from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime, time, timezone
import json
import uuid

from app.core.database import get_supabase_client
from app.core.flexible_auth import get_current_user
from app.core.subscriptions import get_user_effective_plan
from postgrest.exceptions import APIError

router = APIRouter(
    redirect_slashes=False
)  # Disable redirects to preserve Authorization header


# Pydantic models
class NotificationPreferencesRequest(BaseModel):
    # Global settings
    enabled: bool = True
    push_notifications: bool = True
    email_notifications: bool = True

    # Core notification types
    ai_motivation: bool = True
    reminders: bool = True
    achievements: bool = True
    reengagement: bool = True
    weekly_recap: bool = True

    # Quiet hours
    quiet_hours_enabled: bool = False
    quiet_hours_start: str = "22:00"
    quiet_hours_end: str = "08:00"

    # Partner notifications (single toggle for all partner types)
    partners: bool = True


class NotificationPreferencesResponse(BaseModel):
    # Global settings
    enabled: bool
    push_notifications: bool
    email_notifications: bool

    # Core notification types
    ai_motivation: bool
    reminders: bool
    achievements: bool
    reengagement: bool
    weekly_recap: bool

    # Quiet hours
    quiet_hours_enabled: bool
    quiet_hours_start: str
    quiet_hours_end: str

    # Partner notifications (single toggle for all partner types)
    partners: bool


class DeviceTokenRequest(BaseModel):
    fcm_token: str
    device_type: str  # 'ios' or 'android'
    device_id: str
    timezone: str
    app_version: str
    os_version: str


class DeviceTokenResponse(BaseModel):
    success: bool
    device_id: str


class NotificationHistoryResponse(BaseModel):
    id: str
    notification_type: str
    title: str
    body: str
    data: Optional[Dict[str, Any]] = None
    sent_at: datetime
    delivered_at: Optional[datetime]
    opened_at: Optional[datetime]
    dismissed_at: Optional[datetime] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    created_at: datetime


class BroadcastResponse(BaseModel):
    """Admin broadcast (notifications table row) for in-app modal."""

    id: str
    title: str
    body: str
    image_url: Optional[str] = None
    cta_label: Optional[str] = None
    cta_url: Optional[str] = None
    deeplink: Optional[str] = None


class MarkBroadcastSeenRequest(BaseModel):
    dismissed: bool = False


@router.get("/preferences", response_model=NotificationPreferencesResponse)
async def get_notification_preferences(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get user's notification preferences"""
    try:
        supabase = get_supabase_client()

        # Query user's notification preferences
        result = (
            supabase.table("notification_preferences")
            .select("*")
            .eq("user_id", current_user["id"])
            .execute()
        )

        if not result.data:
            # Return default preferences if none exist
            return NotificationPreferencesResponse(
                enabled=True,
                push_notifications=True,
                email_notifications=True,
                ai_motivation=True,
                reminders=True,
                achievements=True,
                reengagement=True,
                weekly_recap=True,
                quiet_hours_enabled=False,
                quiet_hours_start="22:00",
                quiet_hours_end="08:00",
                partners=True,
            )

        prefs = result.data[0]
        return NotificationPreferencesResponse(
            enabled=prefs["enabled"],
            push_notifications=prefs.get("push_notifications", True),
            email_notifications=prefs.get("email_notifications", True),
            ai_motivation=prefs["ai_motivation"],
            reminders=prefs["reminders"],
            achievements=prefs["achievements"],
            reengagement=prefs["reengagement"],
            weekly_recap=prefs.get("weekly_recap", prefs.get("weekly_recaps", True)),
            quiet_hours_enabled=prefs["quiet_hours_enabled"],
            quiet_hours_start=str(prefs["quiet_hours_start"]),
            quiet_hours_end=str(prefs["quiet_hours_end"]),
            partners=prefs.get("partners", True),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get notification preferences: {str(e)}",
        )


@router.put("/preferences", response_model=NotificationPreferencesResponse)
async def update_notification_preferences(
    preferences: NotificationPreferencesRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Update user's notification preferences"""
    try:
        # Validate time format
        try:
            time.fromisoformat(preferences.quiet_hours_start)
            time.fromisoformat(preferences.quiet_hours_end)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid time format. Use HH:MM format.",
            )

        supabase = get_supabase_client()

        # Upsert notification preferences (use user_id for conflict resolution)
        result = (
            supabase.table("notification_preferences")
            .upsert(
                {
                    "user_id": current_user["id"],
                    "enabled": preferences.enabled,
                    "push_notifications": preferences.push_notifications,
                    "email_notifications": preferences.email_notifications,
                    "ai_motivation": preferences.ai_motivation,
                    "reminders": preferences.reminders,
                    "achievements": preferences.achievements,
                    "reengagement": preferences.reengagement,
                    "weekly_recap": preferences.weekly_recap,
                    "quiet_hours_enabled": preferences.quiet_hours_enabled,
                    "quiet_hours_start": preferences.quiet_hours_start,
                    "quiet_hours_end": preferences.quiet_hours_end,
                    "partners": preferences.partners,
                },
                on_conflict="user_id",
            )
            .execute()
        )

        # Return updated preferences
        return NotificationPreferencesResponse(
            enabled=preferences.enabled,
            push_notifications=preferences.push_notifications,
            email_notifications=preferences.email_notifications,
            ai_motivation=preferences.ai_motivation,
            reminders=preferences.reminders,
            achievements=preferences.achievements,
            reengagement=preferences.reengagement,
            weekly_recap=preferences.weekly_recap,
            quiet_hours_enabled=preferences.quiet_hours_enabled,
            quiet_hours_start=preferences.quiet_hours_start,
            quiet_hours_end=preferences.quiet_hours_end,
            partners=preferences.partners,
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Failed to update notification preferences: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update notification preferences: {str(e)}",
        )


@router.post("/register-device", response_model=DeviceTokenResponse)
async def register_device(
    device_info: DeviceTokenRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Register device for push notifications"""
    try:
        # Validate device type
        if device_info.device_type not in ["ios", "android"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid device type. Must be 'ios' or 'android'",
            )

        supabase = get_supabase_client()

        # Deactivate old tokens for this user
        try:
            supabase.table("device_tokens").update({"is_active": False}).eq(
                "user_id", current_user["id"]
            ).execute()
        except APIError as exc:
            # Supabase returns a 404 when no rows match the update filter. That's fine.
            if getattr(exc, "code", "") not in {"404", "PGRST116"}:
                raise

        # Insert or update device token
        supabase.table("device_tokens").upsert(
            {
                "user_id": current_user["id"],
                "fcm_token": device_info.fcm_token,
                "device_type": device_info.device_type,
                "device_id": device_info.device_id,
                "timezone": device_info.timezone,
                "app_version": device_info.app_version,
                "os_version": device_info.os_version,
                "is_active": True,
            },
            on_conflict="fcm_token",
        ).execute()

        return DeviceTokenResponse(success=True, device_id=device_info.device_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register device: {str(e)}",
        )


@router.delete("/register-device")
async def unregister_device(
    fcm_token: str, current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Unregister device from push notifications"""
    try:
        supabase = get_supabase_client()

        # Deactivate device token
        result = (
            supabase.table("device_tokens")
            .update({"is_active": False})
            .eq("fcm_token", fcm_token)
            .eq("user_id", current_user["id"])
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Device token not found"
            )

        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to unregister device: {str(e)}",
        )


@router.get("/history", response_model=List[NotificationHistoryResponse])
async def get_notification_history(
    limit: int = 50,
    offset: int = 0,
    notification_type: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get user's notification history

    Args:
        limit: Max notifications to return (default 50)
        offset: Pagination offset (default 0)
        notification_type: Optional filter by type (e.g., 'reminder', 'ai_motivation', 'social')
    """
    try:
        supabase = get_supabase_client()

        query = (
            supabase.table("notification_history")
            .select("*")
            .eq("user_id", current_user["id"])
        )

        # Optional filter by notification type
        if notification_type:
            query = query.eq("notification_type", notification_type)

        result = (
            query.order("sent_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )

        notifications = []
        for row in result.data:
            # Parse data JSON string if present
            data = None
            if row.get("data"):
                try:
                    data = (
                        json.loads(row["data"])
                        if isinstance(row["data"], str)
                        else row["data"]
                    )
                except (json.JSONDecodeError, TypeError):
                    data = None

            notifications.append(
                NotificationHistoryResponse(
                    id=str(row["id"]),
                    notification_type=row["notification_type"],
                    title=row["title"],
                    body=row["body"],
                    data=data,
                    sent_at=datetime.fromisoformat(
                        row["sent_at"].replace("Z", "+00:00")
                    ),
                    delivered_at=(
                        datetime.fromisoformat(
                            row["delivered_at"].replace("Z", "+00:00")
                        )
                        if row["delivered_at"]
                        else None
                    ),
                    opened_at=(
                        datetime.fromisoformat(row["opened_at"].replace("Z", "+00:00"))
                        if row["opened_at"]
                        else None
                    ),
                    dismissed_at=(
                        datetime.fromisoformat(
                            row["dismissed_at"].replace("Z", "+00:00")
                        )
                        if row.get("dismissed_at")
                        else None
                    ),
                    entity_type=row.get("entity_type"),
                    entity_id=str(row["entity_id"]) if row.get("entity_id") else None,
                    created_at=datetime.fromisoformat(
                        row["created_at"].replace("Z", "+00:00")
                    ),
                )
            )

        return notifications
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get notification history: {str(e)}",
        )


@router.post("/history/{notification_id}/opened")
async def mark_notification_opened(
    notification_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Mark a notification as opened"""
    try:
        supabase = get_supabase_client()

        result = (
            supabase.table("notification_history")
            .update({"opened_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", notification_id)
            .eq("user_id", current_user["id"])
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found",
            )

        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark notification as opened: {str(e)}",
        )


@router.post("/history/mark-all-opened")
async def mark_all_notifications_opened(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Mark ALL unread notifications as opened for the current user.

    This is a batch operation following SCALABILITY.md best practices:
    - Single DB query instead of N+1 pattern
    - Marks ALL unread notifications, not just visible ones
    """
    try:
        supabase = get_supabase_client()
        user_id = current_user["id"]

        # Single batch update - mark ALL unread notifications as opened
        # Following SCALABILITY.md: Use batch operations instead of loops
        result = (
            supabase.table("notification_history")
            .update({"opened_at": datetime.now(timezone.utc).isoformat()})
            .eq("user_id", user_id)
            .is_("opened_at", "null")  # Only update those not yet opened
            .execute()
        )

        # Return count of updated notifications
        updated_count = len(result.data) if result.data else 0

        return {"success": True, "updated_count": updated_count}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark all notifications as opened: {str(e)}",
        )


@router.get("/analytics")
async def get_notification_analytics(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get notification analytics for user"""
    try:
        supabase = get_supabase_client()

        # Get basic stats
        stats_result = (
            supabase.table("notification_history")
            .select("delivered_at, opened_at")
            .eq("user_id", current_user["id"])
            .execute()
        )

        total_sent = len(stats_result.data)
        total_delivered = len([row for row in stats_result.data if row["delivered_at"]])
        total_opened = len([row for row in stats_result.data if row["opened_at"]])

        open_rate = (total_opened / total_sent * 100) if total_sent > 0 else 0

        # Get stats by category
        category_result = (
            supabase.table("notification_history")
            .select("notification_type, delivered_at, opened_at")
            .eq("user_id", current_user["id"])
            .execute()
        )

        by_category = {}
        for row in category_result.data:
            notification_type = row["notification_type"]
            if notification_type not in by_category:
                by_category[notification_type] = {
                    "sent": 0,
                    "delivered": 0,
                    "opened": 0,
                }

            by_category[notification_type]["sent"] += 1
            if row["delivered_at"]:
                by_category[notification_type]["delivered"] += 1
            if row["opened_at"]:
                by_category[notification_type]["opened"] += 1

        # Calculate rates
        for category in by_category:
            sent = by_category[category]["sent"]
            opened = by_category[category]["opened"]
            rate = (opened / sent * 100) if sent > 0 else 0
            by_category[category]["rate"] = round(rate, 2)

        return {
            "total_sent": total_sent,
            "total_delivered": total_delivered,
            "total_opened": total_opened,
            "open_rate": round(open_rate, 2),
            "by_category": by_category,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get notification analytics: {str(e)}",
        )


# =====================================================
# Admin broadcasts (in-app modal, system tab)
# =====================================================

# Supported locales for broadcast translations (match LANGUAGES in mobile)
BROADCAST_LOCALES = ("en", "es", "fr", "de", "pt", "it", "nl")


def _resolve_broadcast_localization(
    row: Dict[str, Any], user_lang: str
) -> tuple[str, str, Optional[str]]:
    """
    Resolve localized title, body, cta_label from broadcast row.
    Fallback: translations[user_lang] -> translations[source_lang] -> translations["en"] -> top-level.
    """
    trans = row.get("translations")
    if isinstance(trans, str):
        try:
            trans = json.loads(trans) if trans.strip() else None
        except (json.JSONDecodeError, AttributeError):
            trans = None
    source = (row.get("source_lang") or "en").lower()
    lang = (user_lang or "en").lower() if user_lang else "en"
    if lang not in BROADCAST_LOCALES:
        lang = "en"

    def get_locale_block(loc: str) -> Optional[Dict[str, Any]]:
        if not trans or not isinstance(trans, dict):
            return None
        b = trans.get(loc)
        return b if isinstance(b, dict) else None

    for loc in (lang, source, "en"):
        block = get_locale_block(loc)
        if block:
            t = block.get("title")
            b = block.get("body")
            c = block.get("cta_label")
            if t is not None and b is not None:
                return (str(t), str(b), str(c) if c is not None else None)

    cta = row.get("cta_label")
    return (
        str(row.get("title") or ""),
        str(row.get("body") or ""),
        str(cta) if cta is not None else None,
    )


@router.get("/broadcasts/active", response_model=List[BroadcastResponse])
async def list_active_broadcasts(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    List active admin broadcasts for the current user.

    - Only for users who have completed onboarding (onboarding_completed_at is set).
    - Filter by is_active, starts_at/ends_at (server time).
    - Exclude broadcasts already in notification_history for this user
      (entity_type=admin_broadcast, entity_id=broadcast id).
    - Audience: all, free, premium; filter by user's effective plan.
    """
    try:
        if not current_user.get("onboarding_completed_at"):
            return []

        supabase = get_supabase_client()
        user_id = current_user["id"]
        now_utc = datetime.now(timezone.utc)

        user_lang = (current_user.get("language") or "en").strip() or "en"

        # Fetch active broadcasts; filter starts_at/ends_at in Python (server time)
        n_result = (
            supabase.table("notifications")
            .select(
                "id, title, body, image_url, cta_label, cta_url, deeplink, "
                "source_lang, translations, audience, delivery, starts_at, ends_at"
            )
            .eq("is_active", True)
            .execute()
        )
        rows = n_result.data or []

        def in_schedule(r: dict) -> bool:
            try:
                s = r.get("starts_at")
                e = r.get("ends_at")
                if s:
                    start = datetime.fromisoformat(s.replace("Z", "+00:00"))
                    if now_utc < start:
                        return False
                if e:
                    end = datetime.fromisoformat(e.replace("Z", "+00:00"))
                    if now_utc > end:
                        return False
                return True
            except Exception:
                return True

        rows = [r for r in rows if in_schedule(r)]

        # Filter by audience (user plan)
        plan = get_user_effective_plan(user_id, supabase=supabase)
        filtered = []
        for r in rows:
            aud = (r.get("audience") or "all").lower()
            if aud == "all":
                filtered.append(r)
            elif aud == "free" and plan == "free":
                filtered.append(r)
            elif aud == "premium" and plan == "premium":
                filtered.append(r)

        # Exclude already-seen (notification_history with entity_type admin_broadcast, entity_id)
        hist = (
            supabase.table("notification_history")
            .select("entity_id")
            .eq("user_id", user_id)
            .eq("entity_type", "admin_broadcast")
            .not_.is_("opened_at", "null")
            .execute()
        )
        seen_ids = {
            str(h["entity_id"]) for h in (hist.data or []) if h.get("entity_id")
        }

        out = []
        for r in filtered:
            bid = str(r["id"])
            if bid in seen_ids:
                continue
            title, body, cta_label = _resolve_broadcast_localization(r, user_lang)
            out.append(
                BroadcastResponse(
                    id=bid,
                    title=title,
                    body=body,
                    image_url=r.get("image_url") or None,
                    cta_label=cta_label,
                    cta_url=r.get("cta_url") or None,
                    deeplink=r.get("deeplink") or None,
                )
            )
        return out
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list active broadcasts: {str(e)}",
        )


@router.post("/broadcasts/{broadcast_id}/mark-seen")
async def mark_broadcast_seen(
    broadcast_id: str,
    body: Optional[MarkBroadcastSeenRequest] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Upsert notification_history for this user + broadcast.
    Set opened_at when shown; set dismissed_at when user dismisses.
    Fire-and-forget friendly: client can close UI immediately.
    """
    try:
        supabase = get_supabase_client()
        user_id = current_user["id"]
        user_lang = (current_user.get("language") or "en").strip() or "en"
        now_iso = datetime.now(timezone.utc).isoformat()
        dismissed = body.dismissed if body else False

        # Get broadcast for title, body, image, CTA (for modal in System tab)
        b = (
            supabase.table("notifications")
            .select(
                "id, title, body, image_url, cta_label, cta_url, deeplink, "
                "source_lang, translations"
            )
            .eq("id", broadcast_id)
            .maybe_single()
            .execute()
        )
        if not b or not getattr(b, "data", None):
            return {"success": True}

        row = b.data
        title, body_resolved, cta_label = _resolve_broadcast_localization(
            row, user_lang
        )

        data_json = json.dumps(
            {
                "broadcast_id": broadcast_id,
                "image_url": row.get("image_url"),
                "cta_label": cta_label,
                "cta_url": row.get("cta_url"),
                "deeplink": row.get("deeplink"),
            }
        )

        # Find existing history row (user + admin_broadcast + entity_id)
        existing = (
            supabase.table("notification_history")
            .select("id")
            .eq("user_id", user_id)
            .eq("entity_type", "admin_broadcast")
            .eq("entity_id", broadcast_id)
            .maybe_single()
            .execute()
        )
        existing_data = getattr(existing, "data", None) if existing else None

        payload = {
            "opened_at": now_iso,
            "dismissed_at": now_iso if dismissed else None,
            "title": title,
            "body": body_resolved,
            "data": data_json,
        }

        if existing_data:
            supabase.table("notification_history").update(payload).eq(
                "id", existing_data["id"]
            ).execute()
        else:
            supabase.table("notification_history").insert(
                {
                    "user_id": user_id,
                    "notification_type": "general",
                    "entity_type": "admin_broadcast",
                    "entity_id": broadcast_id,
                    "title": title,
                    "body": body_resolved,
                    "data": data_json,
                    "opened_at": now_iso,
                    "dismissed_at": now_iso if dismissed else None,
                }
            ).execute()

        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Failed to mark broadcast seen: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark broadcast seen: {str(e)}",
        )
