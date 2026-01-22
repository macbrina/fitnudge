"""
FitNudge V2 - Social Notification Service

Handles sending push notifications for social features:
- Accountability Partners
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


# Notification templates with placeholders
SOCIAL_NOTIFICATION_TEMPLATES = {
    # Accountability Partners
    "partner_request": "👋 {sender_name} wants to be your accountability partner! As partners, you'll be able to see each other's goals and send motivational nudges.",
    "partner_accepted": "🎉 {sender_name} accepted your partner request! You can now see their goals and track their progress.",
    "partner_nudge": "👋 {sender_name}: {message}",
    "partner_cheer": "🎉 {sender_name} sent you a cheer!",
    "partner_milestone": "🔥 Your partner {sender_name} just hit a {count}-day streak!",
    "partner_inactive": "💙 {sender_name} hasn't checked in for {days} days. Send encouragement?",
}

# Map notification types to preference column names
NOTIFICATION_PREFERENCE_MAPPING = {
    SocialNotificationType.PARTNER_REQUEST: "partner_requests",
    SocialNotificationType.PARTNER_ACCEPTED: "partner_requests",
    SocialNotificationType.PARTNER_NUDGE: "partner_nudges",
    SocialNotificationType.PARTNER_CHEER: "partner_cheers",
    SocialNotificationType.PARTNER_MILESTONE: "partner_milestones",
    SocialNotificationType.PARTNER_INACTIVE: "partner_nudges",
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
    }
    return titles.get(notification_type, "FitNudge")


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
        # Get template and format message
        # If a custom message is provided and it's not empty, use it directly
        # This allows callers to override templates when needed (e.g., achievements)
        custom_message = data.get("message", "")
        if custom_message and notification_type in [
            SocialNotificationType.PARTNER_MILESTONE,
            SocialNotificationType.PARTNER_NUDGE,
            SocialNotificationType.PARTNER_CHEER,
        ]:
            # Use custom message directly for these types when provided
            message = custom_message
        else:
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

        # Determine entity type and ID
        entity_type = data.get("entity_type")
        entity_id = data.get("entity_id")

        # Determine category_id for actionable notifications
        # partner_activity category adds "Cheer Back" action button
        category_id = None
        if notification_type in [
            SocialNotificationType.PARTNER_NUDGE,
            SocialNotificationType.PARTNER_CHEER,
            SocialNotificationType.PARTNER_MILESTONE,
        ]:
            category_id = "partner_activity"

        if not entity_type or not entity_id:
            # Partner notifications point to partnership or sender
            if notification_type in [
                SocialNotificationType.PARTNER_REQUEST,
                SocialNotificationType.PARTNER_ACCEPTED,
            ]:
                entity_type = entity_type or "partner_request"
                entity_id = (
                    entity_id or data.get("request_id") or data.get("partnership_id")
                )
            elif notification_type in [
                SocialNotificationType.PARTNER_NUDGE,
                SocialNotificationType.PARTNER_CHEER,
                SocialNotificationType.PARTNER_MILESTONE,
                SocialNotificationType.PARTNER_INACTIVE,
            ]:
                # For nudges/cheers, entity is the sender (partner)
                entity_type = entity_type or "user"
                entity_id = entity_id or sender_id

        # Send push notification (fire-and-forget for non-blocking)
        await send_push_to_user(
            user_id=recipient_id,
            title=title,
            body=message,
            data=notification_data,
            notification_type=notification_type.value,
            entity_type=entity_type,
            entity_id=entity_id,
            category_id=category_id,
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
    partnership_id: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    deep_link: Optional[str] = None,
    goal_id: Optional[str] = None,
    supabase=None,
) -> bool:
    """Convenience function for partner notifications

    Args:
        notification_type: Type of notification
        recipient_id: User ID to send to
        sender_id: User ID who triggered the notification
        sender_name: Display name of sender
        message: Optional message content
        count: Optional count (for milestones like streak days)
        days: Optional days count (for inactive)
        partnership_id: ID of the accountability_partners record
        entity_type: Entity type for notification_history
        entity_id: Entity ID for notification_history
        deep_link: Deep link URL for navigation
        goal_id: Optional goal ID for goal-related nudges
        supabase: Supabase client
    """
    data = {
        "sender_name": sender_name,
        "message": message or "",
        "count": count or 0,
        "days": days or 0,
        "partnership_id": partnership_id,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "deepLink": deep_link,  # Use camelCase for frontend compatibility
        "goal_id": goal_id,  # For goal-related nudges
    }
    return await send_social_notification(
        notification_type, recipient_id, sender_id, data, supabase
    )
