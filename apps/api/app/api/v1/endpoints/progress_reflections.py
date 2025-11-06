"""
AI Progress Reflections API endpoints

Premium AI-powered progress reflections for Pro/Coach+ users.
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import Optional
from app.core.flexible_auth import get_current_user
from app.services.logger import logger
from app.services.ai_progress_reflections_service import ai_progress_reflections_service

router = APIRouter(redirect_slashes=False)


class ProgressReflectionResponse(BaseModel):
    period: str
    start_date: str
    end_date: str
    goal_id: Optional[str]
    goal: Optional[dict]
    stats: dict
    reflection: str
    generated_at: str


@router.get("/", response_model=ProgressReflectionResponse)
async def get_progress_reflection(
    current_user: dict = Depends(get_current_user),
    goal_id: Optional[str] = Query(None),
    period: str = Query("weekly", regex="^(weekly|monthly)$"),
):
    """Get AI-powered progress reflection (Pro/Coach+ only)"""
    # Check if user has Pro or Coach+ plan
    user_plan = current_user.get("plan", "free")
    if user_plan not in ["pro", "coach_plus"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AI Progress Reflections are available for Pro and Coach+ users only",
        )

    try:
        result = await ai_progress_reflections_service.generate_reflection(
            user_id=current_user["id"],
            goal_id=goal_id,
            period=period,
        )

        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No check-ins found for the selected period",
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to generate progress reflection for user {current_user['id']}",
            {"error": str(e), "user_id": current_user["id"], "goal_id": goal_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate progress reflection",
        )
