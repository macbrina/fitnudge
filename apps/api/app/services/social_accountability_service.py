"""
FitNudge V2 - Social Accountability Service

Handles accountability partners and social nudges.
"""

from typing import Dict, Any
from datetime import datetime, timezone
from app.core.database import get_supabase_client
from app.services.logger import logger


class SocialAccountabilityService:
    """Service for managing social accountability features"""

    async def notify_partners_of_data_change(
        self, user_id: str, change_type: str = "data"
    ) -> int:
        """
        Touch accountability_partners table to trigger realtime events for partners.

        When a user updates their goals/check-ins, their partners need
        to be notified so their PartnerDetailScreen can refresh and show updated data.

        This updates the updated_at field on all partnerships involving this user,
        which triggers Supabase Realtime events to all partners.

        Args:
            user_id: The user whose data changed
            change_type: Description of what changed (for logging)

        Returns:
            Number of partners notified
        """
        supabase = get_supabase_client()

        try:
            # Update all accepted partnerships where this user is involved
            # This triggers realtime events to their partners
            result = (
                supabase.table("accountability_partners")
                .update({"updated_at": datetime.now(timezone.utc).isoformat()})
                .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
                .eq("status", "accepted")
                .execute()
            )

            partner_count = len(result.data) if result.data else 0
            if partner_count > 0:
                logger.info(
                    f"Notified {partner_count} partnership records of {change_type} change for user {user_id}"
                )
            return partner_count
        except Exception as e:
            # Don't fail the main operation if partner notification fails
            logger.warning(f"Failed to notify partners of {change_type} change: {e}")
            return 0

    def notify_partners_of_data_change_sync(
        self, user_id: str, change_type: str = "data"
    ) -> int:
        """
        Sync version of notify_partners_of_data_change for use in Celery tasks.

        Touch accountability_partners table to trigger realtime events for partners.
        """
        supabase = get_supabase_client()

        try:
            result = (
                supabase.table("accountability_partners")
                .update({"updated_at": datetime.now(timezone.utc).isoformat()})
                .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
                .eq("status", "accepted")
                .execute()
            )

            partner_count = len(result.data) if result.data else 0
            if partner_count > 0:
                logger.info(
                    f"Notified {partner_count} partnership records of {change_type} change for user {user_id}"
                )
            return partner_count
        except Exception as e:
            logger.warning(f"Failed to notify partners of {change_type} change: {e}")
            return 0

    def notify_partners_for_multiple_users_sync(
        self, user_ids: list, change_type: str = "data"
    ) -> int:
        """
        Sync version of partner notification for multiple users.
        Used in Celery tasks that affect multiple users at once.

        Args:
            user_ids: List of user IDs whose partners should be notified
            change_type: Description of what changed (for logging)

        Returns:
            Total number of partnerships notified
        """
        if not user_ids:
            return 0

        supabase = get_supabase_client()
        total_notified = 0

        try:
            # Build OR condition for all user IDs
            # Each user can be either user_id or partner_user_id in the partnership
            or_conditions = ",".join(
                [f"user_id.eq.{uid},partner_user_id.eq.{uid}" for uid in user_ids]
            )

            result = (
                supabase.table("accountability_partners")
                .update({"updated_at": datetime.now(timezone.utc).isoformat()})
                .or_(or_conditions)
                .eq("status", "accepted")
                .execute()
            )

            total_notified = len(result.data) if result.data else 0
            if total_notified > 0:
                logger.info(
                    f"Notified {total_notified} partnership records of {change_type} change for {len(user_ids)} users"
                )
        except Exception as e:
            logger.warning(f"Failed to notify partners for multiple users: {e}")

        return total_notified

    async def request_accountability_partner(
        self, user_id: str, partner_user_id: str
    ) -> Dict[str, Any]:
        """
        Request an accountability partnership.

        Args:
            user_id: User ID requesting partnership
            partner_user_id: User ID of potential partner

        Returns:
            Created partnership request
        """
        supabase = get_supabase_client()

        try:
            # Check if partnership already exists
            existing = (
                supabase.table("accountability_partners")
                .select("id, status")
                .or_(
                    f"user_id.eq.{user_id},partner_user_id.eq.{user_id}",
                    f"user_id.eq.{partner_user_id},partner_user_id.eq.{partner_user_id}",
                )
                .execute()
            )

            if existing.data:
                # Check if it's the same pair (different order)
                for partner in existing.data:
                    if (
                        partner.get("user_id") == user_id
                        and partner.get("partner_user_id") == partner_user_id
                    ) or (
                        partner.get("user_id") == partner_user_id
                        and partner.get("partner_user_id") == user_id
                    ):
                        if partner.get("status") == "accepted":
                            raise ValueError("Partnership already exists")
                        elif partner.get("status") == "pending":
                            raise ValueError("Partnership request already pending")

            # Create partnership request (bidirectional)
            partnership_data = [
                {
                    "user_id": user_id,
                    "partner_user_id": partner_user_id,
                    "status": "pending",
                    "initiated_by_user_id": user_id,
                },
                {
                    "user_id": partner_user_id,
                    "partner_user_id": user_id,
                    "status": "pending",
                    "initiated_by_user_id": user_id,
                },
            ]

            result = (
                supabase.table("accountability_partners")
                .insert(partnership_data)
                .execute()
            )

            print(
                f"Accountability partnership requested: {user_id} <-> {partner_user_id}",
                {"user_id": user_id, "partner_user_id": partner_user_id},
            )

            return result.data[0] if result.data else None

        except Exception as e:
            logger.error(
                f"Failed to request accountability partner: {e}",
                {
                    "error": str(e),
                    "user_id": user_id,
                    "partner_user_id": partner_user_id,
                },
            )
            raise

    async def accept_accountability_partner(
        self, user_id: str, partner_user_id: str
    ) -> bool:
        """
        Accept an accountability partnership request.

        Args:
            user_id: User ID accepting
            partner_user_id: Partner user ID

        Returns:
            True if successful
        """
        supabase = get_supabase_client()

        try:
            # Update both directions
            from datetime import datetime

            supabase.table("accountability_partners").update(
                {"status": "accepted", "accepted_at": datetime.now().isoformat()}
            ).or_(
                f"user_id.eq.{user_id},partner_user_id.eq.{partner_user_id}",
                f"user_id.eq.{partner_user_id},partner_user_id.eq.{user_id}",
            ).execute()

            print(
                f"Accountability partnership accepted: {user_id} <-> {partner_user_id}",
                {"user_id": user_id, "partner_user_id": partner_user_id},
            )

            return True

        except Exception as e:
            logger.error(
                f"Failed to accept accountability partner: {e}",
                {
                    "error": str(e),
                    "user_id": user_id,
                    "partner_user_id": partner_user_id,
                },
            )
            raise


# Global instance
social_accountability_service = SocialAccountabilityService()
