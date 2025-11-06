from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from app.core.flexible_auth import get_current_user

router = APIRouter(
    redirect_slashes=False
)  # Disable redirects to preserve Authorization header


# Pydantic models
class AnalyticsDashboard(BaseModel):
    user_stats: Dict[str, Any]
    goals_overview: Dict[str, Any]
    recent_activity: List[Dict[str, Any]]
    motivation_stats: Dict[str, Any]
    social_stats: Dict[str, Any]


class GoalsAnalytics(BaseModel):
    total_goals: int
    active_goals: int
    completed_goals: int
    completion_rate: float
    goals_by_category: Dict[str, int]
    goals_timeline: List[Dict[str, Any]]
    streak_analytics: Dict[str, Any]


class MotivationAnalytics(BaseModel):
    total_motivations: int
    sent_motivations: int
    response_rate: float
    motivation_timeline: List[Dict[str, Any]]
    tone_preferences: Dict[str, int]
    engagement_metrics: Dict[str, Any]


class SocialAnalytics(BaseModel):
    total_posts: int
    total_likes: int
    total_comments: int
    followers_count: int
    following_count: int
    engagement_rate: float
    posts_timeline: List[Dict[str, Any]]
    top_posts: List[Dict[str, Any]]


@router.get("/dashboard", response_model=AnalyticsDashboard)
async def get_dashboard_analytics(
    current_user: dict = Depends(get_current_user),
    days: int = Query(30, ge=7, le=365),
):
    """Get comprehensive dashboard analytics"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    end_date = date.today()
    start_date = end_date - timedelta(days=days)

    # User stats
    user_stats = await get_user_stats(
        supabase, current_user["id"], start_date, end_date
    )

    # Goals overview
    goals_overview = await get_goals_overview(
        supabase, current_user["id"], start_date, end_date
    )

    # Recent activity
    recent_activity = await get_recent_activity(supabase, current_user["id"], 10)

    # Motivation stats
    motivation_stats = await get_motivation_stats(
        supabase, current_user["id"], start_date, end_date
    )

    # Social stats
    social_stats = await get_social_stats(
        supabase, current_user["id"], start_date, end_date
    )

    return AnalyticsDashboard(
        user_stats=user_stats,
        goals_overview=goals_overview,
        recent_activity=recent_activity,
        motivation_stats=motivation_stats,
        social_stats=social_stats,
    )


@router.get("/goals", response_model=GoalsAnalytics)
async def get_goals_analytics(
    current_user: dict = Depends(get_current_user),
    days: int = Query(30, ge=7, le=365),
):
    """Get detailed goals analytics"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    end_date = date.today()
    start_date = end_date - timedelta(days=days)

    # Get goals data
    goals_result = (
        supabase.table("goals")
        .select("*")
        .eq("user_id", current_user["id"])
        .gte("created_at", start_date.isoformat())
        .execute()
    )

    goals = goals_result.data
    total_goals = len(goals)
    active_goals = len([g for g in goals if g["is_active"]])
    completed_goals = total_goals - active_goals
    completion_rate = (completed_goals / total_goals * 100) if total_goals > 0 else 0

    # Goals by category
    goals_by_category = {}
    for goal in goals:
        category = goal["category"]
        goals_by_category[category] = goals_by_category.get(category, 0) + 1

    # Goals timeline (goals created over time)
    goals_timeline = []
    for i in range(days):
        current_date = start_date + timedelta(days=i)
        goals_created = len(
            [
                g
                for g in goals
                if datetime.fromisoformat(g["created_at"]).date() == current_date
            ]
        )
        goals_timeline.append(
            {"date": current_date.isoformat(), "goals_created": goals_created}
        )

    # Streak analytics
    checkins_result = (
        supabase.table("check_ins")
        .select("date, completed")
        .eq("user_id", current_user["id"])
        .gte("date", start_date.isoformat())
        .execute()
    )

    checkins = checkins_result.data
    current_streak = calculate_current_streak(checkins)
    longest_streak = calculate_longest_streak(checkins)

    return GoalsAnalytics(
        total_goals=total_goals,
        active_goals=active_goals,
        completed_goals=completed_goals,
        completion_rate=completion_rate,
        goals_by_category=goals_by_category,
        goals_timeline=goals_timeline,
        streak_analytics={
            "current_streak": current_streak,
            "longest_streak": longest_streak,
            "total_check_ins": len(checkins),
            "completed_check_ins": len([c for c in checkins if c["completed"]]),
        },
    )


@router.get("/motivation", response_model=MotivationAnalytics)
async def get_motivation_analytics(
    current_user: dict = Depends(get_current_user),
    days: int = Query(30, ge=7, le=365),
):
    """Get detailed motivation analytics"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    end_date = date.today()
    start_date = end_date - timedelta(days=days)

    # Get motivations data
    motivations_result = (
        supabase.table("motivations")
        .select("*")
        .eq("user_id", current_user["id"])
        .gte("created_at", start_date.isoformat())
        .execute()
    )

    motivations = motivations_result.data
    total_motivations = len(motivations)
    sent_motivations = len([m for m in motivations if m["is_sent"]])
    response_rate = (
        (sent_motivations / total_motivations * 100) if total_motivations > 0 else 0
    )

    # Motivation timeline
    motivation_timeline = []
    for i in range(days):
        current_date = start_date + timedelta(days=i)
        motivations_created = len(
            [
                m
                for m in motivations
                if datetime.fromisoformat(m["created_at"]).date() == current_date
            ]
        )
        motivation_timeline.append(
            {
                "date": current_date.isoformat(),
                "motivations_created": motivations_created,
            }
        )

    # Tone preferences (if stored)
    tone_preferences = {}
    for motivation in motivations:
        tone = motivation.get("tone", "friendly")
        tone_preferences[tone] = tone_preferences.get(tone, 0) + 1

    return MotivationAnalytics(
        total_motivations=total_motivations,
        sent_motivations=sent_motivations,
        response_rate=response_rate,
        motivation_timeline=motivation_timeline,
        tone_preferences=tone_preferences,
        engagement_metrics={
            "avg_motivations_per_day": total_motivations / days,
            "most_active_day": get_most_active_day(motivation_timeline),
        },
    )


@router.get("/social", response_model=SocialAnalytics)
async def get_social_analytics(
    current_user: dict = Depends(get_current_user),
    days: int = Query(30, ge=7, le=365),
):
    """Get detailed social analytics"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    end_date = date.today()
    start_date = end_date - timedelta(days=days)

    # Get posts data
    posts_result = (
        supabase.table("posts")
        .select("*")
        .eq("user_id", current_user["id"])
        .gte("created_at", start_date.isoformat())
        .execute()
    )

    posts = posts_result.data
    total_posts = len(posts)
    total_likes = sum(post["likes_count"] for post in posts)
    total_comments = sum(post["comments_count"] for post in posts)

    # Get followers/following counts
    followers_result = (
        supabase.table("follows")
        .select("id")
        .eq("following_id", current_user["id"])
        .execute()
    )
    followers_count = len(followers_result.data)

    following_result = (
        supabase.table("follows")
        .select("id")
        .eq("follower_id", current_user["id"])
        .execute()
    )
    following_count = len(following_result.data)

    engagement_rate = (
        ((total_likes + total_comments) / total_posts) if total_posts > 0 else 0
    )

    # Posts timeline
    posts_timeline = []
    for i in range(days):
        current_date = start_date + timedelta(days=i)
        posts_created = len(
            [
                p
                for p in posts
                if datetime.fromisoformat(p["created_at"]).date() == current_date
            ]
        )
        posts_timeline.append(
            {"date": current_date.isoformat(), "posts_created": posts_created}
        )

    # Top posts (by engagement)
    top_posts = sorted(
        posts, key=lambda x: x["likes_count"] + x["comments_count"], reverse=True
    )[:5]

    return SocialAnalytics(
        total_posts=total_posts,
        total_likes=total_likes,
        total_comments=total_comments,
        followers_count=followers_count,
        following_count=following_count,
        engagement_rate=engagement_rate,
        posts_timeline=posts_timeline,
        top_posts=top_posts,
    )


# Helper functions
async def get_user_stats(
    supabase, user_id: str, start_date: date, end_date: date
) -> Dict[str, Any]:
    """Get user statistics"""
    # Get basic user info
    user_result = supabase.table("users").select("*").eq("id", user_id).execute()
    user = user_result.data[0] if user_result.data else {}

    # Get goals count
    goals_result = supabase.table("goals").select("id").eq("user_id", user_id).execute()
    goals_count = len(goals_result.data)

    # Get check-ins count
    checkins_result = (
        supabase.table("check_ins")
        .select("id")
        .eq("user_id", user_id)
        .gte("date", start_date.isoformat())
        .lte("date", end_date.isoformat())
        .execute()
    )
    checkins_count = len(checkins_result.data)

    return {
        "user_id": user_id,
        "name": user.get("name", ""),
        "username": user.get("username", ""),
        "plan": user.get("plan", "free"),
        "goals_count": goals_count,
        "check_ins_count": checkins_count,
        "period_days": (end_date - start_date).days,
    }


async def get_goals_overview(
    supabase, user_id: str, start_date: date, end_date: date
) -> Dict[str, Any]:
    """Get goals overview"""
    goals_result = (
        supabase.table("goals")
        .select("*")
        .eq("user_id", user_id)
        .gte("created_at", start_date.isoformat())
        .lte("created_at", end_date.isoformat())
        .execute()
    )

    goals = goals_result.data
    active_goals = len([g for g in goals if g["is_active"]])

    return {
        "total_goals": len(goals),
        "active_goals": active_goals,
        "completed_goals": len(goals) - active_goals,
    }


async def get_recent_activity(
    supabase, user_id: str, limit: int
) -> List[Dict[str, Any]]:
    """Get recent activity"""
    # Get recent check-ins
    checkins_result = (
        supabase.table("check_ins")
        .select("date, completed, goal:goals(title)")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )

    activities = []
    for checkin in checkins_result.data:
        activities.append(
            {
                "type": "check_in",
                "date": checkin["date"],
                "description": f"Checked in for goal: {checkin['goal']['title']}",
                "completed": checkin["completed"],
            }
        )

    return activities[:limit]


async def get_motivation_stats(
    supabase, user_id: str, start_date: date, end_date: date
) -> Dict[str, Any]:
    """Get motivation statistics"""
    motivations_result = (
        supabase.table("motivations")
        .select("*")
        .eq("user_id", user_id)
        .gte("created_at", start_date.isoformat())
        .lte("created_at", end_date.isoformat())
        .execute()
    )

    motivations = motivations_result.data
    sent_motivations = len([m for m in motivations if m["is_sent"]])

    return {
        "total_motivations": len(motivations),
        "sent_motivations": sent_motivations,
        "response_rate": (
            (sent_motivations / len(motivations) * 100) if motivations else 0
        ),
    }


async def get_social_stats(
    supabase, user_id: str, start_date: date, end_date: date
) -> Dict[str, Any]:
    """Get social statistics"""
    posts_result = (
        supabase.table("posts")
        .select("*")
        .eq("user_id", user_id)
        .gte("created_at", start_date.isoformat())
        .lte("created_at", end_date.isoformat())
        .execute()
    )

    posts = posts_result.data
    total_likes = sum(post["likes_count"] for post in posts)
    total_comments = sum(post["comments_count"] for post in posts)

    return {
        "total_posts": len(posts),
        "total_likes": total_likes,
        "total_comments": total_comments,
        "engagement_rate": (
            ((total_likes + total_comments) / len(posts)) if posts else 0
        ),
    }


def calculate_current_streak(checkins: List[Dict]) -> int:
    """Calculate current streak from check-ins"""
    if not checkins:
        return 0

    sorted_checkins = sorted(checkins, key=lambda x: x["date"], reverse=True)
    streak = 0

    for checkin in sorted_checkins:
        if checkin["completed"]:
            streak += 1
        else:
            break

    return streak


def calculate_longest_streak(checkins: List[Dict]) -> int:
    """Calculate longest streak from check-ins"""
    if not checkins:
        return 0

    sorted_checkins = sorted(checkins, key=lambda x: x["date"], reverse=True)
    longest_streak = 0
    current_streak = 0

    for checkin in sorted_checkins:
        if checkin["completed"]:
            current_streak += 1
            longest_streak = max(longest_streak, current_streak)
        else:
            current_streak = 0

    return longest_streak


def get_most_active_day(timeline: List[Dict]) -> str:
    """Get the most active day from timeline data"""
    if not timeline:
        return ""

    max_activity = max(timeline, key=lambda x: x.get("motivations_created", 0))
    return max_activity["date"]
