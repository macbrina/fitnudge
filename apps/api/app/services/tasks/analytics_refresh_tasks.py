"""
Analytics Refresh Tasks

Celery tasks for:
1. Refreshing materialized views (hourly)
2. Pre-warming analytics cache for active users

Following SCALABILITY.md patterns for 100K+ users.
"""

from celery import shared_task
from app.core.database import get_supabase_client
from app.core.cache import get_redis_client
from app.services.logger import logger
import json
from datetime import datetime, timedelta


# =============================================================================
# MATERIALIZED VIEW REFRESH (Phase 3)
# =============================================================================


@shared_task(name="refresh_analytics_views", bind=True, max_retries=3)
def refresh_analytics_views_task(self):
    """
    Refresh analytics materialized views in private 'analytics' schema.

    Runs hourly via Celery Beat.
    Uses REFRESH MATERIALIZED VIEW CONCURRENTLY for non-blocking updates.

    Views refreshed:
    - analytics.user_engagement_summary
    - analytics.subscription_analytics
    - analytics.mv_user_daily_stats
    - analytics.mv_goal_stats
    """
    try:
        supabase = get_supabase_client()

        # Call the refresh function we created in the migration
        result = supabase.rpc("refresh_analytics_views").execute()

        logger.info("Analytics materialized views refreshed successfully")

        # Store refresh timestamp in Redis for monitoring
        redis = get_redis_client()
        if redis:
            redis.setex(
                "analytics:last_refresh",
                3600 * 24,  # Keep for 24 hours
                datetime.utcnow().isoformat(),
            )

        return {"status": "success", "refreshed_at": datetime.utcnow().isoformat()}

    except Exception as e:
        logger.error(f"Failed to refresh analytics views: {str(e)}")
        raise self.retry(exc=e, countdown=60 * (self.request.retries + 1))


# =============================================================================
# ANALYTICS CACHE SERVICE (Phase 4) - Per-Goal
# =============================================================================

ANALYTICS_CACHE_TTL = 3600  # 1 hour
ANALYTICS_CACHE_PREFIX = "analytics:dashboard"


def get_cached_analytics(
    user_id: str, days: int = 30, goal_id: str = None
) -> dict | None:
    """
    Get per-goal analytics dashboard from Redis cache.

    V2: Now requires goal_id for per-goal caching.
    Returns None if not cached or Redis unavailable.
    """
    redis = get_redis_client()
    if not redis:
        return None

    # V2: Cache key includes goal_id
    cache_key = f"{ANALYTICS_CACHE_PREFIX}:{user_id}:{goal_id}:{days}"

    try:
        cached = redis.get(cache_key)
        if cached:
            data = json.loads(cached)
            logger.debug(f"Analytics cache hit for user {user_id}, goal {goal_id}")
            return data
    except Exception as e:
        logger.warning(f"Redis get error: {e}")

    return None


def set_cached_analytics(
    user_id: str, days: int, data: dict, goal_id: str = None
) -> bool:
    """
    Store per-goal analytics dashboard in Redis cache.

    V2: Now requires goal_id for per-goal caching.
    Returns True if cached successfully.
    """
    redis = get_redis_client()
    if not redis:
        return False

    # V2: Cache key includes goal_id
    cache_key = f"{ANALYTICS_CACHE_PREFIX}:{user_id}:{goal_id}:{days}"

    try:
        redis.setex(cache_key, ANALYTICS_CACHE_TTL, json.dumps(data))
        logger.debug(f"Analytics cached for user {user_id}, goal {goal_id}")
        return True
    except Exception as e:
        logger.warning(f"Redis setex error: {e}")
        return False


def invalidate_user_analytics_cache(user_id: str, goal_id: str = None):
    """
    Invalidate analytics cache for a user.

    V2: If goal_id provided, invalidates only that goal's cache.
        If goal_id is None, invalidates ALL goals for the user.

    Call this when user creates a check-in, goal, etc.
    """
    redis = get_redis_client()
    if not redis:
        return

    if goal_id:
        # Invalidate specific goal's cache for all time ranges
        for days in [30, 90, 180]:
            cache_key = f"{ANALYTICS_CACHE_PREFIX}:{user_id}:{goal_id}:{days}"
            try:
                redis.delete(cache_key)
            except Exception:
                pass
    else:
        # Invalidate ALL analytics caches for this user (pattern match)
        pattern = f"{ANALYTICS_CACHE_PREFIX}:{user_id}:*"
        try:
            cursor = 0
            while True:
                cursor, keys = redis.scan(cursor, match=pattern, count=100)
                if keys:
                    redis.delete(*keys)
                if cursor == 0:
                    break
        except Exception as e:
            logger.warning(f"Error invalidating analytics cache: {e}")


def clear_all_analytics_cache() -> int:
    """
    Clear ALL analytics cache entries.

    Use this when schema changes to avoid stale data errors.
    Returns number of keys deleted.
    """
    redis = get_redis_client()
    if not redis:
        return 0

    deleted = 0
    cursor = 0
    pattern = f"{ANALYTICS_CACHE_PREFIX}:*"

    try:
        # Use SCAN to find all matching keys (safe for production)
        while True:
            cursor, keys = redis.scan(cursor, match=pattern, count=100)
            if keys:
                redis.delete(*keys)
                deleted += len(keys)
            if cursor == 0:
                break
        logger.info(f"Cleared {deleted} analytics cache entries")
    except Exception as e:
        logger.warning(f"Error clearing analytics cache: {e}")

    return deleted


# =============================================================================
# PRE-WARM CACHE FOR ACTIVE USERS (Optional - run during off-peak hours)
# =============================================================================


@shared_task(name="prewarm_analytics_cache_task", bind=True)
def prewarm_analytics_cache_task(self, user_ids: list[str] = None):
    """
    Pre-compute analytics for active users during off-peak hours.

    This reduces latency for users when they open the Analytics screen.
    Run at 3 AM local time (low traffic).
    """
    from app.services.subscription_service import has_user_feature_sync

    supabase = get_supabase_client()

    try:
        if user_ids:
            # Specific users provided
            users = user_ids
        else:
            # Get recently active premium users
            # Active = checked in within last 7 days
            week_ago = (datetime.utcnow() - timedelta(days=7)).date().isoformat()

            result = (
                supabase.table("check_ins")
                .select("user_id")
                .gte("check_in_date", week_ago)
                .execute()
            )

            if not result.data:
                return {"status": "no_active_users"}

            # Unique user IDs
            users = list(set(c["user_id"] for c in result.data))

        prewarmed = 0
        skipped = 0

        for user_id in users[:100]:  # Limit to 100 users per run
            # Check if premium (only premium users get analytics)
            has_access = has_user_feature_sync(supabase, user_id, "advanced_analytics")
            if not has_access:
                skipped += 1
                continue

            # Check if already cached
            if get_cached_analytics(user_id, 90):
                skipped += 1
                continue

            # Fetch and cache
            try:
                result = supabase.rpc(
                    "get_analytics_dashboard", {"p_user_id": user_id, "p_days": 90}
                ).execute()

                if result.data:
                    set_cached_analytics(user_id, 90, result.data)
                    prewarmed += 1

            except Exception as e:
                logger.warning(f"Failed to prewarm analytics for {user_id}: {e}")

        logger.info(f"Analytics prewarm: {prewarmed} cached, {skipped} skipped")
        return {"prewarmed": prewarmed, "skipped": skipped}

    except Exception as e:
        logger.error(f"Analytics prewarm failed: {str(e)}")
        return {"status": "error", "error": str(e)}


# =============================================================================
# CACHE INVALIDATION ON CHECK-IN (Fire-and-Forget)
# =============================================================================


@shared_task(name="invalidate_analytics_on_checkin_task")
def invalidate_analytics_on_checkin_task(user_id: str, goal_id: str = None):
    """
    Invalidate analytics cache when user creates a check-in.

    V2: If goal_id provided, only invalidates that goal's cache.
        If goal_id is None, invalidates ALL goals (less efficient).

    Called from check-in endpoint as fire-and-forget.
    """
    invalidate_user_analytics_cache(user_id, goal_id)
    goal_info = f", goal {goal_id}" if goal_id else " (all goals)"
    logger.debug(f"Analytics cache invalidated for user {user_id}{goal_info}")
