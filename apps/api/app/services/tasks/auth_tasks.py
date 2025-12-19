"""
Authentication-related Celery tasks

Handles periodic cleanup of expired refresh tokens.
"""

from app.core.celery_app import celery_app
from app.services.logger import logger


@celery_app.task(name="cleanup_expired_refresh_tokens")
def cleanup_expired_refresh_tokens_task() -> dict:
    """Clean up expired refresh tokens from the database

    This task removes tokens that have passed their expiration date.
    With immediate deletion on rotation, this mainly catches abandoned
    sessions (users who logged in but never came back).

    Schedule: Daily
    """
    from app.core.auth import cleanup_expired_refresh_tokens

    try:
        deleted_count = cleanup_expired_refresh_tokens()

        logger.info("Completed refresh token cleanup", {"deleted_count": deleted_count})

        return {
            "success": True,
            "deleted_count": deleted_count,
        }

    except Exception as e:
        logger.error("Failed to cleanup expired refresh tokens", {"error": str(e)})
        return {
            "success": False,
            "error": str(e),
        }
