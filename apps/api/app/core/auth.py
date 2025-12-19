from datetime import datetime, timedelta, timezone
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
    """Create JWT access token compatible with Supabase Auth

    Token structure follows Supabase conventions so it works with:
    - FastAPI backend authentication
    - Supabase Realtime (for RLS auth.uid() checks)
    - Supabase client setSession()
    """
    # Use timezone-aware UTC datetime to avoid timestamp() issues
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    user_id = data.get("user_id")

    # Create Supabase-compatible token structure
    # This allows Supabase Realtime to use auth.uid() for RLS checks
    to_encode = {
        # Supabase required claims
        "sub": user_id,  # Subject = user ID (Supabase uses this for auth.uid())
        "aud": "authenticated",  # Audience
        "role": "authenticated",  # Role for RLS
        "iat": int(now.timestamp()),  # Issued at (UTC)
        "exp": int(expire.timestamp()),  # Expiration (UTC)
        # Our custom claims (backward compatible)
        "user_id": user_id,
        "type": "access",
        # Optional: include email if available
        "email": data.get("email"),
    }

    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )

    return encoded_jwt


def create_refresh_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
    token_family: Optional[str] = None,
    device_info: Optional[Dict[str, Any]] = None,
) -> str:
    """Create JWT refresh token with rotation support (Supabase-compatible)

    Args:
        data: Dict containing user_id
        expires_delta: Optional custom expiration time
        token_family: Optional existing token family (for rotation, keeps same family)
        device_info: Optional device information for session tracking:
            - device_name: Human-readable name (e.g., "iPhone 14 Pro")
            - device_id: Unique device identifier
            - device_type: Platform ("ios", "android", "web")
            - ip_address: Client IP address
            - user_agent: Browser/app user agent string
    """
    # Use timezone-aware UTC datetime to avoid timestamp() issues
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    # Use existing token family if provided (rotation), otherwise create new (login)
    if token_family is None:
        token_family = secrets.token_urlsafe(16)

    token_id = secrets.token_urlsafe(16)
    user_id = data.get("user_id")

    # Create Supabase-compatible token structure
    to_encode = {
        # Supabase required claims
        "sub": user_id,
        "aud": "authenticated",
        "role": "authenticated",
        "iat": int(now.timestamp()),  # UTC timestamp
        "exp": int(expire.timestamp()),  # UTC timestamp
        # Our custom claims
        "user_id": user_id,
        "type": "refresh",
        "token_family": token_family,
        "token_id": token_id,
    }

    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )

    # Build token record with optional device info
    token_record = {
        "user_id": user_id,
        "token_family": token_family,
        "token_id": token_id,
        "is_active": True,
        "created_at": now.isoformat(),
        "expires_at": expire.isoformat(),
    }

    # Add device info if provided
    if device_info:
        if device_info.get("device_name"):
            token_record["device_name"] = device_info["device_name"][:100]
        if device_info.get("device_id"):
            token_record["device_id"] = device_info["device_id"][:100]
        if device_info.get("device_type"):
            token_record["device_type"] = device_info["device_type"][:20]
        if device_info.get("ip_address"):
            token_record["ip_address"] = device_info["ip_address"]
        if device_info.get("user_agent"):
            token_record["user_agent"] = device_info["user_agent"]

    # Store token in database
    supabase = get_supabase_client()
    supabase.table("refresh_tokens").insert(token_record).execute()

    return encoded_jwt


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify and decode JWT token"""
    try:
        # Disable audience verification since we use custom audience "authenticated"
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"verify_aud": False},
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
                f"Verification code generated but email sending failed for user {user_id} Code: {code}",
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
    """Create new user in both auth.users (for Supabase Realtime) and public.users"""
    supabase = get_supabase_client()

    # Import logger for error handling
    from app.services.logger import logger

    # Hash password if provided (email/password signup)
    password = user_data.pop("password", None)
    raw_password = password  # Keep original for auth.users
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

    email = user_data.get("email")

    # Step 1: Create user in auth.users (for Supabase Realtime RLS to work)
    # This allows auth.uid() to return the correct user ID
    auth_user_id = None
    try:
        auth_user_data = {
            "email": email,
            "email_confirm": True,  # Auto-confirm since we handle verification ourselves
            "user_metadata": {
                "name": user_data.get("name"),
                "auth_provider": auth_provider,
            },
        }

        # Add password for email signups (required by Supabase Auth)
        if raw_password:
            auth_user_data["password"] = raw_password
        else:
            # For OAuth users, generate a random password (they won't use it)
            auth_user_data["password"] = secrets.token_urlsafe(32)

        auth_response = supabase.auth.admin.create_user(auth_user_data)

        if auth_response and auth_response.user:
            auth_user_id = str(auth_response.user.id)
            logger.info(
                f"Created auth.users entry for {email}", {"auth_user_id": auth_user_id}
            )

            # Use the same ID for public.users
            user_data["id"] = auth_user_id
        else:
            logger.warning(f"auth.admin.create_user returned no user for {email}")

    except Exception as e:
        # Check if user already exists in auth.users
        error_str = str(e).lower()
        if "already" in error_str or "exists" in error_str or "duplicate" in error_str:
            try:
                # Try to find existing auth user by email
                existing_auth_users = supabase.auth.admin.list_users()
                for auth_user in existing_auth_users:
                    if auth_user.email == email:
                        auth_user_id = str(auth_user.id)
                        user_data["id"] = auth_user_id
                        logger.info(
                            f"Found existing auth.users entry for {email}",
                            {"auth_user_id": auth_user_id},
                        )
                        break
            except Exception as lookup_error:
                logger.warning(f"Failed to lookup existing auth user: {lookup_error}")
        else:
            # Log but don't fail - user can still be created in public.users
            logger.warning(
                f"Failed to create auth.users entry for {email} (Realtime INSERT/UPDATE may not work)",
                {"error": str(e)},
            )

    # Step 2: Insert user in public.users
    result = supabase.table("users").insert(user_data).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to create user"
        )

    user = result.data[0]
    user_id = user["id"]

    # Log if IDs match (they should for Realtime to work correctly)
    if auth_user_id and auth_user_id != user_id:
        logger.warning(
            f"User ID mismatch! auth.users={auth_user_id}, public.users={user_id}"
        )

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
            await generate_verification_code(user_id)
        except Exception as e:
            # Don't fail user creation if email sending fails
            logger.error(
                f"Failed to send verification email for user {user_id}",
                {"error": str(e), "user_id": user_id},
            )

    return user


async def ensure_auth_user_exists(user: Dict[str, Any]) -> None:
    """
    Ensure a user exists in auth.users (for Supabase Realtime RLS to work).
    Call this for existing users who might have been created before auth.users sync was added.
    """
    from app.services.logger import logger

    supabase = get_supabase_client()
    user_id = user.get("id")
    email = user.get("email")

    if not user_id or not email:
        return

    try:
        # Check if user already exists in auth.users
        existing_auth_users = supabase.auth.admin.list_users()
        for auth_user in existing_auth_users:
            if str(auth_user.id) == user_id:
                # Already exists with same ID
                return

        # User doesn't exist in auth.users, create them
        auth_response = supabase.auth.admin.create_user(
            {
                "id": user_id,
                "email": email,
                "email_confirm": True,
                "password": secrets.token_urlsafe(32),
                "user_metadata": {
                    "name": user.get("name"),
                    "auth_provider": user.get("auth_provider", "email"),
                    "synced_from_existing_user": True,
                },
            }
        )

        if auth_response and auth_response.user:
            logger.info(f"Created auth.users entry for existing user {email}")
    except Exception as e:
        error_str = str(e).lower()
        if "already" in error_str or "exists" in error_str or "duplicate" in error_str:
            # User already exists, that's fine
            pass
        else:
            logger.warning(f"Could not ensure auth.users entry for {email}: {e}")


async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Get user by ID"""
    supabase = get_supabase_client()

    result = supabase.table("users").select("*").eq("id", user_id).execute()

    if not result.data:
        return None

    return result.data[0]


def rotate_refresh_token(old_refresh_token: str) -> Optional[Dict[str, str]]:
    """Rotate refresh token with immediate cleanup (no accumulation)

    Flow:
    1. Validate the old refresh token (JWT signature)
    2. Check if token exists and is active in database
    3. DELETE the old token immediately
    4. Create new tokens with SAME token_family (for reuse detection)
    5. Return new tokens

    Reuse Detection:
    - If token_id not found but token_family exists with different token_id
      → Token was already rotated → Someone is reusing old token → Revoke family

    Returns:
        Dict with new access_token and refresh_token, or None if rotation fails
    """
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

        # Check if this exact token exists and is active (fetch device info too)
        token_check = (
            supabase.table("refresh_tokens")
            .select("id, device_name, device_id, device_type, ip_address, user_agent")
            .eq("token_family", token_family)
            .eq("token_id", token_id)
            .eq("is_active", True)
            .execute()
        )

        if not token_check.data:
            # Token not found or not active
            # Check if family exists with a DIFFERENT token_id (reuse detection)
            family_check = (
                supabase.table("refresh_tokens")
                .select("id")
                .eq("token_family", token_family)
                .eq("is_active", True)
                .execute()
            )

            if family_check.data:
                # Family exists with different token_id → REUSE DETECTED!
                # Someone is using an old token that was already rotated
                # Revoke entire family (delete all tokens for this family)
                supabase.table("refresh_tokens").delete().eq(
                    "token_family", token_family
                ).execute()

            return None

        # Preserve device info from the old token
        old_token_data = token_check.data[0]
        device_info = {}
        if old_token_data.get("device_name"):
            device_info["device_name"] = old_token_data["device_name"]
        if old_token_data.get("device_id"):
            device_info["device_id"] = old_token_data["device_id"]
        if old_token_data.get("device_type"):
            device_info["device_type"] = old_token_data["device_type"]
        if old_token_data.get("ip_address"):
            device_info["ip_address"] = str(old_token_data["ip_address"])
        if old_token_data.get("user_agent"):
            device_info["user_agent"] = old_token_data["user_agent"]

        # Token is valid and active → DELETE it immediately
        supabase.table("refresh_tokens").delete().eq("token_family", token_family).eq(
            "token_id", token_id
        ).execute()

        # Create new tokens with SAME token_family and device_info (for reuse detection)
        new_access_token = create_access_token({"user_id": user_id})
        new_refresh_token = create_refresh_token(
            {"user_id": user_id},
            token_family=token_family,
            device_info=device_info if device_info else None,
        )

        return {"access_token": new_access_token, "refresh_token": new_refresh_token}

    except Exception:
        return None


def revoke_all_user_tokens(user_id: str):
    """Revoke all refresh tokens for a user (logout from all devices)

    Deletes all tokens for the user immediately.
    """
    supabase = get_supabase_client()
    supabase.table("refresh_tokens").delete().eq("user_id", user_id).execute()


def get_user_sessions(user_id: str) -> list:
    """Get all active sessions for a user

    Returns list of sessions with device info for display in settings.
    """
    supabase = get_supabase_client()

    result = (
        supabase.table("refresh_tokens")
        .select(
            "id, token_family, device_name, device_id, device_type, "
            "ip_address, created_at, last_used_at"
        )
        .eq("user_id", user_id)
        .eq("is_active", True)
        .order("created_at", desc=True)
        .execute()
    )

    return result.data if result.data else []


def revoke_session(user_id: str, session_id: str) -> bool:
    """Revoke a specific session for a user

    Args:
        user_id: The user's ID (for security - ensure they own the session)
        session_id: The session ID (refresh_tokens.id) to revoke

    Returns:
        True if session was revoked, False if not found or not owned by user
    """
    supabase = get_supabase_client()

    # Delete the session (only if owned by this user)
    result = (
        supabase.table("refresh_tokens")
        .delete()
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )

    # Return True if a row was deleted
    return bool(result.data)


def cleanup_expired_refresh_tokens() -> int:
    """Clean up expired refresh tokens

    This is a maintenance function that can be called periodically
    to remove tokens that have passed their expiration date.

    With immediate deletion on rotation, this should rarely find anything,
    but it's useful for cleaning up tokens from users who never refreshed
    (e.g., abandoned sessions).

    Returns:
        Number of tokens deleted
    """
    from app.services.logger import logger

    supabase = get_supabase_client()
    now = datetime.now(timezone.utc)

    try:
        # Delete expired tokens (past expiration date)
        result = (
            supabase.table("refresh_tokens")
            .delete()
            .lt("expires_at", now.isoformat())
            .execute()
        )
        deleted_count = len(result.data) if result.data else 0

        if deleted_count > 0:
            logger.info(f"Cleaned up {deleted_count} expired refresh tokens")

        return deleted_count

    except Exception as e:
        logger.error(f"Failed to cleanup refresh tokens: {e}")
        return 0


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
