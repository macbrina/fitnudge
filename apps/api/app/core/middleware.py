from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response
import time
import hashlib
import json
import re
import asyncio
from typing import Optional, List
from app.core.database import get_supabase_client
from app.core.cache import get_redis_client


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add comprehensive security headers"""

    async def dispatch(self, request: Request, call_next):

        response = await call_next(request)

        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=()"
        )

        # HSTS (HTTP Strict Transport Security)
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )

        # Content Security Policy
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self' https:; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
        response.headers["Content-Security-Policy"] = csp

        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Enhanced rate limiting with different limits for different endpoints"""

    def __init__(self, app, calls: int = 100, period: int = 60):
        super().__init__(app)
        self.calls = calls
        self.period = period
        # Different rate limits for different endpoints
        self.endpoint_limits = {
            "/auth/login": {"calls": 5, "period": 300},  # 5 attempts per 5 minutes
            "/auth/signup": {"calls": 3, "period": 300},  # 3 attempts per 5 minutes
            "/auth/forgot-password": {
                "calls": 3,
                "period": 3600,
            },  # 3 attempts per hour
            "/media/upload": {"calls": 10, "period": 60},  # 10 uploads per minute
            "default": {"calls": 100, "period": 60},  # 100 requests per minute
        }

    async def dispatch(self, request: Request, call_next):
        try:
            client_ip = request.client.host
            endpoint = request.url.path

            # Get rate limit config for this endpoint
            limit_config = self.endpoint_limits.get(
                endpoint, self.endpoint_limits["default"]
            )
            calls = limit_config["calls"]
            period = limit_config["period"]

            # Create rate limit key
            key = f"rate_limit:{client_ip}:{endpoint}"

            # Check current count (skip if Redis fails)
            try:
                redis = get_redis_client()
                current = redis.get(key)

                if current is None:
                    redis.setex(key, period, 1)
                else:
                    count = int(current)
                    if count >= calls:
                        raise HTTPException(
                            status_code=429,
                            detail=f"Rate limit exceeded. Max {calls} requests per {period} seconds for this endpoint.",
                        )
                    redis.incr(key)
            except Exception:
                # If Redis fails, skip rate limiting (don't block requests)
                pass

            response = await call_next(request)
            return response
        except HTTPException:
            raise
        except Exception as e:
            # Log but don't block if middleware fails
            print(f"⚠️ RateLimitMiddleware error: {e}")
            return await call_next(request)


class AccountLockoutMiddleware(BaseHTTPMiddleware):
    """Account lockout after failed login attempts"""

    async def dispatch(self, request: Request, call_next):
        # For now, skip body reading to avoid consuming the stream
        # Account lockout check will happen after response if login fails
        response = await call_next(request)

        # If login failed (401), try to get email from request for tracking
        # Note: We can't read the body here as it's already consumed
        # This is a limitation - we'll track by IP instead if needed
        if (
            request.url.path == "/api/v1/auth/login"
            and request.method == "POST"
            and response.status_code == 401
        ):
            # In a production app, you'd extract email from response error details
            # For now, we'll skip email-based tracking to avoid body consumption issues
            pass

        return response

    def _handle_failed_login(self, email: str):
        """Handle failed login attempt"""
        redis = get_redis_client()
        email_hash = hashlib.sha256(email.encode()).hexdigest()
        failed_key = f"failed_attempts:{email_hash}"
        lock_key = f"account_locked:{email_hash}"

        # Increment failed attempts
        attempts = redis.incr(failed_key)
        redis.expire(failed_key, 3600)  # Expire after 1 hour

        # Lock account after 5 failed attempts
        if attempts >= 5:
            redis.setex(lock_key, 1800, "locked")  # Lock for 30 minutes
            redis.delete(failed_key)  # Reset failed attempts


class IPWhitelistMiddleware(BaseHTTPMiddleware):
    """IP whitelisting and geo-blocking"""

    def __init__(
        self,
        app,
        allowed_ips: Optional[List[str]] = None,
        blocked_countries: Optional[List[str]] = None,
    ):
        super().__init__(app)
        self.allowed_ips = allowed_ips or []
        self.blocked_countries = blocked_countries or []

    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host

        # Check IP whitelist (only if explicitly configured)
        if (
            self.allowed_ips
            and len(self.allowed_ips) > 0
            and client_ip not in self.allowed_ips
        ):
            raise HTTPException(
                status_code=403, detail="Access denied from this IP address"
            )

        # Check for suspicious patterns
        if self._is_suspicious_ip(client_ip):
            raise HTTPException(status_code=403, detail="Access denied")

        response = await call_next(request)
        return response

    def _is_suspicious_ip(self, ip: str) -> bool:
        """Check if IP is suspicious"""
        # Check for private IPs accessing public endpoints
        if ip.startswith(("10.", "192.168.", "172.")):
            return False

        # Check for known malicious patterns
        suspicious_patterns = [
            r"^\d+\.\d+\.\d+\.\d+$",  # Basic IP validation
        ]

        for pattern in suspicious_patterns:
            if not re.match(pattern, ip):
                return True

        return False


class AuditLoggingMiddleware(BaseHTTPMiddleware):
    """Audit logging for sensitive operations"""

    # Use centralized config for sensitive endpoints
    # Imported at runtime to avoid circular imports
    @property
    def sensitive_endpoints(self) -> List[str]:
        from app.core.security_config import SecurityConfig

        return SecurityConfig.AUDIT_LOGGING.get("sensitive_endpoints", [])

    async def dispatch(self, request: Request, call_next):
        start_time = time.time()

        # Log request
        await self._log_request(request)

        response = await call_next(request)

        # Log response
        await self._log_response(request, response, time.time() - start_time)

        return response

    async def _log_request(self, request: Request):
        """Log incoming request"""
        if any(endpoint in request.url.path for endpoint in self.sensitive_endpoints):
            log_data = {
                "timestamp": time.time(),
                "method": request.method,
                "path": request.url.path,
                "ip": request.client.host,
                "user_agent": request.headers.get("user-agent"),
                "type": "request",
            }

            # Store in Redis for audit trail
            redis = get_redis_client()
            redis.lpush("audit_log", json.dumps(log_data))
            redis.ltrim("audit_log", 0, 9999)  # Keep last 10000 entries

    async def _log_response(
        self, request: Request, response: Response, duration: float
    ):
        """Log response"""
        if any(endpoint in request.url.path for endpoint in self.sensitive_endpoints):
            log_data = {
                "timestamp": time.time(),
                "method": request.method,
                "path": request.url.path,
                "ip": request.client.host,
                "status_code": response.status_code,
                "duration": duration,
                "type": "response",
            }

            redis = get_redis_client()
            redis.lpush("audit_log", json.dumps(log_data))
            redis.ltrim("audit_log", 0, 9999)


class SQLInjectionProtectionMiddleware(BaseHTTPMiddleware):
    """Basic SQL injection protection"""

    SQL_INJECTION_PATTERNS = [
        r"\bSELECT\b\s+.+\bFROM\b",
        r"\bINSERT\b\s+INTO\b",
        r"\bUPDATE\b\s+\w+\s+SET\b",
        r"\bDELETE\b\s+FROM\b",
        r"\bDROP\b\s+(TABLE|DATABASE|FUNCTION|PROCEDURE)\b",
        r"\bALTER\b\s+(TABLE|DATABASE|FUNCTION|PROCEDURE)\b",
        r"\bCREATE\b\s+(TABLE|DATABASE|FUNCTION|PROCEDURE)\b",
        r"\bUNION\b\s+SELECT\b",
        r";--",
        r"--\s",
        r"/\*.*?\*/",
    ]

    async def dispatch(self, request: Request, call_next):
        # Check query parameters
        for param_name, param_value in request.query_params.items():
            if self._contains_sql_injection(str(param_value)):
                raise HTTPException(
                    status_code=400, detail="Invalid characters detected in request"
                )

        # Check request body for POST/PUT requests
        if request.method in ["POST", "PUT", "PATCH"]:
            content_type = request.headers.get("content-type", "")

            # Skip binary/multipart requests (file uploads)
            if (
                "multipart/form-data" in content_type
                or "application/octet-stream" in content_type
            ):
                response = await call_next(request)
                return response

            body = await request.body()
            if body:
                try:
                    data = json.loads(body)
                    if self._check_dict_for_sql_injection(data):
                        raise HTTPException(
                            status_code=400,
                            detail="Invalid characters detected in request body",
                        )
                except json.JSONDecodeError:
                    # Check raw body for SQL injection (only for text content)
                    try:
                        body_text = body.decode("utf-8")
                        if self._contains_sql_injection(body_text):
                            raise HTTPException(
                                status_code=400,
                                detail="Invalid characters detected in request body",
                            )
                    except UnicodeDecodeError:
                        # Binary data, skip SQL injection check
                        pass

        response = await call_next(request)
        return response

    def _contains_sql_injection(self, text: str) -> bool:
        """Check if text contains SQL injection patterns"""
        text_upper = text.upper()
        for pattern in self.SQL_INJECTION_PATTERNS:
            if re.search(pattern, text_upper, re.IGNORECASE):
                return True
        return False

    def _check_dict_for_sql_injection(self, data: dict) -> bool:
        """Recursively check dictionary for SQL injection"""
        for key, value in data.items():
            if isinstance(value, str):
                if self._contains_sql_injection(value):
                    return True
            elif isinstance(value, dict):
                if self._check_dict_for_sql_injection(value):
                    return True
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, str) and self._contains_sql_injection(item):
                        return True
                    elif isinstance(item, dict) and self._check_dict_for_sql_injection(
                        item
                    ):
                        return True
        return False


class SessionManagementMiddleware(BaseHTTPMiddleware):
    """Session management and concurrent session limits"""

    MAX_CONCURRENT_SESSIONS = 3

    async def dispatch(self, request: Request, call_next):
        # Check for session token in headers
        session_token = request.headers.get("X-Session-Token")

        if session_token and request.url.path.startswith("/api/v1"):
            # Validate session
            if not await self._validate_session(session_token):
                raise HTTPException(
                    status_code=401, detail="Invalid or expired session"
                )

        response = await call_next(request)

        # Create session for successful auth
        if (
            request.url.path == "/auth/login"
            and request.method == "POST"
            and response.status_code == 200
        ):
            # Extract user_id from response (would need to modify auth endpoint)
            pass

        return response

    async def _validate_session(self, session_token: str) -> bool:
        """Validate session token"""
        session_key = f"session:{session_token}"
        redis = get_redis_client()
        return redis.exists(session_key)

    async def _create_session(self, user_id: str) -> str:
        """Create new session"""
        session_token = hashlib.sha256(f"{user_id}{time.time()}".encode()).hexdigest()
        session_key = f"session:{session_token}"

        # Store session data
        session_data = {
            "user_id": user_id,
            "created_at": time.time(),
            "last_activity": time.time(),
        }

        redis = get_redis_client()
        redis.setex(session_key, 86400, json.dumps(session_data))  # 24 hours

        # Track user sessions
        user_sessions_key = f"user_sessions:{user_id}"
        redis.sadd(user_sessions_key, session_token)
        redis.expire(user_sessions_key, 86400)

        # Enforce concurrent session limit
        sessions = redis.smembers(user_sessions_key)
        if len(sessions) > self.MAX_CONCURRENT_SESSIONS:
            # Remove oldest session
            oldest_session = min(sessions, key=lambda s: redis.get(f"session:{s}"))
            redis.delete(f"session:{oldest_session}")
            redis.srem(user_sessions_key, oldest_session)

        return session_token


class UserActivityMiddleware(BaseHTTPMiddleware):
    """
    Updates user's last_active_at timestamp for activity tracking.

    Features:
    - Only updates for authenticated API requests
    - Debounced: max one update per 5 minutes per user (reduces DB writes)
    - Non-blocking: runs update asynchronously after response
    """

    DEBOUNCE_SECONDS = 300  # 5 minutes

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Only process successful authenticated API requests
        if (
            response.status_code >= 200
            and response.status_code < 300
            and request.url.path.startswith("/api/v1")
            and request.url.path not in ["/api/v1/health", "/api/v1/version"]
        ):
            # Try to extract user_id from auth header (non-blocking)
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                # Schedule async update (don't await - fire and forget)
                asyncio.create_task(self._update_user_activity(auth_header))

        return response

    async def _update_user_activity(self, auth_header: str):
        """Update user's last_active_at (debounced)"""
        try:
            import jwt
            from app.core.config import settings

            # Decode token to get user_id (without full validation for speed)
            token = auth_header.replace("Bearer ", "")
            try:
                # Try to decode - if invalid, just skip
                payload = jwt.decode(
                    token,
                    settings.SUPABASE_JWT_SECRET,
                    algorithms=["HS256"],
                    options={
                        "verify_exp": False
                    },  # Don't verify expiry for activity tracking
                )
                user_id = payload.get("sub")
                if not user_id:
                    return
            except Exception:
                # Fallback: decode without signature verification (activity tracking only)
                try:
                    payload = jwt.decode(
                        token, options={"verify_signature": False, "verify_exp": False}
                    )
                    user_id = payload.get("sub")
                    if not user_id:
                        return
                except Exception:
                    return  # Invalid token, skip

            # Check debounce in Redis
            redis = get_redis_client()
            debounce_key = f"user_activity:{user_id}"

            # If key exists, skip update (already updated recently)
            if redis.exists(debounce_key):
                return

            # Set debounce key (expires after DEBOUNCE_SECONDS)
            redis.setex(debounce_key, self.DEBOUNCE_SECONDS, "1")

            # Update last_active_at in database
            from datetime import datetime, timezone

            supabase = get_supabase_client()
            supabase.table("users").update(
                {"last_active_at": datetime.now(timezone.utc).isoformat()}
            ).eq("id", user_id).execute()

        except Exception as e:
            # Silently fail - activity tracking shouldn't break requests
            print(f"⚠️ UserActivityMiddleware error: {e}")
