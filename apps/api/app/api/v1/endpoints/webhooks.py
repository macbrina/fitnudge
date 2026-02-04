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
- NON_RENEWING_PURCHASE: One-time purchase (lifetime, consumable)
- SUBSCRIPTION_EXTENDED: Subscription extended via store API

Features:
- Idempotency: Each event is processed only once
- Async processing: Heavy operations don't block webhook response
- Deactivation handling: Automatic goal cleanup on expiry
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
    is_trial_conversion: Optional[bool] = None  # RENEWAL: True when trial converted to paid
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
    """Map product ID to plan name (2-tier system: free + premium)"""
    if not product_id:
        return "free"

    product_id_lower = product_id.lower()

    # Any paid product is premium
    if "premium" in product_id_lower:
        return "premium"

    return "free"


def get_plan_from_entitlement_ids(
    entitlement_ids: Optional[List[str]],
) -> Optional[str]:
    """
    Derive plan from entitlement IDs (2-tier system: free + premium).
    Entitlement IDs are more reliable than product_id for determining the current plan,
    especially during product changes.

    Returns None if no valid entitlement found (caller should fallback to product_id).
    """
    if not entitlement_ids:
        return None

    # Check for premium entitlement
    for eid in entitlement_ids:
        eid_lower = eid.lower()
        if "premium" in eid_lower:
            return "premium"

    return None


def get_platform_from_store(store: str) -> str:
    """Map RevenueCat store to platform (ios, android, web, admin_granted, promo)"""
    store_map = {
        "APP_STORE": "ios",
        "MAC_APP_STORE": "ios",
        "PLAY_STORE": "android",
        "AMAZON": "android",
        "STRIPE": "stripe",
        "PROMOTIONAL": "promo",  # RevenueCat promo grants (referral, etc.)
    }
    return store_map.get(store, "unknown")


def _is_unique_violation(e: Exception) -> bool:
    """Check if exception is PostgreSQL unique constraint violation (23505)."""
    err = str(e).lower()
    return "23505" in err or "unique" in err or "duplicate" in err or "conflict" in err


async def try_claim_webhook_event(
    supabase, event_id: str, event_type: str, user_id: str, payload: dict
) -> bool:
    """
    Atomically claim event for processing via INSERT.
    Returns True if we claimed it (first to insert), False if already claimed/processed.
    """
    if not event_id:
        return False
    try:
        supabase.table("webhook_events").insert(
            {
                "event_id": event_id,
                "event_type": event_type,
                "user_id": user_id,
                "status": "processing",
                "payload": payload,
            }
        ).execute()
        return True
    except Exception as e:
        if _is_unique_violation(e):
            return False
        logger.error(f"Error claiming webhook event: {e}")
        raise


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

    # Get event ID for idempotency (include transaction_id for safer fallback)
    event_id = (
        event.id
        or f"{event.type}_{event.app_user_id}_{event.event_timestamp_ms or 0}_{getattr(event, 'transaction_id', '') or getattr(event, 'original_transaction_id', '')}"
    )

    # Get user ID
    user_id = event.app_user_id or event.original_app_user_id

    if not user_id:
        print("No user ID in webhook event")
        return {"status": "skipped", "reason": "no_user_id"}

    # Skip if user no longer exists (e.g. deleted account but subscription still active in store)
    user_exists = (
        supabase.table("users").select("id").eq("id", user_id).execute()
    )
    if not user_exists.data or len(user_exists.data) == 0:
        logger.warning(
            f"Skipping {event.type} webhook: user {user_id} not found in users table "
            "(likely deleted account with active subscription)"
        )
        return {"status": "skipped", "reason": "user_not_found"}

    # Atomic claim: only first request to insert succeeds
    claimed = await try_claim_webhook_event(
        supabase, event_id, event.type, user_id, payload
    )
    if not claimed:
        logger.info(f"Event {event_id} already claimed/processed, skipping")
        return {"status": "already_processed", "event_id": event_id}

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

        elif event.type == "NON_RENEWING_PURCHASE":
            await handle_non_renewing_purchase(supabase, event, user_id)

        elif event.type == "SUBSCRIPTION_EXTENDED":
            await handle_subscription_extended(supabase, event, user_id)

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


async def notify_partners_of_subscription_change(supabase, user_id: str):
    """
    Touch accountability_partners table to trigger realtime events for partners.

    When a user's subscription changes, their partners need to be notified so their
    PartnerDetailScreen can show updated premium access status.

    This updates the updated_at field on all partnerships involving this user,
    which triggers Supabase Realtime events to all partners.
    """
    try:
        # Update all partnerships where this user is either user_id or partner_user_id
        # This triggers realtime events to their partners
        result = (
            supabase.table("accountability_partners")
            .update({"updated_at": datetime.utcnow().isoformat()})
            .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
            .eq("status", "accepted")
            .execute()
        )

        partner_count = len(result.data) if result.data else 0
        if partner_count > 0:
            logger.info(
                f"Notified {partner_count} partners of subscription change for user {user_id}"
            )
    except Exception as e:
        # Don't fail the subscription update if partner notification fails
        logger.warning(f"Failed to notify partners of subscription change: {e}")


async def process_referral_bonus_on_subscription(supabase, user_id: str):
    """
    Grant referral bonus when a referred user makes their first actual paid purchase.

    Called only when:
    - INITIAL_PURCHASE with period_type NORMAL (direct paid, not trial)
    - RENEWAL with is_trial_conversion=True (trial converted to paid)
    - NON_RENEWING_PURCHASE (one-time/lifetime, always paid)

    Free trial starts (INITIAL_PURCHASE with period_type TRIAL/INTRO) do NOT trigger this.
    """
    try:
        print(f"[REFERRAL] process_referral_bonus_on_subscription called for user_id={user_id}")
        # Check if user was referred (idempotency handled in process_referral_bonus)
        user_result = (
            supabase.table("users")
            .select("id, referred_by_user_id")
            .eq("id", user_id)
            .execute()
        )

        if not user_result.data:
            print(f"[REFERRAL] No user found for user_id={user_id}, skipping")
            return

        user = user_result.data[0]
        referrer_id = user.get("referred_by_user_id")

        if referrer_id:
            from app.services.referral_service import process_referral_bonus

            print(f"[REFERRAL] User {user_id} was referred by {referrer_id}, calling process_referral_bonus")
            logger.info(
                f"Granting referral bonus: user {user_id} subscribed, referrer {referrer_id}"
            )
            result = await process_referral_bonus(user_id, referrer_id)
            print(f"[REFERRAL] process_referral_bonus returned {result} for user_id={user_id}")
        else:
            print(f"[REFERRAL] User {user_id} has no referred_by_user_id, skipping bonus")

    except Exception as e:
        # Don't fail the subscription if referral bonus fails
        print(f"[REFERRAL] ERROR in process_referral_bonus_on_subscription for user_id={user_id}: {e}")
        logger.error(f"Error processing referral bonus for user {user_id}: {e}")


async def handle_subscription_active(supabase, event: RevenueCatEvent, user_id: str):
    """Handle active subscription (new purchase, renewal, uncancellation)"""
    from app.services.subscription_service import reset_ai_coach_daily_usage_on_downgrade

    # Prefer entitlement_ids over product_id for plan determination
    # This is more reliable during product changes where RENEWAL may have stale product_id
    plan_from_entitlements = get_plan_from_entitlement_ids(event.entitlement_ids)
    plan_from_product = get_plan_from_product_id(event.product_id)

    # Use entitlement-derived plan if available, otherwise fall back to product_id
    plan = plan_from_entitlements or plan_from_product
    platform = get_platform_from_store(event.store or "")

    logger.info(
        f"Processing {event.type} for user {user_id}: "
        f"product_id={event.product_id}, plan_from_product={plan_from_product}, "
        f"entitlement_ids={event.entitlement_ids}, plan_from_entitlements={plan_from_entitlements}, "
        f"final_plan={plan}"
    )

    expires_at = None
    if event.expiration_at_ms:
        expires_at = datetime.fromtimestamp(event.expiration_at_ms / 1000).isoformat()

    purchased_at = None
    if event.purchased_at_ms:
        purchased_at = datetime.fromtimestamp(event.purchased_at_ms / 1000).isoformat()

    # Check if subscription exists and get current plan
    existing = (
        supabase.table("subscriptions")
        .select("id, plan, updated_at")
        .eq("user_id", user_id)
        .execute()
    )

    # For RENEWAL events, check if there was a recent PRODUCT_CHANGE that set a higher plan
    # This prevents RENEWAL from overwriting a plan upgrade with stale product_id
    if event.type == "RENEWAL" and existing.data:
        current_sub = existing.data[0]
        current_plan = current_sub.get("plan", "free")

        plan_tiers = {"free": 0, "premium": 1}
        current_tier = plan_tiers.get(current_plan, 0)
        new_tier = plan_tiers.get(plan, 0)

        if new_tier < current_tier:
            # RENEWAL is trying to set a lower plan than what's in DB
            # This likely means PRODUCT_CHANGE already upgraded the user
            # Keep the higher plan
            logger.warning(
                f"RENEWAL for user {user_id} has lower plan ({plan}) than current ({current_plan}). "
                f"Keeping current plan to avoid overwriting recent PRODUCT_CHANGE."
            )
            plan = current_plan

    # auto_renew is True for active subscription events
    # INITIAL_PURCHASE, RENEWAL, UNCANCELLATION all indicate user intends to keep subscription
    auto_renew = event.type in ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION"]

    now_iso = datetime.utcnow().isoformat()
    period_start = purchased_at or now_iso
    is_promo = platform == "promo"
    subscription_data = {
        "user_id": user_id,
        "plan": plan,
        "status": "active",
        "platform": platform,
        "product_id": event.product_id,
        "purchase_date": purchased_at,
        "expires_date": expires_at,
        "current_period_start": period_start,
        "current_period_end": expires_at,
        "auto_renew": False if is_promo else auto_renew,
        "revenuecat_event_id": event.id,
        "environment": event.environment,
        "grace_period_ends_at": None,
        "updated_at": now_iso,
    }
    if is_promo:
        subscription_data["cancel_at_period_end"] = True

    if existing.data:
        supabase.table("subscriptions").update(subscription_data).eq(
            "user_id", user_id
        ).execute()
        logger.info(f"Updated subscription for user {user_id}: {plan}")
    else:
        subscription_data["created_at"] = now_iso
        supabase.table("subscriptions").insert(subscription_data).execute()
        logger.info(f"Created subscription for user {user_id}: {plan}")

    # Update user's plan
    supabase.table("users").update({"plan": plan}).eq("id", user_id).execute()

    # Reset AI Coach daily usage on INITIAL_PURCHASE and RENEWAL (fresh slate for new period)
    if event.type in ["INITIAL_PURCHASE", "RENEWAL"]:
        await reset_ai_coach_daily_usage_on_downgrade(supabase, user_id)

    # Grant referral bonus only on actual paid purchase (not free trial start)
    # - INITIAL_PURCHASE with period_type NORMAL = direct paid purchase
    # - INITIAL_PURCHASE with period_type TRIAL/INTRO = free trial start, skip (grant on RENEWAL)
    # - RENEWAL with is_trial_conversion=True = trial converted to paid
    # - RENEWAL with period_type=NORMAL = paid period (covers trial conversion when flag missing, or regular renewal; idempotency prevents double-grant)
    is_paid_purchase = False
    if event.type == "INITIAL_PURCHASE":
        pt = (event.period_type or "").upper()
        if pt not in ("TRIAL", "INTRO"):
            is_paid_purchase = True
    elif event.type == "RENEWAL":
        pt = (event.period_type or "").upper()
        if event.is_trial_conversion or pt not in ("TRIAL", "INTRO"):
            is_paid_purchase = True
    print(f"[REFERRAL] handle_subscription_active: event_type={event.type}, period_type={event.period_type}, is_trial_conversion={event.is_trial_conversion}, is_paid_purchase={is_paid_purchase}")
    if is_paid_purchase:
        await process_referral_bonus_on_subscription(supabase, user_id)

    # Notify partners so their PartnerDetailScreen shows updated premium status
    await notify_partners_of_subscription_change(supabase, user_id)

    # Analytics: track new subscription (INITIAL_PURCHASE only)
    if event.type == "INITIAL_PURCHASE":
        try:
            from app.core.analytics import track_subscription_created

            track_subscription_created(user_id, plan, platform)
        except Exception as e:
            logger.warning(f"Failed to track subscription_created: {e}")


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
    """
    from app.services.subscription_service import (
        handle_subscription_expiry_deactivation,
        reset_ai_coach_daily_usage_on_downgrade,
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

    # Reset AI Coach daily usage for today so they get a fresh free limit (same day)
    await reset_ai_coach_daily_usage_on_downgrade(supabase, user_id)

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
            if summary.get("goals_deactivated", 0) > 0:
                goals_msg = f"{summary['goals_deactivated']} goal(s) paused"

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
                    "goals_deactivated": summary.get("goals_deactivated", 0),
                },
                notification_type="subscription",
                skip_preference_check=True,  # Critical - always send
                save_to_notification_history=False,  # No goal/partner; push + deepLink enough
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

    # Notify partners so their PartnerDetailScreen shows updated premium status
    await notify_partners_of_subscription_change(supabase, user_id)


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
            skip_preference_check=True,  # Critical - always send
            save_to_notification_history=False,  # No goal/partner; push + deepLink enough
        )
    except Exception as notify_error:
        logger.error(
            f"Failed to send billing issue notification to {user_id}: {notify_error}"
        )


async def handle_product_change(supabase, event: RevenueCatEvent, user_id: str):
    """Handle plan change (upgrade/downgrade). Single plan: used for resubscribe (free→premium)."""
    from app.services.subscription_service import (
        handle_subscription_expiry_deactivation,
        reset_ai_coach_daily_usage_on_downgrade,
    )

    # Prefer entitlement_ids over product_id for plan determination
    plan_from_entitlements = get_plan_from_entitlement_ids(event.entitlement_ids)
    plan_from_product = get_plan_from_product_id(event.product_id)
    new_plan = plan_from_entitlements or plan_from_product

    logger.info(
        f"Processing PRODUCT_CHANGE for user {user_id}: "
        f"product_id={event.product_id}, plan_from_product={plan_from_product}, "
        f"entitlement_ids={event.entitlement_ids}, plan_from_entitlements={plan_from_entitlements}, "
        f"final_new_plan={new_plan}"
    )

    # Get current plan
    user_result = (
        supabase.table("users").select("plan").eq("id", user_id).single().execute()
    )
    previous_plan = user_result.data.get("plan", "free") if user_result.data else "free"

    expires_at = None
    if event.expiration_at_ms:
        expires_at = datetime.fromtimestamp(event.expiration_at_ms / 1000).isoformat()

    purchased_at = None
    if event.purchased_at_ms:
        purchased_at = datetime.fromtimestamp(event.purchased_at_ms / 1000).isoformat()
    now_iso = datetime.utcnow().isoformat()
    period_start = purchased_at or now_iso

    supabase.table("subscriptions").update(
        {
            "plan": new_plan,
            "product_id": event.product_id,
            "expires_date": expires_at,
            "current_period_start": period_start,
            "current_period_end": expires_at,
            "status": "active",
            "updated_at": now_iso,
        }
    ).eq("user_id", user_id).execute()

    # Update user's plan
    supabase.table("users").update({"plan": new_plan}).eq("id", user_id).execute()

    logger.info(f"Plan changed for user {user_id} from {previous_plan} to {new_plan}")

    # Reset AI Coach daily usage for today on any plan change (upgrade or downgrade).
    # Upgrade: had free usage, now premium — fresh slate. Downgrade: had premium usage, now free — fresh free limit.
    await reset_ai_coach_daily_usage_on_downgrade(supabase, user_id)

    # Check if this is a downgrade that requires deactivation
    plan_tiers = {"free": 0, "premium": 1}

    if plan_tiers.get(new_plan, 0) < plan_tiers.get(previous_plan, 0):
        # Downgrade path: single plan so rarely hit; deactivate excess items if ever
        try:
            summary = await handle_subscription_expiry_deactivation(
                supabase, user_id, previous_plan, reason="manual"  # Voluntary downgrade
            )
            logger.info(f"Downgrade deactivation for user {user_id}: {summary}")
        except Exception as e:
            logger.error(f"Error handling downgrade deactivation for {user_id}: {e}")

    # Notify partners so their PartnerDetailScreen shows updated premium status
    await notify_partners_of_subscription_change(supabase, user_id)


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


async def handle_non_renewing_purchase(supabase, event: RevenueCatEvent, user_id: str):
    """
    Handle non-renewing purchase (lifetime, one-time unlocks, consumables).

    This is similar to INITIAL_PURCHASE but:
    - auto_renew is always False
    - May have no expiration date (lifetime purchases)
    """
    # Prefer entitlement_ids over product_id for plan determination
    plan_from_entitlements = get_plan_from_entitlement_ids(event.entitlement_ids)
    plan_from_product = get_plan_from_product_id(event.product_id)
    plan = plan_from_entitlements or plan_from_product
    platform = get_platform_from_store(event.store or "")

    logger.info(
        f"Processing NON_RENEWING_PURCHASE for user {user_id}: "
        f"product_id={event.product_id}, plan={plan}"
    )

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

    now_iso = datetime.utcnow().isoformat()
    period_start = purchased_at or now_iso
    subscription_data = {
        "user_id": user_id,
        "plan": plan,
        "status": "active",
        "platform": platform,
        "product_id": event.product_id,
        "purchase_date": purchased_at,
        "expires_date": expires_at,  # May be None for lifetime
        "current_period_start": period_start,
        "current_period_end": expires_at,
        "auto_renew": False,  # Non-renewing purchases never auto-renew
        "revenuecat_event_id": event.id,
        "environment": event.environment,
        "grace_period_ends_at": None,
        "updated_at": now_iso,
    }

    if existing.data:
        supabase.table("subscriptions").update(subscription_data).eq(
            "user_id", user_id
        ).execute()
        logger.info(f"Updated non-renewing subscription for user {user_id}: {plan}")
    else:
        subscription_data["created_at"] = now_iso
        supabase.table("subscriptions").insert(subscription_data).execute()
        logger.info(f"Created non-renewing subscription for user {user_id}: {plan}")

    # Update user's plan
    supabase.table("users").update({"plan": plan}).eq("id", user_id).execute()

    # Grant referral bonus on non-renewing purchase (lifetime, one-time)
    await process_referral_bonus_on_subscription(supabase, user_id)

    # Notify partners
    await notify_partners_of_subscription_change(supabase, user_id)


async def handle_subscription_extended(supabase, event: RevenueCatEvent, user_id: str):
    """
    Handle subscription extension (expiration date pushed to future).

    This can happen when:
    - Apple/Google extends subscription via their API
    - Google defers charging for a renewal by <24 hours
    """
    expires_at = None
    if event.expiration_at_ms:
        expires_at = datetime.fromtimestamp(event.expiration_at_ms / 1000).isoformat()

    if not expires_at:
        logger.warning(
            f"SUBSCRIPTION_EXTENDED for user {user_id} but no expiration_at_ms provided"
        )
        return

    # Update the subscription expiration date and period
    update_data = {
        "expires_date": expires_at,
        "current_period_end": expires_at,
        "status": "active",  # Ensure status is active
        "updated_at": datetime.utcnow().isoformat(),
    }
    result = (
        supabase.table("subscriptions")
        .update(update_data)
        .eq("user_id", user_id)
        .execute()
    )

    if result.data:
        logger.info(
            f"Subscription extended for user {user_id}, new expiry: {expires_at}"
        )
    else:
        logger.warning(
            f"SUBSCRIPTION_EXTENDED for user {user_id} but no subscription record found"
        )


# Health check endpoint
@router.get("/revenuecat/health")
async def webhook_health():
    """Health check for webhook endpoint"""
    return {
        "status": "healthy",
        "auth_configured": bool(REVENUECAT_WEBHOOK_SECRET),
    }
