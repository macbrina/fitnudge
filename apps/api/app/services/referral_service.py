"""
Referral Service

Handles user referrals and RevenueCat promotional entitlement grants.
"""

import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx

from app.core.config import settings
from app.core.database import get_supabase_client
from app.services.logger import logger

REVENUECAT_API_URL = "https://api.revenuecat.com/v1"


async def delete_subscriber(user_id: str) -> bool:
    """Delete subscriber from RevenueCat (GDPR compliance on account deletion).

    Removes all user data and purchase history from RevenueCat.
    Does NOT cancel Apple/Google subscriptions - user must cancel in store.

    Returns:
        True if successful or not configured, False on API error.
    """
    if not settings.REVENUECAT_SECRET_KEY:
        logger.warning(
            "REVENUECAT_SECRET_KEY not configured, skipping subscriber deletion",
            {"user_id": user_id},
        )
        return True

    try:
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{REVENUECAT_API_URL}/subscribers/{user_id}",
                headers={
                    "Authorization": f"Bearer {settings.REVENUECAT_SECRET_KEY}",
                    "Content-Type": "application/json",
                },
                timeout=10.0,
            )

            if response.is_success:
                logger.info(
                    "Deleted subscriber from RevenueCat",
                    {"user_id": user_id},
                )
                return True
            else:
                logger.warning(
                    "Failed to delete subscriber from RevenueCat (may not exist)",
                    {
                        "user_id": user_id,
                        "status_code": response.status_code,
                        "response": response.text[:200],
                    },
                )
                return False

    except Exception as e:
        logger.error(
            "Error deleting subscriber from RevenueCat",
            {"user_id": user_id, "error": str(e)},
        )
        return False


async def get_subscriber_info(user_id: str) -> Optional[dict]:
    """Get subscriber info from RevenueCat to check current entitlement expiration

    Args:
        user_id: The RevenueCat app user ID

    Returns:
        Subscriber info dict or None if not found
    """
    if not settings.REVENUECAT_SECRET_KEY:
        return None

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{REVENUECAT_API_URL}/subscribers/{user_id}",
                headers={
                    "Authorization": f"Bearer {settings.REVENUECAT_SECRET_KEY}",
                    "Content-Type": "application/json",
                },
                timeout=10.0,
            )

            if response.is_success:
                return response.json().get("subscriber", {})
            return None

    except Exception as e:
        logger.error(
            "Error getting subscriber info from RevenueCat",
            {"user_id": user_id, "error": str(e)},
        )
        return None


async def grant_promotional_access(
    user_id: str,
    bonus_days: int = 3,
    entitlement_id: str = "premium_access",
) -> bool:
    """Grant promotional entitlement via RevenueCat API

    This uses end_time_ms (preferred over deprecated 'duration') to:
    - If user has existing entitlement: extend from current expiration
    - If user has no entitlement: grant from now

    Args:
        user_id: The RevenueCat app user ID (usually same as our user ID)
        bonus_days: Number of days to grant/extend
        entitlement_id: The entitlement to grant (default: premium_access)

    Returns:
        True if successful, False otherwise
    """
    if not settings.REVENUECAT_SECRET_KEY:
        logger.warning(
            "REVENUECAT_SECRET_KEY not configured, skipping promotional grant",
            {"user_id": user_id, "bonus_days": bonus_days},
        )
        return False

    try:
        # Get current subscriber info to check if they have an existing entitlement
        subscriber = await get_subscriber_info(user_id)

        # Calculate end time
        now = datetime.now(timezone.utc)
        base_time = now

        # Check if user has existing entitlement that expires in the future
        if subscriber:
            entitlements = subscriber.get("entitlements", {})
            entitlement = entitlements.get(entitlement_id, {})
            expires_date_str = entitlement.get("expires_date")

            if expires_date_str:
                try:
                    # Parse ISO format: 2024-01-15T10:30:00Z
                    expires_date = datetime.fromisoformat(
                        expires_date_str.replace("Z", "+00:00")
                    )
                    # If expiration is in the future, extend from there
                    if expires_date > now:
                        base_time = expires_date
                        logger.info(
                            "Extending existing entitlement",
                            {
                                "user_id": user_id,
                                "current_expires": expires_date_str,
                                "bonus_days": bonus_days,
                            },
                        )
                except Exception:
                    pass  # Use now as base if parsing fails

        # Calculate new end time
        end_time = base_time + timedelta(days=bonus_days)
        end_time_ms = int(end_time.timestamp() * 1000)

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{REVENUECAT_API_URL}/subscribers/{user_id}/entitlements/{entitlement_id}/promotional",
                headers={
                    "Authorization": f"Bearer {settings.REVENUECAT_SECRET_KEY}",
                    "Content-Type": "application/json",
                },
                json={"end_time_ms": end_time_ms},
                timeout=10.0,
            )

            if response.is_success:
                logger.info(
                    "Granted promotional access via RevenueCat",
                    {
                        "user_id": user_id,
                        "bonus_days": bonus_days,
                        "end_time": end_time.isoformat(),
                        "entitlement_id": entitlement_id,
                    },
                )
                return True
            else:
                logger.error(
                    "Failed to grant promotional access via RevenueCat",
                    {
                        "user_id": user_id,
                        "bonus_days": bonus_days,
                        "status_code": response.status_code,
                        "response": response.text,
                    },
                )
                return False

    except Exception as e:
        logger.error(
            "Error granting promotional access",
            {"user_id": user_id, "error": str(e)},
        )
        return False


REFERRER_CAP_DAYS = 30
BONUS_DAYS_PER_REFERRAL = 7


def _update_user_plan_for_promo(supabase, user_id: str, bonus_days: int) -> None:
    """Update backend users.plan and subscriptions for promotional grant.

    RevenueCat does not send webhooks for promotional grants, so we must update
    our DB so the user sees premium immediately (e.g. referrer opening the app).
    """
    try:
        now = datetime.now(timezone.utc)
        expires_at = (now + timedelta(days=bonus_days)).isoformat()

        supabase.table("users").update({"plan": "premium"}).eq("id", user_id).execute()

        existing = (
            supabase.table("subscriptions")
            .select("id, expires_date")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )

        now_iso = now.isoformat()
        if existing and existing.data:
            # Update: extending existing subscription (may be paid user's or referrer's)
            # Do NOT overwrite auto_renew, cancel_at_period_end, platform - user may have paid sub
            update_data = {
                "plan": "premium",
                "status": "active",
                "expires_date": expires_at,
                "current_period_start": now_iso,
                "current_period_end": expires_at,
                "updated_at": now_iso,
            }
            promo_end = now + timedelta(days=bonus_days)
            current_expires = existing.data.get("expires_date")
            if current_expires:
                try:
                    ce = datetime.fromisoformat(current_expires.replace("Z", "+00:00"))
                    if ce > promo_end:
                        update_data["expires_date"] = current_expires
                except Exception:
                    pass
            update_data["current_period_end"] = update_data["expires_date"]
            supabase.table("subscriptions").update(update_data).eq(
                "user_id", user_id
            ).execute()
        else:
            # Insert: new subscription from referral bonus (e.g. referrer who was free)
            # Promo-only: no auto-renew, ends at period end
            sub_data = {
                "user_id": user_id,
                "plan": "premium",
                "status": "active",
                "platform": "promo",
                "expires_date": expires_at,
                "current_period_start": now_iso,
                "current_period_end": expires_at,
                "auto_renew": False,
                "cancel_at_period_end": True,
                "created_at": now_iso,
                "purchase_date": now_iso,
                "updated_at": now_iso,
            }
            supabase.table("subscriptions").insert(sub_data).execute()

        logger.info("Updated backend plan for promo grant", {"user_id": user_id})
    except Exception as e:
        logger.warning(
            "Failed to update backend plan for promo grant",
            {"user_id": user_id, "error": str(e)},
        )


async def process_referral_bonus(new_user_id: str, referrer_user_id: str) -> bool:
    """Grant referral bonus to both referrer and referred user when referred user subscribes.

    Uses referrals table for idempotency and per-referral tracking.
    Referrer is capped at 30 days total across all referrals.

    Bonuses:
    - Referrer: min(7, 30 - earned_so_far) days
    - Referred user: +7 days (always)

    Args:
        new_user_id: The user who subscribed (was referred)
        referrer_user_id: The ID of the user who referred them

    Returns:
        True if at least one bonus was granted successfully
    """
    print(f"[REFERRAL] process_referral_bonus ENTRY: new_user_id={new_user_id}, referrer_user_id={referrer_user_id}")
    supabase = get_supabase_client()

    # 1) Fetch or create referral record
    referral_result = (
        supabase.table("referrals")
        .select("*")
        .eq("referred_user_id", new_user_id)
        .execute()
    )

    referral = referral_result.data[0] if referral_result.data else None

    if referral:
        print(f"[REFERRAL] Found referral record: status={referral.get('status')}, id={referral.get('id')}")
        if referral.get("status") == "rewarded":
            print(f"[REFERRAL] Referral already rewarded, skipping (idempotent)")
            logger.info(
                "Referral bonus already granted, skipping (idempotent)",
                {"new_user_id": new_user_id, "referrer_user_id": referrer_user_id},
            )
            return False
    else:
        print(f"[REFERRAL] No referral record found, creating fallback (legacy path)")
        # Fallback: create record if only referred_by_user_id was set (legacy/pre-migration)
        try:
            supabase.table("referrals").insert(
                {
                    "referrer_user_id": referrer_user_id,
                    "referred_user_id": new_user_id,
                    "status": "subscribed",
                    "bonus_days_referrer": BONUS_DAYS_PER_REFERRAL,
                    "bonus_days_referred": BONUS_DAYS_PER_REFERRAL,
                }
            ).execute()
        except Exception as e:
            print(f"[REFERRAL] ERROR creating fallback referral record: {e}")
            logger.warning(
                "Could not create referral record for bonus processing",
                {"new_user_id": new_user_id, "error": str(e)},
            )
            return False

    # 2) Calculate referrer remaining cap (30 days total)
    earned_result = (
        supabase.table("referrals")
        .select("bonus_days_referrer")
        .eq("referrer_user_id", referrer_user_id)
        .eq("status", "rewarded")
        .execute()
    )
    earned_days = sum(
        r.get("bonus_days_referrer") or 0 for r in (earned_result.data or [])
    )
    remaining = max(0, REFERRER_CAP_DAYS - earned_days)
    referrer_days_to_grant = min(BONUS_DAYS_PER_REFERRAL, remaining)
    print(f"[REFERRAL] Cap: earned={earned_days}, remaining={remaining}, referrer_days_to_grant={referrer_days_to_grant}")

    # 3) Atomic claim via RPC: set status=processing (not rewarded until grant succeeds)
    try:
        claim_result = (
            supabase.rpc(
                "claim_referral_for_reward",
                {
                    "p_referred_user_id": new_user_id,
                    "p_bonus_days_referrer": referrer_days_to_grant,
                    "p_bonus_days_referred": BONUS_DAYS_PER_REFERRAL,
                },
            ).execute()
        )
    except Exception as e:
        logger.warning(f"claim_referral_for_reward RPC failed, using table update: {e}")
        claim_result = (
            supabase.table("referrals")
            .update(
                {
                    "status": "processing",
                    "bonus_days_referrer": referrer_days_to_grant,
                    "bonus_days_referred": BONUS_DAYS_PER_REFERRAL,
                }
            )
            .eq("referred_user_id", new_user_id)
            .in_("status", ["pending", "subscribed", "failed"])
            .execute()
        )
    if not claim_result.data:
        print(f"[REFERRAL] Claim failed - already claimed/processed or no matching record")
        logger.info(
            "Referral bonus already claimed/processed, skipping",
            {"new_user_id": new_user_id, "referrer_user_id": referrer_user_id},
        )
        return False

    print(f"[REFERRAL] Claim succeeded, granting promos via RevenueCat...")
    # 4) Grant promos via RevenueCat (only mark rewarded after success)
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        referrer_success = False
        if referrer_days_to_grant > 0:
            referrer_success = await grant_promotional_access(
                referrer_user_id,
                bonus_days=referrer_days_to_grant,
                entitlement_id="premium_access",
            )

        referred_success = await grant_promotional_access(
            new_user_id,
            bonus_days=BONUS_DAYS_PER_REFERRAL,
            entitlement_id="premium_access",
        )

        # Mark rewarded only if BOTH grants succeeded (or referrer cap was 0)
        referrer_ok = (referrer_days_to_grant == 0) or referrer_success
        referred_ok = referred_success

        if referrer_ok and referred_ok:
            supabase.table("referrals").update(
                {"status": "rewarded", "rewarded_at": now_iso}
            ).eq("referred_user_id", new_user_id).eq("status", "processing").execute()
            print(f"[REFERRAL] SUCCESS: Both bonuses granted. referrer_success={referrer_success}, referred_success={referred_success}. Marked rewarded.")

            # Update backend plan for referrer - RevenueCat doesn't send webhooks for
            # promotional grants, so the referrer would stay "free" until app sync.
            if referrer_success and referrer_days_to_grant > 0:
                _update_user_plan_for_promo(supabase, referrer_user_id, referrer_days_to_grant)

            logger.info(
                "Processed referral bonus on subscription",
                {
                    "subscriber_id": new_user_id,
                    "referrer_user_id": referrer_user_id,
                    "referrer_bonus_days": referrer_days_to_grant,
                    "referred_bonus_days": BONUS_DAYS_PER_REFERRAL,
                },
            )
            return True
        else:
            print(f"[REFERRAL] FAILED: referrer_ok={referrer_ok}, referred_ok={referred_ok}, referrer_success={referrer_success}, referred_success={referred_success}")
            supabase.table("referrals").update(
                {"status": "failed"}
            ).eq("referred_user_id", new_user_id).eq("status", "processing").execute()
            logger.warning(
                "Referral grant failed (partial or both failed), marked failed for retry",
                {
                    "new_user_id": new_user_id,
                    "referrer_user_id": referrer_user_id,
                    "referrer_success": referrer_success,
                    "referred_success": referred_success,
                },
            )
            return False
    except Exception as e:
        print(f"[REFERRAL] EXCEPTION in process_referral_bonus: {e}")
        supabase.table("referrals").update(
            {"status": "failed"}
        ).eq("referred_user_id", new_user_id).eq("status", "processing").execute()
        logger.error(
            "Error granting referral promo, marked failed for retry",
            {
                "new_user_id": new_user_id,
                "referrer_user_id": referrer_user_id,
                "error": str(e),
            },
        )
        return False


def generate_referral_code(username: str) -> str:
    """Generate unique referral code like JOHN1234

    Args:
        username: The user's username to derive prefix from

    Returns:
        A unique referral code string
    """
    # Take first 4 characters of username (or less if shorter), uppercase
    prefix = username[:4].upper() if username else "USER"
    # Add 4 random hex characters
    suffix = secrets.token_hex(2).upper()
    return f"{prefix}{suffix}"


def generate_invite_code() -> str:
    """Generate a unique invite code for goals/partners

    Returns:
        A 12-character invite code
    """
    return secrets.token_urlsafe(9)  # 12 characters


async def create_referral_record(referrer_user_id: str, referred_user_id: str) -> bool:
    """Create a pending referral record when a user signs up with a referral code.

    Call this at signup when referred_by_user_id is set. The record starts as 'pending'
    and is updated to 'rewarded' when the referred user subscribes.

    Args:
        referrer_user_id: The user who referred them
        referred_user_id: The new user who signed up with the code

    Returns:
        True if created, False if already exists or failed
    """
    print(f"[REFERRAL] create_referral_record: referrer={referrer_user_id}, referred={referred_user_id}")
    supabase = get_supabase_client()
    try:
        supabase.table("referrals").insert(
            {
                "referrer_user_id": referrer_user_id,
                "referred_user_id": referred_user_id,
                "status": "pending",
                "bonus_days_referrer": 7,
                "bonus_days_referred": 7,
            }
        ).execute()
        print(f"[REFERRAL] create_referral_record SUCCESS: record created")
        logger.info(
            "Created referral record",
            {"referrer_user_id": referrer_user_id, "referred_user_id": referred_user_id},
        )
        return True
    except Exception as e:
        # May fail if row already exists (e.g. backfill + new signup race)
        print(f"[REFERRAL] create_referral_record FAILED (may already exist): {e}")
        logger.warning(
            "Could not create referral record (may already exist)",
            {"referrer_user_id": referrer_user_id, "referred_user_id": referred_user_id, "error": str(e)},
        )
        return False


async def get_referrer_by_code(referral_code: str) -> Optional[dict]:
    """Look up a user by their referral code

    Args:
        referral_code: The referral code to look up

    Returns:
        User dict if found, None otherwise
    """
    if not referral_code:
        return None

    supabase = get_supabase_client()

    result = (
        supabase.table("users")
        .select("id, username, name")
        .eq("referral_code", referral_code.upper())
        .execute()
    )

    if result.data:
        return result.data[0]

    return None


async def get_user_referrals(user_id: str) -> list:
    """Get all users referred by a specific user (from referrals table).

    Returns list with backward-compatible shape: id, username, name, created_at,
    referral_bonus_granted_at (mapped from rewarded_at for UI compatibility).
    """
    supabase = get_supabase_client()

    # Join referrals with users to get referred user info
    result = (
        supabase.table("referrals")
        .select(
            "referred_user_id, status, rewarded_at, created_at, bonus_days_referrer"
        )
        .eq("referrer_user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    if not result.data:
        return []

    # Fetch referred users' details
    referred_ids = [r["referred_user_id"] for r in result.data]
    users_result = (
        supabase.table("users")
        .select("id, username, name, profile_picture_url")
        .in_("id", referred_ids)
        .execute()
    )
    users_by_id = {u["id"]: u for u in (users_result.data or [])}

    # Build response with backward-compatible shape
    formatted = []
    for ref in result.data:
        uid = ref["referred_user_id"]
        user_info = users_by_id.get(uid, {})
        status = ref.get("status", "pending")
        formatted.append(
            {
                "id": uid,
                "username": user_info.get("username"),
                "name": user_info.get("name"),
                "profile_picture_url": user_info.get("profile_picture_url"),
                "created_at": ref.get("created_at"),
                # Map rewarded_at for backward compat; also use status as fallback
                "referral_bonus_granted_at": ref.get("rewarded_at"),
                "bonus_days_referrer": ref.get("bonus_days_referrer"),
                "status": status,  # Include actual status for UI
            }
        )
    return formatted
