"""
Achievement Tasks

Celery tasks for achievement unlocking and challenge progress tracking.
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
        source_type: Optional source type ("goal" or "challenge") for metadata
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
                from app.services.expo_push_service import send_push_to_user

                for achievement in newly_unlocked:
                    # Use correct field names from _unlock_achievement
                    badge_name = achievement.get("badge_name", "New Achievement")
                    badge_description = achievement.get(
                        "badge_description", "You've unlocked a new achievement!"
                    )
                    badge_key = achievement.get("badge_key", "")

                    try:
                        achievement_id = achievement.get("id")
                        notification_result = loop.run_until_complete(
                            send_push_to_user(
                                user_id=user_id,
                                title="🏆 Achievement Unlocked!",
                                body=f"{badge_name}"
                                + (
                                    f": {badge_description}"
                                    if badge_description
                                    else ""
                                ),
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
    name="update_challenge_progress",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def update_challenge_progress_task(
    self, user_id: str, goal_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Celery task to update challenge progress for a user.

    Note: goal_id is kept for backward compatibility but not used.
    Challenge progress is updated for all challenges the user participates in.

    Args:
        self: Celery task instance
        user_id: User ID
        goal_id: Optional goal ID (not used, kept for compatibility)

    Returns:
        Dict with updated challenge data
    """
    from app.services.challenge_service import challenge_service
    import asyncio

    try:
        supabase = get_supabase_client()

        # Find all active challenges the user is participating in
        participants = (
            supabase.table("challenge_participants")
            .select("challenge_id")
            .eq("user_id", user_id)
            .execute()
        )

        if not participants.data:
            return {"success": True, "updated_challenges": 0}

        # Update progress for each challenge
        updated_count = 0
        loop = None
        try:
            loop = asyncio.get_event_loop()
            if loop.is_closed():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        for participant in participants.data:
            challenge_id = participant["challenge_id"]

            try:
                loop.run_until_complete(
                    challenge_service.update_participant_progress(
                        challenge_id=challenge_id,
                        user_id=user_id,
                    )
                )
                updated_count += 1
            except Exception as e:
                logger.warning(
                    f"Failed to update progress for challenge {challenge_id}",
                    {"error": str(e), "challenge_id": challenge_id, "user_id": user_id},
                )

        return {
            "success": True,
            "updated_challenges": updated_count,
        }

    except Exception as e:
        logger.error(
            f"Failed to update challenge progress for user {user_id}",
            {
                "error": str(e),
                "user_id": user_id,
                "retry_count": self.request.retries,
            },
        )

        if self.request.retries >= self.max_retries:
            return {"success": False, "error": str(e)}

        raise self.retry(exc=e)
