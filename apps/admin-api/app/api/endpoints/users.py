"""
User Management Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from app.core.admin_auth import get_current_admin, log_admin_action
from app.core.database import get_supabase_client, first_row

router = APIRouter(prefix="/users", tags=["User Management"])


def _subscription_source_from_platform(platform: str | None) -> str | None:
    """Derive subscription source from subscriptions.platform for display."""
    if not platform:
        return None
    if platform in ("ios", "android"):
        return "paid"
    if platform == "admin_granted":
        return "admin"
    if platform == "promo":
        return "promo"
    if platform == "web":
        return "paid"  # Web purchases
    return None


class UserSummary(BaseModel):
    id: str
    email: str
    display_name: str | None
    role: str
    status: str
    subscription_plan: str | None
    subscription_source: str | None = None  # paid, admin, promo
    created_at: str
    last_active_at: str | None


class UserDetail(BaseModel):
    id: str
    email: str
    display_name: str | None
    role: str
    status: str
    subscription_plan: str | None
    subscription_source: str | None = None  # paid, admin, promo
    timezone: str | None
    created_at: str
    updated_at: str | None
    last_active_at: str | None
    onboarding_completed: bool
    total_goals: int | None = None
    total_checkins: int | None = None


class UserUpdate(BaseModel):
    status: Optional[str] = None
    role: Optional[str] = None
    display_name: Optional[str] = None


class UsersListResponse(BaseModel):
    users: List[UserSummary]
    total: int
    page: int
    per_page: int


@router.get("", response_model=UsersListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by email or name"),
    status: Optional[str] = Query(None, description="Filter by status"),
    role: Optional[str] = Query(None, description="Filter by role"),
    sort_by: Optional[str] = Query(
        "created_at",
        description="Sort by: created_at, last_active_at, email",
    ),
    sort_order: Optional[str] = Query("desc", description="Sort order: asc or desc"),
    current_admin: dict = Depends(get_current_admin),
):
    """
    List all users with pagination and filtering
    """
    supabase = get_supabase_client()

    # Build query (DB columns: name, plan; API exposes as display_name, subscription_plan)
    query = supabase.table("users").select(
        "id, email, name, role, status, plan, created_at, last_active_at",
        count="exact",
    )

    # Apply filters (search by email, name, username)
    if search:
        query = query.or_(f"email.ilike.%{search}%,name.ilike.%{search}%,username.ilike.%{search}%")

    if status:
        query = query.eq("status", status)

    if role:
        query = query.eq("role", role)

    # Sort (map API fields to DB columns: subscription_plan -> plan, display_name -> name)
    sort_column = sort_by
    if sort_column == "subscription_plan":
        sort_column = "plan"
    if sort_column == "display_name":
        sort_column = "name"
    if sort_column not in ("created_at", "last_active_at", "email", "plan", "name", "status", "role"):
        sort_column = "created_at"
    desc = (sort_order or "desc").lower() == "desc"
    query = query.order(sort_column, desc=desc)

    # Pagination
    offset = (page - 1) * per_page
    query = query.range(offset, offset + per_page - 1)

    result = query.execute()

    # Fetch subscription platform for premium users to derive source
    user_ids = [u["id"] for u in result.data]
    subs_result = (
        supabase.table("subscriptions")
        .select("user_id, platform")
        .in_("user_id", user_ids)
        .eq("status", "active")
        .execute()
    )
    platform_by_user = {
        s["user_id"]: s.get("platform") for s in (subs_result.data or [])
    }

    users = [
        UserSummary(
            id=u["id"],
            email=u["email"],
            display_name=u.get("name"),
            role=u["role"],
            status=u["status"],
            subscription_plan=u.get("plan"),
            subscription_source=_subscription_source_from_platform(
                platform_by_user.get(u["id"])
            )
            if u.get("plan") == "premium"
            else None,
            created_at=u["created_at"],
            last_active_at=u.get("last_active_at"),
        )
        for u in result.data
    ]

    return UsersListResponse(
        users=users,
        total=result.count or len(users),
        page=page,
        per_page=per_page,
    )


@router.get("/stats")
async def get_user_stats(current_admin: dict = Depends(get_current_admin)):
    """
    Get user statistics overview
    """
    supabase = get_supabase_client()

    # Total users
    total_result = supabase.table("users").select("id", count="exact").execute()

    # By status
    active_result = (
        supabase.table("users")
        .select("id", count="exact")
        .eq("status", "active")
        .execute()
    )
    disabled_result = (
        supabase.table("users")
        .select("id", count="exact")
        .eq("status", "disabled")
        .execute()
    )
    suspended_result = (
        supabase.table("users")
        .select("id", count="exact")
        .eq("status", "suspended")
        .execute()
    )

    # By role
    admin_result = (
        supabase.table("users")
        .select("id", count="exact")
        .eq("role", "admin")
        .execute()
    )

    # By subscription (DB column: plan)
    premium_result = (
        supabase.table("users")
        .select("id", count="exact")
        .eq("plan", "premium")
        .execute()
    )

    return {
        "total": total_result.count or 0,
        "by_status": {
            "active": active_result.count or 0,
            "disabled": disabled_result.count or 0,
            "suspended": suspended_result.count or 0,
        },
        "by_role": {
            "admin": admin_result.count or 0,
            "user": (total_result.count or 0) - (admin_result.count or 0),
        },
        "by_subscription": {
            "premium": premium_result.count or 0,
            "free": (total_result.count or 0) - (premium_result.count or 0),
        },
    }


@router.get("/{user_id}", response_model=UserDetail)
async def get_user(user_id: str, current_admin: dict = Depends(get_current_admin)):
    """
    Get detailed user information
    """
    supabase = get_supabase_client()

    # Get user (DB: name, plan, onboarding_completed_at)
    result = (
        supabase.table("users")
        .select(
            "id, email, name, role, status, plan, "
            "timezone, created_at, updated_at, last_active_at, onboarding_completed_at"
        )
        .eq("id", user_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user = first_row(result.data)

    # Get active subscription platform for source (paid/admin/promo)
    sub_result = (
        supabase.table("subscriptions")
        .select("platform")
        .eq("user_id", user_id)
        .eq("status", "active")
        .maybe_single()
        .execute()
    )
    sub_row = sub_result.data
    if isinstance(sub_row, list):
        sub_row = sub_row[0] if sub_row else None
    sub_platform = sub_row.get("platform") if sub_row else None
    subscription_source = (
        _subscription_source_from_platform(sub_platform)
        if user.get("plan") == "premium"
        else None
    )

    # Get goal count
    goals_result = (
        supabase.table("goals")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .execute()
    )

    # Get check-in count (DB table: check_ins)
    checkins_result = (
        supabase.table("check_ins")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .execute()
    )

    return UserDetail(
        id=user["id"],
        email=user["email"],
        display_name=user.get("name"),
        role=user["role"],
        status=user["status"],
        subscription_plan=user.get("plan"),
        subscription_source=subscription_source,
        timezone=user.get("timezone"),
        created_at=user["created_at"],
        updated_at=user.get("updated_at"),
        last_active_at=user.get("last_active_at"),
        onboarding_completed=user.get("onboarding_completed_at") is not None,
        total_goals=goals_result.count,
        total_checkins=checkins_result.count,
    )


@router.patch("/{user_id}")
async def update_user(
    user_id: str,
    update: UserUpdate,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Update user properties (status, role, display_name)
    """
    supabase = get_supabase_client()

    # Build update data
    update_data = {}
    if update.status is not None:
        if update.status not in ["active", "disabled", "suspended"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status value",
            )
        update_data["status"] = update.status

    if update.role is not None:
        if update.role not in ["user", "admin"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role value",
            )
        update_data["role"] = update.role

    if update.display_name is not None:
        update_data["name"] = update.display_name

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid fields to update",
        )

    # Update user
    result = supabase.table("users").update(update_data).eq("id", user_id).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Log admin action
    await log_admin_action(
        admin_user_id=current_admin["id"],
        action="update_user",
        resource_type="user",
        resource_id=user_id,
        details=update_data,
    )

    return {"message": "User updated", "updated_fields": list(update_data.keys())}


@router.get("/{user_id}/goals")
async def get_user_goals(
    user_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Get user's goals
    """
    supabase = get_supabase_client()

    result = (
        supabase.table("goals")
        .select(
            "id, title, status, frequency_type, "
            "current_streak, longest_streak, total_completions, created_at"
        )
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    return {"user_id": user_id, "goals": result.data}


@router.get("/{user_id}/activity")
async def get_user_activity(
    user_id: str,
    limit: int = Query(50, ge=1, le=200),
    current_admin: dict = Depends(get_current_admin),
):
    """
    Get user's recent activity (checkins)
    """
    supabase = get_supabase_client()

    result = (
        supabase.table("check_ins")
        .select("id, goal_id, completed, check_in_date, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )

    return {"user_id": user_id, "activity": result.data}
