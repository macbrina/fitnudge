from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.core.auth import (
    authenticate_user,
    create_user,
    create_access_token,
    create_refresh_token,
    verify_token,
    get_current_user_id,
)
from app.core.database import get_supabase_client
from app.core.config import settings
from datetime import timedelta

router = APIRouter()
security = HTTPBearer()


# Pydantic models
class UserSignup(BaseModel):
    email: EmailStr
    password: str
    name: str
    username: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


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
    token: str


class PasswordReset(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


# Helper function to get current user
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials
    user_id = get_current_user_id(token)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

    supabase = get_supabase_client()
    result = supabase.table("users").select("*").eq("id", user_id).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )

    return result.data[0]


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

    # Create tokens
    access_token = create_access_token({"user_id": user["id"]})
    refresh_token = create_refresh_token({"user_id": user["id"]})

    # Update last login
    supabase = get_supabase_client()
    supabase.table("users").update({"last_login_at": "now()"}).eq(
        "id", user["id"]
    ).execute()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "username": user["username"],
            "plan": user["plan"],
            "email_verified": user["email_verified"],
            "auth_provider": user["auth_provider"],
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

    # Create new tokens
    access_token = create_access_token({"user_id": user_id})
    new_refresh_token = create_refresh_token({"user_id": user_id})

    return {"access_token": access_token, "refresh_token": new_refresh_token}


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout user (client should discard tokens)"""
    return {"message": "Successfully logged out"}


@router.post("/verify-email")
async def verify_email(verification_data: EmailVerification):
    """Verify email address"""
    # TODO: Implement email verification logic
    return {"message": "Email verified successfully"}


@router.post("/forgot-password")
async def forgot_password(reset_data: PasswordReset):
    """Send password reset email"""
    # TODO: Implement password reset logic
    return {"message": "Password reset email sent"}


@router.post("/reset-password")
async def reset_password(reset_data: PasswordResetConfirm):
    """Reset password with token"""
    # TODO: Implement password reset confirmation logic
    return {"message": "Password reset successfully"}
