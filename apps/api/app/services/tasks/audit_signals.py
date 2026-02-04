"""
Celery signal handlers for task_audit_log.
Logs FAILURE (raised exceptions) and SOFT_FAILURE (returned {success: False, error: "..."}).
Optionally POSTs to TASK_FAILURE_WEBHOOK_URL for alerting (Slack, Incident.io, etc.).
"""

import json
import logging
import uuid
from datetime import datetime, timezone
from celery.signals import task_failure, task_success
import httpx

from app.core.config import settings
from app.core.database import get_supabase_client

logger = logging.getLogger(__name__)


def _is_soft_failure(result) -> bool:
    """Tasks that return {success: False, error: "..."} instead of raising."""
    if not isinstance(result, dict):
        return False
    return result.get("success") is False and "error" in result


def _truncate(val: str, max_len: int = 2000) -> str:
    if not val or len(val) <= max_len:
        return val or ""
    return val[:max_len] + "...[truncated]"


def _notify_webhook(task_id: str, task_name, state: str, error_message: str) -> None:
    """Fire-and-forget POST to TASK_FAILURE_WEBHOOK_URL. Logs errors but does not raise."""
    url = settings.TASK_FAILURE_WEBHOOK_URL
    if not url or not url.strip():
        return
    try:
        payload = {
            "task_id": task_id,
            "task_name": task_name,
            "state": state,
            "error_message": error_message,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        with httpx.Client(timeout=5.0) as client:
            client.post(url, json=payload)
    except Exception as e:
        logger.warning("Task failure webhook failed: %s", e)


@task_failure.connect
def on_task_failure(sender=None, task_id=None, exception=None, args=None, kwargs=None, traceback=None, **kw):
    """Log real task failures (raised exceptions) to task_audit_log."""
    try:
        task_name = sender.name if sender else None
        error_msg = str(exception) if exception else "Unknown error"
        tb_str = None
        if traceback:
            try:
                tb_str = "".join(traceback.format()) if hasattr(traceback, "format") else str(traceback)
            except Exception:
                tb_str = str(traceback)
        args_json = json.dumps(args, default=str)[:2000] if args else None
        kwargs_json = json.dumps(kwargs, default=str)[:2000] if kwargs else None

        supabase = get_supabase_client()
        supabase.table("task_audit_log").insert({
            "task_id": task_id,
            "task_name": task_name,
            "state": "FAILURE",
            "error_message": _truncate(error_msg),
            "traceback": _truncate(tb_str) if tb_str else None,
            "args_json": args_json,
            "kwargs_json": kwargs_json,
        }).execute()
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower() or "23505" in str(e):
            pass  # Same task_id already logged, skip
        else:
            logger.warning("Failed to write task_audit_log for failure: %s", e)


@task_success.connect
def on_task_success(sender=None, result=None, **kw):
    """Log soft failures (returned {success: False, error: "..."}) to task_audit_log."""
    if not _is_soft_failure(result):
        return
    try:
        task_name = sender.name if sender else None
        task_id = getattr(sender.request, "id", None) if sender and hasattr(sender, "request") else None
        if not task_id and sender:
            task_id = getattr(getattr(sender, "request", None), "id", None)
        # Fallback: request might be on the task
        if not task_id:
            req = getattr(sender, "request", None)
            task_id = getattr(req, "id", None) if req else None

        error_msg = result.get("error", str(result))
        if isinstance(error_msg, dict):
            error_msg = json.dumps(error_msg, default=str)

        tid = task_id or f"soft-{uuid.uuid4().hex[:12]}"
        supabase = get_supabase_client()
        supabase.table("task_audit_log").insert({
            "task_id": tid,
            "task_name": task_name,
            "state": "SOFT_FAILURE",
            "error_message": _truncate(str(error_msg)),
            "traceback": None,
            "args_json": None,
            "kwargs_json": None,
        }).execute()
        _notify_webhook(tid, task_name, "SOFT_FAILURE", str(error_msg))
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower() or "23505" in str(e):
            pass  # Same task_id already logged, skip
        else:
            logger.warning("Failed to write task_audit_log for soft failure: %s", e)
