"""
Subscription Plans Management Endpoints
CRUD for subscription_plans table.
"""

from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from app.core.admin_auth import get_current_admin, log_admin_action
from app.core.database import get_supabase_client, first_row

router = APIRouter(prefix="/subscription-plans", tags=["Subscription Plans"])


class SubscriptionPlanItem(BaseModel):
    id: str
    name: str
    description: Optional[str]
    monthly_price: float
    annual_price: float
    active_goal_limit: int
    tier: int
    is_popular: bool
    has_trial: bool
    trial_days: Optional[int]
    is_active: bool
    sort_order: int
    product_id_ios_monthly: Optional[str]
    product_id_ios_annual: Optional[str]
    product_id_android_monthly: Optional[str]
    product_id_android_annual: Optional[str]
    exit_offer_enabled: bool
    exit_offer_monthly_price: Optional[float]
    exit_offer_annual_price: Optional[float]
    created_at: str
    updated_at: str


class SubscriptionPlanListResponse(BaseModel):
    items: List[SubscriptionPlanItem]


class SubscriptionPlanUpdatePayload(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    monthly_price: Optional[float] = None
    annual_price: Optional[float] = None
    active_goal_limit: Optional[int] = None
    tier: Optional[int] = None
    is_popular: Optional[bool] = None
    has_trial: Optional[bool] = None
    trial_days: Optional[int] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    product_id_ios_monthly: Optional[str] = None
    product_id_ios_annual: Optional[str] = None
    product_id_android_monthly: Optional[str] = None
    product_id_android_annual: Optional[str] = None
    exit_offer_enabled: Optional[bool] = None
    exit_offer_monthly_price: Optional[float] = None
    exit_offer_annual_price: Optional[float] = None


def _decimal_to_float(v) -> float:
    if v is None:
        return 0.0
    if isinstance(v, Decimal):
        return float(v)
    return float(v)


def _row_to_plan(row: dict) -> SubscriptionPlanItem:
    return SubscriptionPlanItem(
        id=row["id"],
        name=row["name"],
        description=row.get("description"),
        monthly_price=_decimal_to_float(row.get("monthly_price", 0)),
        annual_price=_decimal_to_float(row.get("annual_price", 0)),
        active_goal_limit=row.get("active_goal_limit", 1),
        tier=row.get("tier", 0),
        is_popular=row.get("is_popular", False),
        has_trial=row.get("has_trial", False),
        trial_days=row.get("trial_days"),
        is_active=row.get("is_active", True),
        sort_order=row.get("sort_order", 0),
        product_id_ios_monthly=row.get("product_id_ios_monthly"),
        product_id_ios_annual=row.get("product_id_ios_annual"),
        product_id_android_monthly=row.get("product_id_android_monthly"),
        product_id_android_annual=row.get("product_id_android_annual"),
        exit_offer_enabled=row.get("exit_offer_enabled", False),
        exit_offer_monthly_price=(
            _decimal_to_float(row.get("exit_offer_monthly_price"))
            if row.get("exit_offer_monthly_price") is not None
            else None
        ),
        exit_offer_annual_price=(
            _decimal_to_float(row.get("exit_offer_annual_price"))
            if row.get("exit_offer_annual_price") is not None
            else None
        ),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.get("", response_model=SubscriptionPlanListResponse)
async def list_subscription_plans(
    current_admin: dict = Depends(get_current_admin),
):
    """
    List all subscription plans.
    """
    supabase = get_supabase_client()

    result = (
        supabase.table("subscription_plans")
        .select("*")
        .order("sort_order")
        .order("id")
        .execute()
    )

    items = [_row_to_plan(row) for row in (result.data or [])]
    return SubscriptionPlanListResponse(items=items)


@router.get("/{plan_id}", response_model=SubscriptionPlanItem)
async def get_subscription_plan(
    plan_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Get a single subscription plan by ID.
    """
    supabase = get_supabase_client()

    result = (
        supabase.table("subscription_plans")
        .select("*")
        .eq("id", plan_id)
        .maybe_single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Plan not found")

    return _row_to_plan(result.data)


@router.put("/{plan_id}", response_model=SubscriptionPlanItem)
async def update_subscription_plan(
    plan_id: str,
    payload: SubscriptionPlanUpdatePayload,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Update a subscription plan. Audited.
    """
    supabase = get_supabase_client()

    existing = (
        supabase.table("subscription_plans")
        .select("*")
        .eq("id", plan_id)
        .maybe_single()
        .execute()
    )

    if not existing.data:
        raise HTTPException(status_code=404, detail="Plan not found")

    try:
        # maybe_single() returns the row directly (dict), not a list
        old_row = existing.data
        update_data = payload.model_dump(exclude_unset=True)

        if not update_data:
            return _row_to_plan(old_row)

        result = (
            supabase.table("subscription_plans")
            .update(update_data)
            .eq("id", plan_id)
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=500, detail="Update failed")

        await log_admin_action(
            admin_user_id=current_admin["id"],
            action="update",
            resource_type="subscription_plan",
            resource_id=plan_id,
            details={
                "old_values": {k: old_row.get(k) for k in update_data},
                "new_values": update_data,
            },
        )

        return _row_to_plan(first_row(result.data))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
