from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.database import get_supabase_client
from app.core.flexible_auth import get_current_user
from app.services.live_activity_service import refresh_live_activity_for_user


router = APIRouter(redirect_slashes=False)


class PushToStartTokenRequest(BaseModel):
    device_id: str
    platform: str = "ios"
    push_to_start_token: str
    timezone: Optional[str] = None


class ActivityPushTokenRequest(BaseModel):
    device_id: str
    platform: str = "ios"
    activity_id: str
    activity_push_token: str
    timezone: Optional[str] = None


class UnregisterRequest(BaseModel):
    device_id: str
    platform: str = "ios"


@router.post("/push-to-start-token")
async def register_push_to_start_token(
    body: PushToStartTokenRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    if body.platform != "ios":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="platform must be ios"
        )

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Upsert per user+device
    supabase.table("live_activity_devices").upsert(
        {
            "user_id": user_id,
            "device_id": body.device_id,
            "platform": "ios",
            "push_to_start_token": body.push_to_start_token,
            "timezone": body.timezone or current_user.get("timezone") or "UTC",
        },
        on_conflict="user_id,device_id,platform",
    ).execute()

    return {"success": True}


@router.post("/activity-push-token")
async def register_activity_push_token(
    body: ActivityPushTokenRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    if body.platform != "ios":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="platform must be ios"
        )

    supabase = get_supabase_client()
    user_id = current_user["id"]

    supabase.table("live_activity_devices").upsert(
        {
            "user_id": user_id,
            "device_id": body.device_id,
            "platform": "ios",
            "activity_id": body.activity_id,
            "activity_push_token": body.activity_push_token,
            "timezone": body.timezone or current_user.get("timezone") or "UTC",
        },
        on_conflict="user_id,device_id,platform",
    ).execute()

    return {"success": True}


@router.post("/unregister")
async def unregister_live_activity_device(
    body: UnregisterRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Unregister this device from Live Activity pushes.
    Call when the user disables Live Activities in iOS Settings.
    Clears tokens so we stop sending APNs to an invalid device.
    """
    if body.platform != "ios":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="platform must be ios"
        )

    supabase = get_supabase_client()
    user_id = current_user["id"]

    supabase.table("live_activity_devices").delete().eq(
        "user_id", user_id
    ).eq("device_id", body.device_id).eq("platform", body.platform).execute()

    return {"success": True}


@router.post("/debug/refresh")
async def debug_refresh_live_activity(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Debug/testing endpoint: compute + send start/update/end for the current user.
    Useful for verifying server-side APNs integration after token registration.
    """
    try:
        result = await refresh_live_activity_for_user(current_user["id"])
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to refresh live activity: {str(e)}",
        )
