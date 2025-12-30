"""
Audio Preferences API Endpoints

Manages user audio preferences for workout music, coach voice, and sound effects.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field
from typing import Optional
from app.core.database import get_supabase_client
from app.core.flexible_auth import get_current_user
from app.services.logger import logger

router = APIRouter()


class AudioPreferencesResponse(BaseModel):
    """Audio preferences response model"""

    id: str
    user_id: str
    music_enabled: bool = True
    music_volume: float = 0.8
    shuffle_enabled: bool = True
    coach_voice_enabled: bool = True
    coach_voice_volume: float = 1.0
    sound_effects_enabled: bool = True
    sound_effects_volume: float = 1.0
    preferred_music_app: Optional[str] = None
    last_played_track_id: Optional[str] = None
    last_played_position_seconds: int = 0


class UpdateAudioPreferencesRequest(BaseModel):
    """Request to update audio preferences"""

    music_enabled: Optional[bool] = None
    music_volume: Optional[float] = Field(None, ge=0, le=1)
    shuffle_enabled: Optional[bool] = None
    coach_voice_enabled: Optional[bool] = None
    coach_voice_volume: Optional[float] = Field(None, ge=0, le=1)
    sound_effects_enabled: Optional[bool] = None
    sound_effects_volume: Optional[float] = Field(None, ge=0, le=1)
    preferred_music_app: Optional[str] = None
    last_played_track_id: Optional[str] = None
    last_played_position_seconds: Optional[int] = None


def create_default_audio_preferences(user_id: str) -> dict:
    """
    Create default audio preferences for a user.
    Called during user registration.

    Returns the created preferences or None if they already exist.
    """
    supabase = get_supabase_client()

    # Check if preferences already exist
    existing = (
        supabase.table("user_audio_preferences")
        .select("id")
        .eq("user_id", user_id)
        .execute()
    )

    if existing.data:
        logger.info(f"Audio preferences already exist for user {user_id}")
        return existing.data[0]

    # Create default preferences
    default_prefs = {
        "user_id": user_id,
        "music_enabled": True,
        "music_volume": 0.8,
        "shuffle_enabled": True,
        "coach_voice_enabled": True,
        "coach_voice_volume": 1.0,
        "sound_effects_enabled": True,
        "sound_effects_volume": 1.0,
        "preferred_music_app": "playlist",
    }

    result = supabase.table("user_audio_preferences").insert(default_prefs).execute()

    if result.data:
        return result.data[0]

    logger.error(f"Failed to create audio preferences for user {user_id}")
    return None


@router.get("", response_model=AudioPreferencesResponse)
async def get_audio_preferences(current_user: dict = Depends(get_current_user)):
    """
    Get current user's audio preferences.
    Creates default preferences if they don't exist.
    """
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    supabase = get_supabase_client()

    # Try to get existing preferences
    result = (
        supabase.table("user_audio_preferences")
        .select("*")
        .eq("user_id", user_id)
        .execute()
    )

    if result.data:
        return result.data[0]

    # Create default preferences if not found
    prefs = create_default_audio_preferences(user_id)
    if prefs:
        # Fetch the full record
        result = (
            supabase.table("user_audio_preferences")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        if result.data:
            return result.data[0]

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to get or create audio preferences",
    )


@router.patch("", response_model=AudioPreferencesResponse)
async def update_audio_preferences(
    updates: UpdateAudioPreferencesRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Update current user's audio preferences.
    Only updates fields that are provided (partial update).
    """
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    supabase = get_supabase_client()

    # Build update dict with only non-None values
    update_data = {k: v for k, v in updates.dict().items() if v is not None}

    if not update_data:
        # No updates provided, just return current preferences
        result = (
            supabase.table("user_audio_preferences")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        if result.data:
            return result.data[0]
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audio preferences not found",
        )

    # Add updated_at timestamp
    update_data["updated_at"] = "NOW()"

    # Upsert to handle case where preferences don't exist yet
    # First try update
    result = (
        supabase.table("user_audio_preferences")
        .update(update_data)
        .eq("user_id", user_id)
        .execute()
    )

    if result.data:
        return result.data[0]

    # If no rows updated, create default then update
    create_default_audio_preferences(user_id)

    result = (
        supabase.table("user_audio_preferences")
        .update(update_data)
        .eq("user_id", user_id)
        .execute()
    )

    if result.data:
        return result.data[0]

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to update audio preferences",
    )
