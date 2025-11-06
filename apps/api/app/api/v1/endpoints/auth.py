from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional
import json
from app.core.auth import (
    authenticate_user,
    create_user,
    create_access_token,
    create_refresh_token,
    verify_token,
    generate_verification_code,
    get_user_by_id,
)
from app.core.database import get_supabase_client
from app.core.config import settings
from app.core.flexible_auth import get_current_user
from datetime import timedelta, datetime, timezone

router = APIRouter(
    redirect_slashes=False
)  # Disable redirects to preserve Authorization header


# Pydantic models
class UserSignup(BaseModel):
    email: EmailStr
    password: str
    name: str
    username: str
    timezone: Optional[str] = (
        None  # IANA timezone string (e.g., 'America/New_York'), defaults to UTC if not provided
    )


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    remember_me: Optional[bool] = False


class AppleOAuth(BaseModel):
    id_token: str
    authorization_code: str
    user: Optional[dict] = None


class GoogleOAuth(BaseModel):
    id_token: str
    access_token: str


class TokenRefresh(BaseModel):
    refresh_token: str


class EmailVerification(BaseModel):
    code: str
    email: Optional[EmailStr] = None  # Optional if authenticated user


class PasswordReset(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


class ResendVerificationRequest(BaseModel):
    email: Optional[EmailStr] = None  # Optional if authenticated user


# Import the flexible authentication system
from app.core.flexible_auth import get_current_user


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(user_data: UserSignup):
    """Create new user account"""
    supabase = get_supabase_client()

    # Check if user already exists
    existing_user = (
        supabase.table("users").select("id").eq("email", user_data.email).execute()
    )
    if existing_user.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists",
        )

    # Check if username is taken
    existing_username = (
        supabase.table("users")
        .select("id")
        .eq("username", user_data.username)
        .execute()
    )
    if existing_username.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken"
        )

    # Create user
    user = await create_user(user_data.dict())

    # Create tokens
    access_token = create_access_token({"user_id": user["id"]})
    refresh_token = create_refresh_token({"user_id": user["id"]})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "username": user["username"],
            "plan": user["plan"],
            "timezone": user.get("timezone", "UTC"),
            "email_verified": user["email_verified"],
            "auth_provider": user["auth_provider"],
            "created_at": user["created_at"],
        },
    }


@router.post("/login")
async def login(credentials: UserLogin):
    """Authenticate user with email/password"""
    user = await authenticate_user(credentials.email, credentials.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )

    # Check user status
    user_status = user.get("status", "active")
    if user_status != "active":
        status_messages = {
            "disabled": "Account disabled",
            "suspended": "Account suspended",
        }
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": status_messages.get(user_status, f"Account {user_status}"),
                "status": user_status,
            },
        )

    # Create tokens with different expiration based on remember_me
    if credentials.remember_me:
        # Extended tokens for remember me (30 days access, 90 days refresh)
        access_token = create_access_token(
            {"user_id": user["id"]}, expires_delta=timedelta(days=30)
        )
        refresh_token = create_refresh_token(
            {"user_id": user["id"]}, expires_delta=timedelta(days=90)
        )
    else:
        # Standard tokens (1 hour access, 7 days refresh)
        access_token = create_access_token({"user_id": user["id"]})
        refresh_token = create_refresh_token({"user_id": user["id"]})

    # Update last login
    supabase = get_supabase_client()
    supabase.table("users").update({"last_login_at": "now()"}).eq(
        "id", user["id"]
    ).execute()

    print("Login success:", json.dumps(user, indent=2))

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "remember_me": credentials.remember_me,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "username": user["username"],
            "plan": user["plan"],
            "timezone": user.get("timezone", "UTC"),
            "email_verified": user["email_verified"],
            "auth_provider": user["auth_provider"],
            "created_at": user["created_at"],
            "last_login_at": user["last_login_at"],
        },
    }


@router.post("/oauth/apple")
async def apple_oauth(oauth_data: AppleOAuth):
    """Sign in with Apple (iOS only)"""
    # TODO: Implement Apple OAuth verification
    # This would involve verifying the id_token with Apple's servers
    # For now, return a placeholder response

    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Apple OAuth not yet implemented",
    )


@router.post("/oauth/google")
async def google_oauth(oauth_data: GoogleOAuth):
    """Sign in with Google (iOS + Android)"""
    # TODO: Implement Google OAuth verification
    # This would involve verifying the id_token with Google's servers
    # For now, return a placeholder response

    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Google OAuth not yet implemented",
    )


@router.post("/refresh")
async def refresh_token(token_data: TokenRefresh):
    """Refresh access token"""
    from app.core.database import get_supabase_client

    payload = verify_token(token_data.refresh_token)

    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )

    # Check if user exists before creating tokens
    supabase = get_supabase_client()
    user_result = supabase.table("users").select("id").eq("id", user_id).execute()

    if not user_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Create new tokens
    access_token = create_access_token({"user_id": user_id})
    new_refresh_token = create_refresh_token({"user_id": user_id})

    return {"access_token": access_token, "refresh_token": new_refresh_token}


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout user (client should discard tokens)"""
    return {"message": "Successfully logged out"}


@router.post("/verify-email")
async def verify_email(
    verification_data: EmailVerification,
    current_user: Optional[dict] = Depends(get_current_user),
):
    """
    Verify email address with 6-digit code

    Accepts:
    - { code: str, email?: str } (email optional if authenticated)
    - { code: str } (if authenticated user)
    """
    from app.core.database import get_supabase_client
    from app.core.auth import get_user_by_id
    from datetime import datetime

    supabase = get_supabase_client()
    code = verification_data.code.strip()

    # Determine user_id and email
    if verification_data.email:
        # Lookup by email
        user_result = (
            supabase.table("users")
            .select("id, email_verified")
            .eq("email", verification_data.email)
            .execute()
        )
        if not user_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        user = user_result.data[0]
        user_id = user["id"]
    elif current_user:
        # Use authenticated user
        user_id = current_user["id"]
        user_result = (
            supabase.table("users")
            .select("id, email_verified")
            .eq("id", user_id)
            .execute()
        )
        if not user_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        user = user_result.data[0]
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either email must be provided or user must be authenticated",
        )

    # Check if already verified
    if user.get("email_verified"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already verified",
        )

    # Find verification code
    code_result = (
        supabase.table("email_verification_codes")
        .select("*")
        .eq("user_id", user_id)
        .eq("code", code)
        .eq("verified", False)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not code_result.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code",
        )

    verification_code = code_result.data[0]

    # Check expiration
    expires_at = datetime.fromisoformat(
        verification_code["expires_at"].replace("Z", "+00:00")
    )
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code.",
        )

    # Check attempts (max 5)
    if verification_code["attempts"] >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum verification attempts exceeded. Please request a new code.",
        )

    # Verify code matches
    if verification_code["code"] != code:
        # Increment attempts
        supabase.table("email_verification_codes").update(
            {"attempts": verification_code["attempts"] + 1}
        ).eq("id", verification_code["id"]).execute()

        remaining_attempts = 5 - (verification_code["attempts"] + 1)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid verification code. {remaining_attempts} attempt(s) remaining.",
        )

    # Mark code as verified and delete it (and all other unverified codes for user)
    supabase.table("email_verification_codes").delete().eq("user_id", user_id).eq(
        "verified", False
    ).execute()

    # Mark user email as verified
    supabase.table("users").update({"email_verified": True}).eq("id", user_id).execute()

    # Get updated user data
    updated_user = await get_user_by_id(user_id)

    return {
        "message": "Email verified successfully",
        "user": updated_user,
    }


@router.post("/resend-verification")
async def resend_verification(
    request: Optional[ResendVerificationRequest] = None,
    current_user: Optional[dict] = Depends(get_current_user),
):
    """
    Resend verification email

    Accepts:
    - email (optional if authenticated user)
    - Rate limit: 1 request per 2 minutes, max 20 requests per hour per user
    """
    from app.core.database import get_supabase_client
    from datetime import datetime, timedelta

    supabase = get_supabase_client()

    # Determine user_id and email
    request_email = request.email if request else None
    if request_email:
        # Lookup by email
        user_result = (
            supabase.table("users")
            .select("id, email, email_verified")
            .eq("email", request_email)
            .execute()
        )
        if not user_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        user = user_result.data[0]
        user_id = user["id"]
        user_email = user["email"]
    elif current_user:
        # Use authenticated user
        user_id = current_user["id"]
        user_result = (
            supabase.table("users")
            .select("id, email, email_verified")
            .eq("id", user_id)
            .execute()
        )
        if not user_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        user = user_result.data[0]
        user_email = user["email"]
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either email must be provided or user must be authenticated",
        )

    # Check if already verified
    if user.get("email_verified"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already verified",
        )

    # Rate limiting:
    # 1. Check for requests in last 2 minutes (minimum wait time)
    # 2. Check for requests in last hour (max 20 per hour to prevent abuse)

    now = datetime.now(timezone.utc)
    two_minutes_ago = (now - timedelta(minutes=2)).isoformat()
    one_hour_ago = (now - timedelta(hours=1)).isoformat()

    # Check if request was made in last 2 minutes
    recent_codes_minute = (
        supabase.table("email_verification_codes")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .gte("created_at", two_minutes_ago)
        .execute()
    )

    if recent_codes_minute.count and recent_codes_minute.count > 0:
        # Get the most recent code to calculate wait time
        most_recent = (
            supabase.table("email_verification_codes")
            .select("created_at")
            .eq("user_id", user_id)
            .gte("created_at", two_minutes_ago)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if most_recent.data:
            most_recent_time = datetime.fromisoformat(
                most_recent.data[0]["created_at"].replace("Z", "+00:00")
            )
            next_allowed = most_recent_time + timedelta(minutes=2)
            wait_seconds = int((next_allowed - now).total_seconds())
            wait_seconds = max(0, wait_seconds)  # Ensure non-negative
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {wait_seconds} seconds before requesting another code.",
            )

    # Check hourly limit (max 20 per hour)
    recent_codes_hour = (
        supabase.table("email_verification_codes")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .gte("created_at", one_hour_ago)
        .execute()
    )

    if recent_codes_hour.count and recent_codes_hour.count >= 20:
        # Calculate time until next request allowed (1 hour from oldest in window)
        oldest_recent = (
            supabase.table("email_verification_codes")
            .select("created_at")
            .eq("user_id", user_id)
            .gte("created_at", one_hour_ago)
            .order("created_at", desc=False)
            .limit(1)
            .execute()
        )
        if oldest_recent.data:
            oldest_time = datetime.fromisoformat(
                oldest_recent.data[0]["created_at"].replace("Z", "+00:00")
            )
            next_allowed = oldest_time + timedelta(hours=1)
            wait_minutes = int((next_allowed - now).total_seconds() / 60)
            wait_minutes = max(0, wait_minutes)  # Ensure non-negative
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Please wait {wait_minutes} minutes before requesting another code.",
            )

    # Generate and send new verification code
    code = await generate_verification_code(user_id)
    if not code:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate verification code. Please try again later.",
        )

    return {
        "message": "Verification code sent successfully",
        "rate_limit_info": {
            "min_wait_minutes": 2,
            "max_per_hour": 20,
            "remaining": max(0, 20 - (recent_codes_hour.count or 0) - 1),
        },
    }


@router.post("/forgot-password")
async def forgot_password(reset_data: PasswordReset):
    """Send password reset email"""
    from app.core.database import get_supabase_client
    from app.services.email_service import email_service
    from app.services.logger import logger
    import secrets

    supabase = get_supabase_client()

    # Find user by email
    user_result = (
        supabase.table("users")
        .select("id, email, name")
        .eq("email", reset_data.email.lower())
        .execute()
    )

    # Always return success message to prevent email enumeration
    if not user_result.data:
        logger.warning(
            f"Password reset requested for non-existent email: {reset_data.email}"
        )
        return {"message": "If an account exists, a password reset email has been sent"}

    user = user_result.data[0]
    user_id = user["id"]

    # Generate secure token
    reset_token = secrets.token_urlsafe(32)

    # Calculate expiration (1 hour from now)
    from datetime import datetime, timedelta, timezone

    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    # Invalidate any existing unused tokens for this user
    supabase.table("password_reset_tokens").update({"used": True}).eq(
        "user_id", user_id
    ).eq("used", False).execute()

    # Store new reset token
    supabase.table("password_reset_tokens").insert(
        {
            "user_id": user_id,
            "token": reset_token,
            "expires_at": expires_at.isoformat(),
            "used": False,
        }
    ).execute()

    # Send password reset email
    email_sent = email_service.send_password_reset_email(user["email"], reset_token)
    if not email_sent:
        logger.error(
            f"Failed to send password reset email for user {user_id}",
            {"user_id": user_id, "email": user["email"]},
        )

    logger.info(
        f"Password reset token generated for user {user_id}",
        {"user_id": user_id, "email": user["email"]},
    )

    return {"message": "If an account exists, a password reset email has been sent"}


@router.post("/reset-password")
async def reset_password(reset_data: PasswordResetConfirm):
    """Reset password with token"""
    from app.core.database import get_supabase_client
    from app.core.auth import get_password_hash, check_password_strength
    from app.services.logger import logger
    from datetime import datetime, timezone

    supabase = get_supabase_client()

    # Find token
    token_result = (
        supabase.table("password_reset_tokens")
        .select("*")
        .eq("token", reset_data.token)
        .eq("used", False)
        .execute()
    )

    if not token_result.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    reset_token = token_result.data[0]

    # Check if token is expired
    expires_at = datetime.fromisoformat(
        reset_token["expires_at"].replace("Z", "+00:00")
    )
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired",
        )

    user_id = reset_token["user_id"]

    # Check password strength
    password_check = check_password_strength(reset_data.new_password)
    if not password_check["is_valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=password_check.get("message", "Password does not meet requirements"),
        )

    # Update password
    new_password_hash = get_password_hash(reset_data.new_password)
    supabase.table("users").update({"password_hash": new_password_hash}).eq(
        "id", user_id
    ).execute()

    # Mark token as used
    supabase.table("password_reset_tokens").update({"used": True}).eq(
        "id", reset_token["id"]
    ).execute()

    logger.info(f"Password reset successful for user {user_id}", {"user_id": user_id})

    return {"message": "Password reset successfully"}
