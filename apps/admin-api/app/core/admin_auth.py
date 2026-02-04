"""
Admin Authentication
Verifies user has admin role in the database
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends, Request
from app.core.config import settings
from app.core.database import get_supabase_client, first_row

# Password hashing
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256", "bcrypt"],
    deprecated="auto",
)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)


def check_password_strength(password: str) -> dict:
    """Check password meets minimum requirements (a-z, 0-9, 8+ chars)"""
    issues = []
    if len(password) < 8:
        issues.append("Password must be at least 8 characters")
    if not any(c.isupper() for c in password):
        issues.append("Password must contain at least one uppercase letter")
    if not any(c.islower() for c in password):
        issues.append("Password must contain at least one lowercase letter")
    if not any(c.isdigit() for c in password):
        issues.append("Password must contain at least one number")
    return {"is_valid": len(issues) == 0, "message": "; ".join(issues) if issues else ""}


def create_admin_token(user_id: str, email: str) -> str:
    """Create JWT token for admin user"""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "sub": user_id,
        "user_id": user_id,
        "email": email,
        "type": "admin",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }

    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_admin_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify admin JWT token"""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )

        # Verify it's an admin token
        if payload.get("type") != "admin":
            return None

        return payload
    except JWTError:
        return None


async def authenticate_admin(email: str, password: str) -> Dict[str, Any]:
    """
    Authenticate admin user
    Returns user data if valid admin, raises HTTPException otherwise
    """
    supabase = get_supabase_client()

    # Fetch user by email
    result = (
        supabase.table("users")
        .select("id, email, password_hash, role, status, name")
        .eq("email", email.lower())
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    user = first_row(result.data)

    # Check if user is admin
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    # Check if user is active
    if user.get("status") != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not active",
        )

    # Verify password
    if not user.get("password_hash"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not verify_password(password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    return {
        "id": user["id"],
        "email": user["email"],
        "display_name": user.get("name"),
        "role": user["role"],
    }


async def get_current_admin(request: Request) -> Dict[str, Any]:
    """
    Dependency to get current admin user from request
    Verifies JWT token and checks admin role
    """
    authorization = request.headers.get("authorization")

    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization format",
        )

    token = authorization.replace("Bearer ", "").strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token required",
        )

    # Verify token
    payload = verify_admin_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload.get("user_id")

    # Verify user still exists and is admin
    supabase = get_supabase_client()
    result = (
        supabase.table("users")
        .select("id, email, role, status, name")
        .eq("id", user_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    user = first_row(result.data)

    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    if user.get("status") != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not active",
        )

    return {
        "id": user["id"],
        "email": user["email"],
        "display_name": user.get("name"),
        "role": user["role"],
    }


async def log_admin_action(
    admin_user_id: str,
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    """Log an admin action to the audit_logs table"""
    supabase = get_supabase_client()

    try:
        supabase.table("audit_logs").insert(
            {
                "admin_user_id": admin_user_id,
                "action": action,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "new_values": details,
            }
        ).execute()
    except Exception as e:
        # Don't fail the request if logging fails
        print(f"Failed to log admin action: {e}")
