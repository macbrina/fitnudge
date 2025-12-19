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

Features:
- Idempotency: Each event is processed only once
- Async processing: Heavy operations don't block webhook response
- Deactivation handling: Automatic goal/challenge cleanup on expiry
- Audit logging: All subscription changes are logged

Setup in RevenueCat Dashboard:
1. Go to Project Settings > Integrations > Webhooks
2. Add your webhook URL: https://your-api.com/api/v1/webhooks/revenuecat
3. Set Authorization header value (e.g., "Bearer your-secret-token")
4. Add to environment: REVENUECAT_WEBHOOK_SECRET=Bearer your-secret-token
"""

from fastapi import APIRouter, HTTPException, Request, Header, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import hmac
import os
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(redirect_slashes=False)

# RevenueCat webhook secret
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
    grace_period_expiration_at_ms: Optional[int] = None
    id: Optional[str] = None
    is_family_share: Optional[bool] = None
    offer_code: Optional[str] = None
    original_app_user_id: Optional[str] = None
    original_transaction_id: Optional[str] = None
    period_type: Optional[str] = None
    presented_offering_id: Optional[str] = None
    price: Optional[float] = None
    price_in_purchased_currency: Optional[float] = None
    product_id: Optional[str] = None
    purchased_at_ms: Optional[int] = None
    store: Optional[str] = None
    subscriber_attributes: Optional[dict] = None
    takehome_percentage: Optional[float] = None
    tax_percentage: Optional[float] = None
    transaction_id: Optional[str] = None
    type: str


class RevenueCatWebhook(BaseModel):
    api_version: Optional[str] = None
    event: RevenueCatEvent


def get_plan_from_product_id(product_id: str) -> str:
    """Map product ID to plan name"""
    if not product_id:
        return "free"

    product_id_lower = product_id.lower()

    if "elite" in product_id_lower:
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


async def is_event_already_processed(supabase, event_id: str) -> bool:
    """Check if event has already been processed (idempotency check)."""
    if not event_id:
        return False

    try:
        result = (
            supabase.table("webhook_events")
            .select("id, status")
            .eq("event_id", event_id)
            .execute()
        )

        if result.data:
            status = result.data[0].get("status")
            # If already completed or processing, skip
            return status in ["completed", "processing"]

        return False
    except Exception as e:
        logger.error(f"Error checking event idempotency: {e}")
        return False


async def mark_event_processing(
    supabase, event_id: str, event_type: str, user_id: str, payload: dict
):
    """Mark event as being processed."""
    try:
        supabase.table("webhook_events").upsert(
            {
                "event_id": event_id,
                "event_type": event_type,
                "user_id": user_id,
                "status": "processing",
                "payload": payload,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            },
            on_conflict="event_id",
        ).execute()
    except Exception as e:
        logger.error(f"Error marking event as processing: {e}")


async def mark_event_completed(supabase, event_id: str):
    """Mark event as successfully completed."""
    try:
        supabase.table("webhook_events").update(
            {
                "status": "completed",
                "processed_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }
        ).eq("event_id", event_id).execute()
    except Exception as e:
        logger.error(f"Error marking event as completed: {e}")


async def mark_event_failed(supabase, event_id: str, error_message: str):
    """Mark event as failed with error message."""
    try:
        # Get current retry count
        result = (
            supabase.table("webhook_events")
            .select("retry_count")
            .eq("event_id", event_id)
            .execute()
        )

        retry_count = (result.data[0].get("retry_count", 0) if result.data else 0) + 1

        supabase.table("webhook_events").update(
            {
                "status": "failed",
                "error_message": error_message,
                "retry_count": retry_count,
                "updated_at": datetime.utcnow().isoformat(),
            }
        ).eq("event_id", event_id).execute()
    except Exception as e:
        logger.error(f"Error marking event as failed: {e}")


@router.post("/revenuecat")
async def revenuecat_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None),
):
    """
    Handle RevenueCat webhook events with idempotency.

    This endpoint:
    1. Validates the authorization header
    2. Checks if the event was already processed (idempotency)
    3. Processes the event
    4. Returns quickly (heavy operations run in background)
    """
    from app.core.database import get_supabase_client

    # Verify Authorization header
    if REVENUECAT_WEBHOOK_SECRET:
        if not authorization:
            logger.warning("Missing Authorization header")
            raise HTTPException(status_code=401, detail="Missing Authorization header")

        if not hmac.compare_digest(authorization, REVENUECAT_WEBHOOK_SECRET):
            logger.warning("Invalid Authorization header")
            raise HTTPException(status_code=401, detail="Unauthorized")
    else:
        logger.warning("REVENUECAT_WEBHOOK_SECRET not configured, skipping auth check")

    # Parse webhook payload
    body = await request.body()

    try:
        payload = json.loads(body)
        webhook = RevenueCatWebhook(**payload)
        event = webhook.event
    except Exception as e:
        logger.error(f"Failed to parse webhook payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")

    print(f"Received RevenueCat webhook: {event.type} for user {event.app_user_id}")

    supabase = get_supabase_client()

    # Get event ID for idempotency
    event_id = (
        event.id or f"{event.type}_{event.app_user_id}_{event.event_timestamp_ms}"
    )

    # Idempotency check
    if await is_event_already_processed(supabase, event_id):
        logger.info(f"Event {event_id} already processed, skipping")
        return {"status": "already_processed", "event_id": event_id}

    # Get user ID
    user_id = event.app_user_id or event.original_app_user_id

    if not user_id:
        print("No user ID in webhook event")
        return {"status": "skipped", "reason": "no_user_id"}

    # Mark as processing
    await mark_event_processing(supabase, event_id, event.type, user_id, payload)

    # Process event
    try:
        if event.type in ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION"]:
            await handle_subscription_active(supabase, event, user_id)

        elif event.type == "CANCELLATION":
            await handle_subscription_cancelled(supabase, event, user_id)

        elif event.type == "EXPIRATION":
            # This is the critical one - needs deactivation logic
            await handle_subscription_expired(supabase, event, user_id)

        elif event.type == "BILLING_ISSUE":
            await handle_billing_issue(supabase, event, user_id)

        elif event.type == "PRODUCT_CHANGE":
            await handle_product_change(supabase, event, user_id)

        elif event.type == "TRANSFER":
            await handle_subscription_transfer(supabase, event, user_id)

        else:
            logger.info(f"Unhandled event type: {event.type}")

        # Mark as completed
        await mark_event_completed(supabase, event_id)

    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        await mark_event_failed(supabase, event_id, str(e))
        # Don't raise - return 200 to prevent RevenueCat retries for processing errors
        return {"status": "error", "message": str(e), "event_id": event_id}

    return {"status": "success", "event_type": event.type, "event_id": event_id}


async def handle_subscription_active(supabase, event: RevenueCatEvent, user_id: str):
    """Handle active subscription (new purchase, renewal, uncancellation)"""
    plan = get_plan_from_product_id(event.product_id)
    platform = get_platform_from_store(event.store or "")

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

    # auto_renew is True for active subscription events
    # INITIAL_PURCHASE, RENEWAL, UNCANCELLATION all indicate user intends to keep subscription
    auto_renew = event.type in ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION"]

    subscription_data = {
        "user_id": user_id,
        "plan": plan,
        "status": "active",
        "platform": platform,
        "product_id": event.product_id,
        "purchase_date": purchased_at,
        "expires_date": expires_at,
        "auto_renew": auto_renew,
        "revenuecat_event_id": event.id,
        "environment": event.environment,
        "grace_period_ends_at": None,
        "updated_at": datetime.utcnow().isoformat(),
    }

    if existing.data:
        supabase.table("subscriptions").update(subscription_data).eq(
            "user_id", user_id
        ).execute()
        logger.info(f"Updated subscription for user {user_id}: {plan}")
    else:
        subscription_data["created_at"] = datetime.utcnow().isoformat()
        supabase.table("subscriptions").insert(subscription_data).execute()
        logger.info(f"Created subscription for user {user_id}: {plan}")

    # Update user's plan
    supabase.table("users").update({"plan": plan}).eq("id", user_id).execute()


async def handle_subscription_cancelled(supabase, event: RevenueCatEvent, user_id: str):
    """Handle subscription cancellation (still active until expiry)"""
    supabase.table("subscriptions").update(
        {
            "auto_renew": False,
            "status": "cancelled",
            "updated_at": datetime.utcnow().isoformat(),
        }
    ).eq("user_id", user_id).execute()

    logger.info(
        f"Subscription cancelled for user {user_id} (still active until expiry)"
    )


async def handle_subscription_expired(supabase, event: RevenueCatEvent, user_id: str):
    """
    Handle subscription expiration.

    This is the critical handler that:
    1. Updates subscription status to 'expired'
    2. Downgrades user to free plan
    3. Deactivates excess goals beyond free tier limit
    4. Cancels challenges created by the user
    5. Removes user from group goals
    """
    from app.services.subscription_service import (
        handle_subscription_expiry_deactivation,
    )

    # Get current plan before expiring
    user_result = (
        supabase.table("users").select("plan").eq("id", user_id).single().execute()
    )
    previous_plan = (
        user_result.data.get("plan", "unknown") if user_result.data else "unknown"
    )

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

    # Handle all deactivations
    try:
        summary = await handle_subscription_expiry_deactivation(
            supabase, user_id, previous_plan, reason="subscription_expired"
        )

        logger.info(f"Subscription expired for user {user_id}: {summary}")

        # Send push notification about subscription expiry
        try:
            from app.services.expo_push_service import send_push_to_user

            goals_msg = ""
            if summary["goals_deactivated"] > 0:
                goals_msg = f"{summary['goals_deactivated']} goal(s) paused"
            if summary["challenges_cancelled"] > 0:
                if goals_msg:
                    goals_msg += ", "
                goals_msg += f"{summary['challenges_cancelled']} challenge(s) ended"

            body = "Your premium features are no longer active."
            if goals_msg:
                body = f"{goals_msg}. Upgrade to reactivate them."

            await send_push_to_user(
                user_id,
                title="Subscription Expired",
                body=body,
                data={
                    "type": "subscription_expired",
                    "previous_plan": previous_plan,
                    "goals_deactivated": summary["goals_deactivated"],
                    "challenges_cancelled": summary["challenges_cancelled"],
                },
                notification_type="subscription",
            )
        except Exception as notify_error:
            logger.error(
                f"Failed to send expiry notification to {user_id}: {notify_error}"
            )

    except Exception as e:
        logger.error(
            f"Error handling subscription expiry deactivation for {user_id}: {e}"
        )
        # Don't re-raise - subscription status is already updated


async def handle_billing_issue(supabase, event: RevenueCatEvent, user_id: str):
    """
    Handle billing issue (payment failed).
    User retains access during grace period.
    """
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

    if grace_period_ends_at:
        update_data["grace_period_ends_at"] = grace_period_ends_at
        logger.warning(
            f"Billing issue for user {user_id}, grace period ends at {grace_period_ends_at}"
        )
    else:
        logger.warning(f"Billing issue for user {user_id}, no grace period info")

    supabase.table("subscriptions").update(update_data).eq("user_id", user_id).execute()

    # Send push notification about billing issue
    try:
        from app.services.expo_push_service import send_push_to_user

        if grace_period_ends_at:
            # Parse the date to format nicely
            grace_date = datetime.fromisoformat(
                grace_period_ends_at.replace("Z", "+00:00")
            )
            formatted_date = grace_date.strftime("%B %d")
            body = f"Please update your payment method by {formatted_date} to keep your premium features."
        else:
            body = "Please update your payment method to continue your subscription."

        await send_push_to_user(
            user_id,
            title="Payment Issue",
            body=body,
            data={
                "type": "billing_issue",
                "grace_period_ends_at": grace_period_ends_at,
            },
            notification_type="subscription",
        )
    except Exception as notify_error:
        logger.error(
            f"Failed to send billing issue notification to {user_id}: {notify_error}"
        )


async def handle_product_change(supabase, event: RevenueCatEvent, user_id: str):
    """Handle plan change (upgrade/downgrade)"""
    from app.services.subscription_service import (
        handle_subscription_expiry_deactivation,
    )

    new_plan = get_plan_from_product_id(event.product_id)

    # Get current plan
    user_result = (
        supabase.table("users").select("plan").eq("id", user_id).single().execute()
    )
    previous_plan = user_result.data.get("plan", "free") if user_result.data else "free"

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

    logger.info(f"Plan changed for user {user_id} from {previous_plan} to {new_plan}")

    # Check if this is a downgrade that requires deactivation
    plan_tiers = {"free": 0, "starter": 1, "pro": 2, "elite": 3}

    if plan_tiers.get(new_plan, 0) < plan_tiers.get(previous_plan, 0):
        # This is a downgrade - may need to deactivate excess items
        try:
            summary = await handle_subscription_expiry_deactivation(
                supabase, user_id, previous_plan, reason="manual"  # Voluntary downgrade
            )
            logger.info(f"Downgrade deactivation for user {user_id}: {summary}")
        except Exception as e:
            logger.error(f"Error handling downgrade deactivation for {user_id}: {e}")


async def handle_subscription_transfer(supabase, event: RevenueCatEvent, user_id: str):
    """Handle subscription transfer to different user"""
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

        # Downgrade old user to free and handle deactivations
        supabase.table("users").update({"plan": "free"}).eq("id", old_user_id).execute()

        from app.services.subscription_service import (
            handle_subscription_expiry_deactivation,
        )

        try:
            await handle_subscription_expiry_deactivation(
                supabase,
                old_user_id,
                "unknown",  # We don't know their previous plan
                reason="transfer",
            )
        except Exception as e:
            logger.error(f"Error handling transfer deactivation for {old_user_id}: {e}")

        # Handle new user as active subscription
        await handle_subscription_active(supabase, event, new_user_id)

        logger.info(f"Subscription transferred from {old_user_id} to {new_user_id}")


# Health check endpoint
@router.get("/revenuecat/health")
async def webhook_health():
    """Health check for webhook endpoint"""
    return {
        "status": "healthy",
        "auth_configured": bool(REVENUECAT_WEBHOOK_SECRET),
    }
