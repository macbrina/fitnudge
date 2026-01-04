"""
Subscriptions API Endpoints

This module provides endpoints for:
- Getting user's subscription status
- Getting available features for user's plan
- Syncing subscription from RevenueCat (fallback for missed webhooks)

Note: All IAP/receipt verification is handled by RevenueCat.
The RevenueCat webhook endpoint is in webhooks.py.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.core.flexible_auth import get_current_user

router = APIRouter(
    redirect_slashes=False
)  # Disable redirects to preserve Authorization header


# Pydantic models
class SubscriptionResponse(BaseModel):
    id: Optional[str] = None  # None for free users
    user_id: str
    plan: str
    status: str
    platform: Optional[str] = None  # None for free users
    product_id: Optional[str] = None  # None for free users
    purchase_date: Optional[str] = None  # None or user.created_at for free users
    expires_date: Optional[str] = None
    auto_renew: bool = False  # Always False for free users
    created_at: Optional[str] = None  # None for free users
    updated_at: Optional[str] = None  # None for free users


@router.get("/me", response_model=Optional[SubscriptionResponse])
async def get_my_subscription(current_user: dict = Depends(get_current_user)):
    """Get current user's subscription (or free plan info)"""
    from app.core.database import get_supabase_client
    from app.core.subscriptions import get_user_effective_plan

    supabase = get_supabase_client()

    # Check for paid subscription
    result = (
        supabase.table("subscriptions")
        .select("*")
        .eq("user_id", current_user["id"])
        .eq("status", "active")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if result.data:
        return result.data[0]

    # Return free plan info (users.plan is the source of truth for free users)
    plan = get_user_effective_plan(
        current_user["id"], current_user.get("plan"), supabase
    )

    return {
        "id": None,  # No subscription ID for free users
        "user_id": current_user["id"],
        "plan": plan,
        "status": "active",  # Free is always active
        "platform": None,
        "product_id": None,
        "purchase_date": current_user.get("created_at"),
        "expires_date": None,
        "auto_renew": False,
        "created_at": None,
        "updated_at": None,
    }


@router.get("/features")
async def get_available_features(current_user: dict = Depends(get_current_user)):
    """Get features available for current user's plan using tier-based system"""
    from app.core.database import get_supabase_client
    from app.core.subscriptions import get_user_features_by_tier

    supabase = get_supabase_client()

    # Use centralized helper to get plan and features based on tier inheritance
    user_plan = current_user.get("plan")
    features_data = get_user_features_by_tier(
        user_id=current_user["id"], user_plan=user_plan, supabase=supabase
    )

    # Transform features to a more usable format
    features_dict = {}
    for feature in features_data["features"]:
        feature_key = feature["feature_key"]
        if feature.get("feature_value") is not None:
            features_dict[feature_key] = feature["feature_value"]
        else:
            features_dict[feature_key] = feature.get("is_enabled", False)

    return {
        "plan": features_data["plan"],
        "tier": features_data["tier"],
        "features": features_dict,
        "features_list": features_data[
            "features"
        ],  # Full feature objects with metadata
    }


# ====================
# Sync Subscription (fallback for missed webhooks)
# ====================


class SyncSubscriptionRequest(BaseModel):
    """Request body for syncing subscription from RevenueCat"""

    tier: str  # 'free', 'premium'
    is_active: bool
    expires_at: Optional[str] = None
    will_renew: bool = False
    platform: Optional[str] = None  # 'ios', 'android', 'stripe'
    product_id: Optional[str] = None


@router.post("/sync")
async def sync_subscription(
    sync_data: SyncSubscriptionRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Sync subscription status from RevenueCat to backend database.

    Called by mobile app when:
    - User logs in
    - App returns to foreground
    - RevenueCat customer info updates

    This ensures database stays in sync even if webhooks are missed.
    """
    from app.core.database import get_supabase_client
    from app.services.logger import logger

    supabase = get_supabase_client()
    user_id = current_user["id"]
    current_db_plan = current_user.get("plan", "free")

    # Map tier to plan ID (2-tier system: free + premium)
    tier_to_plan = {
        "free": "free",
        "premium": "premium",
    }
    revenuecat_plan = tier_to_plan.get(sync_data.tier, "free")

    # Check if there's a mismatch
    if (
        current_db_plan == revenuecat_plan
        and not sync_data.is_active
        and revenuecat_plan == "free"
    ):
        # Already in sync as free user
        return {"synced": False, "message": "Already in sync", "plan": current_db_plan}

    # Check existing subscription in DB
    existing_sub = (
        supabase.table("subscriptions")
        .select("id, plan, status, updated_at")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    now = datetime.utcnow().isoformat()

    # Prevent race condition: if subscription was updated very recently (< 30 seconds),
    # skip sync to avoid overwriting fresher webhook data
    if existing_sub.data and existing_sub.data.get("updated_at"):
        try:
            last_updated = datetime.fromisoformat(
                existing_sub.data["updated_at"].replace("Z", "+00:00")
            )
            seconds_since_update = (
                datetime.utcnow().replace(tzinfo=last_updated.tzinfo) - last_updated
            ).total_seconds()
            if seconds_since_update < 30:
                logger.info(
                    f"[Sync] Skipping - subscription was updated {seconds_since_update:.1f}s ago"
                )
                return {
                    "synced": False,
                    "message": "Skipped - recently updated by webhook",
                    "plan": existing_sub.data.get("plan", current_db_plan),
                }
        except Exception as e:
            logger.warning(f"[Sync] Could not parse updated_at: {e}")

    if sync_data.is_active and revenuecat_plan != "free":
        # User has active paid subscription in RevenueCat
        subscription_data = {
            "user_id": user_id,
            "plan": revenuecat_plan,
            "status": "active",
            "platform": sync_data.platform,
            "product_id": sync_data.product_id,
            "expires_date": sync_data.expires_at,
            "auto_renew": sync_data.will_renew,
            "updated_at": now,
        }

        if existing_sub.data:
            # Update existing subscription
            supabase.table("subscriptions").update(subscription_data).eq(
                "user_id", user_id
            ).execute()
            logger.info(
                f"[Sync] Updated subscription for user {user_id}: {revenuecat_plan}"
            )
        else:
            # Create new subscription record
            subscription_data["created_at"] = now
            subscription_data["purchase_date"] = now
            supabase.table("subscriptions").insert(subscription_data).execute()
            logger.info(
                f"[Sync] Created subscription for user {user_id}: {revenuecat_plan}"
            )

        # Update user's plan column
        if current_db_plan != revenuecat_plan:
            supabase.table("users").update({"plan": revenuecat_plan}).eq(
                "id", user_id
            ).execute()
            logger.info(
                f"[Sync] Updated user plan {user_id}: {current_db_plan} -> {revenuecat_plan}"
            )

        return {
            "synced": True,
            "message": "Subscription synced",
            "previous_plan": current_db_plan,
            "new_plan": revenuecat_plan,
        }

    else:
        # User is free in RevenueCat (no active subscription)
        if current_db_plan != "free":
            # User was paid but now free - subscription expired
            if existing_sub.data:
                supabase.table("subscriptions").update(
                    {
                        "status": "expired",
                        "auto_renew": False,
                        "updated_at": now,
                    }
                ).eq("user_id", user_id).execute()

            supabase.table("users").update({"plan": "free"}).eq("id", user_id).execute()

            logger.info(f"[Sync] Downgraded user {user_id}: {current_db_plan} -> free")

            return {
                "synced": True,
                "message": "Subscription expired, downgraded to free",
                "previous_plan": current_db_plan,
                "new_plan": "free",
            }

        return {"synced": False, "message": "Already free", "plan": "free"}


# ====================
# Subscription History
# ====================


class SubscriptionHistoryResponse(BaseModel):
    """Response for subscription history check"""

    has_ever_subscribed: bool
    subscription_count: int
    first_subscription_date: Optional[str] = None
    last_subscription_date: Optional[str] = None


@router.get("/history", response_model=SubscriptionHistoryResponse)
async def get_subscription_history(current_user: dict = Depends(get_current_user)):
    """
    Check if user has ever had a paid subscription.

    This is used for exit offer eligibility - users who have previously subscribed
    (even if now expired/cancelled) should not see the exit offer discount.
    """
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Get all subscription records for user (not just active ones)
    result = (
        supabase.table("subscriptions")
        .select("id, plan, status, created_at, purchase_date")
        .eq("user_id", user_id)
        .neq("plan", "free")  # Only count paid subscriptions
        .order("created_at", desc=False)
        .execute()
    )

    subscriptions = result.data or []
    subscription_count = len(subscriptions)

    if subscription_count > 0:
        first_sub = subscriptions[0]
        last_sub = subscriptions[-1]
        return {
            "has_ever_subscribed": True,
            "subscription_count": subscription_count,
            "first_subscription_date": first_sub.get("purchase_date")
            or first_sub.get("created_at"),
            "last_subscription_date": last_sub.get("purchase_date")
            or last_sub.get("created_at"),
        }

    return {
        "has_ever_subscribed": False,
        "subscription_count": 0,
        "first_subscription_date": None,
        "last_subscription_date": None,
    }


# Note: All IAP verification, webhooks, and product fetching is handled by RevenueCat.
# - RevenueCat SDK handles purchases on the client
# - RevenueCat webhook is at POST /webhooks/revenuecat (in webhooks.py)
# - Product info comes from RevenueCat SDK/dashboard
