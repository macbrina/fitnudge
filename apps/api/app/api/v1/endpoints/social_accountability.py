"""
FitNudge V2 - Social Accountability API Endpoints

Handles accountability partners.

V2 Schema (accountability_partners table):
- id, user_id, partner_user_id, status, initiated_by_user_id
- created_at, updated_at, accepted_at
- No scope, goal_id, or invite_code columns

Partnerships are simple user-to-user relationships.
"""

import asyncio

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional
from app.core.flexible_auth import get_current_user
from app.services.logger import logger
from app.services.social_accountability_service import social_accountability_service

router = APIRouter(redirect_slashes=False)


# Pydantic models
class AccountabilityPartnerRequest(BaseModel):
    partner_user_id: str


class AccountabilityPartnerResponse(BaseModel):
    id: str
    user_id: str
    partner_user_id: str
    status: str
    initiated_by_user_id: str
    created_at: str
    accepted_at: Optional[str] = None


# Accountability Partners Endpoints
@router.post(
    "/accountability-partners/request",
    response_model=AccountabilityPartnerResponse,
    status_code=status.HTTP_201_CREATED,
)
async def request_accountability_partner(
    request_data: AccountabilityPartnerRequest,
    current_user: dict = Depends(get_current_user),
):
    """Request an accountability partnership.

    V2: Simple user-to-user partnership (no scoping to goals).
    """
    from app.core.database import get_supabase_client
    from app.services.subscription_service import has_user_feature
    from app.api.v1.endpoints.goals import get_feature_limit

    supabase = get_supabase_client()
    user_id = current_user["id"]
    user_plan = current_user.get("plan", "free")

    # Check if user has access to accountability partners feature
    if not await has_user_feature(supabase, user_id, "accountability_partner_limit"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accountability partners require a subscription. Please upgrade.",
        )

    # Check partner limit
    partner_limit = get_feature_limit(
        user_plan, "accountability_partner_limit", supabase, default=0
    )

    # Count existing accepted partners
    existing_partners = (
        supabase.table("accountability_partners")
        .select("id", count="exact")
        .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
        .eq("status", "accepted")
        .execute()
    )
    existing_count = (
        existing_partners.count
        if hasattr(existing_partners, "count")
        else len(existing_partners.data or [])
    )

    if partner_limit is not None and existing_count >= partner_limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You've reached your limit of {partner_limit} accountability partners. Upgrade for more.",
        )

    # Can't partner with yourself
    if request_data.partner_user_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot be your own accountability partner",
        )

    try:
        # Check if partnership already exists
        existing = (
            supabase.table("accountability_partners")
            .select("id, status")
            .or_(
                f"and(user_id.eq.{user_id},partner_user_id.eq.{request_data.partner_user_id}),and(user_id.eq.{request_data.partner_user_id},partner_user_id.eq.{user_id})"
            )
            .maybe_single()
            .execute()
        )

        if existing and existing.data:
            if existing.data["status"] == "pending":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A partnership request is already pending",
                )
            elif existing.data["status"] == "accepted":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You are already accountability partners",
                )

        # Create new partnership request
        partnership_data = {
            "user_id": user_id,
            "partner_user_id": request_data.partner_user_id,
            "initiated_by_user_id": user_id,
            "status": "pending",
        }

        result = (
            supabase.table("accountability_partners").insert(partnership_data).execute()
        )

        logger.info(
            f"Accountability partner request created",
            {
                "user_id": user_id,
                "partner_user_id": request_data.partner_user_id,
            },
        )

        # Send push notification to partner
        try:
            from app.services.social_notification_service import (
                send_partner_notification,
                SocialNotificationType,
            )

            # Get sender's name
            sender = (
                supabase.table("users")
                .select("username, name")
                .eq("id", user_id)
                .maybe_single()
                .execute()
            )
            sender_name = (
                sender.data.get("name") or sender.data.get("username") or "Someone"
                if sender.data
                else "Someone"
            )

            partnership_id = result.data[0].get("id")

            # Fire-and-forget: don't block response on notification
            async def send_notification_task():
                try:
                    await send_partner_notification(
                        notification_type=SocialNotificationType.PARTNER_REQUEST,
                        recipient_id=request_data.partner_user_id,
                        sender_id=user_id,
                        sender_name=sender_name,
                        partnership_id=partnership_id,
                        entity_type="partner_request",
                        entity_id=partnership_id,
                        supabase=supabase,
                    )
                except Exception as e:
                    logger.warning(f"Failed to send partner request notification: {e}")

            asyncio.create_task(send_notification_task())
        except Exception as e:
            logger.warning(f"Failed to prepare partner request notification: {e}")

        return result.data[0]

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            f"Failed to request accountability partner for user {current_user['id']}",
            {"error": str(e), "user_id": current_user["id"]},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to request accountability partner",
        )


@router.post("/accountability-partners/{partner_user_id}/accept")
async def accept_accountability_partner(
    partner_user_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Accept an accountability partnership request."""
    from app.core.database import get_supabase_client
    from app.services.subscription_service import has_user_feature
    from app.api.v1.endpoints.goals import get_feature_limit

    supabase = get_supabase_client()
    user_id = current_user["id"]
    user_plan = current_user.get("plan", "free")

    # Check if user has access to accountability partners feature
    if not await has_user_feature(supabase, user_id, "accountability_partner_limit"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accountability partners require a subscription. Please upgrade.",
        )

    # Check partner limit before accepting
    partner_limit = get_feature_limit(
        user_plan, "accountability_partner_limit", supabase, default=0
    )

    # Count existing accepted partners
    existing_partners = (
        supabase.table("accountability_partners")
        .select("id", count="exact")
        .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
        .eq("status", "accepted")
        .execute()
    )
    existing_count = (
        existing_partners.count
        if hasattr(existing_partners, "count")
        else len(existing_partners.data or [])
    )

    if partner_limit is not None and existing_count >= partner_limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You've reached your limit of {partner_limit} accountability partners. Upgrade for more.",
        )

    try:
        await social_accountability_service.accept_accountability_partner(
            user_id=user_id, partner_user_id=partner_user_id
        )
        return {"message": "Partnership accepted successfully"}

    except Exception as e:
        logger.error(
            f"Failed to accept accountability partner for user {user_id}",
            {"error": str(e), "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to accept accountability partner",
        )


@router.post("/accountability-partners/{partner_user_id}/reject")
async def reject_accountability_partner(
    partner_user_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Reject or cancel an accountability partnership request."""
    from app.core.database import get_supabase_client
    from datetime import datetime, timezone

    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Update the partnership status to rejected
        result = (
            supabase.table("accountability_partners")
            .update(
                {
                    "status": "rejected",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .or_(
                f"and(user_id.eq.{user_id},partner_user_id.eq.{partner_user_id}),and(user_id.eq.{partner_user_id},partner_user_id.eq.{user_id})"
            )
            .eq("status", "pending")
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Partnership request not found",
            )

        return {"message": "Partnership request rejected"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to reject accountability partner for user {user_id}",
            {"error": str(e), "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reject accountability partner",
        )


@router.delete("/accountability-partners/{partner_user_id}")
async def remove_accountability_partner(
    partner_user_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Remove an existing accountability partnership."""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Delete the partnership
        result = (
            supabase.table("accountability_partners")
            .delete()
            .or_(
                f"and(user_id.eq.{user_id},partner_user_id.eq.{partner_user_id}),and(user_id.eq.{partner_user_id},partner_user_id.eq.{user_id})"
            )
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Partnership not found",
            )

        logger.info(
            f"Partnership removed: {user_id} <-> {partner_user_id}",
            {"user_id": user_id, "partner_user_id": partner_user_id},
        )

        return {"message": "Partnership removed successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to remove accountability partner for user {user_id}",
            {"error": str(e), "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove accountability partner",
        )


@router.get("/accountability-partners")
async def get_accountability_partners(
    current_user: dict = Depends(get_current_user),
):
    """Get all accountability partners for the current user."""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Get all partnerships where user is involved
        result = (
            supabase.table("accountability_partners")
            .select("*")
            .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
            .eq("status", "accepted")
            .execute()
        )

        # Get partner details
        partners = []
        for partnership in result.data or []:
            # Determine which user is the partner
            partner_id = (
                partnership["partner_user_id"]
                if partnership["user_id"] == user_id
                else partnership["user_id"]
            )

            # Get partner info
            partner_info = (
                supabase.table("users")
                .select("id, name, username, profile_picture_url")
                .eq("id", partner_id)
                .maybe_single()
                .execute()
            )

            if partner_info and partner_info.data:
                partners.append(
                    {
                        "partnership_id": partnership["id"],
                        "partner": partner_info.data,
                        "accepted_at": partnership.get("accepted_at"),
                        "created_at": partnership.get("created_at"),
                    }
                )

        return {"partners": partners}

    except Exception as e:
        logger.error(
            f"Failed to get accountability partners for user {user_id}",
            {"error": str(e), "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get accountability partners",
        )


@router.get("/accountability-partners/pending")
async def get_pending_partner_requests(
    current_user: dict = Depends(get_current_user),
):
    """Get pending partner requests for the current user."""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Get pending requests where user is the recipient
        result = (
            supabase.table("accountability_partners")
            .select("*")
            .eq("partner_user_id", user_id)
            .eq("status", "pending")
            .execute()
        )

        # Get requester details
        requests = []
        for partnership in result.data or []:
            requester_info = (
                supabase.table("users")
                .select("id, name, username, profile_picture_url")
                .eq("id", partnership["user_id"])
                .maybe_single()
                .execute()
            )

            if requester_info and requester_info.data:
                requests.append(
                    {
                        "partnership_id": partnership["id"],
                        "requester": requester_info.data,
                        "created_at": partnership.get("created_at"),
                    }
                )

        return {"pending_requests": requests}

    except Exception as e:
        logger.error(
            f"Failed to get pending partner requests for user {user_id}",
            {"error": str(e), "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get pending partner requests",
        )
