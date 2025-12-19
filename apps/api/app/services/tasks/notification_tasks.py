"""
Notification Tasks

Celery tasks for sending push notifications:
- AI-generated motivations at reminder times
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
    frequency: str, days_of_week: list, user_today_weekday: int
) -> bool:
    """
    Check if today is a scheduled work day for the goal/challenge.

    Args:
        frequency: "daily" or "weekly"
        days_of_week: List of day numbers (0=Sunday, 1=Monday, ..., 6=Saturday)
        user_today_weekday: Current weekday in user's timezone (0=Monday in Python, need to convert)

    Returns:
        True if today is a work day, False otherwise
    """
    if frequency == "daily":
        return True

    if frequency == "weekly" and days_of_week:
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
        return our_weekday in days_of_week

    # If no days_of_week specified for weekly, treat as daily
    return True


def calculate_day_number(created_at_str: str, user_today) -> int:
    """
    Calculate which day number the user is on for a goal/challenge.

    Args:
        created_at_str: ISO format datetime string when goal/challenge was created
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
    - Supports both goals AND challenges
    - Checks if today is a work day (based on frequency/days_of_week)
    - Uses user's motivation_style from fitness profile
    - Calculates actual day number (not always day 1!)
    - Only processes active users
    """
    from datetime import datetime, timedelta
    from app.services.expo_push_service import send_push_to_user
    from app.services.push_motivation_generator import generate_push_notification_ai
    import pytz
    import asyncio

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
        # STEP 1: Get users (filter out disabled/suspended if status field exists)
        # ============================================================
        # First try to get users with status filter
        try:
            active_users_result = (
                supabase.table("users")
                .select("id, name, timezone, status")
                .neq("status", "disabled")
                .neq("status", "suspended")
                .execute()
            )
        except Exception:
            # If status field doesn't exist, get all users
            active_users_result = (
                supabase.table("users").select("id, name, timezone").execute()
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
        # STEP 2: Get user fitness profiles for motivation_style
        # ============================================================
        fitness_profiles_result = (
            supabase.table("user_fitness_profiles")
            .select("user_id, motivation_style")
            .in_("user_id", active_user_ids)
            .execute()
        )

        motivation_styles_by_user = {}
        for profile in fitness_profiles_result.data or []:
            motivation_styles_by_user[profile["user_id"]] = profile.get(
                "motivation_style", "supportive"
            )

        # ============================================================
        # STEP 3: Get active goals with reminder times
        # ============================================================
        active_goals_result = (
            supabase.table("goals")
            .select(
                "id, user_id, title, reminder_times, frequency, days_of_week, created_at, is_active"
            )
            .eq("is_active", True)
            .in_("user_id", active_user_ids)
            .execute()
        )

        # ============================================================
        # STEP 4: Get challenges with reminder times (user is participant)
        # Challenge data is in goal_template JSONB, not direct columns
        # challenge_participants has no status - existence means participation
        # ============================================================
        challenge_participants_result = (
            supabase.table("challenge_participants")
            .select(
                """
                user_id, 
                challenge_id,
                joined_at,
                challenges!inner(
                    id, title, start_date, end_date, 
                    challenge_type, is_active, goal_template
                )
                """
            )
            .in_("user_id", active_user_ids)
            .execute()
        )

        # ============================================================
        # STEP 5: Pre-fetch check-ins for all users (batch query)
        # ============================================================
        all_checkins_result = (
            supabase.table("check_ins")
            .select("user_id, goal_id, date, completed")
            .in_("user_id", active_user_ids)
            .order("date", desc=True)
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
        # STEP 6: Pre-fetch notification preferences
        # ============================================================
        prefs_result = (
            supabase.table("notification_preferences")
            .select(
                "user_id, enabled, ai_motivation, quiet_hours_enabled, quiet_hours_start, quiet_hours_end"
            )
            .in_("user_id", active_user_ids)
            .execute()
        )

        prefs_by_user = {}
        for pref in prefs_result.data or []:
            prefs_by_user[pref["user_id"]] = pref

        # ============================================================
        # STEP 7: Build list of items to process (goals + challenges)
        # ============================================================
        items_to_process = []

        # Add goals (already filtered by is_active=True in query, but double-check)
        for goal in active_goals_result.data or []:
            # Safety check - skip if somehow inactive goal got through
            if not goal.get("is_active", True):
                continue

            items_to_process.append(
                {
                    "type": "goal",
                    "id": goal["id"],
                    "user_id": goal["user_id"],
                    "title": goal["title"],
                    "reminder_times": goal.get("reminder_times") or [],
                    "frequency": goal.get("frequency", "daily"),
                    "days_of_week": goal.get("days_of_week") or [],
                    "created_at": goal.get("created_at"),
                    "start_date": None,
                    "end_date": None,
                }
            )

        # Add challenges
        for participant in challenge_participants_result.data or []:
            challenge = participant.get("challenges")
            if not challenge:
                continue

            # Only process active challenges
            if not challenge.get("is_active", False):
                continue

            # Extract goal_template JSONB which contains reminder_times, frequency, days_of_week
            goal_template = challenge.get("goal_template") or {}
            reminder_times = goal_template.get("reminder_times") or []

            # Skip if no reminder times configured
            if not reminder_times:
                continue

            items_to_process.append(
                {
                    "type": "challenge",
                    "id": challenge["id"],
                    "user_id": participant["user_id"],
                    "title": challenge["title"],
                    "reminder_times": reminder_times,
                    "frequency": goal_template.get("frequency", "daily"),
                    "days_of_week": goal_template.get("days_of_week") or [],
                    "created_at": participant.get("joined_at")
                    or challenge.get("start_date"),
                    "start_date": challenge.get("start_date"),
                    "end_date": challenge.get("end_date"),
                }
            )

        # ============================================================
        # STEP 8: Process each item (goal or challenge)
        # ============================================================
        for item in items_to_process:
            item_id = item["id"]
            user_id = item["user_id"]
            item_title = item["title"]
            item_type = item["type"]
            reminder_times = item["reminder_times"]
            frequency = item["frequency"]
            days_of_week = item["days_of_week"]

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
                if current_time not in reminder_times:
                    continue

                # ✅ Check if today is a work day for this item
                if not is_today_a_work_day(
                    frequency, days_of_week, user_today.weekday()
                ):
                    skipped_reasons["not_work_day"] += 1
                    skipped_count += 1
                    print(
                        f"⏭️ Skipping {item_type} '{item_title}' - not a work day (frequency: {frequency}, days: {days_of_week})"
                    )
                    continue

                # ✅ Check if already sent today at this reminder time
                today_str = user_today.isoformat()

                # For goals, check goal_id; for challenges, check challenge_id
                id_column = "goal_id" if item_type == "goal" else "challenge_id"
                already_sent = (
                    supabase.table("motivations")
                    .select("id")
                    .eq(id_column, item_id)
                    .eq("is_sent", True)
                    .eq("sent_date", today_str)
                    .eq("reminder_time", current_time)
                    .execute()
                )

                if already_sent.data:
                    skipped_reasons["already_sent"] += 1
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

                # Get check-ins for streak calculation
                item_checkins = checkins_by_goal.get(item_id, [])

                # Calculate current streak
                current_streak = 0
                if item_checkins:
                    expected_date = user_today
                    for checkin in item_checkins:
                        checkin_date = datetime.fromisoformat(checkin["date"]).date()
                        if checkin_date == expected_date and checkin.get("completed"):
                            current_streak += 1
                            expected_date = expected_date - timedelta(days=1)
                        else:
                            break

                # Calculate day number (how many days since start)
                day_number = calculate_day_number(item["created_at"], user_today)

                # Calculate total days and progress for challenges
                total_days = 0
                progress_percent = 0
                if item_type == "challenge" and item["start_date"] and item["end_date"]:
                    try:
                        start_date = datetime.fromisoformat(
                            item["start_date"].replace("Z", "+00:00")
                        ).date()
                        end_date = datetime.fromisoformat(
                            item["end_date"].replace("Z", "+00:00")
                        ).date()
                        # Total days in challenge (inclusive of both start and end)
                        total_days = (end_date - start_date).days + 1
                        # Days elapsed since start (start_date = Day 0, next day = Day 1, etc.)
                        # If start is Dec 12 and today is Dec 16: (16-12) = 4 days elapsed
                        days_elapsed = (user_today - start_date).days
                        # Ensure at least Day 1 for display purposes
                        day_number = max(1, days_elapsed)
                        # Progress based on days elapsed vs total
                        progress_percent = min(100, (days_elapsed / total_days) * 100)
                    except Exception:
                        pass

                # Calculate recent progress (last 7 days)
                seven_days_ago = user_today - timedelta(days=7)
                recent_checkins = [
                    c
                    for c in item_checkins
                    if datetime.fromisoformat(c["date"]).date() >= seven_days_ago
                ]
                recent_completed = len(
                    [c for c in recent_checkins if c.get("completed")]
                )

                # Get user's motivation style
                motivation_style = motivation_styles_by_user.get(user_id, "supportive")

                # Build user context for AI
                user_context = {
                    "current_streak": current_streak,
                    "recent_completed": recent_completed,
                    "recent_total": max(len(recent_checkins), 7),
                    "time_of_day": (
                        "morning"
                        if user_now.hour < 12
                        else "afternoon" if user_now.hour < 17 else "evening"
                    ),
                    "user_name": user_name,
                    "day_number": day_number,
                    "total_days": total_days,
                    "progress_percent": progress_percent,
                }

                # Generate push notification with motivation style
                push_content = generate_push_notification_ai(
                    goal_title=item_title,
                    user_context=user_context,
                    motivation_style=motivation_style,
                    item_type=item_type,
                )

                # Send push notification
                try:
                    loop = asyncio.get_event_loop()
                    if loop.is_closed():
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                except RuntimeError:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)

                notification_result = loop.run_until_complete(
                    send_push_to_user(
                        user_id=user_id,
                        title=push_content["title"],
                        body=push_content["body"],
                        data={
                            "type": "ai_motivation",
                            "itemType": item_type,
                            "itemId": item_id,
                            "deepLink": (
                                f"/motivation/{item_id}"
                                if item_type == "goal"
                                else f"/challenges/{item_id}"
                            ),
                        },
                        notification_type="ai_motivation",
                        # Generic entity reference for tracking
                        entity_type=item_type,  # 'goal' or 'challenge'
                        entity_id=item_id,
                    )
                )

                if notification_result.get("notification_id"):
                    # Save to database to prevent future duplicates
                    # Use goal_id for goals, challenge_id for challenges
                    motivation_data = {
                        "user_id": user_id,
                        "message": push_content["body"],
                        "message_type": "ai",
                        "is_sent": True,
                        "sent_at": user_now.isoformat(),
                        "sent_date": today_str,
                        "reminder_time": current_time,
                        "scheduled_for": user_now.isoformat(),
                    }

                    if item_type == "goal":
                        motivation_data["goal_id"] = item_id
                    else:
                        motivation_data["challenge_id"] = item_id

                    supabase.table("motivations").insert(motivation_data).execute()

                    sent_count += 1
                    print(
                        f"✅ Sent {item_type} notification to {user_name} ({user_id}) "
                        f"for '{item_title}' at {current_time} ({user_timezone_str}) "
                        f"[Day {day_number}, Streak: {current_streak}, Style: {motivation_style}]"
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
                    f"Failed to process {item_type} {item_id}",
                    {"item_id": item_id, "user_id": user_id, "error": str(e)},
                )
                continue

        print(
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


@celery_app.task(
    name="send_reengagement_notifications",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
)
def send_reengagement_notifications_task(self) -> Dict[str, Any]:
    """
    Send re-engagement notifications to inactive users.
    Runs daily to check for users who haven't checked in for 2+ days.
    Sends motivational push to bring them back.
    """
    from datetime import datetime, timedelta
    from app.services.expo_push_service import send_push_to_user
    import asyncio

    try:
        supabase = get_supabase_client()
        sent_count = 0
        skipped_count = 0

        # Get all users with active goals
        active_users_result = (
            supabase.table("goals")
            .select("user_id, users!inner(name, timezone)")
            .eq("is_active", True)
            .execute()
        )

        if not active_users_result.data:
            return {"success": True, "sent": 0, "skipped": 0}

        # Get unique user IDs
        unique_users = {}
        for goal in active_users_result.data:
            user_id = goal["user_id"]
            if user_id not in unique_users:
                unique_users[user_id] = {
                    "name": goal.get("users", {}).get("name", "Champion"),
                    "timezone": goal.get("users", {}).get("timezone", "UTC"),
                }

        # Check each user's last activity
        for user_id, user_info in unique_users.items():
            try:
                # Get user's last check-in
                last_checkin_result = (
                    supabase.table("check_ins")
                    .select("date, completed")
                    .eq("user_id", user_id)
                    .order("date", desc=True)
                    .limit(1)
                    .execute()
                )

                # Determine if user is inactive
                days_inactive = 0
                if not last_checkin_result.data:
                    # No check-ins at all - send re-engagement
                    days_inactive = 999
                else:
                    last_checkin = last_checkin_result.data[0]
                    last_date = datetime.fromisoformat(last_checkin["date"]).date()
                    today = datetime.now().date()
                    days_inactive = (today - last_date).days

                # Send re-engagement if inactive for 2+ days
                if days_inactive >= 2:
                    # Check notification preferences
                    prefs_result = (
                        supabase.table("notification_preferences")
                        .select("enabled, reengagement")
                        .eq("user_id", user_id)
                        .execute()
                    )

                    # Skip if reengagement notifications disabled
                    if prefs_result.data:
                        prefs = prefs_result.data[0]
                        if not prefs.get("enabled", True) or not prefs.get(
                            "reengagement", True
                        ):
                            skipped_count += 1
                            continue

                    # Personalize message based on inactivity duration
                    user_name = user_info["name"]
                    if days_inactive >= 7:
                        title = f"We miss you, {user_name}! 💪"
                        body = "Your fitness goals are waiting for you. Let's get back on track!"
                    elif days_inactive >= 3:
                        title = f"Hey {user_name}, don't break the chain! 🔥"
                        body = "You've got this! Get back to crushing your goals."
                    else:
                        title = f"Quick reminder, {user_name}! ⏰"
                        body = (
                            "Don't forget to check in today and keep your streak alive!"
                        )

                    # Send push notification
                    try:
                        loop = asyncio.get_event_loop()
                        if loop.is_closed():
                            loop = asyncio.new_event_loop()
                            asyncio.set_event_loop(loop)
                    except RuntimeError:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)

                    notification_result = loop.run_until_complete(
                        send_push_to_user(
                            user_id=user_id,
                            title=title,
                            body=body,
                            data={
                                "type": "reengagement",
                                "deepLink": "/home",
                            },
                            notification_type="reengagement",
                        )
                    )

                    if notification_result.get("notification_id"):
                        sent_count += 1
                        print(
                            f"📬 Sent re-engagement push to user {user_id} ({days_inactive} days inactive)"
                        )
                    else:
                        skipped_count += 1

            except Exception as e:
                logger.warning(
                    f"Failed to process re-engagement for user {user_id}",
                    {"error": str(e), "user_id": user_id},
                )
                continue

        print(
            f"Sent {sent_count} re-engagement notifications, skipped {skipped_count}",
            {"sent": sent_count, "skipped": skipped_count},
        )

        return {
            "success": True,
            "sent": sent_count,
            "skipped": skipped_count,
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

    Flow:
    1. Get all active goals with reminder times
    2. For each goal, find the LAST reminder time of the day
    3. If current time = last_reminder + 30 min:
       - Check if check-in is already completed -> skip
       - Check if prompt already sent today -> skip
       - Otherwise, send "How did it go?" notification

    This ensures users get prompted AFTER they've had time to complete their activity,
    not at check-in creation time (which could be midnight).
    """
    from datetime import datetime, timedelta
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
            .eq("is_active", True)
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

        for goal in active_goals_result.data:
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
                # Sort reminder times and get the last one
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

                # Check if current time matches prompt time (within the minute)
                if current_time_str != prompt_time_str:
                    continue

                # ✅ It's time to potentially send a prompt!
                print(
                    f"📋 [CHECK-IN PROMPT] Checking goal '{goal_title}' for user {user_id} "
                    f"(last reminder: {last_reminder_str}, prompt time: {prompt_time_str})"
                )

                # Check 1: Is check-in already completed today?
                today_checkin = (
                    supabase.table("check_ins")
                    .select("id, completed")
                    .eq("goal_id", goal_id)
                    .eq("user_id", user_id)
                    .eq("date", user_today.isoformat())
                    .execute()
                )

                if today_checkin.data and today_checkin.data[0].get("completed"):
                    print(f"   ⏭️ Skipping - already checked in for goal '{goal_title}'")
                    skipped_already_completed += 1
                    continue

                # Check 2: Did we already send a check-in prompt today for this goal?
                # Use notification_history to track this (type=reminder, subtype=checkin_prompt in data)
                # Filter by user, type, and date - then check goal_id and subtype in Python
                today_reminders = (
                    supabase.table("notification_history")
                    .select("id, data")
                    .eq("user_id", user_id)
                    .eq("notification_type", "reminder")
                    .gte("created_at", user_today.isoformat())
                    .execute()
                )

                # Check if any of today's reminders were check-in prompts for this goal
                already_prompted = any(
                    p.get("data", {}).get("subtype") == "checkin_prompt"
                    and p.get("data", {}).get("goalId") == goal_id
                    for p in (today_reminders.data or [])
                )

                if already_prompted:
                    print(
                        f"   ⏭️ Skipping - already prompted today for goal '{goal_title}'"
                    )
                    skipped_already_prompted += 1
                    continue

                # ✅ Send the check-in prompt notification
                try:
                    from app.services.expo_push_service import send_push_to_user
                    import asyncio

                    # Get or create event loop
                    try:
                        loop = asyncio.get_event_loop()
                        if loop.is_closed():
                            loop = asyncio.new_event_loop()
                            asyncio.set_event_loop(loop)
                    except RuntimeError:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)

                    # Send check-in prompt push notification (uses "reminder" type)
                    notification_result = loop.run_until_complete(
                        send_push_to_user(
                            user_id=user_id,
                            title=f"How did your {goal_title} go? ✅",
                            body=f"Take a moment to check in, {user_name}!",
                            data={
                                "type": "reminder",
                                "subtype": "checkin_prompt",
                                "goalId": goal_id,
                                "deepLink": f"/checkin/{goal_id}",
                            },
                            notification_type="reminder",
                            entity_type="goal",
                            entity_id=goal_id,
                        )
                    )

                    if notification_result.get("notification_id"):
                        sent_count += 1
                        print(
                            f"   ✅ Sent check-in prompt for goal '{goal_title}' to {user_name}"
                        )

                        # Record in notification_history to prevent duplicates
                        # Uses "reminder" type with subtype in data to identify check-in prompts
                        supabase.table("notification_history").insert(
                            {
                                "user_id": user_id,
                                "notification_type": "reminder",
                                "title": f"How did your {goal_title} go? ✅",
                                "body": f"Take a moment to check in, {user_name}!",
                                "data": {
                                    "subtype": "checkin_prompt",
                                    "goalId": goal_id,
                                },
                            }
                        ).execute()

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

        print(
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
    name="cleanup_orphaned_notifications",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def cleanup_orphaned_notifications_task(self, days_old: int = 30) -> Dict[str, Any]:
    """
    Periodic task to clean up orphaned notifications.

    An orphaned notification is one where:
    - entity_type and entity_id are set
    - But the referenced entity no longer exists (was deleted)
    - AND the notification is older than `days_old` days

    This task:
    1. Finds notification_history records with entity references
    2. Checks if those entities still exist in their respective tables
    3. Deletes notifications for entities that no longer exist

    Runs weekly to keep notification_history table clean.

    Args:
        days_old: Only clean up notifications older than this many days (default: 30)

    Returns:
        Dict with counts of cleaned up notifications by entity type
    """
    from datetime import datetime, timedelta

    try:
        supabase = get_supabase_client()
        cutoff_date = (datetime.utcnow() - timedelta(days=days_old)).isoformat()

        cleanup_stats = {
            "goal": 0,
            "challenge": 0,
            "achievement": 0,
            "post": 0,
            "total": 0,
        }

        # Entity type to table mapping
        entity_table_map = {
            "goal": "goals",
            "challenge": "challenges",
            "achievement": "user_achievements",
            "post": "posts",
            "partner_request": "accountability_partners",
            "checkin": "check_ins",
        }

        for entity_type, table_name in entity_table_map.items():
            try:
                # Get notifications with this entity type older than cutoff
                notifications_result = (
                    supabase.table("notification_history")
                    .select("id, entity_id")
                    .eq("entity_type", entity_type)
                    .lt("created_at", cutoff_date)
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

                # Find orphaned notification IDs (entity doesn't exist)
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

                    print(
                        f"🧹 Cleaned up {len(orphaned_notification_ids)} orphaned "
                        f"notifications for deleted {entity_type}s"
                    )

            except Exception as e:
                logger.warning(
                    f"Failed to cleanup orphaned notifications for {entity_type}",
                    {"error": str(e), "entity_type": entity_type},
                )
                continue

        print(
            f"✅ [NOTIFICATION CLEANUP] Total cleaned: {cleanup_stats['total']}",
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
