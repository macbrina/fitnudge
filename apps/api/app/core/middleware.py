from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response
import time
import redis
import hashlib
import json
import re
from typing import Optional, List
from app.core.config import settings
from app.core.database import get_supabase_client

# Redis client for rate limiting and security
# Lazy initialization to avoid blocking app startup if Redis is unavailable
_redis_client = None


def get_redis_client():
    """Get or create Redis client with error handling"""
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = redis.from_url(settings.REDIS_URL)
            # Test connection
            _redis_client.ping()
        except Exception as e:
            print(f"⚠️ Redis connection failed: {e}. Some features may be unavailable.")

            # Return a dummy client that no-ops for development
            class DummyRedis:
                def get(self, *args, **kwargs):
                    return None

                def setex(self, *args, **kwargs):
                    pass

                def incr(self, *args, **kwargs):
                    return 1

                def delete(self, *args, **kwargs):
                    pass

                def lpush(self, *args, **kwargs):
                    pass

                def ltrim(self, *args, **kwargs):
                    pass

                def exists(self, *args, **kwargs):
                    return 0

                def sadd(self, *args, **kwargs):
                    pass

                def expire(self, *args, **kwargs):
                    pass

                def smembers(self, *args, **kwargs):
                    return set()

                def srem(self, *args, **kwargs):
                    pass

                def ping(self, *args, **kwargs):
                    pass

            _redis_client = DummyRedis()
    return _redis_client


# Convenience function - call get_redis_client() in middleware


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

    SENSITIVE_ENDPOINTS = [
        "/auth/login",
        "/auth/signup",
        "/auth/logout",
        "/users/delete",
        "/users/change-password",
        "/media/upload",
        "/goals",
        "/check-ins",
    ]

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
        if any(endpoint in request.url.path for endpoint in self.SENSITIVE_ENDPOINTS):
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
        if any(endpoint in request.url.path for endpoint in self.SENSITIVE_ENDPOINTS):
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
        r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)",
        r"(\b(OR|AND)\s+\d+\s*=\s*\d+)",
        r"(--|#|\/\*|\*\/)",
        r"(\b(UNION|UNION ALL)\b)",
        r"(\b(SCRIPT|JAVASCRIPT|VBSCRIPT)\b)",
        r"(\b(WAITFOR|DELAY|SLEEP)\b)",
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
                    # Check raw body for SQL injection
                    if self._contains_sql_injection(body.decode()):
                        raise HTTPException(
                            status_code=400,
                            detail="Invalid characters detected in request body",
                        )

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
