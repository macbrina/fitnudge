"""
Celery Task Monitoring Endpoints
Provides visibility into task queues, workers, and task status
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from celery.result import AsyncResult
from app.core.admin_auth import get_current_admin, log_admin_action
from app.core.celery_client import celery_app, get_celery_inspect, get_celery_control

router = APIRouter(prefix="/tasks", tags=["Task Monitoring"])


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


@router.get("/{task_id}", response_model=TaskInfo)
async def get_task_detail(
    task_id: str, current_admin: dict = Depends(get_current_admin)
):
    """
    Get details of a specific task by ID
    """
    result = AsyncResult(task_id, app=celery_app)

    task_info = TaskInfo(
        id=task_id,
        name=result.name,
        state=result.state,
        args=result.args,
        kwargs=result.kwargs,
        result=result.result if result.successful() else None,
        error=str(result.result) if result.failed() else None,
        traceback=result.traceback if result.failed() else None,
    )

    # Try to get timing info
    if hasattr(result, "date_done") and result.date_done:
        task_info.completed_at = result.date_done.isoformat()

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
