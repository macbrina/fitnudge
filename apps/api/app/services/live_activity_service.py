"""
Mode B: Server-driven iOS Live Activity (ActivityKit).

Updates the "Today's focus" Live Activity via APNs with push-type liveactivity only.
Does NOT use Expo push notifications; those cannot update a Live Activity.
Topic must be <bundleId>.push-type.liveactivity (ACTIVITYKIT_APNS_TOPIC).

Used when the app is killed or when we want a single source of truth (backend).
Mode A (in-app) remains as fallback when tokens are missing or Live Activities disabled.
"""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import httpx
import pytz
from jose import jwt

from app.core.config import settings
from app.core.database import get_supabase_client


class APNsDeliveryError(Exception):
    """Raised when APNs returns an error. status_code 404/410 = token invalid."""

    def __init__(self, status_code: int, message: str = ""):
        self.status_code = status_code
        self.message = message
        super().__init__(f"APNs error {status_code}: {message}")


# =====================================================
# Payload (stable contract with iOS ActivityKit extension)
# =====================================================


@dataclass(frozen=True)
class NextUpPayload:
    dayKey: str
    nextTaskId: str
    title: str
    taskTitle: str
    emoji: Optional[str]
    completedCount: int
    totalCount: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "dayKey": self.dayKey,
            "nextTaskId": self.nextTaskId,
            "title": self.title,
            "taskTitle": self.taskTitle,
            "emoji": self.emoji,
            "completedCount": self.completedCount,
            "totalCount": self.totalCount,
        }

    def stable_hash(self) -> str:
        raw = json.dumps(self.to_dict(), sort_keys=True, separators=(",", ":")).encode(
            "utf-8"
        )
        return hashlib.sha256(raw).hexdigest()


# =====================================================
# Deterministic selection (server-side mirror of JS rules)
# =====================================================


def _parse_hhmm_to_minutes(hhmm: str) -> Optional[int]:
    try:
        parts = hhmm.strip().split(":")
        if len(parts) != 2:
            return None
        hh = int(parts[0])
        mm = int(parts[1])
        if hh < 0 or hh > 23 or mm < 0 or mm > 59:
            return None
        return hh * 60 + mm
    except Exception:
        return None


def _earliest_reminder_minutes(reminder_times: Optional[List[str]]) -> int:
    if not reminder_times:
        return 24 * 60 - 1
    mins: List[int] = []
    for t in reminder_times:
        m = _parse_hhmm_to_minutes(str(t))
        if m is not None:
            mins.append(m)
    return min(mins) if mins else (24 * 60 - 1)


def _js_day_of_week(now_local: datetime) -> int:
    # Python: Monday=0..Sunday=6. JS Date.getDay(): Sunday=0..Saturday=6
    return (now_local.weekday() + 1) % 7


def _is_goal_scheduled_today(goal: Dict[str, Any], now_local: datetime) -> bool:
    if goal.get("frequency_type") == "daily":
        return True
    if goal.get("frequency_type") != "weekly":
        return False
    target_days = goal.get("target_days")
    if not isinstance(target_days, list):
        return False
    return _js_day_of_week(now_local) in [
        int(x) for x in target_days if str(x).isdigit()
    ]


def _deterministic_sort_key(goal: Dict[str, Any]) -> Tuple[int, str, str]:
    due_minutes = _earliest_reminder_minutes(goal.get("reminder_times"))
    created_at = str(goal.get("created_at") or "")
    goal_id = str(goal.get("id") or "")
    return (due_minutes, created_at, goal_id)


# =====================================================
# APNs ActivityKit Push Sender
# =====================================================


class ActivityKitAPNsClient:
    """
    Minimal APNs (HTTP/2) sender for ActivityKit Live Activities.
    Uses Token-based auth (JWT) with ES256.
    """

    def __init__(self) -> None:
        self.team_id = getattr(settings, "ACTIVITYKIT_APNS_TEAM_ID", "") or ""
        self.key_id = getattr(settings, "ACTIVITYKIT_APNS_KEY_ID", "") or ""
        self.private_key = getattr(settings, "ACTIVITYKIT_APNS_PRIVATE_KEY", "") or ""
        self.topic = getattr(settings, "ACTIVITYKIT_APNS_TOPIC", "") or ""
        self.use_sandbox = (
            str(getattr(settings, "ACTIVITYKIT_APNS_USE_SANDBOX", "false")).lower()
            == "true"
        )

        if (
            not self.team_id
            or not self.key_id
            or not self.private_key
            or not self.topic
        ):
            raise RuntimeError(
                "ActivityKit APNs not configured. Set ACTIVITYKIT_APNS_TEAM_ID, "
                "ACTIVITYKIT_APNS_KEY_ID, ACTIVITYKIT_APNS_PRIVATE_KEY, ACTIVITYKIT_APNS_TOPIC."
            )

    def _provider_jwt(self) -> str:
        now = int(time.time())
        headers = {"alg": "ES256", "kid": self.key_id, "typ": "JWT"}
        claims = {"iss": self.team_id, "iat": now}
        return jwt.encode(claims, self.private_key, algorithm="ES256", headers=headers)

    def _host(self) -> str:
        return (
            "https://api.sandbox.push.apple.com"
            if self.use_sandbox
            else "https://api.push.apple.com"
        )

    async def send(self, token: str, payload: Dict[str, Any]) -> None:
        url = f"{self._host()}/3/device/{token}"
        headers = {
            "authorization": f"bearer {self._provider_jwt()}",
            "apns-push-type": "liveactivity",
            "apns-topic": self.topic,
            "apns-priority": "5",
        }
        async with httpx.AsyncClient(http2=True, timeout=10.0) as client:
            r = await client.post(url, headers=headers, json=payload)
            if r.status_code >= 400:
                raise APNsDeliveryError(r.status_code, r.text)


# =====================================================
# Orchestration: compute + dedupe + send start/update/end
# =====================================================


async def compute_next_up_payload_for_user(
    user_id: str,
    timezone: str,
    locked_task_id: Optional[str],
    locked_day_key: Optional[str],
) -> Tuple[Optional[NextUpPayload], str, Optional[str]]:
    """
    Returns (payload or None if end, day_key, next_task_id_or_none).
    """
    supabase = get_supabase_client()
    tz = pytz.timezone(timezone or "UTC")
    now_local = datetime.now(tz)
    day_key = now_local.strftime("%Y-%m-%d")

    goals_res = (
        supabase.table("goals")
        .select("id,title,created_at,frequency_type,target_days,reminder_times,status")
        .eq("user_id", user_id)
        .eq("status", "active")
        .execute()
    )
    goals = goals_res.data or []
    scheduled = [g for g in goals if _is_goal_scheduled_today(g, now_local)]
    if not scheduled:
        return None, day_key, None

    goal_ids = [g["id"] for g in scheduled]
    checkins_res = (
        supabase.table("check_ins")
        .select("goal_id,status,check_in_date")
        .eq("user_id", user_id)
        .eq("check_in_date", day_key)
        .in_("goal_id", goal_ids)
        .execute()
    )
    checkins = checkins_res.data or []
    status_by_goal: Dict[str, str] = {
        str(ci["goal_id"]): str(ci.get("status") or "") for ci in checkins
    }

    total = len(scheduled)
    completed = sum(
        1
        for g in scheduled
        if status_by_goal.get(str(g["id"]))
        and status_by_goal.get(str(g["id"])) != "pending"
    )
    pending_goals = [
        g for g in scheduled if status_by_goal.get(str(g["id"]), "pending") == "pending"
    ]

    if not pending_goals:
        return None, day_key, None

    # Flicker lock semantics (server-side best effort)
    if locked_day_key == day_key and locked_task_id:
        for g in pending_goals:
            if str(g["id"]) == str(locked_task_id):
                payload = NextUpPayload(
                    dayKey=day_key,
                    nextTaskId=str(g["id"]),
                    title="Today's focus",
                    taskTitle=str(g["title"] or ""),
                    emoji=None,
                    completedCount=completed,
                    totalCount=total,
                )
                return payload, day_key, str(g["id"])

    pending_goals_sorted = sorted(pending_goals, key=_deterministic_sort_key)
    chosen = pending_goals_sorted[0]
    payload = NextUpPayload(
        dayKey=day_key,
        nextTaskId=str(chosen["id"]),
        title="Today's focus",
        taskTitle=str(chosen["title"] or ""),
        emoji=None,
        completedCount=completed,
        totalCount=total,
    )
    return payload, day_key, str(chosen["id"])


def build_activitykit_start_payload(payload: NextUpPayload) -> Dict[str, Any]:
    now = int(time.time())
    return {
        "aps": {
            "timestamp": now,
            "event": "start",
            "content-state": payload.to_dict(),
        },
        # Must match the ActivityAttributes type name in Swift.
        "attributes-type": "NextUpAttributes",
        # Static attributes (minimal)
        "attributes": {"dayKey": payload.dayKey},
    }


def build_activitykit_update_payload(payload: NextUpPayload) -> Dict[str, Any]:
    now = int(time.time())
    return {
        "aps": {
            "timestamp": now,
            "event": "update",
            "content-state": payload.to_dict(),
        }
    }


def build_activitykit_end_payload(payload: NextUpPayload) -> Dict[str, Any]:
    now = int(time.time())
    return {
        "aps": {
            "timestamp": now,
            "event": "end",
            "content-state": payload.to_dict(),
            # Dismiss quickly after ending (seconds). 0 => immediately.
            "dismissal-date": now,
        }
    }


async def refresh_live_activity_for_user(user_id: str) -> Dict[str, Any]:
    """
    Computes next payload for each iOS device and sends:
    - start via push_to_start_token when we don't have an activity_push_token
    - update/end via activity_push_token when available
    Dedupe: skip if payload hash unchanged for the same dayKey.
    """
    supabase = get_supabase_client()
    devices_res = (
        supabase.table("live_activity_devices")
        .select("*")
        .eq("user_id", user_id)
        .eq("platform", "ios")
        .execute()
    )
    devices = devices_res.data or []
    if not devices:
        return {"sent": 0, "devices": 0}

    apns = ActivityKitAPNsClient()
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

        # End case
        if next_payload is None:
            # If we have an activity push token, we can end remotely.
            if d.get("activity_push_token"):
                end_payload = build_activitykit_end_payload(
                    NextUpPayload(
                        dayKey=day_key,
                        nextTaskId=str(d.get("locked_task_id") or ""),
                        title="Today's focus",
                        taskTitle="",
                        emoji=None,
                        completedCount=0,
                        totalCount=0,
                    )
                )
                try:
                    await apns.send(str(d["activity_push_token"]), end_payload)
                    sent += 1
                except APNsDeliveryError as e:
                    if e.status_code in (404, 410):
                        supabase.table("live_activity_devices").update(
                            {
                                "push_to_start_token": None,
                                "activity_id": None,
                                "activity_push_token": None,
                            }
                        ).eq("id", d["id"]).execute()
                except Exception:
                    pass

            # Clear state
            supabase.table("live_activity_devices").update(
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

        try:
            if d.get("activity_push_token"):
                await apns.send(
                    str(d["activity_push_token"]),
                    build_activitykit_update_payload(next_payload),
                )
                sent += 1
            elif d.get("push_to_start_token"):
                await apns.send(
                    str(d["push_to_start_token"]),
                    build_activitykit_start_payload(next_payload),
                )
                sent += 1
        except APNsDeliveryError as e:
            if e.status_code in (404, 410):
                supabase.table("live_activity_devices").update(
                    {
                        "push_to_start_token": None,
                        "activity_id": None,
                        "activity_push_token": None,
                    }
                ).eq("id", d["id"]).execute()
            continue
        except Exception:
            continue

        # Persist dedupe + lock (best-effort flicker prevention)
        supabase.table("live_activity_devices").update(
            {
                "last_day_key": day_key,
                "last_payload_hash": payload_hash,
                "locked_day_key": day_key,
                "locked_task_id": next_task_id,
            }
        ).eq("id", d["id"]).execute()

    return {"sent": sent, "devices": len(devices)}
