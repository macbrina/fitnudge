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

        # result.data is now a list of {user_id, goal_id} dicts
        inserted_rows = result.data if result.data else []
        inserted_count = len(inserted_rows)

        # Invalidate analytics cache for each user/goal that got a new check-in
        # This ensures fresh data when they view analytics
        invalidated_count = 0
        for row in inserted_rows:
            try:
                invalidate_user_analytics_cache(row["user_id"], row["goal_id"])
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


# =====================================================
# AI PATTERN INSIGHTS TASK (Premium - Runs Weekly)
# =====================================================


@celery_app.task(
    name="detect_patterns",
    bind=True,
    max_retries=1,
    default_retry_delay=300,
)
def detect_patterns_task(self) -> Dict[str, Any]:
    """
    Refreshes AI-generated pattern insights for all premium users.
    Uses the AI insights service for intelligent pattern detection.

    Runs WEEKLY (Sunday evening).
    Processes users sequentially to manage API rate limits.
    """
    import asyncio
    from app.services.ai_insights_service import get_ai_insights_service

    async def refresh_all_users():
        supabase = get_supabase_client()
        insights_service = get_ai_insights_service()

        # Get all premium users
        users_result = (
            supabase.table("users")
            .select("id")
            .eq("plan", "premium")
            .eq("status", "active")
            .execute()
        )

        users = users_result.data or []
        total_refreshed = 0
        total_skipped = 0
        total_failed = 0
        processed_users = 0

        # Process users sequentially (to manage OpenAI rate limits)
        for user in users:
            try:
                result = await insights_service.refresh_all_for_user(user["id"])
                total_refreshed += result.get("refreshed", 0)
                total_skipped += result.get("skipped", 0)
                total_failed += result.get("failed", 0)
                processed_users += 1

            except Exception as user_error:
                logger.warning(
                    f"Failed to refresh insights for user {user['id']}: {user_error}"
                )
                total_failed += 1
                continue

        return {
            "processed_users": processed_users,
            "total_refreshed": total_refreshed,
            "total_skipped": total_skipped,
            "total_failed": total_failed,
        }

    try:
        result = asyncio.run(refresh_all_users())

        logger.info(
            f"AI pattern insights refresh completed",
            {
                "processed_users": result["processed_users"],
                "total_refreshed": result["total_refreshed"],
                "total_skipped": result["total_skipped"],
                "total_failed": result["total_failed"],
            },
        )

        return {
            "success": True,
            **result,
        }

    except Exception as e:
        logger.error(f"Failed to run AI pattern insights refresh: {e}")
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


@celery_app.task(
    name="update_goal_streak",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
)
def update_goal_streak_task(
    self,
    goal_id: str,
    user_id: str,
) -> Dict[str, Any]:
    """
    Celery task to update streak counts for a goal after a check-in.

    Updates:
    - current_streak: Consecutive completed check-ins
    - longest_streak: Best streak ever
    - total_completions: Total completed check-ins

    Called after each check-in to keep streaks up-to-date.
    This is EVENT-DRIVEN, not scheduled.
    """
    try:
        supabase = get_supabase_client()

        # V2.1: Get all check-ins using status field (excludes pending)
        checkins_result = (
            supabase.table("check_ins")
            .select("check_in_date, status")
            .eq("goal_id", goal_id)
            .eq("user_id", user_id)
            .neq("status", "pending")  # Exclude pending check-ins
            .order("check_in_date", desc=True)
            .execute()
        )

        checkins = checkins_result.data or []

        if not checkins:
            return {
                "success": True,
                "goal_id": goal_id,
                "current_streak": 0,
                "longest_streak": 0,
                "total_completions": 0,
            }

        # Calculate total completions using status field
        total_completions = sum(1 for c in checkins if c.get("status") == "completed")

        # Calculate current streak (consecutive completed/rest_day from most recent)
        current_streak = 0
        today = datetime.utcnow().date()

        for i, checkin in enumerate(checkins):
            checkin_date = datetime.fromisoformat(checkin["check_in_date"]).date()
            status = checkin.get("status", "missed")
            is_completed = status == "completed"
            is_rest_day = status == "rest_day"

            # For current streak, we check from most recent
            if i == 0:
                # Most recent check-in
                if is_completed or is_rest_day:
                    current_streak = 1
                else:
                    break  # Streak broken (missed/skipped)
            else:
                # Previous check-ins
                prev_date = datetime.fromisoformat(
                    checkins[i - 1]["check_in_date"]
                ).date()
                expected_date = prev_date - timedelta(days=1)

                if checkin_date == expected_date:
                    if is_completed or is_rest_day:
                        current_streak += 1
                    else:
                        break  # Streak broken
                else:
                    # Gap in dates - streak broken
                    break

        # Calculate longest streak (need to scan all checkins)
        longest_streak = 0
        temp_streak = 0
        sorted_checkins = sorted(checkins, key=lambda x: x["check_in_date"])

        for i, checkin in enumerate(sorted_checkins):
            status = checkin.get("status", "missed")
            is_completed = status == "completed"
            is_rest_day = status == "rest_day"

            if is_completed or is_rest_day:
                if i == 0:
                    temp_streak = 1
                else:
                    prev_date = datetime.fromisoformat(
                        sorted_checkins[i - 1]["check_in_date"]
                    ).date()
                    curr_date = datetime.fromisoformat(checkin["check_in_date"]).date()

                    if (curr_date - prev_date).days == 1:
                        temp_streak += 1
                    else:
                        # Gap - start new streak
                        longest_streak = max(longest_streak, temp_streak)
                        temp_streak = 1
            else:
                # Not completed (missed/skipped) - end streak
                longest_streak = max(longest_streak, temp_streak)
                temp_streak = 0

        longest_streak = max(longest_streak, temp_streak, current_streak)

        # Update goal with new streak values
        supabase.table("goals").update(
            {
                "current_streak": current_streak,
                "longest_streak": longest_streak,
                "total_completions": total_completions,
            }
        ).eq("id", goal_id).execute()

        logger.info(
            f"Updated streak for goal {goal_id}",
            {
                "goal_id": goal_id,
                "current_streak": current_streak,
                "longest_streak": longest_streak,
                "total_completions": total_completions,
            },
        )

        return {
            "success": True,
            "goal_id": goal_id,
            "current_streak": current_streak,
            "longest_streak": longest_streak,
            "total_completions": total_completions,
        }

    except Exception as e:
        logger.error(
            f"Failed to update goal streak: {e}",
            {"goal_id": goal_id, "user_id": user_id, "error": str(e)},
        )
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        return {"success": False, "error": str(e)}
