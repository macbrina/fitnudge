"""
FitNudge V2 - Achievement Condition Checker

Handles checking if achievement unlock conditions are met.
Separated for cleaner code organization and easier testing.

Returns both condition result AND metadata to avoid duplicate queries.

V2 Supported condition types (must match achievement_types.unlock_condition in 005_seed_data.sql):
- checkin_count: Total completed check-ins
- goal_count: Total goals created
- partner_count: Active accountability partners
- streak: Check-in streak across all goals
- perfect_week: 7 consecutive days with check-ins
- perfect_month: 30 consecutive days with check-ins
- perfect_period: X consecutive days with check-ins
- nudges_sent: Total nudges sent
- cheers_sent: Total cheers sent
- ai_conversations: Total AI coach conversations
- recaps_viewed: Total weekly recaps viewed
- account_age: Days since account creation
"""

import json
from datetime import date, datetime, timedelta
from typing import Any, Dict, Tuple

from app.core.database import get_supabase_client
from app.services.logger import logger

# Type alias for condition check result: (is_met, metadata)
ConditionResult = Tuple[bool, Dict[str, Any]]


class AchievementConditionChecker:
    """Handles checking achievement unlock conditions"""

    async def check_condition(self, user_id: str, condition: str) -> ConditionResult:
        """
        Check if an achievement condition is met.

        Args:
            user_id: User ID
            condition: JSON string describing the condition

        Returns:
            Tuple of (is_condition_met, metadata_dict)
            - is_condition_met: True if condition is met
            - metadata_dict: Relevant stats for the achievement (e.g., {"checkin_count": 150})
        """
        try:
            condition_data = (
                json.loads(condition) if isinstance(condition, str) else condition
            )
            condition_type = condition_data.get("type")
            target_value = condition_data.get("value")

            supabase = get_supabase_client()

            # ==========================================
            # CHECK-IN & GOAL CONDITIONS
            # ==========================================

            if condition_type == "checkin_count":
                return await self._check_checkin_count(supabase, user_id, target_value)

            elif condition_type == "streak":
                return await self._check_streak(user_id, target_value)

            elif condition_type == "goal_count":
                return await self._check_goal_count(supabase, user_id, target_value)

            elif condition_type == "perfect_week":
                return await self._check_perfect_period(supabase, user_id, 7)

            elif condition_type == "perfect_month":
                return await self._check_perfect_period(supabase, user_id, 30)

            elif condition_type == "perfect_period":
                return await self._check_perfect_period(supabase, user_id, target_value)

            # ==========================================
            # SOCIAL & PARTNER CONDITIONS
            # ==========================================

            elif condition_type == "partner_count":
                return await self._check_partner_count(supabase, user_id, target_value)

            elif condition_type == "nudges_sent":
                return await self._check_nudges_sent(supabase, user_id, target_value)

            elif condition_type == "cheers_sent":
                return await self._check_cheers_sent(supabase, user_id, target_value)

            # ==========================================
            # ENGAGEMENT CONDITIONS
            # ==========================================

            elif condition_type == "ai_conversations":
                return await self._check_ai_conversations(
                    supabase, user_id, target_value
                )

            elif condition_type == "recaps_viewed":
                return await self._check_recaps_viewed(supabase, user_id, target_value)

            elif condition_type == "account_age":
                return await self._check_account_age(supabase, user_id, target_value)

            # Unknown condition type
            logger.warning(
                f"Unknown achievement condition type: {condition_type}",
                {"condition": condition, "user_id": user_id},
            )
            return False, {}

        except Exception as e:
            logger.error(
                f"Failed to check achievement condition: {e}",
                {"condition": condition, "error": str(e)},
            )
            return False, {}

    # ==========================================
    # CHECK-IN & GOAL CONDITION IMPLEMENTATIONS
    # ==========================================

    async def _check_checkin_count(
        self, supabase: Any, user_id: str, target_value: int
    ) -> ConditionResult:
        """Count total check-ins across all goals (status = 'completed')"""
        # V2.1: Use status instead of completed boolean
        result = (
            supabase.table("check_ins")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("status", "completed")
            .execute()
        )
        count = result.count if hasattr(result, "count") else len(result.data or [])
        return count >= target_value, {"checkin_count": count}

    async def _check_streak(self, user_id: str, target_value: int) -> ConditionResult:
        """Check if current streak meets target"""
        streak = await self.get_current_streak(user_id)
        return streak >= target_value, {"streak": streak}

    async def _check_goal_count(
        self, supabase: Any, user_id: str, target_value: int
    ) -> ConditionResult:
        """Count total goals created"""
        result = (
            supabase.table("goals")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .execute()
        )
        count = result.count if hasattr(result, "count") else len(result.data or [])
        return count >= target_value, {"goal_count": count}

    async def _check_perfect_period(
        self, supabase: Any, user_id: str, days: int
    ) -> ConditionResult:
        """Check if user completed all check-ins for X consecutive days"""
        # V2.1: Use status instead of completed boolean
        today = date.today()
        start_date = today - timedelta(days=days - 1)

        result = (
            supabase.table("check_ins")
            .select("check_in_date")
            .eq("user_id", user_id)
            .eq("status", "completed")
            .gte("check_in_date", start_date.isoformat())
            .lte("check_in_date", today.isoformat())
            .execute()
        )
        completed_dates = {row["check_in_date"] for row in (result.data or [])}
        perfect_days = len(completed_dates)
        return perfect_days >= days, {"perfect_days": perfect_days}

    # ==========================================
    # SOCIAL & PARTNER CONDITION IMPLEMENTATIONS
    # ==========================================

    async def _check_partner_count(
        self, supabase: Any, user_id: str, target_value: int
    ) -> ConditionResult:
        """Count active accountability partners"""
        result = (
            supabase.table("accountability_partners")
            .select("id", count="exact")
            .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
            .eq("status", "accepted")
            .execute()
        )
        count = result.count if hasattr(result, "count") else len(result.data or [])
        return count >= target_value, {"partner_count": count}

    async def _check_nudges_sent(
        self, supabase: Any, user_id: str, target_value: int
    ) -> ConditionResult:
        """Count nudges sent by user"""
        result = (
            supabase.table("social_nudges")
            .select("id", count="exact")
            .eq("sender_id", user_id)
            .eq("nudge_type", "nudge")
            .execute()
        )
        count = result.count if hasattr(result, "count") else len(result.data or [])
        return count >= target_value, {"nudges_sent": count}

    async def _check_cheers_sent(
        self, supabase: Any, user_id: str, target_value: int
    ) -> ConditionResult:
        """Count cheers sent by user"""
        result = (
            supabase.table("social_nudges")
            .select("id", count="exact")
            .eq("sender_id", user_id)
            .eq("nudge_type", "cheer")
            .execute()
        )
        count = result.count if hasattr(result, "count") else len(result.data or [])
        return count >= target_value, {"cheers_sent": count}

    # ==========================================
    # ENGAGEMENT CONDITION IMPLEMENTATIONS
    # ==========================================

    async def _check_ai_conversations(
        self, supabase: Any, user_id: str, target_value: int
    ) -> ConditionResult:
        """Count AI coach user messages from daily usage tracking"""
        result = (
            supabase.table("ai_coach_daily_usage")
            .select("message_count")
            .eq("user_id", user_id)
            .execute()
        )
        # Sum all message counts across days
        total_messages = sum(row.get("message_count", 0) for row in (result.data or []))
        return total_messages >= target_value, {"ai_conversations": total_messages}

    async def _check_recaps_viewed(
        self, supabase: Any, user_id: str, target_value: int
    ) -> ConditionResult:
        """Count weekly recaps viewed by user (viewed_at is not null)"""
        result = (
            supabase.table("weekly_recaps")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .not_.is_("viewed_at", "null")
            .execute()
        )
        count = result.count if hasattr(result, "count") else len(result.data or [])
        return count >= target_value, {"recaps_viewed": count}

    async def _check_account_age(
        self, supabase: Any, user_id: str, target_value: int
    ) -> ConditionResult:
        """Check if account is at least X days old"""
        result = (
            supabase.table("users")
            .select("created_at")
            .eq("id", user_id)
            .single()
            .execute()
        )

        if not result.data:
            return False, {"account_age_days": 0}

        created_at_str = result.data.get("created_at")
        if not created_at_str:
            return False, {"account_age_days": 0}

        # Parse the datetime
        if isinstance(created_at_str, str):
            created_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
        else:
            created_at = created_at_str

        days_since_creation = (datetime.now(created_at.tzinfo) - created_at).days
        return days_since_creation >= target_value, {
            "account_age_days": days_since_creation
        }

    # ==========================================
    # STREAK CALCULATION HELPERS
    # ==========================================

    async def get_current_streak(self, user_id: str) -> int:
        """
        Get current streak for user across all goals.

        Args:
            user_id: User ID

        Returns:
            Current streak count (days)
        """
        supabase = get_supabase_client()

        # Get all completed check-ins across all goals, ordered by date descending
        # V2.1: Use status instead of completed boolean
        result = (
            supabase.table("check_ins")
            .select("check_in_date")
            .eq("user_id", user_id)
            .eq("status", "completed")
            .order("check_in_date", desc=True)
            .execute()
        )
        check_ins = result.data or []

        if not check_ins:
            return 0

        # Calculate streak by checking consecutive days
        streak = 0
        today = date.today()
        current_date = today

        for check_in in check_ins:
            check_in_date_val = (
                check_in["check_in_date"]
                if isinstance(check_in["check_in_date"], date)
                else date.fromisoformat(str(check_in["check_in_date"]))
            )

            # Check if this date matches our expected date
            if check_in_date_val == current_date:
                streak += 1
                current_date -= timedelta(days=1)
            elif check_in_date_val < current_date:
                # Gap in streak, break
                break

        return streak


# Global instance
condition_checker = AchievementConditionChecker()
