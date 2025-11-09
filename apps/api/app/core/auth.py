from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status
from app.core.config import settings
from app.core.database import get_supabase_client
import secrets
import hashlib

# Password hashing: prefer pbkdf2_sha256 for portability, still verify bcrypt
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


def create_access_token(
    data: Dict[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def create_refresh_token(
    data: Dict[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """Create JWT refresh token with rotation support"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    # Add token family for rotation
    token_family = secrets.token_urlsafe(16)
    token_id = secrets.token_urlsafe(16)

    to_encode.update(
        {
            "exp": expire,
            "type": "refresh",
            "token_family": token_family,
            "token_id": token_id,
            "version": 1,
        }
    )

    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )

    # Store token family in database for rotation tracking
    supabase = get_supabase_client()
    supabase.table("refresh_tokens").insert(
        {
            "user_id": data.get("user_id"),
            "token_family": token_family,
            "token_id": token_id,
            "is_active": True,
            "created_at": datetime.utcnow().isoformat(),
            "expires_at": expire.isoformat(),
        }
    ).execute()

    return encoded_jwt


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify and decode JWT token"""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError:
        return None


def get_current_user_id(token: str) -> Optional[str]:
    """Get current user ID from token"""
    payload = verify_token(token)
    if payload and payload.get("type") == "access":
        return payload.get("user_id")
    return None


async def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    """Authenticate user with email/password.

    Returns the user if credentials are valid. If the account was created through
    a social provider (Google/Apple) and no password exists, raise a 403 with an
    instruction to reset their password.
    """
    supabase = get_supabase_client()

    # Get user from database
    result = supabase.table("users").select("*").eq("email", email).execute()

    if not result.data:
        return None

    user = result.data[0]

    # Social accounts without password should trigger password reset guidance
    if not user.get("password_hash"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account was created with Google or Apple sign-in. Reset your password to sign in with email",
        )

    # Verify password
    if not verify_password(password, user["password_hash"]):
        return None

    return user


async def generate_verification_code(user_id: str) -> Optional[str]:
    """
    Generate a 6-digit verification code and send it via email

    Args:
        user_id: User ID to generate code for

    Returns:
        str: The generated 6-digit code, or None if generation fails
    """
    try:
        from app.services.email_service import email_service
        from app.core.database import get_supabase_client

        supabase = get_supabase_client()

        # Get user email
        from app.services.logger import logger

        user_result = (
            supabase.table("users").select("email").eq("id", user_id).execute()
        )
        if not user_result.data:
            logger.error(f"User not found for verification code generation: {user_id}")
            return None

        user_email = user_result.data[0]["email"]

        # Generate random 6-digit code
        code = f"{secrets.randbelow(1000000):06d}"

        # Calculate expiration (24 hours from now)
        expires_at = datetime.utcnow() + timedelta(hours=24)

        # Invalidate any existing unverified codes for the user
        supabase.table("email_verification_codes").delete().eq("user_id", user_id).eq(
            "verified", False
        ).execute()

        # Store new verification code
        supabase.table("email_verification_codes").insert(
            {
                "user_id": user_id,
                "code": code,
                "expires_at": expires_at.isoformat(),
                "verified": False,
                "attempts": 0,
            }
        ).execute()

        # Send verification email
        email_sent = email_service.send_verification_email(user_email, code)
        if not email_sent:
            logger.warning(
                f"Verification code generated but email sending failed for user {user_id}",
                {"user_id": user_id, "email": user_email},
            )

        return code

    except Exception as e:
        from app.services.logger import logger

        logger.error(
            f"Failed to generate verification code for user {user_id}",
            {"error": str(e), "user_id": user_id},
        )
        return None


async def create_user(user_data: Dict[str, Any]) -> Dict[str, Any]:
    """Create new user"""
    supabase = get_supabase_client()

    # Hash password if provided (email/password signup)
    password = user_data.pop("password", None)
    auth_provider = user_data.get("auth_provider", "email")

    if password:
        user_data["password_hash"] = get_password_hash(password)
    elif auth_provider == "email" and not user_data.get("password_hash"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is required for email/password signups",
        )
    elif "password_hash" not in user_data:
        user_data["password_hash"] = None

    # Set default timezone to UTC if not provided
    if "timezone" not in user_data or not user_data.get("timezone"):
        user_data["timezone"] = "UTC"

    # Insert user
    result = supabase.table("users").insert(user_data).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to create user"
        )

    user = result.data[0]
    user_id = user["id"]

    # Import logger for error handling
    from app.services.logger import logger

    # Create default notification_preferences
    try:
        supabase.table("notification_preferences").insert(
            {
                "user_id": user_id,
                "enabled": True,
                "push_notifications": True,
                "email_notifications": True,
                "ai_motivation": True,
                "reminders": True,
                "social": True,
                "achievements": True,
                "reengagement": True,
                "quiet_hours_enabled": False,
                "quiet_hours_start": "22:00:00",
                "quiet_hours_end": "08:00:00",
            }
        ).execute()
    except Exception as e:
        # Log error but don't fail user creation
        logger.error(
            f"Failed to create default notification_preferences for user {user_id}",
            {"error": str(e), "user_id": user_id},
        )

    # Create default feed_preferences
    try:
        supabase.table("feed_preferences").insert(
            {
                "user_id": user_id,
                "show_ai_posts": True,
                "show_community_posts": True,
                "show_following_only": False,
                "categories": [],
            }
        ).execute()
    except Exception as e:
        # Log error but don't fail user creation
        logger.error(
            f"Failed to create default feed_preferences for user {user_id}",
            {"error": str(e), "user_id": user_id},
        )

    # Generate and send verification email for email/password users
    if user.get("auth_provider") == "email" and user.get("email"):
        try:
            code = await generate_verification_code(user_id)
            if code:
                logger.info(
                    f"Verification email sent to user {user_id}",
                    {"user_id": user_id, "email": user.get("email")},
                )
        except Exception as e:
            # Don't fail user creation if email sending fails
            logger.error(
                f"Failed to send verification email for user {user_id}",
                {"error": str(e), "user_id": user_id},
            )

    return user


async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Get user by ID"""
    supabase = get_supabase_client()

    result = supabase.table("users").select("*").eq("id", user_id).execute()

    if not result.data:
        return None

    return result.data[0]


def rotate_refresh_token(old_refresh_token: str) -> Optional[Dict[str, str]]:
    """Rotate refresh token for enhanced security"""
    try:
        # Decode the old token
        payload = verify_token(old_refresh_token)
        if not payload or payload.get("type") != "refresh":
            return None

        user_id = payload.get("user_id")
        token_family = payload.get("token_family")
        token_id = payload.get("token_id")

        if not all([user_id, token_family, token_id]):
            return None

        supabase = get_supabase_client()

        # Check if token family is still active
        family_check = (
            supabase.table("refresh_tokens")
            .select("*")
            .eq("token_family", token_family)
            .eq("token_id", token_id)
            .eq("is_active", True)
            .execute()
        )

        if not family_check.data:
            # Token family compromised, revoke all tokens for this family
            supabase.table("refresh_tokens").update({"is_active": False}).eq(
                "token_family", token_family
            ).execute()
            return None

        # Revoke the old token
        supabase.table("refresh_tokens").update({"is_active": False}).eq(
            "token_family", token_family
        ).eq("token_id", token_id).execute()

        # Create new tokens
        new_access_token = create_access_token({"user_id": user_id})
        new_refresh_token = create_refresh_token({"user_id": user_id})

        return {"access_token": new_access_token, "refresh_token": new_refresh_token}

    except Exception:
        return None


def revoke_all_user_tokens(user_id: str):
    """Revoke all refresh tokens for a user (logout from all devices)"""
    supabase = get_supabase_client()
    supabase.table("refresh_tokens").update({"is_active": False}).eq(
        "user_id", user_id
    ).execute()


def check_password_strength(password: str) -> Dict[str, Any]:
    """Check password strength and return validation result"""
    issues = []
    score = 0

    # Length check
    if len(password) < 8:
        issues.append("Password must be at least 8 characters long")
    else:
        score += 1

    # Character variety checks
    if not any(c.isupper() for c in password):
        issues.append("Password must contain at least one uppercase letter")
    else:
        score += 1

    if not any(c.islower() for c in password):
        issues.append("Password must contain at least one lowercase letter")
    else:
        score += 1

    if not any(c.isdigit() for c in password):
        issues.append("Password must contain at least one number")
    else:
        score += 1

    if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
        issues.append("Password must contain at least one special character")
    else:
        score += 1

    # Common password check
    common_passwords = [
        "password",
        "123456",
        "123456789",
        "qwerty",
        "abc123",
        "password123",
        "admin",
        "letmein",
        "welcome",
        "monkey",
    ]

    if password.lower() in common_passwords:
        issues.append("Password is too common")
        score = 0

    return {
        "is_valid": len(issues) == 0,
        "score": score,
        "max_score": 5,
        "issues": issues,
    }
