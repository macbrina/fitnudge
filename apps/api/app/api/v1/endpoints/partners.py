"""
Accountability Partners API endpoints

Dedicated endpoints for managing accountability partners.
Matches the frontend routes at /partners/*
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from app.core.flexible_auth import get_current_user
from app.services.logger import logger

router = APIRouter(redirect_slashes=False)


# Response models
class PartnerUserInfo(BaseModel):
    id: str
    name: Optional[str] = None
    username: Optional[str] = None
    profile_picture_url: Optional[str] = None


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
                user:users!accountability_partners_user_id_fkey(id, name, username, profile_picture_url),
                partner:users!accountability_partners_partner_user_id_fkey(id, name, username, profile_picture_url)
            """
            )
            .eq("status", "accepted")
            .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
            .execute()
        )

        partners = []
        for row in result.data or []:
            # Determine which user is the partner (not the current user)
            if row["user_id"] == user_id:
                partner_info = row.get("partner", {})
            else:
                partner_info = row.get("user", {})

            partners.append(
                {
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
                user:users!accountability_partners_user_id_fkey(id, name, username, profile_picture_url)
            """
            )
            .eq("status", "pending")
            .eq("partner_user_id", user_id)
            .execute()
        )

        pending = []
        for row in result.data or []:
            sender_info = row.get("user", {})
            pending.append(
                {
                    "id": row["id"],
                    "user_id": row["user_id"],
                    "partner_user_id": row["partner_user_id"],
                    "partner": {
                        "id": sender_info.get("id"),
                        "name": sender_info.get("name"),
                        "username": sender_info.get("username"),
                        "profile_picture_url": sender_info.get("profile_picture_url"),
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
                partner:users!accountability_partners_partner_user_id_fkey(id, name, username, profile_picture_url)
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

    supabase = get_supabase_client()
    user_id = current_user["id"]
    partner_user_id = request_data.partner_user_id

    if user_id == partner_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot send partner request to yourself",
        )

    try:
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
