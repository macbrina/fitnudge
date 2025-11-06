from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date, timedelta
from app.core.flexible_auth import get_current_user

router = APIRouter(
    redirect_slashes=False
)  # Disable redirects to preserve Authorization header


# Pydantic models
class CheckInCreate(BaseModel):
    goal_id: str
    date: date
    completed: bool
    reflection: Optional[str] = None
    mood: Optional[int] = None  # 1-5 scale
    photo_urls: Optional[List[str]] = None  # Array of photo URLs


class CheckInUpdate(BaseModel):
    completed: Optional[bool] = None
    reflection: Optional[str] = None
    mood: Optional[int] = None
    photo_urls: Optional[List[str]] = None  # Array of photo URLs


class CheckInResponse(BaseModel):
    id: str
    goal_id: str
    user_id: str
    date: date
    completed: bool
    reflection: Optional[str]
    mood: Optional[int]
    photo_urls: Optional[List[str]]  # Array of photo URLs
    created_at: str
    updated_at: str
    goal: dict  # Goal info


class CheckInStats(BaseModel):
    total_check_ins: int
    completed_check_ins: int
    completion_rate: float
    current_streak: int
    longest_streak: int
    average_mood: Optional[float]
    mood_trend: List[dict]


class StreakInfo(BaseModel):
    current_streak: int
    longest_streak: int
    last_check_in: Optional[date]
    streak_start: Optional[date]


class BulkCheckInCreate(BaseModel):
    goal_id: str
    check_ins: List[CheckInCreate]


@router.get("/", response_model=List[CheckInResponse])
async def get_check_ins(
    current_user: dict = Depends(get_current_user),
    goal_id: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """Get user's check-ins with optional filtering"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    offset = (page - 1) * limit

    query = (
        supabase.table("check_ins")
        .select(
            """
        *,
        goal:goals(id, title, category, frequency)
        """
        )
        .eq("user_id", current_user["id"])
    )

    if goal_id:
        query = query.eq("goal_id", goal_id)
    if start_date:
        query = query.gte("date", start_date.isoformat())
    if end_date:
        query = query.lte("date", end_date.isoformat())

    result = query.order("date", desc=True).range(offset, offset + limit - 1).execute()

    return result.data


@router.get("/{checkin_id}", response_model=CheckInResponse)
async def get_check_in(checkin_id: str, current_user: dict = Depends(get_current_user)):
    """Get specific check-in by ID"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    result = (
        supabase.table("check_ins")
        .select(
            """
        *,
        goal:goals(id, title, category, frequency)
        """
        )
        .eq("id", checkin_id)
        .eq("user_id", current_user["id"])
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Check-in not found"
        )

    return result.data[0]


@router.post("/", response_model=CheckInResponse, status_code=status.HTTP_201_CREATED)
async def create_check_in(
    checkin_data: CheckInCreate, current_user: dict = Depends(get_current_user)
):
    """Create a new check-in"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Verify goal belongs to user
    goal = (
        supabase.table("goals")
        .select("*")
        .eq("id", checkin_data.goal_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not goal.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    checkin = {
        "goal_id": checkin_data.goal_id,
        "user_id": current_user["id"],
        "date": checkin_data.date.isoformat(),
        "completed": checkin_data.completed,
        "reflection": checkin_data.reflection,
        "mood": checkin_data.mood,
        "photo_urls": checkin_data.photo_urls or [],
    }

    result = (
        supabase.table("check_ins")
        .upsert(checkin, on_conflict="goal_id,date,user_id")
        .execute()
    )

    # Get the created check-in with goal info
    created_checkin = (
        supabase.table("check_ins")
        .select(
            """
        *,
        goal:goals(id, title, category, frequency)
        """
        )
        .eq("id", result.data[0]["id"])
        .execute()
    )

    check_in_record = created_checkin.data[0]

    # Check and unlock achievements in background (non-blocking)
    if checkin_data.completed:  # Only check achievements for completed check-ins
        try:
            from app.services.tasks import (
                check_achievements_task,
                update_challenge_progress_task,
            )

            # Queue achievement check as Celery task (non-blocking)
            check_achievements_task.delay(
                user_id=current_user["id"],
                goal_id=checkin_data.goal_id,
            )

            # Queue challenge progress update as Celery task (non-blocking)
            update_challenge_progress_task.delay(
                user_id=current_user["id"],
                goal_id=checkin_data.goal_id,
            )
        except Exception as e:
            # Log error but don't fail check-in creation
            from app.services.logger import logger

            logger.warning(
                f"Failed to queue achievement/challenge tasks: {e}",
                {"user_id": current_user["id"], "goal_id": checkin_data.goal_id},
            )

    return check_in_record


@router.put("/{checkin_id}", response_model=CheckInResponse)
async def update_check_in(
    checkin_id: str,
    checkin_data: CheckInUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update a check-in"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Check if check-in exists and belongs to user
    existing_checkin = (
        supabase.table("check_ins")
        .select("*")
        .eq("id", checkin_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not existing_checkin.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Check-in not found"
        )

    update_data = {k: v for k, v in checkin_data.dict().items() if v is not None}
    if update_data:
        supabase.table("check_ins").update(update_data).eq("id", checkin_id).execute()

    # Get updated check-in with goal info
    result = (
        supabase.table("check_ins")
        .select(
            """
        *,
        goal:goals(id, title, category, frequency)
        """
        )
        .eq("id", checkin_id)
        .execute()
    )

    return result.data[0]


@router.delete("/{checkin_id}")
async def delete_check_in(
    checkin_id: str, current_user: dict = Depends(get_current_user)
):
    """Delete a check-in"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Check if check-in exists and belongs to user
    existing_checkin = (
        supabase.table("check_ins")
        .select("*")
        .eq("id", checkin_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not existing_checkin.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Check-in not found"
        )

    supabase.table("check_ins").delete().eq("id", checkin_id).execute()
    return {"message": "Check-in deleted successfully"}


@router.get("/stats", response_model=CheckInStats)
async def get_check_in_stats(
    current_user: dict = Depends(get_current_user),
    goal_id: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
):
    """Get check-in statistics"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    query = supabase.table("check_ins").select("*").eq("user_id", current_user["id"])

    if goal_id:
        query = query.eq("goal_id", goal_id)
    if start_date:
        query = query.gte("date", start_date.isoformat())
    if end_date:
        query = query.lte("date", end_date.isoformat())

    result = query.execute()
    check_ins = result.data

    total_check_ins = len(check_ins)
    completed_check_ins = len([c for c in check_ins if c["completed"]])
    completion_rate = (
        (completed_check_ins / total_check_ins * 100) if total_check_ins > 0 else 0
    )

    # Calculate streaks
    sorted_checkins = sorted(check_ins, key=lambda x: x["date"], reverse=True)
    current_streak = 0
    longest_streak = 0
    temp_streak = 0

    for checkin in sorted_checkins:
        if checkin["completed"]:
            temp_streak += 1
            if current_streak == 0:  # First streak calculation
                current_streak = temp_streak
        else:
            longest_streak = max(longest_streak, temp_streak)
            temp_streak = 0

    longest_streak = max(longest_streak, temp_streak)

    # Calculate mood stats
    mood_checkins = [c for c in check_ins if c["mood"] is not None]
    average_mood = (
        sum(c["mood"] for c in mood_checkins) / len(mood_checkins)
        if mood_checkins
        else None
    )

    # Mood trend (last 30 days)
    thirty_days_ago = (datetime.now() - timedelta(days=30)).date()
    recent_mood_checkins = [
        c
        for c in mood_checkins
        if datetime.fromisoformat(c["date"]).date() >= thirty_days_ago
    ]
    mood_trend = [
        {"date": c["date"], "mood": c["mood"]}
        for c in sorted(recent_mood_checkins, key=lambda x: x["date"])
    ]

    return CheckInStats(
        total_check_ins=total_check_ins,
        completed_check_ins=completed_check_ins,
        completion_rate=completion_rate,
        current_streak=current_streak,
        longest_streak=longest_streak,
        average_mood=average_mood,
        mood_trend=mood_trend,
    )


@router.get("/stats", response_model=CheckInStats)
async def get_check_in_stats_by_goal(
    goal_id: str, current_user: dict = Depends(get_current_user)
):
    """Get check-in statistics for a specific goal"""
    return await get_check_in_stats(current_user, goal_id)


@router.get("/calendar")
async def get_check_in_calendar(
    current_user: dict = Depends(get_current_user),
    year: int = Query(None),
    month: int = Query(None),
):
    """Get check-ins in calendar format"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Default to current month if not specified
    if not year or not month:
        now = datetime.now()
        year = now.year
        month = now.month

    # Get first and last day of month
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = date(year, month + 1, 1) - timedelta(days=1)

    result = (
        supabase.table("check_ins")
        .select("date, completed, mood, goal_id, goal:goals(title)")
        .eq("user_id", current_user["id"])
        .gte("date", start_date.isoformat())
        .lte("date", end_date.isoformat())
        .execute()
    )

    # Group by date
    calendar_data = {}
    for checkin in result.data:
        checkin_date = checkin["date"]
        if checkin_date not in calendar_data:
            calendar_data[checkin_date] = []
        calendar_data[checkin_date].append(checkin)

    return calendar_data


@router.get("/range")
async def get_check_ins_by_date_range(
    current_user: dict = Depends(get_current_user),
    start_date: date = Query(...),
    end_date: date = Query(...),
):
    """Get check-ins within a date range"""
    return await get_check_ins(current_user, None, start_date, end_date)


@router.get("/today")
async def get_today_check_ins(current_user: dict = Depends(get_current_user)):
    """Get today's check-ins"""
    today = date.today()
    return await get_check_ins(current_user, None, today, today)


@router.get("/streak", response_model=StreakInfo)
async def get_streak_info(
    current_user: dict = Depends(get_current_user),
    goal_id: Optional[str] = Query(None),
):
    """Get streak information"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    query = supabase.table("check_ins").select("*").eq("user_id", current_user["id"])

    if goal_id:
        query = query.eq("goal_id", goal_id)

    result = query.order("date", desc=True).execute()
    check_ins = result.data

    # Calculate streaks
    current_streak = 0
    longest_streak = 0
    temp_streak = 0
    last_check_in = None
    streak_start = None

    for checkin in check_ins:
        if checkin["completed"]:
            temp_streak += 1
            if current_streak == 0:  # First streak calculation
                current_streak = temp_streak
                last_check_in = checkin["date"]
                streak_start = checkin["date"]
        else:
            longest_streak = max(longest_streak, temp_streak)
            temp_streak = 0

    longest_streak = max(longest_streak, temp_streak)

    return StreakInfo(
        current_streak=current_streak,
        longest_streak=longest_streak,
        last_check_in=last_check_in,
        streak_start=streak_start,
    )


@router.get("/streak", response_model=StreakInfo)
async def get_streak_info_by_goal(
    goal_id: str, current_user: dict = Depends(get_current_user)
):
    """Get streak information for a specific goal"""
    return await get_streak_info(current_user, goal_id)


@router.post("/bulk", status_code=status.HTTP_201_CREATED)
async def bulk_create_check_ins(
    bulk_data: BulkCheckInCreate, current_user: dict = Depends(get_current_user)
):
    """Create multiple check-ins at once"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Verify goal belongs to user
    goal = (
        supabase.table("goals")
        .select("*")
        .eq("id", bulk_data.goal_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not goal.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    # Prepare check-ins data
    check_ins = []
    for checkin_data in bulk_data.check_ins:
        check_ins.append(
            {
                "goal_id": bulk_data.goal_id,
                "user_id": current_user["id"],
                "date": checkin_data.date.isoformat(),
                "completed": checkin_data.completed,
                "reflection": checkin_data.reflection,
                "mood": checkin_data.mood,
            }
        )

    # Insert all check-ins
    result = supabase.table("check_ins").insert(check_ins).execute()

    return {"message": f"Created {len(result.data)} check-ins successfully"}


@router.get("/mood-trends")
async def get_mood_trends(
    current_user: dict = Depends(get_current_user),
    days: int = Query(30, ge=7, le=365),
):
    """Get mood trends over time"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Get check-ins with mood from the last N days
    start_date = (datetime.now() - timedelta(days=days)).date()

    result = (
        supabase.table("check_ins")
        .select("date, mood")
        .eq("user_id", current_user["id"])
        .gte("date", start_date.isoformat())
        .not_.is_("mood", "null")
        .order("date")
        .execute()
    )

    # Group by week for trend analysis
    mood_trends = {}
    for checkin in result.data:
        checkin_date = datetime.fromisoformat(checkin["date"]).date()
        week_start = checkin_date - timedelta(days=checkin_date.weekday())
        week_key = week_start.isoformat()

        if week_key not in mood_trends:
            mood_trends[week_key] = []
        mood_trends[week_key].append(checkin["mood"])

    # Calculate weekly averages
    weekly_averages = []
    for week, moods in mood_trends.items():
        weekly_averages.append(
            {
                "week": week,
                "average_mood": sum(moods) / len(moods),
                "count": len(moods),
            }
        )

    return {
        "period_days": days,
        "weekly_averages": weekly_averages,
        "overall_average": (
            sum(c["mood"] for c in result.data) / len(result.data) if result.data else 0
        ),
    }
