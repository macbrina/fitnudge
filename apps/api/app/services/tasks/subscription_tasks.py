"""
FitNudge - Subscription-related Celery Tasks

Tasks for managing subscription lifecycle:
- check_expiring_subscriptions_task: Warn users about subscriptions expiring soon
- process_failed_webhook_events_task: Retry failed RevenueCat webhooks
- enforce_free_tier_limits_task: Backup cleanup for missed expiration events
- cleanup_expired_partner_requests_task: Remove pending requests from expired users
- downgrade_expired_promotional_subscriptions_task: Downgrade users whose promo expired
  (RevenueCat does NOT send webhooks for promotional entitlement expiration)
"""

from datetime import datetime, timedelta
from typing import Optional
from app.core.celery_app import celery_app
from app.core.database import get_supabase_client
from app.services.logger import logger


@celery_app.task(
    name="check_expiring_subscriptions",
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

            # Get user's name for personalization
            user_result = (
                supabase.table("users")
                .select("id, name")
                .eq("id", user_id)
                .eq("status", "active")
                .single()
                .execute()
            )

            if not user_result.data:
                continue

            # Send warning notification using the push service
            # (push service handles device token lookup internally)
            try:
                from app.services.expo_push_service import send_push_to_user_sync

                # No goal/partner; push + deepLink enough — don't save to notification_history
                result = send_push_to_user_sync(
                    user_id=user_id,
                    title=f"Your {plan.title()} subscription expires in 3 days",
                    body="When it expires, some goals will be paused and you'll lose premium features. Tap to renew!",
                    data={
                        "type": "subscription_expiry_warning",
                        "plan": plan,
                        "expires_date": expires_date,
                        "deepLink": "/(user)/(tabs)/profile",
                    },
                    notification_type="subscription",
                    skip_preference_check=True,  # Critical - always send
                    save_to_notification_history=False,
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
    name="process_failed_webhook_events",
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

                        try:
                            loop = asyncio.get_event_loop()
                        except RuntimeError:
                            loop = asyncio.new_event_loop()
                            asyncio.set_event_loop(loop)

                        loop.run_until_complete(
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


@celery_app.task(
    name="enforce_free_tier_limits",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
)
def enforce_free_tier_limits_task(self) -> dict:
    """
    Daily task to enforce subscription limits for free users (V2).

    This is a BACKUP to webhooks - catches cases where:
    - RevenueCat EXPIRATION webhook was missed
    - Webhook processing failed
    - Manual subscription updates in database

    Runs handle_subscription_expiry_deactivation for ALL free users.
    This function handles:
    - Deactivating excess goals beyond active_goal_limit
    - Deleting pending partner requests (no accountability_partner_limit feature)

    The function is idempotent - calling it on a user within limits is a no-op.
    """
    import asyncio

    try:
        supabase = get_supabase_client()
        now = datetime.utcnow().isoformat()

        # Find all users on free plan
        # We run cleanup on ALL free users, not just those with excess items
        # handle_subscription_expiry_deactivation is idempotent
        free_users_result = (
            supabase.table("users").select("id, plan").eq("plan", "free").execute()
        )

        logger.info(
            f"[SUBSCRIPTION_CLEANUP] Found {len(free_users_result.data or [])} users on free plan"
        )

        # Also check expired subscriptions for logging
        expired_subscriptions = (
            supabase.table("subscriptions")
            .select("user_id, plan, status, expires_date")
            .or_(f"status.eq.expired,expires_date.lt.{now}")
            .execute()
        )

        logger.info(
            f"[SUBSCRIPTION_CLEANUP] Found {len(expired_subscriptions.data or [])} expired subscriptions"
        )

        cleaned_count = 0
        checked_count = 0
        no_action_count = 0

        from app.services.subscription_service import (
            handle_subscription_expiry_deactivation,
        )

        # Get or create event loop
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        # Process all free users
        for user in free_users_result.data or []:
            user_id = user["id"]
            checked_count += 1

            try:
                # Run full deactivation check - it's idempotent
                # Will deactivate excess goals and delete partner requests
                summary = loop.run_until_complete(
                    handle_subscription_expiry_deactivation(
                        supabase,
                        user_id,
                        "unknown",  # Previous plan unknown
                        reason="subscription_expired_cleanup",
                    )
                )

                # Check if any action was taken
                if (
                    summary["goals_deactivated"] > 0
                    or summary.get("partner_requests_deleted", 0) > 0
                ):
                    logger.info(
                        f"[SUBSCRIPTION_CLEANUP] Cleaned user {user_id}: {summary}"
                    )
                    cleaned_count += 1
                else:
                    no_action_count += 1

            except Exception as deactivation_error:
                logger.error(
                    f"[SUBSCRIPTION_CLEANUP] Error for user {user_id}: {deactivation_error}"
                )

        logger.info(
            f"[SUBSCRIPTION_CLEANUP] Completed: checked={checked_count}, cleaned={cleaned_count}, no_action={no_action_count}"
        )

        return {
            "status": "success",
            "checked": checked_count,
            "cleaned": cleaned_count,
            "no_action": no_action_count,
        }

    except Exception as e:
        logger.error(f"[SUBSCRIPTION_CLEANUP] Error: {e}")
        raise self.retry(exc=e)


@celery_app.task(
    name="downgrade_expired_promotional_subscriptions",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
)
def downgrade_expired_promotional_subscriptions_task(self) -> dict:
    """
    Downgrade users whose promotional subscriptions have expired.

    RevenueCat does NOT send webhooks when promotional entitlements expire
    (e.g. referral bonus days). This task finds subscriptions where:
    - status = 'active'
    - expires_date < now

    For each, it performs the same actions as the EXPIRATION webhook:
    - Update subscription status to 'expired'
    - Downgrade user to free plan
    - Reset AI Coach daily usage
    - Deactivate excess goals, delete pending partner requests
    - Send push notification
    - Notify partners of subscription change

    Runs daily. Catches both promotional and any missed paid-subscription expirations.
    """
    import asyncio

    try:
        supabase = get_supabase_client()
        now = datetime.utcnow().isoformat()

        # Find active subscriptions that have expired (expires_date in the past)
        expired_result = (
            supabase.table("subscriptions")
            .select("user_id, plan, expires_date")
            .eq("status", "active")
            .lt("expires_date", now)
            .execute()
        )

        expired_subscriptions = expired_result.data or []
        downgraded_count = 0

        if not expired_subscriptions:
            logger.info(
                "[PROMO_EXPIRY] No expired active subscriptions found"
            )
            return {
                "status": "success",
                "found": 0,
                "downgraded": 0,
            }

        logger.info(
            f"[PROMO_EXPIRY] Found {len(expired_subscriptions)} expired active subscriptions"
        )

        from app.services.subscription_service import (
            handle_subscription_expiry_deactivation,
            reset_ai_coach_daily_usage_on_downgrade,
        )

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        for sub in expired_subscriptions:
            user_id = sub["user_id"]
            previous_plan = sub.get("plan", "unknown")

            try:
                # 1. Update subscription status to expired
                supabase.table("subscriptions").update(
                    {
                        "status": "expired",
                        "auto_renew": False,
                        "updated_at": datetime.utcnow().isoformat(),
                    }
                ).eq("user_id", user_id).execute()

                # 2. Downgrade user to free plan
                supabase.table("users").update({"plan": "free"}).eq(
                    "id", user_id
                ).execute()

                # 3. Reset AI Coach daily usage
                loop.run_until_complete(
                    reset_ai_coach_daily_usage_on_downgrade(supabase, user_id)
                )

                # 4. Deactivate excess goals, delete pending partner requests
                summary = loop.run_until_complete(
                    handle_subscription_expiry_deactivation(
                        supabase,
                        user_id,
                        previous_plan,
                        reason="promotional_expired",
                    )
                )

                logger.info(
                    f"[PROMO_EXPIRY] Downgraded user {user_id}: {summary}"
                )

                # 5. Send push notification
                try:
                    from app.services.expo_push_service import (
                        send_push_to_user_sync,
                    )

                    goals_msg = ""
                    if summary.get("goals_deactivated", 0) > 0:
                        goals_msg = (
                            f"{summary['goals_deactivated']} goal(s) paused. "
                        )

                    send_push_to_user_sync(
                        user_id=user_id,
                        title="Subscription Expired",
                        body=f"{goals_msg}Your premium features are no longer active. Upgrade to reactivate them.",
                        data={
                            "type": "subscription_expired",
                            "previous_plan": previous_plan,
                            "goals_deactivated": summary.get(
                                "goals_deactivated", 0
                            ),
                            "deepLink": "/(user)/(tabs)/profile",
                        },
                        notification_type="subscription",
                        skip_preference_check=True,
                        save_to_notification_history=False,
                    )
                except Exception as notify_err:
                    logger.error(
                        f"[PROMO_EXPIRY] Failed to send expiry notification to {user_id}: {notify_err}"
                    )

                # 6. Notify partners of subscription change
                try:
                    from app.api.v1.endpoints.webhooks import (
                        notify_partners_of_subscription_change,
                    )

                    loop.run_until_complete(
                        notify_partners_of_subscription_change(
                            supabase, user_id
                        )
                    )
                except Exception as partner_err:
                    logger.warning(
                        f"[PROMO_EXPIRY] Failed to notify partners for {user_id}: {partner_err}"
                    )

                downgraded_count += 1

            except Exception as user_err:
                logger.error(
                    f"[PROMO_EXPIRY] Error downgrading user {user_id}: {user_err}"
                )
                # Continue with other users

        logger.info(
            f"[PROMO_EXPIRY] Completed: found={len(expired_subscriptions)}, downgraded={downgraded_count}"
        )

        return {
            "status": "success",
            "found": len(expired_subscriptions),
            "downgraded": downgraded_count,
        }

    except Exception as e:
        logger.error(f"[PROMO_EXPIRY] Error: {e}")
        raise self.retry(exc=e)


def _check_user_has_partner_feature(supabase, user_id: str) -> bool:
    """
    Check if a user has the accountability_partner_limit feature.
    Returns True if they can send/maintain partner requests, False otherwise.

    In V2, both free and premium users can have partners:
    - Free: 1 partner max
    - Premium: 3 partners max
    """
    try:
        # Get user's current plan
        user_result = (
            supabase.table("users").select("plan").eq("id", user_id).single().execute()
        )

        if not user_result.data:
            return False

        user_plan = user_result.data.get("plan", "free")

        # Check if the plan has accountability_partner_limit feature enabled
        feature_result = (
            supabase.table("plan_features")
            .select("is_enabled, feature_value")
            .eq("plan_id", user_plan)
            .eq("feature_key", "accountability_partner_limit")
            .single()
            .execute()
        )

        if not feature_result.data:
            return False

        # Check if feature is enabled and has a limit > 0
        is_enabled = feature_result.data.get("is_enabled", False)
        feature_value = feature_result.data.get("feature_value")

        # feature_value of None means unlimited, any positive number means limited
        return is_enabled and (feature_value is None or feature_value > 0)

    except Exception as e:
        logger.error(
            f"Error checking accountability_partner_limit for user {user_id}: {e}"
        )
        return False


@celery_app.task(
    name="cleanup_expired_partner_requests",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
)
def cleanup_expired_partner_requests_task(self) -> dict:
    """
    Daily task to delete pending partner requests from users who no longer have accountability_partner_limit.

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
                    senders_checked[sender_id] = _check_user_has_partner_feature(
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


@celery_app.task(
    name="cleanup_inactive_user_partnerships",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
)
def cleanup_inactive_user_partnerships_task(self) -> dict:
    """
    Daily task to clean up partnerships involving inactive users.

    When a user's status changes to disabled/suspended (but not deleted),
    their partnerships should be removed so they don't appear in partner lists.

    This handles the case where:
    - Admin suspends/disables a user account
    - User deactivates their own account
    - CASCADE DELETE doesn't trigger (account not deleted, just status changed)

    The task:
    1. Finds all users with status != 'active' (disabled, suspended)
    2. Deletes their accepted partnerships (they shouldn't appear as partners)
    3. Deletes their pending partner requests (sent or received)

    This triggers realtime DELETE events on accountability_partners,
    which causes partner lists to refresh on the frontend.
    """
    from app.services.cleanup_service import (
        cleanup_partner_requests_batch_sync,
        CLEANUP_BATCH_SIZE,
    )

    try:
        supabase = get_supabase_client()

        # Find inactive users (not active status)
        inactive_users_result = (
            supabase.table("users")
            .select("id, status")
            .in_("status", ["disabled", "suspended"])
            .execute()
        )

        inactive_user_ids = [u["id"] for u in (inactive_users_result.data or [])]

        if not inactive_user_ids:
            logger.info("[INACTIVE_USER_CLEANUP] No inactive users found")
            return {
                "status": "success",
                "inactive_users": 0,
                "partnerships_deleted": 0,
            }

        logger.info(
            f"[INACTIVE_USER_CLEANUP] Found {len(inactive_user_ids)} inactive users"
        )

        partnerships_deleted = 0

        # Process in batches to avoid hitting limits
        for i in range(0, len(inactive_user_ids), CLEANUP_BATCH_SIZE):
            batch_user_ids = inactive_user_ids[i : i + CLEANUP_BATCH_SIZE]

            # Find all partnerships involving these inactive users
            partnerships_result = (
                supabase.table("accountability_partners")
                .select("id")
                .or_(
                    ",".join(
                        [
                            f"user_id.eq.{uid},partner_user_id.eq.{uid}"
                            for uid in batch_user_ids
                        ]
                    )
                )
                .execute()
            )

            partnership_ids = [p["id"] for p in (partnerships_result.data or [])]

            if partnership_ids:
                # Delete partnerships in batch
                supabase.table("accountability_partners").delete().in_(
                    "id", partnership_ids
                ).execute()

                # Cleanup associated notifications
                cleanup_partner_requests_batch_sync(
                    supabase, partnership_ids, reason="user_account_inactive"
                )

                partnerships_deleted += len(partnership_ids)
                logger.info(
                    f"[INACTIVE_USER_CLEANUP] Deleted {len(partnership_ids)} partnerships for inactive users"
                )

        logger.info(
            f"[INACTIVE_USER_CLEANUP] Completed: inactive_users={len(inactive_user_ids)}, "
            f"partnerships_deleted={partnerships_deleted}"
        )

        return {
            "status": "success",
            "inactive_users": len(inactive_user_ids),
            "partnerships_deleted": partnerships_deleted,
        }

    except Exception as e:
        logger.error(f"[INACTIVE_USER_CLEANUP] Error: {e}")
        raise self.retry(exc=e)
