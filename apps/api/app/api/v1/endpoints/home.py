"""
Home Dashboard API endpoint (V2).

Provides a combined endpoint for the mobile home screen,
returning today's pending check-ins and current streak.
"""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import date, datetime
from app.core.flexible_auth import get_current_user
from app.services.logger import logger
import pytz

router = APIRouter(redirect_slashes=False)


class PendingCheckInResponse(BaseModel):
    """A pending check-in for today"""

    type: str  # 'goal'
    data: Dict[str, Any]
    item: Dict[str, Any]  # The goal this check-in belongs to


class HomeDashboardResponse(BaseModel):
    """Combined response for home dashboard"""

    today_pending_checkins: List[PendingCheckInResponse]
    current_streak: int
    longest_streak: int


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
    Get combined home dashboard data (V2).

    Returns:
    - Today's pending check-ins: goals that need check-in today
    - Current streak: user's best current streak across all goals
    - Longest streak: user's all-time best streak
    """
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]
    user_today = get_user_today(timezone)
    today_str = user_today.isoformat()
    today_day_of_week = user_today.weekday()  # 0=Monday, 6=Sunday

    pending_checkins: List[PendingCheckInResponse] = []
    current_streak = 0
    longest_streak = 0

    # =========================================
    # 1. Fetch Active Goals with Today's Check-in Status
    # =========================================
    try:
        # V2: Get active goals with their streak info
        # V2 schema: goals have current_streak, longest_streak directly
        goals_result = (
            supabase.table("goals")
            .select(
                "id, title, status, frequency_type, frequency_count, target_days, "
                "reminder_times, why_statement, current_streak, longest_streak, "
                "last_checkin_date, week_completions"
            )
            .eq("user_id", user_id)
            .eq("status", "active")
            .execute()
        )

        active_goals = goals_result.data or []

        # Track best streak across all goals
        for goal in active_goals:
            goal_streak = goal.get("current_streak", 0) or 0
            goal_longest = goal.get("longest_streak", 0) or 0
            if goal_streak > current_streak:
                current_streak = goal_streak
            if goal_longest > longest_streak:
                longest_streak = goal_longest

        # =========================================
        # 2. Check which goals need check-in today
        # =========================================
        # V2: Check-ins are created on-the-fly, not pre-created
        # We need to determine which goals are scheduled for today
        # and haven't been checked in yet

        for goal in active_goals:
            is_scheduled_today = False
            frequency_type = goal.get("frequency_type", "daily")
            target_days = goal.get("target_days", [])

            if frequency_type == "daily":
                is_scheduled_today = True
            elif frequency_type == "weekly" and target_days:
                # target_days is 0-indexed: 0=Sunday, 1=Monday, ..., 6=Saturday
                # Python weekday(): 0=Monday, 6=Sunday
                # Convert Python weekday to our format: Sunday=0
                today_day_adjusted = (today_day_of_week + 1) % 7
                is_scheduled_today = today_day_adjusted in target_days

            if not is_scheduled_today:
                continue

            # Check if already checked in today
            last_checkin = goal.get("last_checkin_date")
            if last_checkin == today_str:
                continue  # Already checked in today

            # This goal needs check-in today
            pending_checkins.append(
                PendingCheckInResponse(
                    type="goal",
                    data={
                        "goal_id": goal["id"],
                        "check_in_date": today_str,
                        "is_checked_in": False,
                    },
                    item=goal,
                )
            )

    except Exception as e:
        logger.error(f"Error fetching goals for home dashboard: {e}")

    return HomeDashboardResponse(
        today_pending_checkins=pending_checkins,
        current_streak=current_streak,
        longest_streak=longest_streak,
    )
