"""
Flexible Authentication System
Supports both JWT tokens and API keys for authentication
"""

from fastapi import HTTPException, status, Header, Depends, Request
from starlette.requests import Request
from typing import Optional, Dict, Any
from app.core.auth import verify_token
from app.core.api_keys import get_api_key_user


async def get_current_user_flexible(
    request: Request,
) -> Dict[str, Any]:
    """
    Flexible authentication that supports both JWT and API key authentication

    Supports:
    - JWT: Authorization: Bearer <jwt_token>
    - API Key: Authorization: Bearer <api_key> (where api_key starts with 'fn_')
    """
    # FastAPI automatically provides Request when it's in the function signature
    # Get Authorization header directly from request
    # Starlette's headers.get() is case-insensitive, so use lowercase
    authorization = request.headers.get("authorization")

    # If request object is somehow None or invalid, this would fail before here
    if not request:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Request object not available",
        )

    # Try alternative access methods if primary fails
    if not authorization:
        # Try accessing via list comprehension (more reliable)
        auth_headers = [
            v for k, v in request.headers.items() if k.lower() == "authorization"
        ]
        if auth_headers:
            authorization = auth_headers[0]

    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization format. Use 'Bearer <token>'",
        )

    # Extract the token/key
    token = authorization.replace("Bearer ", "").strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token required"
        )

    # Determine authentication method based on token format
    if token.startswith("fn_"):
        # API Key Authentication
        return await authenticate_with_api_key(token)
    else:
        # JWT Authentication (existing method)
        return await authenticate_with_jwt(token)


async def authenticate_with_jwt(token: str) -> Dict[str, Any]:
    """Authenticate using JWT token"""
    try:
        # Verify the JWT token
        payload = verify_token(token)

        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
            )

        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
            )

        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload"
            )

        # Get user from database
        from app.core.database import get_supabase_client

        supabase = get_supabase_client()

        result = supabase.table("users").select("*").eq("id", user_id).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
            )

        user = result.data[0]

        # Check user status
        user_status = user.get("status", "active")
        if user_status != "active":
            status_message = {
                "disabled": "Account disabled. Contact support if you believe this is an error.",
                "suspended": "Account suspended. Contact support if you believe this is an error.",
            }.get(
                user_status,
                f"Account {user_status}. Contact support if you believe this is an error.",
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": status_message, "status": user_status},
            )

        # Add authentication method info
        user["auth_method"] = "jwt"
        user["auth_type"] = "token"

        return user

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"JWT authentication failed: {str(e)}",
        )


async def authenticate_with_api_key(api_key: str) -> Dict[str, Any]:
    """Authenticate using API key"""
    try:
        # Validate API key using the API key manager
        user_info = get_api_key_user(api_key)

        if not user_info:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired API key",
            )

        # Get full user data from database
        from app.core.database import get_supabase_client

        supabase = get_supabase_client()

        result = (
            supabase.table("users").select("*").eq("id", user_info["user_id"]).execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
            )

        user = result.data[0]

        # Check user status
        user_status = user.get("status", "active")
        if user_status != "active":
            status_message = {
                "disabled": "Account disabled. Contact support if you believe this is an error.",
                "suspended": "Account suspended. Contact support if you believe this is an error.",
            }.get(
                user_status,
                f"Account {user_status}. Contact support if you believe this is an error.",
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": status_message, "status": user_status},
            )

        # Add authentication method info
        user["auth_method"] = "api_key"
        user["auth_type"] = "key"
        user["api_key_info"] = {
            "key_id": user_info["key_id"],
            "permissions": user_info["permissions"],
            "app_name": user_info["app_name"],
        }

        return user

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"API key authentication failed: {str(e)}",
        )


def require_permission(required_permission: str):
    """
    Dependency factory for permission-based access control
    Only works with API key authentication
    """

    def permission_checker(
        current_user: Dict[str, Any] = Depends(get_current_user_flexible),
    ):
        if current_user.get("auth_method") != "api_key":
            # JWT users have full access (for now)
            return current_user

        user_permissions = current_user.get("api_key_info", {}).get("permissions", [])

        if required_permission not in user_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{required_permission}' required",
            )

        return current_user

    return permission_checker


def require_api_key():
    """
    Dependency that requires API key authentication specifically
    """

    async def api_key_checker(
        current_user: Dict[str, Any] = Depends(get_current_user_flexible),
    ):
        if current_user.get("auth_method") != "api_key":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API key authentication required for this endpoint",
            )
        return current_user

    return api_key_checker


def require_jwt():
    """
    Dependency that requires JWT authentication specifically
    """

    async def jwt_checker(
        current_user: Dict[str, Any] = Depends(get_current_user_flexible),
    ):
        if current_user.get("auth_method") != "jwt":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="JWT authentication required for this endpoint",
            )
        return current_user

    return jwt_checker


# Convenience aliases
get_current_user = get_current_user_flexible
