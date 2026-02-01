"""
Goal Tasks - V2.1

Celery tasks for goal-related operations.

V2.1 Architecture Notes:
- Check-ins are PRE-CREATED daily with status='pending' by precreate_daily_checkins_task
- Users UPDATE pending check-ins when responding (status -> completed/skipped/rest_day)
- mark_missed_checkins_task marks remaining 'pending' as 'missed' at end of day
- Streaks are stored on goals table and updated O(1) after each check-in
- Daily task resets streaks for missed days (batch operation)
- Weekly task processes weekly goal streaks
"""

from typing import Dict, Any, List
from datetime import datetime, timedelta
from app.services.tasks.base import celery_app, get_supabase_client, logger


# =====================================================
# DAILY CHECK-IN PRE-CREATION TASK (Runs Hourly)
# =====================================================


@celery_app.task(
    name="precreate_daily_checkins",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def precreate_daily_checkins_task(self) -> Dict[str, Any]:
    """
    Pre-creates check-ins for all active goals for today.

    Runs HOURLY to catch all timezones as their day starts.
    Uses PostgreSQL function for O(1) batch operation.

    Flow:
    1. Call precreate_checkins_for_date(CURRENT_DATE) PostgreSQL function
    2. Function creates check-ins with status='pending' for all active goals
       where today is a scheduled day (daily goals or weekly goals on target days)
    3. Trigger on goal INSERT also creates check-ins, so this catches existing goals
    4. Invalidate analytics cache for users who got new check-ins

    Scalability: Single batch INSERT, no loops, handles 100K+ goals efficiently.
    Uses ON CONFLICT DO NOTHING to avoid duplicates.
    """
    from app.services.tasks.analytics_refresh_tasks import (
        invalidate_user_analytics_cache,
    )

    try:
        supabase = get_supabase_client()

        # Call PostgreSQL function for batch pre-creation
        # Returns list of {user_id, goal_id} for each newly inserted check-in
        result = supabase.rpc(
            "precreate_checkins_for_date",
            {
                "p_target_date": datetime.utcnow().date().isoformat(),
            },
        ).execute()

        # result.data is now a list of {out_user_id, out_goal_id} dicts
        # (columns renamed to avoid PL/pgSQL variable conflict)
        inserted_rows = result.data if result.data else []
        inserted_count = len(inserted_rows)

        # Trigger Live Activity refresh (server-driven Mode B) for affected users.
        # We dedupe by user_id to avoid N per goal.
        try:
            from app.services.tasks.live_activity_tasks import (
                refresh_live_activity_for_user_task,
            )
            from app.services.tasks.nextup_fcm_tasks import (
                refresh_nextup_fcm_for_user_task,
            )

            affected_user_ids = {
                row.get("out_user_id")
                for row in inserted_rows
                if row.get("out_user_id")
            }
            for uid in affected_user_ids:
                # Fire-and-forget: don't block precreate task on APNs.
                refresh_live_activity_for_user_task.delay(str(uid))
                refresh_nextup_fcm_for_user_task.delay(str(uid))
        except Exception:
            # Never fail check-in precreation due to live activity errors.
            pass

        # Invalidate analytics cache for each user/goal that got a new check-in
        # This ensures fresh data when they view analytics
        invalidated_count = 0
        for row in inserted_rows:
            try:
                invalidate_user_analytics_cache(row["out_user_id"], row["out_goal_id"])
                invalidated_count += 1
            except Exception:
                # Don't fail the whole task if cache invalidation fails
                pass

        logger.info(
            f"Pre-created daily check-ins",
            {"inserted_count": inserted_count, "caches_invalidated": invalidated_count},
        )

        return {
            "success": True,
            "inserted_count": inserted_count,
            "caches_invalidated": invalidated_count,
        }

    except Exception as e:
        logger.error(f"Failed to pre-create daily check-ins: {e}")
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        return {"success": False, "error": str(e)}


# =====================================================
# MARK MISSED CHECK-INS TASK (Runs Hourly)
# =====================================================


@celery_app.task(
    name="mark_missed_checkins",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def mark_missed_checkins_task(self) -> Dict[str, Any]:
    """
    Marks pending check-ins as 'missed' when their day has passed.

    Runs HOURLY to catch all timezones as their day ends.
    Uses PostgreSQL function for O(1) batch operation.

    Flow:
    1. Call mark_missed_checkins_batch() PostgreSQL function
    2. Function finds check-ins where:
       - status = 'pending'
       - check_in_date < user's current date (day has passed in their timezone)
    3. Updates status to 'missed'

    Scalability: Single batch UPDATE, no loops, handles 100K+ goals efficiently.
    """
    try:
        supabase = get_supabase_client()

        # Call PostgreSQL function for batch marking
        result = supabase.rpc("mark_missed_checkins_batch").execute()

        affected_count = result.data if result.data else 0

        logger.info(
            f"Marked missed check-ins",
            {"affected_count": affected_count},
        )

        return {
            "success": True,
            "affected_count": affected_count,
        }

    except Exception as e:
        logger.error(f"Failed to mark missed check-ins: {e}")
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        return {"success": False, "error": str(e)}


# =====================================================
# CATCH-UP MISSING CHECK-INS TASK (Manual - After Maintenance)
# =====================================================


@celery_app.task(
    name="catchup_missing_checkins",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def catchup_missing_checkins_task(
    self,
    start_date: str | None = None,
    end_date: str | None = None,
    lookback_days: int | None = None,
) -> Dict[str, Any]:
    """
    Backfills missing check-ins for a date range after maintenance/downtime.

    Can be called in two ways:
    1. Auto mode: Provide lookback_days (or use default 7) to auto-detect missing dates
    2. Manual mode: Provide start_date (and optionally end_date) when you know exact dates

    Flow:
    1. If lookback_days provided: Call catchup_missing_checkins_auto(lookback_days)
    2. Else: Call catchup_missing_checkins(start_date, end_date)
    3. Function creates check-ins with status='pending' for all active goals
       where each date in the range is a scheduled day
    4. The mark_missed_checkins_task (runs hourly) will immediately mark these
       as 'missed' since the days have already passed
    5. Analytics will show them as "missed" (accurate, even if not user fault)

    Args:
        start_date: Start date in YYYY-MM-DD format (manual mode)
        end_date: End date in YYYY-MM-DD format (manual mode, defaults to yesterday)
        lookback_days: Number of days to look back (auto mode, defaults to 7)

    Returns:
        Dict with success status and results per date

    Scalability: Uses PostgreSQL function with batch operations.
    """
    from datetime import datetime, date

    try:
        supabase = get_supabase_client()

        # Auto mode: use lookback_days to auto-detect
        if lookback_days is not None or (start_date is None and end_date is None):
            lookback = lookback_days if lookback_days is not None else 7

            logger.info(
                f"Catch-up missing check-ins (auto mode)",
                {"lookback_days": lookback},
            )

            # Call auto-detection function
            result = supabase.rpc(
                "catchup_missing_checkins_auto",
                {"p_lookback_days": lookback},
            ).execute()

            results = result.data if result.data else []
            total_inserted = sum(r.get("inserted_count", 0) for r in results)

            logger.info(
                f"Catch-up missing check-ins (auto) completed",
                {
                    "lookback_days": lookback,
                    "dates_processed": len(results),
                    "total_inserted": total_inserted,
                },
            )

            return {
                "success": True,
                "mode": "auto",
                "lookback_days": lookback,
                "dates_processed": len(results),
                "total_inserted": total_inserted,
                "results": results,
            }

        # Manual mode: use provided dates
        if not start_date:
            return {
                "success": False,
                "error": "Either start_date or lookback_days must be provided",
            }

        # Validate and parse dates
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            return {
                "success": False,
                "error": f"Invalid start_date format: {start_date}. Use YYYY-MM-DD",
            }

        if end_date:
            try:
                end = datetime.strptime(end_date, "%Y-%m-%d").date()
            except ValueError:
                return {
                    "success": False,
                    "error": f"Invalid end_date format: {end_date}. Use YYYY-MM-DD",
                }
        else:
            # Default to yesterday
            end = (datetime.utcnow() - timedelta(days=1)).date()

        # Validate date range
        if start > end:
            return {
                "success": False,
                "error": f"start_date ({start_date}) must be <= end_date ({end_date})",
            }

        if end >= datetime.utcnow().date():
            return {
                "success": False,
                "error": f"end_date ({end_date}) must be < today",
            }

        logger.info(
            f"Catch-up missing check-ins (manual mode)",
            {"start_date": start_date, "end_date": end_date or "yesterday"},
        )

        # Call PostgreSQL catch-up function
        result = supabase.rpc(
            "catchup_missing_checkins",
            {
                "p_start_date": start.isoformat(),
                "p_end_date": end.isoformat(),
            },
        ).execute()

        # result.data is a list of {out_date, inserted_count, total_goals} dicts
        results = result.data if result.data else []
        total_inserted = sum(r.get("inserted_count", 0) for r in results)

        logger.info(
            f"Catch-up missing check-ins (manual) completed",
            {
                "start_date": start_date,
                "end_date": end_date or "yesterday",
                "dates_processed": len(results),
                "total_inserted": total_inserted,
            },
        )

        return {
            "success": True,
            "mode": "manual",
            "start_date": start_date,
            "end_date": end_date or "yesterday",
            "dates_processed": len(results),
            "total_inserted": total_inserted,
            "results": results,
        }

    except Exception as e:
        logger.error(f"Failed to catch-up missing check-ins: {e}")
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        return {"success": False, "error": str(e)}


# =====================================================
# DAILY STREAK RESET TASK (Runs Hourly)
# =====================================================


@celery_app.task(
    name="reset_missed_streaks",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def reset_missed_streaks_task(self) -> Dict[str, Any]:
    """
    Resets streaks for goals where yesterday was a target day but no check-in.

    Runs HOURLY to catch all timezones.
    Uses PostgreSQL function for O(1) batch operation.

    Scalability: Single batch UPDATE, no loops, handles 100K+ goals efficiently.
    """
    try:
        supabase = get_supabase_client()

        # Call PostgreSQL function for batch reset
        result = supabase.rpc("reset_missed_streaks_batch").execute()

        affected_count = result.data if result.data else 0

        logger.info(
            f"Reset missed streaks batch completed",
            {"affected_count": affected_count},
        )

        return {
            "success": True,
            "affected_count": affected_count,
        }

    except Exception as e:
        logger.error(f"Failed to reset missed streaks: {e}")
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        return {"success": False, "error": str(e)}


# =====================================================
# WEEKLY COMPLETIONS RESET TASK (Runs Mondays)
# =====================================================


@celery_app.task(
    name="reset_weekly_completions",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def reset_weekly_completions_task(self) -> Dict[str, Any]:
    """
    Resets week_completions counter for weekly goals at start of new week.

    Note: Streaks are managed per check-in (same as daily goals).
    This task only resets the "X/Y this week" counter for UI display.

    Runs every MONDAY at midnight UTC.
    Uses PostgreSQL function for O(1) batch operation.
    """
    try:
        supabase = get_supabase_client()

        # Call PostgreSQL function for batch reset
        result = supabase.rpc("reset_weekly_completions_batch").execute()

        affected_count = result.data if result.data else 0

        logger.info(
            f"Weekly completions reset",
            {"affected_count": affected_count},
        )

        return {
            "success": True,
            "affected_count": affected_count,
        }

    except Exception as e:
        logger.error(f"Failed to reset weekly completions: {e}")
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        return {"success": False, "error": str(e)}


@celery_app.task(
    name="detect_user_patterns_single",
    bind=True,
    max_retries=1,
)
def detect_user_patterns_single_task(self, user_id: str) -> Dict[str, Any]:
    """
    Refresh AI pattern insights for a single user.
    Called on-demand when user opens AI coach chat.
    """
    import asyncio
    from app.services.ai_insights_service import get_ai_insights_service

    async def refresh_user():
        insights_service = get_ai_insights_service()
        return await insights_service.refresh_all_for_user(user_id)

    try:
        result = asyncio.run(refresh_user())

        return {
            "success": True,
            "user_id": user_id,
            "refreshed": result.get("refreshed", 0),
            "skipped": result.get("skipped", 0),
            "failed": result.get("failed", 0),
        }

    except Exception as e:
        logger.error(f"Failed to refresh insights for user {user_id}: {e}")
        return {"success": False, "error": str(e)}


# =====================================================
# SINGLE GOAL INSIGHTS TASK (Background - On-Demand)
# =====================================================


@celery_app.task(
    name="generate_goal_insights",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
)
def generate_goal_insights_task(self, goal_id: str, user_id: str) -> Dict[str, Any]:
    """
    Generate AI pattern insights for a single goal.

    Called when user views a goal and insights need to be generated.
    Runs in background so API returns immediately with 'generating' status.
    Realtime subscription updates the UI when complete.
    """
    import asyncio
    from app.services.ai_insights_service import get_ai_insights_service

    async def generate():
        insights_service = get_ai_insights_service()
        return await insights_service.generate_insights_background(goal_id, user_id)

    try:
        result = asyncio.run(generate())

        logger.info(
            f"Generated insights for goal {goal_id}",
            {
                "goal_id": goal_id,
                "user_id": user_id,
                "status": result.get("status"),
            },
        )

        return {
            "success": True,
            "goal_id": goal_id,
            "status": result.get("status"),
        }

    except Exception as e:
        logger.error(f"Failed to generate insights for goal {goal_id}: {e}")

        # Mark as failed in database
        try:
            supabase = get_supabase_client()
            supabase.table("pattern_insights").upsert(
                {
                    "goal_id": goal_id,
                    "user_id": user_id,
                    "status": "failed",
                    "error_message": str(e),
                },
                on_conflict="goal_id",
            ).execute()
        except Exception:
            pass

        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        return {"success": False, "error": str(e)}


# =====================================================
# BUILD AI CONTEXT TASK
# =====================================================


@celery_app.task(name="build_ai_context")
def build_ai_context_task(user_id: str) -> Dict[str, Any]:
    """
    Build comprehensive AI context for a user.
    Called before AI coach chat or check-in response generation.

    Uses PostgreSQL function for efficient aggregation.
    """
    try:
        supabase = get_supabase_client()

        result = supabase.rpc("build_ai_context", {"p_user_id": user_id}).execute()

        context = result.data if result.data else {}

        return {
            "success": True,
            "context": context,
        }

    except Exception as e:
        logger.error(f"Failed to build AI context for user {user_id}: {e}")
        return {"success": False, "error": str(e)}


# =====================================================
# STREAK UPDATE TASK
# =====================================================
