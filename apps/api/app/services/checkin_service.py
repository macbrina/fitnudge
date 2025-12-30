"""
Check-in completion service.

Provides utilities for auto-completing check-ins when users complete activities
(workouts, meal logging, hydration tracking) for goals/challenges with specific
tracking types.
"""

from datetime import date
from typing import Optional, Tuple
from app.core.database import get_supabase_client
from app.services.logger import logger


def is_scheduled_day(
    target_date: date,
    frequency: Optional[str],
    days_of_week: Optional[list],
) -> bool:
    """
    Check if the target date is a scheduled day based on frequency and days_of_week.

    Args:
        target_date: The date to check
        frequency: "daily" or "weekly"
        days_of_week: List of day numbers (0=Sunday, 1=Monday, ..., 6=Saturday)

    Returns:
        True if it's a scheduled day, False otherwise
    """
    if frequency == "daily":
        # Daily frequency - every day is a scheduled day
        return True

    if frequency == "weekly" and days_of_week:
        # Weekly frequency - check if today's day is in the list
        # Python: Monday=0, Sunday=6
        # Database: Sunday=0, Monday=1, ..., Saturday=6
        python_weekday = target_date.weekday()
        # Convert Python weekday to JS/database weekday (Sunday=0)
        js_weekday = (python_weekday + 1) % 7
        return js_weekday in days_of_week

    # Default to allowing if no frequency info (backwards compatibility)
    return True


async def auto_complete_checkin(
    user_id: str,
    goal_id: Optional[str] = None,
    challenge_id: Optional[str] = None,
    checkin_date: Optional[date] = None,
    mood: Optional[str] = None,
    notes: Optional[str] = None,
) -> bool:
    """
    Auto-complete a check-in for a goal or challenge.

    This is called when a user completes an activity that should mark
    their daily check-in as complete (e.g., completing a workout, logging a meal,
    logging hydration).

    Validates that today is a scheduled day before creating/updating check-in.

    Args:
        user_id: The user's ID
        goal_id: The goal ID (for goal check-ins)
        challenge_id: The challenge ID (for challenge check-ins)
        checkin_date: The date to mark as complete (defaults to today)
        mood: Optional mood to record
        notes: Optional notes to add

    Returns:
        True if check-in was completed, False otherwise
    """
    if not goal_id and not challenge_id:
        logger.warning("auto_complete_checkin called without goal_id or challenge_id")
        return False

    supabase = get_supabase_client()
    target_date = checkin_date or date.today()

    try:
        if goal_id:
            return await _complete_goal_checkin(
                supabase, user_id, goal_id, target_date, mood, notes
            )
        elif challenge_id:
            return await _complete_challenge_checkin(
                supabase, user_id, challenge_id, target_date, mood, notes
            )
        return False
    except Exception as e:
        logger.error(
            f"Failed to auto-complete check-in: {str(e)}",
            {
                "user_id": user_id,
                "goal_id": goal_id,
                "challenge_id": challenge_id,
            },
        )
        return False


async def _complete_goal_checkin(
    supabase,
    user_id: str,
    goal_id: str,
    target_date: date,
    mood: Optional[str] = None,
    notes: Optional[str] = None,
) -> bool:
    """Complete a goal check-in for a specific date."""

    # Get goal details to check if today is a scheduled day
    goal = (
        supabase.table("goals")
        .select("id, frequency, days_of_week, status")
        .eq("id", goal_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if not goal.data:
        logger.warning(f"Goal not found: {goal_id}")
        return False

    # Check if goal is active
    if goal.data.get("status") != "active":
        logger.info(
            f"Goal is not active, skipping check-in",
            {"goal_id": goal_id, "status": goal.data.get("status")},
        )
        return False

    # Check if today is a scheduled day
    frequency = goal.data.get("frequency")
    days_of_week = goal.data.get("days_of_week")

    if not is_scheduled_day(target_date, frequency, days_of_week):
        logger.info(
            f"Not a scheduled day for goal, skipping check-in",
            {
                "goal_id": goal_id,
                "date": target_date.isoformat(),
                "frequency": frequency,
                "days_of_week": days_of_week,
            },
        )
        return False

    # Check if check-in already exists
    existing = (
        supabase.table("check_ins")
        .select("id, completed")
        .eq("goal_id", goal_id)
        .eq("user_id", user_id)
        .eq("check_in_date", target_date.isoformat())
        .maybe_single()
        .execute()
    )

    if existing.data:
        # Check-in exists - update it to completed if not already
        if not existing.data.get("completed"):
            update_data = {"completed": True, "is_checked_in": True}
            if mood:
                update_data["mood"] = mood
            if notes:
                update_data["notes"] = notes

            supabase.table("check_ins").update(update_data).eq(
                "id", existing.data["id"]
            ).execute()

            logger.info(
                f"Auto-completed existing goal check-in",
                {
                    "goal_id": goal_id,
                    "user_id": user_id,
                    "date": target_date.isoformat(),
                },
            )
        return True
    else:
        # Create a new completed check-in
        checkin_data = {
            "goal_id": goal_id,
            "user_id": user_id,
            "check_in_date": target_date.isoformat(),
            "completed": True,
            "is_checked_in": True,
            "mood": mood,
            "notes": notes,
        }

        supabase.table("check_ins").insert(checkin_data).execute()

        logger.info(
            f"Created auto-completed goal check-in",
            {"goal_id": goal_id, "user_id": user_id, "date": target_date.isoformat()},
        )

        # Trigger achievement check asynchronously
        try:
            from app.services.tasks import check_achievements_task

            check_achievements_task.delay(
                user_id=user_id,
                source_type="goal",
                source_id=goal_id,
            )
        except Exception as e:
            logger.warning(f"Failed to queue achievement check: {e}")

        # Notify partners of the auto-completed goal check-in
        try:
            from app.services.social_accountability_service import (
                social_accountability_service,
            )

            await social_accountability_service.notify_partners_of_data_change(
                user_id, "goal_checkin"
            )
        except Exception as e:
            logger.warning(f"Failed to notify partners of goal check-in: {e}")

        return True


async def _complete_challenge_checkin(
    supabase,
    user_id: str,
    challenge_id: str,
    target_date: date,
    mood: Optional[str] = None,
    notes: Optional[str] = None,
) -> bool:
    """Complete a challenge check-in for a specific date."""

    # Get challenge details to check if today is a scheduled day
    challenge = (
        supabase.table("challenges")
        .select("id, frequency, days_of_week, status, start_date, end_date")
        .eq("id", challenge_id)
        .maybe_single()
        .execute()
    )

    if not challenge.data:
        logger.warning(f"Challenge not found: {challenge_id}")
        return False

    # Check if challenge is active
    if challenge.data.get("status") != "active":
        logger.info(
            f"Challenge is not active, skipping check-in",
            {"challenge_id": challenge_id, "status": challenge.data.get("status")},
        )
        return False

    # Check if target_date is within challenge period
    start_date_str = challenge.data.get("start_date")
    end_date_str = challenge.data.get("end_date")

    if start_date_str and end_date_str:
        challenge_start = date.fromisoformat(start_date_str)
        challenge_end = date.fromisoformat(end_date_str)
        if target_date < challenge_start or target_date > challenge_end:
            logger.info(
                f"Date is outside challenge period",
                {
                    "challenge_id": challenge_id,
                    "date": target_date.isoformat(),
                    "start": start_date_str,
                    "end": end_date_str,
                },
            )
            return False

    # Check if today is a scheduled day
    frequency = challenge.data.get("frequency")
    days_of_week = challenge.data.get("days_of_week")

    if not is_scheduled_day(target_date, frequency, days_of_week):
        logger.info(
            f"Not a scheduled day for challenge, skipping check-in",
            {
                "challenge_id": challenge_id,
                "date": target_date.isoformat(),
                "frequency": frequency,
                "days_of_week": days_of_week,
            },
        )
        return False

    # Verify user is a participant
    participant = (
        supabase.table("challenge_participants")
        .select("id")
        .eq("challenge_id", challenge_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if not participant.data:
        logger.warning(
            f"User is not a participant in challenge",
            {"challenge_id": challenge_id, "user_id": user_id},
        )
        return False

    # Check if check-in already exists
    existing = (
        supabase.table("challenge_check_ins")
        .select("id, completed")
        .eq("challenge_id", challenge_id)
        .eq("user_id", user_id)
        .eq("check_in_date", target_date.isoformat())
        .maybe_single()
        .execute()
    )

    if existing.data:
        # Check-in exists - update it to completed if not already
        if not existing.data.get("completed"):
            update_data = {"completed": True, "is_checked_in": True}
            if mood:
                update_data["mood"] = mood
            if notes:
                update_data["notes"] = notes

            supabase.table("challenge_check_ins").update(update_data).eq(
                "id", existing.data["id"]
            ).execute()

            logger.info(
                f"Auto-completed existing challenge check-in",
                {
                    "challenge_id": challenge_id,
                    "user_id": user_id,
                    "date": target_date.isoformat(),
                },
            )
        return True
    else:
        # Create a new completed check-in
        checkin_data = {
            "challenge_id": challenge_id,
            "user_id": user_id,
            "check_in_date": target_date.isoformat(),
            "completed": True,
            "is_checked_in": True,
            "mood": mood,
            "notes": notes,
        }

        supabase.table("challenge_check_ins").insert(checkin_data).execute()

        logger.info(
            f"Created auto-completed challenge check-in",
            {
                "challenge_id": challenge_id,
                "user_id": user_id,
                "date": target_date.isoformat(),
            },
        )

        # Trigger achievement check asynchronously
        try:
            from app.services.tasks import check_achievements_task

            check_achievements_task.delay(
                user_id=user_id,
                source_type="challenge",
                source_id=challenge_id,
            )
        except Exception as e:
            logger.warning(f"Failed to queue achievement check: {e}")

        # Notify partners of the auto-completed challenge check-in
        try:
            from app.services.social_accountability_service import (
                social_accountability_service,
            )

            await social_accountability_service.notify_partners_of_data_change(
                user_id, "challenge_checkin"
            )
        except Exception as e:
            logger.warning(f"Failed to notify partners of challenge check-in: {e}")

        return True


async def can_add_reflection(
    user_id: str,
    goal_id: Optional[str] = None,
    challenge_id: Optional[str] = None,
) -> Tuple[bool, Optional[str]]:
    """
    Check if user can add reflection (mood/notes/photo) to today's check-in.

    Returns:
        Tuple of (can_add, check_in_id) - check_in_id is provided if reflection can be added
    """
    supabase = get_supabase_client()
    today = date.today()

    try:
        if goal_id:
            # Get goal details
            goal = (
                supabase.table("goals")
                .select("id, frequency, days_of_week, status")
                .eq("id", goal_id)
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )

            if not goal.data or goal.data.get("status") != "active":
                return False, None

            # Check if today is a scheduled day
            if not is_scheduled_day(
                today, goal.data.get("frequency"), goal.data.get("days_of_week")
            ):
                return False, None

            # Check if check-in exists for today
            existing = (
                supabase.table("check_ins")
                .select("id, mood, notes, photo_url, completed")
                .eq("goal_id", goal_id)
                .eq("user_id", user_id)
                .eq("check_in_date", today.isoformat())
                .maybe_single()
                .execute()
            )

            if not existing.data:
                return False, None

            # Check if reflection already recorded (has mood, notes, or photo)
            has_reflection = (
                existing.data.get("mood")
                or existing.data.get("notes")
                or existing.data.get("photo_url")
            )

            if has_reflection:
                return False, None

            return True, existing.data["id"]

        elif challenge_id:
            # Get challenge details
            challenge = (
                supabase.table("challenges")
                .select("id, frequency, days_of_week, status, start_date, end_date")
                .eq("id", challenge_id)
                .maybe_single()
                .execute()
            )

            if not challenge.data or challenge.data.get("status") != "active":
                return False, None

            # Check if within challenge period
            start_date_str = challenge.data.get("start_date")
            end_date_str = challenge.data.get("end_date")
            if start_date_str and end_date_str:
                challenge_start = date.fromisoformat(start_date_str)
                challenge_end = date.fromisoformat(end_date_str)
                if today < challenge_start or today > challenge_end:
                    return False, None

            # Check if today is a scheduled day
            if not is_scheduled_day(
                today,
                challenge.data.get("frequency"),
                challenge.data.get("days_of_week"),
            ):
                return False, None

            # Check if user is a participant
            participant = (
                supabase.table("challenge_participants")
                .select("id")
                .eq("challenge_id", challenge_id)
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )

            if not participant.data:
                return False, None

            # Check if check-in exists for today
            existing = (
                supabase.table("challenge_check_ins")
                .select("id, mood, notes, photo_url, completed")
                .eq("challenge_id", challenge_id)
                .eq("user_id", user_id)
                .eq("check_in_date", today.isoformat())
                .maybe_single()
                .execute()
            )

            if not existing.data:
                return False, None

            # Check if reflection already recorded
            has_reflection = (
                existing.data.get("mood")
                or existing.data.get("notes")
                or existing.data.get("photo_url")
            )

            if has_reflection:
                return False, None

            return True, existing.data["id"]

        return False, None

    except Exception as e:
        logger.error(f"Error checking can_add_reflection: {str(e)}")
        return False, None
