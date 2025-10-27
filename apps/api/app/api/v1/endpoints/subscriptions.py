from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()


# Pydantic models
class SubscriptionPlan(BaseModel):
    id: str
    name: str
    price: float
    currency: str
    interval: str  # monthly, yearly
    features: List[str]
    product_id_ios: str
    product_id_android: str


class SubscriptionResponse(BaseModel):
    id: str
    user_id: str
    plan: str
    status: str
    platform: str
    product_id: str
    purchase_date: str
    expires_date: Optional[str]
    auto_renew: bool
    created_at: str
    updated_at: str


class AppleReceiptVerify(BaseModel):
    receipt_data: str
    product_id: str


class GooglePurchaseVerify(BaseModel):
    purchase_token: str
    product_id: str


class OfferCodeValidate(BaseModel):
    code: str
    product_id: str


@router.get("/plans", response_model=List[SubscriptionPlan])
async def get_subscription_plans():
    """Get available subscription plans"""
    return [
        {
            "id": "free",
            "name": "Free",
            "price": 0.0,
            "currency": "USD",
            "interval": "monthly",
            "features": [
                "1 active goal",
                "Basic AI motivation",
                "Community access",
                "Text posts",
            ],
            "product_id_ios": "",
            "product_id_android": "",
        },
        {
            "id": "pro",
            "name": "Pro",
            "price": 4.99,
            "currency": "USD",
            "interval": "monthly",
            "features": [
                "Unlimited goals",
                "Voice posts & AI coaching",
                "Advanced analytics",
                "Priority support",
            ],
            "product_id_ios": "com.fitnudge.pro.monthly",
            "product_id_android": "pro_monthly",
        },
        {
            "id": "coach_plus",
            "name": "Coach+",
            "price": 9.99,
            "currency": "USD",
            "interval": "monthly",
            "features": [
                "All Pro features",
                "AI memory & personalization",
                "Integrations (Apple Health, Fitbit)",
                "Custom coaching programs",
            ],
            "product_id_ios": "com.fitnudge.coach.monthly",
            "product_id_android": "coach_monthly",
        },
    ]


@router.get("/me", response_model=Optional[SubscriptionResponse])
async def get_my_subscription(current_user: dict = Depends(get_current_user)):
    """Get current user's subscription"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
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
    return None


@router.get("/features")
async def get_available_features(current_user: dict = Depends(get_current_user)):
    """Get features available for current user's plan"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    subscription = (
        supabase.table("subscriptions")
        .select("*")
        .eq("user_id", current_user["id"])
        .eq("status", "active")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    plan = current_user["plan"]
    if subscription.data:
        plan = subscription.data[0]["plan"]

    features = {
        "goals_limit": 1 if plan == "free" else -1,  # -1 means unlimited
        "voice_posts": plan in ["pro", "coach_plus"],
        "ai_coaching": plan in ["pro", "coach_plus"],
        "analytics": plan in ["pro", "coach_plus"],
        "integrations": plan == "coach_plus",
        "ai_memory": plan == "coach_plus",
        "priority_support": plan in ["pro", "coach_plus"],
    }

    return {"plan": plan, "features": features}


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
                "name": "Coach+ Monthly",
                "price": 9.99,
                "currency": "USD",
            },
            {
                "product_id": "com.fitnudge.coach.annual",
                "name": "Coach+ Annual",
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
                "name": "Coach+ Monthly",
                "price": 9.99,
                "currency": "USD",
            },
            {
                "product_id": "coach_annual",
                "name": "Coach+ Annual",
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
