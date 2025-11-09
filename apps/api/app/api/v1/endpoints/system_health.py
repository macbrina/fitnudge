from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.health import (
    create_health_history_update,
    fetch_health_history,
    fetch_health_history_entry,
    HealthHistoryEntry,
    HealthHistoryUpdate,
    HealthUpdateStatus,
)

router = APIRouter()


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
