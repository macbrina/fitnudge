"""
App Config Management Endpoints
CRUD for app_config table (store URLs, external links, maintenance, etc.)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List

from app.core.admin_auth import get_current_admin, log_admin_action
from app.core.database import get_supabase_client, first_row

router = APIRouter(prefix="/app-config", tags=["App Config"])


class AppConfigItem(BaseModel):
    id: str
    key: str
    value: str
    category: str
    description: Optional[str]
    is_public: bool
    updated_at: str


class AppConfigListResponse(BaseModel):
    items: List[AppConfigItem]


class AppConfigUpdatePayload(BaseModel):
    value: str
    description: Optional[str] = None
    is_public: Optional[bool] = None


@router.get("", response_model=AppConfigListResponse)
async def list_app_config(current_admin: dict = Depends(get_current_admin)):
    """
    List all app_config rows. Admin auth required.
    """
    supabase = get_supabase_client()

    result = (
        supabase.table("app_config")
        .select("id, key, value, category, description, is_public, updated_at")
        .order("category")
        .order("key")
        .execute()
    )

    items = [
        AppConfigItem(
            id=row["id"],
            key=row["key"],
            value=row["value"],
            category=row["category"],
            description=row.get("description"),
            is_public=row.get("is_public", True),
            updated_at=row["updated_at"],
        )
        for row in (result.data or [])
    ]

    return AppConfigListResponse(items=items)


@router.get("/{key}", response_model=AppConfigItem)
async def get_app_config(key: str, current_admin: dict = Depends(get_current_admin)):
    """
    Get single app_config by key.
    """
    supabase = get_supabase_client()

    result = (
        supabase.table("app_config")
        .select("id, key, value, category, description, is_public, updated_at")
        .eq("key", key)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Config key not found")

    row = first_row(result.data)
    return AppConfigItem(
        id=row["id"],
        key=row["key"],
        value=row["value"],
        category=row["category"],
        description=row.get("description"),
        is_public=row.get("is_public", True),
        updated_at=row["updated_at"],
    )


@router.put("/{key}", response_model=AppConfigItem)
async def update_app_config(
    key: str,
    payload: AppConfigUpdatePayload,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Update app_config by key. Audited.
    """
    supabase = get_supabase_client()

    # Fetch existing
    existing = (
        supabase.table("app_config")
        .select("id, key, value, description, is_public")
        .eq("key", key)
        .execute()
    )

    if not existing.data:
        raise HTTPException(status_code=404, detail="Config key not found")

    try:
        old_row = first_row(existing.data)
        update_data: dict = {"value": payload.value}
        if payload.description is not None:
            update_data["description"] = payload.description
        if payload.is_public is not None:
            update_data["is_public"] = payload.is_public

        result = (
            supabase.table("app_config")
            .update(update_data)
            .eq("key", key)
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=500, detail="Update failed")

        await log_admin_action(
            admin_user_id=current_admin["id"],
            action="update",
            resource_type="app_config",
            resource_id=key,
            details={
                "key": key,
                "old_value": old_row.get("value"),
                "new_value": payload.value,
            },
        )

        row = first_row(result.data)
        return AppConfigItem(
            id=row["id"],
            key=row["key"],
            value=row["value"],
            category=row["category"],
            description=row.get("description"),
            is_public=row.get("is_public", True),
            updated_at=row["updated_at"],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
