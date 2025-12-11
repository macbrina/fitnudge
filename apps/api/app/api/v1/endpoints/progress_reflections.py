"""
AI Progress Reflections API endpoints

Premium AI-powered progress reflections (requires ai_progress_reflections feature).
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import Optional
from app.core.flexible_auth import get_current_user
from app.core.subscriptions import check_user_has_feature
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
    """Get AI-powered progress reflection (requires ai_progress_reflections feature)"""
    # Check if user has access to ai_progress_reflections feature via minimum_tier
    user_plan = current_user.get("plan", "free")
    has_access = check_user_has_feature(
        current_user["id"], "ai_progress_reflections", user_plan
    )
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AI Progress Reflections require a higher tier subscription. Please upgrade to access this feature.",
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
