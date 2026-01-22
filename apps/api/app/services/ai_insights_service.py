"""
FitNudge - AI-Powered Pattern Insights Service

Generates personalized insights using AI based on check-in history.
Key features:
- Minimum 3 check-ins required for generation
- On-demand generation with caching (24h freshness)
- Weekly refresh for trend comparison
- Nudge configuration for adaptive nudging
- Status tracking for realtime UI updates

Flow:
1. Check if fresh insights exist (< 24h)
2. Check if enough data (3+ checkins)
3. If not enough: mark as insufficient_data
4. If generating: return current status
5. Otherwise: generate new insights via AI
"""

import json
from datetime import date, datetime, timedelta
from typing import Any, Dict, Optional

from openai import AsyncOpenAI

from app.core.config import settings
from app.core.database import get_supabase_client
from app.services.logger import logger

# Minimum check-ins required before generating insights
# Dynamic based on goal frequency - roughly 2 weeks of expected activity
# Floor of 3 (need some data), ceiling of 7 (don't punish daily users)
MIN_CHECKINS_FLOOR = 3
MIN_CHECKINS_CEILING = 7


def calculate_min_checkins_required(frequency_count: int) -> int:
    """
    Calculate minimum check-ins required based on goal frequency.

    Formula: ~2 weeks of expected check-ins, capped between 3 and 7

    Examples:
    - 7 days/week (daily) → max(3, min(7, 14)) = 7 (~1 week to reach)
    - 5 days/week → max(3, min(7, 10)) = 7 (~1.5 weeks)
    - 4 days/week → max(3, min(7, 8)) = 7 (~2 weeks)
    - 3 days/week → max(3, min(7, 6)) = 6 (~2 weeks)
    - 2 days/week → max(3, min(7, 4)) = 4 (~2 weeks)
    - 1 day/week → max(3, min(7, 2)) = 3 (~3 weeks)
    """
    two_weeks_worth = frequency_count * 2
    return max(MIN_CHECKINS_FLOOR, min(MIN_CHECKINS_CEILING, two_weeks_worth))


# How long insights are considered "fresh" (hours)
FRESHNESS_HOURS = 24

# OpenAI model for insights
INSIGHTS_MODEL = "gpt-4o-mini"

# System prompt for insight generation
INSIGHTS_SYSTEM_PROMPT = """You are a data-driven behavioral analyst for a habit tracking app. Analyze check-in data to find REAL patterns - not generic advice.

## CRITICAL RULES
1. Only mention patterns you can PROVE from the data
2. Never state the obvious (user knows their completion count)
3. No generic motivational fluff - be specific and data-backed
4. If there's no clear pattern, say so honestly

## RESPONSE FORMAT
Respond with valid JSON:
{
  "insights": [
    {
      "type": "pattern|encouragement|warning|tip",
      "text": "Specific, data-backed insight (1-2 sentences)",
      "priority": 1
    }
  ],
  "nudge_config": {
    "risky_days": [4, 5],
    "risk_level": "low|medium|high",
    "best_nudge_time": "09:00",
    "needs_extra_motivation": true|false
  },
  "summary": "One sentence pattern summary"
}

## INSIGHT TYPES
- **pattern**: Specific behavioral patterns with data (e.g., "You complete 90% on mornings, 30% on evenings")
- **encouragement**: Data-backed positive reinforcement (e.g., "Tuesdays are your power day - 100% completion")
- **warning**: Data-backed risk patterns (e.g., "3 of your last 4 skips were on Fridays")
- **tip**: Actionable suggestion based on THEIR specific pattern

## WHAT MAKES A GOOD INSIGHT
✓ "You've missed 5 of 7 Fridays - that's your weakest day"
✓ "When you skip once, you skip 2 more days 80% of the time"
✓ "Your morning check-ins have 85% success vs 40% evenings"
✓ "'Tired' was your skip reason 6 times - consider a rest day routine"
✓ "Your best streak started after a skip - bouncing back is your strength"
✓ "You've completed 8 days in a row - that's your longest streak yet!"
✓ "Mondays are your strongest day with 90% completion"

## WHAT TO AVOID
✗ "You're doing great!" (empty encouragement)
✗ "Keep up the good work!" (generic)
✗ "Your completion rate is 60%" (they can see this in stats)
✗ "Consider setting reminders" (generic advice)
✗ "You checked in on Monday" (stating the obvious)

## NUDGE CONFIG EXPLANATION
- **risky_days**: Days where user historically skips or has <60% completion. Format: 0=Sunday, 1=Monday, ..., 6=Saturday. Example: [4, 5] means Thursday and Friday are risky.
- **risk_level**: Overall consistency - "high" if <50% completion, "medium" if 50-75%, "low" if >75%
- **best_nudge_time**: When to send reminder based on their successful check-in times (HH:MM format)
- **needs_extra_motivation**: true if user has consecutive skips or declining trend

## GUIDELINES
1. Generate 1-3 insights MAX (only if data supports them)
2. Reference specific numbers, days, patterns
3. If data is insufficient for patterns, return fewer insights
4. Priority 1 = most actionable insight
"""


class AIInsightsService:
    """Service for generating AI-powered pattern insights."""

    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.supabase = get_supabase_client()

    async def get_or_generate_insights(
        self,
        goal_id: str,
        user_id: str,
        force_refresh: bool = False,
    ) -> Dict[str, Any]:
        """
        Get existing insights or trigger background generation.

        NON-BLOCKING: If insights need to be generated, this triggers a
        background Celery task and returns immediately with status='generating'.
        The UI should use realtime subscription to update when complete.

        Returns dict with:
        - status: pending|generating|completed|failed|insufficient_data
        - data: The insight data (if available)
        - checkins_count: Number of check-ins (if insufficient_data)
        - min_required: Minimum required (if insufficient_data)
        """
        try:
            # Check existing insights
            existing = await self._get_existing_insight(goal_id)

            if existing:
                # If already generating, return status immediately
                if existing["status"] == "generating":
                    return {"status": "generating", "data": existing}

                # If completed and fresh, return cached
                if existing["status"] == "completed" and not force_refresh:
                    if self._is_fresh(existing.get("generated_at")):
                        return {"status": "completed", "data": existing}

                # If failed, don't auto-retry - require explicit force_refresh
                # This prevents infinite retry loops
                if existing["status"] == "failed" and not force_refresh:
                    return {"status": "failed", "data": existing}

            # Check if enough data (dynamic threshold based on goal frequency)
            checkin_count = await self._get_checkin_count(goal_id)
            frequency_count = await self._get_goal_frequency(goal_id)
            min_required = calculate_min_checkins_required(frequency_count)

            if checkin_count < min_required:
                # Not enough data - only upsert if status changed or doesn't exist
                # This prevents infinite realtime loops
                if not existing or existing.get("status") != "insufficient_data":
                    await self._upsert_insight(
                        goal_id=goal_id,
                        user_id=user_id,
                        status="insufficient_data",
                        checkins_analyzed=checkin_count,
                    )
                return {
                    "status": "insufficient_data",
                    "checkins_count": checkin_count,
                    "min_required": min_required,
                    "data": existing,  # Return existing data if any
                }

            # Mark as generating
            await self._upsert_insight(
                goal_id=goal_id,
                user_id=user_id,
                status="generating",
                checkins_analyzed=checkin_count,
            )

            # Trigger background task - DO NOT AWAIT
            # Import here to avoid circular imports
            from app.services.tasks.goal_tasks import generate_goal_insights_task

            generate_goal_insights_task.delay(goal_id, user_id)

            # Return immediately with generating status
            return {"status": "generating", "data": None}

        except Exception as e:
            logger.error(f"Error in get_or_generate_insights: {e}")
            # Mark as failed
            await self._upsert_insight(
                goal_id=goal_id,
                user_id=user_id,
                status="failed",
                error_message=str(e),
            )
            return {"status": "failed", "error": str(e)}

    async def generate_insights_background(
        self,
        goal_id: str,
        user_id: str,
    ) -> Dict[str, Any]:
        """
        Actually generate insights - called by Celery task.

        This is the blocking AI call that runs in the background worker.
        Updates the database when complete, triggering realtime update.
        """
        try:
            existing = await self._get_existing_insight(goal_id)
            result = await self._generate_insights(goal_id, user_id, existing)
            return {"status": "completed", "data": result}

        except Exception as e:
            logger.error(f"Error in generate_insights_background: {e}")
            await self._upsert_insight(
                goal_id=goal_id,
                user_id=user_id,
                status="failed",
                error_message=str(e),
            )
            return {"status": "failed", "error": str(e)}

    async def refresh_all_for_user(self, user_id: str) -> Dict[str, Any]:
        """
        Refresh insights for all active goals of a user.
        Called by weekly task (runs in background, so blocking is OK).
        """
        try:
            # Get all active goals with frequency for dynamic threshold
            goals_result = (
                self.supabase.table("goals")
                .select("id, frequency_count")
                .eq("user_id", user_id)
                .eq("status", "active")
                .execute()
            )

            goals = (goals_result.data or []) if goals_result else []
            results = {"refreshed": 0, "skipped": 0, "failed": 0}

            for goal in goals:
                try:
                    # Check if enough data first (dynamic threshold)
                    checkin_count = await self._get_checkin_count(goal["id"])
                    frequency_count = goal.get("frequency_count", 7) or 7
                    min_required = calculate_min_checkins_required(frequency_count)

                    if checkin_count < min_required:
                        await self._upsert_insight(
                            goal_id=goal["id"],
                            user_id=user_id,
                            status="insufficient_data",
                            checkins_analyzed=checkin_count,
                        )
                        results["skipped"] += 1
                        continue

                    # Generate directly (blocking is OK in background task)
                    result = await self.generate_insights_background(
                        goal_id=goal["id"],
                        user_id=user_id,
                    )
                    if result["status"] == "completed":
                        results["refreshed"] += 1
                    else:
                        results["failed"] += 1
                except Exception as e:
                    logger.error(
                        f"Failed to refresh insights for goal {goal['id']}: {e}"
                    )
                    results["failed"] += 1

            return results

        except Exception as e:
            logger.error(f"Error in refresh_all_for_user: {e}")
            return {"error": str(e)}

    async def _get_existing_insight(self, goal_id: str) -> Optional[Dict]:
        """Get existing insight for a goal."""
        try:
            result = (
                self.supabase.table("pattern_insights")
                .select("*")
                .eq("goal_id", goal_id)
                .maybe_single()
                .execute()
            )
            return result.data if result else None
        except Exception as e:
            logger.warning(f"Error fetching existing insight: {e}")
            return None

    async def _get_checkin_count(self, goal_id: str) -> int:
        """Get number of check-ins in last 90 days."""
        try:
            cutoff = (date.today() - timedelta(days=90)).isoformat()
            result = (
                self.supabase.table("check_ins")
                .select("id", count="exact")
                .eq("goal_id", goal_id)
                .gte("check_in_date", cutoff)
                .execute()
            )
            return result.count or 0 if result else 0
        except Exception as e:
            logger.warning(f"Error fetching checkin count: {e}")
            return 0

    async def _get_goal_frequency(self, goal_id: str) -> int:
        """Get goal's frequency_count (days per week). Defaults to 7 if not found."""
        try:
            result = (
                self.supabase.table("goals")
                .select("frequency_count")
                .eq("id", goal_id)
                .single()
                .execute()
            )
            if result and result.data:
                return result.data.get("frequency_count", 7) or 7
            return 7
        except Exception as e:
            logger.warning(f"Error fetching goal frequency: {e}")
            return 7  # Default to daily

    def _is_fresh(self, generated_at: Optional[str]) -> bool:
        """Check if insights are still fresh."""
        if not generated_at:
            return False
        try:
            gen_time = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
            now = datetime.now(gen_time.tzinfo)
            return (now - gen_time) < timedelta(hours=FRESHNESS_HOURS)
        except Exception:
            return False

    async def _upsert_insight(
        self,
        goal_id: str,
        user_id: str,
        status: str,
        checkins_analyzed: int = 0,
        insights: Optional[Dict] = None,
        nudge_config: Optional[Dict] = None,
        current_metrics: Optional[Dict] = None,
        previous_metrics: Optional[Dict] = None,
        error_message: Optional[str] = None,
    ) -> Dict:
        """Insert or update insight row."""
        data = {
            "goal_id": goal_id,
            "user_id": user_id,
            "status": status,
            "checkins_analyzed": checkins_analyzed,
        }

        if insights is not None:
            data["insights"] = insights
        if nudge_config is not None:
            data["nudge_config"] = nudge_config
        if current_metrics is not None:
            data["current_metrics"] = current_metrics
        if previous_metrics is not None:
            data["previous_metrics"] = previous_metrics
        if error_message is not None:
            data["error_message"] = error_message
        if status == "completed":
            data["generated_at"] = datetime.utcnow().isoformat()

        result = (
            self.supabase.table("pattern_insights")
            .upsert(data, on_conflict="goal_id")
            .execute()
        )

        return result.data[0] if result and result.data else {}

    async def _generate_insights(
        self,
        goal_id: str,
        user_id: str,
        existing: Optional[Dict],
    ) -> Dict:
        """Generate insights using AI."""
        try:
            # Get metrics using the PostgreSQL function
            metrics_result = self.supabase.rpc(
                "calculate_goal_metrics", {"p_goal_id": goal_id}
            ).execute()
            current_metrics = (metrics_result.data or {}) if metrics_result else {}

            # Get recent check-ins for AI context
            checkins_result = self.supabase.rpc(
                "get_checkins_for_ai", {"p_goal_id": goal_id, "p_limit": 30}
            ).execute()
            recent_checkins = (checkins_result.data or []) if checkins_result else []

            # Get skip reasons summary
            skip_result = self.supabase.rpc(
                "get_skip_reasons_summary", {"p_goal_id": goal_id}
            ).execute()
            skip_reasons = (skip_result.data or []) if skip_result else []

            # Previous metrics for trend comparison
            previous_metrics = existing.get("current_metrics") if existing else None

            # Build context for AI
            context = self._build_ai_context(
                current_metrics, recent_checkins, skip_reasons, previous_metrics
            )

            # Call AI
            ai_response = await self._call_ai(context)

            # Parse response
            insights_data = self._parse_ai_response(ai_response)

            # Update database
            result = await self._upsert_insight(
                goal_id=goal_id,
                user_id=user_id,
                status="completed",
                checkins_analyzed=current_metrics.get("total_checkins_30d", 0),
                insights=insights_data.get("insights", []),
                nudge_config=insights_data.get("nudge_config", {}),
                current_metrics=current_metrics,
                previous_metrics=previous_metrics,
            )

            return result

        except Exception as e:
            logger.error(f"Error generating insights: {e}")
            await self._upsert_insight(
                goal_id=goal_id,
                user_id=user_id,
                status="failed",
                error_message=str(e),
            )
            raise

    def _build_ai_context(
        self,
        metrics: Dict,
        checkins: list,
        skip_reasons: list,
        previous_metrics: Optional[Dict],
    ) -> str:
        """Build context string for AI."""
        day_names = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
        ]

        context_parts = [
            f"## Goal: {metrics.get('goal_title', 'Unknown')}",
            f"- Frequency: {metrics.get('frequency_type', 'daily')} ({metrics.get('frequency_count', 7)}x/week)",
            "",
            "## Current Metrics (Last 30 Days)",
            f"- Completion Rate: {metrics.get('completion_rate_30d', 0)}%",
            f"- Check-ins: {metrics.get('completed_checkins_30d', 0)}/{metrics.get('total_checkins_30d', 0)}",
            f"- Current Streak: {metrics.get('current_streak', 0)} days",
            f"- Longest Streak: {metrics.get('longest_streak', 0)} days",
        ]

        # Best/worst days
        best_day = metrics.get("best_day_index")
        if best_day is not None:
            context_parts.append(
                f"- Best Day: {day_names[best_day]} ({metrics.get('best_day_rate', 0)}% completion)"
            )

        worst_day = metrics.get("worst_day_index")
        if worst_day is not None:
            context_parts.append(
                f"- Challenging Day: {day_names[worst_day]} ({metrics.get('worst_day_rate', 0)}% completion)"
            )

        # Previous metrics for trend
        if previous_metrics:
            context_parts.extend(
                [
                    "",
                    "## Previous Week Comparison",
                    f"- Previous Completion Rate: {previous_metrics.get('completion_rate_30d', 0)}%",
                    f"- Previous Streak: {previous_metrics.get('current_streak', 0)} days",
                ]
            )

        # Skip reasons
        if skip_reasons:
            context_parts.extend(["", "## Common Skip Reasons"])
            for reason in skip_reasons[:3]:
                context_parts.append(
                    f"- \"{reason.get('reason', 'Unknown')}\": {reason.get('count', 0)} times"
                )

        # Recent check-ins sample (V2: use status field)
        if checkins:
            context_parts.extend(["", "## Recent Check-ins (Last 10)"])
            for ci in checkins[:10]:
                ci_status = ci.get("status", "pending")
                status = "✓" if ci_status == "completed" else ("💤" if ci_status == "rest_day" else "✗")
                day = ci.get("day_name", "").strip()
                reason = f" ({ci.get('skip_reason')})" if ci.get("skip_reason") else ""
                context_parts.append(f"- {ci.get('date')} ({day}): {status}{reason}")

        return "\n".join(context_parts)

    async def _call_ai(self, context: str) -> str:
        """Call OpenAI API for insight generation."""
        response = await self.client.chat.completions.create(
            model=INSIGHTS_MODEL,
            messages=[
                {"role": "system", "content": INSIGHTS_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Analyze this check-in data and generate insights:\n\n{context}",
                },
            ],
            temperature=0.7,
            max_tokens=800,
            response_format={"type": "json_object"},
        )

        return response.choices[0].message.content or "{}"

    def _parse_ai_response(self, response: str) -> Dict:
        """Parse and validate AI response."""
        try:
            data = json.loads(response)

            # Validate structure
            insights = data.get("insights", [])
            if not isinstance(insights, list):
                insights = []

            nudge_config = data.get("nudge_config", {})
            if not isinstance(nudge_config, dict):
                nudge_config = {}

            # Ensure required nudge_config fields
            nudge_config.setdefault("risky_days", [])
            nudge_config.setdefault("risk_level", "medium")
            nudge_config.setdefault("best_nudge_time", "09:00")
            nudge_config.setdefault("needs_extra_motivation", False)

            return {
                "insights": insights,
                "nudge_config": nudge_config,
                "summary": data.get("summary", ""),
            }

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response: {e}")
            return {
                "insights": [
                    {
                        "type": "tip",
                        "text": "Keep checking in to build your pattern insights!",
                        "priority": 1,
                    }
                ],
                "nudge_config": {
                    "risky_days": [],
                    "risk_level": "medium",
                    "best_nudge_time": "09:00",
                    "needs_extra_motivation": False,
                },
                "summary": "Not enough data for detailed patterns yet.",
            }


# Singleton instance
_insights_service: Optional[AIInsightsService] = None


def get_ai_insights_service() -> AIInsightsService:
    """Get singleton instance of AIInsightsService."""
    global _insights_service
    if _insights_service is None:
        _insights_service = AIInsightsService()
    return _insights_service
