"""
Tracking Stats API endpoints

Provides tracking-type-specific statistics for goals and challenges.
Supports workout, meal, hydration, and general check-in tracking types.
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import Optional, List, Tuple
from datetime import date, timedelta
from app.core.flexible_auth import get_current_user
from app.core.database import get_supabase_client
from app.services.logger import logger

router = APIRouter(redirect_slashes=False)


# =============================================================================
# Access Control Helpers
# =============================================================================


def check_goal_access_for_stats(
    goal_id: str, current_user_id: str, supabase
) -> Tuple[bool, Optional[dict], bool]:
    """
    Check if user can access a goal's stats (owner or partner).

    Returns:
        Tuple of (has_access, goal_data, is_partner_view)
    """
    # First, try to find the goal (without user filter)
    goal_result = (
        supabase.table("goals")
        .select("id, user_id, tracking_type")
        .eq("id", goal_id)
        .maybe_single()
        .execute()
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


def check_challenge_access_for_stats(
    challenge_id: str, current_user_id: str, supabase
) -> Tuple[bool, Optional[dict], bool]:
    """
    Check if user can access a challenge's stats.

    Access granted if:
    - Challenge is public
    - User is the creator
    - User is a participant
    - User is a partner of a participant

    Returns:
        Tuple of (has_access, challenge_data, is_partner_view)
    """
    # Get challenge data
    challenge_result = (
        supabase.table("challenges")
        .select("id, created_by, is_public, tracking_type")
        .eq("id", challenge_id)
        .maybe_single()
        .execute()
    )

    if not challenge_result or not challenge_result.data:
        return False, None, False

    challenge = challenge_result.data
    is_public = challenge.get("is_public", False)
    is_creator = challenge.get("created_by") == current_user_id

    # Check if user is a participant
    participant_result = (
        supabase.table("challenge_participants")
        .select("id")
        .eq("challenge_id", challenge_id)
        .eq("user_id", current_user_id)
        .maybe_single()
        .execute()
    )
    is_participant = bool(participant_result and participant_result.data)

    # Case 1: Public challenge - anyone can view
    if is_public:
        return True, challenge, False

    # Case 2: Creator always has access
    if is_creator:
        return True, challenge, False

    # Case 3: Participant has access
    if is_participant:
        return True, challenge, False

    # Case 4: Check if user is a partner of any participant
    participants_result = (
        supabase.table("challenge_participants")
        .select("user_id")
        .eq("challenge_id", challenge_id)
        .execute()
    )

    if participants_result and participants_result.data:
        participant_ids = [p["user_id"] for p in participants_result.data]

        for participant_id in participant_ids:
            partnership_result = (
                supabase.table("accountability_partners")
                .select("id")
                .eq("status", "accepted")
                .or_(
                    f"and(user_id.eq.{current_user_id},partner_user_id.eq.{participant_id}),"
                    f"and(user_id.eq.{participant_id},partner_user_id.eq.{current_user_id})"
                )
                .maybe_single()
                .execute()
            )

            if partnership_result and partnership_result.data:
                return True, challenge, True  # Partner view

    return False, None, False


# =============================================================================
# Response Models
# =============================================================================


class WorkoutStats(BaseModel):
    """Workout-specific statistics"""

    total_workouts: int
    total_duration_minutes: int
    workouts_this_week: int
    avg_duration_minutes: float
    exercises_completed: int
    total_calories_burned: int
    rest_days: int
    period_days: int


class MealStats(BaseModel):
    """Meal-specific statistics"""

    total_meals_logged: int
    meals_this_week: int
    avg_meals_per_day: float
    total_calories: int
    total_protein: int
    avg_calories_per_day: float
    avg_protein_per_day: float
    healthy_meals: int
    okay_meals: int
    unhealthy_meals: int
    healthy_meal_percentage: float
    okay_meal_percentage: float
    unhealthy_meal_percentage: float
    period_days: int


class HydrationStats(BaseModel):
    """Hydration-specific statistics"""

    total_intake_ml: int
    avg_daily_intake_ml: float
    days_target_hit: int
    target_hit_percentage: float
    intake_today_ml: int
    daily_target_ml: int
    period_days: int


class CheckinStats(BaseModel):
    """General check-in statistics"""

    total_checkins: int
    completed_checkins: int
    completion_rate: float
    avg_mood: Optional[float]
    mood_trend: List[dict]  # [{date, mood}]
    period_days: int


class TrackingStatsResponse(BaseModel):
    """Combined tracking stats response"""

    tracking_type: str
    entity_type: str  # "goal" or "challenge"
    entity_id: str
    period_days: int
    workout: Optional[WorkoutStats] = None
    meal: Optional[MealStats] = None
    hydration: Optional[HydrationStats] = None
    checkin: Optional[CheckinStats] = None


# =============================================================================
# Helper Functions
# =============================================================================


def get_week_start() -> date:
    """Get Monday of current week"""
    today = date.today()
    days_since_monday = today.weekday()
    return today - timedelta(days=days_since_monday)


async def get_workout_stats(
    user_id: str,
    entity_id: str,
    entity_type: str,
    period_days: int,
) -> WorkoutStats:
    """Get workout-specific statistics using pre-aggregated daily summaries for performance"""
    supabase = get_supabase_client()
    start_date = date.today() - timedelta(days=period_days - 1)
    week_start = get_week_start()

    # Query pre-aggregated daily_workout_summaries instead of raw workout_sessions
    query = (
        supabase.table("daily_workout_summaries")
        .select(
            "summary_date, workout_count, total_duration_seconds, total_exercises_completed, total_calories_burned"
        )
        .eq("user_id", user_id)
        .gte("summary_date", start_date.isoformat())
    )

    if entity_type == "goal":
        query = query.eq("goal_id", entity_id)
    else:
        query = query.eq("challenge_id", entity_id)

    result = query.execute()
    summaries = result.data or []

    # Aggregate from daily summaries
    total_workouts = sum(s.get("workout_count", 0) for s in summaries)
    total_duration_seconds = sum(s.get("total_duration_seconds", 0) for s in summaries)
    total_duration_minutes = total_duration_seconds // 60
    total_exercises = sum(s.get("total_exercises_completed", 0) for s in summaries)
    total_calories = sum(s.get("total_calories_burned", 0) for s in summaries)

    # Count workouts this week from summaries
    workouts_this_week = sum(
        s.get("workout_count", 0)
        for s in summaries
        if s.get("summary_date") and s["summary_date"] >= week_start.isoformat()
    )

    # Days with workouts = number of summary records with workout_count > 0
    workout_days = sum(1 for s in summaries if s.get("workout_count", 0) > 0)

    avg_duration = total_duration_minutes / total_workouts if total_workouts > 0 else 0

    # Rest days = days in period without any workout
    rest_days = period_days - workout_days

    return WorkoutStats(
        total_workouts=total_workouts,
        total_duration_minutes=total_duration_minutes,
        workouts_this_week=workouts_this_week,
        avg_duration_minutes=round(avg_duration, 1),
        exercises_completed=total_exercises,
        total_calories_burned=total_calories,
        rest_days=rest_days,
        period_days=period_days,
    )


async def get_meal_stats(
    user_id: str,
    entity_id: str,
    entity_type: str,
    period_days: int,
) -> MealStats:
    """Get meal-specific statistics using pre-aggregated daily summaries for performance"""
    supabase = get_supabase_client()
    start_date = date.today() - timedelta(days=period_days - 1)
    week_start = get_week_start()

    # Query pre-aggregated daily_nutrition_summaries instead of raw meal_logs
    query = (
        supabase.table("daily_nutrition_summaries")
        .select(
            "summary_date, total_calories, total_protein, meal_count, healthy_meal_count, okay_meal_count, unhealthy_meal_count"
        )
        .eq("user_id", user_id)
        .gte("summary_date", start_date.isoformat())
    )

    if entity_type == "goal":
        query = query.eq("goal_id", entity_id)
    else:
        query = query.eq("challenge_id", entity_id)

    result = query.execute()
    summaries = result.data or []

    # Aggregate from daily summaries
    total_meals = sum(s.get("meal_count", 0) for s in summaries)
    total_calories = sum(s.get("total_calories", 0) for s in summaries)
    total_protein = sum(s.get("total_protein", 0) for s in summaries)
    healthy_meals = sum(s.get("healthy_meal_count", 0) for s in summaries)
    okay_meals = sum(s.get("okay_meal_count", 0) for s in summaries)
    unhealthy_meals = sum(s.get("unhealthy_meal_count", 0) for s in summaries)

    # Count meals this week from summaries
    meals_this_week = sum(
        s.get("meal_count", 0)
        for s in summaries
        if s.get("summary_date") and s["summary_date"] >= week_start.isoformat()
    )

    # Days with meals = number of summary records
    days_with_meals = len(summaries)

    avg_meals_per_day = total_meals / days_with_meals if days_with_meals > 0 else 0
    avg_calories = total_calories / days_with_meals if days_with_meals > 0 else 0
    avg_protein = total_protein / days_with_meals if days_with_meals > 0 else 0

    # Calculate percentages
    healthy_percentage = (healthy_meals / total_meals * 100) if total_meals > 0 else 0
    okay_percentage = (okay_meals / total_meals * 100) if total_meals > 0 else 0
    unhealthy_percentage = (
        (unhealthy_meals / total_meals * 100) if total_meals > 0 else 0
    )

    return MealStats(
        total_meals_logged=total_meals,
        meals_this_week=meals_this_week,
        avg_meals_per_day=round(avg_meals_per_day, 1),
        total_calories=total_calories,
        total_protein=total_protein,
        avg_calories_per_day=round(avg_calories, 0),
        avg_protein_per_day=round(avg_protein, 0),
        healthy_meals=healthy_meals,
        okay_meals=okay_meals,
        unhealthy_meals=unhealthy_meals,
        healthy_meal_percentage=round(healthy_percentage, 1),
        okay_meal_percentage=round(okay_percentage, 1),
        unhealthy_meal_percentage=round(unhealthy_percentage, 1),
        period_days=period_days,
    )


async def get_hydration_stats(
    user_id: str,
    entity_id: str,
    entity_type: str,
    period_days: int,
    daily_target_ml: int = 2000,
) -> HydrationStats:
    """Get hydration-specific statistics using pre-aggregated daily summaries for performance"""
    supabase = get_supabase_client()
    start_date = date.today() - timedelta(days=period_days - 1)
    today = date.today()

    # Query pre-aggregated daily_hydration_summaries instead of raw hydration_logs
    query = (
        supabase.table("daily_hydration_summaries")
        .select("summary_date, total_amount_ml, log_count, target_ml")
        .eq("user_id", user_id)
        .gte("summary_date", start_date.isoformat())
    )

    if entity_type == "goal":
        query = query.eq("goal_id", entity_id)
    else:
        query = query.eq("challenge_id", entity_id)

    result = query.execute()
    summaries = result.data or []

    # Aggregate from daily summaries
    total_intake = sum(s.get("total_amount_ml", 0) for s in summaries)
    days_with_logs = len(summaries)
    avg_daily = total_intake / days_with_logs if days_with_logs > 0 else 0

    # Count days where target was hit
    days_target_hit = sum(
        1
        for s in summaries
        if s.get("total_amount_ml", 0) >= (s.get("target_ml") or daily_target_ml)
    )
    target_percentage = (days_target_hit / period_days * 100) if period_days > 0 else 0

    # Get today's intake from summaries
    today_summary = next(
        (s for s in summaries if s.get("summary_date") == today.isoformat()), None
    )
    intake_today = today_summary.get("total_amount_ml", 0) if today_summary else 0

    # Use target from today's summary if available
    actual_target = (
        today_summary.get("target_ml") if today_summary else None
    ) or daily_target_ml

    return HydrationStats(
        total_intake_ml=total_intake,
        avg_daily_intake_ml=round(avg_daily, 0),
        days_target_hit=days_target_hit,
        target_hit_percentage=round(target_percentage, 1),
        intake_today_ml=intake_today,
        daily_target_ml=actual_target,
        period_days=period_days,
    )


async def get_checkin_stats(
    user_id: str,
    entity_id: str,
    entity_type: str,
    period_days: int,
) -> CheckinStats:
    """Get general check-in statistics using pre-aggregated summaries where possible"""
    supabase = get_supabase_client()
    start_date = date.today() - timedelta(days=period_days - 1)

    total = 0
    completed = 0
    avg_mood = None
    mood_trend = []

    if entity_type == "goal":
        # Use daily_checkin_summaries for totals (optimized)
        summary_result = (
            supabase.table("daily_checkin_summaries")
            .select("summary_date, scheduled_count, completed_count, avg_mood")
            .eq("user_id", user_id)
            .eq("goal_id", entity_id)
            .gte("summary_date", start_date.isoformat())
            .execute()
        )
        summaries = summary_result.data or []

        # Aggregate from summaries
        total = sum(s.get("scheduled_count", 0) for s in summaries)
        completed = sum(s.get("completed_count", 0) for s in summaries)

        # Calculate weighted average mood from summaries
        mood_values = [
            s.get("avg_mood") for s in summaries if s.get("avg_mood") is not None
        ]
        if mood_values:
            avg_mood = sum(mood_values) / len(mood_values)

        # For mood trend, we need daily breakdown (last 7 days)
        # Use summary data which already has avg_mood per day
        for i in range(min(7, period_days)):
            check_date = (date.today() - timedelta(days=i)).isoformat()
            day_summary = next(
                (s for s in summaries if s.get("summary_date") == check_date), None
            )
            if day_summary and day_summary.get("avg_mood") is not None:
                mood_trend.append(
                    {"date": check_date, "mood": round(float(day_summary["avg_mood"]))}
                )
        mood_trend.reverse()  # Oldest first
    else:
        # For challenges, still query raw check_ins (no summary table for challenge_check_ins yet)
        result = (
            supabase.table("challenge_check_ins")
            .select("id, check_in_date, mood, is_checked_in")
            .eq("user_id", user_id)
            .eq("challenge_id", entity_id)
            .gte("check_in_date", start_date.isoformat())
            .execute()
        )
        checkins = result.data or []
        total = len(checkins)
        completed = sum(1 for c in checkins if c.get("is_checked_in"))

        # Mood analysis for challenges
        mood_map = {"terrible": 1, "bad": 2, "okay": 3, "good": 4, "great": 5}
        moods = [mood_map.get(c.get("mood"), 0) for c in checkins if c.get("mood")]
        if moods:
            avg_mood = sum(moods) / len(moods)

        # Mood trend for challenges
        for i in range(min(7, period_days)):
            check_date = (date.today() - timedelta(days=i)).isoformat()
            day_moods = [
                mood_map.get(c.get("mood"), 0)
                for c in checkins
                if c.get("check_in_date") == check_date and c.get("mood")
            ]
            if day_moods:
                mood_trend.append(
                    {"date": check_date, "mood": round(sum(day_moods) / len(day_moods))}
                )
        mood_trend.reverse()

    completion_rate = (completed / total * 100) if total > 0 else 0

    return CheckinStats(
        total_checkins=total,
        completed_checkins=completed,
        completion_rate=round(completion_rate, 1),
        avg_mood=round(avg_mood, 1) if avg_mood else None,
        mood_trend=mood_trend,
        period_days=period_days,
    )


# =============================================================================
# API Endpoints
# =============================================================================


@router.get("", response_model=TrackingStatsResponse)
async def get_tracking_stats(
    current_user: dict = Depends(get_current_user),
    entity_id: str = Query(..., description="Goal or Challenge ID"),
    entity_type: str = Query("goal", regex="^(goal|challenge)$"),
    tracking_type: str = Query("checkin", regex="^(workout|meal|hydration|checkin)$"),
    period: int = Query(30, ge=7, le=365, description="Number of days"),
):
    """
    Get tracking-type-specific statistics for a goal or challenge.

    Supports partner access - partners can view each other's tracking stats.

    - **entity_id**: The goal or challenge ID
    - **entity_type**: "goal" or "challenge"
    - **tracking_type**: "workout", "meal", "hydration", or "checkin"
    - **period**: Number of days to analyze (default: 30)
    """
    user_id = current_user["id"]
    supabase = get_supabase_client()

    try:
        # Verify access (owner or partner)
        if entity_type == "goal":
            has_access, goal_data, is_partner_view = check_goal_access_for_stats(
                entity_id, user_id, supabase
            )
            if not has_access or not goal_data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Goal not found",
                )
            # Use goal's tracking_type if not specified
            actual_tracking_type = goal_data.get("tracking_type") or tracking_type
            # For partner view, use the goal owner's ID for stats queries
            stats_user_id = goal_data.get("user_id") if is_partner_view else user_id
        else:
            has_access, challenge_data, is_partner_view = (
                check_challenge_access_for_stats(entity_id, user_id, supabase)
            )
            if not has_access or not challenge_data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Challenge not found or access denied",
                )
            actual_tracking_type = challenge_data.get("tracking_type") or tracking_type
            # For challenges, stats are user-specific, use current user's ID
            # (partner viewing shows their partner's participation in the challenge)
            stats_user_id = user_id

        # Get hydration target from user profile if hydration tracking
        daily_target_ml = 2000
        if actual_tracking_type == "hydration":
            profile_result = (
                supabase.table("user_fitness_profiles")
                .select("hydration_daily_target_ml")
                .eq("user_id", stats_user_id)
                .maybe_single()
                .execute()
            )
            if profile_result.data:
                daily_target_ml = profile_result.data.get(
                    "hydration_daily_target_ml", 2000
                )

        # Build response based on tracking type
        response = TrackingStatsResponse(
            tracking_type=actual_tracking_type,
            entity_type=entity_type,
            entity_id=entity_id,
            period_days=period,
        )

        if actual_tracking_type == "workout":
            workout_stats = await get_workout_stats(
                stats_user_id, entity_id, entity_type, period
            )
            # Privacy filter: partners see summary only
            if is_partner_view:
                workout_stats.total_calories_burned = 0  # Hide health metric
                workout_stats.exercises_completed = 0  # Hide detailed count
            response.workout = workout_stats
        elif actual_tracking_type == "meal":
            meal_stats = await get_meal_stats(
                stats_user_id, entity_id, entity_type, period
            )
            # Privacy filter: partners see summary only, hide detailed health data
            if is_partner_view:
                meal_stats.total_calories = 0
                meal_stats.total_protein = 0
                meal_stats.avg_calories_per_day = 0
                meal_stats.avg_protein_per_day = 0
            response.meal = meal_stats
        elif actual_tracking_type == "hydration":
            hydration_stats = await get_hydration_stats(
                stats_user_id, entity_id, entity_type, period, daily_target_ml
            )
            # Privacy filter: partners see summary only
            if is_partner_view:
                hydration_stats.total_intake_ml = 0  # Hide exact amounts
                hydration_stats.avg_daily_intake_ml = 0
                hydration_stats.intake_today_ml = 0
                hydration_stats.daily_target_ml = 0
            response.hydration = hydration_stats
        else:
            checkin_stats = await get_checkin_stats(
                stats_user_id, entity_id, entity_type, period
            )
            # Privacy filter: partners see summary only, hide mood data
            if is_partner_view:
                checkin_stats.avg_mood = None
                checkin_stats.mood_trend = []
            response.checkin = checkin_stats

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to get tracking stats for {entity_type} {entity_id}: {str(e)}",
            {"error": str(e), "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get tracking stats",
        )
