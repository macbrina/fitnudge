"""
FitNudge V2 - Goals API Endpoints

Simple habit tracking with yes/no check-ins.
No AI plans, no categories, no tracking types - just accountability.

Check-ins are created on-demand when users respond to notifications,
not pre-created as "pending" records.
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional, Tuple
from datetime import date
from app.core.flexible_auth import get_current_user
from app.services.logger import logger
import re

router = APIRouter(redirect_slashes=False)


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================


def check_goal_access(
    goal_id: str, current_user_id: str, supabase
) -> Tuple[bool, Optional[dict], bool]:
    """
    Check if user can access a goal (either owns it or is a partner of the owner).

    Returns:
        Tuple of (has_access, goal_data, is_partner_view)
        - has_access: True if user can view the goal
        - goal_data: The goal data if found
        - is_partner_view: True if accessing as a partner (read-only)
    """
    try:
        goal_result = (
            supabase.table("goals")
            .select("*")
            .eq("id", goal_id)
            .maybe_single()
            .execute()
        )
    except Exception as e:
        logger.debug(f"Goal lookup failed for {goal_id}: {e}")
        return False, None, False

    if not goal_result or not goal_result.data:
        return False, None, False

    goal = goal_result.data
    goal_owner_id = goal.get("user_id")

    # Case 1: User owns the goal
    if goal_owner_id == current_user_id:
        return True, goal, False

    # Case 2: Check if current user is a partner of the goal owner
    partnership_result = (
        supabase.table("accountability_partners")
        .select("id")
        .eq("status", "accepted")
        .or_(
            f"and(user_id.eq.{current_user_id},partner_user_id.eq.{goal_owner_id}),"
            f"and(user_id.eq.{goal_owner_id},partner_user_id.eq.{current_user_id})"
        )
        .maybe_single()
        .execute()
    )

    if partnership_result and partnership_result.data:
        return True, goal, True  # Partner view (read-only)

    return False, None, False


def get_user_goal_limit(user_plan: str, supabase) -> Optional[int]:
    """
    Get total goal limit for user's plan from subscription_plans table.
    Returns None if unlimited, or integer for limit.
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
            return plan_result.data[0].get("active_goal_limit")

        logger.warning(
            f"Plan {user_plan} not found in subscription_plans, using defaults"
        )
        return 2  # Default to 2 (free tier)
    except Exception as e:
        logger.error(f"Error getting goal limit for plan {user_plan}: {e}")
        return 2  # Default to 2 (free tier)


async def get_user_active_goal_limit(user_id: str, supabase) -> Optional[int]:
    """
    Get active goal limit for user based on their plan.
    Returns: int for limit, None for unlimited, defaults to 2 (free tier).
    """
    from app.services.subscription_service import get_user_feature_value

    limit = await get_user_feature_value(supabase, user_id, "active_goal_limit")
    return limit if limit is not None else 2  # Default to 2 (free tier)


def get_active_goals_count(user_id: str, supabase) -> int:
    """Count active goals for a user."""
    active_goals = (
        supabase.table("goals")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("status", "active")
        .execute()
    )
    return (
        active_goals.count
        if hasattr(active_goals, "count")
        else len(active_goals.data or [])
    )


# =============================================================================
# PYDANTIC MODELS (V2 Schema)
# =============================================================================


class GoalCreate(BaseModel):
    """
    V2 Request body for creating a goal.

    Goals are simple habits like "Work out 3x/week" or "Read daily".
    No categories, no tracking types, no AI plans - just simple accountability.
    """

    title: str
    frequency_type: str  # daily, weekly
    frequency_count: Optional[int] = 1  # For weekly: how many times per week (1-7)
    target_days: Optional[List[int]] = None  # 0=Sunday, 1=Monday, ..., 6=Saturday
    reminder_times: Optional[List[str]] = None  # HH:MM format
    why_statement: Optional[str] = None  # User's personal "why"


class GoalUpdate(BaseModel):
    """V2 Update model for goals."""

    title: Optional[str] = None
    frequency_type: Optional[str] = None
    frequency_count: Optional[int] = None
    target_days: Optional[List[int]] = None
    reminder_times: Optional[List[str]] = None
    why_statement: Optional[str] = None
    status: Optional[str] = None  # active, paused, archived


class GoalResponse(BaseModel):
    """V2 Response model for goals."""

    id: str
    user_id: str
    title: str
    frequency_type: str
    frequency_count: int
    target_days: Optional[List[int]] = None
    reminder_times: Optional[List[str]] = None
    why_statement: Optional[str] = None
    status: str  # active, paused, archived
    current_streak: int = 0
    longest_streak: int = 0
    total_completions: int = 0
    created_at: str
    updated_at: Optional[str] = None
    # Today's status (optional, filled when include_today_status=True)
    today_checkin_status: Optional[str] = (
        None  # "completed" | "skipped" | "rest_day" | null
    )
    progress_this_week: Optional[dict] = None  # {completed: int, target: int}


# =============================================================================
# GOAL ENDPOINTS
# =============================================================================


@router.get("/", response_model=List[GoalResponse])
async def get_goals(
    current_user: dict = Depends(get_current_user),
    active_only: bool = Query(True, description="Filter active goals only"),
    include_today_status: bool = Query(
        True, description="Include today's check-in status"
    ),
):
    """
    Get user's goals.

    When include_today_status=True (default), each goal includes:
    - completed_today: Whether the goal was completed today
    - progress_this_week: For weekly goals, {completed: X, target: Y}
    """
    from app.core.database import get_supabase_client
    from datetime import datetime, timedelta

    supabase = get_supabase_client()
    user_id = current_user["id"]

    query = supabase.table("goals").select("*").eq("user_id", user_id)

    if active_only:
        query = query.eq("status", "active")

    result = query.order("created_at", desc=True).execute()
    goals = result.data or []

    if not goals or not include_today_status:
        return goals

    # Get today's date (using UTC for consistency)
    today = date.today().isoformat()
    goal_ids = [g["id"] for g in goals]

    # Batch fetch today's check-ins for all goals
    # V2: Select status instead of completed/is_rest_day
    today_checkins_result = (
        supabase.table("check_ins")
        .select("goal_id, status")
        .eq("user_id", user_id)
        .eq("check_in_date", today)
        .in_("goal_id", goal_ids)
        .execute()
    )

    # Build status map: goal_id -> status string
    # V2.1: Use status field directly, filter out pending
    def get_checkin_status(checkin: dict) -> Optional[str]:
        status = checkin.get("status", "pending")
        if status == "pending":
            return None  # Not yet responded
        return status  # completed, skipped, missed, rest_day

    today_checkin_status_map = {
        c["goal_id"]: get_checkin_status(c)
        for c in (today_checkins_result.data or [])
        if get_checkin_status(c) is not None  # Only include responded check-ins
    }

    # For weekly goals, get this week's progress
    # Calculate start of week (Monday)
    today_date = date.today()
    days_since_monday = today_date.weekday()
    week_start = (today_date - timedelta(days=days_since_monday)).isoformat()

    weekly_goal_ids = [g["id"] for g in goals if g.get("frequency_type") == "weekly"]
    weekly_progress_map = {}

    if weekly_goal_ids:
        # V2.1: Select status instead of completed
        week_checkins_result = (
            supabase.table("check_ins")
            .select("goal_id, status")
            .eq("user_id", user_id)
            .gte("check_in_date", week_start)
            .in_("goal_id", weekly_goal_ids)
            .execute()
        )

        # Count completed check-ins per goal this week
        # V2.1: Use status field
        for checkin in week_checkins_result.data or []:
            goal_id = checkin["goal_id"]
            if goal_id not in weekly_progress_map:
                weekly_progress_map[goal_id] = 0
            if checkin.get("status") == "completed":
                weekly_progress_map[goal_id] += 1

    # Enrich goals with today's status
    for goal in goals:
        goal_id = goal["id"]
        goal["today_checkin_status"] = today_checkin_status_map.get(goal_id, None)

        if goal.get("frequency_type") == "weekly":
            goal["progress_this_week"] = {
                "completed": weekly_progress_map.get(goal_id, 0),
                "target": goal.get("frequency_count", 1),
            }
        else:
            goal["progress_this_week"] = None

    return goals


@router.post("/", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
async def create_goal(
    goal_data: GoalCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    V2: Create a new goal (simple habit tracking).

    Goals are simple habits with yes/no check-ins.
    Check-ins are created on-demand when users respond to notifications.
    """
    from app.core.database import get_supabase_client
    from app.core.subscriptions import get_user_effective_plan

    supabase = get_supabase_client()
    user_id = current_user["id"]
    user_plan = get_user_effective_plan(user_id, supabase=supabase)

    # Get goal limit from subscription_plans table
    goal_limit = get_user_goal_limit(user_plan, supabase)

    # Check total goals count
    existing_goals = (
        supabase.table("goals")
        .select("id")
        .eq("user_id", user_id)
        .neq("status", "archived")
        .execute()
    )

    total_goals = len(existing_goals.data) if existing_goals.data else 0

    # Check if user has reached goal limit
    if goal_limit is not None and total_goals >= goal_limit:
        plan_name = user_plan.capitalize()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{plan_name} plan allows only {goal_limit} active goal(s). Upgrade to create more goals.",
        )

    # Get active goal limit for user's plan
    active_goal_limit = await get_user_active_goal_limit(user_id, supabase)

    # Check current active goals count
    current_active_count = get_active_goals_count(user_id, supabase)

    # Determine if goal can be activated
    can_activate = active_goal_limit is None or current_active_count < active_goal_limit

    # Validate frequency_type
    if goal_data.frequency_type not in ["daily", "weekly"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="frequency_type must be 'daily' or 'weekly'",
        )

    # For weekly goals, validate frequency_count
    frequency_count = goal_data.frequency_count or 1
    if goal_data.frequency_type == "weekly":
        if frequency_count < 1 or frequency_count > 7:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="frequency_count must be between 1 and 7 for weekly goals",
            )
    else:
        # Daily goals don't use frequency_count
        frequency_count = 1

    # Validate target_days (0-6 for days of week)
    target_days = goal_data.target_days or []
    for day in target_days:
        if day < 0 or day > 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="target_days must contain values between 0 (Sunday) and 6 (Saturday)",
            )

    # For weekly goals, target_days must match frequency_count
    if goal_data.frequency_type == "weekly" and len(target_days) != frequency_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"For weekly goals, you must select exactly {frequency_count} days. You selected {len(target_days)}.",
        )

    # Validate and normalize reminder_times format
    normalized_reminder_times = None
    if goal_data.reminder_times:
        time_pattern = re.compile(r"^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
        normalized_reminder_times = []
        for time_str in goal_data.reminder_times:
            # Normalize HH:MM:SS to HH:MM by stripping seconds
            if len(time_str) == 8 and time_str.count(":") == 2:
                time_str = time_str[:5]
            normalized_reminder_times.append(time_str)
            if not time_pattern.match(time_str):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid time format: {time_str}. Use HH:MM format (e.g., 09:00)",
                )

    # V2: Enforce reminder times limit based on subscription
    reminder_times_to_check = normalized_reminder_times or goal_data.reminder_times
    if reminder_times_to_check:
        from app.services.subscription_service import get_user_feature_value

        # Get reminder times limit using subscription_service (consistent with rest of app)
        reminder_limit = await get_user_feature_value(
            supabase, user_id, "multiple_reminder_times"
        )
        # Default to 1 if feature not found (free tier default)
        reminder_limit = reminder_limit if reminder_limit is not None else 1

        if len(reminder_times_to_check) > reminder_limit:
            plan_name = user_plan.capitalize()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"{plan_name} plan allows only {reminder_limit} reminder(s) per goal. Upgrade to add more.",
            )

    # V2: Simple goal data
    goal = {
        "user_id": user_id,
        "title": goal_data.title.strip(),
        "frequency_type": goal_data.frequency_type,
        "frequency_count": frequency_count,
        "target_days": target_days if target_days else None,
        "reminder_times": normalized_reminder_times
        or goal_data.reminder_times
        or ["18:00"],
        "why_statement": (
            goal_data.why_statement.strip() if goal_data.why_statement else None
        ),
        "status": "active" if can_activate else "paused",
    }

    result = supabase.table("goals").insert(goal).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create goal",
        )

    goal_id = result.data[0]["id"]

    logger.info(
        f"Goal created for user {user_id}",
        {
            "goal_id": goal_id,
            "title": goal_data.title,
            "status": "active" if can_activate else "paused",
            "total_goals": total_goals + 1,
        },
    )

    # Check achievements in background (non-blocking)
    try:
        from app.services.tasks import check_achievements_task

        check_achievements_task.delay(
            user_id=user_id,
            source_type="goal",
            source_id=goal_id,
        )
    except Exception as e:
        logger.warning(
            f"Failed to queue achievement check: {e}",
            {"user_id": user_id, "goal_id": goal_id},
        )

    # Notify partners of new goal (for real-time updates)
    try:
        from app.services.social_accountability_service import (
            social_accountability_service,
        )

        await social_accountability_service.notify_partners_of_data_change(
            user_id, "goal_created"
        )
    except Exception as e:
        logger.warning(f"Failed to notify partners: {e}")

    return result.data[0]


@router.get("/{goal_id}", response_model=GoalResponse)
async def get_goal(goal_id: str, current_user: dict = Depends(get_current_user)):
    """Get specific goal by ID. Allows access if user owns the goal or is a partner."""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    has_access, goal, is_partner_view = check_goal_access(
        goal_id, current_user["id"], supabase
    )

    if not has_access or not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    # Ensure today's check-in exists for active goals (defensive - handles edge cases
    # where hourly task hasn't run yet)
    if goal.get("status") == "active" and not is_partner_view:
        user_tz = current_user.get("timezone", "UTC")
        try:
            result = supabase.rpc(
                "precreate_checkin_for_goal",
                {
                    "p_goal_id": goal_id,
                    "p_user_id": current_user["id"],
                    "p_frequency_type": goal.get("frequency_type"),
                    "p_target_days": goal.get("target_days"),
                    "p_user_timezone": user_tz,
                },
            ).execute()
            # RPC returns: 'inserted', 'existed', or 'not_scheduled'
            # If a new check-in was created, invalidate analytics cache
            if result.data == "inserted":
                from app.services.tasks.analytics_refresh_tasks import (
                    invalidate_user_analytics_cache,
                )

                invalidate_user_analytics_cache(current_user["id"], goal_id)
        except Exception:
            # Non-critical - don't fail the request if pre-creation fails
            pass

    # Privacy filter: hide sensitive schedule data for partner view
    if is_partner_view:
        goal["reminder_times"] = None
        goal["why_statement"] = None

    return goal


@router.put("/{goal_id}", response_model=GoalResponse)
async def update_goal(
    goal_id: str, goal_data: GoalUpdate, current_user: dict = Depends(get_current_user)
):
    """
    V2: Update goal.
    If activating a goal (status='active'), check active goal limit.
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
        .maybe_single()
        .execute()
    )

    if not existing_goal or not existing_goal.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    update_data = {k: v for k, v in goal_data.dict().items() if v is not None}

    # Lock frequency settings after first check-in
    # This prevents users from gaming streak calculations
    has_checkins = existing_goal.data.get("total_completions", 0) > 0
    if has_checkins:
        frequency_fields = ["frequency_type", "target_days", "frequency_count"]
        changed_frequency_fields = [f for f in frequency_fields if f in update_data]

        if changed_frequency_fields:
            # Check if the values are actually different
            actual_changes = []
            for field in changed_frequency_fields:
                old_value = existing_goal.data.get(field)
                new_value = update_data[field]
                # Handle list comparison for target_days
                if field == "target_days":
                    old_sorted = sorted(old_value) if old_value else []
                    new_sorted = sorted(new_value) if new_value else []
                    if old_sorted != new_sorted:
                        actual_changes.append(field)
                elif old_value != new_value:
                    actual_changes.append(field)

            if actual_changes:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot change schedule (frequency or target days) after completing check-ins. Archive this goal and create a new one instead.",
                )

    # Validate frequency_type if provided
    if "frequency_type" in update_data:
        if update_data["frequency_type"] not in ["daily", "weekly"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="frequency_type must be 'daily' or 'weekly'",
            )

    # Validate frequency_count
    if "frequency_count" in update_data:
        if update_data["frequency_count"] < 1 or update_data["frequency_count"] > 7:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="frequency_count must be between 1 and 7",
            )

    # Validate target_days
    if "target_days" in update_data and update_data["target_days"]:
        for day in update_data["target_days"]:
            if day < 0 or day > 6:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="target_days must contain values between 0 (Sunday) and 6 (Saturday)",
                )

    # For weekly goals, validate target_days matches frequency_count
    # Get the effective values (from update_data or existing goal)
    effective_frequency_type = update_data.get(
        "frequency_type", existing_goal.data.get("frequency_type")
    )
    effective_frequency_count = update_data.get(
        "frequency_count", existing_goal.data.get("frequency_count", 1)
    )
    effective_target_days = update_data.get(
        "target_days", existing_goal.data.get("target_days", [])
    )

    if effective_frequency_type == "weekly":
        target_days_count = len(effective_target_days) if effective_target_days else 0
        if target_days_count != effective_frequency_count:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"For weekly goals, you must select exactly {effective_frequency_count} days. You selected {target_days_count}.",
            )

    # Validate and normalize reminder_times format
    if "reminder_times" in update_data and update_data["reminder_times"]:
        time_pattern = re.compile(r"^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
        normalized_times = []
        for time_str in update_data["reminder_times"]:
            # Normalize HH:MM:SS to HH:MM by stripping seconds
            if len(time_str) == 8 and time_str.count(":") == 2:
                time_str = time_str[:5]
            normalized_times.append(time_str)
            if not time_pattern.match(time_str):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid time format: {time_str}. Use HH:MM format",
                )
        update_data["reminder_times"] = normalized_times

        # V2: Enforce reminder times limit based on subscription
        from app.core.subscriptions import get_user_effective_plan
        from app.services.subscription_service import get_user_feature_value

        user_plan = get_user_effective_plan(user_id, supabase=supabase)

        # Get reminder times limit using subscription_service (consistent with rest of app)
        reminder_limit = await get_user_feature_value(
            supabase, user_id, "multiple_reminder_times"
        )
        # Default to 1 if feature not found (free tier default)
        reminder_limit = reminder_limit if reminder_limit is not None else 1

        if len(update_data["reminder_times"]) > reminder_limit:
            plan_name = user_plan.capitalize()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"{plan_name} plan allows only {reminder_limit} reminder(s) per goal. Upgrade to add more.",
            )

    # If activating this goal, check active goal limit
    if update_data.get("status") == "active":
        active_goal_limit = await get_user_active_goal_limit(user_id, supabase)

        # Get current active goals (excluding this one)
        active_goals = (
            supabase.table("goals")
            .select("id")
            .eq("user_id", user_id)
            .eq("status", "active")
            .neq("id", goal_id)
            .execute()
        )

        current_active_count = len(active_goals.data) if active_goals.data else 0

        if active_goal_limit is not None and current_active_count >= active_goal_limit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Your plan allows only {active_goal_limit} active goal(s). Deactivate another goal first.",
            )

    result = supabase.table("goals").update(update_data).eq("id", goal_id).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update goal",
        )

    # Notify partners of the goal update
    try:
        from app.services.social_accountability_service import (
            social_accountability_service,
        )

        await social_accountability_service.notify_partners_of_data_change(
            user_id, "goal_updated"
        )
    except Exception as e:
        logger.warning(f"Failed to notify partners: {e}")

    return result.data[0]


@router.delete("/{goal_id}")
async def delete_goal(
    goal_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Delete goal and all associated check-ins.
    Uses CASCADE delete for check-ins.
    """
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Check if goal exists and belongs to user
    existing_goal = (
        supabase.table("goals")
        .select("id")
        .eq("id", goal_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )

    if not existing_goal or not existing_goal.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    # Delete the goal (check-ins will CASCADE delete)
    supabase.table("goals").delete().eq("id", goal_id).execute()

    # Fire-and-forget: cleanup goal notifications (reminders, AI motivations, etc.)
    from app.services.cleanup_service import fire_and_forget_goal_cleanup

    fire_and_forget_goal_cleanup(goal_id, reason="deleted")

    # Notify partners
    try:
        from app.services.social_accountability_service import (
            social_accountability_service,
        )

        await social_accountability_service.notify_partners_of_data_change(
            current_user["id"], "goal_deleted"
        )
    except Exception as e:
        logger.warning(f"Failed to notify partners: {e}")

    return {"message": "Goal deleted successfully"}


@router.post("/{goal_id}/activate")
async def activate_goal(goal_id: str, current_user: dict = Depends(get_current_user)):
    """
    Activate a goal.
    Checks active goal limit from user's plan.
    """
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]
    user_plan = current_user.get("plan", "free")

    # Check if goal exists and belongs to user
    existing_goal = (
        supabase.table("goals")
        .select("*")
        .eq("id", goal_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if not existing_goal or not existing_goal.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    goal = existing_goal.data

    # Check if goal is already active
    if goal.get("status") == "active":
        return {"message": "Goal is already active", "goal": goal}

    # Get active goal limit
    active_goal_limit = await get_user_active_goal_limit(user_id, supabase)
    current_active_count = get_active_goals_count(user_id, supabase)

    # Check if user has reached active goal limit
    if active_goal_limit is not None and current_active_count >= active_goal_limit:
        plan_name = user_plan.capitalize()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{plan_name} plan allows only {active_goal_limit} active goal(s). Deactivate another goal first.",
        )

    # Activate the goal
    result = (
        supabase.table("goals").update({"status": "active"}).eq("id", goal_id).execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to activate goal",
        )

    # Notify partners
    try:
        from app.services.social_accountability_service import (
            social_accountability_service,
        )

        await social_accountability_service.notify_partners_of_data_change(
            user_id, "goal_activated"
        )
    except Exception as e:
        logger.warning(f"Failed to notify partners: {e}")

    return {"message": "Goal activated successfully", "goal": result.data[0]}


@router.post("/{goal_id}/deactivate")
async def deactivate_goal(goal_id: str, current_user: dict = Depends(get_current_user)):
    """
    Deactivate a goal (sets status to 'paused').
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
        .maybe_single()
        .execute()
    )

    if not existing_goal or not existing_goal.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    goal = existing_goal.data

    # Check if goal is already inactive
    if goal.get("status") != "active":
        return {"message": "Goal is already inactive", "goal": goal}

    # Deactivate goal
    result = (
        supabase.table("goals").update({"status": "paused"}).eq("id", goal_id).execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deactivate goal",
        )

    # Notify partners
    try:
        from app.services.social_accountability_service import (
            social_accountability_service,
        )

        await social_accountability_service.notify_partners_of_data_change(
            user_id, "goal_deactivated"
        )
    except Exception as e:
        logger.warning(f"Failed to notify partners: {e}")

    return {"message": "Goal deactivated successfully", "goal": result.data[0]}


@router.post("/{goal_id}/archive")
async def archive_goal(goal_id: str, current_user: dict = Depends(get_current_user)):
    """
    Archive a goal (sets status to 'archived').
    Archived goals don't count toward limits.
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
        .maybe_single()
        .execute()
    )

    if not existing_goal or not existing_goal.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    goal = existing_goal.data

    if goal.get("status") == "archived":
        return {"message": "Goal is already archived", "goal": goal}

    # Archive goal
    result = (
        supabase.table("goals")
        .update({"status": "archived"})
        .eq("id", goal_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to archive goal",
        )

    # Notify partners of archived goal (for real-time updates)
    try:
        from app.services.social_accountability_service import (
            social_accountability_service,
        )

        await social_accountability_service.notify_partners_of_data_change(
            user_id, "goal_archived"
        )
    except Exception as e:
        logger.warning(f"Failed to notify partners: {e}")

    return {"message": "Goal archived successfully", "goal": result.data[0]}


# =============================================================================
# STATS ENDPOINTS
# =============================================================================


@router.get("/{goal_id}/stats")
async def get_goal_stats(goal_id: str, current_user: dict = Depends(get_current_user)):
    """Get statistics for a specific goal."""
    from app.core.database import get_supabase_client
    from datetime import datetime, timedelta

    supabase = get_supabase_client()

    # Verify goal belongs to user
    goal = (
        supabase.table("goals")
        .select("*")
        .eq("id", goal_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )

    if not goal or not goal.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    goal_data = goal.data

    # Get check-in stats
    today = datetime.utcnow().date()
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)

    # Total check-ins (V2: select status instead of completed)
    all_checkins = (
        supabase.table("check_ins")
        .select("status, check_in_date")
        .eq("goal_id", goal_id)
        .execute()
    )

    checkins = all_checkins.data or []
    # V2.1: Exclude pending check-ins from total count
    total_checkins = len([c for c in checkins if c.get("status") != "pending"])
    # V2.1: Use status field instead of completed boolean
    completed_checkins = len([c for c in checkins if c.get("status") == "completed"])

    # Last 7 days
    recent_checkins = [
        c for c in checkins if c.get("check_in_date") >= week_ago.isoformat()
    ]
    checkins_7d = len([c for c in recent_checkins if c.get("status") == "completed"])

    # Last 30 days
    month_checkins = [
        c for c in checkins if c.get("check_in_date") >= month_ago.isoformat()
    ]
    checkins_30d = len([c for c in month_checkins if c.get("status") == "completed"])

    return {
        "goal_id": goal_id,
        "title": goal_data.get("title"),
        "current_streak": goal_data.get("current_streak", 0),
        "longest_streak": goal_data.get("longest_streak", 0),
        "total_completions": goal_data.get("total_completions", 0),
        "total_checkins": total_checkins,
        "completed_checkins": completed_checkins,
        "completion_rate": (
            round(completed_checkins / total_checkins * 100, 1)
            if total_checkins > 0
            else 0
        ),
        "checkins_last_7d": checkins_7d,
        "checkins_last_30d": checkins_30d,
        "goal_created": goal_data.get("created_at"),
    }


@router.get("/stats/summary")
async def get_goals_summary(current_user: dict = Depends(get_current_user)):
    """Get summary statistics for all user goals."""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Get all goals
    goals_result = supabase.table("goals").select("*").eq("user_id", user_id).execute()

    goals = goals_result.data or []
    total_goals = len(goals)
    active_goals = len([g for g in goals if g.get("status") == "active"])
    paused_goals = len([g for g in goals if g.get("status") == "paused"])
    archived_goals = len([g for g in goals if g.get("status") == "archived"])

    # Get all check-ins
    # V2.1: Select status instead of completed
    checkins_result = (
        supabase.table("check_ins").select("status").eq("user_id", user_id).execute()
    )

    checkins = checkins_result.data or []
    # V2.1: Exclude pending from total, use status for completed count
    total_checkins = len([c for c in checkins if c.get("status") != "pending"])
    completed_checkins = len([c for c in checkins if c.get("status") == "completed"])
    completion_rate = (
        round(completed_checkins / total_checkins * 100, 1) if total_checkins > 0 else 0
    )

    # Get best streak across all goals
    best_streak = max((g.get("longest_streak", 0) for g in goals), default=0)
    current_best_streak = max((g.get("current_streak", 0) for g in goals), default=0)

    return {
        "total_goals": total_goals,
        "active_goals": active_goals,
        "paused_goals": paused_goals,
        "archived_goals": archived_goals,
        "total_checkins": total_checkins,
        "completed_checkins": completed_checkins,
        "completion_rate": completion_rate,
        "best_streak_ever": best_streak,
        "current_best_streak": current_best_streak,
    }


# =============================================================================
# INSIGHTS ENDPOINTS (Premium)
# =============================================================================


class PatternInsight(BaseModel):
    """A single AI-generated pattern insight for a goal."""

    type: str  # pattern, encouragement, warning, tip
    text: str
    priority: int = 1


class NudgeConfig(BaseModel):
    """Nudge configuration for adaptive nudging."""

    risky_days: List[int] = []  # 0=Sunday, 1=Monday, etc.
    risk_level: str = "medium"  # low, medium, high
    best_nudge_time: str = "09:00"
    needs_extra_motivation: bool = False


class InsightsMetrics(BaseModel):
    """Metrics snapshot for trend comparison."""

    completion_rate_30d: float = 0
    completion_rate_7d: float = 0
    current_streak: int = 0
    longest_streak: int = 0
    total_checkins_30d: int = 0
    completed_checkins_30d: int = 0
    best_day_index: Optional[int] = None
    best_day_rate: Optional[float] = None
    worst_day_index: Optional[int] = None
    worst_day_rate: Optional[float] = None
    calculated_at: Optional[str] = None


class GoalInsightsResponse(BaseModel):
    """Response containing AI-generated goal insights."""

    goal_id: str
    goal_title: str
    status: str  # pending, generating, completed, failed, insufficient_data
    insights: List[PatternInsight] = []
    nudge_config: Optional[NudgeConfig] = None
    current_metrics: Optional[InsightsMetrics] = None
    previous_metrics: Optional[InsightsMetrics] = None
    checkins_count: Optional[int] = None  # For insufficient_data status
    min_required: Optional[int] = None  # For insufficient_data status
    generated_at: Optional[str] = None
    summary: Optional[str] = None


@router.get("/{goal_id}/insights", response_model=GoalInsightsResponse)
async def get_goal_insights(
    goal_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Get AI-generated pattern insights for a specific goal.

    PREMIUM FEATURE: Requires premium subscription.

    Returns insights with status:
    - pending: Initial state
    - generating: AI is generating insights
    - completed: Insights are ready
    - failed: Generation failed
    - insufficient_data: Not enough check-ins (need 3+)

    On first call with enough data, triggers AI generation.
    Subsequent calls return cached insights (fresh for 24h).
    """
    from app.core.database import get_supabase_client
    from app.services.subscription_service import has_user_feature
    from app.services.ai_insights_service import get_ai_insights_service

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Check premium access
    has_access = await has_user_feature(supabase, user_id, "pattern_detection")
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Goal insights require a premium subscription",
        )

    # Verify goal belongs to user
    goal = (
        supabase.table("goals")
        .select("id, title, user_id")
        .eq("id", goal_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if not goal or not goal.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    goal_data = goal.data

    # Get or generate insights using AI service
    insights_service = get_ai_insights_service()
    result = await insights_service.get_or_generate_insights(
        goal_id=goal_id,
        user_id=user_id,
        force_refresh=False,
    )

    status_val = result.get("status", "pending")
    data = result.get("data") or {}

    # Format insights for response
    # Use `or []` to handle case where insights key exists but is None
    insights_list = (data.get("insights") or []) if isinstance(data, dict) else []
    formatted_insights = [
        PatternInsight(
            type=i.get("type", "pattern"),
            text=i.get("text", ""),
            priority=i.get("priority", 1),
        )
        for i in insights_list
        if isinstance(i, dict)
    ]

    # Format nudge config
    nudge_data = (data.get("nudge_config") or {}) if isinstance(data, dict) else {}
    nudge_config = None
    if nudge_data:
        nudge_config = NudgeConfig(
            risky_days=nudge_data.get("risky_days", []),
            risk_level=nudge_data.get("risk_level", "medium"),
            best_nudge_time=nudge_data.get("best_nudge_time", "09:00"),
            needs_extra_motivation=nudge_data.get("needs_extra_motivation", False),
        )

    # Format metrics
    current_metrics_data = (
        (data.get("current_metrics") or {}) if isinstance(data, dict) else {}
    )
    current_metrics = None
    if current_metrics_data:
        current_metrics = InsightsMetrics(
            completion_rate_30d=current_metrics_data.get("completion_rate_30d", 0),
            completion_rate_7d=current_metrics_data.get("completion_rate_7d", 0),
            current_streak=current_metrics_data.get("current_streak", 0),
            longest_streak=current_metrics_data.get("longest_streak", 0),
            total_checkins_30d=current_metrics_data.get("total_checkins_30d", 0),
            completed_checkins_30d=current_metrics_data.get(
                "completed_checkins_30d", 0
            ),
            best_day_index=current_metrics_data.get("best_day_index"),
            best_day_rate=current_metrics_data.get("best_day_rate"),
            worst_day_index=current_metrics_data.get("worst_day_index"),
            worst_day_rate=current_metrics_data.get("worst_day_rate"),
            calculated_at=current_metrics_data.get("calculated_at"),
        )

    previous_metrics_data = (
        (data.get("previous_metrics") or {}) if isinstance(data, dict) else {}
    )
    previous_metrics = None
    if previous_metrics_data:
        previous_metrics = InsightsMetrics(
            completion_rate_30d=previous_metrics_data.get("completion_rate_30d", 0),
            completion_rate_7d=previous_metrics_data.get("completion_rate_7d", 0),
            current_streak=previous_metrics_data.get("current_streak", 0),
            longest_streak=previous_metrics_data.get("longest_streak", 0),
            total_checkins_30d=previous_metrics_data.get("total_checkins_30d", 0),
            completed_checkins_30d=previous_metrics_data.get(
                "completed_checkins_30d", 0
            ),
            best_day_index=previous_metrics_data.get("best_day_index"),
            best_day_rate=previous_metrics_data.get("best_day_rate"),
            worst_day_index=previous_metrics_data.get("worst_day_index"),
            worst_day_rate=previous_metrics_data.get("worst_day_rate"),
            calculated_at=previous_metrics_data.get("calculated_at"),
        )

    return GoalInsightsResponse(
        goal_id=goal_id,
        goal_title=goal_data.get("title", ""),
        status=status_val,
        insights=formatted_insights,
        nudge_config=nudge_config,
        current_metrics=current_metrics,
        previous_metrics=previous_metrics,
        checkins_count=result.get("checkins_count"),
        min_required=result.get("min_required"),
        generated_at=data.get("generated_at") if isinstance(data, dict) else None,
        summary=data.get("summary") if isinstance(data, dict) else None,
    )


@router.post("/{goal_id}/insights/refresh")
async def refresh_goal_insights(
    goal_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Force refresh AI-generated pattern insights for a specific goal.

    PREMIUM FEATURE: Requires premium subscription.
    Triggers immediate AI regeneration regardless of cache freshness.
    """
    from app.core.database import get_supabase_client
    from app.services.subscription_service import has_user_feature
    from app.services.ai_insights_service import get_ai_insights_service

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Check premium access
    has_access = await has_user_feature(supabase, user_id, "pattern_detection")
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Goal insights require a premium subscription",
        )

    # Verify goal belongs to user
    goal = (
        supabase.table("goals")
        .select("id, title")
        .eq("id", goal_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if not goal or not goal.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    # Force refresh insights using AI service
    try:
        insights_service = get_ai_insights_service()
        result = await insights_service.get_or_generate_insights(
            goal_id=goal_id,
            user_id=user_id,
            force_refresh=True,
        )

        status_val = result.get("status", "failed")
        data = result.get("data", {}) or {}
        insights_count = len(data.get("insights", []))

    except Exception as e:
        logger.error(f"Failed to refresh goal patterns: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate insights",
        )

    # Return appropriate message based on status
    if status_val == "generating":
        message = "Insights generation started"
    elif status_val == "completed":
        message = "Insights refreshed successfully"
    elif status_val == "insufficient_data":
        message = "Not enough data for insights"
    else:
        message = "Insights refresh requested"

    return {
        "message": message,
        "goal_id": goal_id,
        "status": status_val,
        "insights_count": insights_count,
    }
