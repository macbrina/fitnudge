"""
Broadcasts (Admin Notifications) CRUD
Manage in-app modals and push broadcasts
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from typing import Optional, List, Any
from app.core.admin_auth import get_current_admin, log_admin_action
from app.core.database import get_supabase_client, first_row

router = APIRouter(prefix="/broadcasts", tags=["Broadcasts"])


class BroadcastCreate(BaseModel):
    title: str
    body: str
    image_url: Optional[str] = None
    cta_label: Optional[str] = None
    cta_url: Optional[str] = None
    deeplink: Optional[str] = None
    source_lang: str = "en"
    translations: Optional[dict] = None
    is_active: bool = True
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    audience: str = "all"
    delivery: str = "in_app"


class BroadcastUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    image_url: Optional[str] = None
    cta_label: Optional[str] = None
    cta_url: Optional[str] = None
    deeplink: Optional[str] = None
    source_lang: Optional[str] = None
    translations: Optional[dict] = None
    is_active: Optional[bool] = None
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    audience: Optional[str] = None
    delivery: Optional[str] = None


class BroadcastItem(BaseModel):
    id: str
    title: str
    body: str
    image_url: Optional[str]
    cta_label: Optional[str]
    cta_url: Optional[str]
    deeplink: Optional[str]
    source_lang: str
    translations: Optional[dict]
    is_active: bool
    starts_at: Optional[str]
    ends_at: Optional[str]
    audience: str
    delivery: str
    created_at: str
    updated_at: str


class BroadcastsListResponse(BaseModel):
    items: List[BroadcastItem]
    total: int


@router.get("", response_model=BroadcastsListResponse)
async def list_broadcasts(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    is_active: Optional[bool] = Query(None),
    audience: Optional[str] = Query(None),
    delivery: Optional[str] = Query(None),
    current_admin: dict = Depends(get_current_admin),
):
    """List broadcasts with pagination and filters."""
    supabase = get_supabase_client()

    query = supabase.table("notifications").select(
        "id, title, body, image_url, cta_label, cta_url, deeplink, source_lang, translations, is_active, starts_at, ends_at, audience, delivery, created_at, updated_at",
        count="exact",
    )

    if is_active is not None:
        query = query.eq("is_active", is_active)
    if audience:
        query = query.eq("audience", audience)
    if delivery:
        query = query.eq("delivery", delivery)

    query = query.order("created_at", desc=True)
    offset = (page - 1) * per_page
    query = query.range(offset, offset + per_page - 1)

    result = query.execute()
    items_data = result.data or []
    total = result.count or 0

    items = [
        BroadcastItem(
            id=r["id"],
            title=r["title"],
            body=r["body"],
            image_url=r.get("image_url"),
            cta_label=r.get("cta_label"),
            cta_url=r.get("cta_url"),
            deeplink=r.get("deeplink"),
            source_lang=r.get("source_lang", "en"),
            translations=r.get("translations"),
            is_active=r.get("is_active", True),
            starts_at=r.get("starts_at"),
            ends_at=r.get("ends_at"),
            audience=r.get("audience", "all"),
            delivery=r.get("delivery", "in_app"),
            created_at=r["created_at"],
            updated_at=r["updated_at"],
        )
        for r in items_data
    ]

    return BroadcastsListResponse(items=items, total=total, page=page, per_page=per_page)


@router.get("/{broadcast_id}", response_model=BroadcastItem)
async def get_broadcast(
    broadcast_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """Get single broadcast by ID."""
    supabase = get_supabase_client()
    result = (
        supabase.table("notifications")
        .select("*")
        .eq("id", broadcast_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    r = first_row(result.data)
    return BroadcastItem(
        id=r["id"],
        title=r["title"],
        body=r["body"],
        image_url=r.get("image_url"),
        cta_label=r.get("cta_label"),
        cta_url=r.get("cta_url"),
        deeplink=r.get("deeplink"),
        source_lang=r.get("source_lang", "en"),
        translations=r.get("translations"),
        is_active=r.get("is_active", True),
        starts_at=r.get("starts_at"),
        ends_at=r.get("ends_at"),
        audience=r.get("audience", "all"),
        delivery=r.get("delivery", "in_app"),
        created_at=r["created_at"],
        updated_at=r["updated_at"],
    )


@router.post("", response_model=BroadcastItem)
async def create_broadcast(
    payload: BroadcastCreate,
    current_admin: dict = Depends(get_current_admin),
):
    """Create a new broadcast."""
    supabase = get_supabase_client()

    insert_data = {
        "title": payload.title,
        "body": payload.body,
        "image_url": payload.image_url,
        "cta_label": payload.cta_label,
        "cta_url": payload.cta_url,
        "deeplink": payload.deeplink,
        "source_lang": payload.source_lang,
        "translations": payload.translations,
        "is_active": payload.is_active,
        "starts_at": payload.starts_at,
        "ends_at": payload.ends_at,
        "audience": payload.audience,
        "delivery": payload.delivery,
    }

    result = supabase.table("notifications").insert(insert_data).select("*").execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create broadcast")

    try:
        r = first_row(result.data)

        await log_admin_action(
            admin_user_id=current_admin["id"],
            action="create",
            resource_type="broadcast",
            resource_id=r["id"],
            details=insert_data,
        )

        return BroadcastItem(
            id=r["id"],
            title=r["title"],
            body=r["body"],
            image_url=r.get("image_url"),
            cta_label=r.get("cta_label"),
            cta_url=r.get("cta_url"),
            deeplink=r.get("deeplink"),
            source_lang=r.get("source_lang", "en"),
            translations=r.get("translations"),
            is_active=r.get("is_active", True),
            starts_at=r.get("starts_at"),
            ends_at=r.get("ends_at"),
            audience=r.get("audience", "all"),
            delivery=r.get("delivery", "in_app"),
            created_at=r["created_at"],
            updated_at=r["updated_at"],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{broadcast_id}", response_model=BroadcastItem)
async def update_broadcast(
    broadcast_id: str,
    payload: BroadcastUpdate,
    current_admin: dict = Depends(get_current_admin),
):
    """Update a broadcast."""
    supabase = get_supabase_client()

    existing = (
        supabase.table("notifications")
        .select("*")
        .eq("id", broadcast_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Broadcast not found")

    try:
        update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}

        if not update_data:
            r = first_row(existing.data)
            return BroadcastItem(
                id=r["id"],
                title=r["title"],
                body=r["body"],
                image_url=r.get("image_url"),
                cta_label=r.get("cta_label"),
                cta_url=r.get("cta_url"),
                deeplink=r.get("deeplink"),
                source_lang=r.get("source_lang", "en"),
                translations=r.get("translations"),
                is_active=r.get("is_active", True),
                starts_at=r.get("starts_at"),
                ends_at=r.get("ends_at"),
                audience=r.get("audience", "all"),
                delivery=r.get("delivery", "in_app"),
                created_at=r["created_at"],
                updated_at=r["updated_at"],
            )

        result = (
            supabase.table("notifications")
            .update(update_data)
            .eq("id", broadcast_id)
            .select("*")
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update broadcast")

        r = first_row(result.data)

        await log_admin_action(
            admin_user_id=current_admin["id"],
            action="update",
            resource_type="broadcast",
            resource_id=broadcast_id,
            details=update_data,
        )

        return BroadcastItem(
            id=r["id"],
            title=r["title"],
            body=r["body"],
            image_url=r.get("image_url"),
            cta_label=r.get("cta_label"),
            cta_url=r.get("cta_url"),
            deeplink=r.get("deeplink"),
            source_lang=r.get("source_lang", "en"),
            translations=r.get("translations"),
            is_active=r.get("is_active", True),
            starts_at=r.get("starts_at"),
            ends_at=r.get("ends_at"),
            audience=r.get("audience", "all"),
            delivery=r.get("delivery", "in_app"),
            created_at=r["created_at"],
            updated_at=r["updated_at"],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{broadcast_id}")
async def delete_broadcast(
    broadcast_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """Delete a broadcast. Cascades to notification_history."""
    supabase = get_supabase_client()

    result = (
        supabase.table("notifications")
        .delete()
        .eq("id", broadcast_id)
        .execute()
    )

    # Supabase delete returns empty data on success
    await log_admin_action(
        admin_user_id=current_admin["id"],
        action="delete",
        resource_type="broadcast",
        resource_id=broadcast_id,
    )

    return {"message": "Broadcast deleted"}
