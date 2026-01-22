"""
Security Configuration
Centralized security settings and policies
"""

from typing import List, Dict, Any
from app.core.config import settings


class SecurityConfig:
    """Security configuration and policies"""

    # Rate Limiting Configuration
    RATE_LIMITS = {
        "auth": {
            "login": {"calls": 5, "period": 300},  # 5 attempts per 5 minutes
            "signup": {"calls": 3, "period": 300},  # 3 attempts per 5 minutes
            "forgot_password": {"calls": 3, "period": 3600},  # 3 attempts per hour
            "reset_password": {"calls": 3, "period": 3600},  # 3 attempts per hour
        },
        "api": {
            "default": {"calls": 100, "period": 60},  # 100 requests per minute
            "media_upload": {"calls": 10, "period": 60},  # 10 uploads per minute
            "goals": {"calls": 50, "period": 60},  # 50 goal operations per minute
            "checkins": {"calls": 100, "period": 60},  # 100 check-ins per minute
        },
    }

    # Account Lockout Configuration
    ACCOUNT_LOCKOUT = {
        "max_failed_attempts": 5,
        "lockout_duration_minutes": 30,
        "reset_attempts_after_hours": 24,
    }

    # Password Policy
    PASSWORD_POLICY = {
        "min_length": 8,
        "max_length": 128,
        "require_uppercase": True,
        "require_lowercase": True,
        "require_numbers": True,
        "require_special_chars": True,
        "forbidden_common_passwords": True,
        "max_consecutive_chars": 3,
    }

    # Session Management
    SESSION_MANAGEMENT = {
        "max_concurrent_sessions": 3,
        "session_timeout_minutes": 1440,  # 24 hours
        "refresh_token_rotation": True,
        "logout_all_devices_on_password_change": True,
    }

    # File Upload Security
    FILE_UPLOAD = {
        "max_file_size_mb": 10,
        "allowed_image_types": ["image/jpeg", "image/png", "image/gif", "image/webp"],
        "allowed_video_types": ["video/mp4", "video/quicktime", "video/x-msvideo"],
        "allowed_audio_types": ["audio/mpeg", "audio/wav", "audio/mp4", "audio/aac"],
        "max_image_dimensions": {"width": 4096, "height": 4096},
        "scan_for_malware": True,
        "validate_file_signatures": True,
    }

    # IP Security
    IP_SECURITY = {
        "enable_whitelist": False,  # Set to True in production
        "allowed_ips": [],  # Add specific IPs if whitelist enabled
        "blocked_countries": [],  # Add country codes to block
        "enable_geo_blocking": False,
        "max_requests_per_ip_per_minute": 1000,
    }

    # SQL Injection Protection
    SQL_INJECTION_PROTECTION = {
        "enabled": True,
        "blocked_patterns": [
            r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)",
            r"(\b(OR|AND)\s+\d+\s*=\s*\d+)",
            r"(--|#|\/\*|\*\/)",
            r"(\b(UNION|UNION ALL)\b)",
            r"(\b(SCRIPT|JAVASCRIPT|VBSCRIPT)\b)",
            r"(\b(WAITFOR|DELAY|SLEEP)\b)",
        ],
        "max_query_length": 10000,
    }

    # Security Headers
    SECURITY_HEADERS = {
        "x_content_type_options": "nosniff",
        "x_frame_options": "DENY",
        "x_xss_protection": "1; mode=block",
        "referrer_policy": "strict-origin-when-cross-origin",
        "permissions_policy": "geolocation=(), microphone=(), camera=()",
        "strict_transport_security": "max-age=31536000; includeSubDomains; preload",
        "content_security_policy": (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self' https:; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        ),
    }

    # Audit Logging
    AUDIT_LOGGING = {
        "enabled": True,
        "sensitive_endpoints": [
            # Authentication & Account Security
            "/auth/login",
            "/auth/signup",
            "/auth/logout",
            "/auth/set-password",
            "/auth/forgot-password",
            "/auth/reset-password",
            "/auth/verify-email",
            "/auth/link",  # Account linking (Google/Apple)
            "/auth/unlink",  # Account unlinking
            "/auth/oauth",  # OAuth flows
            # User Account Management
            "/users/delete",
            "/users/change-password",
            "/users/profile",  # Profile updates
            "/users/notification-settings",
            "/users/export",  # Data export (GDPR)
            # Subscription & Payments
            "/subscriptions",
            "/subscription-plans",
            "/webhooks",  # Payment webhooks
            # Content & Media
            "/media/upload",
            "/media/delete",
            # Core User Data (health/fitness - privacy sensitive)
            "/goals",
            "/check-ins",
            # AI Features (personal data)
            "/ai-coach",
            "/daily-motivations",
            "/recaps",
            # Social Features
            "/partners",  # Accountability partnerships
            "/nudges",
            # Gamification
            "/achievements",
            # Notifications & Setup
            "/notifications",
            "/onboarding",
            # Data Export (GDPR)
            "/data-export",
            # Analytics (personal stats)
            "/analytics",
        ],
        "retention_days": 90,
        "log_user_agents": True,
        "log_ip_addresses": True,
    }

    # API Key Security
    API_KEY_SECURITY = {
        "key_length": 32,
        "secret_length": 32,
        "expiration_days": 365,
        "rotation_required": False,
        "max_keys_per_user": 5,
        "permissions": ["read", "write", "admin"],
    }

    # JWT Security
    JWT_SECURITY = {
        "access_token_expire_minutes": 60,
        "refresh_token_expire_days": 30,
        "algorithm": "HS256",
        "require_rotation": True,
        "max_token_family_size": 5,
    }

    # Environment-specific overrides
    @classmethod
    def get_config_for_environment(cls, environment: str) -> Dict[str, Any]:
        """Get security config adjusted for environment"""
        config = {
            "rate_limits": cls.RATE_LIMITS,
            "account_lockout": cls.ACCOUNT_LOCKOUT,
            "password_policy": cls.PASSWORD_POLICY,
            "session_management": cls.SESSION_MANAGEMENT,
            "file_upload": cls.FILE_UPLOAD,
            "ip_security": cls.IP_SECURITY,
            "sql_injection_protection": cls.SQL_INJECTION_PROTECTION,
            "security_headers": cls.SECURITY_HEADERS,
            "audit_logging": cls.AUDIT_LOGGING,
            "api_key_security": cls.API_KEY_SECURITY,
            "jwt_security": cls.JWT_SECURITY,
        }

        if environment == "development":
            # Relaxed settings for development
            config["rate_limits"]["api"]["default"]["calls"] = 1000
            config["account_lockout"]["max_failed_attempts"] = 10
            config["file_upload"]["max_file_size_mb"] = 50
            config["audit_logging"]["retention_days"] = 7

        elif environment == "production":
            # Stricter settings for production
            config["rate_limits"]["api"]["default"]["calls"] = 50
            config["ip_security"]["enable_whitelist"] = True
            config["session_management"]["max_concurrent_sessions"] = 2
            config["audit_logging"]["retention_days"] = 365

        return config


# Global security config instance
security_config = SecurityConfig.get_config_for_environment(settings.ENVIRONMENT)
