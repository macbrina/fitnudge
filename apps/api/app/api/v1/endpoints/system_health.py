import json
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.core.cache import get_redis_client
from app.core.health import (
    create_health_history_update,
    fetch_health_history,
    fetch_health_history_entry,
    build_health_report,
    HealthHistoryEntry,
    HealthHistoryUpdate,
    HealthStatus,
    HealthUpdateStatus,
)

router = APIRouter()

CACHE_KEY = "system_health:report"
CACHE_TTL_SECONDS = 120


async def _get_cached_health_report(api_version: str, force: bool = False) -> dict:
    redis_client = get_redis_client()

    if redis_client and not force:
        cached_report = redis_client.get(CACHE_KEY)
        if cached_report:
            try:
                return json.loads(cached_report)
            except json.JSONDecodeError:
                pass

    report = await build_health_report(api_version=api_version)
    report_payload = report.model_dump(mode="json")

    if redis_client:
        try:
            redis_client.setex(CACHE_KEY, CACHE_TTL_SECONDS, json.dumps(report_payload))
        except Exception:
            # Ignore cache storage errors; the live report is still returned
            pass

    return report_payload


async def read_health(request: Request, force: bool = False):
    """
    Return the cached system health report, refreshing it when necessary.
    Always returns 200 to avoid triggering "offline" status in UI for non-critical issues.
    The actual status is in the response body.
    """
    try:
        api_version = getattr(request.app, "version", "1.0.0")
        report_payload = await _get_cached_health_report(api_version, force=force)

        # Always return 200 - let the client interpret the status from the body
        # Only return 503 if the database (Supabase) is unreachable
        supabase_critical = False
        for check in report_payload.get("checks", []):
            if (
                check.get("component") == "supabase"
                and check.get("status") == "critical"
            ):
                supabase_critical = True
                break

        status_code = (
            status.HTTP_503_SERVICE_UNAVAILABLE
            if supabase_critical
            else status.HTTP_200_OK
        )

        return JSONResponse(content=report_payload, status_code=status_code)
    except Exception as e:
        # If health check itself fails, return degraded status (not 503)
        fallback_payload = {
            "status": "degraded",
            "version": getattr(request.app, "version", "1.0.0"),
            "environment": "unknown",
            "timestamp": None,
            "checks": [],
            "error": str(e),
        }
        return JSONResponse(content=fallback_payload, status_code=status.HTTP_200_OK)


@router.get("/health", summary="Get cached system health report")
async def cached_health(request: Request, force: bool = False):
    """
    Return the cached health report when available. Pass `force=true` to bypass
    the cache and rebuild the report.
    """

    return await read_health(request, force=force)


class HistoryUpdateRequest(BaseModel):
    status: HealthUpdateStatus
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=2000)


@router.get(
    "/history",
    response_model=list[HealthHistoryEntry],
    summary="Get recent system health history",
)
async def get_system_health_history(limit: int = Query(30, ge=1, le=200)):
    """
    Return a list of recent system health snapshots persisted by the backend.
    """

    try:
        history = await fetch_health_history(limit=limit)
    except Exception as exc:  # pragma: no cover - upstream failure
        raise HTTPException(
            status_code=500, detail="Unable to load system health history"
        ) from exc

    return history


@router.post(
    "/history/{history_id}/updates",
    response_model=HealthHistoryUpdate,
    summary="Create an update for a health incident",
)
async def add_system_health_update(history_id: str, payload: HistoryUpdateRequest):
    try:
        update = await create_health_history_update(
            history_id=history_id,
            status=payload.status,
            title=payload.title,
            description=payload.description,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - upstream failure
        raise HTTPException(
            status_code=500, detail="Unable to create health history update"
        ) from exc

    return update


@router.get(
    "/history/{history_id}",
    response_model=HealthHistoryEntry,
    summary="Get a specific health incident",
)
async def get_system_health_entry(history_id: str):
    try:
        entry = await fetch_health_history_entry(history_id)
    except Exception as exc:  # pragma: no cover - upstream failure
        raise HTTPException(
            status_code=500, detail="Unable to load incident details"
        ) from exc

    if entry is None:
        raise HTTPException(status_code=404, detail="Incident not found")

    return entry
