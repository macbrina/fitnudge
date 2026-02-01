"""
Accountability Partners API endpoints

Dedicated endpoints for managing accountability partners.
Matches the frontend routes at /partners/*

Per FITNUDGE_V2_SPEC.md, partners can see:
- First name and last initial
- Active goals (titles only, not "why" statements)
- Daily check-in status
- Current streak
- NO personal info, photos, or contact details
"""

import asyncio
from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.core.flexible_auth import get_current_user
from app.services.logger import logger
from app.services.partner_matching_service import (
    calculate_partner_match_score,
    extract_goal_categories,
    find_matched_goal_titles,
)


router = APIRouter(redirect_slashes=False)


# Helper for fire-and-forget notifications
async def _send_notification_safe(
    notification_type: "SocialNotificationType",
    recipient_id: str,
    sender_id: str,
    sender_name: str,
    partnership_id: str = None,
    goal_id: str = None,
    entity_type: str = None,
    entity_id: str = None,
    deep_link: str = None,
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
        entity_type: Entity type for notification_history cleanup (e.g., 'partner_request')
        entity_id: Entity ID for notification_history cleanup
        deep_link: Deep link URL for navigation (Expo Router path)
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
            entity_type=entity_type,
            entity_id=entity_id,
            deep_link=deep_link,
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
    has_partner_feature: bool = (
        False  # Whether partner has accountability_partner_limit feature
    )
    is_active: bool = True  # Whether partner's account is active
    last_active_at: Optional[str] = None  # ISO timestamp for activity indicator


class PartnerTodayGoal(BaseModel):
    """A partner's goal with today's check-in status for home screen display"""

    id: str
    title: str
    logged_today: bool = False
    is_scheduled_today: bool = True
    today_checkin_status: Optional[str] = None


class PartnerResponse(BaseModel):
    id: str
    user_id: str
    partner_user_id: str
    partner: PartnerUserInfo
    status: str  # pending, accepted
    initiated_by_user_id: str  # user_id who sent the request
    created_at: str
    accepted_at: Optional[str] = None
    has_active_items: bool = False  # Whether partner has active goals
    # Extended fields (only when include_today_goals=true)
    overall_streak: Optional[int] = None
    today_goals: Optional[List[PartnerTodayGoal]] = None
    logged_today: Optional[bool] = None


class PartnerSearchResult(BaseModel):
    id: str
    name: Optional[str] = None
    username: Optional[str] = None
    profile_picture_url: Optional[str] = None
    last_active_at: Optional[str] = None  # ISO timestamp for activity indicator
    is_partner: bool = False
    has_pending_request: bool = False  # Deprecated: use request_status instead
    request_status: str = "none"  # none, sent, received, accepted
    partnership_id: Optional[str] = None  # For cancel/accept actions
    # Smart matching fields (V2)
    match_score: Optional[float] = None  # 0-100 match percentage
    match_reasons: Optional[List[str]] = None  # ["Similar goals", "Same timezone"]
    matched_goals: Optional[List[str]] = None  # Goal titles they share


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
    from app.services.subscription_service import get_user_feature_value

    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Get partner limit (None = unlimited, 0 = no access, >0 = limit)
        partner_limit = await get_user_feature_value(
            supabase, user_id, "accountability_partner_limit"
        )

        # If limit is 0 or not set, user doesn't have the feature
        if partner_limit is not None and partner_limit == 0:
            return PartnerLimitsResponse(
                has_feature=False,
                limit=0,
                accepted_count=0,
                pending_sent_count=0,
                total_toward_limit=0,
                can_send_request=False,
            )

        # User has the feature (limit is None for unlimited, or > 0)

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
    include_today_goals: bool = Query(
        False, description="Include today's goals with check-in status for home screen"
    ),
    current_user: dict = Depends(get_current_user),
):
    """
    Get list of accepted accountability partners.

    If include_today_goals=true, also returns:
    - overall_streak: Partner's highest current streak
    - today_goals: List of partner's active goals with today's check-in status
    - logged_today: Whether partner has completed any goal today
    """
    from app.core.database import get_supabase_client
    from datetime import date

    supabase = get_supabase_client()
    user_id = current_user["id"]
    today = date.today().isoformat()

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
                user:users!accountability_partners_user_id_fkey(id, name, username, profile_picture_url, status, last_active_at),
                partner:users!accountability_partners_partner_user_id_fkey(id, name, username, profile_picture_url, status, last_active_at)
            """
            )
            .eq("status", "accepted")
            .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
            .execute()
        )

        # Collect all partner user IDs for batch query
        partner_user_ids = []
        partner_info_map = {}  # partner_user_id -> partner_info, partner_status

        for row in result.data or []:
            if row["user_id"] == user_id:
                partner_info = row.get("partner", {})
                actual_partner_user_id = row["partner_user_id"]
            else:
                partner_info = row.get("user", {})
                actual_partner_user_id = row["user_id"]

            partner_status = partner_info.get("status", "active")
            if partner_status != "active":
                continue

            partner_user_ids.append(actual_partner_user_id)
            partner_info_map[actual_partner_user_id] = {
                "row": row,
                "partner_info": partner_info,
                "partner_status": partner_status,
                "actual_partner_user_id": actual_partner_user_id,
            }

        # Batch query: Get active goals for all partners
        # If include_today_goals, we need full goal info; otherwise just count
        goals_by_partner: Dict[str, List[Dict]] = {pid: [] for pid in partner_user_ids}
        active_goals_map: Dict[str, int] = {}

        if partner_user_ids:
            if include_today_goals:
                # Fetch full goal data for today's goals display
                goals_result = (
                    supabase.table("goals")
                    .select(
                        "id, user_id, title, status, frequency_type, target_days, current_streak"
                    )
                    .in_("user_id", partner_user_ids)
                    .eq("status", "active")
                    .execute()
                )
                for g in goals_result.data or []:
                    uid = g.get("user_id")
                    if uid:
                        goals_by_partner[uid].append(g)
                        active_goals_map[uid] = active_goals_map.get(uid, 0) + 1
            else:
                # Just count active goals
                goals_result = (
                    supabase.table("goals")
                    .select("user_id")
                    .in_("user_id", partner_user_ids)
                    .eq("status", "active")
                    .execute()
                )
                for g in goals_result.data or []:
                    uid = g.get("user_id")
                    if uid:
                        active_goals_map[uid] = active_goals_map.get(uid, 0) + 1

        # Batch query: Get today's check-ins for all partners (only if include_today_goals)
        checkins_by_goal: Dict[str, Optional[str]] = {}
        if include_today_goals and partner_user_ids:
            # Get all goal IDs first
            all_goal_ids = []
            for goals in goals_by_partner.values():
                for g in goals:
                    all_goal_ids.append(g["id"])

            if all_goal_ids:
                checkins_result = (
                    supabase.table("check_ins")
                    .select("goal_id, status")
                    .in_("goal_id", all_goal_ids)
                    .eq("check_in_date", today)
                    .execute()
                )
                for ci in checkins_result.data or []:
                    goal_id = ci.get("goal_id")
                    if goal_id:
                        # V2: Use status field directly (completed, skipped, rest_day)
                        checkins_by_goal[goal_id] = ci.get("status")

        # Build response with has_active_items and optional today_goals
        partners = []
        for partner_user_id in partner_user_ids:
            data = partner_info_map[partner_user_id]
            row = data["row"]
            partner_info = data["partner_info"]
            actual_partner_user_id = data["actual_partner_user_id"]

            goals_count = active_goals_map.get(actual_partner_user_id, 0)
            has_active_items = goals_count > 0

            partner_data = {
                "id": row["id"],
                "user_id": row["user_id"],
                "partner_user_id": actual_partner_user_id,
                "partner": {
                    "id": partner_info.get("id"),
                    "name": partner_info.get("name"),
                    "username": partner_info.get("username"),
                    "profile_picture_url": partner_info.get("profile_picture_url"),
                    "last_active_at": partner_info.get("last_active_at"),
                    "is_active": data["partner_status"] == "active",
                },
                "status": row["status"],
                "initiated_by_user_id": row["initiated_by_user_id"],
                "created_at": row["created_at"],
                "accepted_at": row.get("accepted_at"),
                "has_active_items": has_active_items,
            }

            # Add extended fields if requested
            if include_today_goals:
                partner_goals = goals_by_partner.get(actual_partner_user_id, [])

                # Calculate overall streak (highest current streak)
                overall_streak = 0
                for g in partner_goals:
                    streak = g.get("current_streak", 0) or 0
                    if streak > overall_streak:
                        overall_streak = streak

                # Build today_goals with check-in status
                today_goals = []
                partner_logged_today = False
                for g in partner_goals:
                    goal_id = g["id"]
                    status = checkins_by_goal.get(goal_id)
                    logged = status in ("completed", "rest_day")
                    if logged:
                        partner_logged_today = True

                    # Check if scheduled today
                    freq = g.get("frequency_type", "daily")
                    days = g.get("target_days", [])
                    scheduled = is_scheduled_today(freq, days)

                    today_goals.append(
                        {
                            "id": goal_id,
                            "title": g["title"],
                            "logged_today": logged,
                            "is_scheduled_today": scheduled,
                            "today_checkin_status": status,
                        }
                    )

                partner_data["overall_streak"] = overall_streak
                partner_data["today_goals"] = today_goals
                partner_data["logged_today"] = partner_logged_today

            partners.append(partner_data)

        return partners

    except Exception as e:
        logger.error(
            f"Failed to get partners for user {user_id} {str(e)}",
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
            f"Failed to get pending requests for user {user_id} {str(e)}",
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


@router.get("/blocked", response_model=List[PartnerResponse])
async def get_blocked_partners(
    current_user: dict = Depends(get_current_user),
):
    """Get partners that the current user has blocked"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Get blocked partnerships where current user is the blocker
        result = (
            supabase.table("accountability_partners")
            .select(
                """
                id,
                user_id,
                partner_user_id,
                status,
                initiated_by_user_id,
                blocked_by,
                created_at,
                updated_at,
                partner:users!accountability_partners_partner_user_id_fkey(id, name, username, profile_picture_url, status),
                user:users!accountability_partners_user_id_fkey(id, name, username, profile_picture_url, status)
            """
            )
            .eq("status", "blocked")
            .eq("blocked_by", user_id)  # Only show blocked by current user
            .order("updated_at", desc=True)
            .execute()
        )

        blocked = []
        for row in result.data or []:
            # Determine which user is the "other" person (the blocked one)
            if row["user_id"] == user_id:
                other_info = row.get("partner", {})
                other_user_id = row["partner_user_id"]
            else:
                other_info = row.get("user", {})
                other_user_id = row["user_id"]

            blocked.append(
                {
                    "id": row["id"],
                    "user_id": row["user_id"],
                    "partner_user_id": row["partner_user_id"],
                    "partner": {
                        "id": other_info.get("id") or other_user_id,
                        "name": other_info.get("name"),
                        "username": other_info.get("username"),
                        "profile_picture_url": other_info.get("profile_picture_url"),
                        "is_active": other_info.get("status") == "active",
                    },
                    "status": row["status"],
                    "initiated_by_user_id": row["initiated_by_user_id"],
                    "created_at": row["created_at"],
                    "accepted_at": None,
                }
            )

        return blocked

    except Exception as e:
        logger.error(
            f"Failed to get blocked partners for user {user_id}",
            {"error": str(e), "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get blocked partners",
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
            .select(
                "id, name, username, profile_picture_url, last_active_at", count="exact"
            )
            .or_(f"name.ilike.%{query}%,username.ilike.%{query}%")
            .neq("id", user_id)  # Exclude current user
            .eq("status", "active")
            .not_.is_(
                "onboarding_completed_at", "null"
            )  # Only users who completed onboarding
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

        # Get existing partnerships (accepted, pending, or blocked)
        partnerships = (
            supabase.table("accountability_partners")
            .select("id, user_id, partner_user_id, status, initiated_by_user_id")
            .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
            .in_("status", ["accepted", "pending", "blocked"])
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

            # Skip blocked users - don't show them at all
            if info and info["status"] == "blocked":
                continue

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
                    "last_active_at": user.get("last_active_at"),
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
    """Get suggested users to add as accountability partners using smart matching.

    V2 Matching Criteria (per FITNUDGE_V2_SPEC.md):
    - Similar goal types (fitness, reading, meditation, etc.) - 40% weight
    - Similar frequency (daily vs 3x/week) - 25% weight
    - Similar timezone (within 3 hours) - 25% weight
    - Similar streak level (beginner with beginner) - 10% weight

    Returns users sorted by match score with match reasons.
    """
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # 1. Get current user's profile and goals for matching
        user_profile = (
            supabase.table("users")
            .select("id, timezone")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )

        profile = getattr(user_profile, "data", None) if user_profile is not None else None
        user_timezone = profile.get("timezone", "UTC") if profile else "UTC"

        # Get current user's active goals
        user_goals_result = (
            supabase.table("goals")
            .select("id, title, frequency_type, current_streak")
            .eq("user_id", user_id)
            .eq("status", "active")
            .execute()
        )

        user_goal_titles = [g["title"] for g in user_goals_result.data or []]
        user_frequencies = list(
            set(g.get("frequency_type", "daily") for g in user_goals_result.data or [])
        )
        user_max_streak = max(
            (g.get("current_streak", 0) or 0 for g in user_goals_result.data or []),
            default=0,
        )

        user_data = {
            "goal_titles": user_goal_titles,
            "frequencies": user_frequencies,
            "timezone": user_timezone,
            "max_streak": user_max_streak,
        }

        # 2. Get existing partnerships and pending requests to exclude
        # Also exclude blocked users - they should never appear in suggestions
        partnerships = (
            supabase.table("accountability_partners")
            .select("user_id, partner_user_id")
            .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
            .in_("status", ["accepted", "pending", "blocked"])
            .execute()
        )

        exclude_ids = {user_id}  # Always exclude self
        for p in partnerships.data or []:
            exclude_ids.add(p["user_id"])
            exclude_ids.add(p["partner_user_id"])

        exclude_list = list(exclude_ids)

        # 3. Get candidate users with their goals (batch query)
        # We fetch more than needed to allow for scoring and filtering
        fetch_limit = min(limit * 5, 100)  # Fetch up to 5x or 100 candidates

        users_query = (
            supabase.table("users")
            .select("id, name, username, profile_picture_url, timezone, last_active_at")
            .eq("status", "active")
            .not_.is_(
                "onboarding_completed_at", "null"
            )  # Only users who completed onboarding
        )

        if exclude_list:
            exclude_str = f"({','.join(exclude_list)})"
            users_query = users_query.filter("id", "not.in", exclude_str)

        users_result = users_query.limit(fetch_limit).execute()

        if not users_result.data:
            return {
                "users": [],
                "total": 0,
                "page": page,
                "limit": limit,
                "has_more": False,
            }

        # 4. Batch fetch goals for all candidates
        candidate_ids = [u["id"] for u in users_result.data]

        goals_result = (
            supabase.table("goals")
            .select("user_id, title, frequency_type, current_streak")
            .in_("user_id", candidate_ids)
            .eq("status", "active")
            .execute()
        )

        # Group goals by user_id
        goals_by_user: Dict[str, List[Dict]] = {}
        for goal in goals_result.data or []:
            uid = goal["user_id"]
            if uid not in goals_by_user:
                goals_by_user[uid] = []
            goals_by_user[uid].append(goal)

        # 5. Score each candidate
        scored_candidates = []

        for candidate in users_result.data:
            cand_id = candidate["id"]
            cand_goals = goals_by_user.get(cand_id, [])

            # Skip users with no active goals (nothing to match on)
            if not cand_goals:
                continue

            cand_goal_titles = [g["title"] for g in cand_goals]
            cand_frequencies = list(
                set(g.get("frequency_type", "daily") for g in cand_goals)
            )
            cand_max_streak = max(
                (g.get("current_streak", 0) or 0 for g in cand_goals), default=0
            )

            candidate_data = {
                "goal_titles": cand_goal_titles,
                "frequencies": cand_frequencies,
                "timezone": candidate.get("timezone", "UTC"),
                "max_streak": cand_max_streak,
            }

            # Calculate match score
            match_score, match_reasons = calculate_partner_match_score(
                user_data, candidate_data
            )

            # Find matched goal titles (for display)
            matched_goals = find_matched_goal_titles(
                user_goal_titles, cand_goal_titles, threshold=70, max_results=3
            )

            scored_candidates.append(
                {
                    "user": candidate,
                    "match_score": match_score,
                    "match_reasons": match_reasons,
                    "matched_goals": matched_goals,
                }
            )

        # 6. Sort by match score (descending)
        scored_candidates.sort(key=lambda x: x["match_score"], reverse=True)

        # 7. Paginate
        total = len(scored_candidates)
        offset = (page - 1) * limit
        paginated = scored_candidates[offset : offset + limit]

        # 8. Build response
        users = []
        for item in paginated:
            user = item["user"]
            users.append(
                {
                    "id": user["id"],
                    "name": user.get("name"),
                    "username": user.get("username"),
                    "profile_picture_url": user.get("profile_picture_url"),
                    "last_active_at": user.get("last_active_at"),
                    "is_partner": False,
                    "has_pending_request": False,
                    "request_status": "none",
                    "partnership_id": None,
                    "match_score": item["match_score"],
                    "match_reasons": item["match_reasons"],
                    "matched_goals": item["matched_goals"],
                }
            )

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
        # Get sender's accountability_partner_limit
        from app.services.subscription_service import get_user_feature_value
        from concurrent.futures import ThreadPoolExecutor

        partner_limit = await get_user_feature_value(
            supabase, user_id, "accountability_partner_limit"
        )

        # If limit is 0, user doesn't have the feature
        if partner_limit is not None and partner_limit == 0:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Accountability partner feature requires a subscription",
            )

        # Run partner user check and partnerships check in parallel
        def get_partner_user():
            return (
                supabase.table("users")
                .select("id, name, username, profile_picture_url")
                .eq("id", partner_user_id)
                .maybe_single()
                .execute()
            )

        def get_all_partnerships():
            # Single query: get all partnerships for limit counting AND existing check
            return (
                supabase.table("accountability_partners")
                .select("id, status, initiated_by_user_id, user_id, partner_user_id")
                .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
                .execute()
            )

        with ThreadPoolExecutor(max_workers=2) as executor:
            partner_future = executor.submit(get_partner_user)
            partnerships_future = executor.submit(get_all_partnerships)
            partner = partner_future.result()
            partnerships_result = partnerships_future.result()

        # Check if partner user exists
        if not partner.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # Process partnerships: count for limit AND check existing with target
        accepted_count = 0
        pending_sent_count = 0
        existing_with_target = None

        for p in partnerships_result.data or []:
            p_user_id = p.get("user_id")
            p_partner_id = p.get("partner_user_id")
            p_status = p.get("status")

            # Check if this is a partnership with the target user
            if (p_user_id == user_id and p_partner_id == partner_user_id) or (
                p_user_id == partner_user_id and p_partner_id == user_id
            ):
                existing_with_target = p

            # Count for limit (only accepted and pending)
            if p_status == "accepted":
                accepted_count += 1
            elif p_status == "pending" and p.get("initiated_by_user_id") == user_id:
                pending_sent_count += 1

        # Check existing partnership with target
        if existing_with_target:
            status_val = existing_with_target.get("status")
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
            elif status_val == "blocked":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot send partner request to this user",
                )

        # Check limit (None = unlimited)
        total_toward_limit = accepted_count + pending_sent_count
        if partner_limit is not None and total_toward_limit >= partner_limit:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You have reached your partner limit ({partner_limit}). "
                f"You have {accepted_count} partners and {pending_sent_count} pending requests.",
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
                deep_link="/(user)/profile/partners?tab=received",  # Go to partners screen to see request
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
                    entity_type="partner_accepted",
                    entity_id=partnership_id,
                    deep_link=f"/(user)/profile/partner/{user_id}?partnershipId={partnership_id}",
                    context={
                        "original_sender_id": original_sender_id,
                    },
                )
            )

        # Check achievements for both users (non-blocking) - e.g., "first_partner" badge
        try:
            from app.services.tasks import check_achievements_task

            # Check for accepter
            check_achievements_task.delay(
                user_id=user_id,
                source_type="partner",
                source_id=partnership_id,
            )
            # Check for sender
            if original_sender_id:
                check_achievements_task.delay(
                    user_id=original_sender_id,
                    source_type="partner",
                    source_id=partnership_id,
                )
        except Exception as e:
            logger.warning(
                f"Failed to queue achievement check for partner acceptance: {e}",
                {"partnership_id": partnership_id},
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

        # Fetch nudge IDs BEFORE deleting (cascade will remove them)
        nudges_query = (
            supabase.table("social_nudges")
            .select("id")
            .eq("partnership_id", partnership_id)
            .execute()
        )
        nudge_ids = [n["id"] for n in (nudges_query.data or [])]

        # Delete the partnership (cascade deletes social_nudges)
        supabase.table("accountability_partners").delete().eq(
            "id", partnership_id
        ).execute()

        # Fire-and-forget: cleanup notifications (pass nudge_ids since they're now deleted)
        from app.services.cleanup_service import fire_and_forget_partner_cleanup

        fire_and_forget_partner_cleanup(
            partnership_id, reason="removed", nudge_ids=nudge_ids
        )

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


# ===== PARTNER DASHBOARD - View partner's goals and progress =====


class PartnerGoalSummary(BaseModel):
    """Summary of a partner's goal for accountability view (V2)"""

    id: str
    title: str
    status: str
    current_streak: int = 0
    logged_today: bool = False
    frequency_type: str = "daily"  # "daily" or "weekly"
    today_checkin_status: Optional[str] = None


class PartnerDashboard(BaseModel):
    """Partner's accountability dashboard data"""

    partner: PartnerUserInfo
    partnership_id: str
    partnership_created_at: str
    goals: List[PartnerGoalSummary]
    total_active_goals: int = 0
    overall_streak: int = 0
    logged_today: bool = False
    has_scheduled_today: bool = (
        True  # Whether partner has any goals scheduled for today
    )


def is_scheduled_today(frequency: Optional[str], days_of_week: Optional[list]) -> bool:
    """
    Check if a goal is scheduled for today based on frequency settings.

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

    Shows the partner's active goals, progress, and "logged today" status.
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

        if not partnership or not partnership.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Partnership not found or not accepted",
            )

        partnership_id = partnership.data["id"]
        partnership_created_at = partnership.data["created_at"]

        # Get partner's user info (include status to check if active)
        partner_info = (
            supabase.table("users")
            .select("id, name, username, profile_picture_url, status, last_active_at")
            .eq("id", partner_user_id)
            .maybe_single()
            .execute()
        )

        if not partner_info or not partner_info.data:
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

        # Check if partner has accountability feature (limit > 0)
        from app.services.subscription_service import get_user_feature_value

        partner_limit = await get_user_feature_value(
            supabase, partner_user_id, "accountability_partner_limit"
        )
        partner_has_feature = partner_limit is None or partner_limit > 0

        # V2: Get overall stats from goals table (denormalized)
        goals_stats_result = (
            supabase.table("goals")
            .select("current_streak")
            .eq("user_id", partner_user_id)
            .eq("status", "active")
            .execute()
        )
        overall_streak = 0
        for g in goals_stats_result.data or []:
            streak = g.get("current_streak", 0) or 0
            if streak > overall_streak:
                overall_streak = streak

        # V2: Get partner's active goals (simplified schema)
        goals_result = (
            supabase.table("goals")
            .select(
                "id, title, status, frequency_type, frequency_count, target_days, "
                "current_streak, longest_streak, total_completions"
            )
            .eq("user_id", partner_user_id)
            .eq("status", "active")
            .order("created_at", desc=True)
            .execute()
        )

        # V2: All active goals are shown (no actionable_plans in V2)
        goals_data = goals_result.data or []
        goal_ids = [g["id"] for g in goals_data]
        today_checkins: Dict[str, Optional[str]] = {}

        if goal_ids:
            # Batch fetch: today's check-ins
            checkins_result = (
                supabase.table("check_ins")
                .select("goal_id, status")
                .eq("user_id", partner_user_id)
                .eq("check_in_date", today)
                .in_("goal_id", goal_ids)
                .execute()
            )

            for ci in checkins_result.data or []:
                if ci.get("goal_id"):
                    # V2: Use status field directly (completed, skipped, rest_day)
                    today_checkins[ci["goal_id"]] = ci.get("status")

        # Build goal summaries (V2: goals only)
        goal_summaries = []
        for goal in goals_data:
            goal_id = goal["id"]
            status = today_checkins.get(goal_id)
            logged_today = status in ("completed", "rest_day")

            goal_summaries.append(
                PartnerGoalSummary(
                    id=goal_id,
                    title=goal["title"],
                    status=goal["status"],
                    current_streak=goal.get("current_streak", 0) or 0,
                    logged_today=logged_today,
                    frequency_type=goal.get("frequency_type", "daily"),
                    today_checkin_status=status,
                )
            )

        # Calculate if partner logged today (goals only in V2)
        partner_logged_today = any(g.logged_today for g in goal_summaries)

        # Calculate if partner has anything scheduled for today
        goals_scheduled_today = False
        for goal in goals_data:
            freq = goal.get("frequency_type", "daily")
            days = goal.get("target_days", [])
            scheduled = is_scheduled_today(freq, days)
            if scheduled:
                goals_scheduled_today = True
                break

        partner_has_scheduled_today = goals_scheduled_today

        return PartnerDashboard(
            partner=PartnerUserInfo(
                id=partner_info.data["id"],
                name=partner_info.data.get("name"),
                username=partner_info.data.get("username"),
                profile_picture_url=partner_info.data.get("profile_picture_url"),
                last_active_at=partner_info.data.get("last_active_at"),
                has_partner_feature=partner_has_feature,
                is_active=partner_is_active,
            ),
            partnership_id=partnership_id,
            partnership_created_at=partnership_created_at,
            goals=goal_summaries,
            total_active_goals=len(goal_summaries),
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


# ===== BLOCK PARTNER =====


@router.post("/{partnership_id}/block")
async def block_partner(
    partnership_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Block a partner. This will:
    1. Update partnership status to 'blocked'
    2. Prevent future matching with this user
    3. Hide them from suggested partners

    Unlike remove_partner (DELETE), blocking persists the record with 'blocked' status.
    """
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
            .maybe_single()
            .execute()
        )

        if not partnership.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Partnership not found",
            )

        # Check if already blocked
        if partnership.data.get("status") == "blocked":
            return {"message": "Partner already blocked"}

        # Update status to blocked
        supabase.table("accountability_partners").update(
            {
                "status": "blocked",
                "blocked_by": user_id,
                "updated_at": datetime.utcnow().isoformat(),
            }
        ).eq("id", partnership_id).execute()

        # Fire-and-forget: cleanup notifications and social_nudges between users
        from app.services.cleanup_service import fire_and_forget_partner_cleanup

        fire_and_forget_partner_cleanup(partnership_id, reason="blocked")

        logger.info(
            f"Partner blocked: {partnership_id} by {user_id}",
            {"partnership_id": partnership_id, "user_id": user_id},
        )

        return {"message": "Partner blocked successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to block partner {partnership_id}",
            {"error": str(e), "partnership_id": partnership_id, "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to block partner",
        )


@router.post("/{partnership_id}/unblock")
async def unblock_partner(
    partnership_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Unblock a previously blocked partner.
    This deletes the partnership record entirely - a clean slate.
    If they want to be partners again, they can search and send a new request.
    """
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Get the partnership
        partnership = (
            supabase.table("accountability_partners")
            .select("*")
            .eq("id", partnership_id)
            .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
            .eq("status", "blocked")
            .maybe_single()
            .execute()
        )

        if not partnership.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Blocked partnership not found",
            )

        # Delete the partnership record entirely (clean slate)
        supabase.table("accountability_partners").delete().eq(
            "id", partnership_id
        ).execute()

        logger.info(
            f"Partner unblocked (deleted): {partnership_id} by {user_id}",
            {"partnership_id": partnership_id, "user_id": user_id},
        )

        return {"message": "Partner unblocked"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to unblock partner {partnership_id}",
            {"error": str(e), "partnership_id": partnership_id, "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to unblock partner",
        )


# ===== REPORT USER =====


def _block_partner_if_exists(supabase, blocker_id: str, user_id: str) -> bool:
    """
    Block a partner if an active partnership exists between blocker and user.
    Returns True if blocked, False if no partnership found.
    """
    from datetime import datetime
    from app.services.cleanup_service import fire_and_forget_partner_cleanup

    partnership = (
        supabase.table("accountability_partners")
        .select("id")
        .or_(
            f"and(user_id.eq.{blocker_id},partner_user_id.eq.{user_id}),"
            f"and(user_id.eq.{user_id},partner_user_id.eq.{blocker_id})"
        )
        .eq("status", "accepted")
        .maybe_single()
        .execute()
    )

    if partnership and partnership.data:
        partnership_id = partnership.data["id"]

        supabase.table("accountability_partners").update(
            {
                "status": "blocked",
                "blocked_by": blocker_id,
                "updated_at": datetime.utcnow().isoformat(),
            }
        ).eq("id", partnership_id).execute()

        # Fire-and-forget: cleanup notifications and social_nudges
        fire_and_forget_partner_cleanup(partnership_id, reason="blocked")

        logger.info(f"Blocked partner after report: {partnership_id}")
        return True

    return False


class ReportUserRequest(BaseModel):
    """Request to report a user for inappropriate content"""

    reason: str  # "inappropriate_username", "harassment", "spam", "other"
    details: Optional[str] = None  # Additional context
    block_partner: bool = False  # Whether to also block the partner


@router.post("/report/{user_id}")
async def report_user(
    user_id: str,
    report_data: ReportUserRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Report a user for inappropriate username or behavior.

    This creates a report record for admin review and optionally
    auto-blocks the user if they're a partner.
    """
    from app.core.database import get_supabase_client
    from uuid import uuid4

    supabase = get_supabase_client()
    reporter_id = current_user["id"]

    # Don't allow reporting yourself
    if user_id == reporter_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot report yourself",
        )

    try:
        # Check if reported user exists
        reported_user = (
            supabase.table("users")
            .select("id, username, name")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )

        if not reported_user.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        # Check for duplicate report (same reporter, same user, within 24 hours)
        from datetime import datetime, timedelta

        yesterday = (datetime.utcnow() - timedelta(hours=24)).isoformat()

        existing_report = (
            supabase.table("user_reports")
            .select("id")
            .eq("reporter_id", reporter_id)
            .eq("reported_user_id", user_id)
            .gte("created_at", yesterday)
            .limit(1)
            .execute()
        )

        if existing_report.data:
            # Still block if requested, even if already reported
            blocked = False
            if report_data.block_partner:
                blocked = _block_partner_if_exists(supabase, reporter_id, user_id)
            return {
                "message": "You've already reported this user recently. Our team is reviewing.",
                "blocked": blocked,
            }

        # Create the report
        report_record = {
            "id": str(uuid4()),
            "reporter_id": reporter_id,
            "reported_user_id": user_id,
            "reported_username": reported_user.data.get("username"),
            "reason": report_data.reason,
            "details": report_data.details,
            "status": "pending",  # pending, reviewed, actioned, dismissed
            "created_at": datetime.utcnow().isoformat(),
        }

        supabase.table("user_reports").insert(report_record).execute()

        logger.info(
            f"User reported: {user_id} by {reporter_id}",
            {
                "reported_user_id": user_id,
                "reporter_id": reporter_id,
                "reason": report_data.reason,
            },
        )

        # If they're partners and block_partner is True, block them
        blocked = False
        if report_data.block_partner:
            blocked = _block_partner_if_exists(supabase, reporter_id, user_id)

        return {
            "message": "Thank you for your report. Our team will review it.",
            "report_id": report_record["id"],
            "blocked": blocked,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to report user {user_id}",
            {"error": str(e), "user_id": user_id, "reporter_id": reporter_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit report",
        )
