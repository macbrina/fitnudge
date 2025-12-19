"""
Plan Generation Tasks

Celery tasks for AI-powered plan generation and goal suggestions.
"""

from typing import Dict, Any, Optional
from app.services.tasks.base import (
    celery_app,
    get_supabase_client,
    logger,
    _activate_goal_and_create_checkin,
)
from app.services.plan_generator import PlanGenerator
from app.services.suggested_goals_service import generate_suggested_goals_for_user
from app.services.expo_push_service import send_push_to_user_sync


@celery_app.task(
    name="generate_plan",
    bind=True,
    max_retries=3,
    default_retry_delay=60,  # Retry after 60 seconds
    autoretry_for=(Exception,),  # Retry on any exception
    retry_backoff=True,  # Exponential backoff
    retry_backoff_max=600,  # Max 10 minutes between retries
    retry_jitter=True,  # Add randomness to retry timing
)
def generate_plan_task(
    self,
    plan_id: str,
    goal_id: str,
    goal_data: Dict[str, Any],
    user_profile: Optional[Dict[str, Any]] = None,
    user_plan: Optional[str] = None,
    activation_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Celery task to generate an actionable plan for a goal.
    When plan is ready, activates the goal and creates initial check-in.

    Args:
        self: Celery task instance (for retry mechanism)
        plan_id: The plan ID in database
        goal_id: The goal ID
        goal_data: Goal data dictionary
        user_profile: Optional user profile for personalization
        user_plan: User's subscription plan (free, starter, pro, elite)
        activation_context: Context for activating goal when plan is ready
            - can_activate: Whether user has room for more active goals
            - user_timezone: User's timezone for check-in creation
            - frequency: Goal frequency (daily/weekly)
            - days_of_week: Days of week for weekly goals

    Returns:
        Dict with success status and plan details

    Raises:
        Exception: If plan generation fails (will trigger retry)
    """
    supabase = get_supabase_client()
    plan_generator = PlanGenerator()

    try:
        # Get user_id from goal
        goal_result = (
            supabase.table("goals")
            .select("user_id")
            .eq("id", goal_id)
            .maybe_single()
            .execute()
        )

        user_id = None
        if goal_result.data:
            user_id = goal_result.data.get("user_id")

        # If user_plan not provided, get it from user record
        if not user_plan and user_id:
            from app.core.subscriptions import get_user_effective_plan

            user_plan = get_user_effective_plan(user_id, supabase=supabase)

        # Update status to generating
        supabase.table("actionable_plans").update({"status": "generating"}).eq(
            "id", plan_id
        ).execute()

        print(
            f"Starting plan generation for goal {goal_id} (attempt {self.request.retries + 1}/{self.max_retries + 1})",
            {
                "plan_id": plan_id,
                "goal_id": goal_id,
                "retry_count": self.request.retries,
                "user_plan": user_plan,
            },
        )

        # Import here to avoid circular imports
        import asyncio

        # Run async plan generation in sync context
        # Celery tasks are sync, but plan_generator.generate_plan is async
        # Create new event loop for this thread (Celery uses threads/processes)
        try:
            loop = asyncio.get_event_loop()
            if loop.is_closed():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        plan = loop.run_until_complete(
            plan_generator.generate_plan(
                goal_data, user_profile, user_plan=user_plan, user_id=user_id
            )
        )

        if plan:
            # Save the generated plan
            supabase.table("actionable_plans").update(
                {
                    "plan_type": plan["plan_type"],
                    "structured_data": plan,
                    "status": "completed",
                    "generated_at": "now()",
                }
            ).eq("id", plan_id).execute()

            print(
                f"Successfully generated plan for goal {goal_id}",
                {"plan_id": plan_id, "plan_type": plan["plan_type"]},
            )

            # ✅ ACTIVATE GOAL AND CREATE CHECK-IN NOW THAT PLAN IS READY
            if activation_context and activation_context.get("can_activate"):
                _activate_goal_and_create_checkin(
                    supabase=supabase,
                    goal_id=goal_id,
                    user_id=user_id,
                    user_timezone=activation_context.get("user_timezone", "UTC"),
                    frequency=activation_context.get("frequency", "daily"),
                    days_of_week=activation_context.get("days_of_week"),
                )

            # 🔔 SEND PUSH NOTIFICATION - Plan is ready!
            if user_id:
                goal_title = goal_data.get("title", "Your goal")
                try:
                    send_push_to_user_sync(
                        user_id=user_id,
                        title="Your plan is ready! 🎯",
                        body=f"Your personalized plan for '{goal_title}' is ready. Tap to view.",
                        data={
                            "type": "plan_ready",
                            "goalId": goal_id,
                            "planId": plan_id,
                            "url": f"/goal?id={goal_id}",
                        },
                        notification_type="plan_ready",
                        entity_type="goal",
                        entity_id=goal_id,
                    )
                    logger.info(f"Sent plan ready notification for goal {goal_id}")
                except Exception as notif_error:
                    # Don't fail the task if notification fails
                    logger.warning(
                        f"Failed to send plan ready notification: {notif_error}"
                    )

            return {
                "success": True,
                "plan_id": plan_id,
                "goal_id": goal_id,
                "plan_type": plan["plan_type"],
                "goal_activated": (
                    activation_context.get("can_activate")
                    if activation_context
                    else False
                ),
            }
        else:
            # Plan generation returned None
            error_msg = "Plan generation returned no result"
            supabase.table("actionable_plans").update(
                {
                    "status": "failed",
                    "error_message": error_msg,
                }
            ).eq("id", plan_id).execute()

            # Mark the goal as failed so user can retry
            supabase.table("goals").update(
                {
                    "is_active": False,
                    "archived_reason": "failed",
                }
            ).eq("id", goal_id).execute()

            logger.warning(f"Plan generation returned None for goal {goal_id}")
            # Don't retry if AI returned None - it's not a transient error
            return {"success": False, "error": error_msg}

    except Exception as e:
        # Log the error
        error_message = str(e)[:500]  # Limit error message length

        logger.error(
            f"Failed to generate plan for goal {goal_id} (attempt {self.request.retries + 1}/{self.max_retries + 1})",
            {
                "error": error_message,
                "plan_id": plan_id,
                "goal_id": goal_id,
                "retry_count": self.request.retries,
            },
        )

        # Update status to failed only if we've exhausted retries
        if self.request.retries >= self.max_retries:
            try:
                # Mark the actionable_plans as failed
                supabase.table("actionable_plans").update(
                    {
                        "status": "failed",
                        "error_message": error_message,
                    }
                ).eq("id", plan_id).execute()

                # Mark the goal as inactive with archived_reason = "failed"
                # so user can see the failure and retry
                supabase.table("goals").update(
                    {
                        "is_active": False,
                        "archived_reason": "failed",
                    }
                ).eq("id", goal_id).execute()

                logger.warning(
                    f"Goal {goal_id} marked as failed after plan generation failure",
                    {"goal_id": goal_id, "plan_id": plan_id},
                )
            except Exception as update_error:
                logger.error(
                    f"Failed to update goal/plan status for {goal_id}",
                    {"error": str(update_error)},
                )

            # Return failure without retrying
            return {"success": False, "error": error_message}

        # Retry the task (Celery will automatically retry based on decorator settings)
        raise self.retry(exc=e)


@celery_app.task(
    name="generate_suggested_goals",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def generate_suggested_goals_task(
    self, user_id: str, goal_type: str = "habit", user_timezone: str = None
) -> Dict[str, Any]:
    """
    Celery task to generate suggested goals for a user and persist them.

    Args:
        user_id: The user's ID
        goal_type: Type of goals to generate - "habit", "time_challenge",
                   "target_challenge", or "mixed". Defaults to "habit".
        user_timezone: User's timezone (e.g., 'America/New_York') for time-aware suggestions.
    """
    supabase = get_supabase_client()

    try:
        status, goals, error_message = generate_suggested_goals_for_user(
            user_id, goal_type=goal_type, user_timezone=user_timezone
        )

        # Get current regeneration count (use maybe_single to handle 0 rows)
        existing_record = (
            supabase.table("suggested_goals")
            .select("regeneration_count")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )

        current_count = 0
        if existing_record.data:
            current_count = existing_record.data.get("regeneration_count", 0)

        # Simple logic: Increment count on EVERY successful generation
        # Initial generation: 0 + 1 = 1
        # First regeneration: 1 + 1 = 2
        # Failed generation: keep current count
        if status == "ready":
            new_count = current_count + 1
        else:
            new_count = current_count

        payload: Dict[str, Any] = {
            "user_id": user_id,
            "status": status,
            "updated_at": "now()",
            "error_message": error_message,
            "goals": [goal.dict() for goal in goals] if goals else None,
            "regeneration_count": new_count,
            "goal_type": goal_type,  # Preserve the goal type
        }

        supabase.table("suggested_goals").upsert(
            payload, on_conflict="user_id"
        ).execute()

        print(
            "Suggested goals generation task completed",
            {
                "user_id": user_id,
                "status": status,
                "goal_count": len(goals) if goals else 0,
                "regeneration_count": new_count,
            },
        )

        return {
            "status": status,
            "goal_count": len(goals) if goals else 0,
            "error": error_message,
            "regeneration_count": new_count,
        }
    except Exception as exc:
        logger.error(
            "Suggested goals generation task failed",
            {"user_id": user_id, "error": str(exc), "retries": self.request.retries},
        )

        # On failure, DON'T increment regeneration_count
        # Get current count and preserve it (use maybe_single to handle 0 rows)
        try:
            existing_record = (
                supabase.table("suggested_goals")
                .select("regeneration_count")
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )

            current_count = 0
            if existing_record.data:
                current_count = existing_record.data.get("regeneration_count", 0)
        except Exception:
            # If even the lookup fails, start from 0
            current_count = 0

        # Check if we've exhausted all retries
        if self.request.retries >= self.max_retries:
            # Final failure - mark as failed so user can retry
            logger.error(
                "Suggested goals generation failed after all retries",
                {"user_id": user_id, "max_retries": self.max_retries},
            )
            try:
                supabase.table("suggested_goals").upsert(
                    {
                        "user_id": user_id,
                        "status": "failed",
                        "error_message": f"Generation failed after {self.max_retries + 1} attempts. Please try again.",
                        "goals": None,
                        "regeneration_count": current_count,
                        "goal_type": goal_type,  # Preserve the goal type for retry
                        "updated_at": "now()",
                    },
                    on_conflict="user_id",
                ).execute()
            except Exception as upsert_error:
                logger.error(
                    "Failed to update suggested_goals status to failed",
                    {"user_id": user_id, "error": str(upsert_error)},
                )
            # Don't retry anymore, just return failure
            return {
                "status": "failed",
                "goal_count": 0,
                "error": str(exc)[:500],
                "regeneration_count": current_count,
            }

        # Still have retries left - retry the task
        raise self.retry(exc=exc)


# =============================================================================
# STALE TASK CLEANUP
# =============================================================================


@celery_app.task(name="cleanup_stale_pending_tasks")
def cleanup_stale_pending_tasks() -> Dict[str, Any]:
    """
    Periodic task to clean up stale 'pending' records that got stuck.

    This handles cases where:
    - Celery worker crashed/restarted mid-task
    - Task failed before updating status
    - Network issues prevented status update

    Runs every 2 minutes via Celery Beat.
    Marks records pending for more than 3 minutes as 'failed'.
    """
    from datetime import datetime, timedelta, timezone

    supabase = get_supabase_client()

    # Consider "pending" records older than 3 minutes as stale
    stale_threshold = datetime.now(timezone.utc) - timedelta(minutes=3)
    stale_threshold_str = stale_threshold.isoformat()

    cleaned_count = 0

    try:
        # Find stale suggested_goals records
        stale_goals = (
            supabase.table("suggested_goals")
            .select("user_id, updated_at")
            .eq("status", "pending")
            .lt("updated_at", stale_threshold_str)
            .execute()
        )

        if stale_goals.data:
            for record in stale_goals.data:
                try:
                    supabase.table("suggested_goals").update(
                        {
                            "status": "failed",
                            "error_message": "Generation timed out. Please try again.",
                            "updated_at": "now()",
                        }
                    ).eq("user_id", record["user_id"]).eq("status", "pending").execute()
                    cleaned_count += 1
                    logger.warning(
                        f"Cleaned up stale suggested_goals for user {record['user_id']}"
                    )
                except Exception as e:
                    logger.error(
                        f"Failed to cleanup stale suggested_goals: {e}",
                        {"user_id": record["user_id"]},
                    )

        # Find stale actionable_plans records
        stale_plans = (
            supabase.table("actionable_plans")
            .select("id, goal_id, updated_at")
            .eq("status", "pending")
            .lt("updated_at", stale_threshold_str)
            .execute()
        )

        if stale_plans.data:
            for record in stale_plans.data:
                try:
                    supabase.table("actionable_plans").update(
                        {
                            "status": "failed",
                            "error_message": "Plan generation timed out. Please try again.",
                            "updated_at": "now()",
                        }
                    ).eq("id", record["id"]).eq("status", "pending").execute()
                    cleaned_count += 1
                    logger.warning(f"Cleaned up stale actionable_plan {record['id']}")
                except Exception as e:
                    logger.error(
                        f"Failed to cleanup stale actionable_plan: {e}",
                        {"plan_id": record["id"]},
                    )

        if cleaned_count > 0:
            logger.info(f"Cleaned up {cleaned_count} stale pending records")

        return {
            "success": True,
            "cleaned_count": cleaned_count,
            "stale_goals": len(stale_goals.data) if stale_goals.data else 0,
            "stale_plans": len(stale_plans.data) if stale_plans.data else 0,
        }

    except Exception as e:
        logger.error(f"Stale task cleanup failed: {e}")
        return {"success": False, "error": str(e), "cleaned_count": 0}
