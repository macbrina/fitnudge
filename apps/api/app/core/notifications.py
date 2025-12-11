from firebase_admin import messaging
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


async def send_push_notification(
    user_id: str, title: str, body: str, data: dict = None, image_url: str = None
):
    """Send push notification to user"""
    try:
        # Get user's FCM token from database
        from app.core.database import get_supabase_client

        supabase = get_supabase_client()

        # In a real implementation, you'd store FCM tokens in the database
        # For now, we'll use a placeholder
        fcm_token = "placeholder_fcm_token"

        # Create message
        message = messaging.Message(
            notification=messaging.Notification(
                title=title, body=body, image=image_url
            ),
            data=data or {},
            token=fcm_token,
        )

        # Send message
        response = messaging.send(message)
        print(f"Successfully sent message: {response}")

        return {"success": True, "message_id": response}

    except Exception as e:
        logger.error(f"Failed to send push notification: {str(e)}")
        raise e


async def send_bulk_notifications(
    user_ids: list, title: str, body: str, data: dict = None, image_url: str = None
):
    """Send push notification to multiple users"""
    try:
        # Get FCM tokens for all users
        from app.core.database import get_supabase_client

        supabase = get_supabase_client()

        # In a real implementation, you'd get FCM tokens from database
        fcm_tokens = ["placeholder_token_1", "placeholder_token_2"]

        # Create multicast message
        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=title, body=body, image=image_url
            ),
            data=data or {},
            tokens=fcm_tokens,
        )

        # Send message
        response = messaging.send_multicast(message)
        print(f"Successfully sent {response.success_count} messages")

        return {
            "success": True,
            "success_count": response.success_count,
            "failure_count": response.failure_count,
        }

    except Exception as e:
        logger.error(f"Failed to send bulk notifications: {str(e)}")
        raise e


async def schedule_notification(
    user_id: str, title: str, body: str, scheduled_time: str, data: dict = None
):
    """Schedule a notification for later delivery"""
    try:
        # In a real implementation, you'd use a job queue like Celery
        # For now, we'll just log the scheduled notification
        print(f"Scheduled notification for user {user_id} at {scheduled_time}")

        return {"success": True, "scheduled_at": scheduled_time}

    except Exception as e:
        logger.error(f"Failed to schedule notification: {str(e)}")
        raise e


async def send_motivation_notification(
    user_id: str, motivation_message: str, goal_title: str = None
):
    """Send AI motivation notification"""
    title = "💪 Your Daily Motivation"
    body = motivation_message

    if goal_title:
        body = f"Goal: {goal_title}\n\n{motivation_message}"

    return await send_push_notification(
        user_id=user_id,
        title=title,
        body=body,
        data={"type": "motivation", "goal_title": goal_title or ""},
    )


async def send_reminder_notification(
    user_id: str, goal_title: str, reminder_type: str = "workout"
):
    """Send goal reminder notification"""
    title = "⏰ Time for your workout!"
    body = f"Don't forget: {goal_title}"

    if reminder_type == "workout":
        title = "🏋️ Workout Time!"
        body = f"Time to crush your goal: {goal_title}"
    elif reminder_type == "checkin":
        title = "📝 Daily Check-in"
        body = f"How did you do with: {goal_title}?"

    return await send_push_notification(
        user_id=user_id,
        title=title,
        body=body,
        data={
            "type": "reminder",
            "reminder_type": reminder_type,
            "goal_title": goal_title,
        },
    )


async def send_achievement_notification(
    user_id: str, achievement: str, streak_count: int = None
):
    """Send achievement notification"""
    title = "🎉 Achievement Unlocked!"
    body = f"Congratulations! {achievement}"

    if streak_count:
        body += f" You're on a {streak_count} day streak!"

    return await send_push_notification(
        user_id=user_id,
        title=title,
        body=body,
        data={
            "type": "achievement",
            "achievement": achievement,
            "streak_count": streak_count or 0,
        },
    )
