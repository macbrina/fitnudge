"""
FitNudge V2 - Expo Push Notification Service

Implements Expo's best practices:
- Batched sending (max 100 per batch)
- Exponential backoff retry on failures
- Push receipt validation after 15 minutes (or immediate for testing)
- Automatic invalid token detection and cleanup
- Proper error handling with specific exception types
- Centralized notification preference and quiet hours check

Reference: https://docs.expo.dev/push-notifications/sending-notifications/
"""

from __future__ import annotations

import logging
import time
import httpx
from datetime import datetime, timezone, time as dt_time
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4
import pytz

from exponent_server_sdk import (
    DeviceNotRegisteredError,
    PushClient,
    PushMessage,
    PushServerError,
    PushTicketError,
)

from app.core.database import get_supabase_client

logger = logging.getLogger(__name__)


# =============================================================================
# NOTIFICATION PREFERENCE & QUIET HOURS CHECK
# =============================================================================

# V2 Map notification_type to preference column in notification_preferences table
# Format: (preference_column, None) - we use a simple single-column mapping
# If preference_column is None, the notification is always sent (critical notifications)
NOTIFICATION_TYPE_TO_PREFERENCE = {
    # Core types (single column)
    "ai_motivation": ("ai_motivation", None),
    "reminder": ("reminders", None),
    "achievement": ("achievements", None),
    "reengagement": ("reengagement", None),
    "weekly_recap": ("weekly_recap", None),
    # Partner types - all use single 'partners' preference toggle
    "partner_request": ("partners", None),
    "partner_accepted": ("partners", None),
    "partner_nudge": ("partners", None),
    "partner_cheer": ("partners", None),
    "partner_milestone": ("partners", None),
    "partner_inactive": ("partners", None),
    # Always send (critical notifications)
    "subscription": (None, None),
    "general": (None, None),
    # Achievement variants
    "streak_milestone": ("achievements", None),
    "goal_complete": ("achievements", None),
    # Adaptive nudge (uses reminders preference)
    "adaptive_nudge": ("reminders", None),
}


def should_send_push_notification(user_id: str) -> Tuple[bool, str]:
    """
    Check if user has push notifications enabled.
    Used when skip_preference_check=True but we still need to respect push_notifications toggle.

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

        # If no preferences, default to sending
        if not prefs:
            return (True, "ok")

        # Check global enabled
        if not prefs.get("enabled", True):
            return (False, "notifications_disabled")

        # Check push_notifications specifically
        if not prefs.get("push_notifications", True):
            return (False, "push_notifications_disabled")

        return (True, "ok")

    except Exception as e:
        logger.warning(
            f"Error checking push notification preference for {user_id}: {e}"
        )
        return (True, "ok")  # Default to sending on error


def should_send_notification(
    user_id: str,
    notification_type: str,
    user_timezone: Optional[str] = None,
) -> Tuple[bool, str]:
    """
    Centralized check for whether to send a notification to a user.

    Checks:
    1. Global notifications enabled
    2. Push notifications enabled
    3. Specific notification type enabled
    4. Quiet hours (using user's timezone)

    Args:
        user_id: User ID to check
        notification_type: Type of notification (ai_motivation, reminder, social, etc.)
        user_timezone: User's timezone (e.g., "America/New_York"). If None, fetches from users table.

    Returns:
        Tuple of (should_send: bool, reason: str)
        - (True, "ok") if notification should be sent
        - (False, reason) if notification should be skipped
    """
    supabase = get_supabase_client()

    try:
        # Get user's notification preferences (all columns we might need)
        prefs_result = (
            supabase.table("notification_preferences")
            .select("*")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )

        prefs = prefs_result.data

        # If no preferences, default to sending (user hasn't configured yet)
        if not prefs:
            return (True, "ok")

        # Check 1: Global notifications enabled
        if not prefs.get("enabled", True):
            return (False, "notifications_disabled")

        # Check 2: Push notifications enabled
        if not prefs.get("push_notifications", True):
            return (False, "push_notifications_disabled")

        # Check 3: Specific notification type enabled
        # Format: (preference_column, unused) - we only use the first value now
        pref_tuple = NOTIFICATION_TYPE_TO_PREFERENCE.get(
            notification_type, (None, None)
        )
        preference_column, _ = pref_tuple

        # Check the preference toggle (e.g., "partners", "reminders", "achievements")
        if preference_column:
            if not prefs.get(preference_column, True):
                return (False, f"{preference_column}_disabled")

        # Check 3: Quiet hours
        if prefs.get("quiet_hours_enabled", False):
            quiet_start = prefs.get("quiet_hours_start")
            quiet_end = prefs.get("quiet_hours_end")

            if quiet_start and quiet_end:
                # Get user timezone if not provided
                if not user_timezone:
                    user_timezone = _get_user_timezone(supabase, user_id)

                if _is_quiet_hours(quiet_start, quiet_end, user_timezone):
                    return (False, "quiet_hours")

        return (True, "ok")

    except Exception as e:
        logger.warning(f"Error checking notification preferences for {user_id}: {e}")
        # Default to sending if preference check fails
        return (True, "preference_check_failed")


def _get_user_timezone(supabase, user_id: str) -> str:
    """Get user's timezone from users table."""
    try:
        user_result = (
            supabase.table("users")
            .select("timezone")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )

        if user_result.data and user_result.data.get("timezone"):
            return user_result.data["timezone"]
    except Exception:
        pass

    return "UTC"


def _is_quiet_hours(
    quiet_start: str,
    quiet_end: str,
    user_timezone: str,
) -> bool:
    """
    Check if current time (in user's timezone) is within quiet hours.

    Handles overnight ranges (e.g., 22:00 to 08:00).

    Args:
        quiet_start: Start time as "HH:MM" or "HH:MM:SS"
        quiet_end: End time as "HH:MM" or "HH:MM:SS"
        user_timezone: User's timezone string (e.g., "America/New_York")

    Returns:
        True if within quiet hours, False otherwise
    """
    try:
        # Parse times
        start_parts = str(quiet_start).split(":")
        end_parts = str(quiet_end).split(":")

        start_time = dt_time(int(start_parts[0]), int(start_parts[1]))
        end_time = dt_time(int(end_parts[0]), int(end_parts[1]))

        # Get current time in user's timezone
        try:
            tz = pytz.timezone(user_timezone)
        except pytz.UnknownTimeZoneError:
            tz = pytz.UTC

        now = datetime.now(tz).time()

        # Handle overnight range (e.g., 22:00 to 08:00)
        if start_time > end_time:
            # Overnight: quiet if current >= start OR current <= end
            return now >= start_time or now <= end_time
        else:
            # Same day: quiet if start <= current <= end
            return start_time <= now <= end_time

    except Exception as e:
        logger.warning(f"Error checking quiet hours: {e}")
        return False  # Default to not quiet hours on error


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
    sound: str = "notification_sound.wav",
    priority: str = "high",
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    category_id: Optional[str] = None,
    skip_preference_check: bool = False,
    save_to_notification_history: bool = True,
) -> Dict[str, Any]:
    """
    Persist a notification record (optional) and deliver it to all active Expo push tokens for the user.

    This function:
    1. Optionally save notification to history (inbox) first; skip when save_to_notification_history=False
    2. Check notification preferences and quiet hours for push delivery
    3. Query device_tokens from database (no user auth needed)
    4. Send push notification using Expo SDK
    5. Handle errors and mark invalid tokens as inactive

    Use save_to_notification_history=False for notifications that don't point to a goal or partner
    (e.g. reengagement, subscription expiry, achievements). Push + deepLinkHandler is enough; inbox
    persistence is not needed. Admin / goal / partner notifications should keep default True.

    Args:
        user_id: User ID to send notification to
        title: Notification title
        body: Notification body
        data: Optional data payload
        notification_type: Type of notification (ai_motivation, reminder, etc.)
            V2 Types: ai_motivation, reminder, reengagement, achievement, general,
            partner_request, partner_accepted, partner_nudge, partner_cheer,
            partner_milestone, weekly_recap, subscription
        sound: Sound to play (default: "default")
        priority: Push priority (default: "high")
        entity_type: Type of entity referenced (goal, achievement, partner_request, etc.)
        entity_id: ID of the referenced entity (no FK - handle deleted at app level)
        skip_preference_check: If True, skip preference/quiet hours check (for critical notifications)
        save_to_notification_history: If True, persist to notification_history (inbox). Default True.

    Returns:
        Dict with notification_id, delivered status, and token info
    """

    supabase = get_supabase_client()

    # STEP 1: Optionally create notification record in database (for inbox)
    notification_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()

    if save_to_notification_history:
        notification_record = {
            "id": notification_id,
            "user_id": user_id,
            "notification_type": notification_type,
            "title": title,
            "body": body,
            "data": data or {},
            "sent_at": now,
        }
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

    # STEP 2: Check notification preferences for PUSH delivery
    # Even with skip_preference_check, we still respect the push_notifications toggle
    if skip_preference_check:
        # Only check if push notifications are enabled (skip type-specific checks)
        should_send, reason = should_send_push_notification(user_id)
    else:
        # Full check: push_notifications + type-specific + quiet hours
        should_send, reason = should_send_notification(user_id, notification_type)

    if not should_send:
        logger.info(
            f"Push notification skipped for user {user_id}"
            + (" (saved to inbox)" if save_to_notification_history else ""),
            extra={
                "user_id": user_id,
                "notification_id": notification_id,
                "notification_type": notification_type,
                "skip_reason": reason,
            },
        )
        return {
            "notification_id": notification_id,
            "delivered": False,
            "reason": reason,
            "skipped": True,
            "saved_to_inbox": save_to_notification_history,
            "tokens_attempted": 0,
            "invalid_tokens": [],
        }

    # STEP 3: Get all active device tokens for the user (no auth required - uses service key)
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

    if not tokens:
        logger.info(
            f"No active Expo tokens for user {user_id}"
            + (
                ", notification saved to history only"
                if save_to_notification_history
                else ""
            )
        )
        return {
            "notification_id": notification_id,
            "delivered": False,
            "reason": "no_active_tokens",
            "tokens_attempted": 0,
            "invalid_tokens": [],
        }

    # Send to device tokens using Expo SDK with proper batching and rate limiting
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

            message_kwargs = {
                "to": fcm_token,
                "title": title,
                "body": body,
                "data": data or {"notification_id": notification_id},
                "sound": sound,
                "priority": priority,
            }
            # Add category identifier for action buttons (iOS)
            if category_id:
                message_kwargs["category"] = category_id
            push_messages.append(PushMessage(**message_kwargs))

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

    if save_to_notification_history and delivered:
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


def send_push_to_user_sync(
    user_id: str,
    *,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
    notification_type: str = "general",
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    category_id: Optional[str] = None,
    skip_preference_check: bool = False,
    save_to_notification_history: bool = True,
) -> Dict[str, Any]:
    """
    Synchronous version of send_push_to_user for Celery tasks.

    This function:
    1. Optionally save notification to history (inbox) first; skip when save_to_notification_history=False
    2. Check notification preferences and quiet hours for push delivery
    3. Send push notification to all active device tokens

    Use save_to_notification_history=False for notifications that don't point to a goal or partner
    (e.g. reengagement, subscription expiry, achievements). Push + deepLinkHandler is enough.

    Args:
        user_id: User ID to send notification to
        title: Notification title
        body: Notification body
        data: Optional data payload (include deep link info here)
        notification_type: Type of notification (V2: ai_motivation, reminder, etc.)
        entity_type: Type of entity (goal, achievement, partner_request, etc.)
        entity_id: ID of the entity
        skip_preference_check: If True, skip preference/quiet hours check (for critical notifications)
        save_to_notification_history: If True, persist to notification_history (inbox). Default True.

    Returns:
        Dict with success status and delivery count
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
                        "entity_type": entity_type,
                        "entity_id": entity_id,
                    },
                )
            except Exception as e:
                logger.error(f"Failed to create notification history: {e}")

        # STEP 2: Check notification preferences for PUSH delivery
        # Even with skip_preference_check, we still respect the push_notifications toggle
        if skip_preference_check:
            # Only check if push notifications are enabled (skip type-specific checks)
            should_send, reason = should_send_push_notification(user_id)
        else:
            # Full check: push_notifications + type-specific + quiet hours
            should_send, reason = should_send_notification(user_id, notification_type)

        if not should_send:
            logger.info(
                f"Push notification skipped for user {user_id}"
                + (" (saved to inbox)" if save_to_notification_history else ""),
                extra={
                    "user_id": user_id,
                    "notification_id": notification_id,
                    "notification_type": notification_type,
                    "skip_reason": reason,
                },
            )
            return {
                "success": True,
                "delivered": 0,
                "reason": reason,
                "skipped": True,
                "saved_to_inbox": save_to_notification_history,
                "notification_id": notification_id,
            }

        # STEP 3: Get all active device tokens for the user
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

        if not tokens:
            logger.info(
                f"No active push tokens for user {user_id}"
                + (
                    ", notification saved to history only"
                    if save_to_notification_history
                    else ""
                )
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
            message_kwargs = {
                "to": token,
                "title": title,
                "body": body,
                "data": data or {},
                "sound": "default",
                "priority": "high",
            }
            # Add category identifier for action buttons (iOS)
            if category_id:
                message_kwargs["category"] = category_id
            push_messages.append(PushMessage(**message_kwargs))
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
                    logger.warning(
                        f"Push failed for token {token_row['fcm_token'][:20]}...: {exc}"
                    )
                    invalid_token_ids.append(token_row["id"])

        except (PushServerError, Exception) as exc:
            logger.error(f"Batch push failed: {exc}")
            # Mark all as invalid if entire batch fails
            invalid_token_ids = [t["id"] for t in tokens]

        # Mark invalid tokens as inactive (batch update)
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
