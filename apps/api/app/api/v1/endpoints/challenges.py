"""
Challenges API endpoints
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Tuple
from datetime import date
from app.core.flexible_auth import get_current_user
from app.services.logger import logger
from app.services.challenge_service import challenge_service

router = APIRouter(redirect_slashes=False)


def check_challenge_access(
    challenge_id: str, current_user_id: str, supabase
) -> Tuple[bool, Optional[dict], bool, bool]:
    """
    Check if user can access a challenge.

    Access is granted if:
    - Challenge is public (anyone can view)
    - User is the creator
    - User is a participant
    - User is a partner of a participant (read-only, partner view)

    Returns:
        Tuple of (has_access, challenge_data, is_partner_view, is_participant)
    """
    # Get challenge data
    challenge_result = (
        supabase.table("challenges")
        .select("*, creator:created_by(id, name, username, profile_picture_url)")
        .eq("id", challenge_id)
        .maybe_single()
        .execute()
    )

    if not challenge_result or not challenge_result.data:
        return False, None, False, False

    challenge = challenge_result.data
    is_public = challenge.get("is_public", False)
    is_creator = challenge.get("created_by") == current_user_id

    # Check if user is a participant
    participant_result = (
        supabase.table("challenge_participants")
        .select("id")
        .eq("challenge_id", challenge_id)
        .eq("user_id", current_user_id)
        .maybe_single()
        .execute()
    )
    is_participant = bool(participant_result and participant_result.data)

    # Case 1: Public challenge - anyone can view
    if is_public:
        return True, challenge, False, is_participant

    # Case 2: Creator always has access
    if is_creator:
        return True, challenge, False, True  # Creator is always considered participant

    # Case 3: Participant has access
    if is_participant:
        return True, challenge, False, True

    # Case 4: Check if user is a partner of any participant
    # Get all participant user IDs
    participants_result = (
        supabase.table("challenge_participants")
        .select("user_id")
        .eq("challenge_id", challenge_id)
        .execute()
    )

    if participants_result and participants_result.data:
        participant_ids = [p["user_id"] for p in participants_result.data]

        # Check if current user is a partner of any participant
        for participant_id in participant_ids:
            partnership_result = (
                supabase.table("accountability_partners")
                .select("id")
                .eq("status", "accepted")
                .or_(
                    f"and(user_id.eq.{current_user_id},partner_user_id.eq.{participant_id}),"
                    f"and(user_id.eq.{participant_id},partner_user_id.eq.{current_user_id})"
                )
                .maybe_single()
                .execute()
            )

            if partnership_result and partnership_result.data:
                return (
                    True,
                    challenge,
                    True,
                    False,
                )  # Partner view (read-only, not a participant)

    # No access
    return False, None, False, False


class ChallengeCreate(BaseModel):
    """
    Request body for creating a standalone challenge.

    Challenges can now be created directly without needing a goal first.
    The challenge will have its own actionable plan generated and stored
    in the actionable_plans table (with challenge_id instead of goal_id).

    Challenge types:
    - streak: Time Challenge (duration-based, focus on maintaining streaks)
    - checkin_count: Target Challenge (count-based, complete X check-ins)
    """

    title: str
    description: Optional[str] = None
    challenge_type: str  # streak or checkin_count only
    duration_days: int
    start_date: date
    end_date: Optional[date] = (
        None  # Optional - calculated from start_date + duration_days if not provided
    )
    is_public: bool = True
    max_participants: Optional[int] = None  # null = unlimited
    join_deadline: Optional[date] = None  # Must be before start_date

    # Goal-like fields for plan generation
    category: Optional[str] = None  # fitness, nutrition, wellness, etc.
    frequency: Optional[str] = "daily"  # daily, weekly
    days_of_week: Optional[List[int]] = None  # 0-6 for Sun-Sat
    target_days: Optional[int] = None  # Target days per week
    target_checkins: Optional[int] = None  # Required for checkin_count type
    # Tracking type - how users complete their check-ins
    # Default to None so backend can derive from category if not specified
    tracking_type: Optional[str] = None  # workout, meal, hydration, checkin
    reminder_times: Optional[List[str]] = None  # HH:MM format

    metadata: Optional[Dict[str, Any]] = None


class ChallengeResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    challenge_type: str
    duration_days: int
    start_date: date
    end_date: date
    is_public: bool
    status: str  # 'upcoming', 'active', 'completed', 'cancelled'
    max_participants: Optional[int]
    created_by: Optional[str]
    metadata: Dict[str, Any]
    created_at: str
    updated_at: str


class ChallengeCreatorInfo(BaseModel):
    """Creator info for challenge detail"""

    id: str
    name: Optional[str] = None
    username: Optional[str] = None
    profile_picture_url: Optional[str] = None


class ChallengeDetailResponse(BaseModel):
    """Extended response for GET /challenges/{id} with computed fields"""

    id: str
    title: str
    description: Optional[str] = None
    challenge_type: str
    duration_days: Optional[int] = None
    start_date: date
    end_date: Optional[date] = None
    join_deadline: Optional[date] = None
    target_value: Optional[int] = None
    is_public: bool
    status: str = "upcoming"  # 'upcoming', 'active', 'completed', 'cancelled'
    max_participants: Optional[int] = None
    created_by: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: str
    updated_at: str
    # Standalone challenge fields (direct on challenge, not in goal_template)
    category: Optional[str] = None
    frequency: Optional[str] = None
    target_days: Optional[int] = None
    days_of_week: Optional[List[int]] = None
    target_checkins: Optional[int] = None
    reminder_times: Optional[List[str]] = None
    tracking_type: Optional[str] = (
        None  # workout, meal, hydration, checkin - derived from category
    )
    # Computed fields
    status: str  # upcoming, active, completed, cancelled
    creator_id: Optional[str] = None  # Alias for created_by
    creator: Optional[ChallengeCreatorInfo] = None
    participants_count: int = 0
    is_creator: bool = False
    is_participant: bool = False
    is_partner_view: bool = False  # True if viewing as a partner (read-only)
    my_progress: Optional[int] = None
    my_rank: Optional[int] = None

    class Config:
        extra = "allow"  # Allow extra fields from database


class ChallengeParticipantResponse(BaseModel):
    id: str
    challenge_id: str
    user_id: str
    goal_id: Optional[str]
    joined_at: str
    progress_data: Dict[str, Any]
    rank: Optional[int]
    points: int
    completed_at: Optional[str]


@router.post("/", response_model=ChallengeResponse, status_code=status.HTTP_201_CREATED)
async def create_challenge(
    challenge_data: ChallengeCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new challenge"""
    from app.core.database import get_supabase_client
    from app.core.subscriptions import check_user_has_feature
    from app.api.v1.endpoints.goals import (
        get_user_challenge_limit,
        get_user_challenge_participation_count,
    )

    supabase = get_supabase_client()
    user_id = current_user["id"]
    user_plan = current_user.get("plan", "free")

    # 1. Check feature access: challenge_create (starter+ only)
    if not check_user_has_feature(user_id, "challenge_create", user_plan, supabase):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Creating challenges is available on Starter plan and above. "
            "Upgrade your plan to create challenges.",
        )

    # 2. Check challenge_limit (creating counts towards participation)
    challenge_limit = get_user_challenge_limit(user_plan, supabase)
    current_participation_count = get_user_challenge_participation_count(
        user_id, supabase
    )

    if challenge_limit is not None and current_participation_count >= challenge_limit:
        plan_name = user_plan.capitalize()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{plan_name} plan allows only {challenge_limit} challenge(s). "
            f"Complete or leave a challenge first to create a new one.",
        )

    try:
        challenge = await challenge_service.create_challenge(
            user_id=user_id,
            title=challenge_data.title,
            description=challenge_data.description,
            challenge_type=challenge_data.challenge_type,
            duration_days=challenge_data.duration_days,
            start_date=challenge_data.start_date,
            end_date=challenge_data.end_date,  # Optional - service calculates if not provided
            is_public=challenge_data.is_public,
            max_participants=challenge_data.max_participants,
            join_deadline=challenge_data.join_deadline,
            # Goal-like fields for plan generation
            category=challenge_data.category,
            frequency=challenge_data.frequency,
            days_of_week=challenge_data.days_of_week,
            target_days=challenge_data.target_days,
            target_checkins=challenge_data.target_checkins,
            reminder_times=challenge_data.reminder_times,
            tracking_type=challenge_data.tracking_type,
            metadata=challenge_data.metadata or {},
            # User context for plan generation (same as goals.py)
            user_plan=user_plan,
            user_timezone=current_user.get("timezone", "UTC"),
        )

        return challenge

    except Exception as e:
        logger.error(
            f"Failed to create challenge for user {user_id}",
            {"error": str(e), "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create challenge: {str(e)}",
        )


@router.get("/", response_model=List[ChallengeResponse])
async def get_challenges(
    current_user: dict = Depends(get_current_user),
    is_public: Optional[bool] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    my_challenges: bool = Query(False),
):
    """Get available challenges"""
    try:
        user_id = current_user["id"] if my_challenges else None

        challenges = await challenge_service.get_challenges(
            user_id=user_id,
            is_public=is_public,
            status=status_filter,
        )

        return challenges

    except Exception as e:
        logger.error(
            f"Failed to get challenges",
            {"error": str(e), "user_id": current_user["id"]},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve challenges",
        )


@router.get("/my")
async def get_my_challenges(
    current_user: dict = Depends(get_current_user),
    status: Optional[str] = Query(
        None, description="Filter by status: upcoming, active, completed, cancelled"
    ),
):
    """
    Get all challenges the user has access to.
    This includes:
    - Challenges created by the user
    - Challenges the user has joined

    For GoalsScreen - shows user's personal challenge library.
    """
    try:
        challenges = await challenge_service.get_my_challenges(
            user_id=current_user["id"],
            status=status,
        )

        return challenges

    except Exception as e:
        logger.error(
            f"Failed to get user's challenges",
            {"error": str(e), "user_id": current_user["id"]},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve challenges",
        )


@router.get("/public")
async def get_public_challenges(
    current_user: dict = Depends(get_current_user),
    status: Optional[str] = Query(
        None, description="Filter by status: upcoming, active, completed, cancelled"
    ),
):
    """
    Get all public challenges for discovery.
    Returns public challenges that can be joined (upcoming or active).
    This is for the SocialScreen discover section.
    """
    try:
        challenges = await challenge_service.get_challenges(
            user_id=None,  # Don't filter by user
            is_public=True,
            status=status,
        )

        return challenges

    except Exception as e:
        logger.error(
            f"Failed to get public challenges",
            {"error": str(e), "user_id": current_user["id"]},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve public challenges",
        )


@router.get("/{challenge_id}", response_model=ChallengeDetailResponse)
async def get_challenge(
    challenge_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Get challenge by ID with full details including computed fields.

    Access control:
    - Public challenges: Anyone can view
    - Private challenges: Only creator, participants, or partners of participants
    """
    from app.core.database import get_supabase_client
    from datetime import date

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Check access using helper function
    has_access, challenge, is_partner_view, is_participant_from_check = (
        check_challenge_access(challenge_id, user_id, supabase)
    )

    if not has_access or not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found"
        )

    # Status is stored in the database - no need to compute
    # Just validate it's a valid status value
    if challenge.get("status") not in ("upcoming", "active", "completed", "cancelled"):
        challenge["status"] = "upcoming"  # Default fallback

    # Set target_value based on challenge type for progress tracking
    challenge_type = challenge.get("challenge_type")
    if challenge_type == "checkin_count":
        challenge["target_value"] = challenge.get("target_checkins")
    elif challenge_type == "streak":
        challenge["target_value"] = challenge.get("duration_days")

    # Add creator flag (column is created_by, not creator_id)
    is_creator = challenge.get("created_by") == user_id
    challenge["is_creator"] = is_creator
    challenge["creator_id"] = challenge.get("created_by")  # Alias for frontend

    # Add partner view flag for frontend
    challenge["is_partner_view"] = is_partner_view

    # Privacy filter: hide sensitive schedule data for partner view
    if is_partner_view:
        challenge["reminder_times"] = None  # Hide daily schedule

    # Get participants count
    try:
        participants_count_result = (
            supabase.table("challenge_participants")
            .select("id", count="exact")
            .eq("challenge_id", challenge_id)
            .execute()
        )
        challenge["participants_count"] = (
            participants_count_result.count if participants_count_result else 0
        ) or 0
    except Exception:
        challenge["participants_count"] = 0

    # Use the is_participant from access check, or verify again
    is_participant = is_participant_from_check or is_creator
    challenge["is_participant"] = is_participant

    # Get scoring data from leaderboard (rank, points, progress_data all in one place)
    try:
        leaderboard_result = (
            supabase.table("challenge_leaderboard")
            .select("rank, points, progress_data")
            .eq("challenge_id", challenge_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )

        if leaderboard_result and leaderboard_result.data:
            challenge["my_rank"] = leaderboard_result.data.get("rank")
            challenge["my_progress"] = leaderboard_result.data.get("points", 0)
        else:
            # Not in leaderboard yet (no check-ins)
            challenge["my_rank"] = None
            challenge["my_progress"] = 0
    except Exception:
        # Leaderboard query failed - default to no rank
        challenge["my_rank"] = None
        challenge["my_progress"] = 0

    return challenge


@router.post("/{challenge_id}/join", response_model=ChallengeParticipantResponse)
async def join_challenge(
    challenge_id: str,
    current_user: dict = Depends(get_current_user),
    goal_id: Optional[str] = Query(None),
):
    """
    Join a challenge.

    Checks:
    1. Feature access: challenge_join (available to all tiers)
    2. Limit: challenge_limit (total created + joined)
    """
    from app.core.database import get_supabase_client
    from app.core.subscriptions import check_user_has_feature
    from app.api.v1.endpoints.goals import (
        get_user_challenge_limit,
        get_user_challenge_participation_count,
    )

    supabase = get_supabase_client()
    user_id = current_user["id"]
    user_plan = current_user.get("plan", "free")

    # 1. Check feature access: challenge_join (available to all tiers)
    if not check_user_has_feature(user_id, "challenge_join", user_plan, supabase):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Joining challenges is not available on your current plan.",
        )

    # 2. Check challenge_limit from plan_features (covers both created and joined)
    challenge_limit = get_user_challenge_limit(user_plan, supabase)

    # Count total challenges user is participating in (created + joined)
    current_participation_count = get_user_challenge_participation_count(
        user_id, supabase
    )

    # Check limit (None = unlimited)
    if challenge_limit is not None and current_participation_count >= challenge_limit:
        plan_name = user_plan.capitalize()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{plan_name} plan allows only {challenge_limit} challenge(s). "
            f"Complete or leave a challenge first to join a new one.",
        )

    try:
        participant = await challenge_service.join_challenge(
            challenge_id=challenge_id,
            user_id=user_id,
            goal_id=goal_id,
        )

        # Notify partners that user joined a challenge
        from app.services.social_accountability_service import (
            social_accountability_service,
        )

        await social_accountability_service.notify_partners_of_data_change(
            user_id, "challenge_joined"
        )

        return participant

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            f"Failed to join challenge {challenge_id} for user {user_id}",
            {
                "error": str(e),
                "challenge_id": challenge_id,
                "user_id": user_id,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to join challenge: {str(e)}",
        )


@router.get("/{challenge_id}/leaderboard")
async def get_challenge_leaderboard(
    challenge_id: str,
    current_user: dict = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=100),
):
    """Get challenge leaderboard"""
    try:
        leaderboard = await challenge_service.get_challenge_leaderboard(
            challenge_id=challenge_id, limit=limit
        )

        return leaderboard

    except Exception as e:
        logger.error(
            f"Failed to get leaderboard for challenge {challenge_id}",
            {"error": str(e), "challenge_id": challenge_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve leaderboard",
        )


class ParticipantWithUserResponse(BaseModel):
    """Participant with user info for list endpoint"""

    id: str
    challenge_id: str
    user_id: str
    joined_at: str
    points: int
    rank: Optional[int] = None
    user: Optional[Dict[str, Any]] = None


@router.get("/{challenge_id}/participants")
async def get_challenge_participants(
    challenge_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get all participants for a challenge with user info and rank"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Get participants from challenge_participants table
    participants_result = (
        supabase.table("challenge_participants")
        .select("id, challenge_id, user_id, joined_at")
        .eq("challenge_id", challenge_id)
        .execute()
    )

    participants = participants_result.data or []

    if not participants:
        return []

    # Get user ids to fetch user info
    user_ids = [p["user_id"] for p in participants]

    # Get user info
    users_result = (
        supabase.table("users")
        .select("id, name, username, profile_picture_url")
        .in_("id", user_ids)
        .execute()
    )

    users_map = {u["id"]: u for u in (users_result.data or [])}

    # Get leaderboard data for points and ranks
    leaderboard_result = (
        supabase.table("challenge_leaderboard")
        .select("user_id, points, rank")
        .eq("challenge_id", challenge_id)
        .execute()
    )

    leaderboard_map = {l["user_id"]: l for l in (leaderboard_result.data or [])}

    # Combine data
    result = []
    for p in participants:
        user_info = users_map.get(p["user_id"])
        leaderboard_info = leaderboard_map.get(p["user_id"], {})

        result.append(
            {
                "id": p["id"],
                "challenge_id": p["challenge_id"],
                "user_id": p["user_id"],
                "joined_at": p["joined_at"],
                "points": leaderboard_info.get("points", 0),
                "rank": leaderboard_info.get("rank"),
                "user": user_info,
            }
        )

    # Sort by rank (participants with no rank go to end)
    result.sort(key=lambda x: (x["rank"] is None, x["rank"] or 0))

    return result


@router.post("/{challenge_id}/update-progress")
async def update_challenge_progress(
    challenge_id: str, current_user: dict = Depends(get_current_user)
):
    """Manually update challenge progress for current user"""
    try:
        participant = await challenge_service.update_participant_progress(
            challenge_id=challenge_id,
            user_id=current_user["id"],
        )

        return participant

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            f"Failed to update progress for challenge {challenge_id}, user {current_user['id']}",
            {
                "error": str(e),
                "challenge_id": challenge_id,
                "user_id": current_user["id"],
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update progress: {str(e)}",
        )


# =====================================================
# CHALLENGE CHECK-INS
# =====================================================
class ChallengeCheckInRequest(BaseModel):
    """Request to check into a challenge"""

    check_in_date: Optional[date] = None  # Defaults to today
    notes: Optional[str] = None
    mood: Optional[str] = None  # great, good, okay, bad, terrible
    photo_url: Optional[str] = None


class ChallengeCheckInResponse(BaseModel):
    """Response after checking into a challenge"""

    id: str
    challenge_id: str
    user_id: str
    check_in_date: str
    notes: Optional[str]
    mood: Optional[str]
    photo_url: Optional[str]
    created_at: str
    points_earned: int
    new_total_points: int
    new_rank: Optional[int]


@router.post("/{challenge_id}/check-in", response_model=ChallengeCheckInResponse)
async def challenge_check_in(
    challenge_id: str,
    data: ChallengeCheckInRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Check into a challenge.

    This is separate from goal check-ins. Challenge check-ins:
    - Track participation in the shared challenge
    - Update the leaderboard
    - Award points based on challenge type
    """
    from app.core.database import get_supabase_client
    from datetime import datetime

    supabase = get_supabase_client()
    user_id = current_user["id"]
    check_in_date = data.check_in_date or date.today()

    # Verify challenge exists and is active
    challenge_result = (
        supabase.table("challenges")
        .select("*")
        .eq("id", challenge_id)
        .maybe_single()
        .execute()
    )

    if not challenge_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found",
        )

    challenge = challenge_result.data

    # Check if challenge is active
    if challenge.get("status") not in ("upcoming", "active"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This challenge is no longer active",
        )

    # Check if challenge has started
    challenge_start = date.fromisoformat(challenge["start_date"])
    if check_in_date < challenge_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Challenge has not started yet",
        )

    # Check if challenge has ended
    challenge_end = date.fromisoformat(challenge["end_date"])
    if check_in_date > challenge_end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Challenge has already ended",
        )

    # Verify user is a participant (membership check only)
    participant_result = (
        supabase.table("challenge_participants")
        .select("id, user_id, joined_at")
        .eq("challenge_id", challenge_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if not participant_result.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must join this challenge before checking in",
        )

    # Find pre-created check-in record for today
    existing_checkin_result = (
        supabase.table("challenge_check_ins")
        .select("*")
        .eq("challenge_id", challenge_id)
        .eq("user_id", user_id)
        .eq("check_in_date", check_in_date.isoformat())
        .execute()
    )

    existing_checkin = (
        existing_checkin_result.data[0] if existing_checkin_result.data else None
    )

    # Check if already checked in (is_checked_in=true)
    if existing_checkin and existing_checkin.get("is_checked_in"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already checked in today. Check-ins are limited to once per day.",
        )

    # Get current leaderboard entry (for points and progress)
    leaderboard_entry_result = (
        supabase.table("challenge_leaderboard")
        .select("*")
        .eq("challenge_id", challenge_id)
        .eq("user_id", user_id)
        .execute()
    )
    leaderboard_entry = (
        leaderboard_entry_result.data[0]
        if leaderboard_entry_result.data and len(leaderboard_entry_result.data) > 0
        else None
    )

    # Validate mood if provided
    valid_moods = ["great", "good", "okay", "bad", "terrible"]
    if data.mood and data.mood not in valid_moods:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid mood. Must be one of: {', '.join(valid_moods)}",
        )

    # Update or create the check-in
    check_in_update_data = {
        "completed": True,
        "is_checked_in": True,
        "notes": data.notes,
        "mood": data.mood,
        "photo_url": data.photo_url,
    }

    if existing_checkin:
        # UPDATE the pre-created record
        try:
            check_in_result = (
                supabase.table("challenge_check_ins")
                .update(check_in_update_data)
                .eq("id", existing_checkin["id"])
                .execute()
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update check-in: {str(e)}",
            )
    else:
        # Fallback: INSERT new record (for backwards compatibility during transition)
        check_in_insert_data = {
            "challenge_id": challenge_id,
            "user_id": user_id,
            "check_in_date": check_in_date.isoformat(),
            **check_in_update_data,
        }
        try:
            check_in_result = (
                supabase.table("challenge_check_ins")
                .insert(check_in_insert_data)
                .execute()
            )
        except Exception as e:
            error_msg = str(e)
            if (
                "duplicate key" in error_msg.lower()
                or "unique constraint" in error_msg.lower()
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You have already checked in for this date",
                )
            raise

    if not check_in_result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save check-in",
        )

    check_in = check_in_result.data[0]

    # Get current points from leaderboard (or 0 if first check-in)
    current_entry = leaderboard_entry if leaderboard_entry else {}
    current_points = current_entry.get("points", 0)

    # Check if user already checked in today (from progress_data.last_check_in)
    # If so, don't add points - just keep the existing points
    progress_data = current_entry.get("progress_data", {}) or {}
    last_check_in_str = progress_data.get("last_check_in")
    already_checked_in_today = last_check_in_str == check_in_date.isoformat()

    if already_checked_in_today:
        # User already checked in today, don't add points
        new_total_points = current_points
        points_earned = 0
    else:
        # Calculate points based on challenge type
        challenge_type = challenge.get("challenge_type", "checkin_count")
        points_earned = 0

        if challenge_type == "streak":
            # Streak challenges: points for consecutive days
            points_earned = 10  # Base points per check-in
        elif challenge_type == "checkin_count":
            # Count challenges: fixed points per check-in
            points_earned = 5
        elif challenge_type == "community":
            # Community: combination
            points_earned = 10
        else:
            points_earned = 5  # Default

        new_total_points = current_points + points_earned

    # Get check-in count for progress data (completed only)
    check_ins_count_result = (
        supabase.table("challenge_check_ins")
        .select("id", count="exact")
        .eq("challenge_id", challenge_id)
        .eq("user_id", user_id)
        .eq("completed", True)
        .execute()
    )
    check_in_count = (
        check_ins_count_result.count
        if hasattr(check_ins_count_result, "count")
        else len(check_ins_count_result.data or [])
    )

    # Update progress data with new check-in count and date
    progress_data["checkin_count"] = check_in_count
    progress_data["last_check_in"] = check_in_date.isoformat()

    # Update or insert leaderboard entry (all scoring data goes here)
    if current_entry:
        # Update existing entry
        supabase.table("challenge_leaderboard").update(
            {
                "points": new_total_points,
                "progress_data": progress_data,
            }
        ).eq("challenge_id", challenge_id).eq("user_id", user_id).execute()
    else:
        # Create new entry (first check-in for this user)
        supabase.table("challenge_leaderboard").insert(
            {
                "challenge_id": challenge_id,
                "user_id": user_id,
                "rank": 0,  # Will be calculated next
                "points": new_total_points,
                "progress_data": progress_data,
            }
        ).execute()

    # Recalculate ranks based on points
    await challenge_service._update_leaderboard(challenge_id)

    # Get updated rank
    rank_result = (
        supabase.table("challenge_leaderboard")
        .select("rank")
        .eq("challenge_id", challenge_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    new_rank = rank_result.data.get("rank") if rank_result.data else None

    print(
        f"Challenge check-in created for user {user_id} in challenge {challenge_id}",
        {
            "challenge_id": challenge_id,
            "user_id": user_id,
            "check_in_date": check_in_date.isoformat(),
            "points_earned": points_earned,
            "new_rank": new_rank,
        },
    )

    # Check and unlock achievements in background (non-blocking)
    try:
        from app.services.tasks import check_achievements_task

        # Queue achievement check as Celery task (non-blocking)
        check_achievements_task.delay(
            user_id=user_id,
            source_type="challenge",
            source_id=challenge_id,
        )
    except Exception as e:
        # Log error but don't fail check-in
        logger.warning(
            f"Failed to queue achievement task: {e}",
            {"user_id": user_id, "challenge_id": challenge_id},
        )

    # Notify partners of the challenge check-in
    from app.services.social_accountability_service import social_accountability_service

    await social_accountability_service.notify_partners_of_data_change(
        user_id, "challenge_checkin"
    )

    return ChallengeCheckInResponse(
        id=check_in["id"],
        challenge_id=challenge_id,
        user_id=user_id,
        check_in_date=check_in_date.isoformat(),
        notes=data.notes,
        mood=data.mood,
        photo_url=data.photo_url,
        created_at=check_in["created_at"],
        points_earned=points_earned,
        new_total_points=new_total_points,
        new_rank=new_rank,
    )


@router.get("/{challenge_id}/check-ins")
async def get_challenge_check_ins(
    challenge_id: str,
    current_user: dict = Depends(get_current_user),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    limit: int = Query(50, ge=1, le=200),
):
    """Get completed check-ins for a challenge (completed=true)"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    current_user_id = current_user["id"]

    # Verify access to challenge
    has_access, _, is_partner_view = check_challenge_access(
        challenge_id, current_user_id, supabase
    )
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found",
        )

    # Privacy: partners viewing via PartnerDetailScreen cannot see check-in history
    if is_partner_view:
        return []

    # Build query - only return completed check-ins
    query = (
        supabase.table("challenge_check_ins")
        .select("*, users(id, name, username, profile_picture_url)")
        .eq("challenge_id", challenge_id)
        .eq("completed", True)
        .order("check_in_date", desc=True)
        .limit(limit)
    )

    if user_id:
        query = query.eq("user_id", user_id)

    result = query.execute()
    checkins = result.data or []

    # Privacy filter: hide sensitive data when viewing other users' check-ins
    # Only show full data for own check-ins
    for checkin in checkins:
        if checkin.get("user_id") != current_user_id:
            checkin["notes"] = None  # Hide personal reflections
            checkin["mood"] = None  # Hide emotional state
            checkin["photo_url"] = None  # Hide photos

    return checkins


@router.get("/{challenge_id}/my-check-ins")
async def get_my_challenge_check_ins(
    challenge_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get current user's check-ins for a challenge"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    result = (
        supabase.table("challenge_check_ins")
        .select("*")
        .eq("challenge_id", challenge_id)
        .eq("user_id", current_user["id"])
        .order("check_in_date", desc=True)
        .execute()
    )

    return result.data or []


class UpdateChallengeCheckInRequest(BaseModel):
    """Request to update a challenge check-in"""

    notes: Optional[str] = None
    mood: Optional[str] = None  # great, good, okay, bad, terrible
    photo_url: Optional[str] = None


@router.put("/{challenge_id}/check-ins/{check_in_id}")
async def update_challenge_check_in(
    challenge_id: str,
    check_in_id: str,
    data: UpdateChallengeCheckInRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Update a challenge check-in (notes, mood, photo).
    Only the user who created the check-in can update it.
    """
    from app.core.database import get_supabase_client
    from datetime import datetime

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Verify check-in exists and belongs to user
    check_in_result = (
        supabase.table("challenge_check_ins")
        .select("*")
        .eq("id", check_in_id)
        .eq("challenge_id", challenge_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if not check_in_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Check-in not found or you don't have permission to update it",
        )

    # Build update data (only include non-None fields)
    update_data = {"updated_at": datetime.utcnow().isoformat()}
    if data.notes is not None:
        update_data["notes"] = data.notes
    if data.mood is not None:
        if data.mood not in ["great", "good", "okay", "bad", "terrible"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid mood value. Must be: great, good, okay, bad, terrible",
            )
        update_data["mood"] = data.mood
    if data.photo_url is not None:
        update_data["photo_url"] = data.photo_url

    # Update check-in
    result = (
        supabase.table("challenge_check_ins")
        .update(update_data)
        .eq("id", check_in_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update check-in",
        )

    return result.data[0]


@router.delete("/{challenge_id}/check-ins/{check_in_id}")
async def delete_challenge_check_in(
    challenge_id: str,
    check_in_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Delete a challenge check-in and recalculate participant points.

    Only the user who created the check-in can delete it.
    Points are recalculated based on remaining check-ins.
    """
    from app.core.database import get_supabase_client
    from datetime import datetime

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Verify check-in exists and belongs to user
    check_in_result = (
        supabase.table("challenge_check_ins")
        .select("*")
        .eq("id", check_in_id)
        .eq("challenge_id", challenge_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if not check_in_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Check-in not found or you don't have permission to delete it",
        )

    # Get challenge to calculate points per check-in
    challenge_result = (
        supabase.table("challenges")
        .select("challenge_type")
        .eq("id", challenge_id)
        .maybe_single()
        .execute()
    )

    challenge_type = (
        challenge_result.data.get("challenge_type", "checkin_count")
        if challenge_result.data
        else "checkin_count"
    )

    # Calculate points that were earned for this check-in
    points_to_deduct = 5  # Default
    if challenge_type == "streak":
        points_to_deduct = 10
    elif challenge_type == "community":
        points_to_deduct = 10

    # Delete the check-in
    supabase.table("challenge_check_ins").delete().eq("id", check_in_id).execute()

    # Get remaining check-ins count (completed only)
    remaining_result = (
        supabase.table("challenge_check_ins")
        .select("id", count="exact")
        .eq("challenge_id", challenge_id)
        .eq("user_id", user_id)
        .eq("completed", True)
        .execute()
    )
    remaining_count = remaining_result.count or 0

    # Get last check-in date (completed only)
    last_check_in_result = (
        supabase.table("challenge_check_ins")
        .select("check_in_date")
        .eq("challenge_id", challenge_id)
        .eq("user_id", user_id)
        .eq("completed", True)
        .order("check_in_date", desc=True)
        .limit(1)
        .execute()
    )
    last_check_in_date = (
        last_check_in_result.data[0]["check_in_date"]
        if last_check_in_result.data
        else None
    )

    # Update leaderboard entry (all scoring data is here)
    leaderboard_result = (
        supabase.table("challenge_leaderboard")
        .select("*")
        .eq("challenge_id", challenge_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if leaderboard_result.data:
        entry = leaderboard_result.data
        current_points = entry.get("points", 0)
        new_points = max(0, current_points - points_to_deduct)

        progress_data = entry.get("progress_data", {}) or {}
        progress_data["checkin_count"] = remaining_count
        progress_data["last_check_in"] = last_check_in_date

        if remaining_count == 0:
            # No more check-ins, remove from leaderboard
            supabase.table("challenge_leaderboard").delete().eq(
                "challenge_id", challenge_id
            ).eq("user_id", user_id).execute()
        else:
            # Update points and progress
            supabase.table("challenge_leaderboard").update(
                {
                    "points": new_points,
                    "progress_data": progress_data,
                }
            ).eq("challenge_id", challenge_id).eq("user_id", user_id).execute()

    # Recalculate ranks
    await challenge_service._update_leaderboard(challenge_id)

    logger.info(
        f"Deleted check-in {check_in_id} for user {user_id} in challenge {challenge_id}",
        {
            "check_in_id": check_in_id,
            "challenge_id": challenge_id,
            "user_id": user_id,
            "points_deducted": points_to_deduct,
        },
    )

    return {
        "message": "Check-in deleted successfully",
        "check_in_id": check_in_id,
        "points_deducted": points_to_deduct,
        "remaining_check_ins": remaining_count,
    }


# =====================================================
# CHALLENGE LIFECYCLE MANAGEMENT
# =====================================================


class CancelChallengeRequest(BaseModel):
    reason: Optional[str] = None  # Optional reason for cancellation


@router.post("/{challenge_id}/cancel")
async def cancel_challenge(
    challenge_id: str,
    data: Optional[CancelChallengeRequest] = None,
    current_user: dict = Depends(get_current_user),
):
    """
    Cancel an active challenge.

    Only the creator can cancel a challenge.
    The challenge status is set to 'cancelled' but all data is preserved.
    Participants will be notified that the challenge was cancelled.
    """
    from app.core.database import get_supabase_client
    from datetime import datetime

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Get the challenge
    challenge_result = (
        supabase.table("challenges")
        .select("*")
        .eq("id", challenge_id)
        .maybe_single()
        .execute()
    )

    if not challenge_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found",
        )

    challenge = challenge_result.data

    # Only creator can cancel
    if challenge.get("created_by") != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the challenge creator can cancel it",
        )

    # Check if already cancelled
    if challenge.get("status") == "cancelled":
        return {
            "message": "Challenge is already cancelled",
            "challenge_id": challenge_id,
        }

    # Update challenge to inactive
    reason = data.reason if data else None
    update_data = {
        "status": "cancelled",
        "cancelled_at": datetime.now().isoformat(),
        "cancelled_reason": reason,
        "metadata": {
            **challenge.get("metadata", {}),
            "cancelled": True,
            "cancelled_at": date.today().isoformat(),
            "cancelled_reason": reason,
        },
    }

    supabase.table("challenges").update(update_data).eq("id", challenge_id).execute()

    # Get participant count for logging
    participants = (
        supabase.table("challenge_participants")
        .select("user_id", count="exact")
        .eq("challenge_id", challenge_id)
        .execute()
    )
    participant_count = (
        participants.count
        if hasattr(participants, "count")
        else len(participants.data or [])
    )

    logger.info(
        f"Challenge {challenge_id} cancelled by creator {user_id}",
        {
            "challenge_id": challenge_id,
            "user_id": user_id,
            "reason": reason,
            "participant_count": participant_count,
        },
    )

    # Fire-and-forget: cleanup pending invites and notifications
    from app.services.cleanup_service import fire_and_forget_challenge_cleanup

    fire_and_forget_challenge_cleanup(challenge_id, reason="cancelled")

    # Notify partners of the challenge cancellation
    from app.services.social_accountability_service import social_accountability_service

    await social_accountability_service.notify_partners_of_data_change(
        user_id, "challenge_cancelled"
    )

    # TODO: Send notifications to participants about cancellation

    return {
        "message": "Challenge cancelled successfully",
        "challenge_id": challenge_id,
        "participants_affected": participant_count,
    }


@router.delete("/{challenge_id}")
async def delete_challenge(
    challenge_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Delete a challenge permanently.

    Only the creator can delete a challenge.
    Can only delete if no other participants have joined (only creator is participant).
    If others have joined, use cancel instead.
    """
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Get the challenge
    challenge_result = (
        supabase.table("challenges")
        .select("*")
        .eq("id", challenge_id)
        .maybe_single()
        .execute()
    )

    if not challenge_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found",
        )

    challenge = challenge_result.data

    # Only creator can delete
    if challenge.get("created_by") != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the challenge creator can delete it",
        )

    # Check if others have joined
    participants = (
        supabase.table("challenge_participants")
        .select("user_id")
        .eq("challenge_id", challenge_id)
        .neq("user_id", user_id)  # Exclude creator
        .execute()
    )

    if participants.data and len(participants.data) > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete challenge with {len(participants.data)} other participant(s). "
            "Use cancel instead to preserve their data.",
        )

    # Fire-and-forget: cleanup pending invites and notifications BEFORE deleting
    # (challenge_invites has ON DELETE CASCADE, but we still need to clean notifications)
    from app.services.cleanup_service import fire_and_forget_challenge_cleanup

    fire_and_forget_challenge_cleanup(challenge_id, reason="deleted")

    # Delete the challenge (cascade will handle participants and check-ins)
    supabase.table("challenges").delete().eq("id", challenge_id).execute()

    # Note: Standalone challenges don't have source goals
    # Legacy "shared_goal" challenges are deprecated

    logger.info(
        f"Challenge {challenge_id} deleted by creator {user_id}",
        {"challenge_id": challenge_id, "user_id": user_id},
    )

    # Notify partners of the challenge deletion
    from app.services.social_accountability_service import social_accountability_service

    await social_accountability_service.notify_partners_of_data_change(
        user_id, "challenge_deleted"
    )

    return {"message": "Challenge deleted successfully"}


@router.post("/{challenge_id}/leave")
async def leave_challenge(
    challenge_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Leave a challenge as a participant.

    The creator cannot leave - they can only cancel the challenge.
    Removes the participant and their check-ins from the challenge.
    """
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Get the challenge
    challenge_result = (
        supabase.table("challenges")
        .select("*")
        .eq("id", challenge_id)
        .maybe_single()
        .execute()
    )

    if not challenge_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found",
        )

    challenge = challenge_result.data

    # Creator cannot leave - they must cancel
    if challenge.get("created_by") == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="As the creator, you cannot leave the challenge. Use cancel instead.",
        )

    # Check if user is a participant
    participant = (
        supabase.table("challenge_participants")
        .select("id")
        .eq("challenge_id", challenge_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if not participant.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not a participant in this challenge",
        )

    # Delete participant's check-ins for this challenge
    supabase.table("challenge_check_ins").delete().eq("challenge_id", challenge_id).eq(
        "user_id", user_id
    ).execute()

    # Remove leaderboard entry
    supabase.table("challenge_leaderboard").delete().eq(
        "challenge_id", challenge_id
    ).eq("user_id", user_id).execute()

    # Remove participant from challenge
    supabase.table("challenge_participants").delete().eq(
        "challenge_id", challenge_id
    ).eq("user_id", user_id).execute()

    # Recalculate ranks for remaining participants
    await challenge_service._update_leaderboard(challenge_id)

    logger.info(
        f"User {user_id} left challenge {challenge_id}",
        {"challenge_id": challenge_id, "user_id": user_id},
    )

    # Notify partners of the user leaving the challenge
    from app.services.social_accountability_service import social_accountability_service

    await social_accountability_service.notify_partners_of_data_change(
        user_id, "challenge_left"
    )

    return {"message": "You have left the challenge"}


# =====================================================
# Challenge Invite Endpoints
# =====================================================


def validate_challenge_join(
    challenge: dict, user_id: str, supabase, skip_invite_check: bool = False
) -> tuple:
    """Validate if user can join challenge

    Args:
        challenge: Challenge data dict
        user_id: User ID attempting to join
        supabase: Supabase client
        skip_invite_check: If True, skip the invite check (for invite-based joins)

    Returns:
        (can_join: bool, error_message: str or None)
    """
    # 1. Challenge must be active or upcoming
    if challenge.get("status") not in ("upcoming", "active"):
        return False, "This challenge is no longer active"

    # 2. Challenge must not have ended
    end_date_str = challenge.get("end_date")
    if end_date_str:
        from datetime import date as date_type

        if isinstance(end_date_str, str):
            end_date = date_type.fromisoformat(end_date_str)
        else:
            end_date = end_date_str
        if end_date < date_type.today():
            return False, "This challenge has already ended"

    # 3. Check join deadline (if set, otherwise use start_date)
    join_deadline_str = challenge.get("join_deadline") or challenge.get("start_date")
    if join_deadline_str:
        from datetime import date as date_type

        if isinstance(join_deadline_str, str):
            join_deadline = date_type.fromisoformat(join_deadline_str)
        else:
            join_deadline = join_deadline_str
        if join_deadline < date_type.today():
            return False, "The deadline to join this challenge has passed"

    # 4. Check max participants (if set)
    if challenge.get("max_participants"):
        participant_count = (
            supabase.table("challenge_participants")
            .select("id", count="exact")
            .eq("challenge_id", challenge["id"])
            .execute()
        )
        current_count = participant_count.count or 0
        if current_count >= challenge["max_participants"]:
            return False, "This challenge is full"

    # 5. User not already a participant
    existing = (
        supabase.table("challenge_participants")
        .select("id")
        .eq("challenge_id", challenge["id"])
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if existing.data:
        return False, "You have already joined this challenge"

    # 6. For private challenges, check if user has a valid invite
    if not skip_invite_check and not challenge.get("is_public", True):
        # Check if user is the creator (creators don't need invites)
        if challenge.get("created_by") != user_id:
            # Check for a valid (pending or accepted) invite
            invite = (
                supabase.table("challenge_invites")
                .select("id, status")
                .eq("challenge_id", challenge["id"])
                .eq("invited_user_id", user_id)
                .in_("status", ["pending", "accepted"])
                .maybe_single()
                .execute()
            )
            if not invite.data:
                return (
                    False,
                    "This is a private challenge. You need an invite to join.",
                )

    return True, None


class ChallengeInviteRequest(BaseModel):
    user_id: str  # User to invite


class ChallengeInviteResponse(BaseModel):
    id: str
    challenge_id: str
    invited_user_id: Optional[str]
    invite_code: Optional[str]
    status: str
    created_at: str


@router.post("/{challenge_id}/invite")
async def send_challenge_invite(
    challenge_id: str,
    invite_data: ChallengeInviteRequest,
    current_user: dict = Depends(get_current_user),
):
    """Send an in-app invite to a user to join a challenge"""
    from app.core.database import get_supabase_client
    from datetime import datetime, timezone, timedelta

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Check if challenge exists
    challenge = (
        supabase.table("challenges")
        .select("*")
        .eq("id", challenge_id)
        .maybe_single()
        .execute()
    )

    if not challenge.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found"
        )

    # Check if user can invite (must be creator or participant)
    is_creator = challenge.data.get("created_by") == user_id
    is_participant = (
        supabase.table("challenge_participants")
        .select("id")
        .eq("challenge_id", challenge_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    ).data

    if not is_creator and not is_participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a participant to invite others",
        )

    # Check if target user exists
    target_user = (
        supabase.table("users")
        .select("id, username")
        .eq("id", invite_data.user_id)
        .maybe_single()
        .execute()
    )

    if not target_user.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Check if user is already a participant
    existing_participant = (
        supabase.table("challenge_participants")
        .select("id")
        .eq("challenge_id", challenge_id)
        .eq("user_id", invite_data.user_id)
        .maybe_single()
        .execute()
    )

    if existing_participant and existing_participant.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a participant in this challenge",
        )

    # Check if invite already exists
    existing_invite = (
        supabase.table("challenge_invites")
        .select("id, status")
        .eq("challenge_id", challenge_id)
        .eq("invited_user_id", invite_data.user_id)
        .maybe_single()
        .execute()
    )

    if existing_invite and existing_invite.data:
        if existing_invite.data["status"] == "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An invite is already pending for this user",
            )
        # Update existing declined/expired invite to pending
        result = (
            supabase.table("challenge_invites")
            .update(
                {
                    "status": "pending",
                    "invited_by_user_id": user_id,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "expires_at": (
                        datetime.now(timezone.utc) + timedelta(days=7)
                    ).isoformat(),
                }
            )
            .eq("id", existing_invite.data["id"])
            .execute()
        )
        return {
            "message": "Invite resent successfully",
            "invite_id": existing_invite.data["id"],
        }

    # Create new invite
    invite_result = (
        supabase.table("challenge_invites")
        .insert(
            {
                "challenge_id": challenge_id,
                "invited_by_user_id": user_id,
                "invited_user_id": invite_data.user_id,
                "status": "pending",
                "expires_at": (
                    datetime.now(timezone.utc) + timedelta(days=7)
                ).isoformat(),
            }
        )
        .execute()
    )

    logger.info(
        f"Challenge invite sent",
        {
            "challenge_id": challenge_id,
            "invited_by": user_id,
            "invited_user": invite_data.user_id,
        },
    )

    # Send push notification to invited user
    try:
        from app.services.social_notification_service import (
            send_challenge_notification,
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

        await send_challenge_notification(
            notification_type=SocialNotificationType.CHALLENGE_INVITE,
            recipient_id=invite_data.user_id,
            sender_id=user_id,
            challenge_title=challenge.data.get("title", "a challenge"),
            challenge_id=challenge_id,
            sender_name=sender_name,
            entity_type="challenge",
            entity_id=challenge_id,
            supabase=supabase,
        )
    except Exception as e:
        # Don't fail the invite if notification fails
        logger.warning(f"Failed to send challenge invite notification: {e}")

    return {
        "message": "Invite sent successfully",
        "invite_id": invite_result.data[0]["id"],
    }


@router.post("/{challenge_id}/invite-link")
async def generate_challenge_invite_link(
    challenge_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Generate a shareable invite link for a challenge"""
    from app.core.database import get_supabase_client
    from app.services.referral_service import generate_invite_code
    from datetime import datetime, timezone, timedelta

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Check if challenge exists
    challenge = (
        supabase.table("challenges")
        .select("*")
        .eq("id", challenge_id)
        .maybe_single()
        .execute()
    )

    if not challenge.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found"
        )

    # Check if user can invite (must be creator or participant)
    is_creator = challenge.data.get("created_by") == user_id
    is_participant = (
        supabase.table("challenge_participants")
        .select("id")
        .eq("challenge_id", challenge_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    ).data

    if not is_creator and not is_participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a participant to generate invite links",
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

    # Create invite record (with NULL invited_user_id for link invites)
    invite_result = (
        supabase.table("challenge_invites")
        .insert(
            {
                "challenge_id": challenge_id,
                "invited_by_user_id": user_id,
                "invited_user_id": None,  # Link invite - user unknown
                "invite_code": invite_code,
                "status": "pending",
                "expires_at": (
                    datetime.now(timezone.utc) + timedelta(days=30)
                ).isoformat(),
            }
        )
        .execute()
    )

    # Build invite link with referral code for new user attribution
    invite_link = f"https://fitnudge.app/challenge/join/{invite_code}"
    if sharer_referral_code:
        invite_link += f"?ref={sharer_referral_code}"

    return {
        "invite_code": invite_code,
        "invite_link": invite_link,
        "expires_in_days": 30,
    }


@router.post("/join/{invite_code}")
async def join_challenge_via_invite(
    invite_code: str,
    current_user: dict = Depends(get_current_user),
):
    """Join a challenge via invite code

    Validates the invite code and adds user to challenge if valid.
    """
    from app.core.database import get_supabase_client
    from app.core.subscriptions import check_user_has_feature
    from app.api.v1.endpoints.goals import (
        get_user_challenge_limit,
        get_user_challenge_participation_count,
    )
    from datetime import datetime, timezone

    supabase = get_supabase_client()
    user_id = current_user["id"]
    user_plan = current_user.get("plan", "free")

    # Find the invite
    invite = (
        supabase.table("challenge_invites")
        .select("*, challenges(*)")
        .eq("invite_code", invite_code)
        .maybe_single()
        .execute()
    )

    if not invite.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invite code"
        )

    invite_data = invite.data
    challenge = invite_data.get("challenges")

    # Check if invite is still valid
    if invite_data.get("status") != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invite is no longer valid",
        )

    # Check if expired
    expires_at = invite_data.get("expires_at")
    if expires_at:
        from datetime import datetime

        if isinstance(expires_at, str):
            expires_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        else:
            expires_dt = expires_at
        if expires_dt < datetime.now(timezone.utc):
            # Mark as expired
            supabase.table("challenge_invites").update({"status": "expired"}).eq(
                "id", invite_data["id"]
            ).execute()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This invite has expired",
            )

    # Validate challenge join conditions (skip invite check since they have an invite)
    can_join, error_message = validate_challenge_join(
        challenge, user_id, supabase, skip_invite_check=True
    )
    if not can_join:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_message,
        )

    # Check feature access and limits
    if not check_user_has_feature(user_id, "challenge_join", user_plan, supabase):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Joining challenges is not available on your current plan.",
        )

    challenge_limit = get_user_challenge_limit(user_plan, supabase)
    current_count = get_user_challenge_participation_count(user_id, supabase)

    if challenge_limit is not None and current_count >= challenge_limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You have reached your challenge limit ({challenge_limit}). "
            f"Complete or leave a challenge first.",
        )

    # Join the challenge
    try:
        participant = await challenge_service.join_challenge(
            challenge_id=challenge["id"],
            user_id=user_id,
            goal_id=None,
        )

        # Mark invite as accepted and set the user who accepted
        supabase.table("challenge_invites").update(
            {
                "status": "accepted",
                "accepted_at": datetime.now(timezone.utc).isoformat(),
                "invited_user_id": user_id,  # Set the user who accepted (for link invites)
            }
        ).eq("id", invite_data["id"]).execute()

        logger.info(
            f"User joined challenge via invite",
            {
                "challenge_id": challenge["id"],
                "user_id": user_id,
                "invite_code": invite_code,
            },
        )

        # Notify partners that user joined a challenge
        from app.services.social_accountability_service import (
            social_accountability_service,
        )

        await social_accountability_service.notify_partners_of_data_change(
            user_id, "challenge_joined"
        )

        return {
            "message": "Successfully joined the challenge!",
            "challenge": {
                "id": challenge["id"],
                "title": challenge.get("title"),
            },
        }

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            f"Failed to join challenge via invite",
            {"error": str(e), "invite_code": invite_code, "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to join challenge: {str(e)}",
        )


# =====================================================
# Challenge Invite Management Endpoints
# =====================================================


class ChallengeInviteWithDetails(BaseModel):
    id: str
    challenge_id: str
    invited_by_user_id: str
    invited_user_id: Optional[str]
    status: str
    created_at: str
    expires_at: Optional[str]
    challenge: Optional[Dict[str, Any]] = None
    inviter: Optional[Dict[str, Any]] = None
    invitee: Optional[Dict[str, Any]] = None


@router.get("/invites/received", response_model=List[ChallengeInviteWithDetails])
async def get_received_challenge_invites(
    current_user: dict = Depends(get_current_user),
):
    """Get challenge invites received by the current user"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        result = (
            supabase.table("challenge_invites")
            .select(
                """
                id,
                challenge_id,
                invited_by_user_id,
                invited_user_id,
                status,
                created_at,
                expires_at,
                challenge:challenges!challenge_invites_challenge_id_fkey(id, title, description, start_date, end_date, is_public, challenge_type, status),
                inviter:users!challenge_invites_invited_by_user_id_fkey(id, name, username, profile_picture_url)
            """
            )
            .eq("invited_user_id", user_id)
            .eq("status", "pending")
            .order("created_at", desc=True)
            .execute()
        )

        invites = []
        for row in result.data or []:
            invites.append(
                {
                    "id": row["id"],
                    "challenge_id": row["challenge_id"],
                    "invited_by_user_id": row["invited_by_user_id"],
                    "invited_user_id": row["invited_user_id"],
                    "status": row["status"],
                    "created_at": row["created_at"],
                    "expires_at": row.get("expires_at"),
                    "challenge": row.get("challenge"),
                    "inviter": row.get("inviter"),
                }
            )

        return invites

    except Exception as e:
        logger.error(
            f"Failed to get received challenge invites for user {user_id}",
            {"error": str(e), "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get challenge invites",
        )


@router.get("/invites/sent", response_model=List[ChallengeInviteWithDetails])
async def get_sent_challenge_invites(
    current_user: dict = Depends(get_current_user),
):
    """Get challenge invites sent by the current user"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        result = (
            supabase.table("challenge_invites")
            .select(
                """
                id,
                challenge_id,
                invited_by_user_id,
                invited_user_id,
                status,
                created_at,
                expires_at,
                challenge:challenges!challenge_invites_challenge_id_fkey(id, title, description, start_date, end_date, is_public, challenge_type, status),
                invitee:users!challenge_invites_invited_user_id_fkey(id, name, username, profile_picture_url)
            """
            )
            .eq("invited_by_user_id", user_id)
            .eq("status", "pending")
            .order("created_at", desc=True)
            .execute()
        )

        invites = []
        for row in result.data or []:
            invites.append(
                {
                    "id": row["id"],
                    "challenge_id": row["challenge_id"],
                    "invited_by_user_id": row["invited_by_user_id"],
                    "invited_user_id": row["invited_user_id"],
                    "status": row["status"],
                    "created_at": row["created_at"],
                    "expires_at": row.get("expires_at"),
                    "challenge": row.get("challenge"),
                    "invitee": row.get("invitee"),
                }
            )

        return invites

    except Exception as e:
        logger.error(
            f"Failed to get sent challenge invites for user {user_id}",
            {"error": str(e), "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get sent challenge invites",
        )


@router.post("/invites/{invite_id}/accept")
async def accept_challenge_invite(
    invite_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Accept a challenge invite"""
    from app.core.database import get_supabase_client
    from datetime import datetime, timezone

    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Get the invite
        invite = (
            supabase.table("challenge_invites")
            .select("*, challenges(*)")
            .eq("id", invite_id)
            .eq("invited_user_id", user_id)
            .eq("status", "pending")
            .maybe_single()
            .execute()
        )

        if not invite.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invite not found or already processed",
            )

        challenge = invite.data.get("challenges")
        if not challenge:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Challenge not found",
            )

        # Join the challenge
        participant = await challenge_service.join_challenge(
            challenge_id=challenge["id"],
            user_id=user_id,
            goal_id=None,
        )

        # Mark invite as accepted
        supabase.table("challenge_invites").update(
            {
                "status": "accepted",
                "accepted_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", invite_id).execute()

        logger.info(
            f"Challenge invite accepted",
            {
                "invite_id": invite_id,
                "challenge_id": challenge["id"],
                "user_id": user_id,
            },
        )

        return {
            "message": "Successfully joined the challenge!",
            "challenge": {
                "id": challenge["id"],
                "title": challenge.get("title"),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to accept challenge invite",
            {"error": str(e), "invite_id": invite_id, "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to accept invite: {str(e)}",
        )


@router.post("/invites/{invite_id}/decline")
async def decline_challenge_invite(
    invite_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Decline a challenge invite"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Get the invite (need challenge_id for notification cleanup)
        invite = (
            supabase.table("challenge_invites")
            .select("id, challenge_id")
            .eq("id", invite_id)
            .eq("invited_user_id", user_id)
            .eq("status", "pending")
            .maybe_single()
            .execute()
        )

        if not invite.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invite not found or already processed",
            )

        # Update to declined
        supabase.table("challenge_invites").update({"status": "declined"}).eq(
            "id", invite_id
        ).execute()

        # Fire-and-forget: cleanup the notification for this invite
        from app.services.cleanup_service import (
            fire_and_forget_invite_notification_cleanup,
        )

        challenge_id = invite.data.get("challenge_id")
        if challenge_id:
            fire_and_forget_invite_notification_cleanup(
                challenge_id, user_id, reason="declined"
            )

        logger.info(
            f"Challenge invite declined",
            {"invite_id": invite_id, "user_id": user_id},
        )

        return {"message": "Invite declined"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to decline challenge invite",
            {"error": str(e), "invite_id": invite_id, "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to decline invite",
        )


@router.delete("/invites/{invite_id}")
async def cancel_challenge_invite(
    invite_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Cancel a challenge invite that the current user sent"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Get the invite (must be sender, need challenge_id and invited_user_id for cleanup)
        invite = (
            supabase.table("challenge_invites")
            .select("id, challenge_id, invited_user_id")
            .eq("id", invite_id)
            .eq("invited_by_user_id", user_id)
            .eq("status", "pending")
            .maybe_single()
            .execute()
        )

        if not invite.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invite not found or you are not the sender",
            )

        # Delete the invite
        supabase.table("challenge_invites").delete().eq("id", invite_id).execute()

        # Fire-and-forget: cleanup the notification for this invite
        from app.services.cleanup_service import (
            fire_and_forget_invite_notification_cleanup,
        )

        challenge_id = invite.data.get("challenge_id")
        invited_user_id = invite.data.get("invited_user_id")
        if challenge_id and invited_user_id:
            fire_and_forget_invite_notification_cleanup(
                challenge_id, invited_user_id, reason="cancelled"
            )

        logger.info(
            f"Challenge invite cancelled",
            {"invite_id": invite_id, "user_id": user_id},
        )

        return {"message": "Invite cancelled"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to cancel challenge invite",
            {"error": str(e), "invite_id": invite_id, "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel invite",
        )


# =====================================================
# CHALLENGE PLAN ENDPOINTS
# =====================================================


class ChallengePlanStatusResponse(BaseModel):
    """Response for challenge plan status."""

    challenge_id: str
    status: str  # not_started, pending, generating, completed, failed
    plan_type: Optional[str] = None
    error_message: Optional[str] = None
    generated_at: Optional[str] = None


class ChallengePlanResponse(BaseModel):
    """Response for challenge plan."""

    challenge_id: str
    plan: Optional[Dict[str, Any]] = None
    status: str


@router.get("/{challenge_id}/plan-status", response_model=ChallengePlanStatusResponse)
async def get_challenge_plan_status(
    challenge_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Get the plan generation status for a challenge.

    Returns:
    - not_started: No plan generation has been initiated
    - pending: Plan generation is queued
    - generating: Plan is being generated by AI
    - completed: Plan is ready
    - failed: Plan generation failed
    - restricted: Partner viewing (has plan but details hidden)
    """
    from app.core.database import get_supabase_client
    from app.services.task_queue import task_queue

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Check access
    has_access, _, is_partner_view, _ = check_challenge_access(
        challenge_id, user_id, supabase
    )

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found",
        )

    # Partner view: return restricted immediately without querying plan
    if is_partner_view:
        return ChallengePlanStatusResponse(
            challenge_id=challenge_id,
            status="restricted",
        )

    # Use task_queue (same as goals)
    plan_status = await task_queue.get_plan_status(challenge_id=challenge_id)

    if not plan_status:
        return ChallengePlanStatusResponse(
            challenge_id=challenge_id,
            status="not_started",
        )

    return ChallengePlanStatusResponse(
        challenge_id=challenge_id,
        status=plan_status.get("status", "not_started"),
        plan_type=plan_status.get("plan_type"),
        error_message=plan_status.get("error_message"),
        generated_at=plan_status.get("generated_at"),
    )


@router.get("/{challenge_id}/plan", response_model=ChallengePlanResponse)
async def get_challenge_plan(
    challenge_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Get the complete actionable plan for a challenge.

    Only returns the plan if status is "completed".
    Partners get a restricted response (no plan details).
    """
    from app.core.database import get_supabase_client
    from app.services.task_queue import task_queue

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Check access
    has_access, _, is_partner_view, _ = check_challenge_access(
        challenge_id, user_id, supabase
    )

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found",
        )

    # Partner view: return restricted immediately without querying plan
    # Same as goals endpoint - just indicate plan exists
    if is_partner_view:
        return {
            "challenge_id": challenge_id,
            "has_plan": True,
            "status": "restricted",
            "plan": None,
        }

    # Use task_queue (same as goals)
    plan = await task_queue.get_plan(challenge_id=challenge_id)

    if not plan:
        # Check if plan exists but not completed yet
        plan_status = await task_queue.get_plan_status(challenge_id=challenge_id)
        if plan_status:
            return ChallengePlanResponse(
                challenge_id=challenge_id,
                plan=None,
                status=plan_status.get("status", "not_started"),
            )
        return ChallengePlanResponse(
            challenge_id=challenge_id,
            plan=None,
            status="not_started",
        )

    return ChallengePlanResponse(
        challenge_id=challenge_id,
        plan=plan,
        status="completed",
    )


@router.post("/{challenge_id}/plan/retry")
async def retry_challenge_plan_generation(
    challenge_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Retry plan generation for a failed challenge plan.

    Only works if the current plan status is "failed".
    """
    from app.core.database import get_supabase_client
    from app.services.tasks import generate_challenge_plan_task

    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Verify challenge exists and user has access
        challenge = (
            supabase.table("challenges")
            .select("*")
            .eq("id", challenge_id)
            .maybe_single()
            .execute()
        )

        if not challenge.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Challenge not found",
            )

        # Get existing plan
        plan_result = (
            supabase.table("actionable_plans")
            .select("*")
            .eq("challenge_id", challenge_id)
            .maybe_single()
            .execute()
        )

        if not plan_result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No plan exists for this challenge",
            )

        plan = plan_result.data

        if plan.get("status") != "failed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only retry failed plans",
            )

        # Reset plan status to pending
        supabase.table("actionable_plans").update(
            {
                "status": "pending",
                "error_message": None,
            }
        ).eq("id", plan["id"]).execute()

        # Build challenge data for plan generator
        challenge_data = challenge.data
        challenge_as_goal = {
            "id": challenge_id,
            "user_id": challenge_data.get("created_by"),
            "title": challenge_data.get("title"),
            "description": challenge_data.get("description"),
            "category": challenge_data.get("category"),
            "goal_type": "time_challenge",
            "frequency": challenge_data.get("frequency", "daily"),
            "days_of_week": challenge_data.get("days_of_week"),
            "target_days": challenge_data.get("target_days")
            or challenge_data.get("duration_days"),
            "duration_days": challenge_data.get("duration_days"),
            "is_challenge": True,
        }

        # Queue plan generation
        generate_challenge_plan_task.delay(
            plan_id=plan["id"],
            challenge_id=challenge_id,
            challenge_data=challenge_as_goal,
            user_id=user_id,
        )

        logger.info(
            f"Queued plan retry for challenge {challenge_id}",
            {"challenge_id": challenge_id, "plan_id": plan["id"], "user_id": user_id},
        )

        return {
            "message": "Plan generation retried",
            "status": "pending",
            "challenge_id": challenge_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to retry plan for challenge {challenge_id}",
            {"error": str(e), "challenge_id": challenge_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retry plan generation",
        )
