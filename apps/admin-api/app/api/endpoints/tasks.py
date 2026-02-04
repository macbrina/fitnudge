"""
Celery Task Monitoring Endpoints
Provides visibility into task queues, workers, and task status
"""

import json
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from celery.result import AsyncResult
from app.core.admin_auth import get_current_admin, log_admin_action
from app.core.celery_client import celery_app, get_celery_inspect, get_celery_control
from app.core.config import settings
from app.core.database import get_supabase_client

router = APIRouter(prefix="/tasks", tags=["Task Monitoring"])

# Celery Redis backend key prefix
CELERY_KEY_PREFIX = "celery-task-meta-"


def _is_soft_failure(result: Any) -> bool:
    """Tasks that return {success: False, error: "..."} instead of raising are SUCCESS in Celery but are logical failures."""
    if not isinstance(result, dict):
        return False
    return result.get("success") is False and "error" in result


class WorkerInfo(BaseModel):
    name: str
    status: str
    active_tasks: int
    processed: int | None = None
    concurrency: int | None = None


class TaskOverview(BaseModel):
    workers_online: int
    workers: List[WorkerInfo]
    active_tasks: int
    scheduled_tasks: int
    reserved_tasks: int


class TaskInfo(BaseModel):
    id: str
    name: str | None
    state: str
    args: List[Any] | None = None
    kwargs: Dict[str, Any] | None = None
    result: Any | None = None
    error: str | None = None
    traceback: str | None = None
    started_at: str | None = None
    completed_at: str | None = None


@router.get("/overview", response_model=TaskOverview)
async def get_tasks_overview(current_admin: dict = Depends(get_current_admin)):
    """
    Get overview of Celery task queue and workers
    Shows worker status and task counts
    """
    inspect = get_celery_inspect()

    # Get worker info
    ping_result = inspect.ping() or {}
    active_result = inspect.active() or {}
    scheduled_result = inspect.scheduled() or {}
    reserved_result = inspect.reserved() or {}
    stats_result = inspect.stats() or {}

    workers = []
    total_active = 0
    total_scheduled = 0
    total_reserved = 0

    for worker_name in ping_result.keys():
        active_tasks = active_result.get(worker_name, [])
        worker_stats = stats_result.get(worker_name, {})

        workers.append(
            WorkerInfo(
                name=worker_name,
                status="online",
                active_tasks=len(active_tasks),
                processed=worker_stats.get("total", {}).get(
                    "tasks.task_completed", None
                ),
                concurrency=worker_stats.get("pool", {}).get("max-concurrency", None),
            )
        )
        total_active += len(active_tasks)

    for tasks in scheduled_result.values():
        total_scheduled += len(tasks)

    for tasks in reserved_result.values():
        total_reserved += len(tasks)

    return TaskOverview(
        workers_online=len(workers),
        workers=workers,
        active_tasks=total_active,
        scheduled_tasks=total_scheduled,
        reserved_tasks=total_reserved,
    )


@router.get("/workers")
async def get_workers_detail(current_admin: dict = Depends(get_current_admin)):
    """
    Get detailed worker information
    """
    inspect = get_celery_inspect()

    return {
        "ping": inspect.ping() or {},
        "stats": inspect.stats() or {},
        "registered": inspect.registered() or {},
        "active_queues": inspect.active_queues() or {},
    }


@router.get("/active")
async def get_active_tasks(current_admin: dict = Depends(get_current_admin)):
    """
    Get currently executing tasks
    """
    inspect = get_celery_inspect()
    active = inspect.active() or {}

    tasks = []
    for worker_name, worker_tasks in active.items():
        for task in worker_tasks:
            tasks.append(
                {
                    "worker": worker_name,
                    "id": task.get("id"),
                    "name": task.get("name"),
                    "args": task.get("args"),
                    "kwargs": task.get("kwargs"),
                    "time_start": task.get("time_start"),
                }
            )

    return {"count": len(tasks), "tasks": tasks}


# Beat schedule (mirrors main API celery_app.conf.beat_schedule - for admin display)
BEAT_SCHEDULE_ENTRIES = [
    {"name": "generate-weekly-recaps", "task": "generate_weekly_recaps", "schedule_human": "Mondays 8:00 UTC"},
    {"name": "precreate-daily-checkins", "task": "precreate_daily_checkins", "schedule_human": "Every hour"},
    {"name": "mark-missed-checkins", "task": "mark_missed_checkins", "schedule_human": "Every hour"},
    {"name": "send-scheduled-ai-motivations", "task": "send_scheduled_ai_motivations", "schedule_human": "Every minute"},
    {"name": "send-morning-motivations", "task": "send_morning_motivations", "schedule_human": "Every minute"},
    {"name": "send-checkin-prompts", "task": "send_checkin_prompts", "schedule_human": "Every minute"},
    {"name": "send-checkin-followups", "task": "send_checkin_followups", "schedule_human": "Every minute"},
    {"name": "send-reengagement-notifications", "task": "send_reengagement_notifications", "schedule_human": "Daily 3:00 UTC"},
    {"name": "notify-inactive-partners", "task": "notify_inactive_partners", "schedule_human": "Daily 3:00 UTC"},
    {"name": "reset-missed-streaks", "task": "reset_missed_streaks", "schedule_human": "Every hour"},
    {"name": "reset-weekly-completions", "task": "reset_weekly_completions", "schedule_human": "Monday 0:00 UTC"},
    {"name": "refresh-analytics-views", "task": "refresh_analytics_views", "schedule_human": "Every hour"},
    {"name": "prewarm-analytics-cache", "task": "prewarm_analytics_cache_task", "schedule_human": "Every 8h (0, 8, 16 UTC)"},
    {"name": "check-expiring-subscriptions", "task": "check_expiring_subscriptions", "schedule_human": "Daily 3:00 UTC"},
    {"name": "process-failed-webhook-events", "task": "process_failed_webhook_events", "schedule_human": "Every 5 minutes"},
    {"name": "cleanup-expired-partner-requests", "task": "cleanup_expired_partner_requests", "schedule_human": "Daily 3:00 UTC"},
    {"name": "cleanup-inactive-user-partnerships", "task": "cleanup_inactive_user_partnerships", "schedule_human": "Daily 3:00 UTC"},
    {"name": "enforce-free-tier-limits", "task": "enforce_free_tier_limits", "schedule_human": "Daily 3:00 UTC"},
    {"name": "downgrade-expired-promotional-subscriptions", "task": "downgrade_expired_promotional_subscriptions", "schedule_human": "Daily 3:00 UTC"},
    {"name": "cleanup-expired-refresh-tokens", "task": "cleanup_expired_refresh_tokens", "schedule_human": "Daily 3:00 UTC"},
    {"name": "check-account-age-achievements", "task": "check_account_age_achievements", "schedule_human": "Daily 3:00 UTC"},
    {"name": "cleanup-orphaned-notifications", "task": "cleanup_orphaned_notifications", "schedule_human": "Monday 0:00 UTC"},
    {"name": "cleanup-blocked-partnership-nudges", "task": "cleanup_blocked_partnership_nudges", "schedule_human": "Monday 0:00 UTC"},
    {"name": "check-streak-at-risk", "task": "check_streak_at_risk", "schedule_human": "2pm-8pm UTC, hourly"},
    {"name": "check-risky-day-warning", "task": "check_risky_day_warning", "schedule_human": "Every 15 minutes"},
    {"name": "check-missed-days-intervention", "task": "check_missed_days_intervention", "schedule_human": "Daily 10:00 UTC"},
    {"name": "check-approaching-milestone", "task": "check_approaching_milestone", "schedule_human": "Daily 9:00 UTC"},
    {"name": "cleanup-task-audit-log", "task": "cleanup_task_audit_log", "schedule_human": "Sunday 4:00 UTC"},
]


@router.get("/beat-schedule")
async def get_beat_schedule(current_admin: dict = Depends(get_current_admin)):
    """
    Get Celery Beat schedule (when tasks are due).
    Read-only display for admin portal.
    """
    return {"entries": BEAT_SCHEDULE_ENTRIES}


@router.get("/scheduled")
async def get_scheduled_tasks(current_admin: dict = Depends(get_current_admin)):
    """
    Get scheduled/pending tasks (from beat)
    """
    inspect = get_celery_inspect()
    scheduled = inspect.scheduled() or {}

    tasks = []
    for worker_name, worker_tasks in scheduled.items():
        for task in worker_tasks:
            tasks.append(
                {
                    "worker": worker_name,
                    "id": task.get("request", {}).get("id"),
                    "name": task.get("request", {}).get("name"),
                    "eta": task.get("eta"),
                    "priority": task.get("priority"),
                }
            )

    return {"count": len(tasks), "tasks": tasks}


@router.get("/failures")
async def get_task_failures(
    limit: int = Query(100, ge=1, le=500),
    task_name: Optional[str] = Query(None, description="Filter by task name"),
    current_admin: dict = Depends(get_current_admin),
):
    """
    Get persistent task failure log from task_audit_log table.
    Records are kept for 30 days (cleanup_task_audit_log runs weekly).
    """
    try:
        supabase = get_supabase_client()
        query = (
            supabase.table("task_audit_log")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
        )
        if task_name:
            query = query.eq("task_name", task_name)
        result = query.execute()
        rows = result.data or []
        return {"failures": rows, "count": len(rows)}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch task failures: {str(e)}",
        )


@router.delete("/failures/{record_id}")
async def delete_task_failure(
    record_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Delete a failure record from task_audit_log.
    Use when the error has been fixed and you want to clear it from the log.
    """
    try:
        supabase = get_supabase_client()
        result = (
            supabase.table("task_audit_log")
            .delete()
            .eq("id", record_id)
            .execute()
        )
        deleted = len(result.data or [])
        if deleted == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Failure record not found",
            )
        await log_admin_action(
            admin_user_id=current_admin["id"],
            action="delete_task_failure",
            resource_type="task_audit_log",
            resource_id=record_id,
            details={},
        )
        return {"message": "Deleted", "id": record_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete: {str(e)}",
        )


@router.get("/recent")
async def get_recent_task_logs(
    limit: int = Query(50, ge=1, le=200),
    current_admin: dict = Depends(get_current_admin),
):
    """
    Get recent task completion logs (success + failure) from Redis result backend.
    Scans celery-task-meta-* keys and returns tasks sorted by completion time.

    Note: Celery result_expires is typically 1 hour. Past records are not persisted.
    For long-term audit/debugging, consider adding a task_audit_log table.
    """
    try:
        import redis
        redis_url = settings.redis_connection_url
        if redis_url and "rediss://" in redis_url:
            client = redis.from_url(
                redis_url,
                decode_responses=True,
                ssl_cert_reqs=None,
            )
        else:
            client = redis.from_url(redis_url, decode_responses=True)

        pattern = f"{CELERY_KEY_PREFIX}*"
        logs: List[Dict[str, Any]] = []
        seen = 0
        max_scan = 500

        for key in client.scan_iter(match=pattern, count=100):
            seen += 1
            if seen > max_scan:
                break
            try:
                raw = client.get(key)
                if not raw:
                    continue
                meta = json.loads(raw) if isinstance(raw, str) else json.loads(raw.decode("utf-8"))
                status_val = meta.get("status")
                if status_val not in ("SUCCESS", "FAILURE"):
                    continue
                result_val = meta.get("result")
                # Tasks that return {success: False, error: "..."} are SUCCESS in Celery but logical failures
                if status_val == "SUCCESS" and _is_soft_failure(result_val):
                    status_val = "FAILURE"
                    result_val = result_val.get("error", str(result_val))
                task_id = key.replace(CELERY_KEY_PREFIX, "")
                date_done = meta.get("date_done")
                # name from result_extended; fallback for older records or different backends
                task_name = meta.get("name") or meta.get("task_name")
                logs.append({
                    "id": task_id,
                    "name": task_name,
                    "state": status_val,
                    "result": meta.get("result") if status_val == "SUCCESS" else None,
                    "error": str(result_val) if status_val == "FAILURE" else None,
                    "traceback": meta.get("traceback"),
                    "date_done": date_done,
                })
            except (json.JSONDecodeError, TypeError, KeyError):
                continue

        # Sort by date_done desc (most recent first)
        def sort_key(x: dict) -> str:
            d = x.get("date_done") or ""
            return d

        logs.sort(key=sort_key, reverse=True)
        return {"logs": logs[:limit], "count": len(logs[:limit])}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch recent logs: {str(e)}",
        )


@router.get("/{task_id}", response_model=TaskInfo)
async def get_task_detail(
    task_id: str, current_admin: dict = Depends(get_current_admin)
):
    """
    Get details of a specific task by ID
    """
    ar = AsyncResult(task_id, app=celery_app)
    state = ar.state
    res = ar.result
    # Tasks that return {success: False, error: "..."} are SUCCESS in Celery but logical failures
    if state == "SUCCESS" and _is_soft_failure(res):
        state = "FAILURE"
        error_msg = res.get("error", str(res)) if isinstance(res, dict) else str(res)
    else:
        error_msg = str(res) if state == "FAILURE" else None

    task_info = TaskInfo(
        id=task_id,
        name=ar.name,
        state=state,
        args=ar.args,
        kwargs=ar.kwargs,
        result=ar.result if state == "SUCCESS" else None,
        error=error_msg,
        traceback=ar.traceback if ar.failed() else None,
    )

    # Try to get timing info
    if hasattr(ar, "date_done") and ar.date_done:
        task_info.completed_at = ar.date_done.isoformat()

    return task_info


@router.post("/{task_id}/revoke")
async def revoke_task(
    task_id: str,
    terminate: bool = Query(False, description="Force terminate running task"),
    current_admin: dict = Depends(get_current_admin),
):
    """
    Revoke (cancel) a pending or running task
    Use terminate=true to force kill a running task
    """
    control = get_celery_control()

    try:
        control.revoke(task_id, terminate=terminate)

        # Log admin action
        await log_admin_action(
            admin_user_id=current_admin["id"],
            action="revoke_task",
            resource_type="celery_task",
            resource_id=task_id,
            details={"terminate": terminate},
        )

        return {
            "message": f"Task {task_id} revoked",
            "terminate": terminate,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to revoke task: {str(e)}",
        )


@router.post("/purge")
async def purge_queue(
    queue: str = Query("celery", description="Queue name to purge"),
    current_admin: dict = Depends(get_current_admin),
):
    """
    Purge all pending tasks from a queue
    WARNING: This cannot be undone!
    """
    control = get_celery_control()

    try:
        result = control.purge()

        # Log admin action
        await log_admin_action(
            admin_user_id=current_admin["id"],
            action="purge_queue",
            resource_type="celery_queue",
            resource_id=queue,
            details={"purged_count": result},
        )

        return {
            "message": f"Queue purged",
            "purged_count": result,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to purge queue: {str(e)}",
        )


@router.get("/registered/list")
async def get_registered_tasks(current_admin: dict = Depends(get_current_admin)):
    """
    Get list of all registered task names
    """
    inspect = get_celery_inspect()
    registered = inspect.registered() or {}

    # Flatten and deduplicate task names
    all_tasks = set()
    for worker_tasks in registered.values():
        all_tasks.update(worker_tasks)

    return {"tasks": sorted(list(all_tasks))}


class CatchupCheckinsRequest(BaseModel):
    start_date: str | None = None  # YYYY-MM-DD format (manual mode)
    end_date: str | None = None  # YYYY-MM-DD format (manual mode, optional)
    lookback_days: int | None = None  # Auto mode: days to look back (defaults to 7)


@router.post("/catchup-checkins")
async def trigger_catchup_checkins(
    request: CatchupCheckinsRequest,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Trigger catch-up task to backfill missing check-ins after maintenance/downtime.

    Can be used in two modes:
    1. **Auto mode** (recommended): Provide `lookback_days` or leave all fields null (defaults to 7 days)
       - Automatically detects missing check-ins for recent dates
       - Perfect when you don't know exact maintenance dates
    2. **Manual mode**: Provide `start_date` (and optionally `end_date`)
       - Use when you know exact dates that need backfilling

    This creates check-ins with status='pending' for all active goals where
    each date in the range is a scheduled day. The mark_missed_checkins_task
    (runs hourly) will immediately mark these as 'missed' since the days have
    already passed.

    Use this after maintenance to ensure analytics accurately reflect scheduled
    vs non-scheduled days.

    Args:
        start_date: Start date in YYYY-MM-DD format (manual mode)
        end_date: End date in YYYY-MM-DD format (manual mode, optional, defaults to yesterday)
        lookback_days: Number of days to look back (auto mode, optional, defaults to 7)

    Returns:
        Task ID and status
    """
    try:
        # Determine mode and prepare task args
        if request.lookback_days is not None or (
            request.start_date is None and request.end_date is None
        ):
            # Auto mode
            lookback = request.lookback_days if request.lookback_days is not None else 7
            task_kwargs = {"lookback_days": lookback}
            mode = "auto"
        else:
            # Manual mode
            if not request.start_date:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Either start_date or lookback_days must be provided",
                )
            task_kwargs = {"start_date": request.start_date}
            if request.end_date:
                task_kwargs["end_date"] = request.end_date
            mode = "manual"

        # Trigger the catch-up task
        task = celery_app.send_task(
            "catchup_missing_checkins",
            kwargs=task_kwargs,
        )

        # Log admin action
        await log_admin_action(
            admin_user_id=current_admin["id"],
            action="trigger_catchup_checkins",
            resource_type="celery_task",
            resource_id=task.id,
            details={
                "mode": mode,
                **task_kwargs,
            },
        )

        return {
            "message": f"Catch-up task triggered ({mode} mode)",
            "task_id": task.id,
            "mode": mode,
            **task_kwargs,
            "status": "PENDING",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to trigger catch-up task: {str(e)}",
        )
