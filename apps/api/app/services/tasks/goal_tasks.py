"""
Goal Tasks

Celery tasks for goal-related operations like check-in creation and completion checks.
"""

from typing import Dict, Any
from app.services.tasks.base import celery_app, get_supabase_client, logger


@celery_app.task(
    name="auto_create_daily_checkins",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
)
def auto_create_daily_checkins_task(self) -> Dict[str, Any]:
    """
    Celery task to automatically create check-ins for active goals.
    TIMEZONE-AWARE: Runs hourly to ensure today's check-in exists.
    - Daily goals: creates check-in for today if missing
    - Weekly goals: creates check-in for today if today is in days_of_week
    - Prevents duplicates: checks for existing check-in before creating
    """
    from datetime import datetime
    import pytz

    try:
        supabase = get_supabase_client()
        created_count = 0
        skipped_count = 0
        processed_users = set()

        # Get all active goals with user timezone
        # Join with users table to get timezone
        active_goals_result = (
            supabase.table("goals")
            .select(
                "id, user_id, title, frequency, days_of_week, users!inner(timezone)"
            )
            .eq("is_active", True)
            .execute()
        )

        if not active_goals_result.data:
            print("❌ [CHECK-IN TASK] No active goals found for check-in creation")
            return {"success": True, "processed": 0, "created": 0, "skipped": 0}

        for goal in active_goals_result.data:
            goal_id = goal["id"]
            user_id = goal["user_id"]
            goal_title = goal.get("title", "Unknown")
            frequency = goal["frequency"]
            days_of_week = goal.get("days_of_week") or []

            # Get user's timezone (default to UTC if not set)
            user_timezone_str = goal.get("users", {}).get("timezone") or "UTC"

            try:
                # Get current time in user's timezone
                user_tz = pytz.timezone(user_timezone_str)
                user_now = datetime.now(user_tz)
                user_today = user_now.date()
                user_hour = user_now.hour
                user_minute = user_now.minute

                # Mark this user as processed (for logging)
                processed_users.add(user_id)

                # Check if today is a valid day for this goal
                should_create = False

                if frequency == "daily":
                    should_create = True
                elif frequency == "weekly":
                    # Convert user's today to day_of_week (0=Sunday, 1=Monday, ..., 6=Saturday)
                    user_weekday = user_today.weekday()  # Python: 0=Mon, 6=Sun
                    user_day_of_week = (user_weekday + 1) % 7  # Convert to 0=Sun

                    if (
                        isinstance(days_of_week, list)
                        and user_day_of_week in days_of_week
                    ):
                        should_create = True

                if not should_create:
                    continue

                # Check if check-in already exists for this date
                existing_checkin = (
                    supabase.table("check_ins")
                    .select("id")
                    .eq("goal_id", goal_id)
                    .eq("user_id", user_id)
                    .eq("date", user_today.isoformat())
                    .execute()
                )

                if existing_checkin.data:
                    skipped_count += 1
                    continue

                # Create new check-in for user's today
                checkin_data = {
                    "goal_id": goal_id,
                    "user_id": user_id,
                    "date": user_today.isoformat(),
                    "completed": False,
                    "photo_urls": [],
                }

                result = supabase.table("check_ins").insert(checkin_data).execute()

                if result.data:
                    created_count += 1
                    print(
                        f"✅ [CHECK-IN TASK] Created check-in for goal '{goal_title}': "
                        f"date={user_today.isoformat()}, timezone={user_timezone_str}"
                    )
                    # NOTE: No notification here - check-in prompts are sent separately
                    # by send_checkin_prompts task (30 min after last reminder time)

            except pytz.exceptions.UnknownTimeZoneError:
                logger.error(
                    f"Invalid timezone for user {user_id}: {user_timezone_str}",
                    {"user_id": user_id, "timezone": user_timezone_str},
                )
                continue
            except Exception as e:
                logger.error(
                    f"Failed to create check-in for goal {goal_id}",
                    {"goal_id": goal_id, "user_id": user_id, "error": str(e)},
                )
                continue

        print(
            f"Auto-created {created_count} check-ins, skipped {skipped_count} existing for {len(processed_users)} users",
            {
                "created": created_count,
                "skipped": skipped_count,
                "users_processed": len(processed_users),
            },
        )

        return {
            "success": True,
            "processed": len(processed_users),
            "created": created_count,
            "skipped": skipped_count,
        }

    except Exception as e:
        logger.error(
            "Failed to auto-create daily check-ins",
            {"error": str(e)},
        )
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        return {"success": False, "error": str(e)}


@celery_app.task(
    name="check_goal_completions",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def check_goal_completions_task(self) -> Dict[str, Any]:
    """
    Check and auto-complete challenge goals.

    For time_challenge: Complete when challenge_end_date is reached
    For target_challenge: Complete when completed check-ins >= target_checkins

    Should be scheduled to run daily (e.g., at 00:05 UTC).
    """
    from datetime import datetime, date, timedelta
    from app.services.expo_push_service import ExpoPushService

    try:
        supabase = get_supabase_client()
        push_service = ExpoPushService()
        today = date.today()

        completed_count = 0
        failed_count = 0

        # 1. Check time-based challenges that have ended
        time_challenges = (
            supabase.table("goals")
            .select(
                "id, user_id, title, challenge_start_date, challenge_end_date, goal_type, frequency, days_of_week"
            )
            .eq("goal_type", "time_challenge")
            .is_("completed_at", "null")
            .lte("challenge_end_date", today.isoformat())
            .execute()
        )

        for goal in time_challenges.data or []:
            try:
                # Calculate actual completion stats from check_ins table
                # Count completed check-ins during the challenge period
                challenge_start = goal.get("challenge_start_date")
                challenge_end = goal.get("challenge_end_date")
                frequency = goal.get("frequency", "daily")
                days_of_week = goal.get("days_of_week") or []

                checkins_result = (
                    supabase.table("check_ins")
                    .select("id, completed, date", count="exact")
                    .eq("goal_id", goal["id"])
                    .eq("completed", True)
                    .execute()
                )

                completed_days = checkins_result.count or 0

                # Calculate total SCHEDULED days (respecting frequency and days_of_week)
                # For weekly goals, only count the scheduled days within the challenge period
                total_scheduled_days = 0
                if challenge_start and challenge_end:
                    try:
                        start_date = (
                            datetime.fromisoformat(challenge_start).date()
                            if isinstance(challenge_start, str)
                            else challenge_start
                        )
                        end_date = (
                            datetime.fromisoformat(challenge_end).date()
                            if isinstance(challenge_end, str)
                            else challenge_end
                        )

                        if frequency == "daily":
                            # Daily goals: every day counts
                            total_scheduled_days = (end_date - start_date).days + 1
                        elif frequency == "weekly" and days_of_week:
                            # Weekly goals: count only scheduled days
                            # days_of_week uses 0=Sunday, 1=Monday, ..., 6=Saturday
                            current_date = start_date
                            while current_date <= end_date:
                                # Python weekday: 0=Monday, 6=Sunday
                                # Convert to our format: 0=Sunday, 1=Monday, ..., 6=Saturday
                                python_weekday = current_date.weekday()
                                our_weekday = (python_weekday + 1) % 7
                                if our_weekday in days_of_week:
                                    total_scheduled_days += 1
                                current_date += timedelta(days=1)
                        else:
                            # Fallback: assume daily
                            total_scheduled_days = (end_date - start_date).days + 1
                    except Exception:
                        total_scheduled_days = 30  # Default fallback

                completion_rate = (
                    round((completed_days / max(total_scheduled_days, 1)) * 100)
                    if total_scheduled_days > 0
                    else 0
                )

                # Mark as completed with stats
                supabase.table("goals").update(
                    {
                        "completed_at": datetime.now().isoformat(),
                        "completion_reason": "duration",
                        "is_active": False,
                    }
                ).eq("id", goal["id"]).execute()

                # Send celebration notification with completion stats
                user_result = (
                    supabase.table("users")
                    .select("expo_push_token, name")
                    .eq("id", goal["user_id"])
                    .maybe_single()
                    .execute()
                )

                if user_result.data and user_result.data.get("expo_push_token"):
                    # Personalize message based on completion rate
                    if completion_rate >= 90:
                        celebration_emoji = "🏆"
                        message = f"Amazing! You crushed your '{goal['title']}' challenge with {completed_days}/{total_scheduled_days} check-ins ({completion_rate}%)!"
                    elif completion_rate >= 70:
                        celebration_emoji = "🎉"
                        message = f"Great job! You completed your '{goal['title']}' challenge with {completed_days}/{total_scheduled_days} check-ins!"
                    elif completion_rate >= 50:
                        celebration_emoji = "👏"
                        message = f"You finished your '{goal['title']}' challenge! {completed_days}/{total_scheduled_days} check-ins completed."
                    else:
                        celebration_emoji = "✅"
                        message = f"Your '{goal['title']}' challenge ended. You completed {completed_days}/{total_scheduled_days} check-ins."

                    push_service.send_notification(
                        push_token=user_result.data["expo_push_token"],
                        title=f"{celebration_emoji} Challenge Complete!",
                        body=message,
                        data={
                            "type": "challenge_complete",
                            "goal_id": goal["id"],
                            "completed_checkins": completed_days,
                            "total_scheduled_checkins": total_scheduled_days,
                            "completion_rate": completion_rate,
                        },
                    )

                completed_count += 1
                print(
                    f"✅ Completed time challenge: {goal['title']} ({completed_days}/{total_scheduled_days} check-ins, {completion_rate}%) (goal_id: {goal['id']})"
                )

            except Exception as e:
                failed_count += 1
                print(f"❌ Failed to complete time challenge {goal['id']}: {e}")

        # 2. Check target-based challenges that have reached their target
        target_challenges = (
            supabase.table("goals")
            .select("id, user_id, title, target_checkins, goal_type")
            .eq("goal_type", "target_challenge")
            .is_("completed_at", "null")
            .not_.is_("target_checkins", "null")
            .execute()
        )

        for goal in target_challenges.data or []:
            try:
                # Count completed check-ins for this goal
                checkins_result = (
                    supabase.table("check_ins")
                    .select("id", count="exact")
                    .eq("goal_id", goal["id"])
                    .eq("completed", True)
                    .execute()
                )

                completed_checkins = checkins_result.count or 0
                target = goal.get("target_checkins", 0)

                if completed_checkins >= target:
                    # Mark as completed
                    supabase.table("goals").update(
                        {
                            "completed_at": datetime.now().isoformat(),
                            "completion_reason": "target",
                            "is_active": False,
                        }
                    ).eq("id", goal["id"]).execute()

                    # Send celebration notification
                    user_result = (
                        supabase.table("users")
                        .select("expo_push_token, name")
                        .eq("id", goal["user_id"])
                        .maybe_single()
                        .execute()
                    )

                    if user_result.data and user_result.data.get("expo_push_token"):
                        push_service.send_notification(
                            push_token=user_result.data["expo_push_token"],
                            title="🎉 Target Reached!",
                            body=f"Amazing! You hit {completed_checkins}/{target} check-ins for '{goal['title']}'!",
                            data={
                                "type": "challenge_complete",
                                "goal_id": goal["id"],
                            },
                        )

                    completed_count += 1
                    print(
                        f"✅ Completed target challenge: {goal['title']} ({completed_checkins}/{target})"
                    )

            except Exception as e:
                failed_count += 1
                print(f"❌ Failed to check target challenge {goal['id']}: {e}")

        print(
            f"Goal completion check done: {completed_count} completed, {failed_count} failed"
        )

        return {
            "success": True,
            "completed": completed_count,
            "failed": failed_count,
        }

    except Exception as e:
        logger.error(
            "Failed to check goal completions",
            {"error": str(e)},
        )
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        return {"success": False, "error": str(e)}
