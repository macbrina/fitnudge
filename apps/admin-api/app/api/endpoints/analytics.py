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
from app.core.database import get_supabase_client, first_row
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
    total_checkins = supabase.table("check_ins").select("id", count="exact").execute()

    checkins_today = (
        supabase.table("check_ins")
        .select("id", count="exact")
        .eq("check_in_date", today.isoformat())
        .execute()
    )

    checkins_week = (
        supabase.table("check_ins")
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
        plan_row = first_row(plan_result.data)
        monthly_price = float(plan_row.get("monthly_price", 9.99)) if plan_row else 9.99

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
        supabase.table("check_ins")
        .select("check_in_date, status")
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

        status = checkin.get("status", "")
        if status in ("completed", "rest_day"):
            daily_data[date]["completed"] += 1
        elif status in ("missed", "skipped"):
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


@router.get("/subscriptions/by-platform")
async def get_subscription_breakdown(current_admin: dict = Depends(get_current_admin)):
    """
    Subscription breakdown by platform (iOS, Android, Promo, Admin)
    """
    supabase = get_supabase_client()
    result = (
        supabase.table("subscriptions")
        .select("platform")
        .eq("status", "active")
        .execute()
    )
    counts = {"ios": 0, "android": 0, "promo": 0, "admin_granted": 0, "web": 0}
    for row in result.data or []:
        platform = (row.get("platform") or "admin_granted").lower()
        if platform in counts:
            counts[platform] += 1
        else:
            counts["admin_granted"] += 1
    return {"by_platform": counts, "total": sum(counts.values())}


@router.get("/subscriptions/mrr-trend")
async def get_mrr_trend(
    days: int = Query(30, ge=7, le=365),
    current_admin: dict = Depends(get_current_admin),
):
    """
    MRR trend over time. For each date, counts subscriptions active at end of that day.
    """
    supabase = get_supabase_client()
    plan_result = (
        supabase.table("subscription_plans")
        .select("monthly_price")
        .eq("id", "premium")
        .execute()
    )
    monthly_price = 9.99
    if plan_result.data:
        plan_row = first_row(plan_result.data)
        monthly_price = float(plan_row.get("monthly_price", 9.99)) if plan_row else 9.99

    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)
    all_subs = (
        supabase.table("subscriptions")
        .select("created_at, cancelled_at, status")
        .execute()
    )

    current = start_date.date()
    end = now.date()
    data_points = []
    while current <= end:
        date_str = current.isoformat()
        end_of_day = (current + timedelta(days=1)).isoformat()
        count = sum(
            1 for sub in (all_subs.data or [])
            if (sub.get("created_at") or "") < end_of_day
            and (
                sub.get("status") == "active"
                or (
                    sub.get("status") in ("cancelled", "expired")
                    and sub.get("cancelled_at")
                    and (sub.get("cancelled_at") or "")[:10] > date_str
                )
            )
        )
        data_points.append({
            "date": date_str,
            "mrr": round(count * monthly_price, 2),
            "active_subscriptions": count,
        })
        current += timedelta(days=1)

    return {"period_days": days, "data": data_points}


@router.get("/referrals")
async def get_referral_analytics(current_admin: dict = Depends(get_current_admin)):
    """
    Referral analytics: count, conversion rate, top referrers
    """
    supabase = get_supabase_client()
    all_refs = supabase.table("referrals").select("id, referrer_user_id, status").execute()
    refs = all_refs.data or []
    total = len(refs)
    rewarded = len([r for r in refs if r.get("status") == "rewarded"])
    conversion = round(rewarded / total * 100, 1) if total > 0 else 0

    referrer_counts = {}
    for r in refs:
        uid = r.get("referrer_user_id")
        if uid:
            referrer_counts[uid] = referrer_counts.get(uid, 0) + 1

    top_referrers = sorted(referrer_counts.items(), key=lambda x: -x[1])[:10]
    top_with_names = []
    for uid, count in top_referrers:
        user = supabase.table("users").select("email, name").eq("id", uid).execute()
        u = (user.data or [{}])[0]
        top_with_names.append({
            "user_id": str(uid),
            "email": u.get("email", ""),
            "name": u.get("name", ""),
            "referral_count": count,
        })

    return {
        "total_referrals": total,
        "rewarded": rewarded,
        "conversion_rate": conversion,
        "top_referrers": top_with_names,
    }


@router.get("/subscriptions/churn")
async def get_churn(
    days: int = Query(30, ge=7, le=365),
    current_admin: dict = Depends(get_current_admin),
):
    """
    Churn / cancellations over time
    """
    supabase = get_supabase_client()
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)

    result = (
        supabase.table("subscriptions")
        .select("cancelled_at")
        .not_.is_("cancelled_at", "null")
        .gte("cancelled_at", start_date.isoformat())
        .execute()
    )

    daily_churn = {}
    for row in result.data or []:
        dt = (row.get("cancelled_at") or "")[:10]
        daily_churn[dt] = daily_churn.get(dt, 0) + 1

    current = start_date.date()
    end = now.date()
    data_points = []
    while current <= end:
        date_str = current.isoformat()
        data_points.append({
            "date": date_str,
            "cancellations": daily_churn.get(date_str, 0),
        })
        current += timedelta(days=1)

    return {"period_days": days, "data": data_points}


@router.get("/engagement")
async def get_engagement(current_admin: dict = Depends(get_current_admin)):
    """
    DAU / WAU / MAU
    """
    supabase = get_supabase_client()
    now = datetime.now(timezone.utc)
    today = now.date()
    day_ago = today - timedelta(days=1)
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)

    users = supabase.table("users").select("id, last_active_at").execute()
    dau = wau = mau = 0
    for u in users.data or []:
        lat = u.get("last_active_at")
        if not lat:
            continue
        try:
            d = datetime.fromisoformat(lat.replace("Z", "+00:00")).date()
        except Exception:
            continue
        if d >= day_ago:
            dau += 1
        if d >= week_ago:
            wau += 1
        if d >= month_ago:
            mau += 1

    return {
        "dau": dau,
        "wau": wau,
        "mau": mau,
        "generated_at": now.isoformat(),
    }


@router.get("/broadcasts/engagement")
async def get_broadcast_engagement(current_admin: dict = Depends(get_current_admin)):
    """
    Broadcast engagement: views and clicks from notification_history
    where entity_type = admin_broadcast
    """
    supabase = get_supabase_client()
    result = (
        supabase.table("notification_history")
        .select("entity_id, sent_at, opened_at, dismissed_at")
        .eq("entity_type", "admin_broadcast")
        .execute()
    )
    by_broadcast = {}
    for row in result.data or []:
        eid = row.get("entity_id")
        if not eid:
            continue
        eid_str = str(eid)
        if eid_str not in by_broadcast:
            by_broadcast[eid_str] = {"views": 0, "clicks": 0}
        by_broadcast[eid_str]["views"] += 1
        if row.get("opened_at") or row.get("dismissed_at"):
            by_broadcast[eid_str]["clicks"] += 1

    broadcasts = (
        supabase.table("notifications")
        .select("id, title, created_at")
        .execute()
    )
    items = []
    for b in broadcasts.data or []:
        bid = str(b.get("id", ""))
        eng = by_broadcast.get(bid, {"views": 0, "clicks": 0})
        items.append({
            "broadcast_id": bid,
            "title": b.get("title", ""),
            "created_at": b.get("created_at"),
            "views": eng["views"],
            "clicks": eng["clicks"],
        })
    return {"broadcasts": items, "total_views": sum(e["views"] for e in by_broadcast.values())}


@router.delete("/cache")
async def clear_analytics_cache(current_admin: dict = Depends(get_current_admin)):
    """
    Clear all user analytics cache entries.

    Use when schema changes to clear stale data that causes validation errors.
    """
    redis_url = settings.redis_connection_url
    if not redis_url:
        return {
            "success": False,
            "deleted_keys": 0,
            "message": "Redis not configured",
        }

    try:
        redis_client = redis.from_url(redis_url)
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
