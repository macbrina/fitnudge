"""
Weekly Recap API endpoints

PREMIUM FEATURE: weekly_recap requires premium subscription (minimum_tier: 1)
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import Optional, List, Any
from app.core.flexible_auth import get_current_user
from app.core.database import get_supabase_client
from app.services.logger import logger
from app.services.weekly_recap_service import weekly_recap_service
from app.services.subscription_service import has_user_feature

router = APIRouter(redirect_slashes=False)


class GoalBreakdown(BaseModel):
    """Per-goal breakdown in weekly recap."""

    goal_id: str
    title: str
    completed: int
    total: int  # V2: renamed from 'scheduled'
    days_active: int
    completion_rate: float
    status: str  # 'excellent', 'good', 'needs_attention'
    current_streak: Optional[int] = 0
    longest_streak: Optional[int] = 0


class CompletionRateTrend(BaseModel):
    week_start: str
    week_label: str
    completed: int
    scheduled: int
    completion_rate: float
    is_current: bool


class AchievementUnlocked(BaseModel):
    badge_key: Optional[str] = None
    badge_name: str
    description: Optional[str] = None
    category: Optional[str] = None
    rarity: Optional[str] = None
    unlocked_at: Optional[str] = None


class PartnerContext(BaseModel):
    partner_name: str
    partner_streak: int
    partnership_id: Optional[str] = None


class WeeklyRecapStats(BaseModel):
    """V2 Stats - simplified structure."""

    completed_check_ins: int
    days_with_checkins: int
    current_streak: int
    longest_streak: int
    completion_rate: float
    total_check_ins: Optional[int] = 0
    rest_day_count: Optional[int] = 0
    previous_week_checkins: Optional[int] = 0
    week_over_week_change: Optional[int] = 0
    strongest_day: Optional[str] = None
    weakest_day: Optional[str] = None
    mood_distribution: Optional[dict] = None  # {'tough': 2, 'good': 5, 'amazing': 3}


class WeeklyRecapResponse(BaseModel):
    """V2 Weekly Recap."""

    id: Optional[str] = None
    week_start: str
    week_end: str
    goal_id: Optional[str] = None
    goal_title: Optional[str] = None
    # DB summary columns
    goals_hit: Optional[int] = 0
    goals_total: Optional[int] = 0
    consistency_percent: Optional[float] = 0
    # Full stats object
    stats: Optional[dict] = {}
    goal_breakdown: Optional[List[dict]] = []
    completion_rate_trend: Optional[List[dict]] = []
    partner_context: Optional[List[dict]] = None
    achievements_unlocked: Optional[List[dict]] = []
    # AI-generated content
    summary: Optional[str] = None  # Short AI summary
    recap_text: Optional[str] = None  # Full recap text
    win: Optional[str] = None
    insight: Optional[str] = None
    focus_next_week: Optional[str] = None
    motivational_close: Optional[str] = None
    generated_at: Optional[str] = None


class WeeklyRecapListItem(BaseModel):
    """V2 List item."""

    id: str
    week_start: str
    week_end: str
    # DB summary columns
    goals_hit: Optional[int] = 0
    goals_total: Optional[int] = 0
    consistency_percent: Optional[float] = 0
    # Cached data
    stats: Optional[dict] = {}
    goal_breakdown: Optional[List[dict]] = []
    achievements_unlocked: Optional[List[dict]] = []
    partner_context: Optional[List[dict]] = None
    # AI content
    summary: Optional[str] = None
    recap_text: Optional[str] = None
    win: Optional[str] = None
    insight: Optional[str] = None
    generated_at: Optional[str] = None
    created_at: Optional[str] = None


class WeeklyRecapsListResponse(BaseModel):
    data: List[WeeklyRecapListItem]
    total: int


@router.get("/list", response_model=WeeklyRecapsListResponse)
async def list_weekly_recaps(
    current_user: dict = Depends(get_current_user),
    limit: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0),
):
    """
    List cached weekly recaps for current user.

    PREMIUM FEATURE: Requires premium subscription to view recaps.
    """
    try:
        supabase = get_supabase_client()

        # Check premium access
        has_access = await has_user_feature(
            supabase, current_user["id"], "weekly_recap"
        )
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Weekly recaps require a premium subscription",
            )

        # Get recaps from cache table, most recent first (week_end desc = latest week first)
        result = (
            supabase.table("weekly_recaps")
            .select("*")
            .eq("user_id", current_user["id"])
            .order("week_end", desc=True)
            .order("generated_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )

        recaps = result.data or []

        # Get total count
        count_result = (
            supabase.table("weekly_recaps")
            .select("id", count="exact")
            .eq("user_id", current_user["id"])
            .execute()
        )
        total = count_result.count or 0

        return {"data": recaps, "total": total}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to list weekly recaps for user {current_user['id']}",
            {"error": str(e), "user_id": current_user["id"]},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list weekly recaps",
        )


@router.get("/weekly", response_model=WeeklyRecapResponse)
async def get_weekly_recap(
    current_user: dict = Depends(get_current_user),
    goal_id: Optional[str] = Query(None),
    force_regenerate: bool = Query(False),
):
    """Get current weekly recap for current user (PREMIUM FEATURE, generates if not cached)"""
    try:
        supabase = get_supabase_client()

        # Check premium access
        has_access = await has_user_feature(
            supabase, current_user["id"], "weekly_recap"
        )
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Weekly recaps require a premium subscription",
            )

        # Use the cache-first method
        recap = await weekly_recap_service.get_weekly_recap(
            user_id=current_user["id"],
            force_regenerate=force_regenerate,
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


@router.get("/{recap_id}", response_model=WeeklyRecapResponse)
async def get_recap_by_id(
    recap_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Get a specific weekly recap by ID.

    PREMIUM FEATURE: Requires premium subscription to view recaps.
    """
    try:
        supabase = get_supabase_client()

        # Check premium access
        has_access = await has_user_feature(
            supabase, current_user["id"], "weekly_recap"
        )
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Weekly recaps require a premium subscription",
            )

        result = (
            supabase.table("weekly_recaps")
            .select("*")
            .eq("id", recap_id)
            .eq("user_id", current_user["id"])
            .maybe_single()
            .execute()
        )

        # Supabase client can (rarely) return None here; treat as not found
        recap = getattr(result, "data", None) if result is not None else None
        if not recap:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Weekly recap not found",
            )

        # Mark as viewed if not already viewed
        if not recap.get("viewed_at"):
            from datetime import datetime, timezone

            supabase.table("weekly_recaps").update(
                {"viewed_at": datetime.now(timezone.utc).isoformat()}
            ).eq("id", recap_id).execute()

            # Check recap achievements (non-blocking)
            try:
                from app.services.tasks import check_achievements_task

                check_achievements_task.delay(
                    user_id=current_user["id"],
                    source_type="recap_viewed",
                    source_id=recap_id,
                )
            except Exception as e:
                logger.warning(f"Failed to queue achievement check for recap: {e}")

        return recap

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to get weekly recap {recap_id} for user {current_user['id']} str({e})",
            {"error": str(e), "user_id": current_user["id"], "recap_id": recap_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get weekly recap",
        )
