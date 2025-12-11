"""
Meal Tracking Service

Handles meal logging and daily nutrition summaries for accountability tracking.
"""

from typing import Dict, Any, List, Optional
from datetime import date, time
from app.core.database import get_supabase_client
from app.services.logger import logger


class MealTrackingService:
    """Service for managing meal tracking"""

    async def log_meal(
        self,
        user_id: str,
        meal_type: str,
        logged_date: date,
        meal_name: Optional[str] = None,
        meal_description: Optional[str] = None,
        logged_time: Optional[time] = None,
        goal_id: Optional[str] = None,
        estimated_protein: Optional[int] = None,
        estimated_calories: Optional[int] = None,
        notes: Optional[str] = None,
        photo_urls: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Log a meal for a user.

        Args:
            user_id: User ID
            meal_type: Type of meal (breakfast, lunch, dinner, snack, other)
            logged_date: Date of meal
            meal_name: Name of meal (optional)
            meal_description: Description of meal (optional)
            logged_time: Time of meal (optional)
            goal_id: Optional goal ID if meal is related to a goal
            estimated_protein: Estimated protein in grams (optional)
            estimated_calories: Estimated calories (optional)
            notes: Additional notes (optional)
            photo_urls: List of photo URLs (optional)

        Returns:
            Created meal log data
        """
        supabase = get_supabase_client()

        try:
            # Verify goal belongs to user if provided
            if goal_id:
                goal = (
                    supabase.table("goals")
                    .select("id, user_id")
                    .eq("id", goal_id)
                    .eq("user_id", user_id)
                    .maybe_single()
                    .execute()
                )

                if not goal.data:
                    raise ValueError("Goal not found or you don't have permission")

            meal_data = {
                "user_id": user_id,
                "goal_id": goal_id,
                "meal_type": meal_type,
                "meal_name": meal_name,
                "meal_description": meal_description,
                "logged_date": logged_date.isoformat(),
                "logged_time": logged_time.isoformat() if logged_time else None,
                "estimated_protein": estimated_protein,
                "estimated_calories": estimated_calories,
                "notes": notes,
                "photo_urls": photo_urls or [],
            }

            result = supabase.table("meal_logs").insert(meal_data).execute()

            # Daily nutrition summary will be updated automatically via trigger

            print(
                f"Meal logged for user {user_id}",
                {
                    "user_id": user_id,
                    "meal_type": meal_type,
                    "logged_date": logged_date.isoformat(),
                },
            )

            return result.data[0] if result.data else None

        except Exception as e:
            logger.error(
                f"Failed to log meal for user {user_id}: {e}",
                {"error": str(e), "user_id": user_id},
            )
            raise

    async def get_meal_logs(
        self,
        user_id: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        goal_id: Optional[str] = None,
        meal_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        Get meal logs for a user.

        Args:
            user_id: User ID
            start_date: Start date filter (optional)
            end_date: End date filter (optional)
            goal_id: Goal ID filter (optional)
            meal_type: Meal type filter (optional)
            limit: Number of records to return
            offset: Offset for pagination

        Returns:
            List of meal logs
        """
        supabase = get_supabase_client()

        try:
            query = (
                supabase.table("meal_logs")
                .select(
                    """
                *,
                goal:goals(id, title, category)
                """
                )
                .eq("user_id", user_id)
            )

            if start_date:
                query = query.gte("logged_date", start_date.isoformat())
            if end_date:
                query = query.lte("logged_date", end_date.isoformat())
            if goal_id:
                query = query.eq("goal_id", goal_id)
            if meal_type:
                query = query.eq("meal_type", meal_type)

            result = (
                query.order("logged_date", desc=True)
                .order("logged_time", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )

            return result.data if result.data else []

        except Exception as e:
            logger.error(
                f"Failed to get meal logs for user {user_id}: {e}",
                {"error": str(e), "user_id": user_id},
            )
            raise

    async def update_meal_log(
        self,
        meal_log_id: str,
        user_id: str,
        meal_type: Optional[str] = None,
        meal_name: Optional[str] = None,
        meal_description: Optional[str] = None,
        logged_time: Optional[time] = None,
        estimated_protein: Optional[int] = None,
        estimated_calories: Optional[int] = None,
        notes: Optional[str] = None,
        photo_urls: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Update a meal log.

        Args:
            meal_log_id: Meal log ID
            user_id: User ID (for verification)
            meal_type: Type of meal (optional)
            meal_name: Name of meal (optional)
            meal_description: Description of meal (optional)
            logged_time: Time of meal (optional)
            estimated_protein: Estimated protein in grams (optional)
            estimated_calories: Estimated calories (optional)
            notes: Additional notes (optional)
            photo_urls: List of photo URLs (optional)

        Returns:
            Updated meal log data
        """
        supabase = get_supabase_client()

        try:
            # Verify meal log belongs to user
            meal_log = (
                supabase.table("meal_logs")
                .select("id, user_id")
                .eq("id", meal_log_id)
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )

            if not meal_log.data:
                raise ValueError("Meal log not found or you don't have permission")

            # Build update data (only include non-None values)
            update_data = {}
            if meal_type is not None:
                update_data["meal_type"] = meal_type
            if meal_name is not None:
                update_data["meal_name"] = meal_name
            if meal_description is not None:
                update_data["meal_description"] = meal_description
            if logged_time is not None:
                update_data["logged_time"] = logged_time.isoformat()
            if estimated_protein is not None:
                update_data["estimated_protein"] = estimated_protein
            if estimated_calories is not None:
                update_data["estimated_calories"] = estimated_calories
            if notes is not None:
                update_data["notes"] = notes
            if photo_urls is not None:
                update_data["photo_urls"] = photo_urls

            if not update_data:
                # No updates to make
                result = (
                    supabase.table("meal_logs")
                    .select("*")
                    .eq("id", meal_log_id)
                    .maybe_single()
                    .execute()
                )
                return result.data if result.data else None

            result = (
                supabase.table("meal_logs")
                .update(update_data)
                .eq("id", meal_log_id)
                .execute()
            )

            return result.data[0] if result.data else None

        except Exception as e:
            logger.error(
                f"Failed to update meal log {meal_log_id}: {e}",
                {"error": str(e), "meal_log_id": meal_log_id},
            )
            raise

    async def delete_meal_log(self, meal_log_id: str, user_id: str) -> bool:
        """
        Delete a meal log.

        Args:
            meal_log_id: Meal log ID
            user_id: User ID (for verification)

        Returns:
            True if successful
        """
        supabase = get_supabase_client()

        try:
            # Verify meal log belongs to user
            meal_log = (
                supabase.table("meal_logs")
                .select("id")
                .eq("id", meal_log_id)
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )

            if not meal_log.data:
                raise ValueError("Meal log not found or you don't have permission")

            supabase.table("meal_logs").delete().eq("id", meal_log_id).execute()

            return True

        except Exception as e:
            logger.error(
                f"Failed to delete meal log {meal_log_id}: {e}",
                {"error": str(e), "meal_log_id": meal_log_id},
            )
            raise

    async def get_daily_nutrition_summary(
        self,
        user_id: str,
        summary_date: date,
        goal_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Get daily nutrition summary for a user.

        Args:
            user_id: User ID
            summary_date: Date to get summary for
            goal_id: Optional goal ID filter

        Returns:
            Daily nutrition summary or None if not found
        """
        supabase = get_supabase_client()

        try:
            query = (
                supabase.table("daily_nutrition_summaries")
                .select(
                    """
                *,
                goal:goals(id, title, category)
                """
                )
                .eq("user_id", user_id)
                .eq("summary_date", summary_date.isoformat())
            )

            if goal_id:
                query = query.eq("goal_id", goal_id)
            else:
                query = query.is_("goal_id", "null")

            result = query.maybe_single().execute()

            return result.data if result.data else None

        except Exception as e:
            logger.error(
                f"Failed to get daily nutrition summary for user {user_id}: {e}",
                {
                    "error": str(e),
                    "user_id": user_id,
                    "summary_date": summary_date.isoformat(),
                },
            )
            return None

    async def get_nutrition_summaries(
        self,
        user_id: str,
        start_date: date,
        end_date: date,
        goal_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get nutrition summaries for a date range.

        Args:
            user_id: User ID
            start_date: Start date
            end_date: End date
            goal_id: Optional goal ID filter

        Returns:
            List of nutrition summaries
        """
        supabase = get_supabase_client()

        try:
            query = (
                supabase.table("daily_nutrition_summaries")
                .select(
                    """
                *,
                goal:goals(id, title, category)
                """
                )
                .eq("user_id", user_id)
                .gte("summary_date", start_date.isoformat())
                .lte("summary_date", end_date.isoformat())
            )

            if goal_id:
                query = query.eq("goal_id", goal_id)

            result = query.order("summary_date", desc=True).execute()

            return result.data if result.data else []

        except Exception as e:
            logger.error(
                f"Failed to get nutrition summaries for user {user_id}: {e}",
                {
                    "error": str(e),
                    "user_id": user_id,
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                },
            )
            return []


# Global instance
meal_tracking_service = MealTrackingService()
