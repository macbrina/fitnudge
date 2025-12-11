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
    has_pending_request: bool = False


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


@router.get("/search", response_model=List[PartnerSearchResult])
async def search_users_for_partners(
    query: str = Query(..., min_length=2),
    current_user: dict = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=50),
):
    """Search users to add as accountability partners"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Search users by name or username
        result = (
            supabase.table("users")
            .select("id, name, username, profile_picture_url")
            .or_(f"name.ilike.%{query}%,username.ilike.%{query}%")
            .neq("id", user_id)  # Exclude current user
            .limit(limit)
            .execute()
        )

        if not result.data:
            return []

        user_ids = [u["id"] for u in result.data]

        # Get existing partnerships (accepted or pending)
        partnerships = (
            supabase.table("accountability_partners")
            .select("user_id, partner_user_id, status")
            .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
            .in_("status", ["accepted", "pending"])
            .execute()
        )

        # Build lookup sets
        partner_ids = set()
        pending_ids = set()

        for p in partnerships.data or []:
            other_id = p["partner_user_id"] if p["user_id"] == user_id else p["user_id"]
            if p["status"] == "accepted":
                partner_ids.add(other_id)
            else:
                pending_ids.add(other_id)

        # Build response
        search_results = []
        for user in result.data:
            search_results.append(
                {
                    "id": user["id"],
                    "name": user.get("name"),
                    "username": user.get("username"),
                    "profile_picture_url": user.get("profile_picture_url"),
                    "is_partner": user["id"] in partner_ids,
                    "has_pending_request": user["id"] in pending_ids,
                }
            )

        return search_results

    except Exception as e:
        logger.error(
            f"Failed to search users for user {user_id}",
            {"error": str(e), "user_id": user_id, "query": query},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search users",
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
