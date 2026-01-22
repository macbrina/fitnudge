"""
Subscription Plans API endpoints
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.core.database import get_supabase_client
from app.services.logger import logger

router = APIRouter(
    redirect_slashes=False
)  # Disable redirects to preserve Authorization header


# Pydantic models
class PlanFeature(BaseModel):
    id: str
    feature_key: str
    feature_name: str
    feature_description: str | None
    feature_value: int | None
    is_enabled: bool
    sort_order: int
    minimum_tier: int = 0  # 0=free, 1=premium


class SubscriptionPlan(BaseModel):
    id: str
    name: str
    description: str
    monthly_price: float
    annual_price: float
    active_goal_limit: int | None  # None means unlimited
    features: List[PlanFeature]
    is_popular: bool
    has_trial: bool
    trial_days: int | None
    is_active: bool
    sort_order: int
    # App Store and Play Store product IDs
    product_id_ios_monthly: str | None = None
    product_id_ios_annual: str | None = None
    product_id_android_monthly: str | None = None
    product_id_android_annual: str | None = None
    # Exit-offer fields (optional)
    exit_offer_enabled: bool | None = None
    exit_offer_monthly_price: float | None = None
    exit_offer_annual_price: float | None = None


class SubscriptionPlansResponse(BaseModel):
    plans: List[SubscriptionPlan]


@router.get("/plans", response_model=SubscriptionPlansResponse)
async def get_subscription_plans(
    supabase=Depends(get_supabase_client),
):
    """Get all active subscription plans with their features"""
    try:
        # Get plans
        plans_result = (
            supabase.table("subscription_plans")
            .select("*")
            .eq("is_active", True)
            .order("sort_order")
            .execute()
        )

        if not plans_result.data:
            logger.warning("No subscription plans found")
            return SubscriptionPlansResponse(plans=[])

        # Get features for all plans
        plan_ids = [plan["id"] for plan in plans_result.data]
        features_result = (
            supabase.table("plan_features")
            .select("*")
            .in_("plan_id", plan_ids)
            .eq("is_enabled", True)
            .order("plan_id, sort_order")
            .execute()
        )

        # Group features by plan_id
        features_by_plan = {}
        for feature in features_result.data:
            plan_id = feature["plan_id"]
            if plan_id not in features_by_plan:
                features_by_plan[plan_id] = []
            features_by_plan[plan_id].append(PlanFeature(**feature))

        # Build final plans with features
        plans = []
        for plan_data in plans_result.data:
            plan_id = plan_data["id"]
            plan_features = features_by_plan.get(plan_id, [])

            plan = SubscriptionPlan(**plan_data, features=plan_features)
            plans.append(plan)

        return SubscriptionPlansResponse(plans=plans)

    except Exception as e:
        logger.error(f"Error retrieving subscription plans: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve subscription plans",
        )


@router.get("/plans/{plan_id}", response_model=SubscriptionPlan)
async def get_subscription_plan(
    plan_id: str,
    supabase=Depends(get_supabase_client),
):
    """Get a specific subscription plan by ID with its features"""
    try:
        # Get plan
        plan_result = (
            supabase.table("subscription_plans")
            .select("*")
            .eq("id", plan_id)
            .eq("is_active", True)
            .execute()
        )

        if not plan_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subscription plan not found",
            )

        # Get features for this plan
        features_result = (
            supabase.table("plan_features")
            .select("*")
            .eq("plan_id", plan_id)
            .eq("is_enabled", True)
            .order("sort_order")
            .execute()
        )

        # Convert features to PlanFeature objects
        features = [PlanFeature(**feature) for feature in features_result.data]

        # Build final plan with features
        plan_data = plan_result.data[0]
        plan = SubscriptionPlan(**plan_data, features=features)

        return plan

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving subscription plan {plan_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve subscription plan",
        )
