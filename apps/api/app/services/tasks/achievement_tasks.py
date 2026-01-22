"""
FitNudge V2 - Achievement Tasks

Celery tasks for achievement unlocking.
"""

from typing import Dict, Any, Optional
from app.services.tasks.base import celery_app, get_supabase_client, logger


@celery_app.task(
    name="check_achievements",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def check_achievements_task(
    self,
    user_id: str,
    source_type: Optional[str] = None,
    source_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Celery task to check and unlock achievements for a user.

    Args:
        self: Celery task instance
        user_id: User ID
        source_type: Optional source type for metadata
        source_id: Optional source ID for metadata

    Returns:
        Dict with newly unlocked achievements
    """
    from app.services.achievement_service import achievement_service
    import asyncio

    try:
        # Run async achievement check in sync context
        try:
            loop = asyncio.get_event_loop()
            if loop.is_closed():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        newly_unlocked = loop.run_until_complete(
            achievement_service.check_and_unlock_achievements(
                user_id=user_id,
                source_type=source_type,
                source_id=source_id,
            )
        )

        # Send push notifications for each newly unlocked achievement
        if newly_unlocked:
            supabase = get_supabase_client()

            try:
                from app.services.expo_push_service import send_push_to_user_sync

                for achievement in newly_unlocked:
                    # Use correct field names from _unlock_achievement
                    badge_name = achievement.get("badge_name", "New Achievement")
                    badge_description = achievement.get(
                        "badge_description", "You've unlocked a new achievement!"
                    )
                    badge_key = achievement.get("badge_key", "")

                    try:
                        achievement_id = achievement.get("id")
                        # Use sync version for Celery consistency
                        notification_result = send_push_to_user_sync(
                            user_id=user_id,
                            title="🏆 Achievement Unlocked!",
                            body=f"{badge_name}"
                            + (f": {badge_description}" if badge_description else ""),
                            data={
                                "type": "achievement",
                                "achievementId": achievement_id,
                                "badgeKey": badge_key,
                                "deepLink": "/(user)/profile/achievements",
                            },
                            notification_type="achievement",
                            entity_type="achievement",
                            entity_id=achievement_id,
                        )

                        if notification_result.get("notification_id"):
                            print(
                                f"📬 Sent achievement push for '{badge_name}' to user {user_id}"
                            )
                    except Exception as push_error:
                        # Don't fail achievement unlock if push fails
                        logger.warning(
                            f"Failed to send achievement push for user {user_id}",
                            {
                                "error": str(push_error),
                                "badge_name": badge_name,
                                "user_id": user_id,
                            },
                        )

            except Exception as e:
                logger.warning(
                    f"Failed to send achievement notifications for user {user_id}",
                    {"error": str(e), "user_id": user_id},
                )

            # Notify partners of milestone achievements (PARTNER_MILESTONE notification)
            try:
                from app.services.social_notification_service import (
                    send_partner_notification,
                    SocialNotificationType,
                )

                # Get user's name for notification
                user_result = (
                    supabase.table("users")
                    .select("name")
                    .eq("id", user_id)
                    .maybe_single()
                    .execute()
                )
                user_name = (
                    user_result.data.get("name", "Your partner")
                    if user_result.data
                    else "Your partner"
                )

                # Batch fetch all partners (SCALABILITY: 1 query for all partners)
                partners_result = (
                    supabase.table("accountability_partners")
                    .select("user_id, partner_user_id")
                    .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
                    .eq("status", "accepted")
                    .execute()
                )

                partner_ids = set()
                for p in partners_result.data or []:
                    # Get the OTHER user in the partnership
                    if p["user_id"] == user_id:
                        partner_ids.add(p["partner_user_id"])
                    else:
                        partner_ids.add(p["user_id"])

                # Notify each partner about ALL achievements (batch message)
                if partner_ids and len(newly_unlocked) > 0:
                    # Build a summary message
                    if len(newly_unlocked) == 1:
                        achievement_msg = newly_unlocked[0].get(
                            "badge_name", "a new achievement"
                        )
                    else:
                        achievement_msg = f"{len(newly_unlocked)} new achievements"

                    for partner_id in partner_ids:
                        try:
                            loop.run_until_complete(
                                send_partner_notification(
                                    notification_type=SocialNotificationType.PARTNER_MILESTONE,
                                    recipient_id=partner_id,
                                    sender_id=user_id,
                                    sender_name=user_name,
                                    message=f"🏆 {user_name} unlocked {achievement_msg}!",
                                    entity_type="achievement",
                                    entity_id=newly_unlocked[0].get("id"),
                                    deep_link="/(user)/profile/partners",  # Partner can see their partner's dashboard
                                    supabase=supabase,
                                )
                            )
                        except Exception as partner_notify_error:
                            # Don't fail if partner notification fails
                            logger.warning(
                                f"Failed to notify partner {partner_id} of achievement",
                                {"error": str(partner_notify_error)},
                            )

            except Exception as e:
                logger.warning(
                    f"Failed to notify partners of achievements for user {user_id}",
                    {"error": str(e), "user_id": user_id},
                )

        return {
            "success": True,
            "unlocked_count": len(newly_unlocked),
            "achievements": newly_unlocked,
        }

    except Exception as e:
        logger.error(
            f"Failed to check achievements for user {user_id}",
            {
                "error": str(e),
                "user_id": user_id,
                "source_type": source_type,
                "source_id": source_id,
                "retry_count": self.request.retries,
            },
        )

        if self.request.retries >= self.max_retries:
            return {"success": False, "error": str(e)}

        raise self.retry(exc=e)


@celery_app.task(
    name="check_account_age_achievements",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def check_account_age_achievements_task(self) -> Dict[str, Any]:
    """
    Scheduled task to check account_age achievements for all users.
    Should run daily to unlock membership milestone achievements.

    This checks users who might have reached account age milestones
    (30, 90, 180, 365, 730, 1095, 1825 days).
    """
    from datetime import datetime, timedelta

    try:
        supabase = get_supabase_client()

        # Account age milestones (in days)
        milestones = [30, 90, 180, 365, 730, 1095, 1825]

        users_checked = 0
        achievements_unlocked = 0

        # For each milestone, find users who just reached it (within last 2 days buffer)
        for days in milestones:
            # Calculate the date range for users who reached this milestone
            target_date = datetime.utcnow() - timedelta(days=days)
            buffer_start = target_date - timedelta(days=1)
            buffer_end = target_date + timedelta(days=1)

            # Find users created within this window
            result = (
                supabase.table("users")
                .select("id")
                .gte("created_at", buffer_start.isoformat())
                .lte("created_at", buffer_end.isoformat())
                .execute()
            )

            users = result.data or []

            for user in users:
                user_id = user["id"]
                users_checked += 1

                # Trigger achievement check for this user
                try:
                    check_result = check_achievements_task.delay(
                        user_id=user_id,
                        source_type="account_age",
                        source_id=f"milestone_{days}",
                    )
                    if check_result:
                        achievements_unlocked += 1
                except Exception as e:
                    logger.warning(
                        f"Failed to check achievements for user {user_id}",
                        {"error": str(e)},
                    )

        logger.info(
            "Account age achievement check completed",
            {
                "users_checked": users_checked,
                "achievements_triggered": achievements_unlocked,
            },
        )

        return {
            "success": True,
            "users_checked": users_checked,
            "achievements_triggered": achievements_unlocked,
        }

    except Exception as e:
        logger.error(
            "Failed to run account age achievement check",
            {"error": str(e), "retry_count": self.request.retries},
        )

        if self.request.retries >= self.max_retries:
            return {"success": False, "error": str(e)}

        raise self.retry(exc=e)
