"""
Social Notification Service

Handles sending push notifications for social features including:
- Accountability Partners
- Challenges
- Social Nudges
"""

from enum import Enum
from typing import Dict, Any, Optional
from app.services.logger import logger


class SocialNotificationType(Enum):
    """Types of social notifications"""

    # Accountability Partners
    PARTNER_REQUEST = "partner_request"
    PARTNER_ACCEPTED = "partner_accepted"
    PARTNER_NUDGE = "partner_nudge"
    PARTNER_CHEER = "partner_cheer"
    PARTNER_MILESTONE = "partner_milestone"
    PARTNER_INACTIVE = "partner_inactive"

    # Challenges
    CHALLENGE_INVITE = "challenge_invite"
    CHALLENGE_JOINED = "challenge_joined"
    CHALLENGE_OVERTAKEN = "challenge_overtaken"
    CHALLENGE_LEAD = "challenge_lead"
    CHALLENGE_NUDGE = "challenge_nudge"
    CHALLENGE_STARTING = "challenge_starting"
    CHALLENGE_ENDING = "challenge_ending"
    CHALLENGE_ENDED = "challenge_ended"

    # Motivation
    MOTIVATION_MESSAGE = "motivation_message"


# Notification templates with placeholders
SOCIAL_NOTIFICATION_TEMPLATES = {
    # Accountability Partners
    "partner_request": "👋 {sender_name} wants to be your accountability partner",
    "partner_accepted": "🎉 {sender_name} accepted your partner request!",
    "partner_nudge": "👋 {sender_name}: {message}",
    "partner_cheer": "🎉 {sender_name} cheered your check-in!",
    "partner_milestone": "🔥 Your partner {sender_name} just hit a {count}-day streak!",
    "partner_inactive": "💙 {sender_name} hasn't checked in for {days} days. Send encouragement?",
    # Challenges
    "challenge_invite": "🏆 {sender_name} invited you to '{challenge_title}'",
    "challenge_joined": "🙌 {sender_name} joined your challenge!",
    "challenge_overtaken": "😱 {sender_name} just passed you! You're now #{rank}",
    "challenge_lead": "👑 You're now in 1st place!",
    "challenge_nudge": "🏃 {sender_name}: {message}",
    "challenge_starting": "⏰ '{challenge_title}' starts tomorrow!",
    "challenge_ending": "⏰ {days} days left in '{challenge_title}'! You're #{rank}",
    "challenge_ended": "🏆 '{challenge_title}' complete! You finished #{rank}!",
    # Motivation
    "motivation_message": "💪 {sender_name}: {message}",
}

# Map notification types to preference column names
NOTIFICATION_PREFERENCE_MAPPING = {
    SocialNotificationType.PARTNER_REQUEST: "social_partner_requests",
    SocialNotificationType.PARTNER_ACCEPTED: "social_partner_requests",
    SocialNotificationType.PARTNER_NUDGE: "social_partner_nudges",
    SocialNotificationType.PARTNER_CHEER: "social_partner_cheers",
    SocialNotificationType.PARTNER_MILESTONE: "social_partner_milestones",
    SocialNotificationType.PARTNER_INACTIVE: "social_partner_nudges",
    SocialNotificationType.CHALLENGE_INVITE: "social_challenge_invites",
    SocialNotificationType.CHALLENGE_JOINED: "social_challenge_invites",
    SocialNotificationType.CHALLENGE_OVERTAKEN: "social_challenge_leaderboard",
    SocialNotificationType.CHALLENGE_LEAD: "social_challenge_leaderboard",
    SocialNotificationType.CHALLENGE_NUDGE: "social_challenge_nudges",
    SocialNotificationType.CHALLENGE_STARTING: "social_challenge_reminders",
    SocialNotificationType.CHALLENGE_ENDING: "social_challenge_reminders",
    SocialNotificationType.CHALLENGE_ENDED: "social_challenge_reminders",
    SocialNotificationType.MOTIVATION_MESSAGE: "social_motivation_messages",
}


def get_notification_title(notification_type: SocialNotificationType) -> str:
    """Get the notification title based on type"""
    titles = {
        # Partners
        SocialNotificationType.PARTNER_REQUEST: "Partner Request",
        SocialNotificationType.PARTNER_ACCEPTED: "Partner Accepted",
        SocialNotificationType.PARTNER_NUDGE: "Partner Nudge",
        SocialNotificationType.PARTNER_CHEER: "Cheer!",
        SocialNotificationType.PARTNER_MILESTONE: "Partner Milestone",
        SocialNotificationType.PARTNER_INACTIVE: "Check on Partner",
        # Challenges
        SocialNotificationType.CHALLENGE_INVITE: "Challenge Invite",
        SocialNotificationType.CHALLENGE_JOINED: "New Challenger",
        SocialNotificationType.CHALLENGE_OVERTAKEN: "Leaderboard Update",
        SocialNotificationType.CHALLENGE_LEAD: "You're Winning!",
        SocialNotificationType.CHALLENGE_NUDGE: "Challenge",
        SocialNotificationType.CHALLENGE_STARTING: "Challenge Starting",
        SocialNotificationType.CHALLENGE_ENDING: "Challenge Ending Soon",
        SocialNotificationType.CHALLENGE_ENDED: "Challenge Complete",
        # Motivation
        SocialNotificationType.MOTIVATION_MESSAGE: "Motivation",
    }
    return titles.get(notification_type, "FitNudge")


async def get_notification_preferences(user_id: str, supabase) -> Dict[str, bool]:
    """Get user's notification preferences"""
    try:
        result = (
            supabase.table("notification_preferences")
            .select("*")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )

        if result.data:
            return result.data

        # Return defaults if no preferences found
        return {
            "social_partner_requests": True,
            "social_partner_nudges": True,
            "social_partner_cheers": True,
            "social_partner_milestones": True,
            "social_challenge_invites": True,
            "social_challenge_leaderboard": True,
            "social_challenge_nudges": True,
            "social_challenge_reminders": True,
            "social_motivation_messages": True,
        }
    except Exception as e:
        logger.error(f"Failed to get notification preferences: {e}")
        return {}


async def send_social_notification(
    notification_type: SocialNotificationType,
    recipient_id: str,
    sender_id: Optional[str],
    data: Dict[str, Any],
    supabase,
) -> bool:
    """
    Send a social notification if user has enabled it.

    Args:
        notification_type: Type of notification
        recipient_id: User ID to send to
        sender_id: User ID who triggered the notification (optional)
        data: Template data (sender_name, message, etc.)
        supabase: Supabase client

    Returns:
        True if notification was sent, False otherwise
    """
    from app.services.expo_push_service import send_push_to_user

    try:
        # Check user preferences
        prefs = await get_notification_preferences(recipient_id, supabase)
        pref_key = NOTIFICATION_PREFERENCE_MAPPING.get(notification_type)

        if pref_key and not prefs.get(pref_key, True):
            logger.info(
                f"Social notification skipped - user disabled {pref_key}",
                {"recipient_id": recipient_id, "type": notification_type.value},
            )
            return False

        # Get template and format message
        template = SOCIAL_NOTIFICATION_TEMPLATES.get(
            notification_type.value, "{message}"
        )

        # Safely format the message
        try:
            message = template.format(**data)
        except KeyError as e:
            logger.warning(f"Missing template key: {e}, using fallback")
            message = data.get("message", "You have a new notification")

        # Get title
        title = get_notification_title(notification_type)

        # Build notification data
        notification_data = {
            "type": notification_type.value,
            "sender_id": sender_id,
            **data,
        }

        # Determine entity type and ID based on notification type
        entity_type = None
        entity_id = None
        
        if notification_type in [
            SocialNotificationType.CHALLENGE_INVITE,
            SocialNotificationType.CHALLENGE_JOINED,
            SocialNotificationType.CHALLENGE_OVERTAKEN,
            SocialNotificationType.CHALLENGE_LEAD,
            SocialNotificationType.CHALLENGE_NUDGE,
            SocialNotificationType.CHALLENGE_STARTING,
            SocialNotificationType.CHALLENGE_ENDING,
            SocialNotificationType.CHALLENGE_ENDED,
        ]:
            entity_type = "challenge"
            entity_id = data.get("challenge_id")
        elif notification_type in [
            SocialNotificationType.PARTNER_REQUEST,
            SocialNotificationType.PARTNER_ACCEPTED,
        ]:
            entity_type = "partner_request"
            entity_id = data.get("request_id") or data.get("partnership_id")
        elif notification_type in [
            SocialNotificationType.PARTNER_NUDGE,
            SocialNotificationType.PARTNER_CHEER,
            SocialNotificationType.PARTNER_MILESTONE,
            SocialNotificationType.PARTNER_INACTIVE,
        ]:
            # These are partner-related but may reference a goal
            entity_type = "goal" if data.get("goal_id") else "user"
            entity_id = data.get("goal_id") or sender_id

        # Send push notification
        await send_push_to_user(
            user_id=recipient_id,
            title=title,
            body=message,
            data=notification_data,
            notification_type=notification_type.value,
            entity_type=entity_type,
            entity_id=entity_id,
        )

        logger.info(
            f"Social notification sent",
            {
                "type": notification_type.value,
                "recipient_id": recipient_id,
                "sender_id": sender_id,
            },
        )

        return True

    except Exception as e:
        logger.error(
            f"Failed to send social notification: {e}",
            {
                "type": notification_type.value,
                "recipient_id": recipient_id,
                "error": str(e),
            },
        )
        return False


async def send_partner_notification(
    notification_type: SocialNotificationType,
    recipient_id: str,
    sender_id: str,
    sender_name: str,
    message: Optional[str] = None,
    count: Optional[int] = None,
    days: Optional[int] = None,
    supabase=None,
) -> bool:
    """Convenience function for partner notifications"""
    data = {
        "sender_name": sender_name,
        "message": message or "",
        "count": count or 0,
        "days": days or 0,
    }
    return await send_social_notification(
        notification_type, recipient_id, sender_id, data, supabase
    )


async def send_challenge_notification(
    notification_type: SocialNotificationType,
    recipient_id: str,
    sender_id: Optional[str],
    challenge_title: str,
    sender_name: Optional[str] = None,
    message: Optional[str] = None,
    rank: Optional[int] = None,
    days: Optional[int] = None,
    supabase=None,
) -> bool:
    """Convenience function for challenge notifications"""
    data = {
        "sender_name": sender_name or "FitNudge",
        "challenge_title": challenge_title,
        "message": message or "",
        "rank": rank or 0,
        "days": days or 0,
    }
    return await send_social_notification(
        notification_type, recipient_id, sender_id, data, supabase
    )
