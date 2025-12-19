"""
Subscription Service

Handles subscription-related operations including:
- Feature limit checks
- Subscription expiry handling
- Goal/Challenge deactivation

This service is used by:
- Webhook handlers (for immediate expiry handling)
- Celery tasks (for scheduled expiry checks)
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
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
        # Return free tier defaults as fallback (simplified limits)
        return {
            "active_goal_limit": 1,
            "challenge_limit": 1,
        }


async def handle_subscription_expiry_deactivation(
    supabase, user_id: str, previous_plan: str, reason: str = "subscription_expired"
) -> Dict[str, Any]:
    """
    Handle all deactivations when a subscription expires.

    This function:
    1. Deactivates excess goals beyond free tier limit
    2. Cancels challenges created by the user
    3. Logs all changes for audit

    Returns summary of what was deactivated.
    """
    # Get FREE tier limits
    free_limits = await get_plan_limits(supabase, "free")

    summary = {
        "goals_deactivated": 0,
        "challenges_cancelled": 0,
        "deactivated_goal_ids": [],
        "cancelled_challenge_ids": [],
    }

    try:
        # =========================================
        # 1. GOALS TABLE - Keep only free tier active limit
        # =========================================
        active_goal_limit = free_limits.get("active_goal_limit", 1) or 1

        # Get all active goals, ordered by creation date (keep oldest/most invested)
        active_goals_result = (
            supabase.table("goals")
            .select("id, title, created_at, is_active, converted_to_challenge_id")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .is_("converted_to_challenge_id", "null")
            .order("created_at", desc=False)
            .execute()
        )

        active_goals = active_goals_result.data or []
        goals_to_deactivate = active_goals[active_goal_limit:]

        for goal in goals_to_deactivate:
            supabase.table("goals").update(
                {
                    "is_active": False,
                    "archived_reason": "subscription_expired",
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).eq("id", goal["id"]).execute()

            summary["goals_deactivated"] += 1
            summary["deactivated_goal_ids"].append(goal["id"])

        logger.info(
            f"Deactivated {summary['goals_deactivated']} goals for user {user_id}"
        )

        # =========================================
        # 2. CHALLENGES - Leave/cancel excess beyond free tier limit
        # =========================================
        # NOTE: Status is computed, not stored:
        # - is_active=false -> cancelled
        # - is_active=true, today < start_date -> upcoming
        # - is_active=true, start_date <= today <= end_date -> active
        # - is_active=true, today > end_date -> completed
        challenge_limit = free_limits.get("challenge_limit", 1) or 1
        today = datetime.utcnow().date().isoformat()

        # Get all active challenges user created (ongoing = not ended)
        created_challenges_result = (
            supabase.table("challenges")
            .select("id, title, end_date, created_at")
            .eq("created_by", user_id)
            .eq("is_active", True)
            .execute()
        )

        # Get all challenges user joined (from challenge_participants)
        joined_challenges_result = (
            supabase.table("challenge_participants")
            .select(
                "challenge_id, joined_at, challenges!inner(id, title, end_date, created_by, is_active)"
            )
            .eq("user_id", user_id)
            .eq("challenges.is_active", True)
            .neq("challenges.created_by", user_id)  # Exclude ones they created
            .execute()
        )

        # Filter for ongoing challenges (end_date >= today or null)
        def is_ongoing(end_date):
            return end_date is None or end_date >= today

        # Combine and sort by date (keep oldest)
        all_challenges = []
        for c in created_challenges_result.data or []:
            if is_ongoing(c.get("end_date")):
                all_challenges.append(
                    {
                        "id": c["id"],
                        "title": c["title"],
                        "is_creator": True,
                        "date": c["created_at"],
                    }
                )
        for p in joined_challenges_result.data or []:
            challenge_data = p.get("challenges")
            if challenge_data and is_ongoing(challenge_data.get("end_date")):
                all_challenges.append(
                    {
                        "id": challenge_data["id"],
                        "title": challenge_data["title"],
                        "is_creator": False,
                        "date": p["joined_at"],
                    }
                )

        # Sort by date (oldest first to keep most invested)
        all_challenges.sort(key=lambda x: x["date"])

        # Keep only up to the limit, remove the rest
        challenges_to_remove = all_challenges[challenge_limit:]

        for challenge in challenges_to_remove:
            if challenge["is_creator"]:
                # Cancel challenges they created (set is_active=false)
                supabase.table("challenges").update(
                    {
                        "is_active": False,  # This makes status = cancelled
                        "cancelled_reason": "creator_subscription_expired",
                        "cancelled_at": datetime.utcnow().isoformat(),
                        "updated_at": datetime.utcnow().isoformat(),
                    }
                ).eq("id", challenge["id"]).execute()
            else:
                # Leave challenges they joined
                supabase.table("challenge_participants").delete().eq(
                    "challenge_id", challenge["id"]
                ).eq("user_id", user_id).execute()

            summary["challenges_cancelled"] += 1
            summary["cancelled_challenge_ids"].append(challenge["id"])

        logger.info(
            f"Removed from {summary['challenges_cancelled']} challenges for user {user_id}"
        )

        # =========================================
        # 3. LOG THE DEACTIVATION
        # =========================================
        supabase.table("subscription_deactivation_logs").insert(
            {
                "user_id": user_id,
                "previous_plan": previous_plan,
                "new_plan": "free",
                "goals_deactivated": summary["goals_deactivated"],
                "challenges_cancelled": summary["challenges_cancelled"],
                "deactivation_reason": reason,
                "deactivated_goal_ids": summary["deactivated_goal_ids"],
                "cancelled_challenge_ids": summary["cancelled_challenge_ids"],
            }
        ).execute()

        logger.info(f"Subscription expiry handled for user {user_id}: {summary}")

        return summary

    except Exception as e:
        logger.error(f"Error handling subscription expiry for user {user_id}: {e}")
        raise


async def check_user_feature_limit(
    supabase, user_id: str, feature_key: str, current_count: int
) -> Dict[str, Any]:
    """
    Check if user can perform an action based on their plan limits.

    Returns:
    {
        "allowed": bool,
        "limit": int or None (None = unlimited),
        "current": int,
        "remaining": int or None,
        "plan": str
    }
    """
    try:
        # Get user's plan
        user_result = (
            supabase.table("users").select("plan").eq("id", user_id).single().execute()
        )

        plan = user_result.data.get("plan", "free") if user_result.data else "free"

        # Get feature limit for plan
        feature_result = (
            supabase.table("plan_features")
            .select("feature_value, is_enabled")
            .eq("plan_id", plan)
            .eq("feature_key", feature_key)
            .single()
            .execute()
        )

        if not feature_result.data or not feature_result.data.get("is_enabled"):
            return {
                "allowed": False,
                "limit": 0,
                "current": current_count,
                "remaining": 0,
                "plan": plan,
            }

        limit = feature_result.data.get("feature_value")

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
