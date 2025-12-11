"""
Test endpoint for push notifications
Allows testing Expo push notifications to verify they work
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from app.core.flexible_auth import get_current_user
from app.services.expo_push_service import send_push_to_user
import asyncio

router = APIRouter(redirect_slashes=False)


class TestNotificationRequest(BaseModel):
    title: Optional[str] = "🧪 Test Notification"
    body: Optional[str] = "This is a test push notification from the backend!"
    notification_type: Optional[str] = "motivation"  # Use valid type (not "test")


class TestNotificationResponse(BaseModel):
    success: bool
    notification_id: Optional[str]
    delivered: bool
    tokens_attempted: int
    message: str


@router.post("/test-push", response_model=TestNotificationResponse)
async def send_test_push_notification(
    request: TestNotificationRequest = TestNotificationRequest(),
    current_user: dict = Depends(get_current_user),
):
    """
    Send a test push notification to the current user's devices.

    This endpoint verifies that:
    - Backend can send push notifications
    - Expo Push Service is working
    - User's device tokens are valid
    - Push notifications appear on device

    Use this to test before implementing scheduled notifications.
    """
    try:
        user_id = current_user["id"]

        # Send push notification
        result = await send_push_to_user(
            user_id=user_id,
            title=request.title,
            body=request.body,
            data={
                "type": request.notification_type,  # Use the same type
                "timestamp": asyncio.get_event_loop().time(),
                "deepLink": "/home",
            },
            notification_type=request.notification_type,
        )

        if result["delivered"]:
            return TestNotificationResponse(
                success=True,
                notification_id=result["notification_id"],
                delivered=True,
                tokens_attempted=result["tokens_attempted"],
                message=f"✅ Push notification sent successfully to {result['tokens_attempted']} device(s)!",
            )
        elif result.get("reason") == "no_active_tokens":
            return TestNotificationResponse(
                success=False,
                notification_id=None,
                delivered=False,
                tokens_attempted=0,
                message="❌ No active device tokens found. Make sure the mobile app is registered.",
            )
        else:
            return TestNotificationResponse(
                success=False,
                notification_id=result["notification_id"],
                delivered=False,
                tokens_attempted=result["tokens_attempted"],
                message=f"⚠️ Push sent to {result['tokens_attempted']} device(s) but delivery failed. Check device tokens.",
            )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to send test push notification: {str(e)}"
        )


@router.post("/test-ai-motivation", response_model=TestNotificationResponse)
async def send_test_ai_motivation(
    current_user: dict = Depends(get_current_user),
):
    """
    Send a test AI-generated motivation push notification.
    Tests the new push_motivation_generator.
    """
    try:
        from app.services.push_motivation_generator import generate_push_notification_ai
        from app.core.database import get_supabase_client

        user_id = current_user["id"]
        supabase = get_supabase_client()

        # Get a goal for testing
        goal_result = (
            supabase.table("goals")
            .select("id, title")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .limit(1)
            .execute()
        )

        if not goal_result.data:
            raise HTTPException(
                status_code=404,
                detail="No active goals found. Create a goal first to test AI motivation.",
            )

        goal = goal_result.data[0]
        goal_title = goal["title"]

        # Generate AI push notification
        push_content = generate_push_notification_ai(
            goal_title=goal_title,
            user_context={
                "current_streak": 5,  # Mock data for testing
                "recent_completed": 4,
                "recent_total": 7,
                "time_of_day": "afternoon",
                "user_name": current_user.get("name", "Champion"),
            },
        )

        # Send via Expo Push
        result = await send_push_to_user(
            user_id=user_id,
            title=push_content["title"],
            body=push_content["body"],
            data={
                "type": "ai_motivation",
                "goalId": goal["id"],
                "deepLink": f"/motivation/{goal['id']}",
            },
            notification_type="ai_motivation",
        )

        if result["delivered"]:
            return TestNotificationResponse(
                success=True,
                notification_id=result["notification_id"],
                delivered=True,
                tokens_attempted=result["tokens_attempted"],
                message=f"✅ AI motivation sent: \"{push_content['title']}\" - \"{push_content['body']}\"",
            )
        else:
            return TestNotificationResponse(
                success=False,
                notification_id=result.get("notification_id"),
                delivered=False,
                tokens_attempted=result["tokens_attempted"],
                message="❌ Failed to deliver push notification. Check device tokens.",
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to send test AI motivation: {str(e)}"
        )


@router.post("/test-checkin-reminder", response_model=TestNotificationResponse)
async def send_test_checkin_reminder(
    current_user: dict = Depends(get_current_user),
):
    """
    Send a test check-in reminder push notification.
    """
    try:
        from app.core.database import get_supabase_client

        user_id = current_user["id"]
        supabase = get_supabase_client()

        # Get a goal for testing
        goal_result = (
            supabase.table("goals")
            .select("id, title")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .limit(1)
            .execute()
        )

        if not goal_result.data:
            raise HTTPException(
                status_code=404, detail="No active goals found. Create a goal first."
            )

        goal = goal_result.data[0]

        # Send check-in reminder
        result = await send_push_to_user(
            user_id=user_id,
            title="⏰ Check-In Time!",
            body=f"How did your {goal['title']} go today?",
            data={
                "type": "checkin_reminder",
                "goalId": goal["id"],
                "deepLink": f"/checkin/{goal['id']}",
            },
            notification_type="checkin_reminder",
        )

        if result["delivered"]:
            return TestNotificationResponse(
                success=True,
                notification_id=result["notification_id"],
                delivered=True,
                tokens_attempted=result["tokens_attempted"],
                message=f"✅ Check-in reminder sent for: {goal['title']}",
            )
        else:
            return TestNotificationResponse(
                success=False,
                notification_id=result.get("notification_id"),
                delivered=False,
                tokens_attempted=result["tokens_attempted"],
                message="❌ Failed to deliver. Check device tokens.",
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to send test check-in reminder: {str(e)}"
        )
