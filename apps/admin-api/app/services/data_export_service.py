"""
Data Export Service for Admin API
Generates GDPR data exports. Same logic as main API - admin API runs this
for retries since apps/api and apps/admin-api are hosted separately.
"""

import json
from datetime import datetime

from app.core.database import get_supabase_client, first_row
from app.services.email_service import send_data_export_email


def run_generate_user_data_export(user_id: str, email: str, export_id: str) -> bool:
    """
    Sync implementation for Celery. Collects all user data and emails the JSON.
    Returns True if email was sent successfully, False otherwise.
    """
    supabase = get_supabase_client()

    try:
        supabase.table("data_export_requests").update({"status": "processing"}).eq(
            "id", export_id
        ).execute()

        user_data = {}

        # 1. User profile
        user_result = (
            supabase.table("users").select("*").eq("id", user_id).single().execute()
        )
        if user_result.data:
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
            first_row(notif_result.data) if notif_result.data else None
        )

        # 7. Subscriptions
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

        # 10. AI Coach conversations
        conversations_result = (
            supabase.table("ai_coach_conversations")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        user_data["ai_coach_conversations"] = conversations_result.data or []

        # 11. Social nudges
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

        # 12. Device tokens
        device_tokens_result = (
            supabase.table("device_tokens")
            .select("device_type, app_version, os_version, is_active, created_at")
            .eq("user_id", user_id)
            .execute()
        )
        user_data["device_tokens"] = device_tokens_result.data or []

        user_data["export_metadata"] = {
            "export_date": datetime.utcnow().isoformat(),
            "export_id": export_id,
            "user_id": user_id,
            "version": "V2",
        }

        export_json = json.dumps(user_data, indent=2, default=str)
        user_name = user_data.get("profile", {}).get("name", "User")

        success = send_data_export_email(
            to_email=email,
            user_name=user_name,
            export_data=export_json,
        )

        if success:
            supabase.table("data_export_requests").update(
                {"status": "completed", "completed_at": datetime.utcnow().isoformat()}
            ).eq("id", export_id).execute()
            return True
        else:
            supabase.table("data_export_requests").update(
                {"status": "failed", "error_message": "Failed to send email"}
            ).eq("id", export_id).execute()
            return False

    except Exception as e:
        supabase.table("data_export_requests").update(
            {"status": "failed", "error_message": str(e)}
        ).eq("id", export_id).execute()
        raise
