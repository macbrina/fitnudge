"""
Social Accountability Service

Handles goal sharing, accountability partners, and group goals.
"""

from typing import Dict, Any, List, Optional
from datetime import date
from app.core.database import get_supabase_client
from app.services.logger import logger


class SocialAccountabilityService:
    """Service for managing social accountability features"""

    async def share_goal_with_user(
        self,
        goal_id: str,
        shared_with_user_id: str,
        owner_user_id: str,
        permission_level: str = "view",
    ) -> Dict[str, Any]:
        """
        Share a goal with a specific user.

        Args:
            goal_id: Goal ID to share
            shared_with_user_id: User ID to share with
            owner_user_id: User ID of goal owner
            permission_level: Permission level (view, comment, motivate)

        Returns:
            Created goal share data
        """
        supabase = get_supabase_client()

        try:
            # Verify goal belongs to owner
            goal = (
                supabase.table("goals")
                .select("id, user_id, title")
                .eq("id", goal_id)
                .eq("user_id", owner_user_id)
                .maybe_single()
                .execute()
            )

            if not goal.data:
                raise ValueError("Goal not found or you don't have permission")

            # Check if already shared
            existing = (
                supabase.table("goal_shares")
                .select("id")
                .eq("goal_id", goal_id)
                .eq("shared_with_user_id", shared_with_user_id)
                .execute()
            )

            if existing.data:
                # Update existing share
                result = (
                    supabase.table("goal_shares")
                    .update(
                        {
                            "permission_level": permission_level,
                            "is_active": True,
                        }
                    )
                    .eq("id", existing.data[0]["id"])
                    .execute()
                )
                return result.data[0] if result.data else None

            # Create new share
            share_data = {
                "goal_id": goal_id,
                "shared_with_user_id": shared_with_user_id,
                "shared_by_user_id": owner_user_id,
                "permission_level": permission_level,
                "is_active": True,
            }

            result = supabase.table("goal_shares").insert(share_data).execute()

            # Update goal's is_shared flag
            supabase.table("goals").update({"is_shared": True}).eq(
                "id", goal_id
            ).execute()

            print(
                f"Goal {goal_id} shared with user {shared_with_user_id}",
                {
                    "goal_id": goal_id,
                    "shared_with_user_id": shared_with_user_id,
                    "owner_user_id": owner_user_id,
                },
            )

            return result.data[0] if result.data else None

        except Exception as e:
            logger.error(
                f"Failed to share goal {goal_id} with user {shared_with_user_id}: {e}",
                {
                    "error": str(e),
                    "goal_id": goal_id,
                    "shared_with_user_id": shared_with_user_id,
                },
            )
            raise

    async def unshare_goal(
        self, goal_id: str, shared_with_user_id: str, owner_user_id: str
    ) -> bool:
        """
        Unshare a goal with a user.

        Args:
            goal_id: Goal ID
            shared_with_user_id: User ID to unshare with
            owner_user_id: User ID of goal owner

        Returns:
            True if successful
        """
        supabase = get_supabase_client()

        try:
            # Verify goal belongs to owner
            goal = (
                supabase.table("goals")
                .select("id")
                .eq("id", goal_id)
                .eq("user_id", owner_user_id)
                .maybe_single()
                .execute()
            )

            if not goal.data:
                raise ValueError("Goal not found or you don't have permission")

            # Remove share
            supabase.table("goal_shares").update({"is_active": False}).eq(
                "goal_id", goal_id
            ).eq("shared_with_user_id", shared_with_user_id).execute()

            print(
                f"Goal {goal_id} unshared with user {shared_with_user_id}",
                {"goal_id": goal_id, "shared_with_user_id": shared_with_user_id},
            )

            return True

        except Exception as e:
            logger.error(
                f"Failed to unshare goal {goal_id}: {e}",
                {"error": str(e), "goal_id": goal_id},
            )
            raise

    async def get_shared_goals(
        self, user_id: str, include_my_shared: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Get goals shared with the user or shared by the user.

        Args:
            user_id: User ID
            include_my_shared: Include goals shared by this user

        Returns:
            List of shared goals with metadata
        """
        supabase = get_supabase_client()

        try:
            query = (
                supabase.table("goal_shares")
                .select(
                    """
                *,
                goal:goals(id, title, description, category, frequency, target_days, user_id, is_active),
                shared_by:users!goal_shares_shared_by_user_id_fkey(id, name, username, profile_picture_url),
                shared_with:users!goal_shares_shared_with_user_id_fkey(id, name, username, profile_picture_url)
                """
                )
                .eq("is_active", True)
            )

            if include_my_shared:
                # Goals shared by this user
                query = query.eq("shared_by_user_id", user_id)
            else:
                # Goals shared with this user
                query = query.eq("shared_with_user_id", user_id)

            result = query.execute()
            return result.data if result.data else []

        except Exception as e:
            logger.error(
                f"Failed to get shared goals for user {user_id}: {e}",
                {"error": str(e), "user_id": user_id},
            )
            raise

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

    async def create_group_goal(
        self,
        goal_id: str,
        owner_user_id: str,
        member_user_ids: List[str],
    ) -> Dict[str, Any]:
        """
        Create a group goal and add members.

        Args:
            goal_id: Goal ID
            owner_user_id: Owner user ID
            member_user_ids: List of user IDs to add as members

        Returns:
            Created group goal data
        """
        supabase = get_supabase_client()

        try:
            # Verify goal belongs to owner
            goal = (
                supabase.table("goals")
                .select("id, user_id")
                .eq("id", goal_id)
                .eq("user_id", owner_user_id)
                .maybe_single()
                .execute()
            )

            if not goal.data:
                raise ValueError("Goal not found or you don't have permission")

            # Add owner as group goal member with 'owner' role
            group_goal_data = [
                {
                    "goal_id": goal_id,
                    "user_id": owner_user_id,
                    "role": "owner",
                    "is_active": True,
                }
            ]

            # Add members
            for member_id in member_user_ids:
                if member_id != owner_user_id:  # Don't add owner twice
                    group_goal_data.append(
                        {
                            "goal_id": goal_id,
                            "user_id": member_id,
                            "role": "member",
                            "is_active": True,
                        }
                    )

            result = supabase.table("group_goals").insert(group_goal_data).execute()

            # Update goal's is_group_goal flag
            supabase.table("goals").update({"is_group_goal": True}).eq(
                "id", goal_id
            ).execute()

            print(
                f"Group goal created: {goal_id} with {len(group_goal_data)} members",
                {"goal_id": goal_id, "owner_user_id": owner_user_id},
            )

            return {"goal_id": goal_id, "members": result.data} if result.data else None

        except Exception as e:
            logger.error(
                f"Failed to create group goal {goal_id}: {e}",
                {"error": str(e), "goal_id": goal_id},
            )
            raise

    async def add_group_goal_member(
        self,
        goal_id: str,
        user_id: str,
        admin_user_id: str,
        role: str = "member",
    ) -> Dict[str, Any]:
        """
        Add a member to a group goal.

        Args:
            goal_id: Goal ID
            user_id: User ID to add
            admin_user_id: Admin/Owner user ID
            role: Role for new member (member, admin)

        Returns:
            Created group goal membership
        """
        supabase = get_supabase_client()

        try:
            # Verify admin has permission
            admin_check = (
                supabase.table("group_goals")
                .select("role")
                .eq("goal_id", goal_id)
                .eq("user_id", admin_user_id)
                .in_("role", ["owner", "admin"])
                .maybe_single()
                .execute()
            )

            if not admin_check.data:
                raise ValueError("You don't have permission to add members")

            # Check if already a member
            existing = (
                supabase.table("group_goals")
                .select("id")
                .eq("goal_id", goal_id)
                .eq("user_id", user_id)
                .execute()
            )

            if existing.data:
                # Update existing membership
                result = (
                    supabase.table("group_goals")
                    .update({"role": role, "is_active": True})
                    .eq("id", existing.data[0]["id"])
                    .execute()
                )
                return result.data[0] if result.data else None

            # Create new membership
            membership_data = {
                "goal_id": goal_id,
                "user_id": user_id,
                "role": role,
                "is_active": True,
            }

            result = supabase.table("group_goals").insert(membership_data).execute()

            return result.data[0] if result.data else None

        except Exception as e:
            logger.error(
                f"Failed to add member to group goal {goal_id}: {e}",
                {"error": str(e), "goal_id": goal_id, "user_id": user_id},
            )
            raise

    async def get_group_goals(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get all group goals the user is part of.

        Args:
            user_id: User ID

        Returns:
            List of group goals with members
        """
        supabase = get_supabase_client()

        try:
            result = (
                supabase.table("group_goals")
                .select(
                    """
                *,
                goal:goals(id, title, description, category, frequency, target_days, is_active),
                user:users(id, name, username, profile_picture_url)
                """
                )
                .eq("user_id", user_id)
                .eq("is_active", True)
                .execute()
            )

            return result.data if result.data else []

        except Exception as e:
            logger.error(
                f"Failed to get group goals for user {user_id}: {e}",
                {"error": str(e), "user_id": user_id},
            )
            raise


# Global instance
social_accountability_service = SocialAccountabilityService()
