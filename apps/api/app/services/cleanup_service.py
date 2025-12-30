"""
Cleanup Service for Notifications and Related Records

Provides fire-and-forget cleanup functions that don't block the main request.
Used when challenges are cancelled/completed or partner requests are deleted.

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


def cleanup_challenge_invites_and_notifications_sync(
    supabase, challenge_id: str, reason: str = "challenge_status_change"
) -> dict:
    """
    Synchronous version: Clean up pending challenge invites and related notifications.

    Args:
        supabase: Supabase client
        challenge_id: ID of the challenge
        reason: Reason for cleanup (for logging)

    Returns:
        dict with counts of deleted items
    """
    stats = {"invites_deleted": 0, "notifications_deleted": 0}

    try:
        # 1. Delete pending challenge_invites
        pending_invites = (
            supabase.table("challenge_invites")
            .delete()
            .eq("challenge_id", challenge_id)
            .eq("status", "pending")
            .execute()
        )
        stats["invites_deleted"] = len(pending_invites.data or [])

        # 2. Delete challenge_invite notifications from notification_history
        # These have entity_type='challenge', entity_id=challenge_id, notification_type='challenge_invite'
        notifications = (
            supabase.table("notification_history")
            .delete()
            .eq("entity_type", "challenge")
            .eq("entity_id", challenge_id)
            .eq("notification_type", "challenge_invite")
            .execute()
        )
        stats["notifications_deleted"] = len(notifications.data or [])

        if stats["invites_deleted"] > 0 or stats["notifications_deleted"] > 0:
            logger.info(
                f"Challenge cleanup ({reason})",
                {
                    "challenge_id": challenge_id,
                    "reason": reason,
                    "invites_deleted": stats["invites_deleted"],
                    "notifications_deleted": stats["notifications_deleted"],
                },
            )

    except Exception as e:
        logger.error(
            f"Failed to cleanup challenge invites/notifications: {e}",
            {"challenge_id": challenge_id, "error": str(e)},
        )

    return stats


async def cleanup_challenge_invites_and_notifications(
    challenge_id: str, reason: str = "challenge_status_change"
) -> dict:
    """
    Async version: Clean up pending challenge invites and related notifications.
    Gets its own supabase client to avoid connection issues.

    Args:
        challenge_id: ID of the challenge
        reason: Reason for cleanup (for logging)

    Returns:
        dict with counts of deleted items
    """
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    return cleanup_challenge_invites_and_notifications_sync(
        supabase, challenge_id, reason
    )


def fire_and_forget_challenge_cleanup(challenge_id: str, reason: str = "cancelled"):
    """
    Fire-and-forget wrapper for challenge cleanup.
    Schedules the cleanup as a background task that won't block the response.

    Usage:
        fire_and_forget_challenge_cleanup(challenge_id, reason="cancelled")
    """
    asyncio.create_task(_safe_challenge_cleanup(challenge_id, reason))


async def _safe_challenge_cleanup(challenge_id: str, reason: str):
    """Wrapper that catches all exceptions to prevent unhandled errors."""
    try:
        await cleanup_challenge_invites_and_notifications(challenge_id, reason)
    except Exception as e:
        logger.error(
            f"Fire-and-forget challenge cleanup failed: {e}",
            {"challenge_id": challenge_id, "reason": reason, "error": str(e)},
        )


def cleanup_partner_notifications_sync(
    supabase, partnership_id: str, reason: str = "partner_request_deleted"
) -> int:
    """
    Synchronous version: Clean up partner_request and partner_accepted notifications.

    Args:
        supabase: Supabase client
        partnership_id: ID of the accountability_partners record
        reason: Reason for cleanup (for logging)

    Returns:
        Number of notifications deleted
    """
    try:
        # Delete notifications where entity_type='partner_request' and entity_id=partnership_id
        # This covers both partner_request and partner_accepted notification types
        result = (
            supabase.table("notification_history")
            .delete()
            .eq("entity_type", "partner_request")
            .eq("entity_id", partnership_id)
            .execute()
        )

        deleted_count = len(result.data or [])

        if deleted_count > 0:
            logger.info(
                f"Partner notification cleanup ({reason})",
                {
                    "partnership_id": partnership_id,
                    "reason": reason,
                    "notifications_deleted": deleted_count,
                },
            )

        return deleted_count

    except Exception as e:
        logger.error(
            f"Failed to cleanup partner notifications: {e}",
            {"partnership_id": partnership_id, "error": str(e)},
        )
        return 0


async def cleanup_partner_notifications(
    partnership_id: str, reason: str = "partner_request_deleted"
) -> int:
    """
    Async version: Clean up partner notifications.
    Gets its own supabase client to avoid connection issues.

    Args:
        partnership_id: ID of the accountability_partners record
        reason: Reason for cleanup (for logging)

    Returns:
        Number of notifications deleted
    """
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    return cleanup_partner_notifications_sync(supabase, partnership_id, reason)


def fire_and_forget_partner_cleanup(partnership_id: str, reason: str = "deleted"):
    """
    Fire-and-forget wrapper for partner notification cleanup.
    Schedules the cleanup as a background task that won't block the response.

    Usage:
        fire_and_forget_partner_cleanup(partnership_id, reason="rejected")
    """
    asyncio.create_task(_safe_partner_cleanup(partnership_id, reason))


async def _safe_partner_cleanup(partnership_id: str, reason: str):
    """Wrapper that catches all exceptions to prevent unhandled errors."""
    try:
        await cleanup_partner_notifications(partnership_id, reason)
    except Exception as e:
        logger.error(
            f"Fire-and-forget partner cleanup failed: {e}",
            {"partnership_id": partnership_id, "reason": reason, "error": str(e)},
        )


def cleanup_challenge_invite_notification_sync(
    supabase,
    challenge_id: str,
    invited_user_id: str,
    reason: str = "invite_cancelled",
) -> int:
    """
    Synchronous version: Clean up a specific challenge invite notification.
    Used when an individual invite is cancelled or declined.

    Args:
        supabase: Supabase client
        challenge_id: ID of the challenge
        invited_user_id: ID of the user who was invited
        reason: Reason for cleanup (for logging)

    Returns:
        Number of notifications deleted
    """
    try:
        # Delete the specific notification for this invite
        result = (
            supabase.table("notification_history")
            .delete()
            .eq("entity_type", "challenge")
            .eq("entity_id", challenge_id)
            .eq("notification_type", "challenge_invite")
            .eq("user_id", invited_user_id)
            .execute()
        )

        deleted_count = len(result.data or [])

        if deleted_count > 0:
            logger.info(
                f"Challenge invite notification cleanup ({reason})",
                {
                    "challenge_id": challenge_id,
                    "invited_user_id": invited_user_id,
                    "reason": reason,
                    "notifications_deleted": deleted_count,
                },
            )

        return deleted_count

    except Exception as e:
        logger.error(
            f"Failed to cleanup challenge invite notification: {e}",
            {
                "challenge_id": challenge_id,
                "invited_user_id": invited_user_id,
                "error": str(e),
            },
        )
        return 0


async def cleanup_challenge_invite_notification(
    challenge_id: str,
    invited_user_id: str,
    reason: str = "invite_cancelled",
) -> int:
    """
    Async version: Clean up a specific challenge invite notification.
    Gets its own supabase client to avoid connection issues.

    Args:
        challenge_id: ID of the challenge
        invited_user_id: ID of the user who was invited
        reason: Reason for cleanup (for logging)

    Returns:
        Number of notifications deleted
    """
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    return cleanup_challenge_invite_notification_sync(
        supabase, challenge_id, invited_user_id, reason
    )


def fire_and_forget_invite_notification_cleanup(
    challenge_id: str, invited_user_id: str, reason: str = "cancelled"
):
    """
    Fire-and-forget wrapper for individual invite notification cleanup.
    Schedules the cleanup as a background task that won't block the response.

    Usage:
        fire_and_forget_invite_notification_cleanup(challenge_id, invited_user_id, reason="declined")
    """
    asyncio.create_task(
        _safe_invite_notification_cleanup(challenge_id, invited_user_id, reason)
    )


async def _safe_invite_notification_cleanup(
    challenge_id: str, invited_user_id: str, reason: str
):
    """Wrapper that catches all exceptions to prevent unhandled errors."""
    try:
        await cleanup_challenge_invite_notification(
            challenge_id, invited_user_id, reason
        )
    except Exception as e:
        logger.error(
            f"Fire-and-forget invite notification cleanup failed: {e}",
            {
                "challenge_id": challenge_id,
                "invited_user_id": invited_user_id,
                "reason": reason,
                "error": str(e),
            },
        )


# =====================================================
# BATCH OPERATIONS - For scalability at 100K+ users
# =====================================================


def cleanup_challenges_batch_sync(
    supabase,
    challenge_ids: List[str],
    reason: str = "batch_cleanup",
) -> Dict[str, int]:
    """
    Batch cleanup for multiple challenges at once.
    Uses .in_() for O(1) database operations instead of O(n) loops.

    Args:
        supabase: Supabase client
        challenge_ids: List of challenge IDs to cleanup
        reason: Reason for cleanup (for logging)

    Returns:
        dict with counts of deleted items
    """
    if not challenge_ids:
        return {"invites_deleted": 0, "notifications_deleted": 0}

    stats = {"invites_deleted": 0, "notifications_deleted": 0}

    try:
        # Batch delete pending challenge_invites for ALL challenges at once
        pending_invites = (
            supabase.table("challenge_invites")
            .delete()
            .in_("challenge_id", challenge_ids)
            .eq("status", "pending")
            .execute()
        )
        stats["invites_deleted"] = len(pending_invites.data or [])

        # Batch delete notifications for ALL challenges at once
        notifications = (
            supabase.table("notification_history")
            .delete()
            .eq("entity_type", "challenge")
            .in_("entity_id", challenge_ids)
            .eq("notification_type", "challenge_invite")
            .execute()
        )
        stats["notifications_deleted"] = len(notifications.data or [])

        if stats["invites_deleted"] > 0 or stats["notifications_deleted"] > 0:
            logger.info(
                f"Batch challenge cleanup ({reason})",
                {
                    "challenge_count": len(challenge_ids),
                    "reason": reason,
                    **stats,
                },
            )

    except Exception as e:
        logger.error(
            f"Failed batch challenge cleanup: {e}",
            {"challenge_count": len(challenge_ids), "error": str(e)},
        )

    return stats


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
