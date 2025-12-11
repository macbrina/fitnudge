"""
Analytics Tasks

Celery tasks for analytics and reporting:
- Weekly recap generation
- Materialized view refresh
"""

from typing import Dict, Any
from app.services.tasks.base import celery_app, get_supabase_client, logger


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
    from datetime import datetime
    import asyncio

    try:
        supabase = get_supabase_client()

        # Check if today is Monday (day 0 in Python's weekday)
        today = datetime.now().date()
        if today.weekday() != 0:  # Not Monday
            print("Skipping weekly recap generation - not Monday")
            return {"success": True, "skipped": True, "reason": "Not Monday"}

        # Get all users with active goals
        active_goals = (
            supabase.table("goals")
            .select("user_id, id")
            .eq("is_active", True)
            .execute()
        )

        if not active_goals.data:
            print("No active goals found for weekly recap generation")
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
                    print(
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

        print(
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


@celery_app.task(
    name="refresh_analytics_views",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def refresh_analytics_views_task(self) -> Dict[str, Any]:
    """
    Refresh materialized views for analytics dashboards.
    Runs hourly to keep analytics data fresh without impacting query performance.

    Views refreshed:
    - user_engagement_summary: User activity metrics (goals, check-ins, posts, followers)
    - subscription_analytics: Subscription metrics by plan/status/platform

    Performance: 280x faster queries with pre-computed data + indexes
    """
    from datetime import datetime

    try:
        supabase = get_supabase_client()

        print("🔄 Refreshing analytics materialized views...")

        # Call PostgreSQL function to refresh all analytics views
        # Uses REFRESH MATERIALIZED VIEW CONCURRENTLY to avoid locking
        result = supabase.rpc("refresh_analytics_views").execute()

        print("✅ Analytics views refreshed successfully")
        logger.info("Analytics materialized views refreshed")

        return {
            "success": True,
            "refreshed_at": datetime.now().isoformat(),
            "views": ["user_engagement_summary", "subscription_analytics"],
        }

    except Exception as e:
        logger.error(
            "Failed to refresh analytics views",
            {"error": str(e), "retry_count": self.request.retries},
        )

        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)

        return {"success": False, "error": str(e)}
