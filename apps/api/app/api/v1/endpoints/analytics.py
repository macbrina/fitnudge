"""
FitNudge V2 - Analytics API Endpoints (Per-Goal)

PREMIUM FEATURE: advanced_analytics requires premium subscription (minimum_tier: 1)

V2 Changes:
- Analytics are now per-goal (requires goal_id)
- Added heatmap_data, this_week_summary, mood_trend
- Removed goal_comparison (not needed for single goal view)

Optimized for 100K+ users:
1. PostgreSQL RPC with parallel CTEs
2. Materialized views for pre-aggregation
3. Redis caching (1 hour TTL)

Following SCALABILITY.md patterns.
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import pytz

from app.core.flexible_auth import get_current_user
from app.services.subscription_service import has_user_feature
from app.services.tasks.analytics_refresh_tasks import (
    get_cached_analytics,
    set_cached_analytics,
)
from app.services.logger import logger

router = APIRouter(redirect_slashes=False)


# =============================================================================
# V2 PYDANTIC MODELS - Chart Data Structures
# =============================================================================


class HeatmapDataItem(BaseModel):
    """Check-in status for a single day (calendar heatmap)."""

    date: str
    status: str  # completed, rest_day, skipped, missed
    intensity: int  # 0-4 for coloring


class ThisWeekItem(BaseModel):
    """Status for a single day in the current week."""

    date: str
    day_name: str  # Mon, Tue, etc.
    day_of_week: int  # 0=Sun, 1=Mon, etc.
    status: str  # completed, rest_day, skipped, missed, pending, no_data


class MoodTrendItem(BaseModel):
    """Mood data for a single day."""

    date: str
    mood: str  # tough, good, amazing
    mood_score: int  # 1, 2, 3
    label: str  # "Jan 15" format


class WeeklyConsistencyItem(BaseModel):
    """Consistency data for a single day of the week."""

    day: str
    day_index: int
    percentage: int
    completed: int
    total: int


class StreakHistoryItem(BaseModel):
    """Streak data for a single week."""

    week: str
    week_start: str
    max_streak: int


class MonthlyTrendItem(BaseModel):
    """Trend data for a single month."""

    month: str
    month_index: int
    year: int
    percentage: int
    completed: int
    total: int


class SkipReasonItem(BaseModel):
    """Distribution of a skip reason."""

    reason: str
    label: str
    count: int
    percentage: int
    color: str


class AnalyticsDashboardResponse(BaseModel):
    """Complete per-goal analytics dashboard data."""

    # Goal info
    goal_id: Optional[str] = None
    goal_title: Optional[str] = None
    goal_created_at: Optional[str] = None  # ISO date when goal was created
    # Target days for schedule: null = daily (all days), array = specific days (0=Sun, 1=Mon, etc.)
    target_days: Optional[List[int]] = None

    # Summary stats
    total_check_ins: int
    completed_check_ins: int
    completion_rate: float
    current_streak: int
    longest_streak: int

    # New: Heatmap and this week data
    heatmap_data: List[HeatmapDataItem]
    this_week_summary: List[ThisWeekItem]

    # Chart data
    weekly_consistency: List[WeeklyConsistencyItem]
    streak_history: List[StreakHistoryItem]
    monthly_trend: List[MonthlyTrendItem]
    skip_reasons: List[SkipReasonItem]

    # New: Mood trend
    mood_trend: List[MoodTrendItem]

    # Metadata
    data_range_days: int
    generated_at: str
    cache_hit: bool = False  # Indicates if served from cache


# =============================================================================
# MAIN ENDPOINT - Per-Goal Analytics with Redis Caching
# =============================================================================


@router.get("/dashboard", response_model=AnalyticsDashboardResponse)
async def get_analytics_dashboard(
    goal_id: str = Query(..., description="Goal ID to analyze (required)"),
    days: int = Query(30, ge=7, le=180, description="Number of days to analyze"),
    skip_cache: bool = Query(False, description="Force fresh data (skip Redis cache)"),
    current_user: dict = Depends(get_current_user),
):
    """
    Get per-goal analytics dashboard data (PREMIUM FEATURE).

    V2: Analytics are now per-goal. Each goal has its own:
    - Heatmap calendar
    - This week summary
    - Weekly consistency patterns
    - Streak history
    - Mood trend
    - Skip reason breakdown
    - Monthly trend

    Performance optimizations:
    1. Redis cache (1 hour TTL) - instant response
    2. PostgreSQL parallel CTEs - efficient SQL execution

    Query params:
    - goal_id: Goal ID to analyze (required)
    - days: Number of days to analyze (7-180, default 30)
    - skip_cache: Force fresh data from database
    """
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Check premium access
    has_access = await has_user_feature(supabase, user_id, "advanced_analytics")
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Advanced analytics require a premium subscription",
        )

    # Validate goal exists and belongs to user
    goal_check = (
        supabase.table("goals")
        .select("id, title, status, created_at, target_days, frequency_type")
        .eq("id", goal_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if not goal_check.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found",
        )

    if goal_check.data.get("status") != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analytics are only available for active goals",
        )

    user_tz = current_user.get("timezone", "UTC")
    end_date = _user_today_iso(user_tz)

    # ==========================================================================
    # Defensive: Pre-create today's check-in if it doesn't exist
    # This ensures accurate "today" status in heatmap/this_week_summary
    # (Covers edge case where hourly task hasn't run yet)
    # ==========================================================================
    checkin_created = False
    try:
        result = supabase.rpc(
            "precreate_checkin_for_goal",
            {
                "p_goal_id": goal_id,
                "p_user_id": user_id,
                "p_frequency_type": goal_check.data.get("frequency_type"),
                "p_target_days": goal_check.data.get("target_days"),
                "p_user_timezone": user_tz,
            },
        ).execute()
        # RPC returns: 'inserted', 'existed', or 'not_scheduled'
        checkin_created = result.data == "inserted"
    except Exception:
        # Non-critical - don't fail the request if pre-creation fails
        pass

    # If a new check-in was created, invalidate cache to ensure fresh data
    if checkin_created:
        from app.services.tasks.analytics_refresh_tasks import (
            invalidate_user_analytics_cache,
        )

        invalidate_user_analytics_cache(user_id, goal_id)

    # ==========================================================================
    # Check Redis cache first (key includes goal_id and end_date for timezone correctness)
    # ==========================================================================
    if not skip_cache:
        cached_data = get_cached_analytics(user_id, days, goal_id, end_date)
        if cached_data:
            return _transform_to_response(cached_data, cache_hit=True)

    # ==========================================================================
    # Cache miss - fetch from database
    # ==========================================================================
    try:
        # Call RPC with user's local "today" so completion_rate matches SingleGoalScreen
        result = supabase.rpc(
            "get_analytics_dashboard",
            {
                "p_user_id": user_id,
                "p_goal_id": goal_id,
                "p_days": days,
                "p_end_date": end_date,
            },
        ).execute()

        if not result.data:
            # Extract goal created_at as date string
            goal_created_at = None
            if goal_check.data.get("created_at"):
                from datetime import datetime as dt

                try:
                    created_dt = dt.fromisoformat(
                        goal_check.data["created_at"].replace("Z", "+00:00")
                    )
                    goal_created_at = created_dt.strftime("%Y-%m-%d")
                except (ValueError, AttributeError):
                    pass
            return _empty_dashboard(
                days,
                goal_id,
                goal_check.data.get("title"),
                goal_created_at,
                goal_check.data.get("target_days"),
            )

        data = result.data

        # ==========================================================================
        # Store in Redis cache for next request
        # ==========================================================================
        set_cached_analytics(user_id, days, data, goal_id, end_date)

        return _transform_to_response(data, cache_hit=False)

    except Exception as e:
        logger.error(f"Analytics dashboard error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate analytics dashboard",
        )


# =============================================================================
# CACHE STATUS ENDPOINT (for debugging/monitoring)
# =============================================================================


@router.get("/cache-status")
async def get_analytics_cache_status(
    current_user: dict = Depends(get_current_user),
):
    """
    Check analytics cache status for current user.
    Useful for debugging and monitoring.
    """
    from app.core.cache import get_redis_client

    user_id = current_user["id"]
    redis = get_redis_client()

    if not redis:
        return {
            "redis_available": False,
            "cached": False,
            "message": "Redis not configured",
        }

    # Keys are analytics:dashboard:{user_id}:{goal_id}:{days}:{end_date}
    pattern = f"analytics:dashboard:{user_id}:*"
    cached_count = 0
    try:
        cursor = 0
        while True:
            cursor, keys = redis.scan(cursor, match=pattern, count=100)
            cached_count += len(keys)
            if cursor == 0:
                break
    except Exception:
        pass

    try:
        last_refresh = redis.get("analytics:last_refresh")
        last_refresh_str = last_refresh.decode() if last_refresh else None
    except Exception:
        last_refresh_str = None

    return {
        "redis_available": True,
        "user_id": user_id,
        "cached_any": cached_count > 0,
        "cached_keys_count": cached_count,
        "last_mv_refresh": last_refresh_str,
    }


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================


def _user_today_iso(user_timezone: str) -> str:
    """Today's date (YYYY-MM-DD) in user's timezone. Falls back to UTC on error."""
    try:
        tz = pytz.timezone(user_timezone or "UTC")
        return datetime.now(tz).date().isoformat()
    except Exception:
        return datetime.utcnow().date().isoformat()


def _transform_to_response(data: dict, cache_hit: bool) -> AnalyticsDashboardResponse:
    """Transform RPC/cache result to response model."""
    return AnalyticsDashboardResponse(
        # Goal info
        goal_id=data.get("goal_id"),
        goal_title=data.get("goal_title"),
        goal_created_at=data.get("goal_created_at"),
        target_days=data.get("target_days"),
        # Summary stats
        total_check_ins=data.get("total_check_ins", 0),
        completed_check_ins=data.get("completed_check_ins", 0),
        completion_rate=float(data.get("completion_rate", 0)),
        current_streak=data.get("current_streak", 0),
        longest_streak=data.get("longest_streak", 0),
        # New: Heatmap and this week
        heatmap_data=[HeatmapDataItem(**item) for item in data.get("heatmap_data", [])],
        this_week_summary=[
            ThisWeekItem(**item) for item in data.get("this_week_summary", [])
        ],
        # Chart data
        weekly_consistency=[
            WeeklyConsistencyItem(**item) for item in data.get("weekly_consistency", [])
        ],
        streak_history=[
            StreakHistoryItem(**item) for item in data.get("streak_history", [])
        ],
        monthly_trend=[
            MonthlyTrendItem(**item) for item in data.get("monthly_trend", [])
        ],
        skip_reasons=[SkipReasonItem(**item) for item in data.get("skip_reasons", [])],
        # New: Mood trend
        mood_trend=[MoodTrendItem(**item) for item in data.get("mood_trend", [])],
        # Metadata
        data_range_days=data.get("data_range_days", 30),
        generated_at=data.get("generated_at", datetime.utcnow().isoformat()),
        cache_hit=cache_hit,
    )


def _empty_dashboard(
    days: int,
    goal_id: str = None,
    goal_title: str = None,
    goal_created_at: str = None,
    target_days: List[int] = None,
) -> AnalyticsDashboardResponse:
    """Return empty dashboard for goals with no data."""
    return AnalyticsDashboardResponse(
        goal_id=goal_id,
        goal_title=goal_title,
        goal_created_at=goal_created_at,
        target_days=target_days,
        total_check_ins=0,
        completed_check_ins=0,
        completion_rate=0,
        current_streak=0,
        longest_streak=0,
        heatmap_data=[],
        this_week_summary=[],
        weekly_consistency=[],
        streak_history=[],
        monthly_trend=[],
        skip_reasons=[],
        mood_trend=[],
        data_range_days=days,
        generated_at=datetime.utcnow().isoformat(),
        cache_hit=False,
    )
