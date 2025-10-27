from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import date
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()


# Pydantic models
class GoalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str
    frequency: str
    target_days: Optional[int] = None
    reminder_times: Optional[List[str]] = None


class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    frequency: Optional[str] = None
    target_days: Optional[int] = None
    reminder_times: Optional[List[str]] = None
    is_active: Optional[bool] = None


class GoalResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    category: str
    frequency: str
    target_days: Optional[int]
    reminder_times: Optional[List[str]]
    is_active: bool
    created_at: str
    updated_at: str


class CheckInCreate(BaseModel):
    goal_id: str
    date: date
    completed: bool
    reflection: Optional[str] = None
    mood: Optional[int] = None


class CheckInResponse(BaseModel):
    id: str
    goal_id: str
    date: date
    completed: bool
    reflection: Optional[str]
    mood: Optional[int]
    created_at: str


@router.get("/", response_model=List[GoalResponse])
async def get_goals(
    current_user: dict = Depends(get_current_user),
    active_only: bool = Query(True, description="Filter active goals only"),
):
    """Get user's goals"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    query = supabase.table("goals").select("*").eq("user_id", current_user["id"])

    if active_only:
        query = query.eq("is_active", True)

    result = query.order("created_at", desc=True).execute()
    return result.data


@router.post("/", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
async def create_goal(
    goal_data: GoalCreate, current_user: dict = Depends(get_current_user)
):
    """Create a new goal"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Check if user has reached goal limit (Free users: 1 goal)
    if current_user["plan"] == "free":
        existing_goals = (
            supabase.table("goals")
            .select("id")
            .eq("user_id", current_user["id"])
            .eq("is_active", True)
            .execute()
        )
        if len(existing_goals.data) >= 1:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Free plan allows only 1 active goal. Upgrade to Pro for unlimited goals.",
            )

    goal = {
        "user_id": current_user["id"],
        "title": goal_data.title,
        "description": goal_data.description,
        "category": goal_data.category,
        "frequency": goal_data.frequency,
        "target_days": goal_data.target_days,
        "reminder_times": goal_data.reminder_times or [],
        "is_active": True,
    }

    result = supabase.table("goals").insert(goal).execute()
    return result.data[0]


@router.get("/{goal_id}", response_model=GoalResponse)
async def get_goal(goal_id: str, current_user: dict = Depends(get_current_user)):
    """Get specific goal by ID"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    result = (
        supabase.table("goals")
        .select("*")
        .eq("id", goal_id)
        .eq("user_id", current_user["id"])
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    return result.data[0]


@router.put("/{goal_id}", response_model=GoalResponse)
async def update_goal(
    goal_id: str, goal_data: GoalUpdate, current_user: dict = Depends(get_current_user)
):
    """Update goal"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Check if goal exists and belongs to user
    existing_goal = (
        supabase.table("goals")
        .select("*")
        .eq("id", goal_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not existing_goal.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    update_data = {k: v for k, v in goal_data.dict().items() if v is not None}
    result = supabase.table("goals").update(update_data).eq("id", goal_id).execute()

    return result.data[0]


@router.delete("/{goal_id}")
async def delete_goal(goal_id: str, current_user: dict = Depends(get_current_user)):
    """Delete goal"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Check if goal exists and belongs to user
    existing_goal = (
        supabase.table("goals")
        .select("*")
        .eq("id", goal_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not existing_goal.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    supabase.table("goals").delete().eq("id", goal_id).execute()
    return {"message": "Goal deleted successfully"}


@router.post(
    "/{goal_id}/checkin",
    response_model=CheckInResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_checkin(
    goal_id: str,
    checkin_data: CheckInCreate,
    current_user: dict = Depends(get_current_user),
):
    """Record daily check-in for a goal"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Verify goal belongs to user
    goal = (
        supabase.table("goals")
        .select("*")
        .eq("id", goal_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not goal.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    checkin = {
        "goal_id": goal_id,
        "user_id": current_user["id"],
        "date": checkin_data.date.isoformat(),
        "completed": checkin_data.completed,
        "reflection": checkin_data.reflection,
        "mood": checkin_data.mood,
    }

    result = (
        supabase.table("check_ins")
        .upsert(checkin, on_conflict="goal_id,date")
        .execute()
    )
    return result.data[0]


@router.get("/{goal_id}/checkins", response_model=List[CheckInResponse])
async def get_goal_checkins(
    goal_id: str,
    current_user: dict = Depends(get_current_user),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
):
    """Get check-ins for a specific goal"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Verify goal belongs to user
    goal = (
        supabase.table("goals")
        .select("*")
        .eq("id", goal_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not goal.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    query = supabase.table("check_ins").select("*").eq("goal_id", goal_id)

    if start_date:
        query = query.gte("date", start_date.isoformat())
    if end_date:
        query = query.lte("date", end_date.isoformat())

    result = query.order("date", desc=True).execute()
    return result.data


@router.get("/templates/")
async def get_goal_templates():
    """Get available goal templates"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    result = (
        supabase.table("goal_templates").select("*").eq("is_premium", False).execute()
    )
    return result.data
