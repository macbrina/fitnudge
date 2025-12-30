"""
Expo push notification service using official SDK.

Implements Expo's best practices:
- Batched sending (max 100 per batch)
- Exponential backoff retry on failures
- Push receipt validation after 15 minutes (or immediate for testing)
- Automatic invalid token detection and cleanup
- Proper error handling with specific exception types

Reference: https://docs.expo.dev/push-notifications/sending-notifications/
"""

from __future__ import annotations

import logging
import time
import httpx
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
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

# Expo's recommended batch size
EXPO_BATCH_SIZE = 100

# Retry configuration (exponential backoff)
MAX_RETRIES = 3
INITIAL_RETRY_DELAY = 2  # seconds

# Rate limiting: Expo allows 600 notifications/second per project
# With 100 per batch and 200ms delay, we send ~500/sec (safe buffer)
BATCH_DELAY_SECONDS = 0.2  # 200ms delay between batches


def is_valid_expo_token(token: str) -> bool:
    """Check if token is a valid Expo push token format"""
    return token.startswith("ExponentPushToken[") and token.endswith("]")


async def send_push_to_user(
    user_id: str,
    *,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
    notification_type: str = "general",
    sound: str = "default",
    priority: str = "high",
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Persist a notification record and deliver it to all active Expo push tokens for the user.

    This function mimics how the Celery background task works:
    1. Query device_tokens from database (no user auth needed)
    2. Send push notification using Expo SDK
    3. Handle errors and mark invalid tokens as inactive

    Args:
        user_id: User ID to send notification to
        title: Notification title
        body: Notification body
        data: Optional data payload
        notification_type: Type of notification (ai_motivation, reminder, etc.)
        sound: Sound to play (default: "default")
        priority: Push priority (default: "high")
        entity_type: Type of entity referenced (goal, challenge, post, comment, etc.)
        entity_id: ID of the referenced entity (no FK - handle deleted at app level)

    Returns:
        Dict with notification_id, delivered status, and token info
    """
    logger.info(
        f"send_push_to_user called",
        extra={
            "user_id": user_id,
            "notification_type": notification_type,
            "title": title[:50],
            "entity_type": entity_type,
            "entity_id": entity_id,
        },
    )

    supabase = get_supabase_client()

    # Get all active device tokens for the user (no auth required - uses service key)
    tokens_result = (
        supabase.table("device_tokens")
        .select("fcm_token, id")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
    )

    tokens = [
        row
        for row in tokens_result.data or []
        if isinstance(row.get("fcm_token"), str)
        and is_valid_expo_token(row["fcm_token"])
    ]

    # ALWAYS create notification record in database first (for inbox)
    # Users should see notifications even if they don't have push tokens
    notification_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()

    notification_record = {
        "id": notification_id,
        "user_id": user_id,
        "notification_type": notification_type,
        "title": title,
        "body": body,
        "data": data or {},
        "sent_at": now,
    }

    # Add generic entity reference for tracking
    # entity_type: 'goal', 'challenge', 'post', 'comment', 'follow', etc.
    # No FK constraint - handle deleted entities at application level
    if entity_type and entity_id:
        notification_record["entity_type"] = entity_type
        notification_record["entity_id"] = entity_id

    try:
        supabase.table("notification_history").insert(notification_record).execute()
        logger.info(
            f"Notification history record created",
            extra={
                "notification_id": notification_id,
                "user_id": user_id,
                "notification_type": notification_type,
                "entity_type": entity_type,
                "entity_id": entity_id,
            },
        )
    except Exception as e:
        logger.error(
            f"Failed to create notification history record: {e}",
            extra={
                "user_id": user_id,
                "notification_type": notification_type,
                "error": str(e),
            },
        )

    # If no tokens, return early but notification is already saved to history
    if not tokens:
        logger.info(
            f"No active Expo tokens for user {user_id}, notification saved to history only"
        )
        return {
            "notification_id": notification_id,
            "delivered": False,
            "reason": "no_active_tokens",
            "tokens_attempted": 0,
            "invalid_tokens": [],
        }

    # Send to device tokens using Expo SDK with proper batching and rate limiting
    # Expo limits: 600 notifications/second per project
    # With 100 per batch + 200ms delay = ~500/sec (safe under limit)
    delivered = False
    invalid_tokens: List[str] = []
    successful_tokens: List[str] = []
    receipt_ids: List[str] = []  # For receipt validation

    total_batches = (len(tokens) + EXPO_BATCH_SIZE - 1) // EXPO_BATCH_SIZE
    if total_batches > 1:
        estimated_rate = (
            (EXPO_BATCH_SIZE / BATCH_DELAY_SECONDS)
            if BATCH_DELAY_SECONDS > 0
            else EXPO_BATCH_SIZE
        )
        print(f"📊 Sending {len(tokens)} notifications in {total_batches} batches")
        print(f"   Estimated rate: ~{int(estimated_rate)}/sec (limit: 600/sec)")

    # Process tokens in batches with rate limiting
    for batch_idx, batch_start in enumerate(range(0, len(tokens), EXPO_BATCH_SIZE), 1):
        batch_tokens = tokens[batch_start : batch_start + EXPO_BATCH_SIZE]

        # Create push messages for this batch
        push_messages = []
        token_map = {}  # Map message index to token_row for error handling

        for idx, token_row in enumerate(batch_tokens):
            fcm_token = token_row["fcm_token"]
            token_map[len(push_messages)] = token_row

            push_messages.append(
                PushMessage(
                    to=fcm_token,
                    title=title,
                    body=body,
                    data=data or {"notification_id": notification_id},
                    sound=sound,
                    priority=priority,
                )
            )

        # Send batch using SDK with retry logic (exponential backoff)
        responses = None
        last_error = None

        for retry_attempt in range(MAX_RETRIES):
            try:
                # publish_multiple() sends all messages in one request (efficient)
                responses = PushClient().publish_multiple(push_messages)
                print(
                    f"✅ Batch {batch_start // EXPO_BATCH_SIZE + 1} sent to Expo (attempt {retry_attempt + 1})"
                )
                break  # Success, exit retry loop

            except (PushServerError, Exception) as exc:
                last_error = exc
                is_retryable = isinstance(exc, PushServerError) or (
                    hasattr(exc, "response")
                    and hasattr(exc.response, "status_code")
                    and exc.response.status_code in [429, 500, 502, 503, 504]
                )

                if is_retryable and retry_attempt < MAX_RETRIES - 1:
                    # Exponential backoff: 2s, 4s, 8s
                    delay = INITIAL_RETRY_DELAY * (2**retry_attempt)
                    print(
                        f"⚠️  Batch {batch_start // EXPO_BATCH_SIZE + 1} failed (attempt {retry_attempt + 1}), retrying in {delay}s..."
                    )
                    logger.warning(
                        f"Retrying batch {batch_start // EXPO_BATCH_SIZE + 1} after {delay}s",
                        extra={"error": str(exc), "attempt": retry_attempt + 1},
                    )
                    time.sleep(delay)
                else:
                    # Non-retryable error or max retries exceeded
                    print(
                        f"❌ Batch {batch_start // EXPO_BATCH_SIZE + 1} failed permanently"
                    )
                    logger.error(
                        f"Batch {batch_start // EXPO_BATCH_SIZE + 1} failed after {retry_attempt + 1} attempts",
                        extra={"error": str(exc)},
                    )
                    break

        if not responses:
            # Failed to send batch after all retries
            logger.error(
                f"Failed to send batch {batch_start // EXPO_BATCH_SIZE + 1} after {MAX_RETRIES} attempts",
                extra={"error": str(last_error)},
            )
            for token_row in batch_tokens:
                invalid_tokens.append(token_row["fcm_token"])
            continue

        # Process each response
        for idx, response in enumerate(responses):
            token_row = token_map[idx]
            fcm_token = token_row["fcm_token"]
            token_id = token_row["id"]

            try:
                # Validate this specific response
                response.validate_response()
                delivered = True
                successful_tokens.append(fcm_token)

                # Store receipt ID for later validation
                ticket_id = response.id if hasattr(response, "id") else None
                if ticket_id:
                    receipt_ids.append(ticket_id)
                    print(
                        f"✅ Push ticket validated for {fcm_token[:20]}... | Ticket: {ticket_id}"
                    )
                else:
                    print(
                        f"✅ Push ticket validated for {fcm_token[:20]}... | No ticket ID"
                    )

                logger.info(
                    f"Push sent successfully to {fcm_token[:20]}... (batch {batch_start // EXPO_BATCH_SIZE + 1})"
                )

            except DeviceNotRegisteredError:
                # Token is invalid/expired - mark as inactive
                print(
                    f"❌ DeviceNotRegistered for {fcm_token[:20]}... | Marking inactive"
                )
                logger.warning(
                    f"Device not registered: {fcm_token[:20]}..., marking inactive"
                )
                invalid_tokens.append(fcm_token)

                # Mark token as inactive in database
                supabase.table("device_tokens").update({"is_active": False}).eq(
                    "id", token_id
                ).execute()

            except PushTicketError as exc:
                # Other push-specific error
                print(f"❌ PushTicketError for {fcm_token[:20]}... | {exc}")
                logger.error(
                    f"Push ticket error for {fcm_token[:20]}...",
                    extra={
                        "error": str(exc),
                        "push_response": (
                            exc.push_response._asdict()
                            if hasattr(exc, "push_response")
                            else None
                        ),
                    },
                )
                invalid_tokens.append(fcm_token)

        # Rate limiting: Add delay between batches to stay under 600/sec limit
        # Skip delay after the last batch
        if batch_idx < total_batches and BATCH_DELAY_SECONDS > 0:
            time.sleep(BATCH_DELAY_SECONDS)

    # Optionally validate push receipts (confirms actual device delivery)
    # Note: Receipts are available after a few seconds, so this is optional for real-time sending
    # For background tasks, you can check receipts in a separate task
    if receipt_ids and len(receipt_ids) <= 10:  # Only check receipts for small batches
        try:
            print(f"⏳ Waiting 3 seconds for receipts to be available...")
            time.sleep(3)  # Wait for receipts to be available

            print(f"📬 Checking push receipts for {len(receipt_ids)} ticket(s)...")

            # Use direct HTTP API (more reliable than SDK method)
            async with httpx.AsyncClient(timeout=10.0) as client:
                receipt_response = await client.post(
                    "https://exp.host/--/api/v2/push/getReceipts",
                    json={"ids": receipt_ids},
                    headers={"Content-Type": "application/json"},
                )
                receipt_response.raise_for_status()
                receipt_json = receipt_response.json()

            # Process receipts: {data: {ticket_id: receipt_object}}
            receipts = receipt_json.get("data", {})
            for ticket_id, receipt in receipts.items():
                status = receipt.get("status", "unknown")

                if status == "error":
                    message = receipt.get("message", "No message")
                    details = receipt.get("details", {})
                    print(f"❌ Receipt {ticket_id}: ERROR")
                    print(f"   Message: {message}")
                    print(f"   Details: {details}")
                    logger.warning(
                        f"Push receipt error for {ticket_id}",
                        extra={
                            "error": message,
                            "details": details,
                        },
                    )
                elif status == "ok":
                    print(
                        f"✅ Receipt {ticket_id}: OK - Actually delivered to Apple/Google!"
                    )
                    logger.info(f"Push receipt confirmed: {ticket_id}")
                else:
                    print(f"⚠️  Receipt {ticket_id}: {status}")

        except Exception as exc:
            # Don't fail the entire operation if receipt checking fails
            print(f"⚠️  Failed to check push receipts: {exc}")
            logger.warning(f"Failed to validate push receipts: {exc}")

    # Update notification record with delivery status
    if delivered:
        supabase.table("notification_history").update(
            {"delivered_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", notification_id).execute()

    return {
        "notification_id": notification_id,
        "delivered": delivered,
        "invalid_tokens": invalid_tokens,
        "successful_tokens": successful_tokens,
        "tokens_attempted": len(tokens),
        "receipt_ids": receipt_ids if len(receipt_ids) <= 10 else [],
    }


def send_push_message_sync(
    token: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Synchronous helper to send a single push notification.
    Used by background tasks that don't use async.

    Args:
        token: Expo push token
        title: Notification title
        body: Notification body
        data: Optional data payload

    Returns:
        bool: True if delivered, False otherwise
    """
    try:
        if not is_valid_expo_token(token):
            logger.warning(f"Invalid token format: {token[:20]}...")
            return False

        push_message = PushMessage(
            to=token,
            title=title,
            body=body,
            data=data or {},
            sound="default",
            priority="high",
        )

        response = PushClient().publish(push_message)
        response.validate_response()

        return True

    except DeviceNotRegisteredError:
        logger.warning(f"Device not registered: {token[:20]}...")
        return False
    except (PushServerError, PushTicketError) as exc:
        logger.error(f"Push error for {token[:20]}...: {exc}")
        return False
    except Exception as exc:
        logger.error(f"Unexpected error sending push: {exc}")
        return False


def send_push_to_user_sync(
    user_id: str,
    *,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
    notification_type: str = "general",
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Synchronous version of send_push_to_user for Celery tasks.

    Sends push notification to all active device tokens for a user
    and creates notification_history record.

    Args:
        user_id: User ID to send notification to
        title: Notification title
        body: Notification body
        data: Optional data payload (include deep link info here)
        notification_type: Type of notification (plan_ready, goal, etc.)
        entity_type: Type of entity (goal, plan, etc.)
        entity_id: ID of the entity

    Returns:
        Dict with success status and delivery count
    """
    supabase = get_supabase_client()

    try:
        # Get all active device tokens for the user
        tokens_result = (
            supabase.table("device_tokens")
            .select("fcm_token, id")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .execute()
        )

        tokens = [
            row
            for row in tokens_result.data or []
            if isinstance(row.get("fcm_token"), str)
            and is_valid_expo_token(row["fcm_token"])
        ]

        # ALWAYS create notification history record first (for inbox)
        # Users should see notifications even if they don't have push tokens
        notification_id = str(uuid4())
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
            supabase.table("notification_history").insert(notification_record).execute()
            logger.info(
                f"Created notification history record",
                extra={
                    "notification_id": notification_id,
                    "user_id": user_id,
                    "notification_type": notification_type,
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                },
            )
        except Exception as e:
            logger.error(f"Failed to create notification history: {e}")

        # If no tokens, return early but notification is already saved to history
        if not tokens:
            logger.info(
                f"No active push tokens for user {user_id}, notification saved to history only"
            )
            return {
                "success": True,
                "delivered": 0,
                "reason": "no_tokens",
                "notification_id": notification_id,
            }

        # SCALABILITY: Use batch sending with publish_multiple()
        # instead of sending one-by-one
        delivered_count = 0
        invalid_token_ids = []

        # Build batch of push messages
        push_messages = []
        token_map = {}  # Map message index to token_row

        for idx, token_row in enumerate(tokens):
            token = token_row["fcm_token"]
            push_messages.append(
                PushMessage(
                    to=token,
                    title=title,
                    body=body,
                    data=data or {},
                    sound="default",
                    priority="high",
                )
            )
            token_map[idx] = token_row

        # Send batch using Expo SDK with retry logic
        try:
            responses = PushClient().publish_multiple(push_messages)

            # Process responses
            for idx, response in enumerate(responses):
                token_row = token_map[idx]
                try:
                    response.validate_response()
                    delivered_count += 1
                except DeviceNotRegisteredError:
                    invalid_token_ids.append(token_row["id"])
                except (PushTicketError, Exception) as exc:
                    logger.warning(f"Push failed for token {token_row['fcm_token'][:20]}...: {exc}")
                    invalid_token_ids.append(token_row["id"])

        except (PushServerError, Exception) as exc:
            logger.error(f"Batch push failed: {exc}")
            # Mark all as invalid if entire batch fails
            invalid_token_ids = [t["id"] for t in tokens]

        # Mark invalid tokens as inactive (batch update)
        if invalid_token_ids:
            try:
                supabase.table("device_tokens").update(
                    {"is_active": False}
                ).in_("id", invalid_token_ids).execute()
            except Exception as e:
                logger.warning(f"Failed to deactivate invalid tokens: {e}")

        # Update notification history as delivered
        if delivered_count > 0:
            try:
                supabase.table("notification_history").update(
                    {
                        "delivered_at": datetime.now(timezone.utc).isoformat(),
                    }
                ).eq("id", notification_id).execute()
                logger.info(
                    f"Notification marked as delivered",
                    extra={
                        "notification_id": notification_id,
                        "delivered_count": delivered_count,
                    },
                )
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
