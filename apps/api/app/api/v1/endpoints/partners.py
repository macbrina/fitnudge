"""
Accountability Partners API endpoints

Dedicated endpoints for managing accountability partners.
Matches the frontend routes at /partners/*
"""

import asyncio
from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from app.core.flexible_auth import get_current_user
from app.services.logger import logger

router = APIRouter(redirect_slashes=False)


# Helper for fire-and-forget notifications
async def _send_notification_safe(
    notification_type: "SocialNotificationType",
    recipient_id: str,
    sender_id: str,
    sender_name: str,
    partnership_id: str = None,
    goal_id: str = None,
    challenge_id: str = None,
    entity_type: str = None,
    entity_id: str = None,
    context: dict = None,
):
    """
    Safely send a notification without blocking or raising exceptions.
    Used for fire-and-forget pattern with asyncio.create_task().

    Args:
        notification_type: SocialNotificationType enum
        recipient_id: User ID to receive the notification
        sender_id: User ID who triggered the notification
        sender_name: Display name of sender
        partnership_id: ID of the partnership record
        goal_id: ID of related goal (if any)
        challenge_id: ID of related challenge (if any)
        entity_type: Entity type for notification_history cleanup (e.g., 'partner_request')
        entity_id: Entity ID for notification_history cleanup
        context: Additional logging context
    """
    from app.core.database import get_supabase_client
    from app.services.social_notification_service import send_partner_notification

    try:
        supabase = get_supabase_client()
        result = await send_partner_notification(
            notification_type=notification_type,
            recipient_id=recipient_id,
            sender_id=sender_id,
            sender_name=sender_name,
            partnership_id=partnership_id,
            goal_id=goal_id,
            challenge_id=challenge_id,
            entity_type=entity_type,
            entity_id=entity_id,
            supabase=supabase,
        )

    except Exception as e:
        logger.error(
            f"Failed to send partner notification: {e}",
            {
                "notification_type": str(notification_type),
                "recipient_id": recipient_id,
                "partnership_id": partnership_id,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "error": str(e),
                **(context or {}),
            },
        )


# Response models
class PartnerUserInfo(BaseModel):
    id: str
    name: Optional[str] = None
    username: Optional[str] = None
    profile_picture_url: Optional[str] = None
    has_social_accountability: bool = False  # Whether partner has the feature
    is_active: bool = True  # Whether partner's account is active


class PartnerResponse(BaseModel):
    id: str
    user_id: str
    partner_user_id: str
    partner: PartnerUserInfo
    status: str  # pending, accepted
    initiated_by_user_id: str  # user_id who sent the request
    created_at: str
    accepted_at: Optional[str] = None


class PartnerSearchResult(BaseModel):
    id: str
    name: Optional[str] = None
    username: Optional[str] = None
    profile_picture_url: Optional[str] = None
    is_partner: bool = False
    has_pending_request: bool = False  # Deprecated: use request_status instead
    request_status: str = "none"  # none, sent, received, accepted
    partnership_id: Optional[str] = None  # For cancel/accept actions


class PartnerRequest(BaseModel):
    partner_user_id: str


class PartnerLimitsResponse(BaseModel):
    """Response for partner limits check"""

    has_feature: bool = False
    limit: Optional[int] = None  # null = unlimited
    accepted_count: int = 0
    pending_sent_count: int = 0
    total_toward_limit: int = 0
    can_send_request: bool = False


@router.get("/limits", response_model=PartnerLimitsResponse)
async def get_partner_limits(
    current_user: dict = Depends(get_current_user),
):
    """
    Get current user's partner limits and counts.
    Used by frontend to determine if user can send more requests.
    """
    from app.core.database import get_supabase_client
    from app.services.subscription_service import (
        has_user_feature,
        get_user_feature_value,
    )

    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Check if user has the social_accountability feature
        has_social_feature = await has_user_feature(
            supabase, user_id, "social_accountability"
        )

        if not has_social_feature:
            return PartnerLimitsResponse(
                has_feature=False,
                limit=0,
                accepted_count=0,
                pending_sent_count=0,
                total_toward_limit=0,
                can_send_request=False,
            )

        # Get partner limit
        partner_limit = await get_user_feature_value(
            supabase, user_id, "accountability_partner_limit"
        )

        # Count accepted partners + pending sent requests
        # Include partner's user status to only count active users toward limit
        full_result = (
            supabase.table("accountability_partners")
            .select(
                """
                id, user_id, partner_user_id, status, initiated_by_user_id,
                user:users!accountability_partners_user_id_fkey(status),
                partner:users!accountability_partners_partner_user_id_fkey(status)
            """
            )
            .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
            .in_("status", ["accepted", "pending"])
            .execute()
        )

        accepted_count = 0
        pending_sent_count = 0
        for p in full_result.data or []:
            # Determine which user is the partner (the OTHER user)
            if p.get("user_id") == user_id:
                partner_info = p.get("partner", {})
            else:
                partner_info = p.get("user", {})

            # Only count active partners toward the limit
            partner_status = (
                partner_info.get("status", "active") if partner_info else "active"
            )
            if partner_status != "active":
                continue

            if p.get("status") == "accepted":
                accepted_count += 1
            elif (
                p.get("status") == "pending"
                and p.get("initiated_by_user_id") == user_id
            ):
                pending_sent_count += 1

        total_toward_limit = accepted_count + pending_sent_count

        # Check if can send more requests
        can_send_request = partner_limit is None or total_toward_limit < partner_limit

        return PartnerLimitsResponse(
            has_feature=True,
            limit=partner_limit,
            accepted_count=accepted_count,
            pending_sent_count=pending_sent_count,
            total_toward_limit=total_toward_limit,
            can_send_request=can_send_request,
        )

    except Exception as e:
        logger.error(
            f"Failed to get partner limits for user {user_id}",
            {"error": str(e), "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get partner limits",
        )


# Endpoints
@router.get("", response_model=List[PartnerResponse])
async def get_partners(
    current_user: dict = Depends(get_current_user),
):
    """Get list of accepted accountability partners"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Get partnerships where current user is either user_id or partner_user_id
        # Include user status to filter out inactive accounts
        result = (
            supabase.table("accountability_partners")
            .select(
                """
                id,
                user_id,
                partner_user_id,
                status,
                initiated_by_user_id,
                created_at,
                accepted_at,
                user:users!accountability_partners_user_id_fkey(id, name, username, profile_picture_url, status),
                partner:users!accountability_partners_partner_user_id_fkey(id, name, username, profile_picture_url, status)
            """
            )
            .eq("status", "accepted")
            .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
            .execute()
        )

        partners = []
        for row in result.data or []:
            # Determine which user is the partner (not the current user)
            # The "partner" from current user's perspective is the OTHER user
            if row["user_id"] == user_id:
                # Current user is user_id, so partner is partner_user_id
                partner_info = row.get("partner", {})
                actual_partner_user_id = row["partner_user_id"]
            else:
                # Current user is partner_user_id, so partner is user_id
                partner_info = row.get("user", {})
                actual_partner_user_id = row["user_id"]

            # Skip partners with inactive/suspended/disabled accounts
            partner_status = partner_info.get("status", "active")
            if partner_status != "active":
                continue

            partners.append(
                {
                    "id": row["id"],
                    "user_id": row["user_id"],
                    "partner_user_id": actual_partner_user_id,  # Always the OTHER user's ID
                    "partner": {
                        "id": partner_info.get("id"),
                        "name": partner_info.get("name"),
                        "username": partner_info.get("username"),
                        "profile_picture_url": partner_info.get("profile_picture_url"),
                        "is_active": partner_status == "active",
                    },
                    "status": row["status"],
                    "initiated_by_user_id": row["initiated_by_user_id"],
                    "created_at": row["created_at"],
                    "accepted_at": row.get("accepted_at"),
                }
            )

        return partners

    except Exception as e:
        logger.error(
            f"Failed to get partners for user {user_id}",
            {"error": str(e), "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get partners",
        )


@router.get("/pending", response_model=List[PartnerResponse])
async def get_pending_requests(
    current_user: dict = Depends(get_current_user),
):
    """Get pending partner requests (received by current user)"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Get pending requests where current user is the partner_user_id (receiver)
        # Include sender's status to filter out inactive accounts
        result = (
            supabase.table("accountability_partners")
            .select(
                """
                id,
                user_id,
                partner_user_id,
                status,
                initiated_by_user_id,
                created_at,
                user:users!accountability_partners_user_id_fkey(id, name, username, profile_picture_url, status)
            """
            )
            .eq("status", "pending")
            .eq("partner_user_id", user_id)
            .execute()
        )

        pending = []
        for row in result.data or []:
            # The "partner" is the sender (user_id), not the receiver (current user)
            sender_info = row.get("user", {})

            # Skip requests from inactive/suspended/disabled accounts
            sender_status = sender_info.get("status", "active")
            if sender_status != "active":
                continue

            pending.append(
                {
                    "id": row["id"],
                    "user_id": row["user_id"],
                    "partner_user_id": row[
                        "user_id"
                    ],  # The sender is the partner from receiver's perspective
                    "partner": {
                        "id": sender_info.get("id"),
                        "name": sender_info.get("name"),
                        "username": sender_info.get("username"),
                        "profile_picture_url": sender_info.get("profile_picture_url"),
                        "is_active": sender_status == "active",
                    },
                    "status": row["status"],
                    "initiated_by_user_id": row["initiated_by_user_id"],
                    "created_at": row["created_at"],
                    "accepted_at": None,
                }
            )

        return pending

    except Exception as e:
        logger.error(
            f"Failed to get pending requests for user {user_id}",
            {"error": str(e), "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get pending requests",
        )


@router.get("/sent", response_model=List[PartnerResponse])
async def get_sent_requests(
    current_user: dict = Depends(get_current_user),
):
    """Get partner requests sent by current user (outgoing requests)"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Get pending requests where current user is the initiator
        # Include receiver's status to filter out inactive accounts
        result = (
            supabase.table("accountability_partners")
            .select(
                """
                id,
                user_id,
                partner_user_id,
                status,
                initiated_by_user_id,
                created_at,
                partner:users!accountability_partners_partner_user_id_fkey(id, name, username, profile_picture_url, status)
            """
            )
            .eq("status", "pending")
            .eq("initiated_by_user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )

        sent = []
        for row in result.data or []:
            receiver_info = row.get("partner", {})

            # Skip requests to inactive/suspended/disabled accounts
            receiver_status = receiver_info.get("status", "active")
            if receiver_status != "active":
                continue

            sent.append(
                {
                    "id": row["id"],
                    "user_id": row["user_id"],
                    "partner_user_id": row["partner_user_id"],
                    "partner": {
                        "id": receiver_info.get("id"),
                        "name": receiver_info.get("name"),
                        "username": receiver_info.get("username"),
                        "profile_picture_url": receiver_info.get("profile_picture_url"),
                        "is_active": receiver_status == "active",
                    },
                    "status": row["status"],
                    "initiated_by_user_id": row["initiated_by_user_id"],
                    "created_at": row["created_at"],
                    "accepted_at": None,
                }
            )

        return sent

    except Exception as e:
        logger.error(
            f"Failed to get sent requests for user {user_id}",
            {"error": str(e), "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get sent requests",
        )


class PaginatedSearchResponse(BaseModel):
    users: List[PartnerSearchResult]
    total: int
    page: int
    limit: int
    has_more: bool


@router.get("/search", response_model=PaginatedSearchResponse)
async def search_users_for_partners(
    query: str = Query(..., min_length=2),
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
):
    """Search users to add as accountability partners with pagination"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]
    offset = (page - 1) * limit

    try:
        # Search users by name or username with pagination
        result = (
            supabase.table("users")
            .select("id, name, username, profile_picture_url", count="exact")
            .or_(f"name.ilike.%{query}%,username.ilike.%{query}%")
            .neq("id", user_id)  # Exclude current user
            .eq("status", "active")
            .range(offset, offset + limit - 1)
            .execute()
        )

        total = result.count if hasattr(result, "count") and result.count else 0

        if not result.data:
            return {
                "users": [],
                "total": 0,
                "page": page,
                "limit": limit,
                "has_more": False,
            }

        # Get existing partnerships (accepted or pending)
        partnerships = (
            supabase.table("accountability_partners")
            .select("id, user_id, partner_user_id, status, initiated_by_user_id")
            .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
            .in_("status", ["accepted", "pending"])
            .execute()
        )

        # Build lookup dicts with detailed status
        # Key: other user's id, Value: {status, i_initiated, partnership_id}
        partnership_info = {}

        for p in partnerships.data or []:
            other_id = p["partner_user_id"] if p["user_id"] == user_id else p["user_id"]
            i_initiated = p["initiated_by_user_id"] == user_id
            partnership_info[other_id] = {
                "status": p["status"],
                "i_initiated": i_initiated,
                "partnership_id": p["id"],
            }

        # Build response
        search_results = []
        for user in result.data:
            info = partnership_info.get(user["id"])

            if info:
                if info["status"] == "accepted":
                    request_status = "accepted"
                    is_partner = True
                    has_pending = False
                else:  # pending
                    is_partner = False
                    has_pending = True
                    request_status = "sent" if info["i_initiated"] else "received"
                partnership_id = info["partnership_id"]
            else:
                request_status = "none"
                is_partner = False
                has_pending = False
                partnership_id = None

            search_results.append(
                {
                    "id": user["id"],
                    "name": user.get("name"),
                    "username": user.get("username"),
                    "profile_picture_url": user.get("profile_picture_url"),
                    "is_partner": is_partner,
                    "has_pending_request": has_pending,
                    "request_status": request_status,
                    "partnership_id": partnership_id,
                }
            )

        return {
            "users": search_results,
            "total": total,
            "page": page,
            "limit": limit,
            "has_more": offset + limit < total,
        }

    except Exception as e:
        logger.error(
            f"Failed to search users for user {user_id}: {str(e)}",
            {"error": str(e), "user_id": user_id, "query": query},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search users: {str(e)}",
        )


@router.get("/suggested", response_model=PaginatedSearchResponse)
async def get_suggested_partners(
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
):
    """Get suggested users to add as accountability partners

    Suggests recently active users.
    Excludes existing partners and pending requests.
    """
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]
    offset = (page - 1) * limit

    try:
        # Get existing partnerships and pending requests to exclude
        partnerships = (
            supabase.table("accountability_partners")
            .select("user_id, partner_user_id")
            .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
            .in_("status", ["accepted", "pending"])
            .execute()
        )

        exclude_ids = {user_id}  # Always exclude self
        for p in partnerships.data or []:
            exclude_ids.add(p["user_id"])
            exclude_ids.add(p["partner_user_id"])

        # Get recently active users, excluding existing partners and pending requests
        exclude_list = list(exclude_ids)

        query = (
            supabase.table("users")
            .select("id, name, username, profile_picture_url", count="exact")
            .eq("status", "active")
        )

        # Only add NOT IN filter if we have IDs to exclude
        if exclude_list:
            exclude_str = f"({','.join(exclude_list)})"
            query = query.filter("id", "not.in", exclude_str)

        result = (
            query.order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )

        total = result.count if hasattr(result, "count") and result.count else 0

        users = [
            {
                "id": u["id"],
                "name": u.get("name"),
                "username": u.get("username"),
                "profile_picture_url": u.get("profile_picture_url"),
                "is_partner": False,
                "has_pending_request": False,
                "request_status": "none",
                "partnership_id": None,
            }
            for u in result.data or []
        ]

        return {
            "users": users,
            "total": total,
            "page": page,
            "limit": limit,
            "has_more": offset + limit < total,
        }

    except Exception as e:
        logger.error(
            f"Failed to get suggested partners for user {user_id}: {str(e)}",
            {"error": str(e), "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get suggested partners: {str(e)}",
        )


@router.post("/request", response_model=PartnerResponse)
async def send_partner_request(
    request_data: PartnerRequest,
    current_user: dict = Depends(get_current_user),
):
    """Send an accountability partner request"""
    from app.core.database import get_supabase_client
    from app.services.social_notification_service import SocialNotificationType

    supabase = get_supabase_client()
    user_id = current_user["id"]
    sender_name = current_user.get("name") or current_user.get("username") or "Someone"
    partner_user_id = request_data.partner_user_id

    if user_id == partner_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot send partner request to yourself",
        )

    try:
        # Check if sender has the social_accountability feature
        # and get their accountability_partner_limit
        from app.services.subscription_service import (
            has_user_feature,
            get_user_feature_value,
        )

        has_social_feature = await has_user_feature(
            supabase, user_id, "social_accountability"
        )
        if not has_social_feature:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Accountability partner feature requires a subscription",
            )

        partner_limit = await get_user_feature_value(
            supabase, user_id, "accountability_partner_limit"
        )

        # Count accepted partners + pending sent requests toward the limit
        full_result = (
            supabase.table("accountability_partners")
            .select("id, status, initiated_by_user_id")
            .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
            .in_("status", ["accepted", "pending"])
            .execute()
        )

        accepted_count = 0
        pending_sent_count = 0
        for p in full_result.data or []:
            if p.get("status") == "accepted":
                accepted_count += 1
            elif (
                p.get("status") == "pending"
                and p.get("initiated_by_user_id") == user_id
            ):
                pending_sent_count += 1

        total_toward_limit = accepted_count + pending_sent_count

        # Check limit (None = unlimited)
        if partner_limit is not None and total_toward_limit >= partner_limit:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You have reached your partner limit ({partner_limit}). "
                f"You have {accepted_count} partners and {pending_sent_count} pending requests.",
            )

        # Check if partner user exists
        partner = (
            supabase.table("users")
            .select("id, name, username, profile_picture_url")
            .eq("id", partner_user_id)
            .maybe_single()
            .execute()
        )

        if not partner.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # Check if partnership already exists
        existing = (
            supabase.table("accountability_partners")
            .select("id, status")
            .or_(
                f"and(user_id.eq.{user_id},partner_user_id.eq.{partner_user_id}),"
                f"and(user_id.eq.{partner_user_id},partner_user_id.eq.{user_id})"
            )
            .execute()
        )

        if existing.data:
            status_val = existing.data[0].get("status")
            if status_val == "accepted":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Already partners with this user",
                )
            elif status_val == "pending":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A request is already pending with this user",
                )

        # Create partnership request
        result = (
            supabase.table("accountability_partners")
            .insert(
                {
                    "user_id": user_id,
                    "partner_user_id": partner_user_id,
                    "status": "pending",
                    "initiated_by_user_id": user_id,
                }
            )
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create partner request",
            )

        row = result.data[0]
        partner_info = partner.data

        logger.info(
            f"Partner request sent from {user_id} to {partner_user_id}",
            {"user_id": user_id, "partner_user_id": partner_user_id},
        )

        # Send notification to the partner (fire and forget - don't block response)
        asyncio.create_task(
            _send_notification_safe(
                notification_type=SocialNotificationType.PARTNER_REQUEST,
                recipient_id=partner_user_id,
                sender_id=user_id,
                sender_name=sender_name,
                partnership_id=row["id"],
                entity_type="partner_request",
                entity_id=row["id"],
                context={"user_id": user_id, "partner_user_id": partner_user_id},
            )
        )

        return {
            "id": row["id"],
            "user_id": row["user_id"],
            "partner_user_id": row["partner_user_id"],
            "partner": {
                "id": partner_info.get("id"),
                "name": partner_info.get("name"),
                "username": partner_info.get("username"),
                "profile_picture_url": partner_info.get("profile_picture_url"),
            },
            "status": row["status"],
            "initiated_by_user_id": row["initiated_by_user_id"],
            "created_at": row["created_at"],
            "accepted_at": None,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to send partner request from {user_id} to {partner_user_id}",
            {"error": str(e), "user_id": user_id, "partner_user_id": partner_user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send partner request",
        )


@router.post("/{partnership_id}/accept")
async def accept_partner_request(
    partnership_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Accept a partner request"""
    from app.core.database import get_supabase_client
    from datetime import datetime
    from app.services.social_notification_service import SocialNotificationType
    from app.services.subscription_service import get_user_feature_value

    supabase = get_supabase_client()
    user_id = current_user["id"]
    accepter_name = (
        current_user.get("name") or current_user.get("username") or "Someone"
    )

    try:
        # Get the partnership
        partnership = (
            supabase.table("accountability_partners")
            .select("*")
            .eq("id", partnership_id)
            .eq("partner_user_id", user_id)  # Must be the receiver
            .eq("status", "pending")
            .maybe_single()
            .execute()
        )

        if not partnership.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Partner request not found or already processed",
            )

        # Safety check: Verify the sender hasn't exceeded their limit
        # This handles the race condition where sender sent multiple requests
        # and multiple were accepted before limit was reached
        sender_id = partnership.data.get("user_id")
        sender_limit = await get_user_feature_value(
            supabase, sender_id, "accountability_partner_limit"
        )

        if sender_limit is not None:
            # Count sender's current accepted partners
            sender_partners_result = (
                supabase.table("accountability_partners")
                .select("id", count="exact")
                .or_(f"user_id.eq.{sender_id},partner_user_id.eq.{sender_id}")
                .eq("status", "accepted")
                .execute()
            )

            sender_accepted_count = sender_partners_result.count or 0

            if sender_accepted_count >= sender_limit:
                # Sender has reached their limit, delete the pending request
                supabase.table("accountability_partners").delete().eq(
                    "id", partnership_id
                ).execute()

                logger.info(
                    f"Partner request {partnership_id} auto-expired - sender {sender_id} at limit",
                    {"partnership_id": partnership_id, "sender_id": sender_id},
                )

                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This user has reached their partner limit. The request has been removed.",
                )

        # Accept the request
        result = (
            supabase.table("accountability_partners")
            .update(
                {
                    "status": "accepted",
                    "accepted_at": datetime.utcnow().isoformat(),
                }
            )
            .eq("id", partnership_id)
            .execute()
        )

        logger.info(
            f"Partner request {partnership_id} accepted by {user_id}",
            {"partnership_id": partnership_id, "user_id": user_id},
        )

        # Send notification to the original requester (fire and forget - don't block response)
        original_sender_id = partnership.data.get("user_id")
        if original_sender_id:
            asyncio.create_task(
                _send_notification_safe(
                    notification_type=SocialNotificationType.PARTNER_ACCEPTED,
                    recipient_id=original_sender_id,
                    sender_id=user_id,
                    sender_name=accepter_name,
                    partnership_id=partnership_id,
                    entity_type="partner_request",
                    entity_id=partnership_id,
                    context={
                        "original_sender_id": original_sender_id,
                    },
                )
            )

        return {"message": "Partner request accepted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to accept partner request {partnership_id}",
            {"error": str(e), "partnership_id": partnership_id, "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to accept partner request",
        )


@router.post("/{partnership_id}/reject")
async def reject_partner_request(
    partnership_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Reject a partner request"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Get the partnership
        partnership = (
            supabase.table("accountability_partners")
            .select("*")
            .eq("id", partnership_id)
            .eq("partner_user_id", user_id)  # Must be the receiver
            .eq("status", "pending")
            .maybe_single()
            .execute()
        )

        if not partnership.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Partner request not found or already processed",
            )

        # Delete the request
        supabase.table("accountability_partners").delete().eq(
            "id", partnership_id
        ).execute()

        # Fire-and-forget: cleanup partner_request notifications
        from app.services.cleanup_service import fire_and_forget_partner_cleanup

        fire_and_forget_partner_cleanup(partnership_id, reason="rejected")

        logger.info(
            f"Partner request {partnership_id} rejected by {user_id}",
            {"partnership_id": partnership_id, "user_id": user_id},
        )

        return {"message": "Partner request rejected"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to reject partner request {partnership_id}",
            {"error": str(e), "partnership_id": partnership_id, "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reject partner request",
        )


@router.post("/{partnership_id}/cancel")
async def cancel_partner_request(
    partnership_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Cancel a pending partner request that the current user initiated"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Get the partnership (must be pending and initiated by current user)
        partnership = (
            supabase.table("accountability_partners")
            .select("*")
            .eq("id", partnership_id)
            .eq("initiated_by_user_id", user_id)
            .eq("status", "pending")
            .maybe_single()
            .execute()
        )

        if not partnership.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pending request not found or you are not the initiator",
            )

        # Delete the pending request
        supabase.table("accountability_partners").delete().eq(
            "id", partnership_id
        ).execute()

        # Fire-and-forget: cleanup partner_request notifications
        from app.services.cleanup_service import fire_and_forget_partner_cleanup

        fire_and_forget_partner_cleanup(partnership_id, reason="cancelled")

        logger.info(
            f"Partner request {partnership_id} cancelled by {user_id}",
            {"partnership_id": partnership_id, "user_id": user_id},
        )

        return {"message": "Partner request cancelled"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to cancel partner request {partnership_id}",
            {"error": str(e), "partnership_id": partnership_id, "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel partner request",
        )


@router.delete("/{partnership_id}")
async def remove_partner(
    partnership_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Remove an existing partner"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Get the partnership (must be a participant)
        partnership = (
            supabase.table("accountability_partners")
            .select("*")
            .eq("id", partnership_id)
            .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
            .eq("status", "accepted")
            .maybe_single()
            .execute()
        )

        if not partnership.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Partnership not found",
            )

        # Delete the partnership
        supabase.table("accountability_partners").delete().eq(
            "id", partnership_id
        ).execute()

        # Fire-and-forget: cleanup partner_request and partner_accepted notifications
        from app.services.cleanup_service import fire_and_forget_partner_cleanup

        fire_and_forget_partner_cleanup(partnership_id, reason="removed")

        logger.info(
            f"Partnership {partnership_id} removed by {user_id}",
            {"partnership_id": partnership_id, "user_id": user_id},
        )

        return {"message": "Partner removed"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to remove partner {partnership_id}",
            {"error": str(e), "partnership_id": partnership_id, "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove partner",
        )


# ===== PARTNER DASHBOARD - View partner's goals, challenges, and progress =====


class PartnerGoalSummary(BaseModel):
    """Summary of a partner's goal for accountability view"""

    id: str
    title: str
    category: str
    tracking_type: Optional[str] = None
    status: str
    progress_percentage: float = 0.0
    current_streak: int = 0
    logged_today: bool = False
    frequency: Optional[str] = None


class PartnerChallengeSummary(BaseModel):
    """Summary of a partner's challenge for accountability view"""

    id: str
    title: str
    category: Optional[str] = None
    tracking_type: Optional[str] = None
    status: str
    progress: int = 0
    target_value: Optional[int] = None
    participants_count: int = 0
    logged_today: bool = False


class PartnerDashboard(BaseModel):
    """Partner's accountability dashboard data"""

    partner: PartnerUserInfo
    partnership_id: str
    partnership_created_at: str
    goals: List[PartnerGoalSummary]
    challenges: List[PartnerChallengeSummary]
    total_active_goals: int = 0
    total_active_challenges: int = 0
    overall_streak: int = 0
    logged_today: bool = False
    has_scheduled_today: bool = (
        True  # Whether partner has any goals/challenges scheduled for today
    )


def is_scheduled_today(frequency: Optional[str], days_of_week: Optional[list]) -> bool:
    """
    Check if a goal/challenge is scheduled for today based on frequency settings.

    Args:
        frequency: "daily", "weekly", or "custom"
        days_of_week: List of day numbers (can be int or str) like [0, 1, 2, 3, 6] or ["0", "2", "4", "6"]
                      where 0=Sunday, 1=Monday, ..., 6=Saturday (JS convention)

    Returns:
        True if today is a scheduled day, False otherwise
    """
    if not frequency or frequency == "daily":
        return True

    if frequency in ("weekly", "custom"):
        if not days_of_week:
            return True  # If no specific days set, assume always active

        # Get today's day number in JS convention (0=Sunday, 1=Monday, ..., 6=Saturday)
        # Python weekday(): 0=Monday, 6=Sunday
        # We need to convert: Python Monday(0) -> JS Monday(1), Python Sunday(6) -> JS Sunday(0)
        python_weekday = datetime.now().weekday()
        # Convert Python weekday (Mon=0, Sun=6) to JS weekday (Sun=0, Mon=1, ..., Sat=6)
        js_weekday = (python_weekday + 1) % 7

        # days_of_week can be integers [0, 1, 2] or strings ["0", "1", "2"]
        # Normalize to integers for comparison
        normalized_days = []
        for day in days_of_week:
            if isinstance(day, int):
                normalized_days.append(day)
            elif isinstance(day, str):
                try:
                    normalized_days.append(int(day))
                except ValueError:
                    pass  # Skip invalid values

        return js_weekday in normalized_days

    return True  # Default to scheduled if unknown frequency


@router.get("/{partner_user_id}/dashboard", response_model=PartnerDashboard)
async def get_partner_dashboard(
    partner_user_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Get a partner's accountability dashboard.

    Shows the partner's active goals, challenges, progress, and "logged today" status.
    Only accessible if there's an accepted partnership between the users.
    """
    from app.core.database import get_supabase_client
    from datetime import date

    supabase = get_supabase_client()
    user_id = current_user["id"]
    today = date.today().isoformat()

    try:

        # Verify there's an accepted partnership
        partnership = (
            supabase.table("accountability_partners")
            .select("id, created_at")
            .eq("status", "accepted")
            .or_(
                f"and(user_id.eq.{user_id},partner_user_id.eq.{partner_user_id}),"
                f"and(user_id.eq.{partner_user_id},partner_user_id.eq.{user_id})"
            )
            .maybe_single()
            .execute()
        )

        if not partnership.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Partnership not found or not accepted",
            )

        partnership_id = partnership.data["id"]
        partnership_created_at = partnership.data["created_at"]

        # Get partner's user info (include status to check if active)
        partner_info = (
            supabase.table("users")
            .select("id, name, username, profile_picture_url, status")
            .eq("id", partner_user_id)
            .maybe_single()
            .execute()
        )

        if not partner_info.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Partner user not found"
            )

        # Check if partner's account is active
        partner_account_status = partner_info.data.get("status", "active")
        partner_is_active = partner_account_status == "active"

        if not partner_is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Partner's account is no longer active",
            )

        # Check if partner has social_accountability feature
        from app.services.subscription_service import has_user_feature

        partner_has_feature = await has_user_feature(
            supabase, partner_user_id, "social_accountability"
        )

        # Get overall stats from user_stats_cache (always fetch, has both goals and challenges data)

        stats_result = (
            supabase.table("user_stats_cache")
            .select("current_streak, active_goals_count, active_challenges_count")
            .eq("user_id", partner_user_id)
            .maybe_single()
            .execute()
        )
        overall_streak = (
            stats_result.data.get("current_streak", 0) if stats_result.data else 0
        )

        # Get partner's active goals
        goals_result = (
            supabase.table("goals")
            .select(
                "id, title, category, tracking_type, status, frequency, days_of_week"
            )
            .eq("user_id", partner_user_id)
            .eq("status", "active")
            .order("created_at", desc=True)
            .execute()
        )

        all_goals_data = goals_result.data or []
        all_goal_ids = [g["id"] for g in all_goals_data]

        # Filter goals to only those with completed actionable plans
        goals_data = []
        goal_ids = []
        if all_goal_ids:
            completed_plans_result = (
                supabase.table("actionable_plans")
                .select("goal_id")
                .in_("goal_id", all_goal_ids)
                .eq("status", "completed")
                .execute()
            )
            goals_with_plans = {
                p["goal_id"]
                for p in (completed_plans_result.data or [])
                if p.get("goal_id")
            }
            goals_data = [g for g in all_goals_data if g["id"] in goals_with_plans]
            goal_ids = [g["id"] for g in goals_data]
        today_checkins = {}
        goal_stats_map = {}

        if goal_ids:
            # Batch fetch: today's check-ins + goal_statistics (2 queries instead of N+1)
            checkins_result = (
                supabase.table("check_ins")
                .select("goal_id, is_checked_in")
                .eq("user_id", partner_user_id)
                .eq("check_in_date", today)
                .in_("goal_id", goal_ids)
                .execute()
            )

            for ci in checkins_result.data or []:
                if ci.get("goal_id"):
                    today_checkins[ci["goal_id"]] = ci.get("is_checked_in", False)

            # Get individual goal stats from goal_statistics table
            goal_stats_result = (
                supabase.table("goal_statistics")
                .select("goal_id, current_streak, completion_rate")
                .in_("goal_id", goal_ids)
                .execute()
            )

            for stat in goal_stats_result.data or []:
                if stat.get("goal_id"):
                    goal_stats_map[stat["goal_id"]] = {
                        "current_streak": stat.get("current_streak", 0),
                        "completion_rate": float(stat.get("completion_rate", 0)),
                    }

        # Build goal summaries
        goal_summaries = []
        for goal in goals_data:
            goal_id = goal["id"]
            logged_today = today_checkins.get(goal_id, False)
            goal_stats = goal_stats_map.get(goal_id, {})

            goal_summaries.append(
                PartnerGoalSummary(
                    id=goal_id,
                    title=goal["title"],
                    category=goal["category"],
                    tracking_type=goal.get("tracking_type"),
                    status=goal["status"],
                    progress_percentage=goal_stats.get("completion_rate", 0.0),
                    current_streak=goal_stats.get("current_streak", 0),
                    logged_today=logged_today,
                    frequency=goal.get("frequency"),
                )
            )

        # Get partner's active challenges via challenge_participants (just to get challenge IDs they're in)
        participations_result = (
            supabase.table("challenge_participants")
            .select(
                """
                challenge_id,
                challenges!inner(
                    id, title, category, tracking_type, status,
                    challenge_type, target_days, target_checkins,
                    frequency, days_of_week
                )
            """
            )
            .eq("user_id", partner_user_id)
            .execute()
        )

        # Filter to only active/upcoming challenges and collect IDs
        all_challenge_ids = []
        all_challenges_info = {}  # challenge_id -> challenge data

        for cp in participations_result.data or []:
            challenge = cp.get("challenges", {})
            if challenge and challenge.get("status") in ["active", "upcoming"]:
                cid = challenge["id"]
                all_challenge_ids.append(cid)
                # Determine target_value based on challenge_type
                challenge_type = challenge.get("challenge_type")
                if challenge_type == "streak":
                    target_value = challenge.get("target_days")
                else:  # checkin_count
                    target_value = challenge.get("target_checkins")

                all_challenges_info[cid] = {
                    "id": cid,
                    "title": challenge["title"],
                    "category": challenge.get("category"),
                    "tracking_type": challenge.get("tracking_type"),
                    "status": challenge["status"],
                    "target_value": target_value,
                    "frequency": challenge.get("frequency"),
                    "days_of_week": challenge.get("days_of_week"),
                }

        # Filter challenges to only those with completed actionable plans
        challenge_ids = []
        challenges_info = {}
        if all_challenge_ids:
            completed_challenge_plans_result = (
                supabase.table("actionable_plans")
                .select("challenge_id")
                .in_("challenge_id", all_challenge_ids)
                .eq("status", "completed")
                .execute()
            )
            challenges_with_plans = {
                p["challenge_id"]
                for p in (completed_challenge_plans_result.data or [])
                if p.get("challenge_id")
            }
            challenge_ids = [
                cid for cid in all_challenge_ids if cid in challenges_with_plans
            ]
            challenges_info = {
                cid: info
                for cid, info in all_challenges_info.items()
                if cid in challenges_with_plans
            }

        challenge_summaries = []

        if challenge_ids:
            # Batch fetch challenge_statistics (has progress, current_streak, last_checkin_date)
            challenge_stats_result = (
                supabase.table("challenge_statistics")
                .select("challenge_id, current_streak, last_checkin_date, progress")
                .eq("user_id", partner_user_id)
                .in_("challenge_id", challenge_ids)
                .execute()
            )

            challenge_stats_map = {}
            for stat in challenge_stats_result.data or []:
                cid = stat.get("challenge_id")
                if cid:
                    challenge_stats_map[cid] = {
                        "current_streak": stat.get("current_streak", 0),
                        "logged_today": stat.get("last_checkin_date") == today,
                        "progress": stat.get("progress", 0),
                    }

            # Batch count participants per challenge
            participants_result = (
                supabase.table("challenge_participants")
                .select("challenge_id")
                .in_("challenge_id", challenge_ids)
                .execute()
            )

            participants_count_map = {}
            for p in participants_result.data or []:
                cid = p.get("challenge_id")
                if cid:
                    participants_count_map[cid] = participants_count_map.get(cid, 0) + 1

            # Build challenge summaries with all data
            for cid in challenge_ids:
                info = challenges_info.get(cid, {})
                stats = challenge_stats_map.get(cid, {})
                challenge_summaries.append(
                    {
                        "id": cid,
                        "title": info.get("title", ""),
                        "category": info.get("category"),
                        "tracking_type": info.get("tracking_type"),
                        "status": info.get("status", "active"),
                        "progress": stats.get("progress", 0),
                        "target_value": info.get("target_value"),
                        "participants_count": participants_count_map.get(cid, 0),
                        "logged_today": stats.get("logged_today", False),
                    }
                )

        # Convert to Pydantic models
        challenge_models = [PartnerChallengeSummary(**cs) for cs in challenge_summaries]

        # Calculate if partner logged today (any goal or challenge)
        partner_logged_today = any(g.logged_today for g in goal_summaries) or any(
            c.logged_today for c in challenge_models
        )

        # Calculate if partner has anything scheduled for today
        # Check goals: if any goal is scheduled for today based on frequency/days_of_week

        goals_scheduled_today = False
        for goal in goals_data:
            freq = goal.get("frequency")
            days = goal.get("days_of_week")
            scheduled = is_scheduled_today(freq, days)

            if scheduled:
                goals_scheduled_today = True

        # Check challenges: if any challenge is scheduled for today based on frequency/days_of_week

        challenges_scheduled_today = False
        for cid in challenge_ids:
            freq = challenges_info.get(cid, {}).get("frequency")
            days = challenges_info.get(cid, {}).get("days_of_week")
            scheduled = is_scheduled_today(freq, days)

            if scheduled:
                challenges_scheduled_today = True

        partner_has_scheduled_today = (
            goals_scheduled_today or challenges_scheduled_today
        )

        return PartnerDashboard(
            partner=PartnerUserInfo(
                id=partner_info.data["id"],
                name=partner_info.data.get("name"),
                username=partner_info.data.get("username"),
                profile_picture_url=partner_info.data.get("profile_picture_url"),
                has_social_accountability=partner_has_feature,
                is_active=partner_is_active,
            ),
            partnership_id=partnership_id,
            partnership_created_at=partnership_created_at,
            goals=goal_summaries,
            challenges=challenge_models,
            total_active_goals=len(goal_summaries),
            total_active_challenges=len(challenge_models),
            overall_streak=overall_streak,
            logged_today=partner_logged_today,
            has_scheduled_today=partner_has_scheduled_today,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to get partner dashboard for user {partner_user_id} {str(e)}",
            {"error": str(e), "user_id": user_id, "partner_user_id": partner_user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get partner dashboard: {str(e)}",
        )
