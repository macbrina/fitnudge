"""
Maintenance Celery tasks - cleanup and housekeeping.
"""

from datetime import datetime, timedelta, timezone

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.database import get_supabase_client
from app.services.logger import logger


@celery_app.task(name="cleanup_task_audit_log")
def cleanup_task_audit_log_task() -> dict:
    """Delete task_audit_log records older than TASK_AUDIT_LOG_RETENTION_DAYS.

    Keeps the failure log table small and focused on recent debugging.
    Schedule: Weekly (Sunday 4am UTC)
    """
    try:
        retention_days = settings.TASK_AUDIT_LOG_RETENTION_DAYS
        cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
        cutoff_iso = cutoff.isoformat()

        supabase = get_supabase_client()
        result = (
            supabase.table("task_audit_log")
            .delete()
            .lt("created_at", cutoff_iso)
            .execute()
        )

        # Supabase delete returns the deleted rows; count them
        deleted = len(result.data) if result.data else 0

        logger.info(
            "Completed task_audit_log cleanup",
            {"deleted_count": deleted, "cutoff": cutoff_iso},
        )

        return {
            "success": True,
            "deleted_count": deleted,
            "cutoff": cutoff_iso,
        }

    except Exception as e:
        logger.error("Failed to cleanup task_audit_log", {"error": str(e)})
        return {
            "success": False,
            "error": str(e),
        }
