"""
App Versions Management Endpoints
CRUD for app_versions table (platform-specific version info for iOS/Android)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from typing_extensions import Literal

from app.core.admin_auth import get_current_admin, log_admin_action
from app.core.database import get_supabase_client, first_row

router = APIRouter(prefix="/app-versions", tags=["App Versions"])


class AppVersionItem(BaseModel):
    id: str
    platform: str
    latest_version: str
    minimum_version: str
    release_notes: Optional[str]
    store_url: Optional[str]
    force_update: bool
    created_at: str
    updated_at: str


class AppVersionListResponse(BaseModel):
    items: List[AppVersionItem]


class AppVersionUpdatePayload(BaseModel):
    latest_version: Optional[str] = None
    minimum_version: Optional[str] = None
    release_notes: Optional[str] = None
    store_url: Optional[str] = None
    force_update: Optional[bool] = None


def _row_to_item(row: dict) -> AppVersionItem:
    return AppVersionItem(
        id=row["id"],
        platform=row["platform"],
        latest_version=row["latest_version"],
        minimum_version=row["minimum_version"],
        release_notes=row.get("release_notes"),
        store_url=row.get("store_url"),
        force_update=row.get("force_update", False),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.get("", response_model=AppVersionListResponse)
async def list_app_versions(current_admin: dict = Depends(get_current_admin)):
    """
    List all app_versions (iOS and Android).
    """
    supabase = get_supabase_client()

    result = (
        supabase.table("app_versions")
        .select("*")
        .order("platform")
        .execute()
    )

    items = [_row_to_item(row) for row in (result.data or [])]
    return AppVersionListResponse(items=items)


@router.get("/{platform}", response_model=AppVersionItem)
async def get_app_version(
    platform: Literal["ios", "android"],
    current_admin: dict = Depends(get_current_admin),
):
    """
    Get app version for a specific platform.
    """
    supabase = get_supabase_client()

    result = (
        supabase.table("app_versions")
        .select("*")
        .eq("platform", platform)
        .maybe_single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=404,
            detail=f"App version not found for platform: {platform}",
        )

    return _row_to_item(result.data)


@router.put("/{platform}", response_model=AppVersionItem)
async def update_app_version(
    platform: Literal["ios", "android"],
    payload: AppVersionUpdatePayload,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Update app version for a platform. Audited.
    """
    supabase = get_supabase_client()

    existing = (
        supabase.table("app_versions")
        .select("*")
        .eq("platform", platform)
        .maybe_single()
        .execute()
    )

    if not existing.data:
        raise HTTPException(
            status_code=404,
            detail=f"App version not found for platform: {platform}",
        )

    try:
        old_row = first_row(existing.data)
        update_data: dict = {}
        if payload.latest_version is not None:
            update_data["latest_version"] = payload.latest_version
        if payload.minimum_version is not None:
            update_data["minimum_version"] = payload.minimum_version
        if payload.release_notes is not None:
            update_data["release_notes"] = payload.release_notes
        if payload.store_url is not None:
            update_data["store_url"] = payload.store_url
        if payload.force_update is not None:
            update_data["force_update"] = payload.force_update

        if not update_data:
            return _row_to_item(old_row)

        result = (
            supabase.table("app_versions")
            .update(update_data)
            .eq("platform", platform)
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=500, detail="Update failed")

        await log_admin_action(
            admin_user_id=current_admin["id"],
            action="update",
            resource_type="app_version",
            resource_id=platform,
            details={
                "platform": platform,
                "old_values": {k: old_row.get(k) for k in update_data},
                "new_values": update_data,
            },
        )

        return _row_to_item(first_row(result.data))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
