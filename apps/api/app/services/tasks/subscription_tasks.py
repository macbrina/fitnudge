"""
Subscription-related Celery Tasks

Tasks for managing subscription lifecycle:
- check_expiring_subscriptions_task: Warn users about subscriptions expiring soon
- update_challenge_statuses_task: Transition challenge statuses (upcoming -> active -> completed)
- cleanup_abandoned_challenges_task: Cancel challenges with no participants after deadline

These tasks should run on a schedule (e.g., daily via Celery Beat).
"""

from datetime import datetime, timedelta
from typing import Optional
from app.core.celery_app import celery_app
from app.core.database import get_supabase_client
from app.services.logger import logger


@celery_app.task(
    name="subscription.check_expiring_subscriptions",
    bind=True,
    max_retries=3,
    default_retry_delay=300,  # 5 minutes
)
def check_expiring_subscriptions_task(self) -> dict:
    """
    Daily task to warn users about expiring subscriptions.

    Checks for subscriptions that:
    - Are currently active
    - Expire in 3 days
    - Have auto_renew = false (user won't renew)

    Sends push notification to affected users.
    """
    try:
        supabase = get_supabase_client()

        # Calculate date range for 3 days from now
        now = datetime.utcnow()
        three_days_from_now = now + timedelta(days=3)
        four_days_from_now = now + timedelta(days=4)

        # Find subscriptions expiring soon that won't auto-renew
        result = (
            supabase.table("subscriptions")
            .select("user_id, plan, expires_date, auto_renew")
            .eq("status", "active")
            .eq("auto_renew", False)
            .gte("expires_date", three_days_from_now.isoformat())
            .lt("expires_date", four_days_from_now.isoformat())
            .execute()
        )

        expiring_subscriptions = result.data or []
        warned_count = 0

        for subscription in expiring_subscriptions:
            user_id = subscription["user_id"]
            plan = subscription["plan"]
            expires_date = subscription["expires_date"]

            # Get user's push token
            user_result = (
                supabase.table("users")
                .select("id, name, expo_push_token")
                .eq("id", user_id)
                .single()
                .execute()
            )

            if not user_result.data:
                continue

            user = user_result.data
            push_token = user.get("expo_push_token")

            # Send warning notification (uses send_push_to_user_sync for notification_history)
            try:
                from app.services.expo_push_service import send_push_to_user_sync

                result = send_push_to_user_sync(
                    user_id=user_id,
                    title=f"Your {plan.title()} subscription expires in 3 days",
                    body="When it expires, some goals will be paused and you'll lose access to premium features. Tap to renew!",
                    data={
                        "type": "subscription_expiry_warning",
                        "plan": plan,
                        "expires_date": expires_date,
                        "deepLink": "/(user)/(tabs)",
                    },
                    notification_type="subscription",
                    # No entity_type/entity_id - subscription notifications are user-level
                )
                if result.get("delivered"):
                    warned_count += 1
            except Exception as e:
                logger.error(f"Failed to send expiry warning to user {user_id}: {e}")

        logger.info(f"Sent subscription expiry warnings to {warned_count} users")

        return {
            "status": "success",
            "total_expiring": len(expiring_subscriptions),
            "warned_count": warned_count,
        }

    except Exception as e:
        logger.error(f"Error checking expiring subscriptions: {e}")
        raise self.retry(exc=e)


@celery_app.task(
    name="subscription.update_challenge_statuses",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
)
def update_challenge_statuses_task(self) -> dict:
    """
    Hourly task to handle challenge lifecycle events.

    Challenge status is stored in the 'status' column:
    - 'cancelled' -> challenge was cancelled
    - 'upcoming' -> today < start_date
    - 'active' -> start_date <= today <= end_date
    - 'completed' -> today > end_date

    This task handles:
    1. Transition 'upcoming' challenges to 'active' when start_date arrives
    2. Transition 'active' challenges to 'completed' when end_date passes
    3. Calculate final rankings when challenges complete
    4. Mark rankings as "finalized" in metadata to avoid recalculating
    """
    try:
        supabase = get_supabase_client()
        today = datetime.utcnow().date().isoformat()

        stats = {
            "rankings_calculated": 0,
            "transitioned_to_active": 0,
            "transitioned_to_completed": 0,
            "cancelled_creator_expired": 0,
        }

        # Transition upcoming challenges to active when start_date arrives
        # BUT first check if creator still has challenge_create feature
        upcoming_challenges = (
            supabase.table("challenges")
            .select("id, title, start_date, created_by")
            .eq("status", "upcoming")
            .lte("start_date", today)  # start_date has arrived
            .execute()
        )

        for challenge in upcoming_challenges.data or []:
            creator_id = challenge.get("created_by")

            # Check if creator still has challenge_create feature
            if creator_id:
                has_access = _check_creator_has_challenge_access(supabase, creator_id)

                if not has_access:
                    # Creator lost subscription - cancel instead of activating
                    supabase.table("challenges").update(
                        {
                            "status": "cancelled",
                            "cancelled_reason": "creator_subscription_expired",
                            "cancelled_at": datetime.utcnow().isoformat(),
                            "updated_at": datetime.utcnow().isoformat(),
                        }
                    ).eq("id", challenge["id"]).execute()

                    # Cleanup pending invites and notifications (sync version for Celery task)
                    from app.services.cleanup_service import (
                        cleanup_challenge_invites_and_notifications_sync,
                    )

                    cleanup_challenge_invites_and_notifications_sync(
                        supabase, challenge["id"], reason="creator_subscription_expired"
                    )

                    logger.info(
                        f"Challenge cancelled (creator lost subscription): {challenge['title']}"
                    )
                    stats["cancelled_creator_expired"] += 1

                    # Notify creator
                    _send_challenge_cancelled_notification(
                        supabase,
                        creator_id=creator_id,
                        challenge_title=challenge["title"],
                        reason="creator_subscription_expired",
                        challenge_id=challenge["id"],
                    )

                    # Notify all participants' partners
                    _notify_challenge_participants_partners(
                        supabase, challenge["id"], "challenge_cancelled"
                    )
                    continue

            # Creator still has access - activate the challenge
            supabase.table("challenges").update(
                {
                    "status": "active",
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).eq("id", challenge["id"]).execute()

            # Cleanup pending invites and notifications (challenge started)
            from app.services.cleanup_service import (
                cleanup_challenge_invites_and_notifications_sync,
            )

            cleanup_challenge_invites_and_notifications_sync(
                supabase, challenge["id"], reason="activated"
            )

            logger.info(f"Challenge transitioned to active: {challenge['title']}")
            stats["transitioned_to_active"] += 1

        # Find active challenges that have ended and need to be completed
        ended_challenges = (
            supabase.table("challenges")
            .select("id, title, end_date, metadata")
            .eq("status", "active")
            .not_.is_("end_date", "null")
            .lt("end_date", today)  # end_date is in the past
            .execute()
        )

        for challenge in ended_challenges.data or []:
            challenge_id = challenge["id"]
            metadata = challenge.get("metadata") or {}

            # Skip if already finalized
            if metadata.get("rankings_finalized"):
                # Still need to update status to completed if not done
                continue

            # Calculate final rankings
            _calculate_final_rankings(supabase, challenge_id)

            # Mark as finalized in metadata and update status to completed
            updated_metadata = {**metadata, "rankings_finalized": True}
            supabase.table("challenges").update(
                {
                    "status": "completed",
                    "metadata": updated_metadata,
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).eq("id", challenge_id).execute()

            # Cleanup pending invites and notifications (challenge completed)
            cleanup_challenge_invites_and_notifications_sync(
                supabase, challenge_id, reason="completed"
            )

            logger.info(
                f"Challenge completed and rankings finalized: {challenge['title']}"
            )
            stats["rankings_calculated"] += 1
            stats["transitioned_to_completed"] += 1

            # Send challenge completion notifications to participants
            _send_challenge_completion_notifications(
                supabase, challenge_id, challenge["title"]
            )

            # Notify all participants' partners
            _notify_challenge_participants_partners(
                supabase, challenge_id, "challenge_completed"
            )

        return {
            "status": "success",
            **stats,
        }

    except Exception as e:
        logger.error(f"Error in challenge lifecycle task: {e}")
        raise self.retry(exc=e)


def _send_challenge_cancelled_notification(
    supabase,
    creator_id: str,
    challenge_title: str,
    reason: str,
    challenge_id: str = None,
):
    """Send push notification to challenge creator when their challenge is cancelled."""
    try:
        from app.services.expo_push_service import send_push_to_user_sync

        # Customize message based on reason
        reason_messages = {
            "no_participants": (
                "Challenge cancelled",
                f"'{challenge_title}' was cancelled because no one joined before the deadline.",
            ),
            "creator_subscription_expired": (
                "Challenge cancelled",
                f"'{challenge_title}' was cancelled because your subscription expired. Renew to create new challenges!",
            ),
        }

        title, body = reason_messages.get(
            reason,
            (
                "Challenge cancelled",
                f"'{challenge_title}' has been cancelled.",
            ),
        )

        result = send_push_to_user_sync(
            user_id=creator_id,
            title=title,
            body=body,
            data={
                "type": "challenge_cancelled",
                "challenge_title": challenge_title,
                "challengeId": challenge_id,
                "reason": reason,
                "deepLink": "/(user)/(tabs)/goals",
            },
            notification_type="challenge",
            entity_type="challenge" if challenge_id else None,
            entity_id=challenge_id,
        )

        if result.get("delivered"):
            logger.info(
                f"Sent challenge cancellation notification to creator {creator_id}"
            )

    except Exception as e:
        logger.error(
            f"Failed to send cancellation notification to creator {creator_id}: {e}"
        )


def _send_challenge_completion_notifications(
    supabase, challenge_id: str, challenge_title: str
):
    """Send push notifications to all participants when a challenge completes."""
    try:
        from app.services.expo_push_service import send_push_to_user_sync

        # Get all participants with their user info and points
        participants = (
            supabase.table("challenge_participants")
            .select("user_id, points")
            .eq("challenge_id", challenge_id)
            .execute()
        )

        if not participants.data:
            return

        # Get leaderboard for ranks
        leaderboard = (
            supabase.table("challenge_leaderboard")
            .select("user_id, rank")
            .eq("challenge_id", challenge_id)
            .execute()
        )
        rank_lookup = {
            entry["user_id"]: entry["rank"] for entry in (leaderboard.data or [])
        }

        notified_count = 0

        for participant in participants.data:
            user_id = participant.get("user_id")
            rank = rank_lookup.get(user_id, 0)
            points = participant.get("points", 0)

            if not user_id:
                continue

            # Customize message based on rank
            if rank == 1:
                title = "🏆 You Won!"
                body = f"Congratulations! You finished 1st in '{challenge_title}' with {points} points!"
            elif rank == 2:
                title = "🥈 2nd Place!"
                body = f"Amazing! You finished 2nd in '{challenge_title}' with {points} points!"
            elif rank == 3:
                title = "🥉 3rd Place!"
                body = f"Great job! You finished 3rd in '{challenge_title}' with {points} points!"
            else:
                title = "🎉 Challenge Complete!"
                body = f"You finished #{rank} in '{challenge_title}' with {points} points. Great effort!"

            try:
                result = send_push_to_user_sync(
                    user_id=user_id,
                    title=title,
                    body=body,
                    data={
                        "type": "challenge_completed",
                        "challengeId": challenge_id,
                        "rank": rank,
                        "points": points,
                        "deepLink": f"/(user)/challenges/{challenge_id}",
                    },
                    notification_type="challenge",
                    entity_type="challenge",
                    entity_id=challenge_id,
                )
                if result.get("delivered"):
                    notified_count += 1
            except Exception as e:
                logger.error(
                    f"Failed to send completion notification to user {user_id}: {e}"
                )

        logger.info(
            f"Sent challenge completion notifications to {notified_count} participants for challenge {challenge_id}"
        )

    except Exception as e:
        logger.error(
            f"Error sending challenge completion notifications for {challenge_id}: {e}"
        )


def _notify_challenge_participants_partners(
    supabase, challenge_id: str, change_type: str
):
    """
    Notify all challenge participants' accountability partners.
    Used when a challenge status changes (completed, cancelled, etc.)
    """
    try:
        # Get all participant user IDs
        participants = (
            supabase.table("challenge_participants")
            .select("user_id")
            .eq("challenge_id", challenge_id)
            .execute()
        )
        
        if not participants.data:
            return
        
        user_ids = [p["user_id"] for p in participants.data if p.get("user_id")]
        
        if user_ids:
            from app.services.social_accountability_service import social_accountability_service
            social_accountability_service.notify_partners_for_multiple_users_sync(
                user_ids, change_type
            )
    except Exception as e:
        logger.warning(f"Failed to notify participants' partners for challenge {challenge_id}: {e}")


def _calculate_final_rankings(supabase, challenge_id: str):
    """Calculate and store final rankings for a completed challenge."""
    try:
        # Get all participants (membership)
        participants = (
            supabase.table("challenge_participants")
            .select("id, user_id")
            .eq("challenge_id", challenge_id)
            .execute()
        )

        # Get all leaderboard entries (scoring data)
        leaderboard_entries = (
            supabase.table("challenge_leaderboard")
            .select("user_id, points")
            .eq("challenge_id", challenge_id)
            .order("points", desc=True)
            .execute()
        )

        if not participants.data:
            return

        # SCALABILITY: Batch update all participants at once
        participant_ids = [p["id"] for p in participants.data]
        if participant_ids:
            supabase.table("challenge_participants").update(
                {"completed_at": datetime.utcnow().isoformat()}
            ).in_("id", participant_ids).execute()

        # Update final ranks in leaderboard
        # Note: Rank updates need individual calls since each has different rank value
        # For scale, we could use a stored procedure or batch update with CASE
        for rank_position, entry in enumerate(leaderboard_entries.data or [], start=1):
            supabase.table("challenge_leaderboard").update({"rank": rank_position}).eq(
                "challenge_id", challenge_id
            ).eq("user_id", entry["user_id"]).execute()

        # Store winner info in challenge metadata
        winner = leaderboard_entries.data[0] if leaderboard_entries.data else None
        challenge_result = (
            supabase.table("challenges")
            .select("metadata")
            .eq("id", challenge_id)
            .single()
            .execute()
        )
        current_metadata = (
            challenge_result.data.get("metadata") or {} if challenge_result.data else {}
        )
        updated_metadata = {
            **current_metadata,
            "winner_user_id": winner["user_id"] if winner else None,
            "winner_points": winner["points"] if winner else 0,
            "total_participants": len(participants.data),
        }

        supabase.table("challenges").update(
            {
                "metadata": updated_metadata,
                "updated_at": datetime.utcnow().isoformat(),
            }
        ).eq("id", challenge_id).execute()

        winner_id = winner["user_id"] if winner else "none"
        logger.info(
            f"Calculated final rankings for challenge {challenge_id}, winner: {winner_id}"
        )

    except Exception as e:
        logger.error(
            f"Error calculating final rankings for challenge {challenge_id}: {e}"
        )


@celery_app.task(
    name="subscription.cleanup_abandoned_challenges",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
)
def cleanup_abandoned_challenges_task(self) -> dict:
    """
    Daily task to cleanup challenges that:
    - Are upcoming (status = 'upcoming')
    - Have passed their join_deadline
    - Have 0 participants (completely abandoned)

    Challenges with at least 1 participant (even just the creator) will proceed.
    The creator can manually cancel if they don't want to continue alone.
    """
    try:
        supabase = get_supabase_client()
        today = datetime.utcnow().date().isoformat()

        # Find upcoming challenges past join deadline
        past_deadline = (
            supabase.table("challenges")
            .select("id, title, created_by, join_deadline, start_date")
            .eq("status", "upcoming")
            .not_.is_("join_deadline", "null")
            .lt("join_deadline", today)  # past join deadline
            .execute()
        )

        cancelled_count = 0

        for challenge in past_deadline.data or []:
            challenge_id = challenge["id"]

            # Count participants for this challenge
            participants_result = (
                supabase.table("challenge_participants")
                .select("id", count="exact")
                .eq("challenge_id", challenge_id)
                .execute()
            )
            participants_count = participants_result.count or 0

            # Only cancel if absolutely no one joined (completely abandoned)
            # Challenges with at least 1 participant (creator or others) will proceed
            if participants_count == 0:
                supabase.table("challenges").update(
                    {
                        "status": "cancelled",
                        "cancelled_reason": "no_participants",
                        "cancelled_at": datetime.utcnow().isoformat(),
                        "updated_at": datetime.utcnow().isoformat(),
                    }
                ).eq("id", challenge_id).execute()

                # Cleanup pending invites and notifications
                from app.services.cleanup_service import (
                    cleanup_challenge_invites_and_notifications_sync,
                )

                cleanup_challenge_invites_and_notifications_sync(
                    supabase, challenge_id, reason="no_participants"
                )

                logger.info(
                    f"Auto-cancelled abandoned challenge (no participants): {challenge['title']}"
                )
                cancelled_count += 1

                # Send notification to creator about cancellation
                _send_challenge_cancelled_notification(
                    supabase,
                    creator_id=challenge["created_by"],
                    challenge_title=challenge["title"],
                    reason="no_participants",
                    challenge_id=challenge["id"],
                )

                # Notify creator's partners (no participants to notify)
                from app.services.social_accountability_service import social_accountability_service
                if challenge.get("created_by"):
                    social_accountability_service.notify_partners_of_data_change_sync(
                        challenge["created_by"], "challenge_cancelled"
                    )

        return {
            "status": "success",
            "checked": len(past_deadline.data or []),
            "cancelled": cancelled_count,
        }

    except Exception as e:
        logger.error(f"Error cleaning up abandoned challenges: {e}")
        raise self.retry(exc=e)


@celery_app.task(
    name="subscription.process_failed_webhook_events",
    bind=True,
    max_retries=1,
)
def process_failed_webhook_events_task(self) -> dict:
    """
    Periodic task to retry failed webhook events.

    Checks for events that:
    - Have status = 'failed'
    - Have retry_count < 5
    - Were created more than 5 minutes ago

    Re-processes them using the subscription service.
    """
    try:
        supabase = get_supabase_client()

        # Find failed events that can be retried
        five_minutes_ago = (datetime.utcnow() - timedelta(minutes=5)).isoformat()

        failed_events = (
            supabase.table("webhook_events")
            .select("*")
            .eq("status", "failed")
            .lt("retry_count", 5)
            .lt("created_at", five_minutes_ago)
            .order("created_at", desc=False)
            .limit(10)
            .execute()
        )

        retried_count = 0
        success_count = 0

        for event in failed_events.data or []:
            event_id = event["event_id"]
            payload = event.get("payload", {})
            user_id = event.get("user_id")
            event_type = event.get("event_type")

            logger.info(f"Retrying failed webhook event: {event_id}")

            try:
                # Mark as processing
                supabase.table("webhook_events").update(
                    {
                        "status": "processing",
                        "updated_at": datetime.utcnow().isoformat(),
                    }
                ).eq("event_id", event_id).execute()

                # Re-process based on event type
                if event_type == "EXPIRATION" and user_id:
                    from app.services.subscription_service import (
                        handle_subscription_expiry_deactivation,
                    )

                    # Get user's current plan (might have been updated already)
                    user_result = (
                        supabase.table("users")
                        .select("plan")
                        .eq("id", user_id)
                        .single()
                        .execute()
                    )

                    previous_plan = (
                        user_result.data.get("plan", "free")
                        if user_result.data
                        else "free"
                    )

                    # Only process if not already on free
                    if previous_plan != "free":
                        import asyncio

                        asyncio.get_event_loop().run_until_complete(
                            handle_subscription_expiry_deactivation(
                                supabase, user_id, previous_plan, "subscription_expired"
                            )
                        )

                # Mark as completed
                supabase.table("webhook_events").update(
                    {
                        "status": "completed",
                        "processed_at": datetime.utcnow().isoformat(),
                        "updated_at": datetime.utcnow().isoformat(),
                    }
                ).eq("event_id", event_id).execute()

                success_count += 1

            except Exception as e:
                # Increment retry count
                supabase.table("webhook_events").update(
                    {
                        "status": "failed",
                        "retry_count": event["retry_count"] + 1,
                        "error_message": str(e),
                        "updated_at": datetime.utcnow().isoformat(),
                    }
                ).eq("event_id", event_id).execute()

                logger.error(f"Failed to retry event {event_id}: {e}")

            retried_count += 1

        return {
            "status": "success",
            "total_failed": len(failed_events.data or []),
            "retried": retried_count,
            "succeeded": success_count,
        }

    except Exception as e:
        logger.error(f"Error processing failed webhook events: {e}")
        raise self.retry(exc=e)


def _check_creator_has_challenge_access(supabase, creator_id: str) -> bool:
    """
    Check if a user has the challenge_create feature.
    Returns True if they can create/maintain challenges, False otherwise.
    """
    try:
        # Get user's current plan
        user_result = (
            supabase.table("users")
            .select("plan")
            .eq("id", creator_id)
            .single()
            .execute()
        )

        if not user_result.data:
            return False

        user_plan = user_result.data.get("plan", "free")

        # Free users don't have challenge_create
        if user_plan == "free":
            return False

        # Check if the plan has challenge_create feature enabled
        feature_result = (
            supabase.table("plan_features")
            .select("is_enabled")
            .eq("plan_id", user_plan)
            .eq("feature_key", "challenge_create")
            .single()
            .execute()
        )

        if not feature_result.data:
            return False

        return feature_result.data.get("is_enabled", False)

    except Exception as e:
        logger.error(f"Error checking challenge access for user {creator_id}: {e}")
        return False


@celery_app.task(
    name="subscription.cleanup_expired_subscription_goals",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
)
def cleanup_expired_subscription_goals_task(self) -> dict:
    """
    Daily task to deactivate excess goals for users with expired subscriptions.

    This catches cases where:
    - RevenueCat EXPIRATION webhook was missed
    - Webhook processing failed
    - Manual subscription updates in database

    Checks:
    - Users on 'free' plan with more than free tier active goals
    - Also checks subscriptions table for expired status
    """
    import asyncio

    try:
        supabase = get_supabase_client()
        now = datetime.utcnow().isoformat()

        # APPROACH 1: Find users on free plan directly (more reliable)
        # This catches ALL free users with excess goals, regardless of subscription table state
        free_users_result = (
            supabase.table("users").select("id, plan").eq("plan", "free").execute()
        )

        logger.info(
            f"[GOAL_CLEANUP] Found {len(free_users_result.data or [])} users on free plan"
        )

        # Also check expired subscriptions for logging
        expired_subscriptions = (
            supabase.table("subscriptions")
            .select("user_id, plan, status, expires_date")
            .or_(f"status.eq.expired,expires_date.lt.{now}")
            .execute()
        )

        logger.info(
            f"[GOAL_CLEANUP] Found {len(expired_subscriptions.data or [])} expired subscriptions"
        )

        cleaned_count = 0
        checked_count = 0
        skipped_count = 0

        # Get free tier goal limit ONCE
        from app.services.subscription_service import get_plan_limits

        free_limits = asyncio.get_event_loop().run_until_complete(
            get_plan_limits(supabase, "free")
        )
        active_goal_limit = free_limits.get("active_goal_limit", 1) or 1

        # Process all free users
        for user in free_users_result.data or []:
            user_id = user["id"]
            user_plan = user.get("plan", "free")
            checked_count += 1

            # Check if user has excess active goals
            active_goals_result = (
                supabase.table("goals")
                .select("id, title, created_at", count="exact")
                .eq("user_id", user_id)
                .eq("status", "active")
                .order("created_at", desc=False)
                .execute()
            )

            active_count = active_goals_result.count or 0
            active_goals = active_goals_result.data or []

            if active_count > active_goal_limit:
                # User has excess goals - deactivate them

                # Log which goals will be kept vs deactivated
                goals_to_keep = active_goals[:active_goal_limit]
                goals_to_deactivate = active_goals[active_goal_limit:]

                logger.info(
                    f"[GOAL_CLEANUP] Keeping goals: {[g['id'] for g in goals_to_keep]}"
                )
                logger.info(
                    f"[GOAL_CLEANUP] Deactivating goals: {[g['id'] for g in goals_to_deactivate]}"
                )

                from app.services.subscription_service import (
                    handle_subscription_expiry_deactivation,
                )

                try:
                    summary = asyncio.get_event_loop().run_until_complete(
                        handle_subscription_expiry_deactivation(
                            supabase,
                            user_id,
                            "unknown",  # Previous plan unknown
                            reason="subscription_expired_cleanup",
                        )
                    )
                    logger.info(
                        f"[GOAL_CLEANUP] Deactivation result for user {user_id}: {summary}"
                    )
                    cleaned_count += 1
                except Exception as deactivation_error:
                    logger.error(
                        f"[GOAL_CLEANUP] Error deactivating goals for user {user_id}: {deactivation_error}"
                    )
            else:
                skipped_count += 1
                logger.info(f"[GOAL_CLEANUP] User {user_id} within limit, skipping")

        logger.info(
            f"[GOAL_CLEANUP] Completed: checked={checked_count}, cleaned={cleaned_count}, skipped={skipped_count}"
        )

        return {
            "status": "success",
            "checked": checked_count,
            "cleaned": cleaned_count,
            "skipped": skipped_count,
            "free_tier_limit": active_goal_limit,
        }

    except Exception as e:
        logger.error(f"[GOAL_CLEANUP] Error: {e}")
        raise self.retry(exc=e)


@celery_app.task(
    name="subscription.cleanup_expired_creator_challenges",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
)
def cleanup_expired_creator_challenges_task(self) -> dict:
    """
    Daily task to cancel challenges where creator no longer has challenge_create feature.

    SCALABILITY: Uses pagination and batch operations for 100K+ users.
    - Fetches challenges in batches of 500
    - Groups by creator to minimize feature checks
    - Batch updates and batch cleanup

    This catches cases where:
    - Subscription expired between webhook and task runs
    - RevenueCat webhook was missed
    - Manual subscription cancellation in database

    Runs daily to ensure no orphaned challenges exist.
    """
    from app.services.cleanup_service import cleanup_challenges_batch_sync

    BATCH_SIZE = 500

    try:
        supabase = get_supabase_client()

        cancelled_count = 0
        checked_count = 0
        creators_checked = {}  # Cache: creator_id -> has_access
        offset = 0

        while True:
            # PAGINATION: Fetch challenges in batches
            batch = (
                supabase.table("challenges")
                .select("id, title, created_by")
                .in_("status", ["upcoming", "active"])
                .not_.is_("created_by", "null")
                .range(offset, offset + BATCH_SIZE - 1)
                .execute()
            )

            if not batch.data:
                break

            checked_count += len(batch.data)

            # Group challenges by creator for efficient processing
            challenges_by_creator = {}
            for challenge in batch.data:
                creator_id = challenge["created_by"]
                if creator_id not in challenges_by_creator:
                    challenges_by_creator[creator_id] = []
                challenges_by_creator[creator_id].append(challenge)

            # Check each unique creator once
            challenges_to_cancel = []
            for creator_id, creator_challenges in challenges_by_creator.items():
                if creator_id not in creators_checked:
                    creators_checked[creator_id] = _check_creator_has_challenge_access(
                        supabase, creator_id
                    )

                if not creators_checked[creator_id]:
                    challenges_to_cancel.extend(creator_challenges)

            # BATCH UPDATE: Cancel all invalid challenges at once
            if challenges_to_cancel:
                challenge_ids = [c["id"] for c in challenges_to_cancel]

                supabase.table("challenges").update(
                    {
                        "status": "cancelled",
                        "cancelled_reason": "creator_subscription_expired",
                        "cancelled_at": datetime.utcnow().isoformat(),
                        "updated_at": datetime.utcnow().isoformat(),
                    }
                ).in_("id", challenge_ids).execute()

                # BATCH CLEANUP: Cleanup invites/notifications for all at once
                cleanup_challenges_batch_sync(
                    supabase, challenge_ids, reason="creator_subscription_expired"
                )

                cancelled_count += len(challenge_ids)
                logger.info(
                    f"Batch cancelled {len(challenge_ids)} challenges (creator lost subscription)"
                )

                # Notify creators (still individual for personalized messages)
                for challenge in challenges_to_cancel:
                    _send_challenge_cancelled_notification(
                        supabase,
                        creator_id=challenge["created_by"],
                        challenge_title=challenge["title"],
                        reason="creator_subscription_expired",
                        challenge_id=challenge["id"],
                    )
                    # Notify all participants' partners
                    _notify_challenge_participants_partners(
                        supabase, challenge["id"], "challenge_cancelled"
                    )

            # If we got less than batch size, we're done
            if len(batch.data) < BATCH_SIZE:
                break

            offset += BATCH_SIZE

        logger.info(
            f"Expired creator cleanup: checked {checked_count}, cancelled {cancelled_count}"
        )

        return {
            "status": "success",
            "checked": checked_count,
            "cancelled": cancelled_count,
            "unique_creators_checked": len(creators_checked),
        }

    except Exception as e:
        logger.error(f"Error cleaning up expired creator challenges: {e}")
        raise self.retry(exc=e)


def _check_user_has_social_accountability(supabase, user_id: str) -> bool:
    """
    Check if a user has the social_accountability feature.
    Returns True if they can send/maintain partner requests, False otherwise.
    """
    try:
        # Get user's current plan
        user_result = (
            supabase.table("users").select("plan").eq("id", user_id).single().execute()
        )

        if not user_result.data:
            return False

        user_plan = user_result.data.get("plan", "free")

        # Free users don't have social_accountability
        if user_plan == "free":
            return False

        # Check if the plan has social_accountability feature enabled
        feature_result = (
            supabase.table("plan_features")
            .select("is_enabled")
            .eq("plan_id", user_plan)
            .eq("feature_key", "social_accountability")
            .single()
            .execute()
        )

        if not feature_result.data:
            return False

        return feature_result.data.get("is_enabled", False)

    except Exception as e:
        logger.error(f"Error checking social_accountability for user {user_id}: {e}")
        return False


@celery_app.task(
    name="subscription.cleanup_expired_partner_requests",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
)
def cleanup_expired_partner_requests_task(self) -> dict:
    """
    Daily task to delete pending partner requests from users who no longer have social_accountability.

    SCALABILITY: Uses pagination and batch operations for 100K+ users.
    - Fetches requests in batches of 500
    - Groups by sender to minimize feature checks
    - Batch deletes requests and notifications

    This catches cases where:
    - Subscription expired between webhook and task runs
    - RevenueCat webhook was missed
    - Manual subscription cancellation in database

    Only deletes PENDING requests where the sender (user_id) lost their feature.
    Accepted partnerships are kept (graceful degradation - they just can't use features).
    """
    from app.services.cleanup_service import (
        cleanup_partner_requests_batch_sync,
        CLEANUP_BATCH_SIZE,
    )

    try:
        supabase = get_supabase_client()

        deleted_count = 0
        checked_count = 0
        senders_checked = {}  # Cache: sender_id -> has_feature
        offset = 0

        while True:
            # PAGINATION: Fetch requests in batches
            batch = (
                supabase.table("accountability_partners")
                .select("id, user_id")
                .eq("status", "pending")
                .range(offset, offset + CLEANUP_BATCH_SIZE - 1)
                .execute()
            )

            if not batch.data:
                break

            checked_count += len(batch.data)

            # Group requests by sender for efficient processing
            requests_by_sender = {}
            for request in batch.data:
                sender_id = request["user_id"]
                if sender_id not in requests_by_sender:
                    requests_by_sender[sender_id] = []
                requests_by_sender[sender_id].append(request["id"])

            # Check each unique sender once
            requests_to_delete = []
            for sender_id, request_ids in requests_by_sender.items():
                if sender_id not in senders_checked:
                    senders_checked[sender_id] = _check_user_has_social_accountability(
                        supabase, sender_id
                    )

                if not senders_checked[sender_id]:
                    requests_to_delete.extend(request_ids)

            # BATCH DELETE: Delete all invalid requests at once
            if requests_to_delete:
                supabase.table("accountability_partners").delete().in_(
                    "id", requests_to_delete
                ).execute()

                # BATCH CLEANUP: Cleanup notifications for all deleted requests
                cleanup_partner_requests_batch_sync(
                    supabase, requests_to_delete, reason="sender_subscription_expired"
                )

                deleted_count += len(requests_to_delete)
                logger.info(
                    f"Batch deleted {len(requests_to_delete)} expired partner requests"
                )

            # If we got less than batch size, we're done
            if len(batch.data) < CLEANUP_BATCH_SIZE:
                break

            offset += CLEANUP_BATCH_SIZE

        logger.info(
            f"Expired partner request cleanup: checked {checked_count}, deleted {deleted_count}"
        )

        return {
            "status": "success",
            "checked": checked_count,
            "deleted": deleted_count,
            "unique_senders_checked": len(senders_checked),
        }

    except Exception as e:
        logger.error(f"Error cleaning up expired partner requests: {e}")
        raise self.retry(exc=e)


# =====================================================
# CHUNKED NOTIFICATION TASKS
# =====================================================
# These tasks process notifications in chunks for scalability


@celery_app.task(
    name="subscription.notify_challenge_cancelled_chunk",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def notify_challenge_cancelled_chunk_task(
    self,
    user_ids: list,
    challenge_id: str,
    challenge_title: str,
    reason: str,
) -> dict:
    """
    Process a chunk of cancellation notifications.

    SCALABILITY: Called by _notify_challenge_participants_cancelled
    for challenges with many participants (10+).
    """
    from app.services.subscription_service import _send_cancellation_notifications_sync

    try:
        supabase = get_supabase_client()

        notified = _send_cancellation_notifications_sync(
            supabase, user_ids, challenge_id, challenge_title, reason
        )

        return {
            "status": "success",
            "processed": len(user_ids),
            "notified": notified,
            "challenge_id": challenge_id,
        }

    except Exception as e:
        logger.error(
            f"Error in notification chunk task: {e}",
            {
                "challenge_id": challenge_id,
                "user_count": len(user_ids),
                "error": str(e),
            },
        )
        raise self.retry(exc=e)
