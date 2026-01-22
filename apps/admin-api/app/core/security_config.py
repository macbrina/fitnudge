"""
Admin API Security Configuration
Stricter settings than public API since admin has elevated privileges
"""

from typing import List, Dict, Any
from app.core.config import settings


class AdminSecurityConfig:
    """Admin-specific security configuration - stricter than public API"""

    # Rate Limiting - Stricter for admin
    RATE_LIMITS = {
        "auth": {
            "login": {"calls": 3, "period": 300},  # 3 attempts per 5 minutes
            "logout": {"calls": 10, "period": 60},
        },
        "api": {
            "default": {"calls": 60, "period": 60},  # 60 requests per minute
            "users": {"calls": 30, "period": 60},  # 30 user operations per minute
            "subscriptions": {"calls": 20, "period": 60},
            "tasks": {"calls": 60, "period": 60},
            "analytics": {"calls": 20, "period": 60},
        },
    }

    # Account Lockout - Stricter for admin
    ACCOUNT_LOCKOUT = {
        "max_failed_attempts": 3,  # Lock after 3 failed attempts (vs 5 for users)
        "lockout_duration_minutes": 60,  # 1 hour lockout (vs 30 min for users)
        "reset_attempts_after_hours": 24,
    }

    # Session Management - Shorter sessions for admin
    SESSION_MANAGEMENT = {
        "max_concurrent_sessions": 1,  # Only 1 active admin session
        "session_timeout_minutes": 60,  # 1 hour timeout (vs 24 hours for users)
        "require_reauth_for_sensitive": True,  # Re-authenticate for dangerous ops
    }

    # IP Security - Stricter for admin
    IP_SECURITY = {
        "enable_whitelist": True,  # Always enabled for admin
        "allowed_ips": [],  # Configure via ADMIN_ALLOWED_IPS env var
        "enable_geo_blocking": True,
        "allowed_countries": ["US", "CA", "GB", "AU"],  # Adjust as needed
        "max_requests_per_ip_per_minute": 100,
    }

    # Security Headers - Same as public API
    SECURITY_HEADERS = {
        "x_content_type_options": "nosniff",
        "x_frame_options": "DENY",
        "x_xss_protection": "1; mode=block",
        "referrer_policy": "strict-origin-when-cross-origin",
        "permissions_policy": "geolocation=(), microphone=(), camera=()",
        "strict_transport_security": "max-age=31536000; includeSubDomains; preload",
        "content_security_policy": (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self'; "
            "img-src 'self' data: https:; "
            "font-src 'self'; "
            "connect-src 'self'; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        ),
    }

    # Audit Logging - Log EVERYTHING for admin
    AUDIT_LOGGING = {
        "enabled": True,
        "log_all_requests": True,  # Log every admin request
        "sensitive_endpoints": [
            "/api/auth/login",
            "/api/auth/logout",
            "/api/users",
            "/api/subscriptions",
            "/api/tasks/revoke",
            "/api/tasks/purge",
        ],
        "retention_days": 365,  # Keep admin logs for 1 year
        "log_user_agents": True,
        "log_ip_addresses": True,
        "log_request_body": True,  # Log request bodies for audit trail
    }

    # JWT Security - Shorter expiry for admin
    JWT_SECURITY = {
        "access_token_expire_minutes": 60,  # 1 hour
        "algorithm": "HS256",
        "require_fresh_token_for_sensitive": True,
    }

    # Dangerous Operations requiring extra confirmation
    DANGEROUS_OPERATIONS = [
        "POST /api/tasks/purge",  # Purge task queue
        "POST /api/users/{id}/delete",  # Delete user
        "POST /api/subscriptions/{id}/cancel",  # Cancel subscription
        "PATCH /api/users/{id}",  # When changing role
    ]

    @classmethod
    def get_config_for_environment(cls, environment: str) -> Dict[str, Any]:
        """Get security config adjusted for environment"""
        config = {
            "rate_limits": cls.RATE_LIMITS,
            "account_lockout": cls.ACCOUNT_LOCKOUT,
            "session_management": cls.SESSION_MANAGEMENT,
            "ip_security": cls.IP_SECURITY,
            "security_headers": cls.SECURITY_HEADERS,
            "audit_logging": cls.AUDIT_LOGGING,
            "jwt_security": cls.JWT_SECURITY,
            "dangerous_operations": cls.DANGEROUS_OPERATIONS,
        }

        if environment == "development":
            # Relaxed for local development
            config["rate_limits"]["api"]["default"]["calls"] = 1000
            config["account_lockout"]["max_failed_attempts"] = 10
            config["ip_security"]["enable_whitelist"] = False
            config["ip_security"]["enable_geo_blocking"] = False
            config["session_management"]["session_timeout_minutes"] = 480  # 8 hours
            config["audit_logging"]["retention_days"] = 7

        elif environment == "production":
            # Maximum security for production
            config["rate_limits"]["api"]["default"]["calls"] = 30
            config["ip_security"]["enable_whitelist"] = True
            config["session_management"]["max_concurrent_sessions"] = 1
            config["audit_logging"]["retention_days"] = 730  # 2 years

        return config


# Global admin security config instance
admin_security_config = AdminSecurityConfig.get_config_for_environment(
    settings.ENVIRONMENT
)
