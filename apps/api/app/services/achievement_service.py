"""
Achievement Service

Handles achievement badge unlocking logic.
Checks user progress and unlocks badges when conditions are met.
"""

from typing import Dict, Any, Optional, List
from app.core.database import get_supabase_client
from app.services.logger import logger
from app.services.achievement_condition_checker import condition_checker


class AchievementService:
    """Service for managing achievement badges"""

    async def check_and_unlock_achievements(
        self,
        user_id: str,
        source_type: Optional[str] = None,  # "goal", "partner", "nudge", etc.
        source_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Check user progress and unlock any eligible achievements.

        Args:
            user_id: User ID to check
            source_type: Optional source type for metadata
            source_id: Optional source ID for metadata

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

                # Check if condition is met using the condition checker
                # Returns both the result AND metadata to avoid duplicate queries
                condition_met, condition_metadata = (
                    await condition_checker.check_condition(
                        user_id, achievement["unlock_condition"]
                    )
                )

                if condition_met:
                    # Unlock the achievement with metadata from condition check
                    unlocked = await self._unlock_achievement(
                        user_id,
                        achievement["id"],
                        achievement,
                        condition_metadata,
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

    async def _unlock_achievement(
        self,
        user_id: str,
        achievement_type_id: str,
        achievement_data: Dict[str, Any],
        condition_metadata: Dict[str, Any],
        source_type: Optional[str] = None,
        source_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Unlock an achievement for a user.

        Args:
            user_id: User ID
            achievement_type_id: Achievement type ID
            achievement_data: Achievement type data
            condition_metadata: Metadata from condition check (avoids duplicate queries)
            source_type: Optional source type for metadata
            source_id: Optional source ID for metadata

        Returns:
            Unlocked achievement data or None if failed
        """
        supabase = get_supabase_client()

        try:
            # Build metadata - start with condition metadata (stats from the check)
            metadata: Dict[str, Any] = {**condition_metadata}

            # Add source info if provided
            if source_type and source_id:
                metadata["source_type"] = source_type
                metadata["source_id"] = source_id

            # Create user achievement record
            achievement_record = {
                "user_id": user_id,
                "achievement_type_id": achievement_type_id,
                "metadata": metadata,
            }

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

                logger.info(
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
