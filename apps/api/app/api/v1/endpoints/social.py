from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.core.flexible_auth import get_current_user

router = APIRouter(
    redirect_slashes=False
)  # Disable redirects to preserve Authorization header


# Pydantic models
class PostCreate(BaseModel):
    content: str
    media_url: Optional[str] = None
    media_type: str = "text"  # text, voice, image
    is_public: bool = True


class PostResponse(BaseModel):
    id: str
    user_id: str
    content: str
    media_url: Optional[str]
    media_type: str
    is_public: bool
    likes_count: int
    comments_count: int
    created_at: str
    updated_at: str
    user: dict  # User info


class CommentCreate(BaseModel):
    content: str


class CommentResponse(BaseModel):
    id: str
    post_id: str
    user_id: str
    content: str
    created_at: str
    updated_at: str
    user: dict  # User info


class LikeCreate(BaseModel):
    reaction_type: str = "like"  # like, cheer, love


class FollowCreate(BaseModel):
    following_id: str


@router.get("/feed", response_model=List[PostResponse])
async def get_feed(
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    category: Optional[str] = None,
    user_id: Optional[str] = None,
):
    """Get social feed with AI and community posts"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    offset = (page - 1) * limit

    # Get user's feed preferences
    preferences = (
        supabase.table("feed_preferences")
        .select("*")
        .eq("user_id", current_user["id"])
        .execute()
    )
    prefs = preferences.data[0] if preferences.data else {}

    # Build query
    query = supabase.table("posts").select(
        """
        *,
        user:users(id, name, username, profile_picture_url, plan)
    """
    )

    # Apply filters
    if user_id:
        query = query.eq("user_id", user_id)
    elif prefs.get("show_following_only"):
        # Get following users
        following = (
            supabase.table("follows")
            .select("following_id")
            .eq("follower_id", current_user["id"])
            .execute()
        )
        following_ids = [f["following_id"] for f in following.data]
        if following_ids:
            query = query.in_("user_id", following_ids)
        else:
            # No following, return empty
            return []

    if category:
        # This would need to be implemented based on your category system
        pass

    result = (
        query.eq("is_public", True)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    # Add AI motivation posts if enabled
    if prefs.get("show_ai_posts", True):
        ai_motivations = (
            supabase.table("motivations")
            .select("*")
            .eq("user_id", current_user["id"])
            .eq("is_sent", True)
            .order("sent_at", desc=True)
            .limit(5)
            .execute()
        )

        # Convert AI motivations to post format
        ai_posts = []
        for motivation in ai_motivations.data:
            ai_posts.append(
                {
                    "id": f"ai_{motivation['id']}",
                    "user_id": "ai",
                    "content": motivation["message"],
                    "media_url": None,
                    "media_type": "text",
                    "is_public": True,
                    "likes_count": 0,
                    "comments_count": 0,
                    "created_at": motivation["sent_at"],
                    "updated_at": motivation["sent_at"],
                    "user": {
                        "id": "ai",
                        "name": "FitNudge AI",
                        "username": "fitnudge_ai",
                        "profile_picture_url": None,
                        "plan": "ai",
                    },
                }
            )

        # Merge and sort
        all_posts = result.data + ai_posts
        all_posts.sort(key=lambda x: x["created_at"], reverse=True)
        return all_posts[:limit]

    return result.data


@router.post("/posts", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    post_data: PostCreate, current_user: dict = Depends(get_current_user)
):
    """Create a new post"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Check if user has permission for voice posts (Pro/Coach+ only)
    if post_data.media_type == "voice" and current_user["plan"] == "free":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Voice posts are available for Pro and Coach+ users only",
        )

    post = {
        "user_id": current_user["id"],
        "content": post_data.content,
        "media_url": post_data.media_url,
        "media_type": post_data.media_type,
        "is_public": post_data.is_public,
        "likes_count": 0,
        "comments_count": 0,
    }

    result = supabase.table("posts").insert(post).execute()
    post_data = result.data[0]

    # Get user info
    user_info = (
        supabase.table("users")
        .select("id, name, username, profile_picture_url, plan")
        .eq("id", current_user["id"])
        .execute()
    )

    return {**post_data, "user": user_info.data[0]}


@router.get("/posts/{post_id}", response_model=PostResponse)
async def get_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Get specific post by ID"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    result = (
        supabase.table("posts")
        .select(
            """
        *,
        user:users(id, name, username, profile_picture_url, plan)
    """
        )
        .eq("id", post_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Post not found"
        )

    return result.data[0]


@router.delete("/posts/{post_id}")
async def delete_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a post"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Check if post exists and belongs to user
    post = (
        supabase.table("posts")
        .select("*")
        .eq("id", post_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not post.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Post not found"
        )

    supabase.table("posts").delete().eq("id", post_id).execute()
    return {"message": "Post deleted successfully"}


@router.post(
    "/posts/{post_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    post_id: str,
    comment_data: CommentCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a comment on a post"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Check if post exists
    post = supabase.table("posts").select("*").eq("id", post_id).execute()
    if not post.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Post not found"
        )

    comment = {
        "post_id": post_id,
        "user_id": current_user["id"],
        "content": comment_data.content,
    }

    result = supabase.table("comments").insert(comment).execute()
    comment_data = result.data[0]

    # Get user info
    user_info = (
        supabase.table("users")
        .select("id, name, username, profile_picture_url, plan")
        .eq("id", current_user["id"])
        .execute()
    )

    return {**comment_data, "user": user_info.data[0]}


@router.get("/posts/{post_id}/comments", response_model=List[CommentResponse])
async def get_post_comments(
    post_id: str,
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
):
    """Get comments for a post"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    offset = (page - 1) * limit

    result = (
        supabase.table("comments")
        .select(
            """
        *,
        user:users(id, name, username, profile_picture_url, plan)
    """
        )
        .eq("post_id", post_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    return result.data


@router.post("/posts/{post_id}/like")
async def like_post(
    post_id: str, like_data: LikeCreate, current_user: dict = Depends(get_current_user)
):
    """Like or react to a post"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Check if post exists
    post = supabase.table("posts").select("*").eq("id", post_id).execute()
    if not post.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Post not found"
        )

    # Check if user already liked this post
    existing_like = (
        supabase.table("likes")
        .select("*")
        .eq("post_id", post_id)
        .eq("user_id", current_user["id"])
        .execute()
    )

    if existing_like.data:
        # Update existing like
        supabase.table("likes").update({"reaction_type": like_data.reaction_type}).eq(
            "id", existing_like.data[0]["id"]
        ).execute()
    else:
        # Create new like
        like = {
            "post_id": post_id,
            "user_id": current_user["id"],
            "reaction_type": like_data.reaction_type,
        }
        supabase.table("likes").insert(like).execute()

    return {"message": "Post liked successfully"}


@router.delete("/posts/{post_id}/like")
async def unlike_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Remove like from a post"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Remove like
    supabase.table("likes").delete().eq("post_id", post_id).eq(
        "user_id", current_user["id"]
    ).execute()

    return {"message": "Post unliked successfully"}


@router.post("/users/{user_id}/follow")
async def follow_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Follow a user"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Check if user exists
    user = supabase.table("users").select("*").eq("id", user_id).execute()
    if not user.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Check if already following
    existing_follow = (
        supabase.table("follows")
        .select("*")
        .eq("follower_id", current_user["id"])
        .eq("following_id", user_id)
        .execute()
    )
    if existing_follow.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already following this user",
        )

    # Create follow relationship
    follow = {"follower_id": current_user["id"], "following_id": user_id}
    supabase.table("follows").insert(follow).execute()

    return {"message": "User followed successfully"}


@router.delete("/users/{user_id}/follow")
async def unfollow_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Unfollow a user"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Remove follow relationship
    supabase.table("follows").delete().eq("follower_id", current_user["id"]).eq(
        "following_id", user_id
    ).execute()

    return {"message": "User unfollowed successfully"}


@router.get("/users/{user_id}/followers")
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
        follower:users(id, name, username, profile_picture_url, plan)
    """
        )
        .eq("following_id", user_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    return result.data


@router.get("/users/{user_id}/following")
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
        following:users(id, name, username, profile_picture_url, plan)
    """
        )
        .eq("follower_id", user_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    return result.data
