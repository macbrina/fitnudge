"""
Celery Tasks Package - V2.1

Re-exports all tasks for Celery autodiscovery.
All tasks are organized into domain-specific modules:

- goal_tasks: Check-in pre-creation, streak updates, pattern insights
- achievement_tasks: Achievement unlocking
- notification_tasks: Push notifications (AI motivations, re-engagement, check-in prompts)
- analytics_tasks: Weekly recaps
- auth_tasks: Refresh token cleanup
- ai_coach_tasks: AI coach message processing
- subscription_tasks: Subscription management
- media_tasks: R2 media file deletion (voice notes)
- motivation_tasks: AI check-in responses, daily motivations

V2.1 Architecture Notes:
- Check-ins PRE-CREATED daily with status='pending' (precreate_daily_checkins_task)
- Users UPDATE pending check-ins when responding
- End of day: remaining 'pending' marked 'missed' (mark_missed_checkins_task)
- Streaks updated via event-driven task after each check-in
- Daily motivations generated on-demand in send_morning_motivations
"""

# Goal-related tasks (V2.1: Pre-creation + O(1) inline streak updates + batch tasks)
from app.services.tasks.goal_tasks import (
    precreate_daily_checkins_task,  # Hourly: pre-create pending check-ins
    mark_missed_checkins_task,  # Hourly: mark pending as missed at EOD
    update_goal_streak_task,  # Legacy: kept for manual recalculation
    reset_missed_streaks_task,  # Hourly: reset streaks for missed days
    reset_weekly_completions_task,  # Monday: reset week_completions counter
    detect_patterns_task,  # Weekly: detect user patterns for AI context
    detect_user_patterns_single_task,  # On-demand: single user pattern detection
    generate_goal_insights_task,  # On-demand: single goal insights (background)
    build_ai_context_task,  # On-demand: build AI context for chat
)

# Achievement tasks
from app.services.tasks.achievement_tasks import (
    check_achievements_task,
    check_account_age_achievements_task,
)

# Notification tasks
from app.services.tasks.notification_tasks import (
    send_scheduled_ai_motivations_task,
    send_reengagement_notifications_task,
    send_checkin_prompts_task,
    send_checkin_followups_task,
    notify_inactive_partners_task,
    cleanup_orphaned_notifications_task,
    cleanup_blocked_partnership_nudges_task,
)

# Analytics tasks
from app.services.tasks.analytics_tasks import (
    generate_weekly_recaps_task,
    refresh_analytics_views_task,
)

# Analytics cache prewarming
from app.services.tasks.analytics_refresh_tasks import (
    prewarm_analytics_cache_task,
)

# Subscription tasks
from app.services.tasks.subscription_tasks import (
    check_expiring_subscriptions_task,
    process_failed_webhook_events_task,
    cleanup_expired_partner_requests_task,
    cleanup_inactive_user_partnerships_task,
    enforce_free_tier_limits_task,
)

# Auth tasks
from app.services.tasks.auth_tasks import (
    cleanup_expired_refresh_tokens_task,
)

# AI Coach tasks
from app.services.tasks.ai_coach_tasks import (
    process_ai_coach_message_task,
)

# Media tasks
from app.services.tasks.media_tasks import (
    delete_media_from_r2_task,
)

# Motivation tasks (V2)
# - generate_checkin_ai_response: Called after check-in for premium users
# - send_morning_motivations: Scheduled task, generates on-demand if needed
from app.services.tasks.motivation_tasks import (
    generate_checkin_ai_response,
    send_morning_motivations,
)

# Adaptive Nudging tasks (V2 Premium)
# - Smart notifications based on user patterns
from app.services.tasks.adaptive_nudging_tasks import (
    check_streak_at_risk_task,
    check_risky_day_warning_task,
    check_missed_days_intervention_task,
    check_approaching_milestone_task,
    run_all_adaptive_nudges_task,
)

# Task utilities (for scalable chunking)
from app.services.tasks.task_utils import (
    chunk_list,
    dispatch_chunked_tasks,
    process_in_batches,
    aggregate_chunk_results_task,
)

__all__ = [
    # Goal tasks (V2.1: Pre-creation + O(1) inline + batch scheduled tasks)
    "precreate_daily_checkins_task",
    "mark_missed_checkins_task",
    "update_goal_streak_task",
    "reset_missed_streaks_task",
    "reset_weekly_completions_task",
    "detect_patterns_task",
    "detect_user_patterns_single_task",
    "generate_goal_insights_task",
    "build_ai_context_task",
    # Achievement tasks
    "check_achievements_task",
    "check_account_age_achievements_task",
    # Notification tasks
    "send_scheduled_ai_motivations_task",
    "send_reengagement_notifications_task",
    "send_checkin_prompts_task",
    "send_checkin_followups_task",
    "notify_inactive_partners_task",
    "cleanup_orphaned_notifications_task",
    "cleanup_blocked_partnership_nudges_task",
    # Analytics tasks
    "generate_weekly_recaps_task",
    "refresh_analytics_views_task",
    "prewarm_analytics_cache_task",
    # Subscription tasks
    "check_expiring_subscriptions_task",
    "process_failed_webhook_events_task",
    "cleanup_expired_partner_requests_task",
    "cleanup_inactive_user_partnerships_task",
    "enforce_free_tier_limits_task",
    # Auth tasks
    "cleanup_expired_refresh_tokens_task",
    # AI Coach tasks
    "process_ai_coach_message_task",
    # Media tasks
    "delete_media_from_r2_task",
    # Motivation tasks (V2)
    "generate_checkin_ai_response",
    "send_morning_motivations",
    # Adaptive Nudging tasks (V2 Premium)
    "check_streak_at_risk_task",
    "check_risky_day_warning_task",
    "check_missed_days_intervention_task",
    "check_approaching_milestone_task",
    "run_all_adaptive_nudges_task",
    # Task utilities
    "chunk_list",
    "dispatch_chunked_tasks",
    "process_in_batches",
    "aggregate_chunk_results_task",
]
