"""
Task Queue Service

Manages background tasks for async operations like plan generation.

IMPLEMENTATION: Celery + Redis
- Task persistence (survive server restarts)
- Automatic retry on failure (up to 3 retries with exponential backoff)
- Horizontal scaling (multiple workers)
- Task prioritization and scheduling
- Better monitoring and observability

PERFORMANCE:
- Plan generation takes 10-30 seconds (OpenAI API)
- Celery workers handle tasks asynchronously from Redis queue
- Can scale workers horizontally for high traffic
- Tasks are persisted in Redis, won't be lost on restart
"""

from typing import Dict, Any, Optional
from app.core.database import get_supabase_client
from app.services.logger import logger
from app.services.tasks import generate_plan_task


class TaskQueue:
    """Task queue for background operations using Celery + Redis"""

    async def queue_plan_generation(
        self,
        goal_id: str,
        goal_data: Dict[str, Any],
        user_profile: Optional[Dict[str, Any]] = None,
        background_tasks: Optional[
            Any
        ] = None,  # Not used with Celery, kept for API compatibility
    ) -> bool:
        """
        Queue a plan generation task for a goal.

        Args:
            goal_id: The goal ID to generate a plan for
            goal_data: The goal data dictionary
            user_profile: Optional user profile for personalization
            background_tasks: FastAPI BackgroundTasks instance (optional)

        Returns:
            True if task was queued successfully
        """
        try:
            supabase = get_supabase_client()

            # Create pending plan entry
            plan_entry = {
                "goal_id": goal_id,
                "plan_type": "accountability_plan",  # Default, will be determined during generation
                "structured_data": {},
                "status": "pending",
            }

            result = supabase.table("actionable_plans").insert(plan_entry).execute()

            if not result.data:
                logger.error(f"Failed to create pending plan for goal {goal_id}")
                return False

            plan_id = result.data[0]["id"]

            # Queue the plan generation task with Celery
            # This queues the task in Redis, where Celery workers will pick it up
            task_result = generate_plan_task.delay(
                plan_id=plan_id,
                goal_id=goal_id,
                goal_data=goal_data,
                user_profile=user_profile,
            )

            logger.info(
                f"Queued plan generation for goal {goal_id} with Celery",
                {
                    "plan_id": plan_id,
                    "task_id": task_result.id,
                },
            )
            return True

        except Exception as e:
            logger.error(
                f"Failed to queue plan generation for goal {goal_id}",
                {"error": str(e), "goal_id": goal_id},
            )
            return False

    async def get_plan_status(self, goal_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the status of a plan generation for a goal.

        Args:
            goal_id: The goal ID

        Returns:
            Plan status dictionary or None if not found
        """
        try:
            supabase = get_supabase_client()

            result = (
                supabase.table("actionable_plans")
                .select("*")
                .eq("goal_id", goal_id)
                .single()
                .execute()
            )

            if result.data:
                return result.data
            return None

        except Exception as e:
            logger.error(
                f"Failed to get plan status for goal {goal_id}",
                {"error": str(e), "goal_id": goal_id},
            )
            return None

    async def get_plan(self, goal_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the generated plan for a goal (only if status is 'completed').

        Args:
            goal_id: The goal ID

        Returns:
            Plan dictionary with structured_data or None if not found/completed
        """
        try:
            supabase = get_supabase_client()

            result = (
                supabase.table("actionable_plans")
                .select("*")
                .eq("goal_id", goal_id)
                .eq("status", "completed")
                .single()
                .execute()
            )

            if result.data:
                return result.data
            return None

        except Exception as e:
            logger.error(
                f"Failed to get plan for goal {goal_id}",
                {"error": str(e), "goal_id": goal_id},
            )
            return None


# Global task queue instance
task_queue = TaskQueue()
