"""
Data Export Celery Tasks (Admin API)

Runs in admin-api workers. Response returns immediately; task runs in background.
"""

from app.core.celery_client import celery_app
from app.services.data_export_service import run_generate_user_data_export


@celery_app.task(name="admin.generate_user_data_export")
def generate_user_data_export_task(user_id: str, email: str, export_id: str) -> dict:
    """
    Generate user data export and send via email.
    Called by admin-api data export endpoint - runs in Celery worker.
    Returns success: True only when email was sent successfully.
    """
    try:
        ok = run_generate_user_data_export(user_id, email, export_id)
        if ok:
            return {"success": True, "export_id": export_id}
        return {"success": False, "error": "Failed to send email", "export_id": export_id}
    except Exception as e:
        return {"success": False, "error": str(e), "export_id": export_id}
