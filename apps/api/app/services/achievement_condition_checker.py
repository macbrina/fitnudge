"""
Achievement Condition Checker

Handles checking if achievement unlock conditions are met.
Separated for cleaner code organization and easier testing.

Supported condition types (must match achievement_types.unlock_condition):
- streak: Check-in streak across all goals
- checkin_count: Total completed check-ins
- goal_count: Total goals created
- perfect_week: 7 consecutive days with check-ins
- workout_count: Completed workout sessions
- perfect_workout: At least one workout with no skipped exercises
- perfect_workout_count: Count of perfect workouts
- workout_time: Workout at specific time (before, after, between)
- workout_duration: Workout lasting X minutes
- workout_streak: Consecutive days with workouts
- weekly_workouts: Workouts in current week
- partner_count: Active accountability partners
- nudges_sent: Total nudges sent
- meal_count: Total meals logged
- hydration_count: Total hydration logs
- challenge_count: Challenges participated in
- challenge_won: Challenges won (rank 1)
- post_count: Posts created (future)
- comment_count: Comments created (future)
- likes_received: Likes received on posts (future)
"""

import json
from datetime import date, datetime, timedelta
from typing import Any, Dict, Optional

from app.core.database import get_supabase_client
from app.services.logger import logger


class AchievementConditionChecker:
    """Handles checking achievement unlock conditions"""

    async def check_condition(self, user_id: str, condition: str) -> bool:
        """
        Check if an achievement condition is met.

        Args:
            user_id: User ID
            condition: JSON string describing the condition

        Returns:
            True if condition is met, False otherwise
        """
        try:
            condition_data = (
                json.loads(condition) if isinstance(condition, str) else condition
            )
            condition_type = condition_data.get("type")
            target_value = condition_data.get("value")

            supabase = get_supabase_client()

            # ==========================================
            # GENERAL CONDITION TYPES
            # ==========================================

            if condition_type == "checkin_count":
                return await self._check_checkin_count(supabase, user_id, target_value)

            elif condition_type == "streak":
                return await self._check_streak(user_id, target_value)

            elif condition_type == "goal_count":
                return await self._check_goal_count(supabase, user_id, target_value)

            elif condition_type == "perfect_week":
                return await self._check_perfect_week(supabase, user_id)

            # ==========================================
            # WORKOUT CONDITION TYPES
            # ==========================================

            elif condition_type == "workout_count":
                return await self._check_workout_count(supabase, user_id, target_value)

            elif condition_type == "perfect_workout":
                return await self._check_perfect_workout(supabase, user_id)

            elif condition_type == "perfect_workout_count":
                return await self._check_perfect_workout_count(
                    supabase, user_id, target_value
                )

            elif condition_type == "workout_time":
                return await self._check_workout_time(supabase, user_id, condition_data)

            elif condition_type == "workout_duration":
                return await self._check_workout_duration(
                    supabase, user_id, condition_data
                )

            elif condition_type == "workout_streak":
                return await self._check_workout_streak(user_id, target_value)

            elif condition_type == "weekly_workouts":
                return await self._check_weekly_workouts(
                    supabase, user_id, target_value
                )

            # ==========================================
            # SOCIAL & PARTNER CONDITION TYPES
            # ==========================================

            elif condition_type == "partner_count":
                return await self._check_partner_count(supabase, user_id, target_value)

            elif condition_type == "nudges_sent":
                return await self._check_nudges_sent(supabase, user_id, target_value)

            # ==========================================
            # MEAL & HYDRATION CONDITION TYPES
            # ==========================================

            elif condition_type == "meal_count":
                return await self._check_meal_count(supabase, user_id, target_value)

            elif condition_type == "hydration_count":
                return await self._check_hydration_count(
                    supabase, user_id, target_value
                )

            # ==========================================
            # CHALLENGE CONDITION TYPES
            # ==========================================

            elif condition_type == "challenge_count":
                return await self._check_challenge_count(
                    supabase, user_id, target_value
                )

            elif condition_type == "challenge_won":
                return await self._check_challenge_won(supabase, user_id, target_value)

            # ==========================================
            # SOCIAL POSTS/COMMENTS/LIKES CONDITION TYPES
            # (For future social features)
            # ==========================================

            elif condition_type == "post_count":
                return await self._check_post_count(supabase, user_id, target_value)

            elif condition_type == "comment_count":
                return await self._check_comment_count(supabase, user_id, target_value)

            elif condition_type == "likes_received":
                return await self._check_likes_received(supabase, user_id, target_value)

            # Unknown condition type
            logger.warning(
                f"Unknown achievement condition type: {condition_type}",
                {"condition": condition, "user_id": user_id},
            )
            return False

        except Exception as e:
            logger.error(
                f"Failed to check achievement condition: {e}",
                {"condition": condition, "error": str(e)},
            )
            return False

    # ==========================================
    # GENERAL CONDITION IMPLEMENTATIONS
    # ==========================================

    async def _check_checkin_count(
        self, supabase: Any, user_id: str, target_value: int
    ) -> bool:
        """Count total check-ins across all goals (completed = true)"""
        result = (
            supabase.table("check_ins")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("completed", True)
            .execute()
        )
        count = result.count if hasattr(result, "count") else len(result.data or [])
        return count >= target_value

    async def _check_streak(self, user_id: str, target_value: int) -> bool:
        """Check if current streak meets target"""
        streak = await self.get_current_streak(user_id)
        return streak >= target_value

    async def _check_goal_count(
        self, supabase: Any, user_id: str, target_value: int
    ) -> bool:
        """Count total goals created"""
        result = (
            supabase.table("goals")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .execute()
        )
        count = result.count if hasattr(result, "count") else len(result.data or [])
        return count >= target_value

    async def _check_perfect_week(self, supabase: Any, user_id: str) -> bool:
        """Check if user completed all check-ins in a week"""
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
        return len(completed_dates) >= 7

    # ==========================================
    # WORKOUT CONDITION IMPLEMENTATIONS
    # ==========================================

    async def _check_workout_count(
        self, supabase: Any, user_id: str, target_value: int
    ) -> bool:
        """Count completed workout sessions"""
        result = (
            supabase.table("workout_sessions")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("status", "completed")
            .execute()
        )
        count = result.count if hasattr(result, "count") else len(result.data or [])
        return count >= target_value

    async def _check_perfect_workout(self, supabase: Any, user_id: str) -> bool:
        """Check if user completed at least one workout without skipping"""
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

    async def _check_perfect_workout_count(
        self, supabase: Any, user_id: str, target_value: int
    ) -> bool:
        """Count perfect workouts (no skipped exercises)"""
        result = (
            supabase.table("workout_sessions")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("status", "completed")
            .eq("exercises_skipped", 0)
            .execute()
        )
        count = result.count if hasattr(result, "count") else len(result.data or [])
        return count >= target_value

    async def _check_workout_time(
        self, supabase: Any, user_id: str, condition_data: Dict[str, Any]
    ) -> bool:
        """Check if user completed a workout at a specific time"""
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
                session_time = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
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

    async def _check_workout_duration(
        self, supabase: Any, user_id: str, condition_data: Dict[str, Any]
    ) -> bool:
        """Check if user completed a workout of a certain duration"""
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

    async def _check_workout_streak(self, user_id: str, target_value: int) -> bool:
        """Check if current workout streak meets target"""
        streak = await self.get_workout_streak(user_id)
        return streak >= target_value

    async def _check_weekly_workouts(
        self, supabase: Any, user_id: str, target_value: int
    ) -> bool:
        """Check if user completed X workouts in current week"""
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
        count = result.count if hasattr(result, "count") else len(result.data or [])
        return count >= target_value

    # ==========================================
    # SOCIAL & PARTNER CONDITION IMPLEMENTATIONS
    # ==========================================

    async def _check_partner_count(
        self, supabase: Any, user_id: str, target_value: int
    ) -> bool:
        """Count active accountability partners"""
        result = (
            supabase.table("accountability_partners")
            .select("id", count="exact")
            .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
            .eq("status", "accepted")
            .execute()
        )
        count = result.count if hasattr(result, "count") else len(result.data or [])
        return count >= target_value

    async def _check_nudges_sent(
        self, supabase: Any, user_id: str, target_value: int
    ) -> bool:
        """Count nudges sent by user"""
        result = (
            supabase.table("social_nudges")
            .select("id", count="exact")
            .eq("sender_id", user_id)
            .execute()
        )
        count = result.count if hasattr(result, "count") else len(result.data or [])
        return count >= target_value

    # ==========================================
    # MEAL & HYDRATION CONDITION IMPLEMENTATIONS
    # ==========================================

    async def _check_meal_count(
        self, supabase: Any, user_id: str, target_value: int
    ) -> bool:
        """Count meals logged by user"""
        result = (
            supabase.table("meal_logs")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .execute()
        )
        count = result.count if hasattr(result, "count") else len(result.data or [])
        return count >= target_value

    async def _check_hydration_count(
        self, supabase: Any, user_id: str, target_value: int
    ) -> bool:
        """Count hydration logs by user"""
        result = (
            supabase.table("hydration_logs")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .execute()
        )
        count = result.count if hasattr(result, "count") else len(result.data or [])
        return count >= target_value

    # ==========================================
    # CHALLENGE CONDITION IMPLEMENTATIONS
    # ==========================================

    async def _check_challenge_count(
        self, supabase: Any, user_id: str, target_value: int
    ) -> bool:
        """Count challenges user has participated in"""
        result = (
            supabase.table("challenge_participants")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .execute()
        )
        count = result.count if hasattr(result, "count") else len(result.data or [])
        return count >= target_value

    async def _check_challenge_won(
        self, supabase: Any, user_id: str, target_value: int
    ) -> bool:
        """Count challenges won by user (rank 1)"""
        result = (
            supabase.table("challenge_statistics")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("final_rank", 1)
            .execute()
        )
        count = result.count if hasattr(result, "count") else len(result.data or [])
        return count >= target_value

    # ==========================================
    # SOCIAL POSTS/COMMENTS/LIKES IMPLEMENTATIONS
    # (For future social features)
    # ==========================================

    async def _check_post_count(
        self, supabase: Any, user_id: str, target_value: int
    ) -> bool:
        """Count posts created by user"""
        result = (
            supabase.table("posts")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .execute()
        )
        count = result.count if hasattr(result, "count") else len(result.data or [])
        return count >= target_value

    async def _check_comment_count(
        self, supabase: Any, user_id: str, target_value: int
    ) -> bool:
        """Count comments created by user"""
        result = (
            supabase.table("comments")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .execute()
        )
        count = result.count if hasattr(result, "count") else len(result.data or [])
        return count >= target_value

    async def _check_likes_received(
        self, supabase: Any, user_id: str, target_value: int
    ) -> bool:
        """Count likes received on user's posts"""
        # First get all user's post IDs, then count likes on those posts
        posts_result = (
            supabase.table("posts").select("id").eq("user_id", user_id).execute()
        )
        post_ids = [p["id"] for p in (posts_result.data or [])]

        if not post_ids:
            return False

        likes_result = (
            supabase.table("likes")
            .select("id", count="exact")
            .in_("post_id", post_ids)
            .execute()
        )
        count = (
            likes_result.count
            if hasattr(likes_result, "count")
            else len(likes_result.data or [])
        )
        return count >= target_value

    # ==========================================
    # STREAK CALCULATION HELPERS
    # ==========================================

    async def get_current_streak(self, user_id: str) -> int:
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

    async def get_workout_streak(self, user_id: str) -> int:
        """
        Get current workout streak for user (consecutive days with workouts).

        Args:
            user_id: User ID

        Returns:
            Current workout streak count (days)
        """
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


# Global instance
condition_checker = AchievementConditionChecker()

