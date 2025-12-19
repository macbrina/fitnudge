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

            if push_token:
                # Send warning notification
                try:
                    from app.services.expo_push_service import send_push_message_sync

                    success = send_push_message_sync(
                        token=push_token,
                        title=f"Your {plan.title()} subscription expires in 3 days",
                        body="When it expires, some goals will be paused and you'll lose access to premium features. Tap to renew!",
                        data={
                            "type": "subscription_expiry_warning",
                            "user_id": user_id,
                            "plan": plan,
                            "expires_date": expires_date,
                        },
                    )
                    if success:
                        warned_count += 1
                except Exception as e:
                    logger.error(
                        f"Failed to send expiry warning to user {user_id}: {e}"
                    )

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

    NOTE: Challenge status is COMPUTED, not stored. It's derived from:
    - is_active=false -> cancelled
    - is_active=true, today < start_date -> upcoming
    - is_active=true, start_date <= today <= end_date -> active
    - is_active=true, today > end_date -> completed

    This task handles:
    1. Calculate final rankings when challenges complete (end_date passed)
    2. Mark rankings as "finalized" in metadata to avoid recalculating
    """
    try:
        supabase = get_supabase_client()
        today = datetime.utcnow().date().isoformat()

        stats = {
            "rankings_calculated": 0,
        }

        # Find challenges that have ended (today > end_date) and need final rankings
        # These are active challenges that have passed their end_date
        # and haven't been finalized yet (check metadata)
        ended_challenges = (
            supabase.table("challenges")
            .select("id, title, end_date, metadata")
            .eq("is_active", True)
            .not_.is_("end_date", "null")
            .lt("end_date", today)  # end_date is in the past
            .execute()
        )

        for challenge in ended_challenges.data or []:
            challenge_id = challenge["id"]
            metadata = challenge.get("metadata") or {}

            # Skip if already finalized
            if metadata.get("rankings_finalized"):
                continue

            # Calculate final rankings
            _calculate_final_rankings(supabase, challenge_id)

            # Mark as finalized in metadata
            updated_metadata = {**metadata, "rankings_finalized": True}
            supabase.table("challenges").update(
                {
                    "metadata": updated_metadata,
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).eq("id", challenge_id).execute()

            logger.info(f"Finalized rankings for challenge: {challenge['title']}")
            stats["rankings_calculated"] += 1

            # Send challenge completion notifications to participants
            _send_challenge_completion_notifications(
                supabase, challenge_id, challenge["title"]
            )

        return {
            "status": "success",
            **stats,
        }

    except Exception as e:
        logger.error(f"Error in challenge lifecycle task: {e}")
        raise self.retry(exc=e)


def _send_challenge_cancelled_notification(
    supabase, creator_id: str, challenge_title: str, reason: str
):
    """Send push notification to challenge creator when their challenge is cancelled."""
    try:
        from app.services.expo_push_service import send_push_message_sync

        # Get creator's push token
        user_result = (
            supabase.table("users")
            .select("id, name, expo_push_token")
            .eq("id", creator_id)
            .single()
            .execute()
        )

        if not user_result.data:
            return

        push_token = user_result.data.get("expo_push_token")
        if not push_token:
            return

        # Customize message based on reason
        reason_messages = {
            "insufficient_participants": (
                "Your challenge was cancelled",
                f"'{challenge_title}' was auto-cancelled because not enough people joined before the deadline. Try sharing it with more friends next time!",
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

        send_push_message_sync(
            token=push_token,
            title=title,
            body=body,
            data={
                "type": "challenge_cancelled",
                "challenge_title": challenge_title,
                "reason": reason,
            },
        )

        logger.info(f"Sent challenge cancellation notification to creator {creator_id}")

    except Exception as e:
        logger.error(
            f"Failed to send cancellation notification to creator {creator_id}: {e}"
        )


def _send_challenge_completion_notifications(
    supabase, challenge_id: str, challenge_title: str
):
    """Send push notifications to all participants when a challenge completes."""
    try:
        from app.services.expo_push_service import send_push_message_sync

        # Get all participants with their user info and points
        participants = (
            supabase.table("challenge_participants")
            .select("user_id, points, users!inner(id, name, expo_push_token)")
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
            user = participant.get("users", {})
            push_token = user.get("expo_push_token")
            user_id = participant.get("user_id")
            rank = rank_lookup.get(user_id, 0)
            points = participant.get("points", 0)

            if not push_token:
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
                success = send_push_message_sync(
                    token=push_token,
                    title=title,
                    body=body,
                    data={
                        "type": "challenge_completed",
                        "challenge_id": challenge_id,
                        "rank": rank,
                        "points": points,
                    },
                )
                if success:
                    notified_count += 1
            except Exception as e:
                logger.error(
                    f"Failed to send completion notification to user {participant['user_id']}: {e}"
                )

        logger.info(
            f"Sent challenge completion notifications to {notified_count} participants for challenge {challenge_id}"
        )

    except Exception as e:
        logger.error(
            f"Error sending challenge completion notifications for {challenge_id}: {e}"
        )


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

        # Mark all participants as completed
        for participant in participants.data:
            supabase.table("challenge_participants").update(
                {"completed_at": datetime.utcnow().isoformat()}
            ).eq("id", participant["id"]).execute()

        # Update final ranks in leaderboard
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
    - Are active (is_active=true)
    - Are upcoming (start_date > today)
    - Have passed their join_deadline
    - Have 0 or 1 participants (just the creator)

    These are cancelled (is_active=false) to keep the challenge list clean.

    NOTE: Status is computed, not stored:
    - is_active=false -> cancelled
    - is_active=true, today < start_date -> upcoming
    """
    try:
        supabase = get_supabase_client()
        today = datetime.utcnow().date().isoformat()

        # Find upcoming challenges past join deadline
        # Upcoming = is_active=true AND start_date > today
        past_deadline = (
            supabase.table("challenges")
            .select("id, title, created_by, join_deadline, start_date")
            .eq("is_active", True)
            .gt("start_date", today)  # upcoming (hasn't started)
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

            # Only cancel if no one joined (or just the creator)
            if participants_count <= 1:
                supabase.table("challenges").update(
                    {
                        "is_active": False,  # This makes status = cancelled
                        "cancelled_reason": "insufficient_participants",
                        "cancelled_at": datetime.utcnow().isoformat(),
                        "updated_at": datetime.utcnow().isoformat(),
                    }
                ).eq("id", challenge_id).execute()

                logger.info(f"Auto-cancelled abandoned challenge: {challenge['title']}")
                cancelled_count += 1

                # Send notification to creator about cancellation
                _send_challenge_cancelled_notification(
                    supabase,
                    creator_id=challenge["created_by"],
                    challenge_title=challenge["title"],
                    reason="insufficient_participants",
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
