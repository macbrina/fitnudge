"""
FitNudge V2 - Subscription Service

Handles subscription-related operations including:
- Feature limit checks
- Subscription expiry handling
- Goal deactivation for expired subscriptions
- Partner request cleanup

This service is used by:
- Webhook handlers (for immediate expiry handling)
- Celery tasks (for scheduled expiry checks)
"""

from datetime import datetime
from typing import Optional, Dict, Any
from app.services.logger import logger


async def get_plan_limits(supabase, plan_id: str) -> Dict[str, Optional[int]]:
    """
    Get all limits for a plan.
    Returns dict with limit values (None = unlimited, 0 = feature disabled).
    """
    try:
        result = (
            supabase.table("plan_features")
            .select("feature_key, feature_value, is_enabled")
            .eq("plan_id", plan_id)
            .execute()
        )

        limits = {}
        for feature in result.data:
            key = feature["feature_key"]
            if key.endswith("_limit"):
                # For limit features, None means unlimited, 0 means disabled
                limits[key] = feature["feature_value"] if feature["is_enabled"] else 0

        return limits
    except Exception as e:
        logger.error(f"Error getting plan limits for {plan_id}: {e}")
        # Return free tier defaults as fallback
        return {
            "active_goal_limit": 2,  # V2: Free users get 2 goals
        }


async def handle_subscription_expiry_deactivation(
    supabase, user_id: str, previous_plan: str, reason: str = "subscription_expired"
) -> Dict[str, Any]:
    """
    Handle all deactivations when a subscription expires.

    This function:
    1. Deactivates excess goals beyond free tier limit
    2. Deletes pending partner requests (free users don't have social_accountability feature)
    3. Logs all changes for audit

    Returns summary of what was deactivated.
    """
    # Get FREE tier limits
    free_limits = await get_plan_limits(supabase, "free")

    summary = {
        "goals_deactivated": 0,
        "partner_requests_deleted": 0,
        "deactivated_goal_ids": [],
    }

    try:
        # =========================================
        # 1. GOALS TABLE - Keep only free tier active limit
        # =========================================
        active_goal_limit = free_limits.get("active_goal_limit", 2) or 2

        # Get all active goals, ordered by creation date (keep oldest/most invested)
        active_goals_result = (
            supabase.table("goals")
            .select("id, title, created_at, status")
            .eq("user_id", user_id)
            .eq("status", "active")
            .order("created_at", desc=False)
            .execute()
        )

        active_goals = active_goals_result.data or []
        goals_to_deactivate = active_goals[active_goal_limit:]

        for goal in goals_to_deactivate:
            supabase.table("goals").update(
                {
                    "status": "archived",
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).eq("id", goal["id"]).execute()

            summary["goals_deactivated"] += 1
            summary["deactivated_goal_ids"].append(goal["id"])

        logger.info(
            f"Deactivated {summary['goals_deactivated']} goals for user {user_id}"
        )

        # =========================================
        # 2. PARTNER REQUESTS - Delete pending requests SENT by this user
        # =========================================
        # Free users don't have social_accountability feature
        # So delete any pending requests they initiated (not received ones)
        # SCALABILITY: Uses paginated batch cleanup for large datasets
        from app.services.cleanup_service import paginated_cleanup_partner_requests_sync

        try:
            cleanup_stats = paginated_cleanup_partner_requests_sync(
                supabase, user_id, reason="sender_subscription_expired"
            )

            if cleanup_stats["deleted_requests"] > 0:
                summary["partner_requests_deleted"] = cleanup_stats["deleted_requests"]
                logger.info(
                    f"Deleted {cleanup_stats['deleted_requests']} pending partner requests "
                    f"and {cleanup_stats['deleted_notifications']} notifications for user {user_id}"
                )
        except Exception as e:
            logger.error(f"Failed to cleanup partner requests for user {user_id}: {e}")

        # =========================================
        # 3. LOG THE DEACTIVATION (if table exists)
        # =========================================
        # Note: subscription_deactivation_logs table may not exist
        # If it does, log the deactivation for audit purposes
        try:
            supabase.table("subscription_deactivation_logs").insert(
                {
                    "user_id": user_id,
                    "previous_plan": previous_plan,
                    "new_plan": "free",
                    "goals_deactivated": summary["goals_deactivated"],
                    "deactivation_reason": reason,
                    "deactivated_goal_ids": summary["deactivated_goal_ids"],
                }
            ).execute()
        except Exception as log_error:
            # Table might not exist - that's okay, we still log to logger
            logger.debug(
                f"Could not log to subscription_deactivation_logs: {log_error}"
            )

        logger.info(f"Subscription expiry handled for user {user_id}: {summary}")

        return summary

    except Exception as e:
        logger.error(f"Error handling subscription expiry for user {user_id}: {e}")
        raise


async def check_user_feature_limit(
    supabase, user_id: str, feature_key: str, current_count: int
) -> Dict[str, Any]:
    """
    Check if user can perform an action based on their plan limits (V2 simplified).

    V2: Features are tied directly to plan_id (free/premium), not tiers.
    Simply checks if the feature exists for the user's plan.

    Returns:
    {
        "allowed": bool,
        "limit": int or None (None = unlimited),
        "current": int,
        "remaining": int or None,
        "plan": str
    }
    """
    from app.core.subscriptions import get_user_effective_plan, get_user_plan_tier

    try:
        # Get user's EFFECTIVE plan (checks subscriptions table first, then users.plan)
        # This correctly handles active subscriptions
        plan = get_user_effective_plan(user_id, supabase=supabase)
        user_tier = get_user_plan_tier(plan, supabase)

        # V2: Query features directly by plan_id (no tier inheritance)
        feature_result = (
            supabase.table("plan_features")
            .select("feature_value, is_enabled")
            .eq("feature_key", feature_key)
            .eq("plan_id", plan)  # V2: Direct plan matching
            .eq("is_enabled", True)
            .limit(1)
            .execute()
        )

        if not feature_result.data:
            return {
                "allowed": False,
                "limit": 0,
                "current": current_count,
                "remaining": 0,
                "plan": plan,
            }

        limit = feature_result.data[0].get("feature_value")

        # None means unlimited
        if limit is None:
            return {
                "allowed": True,
                "limit": None,
                "current": current_count,
                "remaining": None,
                "plan": plan,
            }

        remaining = limit - current_count
        allowed = remaining > 0

        return {
            "allowed": allowed,
            "limit": limit,
            "current": current_count,
            "remaining": max(0, remaining),
            "plan": plan,
        }

    except Exception as e:
        logger.error(
            f"Error checking feature limit {feature_key} for user {user_id}: {e}"
        )
        return {
            "allowed": False,
            "limit": 0,
            "current": current_count,
            "remaining": 0,
            "plan": "free",
        }


async def get_user_feature_value(
    supabase, user_id: str, feature_key: str
) -> Optional[Any]:
    """
    Get the value of a specific feature for a user (V2 simplified).

    V2: Features are tied directly to plan_id (free/premium), not tiers.
    Simply returns the feature value for the user's plan.

    Returns:
    - None if feature is not found, disabled, or user doesn't have access
    - feature_value for the feature (None = unlimited for limits)
    """
    from app.core.subscriptions import get_user_effective_plan, get_user_plan_tier

    try:
        # Get user's EFFECTIVE plan (checks subscriptions table first, then users.plan)
        # This correctly handles active subscriptions
        plan = get_user_effective_plan(user_id, supabase=supabase)
        user_tier = get_user_plan_tier(plan, supabase)

        # V2: Query features directly by plan_id (no tier inheritance)
        feature_result = (
            supabase.table("plan_features")
            .select("feature_value, is_enabled")
            .eq("feature_key", feature_key)
            .eq("plan_id", plan)  # V2: Direct plan matching
            .eq("is_enabled", True)
            .limit(1)
            .execute()
        )

        if not feature_result.data:
            return None

        # Return feature_value (could be None for unlimited, integer for limits)
        return feature_result.data[0].get("feature_value")

    except Exception as e:
        logger.error(
            f"Error getting feature value {feature_key} for user {user_id}: {e}"
        )
        return None


async def has_user_feature(supabase, user_id: str, feature_key: str) -> bool:
    """
    Check if a user has access to a specific feature based on their plan (V2 simplified).

    V2: Features are tied directly to plan_id (free/premium), not tiers.
    Simply checks if the feature exists and is enabled for the user's plan.

    Returns:
    - True if feature is enabled and user's plan qualifies
    - False otherwise
    """
    from app.core.subscriptions import get_user_effective_plan, get_user_plan_tier

    try:
        # Get user's EFFECTIVE plan (checks subscriptions table first, then users.plan)
        # This correctly handles active subscriptions
        plan = get_user_effective_plan(user_id, supabase=supabase)
        user_tier = get_user_plan_tier(plan, supabase)

        # V2: Check if feature exists for user's plan (direct plan matching)
        feature_result = (
            supabase.table("plan_features")
            .select("id, is_enabled, feature_value")
            .eq("feature_key", feature_key)
            .eq("plan_id", plan)  # V2: Direct plan matching
            .eq("is_enabled", True)
            .limit(1)
            .execute()
        )

        if not feature_result.data:
            return False

        # Feature exists and user qualifies
        # For limit features, check if value > 0 (0 means disabled)
        feature_value = feature_result.data[0].get("feature_value")
        if feature_value == 0:
            return False

        return True

    except Exception as e:
        logger.error(f"Error checking feature {feature_key} for user {user_id}: {e}")
        return False


def has_user_feature_sync(supabase, user_id: str, feature_key: str) -> bool:
    """
    Synchronous version of has_user_feature for use in Celery tasks.

    V2: Features are tied directly to plan_id (free/premium), not tiers.
    Simply checks if the feature exists and is enabled for the user's plan.

    Returns:
    - True if feature is enabled and user's plan qualifies
    - False otherwise
    """
    from app.core.subscriptions import get_user_effective_plan

    try:
        # Get user's EFFECTIVE plan (checks subscriptions table first, then users.plan)
        plan = get_user_effective_plan(user_id, supabase=supabase)

        # V2: Check if feature exists for user's plan (direct plan matching)
        feature_result = (
            supabase.table("plan_features")
            .select("id, is_enabled, feature_value")
            .eq("feature_key", feature_key)
            .eq("plan_id", plan)
            .eq("is_enabled", True)
            .limit(1)
            .execute()
        )

        if not feature_result.data:
            return False

        # For limit features, check if value > 0 (0 means disabled)
        feature_value = feature_result.data[0].get("feature_value")
        if feature_value == 0:
            return False

        return True

    except Exception as e:
        logger.error(f"Error checking feature {feature_key} for user {user_id}: {e}")
        return False
