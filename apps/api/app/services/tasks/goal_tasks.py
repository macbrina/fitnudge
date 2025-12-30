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
    Celery task to automatically create check-ins for active goals AND challenges.
    TIMEZONE-AWARE: Runs hourly to ensure today's check-in exists.
    - Daily goals/challenges: creates check-in for today if missing
    - Weekly goals/challenges: creates check-in for today if today is in days_of_week
    - Prevents duplicates: checks for existing check-in before creating
    """
    from datetime import datetime, date
    import pytz

    try:
        supabase = get_supabase_client()
        goal_created_count = 0
        goal_skipped_count = 0
        challenge_created_count = 0
        challenge_skipped_count = 0
        processed_users = set()

        # =========================================
        # PART 1: Create Goal Check-ins
        # =========================================
        # Get all active goals with user timezone
        # Join with users table to get timezone
        active_goals_result = (
            supabase.table("goals")
            .select(
                "id, user_id, title, frequency, days_of_week, users!inner(timezone)"
            )
            .eq("status", "active")
            .execute()
        )

        goals = active_goals_result.data or []
        if goals:
            # SCALABILITY: Batch fetch all existing check-ins for today
            goal_ids = [g["id"] for g in goals]
            today_str = datetime.now().strftime("%Y-%m-%d")

            existing_checkins_result = (
                supabase.table("check_ins")
                .select("goal_id, check_in_date")
                .in_("goal_id", goal_ids)
                .gte("check_in_date", today_str)
                .execute()
            )

            # Build set of (goal_id, date) pairs that already exist
            existing_checkin_keys = set()
            for ci in existing_checkins_result.data or []:
                existing_checkin_keys.add((ci["goal_id"], ci["check_in_date"]))

        for goal in goals:
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

                # Mark this user as processed (for logging)
                processed_users.add(user_id)

                # Check if today is a valid day for this goal
                should_create = _is_scheduled_day(frequency, days_of_week, user_today)

                if not should_create:
                    continue

                # Check if check-in already exists (from batch data)
                if (goal_id, user_today.isoformat()) in existing_checkin_keys:
                    goal_skipped_count += 1
                    continue

                # Create new check-in for user's today
                checkin_data = {
                    "goal_id": goal_id,
                    "user_id": user_id,
                    "check_in_date": user_today.isoformat(),
                    "completed": False,
                }

                result = supabase.table("check_ins").insert(checkin_data).execute()

                if result.data:
                    goal_created_count += 1
                    print(
                        f"✅ [GOAL CHECK-IN] Created for '{goal_title}': "
                        f"date={user_today.isoformat()}, timezone={user_timezone_str}"
                    )

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

        # =========================================
        # PART 2: Create Challenge Check-ins
        # =========================================
        # Get all active challenge participants with challenge and user data
        try:
            participants_result = (
                supabase.table("challenge_participants")
                .select(
                    "user_id, challenge_id, "
                    "challenges!inner(id, title, status, start_date, end_date, frequency, days_of_week), "
                    "users!inner(timezone)"
                )
                .execute()
            )

            participants = participants_result.data or []
            if participants:
                # SCALABILITY: Batch fetch all existing challenge check-ins
                challenge_ids = list(
                    set(
                        p.get("challenges", {}).get("id")
                        for p in participants
                        if p.get("challenges")
                    )
                )

                existing_challenge_checkins = (
                    supabase.table("challenge_check_ins")
                    .select("challenge_id, user_id, check_in_date")
                    .in_("challenge_id", challenge_ids)
                    .gte("check_in_date", today_str)
                    .execute()
                )

                # Build set of (challenge_id, user_id, date) keys
                existing_challenge_keys = set()
                for ci in existing_challenge_checkins.data or []:
                    existing_challenge_keys.add(
                        (ci["challenge_id"], ci["user_id"], ci["check_in_date"])
                    )

            for participant in participants:
                user_id = participant["user_id"]
                challenge = participant.get("challenges", {})
                challenge_id = challenge.get("id")
                challenge_title = challenge.get("title", "Unknown")

                # Skip if challenge is not active
                if challenge.get("status") not in ("upcoming", "active"):
                    continue

                # Get user's timezone
                user_timezone_str = (
                    participant.get("users", {}).get("timezone") or "UTC"
                )

                try:
                    user_tz = pytz.timezone(user_timezone_str)
                    user_now = datetime.now(user_tz)
                    user_today = user_now.date()

                    processed_users.add(user_id)

                    # Check if challenge is within date range
                    start_date_str = challenge.get("start_date")
                    end_date_str = challenge.get("end_date")

                    if start_date_str:
                        start_date = date.fromisoformat(start_date_str)
                        if user_today < start_date:
                            continue  # Challenge hasn't started yet

                    if end_date_str:
                        end_date = date.fromisoformat(end_date_str)
                        if user_today > end_date:
                            continue  # Challenge has ended

                    # Check if today is a scheduled day (direct fields on challenge)
                    frequency = challenge.get("frequency", "daily")
                    days_of_week = challenge.get("days_of_week") or []

                    should_create = _is_scheduled_day(
                        frequency, days_of_week, user_today
                    )

                    if not should_create:
                        continue

                    # Check if check-in exists (from batch data)
                    if (
                        challenge_id,
                        user_id,
                        user_today.isoformat(),
                    ) in existing_challenge_keys:
                        challenge_skipped_count += 1
                        continue

                    # Create new challenge check-in
                    checkin_data = {
                        "challenge_id": challenge_id,
                        "user_id": user_id,
                        "check_in_date": user_today.isoformat(),
                        "completed": False,
                        "is_checked_in": False,
                    }

                    result = (
                        supabase.table("challenge_check_ins")
                        .insert(checkin_data)
                        .execute()
                    )

                    if result.data:
                        challenge_created_count += 1
                        print(
                            f"✅ [CHALLENGE CHECK-IN] Created for '{challenge_title}': "
                            f"user={user_id}, date={user_today.isoformat()}"
                        )

                except pytz.exceptions.UnknownTimeZoneError:
                    logger.error(
                        f"Invalid timezone for user {user_id}: {user_timezone_str}",
                        {"user_id": user_id, "timezone": user_timezone_str},
                    )
                    continue
                except Exception as e:
                    logger.error(
                        f"Failed to create challenge check-in for user {user_id}",
                        {
                            "challenge_id": challenge_id,
                            "user_id": user_id,
                            "error": str(e),
                        },
                    )
                    continue

        except Exception as e:
            logger.error(
                f"Failed to fetch challenge participants: {e}",
                {"error": str(e)},
            )

        # =========================================
        # Summary
        # =========================================
        total_created = goal_created_count + challenge_created_count
        total_skipped = goal_skipped_count + challenge_skipped_count

        print(
            f"Auto-created {total_created} check-ins "
            f"(goals: {goal_created_count}, challenges: {challenge_created_count}), "
            f"skipped {total_skipped} existing for {len(processed_users)} users"
        )

        return {
            "success": True,
            "processed": len(processed_users),
            "goal_created": goal_created_count,
            "goal_skipped": goal_skipped_count,
            "challenge_created": challenge_created_count,
            "challenge_skipped": challenge_skipped_count,
            "total_created": total_created,
            "total_skipped": total_skipped,
        }

    except Exception as e:
        logger.error(
            "Failed to auto-create daily check-ins",
            {"error": str(e)},
        )
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        return {"success": False, "error": str(e)}


def _is_scheduled_day(frequency: str, days_of_week: list, check_date) -> bool:
    """
    Check if a given date is a scheduled check-in day based on frequency and days_of_week.

    Args:
        frequency: 'daily' or 'weekly'
        days_of_week: List of day indices (0=Sunday, 1=Monday, ..., 6=Saturday)
        check_date: The date to check

    Returns:
        True if check_date is a scheduled day
    """
    if frequency == "daily":
        return True
    elif frequency == "weekly":
        if not days_of_week:
            return True  # If no days specified, treat as daily
        # Convert Python weekday (0=Mon, 6=Sun) to our format (0=Sun, 1=Mon, ..., 6=Sat)
        python_weekday = check_date.weekday()
        our_weekday = (python_weekday + 1) % 7
        return our_weekday in days_of_week
    return True  # Default to daily if unknown frequency
