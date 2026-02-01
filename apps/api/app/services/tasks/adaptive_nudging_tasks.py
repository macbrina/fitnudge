"""
FitNudge V2 - Adaptive Nudging Tasks

Premium feature: Smart, proactive notifications based on user's patterns.

Nudge Types:
1. About to break long streak → Extra check-in reminder
2. Historically risky day → Morning warning
3. 2+ days missed → Intervention message
4. Approaching milestone → Hype notification

Limits:
- Max 3 adaptive nudges per day (beyond scheduled check-ins)
- No nudges during quiet hours (10pm-7am user timezone)
- Only for users with `adaptive_nudging` feature enabled

Scalability (per SCALABILITY.md):
- Uses RPC functions for batch user queries
- Uses send_push_to_user_sync which handles token lookup and notification history
- No N+1 queries - batch operations where possible
"""

from datetime import datetime, timedelta, date
from typing import Dict, Any, List, Optional, Set
import pytz

from app.services.tasks.base import (
    celery_app,
    get_supabase_client,
    logger,
)
from app.services.expo_push_service import send_push_to_user_sync
from app.services.subscription_service import has_user_feature_sync


# Constants
QUIET_HOURS_START = 22  # 10 PM
QUIET_HOURS_END = 7  # 7 AM

# Streak milestones to celebrate
STREAK_MILESTONES = [7, 14, 21, 30, 50, 100, 200, 365, 500, 730, 1000]


def can_send_nudge(user_tz: str) -> bool:
    """
    Check if we can send a nudge to this user right now.

    Only checks quiet hours (10 PM - 7 AM in user's timezone).
    Per-type deduplication is handled by batch queries in each task.
    """
    try:
        tz = pytz.timezone(user_tz or "UTC")
        now = datetime.now(tz)
        user_hour = now.hour

        # Check quiet hours
        if user_hour >= QUIET_HOURS_START or user_hour < QUIET_HOURS_END:
            return False

        return True
    except Exception as e:
        logger.warning(f"Error checking nudge eligibility: {e}")
        return False


def has_feature_access(supabase, user_id: str) -> bool:
    """
    Check if user has access to adaptive nudging (premium feature).

    Uses has_user_feature_sync from subscription_service for:
    - Consistent feature checking with the rest of the app
    - Proper subscription lookup (active subscription OR users.plan fallback)
    - V2 direct plan matching
    """
    return has_user_feature_sync(supabase, user_id, "adaptive_nudging")


def get_goal_ids_with_pending_checkin_today(
    supabase,
    goal_ids: List[str],
    today_utc: Optional[date] = None,
) -> Set[str]:
    """
    Return goal_ids that have a pending check-in for today (UTC date).

    Use before sending "check in today" nudges so we only nudge users who
    have not yet checked in for the day. Call from check_streak_at_risk,
    check_risky_day_warning, check_approaching_milestone, check_pattern_suggestion, etc.
    """
    if not goal_ids:
        return set()
    today = today_utc or datetime.utcnow().date()
    try:
        result = (
            supabase.table("check_ins")
            .select("goal_id")
            .in_("goal_id", goal_ids)
            .eq("check_in_date", today.isoformat())
            .eq("status", "pending")
            .execute()
        )
        return {r["goal_id"] for r in (result.data or []) if r.get("goal_id")}
    except Exception as e:
        logger.warning(
            f"[AdaptiveNudging] get_goal_ids_with_pending_checkin_today: {e}"
        )
        return set()


@celery_app.task(name="check_streak_at_risk", bind=True, max_retries=2)
def check_streak_at_risk_task(self):
    """
    Check for users about to break a long streak.

    Criteria:
    - User has a streak of 7+ days
    - Goal is scheduled for today
    - No check-in logged today
    - It's past their reminder time but before 8 PM
    - They haven't been nudged for this today

    Uses RPC for batch query (SCALABILITY.md compliant).
    Uses send_push_to_user_sync for notification (handles tokens + history).

    Runs: Hourly between 2 PM - 8 PM
    """
    try:
        supabase = get_supabase_client()
        processed = 0
        nudged = 0

        # SCALABILITY: Use RPC for batch query instead of N+1 pattern
        result = supabase.rpc("get_streak_at_risk_users", {"min_streak": 7}).execute()

        if not result.data:
            logger.info("[StreakAtRisk] No users at risk found")
            return {"processed": 0, "nudged": 0}

        # DEDUPLICATION: Batch prefetch existing streak_at_risk nudges TODAY
        user_ids = list(set(ug.get("user_id") for ug in result.data))
        utc_today = datetime.utcnow().date()
        existing_nudges_result = (
            supabase.table("notification_history")
            .select("user_id")
            .in_("user_id", user_ids)
            .eq("notification_type", "adaptive_nudge")
            .gte("sent_at", f"{utc_today}T00:00:00")
            .filter("data->>nudge_type", "eq", "streak_at_risk")
            .execute()
        )
        users_with_streak_nudge_today = set(
            n.get("user_id") for n in (existing_nudges_result.data or [])
        )

        # Only nudge goals that have a pending check-in today (user has not checked in yet)
        goal_ids = [ug.get("goal_id") for ug in result.data if ug.get("goal_id")]
        goals_with_pending_today = get_goal_ids_with_pending_checkin_today(
            supabase, goal_ids, utc_today
        )

        for user_goal in result.data:
            processed += 1
            user_id = user_goal.get("user_id")
            goal_id = user_goal.get("goal_id")
            goal_title = user_goal.get("title")
            current_streak = user_goal.get("current_streak", 0)
            longest_streak = user_goal.get("longest_streak", 0)
            user_tz = user_goal.get("timezone", "UTC")
            user_name = user_goal.get("name", "there")

            # O(1) lookup: Skip if already sent streak_at_risk nudge today
            if user_id in users_with_streak_nudge_today:
                continue

            # Skip if user has already checked in for this goal today (no pending check-in)
            if goal_id not in goals_with_pending_today:
                continue

            # Check if we can send
            if not can_send_nudge(user_tz):
                continue

            # Check feature access
            if not has_feature_access(supabase, user_id):
                continue

            # Build message based on streak context
            if current_streak >= longest_streak - 2 and current_streak >= 10:
                # About to beat their record
                body = f"🔥 {user_name}, you're {longest_streak - current_streak + 1} days from beating your personal best! Don't let {goal_title} slip today."
            elif current_streak >= 14:
                body = f"⚠️ {user_name}, your {current_streak}-day streak is at risk! There's still time to {goal_title.lower()} today."
            else:
                body = f"💪 {user_name}, don't break your {current_streak}-day streak! Did you {goal_title.lower()} today?"

            # SCALABILITY: Use send_push_to_user_sync which handles:
            # - Token lookup from device_tokens
            # - Notification history insertion
            # - Batch sending via publish_multiple()
            result = send_push_to_user_sync(
                user_id=user_id,
                title="Streak Alert 🔥",
                body=body,
                data={
                    "type": "adaptive_nudge",
                    "nudge_type": "streak_at_risk",
                    "goalId": goal_id,
                    "deepLink": f"/(user)/(goals)/details?id={goal_id}",
                },
                notification_type="adaptive_nudge",
                entity_type="goal",
                entity_id=goal_id,
            )

            if result.get("success") or result.get("delivered", 0) > 0:
                nudged += 1

        logger.info(f"[StreakAtRisk] Processed {processed} users, nudged {nudged}")
        return {"processed": processed, "nudged": nudged}

    except Exception as e:
        logger.error(f"[StreakAtRisk] Error: {e}")
        raise self.retry(exc=e, countdown=300)


@celery_app.task(name="check_risky_day_warning", bind=True, max_retries=2)
def check_risky_day_warning_task(self):
    """
    Send morning warning on historically risky days.

    Uses nudge_config from AI-generated pattern_insights.
    Reads risky_days array directly (no second AI call needed).

    SCALABILITY: Batch fetches user info to avoid N+1.

    Runs: Daily at 7 AM UTC (each user gets it at their morning)
    """
    try:
        supabase = get_supabase_client()
        processed = 0
        nudged = 0

        # Get today's day of week (0=Sunday, 1=Monday, etc.)
        today_weekday = datetime.utcnow().weekday()
        # Convert Python weekday (0=Monday) to our format (0=Sunday)
        python_to_our_map = {0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 0}
        our_weekday = python_to_our_map[today_weekday]

        day_names = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
        ]
        today_name = day_names[our_weekday]

        # Find completed pattern_insights with risky_days containing today
        # The nudge_config.risky_days is a JSONB array
        result = (
            supabase.table("pattern_insights")
            .select("user_id, goal_id, nudge_config, current_metrics")
            .eq("status", "completed")
            .execute()
        )

        if not result.data:
            return {"processed": 0, "nudged": 0}

        # Filter to insights where today is a risky day
        risky_insights = []
        for insight in result.data:
            nudge_config = insight.get("nudge_config") or {}
            risky_days = nudge_config.get("risky_days", [])
            if our_weekday in risky_days:
                risky_insights.append(insight)

        if not risky_insights:
            return {"processed": 0, "nudged": 0}

        # SCALABILITY: Batch fetch user info for all unique user_ids
        user_ids = list(set(insight.get("user_id") for insight in risky_insights))
        users_result = (
            supabase.table("users")
            .select("id, name, timezone")
            .in_("id", user_ids)
            .execute()
        )
        user_map = {u["id"]: u for u in (users_result.data or [])}

        # DEDUPLICATION: Batch prefetch existing risky day nudges TODAY
        # Uses data->>'nudge_type' to match exactly this nudge type
        utc_today = datetime.utcnow().date()
        existing_nudges_result = (
            supabase.table("notification_history")
            .select("user_id")
            .in_("user_id", user_ids)
            .eq("notification_type", "adaptive_nudge")
            .gte("sent_at", f"{utc_today}T00:00:00")
            .filter("data->>nudge_type", "eq", "risky_day")
            .execute()
        )
        users_with_risky_nudge_today = set(
            n.get("user_id") for n in (existing_nudges_result.data or [])
        )

        # Only nudge goals that have a pending check-in today (user has not checked in yet)
        goal_ids_risky = [i.get("goal_id") for i in risky_insights if i.get("goal_id")]
        goals_with_pending_today_risky = get_goal_ids_with_pending_checkin_today(
            supabase, goal_ids_risky, utc_today
        )

        for insight in risky_insights:
            processed += 1
            user_id = insight.get("user_id")
            goal_id = insight.get("goal_id")
            nudge_config = insight.get("nudge_config") or {}
            current_metrics = insight.get("current_metrics") or {}

            # O(1) lookup: Skip if already sent risky day nudge today
            if user_id in users_with_risky_nudge_today:
                continue

            # Skip if user has already checked in for this goal today (no pending check-in)
            if goal_id not in goals_with_pending_today_risky:
                continue

            # Get user info from batch-fetched map
            user_data = user_map.get(user_id)
            if not user_data:
                continue

            user_name = user_data.get("name", "there")
            user_tz = user_data.get("timezone", "UTC")

            # Check if it's morning for this user (7-9 AM)
            try:
                tz = pytz.timezone(user_tz)
                user_now = datetime.now(tz)
                if not (7 <= user_now.hour <= 9):
                    continue
            except Exception:
                continue

            # Check nudge eligibility
            if not can_send_nudge(user_tz):
                continue

            if not has_feature_access(supabase, user_id):
                continue

            # Get worst day completion rate from metrics
            worst_day_rate = current_metrics.get("worst_day_rate", 50)
            risk_level = nudge_config.get("risk_level", "medium")

            # Build message based on risk level
            if risk_level == "high":
                body = f"Hey {user_name}! {today_name}s have been challenging (only {worst_day_rate:.0f}% success). Let's break that pattern today! 💪"
            else:
                body = f"Hey {user_name}! {today_name}s can be tricky. What's your plan to win today? 💪"

            # Use send_push_to_user_sync (handles tokens + history)
            result = send_push_to_user_sync(
                user_id=user_id,
                title=f"It's {today_name} - Let's Win! 🎯",
                body=body,
                data={
                    "type": "adaptive_nudge",
                    "nudge_type": "risky_day",
                    "goalId": goal_id,
                    "deepLink": f"/(user)/(goals)/details?id={goal_id}",
                },
                notification_type="adaptive_nudge",
                entity_type="goal",
                entity_id=goal_id,
            )

            if result.get("success") or result.get("delivered", 0) > 0:
                nudged += 1

        logger.info(f"[RiskyDay] Processed {processed} users, nudged {nudged}")
        return {"processed": processed, "nudged": nudged}

    except Exception as e:
        logger.error(f"[RiskyDay] Error: {e}")
        raise self.retry(exc=e, countdown=300)


@celery_app.task(name="check_missed_days_intervention", bind=True, max_retries=2)
def check_missed_days_intervention_task(self):
    """
    Send intervention message for users who've missed 2+ days.

    Criteria:
    - User has missed 2+ consecutive scheduled days
    - They have at least one active goal
    - Haven't been sent an intervention in the last 24 hours

    Uses RPC for batch query (SCALABILITY.md compliant).

    Runs: Daily at 10 AM UTC
    """
    try:
        supabase = get_supabase_client()
        processed = 0
        nudged = 0

        # SCALABILITY: Use RPC for batch query
        result = supabase.rpc("get_users_with_missed_days", {"min_days": 2}).execute()

        if not result.data:
            logger.info("[MissedDays] No users with missed days found")
            return {"processed": 0, "nudged": 0}

        # DEDUPLICATION: Batch prefetch existing missed_days_intervention nudges TODAY
        user_ids = list(set(ud.get("user_id") for ud in result.data))
        utc_today = datetime.utcnow().date()
        existing_nudges_result = (
            supabase.table("notification_history")
            .select("user_id")
            .in_("user_id", user_ids)
            .eq("notification_type", "adaptive_nudge")
            .gte("sent_at", f"{utc_today}T00:00:00")
            .filter("data->>nudge_type", "eq", "missed_days_intervention")
            .execute()
        )
        users_with_intervention_today = set(
            n.get("user_id") for n in (existing_nudges_result.data or [])
        )

        for user_data in result.data:
            processed += 1
            user_id = user_data.get("user_id")
            user_name = user_data.get("name", "there")
            user_tz = user_data.get("timezone", "UTC")
            days_missed = user_data.get("days_missed", 2)

            # O(1) lookup: Skip if already sent missed_days_intervention nudge today
            if user_id in users_with_intervention_today:
                continue

            # Check nudge eligibility
            if not can_send_nudge(user_tz):
                continue

            if not has_feature_access(supabase, user_id):
                continue

            # Build intervention message based on days missed
            if days_missed >= 5:
                body = f"Hey {user_name}, I've noticed you've been quiet for {days_missed} days. Everything okay? Your goals miss you. 💙"
                title = "We Miss You 💙"
            elif days_missed >= 3:
                body = f"{user_name}, it's been {days_missed} days. Life happens, but let's get back on track. One check-in at a time. 🌱"
                title = "Let's Reconnect 🌱"
            else:
                body = f"Hey {user_name}, I noticed you've been quiet. Ready to get back on track? Your streak is waiting! 💪"
                title = "Ready to Restart? 💪"

            # No goal deepLink (tap opens app home) — push only, don't save to notification_history
            result = send_push_to_user_sync(
                user_id=user_id,
                title=title,
                body=body,
                data={
                    "type": "adaptive_nudge",
                    "nudge_type": "missed_days_intervention",
                    "daysMissed": days_missed,
                    # No deepLink - tap opens app home
                },
                notification_type="adaptive_nudge",
                save_to_notification_history=False,
            )

            if result.get("success") or result.get("delivered", 0) > 0:
                nudged += 1

        logger.info(f"[MissedDays] Processed {processed} users, nudged {nudged}")
        return {"processed": processed, "nudged": nudged}

    except Exception as e:
        logger.error(f"[MissedDays] Error: {e}")
        raise self.retry(exc=e, countdown=300)


@celery_app.task(name="check_approaching_milestone", bind=True, max_retries=2)
def check_approaching_milestone_task(self):
    """
    Send hype notification when approaching a streak milestone.

    Criteria:
    - User is within 3 days of a milestone (7, 14, 21, 30, 50, 100, etc.)
    - Haven't been notified about this milestone yet

    SCALABILITY: Batch fetches goals and user info to avoid N+1.

    Runs: Daily at 9 AM UTC
    """
    try:
        supabase = get_supabase_client()
        processed = 0
        nudged = 0

        # SCALABILITY: Single query to get all goals with decent streaks
        result = (
            supabase.table("goals")
            .select("id, user_id, title, current_streak")
            .eq("status", "active")
            .gte("current_streak", 4)
            .execute()
        )

        if not result.data:
            return {"processed": 0, "nudged": 0}

        # SCALABILITY: Batch fetch user info for all unique user_ids
        user_ids = list(set(goal.get("user_id") for goal in result.data))
        users_result = (
            supabase.table("users")
            .select("id, name, timezone")
            .in_("id", user_ids)
            .execute()
        )
        user_map = {u["id"]: u for u in (users_result.data or [])}

        # DEDUPLICATION: Batch prefetch existing milestone_approaching nudges TODAY
        utc_today = datetime.utcnow().date()
        existing_nudges_result = (
            supabase.table("notification_history")
            .select("user_id")
            .in_("user_id", user_ids)
            .eq("notification_type", "adaptive_nudge")
            .gte("sent_at", f"{utc_today}T00:00:00")
            .filter("data->>nudge_type", "eq", "milestone_approaching")
            .execute()
        )
        users_with_milestone_nudge_today = set(
            n.get("user_id") for n in (existing_nudges_result.data or [])
        )

        # Only nudge goals that have a pending check-in today (user has not checked in yet)
        goal_ids_milestone = [g.get("id") for g in result.data if g.get("id")]
        goals_with_pending_today_milestone = get_goal_ids_with_pending_checkin_today(
            supabase, goal_ids_milestone, utc_today
        )

        for goal in result.data:
            current_streak = goal.get("current_streak", 0)
            goal_id = goal.get("id")
            user_id = goal.get("user_id")
            goal_title = goal.get("title")

            # Check if approaching any milestone
            approaching_milestone = None
            for milestone in STREAK_MILESTONES:
                days_until = milestone - current_streak
                if 1 <= days_until <= 3:
                    approaching_milestone = milestone
                    break

            if not approaching_milestone:
                continue

            # O(1) lookup: Skip if already sent milestone_approaching nudge today
            if user_id in users_with_milestone_nudge_today:
                continue

            # Skip if user has already checked in for this goal today (no pending check-in)
            if goal_id not in goals_with_pending_today_milestone:
                continue

            processed += 1

            # Get user info from batch-fetched map
            user_data = user_map.get(user_id)
            if not user_data:
                continue

            user_name = user_data.get("name", "there")
            user_tz = user_data.get("timezone", "UTC")

            # Check nudge eligibility
            if not can_send_nudge(user_tz):
                continue

            if not has_feature_access(supabase, user_id):
                continue

            days_until = approaching_milestone - current_streak

            # Build hype message
            if approaching_milestone == 100:
                title = "🏆 100 Days is Coming!"
                body = f"{user_name}, you're only {days_until} days from 100! That's LEGENDARY status. Don't stop now!"
            elif approaching_milestone >= 30:
                title = f"🔥 {approaching_milestone} Days Ahead!"
                body = f"{user_name}, just {days_until} more days to hit {approaching_milestone}! You're crushing it with {goal_title}!"
            else:
                title = f"⭐ Milestone Alert!"
                body = f"{user_name}, {days_until} more days and you hit a {approaching_milestone}-day streak! Keep going!"

            # Use send_push_to_user_sync (handles tokens + history)
            result = send_push_to_user_sync(
                user_id=user_id,
                title=title,
                body=body,
                data={
                    "type": "adaptive_nudge",
                    "nudge_type": "milestone_approaching",
                    "goalId": goal_id,
                    "milestone": approaching_milestone,
                    "daysUntil": days_until,
                    "deepLink": f"/(user)/(goals)/details?id={goal_id}",
                },
                notification_type="adaptive_nudge",
                entity_type="goal",
                entity_id=goal_id,
            )

            if result.get("success") or result.get("delivered", 0) > 0:
                nudged += 1

        logger.info(f"[Milestone] Processed {processed} goals, nudged {nudged}")
        return {"processed": processed, "nudged": nudged}

    except Exception as e:
        logger.error(f"[Milestone] Error: {e}")
        raise self.retry(exc=e, countdown=300)


@celery_app.task(name="check_pattern_suggestion", bind=True, max_retries=2)
def check_pattern_suggestion_task(self):
    """
    Send pattern-based suggestion nudge when AI detects users need extra motivation.

    Uses AI-generated nudge_config.needs_extra_motivation flag and
    fetches skip reasons to provide targeted suggestions.

    Runs once daily in the morning (8-10 AM).

    SCALABILITY: Uses batch prefetching to avoid N+1 queries.
    """
    try:
        supabase = get_supabase_client()
        nudged = 0
        processed = 0

        # Get completed pattern_insights where needs_extra_motivation is true
        insights_result = (
            supabase.table("pattern_insights")
            .select("id, user_id, goal_id, nudge_config, current_metrics")
            .eq("status", "completed")
            .execute()
        )

        if not insights_result.data:
            return {"processed": 0, "nudged": 0}

        # Filter to insights where needs_extra_motivation is true
        motivation_needed = []
        for insight in insights_result.data:
            nudge_config = insight.get("nudge_config") or {}
            if nudge_config.get("needs_extra_motivation", False):
                motivation_needed.append(insight)

        if not motivation_needed:
            return {"processed": 0, "nudged": 0}

        # Group insights by user to avoid sending multiple nudges
        user_insights = {}
        for insight in motivation_needed:
            user_id = insight.get("user_id")
            if user_id not in user_insights:
                user_insights[user_id] = []
            user_insights[user_id].append(insight)

        user_ids = list(user_insights.keys())
        goal_ids = list(
            {
                i.get("goal_id")
                for i in motivation_needed
                if i.get("goal_id") is not None
            }
        )

        # Batch fetch goals + users (avoid PostgREST embed ambiguity)
        goals_result = (
            supabase.table("goals")
            .select("id, title, user_id")
            .in_("id", goal_ids)
            .execute()
        )
        goals_by_id = {g["id"]: g for g in (goals_result.data or []) if g.get("id")}

        users_result = (
            supabase.table("users")
            .select("id, name, timezone")
            .in_("id", user_ids)
            .execute()
        )
        users_by_id = {u["id"]: u for u in (users_result.data or []) if u.get("id")}

        # SCALABILITY: Batch prefetch existing pattern nudges this week for ALL users
        utc_now = datetime.now(pytz.UTC)
        utc_today = utc_now.date()
        utc_week_start = utc_today - timedelta(days=utc_today.weekday())  # Monday

        existing_nudges_result = (
            supabase.table("notification_history")
            .select("user_id")
            .in_("user_id", user_ids)
            .eq("notification_type", "adaptive_nudge")
            .gte("sent_at", f"{utc_week_start}T00:00:00")
            .ilike("title", "%pattern%")
            .execute()
        )

        users_with_pattern_nudge = set(
            n.get("user_id") for n in (existing_nudges_result.data or [])
        )

        # Only nudge goals that have a pending check-in today (user has not checked in yet)
        goal_ids_pattern = [
            i.get("goal_id") for i in motivation_needed if i.get("goal_id")
        ]
        goals_with_pending_today_pattern = get_goal_ids_with_pending_checkin_today(
            supabase, goal_ids_pattern, utc_today
        )

        for user_id, insights in user_insights.items():
            processed += 1

            if not insights:
                continue

            # O(1) lookup: Skip if already sent this week
            if user_id in users_with_pattern_nudge:
                continue

            # Get first insight for this user
            insight = insights[0]
            goal_id = insight.get("goal_id")
            goal = goals_by_id.get(goal_id) or {}
            user = users_by_id.get(user_id) or {}

            # Skip if user has already checked in for this goal today (no pending check-in)
            if goal_id not in goals_with_pending_today_pattern:
                continue
            goal_title = goal.get("title") or "your goal"
            user_name = user.get("name") or "Champion"
            user_tz_str = user.get("timezone") or "UTC"

            # Check if it's morning (8-10 AM) in user's timezone
            try:
                tz = pytz.timezone(user_tz_str)
                now = datetime.now(tz)
                if not (8 <= now.hour <= 10):
                    continue
            except Exception:
                continue

            # Check feature access
            if not has_user_feature_sync(supabase, user_id, "adaptive_nudging"):
                continue

            # Check if we can send a nudge
            if not can_send_nudge(user_tz_str):
                continue

            # Get skip reasons for this goal to provide targeted suggestion
            skip_reasons = []
            try:
                skip_result = supabase.rpc(
                    "get_skip_reasons_summary", {"p_goal_id": goal_id}
                ).execute()
                skip_reasons = skip_result.data or []
            except Exception:
                pass

            # Get top reason if available
            top_reason = None
            count = 0
            if skip_reasons and len(skip_reasons) > 0:
                top_skip = skip_reasons[0]
                top_reason = top_skip.get("reason", "").lower()
                count = top_skip.get("count", 0)

            # Pattern-specific suggestions matching SKIP_REASONS:
            # work, tired, sick, schedule, other
            suggestions = {
                "work": {
                    "title": "💡 Work-Life Balance",
                    "body": f"{user_name}, work has gotten in the way {count} times for {goal_title}. Try a quick 5-minute version on busy days - consistency beats perfection!",
                },
                "tired": {
                    "title": "💡 Energy Pattern",
                    "body": f"{user_name}, you've felt tired {count} times for {goal_title}. Have you tried scheduling it earlier when you have more energy?",
                },
                "sick": {
                    "title": "💡 Health First",
                    "body": f"{user_name}, health comes first! You've been unwell {count} times. When you're ready, start with a lighter version of {goal_title}.",
                },
                "schedule": {
                    "title": "💡 Schedule Tip",
                    "body": f"{user_name}, scheduling has been tricky {count} times for {goal_title}. Try blocking time in your calendar or pairing it with an existing habit.",
                },
                "other": {
                    "title": "💡 Fresh Start",
                    "body": f"{user_name}, life happens! You've had {count} bumps with {goal_title}. Today is a new opportunity - what's one small step you can take?",
                },
            }

            # Default suggestion if no specific pattern
            suggestion = suggestions.get(
                top_reason,
                {
                    "title": "💪 You've Got This!",
                    "body": f"{user_name}, your {goal_title} journey has had some bumps - that's totally normal! Today is a fresh start. What's one small step you can take?",
                },
            )

            # Save to history only when we have a goal deepLink
            result = send_push_to_user_sync(
                user_id=user_id,
                title=suggestion["title"],
                body=suggestion["body"],
                data={
                    "type": "adaptive_nudge",
                    "nudge_type": "pattern_suggestion",
                    "goalId": goal_id,
                    "pattern": top_reason or "general",
                    "deepLink": (
                        f"/(user)/(goals)/details?id={goal_id}" if goal_id else None
                    ),
                },
                notification_type="adaptive_nudge",
                entity_type="goal",
                entity_id=goal_id,
                save_to_notification_history=bool(goal_id),
            )

            if result.get("success") or result.get("delivered", 0) > 0:
                nudged += 1
                users_with_pattern_nudge.add(user_id)

        logger.info(f"[PatternSuggestion] Processed {processed} users, nudged {nudged}")
        return {"processed": processed, "nudged": nudged}

    except Exception as e:
        logger.error(f"[PatternSuggestion] Error: {e}")
        raise self.retry(exc=e, countdown=300)


@celery_app.task(name="check_crushing_it", bind=True, max_retries=2)
def check_crushing_it_task(self):
    """
    Send "Crushing It" celebration nudge when user is on a hot streak.

    Criteria:
    - User has completed all scheduled check-ins so far this week (5 for 5, etc.)
    - Minimum 3 scheduled days completed
    - Haven't received a "crushing it" nudge this week

    Only runs in the evening (5-8 PM user timezone) when they've completed for the day.

    SCALABILITY: Uses batch prefetching to avoid N+1 queries.
    """
    import random

    try:
        supabase = get_supabase_client()
        nudged = 0
        processed = 0

        # Get all active goals (batch join users in Python to avoid embed ambiguity)
        goals_result = (
            supabase.table("goals")
            .select("id, user_id, title, frequency_type, target_days")
            .eq("status", "active")
            .execute()
        )

        if not goals_result.data:
            return {"processed": 0, "nudged": 0}

        goals = goals_result.data
        goal_ids = [g["id"] for g in goals]
        user_ids = list(set(g["user_id"] for g in goals))

        users_result = (
            supabase.table("users")
            .select("id, name, timezone")
            .in_("id", user_ids)
            .execute()
        )
        users_by_id = {u["id"]: u for u in (users_result.data or []) if u.get("id")}

        # SCALABILITY: Batch prefetch this week's check-ins for ALL goals at once
        # Instead of 1 query per goal (N+1), we do 1 query total
        utc_now = datetime.now(pytz.UTC)
        utc_today = utc_now.date()
        utc_week_start = utc_today - timedelta(days=utc_today.weekday())  # Monday

        # V2.1: Select status instead of completed
        all_checkins_result = (
            supabase.table("check_ins")
            .select("goal_id, check_in_date, status")
            .in_("goal_id", goal_ids)
            .gte("check_in_date", str(utc_week_start))
            .execute()
        )

        # Build lookup: goal_id -> list of check-ins
        checkins_by_goal = {}
        for c in all_checkins_result.data or []:
            gid = c.get("goal_id")
            if gid not in checkins_by_goal:
                checkins_by_goal[gid] = []
            checkins_by_goal[gid].append(c)

        # SCALABILITY: Batch prefetch existing "crushing it" nudges this week for ALL users
        # Instead of 1 query per user (N+1), we do 1 query total
        existing_nudges_result = (
            supabase.table("notification_history")
            .select("user_id")
            .in_("user_id", user_ids)
            .eq("notification_type", "adaptive_nudge")
            .gte("sent_at", f"{utc_week_start}T00:00:00")
            .ilike("title", "%crushing it%")
            .execute()
        )

        users_with_crushing_nudge = set(
            n.get("user_id") for n in (existing_nudges_result.data or [])
        )

        for goal in goals:
            processed += 1
            user_id = goal.get("user_id")
            goal_id = goal.get("id")
            goal_title = goal.get("title")
            user = users_by_id.get(user_id) or {}
            user_name = user.get("name") or "Champion"
            user_tz_str = user.get("timezone") or "UTC"

            # Check if it's evening in user's timezone (5 PM - 8 PM)
            try:
                tz = pytz.timezone(user_tz_str)
                now = datetime.now(tz)
                if not (17 <= now.hour <= 20):
                    continue
            except Exception:
                continue

            # O(1) lookup: Skip if already sent this week
            if user_id in users_with_crushing_nudge:
                continue

            # Check feature access
            if not has_user_feature_sync(supabase, user_id, "adaptive_nudging"):
                continue

            # Check if we can send a nudge
            if not can_send_nudge(user_tz_str):
                continue

            # Calculate this week's scheduled days and completions using prefetched data
            try:
                today = now.date()

                # O(1) lookup from prefetched data
                goal_checkins = checkins_by_goal.get(goal_id, [])

                # Filter to this week based on user's timezone
                week_checkins = [
                    c
                    for c in goal_checkins
                    if c.get("check_in_date") and c.get("check_in_date") <= str(today)
                ]

                if not week_checkins:
                    continue

                # Count scheduled days completed (using status)
                # V2.1: status='completed' means done, status='rest_day' is a rest day
                completed_count = sum(
                    1 for c in week_checkins if c.get("status") == "completed"
                )
                total_scheduled = len(
                    [
                        c
                        for c in week_checkins
                        if c.get("status") not in ("pending", "rest_day")
                    ]
                )

                # Need at least 3 scheduled days and all completed
                if total_scheduled < 3 or completed_count < total_scheduled:
                    continue

                # User is crushing it! Send celebration
                celebrations = [
                    f"{completed_count} for {completed_count} this week! 🔥 {user_name}, you're absolutely crushing {goal_title}!",
                    f"Perfect week so far! {completed_count}/{completed_count} on {goal_title}. {user_name}, you're unstoppable! 💪",
                    f"🏆 {user_name}, you haven't missed a beat! {completed_count} days straight with {goal_title}. Keep it going!",
                ]
                body = random.choice(celebrations)

                result = send_push_to_user_sync(
                    user_id=user_id,
                    title="🔥 You're Crushing It!",
                    body=body,
                    data={
                        "type": "adaptive_nudge",
                        "nudge_type": "crushing_it",
                        "goalId": goal_id,
                        "completedCount": completed_count,
                        "deepLink": f"/(user)/(goals)/details?id={goal_id}",
                    },
                    notification_type="adaptive_nudge",
                    entity_type="goal",
                    entity_id=goal_id,
                )

                if result.get("success") or result.get("delivered", 0) > 0:
                    nudged += 1
                    # Add to set to avoid duplicate nudges to same user for different goals
                    users_with_crushing_nudge.add(user_id)

            except Exception as e:
                logger.warning(f"Error checking crushing it for goal {goal_id}: {e}")
                continue

        logger.info(f"[CrushingIt] Processed {processed} goals, nudged {nudged}")
        return {"processed": processed, "nudged": nudged}

    except Exception as e:
        logger.error(f"[CrushingIt] Error: {e}")
        raise self.retry(exc=e, countdown=300)


# Convenience task to run all adaptive nudging checks
@celery_app.task(name="run_all_adaptive_nudges")
def run_all_adaptive_nudges_task():
    """
    Run all adaptive nudge checks. Called by Celery beat schedule.

    Each sub-task handles its own timing logic (e.g., morning vs evening).
    """
    logger.info("[AdaptiveNudging] Running all adaptive nudge checks")

    # These will run in parallel
    check_streak_at_risk_task.delay()
    check_risky_day_warning_task.delay()
    check_missed_days_intervention_task.delay()
    check_approaching_milestone_task.delay()
    check_crushing_it_task.delay()
    check_pattern_suggestion_task.delay()

    return {"status": "dispatched"}
