"""
Social Accountability Service

Handles accountability partners and social nudges.
"""

from typing import Dict, Any, List, Optional
from datetime import date
from app.core.database import get_supabase_client
from app.services.logger import logger


class SocialAccountabilityService:
    """Service for managing social accountability features"""

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
