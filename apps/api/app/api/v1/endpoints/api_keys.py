"""
API Key Management Endpoints
Allows users to create, manage, and revoke API keys
"""

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import List, Optional
from app.core.flexible_auth import get_current_user, require_jwt
from app.core.api_keys import api_key_manager

router = APIRouter(
    redirect_slashes=False
)  # Disable redirects to preserve Authorization header


# Pydantic models
class APIKeyCreate(BaseModel):
    app_name: str = "mobile"
    permissions: List[str] = ["read", "write"]
    expires_days: Optional[int] = 365


class APIKeyResponse(BaseModel):
    api_key: str
    key_id: str
    app_name: str
    permissions: List[str]
    expires_at: str
    created_at: str


class APIKeyListResponse(BaseModel):
    key_id: str
    app_name: str
    permissions: List[str]
    is_active: bool
    created_at: str
    last_used_at: Optional[str]
    expires_at: str


class APIKeyRotateResponse(BaseModel):
    api_key: str
    key_id: str
    expires_at: str
    created_at: str


@router.post("/", response_model=APIKeyResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    key_data: APIKeyCreate,
    current_user: dict = Depends(require_jwt()),  # Only JWT users can create API keys
):
    """Create a new API key for the current user"""

    # Validate permissions
    valid_permissions = ["read", "write", "admin"]
    for permission in key_data.permissions:
        if permission not in valid_permissions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid permission: {permission}. Valid permissions: {valid_permissions}",
            )

    try:
        result = api_key_manager.generate_api_key(
            user_id=current_user["id"],
            app_name=key_data.app_name,
            permissions=key_data.permissions,
        )

        return APIKeyResponse(
            api_key=result["api_key"],
            key_id=result["key_id"],
            app_name=key_data.app_name,
            permissions=key_data.permissions,
            expires_at=result["expires_at"],
            created_at=result["created_at"],
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create API key: {str(e)}",
        )


@router.get("/", response_model=List[APIKeyListResponse])
async def list_api_keys(
    current_user: dict = Depends(require_jwt()),  # Only JWT users can list API keys
):
    """List all API keys for the current user"""

    try:
        keys = api_key_manager.list_user_api_keys(current_user["id"])

        return [
            APIKeyListResponse(
                key_id=key["key_id"],
                app_name=key["app_name"],
                permissions=key["permissions"],
                is_active=key["is_active"],
                created_at=key["created_at"],
                last_used_at=key["last_used_at"],
                expires_at=key["expires_at"],
            )
            for key in keys
        ]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list API keys: {str(e)}",
        )


@router.delete("/{key_id}")
async def revoke_api_key(
    key_id: str,
    current_user: dict = Depends(require_jwt()),  # Only JWT users can revoke API keys
):
    """Revoke an API key"""

    try:
        success = api_key_manager.revoke_api_key(key_id, current_user["id"])

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found or already revoked",
            )

        return {"message": "API key revoked successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to revoke API key: {str(e)}",
        )


@router.post("/{key_id}/rotate", response_model=APIKeyRotateResponse)
async def rotate_api_key(
    key_id: str,
    current_user: dict = Depends(require_jwt()),  # Only JWT users can rotate API keys
):
    """Rotate an API key (revoke old, create new)"""

    try:
        result = api_key_manager.rotate_api_key(key_id, current_user["id"])

        return APIKeyRotateResponse(
            api_key=result["api_key"],
            key_id=result["key_id"],
            expires_at=result["expires_at"],
            created_at=result["created_at"],
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to rotate API key: {str(e)}",
        )


@router.get("/permissions")
async def get_available_permissions():
    """Get list of available API key permissions"""
    return {
        "permissions": [
            {
                "name": "read",
                "description": "Read access to user data (goals, check-ins, profile)",
            },
            {
                "name": "write",
                "description": "Write access to user data (create, update, delete)",
            },
            {
                "name": "admin",
                "description": "Administrative access (full permissions)",
            },
        ]
    }
