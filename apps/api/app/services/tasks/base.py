"""
Shared utilities for Celery tasks.

This module contains common imports, constants, and helper functions
used across all task modules.
"""

from typing import Dict, Any, Optional
from app.core.celery_app import celery_app
from app.core.database import get_supabase_client
from app.services.logger import logger


def _activate_goal_and_create_checkin(
    supabase,
    goal_id: str,
    user_id: str,
    user_timezone: str,
    frequency: str,
    days_of_week: Optional[list],
) -> None:
    """
    Create initial check-in after plan generation completes.
    Goal is already active (set in create_goal endpoint).
    Called from generate_plan_task when plan is ready.

    Args:
        supabase: Supabase client
        goal_id: Goal ID
        user_id: User ID
        user_timezone: User's timezone for check-in date
        frequency: Goal frequency (daily/weekly)
        days_of_week: Days of week for weekly goals
    """
    from datetime import datetime
    import pytz

    try:
        user_tz = pytz.timezone(user_timezone or "UTC")
        user_now = datetime.now(user_tz)
        user_today = user_now.date()
        user_weekday = user_today.weekday()  # Python: 0=Mon, 6=Sun
        user_day_of_week = (user_weekday + 1) % 7  # Convert to 0=Sun

        # Check if today is a valid day for this goal
        should_create = False

        if frequency == "daily":
            should_create = True
        elif frequency == "weekly" and days_of_week:
            if user_day_of_week in days_of_week:
                should_create = True

        if not should_create:
            print(
                f"ℹ️ [PLAN READY] Skipping check-in for goal {goal_id} (today not in schedule)"
            )
            return

        # Check if check-in already exists
        existing = (
            supabase.table("check_ins")
            .select("id")
            .eq("goal_id", goal_id)
            .eq("date", user_today.isoformat())
            .execute()
        )

        if existing.data:
            print(
                f"ℹ️ [PLAN READY] Check-in already exists for goal {goal_id} on {user_today}"
            )
            return

        # Create check-in
        checkin_data = {
            "goal_id": goal_id,
            "user_id": user_id,
            "date": user_today.isoformat(),
            "completed": False,
            "photo_urls": [],
        }

        result = supabase.table("check_ins").insert(checkin_data).execute()

        if result.data:
            print(
                f"✅ [PLAN READY] Created initial check-in for goal {goal_id} on {user_today} ({user_timezone})"
            )

    except pytz.exceptions.UnknownTimeZoneError:
        logger.error(
            f"Invalid timezone for user {user_id}: {user_timezone}",
            {"user_id": user_id, "timezone": user_timezone},
        )
    except Exception as e:
        logger.error(
            f"Failed to create initial check-in for goal {goal_id}",
            {"goal_id": goal_id, "user_id": user_id, "error": str(e)},
        )


def is_in_quiet_hours(current_time: str, quiet_start: str, quiet_end: str) -> bool:
    """
    Check if current time is within quiet hours.
    Handles cases where quiet hours span midnight (e.g., 22:00 - 08:00).
    """
    from datetime import time

    try:
        current = time.fromisoformat(current_time)
        start = time.fromisoformat(quiet_start)
        end = time.fromisoformat(quiet_end)

        if start <= end:
            # Normal range (e.g., 08:00 - 22:00)
            return start <= current <= end
        else:
            # Spans midnight (e.g., 22:00 - 08:00)
            return current >= start or current <= end
    except:
        return False


# Re-export common imports for use in task modules
__all__ = [
    "celery_app",
    "get_supabase_client",
    "logger",
    "Dict",
    "Any",
    "Optional",
    "_activate_goal_and_create_checkin",
    "is_in_quiet_hours",
]
