from __future__ import annotations

import json
from typing import Any, Dict, Optional

import firebase_admin
from firebase_admin import credentials, messaging

from app.core.config import settings
from app.core.database import get_supabase_client
from app.services.live_activity_service import (
    NextUpPayload,
    compute_next_up_payload_for_user,
)


def _ensure_firebase_app() -> firebase_admin.App:
    if firebase_admin._apps:
        return firebase_admin.get_app()

    raw = getattr(settings, "FCM_SERVICE_ACCOUNT_JSON", "") or ""
    if not raw:
        raise RuntimeError("FCM not configured. Set FCM_SERVICE_ACCOUNT_JSON.")

    try:
        info = json.loads(raw)
    except Exception as e:
        raise RuntimeError("FCM_SERVICE_ACCOUNT_JSON must be valid JSON") from e

    cred = credentials.Certificate(info)
    return firebase_admin.initialize_app(cred)


def _build_nextup_data_message(payload: NextUpPayload, action: str) -> Dict[str, str]:
    # Keep payload tiny and stable: all values must be strings for FCM data.
    d = payload.to_dict()
    return {
        "type": "nextup",
        "action": action,  # start|update|end
        "dayKey": str(d.get("dayKey") or ""),
        "nextTaskId": str(d.get("nextTaskId") or ""),
        "taskTitle": str(d.get("taskTitle") or ""),
        "emoji": str(d.get("emoji") or ""),
        "completedCount": str(int(d.get("completedCount") or 0)),
        "totalCount": str(int(d.get("totalCount") or 0)),
    }


async def refresh_nextup_fcm_for_user(user_id: str) -> Dict[str, Any]:
    """
    Computes NextUp payload and sends FCM data messages to Android devices.
    Dedupe: skip if payload hash unchanged for same dayKey.
    End: if no pending tasks, send 'end' and clear stored state.
    """
    supabase = get_supabase_client()

    devices_res = (
        supabase.table("nextup_fcm_devices")
        .select("*")
        .eq("user_id", user_id)
        .eq("platform", "android")
        .execute()
    )
    devices = devices_res.data or []
    if not devices:
        return {"sent": 0, "devices": 0}

    _ensure_firebase_app()
    sent = 0

    for d in devices:
        timezone = d.get("timezone") or "UTC"
        locked_task_id = (
            str(d.get("locked_task_id")) if d.get("locked_task_id") else None
        )
        locked_day_key = d.get("locked_day_key")

        next_payload, day_key, next_task_id = await compute_next_up_payload_for_user(
            user_id=user_id,
            timezone=timezone,
            locked_task_id=locked_task_id,
            locked_day_key=locked_day_key,
        )

        token = str(d.get("fcm_token") or "")
        if not token:
            continue

        # End case: clear notification
        if next_payload is None:
            try:
                msg = messaging.Message(
                    data={"type": "nextup", "action": "end"}, token=token
                )
                messaging.send(msg)
                sent += 1
            except Exception:
                pass

            supabase.table("nextup_fcm_devices").update(
                {
                    "last_day_key": day_key,
                    "last_payload_hash": None,
                    "locked_day_key": None,
                    "locked_task_id": None,
                }
            ).eq("id", d["id"]).execute()
            continue

        payload_hash = next_payload.stable_hash()
        if (
            d.get("last_day_key") == day_key
            and d.get("last_payload_hash") == payload_hash
        ):
            continue

        # start vs update doesn't matter much for Android; keep semantics anyway.
        action = "start" if not d.get("last_payload_hash") else "update"

        try:
            msg = messaging.Message(
                data=_build_nextup_data_message(next_payload, action), token=token
            )
            messaging.send(msg)
            sent += 1
        except Exception:
            continue

        supabase.table("nextup_fcm_devices").update(
            {
                "last_day_key": day_key,
                "last_payload_hash": payload_hash,
                "locked_day_key": day_key,
                "locked_task_id": next_task_id,
            }
        ).eq("id", d["id"]).execute()

    return {"sent": sent, "devices": len(devices)}
