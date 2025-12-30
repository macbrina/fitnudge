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
        "partner_requests_deleted": 0,
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
        # 2. CHALLENGES - Cancel ALL created + limit joined
        # =========================================
        # FREE users CANNOT create challenges (no challenge_create feature)
        # So ALL created challenges must be cancelled
        # They can still PARTICIPATE in challenges they joined (up to limit)

        challenge_limit = free_limits.get("challenge_limit", 1) or 1
        today = datetime.utcnow().date().isoformat()

        # STEP 2a: Cancel ALL challenges user CREATED
        # (Free users don't have challenge_create feature)
        # SCALABILITY: Uses batch operations instead of loops
        created_challenges_result = (
            supabase.table("challenges")
            .select("id, title")
            .eq("created_by", user_id)
            .in_("status", ["upcoming", "active"])
            .execute()
        )

        created_challenges = created_challenges_result.data or []
        if created_challenges:
            challenge_ids = [c["id"] for c in created_challenges]

            # BATCH UPDATE: Cancel all challenges in one query
            supabase.table("challenges").update(
                {
                    "status": "cancelled",
                    "cancelled_reason": "creator_subscription_expired",
                    "cancelled_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).in_("id", challenge_ids).execute()

            # BATCH CLEANUP: Clean invites and notifications for all challenges at once
            from app.services.cleanup_service import cleanup_challenges_batch_sync

            cleanup_challenges_batch_sync(
                supabase, challenge_ids, reason="creator_subscription_expired"
            )

            summary["challenges_cancelled"] += len(challenge_ids)
            summary["cancelled_challenge_ids"].extend(challenge_ids)

            logger.info(
                f"Batch cancelled {len(challenge_ids)} challenges (creator subscription expired)"
            )

            # Notify participants (still per-challenge for personalized messages)
            for challenge in created_challenges:
                _notify_challenge_participants_cancelled(
                    supabase,
                    challenge["id"],
                    challenge["title"],
                    "creator_subscription_expired",
                )

        # STEP 2b: For JOINED challenges, keep up to challenge_limit (oldest first)
        joined_challenges_result = (
            supabase.table("challenge_participants")
            .select("id, challenge_id, joined_at, challenges!inner(id, title, status)")
            .eq("user_id", user_id)
            .in_("challenges.status", ["upcoming", "active"])
            .neq("challenges.created_by", user_id)  # Only joined, not created
            .order("joined_at", desc=False)  # Oldest first
            .execute()
        )

        joined_challenges = joined_challenges_result.data or []

        # Remove excess joined challenges beyond limit
        # SCALABILITY: Uses batch delete instead of loop
        joined_to_remove = joined_challenges[challenge_limit:]

        if joined_to_remove:
            participant_ids = [p["id"] for p in joined_to_remove]
            challenge_ids_removed = [p["challenge_id"] for p in joined_to_remove]

            # BATCH DELETE: Remove all participations in one query
            supabase.table("challenge_participants").delete().in_(
                "id", participant_ids
            ).execute()

            summary["challenges_cancelled"] += len(participant_ids)
            summary["cancelled_challenge_ids"].extend(challenge_ids_removed)

            logger.info(
                f"Batch removed user from {len(participant_ids)} challenges (subscription expired)"
            )

        logger.info(
            f"Cancelled {len(created_challenges)} created challenges, "
            f"removed from {len(joined_to_remove)} joined challenges for user {user_id}"
        )

        # =========================================
        # 3. PARTNER REQUESTS - Delete pending requests SENT by this user
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
        # 4. LOG THE DEACTIVATION
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
                # Note: partner_requests_deleted not stored in DB, but logged in summary
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
    Check if user can perform an action based on their plan limits with TIER INHERITANCE.

    Users have access to features where minimum_tier <= user_tier.
    Gets the highest tier version of the feature the user qualifies for.

    Returns:
    {
        "allowed": bool,
        "limit": int or None (None = unlimited),
        "current": int,
        "remaining": int or None,
        "plan": str
    }
    """
    from app.core.subscriptions import get_user_plan_tier

    try:
        # Get user's plan and tier
        user_result = (
            supabase.table("users").select("plan").eq("id", user_id).single().execute()
        )

        plan = user_result.data.get("plan", "free") if user_result.data else "free"
        user_tier = get_user_plan_tier(plan, supabase)

        # Query features where user's tier qualifies (minimum_tier <= user_tier)
        # Then get the highest tier version the user qualifies for (not highest overall)
        # e.g., tier 2 user gets tier 2's value, NOT tier 3's value
        feature_result = (
            supabase.table("plan_features")
            .select("feature_value, is_enabled, minimum_tier")
            .eq("feature_key", feature_key)
            .eq("is_enabled", True)
            .lte("minimum_tier", user_tier)  # Excludes tiers above user's tier
            .order("minimum_tier", desc=True)  # Best version user qualifies for
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
    Get the value of a specific feature for a user with TIER INHERITANCE.

    Users have access to features where minimum_tier <= user_tier.
    Returns the highest tier version of the feature the user qualifies for.

    Returns:
    - None if feature is not found, disabled, or user doesn't have access
    - feature_value for the feature (None = unlimited for limits)
    """
    from app.core.subscriptions import get_user_plan_tier

    try:
        # Get user's plan and tier
        user_result = (
            supabase.table("users").select("plan").eq("id", user_id).single().execute()
        )

        plan = user_result.data.get("plan", "free") if user_result.data else "free"
        user_tier = get_user_plan_tier(plan, supabase)

        # Query features where user's tier qualifies (minimum_tier <= user_tier)
        # Then get the highest tier version the user qualifies for (not highest overall)
        # e.g., tier 2 user gets tier 2's value, NOT tier 3's value
        feature_result = (
            supabase.table("plan_features")
            .select("feature_value, is_enabled, minimum_tier")
            .eq("feature_key", feature_key)
            .eq("is_enabled", True)
            .lte("minimum_tier", user_tier)  # Excludes tiers above user's tier
            .order("minimum_tier", desc=True)  # Best version user qualifies for
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
    Check if a user has access to a specific feature based on their plan with TIER INHERITANCE.

    Users have access to features where minimum_tier <= user_tier.

    Returns:
    - True if feature is enabled and user's tier qualifies
    - False otherwise
    """
    from app.core.subscriptions import get_user_plan_tier

    try:
        # Get user's plan and tier
        user_result = (
            supabase.table("users").select("plan").eq("id", user_id).single().execute()
        )

        plan = user_result.data.get("plan", "free") if user_result.data else "free"
        user_tier = get_user_plan_tier(plan, supabase)

        # Check if ANY feature with this key exists where user's tier qualifies
        # (minimum_tier <= user_tier means user has access to this feature)
        feature_result = (
            supabase.table("plan_features")
            .select("id, is_enabled, feature_value")
            .eq("feature_key", feature_key)
            .eq("is_enabled", True)
            .lte("minimum_tier", user_tier)  # Excludes tiers above user's tier
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


def _notify_challenge_participants_cancelled(
    supabase, challenge_id: str, challenge_title: str, reason: str
):
    """
    Notify all participants of a challenge that it has been cancelled.

    SCALABILITY: For large challenges, dispatches notifications via Celery task
    to avoid blocking the main thread. Uses chunking for 100+ participants.
    """
    try:
        # Get all participant user_ids
        participants_result = (
            supabase.table("challenge_participants")
            .select("user_id")
            .eq("challenge_id", challenge_id)
            .execute()
        )

        if not participants_result.data:
            return

        user_ids = [p["user_id"] for p in participants_result.data if p.get("user_id")]

        if not user_ids:
            return

        # For small numbers, process inline
        # For large numbers, dispatch to Celery task
        INLINE_THRESHOLD = 10

        if len(user_ids) <= INLINE_THRESHOLD:
            _send_cancellation_notifications_sync(
                supabase, user_ids, challenge_id, challenge_title, reason
            )
        else:
            # Dispatch to Celery task for async processing
            from app.services.tasks.subscription_tasks import (
                notify_challenge_cancelled_chunk_task,
            )

            # Dispatch chunked tasks for scalable processing
            from app.services.tasks.task_utils import dispatch_chunked_tasks

            dispatch_chunked_tasks(
                task=notify_challenge_cancelled_chunk_task,
                items=user_ids,
                chunk_size=50,
                challenge_id=challenge_id,
                challenge_title=challenge_title,
                reason=reason,
            )

    except Exception as e:
        logger.error(
            f"Error notifying participants about challenge {challenge_id} cancellation: {e}"
        )


def _send_cancellation_notifications_sync(
    supabase,
    user_ids: List[str],
    challenge_id: str,
    challenge_title: str,
    reason: str,
) -> int:
    """
    Send cancellation notifications to a list of users (sync version).
    Used both inline and by Celery tasks.

    Returns:
        Number of notifications delivered
    """
    from app.services.expo_push_service import send_push_to_user_sync

    reason_messages = {
        "creator_subscription_expired": (
            "Challenge Cancelled",
            f"'{challenge_title}' has been cancelled because the creator's subscription expired.",
        ),
        "no_participants": (
            "Challenge Cancelled",
            f"'{challenge_title}' was cancelled because no one joined before the deadline.",
        ),
    }

    title, body = reason_messages.get(
        reason,
        ("Challenge Cancelled", f"'{challenge_title}' has been cancelled."),
    )

    notified_count = 0
    for user_id in user_ids:
        try:
            result = send_push_to_user_sync(
                user_id=user_id,
                title=title,
                body=body,
                data={
                    "type": "challenge_cancelled",
                    "challenge_id": challenge_id,
                    "reason": reason,
                },
                notification_type="social",
                entity_type="challenge",
                entity_id=challenge_id,
            )
            if result.get("delivered"):
                notified_count += 1
        except Exception as e:
            logger.error(
                f"Failed to send cancellation notification to participant {user_id}: {e}"
            )

    logger.info(
        f"Notified {notified_count}/{len(user_ids)} participants about challenge cancellation"
    )

    return notified_count
