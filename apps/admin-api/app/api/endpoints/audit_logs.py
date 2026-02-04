"""
Audit Logs Endpoints
List admin actions for audit trail
"""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from app.core.admin_auth import get_current_admin
from app.core.database import get_supabase_client

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


class AuditLogItem(BaseModel):
    id: str
    admin_user_id: Optional[str]
    admin_email: Optional[str]
    action: str
    resource_type: str
    resource_id: Optional[str]
    old_values: Optional[dict]
    new_values: Optional[dict]
    created_at: str


class AuditLogsListResponse(BaseModel):
    items: List[AuditLogItem]
    total: int
    page: int
    per_page: int


@router.get("", response_model=AuditLogsListResponse)
async def list_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin_user_id: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    current_admin: dict = Depends(get_current_admin),
):
    """
    List audit logs with pagination and filters.
    """
    supabase = get_supabase_client()

    query = supabase.table("audit_logs").select("id, admin_user_id, action, resource_type, resource_id, old_values, new_values, created_at", count="exact")

    if admin_user_id:
        query = query.eq("admin_user_id", admin_user_id)
    if resource_type:
        query = query.eq("resource_type", resource_type)
    if action:
        query = query.ilike("action", f"%{action}%")
    if from_date:
        query = query.gte("created_at", from_date)
    if to_date:
        query = query.lte("created_at", to_date)

    query = query.order("created_at", desc=True)
    offset = (page - 1) * per_page
    query = query.range(offset, offset + per_page - 1)

    result = query.execute()

    items_data = result.data or []
    total = result.count or 0

    # Fetch admin emails for unique admin_user_ids
    admin_ids = list({r["admin_user_id"] for r in items_data if r.get("admin_user_id")})
    admin_emails: dict[str, str] = {}
    if admin_ids:
        users_result = (
            supabase.table("users")
            .select("id, email")
            .in_("id", admin_ids)
            .execute()
        )
        for u in users_result.data or []:
            admin_emails[u["id"]] = u.get("email", "")

    items = [
        AuditLogItem(
            id=r["id"],
            admin_user_id=r.get("admin_user_id"),
            admin_email=admin_emails.get(r["admin_user_id"]) if r.get("admin_user_id") else None,
            action=r["action"],
            resource_type=r["resource_type"],
            resource_id=str(r["resource_id"]) if r.get("resource_id") else None,
            old_values=r.get("old_values"),
            new_values=r.get("new_values"),
            created_at=r["created_at"],
        )
        for r in items_data
    ]

    return AuditLogsListResponse(items=items, total=total, page=page, per_page=per_page)
