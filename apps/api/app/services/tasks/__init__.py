"""
Celery Tasks Package

Re-exports all tasks for Celery autodiscovery.
All tasks are organized into domain-specific modules:

- plan_tasks: AI plan generation and goal suggestions
- goal_tasks: Check-in creation and goal completion checks
- achievement_tasks: Achievement unlocking and challenge progress
- challenge_tasks: Challenge lifecycle (ending, winners, reminders)
- notification_tasks: Push notifications (AI motivations, re-engagement, check-in prompts)
- analytics_tasks: Weekly recaps and materialized view refresh
- media_tasks: R2 media file deletion
- auth_tasks: Refresh token cleanup
"""

# Plan generation tasks
from app.services.tasks.plan_tasks import (
    generate_plan_task,
    generate_challenge_plan_task,
    generate_suggested_goals_task,
)

# Goal-related tasks
from app.services.tasks.goal_tasks import (
    auto_create_daily_checkins_task,
)

# Achievement tasks
from app.services.tasks.achievement_tasks import (
    check_achievements_task,
    update_challenge_progress_task,
)

# Challenge lifecycle tasks
from app.services.tasks.challenge_tasks import (
    check_ended_challenges_task,
    send_challenge_reminder_task,
    send_challenge_reminder_chunk_task,
    check_challenges_ending_soon_task,
)

# Notification tasks
from app.services.tasks.notification_tasks import (
    send_scheduled_ai_motivations_task,
    send_reengagement_notifications_task,
    send_checkin_prompts_task,
    cleanup_orphaned_notifications_task,
)

# Analytics tasks
from app.services.tasks.analytics_tasks import (
    generate_weekly_recaps_task,
    refresh_analytics_views_task,
)

# Media tasks
from app.services.tasks.media_tasks import (
    delete_media_from_r2_task,
)

# Subscription tasks
from app.services.tasks.subscription_tasks import (
    check_expiring_subscriptions_task,
    update_challenge_statuses_task,
    cleanup_abandoned_challenges_task,
    process_failed_webhook_events_task,
    cleanup_expired_creator_challenges_task,
    cleanup_expired_partner_requests_task,
    notify_challenge_cancelled_chunk_task,
)

# Auth tasks
from app.services.tasks.auth_tasks import (
    cleanup_expired_refresh_tokens_task,
)

# Task utilities (for scalable chunking)
from app.services.tasks.task_utils import (
    chunk_list,
    dispatch_chunked_tasks,
    process_in_batches,
    aggregate_chunk_results_task,
)

__all__ = [
    # Plan tasks
    "generate_plan_task",
    "generate_challenge_plan_task",
    "generate_suggested_goals_task",
    # Goal tasks
    "auto_create_daily_checkins_task",
    # Achievement tasks
    "check_achievements_task",
    "update_challenge_progress_task",
    # Challenge lifecycle tasks
    "check_ended_challenges_task",
    "send_challenge_reminder_task",
    "send_challenge_reminder_chunk_task",
    "check_challenges_ending_soon_task",
    # Notification tasks
    "send_scheduled_ai_motivations_task",
    "send_reengagement_notifications_task",
    "send_checkin_prompts_task",
    "cleanup_orphaned_notifications_task",
    # Analytics tasks
    "generate_weekly_recaps_task",
    "refresh_analytics_views_task",
    # Media tasks
    "delete_media_from_r2_task",
    # Subscription tasks
    "check_expiring_subscriptions_task",
    "update_challenge_statuses_task",
    "cleanup_abandoned_challenges_task",
    "process_failed_webhook_events_task",
    "cleanup_expired_creator_challenges_task",
    "cleanup_expired_partner_requests_task",
    "notify_challenge_cancelled_chunk_task",
    # Auth tasks
    "cleanup_expired_refresh_tokens_task",
    # Task utilities
    "chunk_list",
    "dispatch_chunked_tasks",
    "process_in_batches",
    "aggregate_chunk_results_task",
]
