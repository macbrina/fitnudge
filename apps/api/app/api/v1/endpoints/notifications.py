from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime, time
import uuid

from app.core.database import get_supabase_client
from app.core.flexible_auth import get_current_user

router = APIRouter(
    redirect_slashes=False
)  # Disable redirects to preserve Authorization header


# Pydantic models
class NotificationPreferencesRequest(BaseModel):
    enabled: bool = True
    push_notifications: bool = True
    email_notifications: bool = True
    ai_motivation: bool = True
    reminders: bool = True
    social: bool = True
    achievements: bool = True
    reengagement: bool = True
    quiet_hours_enabled: bool = False
    quiet_hours_start: str = "22:00"
    quiet_hours_end: str = "08:00"


class NotificationPreferencesResponse(BaseModel):
    enabled: bool
    push_notifications: bool
    email_notifications: bool
    ai_motivation: bool
    reminders: bool
    social: bool
    achievements: bool
    reengagement: bool
    quiet_hours_enabled: bool
    quiet_hours_start: str
    quiet_hours_end: str


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
    sent_at: datetime
    delivered_at: Optional[datetime]
    opened_at: Optional[datetime]


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
                social=True,
                achievements=True,
                reengagement=True,
                quiet_hours_enabled=False,
                quiet_hours_start="22:00",
                quiet_hours_end="08:00",
            )

        prefs = result.data[0]
        return NotificationPreferencesResponse(
            enabled=prefs["enabled"],
            push_notifications=prefs.get("push_notifications", True),
            email_notifications=prefs.get("email_notifications", True),
            ai_motivation=prefs["ai_motivation"],
            reminders=prefs["reminders"],
            social=prefs["social"],
            achievements=prefs["achievements"],
            reengagement=prefs["reengagement"],
            quiet_hours_enabled=prefs["quiet_hours_enabled"],
            quiet_hours_start=str(prefs["quiet_hours_start"]),
            quiet_hours_end=str(prefs["quiet_hours_end"]),
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

        # Upsert notification preferences
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
                    "social": preferences.social,
                    "achievements": preferences.achievements,
                    "reengagement": preferences.reengagement,
                    "quiet_hours_enabled": preferences.quiet_hours_enabled,
                    "quiet_hours_start": preferences.quiet_hours_start,
                    "quiet_hours_end": preferences.quiet_hours_end,
                }
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
            social=preferences.social,
            achievements=preferences.achievements,
            reengagement=preferences.reengagement,
            quiet_hours_enabled=preferences.quiet_hours_enabled,
            quiet_hours_start=preferences.quiet_hours_start,
            quiet_hours_end=preferences.quiet_hours_end,
        )
    except HTTPException:
        raise
    except Exception as e:
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
        supabase.table("device_tokens").update({"is_active": False}).eq(
            "user_id", current_user["id"]
        ).execute()

        # Insert or update device token
        result = (
            supabase.table("device_tokens")
            .upsert(
                {
                    "user_id": current_user["id"],
                    "fcm_token": device_info.fcm_token,
                    "device_type": device_info.device_type,
                    "device_id": device_info.device_id,
                    "timezone": device_info.timezone,
                    "app_version": device_info.app_version,
                    "os_version": device_info.os_version,
                    "is_active": True,
                }
            )
            .execute()
        )

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
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get user's notification history"""
    try:
        supabase = get_supabase_client()

        result = (
            supabase.table("notification_history")
            .select(
                "id, notification_type, title, body, sent_at, delivered_at, opened_at"
            )
            .eq("user_id", current_user["id"])
            .order("sent_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )

        return [
            NotificationHistoryResponse(
                id=str(row["id"]),
                notification_type=row["notification_type"],
                title=row["title"],
                body=row["body"],
                sent_at=datetime.fromisoformat(row["sent_at"].replace("Z", "+00:00")),
                delivered_at=(
                    datetime.fromisoformat(row["delivered_at"].replace("Z", "+00:00"))
                    if row["delivered_at"]
                    else None
                ),
                opened_at=(
                    datetime.fromisoformat(row["opened_at"].replace("Z", "+00:00"))
                    if row["opened_at"]
                    else None
                ),
            )
            for row in result.data
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get notification history: {str(e)}",
        )


@router.post("/test")
async def send_test_notification(
    notification_type: str,
    data: Optional[dict] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Send a test notification (for development)"""
    try:
        supabase = get_supabase_client()

        # Check if notification type is enabled for user
        result = supabase.rpc(
            "is_notification_type_enabled",
            {"p_user_id": current_user["id"], "p_notification_type": notification_type},
        ).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Notification type '{notification_type}' is disabled for this user",
            )

        # Get user's active device tokens
        tokens_result = supabase.rpc(
            "get_user_active_device_tokens", {"p_user_id": current_user["id"]}
        ).execute()

        if not tokens_result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active device tokens found for this user",
            )

        # Log test notification in history
        notification_id = str(uuid.uuid4())
        supabase.table("notification_history").insert(
            {
                "id": notification_id,
                "user_id": current_user["id"],
                "notification_type": notification_type,
                "title": "Test Notification",
                "body": f"This is a test {notification_type} notification",
                "data": data or {},
            }
        ).execute()

        # TODO: Send actual FCM notification here
        # For now, just return success

        return {
            "success": True,
            "message_id": notification_id,
            "tokens_count": len(tokens_result.data),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send test notification: {str(e)}",
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
