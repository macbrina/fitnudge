"""
Achievement Badges API endpoints
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from app.core.flexible_auth import get_current_user
from app.services.logger import logger
from app.services.achievement_service import achievement_service

router = APIRouter(redirect_slashes=False)


class AchievementResponse(BaseModel):
    id: str
    user_id: str
    achievement_type_id: str
    goal_id: Optional[str]
    unlocked_at: str
    metadata: dict
    badge_key: str
    badge_name: str
    badge_description: Optional[str]
    points: int
    rarity: str


class AchievementTypeResponse(BaseModel):
    id: str
    badge_key: str
    badge_name: str
    badge_description: Optional[str]
    badge_icon: Optional[str]
    unlock_condition: str
    category: str
    rarity: str
    points: int


@router.get("/types", response_model=List[AchievementTypeResponse])
async def get_achievement_types(
    current_user: dict = Depends(get_current_user),
):
    """Get all available achievement types"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    result = (
        supabase.table("achievement_types")
        .select("*")
        .eq("is_active", True)
        .order("sort_order")
        .execute()
    )

    return result.data or []


@router.get("/me", response_model=List[AchievementResponse])
async def get_my_achievements(
    current_user: dict = Depends(get_current_user),
    goal_id: Optional[str] = Query(None),
):
    """Get user's unlocked achievements"""
    try:
        achievements = await achievement_service.get_user_achievements(
            user_id=current_user["id"],
            goal_id=goal_id,
        )

        # Format response
        formatted = []
        for achievement in achievements:
            achievement_type = achievement.get("achievement_types", {})
            formatted.append(
                {
                    "id": achievement["id"],
                    "user_id": achievement["user_id"],
                    "achievement_type_id": achievement["achievement_type_id"],
                    "goal_id": achievement.get("goal_id"),
                    "unlocked_at": achievement["unlocked_at"],
                    "metadata": achievement.get("metadata", {}),
                    "badge_key": achievement_type.get("badge_key", ""),
                    "badge_name": achievement_type.get("badge_name", ""),
                    "badge_description": achievement_type.get("badge_description"),
                    "points": achievement_type.get("points", 0),
                    "rarity": achievement_type.get("rarity", "common"),
                }
            )

        return formatted

    except Exception as e:
        logger.error(
            f"Failed to get achievements for user {current_user['id']}",
            {"error": str(e), "user_id": current_user["id"]},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve achievements",
        )


@router.post("/check", response_model=List[AchievementResponse])
async def check_achievements(
    current_user: dict = Depends(get_current_user),
    goal_id: Optional[str] = Query(None),
):
    """Manually trigger achievement check for current user"""
    try:
        newly_unlocked = await achievement_service.check_and_unlock_achievements(
            user_id=current_user["id"],
            goal_id=goal_id,
        )

        # Format response
        formatted = []
        for achievement in newly_unlocked:
            formatted.append(
                {
                    "id": achievement["id"],
                    "user_id": achievement["user_id"],
                    "achievement_type_id": achievement["achievement_type_id"],
                    "goal_id": achievement.get("goal_id"),
                    "unlocked_at": achievement["unlocked_at"],
                    "metadata": achievement.get("metadata", {}),
                    "badge_key": achievement.get("badge_key", ""),
                    "badge_name": achievement.get("badge_name", ""),
                    "badge_description": achievement.get("badge_description"),
                    "points": achievement.get("points", 0),
                    "rarity": achievement.get("rarity", "common"),
                }
            )

        return formatted

    except Exception as e:
        logger.error(
            f"Failed to check achievements for user {current_user['id']}",
            {"error": str(e), "user_id": current_user["id"]},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check achievements",
        )


@router.get("/stats")
async def get_achievement_stats(
    current_user: dict = Depends(get_current_user),
):
    """Get achievement statistics for current user"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Get total achievements unlocked
        total_result = (
            supabase.table("user_achievements")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .execute()
        )
        total_achievements = (
            total_result.count
            if hasattr(total_result, "count")
            else len(total_result.data or [])
        )

        # Get total points
        achievements = (
            supabase.table("user_achievements")
            .select("achievement_types(points)")
            .eq("user_id", user_id)
            .execute()
        )
        total_points = sum(
            (a.get("achievement_types", {}).get("points", 0) or 0)
            for a in (achievements.data or [])
        )

        # Get achievements by rarity
        rarity_result = (
            supabase.table("user_achievements")
            .select("achievement_types(rarity)")
            .eq("user_id", user_id)
            .execute()
        )
        rarity_counts = {}
        for achievement in rarity_result.data or []:
            rarity = achievement.get("achievement_types", {}).get("rarity", "common")
            rarity_counts[rarity] = rarity_counts.get(rarity, 0) + 1

        return {
            "total_achievements": total_achievements,
            "total_points": total_points,
            "rarity_breakdown": rarity_counts,
        }

    except Exception as e:
        logger.error(
            f"Failed to get achievement stats for user {user_id}",
            {"error": str(e), "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve achievement statistics",
        )
