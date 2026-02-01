from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.database import get_supabase_client
from app.core.flexible_auth import get_current_user
from app.services.nextup_fcm_service import refresh_nextup_fcm_for_user


router = APIRouter(redirect_slashes=False)


class FcmTokenRequest(BaseModel):
    device_id: str
    platform: str = "android"
    fcm_token: str
    timezone: Optional[str] = None


@router.post("/fcm-token")
async def register_fcm_token(
    body: FcmTokenRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    if body.platform != "android":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="platform must be android"
        )

    supabase = get_supabase_client()
    user_id = current_user["id"]

    supabase.table("nextup_fcm_devices").upsert(
        {
            "user_id": user_id,
            "device_id": body.device_id,
            "platform": "android",
            "fcm_token": body.fcm_token,
            "timezone": body.timezone or current_user.get("timezone") or "UTC",
        },
        on_conflict="user_id,device_id,platform",
    ).execute()

    return {"success": True}


@router.post("/debug/refresh")
async def debug_refresh_nextup_android(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    try:
        result = await refresh_nextup_fcm_for_user(current_user["id"])
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to refresh NextUp Android: {str(e)}",
        )
