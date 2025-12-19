from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import date, datetime
from app.core.flexible_auth import get_current_user
from app.services.logger import logger
import pytz

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
            .eq("date", user_today.isoformat())
            .execute()
        )

        if existing.data:
            print(f"Check-in already exists for goal {goal_id} on {user_today}")
            return

        # Create check-in
        checkin_data = {
            "goal_id": goal_id,
            "user_id": user_id,
            "date": user_today.isoformat(),
            "completed": False,
            "photo_urls": [],
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
    - is_active=false -> cancelled
    - is_active=true, today < start_date -> upcoming
    - is_active=true, start_date <= today <= end_date -> active
    - is_active=true, today > end_date -> completed
    """
    from datetime import date

    today = date.today().isoformat()

    # Count challenges created by user that are ongoing
    # Ongoing = is_active AND end_date >= today (or end_date is null)
    created_result = (
        supabase.table("challenges")
        .select("id, end_date")
        .eq("created_by", user_id)
        .eq("is_active", True)
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
        .select(
            "id, challenge_id, challenges!inner(id, is_active, end_date, created_by)"
        )
        .eq("user_id", user_id)
        .eq("challenges.is_active", True)
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
    is_active: Optional[bool] = None
    custom_reminder_message: Optional[str] = None  # Custom message for reminders
    # Goal type fields (mostly immutable after creation, but allow update)
    goal_type: Optional[str] = None
    target_checkins: Optional[int] = None
    completed_at: Optional[str] = None  # Allow manual completion
    completion_reason: Optional[str] = None


class GoalResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    category: str
    frequency: str
    target_days: Optional[int]
    days_of_week: Optional[List[int]] = None
    reminder_times: Optional[List[str]]
    is_active: bool
    created_at: str
    updated_at: str
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
        .eq("is_active", True)
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

    # Validate goal type
    goal_type = goal_data.goal_type or "habit"
    if goal_type not in GOAL_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid goal_type. Must be one of: {GOAL_TYPES}",
        )

    # Check premium access for challenges
    if goal_type in ["time_challenge", "target_challenge"]:
        from app.core.subscriptions import check_user_has_feature

        has_challenge_create = check_user_has_feature(
            user_id, "challenge_create", user_plan, supabase
        )

        if not has_challenge_create:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Upgrade to paid plan to create challenges. Habits are free for all users.",
            )

    # Validate goal type specific fields
    if goal_type == "target_challenge":
        if not goal_data.target_checkins or goal_data.target_checkins <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="target_checkins is required and must be positive for target challenges",
            )

    # Calculate challenge dates for time challenges
    challenge_start_date = None
    challenge_end_date = None
    if goal_type == "time_challenge":
        if (
            not goal_data.challenge_duration_days
            or goal_data.challenge_duration_days <= 0
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="challenge_duration_days is required for time challenges",
            )
        from datetime import timedelta

        challenge_start_date = date.today()
        # End date is start + (duration - 1) days
        # e.g., 30-day challenge: Day 1 = start, Day 30 = start + 29 days
        challenge_end_date = challenge_start_date + timedelta(
            days=goal_data.challenge_duration_days - 1
        )

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
        # Goal starts ACTIVE immediately - if plan generation fails, it will be deactivated
        # with archived_reason = "failed" so user can retry
        "is_active": can_activate,
        # Goal type fields
        "goal_type": goal_type,
        "challenge_id": goal_data.challenge_id,
        "target_checkins": (
            goal_data.target_checkins if goal_type == "target_challenge" else None
        ),
        "challenge_start_date": (
            challenge_start_date.isoformat() if challenge_start_date else None
        ),
        "challenge_end_date": (
            challenge_end_date.isoformat() if challenge_end_date else None
        ),
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
            profile_result.data if profile_result and profile_result.data else None
        )

        # Prepare goal data for plan generator
        goal_for_plan = {
            "id": goal_id,
            "title": goal_data.title,
            "description": goal_data.description or "",
            "category": goal_data.category,
            "frequency": goal_data.frequency,
            "target_days": goal_data.target_days,
            "days_of_week": goal_data.days_of_week,  # For scheduling
            # Goal type fields for plan generation
            "goal_type": goal_type,
            "target_checkins": (
                goal_data.target_checkins if goal_type == "target_challenge" else None
            ),
            "challenge_duration_days": (
                goal_data.challenge_duration_days
                if goal_type == "time_challenge"
                else None
            ),
            "challenge_start_date": (
                challenge_start_date.isoformat() if challenge_start_date else None
            ),
            "challenge_end_date": (
                challenge_end_date.isoformat() if challenge_end_date else None
            ),
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
            "is_active": can_activate,  # Active immediately, will be deactivated if plan fails
            "can_activate": can_activate,
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

    # Verify goal belongs to user (use maybe_single to handle deleted goals)
    try:
        goal_result = (
            supabase.table("goals")
            .select("id")
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
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
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
        .maybe_single()
        .execute()
    )

    if not goal_result or not goal_result.data:
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
            "is_active": True,
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
    user_profile = (
        profile_result.data if profile_result and profile_result.data else None
    )

    # Prepare goal data for plan generator
    goal_for_plan = {
        "id": goal_id,
        "title": goal_data["title"],
        "description": goal_data.get("description", ""),
        "category": goal_data["category"],
        "frequency": goal_data["frequency"],
        "target_days": goal_data.get("target_days"),
        "days_of_week": goal_data.get("days_of_week"),  # For scheduling
        # Goal type fields for plan generation
        "goal_type": goal_data.get("goal_type", "habit"),
        "target_checkins": goal_data.get("target_checkins"),
        "challenge_duration_days": None,  # Calculate if needed
        "challenge_start_date": goal_data.get("challenge_start_date"),
        "challenge_end_date": goal_data.get("challenge_end_date"),
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

    goal = existing_goal.data[0]

    # Check if goal is already active
    if goal.get("is_active", False):
        return {"message": "Goal is already active", "goal": goal}

    # Check if goal was converted to a challenge (cannot be reactivated)
    if goal.get("archived_reason") == "converted_to_challenge":
        challenge_id = goal.get("converted_to_challenge_id")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This goal was converted to a challenge and cannot be reactivated. "
            + (f"View the challenge instead." if challenge_id else ""),
        )

    # Check if goal is archived for other reasons (has archived_reason but not converted)
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
    update_data = {"is_active": True}
    if (
        goal.get("archived_reason")
        and goal.get("archived_reason") != "converted_to_challenge"
    ):
        update_data["archived_reason"] = None

    result = supabase.table("goals").update(update_data).eq("id", goal_id).execute()

    if result.data:
        return {"message": "Goal activated successfully", "goal": result.data[0]}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to activate goal",
        )


@router.post("/{goal_id}/deactivate")
async def deactivate_goal(goal_id: str, current_user: dict = Depends(get_current_user)):
    """
    Deactivate a goal (sets is_active to False).
    This is the counterpart to activate_goal with clearer naming.
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
    if not existing_goal.data[0].get("is_active", False):
        return {"message": "Goal is already inactive", "goal": existing_goal.data[0]}

    # Deactivate goal (set is_active to False)
    result = (
        supabase.table("goals").update({"is_active": False}).eq("id", goal_id).execute()
    )

    if result.data:
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
        .eq("is_active", True)
        .execute()
    )
    return (
        active_goals.count
        if hasattr(active_goals, "count")
        else len(active_goals.data or [])
    )


class ShareAsChallengeRequest(BaseModel):
    """Request to share a goal as a challenge"""

    title: Optional[str] = None  # Override goal title for challenge
    description: Optional[str] = None  # Override description
    start_date: date  # When the challenge starts
    join_deadline: Optional[date] = (
        None  # Optional deadline to join (defaults to start_date)
    )
    max_participants: Optional[int] = None  # Optional participant limit
    is_public: bool = False  # Whether anyone can join or invite-only
    archive_original_goal: bool = True  # Whether to archive the original goal


class ShareAsChallengeResponse(BaseModel):
    """Response after sharing a goal as a challenge"""

    challenge_id: str
    goal_id: str
    title: str
    start_date: str
    end_date: Optional[str]
    join_deadline: Optional[str]
    is_public: bool
    goal_archived: bool
    message: str


@router.post("/{goal_id}/share-as-challenge", response_model=ShareAsChallengeResponse)
async def share_goal_as_challenge(
    goal_id: str,
    data: ShareAsChallengeRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Share a goal as a challenge that others can join.

    Only works for time_challenge and target_challenge goal types.
    Creates a SELF-CONTAINED challenge with embedded goal data and actionable plan.
    The challenge does not depend on the original goal - it can be deleted.

    If archive_original_goal is True (default):
    - Goal is archived and cannot be reactivated
    - Only challenge tracking remains

    If archive_original_goal is False:
    - Goal remains active for personal tracking
    - Both goal and challenge count toward active limit
    """
    from app.core.database import get_supabase_client
    from app.core.subscriptions import check_user_has_feature
    from datetime import timedelta

    supabase = get_supabase_client()
    user_id = current_user["id"]
    user_plan = current_user.get("plan", "free")

    # Check if user has challenge_create feature
    if not check_user_has_feature(user_id, "challenge_create", user_plan, supabase):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Upgrade your plan to share challenges with friends",
        )

    # Get the goal
    goal_result = (
        supabase.table("goals")
        .select("*")
        .eq("id", goal_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if not goal_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found",
        )

    goal = goal_result.data

    # Verify goal is active (not archived/deactivated)
    if not goal.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive goals cannot be shared as challenges. Activate the goal first.",
        )

    # Verify goal type is challenge-compatible
    goal_type = goal.get("goal_type", "habit")
    if goal_type not in ["time_challenge", "target_challenge"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only time challenges and target challenges can be shared. Habits cannot be shared as challenges.",
        )

    # Check if already converted
    if goal.get("converted_to_challenge_id"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This goal has already been shared as a challenge",
        )

    # Check CHALLENGE limit (separate from goals limit)
    challenge_limit = get_user_challenge_limit(user_plan, supabase)
    current_challenge_count = get_user_challenge_participation_count(user_id, supabase)

    # Check if user can create another challenge (None = unlimited)
    if challenge_limit is not None and current_challenge_count >= challenge_limit:
        plan_name = user_plan.capitalize()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{plan_name} plan allows only {challenge_limit} challenge(s). "
            f"Complete or leave a challenge first to create a new one.",
        )

    # If keeping goal active, also check goal limit
    if not data.archive_original_goal and goal.get("is_active"):
        active_goal_limit = get_user_active_goal_limit(user_plan, supabase)
        current_active_goals = get_active_personal_goals_count(user_id, supabase)
        # The goal is already counted, so no additional check needed
        # Just verify we're not going over if they were to keep the goal active

    # Fetch the actionable plan for this goal (to make challenge self-contained)
    # Table structure: id, goal_id, plan_type, structured_data (JSONB), status, error_message, generated_at
    # structured_data contains: guidance, structure (with routine, schedule, progression, etc.)
    actionable_plan_result = (
        supabase.table("actionable_plans")
        .select("plan_type, structured_data, status, error_message")
        .eq("goal_id", goal_id)
        .maybe_single()
        .execute()
    )
    actionable_plan_data = None
    if actionable_plan_result.data:
        ap = actionable_plan_result.data
        # Just pass plan_type and structured_data as-is - frontend handles the rest
        actionable_plan_data = {
            "status": ap.get("status"),
            "plan_type": ap.get("plan_type"),
            "structured_data": ap.get("structured_data"),
            "error_message": ap.get("error_message"),
        }

    # Build challenge data
    challenge_title = data.title or goal.get("title", "Challenge")
    challenge_description = data.description or goal.get("description", "")

    # Calculate duration and end date
    duration_days = (
        goal.get("challenge_duration_days") or goal.get("duration_days") or 30
    )
    end_date = data.start_date + timedelta(days=duration_days - 1)

    # Validate target_checkins is achievable within duration
    target_checkins = goal.get("target_checkins")
    days_of_week = goal.get("days_of_week") or []
    frequency = goal.get("frequency", "weekly")
    reminder_times = goal.get("reminder_times") or ["07:00"]

    if target_checkins and goal_type == "target_challenge":
        # Calculate max possible check-ins in this duration
        if frequency == "weekly" and days_of_week:
            workout_days_per_week = len(days_of_week)
            weeks = duration_days / 7
            max_checkins = int(workout_days_per_week * weeks * len(reminder_times))
        else:
            # Daily frequency
            max_checkins = duration_days * len(reminder_times)

        if target_checkins > max_checkins:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target of {target_checkins} check-ins is not achievable in {duration_days} days. "
                f"Maximum possible: {max_checkins} check-ins with {len(days_of_week) or 7} workout days per week. "
                f"Either reduce target or increase duration.",
            )

    # Determine challenge type
    if goal_type == "time_challenge":
        challenge_type = "streak"  # Time challenges focus on streaks
    else:
        challenge_type = "checkin_count"  # Target challenges count check-ins

    # Build goal template (SELF-CONTAINED - no FK dependency on original goal)
    goal_template = {
        # Goal structure (copied, not referenced)
        "goal_type": goal_type,
        "category": goal.get("category"),
        "frequency": goal.get("frequency"),
        "target_days": goal.get("target_days"),
        "days_of_week": goal.get("days_of_week"),
        "target_checkins": goal.get("target_checkins"),
        "duration_days": duration_days,
        "reminder_times": goal.get("reminder_times"),
        # The full actionable plan (self-contained)
        "actionable_plan": actionable_plan_data,
    }

    # Create the challenge
    challenge_data = {
        "title": challenge_title,
        "description": challenge_description,
        "challenge_type": challenge_type,
        "duration_days": duration_days,
        "start_date": data.start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "join_deadline": (data.join_deadline or data.start_date).isoformat(),
        "is_public": data.is_public,
        "is_active": True,
        "max_participants": data.max_participants,
        "created_by": user_id,
        "goal_template": goal_template,
        "metadata": {
            "source": "shared_goal",
            "created_at": date.today().isoformat(),
        },
    }

    challenge_result = supabase.table("challenges").insert(challenge_data).execute()

    if not challenge_result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create challenge",
        )

    challenge = challenge_result.data[0]
    challenge_id = challenge["id"]

    # Handle the original goal based on user's choice
    if data.archive_original_goal:
        # Archive the goal - it cannot be reactivated
        supabase.table("goals").update(
            {
                "is_active": False,
                "archived_reason": "converted_to_challenge",
                "converted_to_challenge_id": challenge_id,
            }
        ).eq("id", goal_id).execute()
    else:
        # Keep goal active, just mark it as having a linked challenge
        supabase.table("goals").update(
            {
                "converted_to_challenge_id": challenge_id,
            }
        ).eq("id", goal_id).execute()

    # Add creator as first participant (no goal_id - challenge is self-contained)
    participant_data = {
        "challenge_id": challenge_id,
        "user_id": user_id,
        "progress_data": {},
        "points": 0,
    }
    supabase.table("challenge_participants").insert(participant_data).execute()

    logger.info(
        f"Goal {goal_id} shared as challenge {challenge_id} by user {user_id}",
        {
            "goal_id": goal_id,
            "challenge_id": challenge_id,
            "user_id": user_id,
            "goal_type": goal_type,
            "goal_archived": data.archive_original_goal,
        },
    )

    return ShareAsChallengeResponse(
        challenge_id=challenge_id,
        goal_id=goal_id,
        title=challenge_title,
        start_date=data.start_date.isoformat(),
        end_date=end_date.isoformat(),
        join_deadline=(data.join_deadline or data.start_date).isoformat(),
        is_public=data.is_public,
        goal_archived=data.archive_original_goal,
        message="Goal successfully shared as a challenge!"
        + (" Your goal has been archived." if data.archive_original_goal else ""),
    )
