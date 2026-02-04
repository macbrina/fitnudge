"""
Admin API - Push notification service for admin-triggered notifications.

Uses same logic as main API expo_push_service:
- notification_type="general" only (admin broadcasts, report resolution, etc.)
- should_send_push_notification: only check global enabled + push_notifications toggle
  (skip type-specific prefs and quiet hours for admin-critical notifications)
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from exponent_server_sdk import (
    DeviceNotRegisteredError,
    PushClient,
    PushMessage,
    PushServerError,
    PushTicketError,
)

from app.core.database import get_supabase_client

logger = logging.getLogger(__name__)


def is_valid_expo_token(token: str) -> bool:
    """Check if token is a valid Expo push token format."""
    return token.startswith("ExponentPushToken[") and token.endswith("]")


def should_send_push_notification(user_id: str) -> Tuple[bool, str]:
    """
    Check if user has push notifications enabled.
    Used for admin notifications (general type) - only check global + push toggle.
    Same logic as main API expo_push_service.should_send_push_notification.

    Returns:
        Tuple of (should_send: bool, reason: str)
    """
    supabase = get_supabase_client()

    try:
        prefs_result = (
            supabase.table("notification_preferences")
            .select("enabled, push_notifications")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )

        prefs = prefs_result.data

        if not prefs:
            return (True, "ok")

        if not prefs.get("enabled", True):
            return (False, "notifications_disabled")

        if not prefs.get("push_notifications", True):
            return (False, "push_notifications_disabled")

        return (True, "ok")

    except Exception as e:
        logger.warning(
            f"Error checking push notification preference for {user_id}: {e}"
        )
        return (True, "ok")


def _get_unread_notification_count(supabase, user_id: str) -> int:
    """Get count of unread notifications for app icon badge."""
    try:
        result = (
            supabase.table("notification_history")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .is_("opened_at", "null")
            .limit(1)
            .execute()
        )
        return getattr(result, "count", 0) or 0
    except Exception as e:
        logger.warning(f"Failed to get unread count for {user_id}: {e}")
        return 0


def send_push_to_user_sync(
    user_id: str,
    *,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
    notification_type: str = "general",
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    save_to_notification_history: bool = True,
) -> Dict[str, Any]:
    """
    Send push notification to user. Admin API only sends "general" type.
    Uses should_send_push_notification (skip type-specific + quiet hours for admin-critical).

    Args:
        user_id: User ID to send notification to
        title: Notification title
        body: Notification body
        data: Optional data payload (include deepLink for app routing)
        notification_type: Must be "general" for admin notifications
        entity_type: Type of entity (e.g. user_report)
        entity_id: ID of the entity
        save_to_notification_history: Persist to notification_history (inbox)

    Returns:
        Dict with success, delivered count, notification_id
    """
    supabase = get_supabase_client()

    try:
        notification_id = str(uuid4())

        if save_to_notification_history:
            notification_record = {
                "id": notification_id,
                "user_id": user_id,
                "notification_type": notification_type,
                "title": title,
                "body": body,
                "data": data or {},
                "sent_at": datetime.now(timezone.utc).isoformat(),
            }
            if entity_type and entity_id:
                notification_record["entity_type"] = entity_type
                notification_record["entity_id"] = entity_id
            try:
                supabase.table("notification_history").insert(
                    notification_record
                ).execute()
                logger.info(
                    f"Created notification history record",
                    extra={
                        "notification_id": notification_id,
                        "user_id": user_id,
                        "notification_type": notification_type,
                    },
                )
            except Exception as e:
                logger.error(f"Failed to create notification history: {e}")

        # Check: only global + push_notifications (same as admin broadcasts)
        should_send, reason = should_send_push_notification(user_id)

        if not should_send:
            logger.info(
                f"Push notification skipped for user {user_id}",
                extra={"user_id": user_id, "skip_reason": reason},
            )
            return {
                "success": True,
                "delivered": 0,
                "reason": reason,
                "skipped": True,
                "saved_to_inbox": save_to_notification_history,
                "notification_id": notification_id,
            }

        # Get active device tokens
        tokens_result = (
            supabase.table("device_tokens")
            .select("fcm_token, id")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .execute()
        )

        tokens: List[dict] = [
            row
            for row in tokens_result.data or []
            if isinstance(row.get("fcm_token"), str)
            and is_valid_expo_token(row["fcm_token"])
        ]

        if not tokens:
            logger.info(
                f"No active push tokens for user {user_id}",
                extra={"user_id": user_id},
            )
            return {
                "success": True,
                "delivered": 0,
                "reason": "no_tokens",
                "notification_id": notification_id,
            }

        badge_count = _get_unread_notification_count(supabase, user_id)

        push_messages = []
        token_map = {}

        for idx, token_row in enumerate(tokens):
            token = token_row["fcm_token"]
            message_kwargs = {
                "to": token,
                "title": title,
                "body": body,
                "data": data or {"notification_id": notification_id},
                "sound": "default",
                "priority": "high",
            }
            if badge_count > 0:
                message_kwargs["badge"] = badge_count
            push_messages.append(PushMessage(**message_kwargs))
            token_map[idx] = token_row

        delivered_count = 0
        invalid_token_ids: List[str] = []

        try:
            responses = PushClient().publish_multiple(push_messages)

            for idx, response in enumerate(responses):
                token_row = token_map[idx]
                try:
                    response.validate_response()
                    delivered_count += 1
                except DeviceNotRegisteredError:
                    invalid_token_ids.append(token_row["id"])
                except (PushTicketError, Exception) as exc:
                    logger.warning(
                        f"Push failed for token {token_row['fcm_token'][:20]}...: {exc}"
                    )
                    invalid_token_ids.append(token_row["id"])

        except (PushServerError, Exception) as exc:
            logger.error(f"Batch push failed: {exc}")
            invalid_token_ids = [t["id"] for t in tokens]

        if invalid_token_ids:
            try:
                supabase.table("device_tokens").update({"is_active": False}).in_(
                    "id", invalid_token_ids
                ).execute()
            except Exception as e:
                logger.warning(f"Failed to deactivate invalid tokens: {e}")

        if save_to_notification_history and delivered_count > 0:
            try:
                supabase.table("notification_history").update(
                    {"delivered_at": datetime.now(timezone.utc).isoformat()}
                ).eq("id", notification_id).execute()
            except Exception as e:
                logger.warning(f"Failed to update notification history: {e}")

        return {
            "success": True,
            "delivered": delivered_count,
            "total_tokens": len(tokens),
            "notification_id": notification_id,
        }

    except Exception as e:
        logger.error(f"Failed to send push to user {user_id}: {e}")
        return {"success": False, "error": str(e)}
