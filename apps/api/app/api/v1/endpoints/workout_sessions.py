"""
Workout Sessions API Endpoints

Handles workout session tracking:
- Start a workout session
- Update progress during workout
- Complete session
- Get workout history
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.core.database import get_supabase_client
from app.core.flexible_auth import get_current_user
from app.core.entity_validation import validate_entity_is_active_by_id
from app.services.achievement_service import achievement_service
from app.services.logger import logger
from app.services.checkin_service import auto_complete_checkin, can_add_reflection

router = APIRouter()


# ==========================================
# Request/Response Models
# ==========================================


class StartSessionRequest(BaseModel):
    """Request to start a new workout session.

    Either goal_id OR challenge_id must be provided (but not both).
    Challenges are standalone and don't require a goal.
    """

    goal_id: Optional[str] = None
    challenge_id: Optional[str] = None  # For standalone challenges
    plan_id: Optional[str] = None
    exercises_total: int = Field(ge=0)
    sets_total: int = Field(ge=0)


class UpdateSessionRequest(BaseModel):
    """Request to update workout session progress."""

    exercises_completed: Optional[int] = None
    sets_completed: Optional[int] = None
    exercises_skipped: Optional[int] = None
    paused_duration_seconds: Optional[int] = None
    workout_data: Optional[Dict[str, Any]] = None
    # New fields for progress persistence
    current_phase: Optional[str] = None  # warmup, workout, cooldown, rest
    current_exercise_index: Optional[int] = None
    current_set: Optional[int] = None
    current_round: Optional[int] = None
    completion_percentage: Optional[float] = None
    paused_at: Optional[str] = None  # ISO timestamp when paused
    # Feedback rating (submitted on completion summary)
    feedback_rating: Optional[str] = Field(
        None, description="User feedback: hard, just_right, or easy"
    )


class SaveProgressRequest(BaseModel):
    """Request to save workout progress for resume later."""

    current_phase: str = Field(
        ..., description="Current phase: warmup, workout, cooldown, rest"
    )
    current_exercise_index: int = Field(ge=0)
    current_set: int = Field(ge=1, default=1)
    current_round: int = Field(ge=1, default=1)
    completion_percentage: float = Field(ge=0, le=100)
    exercises_completed: int = Field(ge=0, default=0)
    sets_completed: int = Field(ge=0, default=0)
    paused_duration_seconds: int = Field(ge=0, default=0)
    workout_data: Optional[Dict[str, Any]] = None


class SubmitFeedbackRequest(BaseModel):
    """Request to submit workout feedback when quitting.

    Either goal_id OR challenge_id must be provided.
    """

    session_id: Optional[str] = None
    goal_id: Optional[str] = None
    challenge_id: Optional[str] = None  # For standalone challenges
    plan_id: Optional[str] = None
    quit_reason: str = Field(
        ...,
        description="Why user quit: dont_know_how, too_easy, too_hard, just_looking, no_time, other",
    )
    additional_feedback: Optional[str] = None
    exercises_completed: int = Field(ge=0, default=0)
    completion_percentage: float = Field(ge=0, le=100, default=0)
    time_spent_seconds: int = Field(ge=0, default=0)
    current_exercise_name: Optional[str] = Field(
        default=None,
        description="Name of the exercise user was on when they quit (helps improve AI selection)",
    )


class CompleteSessionRequest(BaseModel):
    """Request to complete a workout session."""

    exercises_completed: int = Field(ge=0)
    exercises_skipped: int = Field(ge=0, default=0)
    sets_completed: int = Field(ge=0)
    paused_duration_seconds: int = Field(ge=0, default=0)
    workout_data: Optional[Dict[str, Any]] = None


class WorkoutSession(BaseModel):
    """Workout session response model."""

    id: str
    user_id: str
    goal_id: Optional[str] = None
    challenge_id: Optional[str] = None  # For standalone challenges
    plan_id: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    paused_duration_seconds: int = 0
    total_duration_seconds: Optional[int] = None
    exercises_completed: int = 0
    exercises_total: int = 0
    exercises_skipped: int = 0
    sets_completed: int = 0
    sets_total: int = 0
    workout_data: Dict[str, Any] = {}
    status: str = "in_progress"
    created_at: datetime
    # New progress fields
    current_phase: Optional[str] = "warmup"
    current_exercise_index: Optional[int] = 0
    current_set: Optional[int] = 1
    current_round: Optional[int] = 1
    completion_percentage: Optional[float] = 0
    paused_at: Optional[datetime] = None
    # Practice mode fields
    is_practice_session: Optional[bool] = False
    actual_exercise_time_seconds: Optional[int] = 0
    calories_burned: Optional[int] = 0
    feedback_rating: Optional[str] = None


class WorkoutSessionList(BaseModel):
    """List of workout sessions."""

    sessions: List[WorkoutSession]
    total: int


class CanStartSessionResponse(BaseModel):
    """Response for can-start endpoint."""

    can_start: bool
    is_practice: bool
    reason: str
    sessions_today: int
    allowed_sessions: int
    is_scheduled_day: bool


class CompletedSessionResponse(BaseModel):
    """Enhanced response when completing a session."""

    session: WorkoutSession
    achievements_unlocked: List[Dict[str, Any]]
    streak: Dict[str, Any]
    workout_number_today: int
    is_practice: bool
    can_add_reflection: bool = False  # Whether user can add mood/notes/photo


# ==========================================
# Endpoints
# ==========================================


@router.post("/start", response_model=WorkoutSession)
async def start_workout_session(
    request: StartSessionRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Start a new workout session.

    Called when user begins a workout from the WorkoutPlayerScreen.
    Automatically determines if this is a practice session.

    Either goal_id OR challenge_id must be provided.
    """
    from datetime import date

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Validate: must have either goal_id or challenge_id
    if not request.goal_id and not request.challenge_id:
        raise HTTPException(
            status_code=400, detail="Either goal_id or challenge_id must be provided"
        )

    # Validate that the goal/challenge is active before starting workout
    if request.goal_id:
        validate_entity_is_active_by_id(
            supabase, request.goal_id, "goal", allow_upcoming=False
        )
    else:
        # Challenges can start workout during active status only
        validate_entity_is_active_by_id(
            supabase, request.challenge_id, "challenge", allow_upcoming=False
        )

    try:
        # Build query for existing in-progress session
        existing_query = (
            supabase.table("workout_sessions")
            .select("*")
            .eq("user_id", user_id)
            .eq("status", "in_progress")
            .order("started_at", desc=True)
            .limit(1)
        )

        # Filter by goal_id or challenge_id
        if request.goal_id:
            existing_query = existing_query.eq("goal_id", request.goal_id)
        else:
            existing_query = existing_query.eq("challenge_id", request.challenge_id)

        existing = existing_query.execute()

        # If there's an existing in-progress session, return it (don't create duplicate)
        if existing.data:
            session = existing.data[0]
            logger.info(
                f"Returning existing in-progress session: {session['id']}",
                {
                    "user_id": user_id,
                    "goal_id": request.goal_id,
                    "challenge_id": request.challenge_id,
                },
            )
            return WorkoutSession(**session)

        # Check if this should be a practice session
        is_practice = False
        reminder_times = []
        days_of_week = []
        frequency = "daily"
        allowed_sessions = 1

        # Get goal or challenge details for practice detection
        if request.goal_id:
            goal_result = (
                supabase.table("goals")
                .select("reminder_times, days_of_week, frequency")
                .eq("id", request.goal_id)
                .maybe_single()
                .execute()
            )

            if goal_result.data:
                goal = goal_result.data
                reminder_times = goal.get("reminder_times") or []
                days_of_week = goal.get("days_of_week") or []
                frequency = goal.get("frequency", "daily")
        else:
            # For challenges, get challenge details
            challenge_result = (
                supabase.table("challenges")
                .select("reminder_times, days_of_week, frequency")
                .eq("id", request.challenge_id)
                .maybe_single()
                .execute()
            )

            if challenge_result.data:
                challenge = challenge_result.data
                reminder_times = challenge.get("reminder_times") or []
                days_of_week = challenge.get("days_of_week") or []
                frequency = challenge.get("frequency", "daily")

        allowed_sessions = len(reminder_times) if reminder_times else 1

        # Check if today is scheduled
        today = date.today()
        today_weekday = today.weekday()
        today_day_num = (today_weekday + 1) % 7

        is_scheduled_day = True
        if frequency == "weekly" and days_of_week:
            is_scheduled_day = today_day_num in days_of_week

        if not is_scheduled_day:
            is_practice = True

        # Count completed sessions today
        today_start = datetime.combine(today, datetime.min.time()).replace(
            tzinfo=timezone.utc
        )
        today_end = datetime.combine(today, datetime.max.time()).replace(
            tzinfo=timezone.utc
        )

        completed_query = (
            supabase.table("workout_sessions")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("status", "completed")
            .gte("completed_at", today_start.isoformat())
            .lte("completed_at", today_end.isoformat())
        )

        if request.goal_id:
            completed_query = completed_query.eq("goal_id", request.goal_id)
        else:
            completed_query = completed_query.eq("challenge_id", request.challenge_id)

        completed_today = completed_query.execute()

        sessions_today = completed_today.count or 0
        if sessions_today >= allowed_sessions:
            is_practice = True

        # If this would be a practice session, check if there's already one for today
        # We reuse practice sessions instead of creating duplicates
        if is_practice:
            today = date.today()
            today_start = datetime.combine(today, datetime.min.time()).replace(
                tzinfo=timezone.utc
            )
            today_end = datetime.combine(today, datetime.max.time()).replace(
                tzinfo=timezone.utc
            )

            # Check for existing practice session today (in_progress or completed)
            practice_query = (
                supabase.table("workout_sessions")
                .select("*")
                .eq("user_id", user_id)
                .eq("is_practice_session", True)
                .gte("started_at", today_start.isoformat())
                .lte("started_at", today_end.isoformat())
                .order("started_at", desc=True)
                .limit(1)
            )

            if request.goal_id:
                practice_query = practice_query.eq("goal_id", request.goal_id)
            else:
                practice_query = practice_query.eq("challenge_id", request.challenge_id)

            existing_practice = practice_query.execute()

            if existing_practice.data:
                practice_session = existing_practice.data[0]

                if practice_session["status"] == "in_progress":
                    # Return existing in-progress practice session
                    logger.info(
                        f"Returning existing in-progress practice session: {practice_session['id']}",
                        {"user_id": user_id, "goal_id": request.goal_id},
                    )
                    return WorkoutSession(**practice_session)
                else:
                    # Reset the completed practice session to in_progress (reuse it)
                    reset_data = {
                        "status": "in_progress",
                        "started_at": datetime.now(timezone.utc).isoformat(),
                        "completed_at": None,
                        "exercises_completed": 0,
                        "sets_completed": 0,
                        "exercises_skipped": 0,
                        "paused_duration_seconds": 0,
                        "total_duration_seconds": None,
                        "current_phase": "warmup",
                        "current_exercise_index": 0,
                        "current_set": 1,
                        "current_round": 1,
                        "completion_percentage": 0,
                        "paused_at": None,
                        "exercises_total": request.exercises_total,
                        "sets_total": request.sets_total,
                        "feedback_rating": None,
                    }

                    supabase.table("workout_sessions").update(reset_data).eq(
                        "id", practice_session["id"]
                    ).execute()

                    # Fetch updated session
                    updated = (
                        supabase.table("workout_sessions")
                        .select("*")
                        .eq("id", practice_session["id"])
                        .maybe_single()
                        .execute()
                    )

                    if updated.data:
                        logger.info(
                            f"Reusing practice session (reset to in_progress): {practice_session['id']}",
                            {"user_id": user_id, "goal_id": request.goal_id},
                        )
                        return WorkoutSession(**updated.data)

        # Create new session
        session_data = {
            "user_id": user_id,
            "goal_id": request.goal_id,
            "challenge_id": request.challenge_id,  # May be None for goal-based sessions
            "plan_id": request.plan_id,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "exercises_total": request.exercises_total,
            "sets_total": request.sets_total,
            "status": "in_progress",
            "is_practice_session": is_practice,
        }

        result = supabase.table("workout_sessions").insert(session_data).execute()

        if not result.data:
            raise HTTPException(
                status_code=500, detail="Failed to create workout session"
            )

        session = result.data[0]
        logger.info(
            f"Started workout session: {session['id']} (practice={is_practice})",
            {
                "user_id": user_id,
                "goal_id": request.goal_id,
                "challenge_id": request.challenge_id,
                "is_practice": is_practice,
            },
        )

        return WorkoutSession(**session)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to start workout session: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to start workout session")


@router.patch("/{session_id}", response_model=WorkoutSession)
async def update_workout_session(
    session_id: str,
    request: UpdateSessionRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Update workout session progress.

    Called periodically during workout to save progress.
    """
    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Verify session belongs to user
        existing = (
            supabase.table("workout_sessions")
            .select("*")
            .eq("id", session_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )

        if not existing.data:
            raise HTTPException(status_code=404, detail="Workout session not found")

        # Allow updating feedback_rating even for completed sessions
        is_feedback_only_update = (
            request.feedback_rating is not None
            and request.exercises_completed is None
            and request.sets_completed is None
            and request.exercises_skipped is None
            and request.paused_duration_seconds is None
            and request.workout_data is None
            and request.current_phase is None
            and request.current_exercise_index is None
            and request.current_set is None
            and request.current_round is None
            and request.completion_percentage is None
            and request.paused_at is None
        )

        if existing.data["status"] != "in_progress" and not is_feedback_only_update:
            raise HTTPException(
                status_code=400, detail="Cannot update completed session"
            )

        # Build update data
        update_data = {}
        if request.exercises_completed is not None:
            update_data["exercises_completed"] = request.exercises_completed
        if request.sets_completed is not None:
            update_data["sets_completed"] = request.sets_completed
        if request.exercises_skipped is not None:
            update_data["exercises_skipped"] = request.exercises_skipped
        if request.paused_duration_seconds is not None:
            update_data["paused_duration_seconds"] = request.paused_duration_seconds
        if request.workout_data is not None:
            update_data["workout_data"] = request.workout_data
        # New progress tracking fields
        if request.current_phase is not None:
            update_data["current_phase"] = request.current_phase
        if request.current_exercise_index is not None:
            update_data["current_exercise_index"] = request.current_exercise_index
        if request.current_set is not None:
            update_data["current_set"] = request.current_set
        if request.current_round is not None:
            update_data["current_round"] = request.current_round
        if request.completion_percentage is not None:
            update_data["completion_percentage"] = request.completion_percentage
        if request.paused_at is not None:
            update_data["paused_at"] = request.paused_at
        if request.feedback_rating is not None:
            # Validate feedback rating value
            valid_ratings = ["hard", "just_right", "easy"]
            if request.feedback_rating not in valid_ratings:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid feedback_rating. Must be one of: {valid_ratings}",
                )
            update_data["feedback_rating"] = request.feedback_rating
            logger.info(
                f"Updating feedback rating for session {session_id}",
                {"feedback_rating": request.feedback_rating, "user_id": user_id},
            )

        if not update_data:
            return WorkoutSession(**existing.data)

        # Update the session
        supabase.table("workout_sessions").update(update_data).eq(
            "id", session_id
        ).execute()

        # Fetch the updated session
        result = (
            supabase.table("workout_sessions")
            .select("*")
            .eq("id", session_id)
            .maybe_single()
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update session")

        return WorkoutSession(**result.data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update workout session: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update workout session")


class CompleteSessionRequestV2(BaseModel):
    """Enhanced request to complete a workout session."""

    exercises_completed: int = Field(ge=0)
    exercises_skipped: int = Field(ge=0, default=0)
    sets_completed: int = Field(ge=0)
    paused_duration_seconds: int = Field(ge=0, default=0)
    workout_data: Optional[Dict[str, Any]] = None
    actual_exercise_time_seconds: Optional[int] = None
    exercise_durations: Optional[Dict[str, int]] = None
    calories_burned: Optional[int] = None
    feedback_rating: Optional[str] = Field(
        None, description="User feedback: hard, just_right, or easy"
    )


@router.post("/{session_id}/complete", response_model=CompletedSessionResponse)
async def complete_workout_session(
    session_id: str,
    request: CompleteSessionRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Complete a workout session.

    Called when user finishes workout. Calculates total duration,
    checks for achievement unlocks, and returns streak info.
    """
    from datetime import date

    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Verify session belongs to user
        existing = (
            supabase.table("workout_sessions")
            .select("*")
            .eq("id", session_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )

        if not existing.data:
            raise HTTPException(status_code=404, detail="Workout session not found")

        session = existing.data
        is_practice = session.get("is_practice_session", False)

        # If session is already completed, return existing completion data
        # This handles race conditions where complete is called multiple times
        if session["status"] == "completed":
            # Return the already-completed session with streak/achievement info
            return await _build_completion_response(
                supabase, user_id, session, is_practice
            )

        # Calculate total duration
        started_at = datetime.fromisoformat(
            session["started_at"].replace("Z", "+00:00")
        )
        completed_at = datetime.now(timezone.utc)
        raw_duration = int((completed_at - started_at).total_seconds())
        total_duration = raw_duration - request.paused_duration_seconds

        # Estimate calories if not provided (rough estimate: ~6.5 cal per minute)
        calories = int((total_duration / 60) * 6.5)

        # Update session
        update_data = {
            "status": "completed",
            "completed_at": completed_at.isoformat(),
            "exercises_completed": request.exercises_completed,
            "exercises_skipped": request.exercises_skipped,
            "sets_completed": request.sets_completed,
            "paused_duration_seconds": request.paused_duration_seconds,
            "total_duration_seconds": total_duration,
            "workout_data": request.workout_data or {},
            "calories_burned": calories,
        }

        # Update the session
        supabase.table("workout_sessions").update(update_data).eq(
            "id", session_id
        ).execute()

        # Fetch the completed session
        result = (
            supabase.table("workout_sessions")
            .select("*")
            .eq("id", session_id)
            .maybe_single()
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to complete session")

        completed_session = result.data

        logger.info(
            f"Completed workout session: {session_id}",
            {
                "user_id": user_id,
                "duration_seconds": total_duration,
                "exercises_completed": request.exercises_completed,
                "sets_completed": request.sets_completed,
                "is_practice": is_practice,
            },
        )

        # Build and return completion response with achievements and streak
        return await _build_completion_response(
            supabase, user_id, completed_session, is_practice
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to complete workout session: {str(e)}")
        raise HTTPException(
            status_code=500, detail="Failed to complete workout session"
        )


async def _build_completion_response(
    supabase, user_id: str, session: dict, is_practice: bool
) -> CompletedSessionResponse:
    """
    Build the completion response with streak and achievement info.
    Used for both new completions and returning cached completed sessions.
    """
    from datetime import date

    # Auto-complete check-in for workout tracking goals/challenges (only if not practice)
    goal_id = session.get("goal_id")
    challenge_id = session.get("challenge_id")

    if not is_practice and (goal_id or challenge_id):
        try:
            await auto_complete_checkin(
                user_id=user_id,
                goal_id=goal_id,
                challenge_id=challenge_id,
            )
        except Exception as checkin_error:
            logger.warning(
                f"Failed to auto-complete check-in after workout: {checkin_error}"
            )

    # Check for achievements (only if not practice)
    newly_unlocked = []
    if not is_practice:
        try:
            # Determine source type based on session
            source_type = "challenge" if challenge_id else "goal" if goal_id else None
            source_id = challenge_id or goal_id

            newly_unlocked = await achievement_service.check_and_unlock_achievements(
                user_id=user_id,
                source_type=source_type,
                source_id=source_id,
            )
        except Exception as e:
            logger.warning(f"Achievement check failed: {str(e)}")

    # Get current streak
    streak_info = await _get_streak_info(user_id)

    # Count workouts today
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time()).replace(
        tzinfo=timezone.utc
    )
    today_end = datetime.combine(today, datetime.max.time()).replace(
        tzinfo=timezone.utc
    )

    workouts_today = (
        supabase.table("workout_sessions")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("status", "completed")
        .gte("completed_at", today_start.isoformat())
        .lte("completed_at", today_end.isoformat())
        .execute()
    )

    workout_number_today = workouts_today.count or 1

    # Check if user can add reflection (not practice, scheduled day, no reflection yet)
    reflection_allowed = False
    if not is_practice and (goal_id or challenge_id):
        try:
            reflection_allowed, _ = await can_add_reflection(
                user_id=user_id,
                goal_id=goal_id,
                challenge_id=challenge_id,
            )
        except Exception as e:
            logger.warning(f"Failed to check can_add_reflection: {e}")

    return CompletedSessionResponse(
        session=WorkoutSession(**session),
        achievements_unlocked=newly_unlocked,
        streak=streak_info,
        workout_number_today=workout_number_today,
        is_practice=is_practice,
        can_add_reflection=reflection_allowed,
    )


async def _get_streak_info(user_id: str) -> Dict[str, Any]:
    """Get current streak information for a user."""
    from datetime import date, timedelta

    supabase = get_supabase_client()

    try:
        # Get all completed workout sessions
        result = (
            supabase.table("workout_sessions")
            .select("started_at, is_practice_session")
            .eq("user_id", user_id)
            .eq("status", "completed")
            .order("started_at", desc=True)
            .execute()
        )

        sessions = result.data or []

        if not sessions:
            return {
                "current_streak": 0,
                "longest_streak": 0,
                "milestone_target": 7,
                "days_until_milestone": 7,
                "workout_dates_this_week": [],
            }

        # Get unique workout dates (excluding practice sessions for streak)
        workout_dates = set()
        all_workout_dates = set()

        for session in sessions:
            started_at = session.get("started_at")
            is_practice = session.get("is_practice_session", False)

            if started_at:
                if isinstance(started_at, str):
                    dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
                else:
                    dt = started_at
                workout_date = dt.date()
                all_workout_dates.add(workout_date)
                if not is_practice:
                    workout_dates.add(workout_date)

        # Calculate current streak
        current_streak = 0
        today = date.today()
        check_date = today

        # Check if we worked out today or yesterday
        if today in workout_dates:
            check_date = today
        elif (today - timedelta(days=1)) in workout_dates:
            check_date = today - timedelta(days=1)
        else:
            current_streak = 0

        if check_date == today or check_date == (today - timedelta(days=1)):
            while check_date in workout_dates:
                current_streak += 1
                check_date -= timedelta(days=1)

        # Calculate longest streak
        longest_streak = 0
        if workout_dates:
            sorted_dates = sorted(workout_dates)
            streak = 1
            for i in range(1, len(sorted_dates)):
                if (sorted_dates[i] - sorted_dates[i - 1]).days == 1:
                    streak += 1
                else:
                    longest_streak = max(longest_streak, streak)
                    streak = 1
            longest_streak = max(longest_streak, streak)

        # Determine milestone target
        milestones = [3, 7, 14, 21, 30, 60, 90, 180, 365]
        milestone_target = 7
        for m in milestones:
            if current_streak < m:
                milestone_target = m
                break

        # Get this week's workout dates
        week_start = today - timedelta(days=today.weekday())
        week_dates = []
        for d in all_workout_dates:
            if week_start <= d <= today:
                week_dates.append(d.strftime("%a"))

        return {
            "current_streak": current_streak,
            "longest_streak": longest_streak,
            "milestone_target": milestone_target,
            "days_until_milestone": milestone_target - current_streak,
            "workout_dates_this_week": week_dates,
        }

    except Exception as e:
        logger.error(f"Failed to get streak info: {str(e)}")
        return {
            "current_streak": 0,
            "longest_streak": 0,
            "milestone_target": 7,
            "days_until_milestone": 7,
            "workout_dates_this_week": [],
        }


@router.get("/history", response_model=WorkoutSessionList)
async def get_workout_history(
    goal_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
):
    """
    Get user's workout session history.

    Optionally filter by goal_id or status.
    """
    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Build query
        query = (
            supabase.table("workout_sessions")
            .select("*", count="exact")
            .eq("user_id", user_id)
            .order("started_at", desc=True)
        )

        if goal_id:
            query = query.eq("goal_id", goal_id)

        if status:
            query = query.eq("status", status)

        # Apply pagination
        query = query.range(offset, offset + limit - 1)

        result = query.execute()

        return WorkoutSessionList(
            sessions=[WorkoutSession(**s) for s in result.data],
            total=result.count or len(result.data),
        )

    except Exception as e:
        logger.error(f"Failed to get workout history: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get workout history")


@router.get("/stats")
async def get_workout_stats(
    current_user: dict = Depends(get_current_user),
):
    """
    Get aggregated workout statistics for the user.

    Returns total workouts, duration, completion rate, etc.
    """
    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Get completed sessions
        completed = (
            supabase.table("workout_sessions")
            .select(
                "total_duration_seconds, exercises_completed, exercises_total, sets_completed, started_at"
            )
            .eq("user_id", user_id)
            .eq("status", "completed")
            .execute()
        )

        sessions = completed.data or []

        if not sessions:
            return {
                "total_workouts": 0,
                "total_duration_minutes": 0,
                "total_exercises": 0,
                "total_sets": 0,
                "average_duration_minutes": 0,
                "completion_rate": 0,
                "current_streak": 0,
            }

        # Calculate stats
        total_workouts = len(sessions)
        total_duration = sum(s.get("total_duration_seconds", 0) or 0 for s in sessions)
        total_exercises = sum(s.get("exercises_completed", 0) or 0 for s in sessions)
        total_sets = sum(s.get("sets_completed", 0) or 0 for s in sessions)

        # Calculate completion rate (exercises completed / total)
        total_possible_exercises = sum(
            s.get("exercises_total", 0) or 0 for s in sessions
        )
        completion_rate = (
            (total_exercises / total_possible_exercises * 100)
            if total_possible_exercises > 0
            else 100
        )

        # Calculate current streak (consecutive days with workouts)
        from datetime import date, timedelta

        workout_dates = set()
        for s in sessions:
            if s.get("started_at"):
                started = datetime.fromisoformat(s["started_at"].replace("Z", "+00:00"))
                workout_dates.add(started.date())

        current_streak = 0
        check_date = date.today()

        while check_date in workout_dates:
            current_streak += 1
            check_date -= timedelta(days=1)

        # If no workout today, check if we had one yesterday
        if current_streak == 0 and (date.today() - timedelta(days=1)) in workout_dates:
            check_date = date.today() - timedelta(days=1)
            while check_date in workout_dates:
                current_streak += 1
                check_date -= timedelta(days=1)

        return {
            "total_workouts": total_workouts,
            "total_duration_minutes": round(total_duration / 60),
            "total_exercises": total_exercises,
            "total_sets": total_sets,
            "average_duration_minutes": (
                round(total_duration / total_workouts / 60) if total_workouts > 0 else 0
            ),
            "completion_rate": round(completion_rate, 1),
            "current_streak": current_streak,
        }

    except Exception as e:
        logger.error(f"Failed to get workout stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get workout stats")


@router.get("/can-start/{entity_id}", response_model=CanStartSessionResponse)
async def can_start_session(
    entity_id: str,
    entity_type: str = Query(
        default="goal", description="Entity type: 'goal' or 'challenge'"
    ),
    current_user: dict = Depends(get_current_user),
):
    """
    Check if user can start a new workout session for a goal or challenge.

    Args:
        entity_id: Goal ID or Challenge ID
        entity_type: 'goal' (default) or 'challenge'

    Returns whether this would be a practice session based on:
    - Number of completed sessions today vs scheduled reminders
    - Whether today is a scheduled workout day

    Practice sessions don't count towards streaks or achievements.
    """
    from datetime import date

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Validate entity_type
    if entity_type not in ["goal", "challenge"]:
        raise HTTPException(
            status_code=400, detail="entity_type must be 'goal' or 'challenge'"
        )

    try:
        reminder_times = []
        days_of_week = []
        frequency = "daily"

        if entity_type == "goal":
            # Get goal details
            goal_result = (
                supabase.table("goals")
                .select("reminder_times, days_of_week, frequency")
                .eq("id", entity_id)
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )

            if not goal_result.data:
                raise HTTPException(status_code=404, detail="Goal not found")

            goal = goal_result.data
            reminder_times = goal.get("reminder_times") or []
            days_of_week = goal.get("days_of_week") or []
            frequency = goal.get("frequency", "daily")
        else:
            # Get challenge details
            # For challenges, verify user is a participant
            participant_check = (
                supabase.table("challenge_participants")
                .select("id")
                .eq("challenge_id", entity_id)
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )

            if not participant_check.data:
                raise HTTPException(
                    status_code=404,
                    detail="Challenge not found or you are not a participant",
                )

            challenge_result = (
                supabase.table("challenges")
                .select("reminder_times, days_of_week, frequency")
                .eq("id", entity_id)
                .maybe_single()
                .execute()
            )

            if not challenge_result.data:
                raise HTTPException(status_code=404, detail="Challenge not found")

            challenge = challenge_result.data
            reminder_times = challenge.get("reminder_times") or []
            days_of_week = challenge.get("days_of_week") or []
            frequency = challenge.get("frequency", "daily")

        # Calculate allowed sessions per day
        allowed_sessions = len(reminder_times) if reminder_times else 1

        # Check if today is a scheduled day
        today = date.today()
        today_weekday = today.weekday()  # 0=Monday, 6=Sunday
        # Convert to 0=Sunday format to match days_of_week storage
        today_day_num = (today_weekday + 1) % 7

        is_scheduled_day = True
        if frequency == "weekly" and days_of_week:
            is_scheduled_day = today_day_num in days_of_week

        # Count completed sessions today
        today_start = datetime.combine(today, datetime.min.time()).replace(
            tzinfo=timezone.utc
        )
        today_end = datetime.combine(today, datetime.max.time()).replace(
            tzinfo=timezone.utc
        )

        # Build query based on entity type
        completed_query = (
            supabase.table("workout_sessions")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("status", "completed")
            .gte("completed_at", today_start.isoformat())
            .lte("completed_at", today_end.isoformat())
        )

        if entity_type == "goal":
            completed_query = completed_query.eq("goal_id", entity_id)
        else:
            completed_query = completed_query.eq("challenge_id", entity_id)

        completed_today = completed_query.execute()
        sessions_today = completed_today.count or 0

        # Determine if this would be a practice session
        is_practice = False
        reason = "Ready to start your workout!"

        if not is_scheduled_day:
            is_practice = True
            reason = "This is a practice session (not your scheduled day)."
        elif sessions_today >= allowed_sessions:
            is_practice = True
            reason = f"Practice session (you've completed {sessions_today}/{allowed_sessions} today)."

        return CanStartSessionResponse(
            can_start=True,  # Always allow starting, just mark as practice
            is_practice=is_practice,
            reason=reason,
            sessions_today=sessions_today,
            allowed_sessions=allowed_sessions,
            is_scheduled_day=is_scheduled_day,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to check can-start: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to check session status")


@router.get("/active/{entity_id}")
async def get_active_session(
    entity_id: str,
    entity_type: str = Query(
        default="goal", description="Entity type: 'goal' or 'challenge'"
    ),
    current_user: dict = Depends(get_current_user),
):
    """
    Get active in-progress session for a goal or challenge.

    Args:
        entity_id: Goal ID or Challenge ID
        entity_type: 'goal' (default) or 'challenge'

    Used to check if user can resume a workout.
    Returns the session with progress if found, null if no active session.
    """
    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Validate entity_type
    if entity_type not in ["goal", "challenge"]:
        raise HTTPException(
            status_code=400, detail="entity_type must be 'goal' or 'challenge'"
        )

    try:
        # Build query based on entity type
        query = (
            supabase.table("workout_sessions")
            .select("*")
            .eq("user_id", user_id)
            .eq("status", "in_progress")
            .order("started_at", desc=True)
            .limit(1)
        )

        if entity_type == "goal":
            query = query.eq("goal_id", entity_id)
        else:
            query = query.eq("challenge_id", entity_id)

        result = query.execute()

        if not result.data:
            return {"session": None, "can_resume": False}

        session = result.data[0]

        return {
            "session": WorkoutSession(**session),
            "can_resume": True,
            "completion_percentage": session.get("completion_percentage", 0),
            "current_phase": session.get("current_phase", "warmup"),
            "current_exercise_index": session.get("current_exercise_index", 0),
        }

    except Exception as e:
        logger.error(f"Failed to get active session: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get active session")


@router.post("/{session_id}/save-progress", response_model=WorkoutSession)
async def save_workout_progress(
    session_id: str,
    request: SaveProgressRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Save workout progress for later resume.

    Called when user pauses or backgrounds the app.
    Allows them to continue from the exact point later.
    """
    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Verify session belongs to user
        existing = (
            supabase.table("workout_sessions")
            .select("*")
            .eq("id", session_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )

        if not existing.data:
            raise HTTPException(status_code=404, detail="Workout session not found")

        session_status = existing.data["status"]

        # If session is already completed, just return it (don't error)
        # This handles race conditions where complete is called before save-progress finishes
        if session_status == "completed":
            return WorkoutSession(**existing.data)

        # Update with progress data
        update_data = {
            "current_phase": request.current_phase,
            "current_exercise_index": request.current_exercise_index,
            "current_set": request.current_set,
            "current_round": request.current_round,
            "completion_percentage": request.completion_percentage,
            "exercises_completed": request.exercises_completed,
            "sets_completed": request.sets_completed,
            "paused_duration_seconds": request.paused_duration_seconds,
            "paused_at": datetime.utcnow().isoformat(),
        }

        if request.workout_data:
            update_data["workout_data"] = request.workout_data

        # Update the session
        supabase.table("workout_sessions").update(update_data).eq(
            "id", session_id
        ).execute()

        # Fetch the updated session
        result = (
            supabase.table("workout_sessions")
            .select("*")
            .eq("id", session_id)
            .maybe_single()
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to save progress")

        return WorkoutSession(**result.data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save workout progress: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to save workout progress")


@router.post("/feedback")
async def submit_workout_feedback(
    request: SubmitFeedbackRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Submit feedback when user quits a workout.

    This feedback helps improve workout recommendations.
    """
    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Validate quit_reason
        valid_reasons = [
            "dont_know_how",
            "too_easy",
            "too_hard",
            "just_looking",
            "no_time",
            "other",
        ]
        if request.quit_reason not in valid_reasons:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid quit_reason. Must be one of: {', '.join(valid_reasons)}",
            )

        # Validate: must have either goal_id or challenge_id
        if not request.goal_id and not request.challenge_id:
            raise HTTPException(
                status_code=400,
                detail="Either goal_id or challenge_id must be provided",
            )

        # Insert feedback
        feedback_data = {
            "user_id": user_id,
            "session_id": request.session_id,
            "goal_id": request.goal_id,
            "challenge_id": request.challenge_id,  # May be None for goal-based feedback
            "plan_id": request.plan_id,
            "quit_reason": request.quit_reason,
            "additional_feedback": request.additional_feedback,
            "exercises_completed": request.exercises_completed,
            "completion_percentage": request.completion_percentage,
            "time_spent_seconds": request.time_spent_seconds,
            "exercise_name": request.current_exercise_name,  # Track which exercise caused quit
        }

        result = supabase.table("workout_feedback").insert(feedback_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to submit feedback")

        logger.info(
            f"Workout feedback submitted",
            {
                "user_id": user_id,
                "reason": request.quit_reason,
                "completion": request.completion_percentage,
            },
        )

        # If there's an active session, save progress (keep status in_progress for resume)
        # This allows users to come back and continue their workout later
        if request.session_id:
            try:
                supabase.table("workout_sessions").update(
                    {
                        "completion_percentage": request.completion_percentage,
                        "exercises_completed": request.exercises_completed,
                        "paused_at": datetime.utcnow().isoformat(),
                        # Keep status as "in_progress" so user can resume
                    }
                ).eq("id", request.session_id).eq("user_id", user_id).eq(
                    "status", "in_progress"
                ).execute()
            except Exception:
                pass  # Don't fail if session update fails

        return {
            "success": True,
            "feedback_id": result.data[0]["id"],
            "message": "Thank you for your feedback!",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to submit workout feedback: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to submit feedback")


class WorkoutReflectionRequest(BaseModel):
    """Request to update workout reflection (mood, notes, photo) after completion."""

    goal_id: Optional[str] = None
    challenge_id: Optional[str] = None
    mood: Optional[str] = Field(
        None, description="Mood: great, good, okay, bad, terrible"
    )
    notes: Optional[str] = None
    photo_url: Optional[str] = None


@router.post("/reflection")
async def save_workout_reflection(
    request: WorkoutReflectionRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Save workout reflection data (mood, notes, photo) after completing a workout.

    This updates the check-in that was auto-completed when the workout finished.
    Validates that:
    - Check-in exists for today
    - It's a scheduled day
    - Reflection hasn't already been recorded

    Either goal_id OR challenge_id must be provided.
    """
    supabase = get_supabase_client()
    user_id = current_user["id"]

    if not request.goal_id and not request.challenge_id:
        raise HTTPException(
            status_code=400, detail="Either goal_id or challenge_id is required"
        )

    # Validate mood if provided
    if request.mood:
        valid_moods = ["great", "good", "okay", "bad", "terrible"]
        if request.mood not in valid_moods:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid mood. Must be one of: {valid_moods}",
            )

    try:
        # Validate that reflection can be added
        can_add, check_in_id = await can_add_reflection(
            user_id=user_id,
            goal_id=request.goal_id,
            challenge_id=request.challenge_id,
        )

        if not can_add:
            logger.info(
                f"Cannot add reflection - validation failed",
                {
                    "user_id": user_id,
                    "goal_id": request.goal_id,
                    "challenge_id": request.challenge_id,
                },
            )
            return {
                "success": False,
                "message": "Cannot add reflection - check-in not found, not a scheduled day, or reflection already recorded",
            }

        update_data = {}
        if request.mood:
            update_data["mood"] = request.mood
        if request.notes is not None:
            update_data["notes"] = request.notes
        if request.photo_url is not None:
            update_data["photo_url"] = request.photo_url

        if not update_data:
            return {"success": True, "message": "No data to update"}

        # Update the check-in by ID (already validated)
        table_name = "check_ins" if request.goal_id else "challenge_check_ins"
        result = (
            supabase.table(table_name)
            .update(update_data)
            .eq("id", check_in_id)
            .execute()
        )

        if result.data:
            logger.info(
                f"Updated {table_name} reflection",
                {
                    "user_id": user_id,
                    "goal_id": request.goal_id,
                    "challenge_id": request.challenge_id,
                    "check_in_id": check_in_id,
                },
            )
            return {
                "success": True,
                "message": "Reflection saved",
                "check_in_id": check_in_id,
            }
        else:
            return {"success": False, "message": "Failed to update check-in"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save workout reflection: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to save reflection")
