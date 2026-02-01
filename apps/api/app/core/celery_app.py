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
    task_time_limit=180,  # 3 minutes max per task (increased for dev/remote Supabase)
    task_soft_time_limit=150,  # 2.5 minutes soft limit
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
        # V2.1: Check-in Pre-creation Tasks
        "precreate-daily-checkins": {
            "task": "precreate_daily_checkins",
            "schedule": 60.0 * 60.0,  # Run HOURLY to catch all timezones
            # Pre-creates check-ins with status='pending' for all active goals for today
            # Uses PostgreSQL precreate_checkins_for_date(p_target_date) - O(1) batch
            # Trigger on goal INSERT (trg_goal_insert_checkin) also creates today's check-in for new goals
        },
        "mark-missed-checkins": {
            "task": "mark_missed_checkins",
            "schedule": 60.0 * 60.0,  # Run HOURLY to catch all timezones
            # Marks pending check-ins as 'missed' when their day has passed
            # Uses PostgreSQL batch function - O(1) performance
        },
        "send-scheduled-ai-motivations": {
            "task": "send_scheduled_ai_motivations",
            "schedule": 60.0,  # Run EVERY MINUTE to match reminder times
            # Timezone-aware: sends AI motivations at user's reminder times
            # Sends "Time for your workout!" at each reminder time
        },
        "send-morning-motivations": {
            "task": "send_morning_motivations",
            "schedule": 60.0,  # Run EVERY MINUTE to match motivation times
            # Timezone-aware: sends morning motivation at user's preferred time
            # Sends daily motivation from daily_motivations table
        },
        "send-checkin-prompts": {
            "task": "send_checkin_prompts",
            "schedule": 60.0,  # Run EVERY MINUTE to match prompt times
            # Timezone-aware: sends "How did it go?" 30 min after LAST reminder
            # Only sends if check-in NOT already completed
        },
        "send-checkin-followups": {
            "task": "send_checkin_followups",
            "schedule": 60.0,  # Run EVERY MINUTE to match follow-up times
            # Timezone-aware: sends follow-up 2 hours after prompt if still no check-in
            # Only sends if same day (won't follow-up on yesterday's missed check-ins)
        },
        "send-reengagement-notifications": {
            "task": "send_reengagement_notifications",
            "schedule": 60.0 * 60.0 * 24.0,  # Run DAILY
            # Sends re-engagement when user has not opened app for 7+ days (users.last_active_at).
            # Distinct from check_missed_days_intervention (missed check-ins while still using app).
        },
        "notify-inactive-partners": {
            "task": "notify_inactive_partners",
            "schedule": 60.0 * 60.0 * 24.0,  # Run DAILY
            # Notifies users when their accountability partner hasn't checked in for 3+ days
            # Prompts active partner to send encouragement
        },
        # V2 Streak Management Tasks
        "reset-missed-streaks": {
            "task": "reset_missed_streaks",
            "schedule": 60.0 * 60.0,  # Run HOURLY to catch all timezones
            # Resets current_streak to 0 for goals where:
            # - Yesterday was a target day AND
            # - No check-in was completed
            # Uses PostgreSQL batch function - O(1) performance
        },
        "reset-weekly-completions": {
            "task": "reset_weekly_completions",
            "schedule": 60.0 * 60.0 * 24.0,  # Run DAILY (resets on Mondays)
            # Resets week_completions counter for weekly goals
            # Note: Streaks are managed per check-in (same as daily goals)
            # This only resets the "X/Y this week" counter for UI display
            # Alternative: crontab(hour=0, minute=0, day_of_week=1) for Monday only
        },
        # REMOVED: "detect-patterns" weekly batch task
        # Pattern insights now generate on-demand after each check-in (more cost-effective)
        # See: generate_goal_insights_task triggered in checkins.py create_check_in endpoint
        "refresh-analytics-views": {
            "task": "refresh_analytics_views",
            "schedule": 60.0 * 60.0,  # Run HOURLY
            # Refreshes materialized views for analytics dashboards
            # Performance: 280x faster queries with pre-computed data
            # Alternative: crontab(minute=0) for every hour on the hour
        },
        "prewarm-analytics-cache": {
            "task": "prewarm_analytics_cache_task",
            "schedule": 60.0 * 60.0 * 8,  # Run every 8 hours (3x daily)
            # Pre-computes analytics for active premium users
            # Reduces latency when users open Analytics screen
            # Alternative: crontab(hour=3, minute=0) for 3 AM only
        },
        # Subscription lifecycle tasks
        "check-expiring-subscriptions": {
            "task": "check_expiring_subscriptions",
            "schedule": 60.0 * 60.0 * 24.0,  # Run DAILY
            # Warns users 3 days before subscription expires (if auto_renew=false)
            # Sends push notification with upgrade CTA
        },
        "process-failed-webhook-events": {
            "task": "process_failed_webhook_events",
            "schedule": 60.0 * 5.0,  # Run EVERY 5 MINUTES
            # Retries failed RevenueCat webhook events
            # Ensures subscription state stays in sync
        },
        "cleanup-expired-partner-requests": {
            "task": "cleanup_expired_partner_requests",
            "schedule": 60.0 * 60.0 * 24.0,  # Run DAILY
            # Deletes pending partner requests from users who lost subscription
            # Catches missed webhooks and edge cases
        },
        "cleanup-inactive-user-partnerships": {
            "task": "cleanup_inactive_user_partnerships",
            "schedule": 60.0 * 60.0 * 24.0,  # Run DAILY
            # Deletes partnerships for disabled/suspended users
            # Ensures inactive users don't appear in partner lists
        },
        "enforce-free-tier-limits": {
            "task": "enforce_free_tier_limits",
            "schedule": 60.0 * 60.0 * 24.0,  # Run DAILY
            # Enforces subscription limits for all free users:
            # - Deactivates excess goals beyond active_goal_limit
            # - Deletes pending partner requests (no social_accountability feature)
            # BACKUP to webhooks - catches missed EXPIRATION events
        },
        # Auth maintenance tasks
        "cleanup-expired-refresh-tokens": {
            "task": "cleanup_expired_refresh_tokens",
            "schedule": 60.0 * 60.0 * 24.0,  # Run DAILY
            # Removes expired refresh tokens from abandoned sessions
            # With immediate deletion on rotation, this is just for cleanup
        },
        # Achievement tasks
        "check-account-age-achievements": {
            "task": "check_account_age_achievements",
            "schedule": 60.0 * 60.0 * 24.0,  # Run DAILY
            # Checks and unlocks account age milestone achievements
            # (30, 90, 180, 365, 730, 1095, 1825 days)
        },
        # Notification cleanup tasks
        "cleanup-orphaned-notifications": {
            "task": "cleanup_orphaned_notifications",
            "schedule": 60.0 * 60.0 * 24.0 * 7,  # Run WEEKLY
            # Removes notifications referencing deleted entities (goals, etc.)
            # Keeps notification_history table clean
        },
        "cleanup-blocked-partnership-nudges": {
            "task": "cleanup_blocked_partnership_nudges",
            "schedule": 60.0 * 60.0 * 24.0 * 7,  # Run WEEKLY
            # Removes social_nudges and notifications for blocked partnerships
            # Safety net for fire-and-forget cleanup failures
        },
        # Adaptive Nudging tasks (V2 Premium)
        "check-streak-at-risk": {
            "task": "check_streak_at_risk",
            "schedule": 60.0
            * 60.0,  # Run HOURLY between 2-8 PM (task filters internally)
            # Sends extra check-in reminder when user is about to break a long streak
            # Criteria: 7+ day streak, goal scheduled today, no check-in yet, past reminder time
        },
        "check-risky-day-warning": {
            "task": "check_risky_day_warning",
            "schedule": 60.0 * 15.0,  # Run EVERY 15 MINUTES
            # Sends morning warning on historically risky days (based on pattern_insights)
            # Uses worst_day patterns to identify days with < 50% success rate
        },
        "check-missed-days-intervention": {
            "task": "check_missed_days_intervention",
            "schedule": 60.0 * 60.0 * 24.0,  # Run DAILY at 10 AM UTC
            # Sends intervention message for users who've missed 2+ consecutive days
            # Gentle re-engagement to help users get back on track
        },
        "check-approaching-milestone": {
            "task": "check_approaching_milestone",
            "schedule": 60.0 * 60.0 * 24.0,  # Run DAILY at 9 AM UTC
            # Sends hype notification when within 3 days of a streak milestone
            # Milestones: 7, 14, 21, 30, 50, 100, 200, 365, etc.
        },
    },
)

# Task routing (optional - can be used for task prioritization)
# V2: No custom routing needed - all tasks use default queue
celery_app.conf.task_routes = {}
