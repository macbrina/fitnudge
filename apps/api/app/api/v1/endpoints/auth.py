from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any, List
import json
import re
import httpx
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
from app.services.email_service import email_service
from app.services.logger import logger
import secrets
from postgrest.exceptions import APIError
from jose import jwt, JWTError

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
    identity_token: str
    authorization_code: Optional[str] = None
    email: Optional[str] = None
    full_name: Optional[dict] = None


class GoogleOAuth(BaseModel):
    id_token: str
    access_token: Optional[str] = None


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


class PasswordResetValidate(BaseModel):
    token: str


class ResendVerificationRequest(BaseModel):
    email: Optional[EmailStr] = None  # Optional if authenticated user


# Import the flexible authentication system
from app.core.flexible_auth import get_current_user


APPLE_KEYS_CACHE: Dict[str, Any] = {"keys": None, "expires_at": None}


def normalize_username_candidate(value: str) -> Optional[str]:
    if not value:
        return None

    normalized = value.lower()
    normalized = re.sub(r"[^a-z0-9_]+", "", normalized)
    normalized = normalized.strip("_")

    if not normalized:
        return None

    return normalized[:24]


def ensure_unique_username(*candidates: str) -> str:
    supabase = get_supabase_client()

    candidate_sources = [candidate for candidate in candidates if candidate]
    candidate_sources.append("fitnudge")

    for source in candidate_sources:
        base = normalize_username_candidate(source)
        if not base:
            continue

        suffix = 0
        while suffix < 5000:
            if suffix == 0:
                username = base
            else:
                suffix_str = str(suffix)
                truncated_base = base[: max(1, 24 - len(suffix_str))]
                username = f"{truncated_base}{suffix_str}"

            existing = (
                supabase.table("users").select("id").eq("username", username).execute()
            )
            if not existing.data:
                return username

            suffix += 1

    # Final fallback with secrets if all else fails
    random_suffix = secrets.token_hex(3)
    return f"fitnudge{random_suffix}"


def get_linked_providers(
    user_id: str, primary_provider: Optional[str] = None
) -> List[str]:
    supabase = get_supabase_client()
    providers: List[str] = []

    if primary_provider:
        providers.append(primary_provider)

    result = (
        supabase.table("oauth_accounts")
        .select("provider")
        .eq("user_id", user_id)
        .execute()
    )

    if result.data:
        providers.extend(
            [row["provider"] for row in result.data if row.get("provider")]
        )

    # Deduplicate while preserving order
    seen = set()
    unique_providers = []
    for provider in providers:
        if provider and provider not in seen:
            seen.add(provider)
            unique_providers.append(provider)

    return unique_providers


def serialize_user(user: Dict[str, Any]) -> Dict[str, Any]:
    linked_providers = get_linked_providers(user["id"], user.get("auth_provider"))

    return {
        "id": user["id"],
        "email": user["email"],
        "name": user.get("name"),
        "username": user.get("username"),
        "plan": user.get("plan", "free"),
        "timezone": user.get("timezone", "UTC"),
        "email_verified": user.get("email_verified", False),
        "auth_provider": user.get("auth_provider", "email"),
        "created_at": user.get("created_at"),
        "last_login_at": user.get("last_login_at"),
        "linked_providers": linked_providers,
    }


def upsert_oauth_account(
    user_id: str,
    provider: str,
    provider_user_id: str,
    *,
    email: Optional[str] = None,
    name: Optional[str] = None,
    picture: Optional[str] = None,
    raw: Optional[Dict[str, Any]] = None,
    access_token: Optional[str] = None,
    refresh_token: Optional[str] = None,
    token_expires_at: Optional[str] = None,
):
    supabase = get_supabase_client()
    payload = {
        "user_id": user_id,
        "provider": provider,
        "provider_user_id": provider_user_id,
        "provider_email": email,
        "provider_name": name,
        "provider_picture": picture,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_expires_at": token_expires_at,
        "raw_user_data": raw,
        "updated_at": datetime.utcnow().isoformat(),
    }

    supabase.table("oauth_accounts").upsert(
        payload, on_conflict="provider,provider_user_id"
    ).execute()


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    if not email:
        return None

    supabase = get_supabase_client()
    result = supabase.table("users").select("*").eq("email", email).execute()
    if result.data:
        return result.data[0]
    return None


async def verify_google_id_token(id_token: str) -> Dict[str, Any]:
    if not settings.google_client_ids:
        logger.error("Google OAuth attempted without server configuration")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth is not configured on the server",
        )

    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": id_token},
        )

    if response.status_code != 200:
        logger.warning(
            "Google token validation failed",
            {"status_code": response.status_code, "response": response.text},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google credentials",
        )

    token_data = response.json()
    audience = token_data.get("aud")

    if audience not in settings.google_client_ids:
        logger.warning(
            "Google token audience mismatch",
            {"audience": audience, "allowed": settings.google_client_ids},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token audience mismatch. Update GOOGLE_CLIENT_IDS to include this client.",
        )

    return token_data


async def fetch_apple_public_keys() -> List[Dict[str, Any]]:
    global APPLE_KEYS_CACHE

    now = datetime.utcnow()
    cached_keys = APPLE_KEYS_CACHE.get("keys")
    expires_at = APPLE_KEYS_CACHE.get("expires_at")

    if cached_keys and expires_at and expires_at > now:
        return cached_keys

    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.get("https://appleid.apple.com/auth/keys")

    if response.status_code != 200:
        logger.error(
            "Failed to fetch Apple public keys",
            {"status_code": response.status_code, "response": response.text},
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to verify Apple credentials right now",
        )

    keys = response.json().get("keys", [])
    APPLE_KEYS_CACHE = {
        "keys": keys,
        "expires_at": now + timedelta(hours=1),
    }
    return keys


async def verify_apple_identity_token(identity_token: str) -> Dict[str, Any]:
    if not settings.apple_client_ids:
        logger.error("Apple OAuth attempted without server configuration")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Apple OAuth is not configured on the server",
        )

    try:
        headers = jwt.get_unverified_header(identity_token)
    except JWTError as error:
        logger.warning("Invalid Apple identity token header", {"error": str(error)})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Apple credentials",
        ) from error

    keys = await fetch_apple_public_keys()
    matching_key = next(
        (key for key in keys if key.get("kid") == headers.get("kid")), None
    )

    if not matching_key:
        logger.warning("Apple identity token key mismatch", headers)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Apple credentials",
        )

    try:
        payload = jwt.decode(
            identity_token,
            matching_key,
            algorithms=[headers.get("alg", "RS256")],
            audience=settings.apple_client_ids,
            issuer="https://appleid.apple.com",
        )
    except JWTError as error:
        logger.warning("Failed to decode Apple identity token", {"error": str(error)})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Apple credentials",
        ) from error

    return payload


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
        "user": serialize_user(user),
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
    current_timestamp = datetime.now(timezone.utc).isoformat()
    supabase.table("users").update({"last_login_at": current_timestamp}).eq(
        "id", user["id"]
    ).execute()
    user["last_login_at"] = current_timestamp

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "remember_me": credentials.remember_me,
        "user": serialize_user(user),
    }


@router.post("/oauth/google")
async def google_oauth(oauth_data: GoogleOAuth):
    """Sign in with Google (iOS + Android)"""

    token_data = await verify_google_id_token(oauth_data.id_token)
    google_sub = token_data.get("sub")

    if not google_sub:
        logger.warning("Google token missing subject", token_data)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google credentials",
        )

    email = token_data.get("email")
    email_verified = str(token_data.get("email_verified", "")).lower() in (
        "true",
        "1",
    )
    full_name = token_data.get("name") or token_data.get("given_name")
    picture = token_data.get("picture")

    supabase = get_supabase_client()

    # Step 1: Check if this Google account is already linked
    account_result = (
        supabase.table("oauth_accounts")
        .select("user_id")
        .eq("provider", "google")
        .eq("provider_user_id", google_sub)
        .execute()
    )

    user: Optional[Dict[str, Any]] = None

    if account_result.data:
        user_id = account_result.data[0]["user_id"]
        user = await get_user_by_id(user_id)
        if not user:
            logger.warning(
                "Google account linked to missing user", {"user_id": user_id}
            )

    # Step 2: If not linked, look up by email
    if not user and email:
        existing_user = get_user_by_email(email)
        if existing_user:
            user = existing_user

    # Step 3: Create a new user if none found
    if not user:
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google account did not return an email address.",
            )

        username = ensure_unique_username(
            token_data.get("preferred_username"),
            token_data.get("name"),
            token_data.get("given_name"),
            token_data.get("family_name"),
            email.split("@")[0],
        )

        display_name = full_name or username

        user = await create_user(
            {
                "email": email,
                "name": display_name,
                "username": username,
                "auth_provider": "google",
                "email_verified": email_verified,
                "plan": "free",
                "timezone": token_data.get("timezone") or "UTC",
                "language": token_data.get("locale", "en"),
                "profile_picture_url": picture,
            }
        )
    else:
        # Update email verification if Google confirms it
        if email_verified and not user.get("email_verified"):
            supabase.table("users").update({"email_verified": True}).eq(
                "id", user["id"]
            ).execute()
            user["email_verified"] = True

        # Keep profile picture up to date if we have one
        if picture and not user.get("profile_picture_url"):
            supabase.table("users").update({"profile_picture_url": picture}).eq(
                "id", user["id"]
            ).execute()
            user["profile_picture_url"] = picture

    upsert_oauth_account(
        user_id=user["id"],
        provider="google",
        provider_user_id=google_sub,
        email=email,
        name=full_name,
        picture=picture,
        raw=token_data,
        access_token=oauth_data.access_token,
    )

    current_timestamp = datetime.now(timezone.utc).isoformat()
    supabase.table("users").update({"last_login_at": current_timestamp}).eq(
        "id", user["id"]
    ).execute()
    user["last_login_at"] = current_timestamp

    access_token = create_access_token({"user_id": user["id"]})
    refresh_token = create_refresh_token({"user_id": user["id"]})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": serialize_user(user),
    }


@router.post("/oauth/apple")
async def apple_oauth(oauth_data: AppleOAuth):
    """Sign in with Apple"""

    payload = await verify_apple_identity_token(oauth_data.identity_token)
    apple_sub = payload.get("sub")

    if not apple_sub:
        logger.warning("Apple identity token missing subject", payload)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Apple credentials",
        )

    email_from_token = payload.get("email")
    email = oauth_data.email or email_from_token
    email_verified = str(payload.get("email_verified", "")).lower() in (
        "true",
        "1",
    )

    name_payload = oauth_data.full_name or {}
    full_name = None
    if isinstance(name_payload, dict):
        given = name_payload.get("givenName") or name_payload.get("given_name")
        family = name_payload.get("familyName") or name_payload.get("family_name")
        if given and family:
            full_name = f"{given} {family}".strip()
        elif given:
            full_name = given
        elif family:
            full_name = family

    supabase = get_supabase_client()

    account_result = (
        supabase.table("oauth_accounts")
        .select("user_id")
        .eq("provider", "apple")
        .eq("provider_user_id", apple_sub)
        .execute()
    )

    user: Optional[Dict[str, Any]] = None

    if account_result.data:
        user_id = account_result.data[0]["user_id"]
        user = await get_user_by_id(user_id)
        if not user:
            logger.warning("Apple account linked to missing user", {"user_id": user_id})

    if not user and email:
        existing_user = get_user_by_email(email)
        if existing_user:
            user = existing_user

    if not user:
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Apple did not provide an email address for this account.",
            )

        username = ensure_unique_username(
            full_name,
            email.split("@")[0],
        )

        display_name = full_name or username

        user = await create_user(
            {
                "email": email,
                "name": display_name,
                "username": username,
                "auth_provider": "apple",
                "email_verified": email_verified,
                "plan": "free",
                "timezone": "UTC",
                "language": payload.get("locale", "en"),
            }
        )
    else:
        if email_verified and not user.get("email_verified"):
            supabase.table("users").update({"email_verified": True}).eq(
                "id", user["id"]
            ).execute()
            user["email_verified"] = True

    upsert_oauth_account(
        user_id=user["id"],
        provider="apple",
        provider_user_id=apple_sub,
        email=email,
        name=full_name,
        raw={
            "identity_token": payload,
            "authorization_code": oauth_data.authorization_code,
        },
    )

    current_timestamp = datetime.now(timezone.utc).isoformat()
    supabase.table("users").update({"last_login_at": current_timestamp}).eq(
        "id", user["id"]
    ).execute()
    user["last_login_at"] = current_timestamp

    access_token = create_access_token({"user_id": user["id"]})
    refresh_token = create_refresh_token({"user_id": user["id"]})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": serialize_user(user),
    }


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
        "user": serialize_user(updated_user),
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
    try:
        supabase.table("password_reset_tokens").update({"used": True}).eq(
            "user_id", user_id
        ).eq("used", False).execute()
    except APIError as exc:
        # Supabase/PostgREST returns a 404 when no rows match the update filter.
        # That's expected if the user hasn't requested a token before, so we can safely ignore it.
        if str(getattr(exc, "code", "")) not in {"404", "PGRST116"}:
            logger.error(
                "Failed to invalidate existing password reset tokens",
                {"user_id": user_id, "error": exc.message},
            )
            raise

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


@router.post("/reset-password/validate")
async def validate_reset_token(reset_data: PasswordResetValidate):
    from app.core.database import get_supabase_client
    from datetime import datetime, timezone

    supabase = get_supabase_client()

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

    expires_at = datetime.fromisoformat(
        reset_token["expires_at"].replace("Z", "+00:00")
    )
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired, please request a new one",
        )

    return {"valid": True, "expires_at": expires_at.isoformat()}


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
            detail="Reset token has expired, please request a new one",
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
