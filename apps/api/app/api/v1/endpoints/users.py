from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date
from app.core.flexible_auth import get_current_user

router = APIRouter(
    redirect_slashes=False
)  # Disable redirects to preserve Authorization header


# Pydantic models
class UserProfileResponse(BaseModel):
    id: str
    email: str
    name: str
    username: str
    profile_picture_url: Optional[str]
    bio: Optional[str]
    plan: str
    timezone: str  # User's timezone (IANA format)
    email_verified: bool
    auth_provider: str
    created_at: str
    last_login_at: Optional[str]


class UserStatsResponse(BaseModel):
    total_goals: int
    active_goals: int
    completed_goals: int
    total_check_ins: int
    current_streak: int
    longest_streak: int
    total_posts: int
    followers_count: int
    following_count: int


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None
    profile_picture_url: Optional[str] = None
    timezone: Optional[str] = None  # IANA timezone string (e.g., 'America/New_York')


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


@router.get("/profile", response_model=UserProfileResponse)
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    """Get current user's profile"""
    return current_user


@router.get("/me/stats", response_model=UserStatsResponse)
async def get_my_stats(current_user: dict = Depends(get_current_user)):
    """Get current user's statistics"""
    return await get_user_stats(current_user["id"], current_user)


@router.get("/stats")
async def get_base_stats(current_user: dict = Depends(get_current_user)):
    """Get base statistics for the app"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Get global stats
    total_users = supabase.table("users").select("id", count="exact").execute()
    total_goals = supabase.table("goals").select("id", count="exact").execute()
    total_posts = supabase.table("posts").select("id", count="exact").execute()

    return {
        "total_users": total_users.count,
        "total_goals": total_goals.count,
        "total_posts": total_posts.count,
    }


@router.get("/{user_id}", response_model=UserProfileResponse)
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get user by ID"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    result = supabase.table("users").select("*").eq("id", user_id).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    return result.data[0]


@router.get("/{user_id}/profile", response_model=UserProfileResponse)
async def get_user_profile(
    user_id: str, current_user: dict = Depends(get_current_user)
):
    """Get user profile (public info only)"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    result = (
        supabase.table("users")
        .select(
            "id, name, username, profile_picture_url, bio, plan, created_at, last_login_at"
        )
        .eq("id", user_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    return result.data[0]


@router.get("/{user_id}/stats", response_model=UserStatsResponse)
async def get_user_stats(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get user statistics"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Get goals stats
    goals_result = (
        supabase.table("goals").select("id, is_active").eq("user_id", user_id).execute()
    )

    total_goals = len(goals_result.data)
    active_goals = len([g for g in goals_result.data if g["is_active"]])
    completed_goals = total_goals - active_goals

    # Get check-ins stats
    checkins_result = (
        supabase.table("check_ins")
        .select("date, completed")
        .eq("user_id", user_id)
        .execute()
    )

    total_check_ins = len(checkins_result.data)

    # Calculate current streak
    current_streak = 0
    longest_streak = 0
    temp_streak = 0

    # Sort check-ins by date
    sorted_checkins = sorted(
        checkins_result.data, key=lambda x: x["date"], reverse=True
    )

    for checkin in sorted_checkins:
        if checkin["completed"]:
            temp_streak += 1
            current_streak = max(current_streak, temp_streak)
        else:
            longest_streak = max(longest_streak, temp_streak)
            temp_streak = 0

    longest_streak = max(longest_streak, temp_streak)

    # Get social stats
    posts_result = supabase.table("posts").select("id").eq("user_id", user_id).execute()
    total_posts = len(posts_result.data)

    # Get followers/following counts
    followers_result = (
        supabase.table("follows").select("id").eq("following_id", user_id).execute()
    )
    followers_count = len(followers_result.data)

    following_result = (
        supabase.table("follows").select("id").eq("follower_id", user_id).execute()
    )
    following_count = len(following_result.data)

    return UserStatsResponse(
        total_goals=total_goals,
        active_goals=active_goals,
        completed_goals=completed_goals,
        total_check_ins=total_check_ins,
        current_streak=current_streak,
        longest_streak=longest_streak,
        total_posts=total_posts,
        followers_count=followers_count,
        following_count=following_count,
    )


@router.put("/profile", response_model=UserProfileResponse)
async def update_profile(
    profile_data: ProfileUpdate, current_user: dict = Depends(get_current_user)
):
    """Update user profile"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Check if username is taken (if changing)
    if profile_data.username and profile_data.username != current_user["username"]:
        existing_username = (
            supabase.table("users")
            .select("id")
            .eq("username", profile_data.username)
            .neq("id", current_user["id"])
            .execute()
        )
        if existing_username.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken"
            )

    update_data = {k: v for k, v in profile_data.dict().items() if v is not None}

    if update_data:
        result = (
            supabase.table("users")
            .update(update_data)
            .eq("id", current_user["id"])
            .execute()
        )
        return result.data[0]

    return current_user


@router.delete("/delete")
async def delete_account(current_user: dict = Depends(get_current_user)):
    """Delete user account"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Delete user and all related data (cascade should handle this)
    supabase.table("users").delete().eq("id", current_user["id"]).execute()

    return {"message": "Account deleted successfully"}


@router.get("/me/data")
async def export_user_data(current_user: dict = Depends(get_current_user)):
    """Export user data (GDPR compliance)"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Get all user data
    user_data = (
        supabase.table("users").select("*").eq("id", current_user["id"]).execute()
    )
    goals_data = (
        supabase.table("goals").select("*").eq("user_id", current_user["id"]).execute()
    )
    checkins_data = (
        supabase.table("check_ins")
        .select("*")
        .eq("user_id", current_user["id"])
        .execute()
    )
    posts_data = (
        supabase.table("posts").select("*").eq("user_id", current_user["id"]).execute()
    )

    return {
        "user": user_data.data[0] if user_data.data else None,
        "goals": goals_data.data,
        "check_ins": checkins_data.data,
        "posts": posts_data.data,
        "exported_at": datetime.utcnow().isoformat(),
    }


@router.post("/change-password")
async def change_password(
    password_data: PasswordChange, current_user: dict = Depends(get_current_user)
):
    """Change user password"""
    from app.core.database import get_supabase_client
    from app.core.auth import verify_password, get_password_hash

    supabase = get_supabase_client()

    # Get current user data
    user_result = (
        supabase.table("users")
        .select("password_hash")
        .eq("id", current_user["id"])
        .execute()
    )

    if not user_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Verify current password
    if not verify_password(
        password_data.current_password, user_result.data[0]["password_hash"]
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    # Update password
    new_password_hash = get_password_hash(password_data.new_password)
    supabase.table("users").update({"password_hash": new_password_hash}).eq(
        "id", current_user["id"]
    ).execute()

    return {"message": "Password changed successfully"}


@router.post("/profile-picture")
async def upload_profile_picture(
    current_user: dict = Depends(get_current_user),
    file_url: str = None,  # This would come from file upload
):
    """Upload profile picture"""
    from app.core.database import get_supabase_client

    if not file_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="File URL is required"
        )

    supabase = get_supabase_client()
    result = (
        supabase.table("users")
        .update({"profile_picture_url": file_url})
        .eq("id", current_user["id"])
        .execute()
    )

    return {"message": "Profile picture updated successfully", "url": file_url}
