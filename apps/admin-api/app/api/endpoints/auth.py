"""
Admin Authentication Endpoints
"""

import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from postgrest.exceptions import APIError

from app.core.admin_auth import (
    authenticate_admin,
    create_admin_token,
    get_current_admin,
    get_password_hash,
    check_password_strength,
)
from app.core.database import get_supabase_client, first_row
from app.services.email_service import send_admin_password_reset_email

router = APIRouter(prefix="/auth", tags=["Authentication"])


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordValidateRequest(BaseModel):
    token: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class AdminUser(BaseModel):
    id: str
    email: str
    display_name: str | None
    role: str


@router.post("/login", response_model=LoginResponse)
async def admin_login(request: LoginRequest):
    """
    Admin login endpoint
    Returns JWT token if credentials are valid and user is admin
    """
    user = await authenticate_admin(request.email, request.password)

    token = create_admin_token(user["id"], user["email"])

    return LoginResponse(
        access_token=token,
        user=user,
    )


@router.get("/me", response_model=AdminUser)
async def get_me(current_admin: dict = Depends(get_current_admin)):
    """Get current admin user info"""
    return AdminUser(
        id=current_admin["id"],
        email=current_admin["email"],
        display_name=current_admin.get("display_name"),
        role=current_admin["role"],
    )


@router.post("/logout")
async def admin_logout(current_admin: dict = Depends(get_current_admin)):
    """
    Admin logout
    Note: With JWT, logout is handled client-side by discarding the token.
    This endpoint exists for audit logging purposes.
    """
    from app.core.admin_auth import log_admin_action

    await log_admin_action(
        admin_user_id=current_admin["id"],
        action="logout",
        resource_type="session",
    )

    return {"message": "Logged out successfully"}


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    """Send password reset email to admin. Only admins receive the email."""
    from datetime import datetime, timedelta, timezone

    supabase = get_supabase_client()

    user_result = (
        supabase.table("users")
        .select("id, email, role")
        .eq("email", req.email.lower().strip())
        .eq("role", "admin")
        .execute()
    )

    if not user_result.data:
        return {"message": "If an account exists, a password reset email has been sent"}

    user = first_row(user_result.data)
    user_id = user["id"]

    reset_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    try:
        supabase.table("password_reset_tokens").update({"used": True}).eq(
            "user_id", user_id
        ).eq("used", False).execute()
    except APIError as exc:
        if str(getattr(exc, "code", "")) not in {"404", "PGRST116"}:
            raise

    supabase.table("password_reset_tokens").insert(
        {
            "user_id": user_id,
            "token": reset_token,
            "expires_at": expires_at.isoformat(),
            "used": False,
        }
    ).execute()

    ok = send_admin_password_reset_email(user["email"], reset_token)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send email. Please try again later.",
        )

    return {"message": "If an account exists, a password reset email has been sent"}


@router.post("/reset-password/validate")
async def validate_reset_token(req: ResetPasswordValidateRequest):
    """Validate a reset token."""
    from datetime import datetime, timezone

    supabase = get_supabase_client()

    token_result = (
        supabase.table("password_reset_tokens")
        .select("*")
        .eq("token", req.token)
        .eq("used", False)
        .execute()
    )

    if not token_result.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    reset_token = first_row(token_result.data)
    expires_at = datetime.fromisoformat(
        reset_token["expires_at"].replace("Z", "+00:00")
    )
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired. Please request a new one.",
        )

    return {"valid": True}


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest):
    """Reset password with token."""
    from datetime import datetime, timezone

    supabase = get_supabase_client()

    token_result = (
        supabase.table("password_reset_tokens")
        .select("*")
        .eq("token", req.token)
        .eq("used", False)
        .execute()
    )

    if not token_result.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    reset_token = first_row(token_result.data)
    expires_at = datetime.fromisoformat(
        reset_token["expires_at"].replace("Z", "+00:00")
    )
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired. Please request a new one.",
        )

    pw_check = check_password_strength(req.new_password)
    if not pw_check["is_valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=pw_check.get("message", "Password does not meet requirements"),
        )

    user_id = reset_token["user_id"]
    new_hash = get_password_hash(req.new_password)
    supabase.table("users").update({"password_hash": new_hash}).eq(
        "id", user_id
    ).execute()

    supabase.table("password_reset_tokens").update({"used": True}).eq(
        "id", reset_token["id"]
    ).execute()

    return {"message": "Password reset successfully"}
