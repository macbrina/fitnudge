from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import date
from app.core.flexible_auth import get_current_user
from app.services.logger import logger

router = APIRouter(
    redirect_slashes=False
)  # Disable redirects to preserve Authorization header


def get_user_goal_limit(user_plan: str, supabase) -> Optional[int]:
    """
    Get total goal limit for user's plan from subscription_plans table.
    Returns None if unlimited, or integer for limit.
    """
    try:
        plan_result = (
            supabase.table("subscription_plans")
            .select("goal_limit")
            .eq("id", user_plan)
            .eq("is_active", True)
            .execute()
        )

        if plan_result.data and len(plan_result.data) > 0:
            return plan_result.data[0].get("goal_limit")

        logger.warning(
            f"Plan {user_plan} not found in subscription_plans, using defaults"
        )
        return None
    except Exception as e:
        logger.error(f"Error getting goal limit for plan {user_plan}: {e}")
        return None


def get_user_active_goal_limit(user_plan: str, supabase) -> int:
    """
    Get active goal limit for user's plan from subscription_plans table.
    Returns integer for active goal limit (defaults to 1 if not found).
    This determines how many goals can be active simultaneously.
    """
    try:
        plan_result = (
            supabase.table("subscription_plans")
            .select("active_goal_limit")
            .eq("id", user_plan)
            .eq("is_active", True)
            .execute()
        )

        if plan_result.data and len(plan_result.data) > 0:
            active_limit = plan_result.data[0].get("active_goal_limit")
            if active_limit is not None:
                return active_limit

        logger.warning(
            f"Active goal limit not found for plan {user_plan}, defaulting to 1"
        )
        return 1
    except Exception as e:
        logger.error(f"Error getting active goal limit for plan {user_plan}: {e}")
        return 1  # Safe default: 1 active goal


# Pydantic models
class GoalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str
    frequency: str
    target_days: Optional[int] = None
    reminder_times: Optional[List[str]] = None
    custom_reminder_message: Optional[str] = None  # Custom message for reminders


class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    frequency: Optional[str] = None
    target_days: Optional[int] = None
    reminder_times: Optional[List[str]] = None
    is_active: Optional[bool] = None
    custom_reminder_message: Optional[str] = None  # Custom message for reminders


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
    goal_data: GoalCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Create a new goal.
    Users can create multiple goals based on their plan limit.
    Goals can be activated up to the active goal limit for their plan.
    New goals are activated automatically if user has room within their active goal limit.
    """
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]
    user_plan = current_user["plan"]

    # Get goal limit from subscription_plans table
    goal_limit = get_user_goal_limit(user_plan, supabase)

    # Check total goals count (not just active ones)
    existing_goals = (
        supabase.table("goals").select("id").eq("user_id", user_id).execute()
    )

    total_goals = len(existing_goals.data) if existing_goals.data else 0

    # Check if user has reached goal limit
    if goal_limit is not None and total_goals >= goal_limit:
        plan_name = user_plan.capitalize()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{plan_name} plan allows only {goal_limit} goal(s). Upgrade to create more goals.",
        )

    # Get active goal limit for user's plan (dynamically from database)
    active_goal_limit = get_user_active_goal_limit(user_plan, supabase)

    # Check current active goals count
    active_goals = (
        supabase.table("goals")
        .select("id")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
    )

    current_active_count = len(active_goals.data) if active_goals.data else 0

    # Determine if new goal should be activated
    # Activate if user has room for more active goals (within limit)
    should_activate = current_active_count < active_goal_limit

    goal = {
        "user_id": user_id,
        "title": goal_data.title,
        "description": goal_data.description,
        "category": goal_data.category,
        "frequency": goal_data.frequency,
        "target_days": goal_data.target_days,
        "reminder_times": goal_data.reminder_times or [],
        "custom_reminder_message": goal_data.custom_reminder_message,
        "is_active": should_activate,
    }

    result = supabase.table("goals").insert(goal).execute()

    goal_id = result.data[0]["id"] if result.data else None

    if goal_id:
        # Queue plan generation in background
        from app.services.task_queue import task_queue

        # Get user's fitness profile if available for personalization
        profile_result = (
            supabase.table("user_fitness_profiles")
            .select("*")
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        user_profile = profile_result.data if profile_result.data else None

        # Prepare goal data for plan generator
        goal_for_plan = {
            "id": goal_id,
            "title": goal_data.title,
            "description": goal_data.description or "",
            "category": goal_data.category,
            "frequency": goal_data.frequency,
            "target_days": goal_data.target_days,
        }

        # Print all data in JSON format for manual debugging if needed
        import json

        debug_data = {
            "goal_id": goal_id,
            "goal_data": goal_for_plan,
            "user_profile": user_profile,
        }
        print("=" * 80)
        print("QUEUE_PLAN_GENERATION DEBUG DATA (JSON):")
        print("=" * 80)
        print(json.dumps(debug_data, indent=2, default=str))
        print("=" * 80)
        logger.info(
            f"Queue plan generation data for goal {goal_id}",
            {
                "goal_id": goal_id,
                "goal_data": goal_for_plan,
                "has_profile": bool(user_profile),
            },
        )

        # Queue the plan generation task (Celery handles it now)
        await task_queue.queue_plan_generation(
            goal_id=goal_id,
            goal_data=goal_for_plan,
            user_profile=user_profile,
        )

    logger.info(
        f"Goal created for user {user_id}",
        {
            "goal_id": goal_id,
            "is_active": should_activate,
            "total_goals": total_goals + 1,
        },
    )

    return result.data[0]


@router.get("/{goal_id}/plan-status")
async def get_goal_plan_status(
    goal_id: str, current_user: dict = Depends(get_current_user)
):
    """Get the status of plan generation for a goal"""
    from app.core.database import get_supabase_client
    from app.services.task_queue import task_queue

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Verify goal belongs to user
    goal_result = (
        supabase.table("goals")
        .select("id")
        .eq("id", goal_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )

    if not goal_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found",
        )

    plan_status = await task_queue.get_plan_status(goal_id)

    if not plan_status:
        return {
            "goal_id": goal_id,
            "status": "not_started",
            "message": "Plan generation not yet started",
        }

    return {
        "goal_id": goal_id,
        "status": plan_status.get("status", "unknown"),
        "plan_type": plan_status.get("plan_type"),
        "error_message": plan_status.get("error_message"),
        "generated_at": plan_status.get("generated_at"),
    }


@router.get("/{goal_id}/plan")
async def get_goal_plan(goal_id: str, current_user: dict = Depends(get_current_user)):
    """Get the generated actionable plan for a goal"""
    from app.core.database import get_supabase_client
    from app.services.task_queue import task_queue

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Verify goal belongs to user
    goal_result = (
        supabase.table("goals")
        .select("id")
        .eq("id", goal_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )

    if not goal_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found",
        )

    plan = await task_queue.get_plan(goal_id)

    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found or not yet generated",
        )

    return {
        "goal_id": goal_id,
        "plan_type": plan.get("plan_type"),
        "structured_data": plan.get("structured_data", {}),
        "generated_at": plan.get("generated_at"),
    }


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
    """
    Update goal.
    If activating a goal (is_active=True), all other goals are deactivated.
    """
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Check if goal exists and belongs to user
    existing_goal = (
        supabase.table("goals")
        .select("*")
        .eq("id", goal_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not existing_goal.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    update_data = {k: v for k, v in goal_data.dict().items() if v is not None}

    user_plan = current_user["plan"]
    active_goal_limit = get_user_active_goal_limit(user_plan, supabase)

    # If activating this goal, check active goal limit
    if update_data.get("is_active") is True:
        # Get current active goals (excluding this one)
        active_goals = (
            supabase.table("goals")
            .select("id")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .neq("id", goal_id)
            .execute()
        )

        current_active_count = len(active_goals.data) if active_goals.data else 0

        # Check if user has reached active goal limit
        if current_active_count >= active_goal_limit:
            plan_name = user_plan.capitalize()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"{plan_name} plan allows only {active_goal_limit} active goal(s). Deactivate another goal first.",
            )

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
    result = supabase.table("goal_templates").select("*").execute()
    return result.data


@router.post("/{goal_id}/archive")
async def archive_goal(goal_id: str, current_user: dict = Depends(get_current_user)):
    """
    Archive a goal (sets is_active to False).
    If this was the active goal and user has other goals, you may want to activate another one.
    """
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Check if goal exists and belongs to user
    existing_goal = (
        supabase.table("goals")
        .select("*")
        .eq("id", goal_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not existing_goal.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    # Check if this was the active goal
    was_active = existing_goal.data[0].get("is_active", False)

    # Archive goal (set is_active to False)
    supabase.table("goals").update({"is_active": False}).eq("id", goal_id).execute()

    # Note: We don't auto-activate other goals anymore
    # Users can manually activate goals up to their active goal limit
    if was_active:
        logger.info(
            f"Goal {goal_id} archived (was active). User can manually activate other goals."
        )

    return {"message": "Goal archived successfully"}


@router.post("/{goal_id}/unarchive")
async def unarchive_goal(goal_id: str, current_user: dict = Depends(get_current_user)):
    """Unarchive a goal (sets is_active to True if within active goal limit)"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Check if goal exists and belongs to user
    existing_goal = (
        supabase.table("goals")
        .select("*")
        .eq("id", goal_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not existing_goal.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    user_plan = current_user["plan"]
    active_goal_limit = get_user_active_goal_limit(user_plan, supabase)

    # Get current active goals (excluding this one)
    active_goals = (
        supabase.table("goals")
        .select("id")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .neq("id", goal_id)
        .execute()
    )

    current_active_count = len(active_goals.data) if active_goals.data else 0

    # Check if user has reached active goal limit
    if current_active_count >= active_goal_limit:
        plan_name = user_plan.capitalize()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{plan_name} plan allows only {active_goal_limit} active goal(s). Deactivate another goal first.",
        )

    # Activate this goal
    supabase.table("goals").update({"is_active": True}).eq("id", goal_id).execute()

    return {"message": "Goal unarchived and activated successfully"}


@router.post("/{goal_id}/activate")
async def activate_goal(goal_id: str, current_user: dict = Depends(get_current_user)):
    """
    Activate a goal.
    Checks active goal limit from user's plan dynamically.
    Only activates if user has not reached their active goal limit.
    """
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]
    user_plan = current_user["plan"]

    # Check if goal exists and belongs to user
    existing_goal = (
        supabase.table("goals")
        .select("*")
        .eq("id", goal_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not existing_goal.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    # Check if goal is already active
    if existing_goal.data[0].get("is_active", False):
        return {"message": "Goal is already active", "goal": existing_goal.data[0]}

    # Get active goal limit for user's plan (dynamically from database)
    active_goal_limit = get_user_active_goal_limit(user_plan, supabase)

    # Get current active goals (excluding this one)
    active_goals = (
        supabase.table("goals")
        .select("id")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .neq("id", goal_id)
        .execute()
    )

    current_active_count = len(active_goals.data) if active_goals.data else 0

    # Check if user has reached active goal limit
    if current_active_count >= active_goal_limit:
        plan_name = user_plan.capitalize()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{plan_name} plan allows only {active_goal_limit} active goal(s). Deactivate another goal first.",
        )

    # Activate this goal (no need to deactivate others - we allow multiple active goals)
    result = (
        supabase.table("goals").update({"is_active": True}).eq("id", goal_id).execute()
    )

    if result.data:
        logger.info(
            f"Goal {goal_id} activated for user {user_id} ({current_active_count + 1}/{active_goal_limit} active)"
        )
        return {"message": "Goal activated successfully", "goal": result.data[0]}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to activate goal",
        )


@router.post("/{goal_id}/duplicate")
async def duplicate_goal(goal_id: str, current_user: dict = Depends(get_current_user)):
    """Duplicate a goal"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Get original goal
    original_goal = (
        supabase.table("goals")
        .select("*")
        .eq("id", goal_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not original_goal.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    goal_data = original_goal.data[0]

    # Create duplicate
    duplicate_goal = {
        "user_id": current_user["id"],
        "title": f"{goal_data['title']} (Copy)",
        "description": goal_data["description"],
        "category": goal_data["category"],
        "frequency": goal_data["frequency"],
        "target_days": goal_data["target_days"],
        "reminder_times": goal_data["reminder_times"],
        "is_active": True,
    }

    result = supabase.table("goals").insert(duplicate_goal).execute()
    return result.data[0]


@router.get("/{goal_id}/stats")
async def get_goal_stats(goal_id: str, current_user: dict = Depends(get_current_user)):
    """Get statistics for a specific goal"""
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

    # Get check-ins for this goal
    checkins_result = (
        supabase.table("check_ins").select("*").eq("goal_id", goal_id).execute()
    )

    checkins = checkins_result.data
    total_check_ins = len(checkins)
    completed_check_ins = len([c for c in checkins if c["completed"]])
    completion_rate = (
        (completed_check_ins / total_check_ins * 100) if total_check_ins > 0 else 0
    )

    # Calculate current streak
    sorted_checkins = sorted(checkins, key=lambda x: x["date"], reverse=True)
    current_streak = 0
    for checkin in sorted_checkins:
        if checkin["completed"]:
            current_streak += 1
        else:
            break

    # Calculate longest streak
    longest_streak = 0
    temp_streak = 0
    for checkin in sorted_checkins:
        if checkin["completed"]:
            temp_streak += 1
            longest_streak = max(longest_streak, temp_streak)
        else:
            temp_streak = 0

    return {
        "goal_id": goal_id,
        "total_check_ins": total_check_ins,
        "completed_check_ins": completed_check_ins,
        "completion_rate": completion_rate,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "goal_created": goal.data[0]["created_at"],
    }


@router.get("/{goal_id}/habit-chains")
async def get_goal_habit_chains(
    goal_id: str,
    current_user: dict = Depends(get_current_user),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
):
    """Get habit chain data for visualization"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Verify goal belongs to user
    goal = (
        supabase.table("goals")
        .select("id")
        .eq("id", goal_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not goal.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    # Get habit chains
    query = (
        supabase.table("habit_chains")
        .select("*")
        .eq("goal_id", goal_id)
        .eq("user_id", current_user["id"])
    )

    if start_date:
        query = query.gte("chain_date", start_date.isoformat())
    if end_date:
        query = query.lte("chain_date", end_date.isoformat())

    result = query.order("chain_date", desc=True).execute()

    return result.data if result.data else []


@router.get("/stats")
async def get_all_goals_stats(current_user: dict = Depends(get_current_user)):
    """Get statistics for all user goals"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Get all goals
    goals_result = (
        supabase.table("goals").select("*").eq("user_id", current_user["id"]).execute()
    )

    goals = goals_result.data
    total_goals = len(goals)
    active_goals = len([g for g in goals if g["is_active"]])
    completed_goals = total_goals - active_goals

    # Get all check-ins
    checkins_result = (
        supabase.table("check_ins")
        .select("*")
        .eq("user_id", current_user["id"])
        .execute()
    )

    checkins = checkins_result.data
    total_check_ins = len(checkins)
    completed_check_ins = len([c for c in checkins if c["completed"]])
    overall_completion_rate = (
        (completed_check_ins / total_check_ins * 100) if total_check_ins > 0 else 0
    )

    # Goals by category
    goals_by_category = {}
    for goal in goals:
        category = goal["category"]
        goals_by_category[category] = goals_by_category.get(category, 0) + 1

    return {
        "total_goals": total_goals,
        "active_goals": active_goals,
        "completed_goals": completed_goals,
        "total_check_ins": total_check_ins,
        "completed_check_ins": completed_check_ins,
        "overall_completion_rate": overall_completion_rate,
        "goals_by_category": goals_by_category,
    }
