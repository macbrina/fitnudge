"""
Create or ensure admin user exists.

Run on Admin API startup when ADMIN_EMAIL and ADMIN_PASSWORD are set.
Creates an admin user in auth.users + public.users if one doesn't exist.
Idempotent: safe to run on every startup.
"""

from typing import Optional

from app.core.config import settings
from app.core.database import get_supabase_client
from app.core.admin_auth import get_password_hash


def ensure_admin_user() -> Optional[str]:
    """
    Ensure an admin user exists. Creates one if ADMIN_EMAIL and ADMIN_PASSWORD are set.

    Returns:
        Admin user ID if created or already existed, None if skipped (env not set).
    """
    email = (settings.ADMIN_EMAIL or "").strip().lower()
    password = settings.ADMIN_PASSWORD or ""

    if not email or not password:
        return None

    supabase = get_supabase_client()

    # Check if admin with this email already exists
    existing = (
        supabase.table("users")
        .select("id, role")
        .eq("email", email)
        .maybe_single()
        .execute()
    )

    data = getattr(existing, "data", None) if existing is not None else None
    if data and isinstance(data, dict):
        user = data
        if user.get("role") == "admin":
            return user["id"]
        # User exists but not admin - upgrade to admin
        supabase.table("users").update({"role": "admin"}).eq("id", user["id"]).execute()
        return user["id"]

    # Create new admin user
    return _create_admin_user(supabase, email, password)


def _create_admin_user(supabase, email: str, password: str) -> str:
    """Create admin user in auth.users and public.users."""
    auth_user_id = None

    # 1. Create in auth.users (required: public.users.id references auth.users)
    try:
        auth_response = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"name": "Admin", "auth_provider": "email"},
        })
        if auth_response and auth_response.user:
            auth_user_id = str(auth_response.user.id)
    except Exception as e:
        err = str(e).lower()
        if "already" in err or "exists" in err or "duplicate" in err:
            # Find existing auth user by email
            try:
                users = supabase.auth.admin.list_users()
                for u in users:
                    if getattr(u, "email", None) == email:
                        auth_user_id = str(u.id)
                        break
            except Exception:
                pass
        if not auth_user_id:
            raise RuntimeError(f"Failed to create auth user for {email}: {e}") from e

    # 2. Generate unique username (users.username is UNIQUE)
    base_username = f"admin_{email.split('@')[0]}"
    username = base_username
    suffix = 0
    while True:
        check = supabase.table("users").select("id").eq("username", username).execute()
        if check is None or not getattr(check, "data", None):
            break
        suffix += 1
        username = f"{base_username}_{suffix}"

    # 3. Insert into public.users
    from datetime import datetime, timezone

    user_data = {
        "id": auth_user_id,
        "email": email,
        "password_hash": get_password_hash(password),
        "auth_provider": "email",
        "email_verified": True,
        "username": username,
        "name": "Admin",
        "status": "active",
        "role": "admin",
        "plan": "premium",
        "onboarding_completed_at": datetime.now(timezone.utc).isoformat(),
    }

    supabase.table("users").insert(user_data).execute()

    return auth_user_id
