"""
Onboarding API endpoints for user personalization and goal suggestions
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, validator
from uuid import uuid4
from app.core.flexible_auth import get_current_user
from app.core.database import get_supabase_client
from app.services.logger import logger
from app.services.openai_service import OpenAIService

router = APIRouter(
    redirect_slashes=False
)  # Disable redirects to preserve Authorization header


# Pydantic models
class FitnessProfileRequest(BaseModel):
    fitness_level: str = Field(..., description="User's fitness level")
    primary_goal: str = Field(..., description="User's primary fitness goal")
    current_frequency: str = Field(
        ..., description="How often user currently exercises"
    )
    preferred_location: str = Field(..., description="Where user prefers to work out")
    available_time: str = Field(..., description="How much time user has for workouts")
    motivation_style: str = Field(..., description="What type of motivation works best")
    biggest_challenge: str = Field(..., description="User's biggest fitness challenge")


class FitnessProfileResponse(BaseModel):
    id: str
    user_id: str
    fitness_level: str
    primary_goal: str
    current_frequency: str
    preferred_location: str
    available_time: str
    motivation_style: str
    biggest_challenge: str
    completed_at: str


class SuggestedGoal(BaseModel):
    id: str
    title: str  # Changed from 'name' to match goals table
    description: str
    category: str  # Will be validated against goal_category enum
    frequency: str  # Will be validated against goal_frequency enum
    target_days: Optional[int]
    reminder_times: List[str]
    match_reason: str  # For UI display only

    @validator("category")
    def validate_category(cls, v):
        valid_categories = [
            "fitness",
            "nutrition",
            "wellness",
            "mindfulness",
            "sleep",
            "custom",
        ]
        if v not in valid_categories:
            raise ValueError(f"Category must be one of: {valid_categories}")
        return v

    @validator("frequency")
    def validate_frequency(cls, v):
        valid_frequencies = ["daily", "weekly", "monthly", "custom"]
        if v not in valid_frequencies:
            raise ValueError(f"Frequency must be one of: {valid_frequencies}")
        return v


# AI goal suggestion logic (fallback to database templates)
def get_suggested_goals_from_db(
    profile: Dict[str, Any], supabase
) -> List[Dict[str, Any]]:
    """
    Generate AI-suggested goals based on user profile using database templates
    """
    suggestions = []

    # Get goal templates from database
    templates_result = supabase.table("goal_templates").select("*").execute()

    if not templates_result.data:
        logger.error("No goal templates found in database")
        return []

    base_templates = templates_result.data

    # AI matching logic based on profile
    fitness_level = profile.get("fitness_level", "")
    primary_goal = profile.get("primary_goal", "")
    current_frequency = profile.get("current_frequency", "")
    preferred_location = profile.get("preferred_location", "")
    available_time = profile.get("available_time", "")

    for template in base_templates:
        match_reason = ""
        score = 0

        # Use template's existing match_reason as base
        if template.get("match_reason"):
            match_reason += template["match_reason"] + " "
            score += 1

        # Match based on fitness level
        if (
            fitness_level == "beginner"
            and template["category"] == "fitness"
            and template["frequency"] == "weekly"
        ):
            match_reason += "Perfect for beginners. "
            score += 3
        elif fitness_level == "intermediate" and template["category"] == "fitness":
            match_reason += "Great for intermediate level. "
            score += 3
        elif fitness_level in ["advanced", "athlete"]:
            match_reason += "Challenging for advanced users. "
            score += 3

        # Match based on primary goal
        if (
            primary_goal == "lose_weight"
            and template["category"] == "fitness"
            and "weight" in template["title"].lower()
        ):
            match_reason += "Designed for weight loss. "
            score += 4
        elif primary_goal == "build_muscle" and "strength" in template["title"].lower():
            match_reason += "Focused on muscle building. "
            score += 4
        elif primary_goal == "stay_active" and template["frequency"] == "daily":
            match_reason += "Keeps you consistently active. "
            score += 3

        # Match based on current frequency
        if current_frequency == "never" and template["frequency"] == "weekly":
            match_reason += "Good starting point for beginners. "
            score += 2
        elif (
            current_frequency in ["1-2x_week", "3-4x_week"]
            and template["frequency"] == "daily"
        ):
            match_reason += "Helps increase your frequency. "
            score += 2

        # Match based on preferred location
        if preferred_location == "gym" and "gym" in template["title"].lower():
            match_reason += "Gym-based workout. "
            score += 2
        elif preferred_location == "home" and template["frequency"] == "daily":
            match_reason += "Can be done at home. "
            score += 2
        elif preferred_location == "outdoor" and "run" in template["title"].lower():
            match_reason += "Outdoor activity. "
            score += 2

        # Match based on available time
        if available_time == "less_30min" and template["frequency"] == "daily":
            match_reason += "Quick and effective. "
            score += 2
        elif (
            available_time in ["30-60min", "1-2hrs"]
            and template["frequency"] == "weekly"
        ):
            match_reason += "Perfect for your time availability. "
            score += 2

        # Only include if it has a reasonable match score
        if score >= 2:  # Lowered threshold since we're using database templates
            template["match_reason"] = match_reason.strip()
            template["score"] = score
            suggestions.append(template)

    # Sort by score (descending) and return top 5
    suggestions.sort(key=lambda x: x.get("score", 0), reverse=True)
    return suggestions[:5]


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

        if existing_profile.data:
            # Update existing profile
            result = (
                supabase.table("user_fitness_profiles")
                .update(
                    {
                        "fitness_level": profile_data.fitness_level,
                        "primary_goal": profile_data.primary_goal,
                        "current_frequency": profile_data.current_frequency,
                        "preferred_location": profile_data.preferred_location,
                        "available_time": profile_data.available_time,
                        "motivation_style": profile_data.motivation_style,
                        "biggest_challenge": profile_data.biggest_challenge,
                    }
                )
                .eq("user_id", user_id)
                .execute()
            )
        else:
            # Create new profile
            result = (
                supabase.table("user_fitness_profiles")
                .insert(
                    {
                        "user_id": user_id,
                        "fitness_level": profile_data.fitness_level,
                        "primary_goal": profile_data.primary_goal,
                        "current_frequency": profile_data.current_frequency,
                        "preferred_location": profile_data.preferred_location,
                        "available_time": profile_data.available_time,
                        "motivation_style": profile_data.motivation_style,
                        "biggest_challenge": profile_data.biggest_challenge,
                    }
                )
                .execute()
            )

        if result.data:
            logger.info(
                f"Fitness profile saved for user {user_id}",
                {
                    "user_id": user_id,
                    "fitness_level": profile_data.fitness_level,
                    "primary_goal": profile_data.primary_goal,
                },
            )
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
            f"Error saving fitness profile for user {current_user.get('id')}",
            {"error": str(e), "user_id": current_user.get("id")},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save fitness profile",
        )


@router.get("/profile", response_model=FitnessProfileResponse)
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
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fitness profile not found",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error getting fitness profile for user {current_user.get('id')}",
            {"error": str(e), "user_id": current_user.get("id")},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get fitness profile",
        )


@router.get("/suggested-goals", response_model=List[SuggestedGoal])
async def get_suggested_goals(
    current_user: Dict[str, Any] = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """Get AI-suggested goals with fallback to database templates"""
    try:
        user_id = current_user["id"]

        # Get user's fitness profile
        profile_result = (
            supabase.table("user_fitness_profiles")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )

        if not profile_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fitness profile not found. Complete onboarding first.",
            )

        profile = profile_result.data[0]

        # Get user's subscription plan for feature-aware AI suggestions
        user_plan = current_user.get("plan", "free")

        # Try OpenAI first
        openai_service = OpenAIService()
        ai_goals = await openai_service.generate_goal_suggestions(
            profile, user_plan=user_plan
        )

        if ai_goals and len(ai_goals) > 0:
            logger.info(
                f"Generated {len(ai_goals)} AI goals for user {user_id}",
                {
                    "user_id": user_id,
                    "fitness_level": profile.get("fitness_level"),
                    "primary_goal": profile.get("primary_goal"),
                    "source": "ai",
                },
            )

            # Transform AI goals to SuggestedGoal format
            suggested_goals = []
            for goal in ai_goals:
                try:
                    suggested_goal = SuggestedGoal(
                        id=str(uuid4()),  # Generate temporary ID for AI goals
                        title=goal.get("title", ""),
                        description=goal.get("description", ""),
                        category=goal.get("category", "fitness"),
                        frequency=goal.get("frequency", "weekly"),
                        target_days=goal.get("target_days"),
                        reminder_times=goal.get("reminder_times") or [],
                        match_reason=goal.get("match_reason", "Based on your profile"),
                    )
                    suggested_goals.append(suggested_goal)
                except Exception as e:
                    logger.warning(
                        f"Failed to transform AI goal to SuggestedGoal format: {e}",
                        {"goal": goal, "error": str(e)},
                    )
                    continue

            if suggested_goals:
                return suggested_goals
            else:
                logger.warning("No valid AI goals could be transformed")
                # Fall through to database fallback

        # Fallback to database template matching
        logger.warning(f"OpenAI failed, using database fallback for user {user_id}")
        suggested_goals_raw = get_suggested_goals_from_db(profile, supabase)

        # Transform database templates to SuggestedGoal format
        suggested_goals = []
        for goal in suggested_goals_raw:
            try:
                # Map database fields to SuggestedGoal model
                suggested_goal = SuggestedGoal(
                    id=goal.get("id", ""),
                    title=goal.get("title")
                    or goal.get("name", ""),  # Support both 'title' and 'name'
                    description=goal.get("description", ""),
                    category=goal.get("category", "fitness"),
                    frequency=goal.get("frequency", "weekly"),
                    target_days=goal.get("target_days"),
                    reminder_times=goal.get("reminder_times")
                    or [],  # Ensure it's a list
                    match_reason=goal.get("match_reason", "Based on your profile"),
                )
                suggested_goals.append(suggested_goal)
            except Exception as e:
                logger.warning(
                    f"Failed to transform goal template {goal.get('id')} to SuggestedGoal format: {e}",
                    {"goal_id": goal.get("id"), "error": str(e)},
                )
                # Skip invalid goals instead of failing completely
                continue

        logger.info(
            f"Generated {len(suggested_goals)} database goals for user {user_id}",
            {
                "user_id": user_id,
                "fitness_level": profile.get("fitness_level"),
                "primary_goal": profile.get("primary_goal"),
                "source": "database",
            },
        )

        if not suggested_goals:
            logger.warning(
                f"No valid goals could be generated from database templates for user {user_id}"
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to generate goal suggestions. Please try again later.",
            )

        return suggested_goals

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error in goal suggestions for user {current_user.get('id')}",
            {"error": str(e), "user_id": current_user.get("id")},
        )
        # Last resort: return database templates
        try:
            suggested_goals_raw = get_suggested_goals_from_db(profile, supabase)

            # Transform database templates to SuggestedGoal format
            suggested_goals = []
            for goal in suggested_goals_raw:
                try:
                    suggested_goal = SuggestedGoal(
                        id=goal.get("id", ""),
                        title=goal.get("title") or goal.get("name", ""),
                        description=goal.get("description", ""),
                        category=goal.get("category", "fitness"),
                        frequency=goal.get("frequency", "weekly"),
                        target_days=goal.get("target_days"),
                        reminder_times=goal.get("reminder_times") or [],
                        match_reason=goal.get("match_reason", "Based on your profile"),
                    )
                    suggested_goals.append(suggested_goal)
                except Exception as transform_error:
                    logger.warning(
                        f"Failed to transform goal template {goal.get('id')}: {transform_error}",
                        {"goal_id": goal.get("id"), "error": str(transform_error)},
                    )
                    continue

            if suggested_goals:
                return suggested_goals
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to generate goal suggestions",
                )
        except HTTPException:
            raise
        except Exception as fallback_error:
            logger.error(
                f"Failed to get suggested goals from database fallback: {fallback_error}",
                {"error": str(fallback_error), "user_id": current_user.get("id")},
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get suggested goals",
            )
