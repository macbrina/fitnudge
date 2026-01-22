"""
FitNudge V2 - Data Export API Endpoints

Handles user data export requests for GDPR compliance.
Exports are processed asynchronously and sent via email.

V2 Changes:
- V2 exports: profile, goals, check_ins, achievements, partners, notifications, subscriptions, daily_motivations, weekly_recaps, ai_coach_conversations
"""

from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import json

from app.core.database import get_supabase_client
from app.core.flexible_auth import get_current_user
from app.services.logger import logger
from app.services.email_service import EmailService

router = APIRouter()


class DataExportResponse(BaseModel):
    """Response model for data export request"""

    success: bool
    message: str
    export_id: Optional[str] = None


class DataExportStatusResponse(BaseModel):
    """Response model for export status check"""

    id: str
    status: str  # pending, processing, completed, failed
    created_at: str
    completed_at: Optional[str] = None
    download_url: Optional[str] = None
    expires_at: Optional[str] = None


async def generate_user_data_export(user_id: str, email: str, export_id: str):
    """
    Background task to generate user data export.
    Collects all user data and sends via email.

    V2 Tables exported:
    - users (profile)
    - goals
    - check_ins
    - user_achievements
    - accountability_partners
    - notification_preferences
    - subscriptions
    - daily_motivations
    - weekly_recaps
    - ai_coach_conversations (messages embedded in JSONB column)
    - social_nudges
    """
    supabase = get_supabase_client()

    try:
        # Update status to processing
        supabase.table("data_export_requests").update({"status": "processing"}).eq(
            "id", export_id
        ).execute()

        # Collect all user data
        user_data = {}

        # 1. User profile
        user_result = (
            supabase.table("users").select("*").eq("id", user_id).single().execute()
        )
        if user_result.data:
            # Remove sensitive fields
            profile = user_result.data.copy()
            profile.pop("password_hash", None)
            user_data["profile"] = profile

        # 2. Goals
        goals_result = (
            supabase.table("goals").select("*").eq("user_id", user_id).execute()
        )
        user_data["goals"] = goals_result.data or []

        # 3. Check-ins
        checkins_result = (
            supabase.table("check_ins").select("*").eq("user_id", user_id).execute()
        )
        user_data["check_ins"] = checkins_result.data or []

        # 4. Achievements
        achievements_result = (
            supabase.table("user_achievements")
            .select("*, achievement_types(*)")
            .eq("user_id", user_id)
            .execute()
        )
        user_data["achievements"] = achievements_result.data or []

        # 5. Partners
        partners_result = (
            supabase.table("accountability_partners")
            .select("*")
            .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
            .execute()
        )
        user_data["accountability_partners"] = partners_result.data or []

        # 6. Notification preferences
        notif_result = (
            supabase.table("notification_preferences")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        user_data["notification_preferences"] = (
            notif_result.data[0] if notif_result.data else None
        )

        # 7. Subscription history
        sub_result = (
            supabase.table("subscriptions").select("*").eq("user_id", user_id).execute()
        )
        user_data["subscriptions"] = sub_result.data or []

        # 8. Daily motivations
        motivations_result = (
            supabase.table("daily_motivations")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        user_data["daily_motivations"] = motivations_result.data or []

        # 9. Weekly recaps
        recaps_result = (
            supabase.table("weekly_recaps").select("*").eq("user_id", user_id).execute()
        )
        user_data["weekly_recaps"] = recaps_result.data or []

        # 10. AI Coach conversations (messages are embedded in the JSONB 'messages' column)
        conversations_result = (
            supabase.table("ai_coach_conversations")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        user_data["ai_coach_conversations"] = conversations_result.data or []

        # 11. Social nudges (sent and received)
        nudges_sent_result = (
            supabase.table("social_nudges")
            .select("*")
            .eq("sender_id", user_id)
            .execute()
        )
        nudges_received_result = (
            supabase.table("social_nudges")
            .select("*")
            .eq("recipient_id", user_id)
            .execute()
        )
        user_data["social_nudges"] = {
            "sent": nudges_sent_result.data or [],
            "received": nudges_received_result.data or [],
        }

        # 12. Device tokens (for reference)
        device_tokens_result = (
            supabase.table("device_tokens")
            .select("device_type, app_version, os_version, is_active, created_at")
            .eq("user_id", user_id)
            .execute()
        )
        user_data["device_tokens"] = device_tokens_result.data or []

        # Add metadata
        user_data["export_metadata"] = {
            "export_date": datetime.utcnow().isoformat(),
            "export_id": export_id,
            "user_id": user_id,
            "version": "V2",
        }

        # Convert to JSON string
        export_json = json.dumps(user_data, indent=2, default=str)

        # Send email with data
        email_service = EmailService()
        await email_service.send_data_export_email(
            to_email=email,
            user_name=user_data.get("profile", {}).get("name", "User"),
            export_data=export_json,
        )

        # Update status to completed
        supabase.table("data_export_requests").update(
            {"status": "completed", "completed_at": datetime.utcnow().isoformat()}
        ).eq("id", export_id).execute()

        logger.info(f"Data export completed for user {user_id}, export_id: {export_id}")

    except Exception as e:
        logger.error(f"Data export failed for user {user_id}: {str(e)}")

        # Update status to failed
        supabase.table("data_export_requests").update(
            {"status": "failed", "error_message": str(e)}
        ).eq("id", export_id).execute()


@router.post("/request", response_model=DataExportResponse)
async def request_data_export(
    background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)
):
    """
    Request a data export. The export will be processed in the background
    and sent to the user's email address.

    Rate limited: 1 request per 24 hours per user.
    """
    user_id = current_user.get("id")
    email = current_user.get("email")

    if not user_id or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )

    supabase = get_supabase_client()

    # Check for recent export requests (rate limiting - 1 per 24 hours)
    recent_exports = (
        supabase.table("data_export_requests")
        .select("*")
        .eq("user_id", user_id)
        .gte(
            "created_at",
            (
                datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            ).isoformat(),
        )
        .execute()
    )

    if recent_exports.data and len(recent_exports.data) > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="You can only request one data export per day. Please try again tomorrow.",
        )

    try:
        # Create export request record
        export_result = (
            supabase.table("data_export_requests")
            .insert({"user_id": user_id, "status": "pending", "email": email})
            .execute()
        )

        if not export_result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create export request",
            )

        export_id = export_result.data[0]["id"]

        # Add background task to generate export
        background_tasks.add_task(generate_user_data_export, user_id, email, export_id)

        return DataExportResponse(
            success=True,
            message="Your data export has been initiated. You will receive an email with your data shortly.",
            export_id=export_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to initiate data export for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initiate data export",
        )


@router.get("/status/{export_id}", response_model=DataExportStatusResponse)
async def get_export_status(
    export_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Check the status of a data export request.
    """
    user_id = current_user.get("id")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )

    supabase = get_supabase_client()

    result = (
        supabase.table("data_export_requests")
        .select("*")
        .eq("id", export_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Export request not found"
        )

    data = result.data
    return DataExportStatusResponse(
        id=data["id"],
        status=data["status"],
        created_at=data["created_at"],
        completed_at=data.get("completed_at"),
        download_url=data.get("download_url"),
        expires_at=data.get("expires_at"),
    )
