"""
RevenueCat Webhook Handler

Handles webhook events from RevenueCat for subscription management.
This is the single source of truth for subscription status changes.

Events handled:
- INITIAL_PURCHASE: User subscribes for the first time
- RENEWAL: Subscription auto-renews
- CANCELLATION: User cancels (but still active until period end)
- EXPIRATION: Subscription expires
- BILLING_ISSUE: Payment failed (with grace period support)
- PRODUCT_CHANGE: User changes plan
- UNCANCELLATION: User re-enables auto-renew
- TRANSFER: Subscription transferred to different app user

Setup in RevenueCat Dashboard:
1. Go to Project Settings > Integrations > Webhooks
2. Add your webhook URL: https://your-api.com/api/v1/webhooks/revenuecat
3. Set Authorization header value (e.g., "Bearer your-secret-token")
4. Add to environment: REVENUECAT_WEBHOOK_SECRET=Bearer your-secret-token

Security:
- RevenueCat uses Authorization header for webhook security (not signature)
- Set the same value in RevenueCat Dashboard and your environment variable
"""

from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import hmac
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter(redirect_slashes=False)

# RevenueCat webhook secret - this is the Authorization header value
# Set the same value in RevenueCat Dashboard > Webhooks > Authorization header
# Example: "Bearer super_long_random_string_here"
REVENUECAT_WEBHOOK_SECRET = os.getenv("REVENUECAT_WEBHOOK_SECRET", "")


# Pydantic models for RevenueCat webhook payload
class SubscriberEntitlement(BaseModel):
    expires_date: Optional[str] = None
    grace_period_expires_date: Optional[str] = None
    product_identifier: Optional[str] = None
    purchase_date: Optional[str] = None


class SubscriberInfo(BaseModel):
    entitlements: Optional[dict] = None
    first_seen: Optional[str] = None
    original_app_user_id: Optional[str] = None
    original_application_version: Optional[str] = None
    non_subscriptions: Optional[dict] = None
    original_purchase_date: Optional[str] = None
    subscriptions: Optional[dict] = None


class RevenueCatEvent(BaseModel):
    aliases: Optional[List[str]] = None
    app_id: Optional[str] = None
    app_user_id: Optional[str] = None
    country_code: Optional[str] = None
    currency: Optional[str] = None
    entitlement_id: Optional[str] = None
    entitlement_ids: Optional[List[str]] = None
    environment: Optional[str] = None  # SANDBOX or PRODUCTION
    event_timestamp_ms: Optional[int] = None
    expiration_at_ms: Optional[int] = None
    grace_period_expiration_at_ms: Optional[int] = (
        None  # Grace period end for billing issues
    )
    id: Optional[str] = None
    is_family_share: Optional[bool] = None
    offer_code: Optional[str] = None
    original_app_user_id: Optional[str] = None
    original_transaction_id: Optional[str] = None
    period_type: Optional[str] = None  # TRIAL, INTRO, NORMAL
    presented_offering_id: Optional[str] = None
    price: Optional[float] = None
    price_in_purchased_currency: Optional[float] = None
    product_id: Optional[str] = None
    purchased_at_ms: Optional[int] = None
    store: Optional[str] = None  # APP_STORE, PLAY_STORE, STRIPE, etc.
    subscriber_attributes: Optional[dict] = None
    takehome_percentage: Optional[float] = None
    tax_percentage: Optional[float] = None
    transaction_id: Optional[str] = None
    type: str  # Event type


class RevenueCatWebhook(BaseModel):
    api_version: Optional[str] = None
    event: RevenueCatEvent


def get_plan_from_product_id(product_id: str) -> str:
    """Map product ID to plan name"""
    if not product_id:
        return "free"

    product_id_lower = product_id.lower()

    if "coach" in product_id_lower:
        return "elite"
    elif "pro" in product_id_lower:
        return "pro"
    elif "starter" in product_id_lower:
        return "starter"
    else:
        return "free"


def get_platform_from_store(store: str) -> str:
    """Map RevenueCat store to platform"""
    store_map = {
        "APP_STORE": "ios",
        "MAC_APP_STORE": "ios",
        "PLAY_STORE": "android",
        "AMAZON": "android",
        "STRIPE": "stripe",
        "PROMOTIONAL": "promotional",
    }
    return store_map.get(store, "unknown")


@router.post("/revenuecat")
async def revenuecat_webhook(
    request: Request,
    authorization: Optional[str] = Header(None),
):
    """
    Handle RevenueCat webhook events

    This endpoint receives subscription events from RevenueCat and updates
    the subscriptions table accordingly.

    Security:
    - Verifies Authorization header against REVENUECAT_WEBHOOK_SECRET
    - Set the same value in RevenueCat Dashboard and your environment variable
    """
    from app.core.database import get_supabase_client

    # Verify Authorization header
    if REVENUECAT_WEBHOOK_SECRET:
        if not authorization:
            logger.warning("Missing Authorization header")
            raise HTTPException(status_code=401, detail="Missing Authorization header")

        # Use timing-safe comparison to prevent timing attacks
        if not hmac.compare_digest(authorization, REVENUECAT_WEBHOOK_SECRET):
            logger.warning("Invalid Authorization header")
            raise HTTPException(status_code=401, detail="Unauthorized")
    else:
        # Allow in development if not configured
        logger.warning("REVENUECAT_WEBHOOK_SECRET not configured, skipping auth check")

    # Get raw body for parsing
    body = await request.body()

    # Parse webhook payload
    try:
        import json

        payload = json.loads(body)
        webhook = RevenueCatWebhook(**payload)
        event = webhook.event
    except Exception as e:
        logger.error(f"Failed to parse webhook payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")

    print(f"Received RevenueCat webhook: {event.type} for user {event.app_user_id}")

    # Skip sandbox events in production (optional)
    # if event.environment == "SANDBOX" and os.getenv("ENVIRONMENT") == "production":
    #     logger.info("Skipping sandbox event in production")
    #     return {"status": "skipped", "reason": "sandbox_event"}

    supabase = get_supabase_client()

    # Get user ID (RevenueCat app_user_id should be our user ID)
    user_id = event.app_user_id or event.original_app_user_id

    if not user_id:
        print("No user ID in webhook event")
        return {"status": "skipped", "reason": "no_user_id"}

    # Handle different event types
    try:
        if event.type in ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION"]:
            # Active subscription events
            await handle_subscription_active(supabase, event, user_id)

        elif event.type == "CANCELLATION":
            # User cancelled but subscription still active until expiry
            await handle_subscription_cancelled(supabase, event, user_id)

        elif event.type == "EXPIRATION":
            # Subscription expired
            await handle_subscription_expired(supabase, event, user_id)

        elif event.type == "BILLING_ISSUE":
            # Payment failed - subscription may enter grace period
            await handle_billing_issue(supabase, event, user_id)

        elif event.type == "PRODUCT_CHANGE":
            # User changed plan (upgrade/downgrade)
            await handle_product_change(supabase, event, user_id)

        elif event.type == "TRANSFER":
            # Subscription transferred to different user
            await handle_subscription_transfer(supabase, event, user_id)

        else:
            logger.info(f"Unhandled event type: {event.type}")

    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        # Don't raise - RevenueCat will retry on 5xx errors
        return {"status": "error", "message": str(e)}

    return {"status": "success", "event_type": event.type}


async def handle_subscription_active(supabase, event: RevenueCatEvent, user_id: str):
    """Handle active subscription (new purchase, renewal, uncancellation)"""
    plan = get_plan_from_product_id(event.product_id)
    platform = get_platform_from_store(event.store or "")

    # Convert timestamps
    expires_at = None
    if event.expiration_at_ms:
        expires_at = datetime.fromtimestamp(event.expiration_at_ms / 1000).isoformat()

    purchased_at = None
    if event.purchased_at_ms:
        purchased_at = datetime.fromtimestamp(event.purchased_at_ms / 1000).isoformat()

    # Check if subscription exists
    existing = (
        supabase.table("subscriptions").select("id").eq("user_id", user_id).execute()
    )

    subscription_data = {
        "user_id": user_id,
        "plan": plan,
        "status": "active",
        "platform": platform,
        "product_id": event.product_id,
        "purchase_date": purchased_at,
        "expires_date": expires_at,
        "auto_renew": event.type != "CANCELLATION",
        "revenuecat_event_id": event.id,
        "environment": event.environment,
        "grace_period_ends_at": None,  # Clear grace period when subscription is active
        "updated_at": datetime.utcnow().isoformat(),
    }

    if existing.data:
        # Update existing subscription
        supabase.table("subscriptions").update(subscription_data).eq(
            "user_id", user_id
        ).execute()
        logger.info(f"Updated subscription for user {user_id}: {plan}")
    else:
        # Create new subscription
        subscription_data["created_at"] = datetime.utcnow().isoformat()
        supabase.table("subscriptions").insert(subscription_data).execute()
        logger.info(f"Created subscription for user {user_id}: {plan}")

    # Update user's plan in users table
    supabase.table("users").update({"plan": plan}).eq("id", user_id).execute()


async def handle_subscription_cancelled(supabase, event: RevenueCatEvent, user_id: str):
    """Handle subscription cancellation (still active until expiry)"""
    # Update subscription to mark as cancelled but still active
    supabase.table("subscriptions").update(
        {
            "auto_renew": False,
            "status": "cancelled",  # Still active until expires_date
            "updated_at": datetime.utcnow().isoformat(),
        }
    ).eq("user_id", user_id).execute()

    logger.info(
        f"Subscription cancelled for user {user_id} (still active until expiry)"
    )


async def handle_subscription_expired(supabase, event: RevenueCatEvent, user_id: str):
    """Handle subscription expiration"""
    # Update subscription status
    supabase.table("subscriptions").update(
        {
            "status": "expired",
            "auto_renew": False,
            "updated_at": datetime.utcnow().isoformat(),
        }
    ).eq("user_id", user_id).execute()

    # Downgrade user to free plan
    supabase.table("users").update({"plan": "free"}).eq("id", user_id).execute()

    logger.info(f"Subscription expired for user {user_id}, downgraded to free")


async def handle_billing_issue(supabase, event: RevenueCatEvent, user_id: str):
    """
    Handle billing issue (payment failed)

    During grace period:
    - Apple: Up to 16 days automatic retry
    - Google: 3-30 days (configurable in Play Console)

    User retains full access until grace_period_ends_at.
    If grace period expires without successful payment, EXPIRATION event is sent.
    """
    # Convert grace period expiry timestamp
    grace_period_ends_at = None
    if event.grace_period_expiration_at_ms:
        grace_period_ends_at = datetime.fromtimestamp(
            event.grace_period_expiration_at_ms / 1000
        ).isoformat()

    update_data = {
        "status": "billing_issue",
        "updated_at": datetime.utcnow().isoformat(),
        "revenuecat_event_id": event.id,
    }

    # Store grace period end date if available
    if grace_period_ends_at:
        update_data["grace_period_ends_at"] = grace_period_ends_at
        logger.warning(
            f"Billing issue for user {user_id}, grace period ends at {grace_period_ends_at}"
        )
    else:
        logger.warning(f"Billing issue for user {user_id}, no grace period info")

    supabase.table("subscriptions").update(update_data).eq("user_id", user_id).execute()

    # Note: User retains access during grace period
    # RevenueCat SDK handles this automatically on the client side
    # For server-side checks, compare current time with grace_period_ends_at

    # TODO: Send email/notification to user about billing issue


async def handle_product_change(supabase, event: RevenueCatEvent, user_id: str):
    """Handle plan change (upgrade/downgrade)"""
    new_plan = get_plan_from_product_id(event.product_id)

    expires_at = None
    if event.expiration_at_ms:
        expires_at = datetime.fromtimestamp(event.expiration_at_ms / 1000).isoformat()

    supabase.table("subscriptions").update(
        {
            "plan": new_plan,
            "product_id": event.product_id,
            "expires_date": expires_at,
            "status": "active",
            "updated_at": datetime.utcnow().isoformat(),
        }
    ).eq("user_id", user_id).execute()

    # Update user's plan
    supabase.table("users").update({"plan": new_plan}).eq("id", user_id).execute()

    logger.info(f"Plan changed for user {user_id} to {new_plan}")


async def handle_subscription_transfer(supabase, event: RevenueCatEvent, user_id: str):
    """Handle subscription transfer to different user"""
    # This is rare - usually happens when user creates new account
    # The new user_id is in app_user_id, original_app_user_id has the old one

    old_user_id = event.original_app_user_id
    new_user_id = event.app_user_id

    if old_user_id and new_user_id and old_user_id != new_user_id:
        # Deactivate old subscription
        supabase.table("subscriptions").update(
            {
                "status": "transferred",
                "updated_at": datetime.utcnow().isoformat(),
            }
        ).eq("user_id", old_user_id).execute()

        # Downgrade old user to free
        supabase.table("users").update({"plan": "free"}).eq("id", old_user_id).execute()

        # Handle new user as active subscription
        await handle_subscription_active(supabase, event, new_user_id)

        logger.info(f"Subscription transferred from {old_user_id} to {new_user_id}")


# Health check endpoint for webhook testing
@router.get("/revenuecat/health")
async def webhook_health():
    """Health check for webhook endpoint"""
    return {
        "status": "healthy",
        "auth_configured": bool(REVENUECAT_WEBHOOK_SECRET),
    }
