from fastapi import APIRouter, HTTPException, status, Depends, Request
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
    ensure_auth_user_exists,
    rotate_refresh_token,
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
class DeviceInfo(BaseModel):
    """Device information for session tracking"""

    device_name: Optional[str] = None  # e.g., "iPhone 14 Pro", "Chrome on Windows"
    device_id: Optional[str] = None  # Unique device identifier
    device_type: Optional[str] = None  # "ios", "android", "web"


class UserSignup(BaseModel):
    email: EmailStr
    password: str
    name: str
    username: str
    timezone: Optional[str] = (
        None  # IANA timezone string (e.g., 'America/New_York'), defaults to UTC if not provided
    )
    country: Optional[str] = (
        None  # ISO 3166-1 alpha-2 country code (e.g., 'US', 'NG', 'GB'), auto-detected from client
    )
    device_info: Optional[DeviceInfo] = None
    referral_code: Optional[str] = None  # Code of user who referred them


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    remember_me: Optional[bool] = False
    device_info: Optional[DeviceInfo] = None


class AppleOAuth(BaseModel):
    identity_token: str
    authorization_code: Optional[str] = None
    email: Optional[str] = None
    full_name: Optional[dict] = None
    device_info: Optional[DeviceInfo] = None
    referral_code: Optional[str] = None  # Referral code for new users
    timezone: Optional[str] = None  # IANA timezone from device (e.g. 'America/New_York')
    country: Optional[str] = None  # ISO 3166-1 alpha-2 from device (e.g. 'US')


class GoogleOAuth(BaseModel):
    id_token: str
    access_token: Optional[str] = None
    device_info: Optional[DeviceInfo] = None
    referral_code: Optional[str] = None  # Referral code for new users
    timezone: Optional[str] = None  # IANA timezone from device (e.g. 'America/New_York')
    country: Optional[str] = None  # ISO 3166-1 alpha-2 from device (e.g. 'US')


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


def build_device_info(
    request: Request, device_info: Optional[DeviceInfo] = None
) -> Dict[str, Any]:
    """Build device info dict from request headers and optional body data

    Combines:
    - IP address from request (X-Forwarded-For or client.host)
    - User-Agent from request headers
    - Device name, ID, type from client-provided device_info
    """
    result: Dict[str, Any] = {}

    # Get IP address (handle proxy headers)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take first IP if multiple (comma-separated)
        result["ip_address"] = forwarded_for.split(",")[0].strip()
    elif request.client:
        result["ip_address"] = request.client.host

    # Get User-Agent
    user_agent = request.headers.get("User-Agent")
    if user_agent:
        result["user_agent"] = user_agent

    # Add client-provided device info
    if device_info:
        if device_info.device_name:
            result["device_name"] = device_info.device_name
        if device_info.device_id:
            result["device_id"] = device_info.device_id
        if device_info.device_type:
            result["device_type"] = device_info.device_type

    return result


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

    # Check if user has a password set (OAuth users may not have one)
    password_hash = user.get("password_hash")
    has_password = password_hash is not None and len(str(password_hash)) > 0

    return {
        "id": user["id"],
        "email": user["email"],
        "name": user.get("name"),
        "username": user.get("username"),
        "plan": user.get("plan", "free"),
        "timezone": user.get("timezone", "UTC"),
        "country": user.get("country"),  # ISO 3166-1 alpha-2 code
        "language": user.get("language", "en"),
        "email_verified": user.get("email_verified", False),
        "auth_provider": user.get("auth_provider", "email"),
        "created_at": user.get("created_at"),
        "updated_at": user.get("updated_at"),
        "last_login_at": user.get("last_login_at"),
        "linked_providers": linked_providers,
        "has_password": has_password,
        # Profile fields
        "profile_picture_url": user.get("profile_picture_url"),
        "bio": user.get("bio"),
        # Status & Role
        "status": user.get("status", "active"),
        "role": user.get("role"),
        # V2 Preferences
        "motivation_style": user.get("motivation_style"),
        "morning_motivation_enabled": user.get("morning_motivation_enabled"),
        "morning_motivation_time": user.get("morning_motivation_time"),
        # Referral
        "referral_code": user.get("referral_code"),
        # Onboarding
        "onboarding_completed_at": user.get("onboarding_completed_at"),
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

    audiences = settings.apple_client_ids or []
    if not audiences:
        audiences = [headers.get("kid")]

    payload = None
    last_error: Optional[Exception] = None

    for aud in audiences:
        if not aud:
            continue
    try:
        payload = jwt.decode(
            identity_token,
            matching_key,
            algorithms=[headers.get("alg", "RS256")],
            audience=aud,
            issuer="https://appleid.apple.com",
        )
    except JWTError as error:
        last_error = error

    if payload is None:
        logger.warning(
            "Failed to decode Apple identity token",
            {
                "error": str(last_error) if last_error else None,
                "audiences": audiences,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Apple credentials",
        ) from last_error

    return payload


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(user_data: UserSignup, request: Request):
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

    try:
        # Create user (this should NOT fail even if email sending fails)
        # Exclude device_info and referral_code from user data (handled separately)
        # country is included in user_dict for storage
        user_dict = user_data.model_dump(exclude={"device_info", "referral_code"})
        user = await create_user(user_dict)

        # Handle referral system
        from app.services.referral_service import (
            create_referral_record,
            generate_referral_code,
            get_referrer_by_code,
        )

        # Generate referral code for new user
        new_referral_code = generate_referral_code(user_data.username)
        referrer_id = None

        # Handle referral if provided
        if user_data.referral_code:
            referrer = await get_referrer_by_code(user_data.referral_code)
            if referrer:
                referrer_id = referrer["id"]
                logger.info(
                    f"User {user['id']} was referred by {referrer_id}",
                    {"referral_code": user_data.referral_code},
                )
                await create_referral_record(referrer_id, user["id"])

        # Update user with referral info (bonus granted later when they subscribe)
        supabase.table("users").update(
            {
                "referral_code": new_referral_code,
                "referred_by_user_id": referrer_id,
            }
        ).eq("id", user["id"]).execute()

        # # Refresh user from database to ensure we have latest values (e.g., email_verified)
        # # This is important because create_user() may have auto-verified email if SMTP failed
        # from app.core.auth import get_user_by_id

        # refreshed_user = await get_user_by_id(user["id"])
        # if refreshed_user:
        #     user = refreshed_user

        # Build device info from request and body
        device_info = build_device_info(request, user_data.device_info)

        # Clean up any existing tokens (shouldn't exist for new user, but just in case)
        supabase.table("refresh_tokens").delete().eq("user_id", user["id"]).execute()

        # Create tokens
        access_token = create_access_token({"user_id": user["id"]})
        refresh_token = create_refresh_token(
            {"user_id": user["id"]}, device_info=device_info
        )

        # Serialize user (might fail if oauth_accounts query fails)
        try:
            serialized_user = serialize_user(user)
            # Add referral code to response
            serialized_user["referral_code"] = new_referral_code
        except Exception as serialize_error:
            # If serialization fails, create a minimal user object
            logger.warning(
                f"User serialization failed for {user['id']}, using minimal response",
                {"error": str(serialize_error), "user_id": user["id"]},
            )
            serialized_user = {
                "id": user["id"],
                "email": user["email"],
                "name": user.get("name"),
                "username": user.get("username"),
                "plan": user.get("plan", "free"),
                "timezone": user.get("timezone", "UTC"),
                "email_verified": user.get("email_verified", False),
                "auth_provider": user.get("auth_provider", "email"),
                "referral_code": new_referral_code,
            }

        # Analytics: track signup
        from app.core.analytics import track_user_signup

        track_user_signup(user["id"], user.get("auth_provider", "email"))

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": serialized_user,
        }

    except HTTPException:
        # Re-raise HTTP exceptions (like validation errors)
        raise
    except Exception as e:
        # If anything fails after user creation, log it but DON'T return "user already exists"
        logger.error(
            f"Signup error after user creation",
            {"error": str(e), "email": user_data.email},
        )
        # Return a generic error, not "user already exists"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Account created but there was an error completing registration. Please try logging in.",
        )


@router.post("/login")
async def login(credentials: UserLogin, request: Request):
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

    # Ensure existing user is in auth.users (for Realtime to work)
    await ensure_auth_user_exists(user)

    # Build device info from request and body
    device_info = build_device_info(request, credentials.device_info)

    # Get supabase client for database operations
    supabase = get_supabase_client()

    # Clean up ALL old refresh tokens for this user on fresh login
    # This prevents token accumulation from reinstalls/multiple logins
    supabase.table("refresh_tokens").delete().eq("user_id", user["id"]).execute()

    # Create tokens with different expiration based on remember_me
    if credentials.remember_me:
        # Extended tokens for remember me (30 days access, 90 days refresh)
        access_token = create_access_token(
            {"user_id": user["id"]}, expires_delta=timedelta(days=30)
        )
        refresh_token = create_refresh_token(
            {"user_id": user["id"]},
            expires_delta=timedelta(days=90),
            device_info=device_info,
        )
    else:
        # Standard tokens (1 hour access, 7 days refresh)
        access_token = create_access_token({"user_id": user["id"]})
        refresh_token = create_refresh_token(
            {"user_id": user["id"]}, device_info=device_info
        )

    # Update last login
    current_timestamp = datetime.now(timezone.utc).isoformat()
    supabase.table("users").update({"last_login_at": current_timestamp}).eq(
        "id", user["id"]
    ).execute()
    user["last_login_at"] = current_timestamp

    # Analytics: track login
    from app.core.analytics import track_user_login

    track_user_login(user["id"], user.get("auth_provider", "email"))

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "remember_me": credentials.remember_me,
        "user": serialize_user(user),
    }


@router.post("/oauth/google")
async def google_oauth(oauth_data: GoogleOAuth, request: Request):
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
    is_new_user = False
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

        # Prefer device timezone/country from client; Google token rarely has timezone
        tz = oauth_data.timezone or token_data.get("timezone") or "UTC"
        country = oauth_data.country

        user = await create_user(
            {
                "email": email,
                "name": display_name,
                "username": username,
                "auth_provider": "google",
                "email_verified": email_verified,
                "plan": "free",
                "timezone": tz,
                "country": country,
                "language": token_data.get("locale", "en"),
                "profile_picture_url": picture,
            }
        )
        is_new_user = True

        # Handle referral for new OAuth users - always generate referral code
        from app.services.referral_service import (
            create_referral_record,
            generate_referral_code,
            get_referrer_by_code,
        )

        new_referral_code = generate_referral_code(username)
        referrer_id = None

        # Check if they were referred by someone
        if oauth_data.referral_code:
            referrer = await get_referrer_by_code(oauth_data.referral_code)
            referrer_id = referrer["id"] if referrer else None
            if referrer_id:
                logger.info(
                    f"Google OAuth user {user['id']} was referred by {referrer_id}",
                    {"referral_code": oauth_data.referral_code},
                )
                await create_referral_record(referrer_id, user["id"])

        # Store referral code (and referrer if any)
        supabase.table("users").update(
            {
                "referral_code": new_referral_code,
                "referred_by_user_id": referrer_id,
            }
        ).eq("id", user["id"]).execute()

        # V2: Audio preferences removed (V1 feature)
    else:
        # Ensure existing user is in auth.users (for Realtime to work)
        await ensure_auth_user_exists(user)

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

    # Build device info from request and body
    device_info = build_device_info(request, oauth_data.device_info)

    # Clean up ALL old refresh tokens for this user on fresh login
    supabase.table("refresh_tokens").delete().eq("user_id", user["id"]).execute()

    access_token = create_access_token({"user_id": user["id"]})
    refresh_token = create_refresh_token(
        {"user_id": user["id"]}, device_info=device_info
    )

    from app.core.analytics import track_user_login, track_user_signup

    if is_new_user:
        track_user_signup(user["id"], "google")
    else:
        track_user_login(user["id"], "google")

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": serialize_user(user),
    }


@router.post("/oauth/apple")
async def apple_oauth(oauth_data: AppleOAuth, request: Request):
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

    is_new_user = False
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

        # Use device timezone/country from client; Apple token does not include these
        tz = oauth_data.timezone or "UTC"
        country = oauth_data.country

        user = await create_user(
            {
                "email": email,
                "name": display_name,
                "username": username,
                "auth_provider": "apple",
                "email_verified": email_verified,
                "plan": "free",
                "timezone": tz,
                "country": country,
                "language": payload.get("locale", "en"),
            }
        )
        is_new_user = True

        # Handle referral for new OAuth users - always generate referral code
        from app.services.referral_service import (
            create_referral_record,
            generate_referral_code,
            get_referrer_by_code,
        )

        new_referral_code = generate_referral_code(username)
        referrer_id = None

        # Check if they were referred by someone
        if oauth_data.referral_code:
            referrer = await get_referrer_by_code(oauth_data.referral_code)
            referrer_id = referrer["id"] if referrer else None
            if referrer_id:
                logger.info(
                    f"Apple OAuth user {user['id']} was referred by {referrer_id}",
                    {"referral_code": oauth_data.referral_code},
                )
                await create_referral_record(referrer_id, user["id"])

        # Store referral code (and referrer if any)
        supabase.table("users").update(
            {
                "referral_code": new_referral_code,
                "referred_by_user_id": referrer_id,
            }
        ).eq("id", user["id"]).execute()

        # V2: Audio preferences removed (V1 feature)
    else:
        # Ensure existing user is in auth.users (for Realtime to work)
        await ensure_auth_user_exists(user)

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

    # Build device info from request and body
    device_info = build_device_info(request, oauth_data.device_info)

    # Clean up ALL old refresh tokens for this user on fresh login
    supabase.table("refresh_tokens").delete().eq("user_id", user["id"]).execute()

    access_token = create_access_token({"user_id": user["id"]})
    refresh_token = create_refresh_token(
        {"user_id": user["id"]}, device_info=device_info
    )

    from app.core.analytics import track_user_login, track_user_signup

    if is_new_user:
        track_user_signup(user["id"], "apple")
    else:
        track_user_login(user["id"], "apple")

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": serialize_user(user),
    }


@router.post("/refresh")
async def refresh_token(token_data: TokenRefresh):
    """Refresh access token with proper token rotation

    This endpoint:
    1. Validates the refresh token
    2. Checks the token family in the database
    3. Deletes the old token
    4. Creates new access + refresh tokens
    5. Returns the new tokens (client MUST use the new refresh token)
    """
    from app.core.database import get_supabase_client

    # First, try proper token rotation (validates, deletes old, creates new)
    rotated = rotate_refresh_token(token_data.refresh_token)

    if rotated:
        return rotated

    # Fallback: If rotation fails (e.g., token not in DB), try basic validation
    # This handles tokens created before rotation tracking was added
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

    # Check if user exists
    supabase = get_supabase_client()
    user_result = supabase.table("users").select("id").eq("id", user_id).execute()

    if not user_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # CLEANUP: Delete old tokens in this family
    # If user reinstalls app or has stale tokens, this cleans them all up
    token_family = payload.get("token_family")
    token_id = payload.get("token_id")

    if token_family:
        # Delete ALL tokens in this family - user only needs the new one
        supabase.table("refresh_tokens").delete().eq(
            "token_family", token_family
        ).execute()
    elif token_id:
        # Fallback: delete by token_id only (legacy tokens without family)
        supabase.table("refresh_tokens").delete().eq("token_id", token_id).execute()

    # Create new tokens with same token_family if available (maintains session identity)
    access_token = create_access_token({"user_id": user_id})
    new_refresh_token = create_refresh_token(
        {"user_id": user_id},
        token_family=token_family,  # Reuse family if exists, else creates new
    )

    return {"access_token": access_token, "refresh_token": new_refresh_token}


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout user and revoke all refresh tokens for this user

    This invalidates all sessions for the user (logout from all devices).
    Client should also discard tokens locally.
    """
    from app.core.auth import revoke_all_user_tokens

    user_id = current_user.get("id")
    if user_id:
        revoke_all_user_tokens(user_id)

    return {"message": "Successfully logged out"}


@router.get("/sessions")
async def get_sessions(current_user: dict = Depends(get_current_user)):
    """Get all active sessions for the current user

    Returns a list of sessions with device info so users can see
    where they're logged in and manage their sessions.
    """
    from app.core.auth import get_user_sessions

    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    sessions = get_user_sessions(user_id)

    # Format sessions for client display
    formatted_sessions = []
    for session in sessions:
        formatted_sessions.append(
            {
                "id": session.get("id"),
                "device_name": session.get("device_name") or "Unknown device",
                "device_type": session.get("device_type") or "unknown",
                "ip_address": (
                    str(session.get("ip_address"))
                    if session.get("ip_address")
                    else None
                ),
                "created_at": session.get("created_at"),
                "last_used_at": session.get("last_used_at"),
                # Include token_family so client can identify current session
                "token_family": session.get("token_family"),
            }
        )

    return {"sessions": formatted_sessions, "count": len(formatted_sessions)}


@router.delete("/sessions/{session_id}")
async def revoke_session_endpoint(
    session_id: str, current_user: dict = Depends(get_current_user)
):
    """Revoke a specific session (logout from one device)

    Allows users to sign out of a specific device without affecting
    other sessions.
    """
    from app.core.auth import revoke_session

    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    success = revoke_session(user_id, session_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or already revoked",
        )

    return {"message": "Session revoked successfully"}


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

    return {"message": "Password reset successfully"}


# ============================================================================
# Account Linking Endpoints
# ============================================================================


class LinkGoogleRequest(BaseModel):
    id_token: str


class LinkAppleRequest(BaseModel):
    identity_token: str
    authorization_code: Optional[str] = None


@router.post("/link/google")
async def link_google_account(
    link_data: LinkGoogleRequest,
    current_user: dict = Depends(get_current_user),
):
    """Link a Google account to the current user's account"""
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    # Verify the Google token
    token_data = await verify_google_id_token(link_data.id_token)
    google_sub = token_data.get("sub")

    if not google_sub:
        logger.warning("Google token missing subject during linking", token_data)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google credentials",
        )

    supabase = get_supabase_client()

    # Check if this Google account is already linked to another user
    existing_link = (
        supabase.table("oauth_accounts")
        .select("user_id")
        .eq("provider", "google")
        .eq("provider_user_id", google_sub)
        .execute()
    )

    if existing_link.data:
        linked_user_id = existing_link.data[0]["user_id"]
        if linked_user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This Google account is already linked to another user",
            )
        # Already linked to this user
        user = await get_user_by_id(user_id)
        return {
            "message": "Google account already linked",
            "user": serialize_user(user),
        }

    # Check if the Google email is already used by another user's primary account
    # This prevents User B from linking a Google account whose email belongs to User A
    google_email = token_data.get("email")
    if google_email:
        existing_user_with_email = get_user_by_email(google_email)
        if existing_user_with_email and existing_user_with_email["id"] != user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This email is already associated with another account",
            )

    # Link the Google account
    email = token_data.get("email")
    full_name = token_data.get("name") or token_data.get("given_name")
    picture = token_data.get("picture")

    upsert_oauth_account(
        user_id=user_id,
        provider="google",
        provider_user_id=google_sub,
        email=email,
        name=full_name,
        picture=picture,
        raw=token_data,
    )

    logger.info(f"Google account linked for user {user_id}", {"google_sub": google_sub})

    # Return updated user
    user = await get_user_by_id(user_id)
    return {
        "message": "Google account linked successfully",
        "user": serialize_user(user),
    }


@router.post("/link/apple")
async def link_apple_account(
    link_data: LinkAppleRequest,
    current_user: dict = Depends(get_current_user),
):
    """Link an Apple account to the current user's account"""
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    # Verify the Apple token
    payload = await verify_apple_identity_token(link_data.identity_token)
    apple_sub = payload.get("sub")

    if not apple_sub:
        logger.warning("Apple identity token missing subject during linking", payload)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Apple credentials",
        )

    supabase = get_supabase_client()

    # Check if this Apple account is already linked to another user
    existing_link = (
        supabase.table("oauth_accounts")
        .select("user_id")
        .eq("provider", "apple")
        .eq("provider_user_id", apple_sub)
        .execute()
    )

    if existing_link.data:
        linked_user_id = existing_link.data[0]["user_id"]
        if linked_user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This Apple account is already linked to another user",
            )
        # Already linked to this user
        user = await get_user_by_id(user_id)
        return {
            "message": "Apple account already linked",
            "user": serialize_user(user),
        }

    # Check if the Apple email is already used by another user's primary account
    # This prevents User B from linking an Apple account whose email belongs to User A
    apple_email = payload.get("email")
    if apple_email:
        existing_user_with_email = get_user_by_email(apple_email)
        if existing_user_with_email and existing_user_with_email["id"] != user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This email is already associated with another account",
            )

    # Link the Apple account
    email = payload.get("email")

    upsert_oauth_account(
        user_id=user_id,
        provider="apple",
        provider_user_id=apple_sub,
        email=email,
        raw={
            "identity_token": payload,
            "authorization_code": link_data.authorization_code,
        },
    )

    logger.info(f"Apple account linked for user {user_id}", {"apple_sub": apple_sub})

    # Return updated user
    user = await get_user_by_id(user_id)
    return {
        "message": "Apple account linked successfully",
        "user": serialize_user(user),
    }


@router.delete("/unlink/{provider}")
async def unlink_account(
    provider: str,
    current_user: dict = Depends(get_current_user),
):
    """Unlink a social account from the current user's account"""
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    # Validate provider
    valid_providers = ["google", "apple"]
    if provider not in valid_providers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid provider. Must be one of: {', '.join(valid_providers)}",
        )

    # Cannot unlink primary provider
    primary_provider = current_user.get("auth_provider")
    if provider == primary_provider:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot unlink your primary sign-in method",
        )

    supabase = get_supabase_client()

    # Check if the provider is linked
    existing_link = (
        supabase.table("oauth_accounts")
        .select("id")
        .eq("user_id", user_id)
        .eq("provider", provider)
        .execute()
    )

    if not existing_link.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{provider.capitalize()} account is not linked",
        )

    # Delete the oauth account link
    supabase.table("oauth_accounts").delete().eq("user_id", user_id).eq(
        "provider", provider
    ).execute()

    logger.info(f"{provider.capitalize()} account unlinked for user {user_id}")

    # Return updated user
    user = await get_user_by_id(user_id)
    return {
        "message": f"{provider.capitalize()} account unlinked successfully",
        "user": serialize_user(user),
    }


# ============================================================================
# Set Password Endpoint (for OAuth users who don't have a password yet)
# ============================================================================


class SetPasswordRequest(BaseModel):
    new_password: str


@router.post("/set-password")
async def set_password(
    password_data: SetPasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Set a password for OAuth users who don't have one yet.
    This is different from change-password which requires the current password.
    """
    from app.core.auth import get_password_hash

    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    supabase = get_supabase_client()

    # Get current user data to check if they already have a password
    user_result = (
        supabase.table("users")
        .select("password_hash, auth_provider")
        .eq("id", user_id)
        .execute()
    )

    if not user_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user_data = user_result.data[0]

    # Check if user already has a password
    if user_data.get("password_hash"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have a password. Use change-password instead.",
        )

    # Validate password strength
    password_check = check_password_strength(password_data.new_password)
    if not password_check["is_valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=password_check.get("message", "Password does not meet requirements"),
        )

    # Set the new password
    new_password_hash = get_password_hash(password_data.new_password)
    supabase.table("users").update({"password_hash": new_password_hash}).eq(
        "id", user_id
    ).execute()

    logger.info(f"Password set for OAuth user {user_id}")

    # Return updated user
    user = await get_user_by_id(user_id)
    return {
        "message": "Password set successfully",
        "user": serialize_user(user),
    }
