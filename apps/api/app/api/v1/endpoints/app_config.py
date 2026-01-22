"""
FitNudge V2 - App Configuration Endpoint

Public endpoint to fetch dynamic app configuration values.
No authentication required for public configs.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Dict, Optional, List

from app.core.database import get_supabase_client
from app.services.logger import logger

router = APIRouter()


class AppConfigItem(BaseModel):
    """Single configuration item"""

    key: str
    value: str
    category: str


class AppConfigResponse(BaseModel):
    """Response containing all public configuration values"""

    config: Dict[str, str]  # Key-value pairs for easy access
    items: List[AppConfigItem]  # Full items with category info


@router.get("/public", response_model=AppConfigResponse)
async def get_public_config():
    """
    Get all public app configuration values.

    No authentication required.

    Returns configuration as both:
    - A flat key-value dict for easy access
    - Full items with category info for filtering
    """
    try:
        supabase = get_supabase_client()

        result = (
            supabase.table("app_config")
            .select("key, value, category")
            .eq("is_public", True)
            .execute()
        )

        items = result.data or []

        # Transform to both formats
        config_dict = {item["key"]: item["value"] for item in items}
        config_items = [
            AppConfigItem(
                key=item["key"], value=item["value"], category=item["category"]
            )
            for item in items
        ]

        return AppConfigResponse(config=config_dict, items=config_items)

    except Exception as e:
        logger.error(f"Failed to fetch app config: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch app configuration",
        )


@router.get("/public/{category}", response_model=AppConfigResponse)
async def get_public_config_by_category(category: str):
    """
    Get public app configuration values filtered by category.

    No authentication required.

    Categories:
    - app_store_urls: iOS and Android store URLs
    - external_urls: Privacy policy, terms, help center, etc.
    """
    try:
        supabase = get_supabase_client()

        result = (
            supabase.table("app_config")
            .select("key, value, category")
            .eq("is_public", True)
            .eq("category", category)
            .execute()
        )

        items = result.data or []

        config_dict = {item["key"]: item["value"] for item in items}
        config_items = [
            AppConfigItem(
                key=item["key"], value=item["value"], category=item["category"]
            )
            for item in items
        ]

        return AppConfigResponse(config=config_dict, items=config_items)

    except Exception as e:
        logger.error(f"Failed to fetch app config for category {category}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch app configuration",
        )
