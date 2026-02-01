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
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

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

# System prompt for insight generation (evidence-first approach)
# Evidence is computed deterministically in code, AI only generates insights
INSIGHTS_SYSTEM_PROMPT = """You are a supportive habit coach. Your role is to help users understand their patterns and improve.

CRITICAL RULES
- The evidence block below is VERIFIED and computed by the system. Do NOT recalculate or contradict it.
- Only reference data explicitly shown in the evidence or metrics.
- Never guess or make up numbers. If something isn't in the evidence, don't mention it.
- Be supportive and encouraging, not judgmental.

TASK
Generate 1–3 insights that help the user understand their patterns and improve. Use the evidence to support your insights.

INSIGHT TYPES
- "pattern": Observations about their behavior (e.g., "Mondays have been challenging")
- "encouragement": Positive reinforcement (e.g., "You're building consistency")
- "warning": Areas needing attention (e.g., "You've missed 3 in a row")
- "tip": Actionable advice (e.g., "Try setting a reminder earlier on Mondays")

WARNING RULE (STRICT)
- The system provides "warning_flags" in the context.
- If warning_flags.should_warn is true: include EXACTLY ONE insight with type="warning".
- If warning_flags.should_warn is false: include ZERO warning insights.
- A warning must reference which flag triggered it (recent_streak_risk / stagnation_risk / chronic_low_consistency) in plain language.
- Warnings must be supportive and actionable (no shame).

WEEKDAY CLAIMS (STRICT)
- You may only call out a specific weekday as a pattern if evidence.weekday_stats[day].total >= 2.
- If total == 1, you can mention it only as "a single data point" or avoid naming the day.
- Do NOT say "particularly Tuesday, Thursday, and Friday" if each only has 1 sample.

OUTPUT
Return valid JSON:
{
  "insights": [
    {"type":"pattern|encouragement|warning|tip","text":"...","priority":1}
  ],
  "nudge_config": {
    "risk_level": "low|medium|high",
    "best_nudge_time": null,
    "needs_extra_motivation": true|false
  },
  "summary": "One to two sentence summary"
}

NOTES
- risky_days is computed by the system (not your job).
- risk_level: high < 0.50, medium 0.50–0.75, low > 0.75 (use completion_rate_30d from metrics if available).
- needs_extra_motivation: true if most recent check-ins show >=2 consecutive misses.
- best_nudge_time: null if no time-of-day data exists (do not default).
- Always include at least one "tip" if there are any missed check-ins.
- Rest days are intentional breaks, not failures - treat them positively.
- When mentioning completion rates, specify the time period (7-day vs 30-day).
- The goal was created on: [GOAL_CREATED_DATE]
"""


def compute_evidence(checkins: List[Dict]) -> Dict:
    """
    Deterministically compute evidence from check-ins.
    Assumes checkins are ordered MOST RECENT first.
    """
    N = len(checkins)

    # Overall counts
    counts = {
        "completed": 0,
        "missed": 0,
        "rest_day": 0,
        "total": N,
    }

    # Per-weekday accumulator
    weekday_raw = defaultdict(
        lambda: {
            "total": 0,
            "completed": 0,
            "missed": 0,
            "rest_day": 0,
        }
    )

    for ci in checkins:
        status = ci.get("status")
        day = ci.get("day_of_week")  # 0=Sun .. 6=Sat

        if day is None:
            continue

        weekday_raw[day]["total"] += 1

        if status == "completed":
            counts["completed"] += 1
            weekday_raw[day]["completed"] += 1
        elif status == "rest_day":
            counts["rest_day"] += 1
            weekday_raw[day]["rest_day"] += 1
        else:  # missed / skipped
            counts["missed"] += 1
            weekday_raw[day]["missed"] += 1

    # Final weekday stats with completion_rate
    weekday_stats = {}
    for day, stats in weekday_raw.items():
        total = stats["total"]
        completed = stats["completed"]

        completion_rate = round(completed / total, 3) if total > 0 else 0.0

        weekday_stats[str(day)] = {
            **stats,
            "completion_rate": completion_rate,
        }

    return {
        "window": {
            "checkins_used": N,
            "lines_used": f"[1]-[{N}]",
        },
        "counts": counts,
        "weekday_stats": weekday_stats,
    }


def compute_risky_days(weekday_stats: Dict) -> List[int]:
    """
    Deterministically compute risky_days from weekday_stats.
    Day is risky if: total >= 2 AND completion_rate < 0.60
    """
    risky = []

    for day_str, stats in weekday_stats.items():
        if isinstance(stats, dict):
            total = stats.get("total", 0)
            completion_rate = stats.get("completion_rate", 1.0)
            if total >= 2 and completion_rate < 0.60:
                risky.append(int(day_str))

    return sorted(risky)


def compute_needs_extra_motivation(checkins: List[Dict]) -> bool:
    """
    Determine if user needs extra motivation.
    Returns true if most recent check-ins contain >=2 consecutive misses.
    """
    consecutive_misses = 0
    for ci in checkins[:5]:  # Check most recent 5
        status = ci.get("status")
        if status in ("missed", "skipped"):
            consecutive_misses += 1
        elif status in ("completed", "rest_day"):
            consecutive_misses = 0  # Reset on any completion/rest_day
        if consecutive_misses >= 2:
            return True
    return False


def compute_best_nudge_time(checkins: List[Dict]) -> Optional[str]:
    """
    Compute best nudge time from successful check-in times.
    Returns null if no time-of-day data exists.
    """
    successful_times = []
    for ci in checkins:
        if ci.get("status") == "completed":
            created_at = ci.get("created_at")
            if created_at:
                try:
                    # Parse timestamp and extract hour
                    if isinstance(created_at, str):
                        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                    else:
                        dt = created_at
                    hour = dt.hour
                    successful_times.append(hour)
                except (ValueError, AttributeError):
                    continue

    if not successful_times:
        return None

    # Use most common hour
    hour_counts = defaultdict(int)
    for hour in successful_times:
        hour_counts[hour] += 1
    most_common_hour = max(hour_counts.items(), key=lambda x: x[1])[0]
    return f"{most_common_hour:02d}:00"


def compute_warning_flags(checkins: List[Dict], metrics: Dict) -> Dict:
    """
    Deterministically compute warning flags based on product rules.
    Returns dict with boolean flags indicating warning-worthy conditions.
    """
    # Recent streak risk: 2+ misses in the last 3 check-ins
    last3 = checkins[:3]
    misses_last3 = sum(1 for ci in last3 if ci.get("status") in ("missed", "skipped"))
    recent_streak_risk = misses_last3 >= 2

    # Stagnation risk: goal is at least 14 days old and 7d completion < 30d completion
    # Note: goal_age_days might not be in metrics, we'll compute from goal creation if needed
    goal_age = metrics.get("goal_age_days", 0) or 0
    cr7 = (metrics.get("completion_rate_7d", 0) or 0) / 100.0
    cr30 = (metrics.get("completion_rate_30d", 0) or 0) / 100.0
    stagnation_risk = goal_age >= 14 and cr7 < cr30

    # Chronic low consistency: enough samples AND very low 30d completion
    total30 = metrics.get("total_checkins_30d", 0) or 0
    chronic_low_consistency = total30 >= 14 and cr30 < 0.40

    should_warn = recent_streak_risk or stagnation_risk or chronic_low_consistency

    return {
        "recent_streak_risk": recent_streak_risk,
        "stagnation_risk": stagnation_risk,
        "chronic_low_consistency": chronic_low_consistency,
        "should_warn": should_warn,
    }


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
                    # Calculate min_required for response (not stored in DB)
                    frequency_count = await self._get_goal_frequency(goal_id)
                    min_required = calculate_min_checkins_required(frequency_count)
                    return {
                        "status": "generating",
                        "data": existing,
                        "checkins_count": existing.get("checkins_analyzed"),
                        "min_required": min_required,
                    }

                # If completed and fresh, return cached (skip queue). When force_refresh
                # (e.g. check-in), we do not skip — we proceed to queue to regenerate
                # with the new check-in data.
                if existing["status"] == "completed" and not force_refresh:
                    is_fresh = self._is_fresh(existing.get("generated_at"))
                    if is_fresh:
                        # Calculate min_required for response (not stored in DB)
                        frequency_count = await self._get_goal_frequency(goal_id)
                        min_required = calculate_min_checkins_required(frequency_count)
                        return {
                            "status": "completed",
                            "data": existing,
                            "checkins_count": existing.get("checkins_analyzed"),
                            "min_required": min_required,
                        }

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

            # Re-fetch right before queuing: another request may have already set
            # status='generating'. Skip queue to avoid duplicate tasks.
            current = await self._get_existing_insight(goal_id)
            if current and current.get("status") == "generating":
                return {
                    "status": "generating",
                    "data": current,
                    "checkins_count": checkin_count,
                    "min_required": min_required,
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

            # Return immediately with generating status (include min_required for frontend)
            return {
                "status": "generating",
                "data": None,
                "checkins_count": checkin_count,
                "min_required": min_required,
            }

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
        """Get number of responded check-ins in last 90 days (excludes pending)."""
        try:
            cutoff = (date.today() - timedelta(days=90)).isoformat()
            result = (
                self.supabase.table("check_ins")
                .select("id", count="exact")
                .eq("goal_id", goal_id)
                .gte("check_in_date", cutoff)
                .neq("status", "pending")
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
        summary: Optional[str] = None,
        evidence: Optional[Dict] = None,
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
        if summary is not None:
            data["summary"] = summary
        if evidence is not None:
            data["evidence"] = evidence  # Store evidence internally (JSONB column)
        if status == "completed":
            data["generated_at"] = datetime.utcnow().isoformat()

        result = (
            self.supabase.table("pattern_insights")
            .upsert(data, on_conflict="goal_id")
            .execute()
        )

        upserted_data = result.data[0] if result and result.data else {}

        return upserted_data

    async def _generate_insights(
        self,
        goal_id: str,
        user_id: str,
        existing: Optional[Dict],
    ) -> Dict:
        """Generate insights using AI."""
        try:
            # Get goal creation date
            goal_result = (
                self.supabase.table("goals")
                .select("created_at")
                .eq("id", goal_id)
                .single()
                .execute()
            )
            goal_created_at = None
            if goal_result and goal_result.data:
                goal_created_at = goal_result.data.get("created_at")

            # Get metrics using the PostgreSQL function
            metrics_result = self.supabase.rpc(
                "calculate_goal_metrics", {"p_goal_id": goal_id}
            ).execute()
            current_metrics = (metrics_result.data or {}) if metrics_result else {}

            print("current_metrics", current_metrics)

            # Get recent check-ins for AI context
            checkins_result = self.supabase.rpc(
                "get_checkins_for_ai", {"p_goal_id": goal_id, "p_limit": 30}
            ).execute()
            recent_checkins = (checkins_result.data or []) if checkins_result else []

            print("recent_checkins", recent_checkins)

            # Get skip reasons summary
            skip_result = self.supabase.rpc(
                "get_skip_reasons_summary", {"p_goal_id": goal_id}
            ).execute()
            skip_reasons = (skip_result.data or []) if skip_result else []

            # Previous metrics for trend comparison
            previous_metrics = existing.get("current_metrics") if existing else None

            # Compute goal_age_days if not in metrics
            goal_age_days = current_metrics.get("goal_age_days", 0)
            if not goal_age_days and goal_created_at:
                try:
                    if isinstance(goal_created_at, str):
                        created_dt = datetime.fromisoformat(
                            goal_created_at.replace("Z", "+00:00")
                        )
                    else:
                        created_dt = goal_created_at
                    goal_age_days = (date.today() - created_dt.date()).days
                except Exception:
                    goal_age_days = 0
            # Add to metrics for warning computation
            current_metrics["goal_age_days"] = goal_age_days

            # DETERMINISTIC COMPUTATION: Compute evidence first
            evidence = compute_evidence(recent_checkins)

            # DETERMINISTIC COMPUTATION: Compute warning flags
            warning_flags = compute_warning_flags(recent_checkins, current_metrics)

            # DETERMINISTIC COMPUTATION: Compute risky_days, needs_extra_motivation, best_nudge_time
            risky_days = compute_risky_days(evidence["weekday_stats"])
            needs_extra_motivation = compute_needs_extra_motivation(recent_checkins)
            best_nudge_time = compute_best_nudge_time(recent_checkins)

            # Compute risk_level from metrics
            completion_rate_30d = (
                current_metrics.get("completion_rate_30d", 0) / 100.0
            )  # Convert % to decimal
            if completion_rate_30d < 0.50:
                risk_level = "high"
            elif completion_rate_30d < 0.75:
                risk_level = "medium"
            else:
                risk_level = "low"

            # Build context for AI (includes evidence and warning flags)
            context = self._build_ai_context(
                current_metrics,
                recent_checkins,
                skip_reasons,
                previous_metrics,
                goal_created_at,
                evidence,  # Pass evidence to context builder
                warning_flags,  # Pass warning flags
            )

            # Call AI (pass raw data for logging)
            ai_response = await self._call_ai(
                context,
                goal_id,
                current_metrics,
                recent_checkins,
                skip_reasons,
                previous_metrics,
            )

            # Parse response - trust AI format, just normalize field names
            insights_data = self._parse_ai_response(ai_response)

            # ENFORCE WARNING RULES (post-parse validation)
            insights = insights_data.get("insights", [])
            if not warning_flags["should_warn"]:
                # Remove all warnings if should_warn is false
                insights = [i for i in insights if i.get("type") != "warning"]
            else:
                # Ensure exactly one warning if should_warn is true
                warnings = [i for i in insights if i.get("type") == "warning"]
                if len(warnings) == 0:
                    # Fallback: insert a templated warning (deterministic)
                    insights.insert(
                        0,
                        {
                            "type": "warning",
                            "text": "You've had a rough patch in your most recent check-ins—let's make it easier to succeed with a smaller target for the next 2 days.",
                            "priority": 1,
                        },
                    )
                elif len(warnings) > 1:
                    # Keep only the highest priority warning (first one)
                    first_warning = warnings[0]
                    insights = [i for i in insights if i.get("type") != "warning"]
                    insights.insert(0, first_warning)
            insights_data["insights"] = insights

            # Merge deterministic nudge_config with AI response
            nudge_config = insights_data.get("nudge_config", {})
            nudge_config["risky_days"] = risky_days  # Use computed value
            nudge_config["risk_level"] = risk_level  # Use computed value
            nudge_config["needs_extra_motivation"] = (
                needs_extra_motivation  # Use computed value
            )
            nudge_config["best_nudge_time"] = best_nudge_time  # Use computed value

            # Update database (store evidence internally)
            result = await self._upsert_insight(
                goal_id=goal_id,
                user_id=user_id,
                status="completed",
                checkins_analyzed=current_metrics.get("total_checkins_30d", 0),
                insights=insights_data.get("insights", []),
                nudge_config=nudge_config,
                current_metrics=current_metrics,
                previous_metrics=previous_metrics,
                summary=insights_data.get("summary"),
                evidence=evidence,  # Store evidence internally
            )

            # Calculate min_required for response (not stored in DB)
            frequency_count = await self._get_goal_frequency(goal_id)
            min_required = calculate_min_checkins_required(frequency_count)

            return {
                "status": "completed",
                "data": result,
                "checkins_count": result.get("checkins_analyzed"),
                "min_required": min_required,
            }

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
        goal_created_at: Optional[str] = None,
        evidence: Optional[Dict] = None,
        warning_flags: Optional[Dict] = None,
    ) -> str:
        """Build context string for AI. Evidence and warning_flags are computed deterministically and passed here."""
        day_names = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
        ]

        # Format goal creation date for AI context
        goal_created_str = "Unknown"
        if goal_created_at:
            try:
                from datetime import datetime

                if isinstance(goal_created_at, str):
                    created_dt = datetime.fromisoformat(
                        goal_created_at.replace("Z", "+00:00")
                    )
                else:
                    created_dt = goal_created_at
                goal_created_str = created_dt.strftime("%Y-%m-%d")
            except Exception:
                goal_created_str = str(goal_created_at)[:10]  # Just date part

        context_parts = [
            "## Metrics (authoritative if present)",
            f"Goal: {metrics.get('goal_title', 'Unknown')}",
            f"Created: {goal_created_str}",
            f"Frequency: {metrics.get('frequency_type', 'daily')} ({metrics.get('frequency_count', 7)}x/week)",
            f"30-Day Completion Rate: {metrics.get('completion_rate_30d', 0)}%",
            f"7-Day Completion Rate: {metrics.get('completion_rate_7d', 0)}%",
            f"Check-ins (30 days): {metrics.get('completed_checkins_30d', 0)}/{metrics.get('total_checkins_30d', 0)}",
            f"Current Streak: {metrics.get('current_streak', 0)} days",
            f"Longest Streak: {metrics.get('longest_streak', 0)} days",
        ]

        # Best/worst days
        best_day = metrics.get("best_day_index")
        if best_day is not None:
            best_rate = metrics.get("best_day_rate", 0)
            context_parts.append(
                f"- Best Day: {day_names[best_day]} ({best_rate}% completion, minimum 2 samples required)"
            )

        worst_day = metrics.get("worst_day_index")
        if worst_day is not None:
            worst_rate = metrics.get("worst_day_rate", 0)
            context_parts.append(
                f"- Challenging Day: {day_names[worst_day]} ({worst_rate}% completion, minimum 2 samples required)"
            )

        # Previous metrics for trend (only if available)
        if previous_metrics:
            context_parts.extend(
                [
                    "",
                    "## Previous Period Comparison (if available)",
                    f"- Previous 30-Day Completion Rate: {previous_metrics.get('completion_rate_30d', 0)}%",
                    f"- Previous Streak: {previous_metrics.get('current_streak', 0)} days",
                    "",
                    "NOTE: Only use this comparison data if it's present above. If this section doesn't exist, do NOT make comparisons to previous periods.",
                ]
            )

        # Skip reasons
        if skip_reasons:
            context_parts.extend(["", "## Common Skip Reasons"])
            for reason in skip_reasons[:3]:
                context_parts.append(
                    f"- \"{reason.get('reason', 'Unknown')}\": {reason.get('count', 0)} times"
                )

        # EVIDENCE BLOCK (computed deterministically - AI must use this)
        if evidence:
            context_parts.extend(
                [
                    "",
                    "## Evidence (VERIFIED - Do NOT recalculate)",
                    "This evidence was computed by the system. Use it as your source of truth.",
                    "",
                    json.dumps(evidence, indent=2),
                ]
            )

        # WARNING FLAGS (computed deterministically - AI must follow these rules)
        if warning_flags:
            context_parts.extend(
                [
                    "",
                    "## Warning Flags (VERIFIED - computed by system)",
                    json.dumps(warning_flags, indent=2),
                ]
            )

        # Recent check-ins sample (for reference, but evidence is authoritative)
        if checkins:
            checkins_to_show = checkins[:10]
            actual_count = len(checkins_to_show)
            # Count rest days for context
            rest_day_count = sum(
                1 for ci in checkins_to_show if ci.get("status") == "rest_day"
            )
            context_parts.extend(
                [
                    "",
                    "## Check-ins (authoritative list for per-day patterns)",
                    f"The list below contains EXACTLY {actual_count} check-ins.",
                    "Ordered MOST RECENT first: [1] is most recent.",
                    "",
                    f"N = {actual_count}",
                    "Status symbols: ✓ = completed, 💤 = rest day (intentional break, preserves streak), ✗ = skipped/missed",
                    "",
                ]
            )
            if rest_day_count > 0:
                context_parts.append(
                    f"Note: {rest_day_count} rest day(s) in recent check-ins - these are intentional breaks, not failures."
                )
            # Number each check-in explicitly (1 = most recent, N = oldest)
            for idx, ci in enumerate(checkins_to_show, start=1):
                ci_status = ci.get("status", "pending")
                status = (
                    "✓"
                    if ci_status == "completed"
                    else ("💤" if ci_status == "rest_day" else "✗")
                )
                day = ci.get("day_name", "").strip()
                reason = f" ({ci.get('skip_reason')})" if ci.get("skip_reason") else ""
                mood_str = f" mood={ci.get('mood')}" if ci.get("mood") else ""
                note_str = ""
                if ci.get("note"):
                    note_str = (
                        f' note="{ci.get("note", "")[:80]}..."'
                        if len(ci.get("note", "")) > 80
                        else f' note="{ci.get("note", "")}"'
                    )
                # Format: [Line Number] Date (Day): Status (no time-of-day data available)
                line = f"[{idx}] {ci.get('date')} ({day}): {status}{reason}{mood_str}{note_str}"
                context_parts.append(line)
                vn = ci.get("voice_note_transcript")
                sn = ci.get("voice_note_sentiment")
                if vn or sn:
                    vn_preview = (vn or "")[:120] + (
                        "..." if (vn and len(vn) > 120) else ""
                    )
                    sn_str = ""
                    if isinstance(sn, dict):
                        s = sn.get("sentiment", "")
                        t = sn.get("tone", "")
                        m = sn.get("matches_mood")
                        sn_str = f' sentiment={s} tone="{t}" matches_mood={m}'
                    context_parts.append(
                        f'  voice_note: transcript="{vn_preview}"{sn_str}'
                    )
            # Add rules reminder
            context_parts.extend(
                [
                    "",
                    "Rules reminder:",
                    "- risky_days require >=2 samples for that weekday and completion_rate < 0.60",
                    "- If no time-of-day exists, best_nudge_time must be null",
                ]
            )

        return "\n".join(context_parts)

    async def _call_ai(
        self,
        context: str,
        goal_id: str = None,
        current_metrics: Dict = None,
        recent_checkins: list = None,
        skip_reasons: list = None,
        previous_metrics: Dict = None,
    ) -> str:
        """Call OpenAI API for insight generation."""
        # Replace placeholder in system prompt with actual goal creation date
        system_prompt = INSIGHTS_SYSTEM_PROMPT
        if "[GOAL_CREATED_DATE]" in system_prompt:
            # Extract goal creation date from context
            import re

            match = re.search(r"Created: ([^\n]+)", context)
            if match:
                goal_date = match.group(1)
                system_prompt = system_prompt.replace("[GOAL_CREATED_DATE]", goal_date)
            else:
                system_prompt = system_prompt.replace("[GOAL_CREATED_DATE]", "Unknown")

        user_message = f"Analyze these check-ins and metrics.\n\n{context}"

        response = await self.client.chat.completions.create(
            model=INSIGHTS_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=0.1,  # Very low temperature for accurate computation
            max_tokens=1100,  # Increased to accommodate evidence block
            response_format={"type": "json_object"},
        )

        ai_response = response.choices[0].message.content or "{}"

        # Log full interaction to file for debugging
        # if goal_id:
        #     self._log_ai_interaction(
        #         goal_id,
        #         system_prompt,
        #         user_message,
        #         ai_response,
        #         current_metrics,
        #         recent_checkins,
        #         skip_reasons,
        #         previous_metrics,
        #     )

        return ai_response

    def _log_ai_interaction(
        self,
        goal_id: str,
        system_prompt: str,
        user_message: str,
        ai_response: str,
        current_metrics: Dict = None,
        recent_checkins: list = None,
        skip_reasons: list = None,
        previous_metrics: Dict = None,
    ):
        """Log full AI interaction to file for debugging."""
        try:
            import os
            import json
            from datetime import datetime

            # Create logs directory if it doesn't exist
            logs_dir = os.path.join(
                os.path.dirname(__file__), "..", "..", "logs", "ai_insights"
            )
            os.makedirs(logs_dir, exist_ok=True)

            # Create filename with timestamp and goal_id
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            filename = f"ai_insights_{goal_id[:8]}_{timestamp}.txt"
            filepath = os.path.join(logs_dir, filename)

            # Write full interaction to file
            with open(filepath, "w", encoding="utf-8") as f:
                f.write("=" * 80 + "\n")
                f.write(f"AI INSIGHTS INTERACTION LOG\n")
                f.write(f"Goal ID: {goal_id}\n")
                f.write(f"Timestamp: {datetime.utcnow().isoformat()}\n")
                f.write("=" * 80 + "\n\n")

                f.write("RAW DATA PASSED TO AI:\n")
                f.write("-" * 80 + "\n")
                f.write("CURRENT METRICS:\n")
                f.write(json.dumps(current_metrics, indent=2, default=str))
                f.write("\n\n")
                f.write("RECENT CHECK-INS:\n")
                f.write(json.dumps(recent_checkins, indent=2, default=str))
                f.write("\n\n")
                if skip_reasons:
                    f.write("SKIP REASONS:\n")
                    f.write(json.dumps(skip_reasons, indent=2, default=str))
                    f.write("\n\n")
                if previous_metrics:
                    f.write("PREVIOUS METRICS:\n")
                    f.write(json.dumps(previous_metrics, indent=2, default=str))
                    f.write("\n\n")
                f.write("-" * 80 + "\n\n")

                f.write("SYSTEM PROMPT:\n")
                f.write("-" * 80 + "\n")
                f.write(system_prompt)
                f.write("\n\n")

                f.write("USER MESSAGE (CONTEXT):\n")
                f.write("-" * 80 + "\n")
                f.write(user_message)
                f.write("\n\n")

                f.write("AI RESPONSE:\n")
                f.write("-" * 80 + "\n")
                f.write(ai_response)
                f.write("\n\n")

                f.write("=" * 80 + "\n")
                f.write("END OF LOG\n")
                f.write("=" * 80 + "\n")

            logger.info(f"Logged AI interaction to {filepath}")

        except Exception as e:
            logger.warning(f"Failed to log AI interaction: {e}")

    def _parse_ai_response(self, response: str) -> Dict:
        """Parse AI response - trust the format, just normalize field names."""
        try:
            data = json.loads(response)

            # Normalize insights - handle both "text" and "message" fields
            insights = data.get("insights", [])
            if not isinstance(insights, list):
                insights = []

            normalized_insights = []
            for insight in insights:
                if not isinstance(insight, dict):
                    continue

                # Handle both "text" and "message" fields
                text = insight.get("text") or insight.get("message", "")
                if not text:
                    continue

                normalized_insights.append(
                    {
                        "type": insight.get("type", "pattern"),
                        "text": text,
                        "priority": insight.get("priority", 1),
                    }
                )

            # Ensure nudge_config structure
            # Note: risky_days, risk_level, needs_extra_motivation, best_nudge_time
            # are now computed deterministically in _generate_insights, so we just
            # ensure defaults here (they'll be overwritten by computed values)
            nudge_config = data.get("nudge_config", {})
            if not isinstance(nudge_config, dict):
                nudge_config = {}

            nudge_config.setdefault("risky_days", [])
            nudge_config.setdefault("risk_level", "medium")
            nudge_config.setdefault("best_nudge_time", None)
            nudge_config.setdefault("needs_extra_motivation", False)

            return {
                "insights": normalized_insights,
                "nudge_config": nudge_config,
                "summary": data.get("summary", ""),
            }

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response: {e}")
            logger.error(f"Response was: {response[:500]}")
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
