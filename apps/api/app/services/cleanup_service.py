"""
FitNudge V2 - Cleanup Service for Notifications

Provides fire-and-forget cleanup functions that don't block the main request.
Used when entities (goals, partner requests) are deleted.

SCALABILITY NOTES:
- All functions use batch operations where possible
- Use .in_() for bulk deletes instead of loops
- Pagination support for large datasets (BATCH_SIZE)
"""

import asyncio
from typing import List, Dict, Any
from app.services.logger import logger

# Batch size for paginated operations
CLEANUP_BATCH_SIZE = 500


# =====================================================
# GOAL NOTIFICATION CLEANUP
# =====================================================


def cleanup_goal_notifications_sync(
    supabase, goal_id: str, reason: str = "goal_deleted"
) -> int:
    """
    Synchronous version: Clean up all notifications referencing a goal.

    This covers:
    - reminder notifications
    - ai_motivation notifications
    - check-in prompts
    - streak milestone notifications
    - Any notification with entity_type='goal' and entity_id=goal_id

    Args:
        supabase: Supabase client
        goal_id: ID of the goal being deleted
        reason: Reason for cleanup (for logging)

    Returns:
        Number of notifications deleted
    """
    try:
        # Delete notifications where entity_type='goal' and entity_id=goal_id
        result = (
            supabase.table("notification_history")
            .delete()
            .eq("entity_type", "goal")
            .eq("entity_id", goal_id)
            .execute()
        )

        deleted_count = len(result.data or [])

        if deleted_count > 0:
            logger.info(
                f"Goal notification cleanup ({reason})",
                {
                    "goal_id": goal_id,
                    "reason": reason,
                    "notifications_deleted": deleted_count,
                },
            )

        return deleted_count

    except Exception as e:
        logger.error(
            f"Failed to cleanup goal notifications: {e}",
            {"goal_id": goal_id, "error": str(e)},
        )
        return 0


async def cleanup_goal_notifications(goal_id: str, reason: str = "goal_deleted") -> int:
    """
    Async version: Clean up goal notifications.
    Gets its own supabase client to avoid connection issues.

    Args:
        goal_id: ID of the goal being deleted
        reason: Reason for cleanup (for logging)

    Returns:
        Number of notifications deleted
    """
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    return cleanup_goal_notifications_sync(supabase, goal_id, reason)


def fire_and_forget_goal_cleanup(goal_id: str, reason: str = "deleted"):
    """
    Fire-and-forget wrapper for goal notification cleanup.
    Schedules the cleanup as a background task that won't block the response.

    Usage:
        fire_and_forget_goal_cleanup(goal_id, reason="deleted")
    """
    asyncio.create_task(_safe_goal_cleanup(goal_id, reason))


async def _safe_goal_cleanup(goal_id: str, reason: str):
    """Wrapper that catches all exceptions to prevent unhandled errors."""
    try:
        await cleanup_goal_notifications(goal_id, reason)
    except Exception as e:
        logger.error(
            f"Fire-and-forget goal cleanup failed: {e}",
            {"goal_id": goal_id, "reason": reason, "error": str(e)},
        )


# =====================================================
# PARTNER NOTIFICATION CLEANUP
# =====================================================


def cleanup_partner_notifications_sync(
    supabase,
    partnership_id: str,
    reason: str = "partner_request_deleted",
    nudge_ids: List[str] = None,
) -> int:
    """
    Synchronous version: Clean up all partner-related notifications.

    This covers all entity types related to partnerships:
    - partner_request
    - partner_accepted
    - nudge (via nudge_ids)

    Args:
        supabase: Supabase client
        partnership_id: ID of the accountability_partners record
        reason: Reason for cleanup (for logging)
        nudge_ids: Optional list of nudge IDs to clean up (required for "removed"
                   since cascade delete removes nudges before this runs)

    Returns:
        Number of notifications deleted
    """
    total_deleted = 0
    nudges_deleted = 0

    try:
        # Always delete partner_request and partner_accepted notifications
        partner_notif_result = (
            supabase.table("notification_history")
            .delete()
            .in_("entity_type", ["partner_request", "partner_accepted"])
            .eq("entity_id", partnership_id)
            .execute()
        )
        total_deleted = len(partner_notif_result.data or [])

        # For blocked: fetch nudge IDs and delete nudges + their notifications
        if reason == "blocked":
            # Get nudge IDs if not provided
            if nudge_ids is None:
                nudges_query = (
                    supabase.table("social_nudges")
                    .select("id")
                    .eq("partnership_id", partnership_id)
                    .execute()
                )
                nudge_ids = [n["id"] for n in (nudges_query.data or [])]

            # Delete notifications for these nudges
            if nudge_ids:
                notif_result = (
                    supabase.table("notification_history")
                    .delete()
                    .eq("entity_type", "nudge")
                    .in_("entity_id", nudge_ids)
                    .execute()
                )
                total_deleted += len(notif_result.data or [])

            # Delete the nudges
            nudges_result = (
                supabase.table("social_nudges")
                .delete()
                .eq("partnership_id", partnership_id)
                .execute()
            )
            nudges_deleted = len(nudges_result.data or [])

        # For removed: nudges are already cascade-deleted, just clean up their notifications
        elif reason == "removed" and nudge_ids:
            notif_result = (
                supabase.table("notification_history")
                .delete()
                .eq("entity_type", "nudge")
                .in_("entity_id", nudge_ids)
                .execute()
            )
            total_deleted += len(notif_result.data or [])

        if total_deleted > 0 or nudges_deleted > 0:
            logger.info(
                f"Partner notification cleanup ({reason})",
                {
                    "partnership_id": partnership_id,
                    "reason": reason,
                    "notifications_deleted": total_deleted,
                    "nudges_deleted": nudges_deleted,
                },
            )

        return total_deleted + nudges_deleted

    except Exception as e:
        logger.error(
            f"Failed to cleanup partner notifications: {e}",
            {"partnership_id": partnership_id, "error": str(e)},
        )
        return 0


async def cleanup_partner_notifications(
    partnership_id: str,
    reason: str = "partner_request_deleted",
    nudge_ids: List[str] = None,
) -> int:
    """
    Async version: Clean up partner notifications.
    Gets its own supabase client to avoid connection issues.

    Args:
        partnership_id: ID of the accountability_partners record
        reason: Reason for cleanup (for logging)
        nudge_ids: Optional list of nudge IDs to clean up

    Returns:
        Number of notifications deleted
    """
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    return cleanup_partner_notifications_sync(
        supabase, partnership_id, reason, nudge_ids
    )


def fire_and_forget_partner_cleanup(
    partnership_id: str, reason: str = "deleted", nudge_ids: List[str] = None
):
    """
    Fire-and-forget wrapper for partner notification cleanup.
    Schedules the cleanup as a background task that won't block the response.

    Usage:
        fire_and_forget_partner_cleanup(partnership_id, reason="rejected")
        fire_and_forget_partner_cleanup(partnership_id, reason="removed", nudge_ids=["id1", "id2"])
    """
    asyncio.create_task(_safe_partner_cleanup(partnership_id, reason, nudge_ids))


async def _safe_partner_cleanup(
    partnership_id: str, reason: str, nudge_ids: List[str] = None
):
    """Wrapper that catches all exceptions to prevent unhandled errors."""
    try:
        await cleanup_partner_notifications(partnership_id, reason, nudge_ids)
    except Exception as e:
        logger.error(
            f"Fire-and-forget partner cleanup failed: {e}",
            {"partnership_id": partnership_id, "reason": reason, "error": str(e)},
        )


# =====================================================
# BATCH OPERATIONS - For scalability at 100K+ users
# =====================================================


def cleanup_partner_requests_batch_sync(
    supabase,
    partnership_ids: List[str],
    reason: str = "batch_cleanup",
) -> int:
    """
    Batch cleanup partner notifications for multiple partnerships at once.
    Uses .in_() for O(1) database operations instead of O(n) loops.

    Args:
        supabase: Supabase client
        partnership_ids: List of accountability_partners IDs
        reason: Reason for cleanup (for logging)

    Returns:
        Number of notifications deleted
    """
    if not partnership_ids:
        return 0

    try:
        # Batch delete notifications for ALL partnerships at once
        result = (
            supabase.table("notification_history")
            .delete()
            .eq("entity_type", "partner_request")
            .in_("entity_id", partnership_ids)
            .execute()
        )

        deleted_count = len(result.data or [])

        if deleted_count > 0:
            logger.info(
                f"Batch partner notification cleanup ({reason})",
                {
                    "partnership_count": len(partnership_ids),
                    "reason": reason,
                    "notifications_deleted": deleted_count,
                },
            )

        return deleted_count

    except Exception as e:
        logger.error(
            f"Failed batch partner notification cleanup: {e}",
            {"partnership_count": len(partnership_ids), "error": str(e)},
        )
        return 0


def paginated_cleanup_partner_requests_sync(
    supabase,
    user_id: str,
    reason: str = "subscription_expired",
) -> Dict[str, Any]:
    """
    Paginated cleanup of pending partner requests for a user.
    Handles large numbers of requests without memory issues.

    Used when a user's subscription expires and they lose social features.

    Args:
        supabase: Supabase client
        user_id: User whose pending requests to delete
        reason: Reason for cleanup

    Returns:
        dict with deleted_requests and deleted_notifications counts
    """
    stats = {"deleted_requests": 0, "deleted_notifications": 0}
    offset = 0

    while True:
        # Fetch a batch of pending requests
        batch = (
            supabase.table("accountability_partners")
            .select("id")
            .eq("user_id", user_id)
            .eq("status", "pending")
            .range(offset, offset + CLEANUP_BATCH_SIZE - 1)
            .execute()
        )

        if not batch.data:
            break

        partnership_ids = [r["id"] for r in batch.data]

        # Batch delete the requests
        supabase.table("accountability_partners").delete().in_(
            "id", partnership_ids
        ).execute()

        # Batch cleanup notifications
        deleted_notifs = cleanup_partner_requests_batch_sync(
            supabase, partnership_ids, reason
        )

        stats["deleted_requests"] += len(partnership_ids)
        stats["deleted_notifications"] += deleted_notifs

        # If we got less than batch size, we're done
        if len(batch.data) < CLEANUP_BATCH_SIZE:
            break

        offset += CLEANUP_BATCH_SIZE

    if stats["deleted_requests"] > 0:
        logger.info(
            f"Paginated partner request cleanup ({reason})",
            {"user_id": user_id, **stats},
        )

    return stats
