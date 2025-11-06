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
        .single()
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
    """Join a challenge"""
    try:
        participant = await challenge_service.join_challenge(
            challenge_id=challenge_id,
            user_id=current_user["id"],
            goal_id=goal_id,
        )

        return participant

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            f"Failed to join challenge {challenge_id} for user {current_user['id']}",
            {
                "error": str(e),
                "challenge_id": challenge_id,
                "user_id": current_user["id"],
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
