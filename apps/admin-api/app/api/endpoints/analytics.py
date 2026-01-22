"""
Admin Analytics Endpoints
Dashboard statistics and reports
"""

from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import datetime, timedelta, timezone
import redis
import json
from app.core.admin_auth import get_current_admin
from app.core.database import get_supabase_client
from app.core.config import settings

router = APIRouter(prefix="/analytics", tags=["Analytics"])

# Analytics cache prefix (must match main API)
ANALYTICS_CACHE_PREFIX = "analytics:dashboard"


@router.get("/dashboard")
async def get_dashboard_stats(current_admin: dict = Depends(get_current_admin)):
    """
    Get main dashboard statistics
    """
    supabase = get_supabase_client()
    now = datetime.now(timezone.utc)
    today = now.date()
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)

    # Users
    total_users = supabase.table("users").select("id", count="exact").execute()

    new_users_week = (
        supabase.table("users")
        .select("id", count="exact")
        .gte("created_at", week_ago.isoformat())
        .execute()
    )

    active_users_week = (
        supabase.table("users")
        .select("id", count="exact")
        .gte("last_active_at", week_ago.isoformat())
        .execute()
    )

    # Goals
    total_goals = supabase.table("goals").select("id", count="exact").execute()

    active_goals = (
        supabase.table("goals")
        .select("id", count="exact")
        .eq("status", "active")
        .execute()
    )

    # Checkins
    total_checkins = supabase.table("checkins").select("id", count="exact").execute()

    checkins_today = (
        supabase.table("checkins")
        .select("id", count="exact")
        .eq("check_in_date", today.isoformat())
        .execute()
    )

    checkins_week = (
        supabase.table("checkins")
        .select("id", count="exact")
        .gte("check_in_date", week_ago.isoformat())
        .execute()
    )

    # Subscriptions
    active_subs = (
        supabase.table("subscriptions")
        .select("id", count="exact")
        .eq("status", "active")
        .execute()
    )

    # Get MRR
    plan_result = (
        supabase.table("subscription_plans")
        .select("monthly_price")
        .eq("id", "premium")
        .execute()
    )
    monthly_price = 9.99
    if plan_result.data:
        monthly_price = float(plan_result.data[0].get("monthly_price", 9.99))

    mrr = (active_subs.count or 0) * monthly_price

    return {
        "users": {
            "total": total_users.count or 0,
            "new_this_week": new_users_week.count or 0,
            "active_this_week": active_users_week.count or 0,
        },
        "goals": {
            "total": total_goals.count or 0,
            "active": active_goals.count or 0,
        },
        "checkins": {
            "total": total_checkins.count or 0,
            "today": checkins_today.count or 0,
            "this_week": checkins_week.count or 0,
        },
        "subscriptions": {
            "active": active_subs.count or 0,
            "mrr": mrr,
        },
        "generated_at": now.isoformat(),
    }


@router.get("/users/growth")
async def get_user_growth(
    days: int = Query(30, ge=7, le=365),
    current_admin: dict = Depends(get_current_admin),
):
    """
    Get user growth over time
    """
    supabase = get_supabase_client()
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)

    # Get daily signups
    result = (
        supabase.table("users")
        .select("created_at")
        .gte("created_at", start_date.isoformat())
        .order("created_at")
        .execute()
    )

    # Group by date
    daily_counts = {}
    for user in result.data:
        date = user["created_at"][:10]  # Extract date part
        daily_counts[date] = daily_counts.get(date, 0) + 1

    # Fill in missing dates
    current = start_date.date()
    end = now.date()
    data_points = []
    cumulative = 0

    while current <= end:
        date_str = current.isoformat()
        count = daily_counts.get(date_str, 0)
        cumulative += count
        data_points.append(
            {
                "date": date_str,
                "new_users": count,
                "cumulative": cumulative,
            }
        )
        current += timedelta(days=1)

    return {
        "period_days": days,
        "data": data_points,
    }


@router.get("/checkins/activity")
async def get_checkin_activity(
    days: int = Query(30, ge=7, le=365),
    current_admin: dict = Depends(get_current_admin),
):
    """
    Get checkin activity over time
    """
    supabase = get_supabase_client()
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)

    result = (
        supabase.table("checkins")
        .select("check_in_date, completed")
        .gte("check_in_date", start_date.date().isoformat())
        .order("check_in_date")
        .execute()
    )

    # Group by date
    daily_data = {}
    for checkin in result.data:
        date = checkin["check_in_date"]
        if date not in daily_data:
            daily_data[date] = {"completed": 0, "missed": 0}

        if checkin.get("completed"):
            daily_data[date]["completed"] += 1
        else:
            daily_data[date]["missed"] += 1

    # Fill in missing dates
    current = start_date.date()
    end = now.date()
    data_points = []

    while current <= end:
        date_str = current.isoformat()
        day_data = daily_data.get(date_str, {"completed": 0, "missed": 0})
        total = day_data["completed"] + day_data["missed"]
        data_points.append(
            {
                "date": date_str,
                "completed": day_data["completed"],
                "missed": day_data["missed"],
                "total": total,
                "completion_rate": (
                    round(day_data["completed"] / total * 100, 1) if total > 0 else 0
                ),
            }
        )
        current += timedelta(days=1)

    return {
        "period_days": days,
        "data": data_points,
    }


@router.get("/retention")
async def get_retention_stats(current_admin: dict = Depends(get_current_admin)):
    """
    Get user retention statistics
    """
    supabase = get_supabase_client()
    now = datetime.now(timezone.utc)

    # Users who signed up in each cohort week and were active this week
    cohorts = []

    for weeks_ago in range(1, 9):  # Last 8 weeks
        cohort_start = now - timedelta(weeks=weeks_ago)
        cohort_end = cohort_start + timedelta(weeks=1)
        week_ago = now - timedelta(weeks=1)

        # Users who signed up in this cohort
        cohort_users = (
            supabase.table("users")
            .select("id", count="exact")
            .gte("created_at", cohort_start.isoformat())
            .lt("created_at", cohort_end.isoformat())
            .execute()
        )

        # Of those, how many were active this week
        retained_users = (
            supabase.table("users")
            .select("id", count="exact")
            .gte("created_at", cohort_start.isoformat())
            .lt("created_at", cohort_end.isoformat())
            .gte("last_active_at", week_ago.isoformat())
            .execute()
        )

        cohort_size = cohort_users.count or 0
        retained = retained_users.count or 0

        cohorts.append(
            {
                "week": weeks_ago,
                "cohort_start": cohort_start.date().isoformat(),
                "cohort_size": cohort_size,
                "retained": retained,
                "retention_rate": (
                    round(retained / cohort_size * 100, 1) if cohort_size > 0 else 0
                ),
            }
        )

    return {
        "cohorts": cohorts,
        "generated_at": now.isoformat(),
    }


@router.delete("/cache")
async def clear_analytics_cache(current_admin: dict = Depends(get_current_admin)):
    """
    Clear all user analytics cache entries.

    Use when schema changes to clear stale data that causes validation errors.
    """
    if not settings.REDIS_URL:
        return {
            "success": False,
            "deleted_keys": 0,
            "message": "Redis not configured",
        }

    try:
        redis_client = redis.from_url(settings.REDIS_URL)
        deleted = 0
        cursor = 0
        pattern = f"{ANALYTICS_CACHE_PREFIX}:*"

        # Use SCAN to find all matching keys (safe for production)
        while True:
            cursor, keys = redis_client.scan(cursor, match=pattern, count=100)
            if keys:
                redis_client.delete(*keys)
                deleted += len(keys)
            if cursor == 0:
                break

        return {
            "success": True,
            "deleted_keys": deleted,
            "message": f"Cleared {deleted} analytics cache entries",
        }
    except Exception as e:
        return {
            "success": False,
            "deleted_keys": 0,
            "message": f"Error: {str(e)}",
        }
