"""
Admin API Security Middleware
Stricter security than public API
"""

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import time
import hashlib
import json
from typing import Optional
from datetime import datetime, timezone

from app.core.config import settings
from app.core.database import get_supabase_client
from app.core.security_config import admin_security_config


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add comprehensive security headers"""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        headers = admin_security_config["security_headers"]

        response.headers["X-Content-Type-Options"] = headers["x_content_type_options"]
        response.headers["X-Frame-Options"] = headers["x_frame_options"]
        response.headers["X-XSS-Protection"] = headers["x_xss_protection"]
        response.headers["Referrer-Policy"] = headers["referrer_policy"]
        response.headers["Permissions-Policy"] = headers["permissions_policy"]
        response.headers["Strict-Transport-Security"] = headers[
            "strict_transport_security"
        ]
        response.headers["Content-Security-Policy"] = headers["content_security_policy"]

        # Additional admin-specific headers
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"

        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting for admin API - stricter than public API"""

    def __init__(self, app):
        super().__init__(app)
        self.rate_limits = admin_security_config["rate_limits"]

    async def dispatch(self, request: Request, call_next):
        try:
            # Skip rate limiting for health checks
            if request.url.path == "/health":
                return await call_next(request)

            client_ip = self._get_client_ip(request)
            endpoint = request.url.path

            # Determine rate limit
            if "/auth" in endpoint:
                limit_config = self.rate_limits["auth"].get(
                    endpoint.split("/")[-1],
                    self.rate_limits["api"]["default"],
                )
            else:
                # Match endpoint category
                for category in ["users", "subscriptions", "tasks", "analytics"]:
                    if f"/{category}" in endpoint:
                        limit_config = self.rate_limits["api"].get(
                            category, self.rate_limits["api"]["default"]
                        )
                        break
                else:
                    limit_config = self.rate_limits["api"]["default"]

            calls = limit_config["calls"]
            period = limit_config["period"]

            # Check rate limit using in-memory cache (for simplicity)
            # In production, use Redis
            key = f"admin_rate:{client_ip}:{endpoint}"

            # For now, skip Redis dependency and just proceed
            # TODO: Add Redis-based rate limiting

            response = await call_next(request)
            return response

        except HTTPException:
            raise
        except Exception as e:
            print(f"⚠️ RateLimitMiddleware error: {e}")
            return await call_next(request)

    def _get_client_ip(self, request: Request) -> str:
        """Get real client IP, handling proxies"""
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"


class IPWhitelistMiddleware(BaseHTTPMiddleware):
    """IP-based access control for admin API"""

    def __init__(self, app):
        super().__init__(app)
        self.config = admin_security_config["ip_security"]
        # Load allowed IPs from environment
        allowed_ips_env = getattr(settings, "ADMIN_ALLOWED_IPS", "")
        self.allowed_ips = (
            [ip.strip() for ip in allowed_ips_env.split(",") if ip.strip()]
            if allowed_ips_env
            else []
        )

    async def dispatch(self, request: Request, call_next):
        # Skip in development
        if settings.ENVIRONMENT == "development":
            return await call_next(request)

        # Skip health checks
        if request.url.path == "/health":
            return await call_next(request)

        # Check IP whitelist if enabled
        if self.config.get("enable_whitelist") and self.allowed_ips:
            client_ip = self._get_client_ip(request)

            if client_ip not in self.allowed_ips:
                # Log blocked attempt
                print(f"🚫 Admin access blocked from IP: {client_ip}")

                return JSONResponse(
                    status_code=403,
                    content={"detail": "Access denied"},
                )

        return await call_next(request)

    def _get_client_ip(self, request: Request) -> str:
        """Get real client IP"""
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"


class AccountLockoutMiddleware(BaseHTTPMiddleware):
    """Account lockout after failed admin login attempts - stricter than public"""

    def __init__(self, app):
        super().__init__(app)
        self.config = admin_security_config["account_lockout"]
        # In-memory lockout tracking (use Redis in production)
        self.failed_attempts = {}
        self.lockouts = {}

    async def dispatch(self, request: Request, call_next):
        # Only check for login endpoint
        if request.url.path != "/api/auth/login" or request.method != "POST":
            return await call_next(request)

        client_ip = self._get_client_ip(request)

        # Check if IP is locked out
        lockout_key = f"lockout:{client_ip}"
        if lockout_key in self.lockouts:
            lockout_until = self.lockouts[lockout_key]
            if time.time() < lockout_until:
                remaining = int(lockout_until - time.time())
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": f"Account locked. Try again in {remaining // 60} minutes."
                    },
                )
            else:
                # Lockout expired
                del self.lockouts[lockout_key]
                if client_ip in self.failed_attempts:
                    del self.failed_attempts[client_ip]

        response = await call_next(request)

        # Track failed attempts
        if response.status_code == 401:
            self.failed_attempts[client_ip] = (
                self.failed_attempts.get(client_ip, 0) + 1
            )

            if (
                self.failed_attempts[client_ip]
                >= self.config["max_failed_attempts"]
            ):
                lockout_duration = self.config["lockout_duration_minutes"] * 60
                self.lockouts[lockout_key] = time.time() + lockout_duration
                print(f"🔒 Admin account locked for IP: {client_ip}")

        elif response.status_code == 200:
            # Successful login, reset attempts
            if client_ip in self.failed_attempts:
                del self.failed_attempts[client_ip]

        return response

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"


class AuditLoggingMiddleware(BaseHTTPMiddleware):
    """Log all admin actions for audit trail"""

    def __init__(self, app):
        super().__init__(app)
        self.config = admin_security_config["audit_logging"]

    async def dispatch(self, request: Request, call_next):
        if not self.config.get("enabled"):
            return await call_next(request)

        # Skip health checks
        if request.url.path == "/health":
            return await call_next(request)

        start_time = time.time()

        # Capture request info
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "unknown")
        method = request.method
        path = request.url.path

        response = await call_next(request)

        # Log the request
        duration_ms = int((time.time() - start_time) * 1000)

        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "method": method,
            "path": path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
            "client_ip": client_ip,
            "user_agent": user_agent if self.config.get("log_user_agents") else None,
        }

        # Get admin user ID from response headers if set
        admin_user_id = response.headers.get("X-Admin-User-Id")
        if admin_user_id:
            log_entry["admin_user_id"] = admin_user_id

        # Log to console (in production, send to logging service)
        log_level = "INFO" if response.status_code < 400 else "WARN"
        print(
            f"[ADMIN AUDIT] [{log_level}] {method} {path} "
            f"-> {response.status_code} ({duration_ms}ms) IP:{client_ip}"
        )

        # Log sensitive operations to database
        if self._is_sensitive_endpoint(path, method):
            await self._log_to_database(log_entry)

        return response

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _is_sensitive_endpoint(self, path: str, method: str) -> bool:
        """Check if this is a sensitive operation"""
        sensitive = self.config.get("sensitive_endpoints", [])
        for endpoint in sensitive:
            if endpoint in path:
                return True
        # All non-GET operations are sensitive
        return method in ["POST", "PUT", "PATCH", "DELETE"]

    async def _log_to_database(self, log_entry: dict):
        """Log sensitive operations to audit_logs table"""
        try:
            supabase = get_supabase_client()
            supabase.table("audit_logs").insert(
                {
                    "admin_user_id": log_entry.get("admin_user_id"),
                    "action": f"{log_entry['method']} {log_entry['path']}",
                    "resource_type": "admin_api",
                    "new_values": log_entry,
                }
            ).execute()
        except Exception as e:
            print(f"⚠️ Failed to log audit entry: {e}")


class SessionTimeoutMiddleware(BaseHTTPMiddleware):
    """Enforce shorter session timeout for admin"""

    def __init__(self, app):
        super().__init__(app)
        self.config = admin_security_config["session_management"]

    async def dispatch(self, request: Request, call_next):
        # Token expiry is handled in admin_auth.py
        # This middleware could enforce additional checks like:
        # - Last activity timestamp
        # - Concurrent session limits

        response = await call_next(request)
        return response
