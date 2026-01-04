"""
Hydration Tracking API endpoints
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime
import traceback
from app.core.flexible_auth import get_current_user
from app.core.database import get_supabase_client
from app.core.entity_validation import validate_entity_is_active_by_id
from app.services.logger import logger
from app.services.checkin_service import auto_complete_checkin

router = APIRouter(redirect_slashes=False)


# Common presets (in milliliters)
HYDRATION_PRESETS = {
    "glass": 237,  # 1 glass = 8 oz = 237 ml
    "bottle": 500,  # Small bottle = 500 ml
    "large_bottle": 750,  # Large bottle = 750 ml
    "liter": 1000,  # 1 liter
}


# Pydantic models
class HydrationLogCreate(BaseModel):
    amount_ml: int  # Amount in milliliters
    logged_date: Optional[date] = None  # Defaults to today
    goal_id: Optional[str] = None
    challenge_id: Optional[str] = None


class HydrationLogResponse(BaseModel):
    id: str
    user_id: str
    goal_id: Optional[str]
    challenge_id: Optional[str]
    amount_ml: int
    logged_date: date
    logged_at: str
    created_at: str


class DailyHydrationSummary(BaseModel):
    logged_date: date
    total_amount_ml: int
    log_count: int
    goal_id: Optional[str] = None
    challenge_id: Optional[str] = None
    target_ml: Optional[int] = None  # User's daily target
    progress_percentage: float = 0.0


class HydrationPresetsResponse(BaseModel):
    """Available hydration presets"""

    glass_ml: int = 237
    bottle_ml: int = 500
    large_bottle_ml: int = 750
    liter_ml: int = 1000


@router.get("/presets", response_model=HydrationPresetsResponse)
async def get_hydration_presets(
    current_user: dict = Depends(get_current_user),
):
    """Get available hydration presets with ml values"""
    return HydrationPresetsResponse()


@router.post(
    "/", response_model=HydrationLogResponse, status_code=status.HTTP_201_CREATED
)
async def log_hydration(
    log_data: HydrationLogCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Log water intake.

    Common presets:
    - 1 glass = 237 ml (8 oz)
    - 1 bottle = 500 ml
    - 1 large bottle = 750 ml
    """
    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        if log_data.amount_ml <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Amount must be positive",
            )

        # Validate that the goal/challenge is active before logging
        if log_data.goal_id:
            validate_entity_is_active_by_id(
                supabase, log_data.goal_id, "goal", allow_upcoming=False
            )
        if log_data.challenge_id:
            validate_entity_is_active_by_id(
                supabase, log_data.challenge_id, "challenge", allow_upcoming=False
            )

        # Verify goal belongs to user if provided
        if log_data.goal_id:
            goal = (
                supabase.table("goals")
                .select("id, user_id")
                .eq("id", log_data.goal_id)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            goal_data = goal.data[0] if goal.data and len(goal.data) > 0 else None

            if not goal_data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Goal not found or you don't have permission",
                )

        # Verify challenge participation if provided
        if log_data.challenge_id:
            participant = (
                supabase.table("challenge_participants")
                .select("id")
                .eq("challenge_id", log_data.challenge_id)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            participant_data = (
                participant.data[0]
                if participant.data and len(participant.data) > 0
                else None
            )

            if not participant_data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Challenge not found or you are not a participant",
                )

        logged_date = log_data.logged_date or date.today()

        hydration_data = {
            "user_id": user_id,
            "goal_id": log_data.goal_id,
            "challenge_id": log_data.challenge_id,
            "amount_ml": log_data.amount_ml,
            "logged_date": logged_date.isoformat(),
        }

        result = supabase.table("hydration_logs").insert(hydration_data).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to log hydration",
            )

        # Auto-complete check-in for hydration tracking goals/challenges
        if log_data.goal_id or log_data.challenge_id:
            try:
                await auto_complete_checkin(
                    user_id=user_id,
                    goal_id=log_data.goal_id,
                    challenge_id=log_data.challenge_id,
                    checkin_date=logged_date,
                )
            except Exception as checkin_error:
                logger.warning(
                    f"Failed to auto-complete check-in after hydration log: {checkin_error}"
                )

        # Check achievements in background (non-blocking) - e.g., "first_hydration" badge
        try:
            from app.services.tasks import check_achievements_task

            check_achievements_task.delay(
                user_id=user_id,
                source_type="hydration",
                source_id=result.data[0].get("id"),
            )
        except Exception as e:
            logger.warning(
                f"Failed to queue achievement check for hydration log: {e}",
                {"user_id": user_id},
            )

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"[HYDRATION] Failed to log hydration for user {user_id} {str(e)}",
            {
                "error": str(e),
                "error_type": type(e).__name__,
                "user_id": user_id,
                "traceback": traceback.format_exc(),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to log hydration: {str(e)}",
        )


@router.get("/", response_model=List[HydrationLogResponse])
async def get_hydration_logs(
    current_user: dict = Depends(get_current_user),
    logged_date: Optional[date] = Query(None, description="Filter by date"),
    goal_id: Optional[str] = Query(None),
    challenge_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Get hydration logs for the current user"""
    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        query = supabase.table("hydration_logs").select("*").eq("user_id", user_id)

        if logged_date:
            query = query.eq("logged_date", logged_date.isoformat())
        if goal_id:
            query = query.eq("goal_id", goal_id)
        if challenge_id:
            query = query.eq("challenge_id", challenge_id)

        result = (
            query.order("logged_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )

        return result.data if result.data else []

    except Exception as e:
        logger.error(
            f"Failed to get hydration logs for user {user_id}",
            {"error": str(e), "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get hydration logs",
        )


@router.get("/summary/{summary_date}", response_model=DailyHydrationSummary)
async def get_daily_hydration_summary(
    summary_date: date,
    current_user: dict = Depends(get_current_user),
    goal_id: Optional[str] = Query(None),
    challenge_id: Optional[str] = Query(None),
):
    """Get daily hydration summary for a specific date.

    Uses the pre-aggregated daily_hydration_summaries table for performance.
    Falls back to calculating from raw logs if summary doesn't exist.
    """
    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # First, try to get from pre-aggregated summary table (faster)
        summary_query = (
            supabase.table("daily_hydration_summaries")
            .select("*")
            .eq("user_id", user_id)
            .eq("summary_date", summary_date.isoformat())
        )

        if goal_id:
            summary_query = summary_query.eq("goal_id", goal_id)
        else:
            summary_query = summary_query.is_("goal_id", "null")

        if challenge_id:
            summary_query = summary_query.eq("challenge_id", challenge_id)
        else:
            summary_query = summary_query.is_("challenge_id", "null")

        summary_result = summary_query.limit(1).execute()

        if summary_result.data and len(summary_result.data) > 0:
            # Use pre-aggregated data
            summary = summary_result.data[0]
            total_amount = summary.get("total_amount_ml", 0)
            log_count = summary.get("log_count", 0)
            target_ml = summary.get("target_ml", 2000)
        else:
            # Fallback: Calculate from raw logs (for edge cases)
            query = (
                supabase.table("hydration_logs")
                .select("amount_ml")
                .eq("user_id", user_id)
                .eq("logged_date", summary_date.isoformat())
            )

            if goal_id:
                query = query.eq("goal_id", goal_id)
            if challenge_id:
                query = query.eq("challenge_id", challenge_id)

            result = query.execute()
            logs = result.data if result.data else []
            total_amount = sum(log.get("amount_ml", 0) for log in logs)
            log_count = len(logs)

            # Get user's daily target from profile
            profile_result = (
                supabase.table("user_fitness_profiles")
                .select("hydration_daily_target_ml")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )

            target_ml = 2000  # Default: 8 glasses
            if profile_result.data and len(profile_result.data) > 0:
                target_ml = (
                    profile_result.data[0].get("hydration_daily_target_ml", 2000)
                    or 2000
                )

        progress_percentage = (total_amount / target_ml * 100) if target_ml > 0 else 0

        return DailyHydrationSummary(
            logged_date=summary_date,
            total_amount_ml=total_amount,
            log_count=log_count,
            goal_id=goal_id,
            challenge_id=challenge_id,
            target_ml=target_ml,
            progress_percentage=min(progress_percentage, 100),  # Cap at 100%
        )

    except Exception as e:
        logger.error(
            f"Failed to get hydration summary for user {user_id}",
            {"error": str(e), "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get hydration summary",
        )


@router.delete("/{log_id}")
async def delete_hydration_log(
    log_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a hydration log"""
    supabase = get_supabase_client()
    user_id = current_user["id"]

    try:
        # Verify log belongs to user
        log = (
            supabase.table("hydration_logs")
            .select("id")
            .eq("id", log_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        log_data = log.data[0] if log.data and len(log.data) > 0 else None

        if not log_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hydration log not found or you don't have permission",
            )

        supabase.table("hydration_logs").delete().eq("id", log_id).eq(
            "user_id", user_id
        ).execute()

        return {"message": "Hydration log deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to delete hydration log {log_id} for user {user_id}",
            {"error": str(e), "log_id": log_id, "user_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete hydration log",
        )
