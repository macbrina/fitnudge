"""
App Version API Endpoints

Provides version checking for mobile apps to determine if updates are available.
This is a public endpoint - no authentication required.
"""

from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel
from typing import Optional, Literal
from app.core.database import get_supabase_client
from app.services.logger import logger

router = APIRouter()


class AppVersionResponse(BaseModel):
    """Response model for app version check"""

    latest_version: str
    minimum_version: str
    release_notes: Optional[str] = None
    force_update: bool = False
    update_url: Optional[str] = None


class AppVersionUpdateRequest(BaseModel):
    """Request to update app version (admin only)"""

    latest_version: Optional[str] = None
    minimum_version: Optional[str] = None
    release_notes: Optional[str] = None
    store_url: Optional[str] = None
    force_update: Optional[bool] = None


def compare_versions(v1: str, v2: str) -> int:
    """
    Compare two semantic version strings.
    Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
    """
    try:
        parts1 = [int(x) for x in v1.split(".")]
        parts2 = [int(x) for x in v2.split(".")]

        for i in range(max(len(parts1), len(parts2))):
            p1 = parts1[i] if i < len(parts1) else 0
            p2 = parts2[i] if i < len(parts2) else 0
            if p1 > p2:
                return 1
            if p1 < p2:
                return -1
        return 0
    except (ValueError, AttributeError):
        return 0


@router.get("/check", response_model=AppVersionResponse)
async def check_app_version(
    platform: Literal["ios", "android"] = Query(
        ..., description="The platform to check (ios or android)"
    ),
    current_version: str = Query(..., description="The current app version installed"),
):
    """
    Check if an app update is available.

    This is a public endpoint - no authentication required.

    Returns:
        - latest_version: The newest version available
        - minimum_version: The minimum required version
        - release_notes: Optional notes about the update
        - force_update: Whether user must update immediately
        - update_url: Optional custom store URL
    """
    supabase = get_supabase_client()

    try:
        result = (
            supabase.table("app_versions")
            .select("*")
            .eq("platform", platform)
            .single()
            .execute()
        )

        if not result.data:
            logger.warning(f"No app version found for platform: {platform}")
            # Return current version as latest if no record exists
            return AppVersionResponse(
                latest_version=current_version,
                minimum_version=current_version,
                force_update=False,
            )

        data = result.data

        # Check if force_update should be true based on minimum_version
        needs_force_update = data.get("force_update", False)
        if not needs_force_update:
            # Check if current version is below minimum
            min_version = data.get("minimum_version", "1.0.0")
            needs_force_update = compare_versions(min_version, current_version) > 0

        return AppVersionResponse(
            latest_version=data.get("latest_version", current_version),
            minimum_version=data.get("minimum_version", current_version),
            release_notes=data.get("release_notes"),
            force_update=needs_force_update,
            update_url=data.get("store_url"),
        )

    except Exception as e:
        logger.error(f"Error checking app version: {str(e)}")
        # Return safe defaults on error
        return AppVersionResponse(
            latest_version=current_version,
            minimum_version=current_version,
            force_update=False,
        )


@router.get("/{platform}", response_model=AppVersionResponse)
async def get_app_version(
    platform: Literal["ios", "android"],
):
    """
    Get app version info for a specific platform.

    This is a public endpoint for admin dashboard or other services.
    """
    supabase = get_supabase_client()

    try:
        result = (
            supabase.table("app_versions")
            .select("*")
            .eq("platform", platform)
            .single()
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No version info found for platform: {platform}",
            )

        data = result.data
        return AppVersionResponse(
            latest_version=data.get("latest_version", "1.0.0"),
            minimum_version=data.get("minimum_version", "1.0.0"),
            release_notes=data.get("release_notes"),
            force_update=data.get("force_update", False),
            update_url=data.get("store_url"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting app version: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get app version info",
        )
