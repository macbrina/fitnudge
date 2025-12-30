"""
Onboarding API endpoints for user personalization and goal suggestions
"""

from typing import Dict, Any, List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from app.core.flexible_auth import get_current_user
from app.core.database import get_supabase_client
from app.services.logger import logger
from app.models.suggested_goals import SuggestedGoalItem, SuggestedGoalsRecord
from app.services.tasks import generate_suggested_goals_task

router = APIRouter(
    redirect_slashes=False
)  # Disable redirects to preserve Authorization header


# Pydantic models
class FitnessProfileRequest(BaseModel):
    biological_sex: Optional[str] = Field(
        default=None,
        description="Biological sex for calorie/nutrition calculations: male, female, or prefer_not_to_say",
    )
    fitness_level: str = Field(..., description="User's fitness level")
    primary_goal: str = Field(..., description="User's primary fitness goal")
    current_frequency: str = Field(
        ..., description="How often user currently exercises"
    )
    preferred_location: str = Field(..., description="Where user prefers to work out")
    available_time: str = Field(..., description="How much time user has for workouts")
    motivation_style: str = Field(..., description="What type of motivation works best")
    biggest_challenge: str = Field(..., description="User's biggest fitness challenge")
    available_equipment: Optional[List[str]] = Field(
        default=[],
        description="List of equipment user has access to: none, resistance_band, dumbbell, kettlebell, pull_up_bar, yoga_mat, barbell, bench",
    )


class FitnessProfileResponse(BaseModel):
    id: str
    user_id: str
    biological_sex: Optional[str] = None
    fitness_level: str
    primary_goal: str
    current_frequency: str
    preferred_location: str
    available_time: str
    motivation_style: str
    biggest_challenge: str
    available_equipment: Optional[List[str]] = []
    completed_at: str


class SuggestedGoalsStatusResponse(BaseModel):
    status: Literal["not_started", "pending", "ready", "failed"]
    goals: Optional[List[SuggestedGoalItem]] = None
    error: Optional[str] = None
    updated_at: Optional[str] = None
    regeneration_count: Optional[int] = 0
    goal_type: Optional[str] = "habit"  # The type of goals requested


@router.post("/profile", response_model=FitnessProfileResponse)
async def save_fitness_profile(
    profile_data: FitnessProfileRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """Save user's fitness profile from onboarding"""
    try:
        user_id = current_user["id"]

        # Check if profile already exists
        existing_profile = (
            supabase.table("user_fitness_profiles")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )

        # Build profile data dict, only include biological_sex if provided
        profile_dict = {
            "fitness_level": profile_data.fitness_level,
            "primary_goal": profile_data.primary_goal,
            "current_frequency": profile_data.current_frequency,
            "preferred_location": profile_data.preferred_location,
            "available_time": profile_data.available_time,
            "motivation_style": profile_data.motivation_style,
            "biggest_challenge": profile_data.biggest_challenge,
            "available_equipment": profile_data.available_equipment or [],
        }
        # Only include biological_sex if provided (it's optional)
        if profile_data.biological_sex:
            profile_dict["biological_sex"] = profile_data.biological_sex

        if existing_profile.data:
            # Update existing profile
            result = (
                supabase.table("user_fitness_profiles")
                .update(profile_dict)
                .eq("user_id", user_id)
                .execute()
            )
        else:
            # Create new profile
            profile_dict["user_id"] = user_id
            result = (
                supabase.table("user_fitness_profiles").insert(profile_dict).execute()
            )

        if result.data:
            return FitnessProfileResponse(**result.data[0])
        else:
            logger.error(
                f"Failed to save fitness profile for user {user_id}",
                {"user_id": user_id, "error": result},
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save fitness profile",
            )

    except Exception as e:
        logger.error(
            f"Error saving fitness profile for user {current_user.get('id')} {e}",
            {"error": str(e), "user_id": current_user.get("id")},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save fitness profile",
        )


@router.get("/profile", response_model=Optional[FitnessProfileResponse])
async def get_fitness_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """Get user's fitness profile"""
    try:
        user_id = current_user["id"]

        result = (
            supabase.table("user_fitness_profiles")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )

        if result.data:
            return FitnessProfileResponse(**result.data[0])
        return None

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Onboarding] Error getting fitness profile: {type(e).__name__}: {e}")
        logger.error(
            f"Error getting fitness profile for user {current_user.get('id')}",
            {"error": str(e), "user_id": current_user.get("id")},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get fitness profile",
        )


def _record_to_response(record: Dict[str, Any]) -> SuggestedGoalsStatusResponse:
    try:
        parsed = SuggestedGoalsRecord(**record)
        return SuggestedGoalsStatusResponse(
            status=parsed.status,
            goals=parsed.goals,
            error=parsed.error_message,
            updated_at=parsed.updated_at.isoformat(),
            regeneration_count=record.get("regeneration_count", 0),
            goal_type=record.get("goal_type", "habit"),
        )
    except Exception as exc:
        logger.error(
            "Failed to parse suggested goals record",
            {"error": str(exc), "record": record},
        )
        return SuggestedGoalsStatusResponse(
            status="failed",
            goals=None,
            error="Unable to parse suggested goals record.",
            updated_at=record.get("updated_at"),
            regeneration_count=record.get("regeneration_count", 0),
            goal_type=record.get("goal_type", "habit"),
        )


class SuggestedGoalsRequest(BaseModel):
    goal_type: str = Field(
        default="habit",
        description="Type of goals to generate: habit, time_challenge, target_challenge, or mixed",
    )
    timezone: Optional[str] = Field(
        default=None,
        description="User's timezone (e.g., 'America/New_York') for time-aware goal suggestions",
    )


@router.post(
    "/suggested-goals",
    response_model=SuggestedGoalsStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def request_suggested_goals_generation(
    request: SuggestedGoalsRequest = SuggestedGoalsRequest(),
    current_user: Dict[str, Any] = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """
    Kick off initial generation of suggested goals for the current user.
    Checks if user already has goals and respects regeneration limits.

    Free users: 2 total generations allowed (feature_value = 2)
    Starter+: Unlimited (feature_value = NULL)

    Args:
        goal_type: Type of goals - "habit" (default), "time_challenge",
                   "target_challenge", or "mixed"
    """
    from app.core.subscriptions import get_user_features_by_tier

    user_id = current_user["id"]
    user_plan = current_user.get("plan", "free")
    goal_type = request.goal_type

    # Check premium access for non-habit goal types
    # "habit" is free, everything else requires premium (challenge_create feature)
    if goal_type != "habit":
        features_data = get_user_features_by_tier(user_id, user_plan, supabase)
        has_challenge_access = any(
            f.get("feature_key") == "challenge_create" and f.get("is_enabled")
            for f in features_data.get("features", [])
        )
        if not has_challenge_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Challenge goals require a premium subscription. Upgrade to access {goal_type} goals.",
            )

    try:
        # Check if user already has suggested goals
        existing_record = (
            supabase.table("suggested_goals")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )

        current_count = 0
        if existing_record.data:
            current_count = existing_record.data[0].get("regeneration_count", 0)

            # Get user's feature limit for AI goal generations
            features_data = get_user_features_by_tier(user_id, user_plan, supabase)
            generation_limit = None  # Default to unlimited

            for feature in features_data.get("features", []):
                if feature.get("feature_key") == "ai_goal_generations":
                    generation_limit = feature.get("feature_value")
                    break

            # If free user has reached limit, return existing goals
            if generation_limit is not None and current_count >= generation_limit:
                # Return existing goals if status is ready
                if existing_record.data[0].get("status") == "ready":
                    return _record_to_response(existing_record.data[0])
                else:
                    # If not ready but limit reached, return error
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"You've used all {generation_limit} AI goal generations. Upgrade to Starter+ for unlimited generations.",
                    )

        # Create/update pending record with goal_type
        supabase.table("suggested_goals").upsert(
            {
                "user_id": user_id,
                "status": "pending",
                "goals": None,
                "error_message": None,
                "regeneration_count": current_count,  # Keep current, will increment on success
                "goal_type": goal_type,  # Store the requested goal type for retries
                "updated_at": "now()",
            },
            on_conflict="user_id",
        ).execute()

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            f"Failed to create pending suggested goals record: {exc}",
            {"user_id": user_id, "error": str(exc)},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to queue suggested goals generation.",
        )

    # Enqueue Celery task to generate suggestions asynchronously
    generate_suggested_goals_task.delay(
        user_id=user_id, goal_type=goal_type, user_timezone=request.timezone
    )

    return SuggestedGoalsStatusResponse(
        status="pending", regeneration_count=current_count, goal_type=goal_type
    )


@router.get(
    "/suggested-goals",
    response_model=SuggestedGoalsStatusResponse,
    status_code=status.HTTP_200_OK,
)
async def get_suggested_goals_status(
    current_user: Dict[str, Any] = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """Retrieve the current status (and results, if ready) of suggested goals generation."""
    user_id = current_user["id"]

    # Retry once on transient failures
    result = None
    last_error = None
    for attempt in range(2):
        try:
            result = (
                supabase.table("suggested_goals")
                .select("*")
                .eq("user_id", user_id)
                .execute()
            )
            break  # Success, exit retry loop
        except Exception as exc:
            last_error = exc
            if attempt == 0:
                logger.warning(
                    "Retrying suggested goals status fetch",
                    {"user_id": user_id, "error": str(exc)},
                )
                continue
            logger.error(
                "Failed to read suggested goals status after retry",
                {"user_id": user_id, "error": str(exc)},
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to fetch suggested goals status.",
            )

    if not result or not result.data:
        return SuggestedGoalsStatusResponse(status="not_started")

    return _record_to_response(result.data[0])


@router.put(
    "/suggested-goals/regenerate",
    response_model=SuggestedGoalsStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def regenerate_suggested_goals(
    request: SuggestedGoalsRequest = SuggestedGoalsRequest(),
    current_user: Dict[str, Any] = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """
    Regenerate suggested goals for the current user.

    Free users: 2 total generations allowed (feature_value = 2)
    Starter+: Unlimited (feature_value = NULL)

    Args:
        goal_type: Type of goals - "habit" (default), "time_challenge",
                   "target_challenge", or "mixed"
    """
    from app.core.subscriptions import get_user_features_by_tier

    user_id = current_user["id"]
    user_plan = current_user.get("plan", "free")
    goal_type = request.goal_type

    # Get user features once for all checks
    features_data = get_user_features_by_tier(user_id, user_plan, supabase)

    # Check premium access for non-habit goal types
    # "habit" is free, everything else requires premium (challenge_create feature)
    if goal_type != "habit":
        has_challenge_access = any(
            f.get("feature_key") == "challenge_create" and f.get("is_enabled")
            for f in features_data.get("features", [])
        )
        if not has_challenge_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Challenge goals require a premium subscription. Upgrade to access {goal_type} goals.",
            )

    try:
        # Get existing record to check regeneration count
        existing_record = (
            supabase.table("suggested_goals")
            .select("regeneration_count")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )

        current_count = 0
        if existing_record and existing_record.data:
            current_count = existing_record.data.get("regeneration_count", 0)

        # Get user's feature limit for AI goal generations
        generation_limit = None  # Default to unlimited

        for feature in features_data.get("features", []):
            if feature.get("feature_key") == "ai_goal_generations":
                generation_limit = feature.get("feature_value")
                break

        # Check if user has reached their limit
        # generation_limit = 2 for free users, NULL for paid users
        if generation_limit is not None and current_count >= generation_limit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You've used all {generation_limit} AI goal generations. Upgrade to Starter+ for unlimited generations.",
            )

        # Clear goals and set to pending with goal_type
        # Count will be incremented by Celery on successful completion
        supabase.table("suggested_goals").upsert(
            {
                "user_id": user_id,
                "status": "pending",
                "goals": None,
                "error_message": None,
                "regeneration_count": current_count,  # Keep current, will increment on success
                "goal_type": goal_type,  # Store the requested goal type for retries
                "updated_at": "now()",
            },
            on_conflict="user_id",
        ).execute()

        # Enqueue Celery task to generate new suggestions
        generate_suggested_goals_task.delay(
            user_id=user_id, goal_type=goal_type, user_timezone=request.timezone
        )

        return SuggestedGoalsStatusResponse(
            status="pending",
            regeneration_count=current_count,
            goal_type=goal_type,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            "Failed to regenerate suggested goals",
            {"user_id": user_id, "error": str(exc), "goal_type": goal_type},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to regenerate suggested goals.",
        )
