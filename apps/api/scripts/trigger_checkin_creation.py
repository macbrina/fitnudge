#!/usr/bin/env python3
"""
Script to manually trigger the auto_create_daily_checkins task.
Useful for testing the habit chain display.

Usage:
    cd apps/api
    python scripts/trigger_checkin_creation.py
"""

import sys
import os

# Add the parent directory to the path so we can import from app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Force fresh Supabase client to avoid SSL session issues
os.environ["SUPABASE_FRESH_CLIENT"] = "true"

from app.services.tasks import auto_create_daily_checkins_task

if __name__ == "__main__":
    print("🚀 Triggering auto_create_daily_checkins task...")
    print("-" * 50)

    try:
        # Call the task synchronously (not via Celery queue)
        result = auto_create_daily_checkins_task()
        print("-" * 50)
        print(f"✅ Task completed!")
        print(f"   Result: {result}")
    except Exception as e:
        print("-" * 50)
        print(f"❌ Task failed: {e}")
        print("\n💡 Tip: This might be a transient SSL error. Try running again.")
        print("   If it persists, check your Cloudflare tunnel or VPN connection.")
