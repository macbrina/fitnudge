"""
V2 Onboarding API endpoints

Simplified onboarding for V2:
- Save user's motivation style
- No fitness profiles (removed in V2)
- No AI-generated goal suggestions (V2 uses simple templates)
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from app.core.flexible_auth import get_current_user
from app.core.database import get_supabase_client
from app.services.logger import logger

router = APIRouter(redirect_slashes=False)


# V2 Pydantic models
class OnboardingCompleteRequest(BaseModel):
    """Request to mark onboarding as complete and set preferences"""

    name: str = Field(..., description="User's first name")
    motivation_style: str = Field(
        default="supportive",
        description="AI buddy motivation style: supportive, tough_love, calm",
    )
    morning_motivation_enabled: bool = Field(
        default=True, description="Whether to send morning motivation messages"
    )
    morning_motivation_time: Optional[str] = Field(
        default="08:00", description="Time to send morning motivation (HH:MM format)"
    )


class OnboardingCompleteResponse(BaseModel):
    """Response after completing onboarding"""

    success: bool
    user_id: str
    first_name: str
    motivation_style: str
    morning_motivation_enabled: bool
    onboarding_completed: bool = True


@router.post("/complete", response_model=OnboardingCompleteResponse)
async def complete_onboarding(
    request: OnboardingCompleteRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """
    Complete user onboarding by saving preferences.

    This is called after the user:
    1. Signs up
    2. Enters their name
    3. Chooses motivation style
    4. Creates their first goal
    5. Enables notifications
    """
    try:
        user_id = current_user["id"]

        # Validate motivation style
        valid_styles = ["supportive", "tough_love", "calm"]
        if request.motivation_style not in valid_styles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid motivation_style. Must be one of: {valid_styles}",
            )

        # Update user profile in users table
        update_data = {
            "name": request.name,  # Display name column in users table
            "motivation_style": request.motivation_style,
            "morning_motivation_enabled": request.morning_motivation_enabled,
            "morning_motivation_time": request.morning_motivation_time,
            "onboarding_completed_at": "now()",
        }

        result = supabase.table("users").update(update_data).eq("id", user_id).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update user profile",
            )

        return OnboardingCompleteResponse(
            success=True,
            user_id=user_id,
            first_name=request.name,
            motivation_style=request.motivation_style,
            morning_motivation_enabled=request.morning_motivation_enabled,
            onboarding_completed=True,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error completing onboarding for user {current_user.get('id')}",
            {"error": str(e), "user_id": current_user.get("id")},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to complete onboarding",
        )


@router.get("/status")
async def get_onboarding_status(
    current_user: Dict[str, Any] = Depends(get_current_user),
    supabase=Depends(get_supabase_client),
):
    """
    Check if user has completed onboarding.
    Returns onboarding status and current preferences.
    """
    try:
        user_id = current_user["id"]

        result = (
            supabase.table("users")
            .select(
                "first_name, motivation_style, morning_motivation_enabled, onboarding_completed_at"
            )
            .eq("id", user_id)
            .single()
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        user = result.data
        onboarding_completed = user.get("onboarding_completed_at") is not None

        return {
            "onboarding_completed": onboarding_completed,
            "first_name": user.get("first_name"),
            "motivation_style": user.get("motivation_style", "supportive"),
            "morning_motivation_enabled": user.get("morning_motivation_enabled", True),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error getting onboarding status for user {current_user.get('id')}",
            {"error": str(e), "user_id": current_user.get("id")},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get onboarding status",
        )
