from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Tuple
from datetime import date, datetime
from app.core.flexible_auth import get_current_user
from app.services.logger import logger
import pytz

router = APIRouter(
    redirect_slashes=False
)  # Disable redirects to preserve Authorization header


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
    # First, try to find the goal (without user filter)
    goal_result = (
        supabase.table("goals").select("*").eq("id", goal_id).maybe_single().execute()
    )

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


async def create_initial_checkin(
    supabase,
    goal_id: str,
    user_id: str,
    user_timezone: str,
    frequency: str,
    days_of_week: Optional[List[int]],
) -> None:
    """
    Create initial check-in for today when goal is created (if applicable).
    Timezone-aware: uses user's local date.
    """
    try:
        # Get current date in user's timezone
        user_tz = pytz.timezone(user_timezone or "UTC")
        user_now = datetime.now(user_tz)
        user_today = user_now.date()
        user_weekday = user_today.weekday()  # Python: 0=Mon, 6=Sun
        user_day_of_week = (user_weekday + 1) % 7  # Convert to 0=Sun

        # Check if today is a valid day for this goal
        should_create = False

        if frequency == "daily":
            should_create = True
        elif frequency == "weekly" and days_of_week:
            if user_day_of_week in days_of_week:
                should_create = True

        if not should_create:
            print(
                f"Skipping initial check-in for goal {goal_id} (today not in schedule)"
            )
            return

        # Check if check-in already exists (shouldn't happen, but be safe)
        existing = (
            supabase.table("check_ins")
            .select("id")
            .eq("goal_id", goal_id)
            .eq("check_in_date", user_today.isoformat())
            .execute()
        )

        if existing.data:
            print(f"Check-in already exists for goal {goal_id} on {user_today}")
            return

        # Create check-in
        checkin_data = {
            "goal_id": goal_id,
            "user_id": user_id,
            "check_in_date": user_today.isoformat(),
            "completed": False,
        }

        result = supabase.table("check_ins").insert(checkin_data).execute()

        if result.data:
            print(
                f"Created initial check-in for goal {goal_id} on {user_today} ({user_timezone})"
            )

    except pytz.exceptions.UnknownTimeZoneError:
        logger.error(
            f"Invalid timezone for user {user_id}: {user_timezone}",
            {"user_id": user_id, "timezone": user_timezone},
        )
    except Exception as e:
        logger.error(
            f"Failed to create initial check-in for goal {goal_id}",
            {"goal_id": goal_id, "user_id": user_id, "error": str(e)},
        )


def get_feature_limit(
    user_plan: str, feature_key: str, supabase, default: int = 1
) -> Optional[int]:
    """
    Get a feature limit from plan_features table.
    Returns:
    - int: The limit value
    - None: Unlimited
    - 0: Feature disabled
    """
    try:
        result = (
            supabase.table("plan_features")
            .select("feature_value, is_enabled")
            .eq("plan_id", user_plan)
            .eq("feature_key", feature_key)
            .maybe_single()
            .execute()
        )

        if result.data:
            if not result.data.get("is_enabled", True):
                return 0  # Feature disabled
            return result.data.get("feature_value")  # None = unlimited

        logger.warning(
            f"{feature_key} not found for plan {user_plan}, defaulting to {default}"
        )
        return default
    except Exception as e:
        logger.error(f"Error getting {feature_key} for plan {user_plan}: {e}")
        return default


def get_user_active_goal_limit(user_plan: str, supabase) -> Optional[int]:
    """
    Get active goal limit for user's plan from plan_features table.
    Returns: int for limit, None for unlimited, defaults to 1.
    This is for PERSONAL goals only (not challenges or group goals).
    """
    return get_feature_limit(user_plan, "active_goal_limit", supabase, default=1)


def get_user_challenge_limit(user_plan: str, supabase) -> Optional[int]:
    """
    Get challenge participation limit (created + joined) from plan_features.
    Returns: int for limit, None for unlimited, defaults to 1.
    """
    return get_feature_limit(user_plan, "challenge_limit", supabase, default=1)


def get_user_challenge_participation_count(user_id: str, supabase) -> int:
    """
    Count total challenges user is participating in (created + joined).
    Only counts challenges that are still ongoing (upcoming or active, not completed/cancelled).

    NOTE: Status is computed, not stored:
    Status is stored in 'status' column.
    """
    from datetime import date

    today = date.today().isoformat()

    # Count challenges created by user that are ongoing
    # Ongoing = status IN ('upcoming', 'active') AND end_date >= today (or end_date is null)
    created_result = (
        supabase.table("challenges")
        .select("id, end_date, status")
        .eq("created_by", user_id)
        .in_("status", ["upcoming", "active"])
        .execute()
    )
    # Filter: end_date >= today OR end_date is null (ongoing challenges)
    created_count = sum(
        1
        for c in (created_result.data or [])
        if c.get("end_date") is None or c.get("end_date") >= today
    )

    # Count challenges joined (via challenge_participants, not created by user)
    joined_result = (
        supabase.table("challenge_participants")
        .select("id, challenge_id, challenges!inner(id, status, end_date, created_by)")
        .eq("user_id", user_id)
        .in_("challenges.status", ["upcoming", "active"])
        .neq("challenges.created_by", user_id)
        .execute()
    )
    # Filter: ongoing challenges (end_date >= today or null)
    joined_count = sum(
        1
        for p in (joined_result.data or [])
        if p.get("challenges", {}).get("end_date") is None
        or p.get("challenges", {}).get("end_date") >= today
    )

    return created_count + joined_count


# Validation helpers
def validate_goal_data(goal_data: Dict[str, Any]) -> None:
    """
    Validate goal data based on frequency and other constraints.
    Raises HTTPException if validation fails.
    """
    frequency = goal_data.get("frequency")
    target_days = goal_data.get("target_days")
    days_of_week = goal_data.get("days_of_week", [])

    # Validate frequency is valid
    valid_frequencies = ["daily", "weekly"]
    if frequency not in valid_frequencies:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid frequency. Must be one of: {', '.join(valid_frequencies)}",
        )

    # Validate based on frequency
    if frequency == "daily":
        # Daily goals: target_days should be 7 (or None, we'll set to 7), days_of_week should be None/empty
        if days_of_week:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="days_of_week should not be provided for daily goals",
            )
        # Set target_days to 7 if not provided
        if target_days is None:
            goal_data["target_days"] = 7

    elif frequency == "weekly":
        # Weekly goals: require target_days (1-7) and days_of_week must match
        if target_days is None or target_days < 1 or target_days > 7:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="target_days is required for weekly goals and must be between 1 and 7",
            )

        # Validate days_of_week if provided
        if days_of_week:
            if len(days_of_week) > target_days:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"days_of_week cannot have more than {target_days} day(s) (based on target_days)",
                )

            # Validate day values are 0-6
            for day in days_of_week:
                if day < 0 or day > 6:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="days_of_week must contain values between 0-6 (0=Sunday, 6=Saturday)",
                    )

        # If no days_of_week provided, require it
        if not days_of_week or len(days_of_week) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="days_of_week is required for weekly goals",
            )


# Goal type literals
GOAL_TYPES = ["habit", "time_challenge", "target_challenge"]
COMPLETION_REASONS = ["duration", "target", "manual"]


# Pydantic models
class GoalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str
    frequency: str
    target_days: Optional[int] = None
    days_of_week: Optional[List[int]] = (
        None  # Array of day numbers (0-6): 0=Sunday, 1=Monday, ..., 6=Saturday
    )
    reminder_times: Optional[List[str]] = None
    custom_reminder_message: Optional[str] = None  # Custom message for reminders
    # Tracking type - determines how user completes check-ins
    # Default to None so backend can derive from category if not specified
    tracking_type: Optional[str] = None  # workout, meal, hydration, checkin
    # Goal type fields
    goal_type: Optional[str] = "habit"  # habit, time_challenge, target_challenge
    target_checkins: Optional[int] = None  # Required for target_challenge
    challenge_duration_days: Optional[int] = None  # For time_challenge (30, 60, 90)
    challenge_id: Optional[str] = None  # Link to shared challenge


class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    frequency: Optional[str] = None
    target_days: Optional[int] = None
    days_of_week: Optional[List[int]] = (
        None  # Array of day numbers (0-6): 0=Sunday, 1=Monday, ..., 6=Saturday
    )
    reminder_times: Optional[List[str]] = None
    status: Optional[str] = None  # 'active', 'paused', 'completed', 'archived'
    custom_reminder_message: Optional[str] = None  # Custom message for reminders
    # Tracking type - determines how user completes check-ins
    tracking_type: Optional[str] = None  # workout, meal, hydration, checkin
    # Goal type fields (mostly immutable after creation, but allow update)
    goal_type: Optional[str] = None
    target_checkins: Optional[int] = None
    completed_at: Optional[str] = None  # Allow manual completion
    completion_reason: Optional[str] = None


class GoalEditRequest(BaseModel):
    """
    Restricted model for user-facing goal edits.

    Only allows editing fields that don't affect the AI-generated plan:
    - title: Safe to change (warning shown to user that plan was based on original)
    - description: Safe to change (warning shown to user that plan was based on original)
    - days_of_week: Can ADD days, but cannot REMOVE existing days
    - reminder_times: Just notification preferences, safe to change
    """

    title: Optional[str] = None
    description: Optional[str] = None
    days_of_week: Optional[List[int]] = None  # ADD only - validated in endpoint
    reminder_times: Optional[List[str]] = None


class GoalResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    category: str
    frequency: str
    target_days: Optional[int]
    days_of_week: Optional[List[int]] = None
    reminder_times: Optional[List[str]]
    status: str  # 'active', 'paused', 'completed', 'archived'
    created_at: str
    updated_at: str
    # Tracking type - determines how user completes check-ins
    tracking_type: Optional[str] = (
        None  # workout, meal, hydration, checkin - derived from category
    )
    # Goal type fields
    goal_type: Optional[str] = "habit"
    challenge_id: Optional[str] = None
    target_checkins: Optional[int] = None
    challenge_start_date: Optional[str] = None
    challenge_end_date: Optional[str] = None
    completed_at: Optional[str] = None
    completion_reason: Optional[str] = None


class CheckInCreate(BaseModel):
    goal_id: str
    check_in_date: date
    completed: bool
    notes: Optional[str] = None
    mood: Optional[str] = None
    is_checked_in: Optional[bool] = True


class CheckInResponse(BaseModel):
    id: str
    goal_id: str
    check_in_date: date
    completed: bool
    notes: Optional[str] = None
    mood: Optional[str] = None
    is_checked_in: Optional[bool] = None
    photo_url: Optional[str] = None
    user_id: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}


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
        query = query.eq("status", "active")

    result = query.order("created_at", desc=True).execute()
    return result.data


class GoalTypeSuggestionRequest(BaseModel):
    """Request for goal type-specific suggestions"""

    goal_type: str  # habit, time_challenge, target_challenge, mixed
    duration_days: Optional[int] = None  # For time_challenge: 30, 60, 90
    target_range: Optional[str] = None  # For target_challenge: small, medium, ambitious


class GoalTypeSuggestionItem(BaseModel):
    """A single goal suggestion with type-specific fields"""

    id: Optional[str] = None
    title: str
    description: str
    category: str
    frequency: str
    target_days: Optional[int] = None
    days_of_week: Optional[List[int]] = None
    reminder_times: Optional[List[str]] = None
    goal_type: str
    tracking_type: Optional[str] = (
        None  # workout, meal, hydration, checkin - derived from category
    )
    duration_days: Optional[int] = None  # For time_challenge
    target_checkins: Optional[int] = None  # For target_challenge
    match_reason: Optional[str] = None


class GoalTypeSuggestionResponse(BaseModel):
    """Response with goal suggestions by type"""

    goal_type: str
    suggestions: List[GoalTypeSuggestionItem]


@router.post("/suggestions-by-type", response_model=GoalTypeSuggestionResponse)
async def get_goal_suggestions_by_type(
    request: GoalTypeSuggestionRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Get AI-powered goal suggestions based on goal type.

    - habit: Ongoing daily/weekly habits (free for all)
    - time_challenge: Duration-based challenges (premium)
    - target_challenge: Target-based challenges (premium)
    - mixed: Variety of all types
    """
    from app.core.database import get_supabase_client
    from app.services.goal_type_suggestion_service import generate_goals_by_type_sync
    from uuid import uuid4

    supabase = get_supabase_client()
    user_id = current_user["id"]
    user_plan = current_user.get("plan", "free")

    # Validate goal type
    valid_types = ["habit", "time_challenge", "target_challenge", "mixed"]
    if request.goal_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid goal_type. Must be one of: {valid_types}",
        )

    # Check premium access for challenges
    if request.goal_type in ["time_challenge", "target_challenge"]:
        from app.core.subscriptions import check_user_has_feature

        has_challenge_create = check_user_has_feature(
            user_id, "challenge_create", user_plan, supabase
        )

        if not has_challenge_create:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Upgrade to paid plan to create challenges. Habits are free for all users.",
            )

    # Get user's fitness profile
    profile_result = (
        supabase.table("user_fitness_profiles")
        .select("*")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if not profile_result or not profile_result.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please complete your fitness profile first.",
        )

    profile = profile_result.data

    # Generate suggestions
    goals = generate_goals_by_type_sync(
        profile=profile,
        goal_type=request.goal_type,
        duration_days=request.duration_days,
        target_range=request.target_range,
    )

    if not goals:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate goal suggestions. Please try again.",
        )

    # Transform to response format with IDs
    suggestions = []
    for goal in goals:
        suggestions.append(
            GoalTypeSuggestionItem(
                id=str(uuid4()),
                title=goal.get("title", ""),
                description=goal.get("description", ""),
                category=goal.get("category", "fitness"),
                frequency=goal.get("frequency", "daily"),
                target_days=goal.get("target_days"),
                days_of_week=goal.get("days_of_week"),
                reminder_times=goal.get("reminder_times", []),
                goal_type=goal.get("goal_type", request.goal_type),
                duration_days=goal.get("duration_days"),
                target_checkins=goal.get("target_checkins"),
                match_reason=goal.get("match_reason"),
            )
        )

    return GoalTypeSuggestionResponse(
        goal_type=request.goal_type,
        suggestions=suggestions,
    )


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
        .eq("status", "active")
        .execute()
    )

    current_active_count = len(active_goals.data) if active_goals.data else 0

    # Determine if goal CAN be activated (user has room for more active goals)
    # But DON'T activate yet - wait for plan generation to complete
    can_activate = current_active_count < active_goal_limit

    # Prepare goal data for validation
    goal_dict = {
        "frequency": goal_data.frequency,
        "target_days": goal_data.target_days,
        "days_of_week": goal_data.days_of_week or [],
    }

    # Validate goal data
    validate_goal_data(goal_dict)

    # Goals are now only for habits (ongoing, no end date)
    # For time-bound challenges, users should create a Challenge instead

    # Determine tracking_type - default based on category if not provided
    tracking_type = goal_data.tracking_type
    if not tracking_type:
        if goal_data.category == "fitness":
            tracking_type = "workout"
        elif goal_data.category == "nutrition":
            tracking_type = "meal"
        elif (
            goal_data.category == "wellness"
            or goal_data.category == "mindfulness"
            or goal_data.category == "sleep"
        ):
            tracking_type = "checkin"
        else:
            tracking_type = "checkin"

    goal = {
        "user_id": user_id,
        "title": goal_data.title,
        "description": goal_data.description,
        "category": goal_data.category,
        "frequency": goal_data.frequency,
        "target_days": goal_dict.get("target_days"),  # Use validated value
        "days_of_week": goal_data.days_of_week if goal_data.days_of_week else None,
        "reminder_times": goal_data.reminder_times or [],
        "custom_reminder_message": goal_data.custom_reminder_message,
        "tracking_type": tracking_type,  # How user completes check-ins
        # Goal activation
        "status": "active" if can_activate else "paused",
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
            .maybe_single()
            .execute()
        )
        user_profile = (
            profile_result.data if profile_result and profile_result.data else {}
        )

        # Merge timezone and country from users table into user_profile for AI personalization
        # These are needed for locale-specific meal suggestions and time-aware reminders
        user_profile["timezone"] = current_user.get("timezone", "UTC")
        user_profile["country"] = current_user.get("country")

        # Prepare goal data for plan generator
        goal_for_plan = {
            "id": goal_id,
            "title": goal_data.title,
            "description": goal_data.description or "",
            "category": goal_data.category,
            "frequency": goal_data.frequency,
            "target_days": goal_data.target_days,
            "days_of_week": goal_data.days_of_week,  # For scheduling
        }

        # Queue the plan generation task (Celery handles it now)
        # Pass activation info - goal will be activated once plan is ready
        await task_queue.queue_plan_generation(
            goal_id=goal_id,
            goal_data=goal_for_plan,
            user_profile=user_profile,
            user_plan=user_plan,
            # Pass activation context - goal will be activated when plan is ready
            activation_context={
                "can_activate": can_activate,
                "user_timezone": current_user.get("timezone", "UTC"),
                "frequency": goal_data.frequency,
                "days_of_week": goal_data.days_of_week,
            },
        )
        # NOTE: Check-in creation moved to plan_generator task completion

    print(
        f"Goal created for user {user_id}",
        {
            "goal_id": goal_id,
            "status": "active" if can_activate else "paused",
            "can_activate": can_activate,
            "total_goals": total_goals + 1,
        },
    )

    # Check achievements in background (non-blocking) - e.g., "first_goal" badge
    try:
        from app.services.tasks import check_achievements_task

        check_achievements_task.delay(
            user_id=user_id,
            source_type="goal",
            source_id=goal_id,
        )
    except Exception as e:
        logger.warning(
            f"Failed to queue achievement check for goal creation: {e}",
            {"user_id": user_id, "goal_id": goal_id},
        )

    return result.data[0]


@router.get("/{goal_id}/plan-status")
async def get_goal_plan_status(
    goal_id: str, current_user: dict = Depends(get_current_user)
):
    """Get the status of plan generation for a goal. Allows access if user owns the goal or is a partner."""
    from app.core.database import get_supabase_client
    from app.services.task_queue import task_queue

    supabase = get_supabase_client()

    # Verify goal access (owner or partner)
    has_access, goal, is_partner_view = check_goal_access(
        goal_id, current_user["id"], supabase
    )

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found",
        )

    # Partner view: return restricted immediately without querying plan
    if is_partner_view:
        return {
            "goal_id": goal_id,
            "status": "restricted",
        }

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
    """Get the generated actionable plan for a goal. Allows access if user owns the goal or is a partner."""
    from app.core.database import get_supabase_client
    from app.services.task_queue import task_queue

    supabase = get_supabase_client()

    # Verify goal access (owner or partner)
    has_access, goal, is_partner_view = check_goal_access(
        goal_id, current_user["id"], supabase
    )

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found",
        )

    # Privacy: partners cannot view plan details
    if is_partner_view:
        return {
            "goal_id": goal_id,
            "has_plan": True,  # Just indicate plan exists
            "status": "restricted",
            "plan": None,
        }

    plan = await task_queue.get_plan(goal_id)

    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found or not yet generated",
        )

    return {
        "goal_id": goal_id,
        "plan": plan,
        "status": "completed",
    }


@router.post("/{goal_id}/plan/retry")
async def retry_plan_generation(
    goal_id: str, current_user: dict = Depends(get_current_user)
):
    """Retry plan generation for a failed plan"""
    from app.core.database import get_supabase_client
    from app.services.task_queue import task_queue

    supabase = get_supabase_client()
    user_id = current_user["id"]
    user_plan = current_user["plan"]

    # Verify goal belongs to user
    goal_result = (
        supabase.table("goals")
        .select("*")
        .eq("id", goal_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if not goal_result or not goal_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found",
        )

    goal_data = goal_result.data

    # Clear the failed state and re-activate the goal
    supabase.table("goals").update(
        {
            "status": "active",
            "archived_reason": None,
        }
    ).eq("id", goal_id).execute()

    # Get user profile for personalization
    profile_result = (
        supabase.table("user_fitness_profiles")
        .select("*")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    user_profile = profile_result.data if profile_result and profile_result.data else {}

    # Merge timezone and country from users table into user_profile for AI personalization
    user_profile["timezone"] = current_user.get("timezone", "UTC")
    user_profile["country"] = current_user.get("country")

    # Prepare goal data for plan generator
    goal_for_plan = {
        "id": goal_id,
        "title": goal_data["title"],
        "description": goal_data.get("description", ""),
        "category": goal_data["category"],
        "frequency": goal_data["frequency"],
        "target_days": goal_data.get("target_days"),
        "days_of_week": goal_data.get("days_of_week"),  # For scheduling
    }

    # Queue the plan generation task with activation context
    await task_queue.queue_plan_generation(
        goal_id=goal_id,
        goal_data=goal_for_plan,
        user_profile=user_profile,
        user_plan=user_plan,
        activation_context={
            "can_activate": True,  # We already re-activated the goal
            "user_timezone": current_user.get("timezone", "UTC"),
            "frequency": goal_data["frequency"],
            "days_of_week": goal_data.get("days_of_week"),
        },
    )

    print(f"Retrying plan generation for goal {goal_id}")

    return {
        "goal_id": goal_id,
        "status": "generating",
        "message": "Plan generation restarted",
    }


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

    # Privacy filter: hide sensitive schedule data for partner view
    if is_partner_view:
        goal["reminder_times"] = None  # Hide daily schedule

    return goal


@router.put("/{goal_id}", response_model=GoalResponse)
async def update_goal(
    goal_id: str, goal_data: GoalUpdate, current_user: dict = Depends(get_current_user)
):
    """
    Update goal.
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
        .execute()
    )
    if not existing_goal.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    update_data = {k: v for k, v in goal_data.dict().items() if v is not None}

    # Prepare data for validation (merge with existing goal data)
    current_goal = existing_goal.data[0]
    validation_data = {
        "frequency": update_data.get("frequency", current_goal.get("frequency")),
        "target_days": update_data.get("target_days", current_goal.get("target_days")),
        "days_of_week": update_data.get(
            "days_of_week", current_goal.get("days_of_week") or []
        ),
    }

    # Validate if frequency or related fields are being updated
    if any(key in update_data for key in ["frequency", "target_days", "days_of_week"]):
        validate_goal_data(validation_data)

        # Update the update_data with validated values
        if (
            "target_days" not in update_data
            and validation_data.get("frequency") == "daily"
        ):
            update_data["target_days"] = 7

    user_plan = current_user["plan"]
    active_goal_limit = get_user_active_goal_limit(user_plan, supabase)

    # If activating this goal, check active goal limit
    if update_data.get("status") == "active":
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

        # Check if user has reached active goal limit
        if current_active_count >= active_goal_limit:
            plan_name = user_plan.capitalize()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"{plan_name} plan allows only {active_goal_limit} active goal(s). Deactivate another goal first.",
            )

    result = supabase.table("goals").update(update_data).eq("id", goal_id).execute()

    # Notify partners of the goal update
    from app.services.social_accountability_service import social_accountability_service

    await social_accountability_service.notify_partners_of_data_change(
        user_id, "goal_updated"
    )

    return result.data[0]


@router.patch("/{goal_id}/edit", response_model=GoalResponse)
async def edit_goal(
    goal_id: str,
    edit_data: GoalEditRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Edit goal with restricted fields.

    This endpoint is for user-facing edits and only allows changes that
    don't invalidate the AI-generated plan:

    - title: Allowed (plan was based on original, user is warned)
    - description: Allowed (plan was based on original, user is warned)
    - days_of_week: Can ADD days only, cannot REMOVE existing days
    - reminder_times: Allowed (just notification preferences)

    Fields NOT allowed to be edited:
    - category: Plan is category-specific
    - frequency: Affects streaks and plan schedule
    - target_days: Derived from frequency
    - goal_type, tracking_type, etc.: Core plan attributes
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

    current_goal = existing_goal.data
    update_data = {}

    # Title validation
    if edit_data.title is not None:
        title = edit_data.title.strip()
        if len(title) < 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Title must be at least 3 characters",
            )
        if len(title) > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Title must be 100 characters or less",
            )
        update_data["title"] = title

    # Description validation
    if edit_data.description is not None:
        description = edit_data.description.strip()
        if len(description) > 500:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Description must be 500 characters or less",
            )
        update_data["description"] = description

    # Days of week validation - ADD only, no REMOVE
    if edit_data.days_of_week is not None:
        current_days = set(current_goal.get("days_of_week") or [])
        new_days = set(edit_data.days_of_week)

        # Validate day values are valid (0-6)
        if not all(0 <= day <= 6 for day in new_days):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Days of week must be between 0 (Sunday) and 6 (Saturday)",
            )

        # Check for removed days
        removed_days = current_days - new_days
        if removed_days:
            day_names = {
                0: "Sunday",
                1: "Monday",
                2: "Tuesday",
                3: "Wednesday",
                4: "Thursday",
                5: "Friday",
                6: "Saturday",
            }
            removed_names = [day_names[d] for d in sorted(removed_days)]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot remove scheduled days: {', '.join(removed_names)}. You can only add new days.",
            )

        # Only update if there are changes (new days added)
        if new_days != current_days:
            update_data["days_of_week"] = sorted(list(new_days))
            # Also update target_days to match (for weekly goals)
            if current_goal.get("frequency") == "weekly":
                update_data["target_days"] = len(new_days)

    # Reminder times validation
    if edit_data.reminder_times is not None:
        import re

        time_pattern = re.compile(r"^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
        for time_str in edit_data.reminder_times:
            if not time_pattern.match(time_str):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid time format: {time_str}. Use HH:MM format (e.g., 09:00)",
                )
        update_data["reminder_times"] = edit_data.reminder_times

    # If nothing to update, return current goal
    if not update_data:
        return current_goal

    # Update the goal
    result = supabase.table("goals").update(update_data).eq("id", goal_id).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update goal",
        )

    # Notify partners of the goal update
    from app.services.social_accountability_service import social_accountability_service

    await social_accountability_service.notify_partners_of_data_change(
        user_id, "goal_updated"
    )

    logger.info(
        f"Goal {goal_id} edited by user {user_id}",
        {"goal_id": goal_id, "updated_fields": list(update_data.keys())},
    )

    return result.data[0]


@router.delete("/{goal_id}")
async def delete_goal(
    goal_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Delete goal and cleanup associated media.

    Users can delete any goal, including those with check-ins.
    All associated data (check-ins, photos) will be permanently deleted.

    Note: The response includes has_progress to help the client show
    appropriate warnings before confirming deletion.
    """
    from app.core.database import get_supabase_client
    from app.core.config import settings
    from app.services.tasks import delete_media_from_r2_task

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

    # Get all check-ins with photos before deleting (CASCADE will remove them)
    checkins_with_photos = (
        supabase.table("check_ins")
        .select("id, photo_urls")
        .eq("goal_id", goal_id)
        .not_.is_("photo_urls", "null")
        .execute()
    )

    # Collect all photo URLs to delete from R2
    photo_urls_to_delete = []
    if checkins_with_photos.data:
        for checkin in checkins_with_photos.data:
            if checkin.get("photo_urls"):
                photo_urls_to_delete.extend(checkin["photo_urls"])

    # Delete the goal (check-ins will CASCADE delete)
    supabase.table("goals").delete().eq("id", goal_id).execute()

    # Queue background tasks to delete photos from R2
    public_url_base = settings.CLOUDFLARE_R2_PUBLIC_URL.rstrip("/")
    for url in photo_urls_to_delete:
        if url.startswith(public_url_base):
            r2_key = url[len(public_url_base) :].lstrip("/")
            delete_media_from_r2_task.delay(
                file_path=r2_key,
                media_id=f"goal-delete-{goal_id}",
            )

    # Notify partners of the goal deletion
    from app.services.social_accountability_service import social_accountability_service

    await social_accountability_service.notify_partners_of_data_change(
        current_user["id"], "goal_deleted"
    )

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
        "check_in_date": checkin_data.check_in_date.isoformat(),
        "completed": checkin_data.completed,
        "notes": checkin_data.notes,
        "mood": checkin_data.mood,
        "is_checked_in": (
            checkin_data.is_checked_in
            if checkin_data.is_checked_in is not None
            else True
        ),
    }

    result = (
        supabase.table("check_ins")
        .upsert(checkin, on_conflict="goal_id,check_in_date")
        .execute()
    )

    # Notify partners of the check-in
    from app.services.social_accountability_service import social_accountability_service

    await social_accountability_service.notify_partners_of_data_change(
        current_user["id"], "goal_checkin"
    )

    return result.data[0]


@router.get("/{goal_id}/checkins", response_model=List[CheckInResponse])
async def get_goal_checkins(
    goal_id: str,
    current_user: dict = Depends(get_current_user),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
):
    """Get check-ins for a specific goal. Allows access if user owns the goal or is a partner."""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Verify goal access (owner or partner)
    has_access, goal, is_partner_view = check_goal_access(
        goal_id, current_user["id"], supabase
    )
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    # Privacy: partners cannot view check-in history
    if is_partner_view:
        return []  # Return empty - partners don't see check-in details

    query = supabase.table("check_ins").select("*").eq("goal_id", goal_id)

    if start_date:
        query = query.gte("check_in_date", start_date.isoformat())
    if end_date:
        query = query.lte("check_in_date", end_date.isoformat())

    result = query.order("check_in_date", desc=True).execute()
    return result.data or []


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
    Archive a goal (sets status to 'archived').
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
    was_active = existing_goal.data[0].get("status") == "active"

    # Archive goal
    supabase.table("goals").update(
        {
            "status": "archived",
        }
    ).eq("id", goal_id).execute()

    # Notify partners of the goal archive
    from app.services.social_accountability_service import social_accountability_service

    await social_accountability_service.notify_partners_of_data_change(
        user_id, "goal_archived"
    )

    return {"message": "Goal archived successfully"}


@router.post("/{goal_id}/unarchive")
async def unarchive_goal(goal_id: str, current_user: dict = Depends(get_current_user)):
    """Unarchive a goal (sets status to 'active' if within active goal limit)"""
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
        .eq("status", "active")
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
    supabase.table("goals").update(
        {
            "status": "active",
        }
    ).eq("id", goal_id).execute()

    # Notify partners of the goal reactivation
    from app.services.social_accountability_service import social_accountability_service

    await social_accountability_service.notify_partners_of_data_change(
        user_id, "goal_unarchived"
    )

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

    goal = existing_goal.data[0]

    # Check if goal is already active
    if goal.get("status") == "active":
        return {"message": "Goal is already active", "goal": goal}

    # Check if goal is archived (has archived_reason)
    # Allow activation - it will clear the archived_reason

    # Get active goal limit for user's plan (for personal goals only)
    active_goal_limit = get_user_active_goal_limit(user_plan, supabase)

    # Get active personal goals count (not challenges, not group goals)
    current_active_count = get_active_personal_goals_count(user_id, supabase)

    # Check if user has reached active goal limit (None = unlimited)
    if active_goal_limit is not None and current_active_count >= active_goal_limit:
        plan_name = user_plan.capitalize()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{plan_name} plan allows only {active_goal_limit} active goal(s). "
            f"Deactivate another goal first.",
        )

    # Activate this goal and clear archived_reason if needed
    update_data = {
        "status": "active",
    }
    if goal.get("archived_reason"):
        update_data["archived_reason"] = None

    result = supabase.table("goals").update(update_data).eq("id", goal_id).execute()

    if result.data:
        # Notify partners of goal activation
        from app.services.social_accountability_service import (
            social_accountability_service,
        )

        await social_accountability_service.notify_partners_of_data_change(
            user_id, "goal_activated"
        )
        return {"message": "Goal activated successfully", "goal": result.data[0]}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to activate goal",
        )


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
        .execute()
    )
    if not existing_goal.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    # Check if goal is already inactive
    if existing_goal.data[0].get("status") != "active":
        return {"message": "Goal is already inactive", "goal": existing_goal.data[0]}

    # Deactivate goal
    result = (
        supabase.table("goals")
        .update(
            {
                "status": "archived",
            }
        )
        .eq("id", goal_id)
        .execute()
    )

    if result.data:
        # Notify partners of goal deactivation
        from app.services.social_accountability_service import (
            social_accountability_service,
        )

        await social_accountability_service.notify_partners_of_data_change(
            user_id, "goal_deactivated"
        )
        return {"message": "Goal deactivated successfully", "goal": result.data[0]}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deactivate goal",
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
        "status": "active",
    }

    result = supabase.table("goals").insert(duplicate_goal).execute()
    return result.data[0]


@router.get("/{goal_id}/stats")
async def get_goal_stats(goal_id: str, current_user: dict = Depends(get_current_user)):
    """Get statistics for a specific goal from goal_statistics table"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Verify goal belongs to user and get created_at
    goal = (
        supabase.table("goals")
        .select("id, created_at")
        .eq("id", goal_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not goal.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    # Get cached stats from goal_statistics table
    stats_result = (
        supabase.table("goal_statistics")
        .select(
            "total_checkins, completed_checkins, completion_rate, "
            "current_streak, longest_streak, last_checkin_date, "
            "checkins_last_7d, checkins_last_30d, completion_rate_7d, completion_rate_30d"
        )
        .eq("goal_id", goal_id)
        .maybe_single()
        .execute()
    )

    if stats_result.data:
        stats = stats_result.data
        return {
            "goal_id": goal_id,
            "total_check_ins": stats.get("total_checkins", 0),
            "completed_check_ins": stats.get("completed_checkins", 0),
            "completion_rate": float(stats.get("completion_rate", 0)),
            "current_streak": stats.get("current_streak", 0),
            "longest_streak": stats.get("longest_streak", 0),
            "last_check_in": stats.get("last_checkin_date"),
            "checkins_last_7d": stats.get("checkins_last_7d", 0),
            "checkins_last_30d": stats.get("checkins_last_30d", 0),
            "completion_rate_7d": float(stats.get("completion_rate_7d", 0)),
            "completion_rate_30d": float(stats.get("completion_rate_30d", 0)),
            "goal_created": goal.data["created_at"],
        }
    else:
        # No stats yet (new goal with no check-ins)
        return {
            "goal_id": goal_id,
            "total_check_ins": 0,
            "completed_check_ins": 0,
            "completion_rate": 0.0,
            "current_streak": 0,
            "longest_streak": 0,
            "last_check_in": None,
            "checkins_last_7d": 0,
            "checkins_last_30d": 0,
            "completion_rate_7d": 0.0,
            "completion_rate_30d": 0.0,
            "goal_created": goal.data["created_at"],
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
    active_goals = len([g for g in goals if g.get("status") == "active"])
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


# =====================================================
# SHARE AS CHALLENGE
# =====================================================
def get_active_personal_goals_count(user_id: str, supabase) -> int:
    """
    Count active PERSONAL goals only (not challenges).
    Used to enforce active_goal_limit.
    """
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
