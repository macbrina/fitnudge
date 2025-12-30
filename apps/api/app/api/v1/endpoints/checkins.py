from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date, timedelta
from app.core.flexible_auth import get_current_user
from app.core.entity_validation import validate_entity_is_active

router = APIRouter(
    redirect_slashes=False
)  # Disable redirects to preserve Authorization header


# Valid mood values (consistent with challenge_check_ins structure)
VALID_MOODS = ["great", "good", "okay", "bad", "terrible"]


# Pydantic models for goal check-ins
# Note: Challenge check-ins use a separate endpoint (/challenge-check-ins)
class CheckInCreate(BaseModel):
    goal_id: str  # Required for goal check-ins
    check_in_date: date
    completed: bool = False
    notes: Optional[str] = None
    mood: Optional[str] = None  # Text: great, good, okay, bad, terrible
    photo_url: Optional[str] = None  # Single photo URL


class CheckInUpdate(BaseModel):
    completed: Optional[bool] = None
    notes: Optional[str] = None
    mood: Optional[str] = None  # Text: great, good, okay, bad, terrible
    photo_url: Optional[str] = None  # Single photo URL
    is_checked_in: Optional[bool] = None  # True when user responds (yes or no)


class CheckInResponse(BaseModel):
    id: str
    goal_id: str
    user_id: str
    check_in_date: date
    completed: bool
    notes: Optional[str] = None
    mood: Optional[str] = None  # Text: great, good, okay, bad, terrible
    photo_url: Optional[str] = None  # Single photo URL
    is_checked_in: Optional[bool] = None  # True when user has responded
    created_at: str
    updated_at: Optional[str] = None
    goal: Optional[dict] = None  # Goal info


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
    """Helper function to get goal check-ins data"""
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
        query = query.gte("check_in_date", start_date.isoformat())
    if end_date:
        query = query.lte("check_in_date", end_date.isoformat())

    result = (
        query.order("check_in_date", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

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
    """Create a new check-in for a goal"""
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
    if goal.get("user_id") != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this goal",
        )

    # Validate that the goal is active before allowing check-in
    validate_entity_is_active(goal, "goal", allow_upcoming=False)

    # Check if user has already completed a check-in for this goal today
    existing_checkin = (
        supabase.table("check_ins")
        .select("id, completed")
        .eq("goal_id", checkin_data.goal_id)
        .eq("user_id", current_user["id"])
        .eq("check_in_date", checkin_data.check_in_date.isoformat())
        .execute()
    )

    if existing_checkin.data and len(existing_checkin.data) > 0:
        existing = existing_checkin.data[0]
        if existing.get("completed"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have already completed your check-in for today.",
            )

    # Validate mood if provided
    if checkin_data.mood and checkin_data.mood not in VALID_MOODS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid mood value. Must be one of: {', '.join(VALID_MOODS)}",
        )

    # Build check-in data
    checkin = {
        "goal_id": checkin_data.goal_id,
        "user_id": current_user["id"],
        "check_in_date": checkin_data.check_in_date.isoformat(),
        "completed": checkin_data.completed,
        "notes": checkin_data.notes,
        "mood": checkin_data.mood,
        "photo_url": checkin_data.photo_url,
        "is_checked_in": True,  # User is actively checking in
    }

    # Upsert the check-in
    result = (
        supabase.table("check_ins")
        .upsert(checkin, on_conflict="user_id,goal_id,check_in_date")
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
                source_type="goal",
                source_id=checkin_data.goal_id,
            )

            # Queue challenge progress update (for linked challenges)
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

    existing_record = existing_checkin.data[0]

    # Validate that the goal is active before allowing check-in update
    goal_id = existing_record.get("goal_id")
    if goal_id:
        goal_result = (
            supabase.table("goals").select("id, status").eq("id", goal_id).execute()
        )
        if goal_result.data:
            validate_entity_is_active(goal_result.data[0], "goal", allow_upcoming=False)

    update_data = {k: v for k, v in checkin_data.dict().items() if v is not None}

    # Validate mood if provided
    if "mood" in update_data and update_data["mood"] not in VALID_MOODS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid mood value. Must be one of: {', '.join(VALID_MOODS)}",
        )

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

    record = result.data[0]

    # Trigger achievement check if completed
    if update_data.get("completed"):
        try:
            from app.services.tasks import check_achievements_task

            check_achievements_task.delay(
                user_id=current_user["id"],
                source_type="goal",
                source_id=record.get("goal_id"),
            )
        except Exception as e:
            from app.services.logger import logger

            logger.warning(f"Failed to queue achievement check: {e}")

    return record


@router.delete("/{checkin_id}")
async def delete_check_in(
    checkin_id: str, current_user: dict = Depends(get_current_user)
):
    """Delete a check-in and cleanup associated photo"""
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
    photo_url = checkin_data.get("photo_url")

    # Delete the check-in
    supabase.table("check_ins").delete().eq("id", checkin_id).execute()

    # Queue background task to delete photo from R2 if exists
    if photo_url:
        public_url_base = settings.CLOUDFLARE_R2_PUBLIC_URL.rstrip("/")
        if photo_url.startswith(public_url_base):
            r2_key = photo_url[len(public_url_base) :].lstrip("/")
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
    """Get goal check-in statistics"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    query = supabase.table("check_ins").select("*").eq("user_id", current_user["id"])

    if goal_id:
        query = query.eq("goal_id", goal_id)
    if start_date:
        query = query.gte("check_in_date", start_date.isoformat())
    if end_date:
        query = query.lte("check_in_date", end_date.isoformat())

    result = query.execute()
    check_ins = result.data

    total_check_ins = len(check_ins)
    completed_check_ins = len([c for c in check_ins if c["completed"]])
    completion_rate = (
        (completed_check_ins / total_check_ins * 100) if total_check_ins > 0 else 0
    )

    # Calculate streaks
    sorted_checkins = sorted(check_ins, key=lambda x: x["check_in_date"], reverse=True)
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

    # Calculate mood stats - mood is now text-based
    # Map text moods to numeric values for averaging
    mood_value_map = {"great": 5, "good": 4, "okay": 3, "bad": 2, "terrible": 1}
    mood_checkins = [c for c in check_ins if c.get("mood") in mood_value_map]
    average_mood = (
        sum(mood_value_map[c["mood"]] for c in mood_checkins) / len(mood_checkins)
        if mood_checkins
        else None
    )

    # Mood trend (last 30 days)
    thirty_days_ago = (datetime.now() - timedelta(days=30)).date()
    recent_mood_checkins = [
        c
        for c in mood_checkins
        if datetime.fromisoformat(c["check_in_date"]).date() >= thirty_days_ago
    ]
    mood_trend = [
        {
            "date": c["check_in_date"],
            "mood": c["mood"],
            "mood_value": mood_value_map.get(c["mood"]),
        }
        for c in sorted(recent_mood_checkins, key=lambda x: x["check_in_date"])
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
    """Get goal check-ins in calendar format"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Default to current month if not specified
    if not year or not month:
        now = datetime.now()
        year = now.year
        month = now.month

    # Get first and last day of month
    start_date_val = date(year, month, 1)
    if month == 12:
        end_date_val = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date_val = date(year, month + 1, 1) - timedelta(days=1)

    result = (
        supabase.table("check_ins")
        .select("check_in_date, completed, mood, goal_id, goal:goals(title)")
        .eq("user_id", current_user["id"])
        .gte("check_in_date", start_date_val.isoformat())
        .lte("check_in_date", end_date_val.isoformat())
        .execute()
    )

    # Group by date
    calendar_data = {}
    for checkin in result.data:
        checkin_date = checkin["check_in_date"]
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
    """Get streak information from cached goal_statistics or user_stats_cache tables"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    if goal_id:
        # Get streak from goal_statistics table (cached per-goal stats)
        result = (
            supabase.table("goal_statistics")
            .select(
                "current_streak, longest_streak, last_checkin_date, streak_start_date"
            )
            .eq("goal_id", goal_id)
            .maybe_single()
            .execute()
        )

        if result.data:
            return StreakInfo(
                current_streak=result.data.get("current_streak", 0),
                longest_streak=result.data.get("longest_streak", 0),
                last_check_in=result.data.get("last_checkin_date"),
                streak_start=result.data.get("streak_start_date"),
            )
        else:
            # No stats yet for this goal
            return StreakInfo(
                current_streak=0,
                longest_streak=0,
                last_check_in=None,
                streak_start=None,
            )
    else:
        # Get overall user streak from user_stats_cache table
        result = (
            supabase.table("user_stats_cache")
            .select("current_streak, longest_streak, last_checkin_date")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )

        if result.data:
            return StreakInfo(
                current_streak=result.data.get("current_streak", 0),
                longest_streak=result.data.get("longest_streak", 0),
                last_check_in=result.data.get("last_checkin_date"),
                streak_start=None,  # user_stats_cache doesn't have streak_start
            )
        else:
            # No stats yet for this user
            return StreakInfo(
                current_streak=0,
                longest_streak=0,
                last_check_in=None,
                streak_start=None,
            )


@router.post("/bulk", status_code=status.HTTP_201_CREATED)
async def bulk_create_check_ins(
    bulk_data: BulkCheckInCreate, current_user: dict = Depends(get_current_user)
):
    """Create multiple goal check-ins at once"""
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
                "check_in_date": checkin_data.check_in_date.isoformat(),
                "completed": checkin_data.completed,
                "notes": checkin_data.notes,
                "mood": checkin_data.mood,
                "is_checked_in": True,
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
    start_date_val = (datetime.now() - timedelta(days=days)).date()

    query = (
        supabase.table("check_ins")
        .select("check_in_date, mood")
        .eq("user_id", current_user["id"])
        .gte("check_in_date", start_date_val.isoformat())
        .not_.is_("mood", "null")
    )

    if goal_id:
        query = query.eq("goal_id", goal_id)

    result = query.order("check_in_date").execute()

    # Map text moods to numeric values for averaging
    mood_value_map = {"great": 5, "good": 4, "okay": 3, "bad": 2, "terrible": 1}

    # Group by day for daily trend analysis
    daily_moods = {}
    for checkin in result.data:
        checkin_date = checkin["check_in_date"].split("T")[0]  # Get just the date part
        mood_value = mood_value_map.get(checkin["mood"])
        if mood_value:
            if checkin_date not in daily_moods:
                daily_moods[checkin_date] = []
            daily_moods[checkin_date].append(mood_value)

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
