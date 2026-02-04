"""
Referrals Management Endpoints
List and monitor referral activity.
"""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Optional, List

from app.core.admin_auth import get_current_admin
from app.core.database import get_supabase_client

router = APIRouter(prefix="/referrals", tags=["Referrals"])


class ReferralItem(BaseModel):
    id: str
    referrer_user_id: str
    referrer_email: Optional[str]
    referred_user_id: str
    referred_email: Optional[str]
    status: str
    bonus_days_referrer: int
    bonus_days_referred: int
    rewarded_at: Optional[str]
    created_at: str
    updated_at: str


class ReferralsListResponse(BaseModel):
    items: List[ReferralItem]
    total: int
    page: int
    per_page: int


@router.get("", response_model=ReferralsListResponse)
async def list_referrals(
    current_admin: dict = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    status: Optional[str] = Query(None),
    referrer_user_id: Optional[str] = Query(None),
    referred_user_id: Optional[str] = Query(None),
):
    """
    List referrals with filters.
    Join with users to include referrer and referred emails.
    """
    supabase = get_supabase_client()

    query = (
        supabase.table("referrals")
        .select(
            "id, referrer_user_id, referred_user_id, status, "
            "bonus_days_referrer, bonus_days_referred, rewarded_at, "
            "created_at, updated_at",
            count="exact",
        )
    )

    if status:
        query = query.eq("status", status)
    if referrer_user_id:
        query = query.eq("referrer_user_id", referrer_user_id)
    if referred_user_id:
        query = query.eq("referred_user_id", referred_user_id)

    query = query.order("created_at", desc=True)

    offset = (page - 1) * per_page
    result = query.range(offset, offset + per_page - 1).execute()

    total = result.count or 0
    rows = result.data or []

    # Fetch user emails
    user_ids = set()
    for r in rows:
        user_ids.add(r["referrer_user_id"])
        user_ids.add(r["referred_user_id"])

    emails_map: dict = {}
    if user_ids:
        users_result = (
            supabase.table("users")
            .select("id, email")
            .in_("id", list(user_ids))
            .execute()
        )
        for u in users_result.data or []:
            emails_map[u["id"]] = u.get("email")

    items = [
        ReferralItem(
            id=row["id"],
            referrer_user_id=row["referrer_user_id"],
            referrer_email=emails_map.get(row["referrer_user_id"]),
            referred_user_id=row["referred_user_id"],
            referred_email=emails_map.get(row["referred_user_id"]),
            status=row["status"],
            bonus_days_referrer=row.get("bonus_days_referrer", 7),
            bonus_days_referred=row.get("bonus_days_referred", 7),
            rewarded_at=row.get("rewarded_at"),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
        for row in rows
    ]

    return ReferralsListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
    )
