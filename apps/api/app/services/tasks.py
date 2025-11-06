"""
Celery Tasks

Background tasks for async operations.
"""

from typing import Dict, Any, Optional
from app.core.celery_app import celery_app
from app.core.database import get_supabase_client
from app.services.logger import logger
from app.services.plan_generator import PlanGenerator


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
) -> Dict[str, Any]:
    """
    Celery task to generate an actionable plan for a goal.

    Args:
        self: Celery task instance (for retry mechanism)
        plan_id: The plan ID in database
        goal_id: The goal ID
        goal_data: Goal data dictionary
        user_profile: Optional user profile for personalization

    Returns:
        Dict with success status and plan details

    Raises:
        Exception: If plan generation fails (will trigger retry)
    """
    supabase = get_supabase_client()
    plan_generator = PlanGenerator()

    try:
        # Update status to generating
        supabase.table("actionable_plans").update({"status": "generating"}).eq(
            "id", plan_id
        ).execute()

        logger.info(
            f"Starting plan generation for goal {goal_id} (attempt {self.request.retries + 1}/{self.max_retries + 1})",
            {
                "plan_id": plan_id,
                "goal_id": goal_id,
                "retry_count": self.request.retries,
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
            plan_generator.generate_plan(goal_data, user_profile)
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

            logger.info(
                f"Successfully generated plan for goal {goal_id}",
                {"plan_id": plan_id, "plan_type": plan["plan_type"]},
            )

            return {
                "success": True,
                "plan_id": plan_id,
                "goal_id": goal_id,
                "plan_type": plan["plan_type"],
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
                supabase.table("actionable_plans").update(
                    {
                        "status": "failed",
                        "error_message": error_message,
                    }
                ).eq("id", plan_id).execute()
            except:
                pass  # If update fails, log it but don't fail the task

            # Return failure without retrying
            return {"success": False, "error": error_message}

        # Retry the task (Celery will automatically retry based on decorator settings)
        raise self.retry(exc=e)


@celery_app.task(
    name="check_achievements",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def check_achievements_task(
    self, user_id: str, goal_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Celery task to check and unlock achievements for a user.

    Args:
        self: Celery task instance
        user_id: User ID
        goal_id: Optional goal ID

    Returns:
        Dict with newly unlocked achievements
    """
    from app.services.achievement_service import achievement_service
    import asyncio

    try:
        # Run async achievement check in sync context
        try:
            loop = asyncio.get_event_loop()
            if loop.is_closed():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        newly_unlocked = loop.run_until_complete(
            achievement_service.check_and_unlock_achievements(user_id, goal_id)
        )

        return {
            "success": True,
            "unlocked_count": len(newly_unlocked),
            "achievements": newly_unlocked,
        }

    except Exception as e:
        logger.error(
            f"Failed to check achievements for user {user_id}",
            {
                "error": str(e),
                "user_id": user_id,
                "goal_id": goal_id,
                "retry_count": self.request.retries,
            },
        )

        if self.request.retries >= self.max_retries:
            return {"success": False, "error": str(e)}

        raise self.retry(exc=e)


@celery_app.task(
    name="update_challenge_progress",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def update_challenge_progress_task(
    self, user_id: str, goal_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Celery task to update challenge progress for a user.

    Args:
        self: Celery task instance
        user_id: User ID
        goal_id: Optional goal ID

    Returns:
        Dict with updated challenge data
    """
    from app.services.challenge_service import challenge_service
    from app.core.database import get_supabase_client
    import asyncio

    try:
        supabase = get_supabase_client()

        # Find all active challenges the user is participating in
        participants = (
            supabase.table("challenge_participants")
            .select("challenge_id")
            .eq("user_id", user_id)
            .execute()
        )

        if not participants.data:
            return {"success": True, "updated_challenges": 0}

        # Update progress for each challenge
        updated_count = 0
        loop = None
        try:
            loop = asyncio.get_event_loop()
            if loop.is_closed():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        for participant in participants.data:
            challenge_id = participant["challenge_id"]

            try:
                loop.run_until_complete(
                    challenge_service.update_participant_progress(
                        challenge_id=challenge_id,
                        user_id=user_id,
                    )
                )
                updated_count += 1
            except Exception as e:
                logger.warning(
                    f"Failed to update progress for challenge {challenge_id}",
                    {"error": str(e), "challenge_id": challenge_id, "user_id": user_id},
                )

        return {
            "success": True,
            "updated_challenges": updated_count,
        }

    except Exception as e:
        logger.error(
            f"Failed to update challenge progress for user {user_id}",
            {
                "error": str(e),
                "user_id": user_id,
                "goal_id": goal_id,
                "retry_count": self.request.retries,
            },
        )

        if self.request.retries >= self.max_retries:
            return {"success": False, "error": str(e)}

        raise self.retry(exc=e)


@celery_app.task(
    name="generate_weekly_recaps",
    bind=True,
)
def generate_weekly_recaps_task(self) -> Dict[str, Any]:
    """
    Celery task to generate weekly recaps for all users with active goals.
    Runs daily to check if it's time to generate recaps (typically Monday).
    """
    from app.services.weekly_recap_service import weekly_recap_service
    from app.core.database import get_supabase_client
    from datetime import datetime
    import asyncio

    try:
        supabase = get_supabase_client()

        # Check if today is Monday (day 0 in Python's weekday)
        today = datetime.now().date()
        if today.weekday() != 0:  # Not Monday
            logger.info("Skipping weekly recap generation - not Monday")
            return {"success": True, "skipped": True, "reason": "Not Monday"}

        # Get all users with active goals
        active_goals = (
            supabase.table("goals")
            .select("user_id, id")
            .eq("is_active", True)
            .execute()
        )

        if not active_goals.data:
            logger.info("No active goals found for weekly recap generation")
            return {"success": True, "processed": 0}

        # Group by user_id to get unique users
        user_goals = {}
        for goal in active_goals.data:
            user_id = goal["user_id"]
            goal_id = goal["id"]
            if user_id not in user_goals:
                user_goals[user_id] = []
            user_goals[user_id].append(goal_id)

        # Generate recaps for each user
        loop = None
        try:
            loop = asyncio.get_event_loop()
            if loop.is_closed():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        processed_count = 0
        for user_id, goal_ids in user_goals.items():
            try:
                # Generate recap for the first active goal (or could generate for all)
                recap = loop.run_until_complete(
                    weekly_recap_service.generate_weekly_recap(
                        user_id=user_id,
                        goal_id=goal_ids[0] if goal_ids else None,
                    )
                )

                if recap:
                    processed_count += 1
                    # TODO: Send recap via notification/email
                    logger.info(
                        f"Generated weekly recap for user {user_id}",
                        {
                            "user_id": user_id,
                            "goal_id": goal_ids[0] if goal_ids else None,
                        },
                    )

            except Exception as e:
                logger.warning(
                    f"Failed to generate recap for user {user_id}",
                    {"error": str(e), "user_id": user_id},
                )

        logger.info(
            f"Completed weekly recap generation",
            {"processed": processed_count, "total_users": len(user_goals)},
        )

        return {
            "success": True,
            "processed": processed_count,
            "total_users": len(user_goals),
        }

    except Exception as e:
        logger.error(
            f"Failed to generate weekly recaps",
            {"error": str(e)},
        )
        return {"success": False, "error": str(e)}
