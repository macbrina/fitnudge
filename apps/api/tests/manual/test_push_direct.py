"""
Direct push notification test (bypasses authentication)
Mimics how the real Celery task sends notifications

Run: poetry run python tests/manual/test_push_direct.py
"""

import asyncio
from app.core.database import get_supabase_client
from app.services.expo_push_service import send_push_to_user


async def test_push_notifications():
    """
    Test push notifications the same way the backend task does:
    1. Query device_tokens from database (no user auth)
    2. Send push notification using Expo SDK
    3. Handle errors properly
    """
    print("=" * 60)
    print("🔔 Direct Push Notification Test (No Auth Required)")
    print("=" * 60)
    print()

    # Get Supabase client (uses service key, not user auth)
    supabase = get_supabase_client()

    # Get all active device tokens
    print("1️⃣  Fetching device tokens from database...")
    tokens_result = (
        supabase.table("device_tokens")
        .select("fcm_token, user_id, device_type, last_used_at")
        .eq("is_active", True)
        .execute()
    )

    if not tokens_result.data:
        print("❌ No active device tokens found in database!")
        print("   Make sure mobile app is registered.")
        print("   Check: SELECT * FROM device_tokens;")
        return

    print(f"✅ Found {len(tokens_result.data)} active device token(s)")
    print()

    # Test each user separately using send_push_to_user
    tested_users = set()
    for token_row in tokens_result.data:
        user_id = token_row["user_id"]

        if user_id in tested_users:
            continue  # Skip duplicate users
        tested_users.add(user_id)

        device_type = token_row["device_type"]
        fcm_token = token_row["fcm_token"]

        print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print(f"Testing User: {user_id}")
        print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print(f"Device: {device_type}")
        print(f"Token: {fcm_token[:50]}...")
        print()

        # Send test notification using send_push_to_user (same as real task)
        print("2️⃣  Sending push notification via send_push_to_user()...")
        print("   (This is EXACTLY how the Celery task sends notifications)")
        print()

        try:
            result = await send_push_to_user(
                user_id=user_id,
                title="🧪 Backend Test (Via send_push_to_user)",
                body="If you see this, the backend task will work!",
                data={
                    "type": "test",
                    "deepLink": "/(user)/(tabs)",
                },
                notification_type="achievement",
            )

            print("📊 Result:")
            print(f"   Notification ID: {result['notification_id']}")
            print(f"   Delivered: {result['delivered']}")
            print(f"   Tokens Attempted: {result['tokens_attempted']}")
            print(f"   Successful: {len(result['successful_tokens'])}")
            print(f"   Invalid: {len(result['invalid_tokens'])}")

            if result.get("receipt_ids"):
                print(f"   Receipt IDs: {len(result['receipt_ids'])}")
            print()

            if result["delivered"]:
                print("✅ Push ticket validated successfully!")
                print()
                print("🎉 SUCCESS! Check your phone - notification should appear!")
                print("   (May take 5-10 seconds to deliver)")
                print()
                print(
                    "📝 Next: Check push receipts after 15 minutes to confirm delivery"
                )
                print("   (Receipts tell you if Apple/Google actually delivered it)")
            else:
                print("❌ Push failed or no valid tokens")
                if result.get("reason"):
                    print(f"   Reason: {result['reason']}")
                if result["invalid_tokens"]:
                    print(f"   Invalid tokens: {result['invalid_tokens']}")

        except Exception as exc:
            print(f"❌ Exception during send_push_to_user: {exc}")
            import traceback

            traceback.print_exc()

        print()

    print("=" * 60)
    print("✅ Test Complete!")
    print("=" * 60)
    print()
    print("What this test does:")
    print("  1. Queries device_tokens table directly (like real Celery task)")
    print("  2. Sends push using Expo SDK (proper error handling)")
    print("  3. No user authentication required")
    print("  4. Automatically marks invalid tokens as inactive")
    print()
    print("This is EXACTLY how the backend task sends notifications!")


if __name__ == "__main__":
    asyncio.run(test_push_notifications())
