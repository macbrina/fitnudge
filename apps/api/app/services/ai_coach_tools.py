"""
FitNudge V2 - AI Coach Tools - Function Calling for AI Coach

This module provides tool definitions and execution logic for the AI Coach.
Tools allow the AI to perform actions like creating goals and getting suggestions.

V2 Changes:
- Simplified goal creation for V2 schema (frequency_type, target_days, etc.)
- Focus on goals and accountability only

Architecture:
- TOOL_DEFINITIONS: OpenAI function calling schema (passed to API)
- ToolExecutor: Executes tool calls and handles validation/errors
- Each tool has validation matching frontend

Validation Rules (matching frontend):
- Title: 3-100 characters, required
- Frequency: daily or weekly (X times per week)
- Days of week: array of day names for weekly goals
- Reminder times: HH:MM format (24-hour)
"""

from datetime import date, datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
import json
import re
from app.core.database import get_supabase_client
from app.services.logger import logger
from app.services.subscription_service import check_user_feature_limit
from app.services.feature_inventory import get_feature_context_for_ai
from app.core.subscriptions import get_user_effective_plan

# =============================================================================
# CONSTANTS (V2 - Simplified)
# =============================================================================

VALID_FREQUENCIES = ["daily", "weekly"]

# Tool limits (bounded fetch, scalability)
GET_CHECKINS_MAX_DAYS = 30
GET_CHECKINS_MAX_ROWS = 200
GET_WEEKLY_RECAP_MAX_WEEKS = 8
GET_GOALS_MAX_LIMIT = 10  # Max active goals per user; only active goals are returned
GET_PATTERN_INSIGHTS_MAX = 20


# =============================================================================
# TOOL DEFINITIONS (OpenAI Function Calling Schema)
# =============================================================================

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "create_goal",
            "description": """Create a new habit goal for the user. Goals are ongoing habits with daily check-ins.

BEFORE CREATING: If user's request is vague, ASK clarifying questions:
- "What time of day works best for you?" (for reminder_times)
- "Would you like to do this every day or specific days?" (for frequency)
- "Which days work best for your schedule?" (for target_days if weekly)

FREQUENCY GUIDANCE:
- Daily: User checks in every day (e.g., "drink water daily")
- Weekly: User selects specific days and number of times per week (e.g., "workout 3x/week on Mon/Wed/Fri")

LIMIT CHECK: User's plan has a goal limit. If at limit, goal will be created as 'paused'.

Examples:
- "I want to start working out" → Ask: "How many days per week?" then use weekly with selected days
- "Help me drink more water" → Use daily frequency with morning reminder
- "Create a meditation habit" → Ask preference, can be daily or weekly
""",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Clear, action-oriented goal title (3-100 chars). Examples: 'Morning Workout', 'Daily Hydration', 'Evening Meditation'",
                        "minLength": 3,
                        "maxLength": 100,
                    },
                    "frequency_type": {
                        "type": "string",
                        "enum": ["daily", "weekly"],
                        "description": "'daily' = every day. 'weekly' = specific days only (requires target_days).",
                    },
                    "frequency_count": {
                        "type": "integer",
                        "description": "For weekly goals: how many times per week (1-7). Ignored for daily.",
                        "minimum": 1,
                        "maximum": 7,
                    },
                    "target_days": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "enum": ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
                        },
                        "description": "For weekly goals: which days to check in. Use lowercase day names. E.g., ['mon', 'wed', 'fri'] for 3x/week.",
                    },
                    "reminder_times": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "pattern": "^([0-1][0-9]|2[0-3]):[0-5][0-9]$",
                        },
                        "description": "REQUIRED. At least one reminder time in 24-hour HH:MM format. Suggest based on goal type: fitness morning ['07:00'], evening habits ['21:00'].",
                    },
                    "why_statement": {
                        "type": "string",
                        "description": "Optional: Why this goal matters to the user. Used for motivation. Max 200 chars.",
                        "maxLength": 200,
                    },
                },
                "required": ["title", "frequency_type", "reminder_times"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_feature_inventory",
            "description": """Get information about what features are available for the user's plan.

USE THIS TOOL WHEN:
- User asks about a feature and you need to check if it's available
- User asks for something that might be premium-only
- You want to explain plan limitations accurately
- You need to suggest alternatives within user's plan

RETURNS:
- User's current plan
- Available features with their limits (from database)
- Premium-only features (for contextual upselling)
- Plan restrictions

EXAMPLE USAGE:
- User asks "Can I have more reminder times?" → Check reminder_times_per_goal limit
- User asks "How many goals can I create?" → Check active_goal_limit
- User asks about a feature → Check if it's in available or premium-only list

This helps you give accurate, plan-aware advice without guessing limits.
""",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_goals",
            "description": """Fetch the user's **active** goals only (fresh from DB). Use when you need up-to-date goals, streaks, or status.

- goal_id: optional. If provided, return only that goal if it is active (otherwise not found). Use for goal-specific chat.
- limit: max goals to return when fetching all (default 10, max 10). Ignored when goal_id is provided. Users have at most 10 active goals.

Returns: id, title, status, frequency_type, frequency_count, current_streak, longest_streak, total_completions, why_statement, week_completions, week_start_date. Only active goals are included.
""",
            "parameters": {
                "type": "object",
                "properties": {
                    "goal_id": {
                        "type": "string",
                        "description": "Optional. Specific goal UUID. When provided, return only this goal if active (goal-specific context). Omit for general context (all active goals).",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max number of active goals to return when not filtering by goal_id. Default 10, max 10.",
                        "minimum": 1,
                        "maximum": 10,
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_pattern_insights",
            "description": """Fetch AI-generated pattern insights (best/worst days, skip reasons, etc.). Use when you need fresh insights instead of pre-passed context.

- goal_id: optional. If provided, return insights only for that goal. Omit for all goals (general context).

Returns: per-goal insights (type, text, goal_id).
""",
            "parameters": {
                "type": "object",
                "properties": {
                    "goal_id": {
                        "type": "string",
                        "description": "Optional. Filter insights to this goal only. Omit for all goals.",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_goal_stats",
            "description": """Fetch detailed stats for a single goal: completion rates (7d, 30d), streaks, best/worst days. Use when answering "how am I doing on X?" or need up-to-date metrics.

- goal_id: required. The goal to get stats for.

Returns: goal_title, completion_rate_30d, completion_rate_7d, current_streak, longest_streak, total_checkins_30d, completed_checkins_30d, best_day_index, worst_day_index, goal_age_days, etc.
""",
            "parameters": {
                "type": "object",
                "properties": {
                    "goal_id": {
                        "type": "string",
                        "description": "Required. Goal UUID to fetch stats for.",
                    },
                },
                "required": ["goal_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_checkins",
            "description": """Fetch check-ins for a date range. Use when user asks about specific periods, mood, notes, or voice.

- goal_id: optional. Filter to this goal only. Omit for all goals (general).
- from_date: start date (YYYY-MM-DD). Required.
- to_date: end date (YYYY-MM-DD). Required. Must be >= from_date. Max range 30 days.
- include_voice_transcripts: include full voice_note_transcript and voice_note_sentiment. Default false. Set true when user asks "what did I say" or similar.

Limits: date range capped at 30 days; max 200 rows returned. Check-ins exclude pending (only completed/skipped/missed/rest_day).
""",
            "parameters": {
                "type": "object",
                "properties": {
                    "goal_id": {
                        "type": "string",
                        "description": "Optional. Filter check-ins to this goal. Omit for all goals.",
                    },
                    "from_date": {
                        "type": "string",
                        "description": "Start date YYYY-MM-DD.",
                    },
                    "to_date": {
                        "type": "string",
                        "description": "End date YYYY-MM-DD. Must be >= from_date. Max 30 days range.",
                    },
                    "include_voice_transcripts": {
                        "type": "boolean",
                        "description": "Include full voice note transcript and sentiment. Default false.",
                    },
                },
                "required": ["from_date", "to_date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_weekly_recap",
            "description": """Fetch weekly recap(s). Use when user asks about their week, "last week", or similar.

- week_start: single week start (YYYY-MM-DD, Monday). Use current week Monday or last week Monday.
- from_week, to_week: range (both required). Max 8 weeks span.
- goal_id: optional. When provided: stats overridden from that goal; goal_breakdown filtered; summary/focus suppressed.

Note: Current week recap may be empty (not yet generated). If empty, use get_checkins for current week + get_weekly_recap for last week to give the user a useful answer (last week summary + so far this week).
Provide either week_start OR (from_week + to_week). Returns goal_breakdown, stats. Empty recaps = no cached recap for that week.
""",
            "parameters": {
                "type": "object",
                "properties": {
                    "week_start": {
                        "type": "string",
                        "description": "Single week start date (Monday) YYYY-MM-DD.",
                    },
                    "from_week": {
                        "type": "string",
                        "description": "Range start (Monday) YYYY-MM-DD. Use with to_week.",
                    },
                    "to_week": {
                        "type": "string",
                        "description": "Range end (Monday) YYYY-MM-DD. Use with from_week. Max 8 weeks span.",
                    },
                    "goal_id": {
                        "type": "string",
                        "description": "Optional. Filter goal_breakdown to this goal only.",
                    },
                },
                "required": [],
            },
        },
    },
]


# =============================================================================
# VALIDATION FUNCTIONS
# =============================================================================


def validate_title(title: str) -> Optional[str]:
    """Validate title (3-100 chars, required)."""
    if not title or not title.strip():
        return "Title is required"
    title = title.strip()
    if len(title) < 3:
        return "Title must be at least 3 characters"
    if len(title) > 100:
        return "Title must be less than 100 characters"
    return None


def validate_frequency_type(frequency_type: str) -> Optional[str]:
    """Validate frequency type is daily or weekly."""
    if not frequency_type or frequency_type not in VALID_FREQUENCIES:
        return "Frequency must be 'daily' or 'weekly'"
    return None


def validate_frequency_count(
    frequency_count: Optional[int], frequency_type: str
) -> Optional[str]:
    """Validate frequency_count for weekly goals."""
    if frequency_type == "weekly":
        if frequency_count is not None:
            if frequency_count < 1 or frequency_count > 7:
                return "frequency_count must be between 1 and 7 for weekly goals"
    return None


def validate_target_days(
    days: Optional[List[str]],
    frequency_type: str,
    frequency_count: Optional[int] = None,
) -> Optional[str]:
    """Validate target days for weekly frequency."""
    valid_days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    if frequency_type == "weekly":
        if not days or len(days) == 0:
            return "At least one day must be selected for weekly goals"
        for day in days:
            if day.lower() not in valid_days:
                return f"Invalid day: {day}. Must be one of: {', '.join(valid_days)}"
        # Validate that days count matches frequency_count
        if frequency_count is not None and len(days) != frequency_count:
            return f"For weekly goals, you must select exactly {frequency_count} days. You selected {len(days)}."
    return None


def day_name_to_int(day_name: str) -> int:
    """Convert day name to integer (0=Sun, 1=Mon, ..., 6=Sat) matching database schema."""
    day_map = {
        "sun": 0,
        "mon": 1,
        "tue": 2,
        "wed": 3,
        "thu": 4,
        "fri": 5,
        "sat": 6,
    }
    return day_map.get(day_name.lower(), 0)


def validate_reminder_times(times: Optional[List[str]]) -> Optional[str]:
    """Validate reminder times are in HH:MM format."""
    if not times or len(times) == 0:
        return "At least one reminder time is required"

    time_regex = re.compile(r"^([0-1][0-9]|2[0-3]):([0-5][0-9])$")
    for time in times:
        if not time_regex.match(time):
            return f"Invalid time format: {time}. Use HH:MM format (e.g., 07:00, 19:30)"
    return None


def validate_goal_params(params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    Validate all goal parameters for V2 schema.
    Returns (is_valid, error_message).
    """
    errors = []

    # Title validation
    err = validate_title(params.get("title", ""))
    if err:
        errors.append(err)

    # Frequency type validation
    frequency_type = params.get("frequency_type", "daily")
    err = validate_frequency_type(frequency_type)
    if err:
        errors.append(err)

    # Frequency count validation (for weekly)
    frequency_count = params.get("frequency_count")
    err = validate_frequency_count(frequency_count, frequency_type)
    if err:
        errors.append(err)

    # Target days validation (for weekly)
    # If frequency_count not provided, infer from target_days length
    target_days = params.get("target_days", [])
    effective_frequency_count = (
        frequency_count
        if frequency_count
        else (len(target_days) if target_days else None)
    )
    err = validate_target_days(target_days, frequency_type, effective_frequency_count)
    if err:
        errors.append(err)

    # Reminder times validation
    err = validate_reminder_times(params.get("reminder_times"))
    if err:
        errors.append(err)

    if errors:
        return False, "; ".join(errors)
    return True, None


# =============================================================================
# TOOL EXECUTOR CLASS
# =============================================================================


class ToolExecutor:
    """
    Executes AI Coach tool calls with proper validation and error handling.

    Each tool method:
    1. Validates parameters (matching frontend validation)
    2. Checks user limits/permissions
    3. Executes the action
    4. Returns a structured result for AI to communicate to user
    """

    def __init__(self, user_id: str, supabase=None):
        self.user_id = user_id
        self.supabase = supabase or get_supabase_client()

    async def execute(
        self, tool_name: str, arguments: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute a tool call and return the result.

        Returns:
            {
                "success": bool,
                "message": str,  # Human-readable message for AI to convey
                "data": Any,     # Optional data payload
                "error": str     # Only if success=False
            }
        """
        logger.info(
            f"[AI Coach Tools] Executing tool: {tool_name}",
            {"user_id": self.user_id[:8], "arguments": arguments},
        )

        try:
            if tool_name == "create_goal":
                return await self._create_goal(arguments)
            elif tool_name == "get_feature_inventory":
                return await self._get_feature_inventory()
            elif tool_name == "get_goals":
                return await self._get_goals(arguments)
            elif tool_name == "get_pattern_insights":
                return await self._get_pattern_insights(arguments)
            elif tool_name == "get_goal_stats":
                return await self._get_goal_stats(arguments)
            elif tool_name == "get_checkins":
                return await self._get_checkins(arguments)
            elif tool_name == "get_weekly_recap":
                return await self._get_weekly_recap(arguments)
            else:
                return {
                    "success": False,
                    "error": f"Unknown tool: {tool_name}",
                    "message": "I tried to perform an action but encountered an error. Please try again.",
                }
        except Exception as e:
            logger.error(
                f"[AI Coach Tools] Tool execution error: {tool_name}",
                {"error": str(e), "user_id": self.user_id[:8]},
            )
            return {
                "success": False,
                "error": str(e),
                "message": f"I encountered an error while trying to help: {str(e)}",
            }

    async def _create_goal(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new goal for the user (V2 schema).

        V2 Goal schema:
        - title: goal title
        - frequency_type: 'daily' or 'weekly'
        - frequency_count: times per week (for weekly)
        - target_days: array of day names (for weekly)
        - reminder_times: array of HH:MM times
        - why_statement: optional motivation anchor
        """
        # Validate parameters
        is_valid, error = validate_goal_params(params)
        if not is_valid:
            return {
                "success": False,
                "error": error,
                "message": f"I couldn't create the goal because: {error}. Please provide the missing information.",
            }

        # Check user's goal limit
        active_goals_result = (
            self.supabase.table("goals")
            .select("id", count="exact")
            .eq("user_id", self.user_id)
            .eq("status", "active")
            .execute()
        )
        active_count = active_goals_result.count or 0

        limit_check = await check_user_feature_limit(
            self.supabase, self.user_id, "active_goal_limit", active_count
        )

        # Determine if goal will be active or paused
        will_be_paused = not limit_check.get("allowed", True)
        goal_status = "paused" if will_be_paused else "active"

        # Prepare goal data for V2 schema
        frequency_type = params.get("frequency_type", "daily")
        target_days_names = params.get("target_days", [])
        frequency_count = params.get("frequency_count")

        # For weekly frequency without target_days, set sensible defaults
        if frequency_type == "weekly" and not target_days_names:
            # Default to Mon/Wed/Fri
            target_days_names = ["mon", "wed", "fri"]

        # If frequency_count not provided for weekly, use target_days length
        if frequency_type == "weekly" and not frequency_count:
            frequency_count = len(target_days_names)

        # Convert day names to integers for database (0=Sun, 1=Mon, ..., 6=Sat)
        # Daily = all days [0,1,2,3,4,5,6] so precreate/schedule logic works consistently
        if frequency_type == "daily":
            target_days_ints = [0, 1, 2, 3, 4, 5, 6]
        elif target_days_names:
            target_days_ints = [day_name_to_int(d) for d in target_days_names]
        else:
            target_days_ints = None

        goal_data = {
            "user_id": self.user_id,
            "title": params["title"].strip(),
            "frequency_type": frequency_type,
            "frequency_count": frequency_count if frequency_type == "weekly" else 1,
            "target_days": target_days_ints,
            "reminder_times": params.get("reminder_times", ["09:00"]),
            "why_statement": (
                params.get("why_statement", "").strip()[:200]
                if params.get("why_statement")
                else None
            ),
            "status": goal_status,
            "current_streak": 0,
            "longest_streak": 0,
            "total_completions": 0,
        }

        try:
            result = self.supabase.table("goals").insert(goal_data).execute()

            if not result.data:
                return {
                    "success": False,
                    "error": "Failed to create goal in database",
                    "message": "I couldn't create your goal. Please try again or create it manually in the Goals tab.",
                }

            goal = result.data[0]
            goal_id = goal["id"]

            # Refresh Live Activity / NextUp so user sees new goal immediately (DB trigger created today's check-in)
            try:
                from app.services.tasks.live_activity_tasks import (
                    refresh_live_activity_for_user_task,
                )
                from app.services.tasks.nextup_fcm_tasks import (
                    refresh_nextup_fcm_for_user_task,
                )

                refresh_live_activity_for_user_task.delay(str(self.user_id))
                refresh_nextup_fcm_for_user_task.delay(str(self.user_id))
            except Exception as e:
                logger.warning(
                    f"[AI Coach Tools] Failed to queue live activity/nextup refresh: {e}"
                )

            # Build structured data for AI to craft its response
            day_display_names = {
                "mon": "Mon",
                "tue": "Tue",
                "wed": "Wed",
                "thu": "Thu",
                "fri": "Fri",
                "sat": "Sat",
                "sun": "Sun",
            }

            if frequency_type == "weekly" and target_days_names:
                schedule_desc = f"{len(target_days_names)} days/week ({', '.join(day_display_names.get(d, d) for d in target_days_names)})"
            else:
                schedule_desc = "every day"

            reminder_time = params.get("reminder_times", ["09:00"])[0]

            # Return structured result - let AI craft the message naturally
            return {
                "success": True,
                "data": {
                    "goal_id": goal_id,
                    "title": params["title"],
                    "status": goal_status,
                    "is_paused": will_be_paused,
                    "schedule": schedule_desc,
                    "reminder_time": reminder_time,
                    "frequency_type": frequency_type,
                    "target_days": (
                        target_days_names if frequency_type == "weekly" else None
                    ),
                    # Limit info if paused
                    "limit_reached": will_be_paused,
                    "goal_limit": limit_check.get("limit") if will_be_paused else None,
                    # Hint for UI: suggest pull-to-refresh on Goals screen if they don't see the new goal
                    "refresh_hint": "If you don't see the new goal on the Goals screen, pull down to refresh.",
                },
            }

        except Exception as e:
            logger.error(f"[AI Coach Tools] Goal creation error: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "I ran into a problem creating your goal. Please try creating it manually in the Goals tab.",
            }

    async def _get_feature_inventory(self) -> Dict[str, Any]:
        """
        Get feature inventory for the user's plan.
        Returns all features and premium-only features from database.
        Each feature has feature_value (number = limit, null = unlimited).
        """
        try:
            # Get user's effective plan
            user_plan = get_user_effective_plan(self.user_id, supabase=self.supabase)

            # Get complete feature context (all from database, no hardcoding)
            feature_context = get_feature_context_for_ai(user_plan)

            # Extract key information for AI
            features = feature_context.get("features", [])
            # premium_only_features only exists for non-premium users
            premium_only = feature_context.get("premium_only_features", None)

            # Build a summary for the AI
            available_features_summary = []
            for f in features:
                summary = f["name"]
                value = f.get("feature_value")
                if value is not None:
                    summary += f" (limit: {value})"
                else:
                    summary += " (unlimited)"
                available_features_summary.append(summary)

            # Build response data
            data = {
                "user_plan": user_plan,
                "is_premium": user_plan.lower() == "premium",
                # Full feature data - each has feature_value (number = limit, null = unlimited)
                "available_features": features,
                # Summary for easy reference
                "available_summary": available_features_summary,
                # Important note for understanding the data
                "note": "feature_value: number = limit, null = unlimited/no restriction",
            }

            # Only include premium_only info for non-premium users (for upselling)
            if premium_only:
                premium_features_summary = []
                for f in premium_only:
                    summary = f["name"]
                    value = f.get("premium_value")
                    if value is not None:
                        summary += f" (premium gets: {value})"
                    else:
                        summary += " (premium: unlimited)"
                    premium_features_summary.append(summary)

                data["premium_only_features"] = premium_only
                data["premium_only_summary"] = premium_features_summary

            return {
                "success": True,
                "data": data,
            }

        except Exception as e:
            logger.error(f"[AI Coach Tools] Feature inventory error: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "I couldn't retrieve the feature information. Please try again.",
            }

    async def _get_goals(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Fetch user's active goals only. goal_id optional (single goal); else list with limit (max 10)."""
        try:
            goal_id = (params.get("goal_id") or "").strip() or None
            limit = params.get("limit")
            if limit is None:
                limit = GET_GOALS_MAX_LIMIT
            else:
                limit = max(1, min(int(limit), GET_GOALS_MAX_LIMIT))

            base = (
                self.supabase.table("goals")
                .select(
                    "id, title, status, frequency_type, frequency_count, "
                    "current_streak, longest_streak, total_completions, "
                    "why_statement, week_completions, week_start_date, created_at"
                )
                .eq("user_id", self.user_id)
                .eq("status", "active")
            )
            if goal_id:
                r = base.eq("id", goal_id).execute()
                if not r.data or len(r.data) == 0:
                    return {
                        "success": False,
                        "error": "Goal not found or not active",
                        "message": "I couldn't find that goal. It may have been deleted, paused, or you don't have access.",
                    }
                return {"success": True, "data": {"goals": r.data, "scope": "goal"}}
            else:
                r = base.order("current_streak", desc=True).limit(limit).execute()
                return {
                    "success": True,
                    "data": {"goals": r.data or [], "scope": "general"},
                }
        except Exception as e:
            logger.error(f"[AI Coach Tools] get_goals error: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "I couldn't fetch your goals. Please try again.",
            }

    async def _get_pattern_insights(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Fetch pattern insights. goal_id optional."""
        try:
            goal_id = (params.get("goal_id") or "").strip() or None
            q = (
                self.supabase.table("pattern_insights")
                .select("goal_id, insights, current_metrics")
                .eq("user_id", self.user_id)
                .eq("status", "completed")
                .limit(GET_PATTERN_INSIGHTS_MAX)
            )
            if goal_id:
                q = q.eq("goal_id", goal_id)
            r = q.execute()
            rows = r.data or []
            # Verify goal belongs to user when goal_id provided
            if goal_id and rows:
                g = (
                    self.supabase.table("goals")
                    .select("id")
                    .eq("user_id", self.user_id)
                    .eq("id", goal_id)
                    .execute()
                )
                if not g.data:
                    return {
                        "success": False,
                        "error": "Goal not found or access denied",
                        "message": "I couldn't find that goal.",
                    }
            out = []
            for p in rows:
                for i in p.get("insights") or []:
                    out.append(
                        {
                            "type": i.get("type", "pattern"),
                            "text": i.get("text", ""),
                            "goal_id": p.get("goal_id"),
                        }
                    )
            return {
                "success": True,
                "data": {"insights": out, "scope": "goal" if goal_id else "general"},
            }
        except Exception as e:
            logger.error(f"[AI Coach Tools] get_pattern_insights error: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "I couldn't fetch pattern insights. Please try again.",
            }

    async def _get_goal_stats(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Fetch stats for a single goal via calculate_goal_metrics RPC."""
        try:
            goal_id = (params.get("goal_id") or "").strip()
            if not goal_id:
                return {
                    "success": False,
                    "error": "goal_id is required",
                    "message": "I need a goal to look up stats for. Which goal do you mean?",
                }
            # Verify ownership
            g = (
                self.supabase.table("goals")
                .select("id")
                .eq("user_id", self.user_id)
                .eq("id", goal_id)
                .execute()
            )
            if not g.data:
                return {
                    "success": False,
                    "error": "Goal not found or access denied",
                    "message": "I couldn't find that goal.",
                }
            r = self.supabase.rpc(
                "calculate_goal_metrics", {"p_goal_id": goal_id}
            ).execute()
            raw = r.data
            if isinstance(raw, list) and len(raw) == 1:
                raw = raw[0]
            if isinstance(raw, dict) and raw.get("error"):
                return {
                    "success": False,
                    "error": raw["error"],
                    "message": "I couldn't compute stats for that goal.",
                }
            return {"success": True, "data": raw if isinstance(raw, dict) else {}}
        except Exception as e:
            logger.error(f"[AI Coach Tools] get_goal_stats error: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "I couldn't fetch goal stats. Please try again.",
            }

    async def _get_checkins(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Fetch check-ins for date range. goal_id optional; include_voice_transcripts optional."""
        try:
            goal_id = (params.get("goal_id") or "").strip() or None
            from_date = (params.get("from_date") or "").strip()
            to_date = (params.get("to_date") or "").strip()
            include_voice = bool(params.get("include_voice_transcripts"))

            if not from_date or not to_date:
                return {
                    "success": False,
                    "error": "from_date and to_date are required",
                    "message": "I need a date range (from_date and to_date in YYYY-MM-DD) to look up check-ins.",
                }
            try:
                fd = datetime.strptime(from_date, "%Y-%m-%d").date()
                td = datetime.strptime(to_date, "%Y-%m-%d").date()
            except ValueError:
                return {
                    "success": False,
                    "error": "Invalid date format. Use YYYY-MM-DD.",
                    "message": "Please use dates in YYYY-MM-DD format.",
                }
            # NOTE: Do NOT block "future" dates here.
            # check_in_date is timezone-based and pre-created, so a user's "today" can be
            # ahead of server UTC. We only enforce bounded range size.
            if fd > td:
                return {
                    "success": False,
                    "error": "from_date must be <= to_date",
                    "message": "The start date must be on or before the end date.",
                }
            delta = (td - fd).days
            if delta > GET_CHECKINS_MAX_DAYS:
                return {
                    "success": False,
                    "error": f"Date range must be at most {GET_CHECKINS_MAX_DAYS} days",
                    "message": f"I can only look up up to {GET_CHECKINS_MAX_DAYS} days at a time. Please narrow the range.",
                }

            select_cols = "check_in_date, status, mood, note, skip_reason, goal_id"
            if include_voice:
                select_cols += ", voice_note_transcript, voice_note_sentiment"
            q = (
                self.supabase.table("check_ins")
                .select(select_cols)
                .eq("user_id", self.user_id)
                .gte("check_in_date", from_date)
                .lte("check_in_date", to_date)
                .neq("status", "pending")
                .order("check_in_date", desc=True)
                .limit(GET_CHECKINS_MAX_ROWS)
            )
            if goal_id:
                g = (
                    self.supabase.table("goals")
                    .select("id")
                    .eq("user_id", self.user_id)
                    .eq("id", goal_id)
                    .execute()
                )
                if not g.data:
                    return {
                        "success": False,
                        "error": "Goal not found or access denied",
                        "message": "I couldn't find that goal.",
                    }
                q = q.eq("goal_id", goal_id)
            rows = q.execute().data or []

            # Optional: truncate long notes for context; keep full if include_voice
            out = []
            for r in rows:
                rec = {
                    "check_in_date": r.get("check_in_date"),
                    "status": r.get("status"),
                    "mood": r.get("mood"),
                    "note": (
                        (r.get("note") or "")[:500]
                        if not include_voice
                        else (r.get("note") or "")
                    ),
                    "skip_reason": r.get("skip_reason"),
                    "goal_id": r.get("goal_id"),
                }
                if include_voice:
                    rec["voice_note_transcript"] = r.get("voice_note_transcript")
                    rec["voice_note_sentiment"] = r.get("voice_note_sentiment")
                out.append(rec)
            return {
                "success": True,
                "data": {
                    "check_ins": out,
                    "from_date": from_date,
                    "to_date": to_date,
                    "scope": "goal" if goal_id else "general",
                },
            }
        except Exception as e:
            logger.error(f"[AI Coach Tools] get_checkins error: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "I couldn't fetch check-ins. Please try again.",
            }

    def _parse_week_start(self, s: str) -> Optional[date]:
        """Parse YYYY-MM-DD and return the date. Caller normalizes to Monday if needed."""
        try:
            return datetime.strptime((s or "").strip(), "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return None

    def _monday_of_week(self, d: date) -> date:
        """Return Monday of the week containing d (ISO week)."""
        # Monday = 0, Sunday = 6
        wd = d.weekday()
        return d - timedelta(days=wd)

    async def _get_weekly_recap(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Fetch weekly recap(s). week_start XOR (from_week, to_week). goal_id optional to filter goal_breakdown."""
        try:
            goal_id = (params.get("goal_id") or "").strip() or None
            week_start = self._parse_week_start(params.get("week_start") or "")
            from_week = self._parse_week_start(params.get("from_week") or "")
            to_week = self._parse_week_start(params.get("to_week") or "")

            single = week_start is not None and from_week is None and to_week is None
            range_ = from_week is not None and to_week is not None

            if not single and not range_:
                return {
                    "success": False,
                    "error": "Provide either week_start or both from_week and to_week",
                    "message": "I need a week (week_start) or a range (from_week and to_week) in YYYY-MM-DD.",
                }
            if single:
                from_week = to_week = self._monday_of_week(week_start)
            else:
                from_week = self._monday_of_week(from_week)
                to_week = self._monday_of_week(to_week)
                if from_week > to_week:
                    from_week, to_week = to_week, from_week
                span = (to_week - from_week).days // 7 + 1
                if span > GET_WEEKLY_RECAP_MAX_WEEKS:
                    return {
                        "success": False,
                        "error": f"Max {GET_WEEKLY_RECAP_MAX_WEEKS} weeks allowed",
                        "message": f"I can only fetch up to {GET_WEEKLY_RECAP_MAX_WEEKS} weeks at a time.",
                    }

            q = (
                self.supabase.table("weekly_recaps")
                .select(
                    "week_start, week_end, summary, win, insight, focus_next_week, "
                    "motivational_close, goal_breakdown, stats"
                )
                .eq("user_id", self.user_id)
                .gte("week_start", from_week.isoformat())
                .lte("week_start", to_week.isoformat())
                .order("week_start", desc=True)
            )
            rows = q.execute().data or []

            # Day names for best/worst (0=Sunday .. 6=Saturday, matches calculate_goal_metrics)
            day_names = [
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
            ]

            out = []
            for r in rows:
                gb = r.get("goal_breakdown") or []
                if goal_id:
                    gb = [x for x in gb if str(x.get("goal_id") or "") == str(goal_id)]

                stats = dict(r.get("stats") or {})

                if goal_id:
                    # Goal-specific: override stats with authoritative data from the goal
                    # (current_streak from goals table; best/worst days from calculate_goal_metrics,
                    # same as PatternInsights/ai_insights_service for consistency)
                    try:
                        rpc_result = self.supabase.rpc(
                            "calculate_goal_metrics", {"p_goal_id": goal_id}
                        ).execute()
                        raw = rpc_result.data
                        if isinstance(raw, list) and len(raw) == 1:
                            raw = raw[0]
                        if isinstance(raw, dict) and not raw.get("error"):
                            metrics = raw
                            stats["current_streak"] = metrics.get("current_streak", 0)
                            best_idx = metrics.get("best_day_index")
                            worst_idx = metrics.get("worst_day_index")
                            stats["strongest_day"] = (
                                day_names[best_idx] if best_idx is not None else None
                            )
                            stats["weakest_day"] = (
                                day_names[worst_idx] if worst_idx is not None else None
                            )
                    except Exception as e:
                        logger.warning(
                            f"[AI Coach Tools] Goal stats override failed: {e}"
                        )

                    # Override completion_rate with goal-specific rate from goal_breakdown
                    # gb is already filtered to this goal above, so gb[0] is the focused goal's data
                    if gb and len(gb) > 0:
                        focused_goal_data = gb[0]  # This is the goal matching goal_id
                        stats["completion_rate"] = focused_goal_data.get("completion_rate", 0)
                        stats["completed_check_ins"] = focused_goal_data.get("completed", 0)
                        stats["total_scheduled"] = focused_goal_data.get("total", 0)

                rec = {
                    "week_start": r.get("week_start"),
                    "week_end": r.get("week_end"),
                    "goal_breakdown": gb,
                    "stats": stats,
                }

                if goal_id:
                    # Cached recap was generated for ALL goals - summary/win/insight/focus_next_week
                    # may reference other goals. Suppress them so AI uses only goal_breakdown + stats.
                    rec["summary"] = None
                    rec["win"] = None
                    rec["insight"] = None
                    rec["focus_next_week"] = None
                    rec["motivational_close"] = None
                    rec["goal_specific_note"] = (
                        "This recap is filtered to one goal. Use goal_breakdown and stats only. "
                        "Generate summary/win/insight/focus_next_week from that goal's data. "
                        "Do NOT mention other goals."
                    )
                else:
                    rec["summary"] = r.get("summary")
                    rec["win"] = r.get("win")
                    rec["insight"] = r.get("insight")
                    rec["focus_next_week"] = r.get("focus_next_week")
                    rec["motivational_close"] = r.get("motivational_close")

                out.append(rec)
            return {
                "success": True,
                "data": {
                    "recaps": out,
                    "scope": "goal" if goal_id else "general",
                },
            }
        except Exception as e:
            logger.error(f"[AI Coach Tools] get_weekly_recap error: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "I couldn't fetch weekly recaps. Please try again.",
            }


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================


def get_tools_for_context(user_context: Dict[str, Any]) -> List[Dict]:
    """
    Get relevant tools based on user's context.
    Can be used to filter tools based on user's plan or existing goals.
    """
    # For now, return all tools. Can be extended to filter based on:
    # - User's subscription plan
    # - User's preferences
    return TOOL_DEFINITIONS


def format_tool_result_for_ai(result: Dict[str, Any]) -> str:
    """
    Format tool execution result as a string for the AI to incorporate.
    """
    if result.get("success"):
        return result.get("message", "Action completed successfully.")
    else:
        return result.get(
            "message", f"Action failed: {result.get('error', 'Unknown error')}"
        )
