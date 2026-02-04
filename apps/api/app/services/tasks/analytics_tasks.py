"""
FitNudge V2 - Analytics Tasks

Celery tasks for analytics and reporting:
- Weekly recap generation (with caching and chunked processing)
- Materialized view refresh
Per SCALABILITY.md:
- Uses chunked task dispatch for large user sets
- Caches recaps in weekly_recaps table
- Inline processing for small batches (< 10 users)
"""

from typing import Dict, Any, List
from app.services.tasks.base import celery_app, get_supabase_client, logger

# Threshold for inline vs chunked processing
INLINE_THRESHOLD = 10
CHUNK_SIZE = 50


@celery_app.task(
    name="generate_weekly_recaps",
    bind=True,
)
def generate_weekly_recaps_task(self) -> Dict[str, Any]:
    """
    Celery task to generate weekly recaps for all users with active goals.
    Runs on Mondays to generate recaps for the previous week.

    Only processes users with active goals.

    Per SCALABILITY.md:
    - Dispatches chunked tasks for large user sets
    - Processes inline for small batches
    """
    from datetime import datetime, date
    from app.services.tasks.task_utils import dispatch_chunked_tasks

    try:
        supabase = get_supabase_client()

        # Check if today is Monday (day 0 in Python's weekday)
        today = datetime.now().date()
        if today.weekday() != 0:  # Not Monday
            logger.info("Skipping weekly recap generation - not Monday")
            return {"success": True, "skipped": True, "reason": "Not Monday"}

        # V2: Get all unique users with active goals only
        user_ids_set = set()

        # Users with active goals
        active_goals = (
            supabase.table("goals").select("user_id").eq("status", "active").execute()
        )
        for goal in active_goals.data or []:
            user_ids_set.add(goal["user_id"])

        user_ids = list(user_ids_set)

        if not user_ids:
            logger.info("No active users found for weekly recap generation")
            return {"success": True, "processed": 0}

        logger.info(
            f"Starting weekly recap generation for {len(user_ids)} users",
            {"user_count": len(user_ids)},
        )

        # Use chunked processing for scalability (per SCALABILITY.md §3.4)
        if len(user_ids) > INLINE_THRESHOLD:
            # Dispatch chunked tasks for parallel processing
            dispatch_chunked_tasks(
                task=generate_weekly_recaps_chunk_task,
                items=user_ids,
                chunk_size=CHUNK_SIZE,
            )
            return {
                "success": True,
                "dispatched": len(user_ids),
                "chunks": (len(user_ids) + CHUNK_SIZE - 1) // CHUNK_SIZE,
            }
        else:
            # Process inline for small batches
            processed_count = _process_user_recaps(user_ids)
            return {
                "success": True,
                "processed": processed_count,
                "total_users": len(user_ids),
            }

    except Exception as e:
        logger.error(
            f"Failed to generate weekly recaps",
            {"error": str(e)},
        )
        return {"success": False, "error": str(e)}


@celery_app.task(
    name="generate_weekly_recaps_chunk",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
)
def generate_weekly_recaps_chunk_task(self, user_ids: List[str]) -> Dict[str, Any]:
    """
    Process a chunk of users for weekly recap generation.
    Called by generate_weekly_recaps_task for parallel processing.
    """
    try:
        processed_count = _process_user_recaps(user_ids)

        logger.info(
            f"Processed weekly recap chunk",
            {"processed": processed_count, "chunk_size": len(user_ids)},
        )

        return {
            "success": True,
            "processed": processed_count,
            "chunk_size": len(user_ids),
        }

    except Exception as e:
        logger.error(
            f"Failed to process weekly recap chunk",
            {"error": str(e), "chunk_size": len(user_ids)},
        )

        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)

        return {"success": False, "error": str(e)}


def _process_user_recaps(user_ids: List[str]) -> int:
    """
    Process weekly recaps for a list of users.
    Uses get_weekly_recap which handles caching automatically.

    PREMIUM FEATURE: Only processes users who have 'weekly_recap' feature enabled.

    Args:
        user_ids: List of user IDs to process

    Returns:
        Number of successfully processed recaps
    """
    from app.services.weekly_recap_service import weekly_recap_service
    from app.services.subscription_service import has_user_feature_sync
    from app.services.expo_push_service import send_push_to_user_sync
    from datetime import date, timedelta
    import asyncio

    # Get or create event loop
    loop = None
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    supabase = get_supabase_client()
    processed_count = 0
    skipped_count = 0
    notified_count = 0

    # Calculate week_start for the PREVIOUS week (Mon-Sun that just ended)
    # Matches the recap we generate (for_previous_week=True)
    today = date.today()
    week_end = today - timedelta(days=1)  # Sunday of previous week
    week_start = week_end - timedelta(days=6)  # Monday of previous week

    for user_id in user_ids:
        try:
            # Check if user has premium weekly_recap feature (sync for Celery)
            has_feature = has_user_feature_sync(supabase, user_id, "weekly_recap")

            if not has_feature:
                skipped_count += 1
                continue  # Skip free users - they don't have access to weekly recaps

            # Use get_weekly_recap which:
            # 1. Checks cache first
            # 2. Generates if not cached
            # 3. Stores in weekly_recaps table
            # for_previous_week=True: Generate for the week that just ended (Mon-Sun),
            # not week-to-date. On Monday, that's the full previous week.
            recap = loop.run_until_complete(
                weekly_recap_service.get_weekly_recap(
                    user_id=user_id,
                    force_regenerate=True,  # Force regenerate for batch job
                    for_previous_week=True,  # Full week that just ended
                )
            )

            if recap:
                processed_count += 1
                logger.info(
                    f"Generated weekly recap for user {user_id}",
                    {
                        "user_id": user_id,
                        "goals": len(recap.get("goal_breakdown", [])),
                    },
                )

                # 🔔 Send push notification - Weekly recap is ready!
                # Deduplication: Check if we already sent notification for this week
                try:
                    existing_notif = (
                        supabase.table("notification_history")
                        .select("id")
                        .eq("user_id", user_id)
                        .eq("notification_type", "weekly_recap")
                        .gte("sent_at", f"{week_start.isoformat()}T00:00:00")
                        .limit(1)
                        .execute()
                    )

                    if not existing_notif.data:
                        # Get recap id from weekly_recaps for entity_id (UUID)
                        recap_row = (
                            supabase.table("weekly_recaps")
                            .select("id")
                            .eq("user_id", user_id)
                            .eq("week_start", week_start.isoformat())
                            .maybe_single()
                            .execute()
                        )
                        recap_id = recap_row.data.get("id") if recap_row.data else None

                        # Build notification body with stats
                        stats = recap.get("stats", {})
                        total_checkins = stats.get(
                            "total_check_ins", stats.get("completed_check_ins", 0)
                        )
                        completion_rate = stats.get("completion_rate", 0)

                        body = f"You completed {total_checkins} check-ins at {completion_rate}% completion. Tap to see your full recap!"

                        # send_push_to_user_sync handles preference & quiet hours check
                        result = send_push_to_user_sync(
                            user_id=user_id,
                            title="Your Weekly Report! 📊",
                            body=body,
                            data={
                                "type": "weekly_recap",
                                "weekStart": week_start.isoformat(),
                                "deepLink": "/(user)/profile/weekly-recaps",
                            },
                            notification_type="weekly_recap",
                            entity_type="weekly_recap",
                            entity_id=recap_id,  # UUID from weekly_recaps table
                            category_id="weekly_recap",  # Adds "View Recap" action button
                        )
                        if not result.get("skipped"):
                            notified_count += 1
                            logger.info(
                                f"Sent weekly recap notification to user {user_id}"
                            )
                except Exception as notif_error:
                    # Don't fail the task if notification fails
                    logger.warning(
                        f"Failed to send weekly recap notification: {notif_error}",
                        {"user_id": user_id, "error": str(notif_error)},
                    )

        except Exception as e:
            logger.warning(
                f"Failed to generate recap for user {user_id}",
                {"error": str(e), "user_id": user_id},
            )

    if skipped_count > 0:
        logger.info(
            f"Skipped {skipped_count} free users (no weekly_recap feature)",
            {"skipped": skipped_count, "processed": processed_count},
        )

    if notified_count > 0:
        logger.info(
            f"Sent {notified_count} weekly recap notifications",
            {"notified": notified_count, "processed": processed_count},
        )

    return processed_count


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

    Views refreshed (in analytics schema - private, not exposed via API):
    - analytics.user_engagement_summary: User activity metrics
    - analytics.subscription_analytics: Subscription metrics
    - analytics.mv_user_daily_stats: Daily check-in aggregates
    - analytics.mv_goal_stats: Goal completion stats

    Security: Views are in private 'analytics' schema, only accessible via RPC.
    Performance: 280x faster queries with pre-computed data + indexes.
    """
    from datetime import datetime

    try:
        supabase = get_supabase_client()

        logger.info("🔄 Refreshing analytics materialized views...")

        # Call PostgreSQL function to refresh all analytics views
        # Uses REFRESH MATERIALIZED VIEW CONCURRENTLY to avoid locking
        result = supabase.rpc("refresh_analytics_views").execute()

        logger.info("✅ Analytics views refreshed successfully")

        return {
            "success": True,
            "refreshed_at": datetime.now().isoformat(),
            "views": [
                "analytics.user_engagement_summary",
                "analytics.subscription_analytics",
                "analytics.mv_user_daily_stats",
                "analytics.mv_goal_stats",
            ],
        }

    except Exception as e:
        logger.error(
            "Failed to refresh analytics views",
            {"error": str(e), "retry_count": self.request.retries},
        )

        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)

        return {"success": False, "error": str(e)}
