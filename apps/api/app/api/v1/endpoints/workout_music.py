"""
Workout Music API endpoints

Provides endpoints for fetching workout music tracks.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.core.database import get_supabase_client
from app.core.flexible_auth import get_current_user

router = APIRouter(prefix="/workout-music", tags=["Workout Music"])


class WorkoutMusicTrack(BaseModel):
    """Workout music track response model."""

    id: str
    title: str
    artist: Optional[str] = None
    duration_seconds: int
    file_url: str
    file_key: str
    file_size_bytes: Optional[int] = None
    bpm: Optional[int] = None
    genre: Optional[str] = None
    mood: Optional[str] = None
    is_active: bool
    sort_order: int
    created_at: str
    updated_at: str


class WorkoutMusicResponse(BaseModel):
    """Response for paginated music tracks."""

    tracks: List[WorkoutMusicTrack]
    total: int
    page: int
    page_size: int
    has_more: bool


@router.get("", response_model=WorkoutMusicResponse)
async def get_workout_music(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    mood: Optional[str] = Query(None, description="Filter by mood"),
    current_user: dict = Depends(get_current_user),
):
    """
    Get all active workout music tracks.

    Returns paginated list of music tracks that can be played during workouts.
    Music is stored on Cloudflare R2 CDN.
    """
    supabase = get_supabase_client()

    # Build query
    query = (
        supabase.table("workout_music")
        .select("*", count="exact")
        .eq("is_active", True)
        .order("sort_order", desc=False)
    )

    # Apply mood filter if provided
    if mood:
        query = query.eq("mood", mood)

    # Apply pagination
    offset = (page - 1) * page_size
    query = query.range(offset, offset + page_size - 1)

    result = query.execute()

    total = result.count or 0
    tracks = result.data or []
    has_more = offset + len(tracks) < total

    return WorkoutMusicResponse(
        tracks=[WorkoutMusicTrack(**track) for track in tracks],
        total=total,
        page=page,
        page_size=page_size,
        has_more=has_more,
    )


@router.get("/all", response_model=List[WorkoutMusicTrack])
async def get_all_workout_music(
    current_user: dict = Depends(get_current_user),
):
    """
    Get all active workout music tracks without pagination.

    Use this for loading the full playlist. Since music library is typically
    small (~20-50 tracks), this is more efficient than multiple paginated calls.
    """
    supabase = get_supabase_client()

    result = (
        supabase.table("workout_music")
        .select("*")
        .eq("is_active", True)
        .order("sort_order", desc=False)
        .execute()
    )

    return [WorkoutMusicTrack(**track) for track in result.data or []]
