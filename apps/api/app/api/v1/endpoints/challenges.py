"""
Challenges API endpoints
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import date
from app.core.flexible_auth import get_current_user
from app.services.logger import logger
from app.services.challenge_service import challenge_service

router = APIRouter(redirect_slashes=False)


class ChallengeCreate(BaseModel):
    title: str
    description: Optional[str] = None
    challenge_type: str  # streak, checkin_count, community, custom
    duration_days: int
    start_date: date
    is_public: bool = True
    max_participants: Optional[int] = None
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
    is_active: bool
    max_participants: Optional[int]
    created_by: Optional[str]
    metadata: Dict[str, Any]
    created_at: str
    updated_at: str


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
    try:
        challenge = await challenge_service.create_challenge(
            user_id=current_user["id"],
            title=challenge_data.title,
            description=challenge_data.description,
            challenge_type=challenge_data.challenge_type,
            duration_days=challenge_data.duration_days,
            start_date=challenge_data.start_date,
            is_public=challenge_data.is_public,
            max_participants=challenge_data.max_participants,
            metadata=challenge_data.metadata or {},
        )

        return challenge

    except Exception as e:
        logger.error(
            f"Failed to create challenge for user {current_user['id']}",
            {"error": str(e), "user_id": current_user["id"]},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create challenge: {str(e)}",
        )


@router.get("/", response_model=List[ChallengeResponse])
async def get_challenges(
    current_user: dict = Depends(get_current_user),
    is_public: Optional[bool] = Query(None),
    is_active: Optional[bool] = Query(True),
    my_challenges: bool = Query(False),
):
    """Get available challenges"""
    try:
        user_id = current_user["id"] if my_challenges else None

        challenges = await challenge_service.get_challenges(
            user_id=user_id,
            is_public=is_public,
            is_active=is_active,
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


@router.get("/{challenge_id}", response_model=ChallengeResponse)
async def get_challenge(
    challenge_id: str, current_user: dict = Depends(get_current_user)
):
    """Get challenge by ID"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    result = (
        supabase.table("challenges")
        .select("*")
        .eq("id", challenge_id)
        .maybe_single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found"
        )

    return result.data[0]


@router.post("/{challenge_id}/join", response_model=ChallengeParticipantResponse)
async def join_challenge(
    challenge_id: str,
    current_user: dict = Depends(get_current_user),
    goal_id: Optional[str] = Query(None),
):
    """
    Join a challenge.

    Checks the user's challenge_join_limit to ensure they haven't exceeded
    the number of challenges they can participate in simultaneously.
    """
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]
    user_plan = current_user.get("plan", "free")

    # Check challenge_join_limit from plan_features
    limit_result = (
        supabase.table("plan_features")
        .select("feature_value")
        .eq("plan_id", user_plan)
        .eq("feature_key", "challenge_join_limit")
        .eq("is_enabled", True)
        .maybe_single()
        .execute()
    )

    challenge_join_limit = 1  # Default for free
    if limit_result.data and limit_result.data.get("feature_value"):
        challenge_join_limit = limit_result.data["feature_value"]

    # Count current active challenge participations (excluding challenges created by user)
    active_participations = (
        supabase.table("challenge_participants")
        .select("id, challenge:challenges!inner(id, is_active, created_by)")
        .eq("user_id", user_id)
        .neq("challenge_id", challenge_id)  # Exclude the one we're trying to join
        .execute()
    )

    # Filter to only count active challenges not created by this user
    current_joined_count = 0
    if active_participations.data:
        for p in active_participations.data:
            challenge_info = p.get("challenge", {})
            # Only count if challenge is active and user is NOT the creator
            if (
                challenge_info.get("is_active")
                and challenge_info.get("created_by") != user_id
            ):
                current_joined_count += 1

    if current_joined_count >= challenge_join_limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You can only join {challenge_join_limit} challenge(s) at a time. "
            f"Complete or leave a challenge first to join a new one.",
        )

    try:
        participant = await challenge_service.join_challenge(
            challenge_id=challenge_id,
            user_id=user_id,
            goal_id=goal_id,
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
    if not challenge.get("is_active", False):
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

    # Verify user is a participant
    participant_result = (
        supabase.table("challenge_participants")
        .select("*")
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

    participant = participant_result.data

    # Validate mood if provided
    valid_moods = ["great", "good", "okay", "bad", "terrible"]
    if data.mood and data.mood not in valid_moods:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid mood. Must be one of: {', '.join(valid_moods)}",
        )

    # Create the check-in
    check_in_data = {
        "challenge_id": challenge_id,
        "user_id": user_id,
        "check_in_date": check_in_date.isoformat(),
        "notes": data.notes,
        "mood": data.mood,
        "photo_url": data.photo_url,
    }

    try:
        check_in_result = (
            supabase.table("challenge_check_ins").insert(check_in_data).execute()
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
            detail="Failed to create check-in",
        )

    check_in = check_in_result.data[0]

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

    # Update participant points
    current_points = participant.get("points", 0)
    new_total_points = current_points + points_earned

    # Get check-in count for progress data
    check_ins_count_result = (
        supabase.table("challenge_check_ins")
        .select("id", count="exact")
        .eq("challenge_id", challenge_id)
        .eq("user_id", user_id)
        .execute()
    )
    check_in_count = (
        check_ins_count_result.count
        if hasattr(check_ins_count_result, "count")
        else len(check_ins_count_result.data or [])
    )

    # Update participant
    progress_data = participant.get("progress_data", {})
    progress_data["checkin_count"] = check_in_count
    progress_data["last_check_in"] = check_in_date.isoformat()

    supabase.table("challenge_participants").update(
        {
            "points": new_total_points,
            "progress_data": progress_data,
        }
    ).eq("id", participant["id"]).execute()

    # Update leaderboard
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
    """Get check-ins for a challenge"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Build query
    query = (
        supabase.table("challenge_check_ins")
        .select("*, users(id, name, username, profile_picture_url)")
        .eq("challenge_id", challenge_id)
        .order("check_in_date", desc=True)
        .limit(limit)
    )

    if user_id:
        query = query.eq("user_id", user_id)

    result = query.execute()

    return result.data or []


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
    The challenge is deactivated (is_active = false) but all data is preserved.
    Participants will be notified that the challenge was cancelled.
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

    # Only creator can cancel
    if challenge.get("created_by") != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the challenge creator can cancel it",
        )

    # Check if already inactive
    if not challenge.get("is_active"):
        return {
            "message": "Challenge is already inactive",
            "challenge_id": challenge_id,
        }

    # Update challenge to inactive
    reason = data.reason if data else None
    update_data = {
        "is_active": False,
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

    # Delete the challenge (cascade will handle participants and check-ins)
    supabase.table("challenges").delete().eq("id", challenge_id).execute()

    # If this challenge came from a goal, update the goal
    if challenge.get("metadata", {}).get("source") == "shared_goal":
        source_goal_id = challenge.get("goal_template", {}).get("original_goal_id")
        if source_goal_id:
            # Clear the converted_to_challenge_id reference
            supabase.table("goals").update({"converted_to_challenge_id": None}).eq(
                "id", source_goal_id
            ).execute()

    logger.info(
        f"Challenge {challenge_id} deleted by creator {user_id}",
        {"challenge_id": challenge_id, "user_id": user_id},
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

    # Remove participant from challenge
    supabase.table("challenge_participants").delete().eq(
        "challenge_id", challenge_id
    ).eq("user_id", user_id).execute()

    logger.info(
        f"User {user_id} left challenge {challenge_id}",
        {"challenge_id": challenge_id, "user_id": user_id},
    )

    return {"message": "You have left the challenge"}
