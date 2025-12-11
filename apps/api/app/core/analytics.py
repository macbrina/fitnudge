"""
PostHog Analytics Service
Handles user analytics, event tracking, and exception monitoring
"""

from posthog import Posthog
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Initialize PostHog client
posthog = None


def initialize_posthog():
    """Initialize PostHog client with configuration"""
    global posthog

    if not settings.POSTHOG_API_KEY:
        logger.warning("PostHog API key not found, analytics disabled")
        return None

    try:
        posthog = Posthog(
            project_api_key=settings.POSTHOG_API_KEY,
            host=settings.POSTHOG_HOST,
            enable_exception_autocapture=settings.POSTHOG_ENABLE_EXCEPTION_AUTOCAPTURE,
        )
        print("PostHog analytics initialized successfully")
        return posthog
    except Exception as e:
        logger.error(f"Failed to initialize PostHog: {e}")
        return None


def get_posthog():
    """Get PostHog client instance"""
    global posthog
    if posthog is None:
        posthog = initialize_posthog()
    return posthog


def identify_user(user_id: str, properties: dict = None):
    """Identify a user with PostHog"""
    client = get_posthog()
    if not client:
        return

    try:
        # PostHog Python SDK uses 'set' for user identification
        client.set(distinct_id=user_id, properties=properties or {})
        logger.debug(f"User identified: {user_id}")
    except Exception as e:
        logger.error(f"Failed to identify user {user_id}: {e}")


def track_event(user_id: str, event_name: str, properties: dict = None):
    """Track an event for a user"""
    client = get_posthog()
    if not client:
        return

    try:
        client.capture(
            distinct_id=user_id, event=event_name, properties=properties or {}
        )
        logger.debug(f"Event tracked: {event_name} for user {user_id}")
    except Exception as e:
        logger.error(f"Failed to track event {event_name}: {e}")


def track_page_view(user_id: str, page_name: str, properties: dict = None):
    """Track a page view"""
    track_event(
        user_id=user_id,
        event_name="$pageview",
        properties={"$current_url": page_name, **(properties or {})},
    )


def track_user_signup(user_id: str, auth_provider: str, properties: dict = None):
    """Track user signup event"""
    track_event(
        user_id=user_id,
        event_name="user_signed_up",
        properties={"auth_provider": auth_provider, **(properties or {})},
    )


def track_user_login(user_id: str, auth_provider: str, properties: dict = None):
    """Track user login event"""
    track_event(
        user_id=user_id,
        event_name="user_logged_in",
        properties={"auth_provider": auth_provider, **(properties or {})},
    )


def track_goal_created(user_id: str, goal_category: str, properties: dict = None):
    """Track goal creation event"""
    track_event(
        user_id=user_id,
        event_name="goal_created",
        properties={"goal_category": goal_category, **(properties or {})},
    )


def track_goal_completed(user_id: str, goal_id: str, properties: dict = None):
    """Track goal completion event"""
    track_event(
        user_id=user_id,
        event_name="goal_completed",
        properties={"goal_id": goal_id, **(properties or {})},
    )


def track_check_in(
    user_id: str, goal_id: str, mood: int = None, properties: dict = None
):
    """Track check-in event"""
    track_event(
        user_id=user_id,
        event_name="check_in_completed",
        properties={"goal_id": goal_id, "mood": mood, **(properties or {})},
    )


def track_post_created(user_id: str, post_type: str, properties: dict = None):
    """Track post creation event"""
    track_event(
        user_id=user_id,
        event_name="post_created",
        properties={"post_type": post_type, **(properties or {})},
    )


def track_subscription_created(
    user_id: str, plan: str, platform: str, properties: dict = None
):
    """Track subscription creation event"""
    track_event(
        user_id=user_id,
        event_name="subscription_created",
        properties={"plan": plan, "platform": platform, **(properties or {})},
    )


def capture_exception(error: Exception, user_id: str = None, properties: dict = None):
    """Manually capture an exception"""
    client = get_posthog()
    if not client:
        return

    try:
        client.capture_exception(
            error=error, distinct_id=user_id or "anonymous", properties=properties or {}
        )
        logger.debug(f"Exception captured for user {user_id or 'anonymous'}")
    except Exception as e:
        logger.error(f"Failed to capture exception: {e}")


def set_user_properties(user_id: str, properties: dict):
    """Set user properties"""
    client = get_posthog()
    if not client:
        return

    try:
        # PostHog Python SDK uses 'set' for user properties
        client.set(distinct_id=user_id, properties=properties)
        logger.debug(f"User properties set for {user_id}")
    except Exception as e:
        logger.error(f"Failed to set user properties: {e}")


def shutdown_posthog():
    """Shutdown PostHog client"""
    global posthog
    if posthog:
        try:
            posthog.shutdown()
            posthog = None
        except Exception as e:
            logger.error(f"Failed to shutdown PostHog: {e}")
