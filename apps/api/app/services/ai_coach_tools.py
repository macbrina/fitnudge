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


def validate_frequency_count(frequency_count: Optional[int], frequency_type: str) -> Optional[str]:
    """Validate frequency_count for weekly goals."""
    if frequency_type == "weekly":
        if frequency_count is not None:
            if frequency_count < 1 or frequency_count > 7:
                return "frequency_count must be between 1 and 7 for weekly goals"
    return None


def validate_target_days(
    days: Optional[List[str]], frequency_type: str, frequency_count: Optional[int] = None
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
    effective_frequency_count = frequency_count if frequency_count else (len(target_days) if target_days else None)
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
        target_days_ints = [day_name_to_int(d) for d in target_days_names] if target_days_names else None

        goal_data = {
            "user_id": self.user_id,
            "title": params["title"].strip(),
            "frequency_type": frequency_type,
            "frequency_count": frequency_count if frequency_type == "weekly" else 1,
            "target_days": target_days_ints if frequency_type == "weekly" else None,
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
                    "target_days": target_days_names if frequency_type == "weekly" else None,
                    # Limit info if paused
                    "limit_reached": will_be_paused,
                    "goal_limit": limit_check.get("limit") if will_be_paused else None,
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
