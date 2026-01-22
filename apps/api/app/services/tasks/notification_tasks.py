"""
FitNudge V2 - Notification Tasks

Celery tasks for sending push notifications:
- AI-generated motivations at reminder times (goals only)
- Re-engagement notifications for inactive users
- Check-in prompts after last reminder

"""

from typing import Dict, Any
from app.services.tasks.base import (
    celery_app,
    get_supabase_client,
    logger,
    is_in_quiet_hours,
)


# Constants
CHECKIN_PROMPT_DELAY_MINUTES = 30  # Send check-in prompt 30 min after last reminder


def is_today_a_work_day(
    frequency_type: str, target_days: list, user_today_weekday: int
) -> bool:
    """
    Check if today is a scheduled work day for the goal.

    Args:
        frequency_type: "daily" or "weekly"
        target_days: List of day numbers (0=Sunday, 1=Monday, ..., 6=Saturday)
        user_today_weekday: Current weekday in user's timezone (Python: 0=Monday)

    Returns:
        True if today is a work day, False otherwise
    """
    if frequency_type == "daily":
        return True

    if frequency_type == "weekly" and target_days:
        # Python weekday: 0=Monday, 6=Sunday
        # Our format: 0=Sunday, 1=Monday, ..., 6=Saturday
        # Convert Python weekday to our format
        python_to_our_weekday = {
            0: 1,  # Monday -> 1
            1: 2,  # Tuesday -> 2
            2: 3,  # Wednesday -> 3
            3: 4,  # Thursday -> 4
            4: 5,  # Friday -> 5
            5: 6,  # Saturday -> 6
            6: 0,  # Sunday -> 0
        }
        our_weekday = python_to_our_weekday.get(user_today_weekday, user_today_weekday)
        return our_weekday in target_days

    # If no target_days specified for weekly, treat as daily
    return True


def calculate_day_number(created_at_str: str, user_today) -> int:
    """
    Calculate which day number the user is on for a goal.

    Args:
        created_at_str: ISO format datetime string when goal was created
        user_today: User's current date

    Returns:
        Day number (1-indexed)
    """
    from datetime import datetime

    try:
        created_date = datetime.fromisoformat(
            created_at_str.replace("Z", "+00:00")
        ).date()
        day_number = (user_today - created_date).days + 1
        return max(1, day_number)
    except Exception:
        return 1


@celery_app.task(
    name="send_scheduled_ai_motivations",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
)
def send_scheduled_ai_motivations_task(self) -> Dict[str, Any]:
    """
    Send AI-generated motivations to users at their reminder times.
    Runs every minute to check if any user has a reminder scheduled for current time.

    TIMEZONE-AWARE: Checks user's local time against their reminder_times.

    Features:
    - Only handles goals
    - Checks if today is a work day (based on frequency_type/target_days)
    - Uses user's motivation_style from users table
    - Calculates actual day number (not always day 1!)
    - Only processes active users
    """
    from datetime import datetime, timedelta
    from app.services.expo_push_service import send_push_to_user_sync
    from app.services.push_motivation_generator import generate_push_notification_ai
    import pytz

    try:
        supabase = get_supabase_client()
        sent_count = 0
        skipped_count = 0
        skipped_reasons = {
            "not_work_day": 0,
            "inactive_user": 0,
            "already_sent": 0,
            "no_reminder_match": 0,
            "notifications_disabled": 0,
            "quiet_hours": 0,
            "no_push_token": 0,
        }

        # ============================================================
        # STEP 1: Get active users with motivation_style
        # ============================================================
        try:
            active_users_result = (
                supabase.table("users")
                .select("id, name, timezone, status, motivation_style")
                .eq("status", "active")
                .not_.is_("onboarding_completed_at", "null")  # Only onboarded users
                .execute()
            )
        except Exception:
            # Fallback if status filter fails
            active_users_result = (
                supabase.table("users")
                .select("id, name, timezone, motivation_style, onboarding_completed_at")
                .not_.is_("onboarding_completed_at", "null")  # Only onboarded users
                .execute()
            )

        if not active_users_result.data:
            return {
                "success": True,
                "sent": 0,
                "skipped": 0,
                "details": "No users found",
            }

        active_user_ids = [u["id"] for u in active_users_result.data]
        users_by_id = {u["id"]: u for u in active_users_result.data}

        # ============================================================
        # STEP 2: Get active goals with reminder times
        # ============================================================
        active_goals_result = (
            supabase.table("goals")
            .select(
                "id, user_id, title, reminder_times, frequency_type, target_days, "
                "created_at, status, current_streak, why_statement"
            )
            .eq("status", "active")
            .in_("user_id", active_user_ids)
            .execute()
        )

        # ============================================================
        # STEP 3: Pre-fetch check-ins for streak calculation (batch query)
        # ============================================================
        # V2.1: Select status instead of completed for check-in state
        all_checkins_result = (
            supabase.table("check_ins")
            .select("user_id, goal_id, check_in_date, status")
            .in_("user_id", active_user_ids)
            .order("check_in_date", desc=True)
            .execute()
        )

        # Organize check-ins by goal_id for fast lookup
        checkins_by_goal = {}
        for checkin in all_checkins_result.data or []:
            goal_id = checkin["goal_id"]
            if goal_id not in checkins_by_goal:
                checkins_by_goal[goal_id] = []
            checkins_by_goal[goal_id].append(checkin)

        # ============================================================
        # STEP 4: Pre-fetch notification preferences
        # ============================================================
        prefs_result = (
            supabase.table("notification_preferences")
            .select(
                "user_id, enabled, ai_motivation, quiet_hours_enabled, "
                "quiet_hours_start, quiet_hours_end"
            )
            .in_("user_id", active_user_ids)
            .execute()
        )

        prefs_by_user = {}
        for pref in prefs_result.data or []:
            prefs_by_user[pref["user_id"]] = pref

        # ============================================================
        # STEP 5: Process each goal
        # ============================================================
        for goal in active_goals_result.data or []:
            if goal.get("status") != "active":
                continue

            goal_id = goal["id"]
            user_id = goal["user_id"]
            goal_title = goal["title"]
            reminder_times = goal.get("reminder_times") or []
            frequency_type = goal.get("frequency_type", "daily")
            target_days = goal.get("target_days") or []

            if not reminder_times or not isinstance(reminder_times, list):
                continue

            # Get user info
            user_info = users_by_id.get(user_id)
            if not user_info:
                skipped_reasons["inactive_user"] += 1
                skipped_count += 1
                continue

            user_timezone_str = user_info.get("timezone") or "UTC"
            user_name = user_info.get("name") or "Champion"

            try:
                # Get current time in user's timezone
                user_tz = pytz.timezone(user_timezone_str)
                user_now = datetime.now(user_tz)
                user_today = user_now.date()
                current_time = user_now.strftime("%H:%M")

                # ✅ Check if current time matches any reminder time
                # Normalize reminder times (HH:MM:SS -> HH:MM) for comparison
                normalized_reminders = [
                    t[:5] if len(t) >= 5 else t for t in reminder_times
                ]
                if current_time not in normalized_reminders:
                    continue

                # ✅ Check if today is a work day (V2: frequency_type, target_days)
                if not is_today_a_work_day(
                    frequency_type, target_days, user_today.weekday()
                ):
                    skipped_reasons["not_work_day"] += 1
                    skipped_count += 1
                    continue

                # ✅ Check notification preferences
                user_prefs = prefs_by_user.get(user_id, {})
                if not user_prefs.get("enabled", True) or not user_prefs.get(
                    "ai_motivation", True
                ):
                    skipped_reasons["notifications_disabled"] += 1
                    skipped_count += 1
                    continue

                # Check quiet hours
                if user_prefs.get("quiet_hours_enabled", False):
                    quiet_start = user_prefs.get("quiet_hours_start", "22:00")
                    quiet_end = user_prefs.get("quiet_hours_end", "08:00")

                    if is_in_quiet_hours(current_time, quiet_start, quiet_end):
                        skipped_reasons["quiet_hours"] += 1
                        skipped_count += 1
                        continue

                # ============================================================
                # Generate and send push notification
                # ============================================================

                # Use streak from goals table
                current_streak = goal.get("current_streak", 0)

                # Calculate day number (days since goal creation)
                day_number = calculate_day_number(goal.get("created_at"), user_today)

                # Calculate recent progress (last 7 days)
                # V2.1: Use status instead of completed (status = 'completed' means done)
                goal_checkins = checkins_by_goal.get(goal_id, [])
                seven_days_ago = user_today - timedelta(days=7)
                recent_checkins = [
                    c
                    for c in goal_checkins
                    if datetime.fromisoformat(c["check_in_date"]).date()
                    >= seven_days_ago
                ]
                recent_completed = len(
                    [c for c in recent_checkins if c.get("status") == "completed"]
                )

                # Get user's motivation style
                motivation_style = user_info.get("motivation_style", "supportive")

                # Build user context for AI
                why_statement = goal.get("why_statement")
                user_context = {
                    "current_streak": current_streak,
                    "recent_completed": recent_completed,
                    "recent_total": 7,
                    "time_of_day": (
                        "morning"
                        if user_now.hour < 12
                        else "afternoon" if user_now.hour < 17 else "evening"
                    ),
                    "user_name": user_name,
                    "day_number": day_number,
                    "why_statement": why_statement,
                }

                # Generate push notification
                push_content = generate_push_notification_ai(
                    goal_title=goal_title,
                    user_context=user_context,
                    motivation_style=motivation_style,
                    item_type="goal",
                )

                # Deep link for Expo Router
                deep_link = f"/(user)/(goals)/details?id={goal_id}"

                # Use sync version for Celery consistency
                notification_result = send_push_to_user_sync(
                    user_id=user_id,
                    title=push_content["title"],
                    body=push_content["body"],
                    data={
                        "type": "ai_motivation",
                        "itemType": "goal",
                        "itemId": goal_id,
                        "deepLink": deep_link,
                    },
                    notification_type="ai_motivation",
                    entity_type="goal",
                    entity_id=goal_id,
                )

                if notification_result.get("notification_id"):
                    sent_count += 1
                    logger.info(
                        f"Sent goal notification to {user_name} for '{goal_title}'",
                        {
                            "user_id": user_id,
                            "goal_id": goal_id,
                            "time": current_time,
                            "streak": current_streak,
                            "style": motivation_style,
                        },
                    )
                else:
                    skipped_reasons["no_push_token"] += 1
                    skipped_count += 1

            except pytz.exceptions.UnknownTimeZoneError:
                logger.error(
                    f"Invalid timezone for user {user_id}: {user_timezone_str}",
                    {"user_id": user_id, "timezone": user_timezone_str},
                )
                continue
            except Exception as e:
                logger.error(
                    f"Failed to process goal {goal_id}",
                    {"goal_id": goal_id, "user_id": user_id, "error": str(e)},
                )
                continue

        logger.info(
            f"[AI MOTIVATIONS] Sent: {sent_count}, Skipped: {skipped_count}",
            {"sent": sent_count, "skipped": skipped_count, "reasons": skipped_reasons},
        )

        return {
            "success": True,
            "sent": sent_count,
            "skipped": skipped_count,
            "skip_reasons": skipped_reasons,
        }

    except Exception as e:
        logger.error(
            "Failed to send scheduled AI motivations",
            {"error": str(e)},
        )
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        return {"success": False, "error": str(e)}


def _get_scheduled_days_in_range(
    frequency_type: str,
    target_days: list,
    start_date,
    end_date,
) -> list:
    """
    Get all scheduled check-in dates in a date range based on goal schedule.

    Args:
        frequency_type: "daily" or "weekly"
        target_days: List of day numbers (0=Sunday, 1=Monday, ..., 6=Saturday)
        start_date: Start of range (inclusive)
        end_date: End of range (inclusive)

    Returns:
        List of date objects that are scheduled check-in days
    """
    from datetime import timedelta

    scheduled_dates = []
    current = start_date

    # Python weekday to our format: Python 0=Monday, Our 0=Sunday
    python_to_our_weekday = {
        0: 1,  # Monday -> 1
        1: 2,  # Tuesday -> 2
        2: 3,  # Wednesday -> 3
        3: 4,  # Thursday -> 4
        4: 5,  # Friday -> 5
        5: 6,  # Saturday -> 6
        6: 0,  # Sunday -> 0
    }

    while current <= end_date:
        if frequency_type == "daily":
            scheduled_dates.append(current)
        elif frequency_type == "weekly" and target_days:
            our_weekday = python_to_our_weekday.get(
                current.weekday(), current.weekday()
            )
            if our_weekday in target_days:
                scheduled_dates.append(current)
        else:
            # No target_days for weekly = treat as daily
            scheduled_dates.append(current)
        current += timedelta(days=1)

    return scheduled_dates


@celery_app.task(
    name="send_reengagement_notifications",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
)
def send_reengagement_notifications_task(self) -> Dict[str, Any]:
    """
    Send re-engagement notifications to users who have missed scheduled check-ins.

    Logic:
    - Only considers SCHEDULED check-in days based on goal frequency/target_days
    - Sends notification if user has missed 2+ scheduled check-in days
    - Only sends on days that ARE scheduled check-in days for the user
    - Respects notification preferences (enabled, reengagement)
    """
    from datetime import datetime, timedelta
    from zoneinfo import ZoneInfo
    from app.services.expo_push_service import send_push_to_user_sync

    try:
        supabase = get_supabase_client()
        sent_count = 0
        skipped_count = 0
        skipped_reasons = {
            "not_scheduled_today": 0,
            "not_enough_missed": 0,
            "prefs_disabled": 0,
            "too_new": 0,
        }

        # Get all active goals with schedule info and user data
        active_goals_result = (
            supabase.table("goals")
            .select(
                "id, user_id, title, frequency_type, target_days, created_at, "
                "users!inner(name, timezone, onboarding_completed_at)"
            )
            .eq("status", "active")
            .not_.is_("users.onboarding_completed_at", "null")
            .execute()
        )

        if not active_goals_result.data:
            return {"success": True, "sent": 0, "skipped": 0}

        # Group goals by user
        goals_by_user = {}
        user_info_map = {}
        for goal in active_goals_result.data:
            user_id = goal["user_id"]
            if user_id not in goals_by_user:
                goals_by_user[user_id] = []
                user_info_map[user_id] = {
                    "name": goal.get("users", {}).get("name", "Champion"),
                    "timezone": goal.get("users", {}).get("timezone", "UTC"),
                }
            goals_by_user[user_id].append(goal)

        user_ids = list(goals_by_user.keys())

        if not user_ids:
            return {"success": True, "sent": 0, "skipped": 0}

        # Batch fetch: Check-ins from the last 14 days for all users
        lookback_date = (datetime.now().date() - timedelta(days=14)).isoformat()
        all_checkins_result = (
            supabase.table("check_ins")
            .select("user_id, goal_id, check_in_date")
            .in_("user_id", user_ids)
            .gte("check_in_date", lookback_date)
            .execute()
        )

        # Build map of (user_id, goal_id, date) -> has_checkin
        checkins_set = set()
        for checkin in all_checkins_result.data or []:
            key = (checkin["user_id"], checkin["goal_id"], checkin["check_in_date"])
            checkins_set.add(key)

        # Batch fetch: Notification preferences
        prefs_result = (
            supabase.table("notification_preferences")
            .select("user_id, enabled, reengagement")
            .in_("user_id", user_ids)
            .execute()
        )
        prefs_by_user = {p["user_id"]: p for p in prefs_result.data or []}

        # Process each user
        for user_id, goals in goals_by_user.items():
            try:
                user_info = user_info_map[user_id]
                user_tz_str = user_info.get("timezone", "UTC")

                try:
                    user_tz = ZoneInfo(user_tz_str)
                except Exception:
                    user_tz = ZoneInfo("UTC")

                user_now = datetime.now(user_tz)
                user_today = user_now.date()

                # Check notification preferences first
                prefs = prefs_by_user.get(user_id, {})
                if not prefs.get("enabled", True) or not prefs.get(
                    "reengagement", True
                ):
                    skipped_count += 1
                    skipped_reasons["prefs_disabled"] += 1
                    continue

                # Check if today is a scheduled day for ANY of their goals
                is_scheduled_today = False
                for goal in goals:
                    freq = goal.get("frequency_type", "daily")
                    target = goal.get("target_days") or []
                    if is_today_a_work_day(freq, target, user_today.weekday()):
                        is_scheduled_today = True
                        break

                if not is_scheduled_today:
                    skipped_count += 1
                    skipped_reasons["not_scheduled_today"] += 1
                    continue

                # Calculate missed scheduled days across all goals
                # Look back 14 days, but only count days AFTER the goal was created
                total_missed_scheduled_days = 0

                for goal in goals:
                    goal_id = goal["id"]
                    freq = goal.get("frequency_type", "daily")
                    target = goal.get("target_days") or []
                    created_at_str = goal.get("created_at", "")

                    # Parse goal creation date
                    try:
                        goal_created = datetime.fromisoformat(
                            created_at_str.replace("Z", "+00:00")
                        ).date()
                    except Exception:
                        goal_created = user_today - timedelta(days=1)

                    # Only look at days from goal creation to yesterday (not today)
                    range_start = max(goal_created, user_today - timedelta(days=14))
                    range_end = user_today - timedelta(days=1)  # Yesterday

                    if range_start > range_end:
                        # Goal is too new (created today or yesterday)
                        continue

                    # Get scheduled days in this range
                    scheduled_days = _get_scheduled_days_in_range(
                        freq, target, range_start, range_end
                    )

                    # Count how many scheduled days had no check-in
                    for scheduled_date in scheduled_days:
                        key = (user_id, goal_id, scheduled_date.isoformat())
                        if key not in checkins_set:
                            total_missed_scheduled_days += 1

                # Send re-engagement if 2+ scheduled days were missed
                if total_missed_scheduled_days < 2:
                    skipped_count += 1
                    skipped_reasons["not_enough_missed"] += 1
                    continue

                # Personalize message based on missed days
                user_name = user_info["name"]
                if total_missed_scheduled_days >= 7:
                    title = f"We miss you, {user_name}! 💪"
                    body = "Your goals are waiting for you. Let's get back on track!"
                elif total_missed_scheduled_days >= 3:
                    title = f"Hey {user_name}, don't break the chain! 🔥"
                    body = "You've got this! Get back to crushing your goals."
                else:
                    title = f"Quick reminder, {user_name}! ⏰"
                    body = "Don't forget to check in today and keep your streak alive!"

                # Send push notification (skip pref check - already checked above)
                notification_result = send_push_to_user_sync(
                    user_id=user_id,
                    title=title,
                    body=body,
                    data={
                        "type": "reengagement",
                        "deepLink": "/(user)/(tabs)",
                    },
                    notification_type="reengagement",
                    skip_preference_check=True,
                )

                if notification_result.get("notification_id"):
                    sent_count += 1
                    logger.info(
                        f"Sent re-engagement to user {user_id} "
                        f"({total_missed_scheduled_days} scheduled days missed)"
                    )
                else:
                    skipped_count += 1

            except Exception as e:
                logger.warning(
                    f"Failed to process re-engagement for user {user_id}",
                    {"error": str(e), "user_id": user_id},
                )
                continue

        logger.info(
            f"Re-engagement: sent={sent_count}, skipped={skipped_count}",
            {
                "sent": sent_count,
                "skipped": skipped_count,
                "reasons": skipped_reasons,
            },
        )

        return {
            "success": True,
            "sent": sent_count,
            "skipped": skipped_count,
            "skipped_reasons": skipped_reasons,
        }

    except Exception as e:
        logger.error(
            "Failed to send re-engagement notifications",
            {"error": str(e)},
        )
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        return {"success": False, "error": str(e)}


@celery_app.task(
    name="send_checkin_prompts",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def send_checkin_prompts_task(self) -> Dict[str, Any]:
    """
    Send check-in prompts to users 30 minutes after their LAST reminder time of the day.

    TIMEZONE-AWARE: Runs every minute to check if any user needs a check-in prompt.

    V2 Flow (goals only):
    1. Get all active goals with reminder times
    2. For each goal, find the LAST reminder time of the day
    3. If current time = last_reminder + 30 min:
       - Check if check-in is already completed -> skip
       - Check if prompt already sent today -> skip
       - Otherwise, send "How did it go?" notification

    This ensures users get prompted AFTER they've had time to complete their activity.

    SCALABILITY: Uses batch prefetching to avoid N+1 queries.
    """
    from datetime import datetime, timedelta, time as dt_time
    from app.services.expo_push_service import send_push_to_user_sync
    import pytz

    try:
        supabase = get_supabase_client()
        sent_count = 0
        skipped_already_completed = 0
        skipped_already_prompted = 0
        skipped_no_reminders = 0

        # Get all active goals with reminder times and user timezone
        active_goals_result = (
            supabase.table("goals")
            .select("id, user_id, title, reminder_times, users!inner(timezone, name)")
            .eq("status", "active")
            .execute()
        )

        if not active_goals_result.data:
            return {
                "success": True,
                "sent": 0,
                "skipped_completed": 0,
                "skipped_prompted": 0,
                "skipped_no_reminders": 0,
            }

        goals = active_goals_result.data
        goal_ids = [g["id"] for g in goals]
        user_ids = list(set(g["user_id"] for g in goals))

        # SCALABILITY: Batch prefetch check-ins for last 2 days (covers all timezones)
        # We filter precisely by user's local "today" in-memory
        utc_now = datetime.utcnow()
        two_days_ago = (utc_now - timedelta(days=2)).date()
        all_checkins_result = (
            supabase.table("check_ins")
            .select("goal_id, user_id, check_in_date, status")
            .in_("goal_id", goal_ids)
            .gte("check_in_date", str(two_days_ago))
            .execute()
        )

        # Build lookup: (goal_id, date_str) -> has_responded (status != 'pending')
        # V2.1: Check-ins are pre-created with status='pending', so we check if user responded
        checkins_lookup = {}
        for c in all_checkins_result.data or []:
            key = (c["goal_id"], c.get("check_in_date"))
            if key[1]:  # Only if date exists
                status = c.get("status", "pending")
                checkins_lookup[key] = status != "pending"  # True if user has responded

        # SCALABILITY: Batch prefetch prompts from last 48 hours (covers all timezones)
        # UTC-12 to UTC+14 = 26 hour span, so 48 hours is safe
        two_days_ago_utc = (utc_now - timedelta(hours=48)).isoformat()
        existing_prompts_result = (
            supabase.table("notification_history")
            .select("entity_id, user_id, created_at")
            .in_("user_id", user_ids)
            .eq("notification_type", "reminder")
            .eq("entity_type", "goal")
            .gte("created_at", two_days_ago_utc)
            .execute()
        )

        # Build lookup: (goal_id, user_id) -> list of created_at timestamps
        # We'll filter by user's local "today" in the loop
        prompts_by_goal_user = {}
        for p in existing_prompts_result.data or []:
            if p.get("entity_id"):
                key = (p["entity_id"], p["user_id"])
                if key not in prompts_by_goal_user:
                    prompts_by_goal_user[key] = []
                prompts_by_goal_user[key].append(p.get("created_at"))

        for goal in goals:
            goal_id = goal["id"]
            user_id = goal["user_id"]
            goal_title = goal["title"]
            reminder_times = goal.get("reminder_times") or []
            user_name = goal.get("users", {}).get("name") or "Champion"

            # Skip if no reminder times set
            if not reminder_times or not isinstance(reminder_times, list):
                skipped_no_reminders += 1
                continue

            # Get user's timezone
            user_timezone_str = goal.get("users", {}).get("timezone") or "UTC"

            try:
                user_tz = pytz.timezone(user_timezone_str)
                user_now = datetime.now(user_tz)
                user_today = user_now.date()
                current_time_str = user_now.strftime("%H:%M")

                # Find the LAST reminder time of the day
                sorted_reminders = sorted(reminder_times)
                last_reminder_str = sorted_reminders[-1]  # e.g., "18:00"

                # Calculate prompt time (last reminder + 30 min)
                last_reminder_parts = last_reminder_str.split(":")
                last_reminder_hour = int(last_reminder_parts[0])
                last_reminder_minute = int(last_reminder_parts[1])

                # Create datetime for last reminder today
                last_reminder_dt = user_now.replace(
                    hour=last_reminder_hour,
                    minute=last_reminder_minute,
                    second=0,
                    microsecond=0,
                )

                # Add 30 minutes to get prompt time
                prompt_dt = last_reminder_dt + timedelta(
                    minutes=CHECKIN_PROMPT_DELAY_MINUTES
                )
                prompt_time_str = prompt_dt.strftime("%H:%M")

                # Check if current time matches prompt time
                if current_time_str != prompt_time_str:
                    continue

                # ✅ It's time to potentially send a prompt!

                # O(1) lookup: Has user already responded to check-in today?
                # V2.1: Check-ins are pre-created with status='pending'
                checkin_key = (goal_id, str(user_today))
                if checkins_lookup.get(checkin_key, False):
                    skipped_already_completed += 1
                    continue

                # Timezone-aware check: Did we already send a prompt during user's local "today"?
                prompt_timestamps = prompts_by_goal_user.get((goal_id, user_id), [])
                already_prompted = False
                for ts in prompt_timestamps:
                    if ts:
                        try:
                            # Parse UTC timestamp and convert to user's timezone
                            prompt_dt = datetime.fromisoformat(
                                ts.replace("Z", "+00:00")
                            )
                            prompt_local = prompt_dt.astimezone(user_tz)
                            if prompt_local.date() == user_today:
                                already_prompted = True
                                break
                        except Exception:
                            continue

                if already_prompted:
                    skipped_already_prompted += 1
                    continue

                # ✅ Send the check-in prompt notification (sync, non-blocking)
                try:
                    notification_result = send_push_to_user_sync(
                        user_id=user_id,
                        title=f"How did {goal_title} go? ✅",
                        body=f"Hey {user_name}, did you complete {goal_title} today? Tap to check in.",
                        data={
                            "type": "reminder",
                            "subtype": "checkin_prompt",
                            "goalId": goal_id,
                            "deepLink": f"/(user)/(goals)/details?id={goal_id}&openCheckIn=true",
                        },
                        notification_type="reminder",
                        entity_type="goal",
                        entity_id=goal_id,
                    )

                    if (
                        notification_result.get("success")
                        or notification_result.get("delivered", 0) > 0
                    ):
                        sent_count += 1
                        # Add to lookup to avoid duplicate prompts in same run
                        key = (goal_id, user_id)
                        if key not in prompts_by_goal_user:
                            prompts_by_goal_user[key] = []
                        prompts_by_goal_user[key].append(
                            datetime.now(pytz.UTC).isoformat()
                        )
                        logger.info(
                            f"Sent check-in prompt for goal '{goal_title}' to {user_name}"
                        )

                except Exception as push_error:
                    logger.warning(
                        f"Failed to send check-in prompt for goal {goal_id}",
                        {
                            "error": str(push_error),
                            "goal_id": goal_id,
                            "user_id": user_id,
                        },
                    )

            except pytz.exceptions.UnknownTimeZoneError:
                logger.error(
                    f"Invalid timezone for user {user_id}: {user_timezone_str}",
                    {"user_id": user_id, "timezone": user_timezone_str},
                )
                continue
            except Exception as e:
                logger.error(
                    f"Failed to process check-in prompt for goal {goal_id}",
                    {"goal_id": goal_id, "user_id": user_id, "error": str(e)},
                )
                continue

        logger.info(
            f"[CHECK-IN PROMPTS] Sent: {sent_count}, "
            f"Skipped (completed): {skipped_already_completed}, "
            f"Skipped (prompted): {skipped_already_prompted}, "
            f"Skipped (no reminders): {skipped_no_reminders}"
        )

        return {
            "success": True,
            "sent": sent_count,
            "skipped_completed": skipped_already_completed,
            "skipped_prompted": skipped_already_prompted,
            "skipped_no_reminders": skipped_no_reminders,
        }

    except Exception as e:
        logger.error(
            "Failed to send check-in prompts",
            {"error": str(e)},
        )
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        return {"success": False, "error": str(e)}


@celery_app.task(
    name="send_checkin_followups",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def send_checkin_followups_task(self) -> Dict[str, Any]:
    """
    Send 2-hour follow-up notification for missed check-ins.

    TIMEZONE-AWARE: Runs every minute to check if any user needs a follow-up.

    Criteria:
    1. User received a check-in prompt (30 min after last reminder)
    2. It's been 2 hours since the prompt
    3. User still hasn't checked in
    4. It's still the same day (no follow-up for yesterday's missed check-ins)
    5. Haven't sent a follow-up for this goal today

    This is a gentle "I didn't hear back from you" nudge.

    SCALABILITY: Uses batch prefetching to avoid N+1 queries.
    """
    from datetime import datetime, timedelta
    from app.services.expo_push_service import send_push_to_user_sync
    import pytz

    try:
        supabase = get_supabase_client()
        sent_count = 0
        skipped_completed = 0
        skipped_already_followed_up = 0
        skipped_not_time_yet = 0

        # Get all active goals with reminder times and user timezone
        active_goals_result = (
            supabase.table("goals")
            .select("id, user_id, title, reminder_times, users!inner(timezone, name)")
            .eq("status", "active")
            .execute()
        )

        if not active_goals_result.data:
            return {
                "success": True,
                "sent": 0,
                "skipped_completed": 0,
                "skipped_followed_up": 0,
                "skipped_not_time": 0,
            }

        goals = active_goals_result.data
        goal_ids = [g["id"] for g in goals]
        user_ids = list(set(g["user_id"] for g in goals))

        # SCALABILITY: Batch prefetch check-ins for last 2 days (covers all timezones)
        utc_now = datetime.utcnow()
        two_days_ago = (utc_now - timedelta(days=2)).date()
        all_checkins_result = (
            supabase.table("check_ins")
            .select("goal_id, check_in_date, status")
            .in_("goal_id", goal_ids)
            .gte("check_in_date", str(two_days_ago))
            .execute()
        )

        # Build set of (goal_id, date_str) that have RESPONDED check-ins (status != 'pending')
        # V2.1: Check-ins are pre-created with status='pending', so we check if user responded
        checkins_exist = set()
        for c in all_checkins_result.data or []:
            if c.get("check_in_date"):
                status = c.get("status", "pending")
                if status != "pending":
                    checkins_exist.add((c["goal_id"], c["check_in_date"]))

        # SCALABILITY: Batch prefetch follow-ups from last 48 hours (covers all timezones)
        two_days_ago_utc = (utc_now - timedelta(hours=48)).isoformat()
        existing_followups_result = (
            supabase.table("notification_history")
            .select("entity_id, user_id, created_at")
            .in_("user_id", user_ids)
            .eq("notification_type", "reminder")
            .eq("entity_type", "goal")
            .gte("created_at", two_days_ago_utc)
            .ilike("title", "%didn't hear back%")
            .execute()
        )

        # Build lookup: (goal_id, user_id) -> list of created_at timestamps
        followups_by_goal_user = {}
        for f in existing_followups_result.data or []:
            if f.get("entity_id"):
                key = (f["entity_id"], f["user_id"])
                if key not in followups_by_goal_user:
                    followups_by_goal_user[key] = []
                followups_by_goal_user[key].append(f.get("created_at"))

        for goal in goals:
            goal_id = goal["id"]
            user_id = goal["user_id"]
            goal_title = goal["title"]
            reminder_times = goal.get("reminder_times") or []
            user_name = goal.get("users", {}).get("name") or "there"

            if not reminder_times or not isinstance(reminder_times, list):
                continue

            user_timezone_str = goal.get("users", {}).get("timezone") or "UTC"

            try:
                user_tz = pytz.timezone(user_timezone_str)
                user_now = datetime.now(user_tz)
                user_today = user_now.date()
                current_time_str = user_now.strftime("%H:%M")

                # Find the LAST reminder time of the day
                sorted_reminders = sorted(reminder_times)
                last_reminder_str = sorted_reminders[-1]

                # Calculate follow-up time (last reminder + 2.5 hours)
                # 30 min prompt + 2 hour wait = 2.5 hours after last reminder
                last_reminder_parts = last_reminder_str.split(":")
                last_reminder_hour = int(last_reminder_parts[0])
                last_reminder_minute = int(last_reminder_parts[1])

                followup_hour = last_reminder_hour + 2
                followup_minute = last_reminder_minute + 30

                if followup_minute >= 60:
                    followup_minute -= 60
                    followup_hour += 1

                if followup_hour >= 24:
                    # Follow-up would be next day - skip (as per user request)
                    continue

                followup_time_str = f"{followup_hour:02d}:{followup_minute:02d}"

                # Check if current time matches follow-up time (within 1-minute window)
                if current_time_str != followup_time_str:
                    skipped_not_time_yet += 1
                    continue

                # O(1) lookup: Has user already responded to check-in today?
                # V2.1: Check-ins are pre-created with status='pending'
                if (goal_id, str(user_today)) in checkins_exist:
                    skipped_completed += 1
                    continue

                # Timezone-aware check: Did we already send a follow-up during user's local "today"?
                followup_timestamps = followups_by_goal_user.get((goal_id, user_id), [])
                already_followed_up = False
                for ts in followup_timestamps:
                    if ts:
                        try:
                            # Parse UTC timestamp and convert to user's timezone
                            followup_dt = datetime.fromisoformat(
                                ts.replace("Z", "+00:00")
                            )
                            followup_local = followup_dt.astimezone(user_tz)
                            if followup_local.date() == user_today:
                                already_followed_up = True
                                break
                        except Exception:
                            continue

                if already_followed_up:
                    skipped_already_followed_up += 1
                    continue

                # Send the follow-up notification (sync, non-blocking for Celery)
                try:
                    notification_result = send_push_to_user_sync(
                        user_id=user_id,
                        title=f"Hey {user_name}, I didn't hear back 💭",
                        body=f"How did {goal_title} go today? Tap to check in.",
                        data={
                            "type": "reminder",
                            "subtype": "checkin_followup",
                            "goalId": goal_id,
                            "deepLink": f"/(user)/(goals)/details?id={goal_id}&openCheckIn=true",
                        },
                        notification_type="reminder",
                        entity_type="goal",
                        entity_id=goal_id,
                    )

                    if (
                        notification_result.get("success")
                        or notification_result.get("delivered", 0) > 0
                    ):
                        sent_count += 1
                        # Add to lookup to avoid duplicate follow-ups in same run
                        key = (goal_id, user_id)
                        if key not in followups_by_goal_user:
                            followups_by_goal_user[key] = []
                        followups_by_goal_user[key].append(
                            datetime.now(pytz.UTC).isoformat()
                        )
                        logger.info(
                            f"Sent 2hr follow-up for goal '{goal_title}' to {user_name}"
                        )

                except Exception as push_error:
                    logger.warning(
                        f"Failed to send follow-up for goal {goal_id}",
                        {
                            "error": str(push_error),
                            "goal_id": goal_id,
                            "user_id": user_id,
                        },
                    )

            except pytz.exceptions.UnknownTimeZoneError:
                logger.error(
                    f"Invalid timezone for user {user_id}: {user_timezone_str}"
                )
                continue
            except Exception as e:
                logger.error(f"Failed to process follow-up for goal {goal_id}: {e}")
                continue

        print(
            f"[CHECK-IN FOLLOWUPS] Sent: {sent_count}, "
            f"Skipped (completed): {skipped_completed}, "
            f"Skipped (followed up): {skipped_already_followed_up}, "
            f"Skipped (not time): {skipped_not_time_yet}"
        )

        return {
            "success": True,
            "sent": sent_count,
            "skipped_completed": skipped_completed,
            "skipped_followed_up": skipped_already_followed_up,
            "skipped_not_time": skipped_not_time_yet,
        }

    except Exception as e:
        logger.error("Failed to send check-in follow-ups", {"error": str(e)})
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        return {"success": False, "error": str(e)}


@celery_app.task(name="send_streak_milestone_notification")
def send_streak_milestone_notification(
    user_id: str,
    goal_id: str,
    goal_title: str,
    streak: int,
) -> Dict[str, Any]:
    """
    Send streak milestone celebration notification (fire-and-forget from check-in endpoint).

    Called from checkins.py when user hits a milestone (7, 14, 21, 30, 50, 100, etc.)

    This runs in background so user doesn't wait for the notification to be sent.
    """
    from app.services.expo_push_service import send_push_to_user_sync

    try:
        # Celebratory messages for different milestones
        milestone_messages = {
            7: f"🎉 WEEK ONE DONE! 7 days of {goal_title}. You're building something real!",
            14: f"🔥 TWO WEEKS! 14 days strong with {goal_title}. This is becoming a habit!",
            21: f"⭐ 21 DAYS! They say it takes 21 days to form a habit. You did it with {goal_title}!",
            30: f"🏆 ONE MONTH! 30 days of {goal_title}. You're unstoppable!",
            50: f"💪 50 DAY STREAK! Half a century of wins with {goal_title}!",
            100: f"🎊 TRIPLE DIGITS! 100 days of {goal_title}. You're a legend!",
            200: f"🌟 200 DAYS! Six months of consistency with {goal_title}!",
            365: f"👑 ONE FULL YEAR! 365 days of {goal_title}. You're extraordinary!",
            500: f"🚀 500 DAYS! That's almost 1.5 years of {goal_title}!",
            730: f"🎖️ TWO YEARS! 730 days of {goal_title}. Absolute champion!",
            1000: f"💎 1000 DAYS! You've mastered {goal_title}. Living legend status!",
        }

        message = milestone_messages.get(
            streak, f"🎉 {streak} day streak! Amazing work with {goal_title}!"
        )

        result = send_push_to_user_sync(
            user_id=user_id,
            title=f"🎉 {streak} Day Milestone!",
            body=message,
            data={
                "type": "streak_milestone",
                "goalId": goal_id,
                "streak": streak,
                "deepLink": f"/(user)/(goals)/details?id={goal_id}",
            },
            notification_type="streak_milestone",
            entity_type="goal",
            entity_id=goal_id,
        )

        if result.get("success") or result.get("delivered", 0) > 0:
            logger.info(
                f"Sent streak milestone notification: {streak} days for user {user_id}"
            )
            return {"success": True, "streak": streak}
        else:
            return {"success": False, "error": "No devices delivered"}

    except Exception as e:
        logger.error(f"Failed to send streak milestone notification: {e}")
        return {"success": False, "error": str(e)}


@celery_app.task(
    name="notify_inactive_partners",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def notify_inactive_partners_task(self) -> Dict[str, Any]:
    """
    Notify users when their accountability partner has been inactive.

    Runs daily to check for inactive partners and send encouragement prompts.

    Logic:
    1. Get all active partnerships (status = 'accepted')
    2. For each partnership, check if either partner has been inactive for X days
    3. Send notification to the active partner: "Your partner X hasn't checked in for Y days. Send encouragement?"

    Inactivity threshold: 3 days (configurable)
    Only sends ONE notification per partnership per day to avoid spam.

    SCALABILITY: Uses batch prefetching to avoid N+1 queries.
    """
    from datetime import datetime, timedelta
    from app.services.expo_push_service import send_push_to_user_sync

    INACTIVE_THRESHOLD_DAYS = 3  # Days of no check-ins before considered inactive

    try:
        supabase = get_supabase_client()
        sent_count = 0
        skipped_count = 0
        skipped_reasons = {
            "not_inactive": 0,
            "already_notified": 0,
            "notifications_disabled": 0,
            "no_push_token": 0,
        }

        # ============================================================
        # STEP 1: Get all active partnerships
        # ============================================================
        partnerships_result = (
            supabase.table("accountability_partners")
            .select("id, user_id, partner_user_id, created_at")
            .eq("status", "accepted")
            .execute()
        )

        if not partnerships_result.data:
            return {
                "success": True,
                "sent": 0,
                "skipped": 0,
                "details": "No active partnerships found",
            }

        partnerships = partnerships_result.data

        # Collect all unique user IDs
        all_user_ids = set()
        for p in partnerships:
            all_user_ids.add(p["user_id"])
            all_user_ids.add(p["partner_user_id"])
        all_user_ids = list(all_user_ids)

        # ============================================================
        # STEP 2: Batch fetch user info (names)
        # ============================================================
        users_result = (
            supabase.table("users")
            .select("id, name, status")
            .in_("id", all_user_ids)
            .execute()
        )

        users_by_id = {u["id"]: u for u in (users_result.data or [])}

        # ============================================================
        # STEP 3: Batch fetch last check-in dates for all users
        # ============================================================
        today = datetime.utcnow().date()
        thirty_days_ago = today - timedelta(days=30)

        checkins_result = (
            supabase.table("check_ins")
            .select("user_id, check_in_date")
            .in_("user_id", all_user_ids)
            .gte("check_in_date", str(thirty_days_ago))
            .order("check_in_date", desc=True)
            .execute()
        )

        # Build map of user_id -> last_check_in_date
        last_checkin_by_user = {}
        for c in checkins_result.data or []:
            uid = c["user_id"]
            if uid not in last_checkin_by_user:
                last_checkin_by_user[uid] = c["check_in_date"]

        # ============================================================
        # STEP 4: Batch fetch notification preferences
        # ============================================================
        prefs_result = (
            supabase.table("notification_preferences")
            .select("user_id, enabled, partner_nudges")
            .in_("user_id", all_user_ids)
            .execute()
        )

        prefs_by_user = {p["user_id"]: p for p in (prefs_result.data or [])}

        # ============================================================
        # STEP 5: Batch fetch existing partner_inactive notifications (last 24h)
        # ============================================================
        yesterday = (datetime.utcnow() - timedelta(hours=24)).isoformat()
        existing_notifications_result = (
            supabase.table("notification_history")
            .select("user_id, entity_id")
            .in_("user_id", all_user_ids)
            .eq("notification_type", "partner_inactive")
            .gte("created_at", yesterday)
            .execute()
        )

        # Build set of (recipient_user_id, partner_user_id) already notified
        already_notified = set()
        for n in existing_notifications_result.data or []:
            # entity_id stores the inactive partner's user_id
            already_notified.add((n["user_id"], n.get("entity_id")))

        # ============================================================
        # STEP 6: Process each partnership
        # ============================================================
        for partnership in partnerships:
            user_a_id = partnership["user_id"]
            user_b_id = partnership["partner_user_id"]
            partnership_id = partnership["id"]

            # Check both directions: A notifies about B, B notifies about A
            for recipient_id, inactive_partner_id in [
                (user_a_id, user_b_id),
                (user_b_id, user_a_id),
            ]:
                try:
                    # Skip if already notified today
                    if (recipient_id, inactive_partner_id) in already_notified:
                        skipped_reasons["already_notified"] += 1
                        skipped_count += 1
                        continue

                    # Get inactive partner's info
                    inactive_user = users_by_id.get(inactive_partner_id)
                    if not inactive_user or inactive_user.get("status") != "active":
                        continue

                    partner_name = inactive_user.get("name") or "Your partner"

                    # Calculate days inactive
                    last_checkin_str = last_checkin_by_user.get(inactive_partner_id)
                    if last_checkin_str:
                        last_checkin_date = datetime.fromisoformat(
                            last_checkin_str
                        ).date()
                        days_inactive = (today - last_checkin_date).days
                    else:
                        # Never checked in - consider very inactive
                        days_inactive = 999

                    # Only notify if partner is inactive for threshold days
                    if days_inactive < INACTIVE_THRESHOLD_DAYS:
                        skipped_reasons["not_inactive"] += 1
                        skipped_count += 1
                        continue

                    # Check recipient's notification preferences
                    recipient_prefs = prefs_by_user.get(recipient_id, {})
                    if not recipient_prefs.get(
                        "enabled", True
                    ) or not recipient_prefs.get("partner_nudges", True):
                        skipped_reasons["notifications_disabled"] += 1
                        skipped_count += 1
                        continue

                    # ✅ Send the notification
                    title = "Check on Partner"
                    body = f"💙 {partner_name} hasn't checked in for {days_inactive} days. Send some encouragement?"

                    notification_result = send_push_to_user_sync(
                        user_id=recipient_id,
                        title=title,
                        body=body,
                        data={
                            "type": "partner_inactive",
                            "partnerId": inactive_partner_id,
                            "partnershipId": partnership_id,
                            "daysInactive": days_inactive,
                            "deepLink": "/(user)/profile/partners",
                        },
                        notification_type="partner_inactive",
                        entity_type="user",
                        entity_id=inactive_partner_id,
                    )

                    if notification_result.get("notification_id"):
                        sent_count += 1
                        already_notified.add((recipient_id, inactive_partner_id))
                        logger.info(
                            f"Sent partner_inactive notification",
                            {
                                "recipient_id": recipient_id,
                                "inactive_partner_id": inactive_partner_id,
                                "days_inactive": days_inactive,
                            },
                        )
                    else:
                        skipped_reasons["no_push_token"] += 1
                        skipped_count += 1

                except Exception as e:
                    logger.warning(
                        f"Failed to process partner inactive notification",
                        {
                            "recipient_id": recipient_id,
                            "inactive_partner_id": inactive_partner_id,
                            "error": str(e),
                        },
                    )
                    continue

        logger.info(
            f"[PARTNER INACTIVE] Sent: {sent_count}, Skipped: {skipped_count}",
            {"sent": sent_count, "skipped": skipped_count, "reasons": skipped_reasons},
        )

        return {
            "success": True,
            "sent": sent_count,
            "skipped": skipped_count,
            "skip_reasons": skipped_reasons,
        }

    except Exception as e:
        logger.error(
            "Failed to send partner inactive notifications",
            {"error": str(e)},
        )
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        return {"success": False, "error": str(e)}


@celery_app.task(
    name="cleanup_orphaned_notifications",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def cleanup_orphaned_notifications_task(self) -> Dict[str, Any]:
    """
    Periodic task to clean up orphaned notifications.

    An orphaned notification is one where:
    - entity_type and entity_id are set
    - But the referenced entity no longer exists (was deleted)

    Only handles goals, achievements, social entities.

    Runs weekly to keep notification_history table clean.
    """
    try:
        supabase = get_supabase_client()

        # Entity type to table mapping
        # Must match entity_type values in notification_history table
        # Used by cleanup task to find notifications referencing deleted entities
        entity_table_map = {
            # Core entities
            "goal": "goals",
            "achievement": "user_achievements",
            "nudge": "social_nudges",
            # User entities (for partner_inactive notifications)
            "user": "users",
            # Other entities
            "checkin": "check_ins",
            "weekly_recap": "weekly_recaps",
        }

        # Initialize stats
        cleanup_stats = {entity_type: 0 for entity_type in entity_table_map}
        cleanup_stats["total"] = 0

        for entity_type, table_name in entity_table_map.items():
            try:
                # Get notifications with this entity type
                notifications_result = (
                    supabase.table("notification_history")
                    .select("id, entity_id")
                    .eq("entity_type", entity_type)
                    .not_.is_("entity_id", "null")
                    .execute()
                )

                if not notifications_result.data:
                    continue

                # Get unique entity IDs
                entity_ids = list(
                    set(
                        n["entity_id"]
                        for n in notifications_result.data
                        if n["entity_id"]
                    )
                )

                if not entity_ids:
                    continue

                # Check which entities still exist
                existing_result = (
                    supabase.table(table_name)
                    .select("id")
                    .in_("id", entity_ids)
                    .execute()
                )

                existing_ids = set(e["id"] for e in (existing_result.data or []))

                # Find orphaned notification IDs
                orphaned_notification_ids = [
                    n["id"]
                    for n in notifications_result.data
                    if n["entity_id"] and n["entity_id"] not in existing_ids
                ]

                if orphaned_notification_ids:
                    # Delete orphaned notifications in batches
                    batch_size = 100
                    for i in range(0, len(orphaned_notification_ids), batch_size):
                        batch = orphaned_notification_ids[i : i + batch_size]
                        supabase.table("notification_history").delete().in_(
                            "id", batch
                        ).execute()

                    cleanup_stats[entity_type] = len(orphaned_notification_ids)
                    cleanup_stats["total"] += len(orphaned_notification_ids)

                    logger.info(
                        f"Cleaned up {len(orphaned_notification_ids)} orphaned "
                        f"notifications for deleted {entity_type}s"
                    )

            except Exception as e:
                logger.warning(
                    f"Failed to cleanup orphaned notifications for {entity_type}",
                    {"error": str(e), "entity_type": entity_type},
                )
                continue

        logger.info(
            f"[NOTIFICATION CLEANUP] Total cleaned: {cleanup_stats['total']}",
            {"stats": cleanup_stats},
        )

        return {
            "success": True,
            "cleaned_up": cleanup_stats,
        }

    except Exception as e:
        logger.error(
            "Failed to cleanup orphaned notifications",
            {"error": str(e)},
        )
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        return {"success": False, "error": str(e)}


@celery_app.task(
    name="cleanup_blocked_partnership_nudges",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def cleanup_blocked_partnership_nudges_task(self) -> Dict[str, Any]:
    """
    Periodic task to clean up social_nudges for blocked partnerships.

    Finds all partnerships with status 'blocked' and deletes their associated
    social_nudges. This serves as a safety net in case fire-and-forget cleanup
    fails or for legacy data from before cleanup was implemented.

    Also cleans up notification_history for blocked partnerships.

    Runs weekly alongside cleanup_orphaned_notifications.
    """
    try:
        supabase = get_supabase_client()

        # Find all blocked partnerships
        blocked_partnerships = (
            supabase.table("accountability_partners")
            .select("id")
            .eq("status", "blocked")
            .execute()
        )

        if not blocked_partnerships.data:
            logger.info("[BLOCKED CLEANUP] No blocked partnerships found")
            return {
                "success": True,
                "blocked_partnerships": 0,
                "nudges_deleted": 0,
                "notifications_deleted": 0,
            }

        partnership_ids = [p["id"] for p in blocked_partnerships.data]
        total_nudges_deleted = 0
        total_notifications_deleted = 0

        # Process in batches to avoid query limits
        batch_size = 100
        for i in range(0, len(partnership_ids), batch_size):
            batch_ids = partnership_ids[i : i + batch_size]

            # First get all nudge IDs for these partnerships
            nudges_query = (
                supabase.table("social_nudges")
                .select("id")
                .in_("partnership_id", batch_ids)
                .execute()
            )
            nudge_ids = [n["id"] for n in (nudges_query.data or [])]

            # Delete notifications for these nudges
            if nudge_ids:
                notif_result = (
                    supabase.table("notification_history")
                    .delete()
                    .eq("entity_type", "nudge")
                    .in_("entity_id", nudge_ids)
                    .execute()
                )
                total_notifications_deleted += len(notif_result.data or [])

            # Delete social_nudges for blocked partnerships
            nudges_result = (
                supabase.table("social_nudges")
                .delete()
                .in_("partnership_id", batch_ids)
                .execute()
            )
            total_nudges_deleted += len(nudges_result.data or [])

        logger.info(
            f"[BLOCKED CLEANUP] Completed",
            {
                "blocked_partnerships": len(partnership_ids),
                "nudges_deleted": total_nudges_deleted,
                "notifications_deleted": total_notifications_deleted,
            },
        )

        return {
            "success": True,
            "blocked_partnerships": len(partnership_ids),
            "nudges_deleted": total_nudges_deleted,
            "notifications_deleted": total_notifications_deleted,
        }

    except Exception as e:
        logger.error(
            "Failed to cleanup blocked partnership nudges",
            {"error": str(e)},
        )
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        return {"success": False, "error": str(e)}
