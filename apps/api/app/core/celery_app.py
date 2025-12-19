"""
Celery Application Configuration

Celery task queue using Redis as broker and backend.
"""

from __future__ import annotations

import ssl
from typing import Dict, Optional

from celery import Celery
from app.core.config import settings


def _build_redis_ssl_options(url: str) -> Optional[Dict[str, int]]:
    """
    Celery requires explicit SSL options when connecting to Redis over TLS.
    Upstash supplies rediss:// URLs without extra parameters, so provide a
    sensible default to keep local development working.
    """

    if not url or not url.startswith("rediss://"):
        return None

    # Respect explicit ssl_cert_reqs in the URL if provided.
    if "ssl_cert_reqs" in url:
        return None

    return {"ssl_cert_reqs": ssl.CERT_NONE}


# Create Celery app instance
redis_url = settings.redis_connection_url
redis_ssl_options = _build_redis_ssl_options(redis_url)

celery_app = Celery(
    "fitnudge",
    broker=redis_url,
    backend=redis_url,
    include=["app.services.tasks"],  # Include task modules
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=60,  # 60 seconds max per task
    task_soft_time_limit=50,  # 50 seconds soft limit
    worker_prefetch_multiplier=1,  # Prefetch only one task at a time for better distribution
    worker_max_tasks_per_child=1000,  # Restart worker after 1000 tasks to prevent memory leaks
    result_expires=3600,  # Results expire after 1 hour
    task_acks_late=True,  # Acknowledge task only after completion
    task_reject_on_worker_lost=True,  # Reject task if worker dies
    broker_use_ssl=redis_ssl_options,
    redis_backend_use_ssl=redis_ssl_options,
    # Beat schedule for periodic tasks
    beat_schedule={
        "generate-weekly-recaps": {
            "task": "generate_weekly_recaps",
            "schedule": 60.0
            * 60.0
            * 24.0,  # Run daily (check if it's time for weekly recaps)
            # Alternatively: use crontab for specific day/time
            # "schedule": crontab(hour=8, minute=0, day_of_week=1),  # Monday 8am
        },
        "auto-create-daily-checkins": {
            "task": "auto_create_daily_checkins",
            "schedule": 60.0 * 60.0,  # Run HOURLY to catch midnight in all timezones
            # Timezone-aware: creates check-ins at user's midnight
        },
        "send-scheduled-ai-motivations": {
            "task": "send_scheduled_ai_motivations",
            "schedule": 60.0,  # Run EVERY MINUTE to match reminder times
            # Timezone-aware: sends AI motivations at user's reminder times
            # Sends "Time for your workout!" at each reminder time
        },
        "send-checkin-prompts": {
            "task": "send_checkin_prompts",
            "schedule": 60.0,  # Run EVERY MINUTE to match prompt times
            # Timezone-aware: sends "How did it go?" 30 min after LAST reminder
            # Only sends if check-in NOT already completed
        },
        "send-reengagement-notifications": {
            "task": "send_reengagement_notifications",
            "schedule": 60.0 * 60.0 * 24.0,  # Run DAILY at midnight UTC
            # Detects users inactive for 2+ days and sends re-engagement push
            # Alternative: crontab(hour=10, minute=0) for 10 AM UTC daily
        },
        "refresh-analytics-views": {
            "task": "refresh_analytics_views",
            "schedule": 60.0 * 60.0,  # Run HOURLY
            # Refreshes materialized views for analytics dashboards
            # Performance: 280x faster queries with pre-computed data
            # Alternative: crontab(minute=0) for every hour on the hour
        },
        "check-goal-completions": {
            "task": "check_goal_completions",
            "schedule": 60.0 * 60.0 * 24.0,  # Run DAILY
            # Checks for completed time/target challenges and auto-completes them
            # Sends celebration notifications to users who completed challenges
        },
        # Challenge lifecycle tasks
        "check-ended-challenges": {
            "task": "check_ended_challenges",
            "schedule": 60.0 * 60.0,  # Run HOURLY
            # Finds active challenges where end_date has passed
            # Deactivates them, calculates final rankings, sends winner notifications
        },
        "check-challenges-ending-soon": {
            "task": "check_challenges_ending_soon",
            "schedule": 60.0 * 60.0 * 24.0,  # Run DAILY
            # Sends reminders for challenges ending in 1-3 days
            # Keeps participants engaged and aware of deadlines
        },
        # Subscription lifecycle tasks
        "check-expiring-subscriptions": {
            "task": "subscription.check_expiring_subscriptions",
            "schedule": 60.0 * 60.0 * 24.0,  # Run DAILY
            # Warns users 3 days before subscription expires (if auto_renew=false)
            # Sends push notification with upgrade CTA
        },
        "update-challenge-statuses": {
            "task": "subscription.update_challenge_statuses",
            "schedule": 60.0 * 60.0,  # Run HOURLY
            # Transitions challenges: upcoming -> active -> completed
            # Calculates final rankings when challenges end
        },
        "cleanup-abandoned-challenges": {
            "task": "subscription.cleanup_abandoned_challenges",
            "schedule": 60.0 * 60.0 * 24.0,  # Run DAILY
            # Cancels challenges with no participants after join deadline
            # Keeps challenge lists clean
        },
        "process-failed-webhook-events": {
            "task": "subscription.process_failed_webhook_events",
            "schedule": 60.0 * 5.0,  # Run EVERY 5 MINUTES
            # Retries failed RevenueCat webhook events
            # Ensures subscription state stays in sync
        },
        # Auth maintenance tasks
        "cleanup-expired-refresh-tokens": {
            "task": "cleanup_expired_refresh_tokens",
            "schedule": 60.0 * 60.0 * 24.0,  # Run DAILY
            # Removes expired refresh tokens from abandoned sessions
            # With immediate deletion on rotation, this is just for cleanup
        },
        # Notification cleanup tasks
        "cleanup-orphaned-notifications": {
            "task": "cleanup_orphaned_notifications",
            "schedule": 60.0 * 60.0 * 24.0 * 7,  # Run WEEKLY
            # Removes notifications referencing deleted entities (goals, challenges, etc.)
            # Only cleans up notifications older than 30 days
            # Keeps notification_history table clean
        },
        # Stale task cleanup - CRITICAL for production reliability
        "cleanup-stale-pending-tasks": {
            "task": "cleanup_stale_pending_tasks",
            "schedule": 60.0 * 2.0,  # Run EVERY 2 MINUTES
            # Marks stuck "pending" records as "failed" after 3 minutes
            # Handles cases where Celery worker crashes/restarts mid-task
            # Allows users to retry instead of being stuck forever
        },
    },
)

# Task routing (optional - can be used for task prioritization)
celery_app.conf.task_routes = {
    "app.services.tasks.plan_tasks.generate_plan_task": {"queue": "plan_generation"},
}
