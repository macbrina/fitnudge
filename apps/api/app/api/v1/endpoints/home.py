"""
Home Dashboard API endpoint.

Provides a combined endpoint for the mobile home screen,
returning active items (goals, challenges),
today's pending check-ins, and combined stats.
"""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import date, datetime, timedelta
from app.core.flexible_auth import get_current_user
from app.services.logger import logger
import pytz

router = APIRouter(redirect_slashes=False)


class ActiveItemResponse(BaseModel):
    """An active item (goal or challenge)"""

    type: str  # 'goal', 'challenge'
    data: Dict[str, Any]


class PendingCheckInResponse(BaseModel):
    """A pending check-in for today"""

    type: str  # 'goal', 'challenge'
    data: Dict[str, Any]
    item: Dict[str, Any]  # The goal or challenge this check-in belongs to


class DashboardStatsResponse(BaseModel):
    """Combined stats for the dashboard"""

    active_count: int
    current_streak: int
    total_check_ins: int
    completion_rate: float


class HomeDashboardResponse(BaseModel):
    """Combined response for home dashboard"""

    items: List[ActiveItemResponse]
    today_pending_checkins: List[PendingCheckInResponse]
    stats: DashboardStatsResponse


def get_user_today(user_timezone: str) -> date:
    """Get today's date in user's timezone"""
    try:
        user_tz = pytz.timezone(user_timezone or "UTC")
        return datetime.now(user_tz).date()
    except Exception:
        return date.today()


@router.get("/dashboard", response_model=HomeDashboardResponse)
async def get_home_dashboard(
    current_user: dict = Depends(get_current_user),
    timezone: str = Query("UTC", description="User's timezone"),
):
    """
    Get combined home dashboard data.

    Returns:
    - Active items: goals and challenges the user is part of
    - Today's pending check-ins: goals and challenges that need check-in today
    - Combined stats: active count, streak, total check-ins, completion rate
    """
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]
    user_today = get_user_today(timezone)
    today_str = user_today.isoformat()

    items: List[ActiveItemResponse] = []
    pending_checkins: List[PendingCheckInResponse] = []

    # =========================================
    # 1. Fetch Active Goals
    # =========================================
    try:
        goals_result = (
            supabase.table("goals")
            .select("*")
            .eq("user_id", user_id)
            .eq("status", "active")
            .order("created_at", desc=True)
            .execute()
        )

        for goal in goals_result.data or []:
            items.append(ActiveItemResponse(type="goal", data=goal))
    except Exception as e:
        logger.error(f"Error fetching goals: {e}")

    # =========================================
    # 2. Fetch Active Challenges user participates in
    # =========================================
    try:
        # Get challenges where user is a participant
        participant_result = (
            supabase.table("challenge_participants")
            .select("challenge_id, joined_at, challenges(*)")
            .eq("user_id", user_id)
            .execute()
        )

        for participation in participant_result.data or []:
            challenge = participation.get("challenges")
            if not challenge or challenge.get("status") not in ("upcoming", "active"):
                continue

            # Status is stored in the database, no need to compute
            else:
                challenge["status"] = "active"

            # Only include active challenges
            if challenge["status"] == "active":
                challenge["joined_at"] = participation.get("joined_at")
                challenge["is_creator"] = challenge.get("created_by") == user_id
                challenge["is_participant"] = True

                # Get participant count
                try:
                    count_result = (
                        supabase.table("challenge_participants")
                        .select("id")
                        .eq("challenge_id", challenge["id"])
                        .execute()
                    )
                    challenge["participants_count"] = (
                        len(count_result.data) if count_result.data else 0
                    )
                except Exception:
                    challenge["participants_count"] = 0

                # Get user's progress from leaderboard
                try:
                    leaderboard_result = (
                        supabase.table("challenge_leaderboard")
                        .select("rank, points, progress_data")
                        .eq("challenge_id", challenge["id"])
                        .eq("user_id", user_id)
                        .execute()
                    )
                    if leaderboard_result.data and len(leaderboard_result.data) > 0:
                        lb_data = leaderboard_result.data[0]
                        challenge["my_rank"] = lb_data.get("rank")
                        challenge["my_progress"] = lb_data.get("points", 0)
                    else:
                        challenge["my_rank"] = None
                        challenge["my_progress"] = 0
                except Exception:
                    challenge["my_rank"] = None
                    challenge["my_progress"] = 0

                items.append(ActiveItemResponse(type="challenge", data=challenge))
    except Exception as e:
        logger.error(f"Error fetching challenges: {e}")

    # =========================================
    # 3. Fetch Today's Pending Goal Check-ins
    # =========================================
    try:
        # Get check-ins for today with full goal details
        goal_checkins_result = (
            supabase.table("check_ins")
            .select(
                "*, goals(id, title, status, tracking_type, category, frequency, days_of_week)"
            )
            .eq("user_id", user_id)
            .eq("check_in_date", today_str)
            .execute()
        )

        for checkin in goal_checkins_result.data or []:
            if not checkin.get("is_checked_in"):
                goal = checkin.get("goals", {})
                # Skip if goal is not active
                if not goal or goal.get("status") != "active":
                    continue
                pending_checkins.append(
                    PendingCheckInResponse(type="goal", data=checkin, item=goal)
                )
    except Exception as e:
        logger.error(f"Error fetching goal check-ins: {e}")

    # =========================================
    # 4. Fetch Today's Pending Challenge Check-ins
    # =========================================
    # Query pre-created challenge check-ins where is_checked_in=false
    try:
        challenge_checkins_result = (
            supabase.table("challenge_check_ins")
            .select(
                "*, challenges(id, title, description, status, tracking_type, start_date, end_date, category, frequency, days_of_week)"
            )
            .eq("user_id", user_id)
            .eq("check_in_date", today_str)
            .eq("is_checked_in", False)
            .execute()
        )

        for checkin in challenge_checkins_result.data or []:
            challenge = checkin.get("challenges", {})
            # Skip if challenge is not active
            if not challenge or challenge.get("status") not in ("upcoming", "active"):
                continue
            pending_checkins.append(
                PendingCheckInResponse(type="challenge", data=checkin, item=challenge)
            )
    except Exception as e:
        logger.error(f"Error fetching pending challenge check-ins: {e}")

    # =========================================
    # 5. Get Combined Stats from user_stats_cache (optimized)
    # =========================================
    # The user_stats_cache table is maintained by triggers and provides
    # pre-calculated stats, eliminating expensive queries on every dashboard load.

    active_count = len(items)
    current_streak = 0
    total_check_ins = 0
    completion_rate = 0.0

    try:
        # Single query to get all pre-calculated stats
        stats_result = (
            supabase.table("user_stats_cache")
            .select(
                "current_streak, total_checkins, completion_rate_30d, longest_streak"
            )
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

        if stats_result.data and len(stats_result.data) > 0:
            cached_stats = stats_result.data[0]
            current_streak = cached_stats.get("current_streak", 0) or 0
            total_check_ins = cached_stats.get("total_checkins", 0) or 0
            completion_rate = float(cached_stats.get("completion_rate_30d", 0) or 0)
        else:
            # Fallback: Create cache entry if it doesn't exist
            # This handles new users or users created before the migration
            logger.info(f"No stats cache for user {user_id}, triggering refresh")
            try:
                supabase.rpc(
                    "refresh_user_stats_cache", {"p_user_id": user_id}
                ).execute()
                # Retry fetch
                retry_result = (
                    supabase.table("user_stats_cache")
                    .select("current_streak, total_checkins, completion_rate_30d")
                    .eq("user_id", user_id)
                    .limit(1)
                    .execute()
                )
                if retry_result.data and len(retry_result.data) > 0:
                    cached_stats = retry_result.data[0]
                    current_streak = cached_stats.get("current_streak", 0) or 0
                    total_check_ins = cached_stats.get("total_checkins", 0) or 0
                    completion_rate = float(
                        cached_stats.get("completion_rate_30d", 0) or 0
                    )
            except Exception as rpc_err:
                logger.warning(f"Failed to refresh stats cache: {rpc_err}")
    except Exception as e:
        logger.error(f"Error fetching user stats cache: {e}")

    return HomeDashboardResponse(
        items=items,
        today_pending_checkins=pending_checkins,
        stats=DashboardStatsResponse(
            active_count=active_count,
            current_streak=current_streak,
            total_check_ins=total_check_ins,
            completion_rate=completion_rate,
        ),
    )
