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


async def process_referral_bonus(new_user_id: str, referrer_user_id: str) -> bool:
    """Grant referral bonus to the referrer when referred user subscribes

    This is triggered when a referred user makes their first subscription purchase.
    The referrer gets bonus days as a reward for bringing in a paying customer.

    Bonuses:
    - Referrer: +7 days (extends their current subscription/trial)
    - New user: No bonus needed - they're already a paying subscriber!

    Args:
        new_user_id: The user who subscribed (was referred)
        referrer_user_id: The ID of the user who referred them

    Returns:
        True if bonus was granted successfully
    """
    supabase = get_supabase_client()

    # Check if bonus was already granted (prevent double-granting)
    user_check = (
        supabase.table("users")
        .select("referral_bonus_granted_at")
        .eq("id", new_user_id)
        .execute()
    )

    if user_check.data and user_check.data[0].get("referral_bonus_granted_at"):
        logger.info(
            "Referral bonus already granted, skipping",
            {"new_user_id": new_user_id, "referrer_user_id": referrer_user_id},
        )
        return False

    try:
        # Grant +7 days to referrer (extends their current subscription)
        # The referred user is already paying, so they don't need bonus days
        referrer_success = await grant_promotional_access(
            referrer_user_id, bonus_days=7, entitlement_id="premium_access"
        )

        # Mark bonus as granted (prevent double-granting)
        supabase.table("users").update(
            {"referral_bonus_granted_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", new_user_id).execute()

        logger.info(
            "Processed referral bonus on subscription",
            {
                "subscriber_id": new_user_id,
                "referrer_user_id": referrer_user_id,
                "referrer_bonus_days": 7 if referrer_success else 0,
            },
        )

        return referrer_success

    except Exception as e:
        logger.error(
            "Error processing referral bonus",
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
    """Generate a unique invite code for challenges/goals/partners

    Returns:
        A 12-character invite code
    """
    return secrets.token_urlsafe(9)  # 12 characters


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
    """Get all users referred by a specific user

    Args:
        user_id: The referrer's user ID

    Returns:
        List of referred users with basic info
    """
    supabase = get_supabase_client()

    result = (
        supabase.table("users")
        .select("id, username, name, created_at, referral_bonus_granted_at")
        .eq("referred_by_user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    return result.data if result.data else []
