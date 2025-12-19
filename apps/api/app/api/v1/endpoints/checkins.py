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
    is_checked_in: Optional[bool] = None  # True when user responds (yes or no)


class CheckInResponse(BaseModel):
    id: str
    goal_id: str
    user_id: str
    date: date
    completed: bool
    reflection: Optional[str]
    mood: Optional[int]
    photo_urls: Optional[List[str]]  # Array of photo URLs
    is_checked_in: Optional[bool] = None  # True when user has responded
    created_at: str
    updated_at: Optional[str] = None  # May not exist in older records
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


async def _get_check_ins_data(
    current_user: dict,
    goal_id: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    page: int = 1,
    limit: int = 20,
):
    """Helper function to get check-ins data"""
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
    return await _get_check_ins_data(
        current_user, goal_id, start_date, end_date, page, limit
    )


@router.post("/", response_model=CheckInResponse, status_code=status.HTTP_201_CREATED)
async def create_check_in(
    checkin_data: CheckInCreate, current_user: dict = Depends(get_current_user)
):
    """Create a new check-in"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Verify goal belongs to user
    goal_result = (
        supabase.table("goals").select("*").eq("id", checkin_data.goal_id).execute()
    )
    if not goal_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    goal = goal_result.data[0]
    is_owner = goal.get("user_id") == current_user["id"]

    if not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this goal",
        )

    # Check if user has already completed a check-in for this goal today
    existing_checkin = (
        supabase.table("check_ins")
        .select("id, completed")
        .eq("goal_id", checkin_data.goal_id)
        .eq("user_id", current_user["id"])
        .eq("date", checkin_data.date.isoformat())
        .execute()
    )

    if existing_checkin.data and len(existing_checkin.data) > 0:
        existing = existing_checkin.data[0]
        if existing.get("completed"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have already completed your check-in for today.",
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

    # Automatically set is_checked_in to True when user responds (yes or no)
    if "completed" in update_data:
        update_data["is_checked_in"] = True

    if update_data:
        # updated_at is handled by database trigger
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
    """Delete a check-in and cleanup associated photos"""
    from app.core.database import get_supabase_client
    from app.core.config import settings
    from app.services.tasks import delete_media_from_r2_task

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

    checkin_data = existing_checkin.data[0]
    photo_urls = checkin_data.get("photo_urls") or []

    # Delete the check-in
    supabase.table("check_ins").delete().eq("id", checkin_id).execute()

    # Queue background tasks to delete photos from R2
    public_url_base = settings.CLOUDFLARE_R2_PUBLIC_URL.rstrip("/")
    for url in photo_urls:
        if url.startswith(public_url_base):
            r2_key = url[len(public_url_base) :].lstrip("/")
            delete_media_from_r2_task.delay(
                file_path=r2_key,
                media_id=f"checkin-delete-{checkin_id}",
            )

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
    goal_id: Optional[str] = Query(None),
):
    """Get check-ins within a date range, optionally filtered by goal_id"""
    return await _get_check_ins_data(current_user, goal_id, start_date, end_date)


@router.get("/today")
async def get_today_check_ins(current_user: dict = Depends(get_current_user)):
    """Get today's check-ins"""
    today = date.today()
    return await _get_check_ins_data(current_user, None, today, today)


@router.get("/streak", response_model=StreakInfo)
async def get_streak_info(
    current_user: dict = Depends(get_current_user),
    goal_id: Optional[str] = Query(None),
):
    """Get streak information - calculates consecutive days with completed check-ins"""
    from app.core.database import get_supabase_client
    from datetime import timedelta

    supabase = get_supabase_client()

    query = (
        supabase.table("check_ins")
        .select("date, completed")
        .eq("user_id", current_user["id"])
        .eq("completed", True)
    )

    if goal_id:
        query = query.eq("goal_id", goal_id)

    result = query.order("date", desc=True).execute()
    check_ins = result.data

    if not check_ins:
        return StreakInfo(
            current_streak=0,
            longest_streak=0,
            last_check_in=None,
            streak_start=None,
        )

    # Get unique dates with completed check-ins (a day counts if any check-in is completed)
    completed_dates = sorted(list({c["date"] for c in check_ins}), reverse=True)

    if not completed_dates:
        return StreakInfo(
            current_streak=0,
            longest_streak=0,
            last_check_in=None,
            streak_start=None,
        )

    last_check_in = completed_dates[0]
    today = date.today()

    # Calculate current streak (consecutive days backwards from today or yesterday)
    current_streak = 0
    streak_start = None

    # Convert to date objects for easier comparison
    completed_date_set = {date.fromisoformat(d) for d in completed_dates}

    # Start from today and count backwards
    check_date = today
    while check_date in completed_date_set:
        current_streak += 1
        streak_start = check_date.isoformat()
        check_date = check_date - timedelta(days=1)

    # If today not checked, check if streak continues from yesterday
    if current_streak == 0:
        check_date = today - timedelta(days=1)
        while check_date in completed_date_set:
            current_streak += 1
            streak_start = check_date.isoformat()
            check_date = check_date - timedelta(days=1)

    # Calculate longest streak (iterate through all dates)
    longest_streak = 0
    if completed_dates:
        # Sort dates oldest first for longest streak calculation
        sorted_dates = sorted([date.fromisoformat(d) for d in completed_dates])
        temp_streak = 1
        longest_streak = 1

        for i in range(1, len(sorted_dates)):
            diff = (sorted_dates[i] - sorted_dates[i - 1]).days
            if diff == 1:
                temp_streak += 1
                longest_streak = max(longest_streak, temp_streak)
            elif diff > 1:
                temp_streak = 1

    # Ensure longest is at least as long as current
    longest_streak = max(longest_streak, current_streak)

    return StreakInfo(
        current_streak=current_streak,
        longest_streak=longest_streak,
        last_check_in=last_check_in,
        streak_start=streak_start,
    )


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
    goal_id: Optional[str] = Query(None),
    days: int = Query(7, ge=1, le=365),
):
    """Get daily mood trends over time - returns array of daily averages"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Get check-ins with mood from the last N days
    start_date = (datetime.now() - timedelta(days=days)).date()

    query = (
        supabase.table("check_ins")
        .select("date, mood")
        .eq("user_id", current_user["id"])
        .gte("date", start_date.isoformat())
        .not_.is_("mood", "null")
    )

    if goal_id:
        query = query.eq("goal_id", goal_id)

    result = query.order("date").execute()

    # Group by day for daily trend analysis
    daily_moods = {}
    for checkin in result.data:
        checkin_date = checkin["date"].split("T")[0]  # Get just the date part

        if checkin_date not in daily_moods:
            daily_moods[checkin_date] = []
        daily_moods[checkin_date].append(checkin["mood"])

    # Calculate daily averages - return as array for mobile compatibility
    daily_averages = []
    for day, moods in sorted(daily_moods.items()):
        daily_averages.append(
            {
                "date": day,
                "average_mood": sum(moods) / len(moods),
                "check_ins_count": len(moods),
            }
        )

    return daily_averages


# Parameterized routes must come AFTER all specific routes
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
