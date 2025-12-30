"""
Achievement Service

Handles achievement badge unlocking logic.
Checks user progress and unlocks badges when conditions are met.
"""

from typing import Dict, Any, Optional, List
from datetime import date, timedelta
from app.core.database import get_supabase_client
from app.services.logger import logger


class AchievementService:
    """Service for managing achievement badges"""

    async def check_and_unlock_achievements(
        self,
        user_id: str,
        source_type: Optional[str] = None,  # "goal" or "challenge"
        source_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Check user progress and unlock any eligible achievements.

        Args:
            user_id: User ID to check
            source_type: Optional source type ("goal" or "challenge") for metadata
            source_id: Optional source ID (goal_id or challenge_id) for metadata

        Returns:
            List of newly unlocked achievements
        """
        supabase = get_supabase_client()
        newly_unlocked = []

        try:
            # Get all active achievement types
            achievements = (
                supabase.table("achievement_types")
                .select("*")
                .eq("is_active", True)
                .order("sort_order")
                .execute()
            )

            if not achievements.data:
                return newly_unlocked

            # SCALABILITY: Batch fetch all user's unlocked achievements (1 query vs N)
            achievement_type_ids = [a["id"] for a in achievements.data]
            unlocked_achievements = (
                supabase.table("user_achievements")
                .select("achievement_type_id")
                .eq("user_id", user_id)
                .in_("achievement_type_id", achievement_type_ids)
                .execute()
            )
            unlocked_ids = set(
                a["achievement_type_id"] for a in unlocked_achievements.data or []
            )

            # Check each achievement type
            for achievement in achievements.data:
                # Check if already unlocked (from batch data)
                if achievement["id"] in unlocked_ids:
                    continue  # Already unlocked

                # Check if condition is met
                condition_met = await self._check_condition(
                    user_id, achievement["unlock_condition"]
                )

                if condition_met:
                    # Unlock the achievement
                    unlocked = await self._unlock_achievement(
                        user_id,
                        achievement["id"],
                        achievement,
                        source_type,
                        source_id,
                    )
                    if unlocked:
                        newly_unlocked.append(unlocked)

            if newly_unlocked:
                logger.info(
                    f"Unlocked {len(newly_unlocked)} achievements for user {user_id}",
                    {
                        "user_id": user_id,
                        "source_type": source_type,
                        "source_id": source_id,
                        "achievements": [a["badge_key"] for a in newly_unlocked],
                    },
                )

            return newly_unlocked

        except Exception as e:
            logger.error(
                f"Failed to check achievements for user {user_id}",
                {"error": str(e), "user_id": user_id},
            )
            return newly_unlocked

    async def _check_condition(self, user_id: str, condition: str) -> bool:
        """
        Check if an achievement condition is met.

        Args:
            user_id: User ID
            condition: JSON string describing the condition

        Returns:
            True if condition is met, False otherwise
        """
        import json
        from datetime import datetime

        try:
            condition_data = (
                json.loads(condition) if isinstance(condition, str) else condition
            )
            condition_type = condition_data.get("type")
            target_value = condition_data.get("value")

            supabase = get_supabase_client()

            if condition_type == "checkin_count":
                # Count total check-ins across all goals (completed = true)
                result = (
                    supabase.table("check_ins")
                    .select("id", count="exact")
                    .eq("user_id", user_id)
                    .eq("completed", True)
                    .execute()
                )
                count = (
                    result.count if hasattr(result, "count") else len(result.data or [])
                )

                return count >= target_value

            elif condition_type == "streak":
                # Get current streak across all goals
                streak = await self._get_current_streak(user_id)
                return streak >= target_value

            elif condition_type == "goal_count":
                # Count goals
                result = (
                    supabase.table("goals")
                    .select("id", count="exact")
                    .eq("user_id", user_id)
                    .execute()
                )
                count = (
                    result.count if hasattr(result, "count") else len(result.data or [])
                )
                return count >= target_value

            elif condition_type == "perfect_week":
                # Check if user completed all check-ins in a week (across all goals)
                today = date.today()
                week_start = today - timedelta(days=today.weekday())

                result = (
                    supabase.table("check_ins")
                    .select("check_in_date")
                    .eq("user_id", user_id)
                    .eq("completed", True)
                    .gte("check_in_date", week_start.isoformat())
                    .lte("check_in_date", today.isoformat())
                    .execute()
                )
                completed_dates = {row["check_in_date"] for row in (result.data or [])}

                # Check if all 7 days have check-ins
                return len(completed_dates) >= 7

            # ==========================================
            # WORKOUT-SPECIFIC CONDITION TYPES
            # ==========================================

            elif condition_type == "workout_count":
                # Count completed workout sessions
                result = (
                    supabase.table("workout_sessions")
                    .select("id", count="exact")
                    .eq("user_id", user_id)
                    .eq("status", "completed")
                    .execute()
                )
                count = (
                    result.count if hasattr(result, "count") else len(result.data or [])
                )
                return count >= target_value

            elif condition_type == "perfect_workout":
                # Check if user completed a workout without skipping
                result = (
                    supabase.table("workout_sessions")
                    .select("id")
                    .eq("user_id", user_id)
                    .eq("status", "completed")
                    .eq("exercises_skipped", 0)
                    .limit(1)
                    .execute()
                )
                return len(result.data or []) > 0

            elif condition_type == "perfect_workout_count":
                # Count perfect workouts (no skipped exercises)
                result = (
                    supabase.table("workout_sessions")
                    .select("id", count="exact")
                    .eq("user_id", user_id)
                    .eq("status", "completed")
                    .eq("exercises_skipped", 0)
                    .execute()
                )
                count = (
                    result.count if hasattr(result, "count") else len(result.data or [])
                )
                return count >= target_value

            elif condition_type == "workout_time":
                # Check if user completed a workout at a specific time
                time_condition = condition_data.get(
                    "condition"
                )  # "before", "after", "between"
                hour = condition_data.get("hour")
                start_hour = condition_data.get("start_hour")
                end_hour = condition_data.get("end_hour")

                result = (
                    supabase.table("workout_sessions")
                    .select("started_at")
                    .eq("user_id", user_id)
                    .eq("status", "completed")
                    .execute()
                )

                for session in result.data or []:
                    started_at = session.get("started_at")
                    if not started_at:
                        continue

                    # Parse the datetime
                    if isinstance(started_at, str):
                        session_time = datetime.fromisoformat(
                            started_at.replace("Z", "+00:00")
                        )
                    else:
                        session_time = started_at

                    session_hour = session_time.hour

                    if time_condition == "before" and session_hour < hour:
                        return True
                    elif time_condition == "after" and session_hour >= hour:
                        return True
                    elif time_condition == "between":
                        if start_hour <= session_hour < end_hour:
                            return True

                return False

            elif condition_type == "workout_duration":
                # Check if user completed a workout of a certain duration
                minutes = condition_data.get("minutes", 0)
                seconds = minutes * 60

                result = (
                    supabase.table("workout_sessions")
                    .select("total_duration_seconds")
                    .eq("user_id", user_id)
                    .eq("status", "completed")
                    .gte("total_duration_seconds", seconds)
                    .limit(1)
                    .execute()
                )
                return len(result.data or []) > 0

            elif condition_type == "workout_streak":
                # Get current workout streak (consecutive days)
                streak = await self._get_workout_streak(user_id)
                return streak >= target_value

            elif condition_type == "weekly_workouts":
                # Check if user completed X workouts in current week
                today = date.today()
                week_start = today - timedelta(days=today.weekday())

                result = (
                    supabase.table("workout_sessions")
                    .select("id", count="exact")
                    .eq("user_id", user_id)
                    .eq("status", "completed")
                    .gte("started_at", week_start.isoformat())
                    .execute()
                )
                count = (
                    result.count if hasattr(result, "count") else len(result.data or [])
                )
                return count >= target_value

            elif condition_type == "program_week":
                # Check if user completed a specific week of their program
                # This requires tracking program progress - simplified check
                # by counting completed workouts for a goal
                if not goal_id:
                    return False

                result = (
                    supabase.table("workout_sessions")
                    .select("id", count="exact")
                    .eq("user_id", user_id)
                    .eq("goal_id", goal_id)
                    .eq("status", "completed")
                    .execute()
                )
                count = (
                    result.count if hasattr(result, "count") else len(result.data or [])
                )

                # Assume 3 workouts per week for program progression
                weeks_completed = count // 3
                return weeks_completed >= target_value

            return False

        except Exception as e:
            logger.error(
                f"Failed to check achievement condition: {e}",
                {"condition": condition, "error": str(e)},
            )
            return False

    async def _get_current_streak(self, user_id: str) -> int:
        """
        Get current streak for user across all goals/challenges.

        Args:
            user_id: User ID

        Returns:
            Current streak count (days)
        """
        supabase = get_supabase_client()

        # Get all completed check-ins across all goals, ordered by date descending
        result = (
            supabase.table("check_ins")
            .select("check_in_date")
            .eq("user_id", user_id)
            .eq("completed", True)
            .order("check_in_date", desc=True)
            .execute()
        )
        check_ins = result.data or []

        if not check_ins:
            return 0

        # Calculate streak by checking consecutive days
        streak = 0
        today = date.today()
        current_date = today

        for check_in in check_ins:
            check_in_date_val = (
                check_in["check_in_date"]
                if isinstance(check_in["check_in_date"], date)
                else date.fromisoformat(str(check_in["check_in_date"]))
            )

            # Check if this date matches our expected date
            if check_in_date_val == current_date:
                streak += 1
                current_date -= timedelta(days=1)
            elif check_in_date_val < current_date:
                # Gap in streak, break
                break

        return streak

    async def _get_workout_streak(self, user_id: str) -> int:
        """
        Get current workout streak for user (consecutive days with workouts).

        Args:
            user_id: User ID

        Returns:
            Current workout streak count (days)
        """
        from datetime import datetime

        supabase = get_supabase_client()

        # Get all completed workout sessions, ordered by date descending
        result = (
            supabase.table("workout_sessions")
            .select("started_at")
            .eq("user_id", user_id)
            .eq("status", "completed")
            .order("started_at", desc=True)
            .execute()
        )

        sessions = result.data or []

        if not sessions:
            return 0

        # Get unique workout dates
        workout_dates = set()
        for session in sessions:
            started_at = session.get("started_at")
            if started_at:
                if isinstance(started_at, str):
                    dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
                else:
                    dt = started_at
                workout_dates.add(dt.date())

        # Calculate streak by checking consecutive days
        streak = 0
        today = date.today()
        current_date = today

        # Check if we have a workout today or yesterday
        if today in workout_dates:
            current_date = today
        elif (today - timedelta(days=1)) in workout_dates:
            current_date = today - timedelta(days=1)
        else:
            return 0

        while current_date in workout_dates:
            streak += 1
            current_date -= timedelta(days=1)

        return streak

    async def _unlock_achievement(
        self,
        user_id: str,
        achievement_type_id: str,
        achievement_data: Dict[str, Any],
        source_type: Optional[str] = None,
        source_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Unlock an achievement for a user.

        Args:
            user_id: User ID
            achievement_type_id: Achievement type ID
            achievement_data: Achievement type data
            source_type: Optional source type ("goal" or "challenge") for metadata
            source_id: Optional source ID for metadata

        Returns:
            Unlocked achievement data or None if failed
        """
        supabase = get_supabase_client()

        try:
            # Build metadata with source info if provided
            metadata: Dict[str, Any] = {}
            if source_type and source_id:
                metadata["source_type"] = source_type
                metadata["source_id"] = source_id

            # Create user achievement record (no goal_id column anymore)
            achievement_record = {
                "user_id": user_id,
                "achievement_type_id": achievement_type_id,
                "metadata": metadata,
            }

            # Add additional metadata based on achievement type
            if "streak" in achievement_data.get("badge_key", ""):
                streak = await self._get_current_streak(user_id)
                achievement_record["metadata"]["streak"] = streak
            elif "checkin" in achievement_data.get("badge_key", ""):
                # Get total check-in count across all goals
                result = (
                    supabase.table("check_ins")
                    .select("id", count="exact")
                    .eq("user_id", user_id)
                    .eq("completed", True)
                    .execute()
                )
                count = (
                    result.count if hasattr(result, "count") else len(result.data or [])
                )
                achievement_record["metadata"]["checkin_count"] = count

            result = (
                supabase.table("user_achievements").insert(achievement_record).execute()
            )

            if result.data:
                unlocked = result.data[0]
                unlocked["badge_key"] = achievement_data.get("badge_key")
                unlocked["badge_name"] = achievement_data.get("badge_name")
                unlocked["badge_description"] = achievement_data.get(
                    "badge_description"
                )
                unlocked["points"] = achievement_data.get("points", 0)
                unlocked["rarity"] = achievement_data.get("rarity", "common")

                print(
                    f"Unlocked achievement {achievement_data.get('badge_key')} for user {user_id}",
                    {
                        "user_id": user_id,
                        "achievement_id": unlocked["id"],
                        "badge_key": achievement_data.get("badge_key"),
                    },
                )

                return unlocked

            return None

        except Exception as e:
            logger.error(
                f"Failed to unlock achievement for user {user_id}",
                {
                    "error": str(e),
                    "user_id": user_id,
                    "achievement_type_id": achievement_type_id,
                },
            )
            return None

    async def get_user_achievements(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get all achievements unlocked by a user.

        Args:
            user_id: User ID

        Returns:
            List of user achievements
        """
        supabase = get_supabase_client()

        try:
            result = (
                supabase.table("user_achievements")
                .select("*, achievement_types(*)")
                .eq("user_id", user_id)
                .order("unlocked_at", desc=True)
                .execute()
            )
            return result.data or []

        except Exception as e:
            logger.error(
                f"Failed to get achievements for user {user_id}",
                {"error": str(e), "user_id": user_id},
            )
            return []


# Global instance
achievement_service = AchievementService()
