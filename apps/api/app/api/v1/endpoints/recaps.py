"""
Weekly Recap API endpoints
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import Optional
from app.core.flexible_auth import get_current_user
from app.services.logger import logger
from app.services.weekly_recap_service import weekly_recap_service

router = APIRouter(redirect_slashes=False)


class WeeklyRecapResponse(BaseModel):
    week_start: str
    week_end: str
    goal_id: str
    goal_title: str
    stats: dict
    recap_text: str
    generated_at: str


@router.get("/weekly", response_model=WeeklyRecapResponse)
async def get_weekly_recap(
    current_user: dict = Depends(get_current_user),
    goal_id: Optional[str] = Query(None),
):
    """Get weekly recap for current user"""
    try:
        recap = await weekly_recap_service.generate_weekly_recap(
            user_id=current_user["id"],
            goal_id=goal_id,
        )

        if not recap:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active goal found or no check-ins for the week",
            )

        return recap

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to generate weekly recap for user {current_user['id']}",
            {"error": str(e), "user_id": current_user["id"], "goal_id": goal_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate weekly recap",
        )
