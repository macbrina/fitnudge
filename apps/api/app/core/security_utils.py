"""
Security Utilities
Helper functions for security operations
"""

import hashlib
import secrets
import re
import ipaddress
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import geoip2.database
import user_agents
from app.core.config import settings
from app.core.database import get_supabase_client


class SecurityUtils:
    """Utility functions for security operations"""

    @staticmethod
    def hash_email(email: str) -> str:
        """Hash email for privacy in logs"""
        return hashlib.sha256(email.lower().encode()).hexdigest()

    @staticmethod
    def generate_secure_token(length: int = 32) -> str:
        """Generate a cryptographically secure random token"""
        return secrets.token_urlsafe(length)

    @staticmethod
    def is_valid_ip(ip: str) -> bool:
        """Check if IP address is valid"""
        try:
            ipaddress.ip_address(ip)
            return True
        except ValueError:
            return False

    @staticmethod
    def is_private_ip(ip: str) -> bool:
        """Check if IP is private/internal"""
        try:
            ip_obj = ipaddress.ip_address(ip)
            return ip_obj.is_private
        except ValueError:
            return False

    @staticmethod
    def get_country_from_ip(ip: str) -> Optional[str]:
        """Get country code from IP address using GeoIP2"""
        try:
            # This would require a GeoIP2 database file
            # For now, return None
            return None
        except Exception:
            return None

    @staticmethod
    def is_suspicious_user_agent(user_agent: str) -> bool:
        """Check if user agent is suspicious"""
        if not user_agent:
            return True

        # Parse user agent
        ua = user_agents.parse(user_agent)

        # Check for suspicious patterns
        suspicious_patterns = [
            "bot",
            "crawler",
            "spider",
            "scraper",
            "curl",
            "wget",
            "python-requests",
            "sqlmap",
            "nikto",
            "nmap",
        ]

        user_agent_lower = user_agent.lower()
        for pattern in suspicious_patterns:
            if pattern in user_agent_lower:
                return True

        # Check if it's a real browser
        if not ua.browser.family or ua.browser.family == "Other":
            return True

        return False

    @staticmethod
    def sanitize_input(text: str) -> str:
        """Sanitize user input to prevent XSS"""
        if not text:
            return ""

        # Remove potentially dangerous characters
        dangerous_chars = ["<", ">", '"', "'", "&", ";", "(", ")", "`"]
        for char in dangerous_chars:
            text = text.replace(char, "")

        # Limit length
        return text[:1000]

    @staticmethod
    def validate_password_strength(password: str) -> Dict[str, Any]:
        """Validate password strength"""
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
            "12345678",
            "1234567890",
            "qwerty123",
            "password1",
        ]

        if password.lower() in common_passwords:
            issues.append("Password is too common")
            score = 0

        # Consecutive character check
        if SecurityUtils._has_consecutive_chars(password, 4):
            issues.append("Password contains too many consecutive characters")
            score = max(0, score - 1)

        return {
            "is_valid": len(issues) == 0,
            "score": score,
            "max_score": 5,
            "issues": issues,
        }

    @staticmethod
    def _has_consecutive_chars(text: str, max_consecutive: int) -> bool:
        """Check if text has too many consecutive characters"""
        if len(text) < max_consecutive:
            return False

        for i in range(len(text) - max_consecutive + 1):
            substring = text[i : i + max_consecutive]
            if len(set(substring)) == 1:  # All characters are the same
                return True

        return False

    @staticmethod
    def generate_csrf_token() -> str:
        """Generate CSRF token"""
        return secrets.token_urlsafe(32)

    @staticmethod
    def verify_csrf_token(token: str, session_token: str) -> bool:
        """Verify CSRF token"""
        # In a real implementation, you'd store and verify against session
        return len(token) == 43 and token.isalnum()  # Basic validation

    @staticmethod
    def is_rate_limited(identifier: str, limit: int, window_seconds: int) -> bool:
        """Check if identifier is rate limited"""
        # This would integrate with Redis
        # For now, return False
        return False

    @staticmethod
    def record_security_event(
        user_id: Optional[str],
        event_type: str,
        event_data: Dict[str, Any],
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ):
        """Record security event in database"""
        try:
            supabase = get_supabase_client()
            supabase.table("security_events").insert(
                {
                    "user_id": user_id,
                    "event_type": event_type,
                    "event_data": event_data,
                    "ip_address": ip_address,
                    "user_agent": user_agent,
                    "created_at": datetime.utcnow().isoformat(),
                }
            ).execute()
        except Exception:
            # Log error but don't fail the request
            pass

    @staticmethod
    def get_client_ip(request) -> str:
        """Get client IP address from request"""
        # Check for forwarded headers
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        # Fallback to direct connection
        return request.client.host

    @staticmethod
    def is_development_environment() -> bool:
        """Check if running in development environment"""
        return settings.ENVIRONMENT == "development"

    @staticmethod
    def should_log_sensitive_data() -> bool:
        """Check if sensitive data should be logged"""
        return settings.ENVIRONMENT == "development"

    @staticmethod
    def mask_sensitive_data(data: str, visible_chars: int = 4) -> str:
        """Mask sensitive data for logging"""
        if not data or len(data) <= visible_chars:
            return "*" * len(data) if data else ""

        return data[:visible_chars] + "*" * (len(data) - visible_chars)

    @staticmethod
    def validate_file_extension(filename: str, allowed_extensions: List[str]) -> bool:
        """Validate file extension"""
        if not filename:
            return False

        extension = filename.lower().split(".")[-1] if "." in filename else ""
        return f".{extension}" in [ext.lower() for ext in allowed_extensions]

    @staticmethod
    def is_safe_filename(filename: str) -> bool:
        """Check if filename is safe (no path traversal)"""
        if not filename:
            return False

        # Check for path traversal attempts
        dangerous_patterns = ["../", "..\\", "/", "\\", "..", "~"]
        for pattern in dangerous_patterns:
            if pattern in filename:
                return False

        # Check for null bytes
        if "\x00" in filename:
            return False

        return True
