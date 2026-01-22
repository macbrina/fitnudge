"""
Subscription Management Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from app.core.admin_auth import get_current_admin, log_admin_action
from app.core.database import get_supabase_client

router = APIRouter(prefix="/subscriptions", tags=["Subscription Management"])


class SubscriptionSummary(BaseModel):
    id: str
    user_id: str
    user_email: str | None
    plan_id: str
    status: str
    platform: str | None
    current_period_end: str | None
    created_at: str


class SubscriptionStats(BaseModel):
    total_subscriptions: int
    active_subscriptions: int
    by_plan: dict
    by_platform: dict
    by_status: dict
    mrr_estimate: float  # Monthly Recurring Revenue estimate


@router.get("/stats", response_model=SubscriptionStats)
async def get_subscription_stats(current_admin: dict = Depends(get_current_admin)):
    """
    Get subscription statistics and MRR
    """
    supabase = get_supabase_client()

    # Total subscriptions
    total_result = (
        supabase.table("subscriptions").select("id", count="exact").execute()
    )

    # Active subscriptions
    active_result = (
        supabase.table("subscriptions")
        .select("id", count="exact")
        .eq("status", "active")
        .execute()
    )

    # By plan
    premium_result = (
        supabase.table("subscriptions")
        .select("id", count="exact")
        .eq("plan_id", "premium")
        .eq("status", "active")
        .execute()
    )

    # By platform
    ios_result = (
        supabase.table("subscriptions")
        .select("id", count="exact")
        .eq("platform", "ios")
        .eq("status", "active")
        .execute()
    )

    android_result = (
        supabase.table("subscriptions")
        .select("id", count="exact")
        .eq("platform", "android")
        .eq("status", "active")
        .execute()
    )

    # By status
    cancelled_result = (
        supabase.table("subscriptions")
        .select("id", count="exact")
        .eq("status", "cancelled")
        .execute()
    )

    expired_result = (
        supabase.table("subscriptions")
        .select("id", count="exact")
        .eq("status", "expired")
        .execute()
    )

    # Get plan price for MRR calculation
    plan_result = (
        supabase.table("subscription_plans")
        .select("monthly_price")
        .eq("id", "premium")
        .execute()
    )

    monthly_price = 9.99  # Default
    if plan_result.data:
        monthly_price = float(plan_result.data[0].get("monthly_price", 9.99))

    active_count = active_result.count or 0
    mrr = active_count * monthly_price

    return SubscriptionStats(
        total_subscriptions=total_result.count or 0,
        active_subscriptions=active_count,
        by_plan={
            "premium": premium_result.count or 0,
            "free": (total_result.count or 0) - (premium_result.count or 0),
        },
        by_platform={
            "ios": ios_result.count or 0,
            "android": android_result.count or 0,
        },
        by_status={
            "active": active_count,
            "cancelled": cancelled_result.count or 0,
            "expired": expired_result.count or 0,
        },
        mrr_estimate=mrr,
    )


@router.get("")
async def list_subscriptions(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by status"),
    platform: Optional[str] = Query(None, description="Filter by platform"),
    current_admin: dict = Depends(get_current_admin),
):
    """
    List all subscriptions with pagination
    """
    supabase = get_supabase_client()

    # Build query - join with users to get email
    query = supabase.table("subscriptions").select(
        "id, user_id, plan_id, status, platform, current_period_end, created_at, "
        "users(email)",
        count="exact",
    )

    # Apply filters
    if status:
        query = query.eq("status", status)

    if platform:
        query = query.eq("platform", platform)

    # Pagination
    offset = (page - 1) * per_page
    query = query.order("created_at", desc=True).range(offset, offset + per_page - 1)

    result = query.execute()

    subscriptions = [
        {
            "id": s["id"],
            "user_id": s["user_id"],
            "user_email": s.get("users", {}).get("email") if s.get("users") else None,
            "plan_id": s["plan_id"],
            "status": s["status"],
            "platform": s.get("platform"),
            "current_period_end": s.get("current_period_end"),
            "created_at": s["created_at"],
        }
        for s in result.data
    ]

    return {
        "subscriptions": subscriptions,
        "total": result.count or len(subscriptions),
        "page": page,
        "per_page": per_page,
    }


@router.get("/{subscription_id}")
async def get_subscription(
    subscription_id: str, current_admin: dict = Depends(get_current_admin)
):
    """
    Get subscription details
    """
    supabase = get_supabase_client()

    result = (
        supabase.table("subscriptions")
        .select("*, users(id, email, display_name)")
        .eq("id", subscription_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription not found",
        )

    return result.data[0]


@router.post("/{subscription_id}/cancel")
async def cancel_subscription(
    subscription_id: str,
    immediate: bool = Query(False, description="Cancel immediately vs at period end"),
    current_admin: dict = Depends(get_current_admin),
):
    """
    Cancel a subscription
    """
    supabase = get_supabase_client()

    update_data = {
        "status": "cancelled" if immediate else "active",
        "cancel_at_period_end": not immediate,
    }

    result = (
        supabase.table("subscriptions")
        .update(update_data)
        .eq("id", subscription_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription not found",
        )

    # Log admin action
    await log_admin_action(
        admin_user_id=current_admin["id"],
        action="cancel_subscription",
        resource_type="subscription",
        resource_id=subscription_id,
        details={"immediate": immediate},
    )

    return {
        "message": "Subscription cancelled",
        "immediate": immediate,
    }


@router.post("/grant")
async def grant_subscription(
    user_id: str,
    plan_id: str = "premium",
    days: int = Query(30, ge=1, le=365),
    current_admin: dict = Depends(get_current_admin),
):
    """
    Grant a subscription to a user (e.g., for support, promotions)
    """
    supabase = get_supabase_client()

    from datetime import timezone

    now = datetime.now(timezone.utc)
    period_end = now + timedelta(days=days)

    # Check if user exists
    user_result = supabase.table("users").select("id").eq("id", user_id).execute()
    if not user_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Create or update subscription
    subscription_data = {
        "user_id": user_id,
        "plan_id": plan_id,
        "status": "active",
        "platform": "admin_granted",
        "current_period_start": now.isoformat(),
        "current_period_end": period_end.isoformat(),
    }

    # Upsert subscription
    result = (
        supabase.table("subscriptions")
        .upsert(subscription_data, on_conflict="user_id")
        .execute()
    )

    # Update user's subscription_plan
    supabase.table("users").update({"subscription_plan": plan_id}).eq(
        "id", user_id
    ).execute()

    # Log admin action
    await log_admin_action(
        admin_user_id=current_admin["id"],
        action="grant_subscription",
        resource_type="subscription",
        resource_id=user_id,
        details={"plan_id": plan_id, "days": days},
    )

    return {
        "message": f"Granted {days} days of {plan_id} to user",
        "user_id": user_id,
        "expires_at": period_end.isoformat(),
    }
