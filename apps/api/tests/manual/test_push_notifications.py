"""
Manual test script for push notifications

Run this to test if backend push notifications work:
    poetry run python tests/manual/test_push_notifications.py

Make sure:
1. API server is running
2. You're logged in on mobile app
3. Mobile app has registered device token
"""

import requests
import json
import sys

# Configuration
API_URL = "http://localhost:8000/api/v1"
# Replace with your access token (get from mobile app logs or login response)
ACCESS_TOKEN = input("Enter your access token: ").strip()

if not ACCESS_TOKEN:
    print("❌ Access token required!")
    sys.exit(1)

headers = {
    "Authorization": f"Bearer {ACCESS_TOKEN}",
    "Content-Type": "application/json",
}


def test_simple_push():
    """Test basic push notification"""
    print("\n🧪 Testing Simple Push Notification...")

    response = requests.post(
        f"{API_URL}/test/test-push",
        headers=headers,
        json={
            "title": "🧪 Test from Backend",
            "body": "If you see this, backend push works! 🎉",
        },
    )

    if response.status_code == 200:
        result = response.json()
        print(f"✅ {result['message']}")
        if result["delivered"]:
            print(f"   Notification ID: {result['notification_id']}")
            print(f"   Devices: {result['tokens_attempted']}")
            print("\n✨ Check your phone - you should see the notification!")
        else:
            print(f"⚠️  Not delivered: {result['message']}")
    else:
        print(f"❌ Request failed: {response.status_code}")
        print(f"   {response.text}")


def test_ai_motivation():
    """Test AI-generated motivation push"""
    print("\n🤖 Testing AI Motivation Push...")

    response = requests.post(
        f"{API_URL}/test/test-ai-motivation",
        headers=headers,
    )

    if response.status_code == 200:
        result = response.json()
        print(f"✅ {result['message']}")
        if result["delivered"]:
            print(f"   Notification ID: {result['notification_id']}")
            print("\n✨ Check your phone - AI-generated motivation should appear!")
        else:
            print(f"⚠️  Not delivered: {result['message']}")
    elif response.status_code == 404:
        print("❌ No active goals found. Create a goal first!")
    else:
        print(f"❌ Request failed: {response.status_code}")
        print(f"   {response.text}")


def test_checkin_reminder():
    """Test check-in reminder push"""
    print("\n⏰ Testing Check-In Reminder Push...")

    response = requests.post(
        f"{API_URL}/test/test-checkin-reminder",
        headers=headers,
    )

    if response.status_code == 200:
        result = response.json()
        print(f"✅ {result['message']}")
        if result["delivered"]:
            print("\n✨ Check your phone - check-in reminder should appear!")
        else:
            print(f"⚠️  Not delivered: {result['message']}")
    elif response.status_code == 404:
        print("❌ No active goals found. Create a goal first!")
    else:
        print(f"❌ Request failed: {response.status_code}")
        print(f"   {response.text}")


if __name__ == "__main__":
    print("=" * 60)
    print("🔔 Push Notification Test Suite")
    print("=" * 60)

    # Run all tests
    test_simple_push()
    test_ai_motivation()
    test_checkin_reminder()

    print("\n" + "=" * 60)
    print("✅ Test complete!")
    print("=" * 60)
    print("\nIf notifications appeared on your phone:")
    print("  → Backend push works! ✅")
    print("  → Can move check-in reminders to backend")
    print("  → Can remove local scheduling from mobile app")
    print("\nIf notifications did NOT appear:")
    print("  → Check device token registration")
    print("  → Check mobile app has notification permission")
    print("  → Keep local scheduling for now")
