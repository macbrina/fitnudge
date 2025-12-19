"""
Workout Sessions API Endpoints

Handles workout session tracking:
- Start a workout session
- Update progress during workout
- Complete session
- Get workout history
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.core.database import get_supabase_client
from app.core.flexible_auth import get_current_user
from app.services.achievement_service import achievement_service
from app.services.logger import logger

router = APIRouter()


# ==========================================
# Request/Response Models
# ==========================================


class StartSessionRequest(BaseModel):
    """Request to start a new workout session."""

    goal_id: str
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
    """Request to submit workout feedback when quitting."""

    session_id: Optional[str] = None
    goal_id: str
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
    goal_id: Optional[str]
    plan_id: Optional[str]
    started_at: datetime
    completed_at: Optional[datetime]
    paused_duration_seconds: int
    total_duration_seconds: Optional[int]
    exercises_completed: int
    exercises_total: int
    exercises_skipped: int
    sets_completed: int
    sets_total: int
    workout_data: Dict[str, Any]
    status: str
    created_at: datetime
    # New progress fields
    current_phase: Optional[str] = "warmup"
    current_exercise_index: Optional[int] = 0
    current_set: Optional[int] = 1
    current_round: Optional[int] = 1
    completion_percentage: Optional[float] = 0
    paused_at: Optional[datetime] = None


class WorkoutSessionList(BaseModel):
    """List of workout sessions."""

    sessions: List[WorkoutSession]
    total: int


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
    """
    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Check for existing in-progress session for this goal
        # Check for existing in-progress session
        existing = (
            supabase.table("workout_sessions")
            .select("*")
            .eq("user_id", user_id)
            .eq("goal_id", request.goal_id)
            .eq("status", "in_progress")
            .order("started_at", desc=True)
            .limit(1)
            .execute()
        )

        # If there's an existing in-progress session, return it (don't create duplicate)
        if existing.data:
            session = existing.data[0]
            logger.info(
                f"Returning existing in-progress session: {session['id']}",
                {"user_id": user_id, "goal_id": request.goal_id},
            )
            return WorkoutSession(**session)

        # Create new session only if no existing one
        session_data = {
            "user_id": user_id,
            "goal_id": request.goal_id,
            "plan_id": request.plan_id,
            "started_at": datetime.utcnow().isoformat(),
            "exercises_total": request.exercises_total,
            "sets_total": request.sets_total,
            "status": "in_progress",
        }

        result = supabase.table("workout_sessions").insert(session_data).execute()

        if not result.data:
            raise HTTPException(
                status_code=500, detail="Failed to create workout session"
            )

        session = result.data[0]
        logger.info(
            f"Started workout session: {session['id']}",
            {"user_id": user_id, "goal_id": request.goal_id},
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

        if existing.data["status"] != "in_progress":
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


@router.post("/{session_id}/complete", response_model=WorkoutSession)
async def complete_workout_session(
    session_id: str,
    request: CompleteSessionRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Complete a workout session.

    Called when user finishes workout. Calculates total duration
    and checks for achievement unlocks.
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

        session = existing.data

        if session["status"] != "in_progress":
            raise HTTPException(status_code=400, detail="Session already completed")

        # Calculate total duration
        started_at = datetime.fromisoformat(
            session["started_at"].replace("Z", "+00:00")
        )
        completed_at = datetime.utcnow()
        raw_duration = int((completed_at - started_at).total_seconds())
        total_duration = raw_duration - request.paused_duration_seconds

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
            },
        )

        # Check for achievements in background
        try:
            await achievement_service.check_and_unlock_achievements(
                user_id=user_id, goal_id=session.get("goal_id")
            )
        except Exception as e:
            logger.warning(f"Achievement check failed: {str(e)}")

        return WorkoutSession(**completed_session)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to complete workout session: {str(e)}")
        raise HTTPException(
            status_code=500, detail="Failed to complete workout session"
        )


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


@router.get("/active/{goal_id}")
async def get_active_session(
    goal_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Get active in-progress session for a goal.

    Used to check if user can resume a workout.
    Returns the session with progress if found, null if no active session.
    """
    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        result = (
            supabase.table("workout_sessions")
            .select("*")
            .eq("user_id", user_id)
            .eq("goal_id", goal_id)
            .eq("status", "in_progress")
            .order("started_at", desc=True)
            .limit(1)
            .execute()
        )

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

        if existing.data["status"] != "in_progress":
            raise HTTPException(
                status_code=400, detail="Cannot save progress on completed session"
            )

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

        # Insert feedback
        feedback_data = {
            "user_id": user_id,
            "session_id": request.session_id,
            "goal_id": request.goal_id,
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
