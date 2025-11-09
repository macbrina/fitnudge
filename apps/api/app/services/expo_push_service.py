"""
Expo push notification service.

Provides helpers for sending push notifications through the Expo Push API.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional
from uuid import uuid4

import httpx

from app.core.database import get_supabase_client

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
EXPO_MAX_BATCH_SIZE = 100  # Expo recommends batches of ≤ 100 messages


class ExpoPushError(Exception):
    """Raised when Expo push API returns an error."""


def is_valid_expo_token(token: str) -> bool:
    return token.startswith("ExponentPushToken[") and token.endswith("]")


@dataclass
class ExpoPushMessage:
    to: str
    sound: Optional[str] = "default"
    title: Optional[str] = None
    body: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    priority: str = "high"

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        # Expo expects no null fields
        return {key: value for key, value in payload.items() if value is not None}


async def send_push_messages(
    messages: Iterable[ExpoPushMessage],
) -> List[Dict[str, Any]]:
    """
    Send a collection of push messages to Expo.

    Args:
        messages: iterable of ExpoPushMessage objects

    Returns:
        A list of responses for each batch sent.
    """

    message_list = [
        message.to_dict() for message in messages if is_valid_expo_token(message.to)
    ]

    if not message_list:
        logger.debug("No valid Expo push tokens to send.")
        return []

    responses: List[Dict[str, Any]] = []

    async with httpx.AsyncClient(timeout=10.0) as client:
        for i in range(0, len(message_list), EXPO_MAX_BATCH_SIZE):
            chunk = message_list[i : i + EXPO_MAX_BATCH_SIZE]

            try:
                response = await client.post(EXPO_PUSH_URL, json=chunk)
                response.raise_for_status()
                payload = response.json()
                responses.append(payload)

                if "data" in payload:
                    for idx, ticket in enumerate(payload["data"]):
                        if ticket.get("status") == "error":
                            details = ticket.get("details", {})
                            logger.warning(
                                "Expo push ticket error",
                                extra={
                                    "error": ticket.get("message"),
                                    "details": details,
                                    "token": chunk[idx].get("to"),
                                },
                            )
                else:
                    logger.warning(
                        "Unexpected Expo response structure: %s",
                        json.dumps(payload)[:500],
                    )
            except httpx.RequestError as exc:
                logger.error("Failed to send Expo push request: %s", exc)
                raise ExpoPushError("Network error sending push notifications") from exc
            except httpx.HTTPStatusError as exc:
                logger.error(
                    "Expo push API returned error: %s - %s",
                    exc.response.status_code,
                    exc.response.text[:500],
                )
                raise ExpoPushError("Expo push API returned error response") from exc

    return responses


async def send_push_to_user(
    user_id: str,
    *,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
    notification_type: str = "general",
) -> Dict[str, Any]:
    """
    Persist a notification record and deliver it to all active Expo push tokens for the user.
    """

    supabase = get_supabase_client()

    tokens_result = (
        supabase.table("device_tokens")
        .select("fcm_token")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
    )

    tokens = [
        row["fcm_token"]
        for row in tokens_result.data or []
        if isinstance(row.get("fcm_token"), str)
        and is_valid_expo_token(row["fcm_token"])
    ]

    if not tokens:
        logger.info(
            "No active Expo tokens for user, skipping push notification",
            extra={"user_id": user_id},
        )

        return {
            "notification_id": None,
            "delivered": False,
            "reason": "no_active_tokens",
            "tokens_attempted": 0,
            "invalid_tokens": [],
        }

    notification_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()

    supabase.table("notification_history").insert(
        {
            "id": notification_id,
            "user_id": user_id,
            "notification_type": notification_type,
            "title": title,
            "body": body,
            "data": data or {},
            "sent_at": now,
        }
    ).execute()

    messages = [
        ExpoPushMessage(
            to=token,
            title=title,
            body=body,
            data=data
            or {"type": notification_type, "notification_id": notification_id},
        )
        for token in tokens
    ]

    responses = await send_push_messages(messages)

    delivered = False
    invalid_tokens: List[str] = []

    for response in responses:
        for ticket, message in zip(response.get("data", []), messages):
            status_value = ticket.get("status")
            if status_value == "ok":
                delivered = True
            elif status_value == "error":
                details = ticket.get("details", {}) or {}
                if details.get("error") == "DeviceNotRegistered":
                    invalid_tokens.append(message.to)
                logger.warning(
                    "Expo push delivery error",
                    extra={
                        "user_id": user_id,
                        "token": message.to,
                        "error": ticket.get("message"),
                        "details": details,
                    },
                )

    if delivered:
        supabase.table("notification_history").update(
            {"delivered_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", notification_id).execute()

    if invalid_tokens:
        supabase.table("device_tokens").update({"is_active": False}).in_(
            "fcm_token", invalid_tokens
        ).execute()

    return {
        "notification_id": notification_id,
        "delivered": delivered,
        "invalid_tokens": invalid_tokens,
        "tokens_attempted": len(tokens),
    }
