"""
Data Export Requests Endpoints (GDPR)
List and monitor data export requests; request on behalf of user; retry failed exports.
All admin logic lives in admin-api (no calls to main API).
Uses Celery task - response returns immediately; export runs in admin-api worker.
"""

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.admin_auth import get_current_admin
from app.core.celery_client import celery_app
from app.core.database import get_supabase_client, first_row

router = APIRouter(prefix="/data-export", tags=["Data Export"])


class DataExportRequestPayload(BaseModel):
    email: str


class DataExportRequestResponse(BaseModel):
    success: bool
    message: str
    export_id: Optional[str] = None


class DataExportItem(BaseModel):
    id: str
    user_id: str
    email: str
    status: str
    error_message: Optional[str]
    download_url: Optional[str]
    expires_at: Optional[str]
    created_at: str
    completed_at: Optional[str]


class DataExportListResponse(BaseModel):
    items: List[DataExportItem]
    total: int
    page: int
    per_page: int


@router.get("", response_model=DataExportListResponse)
async def list_data_export_requests(
    current_admin: dict = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    status: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
):
    """
    List data export requests with filters.
    """
    supabase = get_supabase_client()

    query = (
        supabase.table("data_export_requests")
        .select(
            "id, user_id, email, status, error_message, "
            "download_url, expires_at, created_at, completed_at",
            count="exact",
        )
    )

    if status:
        query = query.eq("status", status)
    if user_id:
        query = query.eq("user_id", user_id)

    query = query.order("created_at", desc=True)

    offset = (page - 1) * per_page
    result = query.range(offset, offset + per_page - 1).execute()

    total = result.count or 0
    rows = result.data or []

    items = [
        DataExportItem(
            id=row["id"],
            user_id=row["user_id"],
            email=row["email"],
            status=row["status"],
            error_message=row.get("error_message"),
            download_url=row.get("download_url"),
            expires_at=row.get("expires_at"),
            created_at=row["created_at"],
            completed_at=row.get("completed_at"),
        )
        for row in rows
    ]

    return DataExportListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/{export_id}", response_model=DataExportItem)
async def get_data_export_request(
    export_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Get a single data export request by ID.
    """
    supabase = get_supabase_client()

    result = (
        supabase.table("data_export_requests")
        .select(
            "id, user_id, email, status, error_message, "
            "download_url, expires_at, created_at, completed_at"
        )
        .eq("id", export_id)
        .maybe_single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Export request not found")

    row = result.data
    return DataExportItem(
        id=row["id"],
        user_id=row["user_id"],
        email=row["email"],
        status=row["status"],
        error_message=row.get("error_message"),
        download_url=row.get("download_url"),
        expires_at=row.get("expires_at"),
        created_at=row["created_at"],
        completed_at=row.get("completed_at"),
    )


@router.post("/request", response_model=DataExportRequestResponse)
async def request_data_export_for_user(
    payload: DataExportRequestPayload,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Request a data export on behalf of a user.
    Creates the export record and runs the background task to send to user's email.
    Admin bypasses the 24h rate limit that applies to user self-requests.
    """
    supabase = get_supabase_client()
    email = payload.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    user_result = (
        supabase.table("users")
        .select("id, email")
        .eq("email", email)
        .maybe_single()
        .execute()
    )
    user_row = first_row(user_result.data)
    if not user_row or not user_row.get("id"):
        raise HTTPException(status_code=404, detail="User not found")

    user_id = user_row["id"]

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    existing = (
        supabase.table("data_export_requests")
        .select("id")
        .eq("user_id", user_id)
        .eq("status", "failed")
        .gte("created_at", today_start)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if existing.data:
        row = first_row(existing.data)
        export_id = row["id"]
        supabase.table("data_export_requests").update(
            {"status": "pending", "error_message": None, "completed_at": None}
        ).eq("id", export_id).execute()
    else:
        export_result = (
            supabase.table("data_export_requests")
            .insert({"user_id": user_id, "status": "pending", "email": email})
            .execute()
        )
        if not export_result.data:
            raise HTTPException(status_code=500, detail="Failed to create export request")
        export_id = first_row(export_result.data)["id"]
    celery_app.send_task(
        "admin.generate_user_data_export",
        args=[user_id, email, export_id],
    )

    return DataExportRequestResponse(
        success=True,
        message="Data export initiated. The user will receive an email with their data shortly.",
        export_id=export_id,
    )


@router.post("/{export_id}/retry")
async def retry_data_export(
    export_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Retry a failed data export.
    Runs export generation in admin-api (no dependency on main API).
    """
    supabase = get_supabase_client()

    result = (
        supabase.table("data_export_requests")
        .select("id, user_id, email, status")
        .eq("id", export_id)
        .maybe_single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Export request not found")

    row = result.data
    if row["status"] not in ("failed", "pending"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot retry export with status: {row['status']}",
        )

    user_id = row["user_id"]
    email = row["email"]

    celery_app.send_task(
        "admin.generate_user_data_export",
        args=[user_id, email, export_id],
    )

    return {"message": "Retry initiated", "export_id": export_id}
