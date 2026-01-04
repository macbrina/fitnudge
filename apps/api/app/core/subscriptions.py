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
    Get all features available to user based on tier inheritance.

    Users have access to all features in their tier AND lower tiers.
    This implements the tier-based feature access system.

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

    # Get tier
    tier = get_user_plan_tier(plan, supabase)

    # Query features where minimum_tier <= user_tier (tier inheritance)
    features_result = (
        supabase.table("plan_features")
        .select("*")
        .lte("minimum_tier", tier)  # User has access to this tier and below
        .eq("is_enabled", True)
        .execute()
    )

    # Deduplicate by feature_key, keeping the highest tier version
    # (features in higher tiers override lower tier versions)
    # Sort by minimum_tier DESC first so higher tier features come first
    all_features = sorted(
        (features_result.data or []),
        key=lambda x: (x.get("minimum_tier", 0), x.get("sort_order", 0)),
        reverse=True,  # Higher tiers first
    )

    features_dict = {}
    for feature in all_features:
        feature_key = feature.get("feature_key")
        if feature_key and feature_key not in features_dict:
            # First occurrence (highest tier) wins
            features_dict[feature_key] = feature

    # Convert back to list, sorted by minimum_tier (ascending) then sort_order
    deduplicated_features = list(features_dict.values())
    deduplicated_features.sort(
        key=lambda x: (x.get("minimum_tier", 0), x.get("sort_order", 0))
    )

    return {
        "plan": plan,
        "tier": tier,
        "features": deduplicated_features,
    }


def check_user_has_feature(
    user_id: str, feature_key: str, user_plan: Optional[str] = None, supabase=None
) -> bool:
    """
    Check if user has access to a specific feature.

    Args:
        user_id: User ID
        feature_key: Feature key to check
        user_plan: Optional users.plan value
        supabase: Optional supabase client

    Returns:
        True if user has access to the feature, False otherwise
    """
    features_data = get_user_features_by_tier(user_id, user_plan, supabase)

    # Check if feature exists in user's available features
    for feature in features_data["features"]:
        if feature.get("feature_key") == feature_key:
            return feature.get("is_enabled", False)

    return False
