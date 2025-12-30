"""
Social Accountability API endpoints

Handles accountability partners and nudges.
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from app.core.flexible_auth import get_current_user
from app.core.entity_validation import validate_entity_is_active_by_id
from app.services.logger import logger
from app.services.social_accountability_service import social_accountability_service

router = APIRouter(redirect_slashes=False)


# Pydantic models
class AccountabilityPartnerRequest(BaseModel):
    partner_user_id: str
    scope: str = "global"  # global, goal, challenge
    goal_id: Optional[str] = None  # Required if scope is 'goal'
    challenge_id: Optional[str] = None  # Required if scope is 'challenge'


class AccountabilityPartnerResponse(BaseModel):
    id: str
    user_id: str
    partner_user_id: str
    status: str
    initiated_by_user_id: str
    scope: Optional[str] = "global"
    goal_id: Optional[str] = None
    challenge_id: Optional[str] = None
    created_at: str
    accepted_at: Optional[str]


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
    """Request an accountability partnership

    Supports scoped partnerships:
    - global: Partner for all goals (default)
    - goal: Partner for a specific goal (requires goal_id)
    - challenge: Partner for a specific challenge (requires challenge_id)
    """
    from app.core.database import get_supabase_client
    from app.core.subscriptions import check_user_has_feature
    from app.api.v1.endpoints.goals import get_feature_limit

    supabase = get_supabase_client()
    user_id = current_user["id"]
    user_plan = current_user.get("plan", "free")

    # Check if user has access to accountability partners feature (Starter+)
    if not check_user_has_feature(
        user_id, "social_accountability", user_plan, supabase
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accountability partners are available on Starter plans and above. Please upgrade.",
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

    # Validate scope and required fields
    if request_data.scope == "goal" and not request_data.goal_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="goal_id is required when scope is 'goal'",
        )
    if request_data.scope == "challenge" and not request_data.challenge_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="challenge_id is required when scope is 'challenge'",
        )

    # Validate goal exists if scoped to goal
    if request_data.goal_id:
        goal = (
            supabase.table("goals")
            .select("id, user_id, status")
            .eq("id", request_data.goal_id)
            .maybe_single()
            .execute()
        )
        if not goal.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal not found",
            )
        # User must own the goal
        if goal.data["user_id"] != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only add accountability partners for your own goals",
            )
        # Goal must be active
        validate_entity_is_active_by_id(
            entity_id=request_data.goal_id,
            entity_type="goal",
            supabase=supabase,
        )

    # Validate challenge exists if scoped to challenge
    if request_data.challenge_id:
        challenge = (
            supabase.table("challenges")
            .select("id, created_by, status")
            .eq("id", request_data.challenge_id)
            .maybe_single()
            .execute()
        )
        if not challenge.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Challenge not found",
            )
        # User must be creator or participant
        is_creator = challenge.data["created_by"] == user_id
        is_participant = (
            supabase.table("challenge_participants")
            .select("id")
            .eq("challenge_id", request_data.challenge_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        ).data
        if not is_creator and not is_participant:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must be a participant to add accountability partners",
            )
        # Challenge must be active
        validate_entity_is_active_by_id(
            entity_id=request_data.challenge_id,
            entity_type="challenge",
            supabase=supabase,
        )

    try:
        # Check if partnership already exists with same scope
        existing = (
            supabase.table("accountability_partners")
            .select("id, status")
            .eq("user_id", user_id)
            .eq("partner_user_id", request_data.partner_user_id)
            .eq("scope", request_data.scope)
        )

        if request_data.scope == "goal":
            existing = existing.eq("goal_id", request_data.goal_id)
        elif request_data.scope == "challenge":
            existing = existing.eq("challenge_id", request_data.challenge_id)
        else:
            existing = existing.is_("goal_id", "null").is_("challenge_id", "null")

        existing_result = existing.maybe_single().execute()

        if existing_result.data:
            if existing_result.data["status"] == "pending":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A partnership request is already pending",
                )
            elif existing_result.data["status"] == "accepted":
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
            "scope": request_data.scope,
            "goal_id": request_data.goal_id if request_data.scope == "goal" else None,
            "challenge_id": (
                request_data.challenge_id if request_data.scope == "challenge" else None
            ),
        }

        result = (
            supabase.table("accountability_partners").insert(partnership_data).execute()
        )

        logger.info(
            f"Accountability partner request created",
            {
                "user_id": user_id,
                "partner_user_id": request_data.partner_user_id,
                "scope": request_data.scope,
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

            # Determine entity type and ID based on scope
            # partner_request entity is the partnership record itself
            partnership_id = result.data[0].get("id")

            await send_partner_notification(
                notification_type=SocialNotificationType.PARTNER_REQUEST,
                recipient_id=request_data.partner_user_id,
                sender_id=user_id,
                sender_name=sender_name,
                partnership_id=partnership_id,
                goal_id=request_data.goal_id if request_data.scope == "goal" else None,
                challenge_id=(
                    request_data.challenge_id
                    if request_data.scope == "challenge"
                    else None
                ),
                entity_type="partner_request",
                entity_id=partnership_id,
                supabase=supabase,
            )
        except Exception as e:
            # Don't fail the request if notification fails
            logger.warning(f"Failed to send partner request notification: {e}")

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
    """Accept an accountability partnership request"""
    from app.core.database import get_supabase_client
    from app.core.subscriptions import check_user_has_feature
    from app.api.v1.endpoints.goals import get_feature_limit

    supabase = get_supabase_client()
    user_id = current_user["id"]
    user_plan = current_user.get("plan", "free")

    # Check if user has access to accountability partners feature (Starter+)
    if not check_user_has_feature(
        user_id, "social_accountability", user_plan, supabase
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accountability partners are available on Starter plans and above. Please upgrade.",
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


# =====================================================
# Accountability Partner Invite Link Endpoints
# =====================================================


class PartnerInviteLinkRequest(BaseModel):
    scope: str = "global"  # global, goal, challenge
    goal_id: Optional[str] = None
    challenge_id: Optional[str] = None


@router.post("/accountability-partners/invite-link")
async def generate_partner_invite_link(
    request_data: PartnerInviteLinkRequest,
    current_user: dict = Depends(get_current_user),
):
    """Generate a shareable invite link to become an accountability partner

    The person who clicks the link will see a pending request that they
    must accept before becoming a partner.
    """
    from app.core.database import get_supabase_client
    from app.core.subscriptions import check_user_has_feature
    from app.services.referral_service import generate_invite_code
    from datetime import datetime, timezone, timedelta

    supabase = get_supabase_client()
    user_id = current_user["id"]
    user_plan = current_user.get("plan", "free")

    # Check if user has access to accountability partners feature (Starter+)
    if not check_user_has_feature(
        user_id, "social_accountability", user_plan, supabase
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accountability partners are available on Starter plans and above. Please upgrade.",
        )

    # Validate scope and required fields
    if request_data.scope == "goal" and not request_data.goal_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="goal_id is required when scope is 'goal'",
        )
    if request_data.scope == "challenge" and not request_data.challenge_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="challenge_id is required when scope is 'challenge'",
        )

    # Validate goal/challenge exists and user owns it
    if request_data.goal_id:
        goal = (
            supabase.table("goals")
            .select("id, user_id, title, status")
            .eq("id", request_data.goal_id)
            .maybe_single()
            .execute()
        )
        if not goal.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal not found",
            )
        if goal.data["user_id"] != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only create partner invites for your own goals",
            )
        # Goal must be active
        validate_entity_is_active_by_id(
            entity_id=request_data.goal_id,
            entity_type="goal",
            supabase=supabase,
        )

    if request_data.challenge_id:
        challenge = (
            supabase.table("challenges")
            .select("id, created_by, title, status")
            .eq("id", request_data.challenge_id)
            .maybe_single()
            .execute()
        )
        if not challenge.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Challenge not found",
            )
        # Must be creator or participant
        is_creator = challenge.data["created_by"] == user_id
        is_participant = (
            supabase.table("challenge_participants")
            .select("id")
            .eq("challenge_id", request_data.challenge_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        ).data
        if not is_creator and not is_participant:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must be a participant to create partner invites",
            )
        # Challenge must be active
        validate_entity_is_active_by_id(
            entity_id=request_data.challenge_id,
            entity_type="challenge",
            supabase=supabase,
        )

    # Generate invite code
    invite_code = generate_invite_code()

    # Get the sharer's referral code for tracking
    sharer = (
        supabase.table("users")
        .select("referral_code")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    sharer_referral_code = sharer.data.get("referral_code") if sharer.data else None

    # Create placeholder partnership record with invite code
    partnership_data = {
        "user_id": user_id,
        "partner_user_id": user_id,  # Placeholder - will be updated when claimed
        "initiated_by_user_id": user_id,
        "status": "pending",
        "scope": request_data.scope,
        "goal_id": request_data.goal_id if request_data.scope == "goal" else None,
        "challenge_id": (
            request_data.challenge_id if request_data.scope == "challenge" else None
        ),
        "invite_code": invite_code,
    }

    result = (
        supabase.table("accountability_partners").insert(partnership_data).execute()
    )

    logger.info(
        f"Partner invite link generated",
        {"user_id": user_id, "invite_code": invite_code, "scope": request_data.scope},
    )

    # Build invite link with referral code for new user attribution
    invite_link = f"https://fitnudge.app/partner/invite/{invite_code}"
    if sharer_referral_code:
        invite_link += f"?ref={sharer_referral_code}"

    return {
        "invite_code": invite_code,
        "invite_link": invite_link,
        "scope": request_data.scope,
        "expires_in_days": 30,
    }


@router.post("/accountability-partners/join/{invite_code}")
async def join_via_partner_invite(
    invite_code: str,
    current_user: dict = Depends(get_current_user),
):
    """Accept a partner invite via invite code

    Creates a pending partner request that the user must accept.
    Unlike challenge invites, this doesn't auto-accept.
    """
    from app.core.database import get_supabase_client
    from app.core.subscriptions import check_user_has_feature
    from app.api.v1.endpoints.goals import get_feature_limit
    from datetime import datetime, timezone

    supabase = get_supabase_client()
    user_id = current_user["id"]
    user_plan = current_user.get("plan", "free")

    # Check if user has access to accountability partners feature (Starter+)
    if not check_user_has_feature(
        user_id, "social_accountability", user_plan, supabase
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accountability partners are available on Starter plans and above. Please upgrade.",
        )

    # Check partner limit before joining
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

    # Find the invite
    invite = (
        supabase.table("accountability_partners")
        .select("*")
        .eq("invite_code", invite_code)
        .maybe_single()
        .execute()
    )

    if not invite.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invite code",
        )

    invite_data = invite.data
    inviter_user_id = invite_data["user_id"]

    # Can't partner with yourself
    if inviter_user_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot be your own accountability partner",
        )

    # Check if already partners with same scope
    existing = (
        supabase.table("accountability_partners")
        .select("id, status")
        .eq("user_id", inviter_user_id)
        .eq("partner_user_id", user_id)
        .eq("scope", invite_data["scope"])
    )

    if invite_data["scope"] == "goal":
        existing = existing.eq("goal_id", invite_data["goal_id"])
    elif invite_data["scope"] == "challenge":
        existing = existing.eq("challenge_id", invite_data["challenge_id"])
    else:
        existing = existing.is_("goal_id", "null").is_("challenge_id", "null")

    existing_result = existing.maybe_single().execute()

    if existing_result.data and existing_result.data["status"] == "accepted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already accountability partners",
        )

    # Validate goal/challenge is still active if scoped
    if invite_data.get("goal_id"):
        validate_entity_is_active_by_id(
            entity_id=invite_data["goal_id"],
            entity_type="goal",
            supabase=supabase,
        )
    if invite_data.get("challenge_id"):
        validate_entity_is_active_by_id(
            entity_id=invite_data["challenge_id"],
            entity_type="challenge",
            supabase=supabase,
        )

    # Update the invite to set the actual partner and reset status to pending
    # (The invitee needs to accept it)
    supabase.table("accountability_partners").update(
        {
            "partner_user_id": user_id,
            "status": "pending",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", invite_data["id"]).execute()

    # Get inviter info for response
    inviter = (
        supabase.table("users")
        .select("id, username, name")
        .eq("id", inviter_user_id)
        .maybe_single()
        .execute()
    )

    logger.info(
        f"Partner invite claimed",
        {
            "invite_code": invite_code,
            "inviter_id": inviter_user_id,
            "invitee_id": user_id,
        },
    )

    return {
        "message": "You have a pending accountability partner request. Accept it to start your partnership!",
        "partnership_id": invite_data["id"],
        "inviter": {
            "id": inviter.data["id"] if inviter.data else None,
            "username": inviter.data.get("username") if inviter.data else None,
            "name": inviter.data.get("name") if inviter.data else None,
        },
        "scope": invite_data["scope"],
    }
