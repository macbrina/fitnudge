"""
API Key Authentication System
Provides secure API key generation and validation for mobile apps
"""

import secrets
import hashlib
import time
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import HTTPException, status
from app.core.database import get_supabase_client
from app.core.config import settings


class APIKeyManager:
    """Manages API key generation, validation, and rotation"""

    def __init__(self):
        self.supabase = get_supabase_client()

    def generate_api_key(
        self, user_id: str, app_name: str = "mobile", permissions: list = None
    ) -> Dict[str, Any]:
        """Generate a new API key for a user"""
        if permissions is None:
            permissions = ["read", "write"]

        # Generate secure random key
        key_id = secrets.token_urlsafe(16)
        key_secret = secrets.token_urlsafe(32)
        full_key = f"fn_{key_id}_{key_secret}"

        # Hash the key for storage
        key_hash = hashlib.sha256(full_key.encode()).hexdigest()

        # Create API key record
        api_key_data = {
            "user_id": user_id,
            "key_id": key_id,
            "key_hash": key_hash,
            "app_name": app_name,
            "permissions": permissions,
            "is_active": True,
            "expires_at": (datetime.utcnow() + timedelta(days=365)).isoformat(),
            "last_used_at": None,
            "created_at": datetime.utcnow().isoformat(),
        }

        # Store in database
        result = self.supabase.table("api_keys").insert(api_key_data).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create API key",
            )

        return {
            "api_key": full_key,
            "key_id": key_id,
            "expires_at": api_key_data["expires_at"],
            "permissions": permissions,
            "created_at": api_key_data["created_at"],
        }

    def validate_api_key(self, api_key: str) -> Optional[Dict[str, Any]]:
        """Validate an API key and return user info"""
        if not api_key or not api_key.startswith("fn_"):
            return None

        try:
            # Extract key parts
            parts = api_key.split("_", 2)
            if len(parts) != 3:
                return None

            key_id = parts[1]
            key_secret = parts[2]

            # Hash the provided key
            key_hash = hashlib.sha256(api_key.encode()).hexdigest()

            # Look up in database
            result = (
                self.supabase.table("api_keys")
                .select("*")
                .eq("key_id", key_id)
                .eq("key_hash", key_hash)
                .eq("is_active", True)
                .execute()
            )

            if not result.data:
                return None

            api_key_data = result.data[0]

            # Check expiration
            expires_at = datetime.fromisoformat(api_key_data["expires_at"])
            if datetime.utcnow() > expires_at:
                # Mark as expired
                self.supabase.table("api_keys").update({"is_active": False}).eq(
                    "id", api_key_data["id"]
                ).execute()
                return None

            # Update last used
            self.supabase.table("api_keys").update(
                {"last_used_at": datetime.utcnow().isoformat()}
            ).eq("id", api_key_data["id"]).execute()

            return {
                "user_id": api_key_data["user_id"],
                "key_id": api_key_data["key_id"],
                "permissions": api_key_data["permissions"],
                "app_name": api_key_data["app_name"],
            }

        except Exception:
            return None

    def revoke_api_key(self, key_id: str, user_id: str) -> bool:
        """Revoke an API key"""
        result = (
            self.supabase.table("api_keys")
            .update({"is_active": False})
            .eq("key_id", key_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(result.data)

    def list_user_api_keys(self, user_id: str) -> list:
        """List all API keys for a user"""
        result = (
            self.supabase.table("api_keys")
            .select(
                "key_id, app_name, permissions, is_active, created_at, last_used_at, expires_at"
            )
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return result.data

    def rotate_api_key(self, key_id: str, user_id: str) -> Dict[str, Any]:
        """Rotate an API key (revoke old, create new)"""
        # Revoke old key
        self.revoke_api_key(key_id, user_id)

        # Get old key data
        old_key_result = (
            self.supabase.table("api_keys")
            .select("app_name, permissions")
            .eq("key_id", key_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not old_key_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="API key not found"
            )

        old_key_data = old_key_result.data[0]

        # Generate new key
        return self.generate_api_key(
            user_id=user_id,
            app_name=old_key_data["app_name"],
            permissions=old_key_data["permissions"],
        )


# Global instance
api_key_manager = APIKeyManager()


def get_api_key_user(api_key: str) -> Optional[Dict[str, Any]]:
    """Get user info from API key"""
    return api_key_manager.validate_api_key(api_key)


def require_api_key(required_permissions: list = None):
    """Decorator to require API key authentication"""

    def decorator(func):
        async def wrapper(*args, **kwargs):
            # This would be used in FastAPI dependencies
            # Implementation would depend on how you want to extract the API key
            pass

        return wrapper

    return decorator
