"""
Meal Tracking API endpoints
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, time
from app.core.flexible_auth import get_current_user
from app.services.logger import logger
from app.services.meal_tracking_service import meal_tracking_service

router = APIRouter(redirect_slashes=False)


# Pydantic models
class MealLogCreate(BaseModel):
    meal_type: str  # breakfast, lunch, dinner, snack, other
    logged_date: date
    meal_name: Optional[str] = None
    meal_description: Optional[str] = None
    logged_time: Optional[time] = None
    goal_id: Optional[str] = None
    estimated_protein: Optional[int] = None
    estimated_calories: Optional[int] = None
    notes: Optional[str] = None
    photo_urls: Optional[List[str]] = None


class MealLogUpdate(BaseModel):
    meal_type: Optional[str] = None
    meal_name: Optional[str] = None
    meal_description: Optional[str] = None
    logged_time: Optional[time] = None
    estimated_protein: Optional[int] = None
    estimated_calories: Optional[int] = None
    notes: Optional[str] = None
    photo_urls: Optional[List[str]] = None


class MealLogResponse(BaseModel):
    id: str
    user_id: str
    goal_id: Optional[str]
    meal_type: str
    meal_name: Optional[str]
    meal_description: Optional[str]
    logged_date: date
    logged_time: Optional[time]
    estimated_protein: Optional[int]
    estimated_calories: Optional[int]
    notes: Optional[str]
    photo_urls: List[str]
    created_at: str
    updated_at: str


class DailyNutritionSummaryResponse(BaseModel):
    id: str
    user_id: str
    goal_id: Optional[str]
    summary_date: date
    total_protein: int
    total_calories: int
    meal_count: int
    created_at: str
    updated_at: str


@router.post("/", response_model=MealLogResponse, status_code=status.HTTP_201_CREATED)
async def log_meal(
    meal_data: MealLogCreate,
    current_user: dict = Depends(get_current_user),
):
    """Log a meal"""
    try:
        result = await meal_tracking_service.log_meal(
            user_id=current_user["id"],
            meal_type=meal_data.meal_type,
            logged_date=meal_data.logged_date,
            meal_name=meal_data.meal_name,
            meal_description=meal_data.meal_description,
            logged_time=meal_data.logged_time,
            goal_id=meal_data.goal_id,
            estimated_protein=meal_data.estimated_protein,
            estimated_calories=meal_data.estimated_calories,
            notes=meal_data.notes,
            photo_urls=meal_data.photo_urls,
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
            notes=meal_data.notes,
            photo_urls=meal_data.photo_urls,
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


@router.get(
    "/nutrition/summary/{summary_date}", response_model=DailyNutritionSummaryResponse
)
async def get_daily_nutrition_summary(
    summary_date: date,
    current_user: dict = Depends(get_current_user),
    goal_id: Optional[str] = Query(None),
):
    """Get daily nutrition summary for a specific date"""
    try:
        result = await meal_tracking_service.get_daily_nutrition_summary(
            user_id=current_user["id"],
            summary_date=summary_date,
            goal_id=goal_id,
        )

        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No nutrition summary found for this date",
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to get nutrition summary for user {current_user['id']}",
            {
                "error": str(e),
                "user_id": current_user["id"],
                "summary_date": summary_date.isoformat(),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get nutrition summary",
        )


@router.get("/nutrition/summaries", response_model=List[DailyNutritionSummaryResponse])
async def get_nutrition_summaries(
    current_user: dict = Depends(get_current_user),
    start_date: date = Query(...),
    end_date: date = Query(...),
    goal_id: Optional[str] = Query(None),
):
    """Get nutrition summaries for a date range"""
    try:
        result = await meal_tracking_service.get_nutrition_summaries(
            user_id=current_user["id"],
            start_date=start_date,
            end_date=end_date,
            goal_id=goal_id,
        )
        return result

    except Exception as e:
        logger.error(
            f"Failed to get nutrition summaries for user {current_user['id']}",
            {"error": str(e), "user_id": current_user["id"]},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get nutrition summaries",
        )
