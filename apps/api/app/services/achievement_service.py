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
        self, user_id: str, goal_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Check user progress and unlock any eligible achievements.

        Args:
            user_id: User ID to check
            goal_id: Optional goal ID to check achievements for specific goal

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

            # Check each achievement type
            for achievement in achievements.data:
                # Check if already unlocked
                query = (
                    supabase.table("user_achievements")
                    .select("id")
                    .eq("user_id", user_id)
                    .eq("achievement_type_id", achievement["id"])
                )

                if goal_id:
                    query = query.eq("goal_id", goal_id)
                else:
                    query = query.is_("goal_id", "null")

                existing = query.execute()

                if existing.data:
                    continue  # Already unlocked

                # Check if condition is met
                condition_met = await self._check_condition(
                    user_id, goal_id, achievement["unlock_condition"]
                )

                if condition_met:
                    # Unlock the achievement
                    unlocked = await self._unlock_achievement(
                        user_id, achievement["id"], goal_id, achievement
                    )
                    if unlocked:
                        newly_unlocked.append(unlocked)

            if newly_unlocked:
                print(
                    f"Unlocked {len(newly_unlocked)} achievements for user {user_id}",
                    {
                        "user_id": user_id,
                        "goal_id": goal_id,
                        "achievements": [a["badge_key"] for a in newly_unlocked],
                    },
                )

            return newly_unlocked

        except Exception as e:
            logger.error(
                f"Failed to check achievements for user {user_id}",
                {"error": str(e), "user_id": user_id, "goal_id": goal_id},
            )
            return newly_unlocked

    async def _check_condition(
        self, user_id: str, goal_id: Optional[str], condition: str
    ) -> bool:
        """
        Check if an achievement condition is met.

        Args:
            user_id: User ID
            goal_id: Optional goal ID
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
                # Count total check-ins (completed = true)
                query = (
                    supabase.table("check_ins")
                    .select("id", count="exact")
                    .eq("user_id", user_id)
                    .eq("completed", True)
                )

                if goal_id:
                    query = query.eq("goal_id", goal_id)

                result = query.execute()
                count = (
                    result.count if hasattr(result, "count") else len(result.data or [])
                )

                return count >= target_value

            elif condition_type == "streak":
                # Get current streak
                streak = await self._get_current_streak(user_id, goal_id)
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
                # Check if user completed all check-ins in a week
                today = date.today()
                week_start = today - timedelta(days=today.weekday())

                query = (
                    supabase.table("check_ins")
                    .select("date")
                    .eq("user_id", user_id)
                    .eq("completed", True)
                    .gte("date", week_start.isoformat())
                    .lte("date", today.isoformat())
                )

                if goal_id:
                    query = query.eq("goal_id", goal_id)

                result = query.execute()
                completed_dates = {row["date"] for row in (result.data or [])}

                # Check if all 7 days have check-ins (or goal's target_days)
                if goal_id:
                    goal = (
                        supabase.table("goals")
                        .select("target_days")
                        .eq("id", goal_id)
                        .maybe_single()
                        .execute()
                    )
                    if goal.data:
                        target_days = goal.data.get("target_days", 7)
                    else:
                        target_days = 7
                else:
                    target_days = 7

                return len(completed_dates) >= min(target_days, 7)

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
                time_condition = condition_data.get("condition")  # "before", "after", "between"
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

    async def _get_current_streak(self, user_id: str, goal_id: Optional[str]) -> int:
        """
        Get current streak for user/goal.

        Args:
            user_id: User ID
            goal_id: Optional goal ID

        Returns:
            Current streak count (days)
        """
        supabase = get_supabase_client()

        # Get all completed check-ins, ordered by date descending
        query = (
            supabase.table("check_ins")
            .select("date")
            .eq("user_id", user_id)
            .eq("completed", True)
            .order("date", desc=True)
        )

        if goal_id:
            query = query.eq("goal_id", goal_id)

        result = query.execute()
        check_ins = result.data or []

        if not check_ins:
            return 0

        # Calculate streak by checking consecutive days
        streak = 0
        today = date.today()
        current_date = today

        for check_in in check_ins:
            check_in_date = (
                check_in["date"]
                if isinstance(check_in["date"], date)
                else date.fromisoformat(str(check_in["date"]))
            )

            # Check if this date matches our expected date
            if check_in_date == current_date:
                streak += 1
                current_date -= timedelta(days=1)
            elif check_in_date < current_date:
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
        goal_id: Optional[str],
        achievement_data: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """
        Unlock an achievement for a user.

        Args:
            user_id: User ID
            achievement_type_id: Achievement type ID
            goal_id: Optional goal ID
            achievement_data: Achievement type data

        Returns:
            Unlocked achievement data or None if failed
        """
        supabase = get_supabase_client()

        try:
            # Create user achievement record
            achievement_record = {
                "user_id": user_id,
                "achievement_type_id": achievement_type_id,
                "goal_id": goal_id,
                "metadata": {},
            }

            # Add metadata based on achievement type
            if "streak" in achievement_data.get("badge_key", ""):
                streak = await self._get_current_streak(user_id, goal_id)
                achievement_record["metadata"] = {"streak": streak}
            elif "checkin" in achievement_data.get("badge_key", ""):
                # Get check-in count
                query = (
                    supabase.table("check_ins")
                    .select("id", count="exact")
                    .eq("user_id", user_id)
                    .eq("completed", True)
                )
                if goal_id:
                    query = query.eq("goal_id", goal_id)
                result = query.execute()
                count = (
                    result.count if hasattr(result, "count") else len(result.data or [])
                )
                achievement_record["metadata"] = {"checkin_count": count}

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

    async def get_user_achievements(
        self, user_id: str, goal_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get all achievements unlocked by a user.

        Args:
            user_id: User ID
            goal_id: Optional goal ID to filter by

        Returns:
            List of user achievements
        """
        supabase = get_supabase_client()

        try:
            query = (
                supabase.table("user_achievements")
                .select("*, achievement_types(*)")
                .eq("user_id", user_id)
                .order("unlocked_at", desc=True)
            )

            if goal_id:
                query = query.eq("goal_id", goal_id)
            else:
                query = query.is_("goal_id", "null")

            result = query.execute()
            return result.data or []

        except Exception as e:
            logger.error(
                f"Failed to get achievements for user {user_id}",
                {"error": str(e), "user_id": user_id},
            )
            return []


# Global instance
achievement_service = AchievementService()
