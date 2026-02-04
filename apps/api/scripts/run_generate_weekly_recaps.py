"""
Run the generate_weekly_recaps Celery task directly (synchronously).

Use this to debug the weekly recap generation without waiting for Celery Beat.

Usage:
    cd apps/api
    poetry run python scripts/run_generate_weekly_recaps.py

The task will:
1. Check if today is Monday (skips if not)
2. Get all users with active goals
3. Filter to premium users (weekly_recap feature)
4. Generate recaps for the PREVIOUS week (Mon-Sun that just ended)
5. Send push notifications (with deduplication)
"""

import os
import sys

# Ensure app is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load env before importing app modules
from dotenv import load_dotenv

load_dotenv()

from app.services.tasks.analytics_tasks import generate_weekly_recaps_task


def main():
    print("\n" + "=" * 60)
    print("Running generate_weekly_recaps task directly (sync)")
    print("=" * 60 + "\n")

    # .apply() runs the task synchronously in the current process (no worker needed)
    result = generate_weekly_recaps_task.apply()

    print("\n" + "=" * 60)
    print("Result:")
    print(result)
    print("=" * 60 + "\n")

    return 0 if result.get("success") else 1


if __name__ == "__main__":
    sys.exit(main())
