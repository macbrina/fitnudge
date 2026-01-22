"""
Admin Authentication Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from app.core.admin_auth import (
    authenticate_admin,
    create_admin_token,
    get_current_admin,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


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
