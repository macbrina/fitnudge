#!/usr/bin/env python3
"""
Sync existing users from public.users to auth.users for Supabase Realtime RLS.

This script creates auth.users entries for users that only exist in public.users.
This is needed because auth.uid() in RLS policies requires users to exist in auth.users.

Usage:
    cd apps/api
    python scripts/sync_users_to_auth.py
"""

import os
import sys
import secrets

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
env_path = Path(__file__).resolve().parent.parent / ".env.local"
load_dotenv(env_path)

from supabase import create_client


def sync_users():
    """Sync all public.users to auth.users"""

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

    if not supabase_url or not supabase_key:
        print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
        return

    supabase = create_client(supabase_url, supabase_key)

    # Get all users from public.users
    print("📋 Fetching users from public.users...")
    result = supabase.table("users").select("id, email, name, auth_provider").execute()

    if not result.data:
        print("No users found in public.users")
        return

    users = result.data
    print(f"Found {len(users)} users in public.users")

    # Get existing auth.users
    print("\n📋 Fetching existing auth.users...")
    try:
        auth_users = supabase.auth.admin.list_users()
        existing_auth_ids = {str(u.id) for u in auth_users}
        existing_auth_emails = {u.email for u in auth_users}
        print(f"Found {len(existing_auth_ids)} users in auth.users")
    except Exception as e:
        print(f"❌ Failed to list auth.users: {e}")
        existing_auth_ids = set()
        existing_auth_emails = set()

    # Sync each user
    synced = 0
    skipped = 0
    failed = 0

    print("\n🔄 Syncing users...")
    for user in users:
        user_id = user["id"]
        email = user.get("email")
        name = user.get("name", "")
        auth_provider = user.get("auth_provider", "email")

        if not email:
            print(f"  ⏭️  Skipping user {user_id}: no email")
            skipped += 1
            continue

        # Check if already exists by ID or email
        if user_id in existing_auth_ids:
            print(f"  ✅ User {email} already exists in auth.users (same ID)")
            skipped += 1
            continue

        if email in existing_auth_emails:
            print(
                f"  ⚠️  User {email} exists in auth.users but with DIFFERENT ID - manual fix needed"
            )
            skipped += 1
            continue

        # Create in auth.users with same ID
        try:
            auth_response = supabase.auth.admin.create_user(
                {
                    "id": user_id,  # Use same ID as public.users
                    "email": email,
                    "email_confirm": True,
                    "password": secrets.token_urlsafe(32),  # Random password (not used)
                    "user_metadata": {
                        "name": name,
                        "auth_provider": auth_provider,
                        "synced_from_public_users": True,
                    },
                }
            )

            if auth_response and auth_response.user:
                print(f"  ✅ Created auth.users entry for {email} (ID: {user_id})")
                synced += 1
            else:
                print(f"  ❌ No response for {email}")
                failed += 1

        except Exception as e:
            error_str = str(e).lower()
            if (
                "already" in error_str
                or "exists" in error_str
                or "duplicate" in error_str
            ):
                print(f"  ⏭️  User {email} already exists")
                skipped += 1
            else:
                print(f"  ❌ Failed to create {email}: {e}")
                failed += 1

    print(f"\n📊 Summary:")
    print(f"   Synced: {synced}")
    print(f"   Skipped: {skipped}")
    print(f"   Failed: {failed}")

    if synced > 0:
        print(f"\n✅ {synced} users can now use Realtime with auth.uid()!")


if __name__ == "__main__":
    sync_users()
