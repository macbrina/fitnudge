"""
Meal Tracking API endpoints
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, time
from app.core.flexible_auth import get_current_user
from app.core.database import get_supabase_client
from app.core.entity_validation import validate_entity_is_active_by_id
from app.services.logger import logger
from app.services.meal_tracking_service import meal_tracking_service
from app.services.checkin_service import auto_complete_checkin

router = APIRouter(redirect_slashes=False)


# Pydantic models
class MealLogCreate(BaseModel):
    meal_type: str  # breakfast, lunch, dinner, snack, other
    logged_date: date
    meal_name: Optional[str] = None
    meal_description: Optional[str] = None
    logged_time: Optional[time] = None
    goal_id: Optional[str] = None
    challenge_id: Optional[str] = None  # For challenge-based meal tracking
    estimated_protein: Optional[int] = None  # If not provided, AI will estimate
    estimated_calories: Optional[int] = None  # If not provided, AI will estimate
    health_rating: Optional[str] = (
        None  # healthy, okay, unhealthy - AI estimates if not provided
    )
    notes: Optional[str] = None
    photo_url: Optional[str] = None  # Single photo URL or base64 data URL
    use_ai_estimation: bool = True  # Whether to use AI to estimate nutrition


class MealLogUpdate(BaseModel):
    meal_type: Optional[str] = None
    meal_name: Optional[str] = None
    meal_description: Optional[str] = None
    logged_time: Optional[time] = None
    estimated_protein: Optional[int] = None
    estimated_calories: Optional[int] = None
    health_rating: Optional[str] = None  # healthy, okay, unhealthy
    notes: Optional[str] = None
    photo_url: Optional[str] = None


class MealLogResponse(BaseModel):
    id: str
    user_id: str
    goal_id: Optional[str]
    challenge_id: Optional[str] = None
    meal_type: str
    meal_name: Optional[str]
    meal_description: Optional[str]
    logged_date: date
    logged_time: Optional[time]
    estimated_protein: Optional[int]
    estimated_calories: Optional[int]
    health_rating: Optional[str] = None  # healthy, okay, unhealthy
    notes: Optional[str]
    photo_url: Optional[str] = None
    created_at: str
    updated_at: str


class NutritionEstimationRequest(BaseModel):
    """Request to estimate nutrition for a meal description or photo"""

    meal_description: str
    meal_name: Optional[str] = None
    photo_url: Optional[str] = None  # Photo URL or base64 data URL for vision analysis


class MealHistoryResponse(BaseModel):
    """Paginated meal history response"""

    data: List[MealLogResponse]
    total: int
    page: int
    limit: int
    has_more: bool


class NutritionEstimationResponse(BaseModel):
    """AI-estimated nutrition values for a meal"""

    estimated_calories: int
    estimated_protein: int
    health_rating: str  # healthy, okay, unhealthy
    confidence: str  # high, medium, low


@router.post("/estimate-nutrition", response_model=NutritionEstimationResponse)
async def estimate_meal_nutrition(
    request: NutritionEstimationRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Use AI to estimate nutrition values for a meal.

    If a photo_url is provided, uses GPT-4 Vision to analyze the image.
    Otherwise, estimates based on the text description.

    Returns estimated calories, protein, and health rating.
    """
    try:
        result = await meal_tracking_service.estimate_meal_nutrition(
            meal_description=request.meal_description,
            meal_name=request.meal_name,
            photo_url=request.photo_url,
        )
        return result

    except Exception as e:
        logger.error(
            f"Failed to estimate nutrition for user {current_user['id']}",
            {"error": str(e), "user_id": current_user["id"]},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to estimate nutrition",
        )


@router.get("/history", response_model=MealHistoryResponse)
async def get_meal_history(
    current_user: dict = Depends(get_current_user),
    goal_id: Optional[str] = Query(None, description="Filter by goal ID"),
    challenge_id: Optional[str] = Query(None, description="Filter by challenge ID"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(20, ge=1, le=50, description="Items per page"),
):
    """
    Get paginated meal history for infinite scroll.

    Returns meals ordered by date (newest first) with total count for pagination.
    """
    supabase = get_supabase_client()
    user_id = current_user["id"]
    offset = (page - 1) * limit

    try:
        # Build base query
        query = (
            supabase.table("meal_logs")
            .select("*", count="exact")
            .eq("user_id", user_id)
        )

        if goal_id:
            query = query.eq("goal_id", goal_id)
        if challenge_id:
            query = query.eq("challenge_id", challenge_id)

        # Order by date and time (newest first)
        query = query.order("logged_date", desc=True).order("logged_time", desc=True)

        # Apply pagination
        query = query.range(offset, offset + limit - 1)

        result = query.execute()
        meals = result.data or []
        total = result.count or 0

        has_more = offset + len(meals) < total

        return MealHistoryResponse(
            data=meals,
            total=total,
            page=page,
            limit=limit,
            has_more=has_more,
        )

    except Exception as e:
        logger.error(
            f"Failed to get meal history for user {user_id}",
            {"error": str(e), "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get meal history",
        )


@router.post("/", response_model=MealLogResponse, status_code=status.HTTP_201_CREATED)
async def log_meal(
    meal_data: MealLogCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Log a meal.

    If use_ai_estimation is True and meal_description is provided,
    AI will estimate calories, protein, and health_rating.
    """
    supabase = get_supabase_client()

    # Validate that the goal/challenge is active before logging
    if meal_data.goal_id:
        validate_entity_is_active_by_id(
            supabase, meal_data.goal_id, "goal", allow_upcoming=False
        )
    if meal_data.challenge_id:
        validate_entity_is_active_by_id(
            supabase, meal_data.challenge_id, "challenge", allow_upcoming=False
        )

    try:
        estimated_protein = meal_data.estimated_protein
        estimated_calories = meal_data.estimated_calories
        health_rating = meal_data.health_rating
        meal_name = meal_data.meal_name

        # Use AI estimation if requested and we have a description or photo
        if meal_data.use_ai_estimation and (
            meal_data.meal_description or meal_data.photo_url
        ):
            # Check if we need any AI values (including meal name)
            needs_estimation = (
                not meal_name
                or not estimated_protein
                or not estimated_calories
                or not health_rating
            )
            if needs_estimation:
                try:
                    ai_estimation = await meal_tracking_service.estimate_meal_nutrition(
                        meal_description=meal_data.meal_description or "",
                        meal_name=meal_name,
                        photo_url=meal_data.photo_url,
                    )
                    # Only use AI values if not provided by user
                    if not meal_name and ai_estimation.get("suggested_name"):
                        meal_name = ai_estimation.get("suggested_name")
                        logger.info(f"🍽️ Using AI suggested meal name: {meal_name}")
                    if not estimated_protein:
                        estimated_protein = ai_estimation.get("estimated_protein")
                    if not estimated_calories:
                        estimated_calories = ai_estimation.get("estimated_calories")
                    if not health_rating:
                        health_rating = ai_estimation.get("health_rating")
                except Exception as ai_error:
                    logger.warning(
                        f"AI nutrition estimation failed, proceeding without: {ai_error}"
                    )

        result = await meal_tracking_service.log_meal(
            user_id=current_user["id"],
            meal_type=meal_data.meal_type,
            logged_date=meal_data.logged_date,
            meal_name=meal_name,  # Use potentially AI-generated name
            meal_description=meal_data.meal_description,
            logged_time=meal_data.logged_time,
            goal_id=meal_data.goal_id,
            challenge_id=meal_data.challenge_id,
            estimated_protein=estimated_protein,
            estimated_calories=estimated_calories,
            health_rating=health_rating,
            notes=meal_data.notes,
            photo_url=meal_data.photo_url,
        )

        # Auto-complete check-in for meal tracking goals/challenges
        if meal_data.goal_id or meal_data.challenge_id:
            try:
                await auto_complete_checkin(
                    user_id=current_user["id"],
                    goal_id=meal_data.goal_id,
                    challenge_id=meal_data.challenge_id,
                    checkin_date=meal_data.logged_date,
                )
            except Exception as checkin_error:
                logger.warning(
                    f"Failed to auto-complete check-in after meal log: {checkin_error}"
                )

        return result

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            f"Failed to log meal for user {current_user['id']}",
            {"error": str(e), "user_id": current_user["id"]},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to log meal",
        )


@router.get("/", response_model=List[MealLogResponse])
async def get_meal_logs(
    current_user: dict = Depends(get_current_user),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    goal_id: Optional[str] = Query(None),
    meal_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Get meal logs for the current user"""
    try:
        result = await meal_tracking_service.get_meal_logs(
            user_id=current_user["id"],
            start_date=start_date,
            end_date=end_date,
            goal_id=goal_id,
            meal_type=meal_type,
            limit=limit,
            offset=offset,
        )
        return result

    except Exception as e:
        logger.error(
            f"Failed to get meal logs for user {current_user['id']}",
            {"error": str(e), "user_id": current_user["id"]},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get meal logs",
        )


@router.put("/{meal_log_id}", response_model=MealLogResponse)
async def update_meal_log(
    meal_log_id: str,
    meal_data: MealLogUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update a meal log"""
    try:
        result = await meal_tracking_service.update_meal_log(
            meal_log_id=meal_log_id,
            user_id=current_user["id"],
            meal_type=meal_data.meal_type,
            meal_name=meal_data.meal_name,
            meal_description=meal_data.meal_description,
            logged_time=meal_data.logged_time,
            estimated_protein=meal_data.estimated_protein,
            estimated_calories=meal_data.estimated_calories,
            health_rating=meal_data.health_rating,
            notes=meal_data.notes,
            photo_url=meal_data.photo_url,
        )
        return result

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            f"Failed to update meal log {meal_log_id} for user {current_user['id']}",
            {
                "error": str(e),
                "meal_log_id": meal_log_id,
                "user_id": current_user["id"],
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update meal log",
        )


@router.delete("/{meal_log_id}")
async def delete_meal_log(
    meal_log_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a meal log"""
    try:
        await meal_tracking_service.delete_meal_log(
            meal_log_id=meal_log_id, user_id=current_user["id"]
        )
        return {"message": "Meal log deleted successfully"}

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            f"Failed to delete meal log {meal_log_id} for user {current_user['id']}",
            {
                "error": str(e),
                "meal_log_id": meal_log_id,
                "user_id": current_user["id"],
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete meal log",
        )
