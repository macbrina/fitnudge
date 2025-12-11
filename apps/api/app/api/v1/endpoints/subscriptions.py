from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
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


class AppleReceiptVerify(BaseModel):
    receipt_data: str
    product_id: str


class GooglePurchaseVerify(BaseModel):
    purchase_token: str
    product_id: str


class OfferCodeValidate(BaseModel):
    code: str
    product_id: str


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


# Apple In-App Purchase endpoints
@router.post("/iap/apple/verify-receipt")
async def verify_apple_receipt(
    receipt_data: AppleReceiptVerify, current_user: dict = Depends(get_current_user)
):
    """Verify Apple receipt after purchase"""
    # TODO: Implement Apple receipt verification
    # This would involve calling Apple's verifyReceipt API

    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Apple receipt verification not yet implemented",
    )


@router.post("/iap/apple/webhook")
async def apple_webhook(webhook_data: dict):
    """Handle Apple App Store Server Notifications"""
    # TODO: Implement Apple webhook handling
    # This would process subscription status changes from Apple

    return {"message": "Webhook received"}


@router.get("/iap/apple/products")
async def get_apple_products():
    """Get Apple product IDs"""
    return {
        "products": [
            {
                "product_id": "com.fitnudge.pro.monthly",
                "name": "Pro Monthly",
                "price": 4.99,
                "currency": "USD",
            },
            {
                "product_id": "com.fitnudge.pro.annual",
                "name": "Pro Annual",
                "price": 49.99,
                "currency": "USD",
            },
            {
                "product_id": "com.fitnudge.coach.monthly",
                "name": "Elite Monthly",
                "price": 9.99,
                "currency": "USD",
            },
            {
                "product_id": "com.fitnudge.coach.annual",
                "name": "Elite Annual",
                "price": 99.99,
                "currency": "USD",
            },
        ]
    }


@router.post("/iap/apple/restore")
async def restore_apple_purchases(current_user: dict = Depends(get_current_user)):
    """Restore previous Apple purchases"""
    # TODO: Implement Apple purchase restoration
    # This would check for existing purchases and restore subscription status

    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Apple purchase restoration not yet implemented",
    )


@router.post("/iap/apple/validate-offer")
async def validate_apple_offer(
    offer_data: OfferCodeValidate, current_user: dict = Depends(get_current_user)
):
    """Validate Apple Offer Code"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Check if offer code exists and is valid
    offer = (
        supabase.table("offer_codes")
        .select("*")
        .eq("code", offer_data.code)
        .eq("product_id", offer_data.product_id)
        .eq("is_active", True)
        .execute()
    )

    if not offer.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invalid offer code"
        )

    offer_info = offer.data[0]

    # Check if offer is still valid
    now = datetime.utcnow()
    if (
        offer_info["valid_until"]
        and datetime.fromisoformat(offer_info["valid_until"]) < now
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Offer code has expired"
        )

    if offer_info["max_uses"] and offer_info["used_count"] >= offer_info["max_uses"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Offer code has reached maximum uses",
        )

    return {
        "valid": True,
        "discount_percentage": offer_info["discount_percentage"],
        "discount_amount": offer_info["discount_amount"],
        "duration_days": offer_info["duration_days"],
    }


# Google Play Billing endpoints
@router.post("/iap/google/verify-purchase")
async def verify_google_purchase(
    purchase_data: GooglePurchaseVerify, current_user: dict = Depends(get_current_user)
):
    """Verify Google Play purchase token"""
    # TODO: Implement Google Play purchase verification
    # This would involve calling Google Play Developer API

    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Google Play purchase verification not yet implemented",
    )


@router.post("/iap/google/webhook")
async def google_webhook(webhook_data: dict):
    """Handle Google Real-time Developer Notifications"""
    # TODO: Implement Google webhook handling
    # This would process subscription status changes from Google Play

    return {"message": "Webhook received"}


@router.get("/iap/google/products")
async def get_google_products():
    """Get Google Play product IDs"""
    return {
        "products": [
            {
                "product_id": "pro_monthly",
                "name": "Pro Monthly",
                "price": 4.99,
                "currency": "USD",
            },
            {
                "product_id": "pro_annual",
                "name": "Pro Annual",
                "price": 49.99,
                "currency": "USD",
            },
            {
                "product_id": "coach_monthly",
                "name": "Elite Monthly",
                "price": 9.99,
                "currency": "USD",
            },
            {
                "product_id": "coach_annual",
                "name": "Elite Annual",
                "price": 99.99,
                "currency": "USD",
            },
        ]
    }


@router.post("/iap/google/acknowledge")
async def acknowledge_google_purchase(
    purchase_data: GooglePurchaseVerify, current_user: dict = Depends(get_current_user)
):
    """Acknowledge Google Play purchase (required by Google)"""
    # TODO: Implement Google Play purchase acknowledgment
    # This is required by Google to prevent refunds

    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Google Play purchase acknowledgment not yet implemented",
    )


@router.post("/iap/google/validate-promo")
async def validate_google_promo(
    promo_data: OfferCodeValidate, current_user: dict = Depends(get_current_user)
):
    """Validate Google Play promo code"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Check if promo code exists and is valid
    offer = (
        supabase.table("offer_codes")
        .select("*")
        .eq("code", promo_data.code)
        .eq("product_id", promo_data.product_id)
        .eq("is_active", True)
        .execute()
    )

    if not offer.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invalid promo code"
        )

    offer_info = offer.data[0]

    # Check if offer is still valid
    now = datetime.utcnow()
    if (
        offer_info["valid_until"]
        and datetime.fromisoformat(offer_info["valid_until"]) < now
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Promo code has expired"
        )

    if offer_info["max_uses"] and offer_info["used_count"] >= offer_info["max_uses"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Promo code has reached maximum uses",
        )

    return {
        "valid": True,
        "discount_percentage": offer_info["discount_percentage"],
        "discount_amount": offer_info["discount_amount"],
        "duration_days": offer_info["duration_days"],
    }
