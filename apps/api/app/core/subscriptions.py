"""
Subscription helper utilities for consistent plan and feature checking.

This module provides centralized functions to:
- Get user's effective plan (subscription or users.plan fallback)
- Get plan tier for feature access checking
- Query features based on tier inheritance
"""

from typing import Optional, Dict, Any
from app.core.database import get_supabase_client


def get_user_effective_plan(
    user_id: str, user_plan: Optional[str] = None, supabase=None
) -> str:
    """
    Get user's effective plan (active subscription OR users.plan fallback).

    This is the canonical way to determine a user's plan:
    - Check for active paid subscription first
    - Fall back to users.plan (defaults to 'free')

    Args:
        user_id: User ID
        user_plan: Optional users.plan value (to avoid extra query if already known)
        supabase: Optional supabase client (creates new if not provided)

    Returns:
        Plan ID: 'free' or 'premium'
    """
    if supabase is None:
        supabase = get_supabase_client()

    # Check for active paid subscription
    subscription_result = (
        supabase.table("subscriptions")
        .select("plan")
        .eq("user_id", user_id)
        .eq("status", "active")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if subscription_result.data:
        return subscription_result.data[0]["plan"]

    # Fall back to users.plan (or query if not provided)
    if user_plan:
        return user_plan or "free"

    user_result = (
        supabase.table("users")
        .select("plan")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )

    return user_result.data.get("plan", "free") if user_result.data else "free"


def get_user_plan_tier(plan: str, supabase=None) -> int:
    """
    Get the tier number for a plan (for feature access checking).

    Args:
        plan: Plan ID ('free' or 'premium')
        supabase: Optional supabase client

    Returns:
        Tier number (0=free, 1=premium)
    """
    if supabase is None:
        supabase = get_supabase_client()

    try:
        plan_result = (
            supabase.table("subscription_plans")
            .select("tier")
            .eq("id", plan)
            .maybe_single()
            .execute()
        )

        if plan_result.data:
            return plan_result.data.get("tier", 0)
    except Exception:
        # If query fails, fall back to hardcoded tiers
        pass

    # Fallback to hardcoded tiers if query fails
    # 2-tier system: free (0) and premium (1)
    tier_map = {
        "free": 0,
        "premium": 1,
    }
    return tier_map.get(plan.lower(), 0)


def get_user_features_by_tier(
    user_id: str, user_plan: Optional[str] = None, supabase=None
) -> Dict[str, Any]:
    """
    Get all features available to user based on their plan (V2 simplified).

    V2: Features are tied directly to plan_id (free/premium), not tiers.
    Simply query features for the user's plan.

    Args:
        user_id: User ID
        user_plan: Optional users.plan value (to avoid extra query)
        supabase: Optional supabase client

    Returns:
        Dict with plan, tier, and list of features
    """
    if supabase is None:
        supabase = get_supabase_client()

    # Get effective plan
    plan = get_user_effective_plan(user_id, user_plan, supabase)

    # Get tier (for backward compatibility)
    tier = get_user_plan_tier(plan, supabase)

    # V2: Query features directly by plan_id (no tier inheritance)
    features_result = (
        supabase.table("plan_features")
        .select("*")
        .eq("plan_id", plan)  # V2: Direct plan matching
        .eq("is_enabled", True)
        .order("sort_order", desc=False)  # Sort by sort_order
        .execute()
    )

    features = features_result.data or []

    return {
        "plan": plan,
        "tier": tier,
        "features": features,
    }
