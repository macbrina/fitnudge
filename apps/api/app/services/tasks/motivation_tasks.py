"""
FitNudge V2 - Motivation Celery Tasks

Background tasks for:
1. Generating AI check-in responses (premium users)
2. Generating and sending daily motivations (morning scheduler)

These run in the background so users don't wait for AI generation.
"""

from app.core.celery_app import celery_app
from app.services.logger import logger
import asyncio


def run_async(coro):
    """Helper to run async functions in Celery tasks."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


@celery_app.task(name="generate_checkin_ai_response", bind=True, max_retries=2)
def generate_checkin_ai_response(self, checkin_id: str, user_id: str, goal_id: str):
    """
    Background task to generate AI response for a check-in.

    Updates check_ins.ai_response in database.
    Frontend receives update via Supabase Realtime.

    Only called for PREMIUM users.
    """
    from app.core.database import get_supabase_client
    from app.services.motivation_service import generate_checkin_motivation

    try:
        supabase = get_supabase_client()

        # Get user, goal, and check-in data
        user = (
            supabase.table("users")
            .select("name, motivation_style, plan")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        goal = (
            supabase.table("goals")
            .select("title, current_streak, longest_streak, why_statement")
            .eq("id", goal_id)
            .maybe_single()
            .execute()
        )
        checkin = (
            supabase.table("check_ins")
            .select("*")
            .eq("id", checkin_id)
            .maybe_single()
            .execute()
        )

        if not all([user.data, goal.data, checkin.data]):
            logger.error(
                f"Missing data for AI response: user={bool(user.data)}, "
                f"goal={bool(goal.data)}, checkin={bool(checkin.data)}"
            )
            return

        user_data = user.data
        goal_data = goal.data
        checkin_data = checkin.data

        # Generate AI response
        ai_response = run_async(
            generate_checkin_motivation(
                user_name=user_data.get("name", "there"),
                goal_title=goal_data.get("title", "your goal"),
                completed=checkin_data.get("completed", False),
                is_rest_day=checkin_data.get("is_rest_day", False),
                mood=checkin_data.get("mood"),
                skip_reason=checkin_data.get("skip_reason"),
                current_streak=goal_data.get("current_streak", 0),
                longest_streak=goal_data.get("longest_streak", 0),
                why_statement=goal_data.get("why_statement"),
                motivation_style=user_data.get("motivation_style", "supportive"),
                is_premium=True,  # This task is only for premium users
            )
        )

        # Update check-in with AI response
        supabase.table("check_ins").update({"ai_response": ai_response}).eq(
            "id", checkin_id
        ).execute()

        logger.info(f"Generated AI response for check-in {checkin_id}")

    except Exception as e:
        logger.error(f"Failed to generate AI response for check-in {checkin_id}: {e}")
        raise self.retry(exc=e, countdown=30)  # Retry in 30 seconds


@celery_app.task(name="send_morning_motivations")
def send_morning_motivations():
    """
    V2 Scheduler task to send goal-specific pre-check-in morning notifications.

    Runs every minute, finds users whose morning_motivation_time
    matches the current time (in their timezone).

    Per FITNUDGE_V2_SPEC.md (lines 125-131):
    - Goal-specific morning prep message: "Today's the day for workout #3 this week"
    - If single goal scheduled: deep link to that goal
    - If multiple goals scheduled: deep link to home tab
    - Uses templates based on motivation_style for efficiency (no AI overhead)

    NOTE: This is different from generate_daily_motivation which powers MotivationCard.tsx
    with AI-generated motivational quotes. This task sends goal-specific prep reminders.

    Per SCALABILITY.md:
    - Batch prefetch goals for all eligible users
    - In-memory filtering for scheduled goals
    """
    from app.core.database import get_supabase_client
    from app.services.expo_push_service import send_push_to_user_sync
    from datetime import datetime, timedelta
    import pytz

    supabase = get_supabase_client()
    sent_count = 0

    # =========================================
    # 1. Get users with morning motivation enabled
    # =========================================
    users = (
        supabase.table("users")
        .select("id, name, timezone, morning_motivation_time, motivation_style")
        .eq("morning_motivation_enabled", True)
        .eq("status", "active")
        .not_.is_("onboarding_completed_at", "null")  # Only onboarded users
        .execute()
    )

    if not users.data:
        return {"sent": 0}

    # =========================================
    # 2. Filter users whose time matches NOW (in their timezone)
    # =========================================
    eligible_user_ids = []
    user_map = {}  # user_id -> user data + local weekday

    for user in users.data:
        user_id = user["id"]
        user_timezone = user.get("timezone", "UTC")
        motivation_time = user.get("morning_motivation_time", "08:00")

        # Parse user's motivation time
        try:
            hour, minute = map(int, motivation_time.split(":"))
        except ValueError:
            hour, minute = 8, 0

        # Get current time in user's timezone
        try:
            user_tz = pytz.timezone(user_timezone)
            user_now = datetime.now(user_tz)
        except Exception:
            continue

        # Check if it's the right time (within 1 minute window)
        if user_now.hour != hour or user_now.minute != minute:
            continue

        eligible_user_ids.append(user_id)
        user_map[user_id] = {
            **user,
            "local_weekday": user_now.weekday(),  # 0=Monday, 6=Sunday
            "local_date": user_now.date().isoformat(),
        }

    if not eligible_user_ids:
        return {"sent": 0}

    # =========================================
    # 3. Batch prefetch active goals for all eligible users
    # =========================================
    goals_result = (
        supabase.table("goals")
        .select("id, user_id, title, frequency_type, target_days, current_streak")
        .in_("user_id", eligible_user_ids)
        .eq("status", "active")
        .execute()
    )

    # Build user_id -> [goals scheduled for today]
    user_goals_today: dict = {uid: [] for uid in eligible_user_ids}

    for goal in goals_result.data or []:
        user_id = goal["user_id"]
        if user_id not in user_map:
            continue

        user_weekday = user_map[user_id]["local_weekday"]
        frequency_type = goal.get("frequency_type", "daily")
        target_days = goal.get("target_days") or []

        # Check if goal is scheduled for today
        is_scheduled = False
        if frequency_type == "daily":
            is_scheduled = True
        elif frequency_type == "weekly" and target_days:
            is_scheduled = user_weekday in target_days

        if is_scheduled:
            user_goals_today[user_id].append(goal)

    # =========================================
    # 4. Batch check for already-sent notifications today (deduplication)
    # =========================================
    # Get today's date range in UTC for notification history check
    utc_now = datetime.utcnow()
    today_start_utc = utc_now.replace(hour=0, minute=0, second=0, microsecond=0)

    sent_today_result = (
        supabase.table("notification_history")
        .select("user_id")
        .in_("user_id", eligible_user_ids)
        .eq("notification_type", "ai_motivation")
        .gte("sent_at", today_start_utc.isoformat())
        .execute()
    )
    already_sent_user_ids = set(n["user_id"] for n in (sent_today_result.data or []))

    # =========================================
    # 5. Send goal-specific morning notifications
    # =========================================
    for user_id, goals_today in user_goals_today.items():
        if not goals_today:
            continue  # No goals scheduled for today

        if user_id in already_sent_user_ids:
            continue  # Already sent today

        user = user_map[user_id]
        user_name = user.get("name", "there")
        motivation_style = user.get("motivation_style", "supportive")

        try:
            # Generate template-based message
            title, body, deep_link = _generate_goal_prep_message(
                user_name=user_name,
                goals=goals_today,
                motivation_style=motivation_style,
            )

            # Build data payload
            data = {
                "type": "goal_prep",
                "deepLink": deep_link,
            }

            # If single goal, include goalId for navigation
            if len(goals_today) == 1:
                data["goalId"] = goals_today[0]["id"]
                data["entity_type"] = "goal"
                data["entity_id"] = goals_today[0]["id"]

            send_push_to_user_sync(
                user_id=user_id,
                title=title,
                body=body,
                data=data,
                notification_type="ai_motivation",
                entity_type="goal" if len(goals_today) == 1 else None,
                entity_id=goals_today[0]["id"] if len(goals_today) == 1 else None,
                skip_preference_check=True,  # Already checked morning_motivation_enabled in users table
            )

            sent_count += 1

        except Exception as e:
            logger.warning(f"Failed to send morning motivation to user {user_id}: {e}")

    logger.info(f"Morning goal prep notifications: sent={sent_count}")
    return {"sent": sent_count}


def _generate_goal_prep_message(
    user_name: str,
    goals: list,
    motivation_style: str,
) -> tuple:
    """
    Generate a template-based goal prep message.

    Returns: (title, body, deep_link)

    Templates based on motivation_style:
    - supportive: Warm, encouraging
    - tough_love: Direct, challenging
    - calm: Patient, balanced
    """
    import random

    single_goal = len(goals) == 1

    if single_goal:
        goal = goals[0]
        goal_title = goal.get("title", "your goal")
        streak = goal.get("current_streak", 0)
        goal_id = goal["id"]
        deep_link = f"/(user)/(goals)/details?id={goal_id}"

        # Templates for single goal
        if motivation_style == "tough_love":
            titles = [
                f"Time to crush it, {user_name}! 💪",
                f"No excuses today, {user_name}!",
                f"Let's go, {user_name}! 🔥",
            ]
            if streak > 0:
                bodies = [
                    f"{streak}-day streak on {goal_title}. Don't break it now.",
                    f"You've got {streak} days. Make it {streak + 1}.",
                    f"{goal_title} - day {streak + 1} starts now.",
                ]
            else:
                bodies = [
                    f"{goal_title} is waiting. Get it done.",
                    f"Today's the day for {goal_title}. No shortcuts.",
                    f"{goal_title} - let's build that streak.",
                ]
        elif motivation_style == "calm":
            titles = [
                f"Good morning, {user_name} 🌅",
                f"A new day awaits, {user_name}",
                f"Ready when you are, {user_name} ✨",
            ]
            if streak > 0:
                bodies = [
                    f"Day {streak + 1} of {goal_title}. One step at a time.",
                    f"Your {streak}-day journey with {goal_title} continues today.",
                    f"{goal_title} - another day to show up for yourself.",
                ]
            else:
                bodies = [
                    f"Today is a fresh start for {goal_title}.",
                    f"{goal_title} awaits when you're ready.",
                    f"A new opportunity for {goal_title} today.",
                ]
        else:  # supportive (default)
            titles = [
                f"Hey {user_name}! ☀️",
                f"Good morning, {user_name}! ✨",
                f"Rise and shine, {user_name}! 🌟",
            ]
            if streak > 0:
                bodies = [
                    f"You're on a {streak}-day streak with {goal_title}! Keep it going! 🔥",
                    f"Day {streak + 1} of {goal_title} - you've got this!",
                    f"{goal_title} streak: {streak} days! Let's add another! 💪",
                ]
            else:
                bodies = [
                    f"Today's the day for {goal_title}! You've got this! 💪",
                    f"Ready to tackle {goal_title}? I believe in you!",
                    f"{goal_title} is calling - let's make it happen! ✨",
                ]

        title = random.choice(titles)
        body = random.choice(bodies)

    else:
        # Multiple goals - deep link to home
        deep_link = "/(user)/(tabs)/home"
        goal_count = len(goals)

        # Get best streak among goals
        best_streak = max((g.get("current_streak", 0) for g in goals), default=0)

        # List goal titles (max 3)
        goal_titles = [g.get("title", "goal") for g in goals[:3]]
        goals_str = ", ".join(goal_titles)
        if len(goals) > 3:
            goals_str += f", +{len(goals) - 3} more"

        if motivation_style == "tough_love":
            titles = [
                f"{goal_count} goals today, {user_name}. Let's go! 💪",
                f"Big day ahead, {user_name}! 🔥",
                f"No slacking, {user_name}! {goal_count} goals waiting.",
            ]
            bodies = [
                f"On deck: {goals_str}. Get after it.",
                f"{goals_str} - knock them all out.",
                f"You've got {goal_count} to tackle. Start strong.",
            ]
        elif motivation_style == "calm":
            titles = [
                f"Good morning, {user_name} 🌅",
                f"A full day ahead, {user_name}",
                f"Ready for today, {user_name}? ✨",
            ]
            bodies = [
                f"Today: {goals_str}. Take it one at a time.",
                f"{goal_count} goals scheduled. You've done this before.",
                f"Your goals for today: {goals_str}.",
            ]
        else:  # supportive
            titles = [
                f"Hey {user_name}! ☀️",
                f"Good morning, {user_name}! ✨",
                f"Big day ahead, {user_name}! 🌟",
            ]
            if best_streak > 0:
                bodies = [
                    f"You have {goal_count} goals today! Best streak: {best_streak} days! 🔥",
                    f"{goals_str} - you're on a roll with {best_streak} days! Keep going!",
                    f"{goal_count} goals scheduled. You've got this! 💪",
                ]
            else:
                bodies = [
                    f"You have {goal_count} goals today: {goals_str}. Let's do this! 💪",
                    f"{goals_str} are on your list. I believe in you!",
                    f"{goal_count} goals to tackle today. You've got this! ✨",
                ]

        title = random.choice(titles)
        body = random.choice(bodies)

    return title, body, deep_link
