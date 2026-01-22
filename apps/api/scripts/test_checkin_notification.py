"""
Manual test script for check-in notifications.

Usage:
    cd apps/api
    poetry run python scripts/test_checkin_notification.py

This will send a check-in prompt notification to all active goals.
"""

from app.core.database import get_supabase_client
from app.services.expo_push_service import send_push_to_user_sync


def main():
    supabase = get_supabase_client()

    # Get all active goals with user info
    goals = (
        supabase.table("goals")
        .select(
            "id, user_id, title, reminder_times, current_streak, users!inner(name, timezone)"
        )
        .eq("status", "active")
        .execute()
    )

    print(f"\n📋 Found {len(goals.data)} active goals:\n")

    for goal in goals.data:
        user_id = goal["user_id"]
        goal_id = goal["id"]
        goal_title = goal["title"]
        user_name = goal.get("users", {}).get("name", "Champion")
        current_streak = goal.get("current_streak", 0)

        print(f"  • {goal_title}")
        print(f"    User: {user_name}")
        print(f"    Streak: {current_streak} days")

        # Build check-in prompt message
        if current_streak > 0:
            title = f"How did {goal_title} go? 🔥"
            body = f"Hey {user_name}, you're on a {current_streak}-day streak! Did you complete {goal_title} today? Tap to check in."
        else:
            title = f"How did {goal_title} go? ✅"
            body = f"Hey {user_name}, did you complete {goal_title} today? Tap to check in."

        # Send notification
        result = send_push_to_user_sync(
            user_id=user_id,
            title=title,
            body=body,
            data={
                "type": "reminder",
                "subtype": "checkin_prompt",
                "goalId": goal_id,
                "deepLink": f"/(user)/(goals)/details?id={goal_id}&openCheckIn=true",
            },
            notification_type="reminder",
            entity_type="goal",
            entity_id=goal_id,
        )

        if result.get("success") or result.get("delivered", 0) > 0:
            print(f"    ✅ Notification sent!")
        else:
            print(f"    ❌ Failed: {result.get('errors', 'Unknown error')}")

        print()


if __name__ == "__main__":
    main()
