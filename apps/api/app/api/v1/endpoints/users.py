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
    profile_picture_url: Optional[str] = None
    bio: Optional[str] = None
    plan: str
    timezone: str  # User's timezone (IANA format)
    language: Optional[str] = None  # Language code (e.g., 'en', 'es')
    country: Optional[str] = None  # ISO 3166-1 alpha-2 country code
    email_verified: bool
    auth_provider: str
    created_at: str
    updated_at: Optional[str] = None
    last_login_at: Optional[str] = None
    linked_providers: Optional[List[str]] = None  # List of linked OAuth providers
    has_password: Optional[bool] = None  # Whether the user has a password set
    # Status & Role
    status: Optional[str] = "active"
    role: Optional[str] = None
    # V2 Preferences
    motivation_style: Optional[str] = None  # 'supportive', 'tough_love', 'calm'
    morning_motivation_enabled: Optional[bool] = None
    morning_motivation_time: Optional[str] = None  # HH:MM format
    # Referral
    referral_code: Optional[str] = None
    # Onboarding
    onboarding_completed_at: Optional[str] = None


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
    language: Optional[str] = None  # Language code (e.g., 'en', 'es')
    country: Optional[str] = None  # ISO 3166-1 alpha-2 country code (e.g., 'US', 'NG')
    # V2 Preferences
    motivation_style: Optional[str] = None  # 'supportive', 'tough_love', 'calm'
    morning_motivation_enabled: Optional[bool] = None
    morning_motivation_time: Optional[str] = None  # HH:MM format


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


@router.get("/profile", response_model=UserProfileResponse)
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    """Get current user's profile"""
    from app.core.database import get_supabase_client

    user_id = current_user["id"]
    supabase = get_supabase_client()

    # Get linked providers from oauth_accounts
    oauth_result = (
        supabase.table("oauth_accounts")
        .select("provider")
        .eq("user_id", user_id)
        .execute()
    )
    linked_providers = (
        list(set([acc["provider"] for acc in oauth_result.data]))
        if oauth_result.data
        else []
    )

    # Add primary auth provider if not already in the list
    primary_provider = current_user.get("auth_provider")
    if primary_provider and primary_provider not in linked_providers:
        linked_providers.append(primary_provider)

    # Compute has_password
    password_hash = current_user.get("password_hash")
    has_password = password_hash is not None and len(str(password_hash)) > 0

    # Build response with computed fields
    return {
        **current_user,
        "linked_providers": linked_providers,
        "has_password": has_password,
    }


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
        supabase.table("goals").select("id, status").eq("user_id", user_id).execute()
    )

    total_goals = len(goals_result.data)
    active_goals = len([g for g in goals_result.data if g.get("status") == "active"])
    completed_goals = total_goals - active_goals

    # Get check-ins stats (V2: use status field)
    checkins_result = (
        supabase.table("check_ins")
        .select("check_in_date, status")
        .eq("user_id", user_id)
        .neq("status", "pending")  # Exclude pending check-ins
        .execute()
    )

    total_check_ins = len(checkins_result.data)

    # Calculate current streak
    current_streak = 0
    longest_streak = 0
    temp_streak = 0

    # Sort check-ins by date
    sorted_checkins = sorted(
        checkins_result.data, key=lambda x: x["check_in_date"], reverse=True
    )

    for checkin in sorted_checkins:
        # V2: Use status field
        if checkin.get("status") == "completed" or checkin.get("status") == "rest_day":
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

    update_data = {k: v for k, v in profile_data.model_dump().items() if v is not None}

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
    """Delete user account from public.users, auth.users, and RevenueCat.

    Order: RevenueCat (GDPR) -> public.users (cascade) -> auth.users.
    Does NOT cancel Apple/Google subscriptions - user must cancel in store.
    """
    from app.core.database import get_supabase_client
    from app.services.logger import logger
    from app.services.referral_service import delete_subscriber

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Step 1: Delete from RevenueCat (GDPR - remove purchase data)
    try:
        await delete_subscriber(user_id)
    except Exception as e:
        logger.warning(f"Failed to delete user {user_id} from RevenueCat: {e}")

    # Step 2: Delete from public.users FIRST (cascade deletes all related data)
    supabase.table("users").delete().eq("id", user_id).execute()
    logger.info(f"Deleted user {user_id} from public.users (cascade handled related data)")

    # Step 3: Delete from auth.users (for Supabase Auth/Realtime cleanup)
    try:
        supabase.auth.admin.delete_user(user_id)
        logger.info(f"Deleted user {user_id} from auth.users")
    except Exception as e:
        logger.warning(f"Failed to delete user {user_id} from auth.users: {e}")

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


# =====================================================
# User Search & Referral Endpoints
# =====================================================


@router.get("/search")
async def search_users(
    q: str = Query(..., min_length=2, description="Search query (username)"),
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
):
    """Search users by username for in-app invites

    Returns basic user info for users matching the search query.
    Excludes the current user from results.
    """
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Search by username (case-insensitive partial match)
    result = (
        supabase.table("users")
        .select("id, username, name, profile_picture_url")
        .ilike("username", f"%{q}%")
        .neq("id", current_user["id"])  # Exclude current user
        .eq("status", "active")
        .limit(limit)
        .execute()
    )

    return {
        "users": result.data if result.data else [],
        "count": len(result.data or []),
    }


@router.get("/me/referral-code")
async def get_my_referral_code(current_user: dict = Depends(get_current_user)):
    """Get current user's referral code

    If the user doesn't have a referral code yet (legacy users),
    generate one and save it.
    """
    from app.core.database import get_supabase_client
    from app.services.referral_service import generate_referral_code

    supabase = get_supabase_client()

    # Get user's referral code
    result = (
        supabase.table("users")
        .select("referral_code, username")
        .eq("id", current_user["id"])
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    user = result.data[0]
    referral_code = user.get("referral_code")

    # Generate referral code for legacy users who don't have one
    if not referral_code:
        referral_code = generate_referral_code(user.get("username", "USER"))

        # Save the generated code
        supabase.table("users").update({"referral_code": referral_code}).eq(
            "id", current_user["id"]
        ).execute()

    return {
        "referral_code": referral_code,
        "referral_link": f"https://fitnudge.app/join?ref={referral_code}",
    }


@router.get("/me/referrals")
async def get_my_referrals(current_user: dict = Depends(get_current_user)):
    """Get list of users referred by the current user

    Shows all users who signed up using your referral code.
    total_bonus_days_earned is the sum of bonus_days_referrer across rewarded referrals
    (respects 30-day cap).
    """
    from app.services.referral_service import get_user_referrals

    referrals = await get_user_referrals(current_user["id"])

    # Format the response to match frontend expectations
    formatted_referrals = []
    total_bonus_days = 0
    for referral in referrals:
        bonus_days = referral.get("bonus_days_referrer") or 0
        status = referral.get("status", "pending")
        # Count bonus days for rewarded referrals (use status as primary check)
        if status == "rewarded" or referral.get("referral_bonus_granted_at"):
            total_bonus_days += bonus_days
        formatted_referrals.append(
            {
                "id": referral.get("id"),
                "username": referral.get("username"),
                "name": referral.get("name"),
                "profile_picture_url": referral.get("profile_picture_url"),
                "created_at": referral.get("created_at"),
                "referral_bonus_granted_at": referral.get("referral_bonus_granted_at"),
                "bonus_days_referrer": bonus_days,
                "status": status,  # Include status for UI
            }
        )

    return {
        "referrals": formatted_referrals,
        "total_bonus_days_earned": total_bonus_days,
    }
