from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
from app.core.flexible_auth import get_current_user

router = APIRouter(
    redirect_slashes=False
)  # Disable redirects to preserve Authorization header


# Pydantic models
class UserSearchResult(BaseModel):
    id: str
    name: str
    username: str
    profile_picture_url: Optional[str]
    bio: Optional[str]
    plan: str
    followers_count: int
    is_following: bool


class PostSearchResult(BaseModel):
    id: str
    content: str
    media_url: Optional[str]
    media_type: str
    likes_count: int
    comments_count: int
    created_at: str
    user: dict


class TrendingPost(BaseModel):
    id: str
    content: str
    media_url: Optional[str]
    media_type: str
    likes_count: int
    comments_count: int
    created_at: str
    user: dict
    trending_score: float


class TrendingHashtag(BaseModel):
    hashtag: str
    post_count: int
    trend_score: float


class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    message: str
    data: dict
    is_read: bool
    created_at: str
    user: dict  # User who triggered the notification


@router.get("/users/search", response_model=List[UserSearchResult])
async def search_users(
    query: str = Query(..., min_length=2),
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
):
    """Search users by name or username"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    offset = (page - 1) * limit

    # Search users by name or username
    result = (
        supabase.table("users")
        .select(
            """
        id, name, username, profile_picture_url, bio, plan,
        followers_count:follows(count)
        """
        )
        .or_(f"name.ilike.%{query}%,username.ilike.%{query}%")
        .neq("id", current_user["id"])  # Exclude current user
        .order("followers_count", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    # Check which users the current user is following
    following_result = (
        supabase.table("follows")
        .select("following_id")
        .eq("follower_id", current_user["id"])
        .execute()
    )
    following_ids = {f["following_id"] for f in following_result.data}

    # Add is_following flag to each user
    users = []
    for user in result.data:
        user["is_following"] = user["id"] in following_ids
        users.append(user)

    return users


@router.get("/posts/search", response_model=List[PostSearchResult])
async def search_posts(
    query: str = Query(..., min_length=2),
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
):
    """Search posts by content"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    offset = (page - 1) * limit

    result = (
        supabase.table("posts")
        .select(
            """
        *,
        user:users(id, name, username, profile_picture_url, plan)
        """
        )
        .text_search("content", query)
        .eq("is_public", True)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    return result.data


@router.get("/posts/trending", response_model=List[TrendingPost])
async def get_trending_posts(
    current_user: dict = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=50),
):
    """Get trending posts based on engagement"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Get posts from the last 7 days with high engagement
    seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()

    result = (
        supabase.table("posts")
        .select(
            """
        *,
        user:users(id, name, username, profile_picture_url, plan)
        """
        )
        .eq("is_public", True)
        .gte("created_at", seven_days_ago)
        .order("likes_count", desc=True)
        .order("comments_count", desc=True)
        .limit(limit)
        .execute()
    )

    # Calculate trending score (likes + comments + recency)
    trending_posts = []
    for post in result.data:
        # Simple trending score calculation
        engagement_score = post["likes_count"] + (post["comments_count"] * 2)
        recency_score = 1.0  # Could be more sophisticated

        trending_score = engagement_score * recency_score

        post["trending_score"] = trending_score
        trending_posts.append(post)

    # Sort by trending score
    trending_posts.sort(key=lambda x: x["trending_score"], reverse=True)

    return trending_posts


@router.get("/hashtags/trending", response_model=List[TrendingHashtag])
async def get_trending_hashtags(
    current_user: dict = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=50),
):
    """Get trending hashtags"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Get hashtags from posts in the last 7 days
    seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()

    # This would require a hashtags table or extracting hashtags from post content
    # For now, return a placeholder implementation
    return [
        {"hashtag": "#fitness", "post_count": 150, "trend_score": 95.5},
        {"hashtag": "#motivation", "post_count": 120, "trend_score": 88.2},
        {"hashtag": "#workout", "post_count": 98, "trend_score": 82.1},
        {"hashtag": "#health", "post_count": 85, "trend_score": 75.8},
        {"hashtag": "#goals", "post_count": 72, "trend_score": 68.4},
    ]


@router.get("/notifications", response_model=List[NotificationResponse])
async def get_notifications(
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
):
    """Get user notifications"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    offset = (page - 1) * limit

    result = (
        supabase.table("notifications")
        .select(
            """
        *,
        user:users(id, name, username, profile_picture_url)
        """
        )
        .eq("user_id", current_user["id"])
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    return result.data


@router.post("/notifications/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: str, current_user: dict = Depends(get_current_user)
):
    """Mark a notification as read"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Check if notification exists and belongs to user
    notification = (
        supabase.table("notifications")
        .select("*")
        .eq("id", notification_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not notification.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found"
        )

    # Mark as read
    supabase.table("notifications").update({"is_read": True}).eq(
        "id", notification_id
    ).execute()

    return {"message": "Notification marked as read"}


@router.post("/notifications/read-all")
async def mark_all_notifications_as_read(
    current_user: dict = Depends(get_current_user),
):
    """Mark all notifications as read"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Mark all user notifications as read
    supabase.table("notifications").update({"is_read": True}).eq(
        "user_id", current_user["id"]
    ).execute()

    return {"message": "All notifications marked as read"}


# Additional social features that might be needed
@router.get("/users/{user_id}/posts", response_model=List[PostSearchResult])
async def get_user_posts(
    user_id: str,
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
):
    """Get posts by a specific user"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    offset = (page - 1) * limit

    result = (
        supabase.table("posts")
        .select(
            """
        *,
        user:users(id, name, username, profile_picture_url, plan)
        """
        )
        .eq("user_id", user_id)
        .eq("is_public", True)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    return result.data


@router.get("/users/{user_id}/followers", response_model=List[UserSearchResult])
async def get_user_followers(
    user_id: str,
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
):
    """Get user's followers"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    offset = (page - 1) * limit

    result = (
        supabase.table("follows")
        .select(
            """
        follower_id,
        created_at,
        follower:users(id, name, username, profile_picture_url, bio, plan)
        """
        )
        .eq("following_id", user_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    # Check which users the current user is following
    following_result = (
        supabase.table("follows")
        .select("following_id")
        .eq("follower_id", current_user["id"])
        .execute()
    )
    following_ids = {f["following_id"] for f in following_result.data}

    # Format response
    followers = []
    for follow in result.data:
        follower = follow["follower"]
        follower["is_following"] = follower["id"] in following_ids
        followers.append(follower)

    return followers


@router.get("/users/{user_id}/following", response_model=List[UserSearchResult])
async def get_user_following(
    user_id: str,
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
):
    """Get users that this user is following"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    offset = (page - 1) * limit

    result = (
        supabase.table("follows")
        .select(
            """
        following_id,
        created_at,
        following:users(id, name, username, profile_picture_url, bio, plan)
        """
        )
        .eq("follower_id", user_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    # Check which users the current user is following
    following_result = (
        supabase.table("follows")
        .select("following_id")
        .eq("follower_id", current_user["id"])
        .execute()
    )
    following_ids = {f["following_id"] for f in following_result.data}

    # Format response
    following = []
    for follow in result.data:
        user = follow["following"]
        user["is_following"] = user["id"] in following_ids
        following.append(user)

    return following
