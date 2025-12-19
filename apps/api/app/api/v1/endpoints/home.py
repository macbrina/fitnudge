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
            .eq("is_active", True)
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
            if not challenge or not challenge.get("is_active"):
                continue

            # Compute status from dates
            start_date = (
                date.fromisoformat(challenge["start_date"])
                if challenge.get("start_date")
                else None
            )
            end_date = (
                date.fromisoformat(challenge["end_date"])
                if challenge.get("end_date")
                else None
            )

            if end_date and user_today > end_date:
                challenge["status"] = "completed"
            elif start_date and user_today < start_date:
                challenge["status"] = "upcoming"
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
        # Get check-ins for today
        goal_checkins_result = (
            supabase.table("check_ins")
            .select("*, goals(id, title, goal_type)")
            .eq("user_id", user_id)
            .eq("date", today_str)
            .execute()
        )

        for checkin in goal_checkins_result.data or []:
            if not checkin.get("is_checked_in"):
                goal = checkin.get("goals", {})
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
                "*, challenges(id, title, description, is_active, start_date, end_date, goal_template)"
            )
            .eq("user_id", user_id)
            .eq("check_in_date", today_str)
            .eq("is_checked_in", False)
            .execute()
        )

        for checkin in challenge_checkins_result.data or []:
            challenge = checkin.get("challenges", {})
            # Skip if challenge is not active
            if not challenge or not challenge.get("is_active"):
                continue
            pending_checkins.append(
                PendingCheckInResponse(type="challenge", data=checkin, item=challenge)
            )
    except Exception as e:
        logger.error(f"Error fetching pending challenge check-ins: {e}")

    # =========================================
    # 5. Calculate Combined Stats (from fetched data)
    # =========================================
    active_count = len(items)
    current_streak = 0
    total_check_ins = 0
    total_goal_checkins = 0
    total_challenge_checkins = 0
    completion_rate = 0.0

    # Collect all check-in dates from both goals and challenges
    all_checkin_dates: set[str] = set()

    # Get completed goal check-ins
    try:
        goal_checkins_result = (
            supabase.table("check_ins")
            .select("id, date, completed")
            .eq("user_id", user_id)
            .eq("completed", True)
            .execute()
        )
        goal_checkins = goal_checkins_result.data or []
        total_goal_checkins = len(goal_checkins)

        # Add goal check-in dates to combined set
        for checkin in goal_checkins:
            all_checkin_dates.add(checkin["date"])
    except Exception as e:
        logger.error(f"Error fetching goal check-ins: {e}")
        goal_checkins = []

    # Get challenge check-ins (completed only)
    try:
        challenge_checkins_result = (
            supabase.table("challenge_check_ins")
            .select("id, check_in_date")
            .eq("user_id", user_id)
            .eq("completed", True)
            .execute()
        )
        challenge_checkins = challenge_checkins_result.data or []
        total_challenge_checkins = len(challenge_checkins)

        # Add challenge check-in dates to combined set
        for checkin in challenge_checkins:
            all_checkin_dates.add(checkin["check_in_date"])
    except Exception as e:
        logger.error(f"Error fetching challenge check-ins: {e}")

    # Combined total check-ins
    total_check_ins = total_goal_checkins + total_challenge_checkins

    # Calculate current streak from combined check-in dates
    # Streak = consecutive days with at least one check-in (goal OR challenge)
    if all_checkin_dates:
        streak = 0
        check_date = user_today

        # Count consecutive days backwards from today
        while check_date.isoformat() in all_checkin_dates:
            streak += 1
            check_date = check_date - timedelta(days=1)

        # If today not checked, check if yesterday was (streak continues)
        if streak == 0:
            yesterday = user_today - timedelta(days=1)
            if yesterday.isoformat() in all_checkin_dates:
                check_date = yesterday
                while check_date.isoformat() in all_checkin_dates:
                    streak += 1
                    check_date = check_date - timedelta(days=1)

        current_streak = streak

    # Calculate completion rate (last 30 days)
    try:
        thirty_days_ago = user_today - timedelta(days=30)

        # Scheduled check-ins in last 30 days
        scheduled_result = (
            supabase.table("check_ins")
            .select("id")
            .eq("user_id", user_id)
            .gte("date", thirty_days_ago.isoformat())
            .execute()
        )
        scheduled_count = len(scheduled_result.data) if scheduled_result.data else 0

        # Completed check-ins in last 30 days (completed=true)
        completed_result = (
            supabase.table("check_ins")
            .select("id")
            .eq("user_id", user_id)
            .eq("completed", True)
            .gte("date", thirty_days_ago.isoformat())
            .execute()
        )
        completed_count = len(completed_result.data) if completed_result.data else 0

        if scheduled_count > 0:
            completion_rate = round((completed_count / scheduled_count) * 100, 1)
    except Exception as e:
        logger.error(f"Error calculating completion rate: {e}")

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
