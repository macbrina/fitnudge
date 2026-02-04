"""
Subscription Deactivation Logs Endpoints
List and monitor subscription deactivation audit trail.
"""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.core.admin_auth import get_current_admin
from app.core.database import get_supabase_client

router = APIRouter(
    prefix="/subscription-deactivation-logs",
    tags=["Subscription Deactivation Logs"],
)


class DeactivationLogItem(BaseModel):
    id: str
    user_id: str
    user_email: Optional[str]
    previous_plan: str
    new_plan: str
    goals_deactivated: int
    deactivation_reason: str
    deactivated_goal_ids: Optional[list]
    created_at: str


class DeactivationLogsListResponse(BaseModel):
    items: List[DeactivationLogItem]
    total: int
    page: int
    per_page: int


@router.get("", response_model=DeactivationLogsListResponse)
async def list_deactivation_logs(
    current_admin: dict = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    user_id: Optional[str] = Query(None),
    reason: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None, description="ISO date YYYY-MM-DD"),
    to_date: Optional[str] = Query(None, description="ISO date YYYY-MM-DD"),
    export_csv: bool = Query(False),
):
    """
    List subscription deactivation logs with filters.
    Join with users to include email.
    """
    supabase = get_supabase_client()

    query = (
        supabase.table("subscription_deactivation_logs")
        .select(
            "id, user_id, previous_plan, new_plan, goals_deactivated, "
            "deactivation_reason, deactivated_goal_ids, created_at",
            count="exact",
        )
    )

    if user_id:
        query = query.eq("user_id", user_id)
    if reason:
        query = query.eq("deactivation_reason", reason)
    if from_date:
        query = query.gte("created_at", f"{from_date}T00:00:00Z")
    if to_date:
        query = query.lte("created_at", f"{to_date}T23:59:59Z")

    query = query.order("created_at", desc=True)

    if export_csv:
        # Return all matching for CSV export (limit 5000)
        result = query.range(0, 4999).execute()
    else:
        offset = (page - 1) * per_page
        result = query.range(offset, offset + per_page - 1).execute()

    total = result.count or 0
    rows = result.data or []

    # Fetch user emails for user_ids
    user_ids = list({r["user_id"] for r in rows})
    emails_map: dict = {}
    if user_ids:
        users_result = (
            supabase.table("users")
            .select("id, email")
            .in_("id", user_ids)
            .execute()
        )
        for u in users_result.data or []:
            emails_map[u["id"]] = u.get("email")

    items = [
        DeactivationLogItem(
            id=row["id"],
            user_id=row["user_id"],
            user_email=emails_map.get(row["user_id"]),
            previous_plan=row["previous_plan"],
            new_plan=row["new_plan"],
            goals_deactivated=row.get("goals_deactivated", 0),
            deactivation_reason=row["deactivation_reason"],
            deactivated_goal_ids=row.get("deactivated_goal_ids"),
            created_at=row["created_at"],
        )
        for row in rows
    ]

    return DeactivationLogsListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page if not export_csv else len(items),
    )
