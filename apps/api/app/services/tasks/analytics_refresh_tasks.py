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

import pytz


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


def _user_today_iso(user_timezone: str) -> str:
    """Today's date (YYYY-MM-DD) in user's timezone. Falls back to UTC on error."""
    try:
        tz = pytz.timezone(user_timezone or "UTC")
        return datetime.now(tz).date().isoformat()
    except Exception:
        return datetime.utcnow().date().isoformat()


def get_cached_analytics(
    user_id: str, days: int = 30, goal_id: str = None, end_date: str = None
) -> dict | None:
    """
    Get per-goal analytics dashboard from Redis cache.

    V2: Requires goal_id. end_date (YYYY-MM-DD, user's local today) is part of
    the cache key so completion_rate stays correct across timezones.
    Returns None if not cached or Redis unavailable.
    """
    redis = get_redis_client()
    if not redis:
        return None

    cache_key = f"{ANALYTICS_CACHE_PREFIX}:{user_id}:{goal_id}:{days}:{end_date or ''}"

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
    user_id: str, days: int, data: dict, goal_id: str = None, end_date: str = None
) -> bool:
    """
    Store per-goal analytics dashboard in Redis cache.

    V2: Requires goal_id. end_date (YYYY-MM-DD) included in key for timezone correctness.
    Returns True if cached successfully.
    """
    redis = get_redis_client()
    if not redis:
        return False

    cache_key = f"{ANALYTICS_CACHE_PREFIX}:{user_id}:{goal_id}:{days}:{end_date or ''}"

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

    V2: If goal_id provided, invalidates only that goal's cache (all days/end_date).
        If goal_id is None, invalidates ALL goals for the user.

    Call this when user creates a check-in, goal, etc.
    """
    redis = get_redis_client()
    if not redis:
        return

    if goal_id:
        pattern = f"{ANALYTICS_CACHE_PREFIX}:{user_id}:{goal_id}:*"
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
    else:
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
    Run every 8 hours (3x daily).

    V2: Analytics are now per-goal, so we prewarm each goal separately.

    Scalability (per SCALABILITY.md):
    - Batch prefetch premium users (1 query instead of N)
    - Batch prefetch all goals for premium users (1 query instead of N)
    - RPC calls are per-goal (unavoidable due to function signature)
    - Limits to 100 users and 500 goals per run
    """
    supabase = get_supabase_client()

    try:
        if user_ids:
            # Specific users provided
            users = user_ids[:100]  # Limit to 100 users
        else:
            # Get recently active users
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

            # Unique user IDs, limit to 100
            users = list(set(c["user_id"] for c in result.data))[:100]

        if not users:
            return {"status": "no_users"}

        # =====================================================
        # BATCH 1: Get premium users with advanced_analytics feature
        # Single query instead of N queries (per SCALABILITY.md 1.3)
        # =====================================================
        premium_result = (
            supabase.table("users")
            .select("id, timezone")
            .in_("id", users)
            .eq("plan", "premium")
            .eq("status", "active")
            .execute()
        )

        premium_user_ids = (
            set(u["id"] for u in premium_result.data) if premium_result.data else set()
        )
        user_tz_map = {
            u["id"]: (u.get("timezone") or "UTC") for u in (premium_result.data or [])
        }

        if not premium_user_ids:
            return {"status": "no_premium_users", "checked": len(users)}

        # =====================================================
        # BATCH 2: Get all active goals for premium users
        # Single query instead of N queries (per SCALABILITY.md 1.3)
        # =====================================================
        goals_result = (
            supabase.table("goals")
            .select("id, user_id")
            .in_("user_id", list(premium_user_ids))
            .eq("status", "active")
            .execute()
        )

        if not goals_result.data:
            return {"status": "no_goals", "premium_users": len(premium_user_ids)}

        # Build list of (user_id, goal_id) tuples to process
        goals_to_prewarm = [(g["user_id"], g["id"]) for g in goals_result.data]

        # Limit total goals to prevent long-running task
        MAX_GOALS_PER_RUN = 500
        goals_to_prewarm = goals_to_prewarm[:MAX_GOALS_PER_RUN]

        # =====================================================
        # PROCESS: Prewarm each goal's analytics
        # RPC calls are per-goal (unavoidable - function requires goal_id)
        # This is acceptable per SCALABILITY.md 13.1 (low volume, off-peak)
        # =====================================================
        prewarmed = 0
        skipped_cached = 0

        for user_id, goal_id in goals_to_prewarm:
            user_tz = user_tz_map.get(user_id) or "UTC"
            end_date = _user_today_iso(user_tz)

            # Check Redis cache first (O(1) lookup)
            if get_cached_analytics(user_id, 90, goal_id, end_date):
                skipped_cached += 1
                continue

            # Fetch and cache per-goal analytics
            try:
                result = supabase.rpc(
                    "get_analytics_dashboard",
                    {
                        "p_user_id": user_id,
                        "p_goal_id": goal_id,
                        "p_days": 90,
                        "p_end_date": end_date,
                    },
                ).execute()

                if result.data:
                    set_cached_analytics(user_id, 90, result.data, goal_id, end_date)
                    prewarmed += 1

            except Exception as e:
                logger.warning(
                    f"Failed to prewarm analytics for {user_id}, goal {goal_id}: {e}"
                )

        logger.info(
            f"Analytics prewarm completed",
            {
                "prewarmed": prewarmed,
                "skipped_cached": skipped_cached,
                "premium_users": len(premium_user_ids),
                "total_goals": len(goals_to_prewarm),
            },
        )
        return {
            "prewarmed": prewarmed,
            "skipped_cached": skipped_cached,
            "premium_users": len(premium_user_ids),
            "total_goals": len(goals_to_prewarm),
        }

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
