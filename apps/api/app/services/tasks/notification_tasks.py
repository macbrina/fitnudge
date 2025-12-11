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
    """
    from datetime import datetime, timedelta
    from app.api.v1.endpoints.daily_motivations import generate_daily_motivation_ai
    from app.services.expo_push_service import send_push_to_user
    import pytz

    try:
        supabase = get_supabase_client()
        sent_count = 0
        skipped_count = 0

        # Get all active goals with reminder times (with user name for efficiency)
        active_goals_result = (
            supabase.table("goals")
            .select("id, user_id, title, reminder_times, users!inner(timezone, name)")
            .eq("is_active", True)
            .execute()
        )

        if not active_goals_result.data:
            return {"success": True, "sent": 0, "skipped": 0}

        # Group goals by user to optimize queries
        goals_by_user = {}
        for goal in active_goals_result.data:
            user_id = goal["user_id"]
            if user_id not in goals_by_user:
                goals_by_user[user_id] = []
            goals_by_user[user_id].append(goal)

        # Pre-fetch check-ins for all users (batch query)
        user_ids = list(goals_by_user.keys())
        all_checkins_result = (
            supabase.table("check_ins")
            .select("user_id, goal_id, date, completed")
            .in_("user_id", user_ids)
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

        # Process each goal
        for goal in active_goals_result.data:
            goal_id = goal["id"]
            user_id = goal["user_id"]
            goal_title = goal["title"]
            reminder_times = goal.get("reminder_times") or []

            # Get user's timezone
            user_timezone_str = goal.get("users", {}).get("timezone") or "UTC"

            if not reminder_times or not isinstance(reminder_times, list):
                continue

            try:
                # Get current time in user's timezone
                user_tz = pytz.timezone(user_timezone_str)
                user_now = datetime.now(user_tz)
                user_today = user_now.date()  # User's current date in their timezone
                current_time = user_now.strftime("%H:%M")

                # Check if current time matches any reminder time (within the minute)
                if current_time not in reminder_times:
                    continue

                # ✅ Check if already sent today at this reminder time (prevent duplicates)
                today_str = user_today.isoformat()
                already_sent = (
                    supabase.table("motivations")
                    .select("id")
                    .eq("goal_id", goal_id)
                    .eq("is_sent", True)
                    .eq("sent_date", today_str)
                    .eq("reminder_time", current_time)
                    .execute()
                )

                if already_sent.data:
                    # Already sent today at this time, skip to prevent duplicates
                    skipped_count += 1
                    continue

                # Check user's notification preferences
                prefs_result = (
                    supabase.table("notification_preferences")
                    .select(
                        "enabled, ai_motivation, quiet_hours_enabled, quiet_hours_start, quiet_hours_end"
                    )
                    .eq("user_id", user_id)
                    .execute()
                )

                # Skip if notifications or AI motivation disabled
                if prefs_result.data:
                    prefs = prefs_result.data[0]
                    if not prefs.get("enabled", True) or not prefs.get(
                        "ai_motivation", True
                    ):
                        skipped_count += 1
                        continue

                    # Check quiet hours
                    if prefs.get("quiet_hours_enabled", False):
                        quiet_start = prefs.get("quiet_hours_start", "22:00")
                        quiet_end = prefs.get("quiet_hours_end", "08:00")

                        if is_in_quiet_hours(current_time, quiet_start, quiet_end):
                            skipped_count += 1
                            print(
                                f"Skipping notification for user {user_id} (quiet hours)"
                            )
                            continue

                # Generate SHORT push notification (different from daily motivation)
                try:
                    # Import the new push notification generator
                    from app.services.push_motivation_generator import (
                        generate_push_notification_ai,
                    )

                    # Get user name from already-fetched data (no extra query)
                    user_name = goal.get("users", {}).get("name") or "Champion"

                    # Get check-ins from pre-fetched data (no extra query per goal)
                    goal_checkins = checkins_by_goal.get(goal_id, [])

                    # Calculate current streak for this goal
                    current_streak = 0
                    if goal_checkins:
                        expected_date = user_today
                        for checkin in goal_checkins:  # Already sorted by date desc
                            checkin_date = datetime.fromisoformat(
                                checkin["date"]
                            ).date()
                            if checkin_date == expected_date and checkin.get(
                                "completed"
                            ):
                                current_streak += 1
                                expected_date = expected_date - timedelta(days=1)
                            else:
                                break

                    # Calculate recent progress (last 7 days)
                    seven_days_ago = user_today - timedelta(days=7)
                    recent_checkins = [
                        c
                        for c in goal_checkins
                        if datetime.fromisoformat(c["date"]).date() >= seven_days_ago
                    ]
                    recent_completed = len(
                        [c for c in recent_checkins if c.get("completed")]
                    )
                    recent_total = len(recent_checkins)

                    # Build user context for AI
                    user_context = {
                        "current_streak": current_streak,
                        "recent_completed": recent_completed,
                        "recent_total": max(
                            recent_total, 7
                        ),  # At least 7 for percentage
                        "time_of_day": (
                            "morning"
                            if user_now.hour < 12
                            else "afternoon" if user_now.hour < 17 else "evening"
                        ),
                        "user_name": user_name,
                    }

                    # Generate SHORT push notification (title + body)
                    push_content = generate_push_notification_ai(
                        goal_title=goal_title, user_context=user_context
                    )

                    # Use async in sync context for push sending
                    import asyncio

                    try:
                        loop = asyncio.get_event_loop()
                        if loop.is_closed():
                            loop = asyncio.new_event_loop()
                            asyncio.set_event_loop(loop)
                    except RuntimeError:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)

                    # Send push notification with SHORT AI-generated title and body
                    notification_result = loop.run_until_complete(
                        send_push_to_user(
                            user_id=user_id,
                            title=push_content["title"],  # ✅ Short AI-generated title
                            body=push_content["body"],  # ✅ Short AI-generated body
                            data={
                                "type": "ai_motivation",
                                "goalId": goal_id,
                                "deepLink": f"/motivation/{goal_id}",
                            },
                            notification_type="ai_motivation",
                        )
                    )

                    if notification_result.get("notification_id"):
                        # ✅ Save to database to prevent future duplicates
                        supabase.table("motivations").insert(
                            {
                                "user_id": user_id,
                                "goal_id": goal_id,
                                "message": push_content["body"],
                                "message_type": "ai",
                                "is_sent": True,
                                "sent_at": user_now.isoformat(),
                                "sent_date": today_str,
                                "reminder_time": current_time,
                                "scheduled_for": user_now.isoformat(),
                            }
                        ).execute()

                        sent_count += 1
                        print(
                            f"✅ Sent push notification to user {user_id} for goal {goal_id} at {current_time} ({user_timezone_str})"
                        )
                    else:
                        skipped_count += 1
                        print(f"No active push tokens for user {user_id}")

                except Exception as e:
                    logger.error(
                        f"Failed to generate/send motivation for goal {goal_id}",
                        {"goal_id": goal_id, "user_id": user_id, "error": str(e)},
                    )
                    continue

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

        print(
            f"Sent {sent_count} AI motivations, skipped {skipped_count}",
            {"sent": sent_count, "skipped": skipped_count},
        )

        return {
            "success": True,
            "sent": sent_count,
            "skipped": skipped_count,
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
