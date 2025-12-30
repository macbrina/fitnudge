from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from app.core.database import get_supabase_client
from app.models.suggested_goals import SuggestedGoalItem, SuggestedGoalsStatus
from app.services.logger import logger
from app.services.goal_type_suggestion_service import generate_goals_by_type_sync


def _fetch_fitness_profile(supabase, user_id: str) -> Optional[Dict[str, Any]]:
    result = (
        supabase.table("user_fitness_profiles")
        .select("*")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    return result.data if result.data else None


def _fetch_user_plan(supabase, user_id: str) -> str:
    try:
        result = (
            supabase.table("users")
            .select("plan")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        if result.data and result.data.get("plan"):
            return result.data["plan"]
    except Exception as exc:
        logger.warning(
            "Failed to fetch user plan, defaulting to free",
            {"user_id": user_id, "error": str(exc)},
        )
    return "free"


def _transform_goal(goal: Dict[str, Any]) -> SuggestedGoalItem:
    # Determine if this is a good challenge candidate based on goal type
    goal_type = goal.get("goal_type", "habit")
    is_challenge_candidate = goal_type in ["time_challenge", "target_challenge"]

    # Determine sharing recommendation based on goal characteristics
    sharing_recommendation = goal.get("sharing_recommendation")
    if not sharing_recommendation and is_challenge_candidate:
        # Default recommendations based on goal type
        if goal_type == "time_challenge":
            sharing_recommendation = (
                "great_for_friends"  # Time challenges are fun with friends
            )
        elif goal_type == "target_challenge":
            sharing_recommendation = (
                "good_for_competition"  # Target challenges are competitive
            )

    return SuggestedGoalItem(
        id=str(goal.get("id") or uuid4()),
        title=goal.get("title") or goal.get("name") or "",
        description=goal.get("description") or "",
        category=goal.get("category", "fitness"),
        frequency=goal.get("frequency", "weekly"),
        target_days=goal.get("target_days"),
        days_of_week=goal.get("days_of_week"),
        reminder_times=goal.get("reminder_times") or [],
        match_reason=goal.get("match_reason"),
        # Goal type fields
        goal_type=goal_type,
        duration_days=goal.get("duration_days"),
        target_checkins=goal.get("target_checkins"),
        # Social/sharing fields
        is_challenge_candidate=goal.get(
            "is_challenge_candidate", is_challenge_candidate
        ),
        sharing_recommendation=sharing_recommendation,
    )


def _generate_ai_goals(
    profile: Dict[str, Any],
    user_plan: str,
    goal_type: str = "habit",
    user_timezone: Optional[str] = None,
    user_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Generate AI goals using the goal-type-aware suggestion service.

    Args:
        profile: User's fitness profile
        user_plan: User's subscription plan (not currently used by new service)
        goal_type: Type of goals - "habit", "time_challenge", "target_challenge", or "mixed"
        user_timezone: User's timezone (e.g., 'America/New_York') for time-aware suggestions
        user_id: User's ID for fetching existing goals to avoid duplicates
    """
    try:
        # Get current UTC time
        current_time = datetime.now(timezone.utc)

        # Use the goal-type-aware service that generates proper habits vs challenges
        goals = generate_goals_by_type_sync(
            profile,
            goal_type,
            user_timezone=user_timezone,
            current_time=current_time,
            user_id=user_id,
        )

        if goals:
            logger.info(
                f"Generated {len(goals)} {goal_type} goals",
                {
                    "goal_type": goal_type,
                    "count": len(goals),
                    "timezone": user_timezone,
                    "user_id": user_id,
                },
            )

        return goals or []
    except Exception as exc:
        logger.error(
            "AI goal generation failed",
            {"error": str(exc), "user_plan": user_plan, "goal_type": goal_type},
        )
        return []


def _get_suggested_goals_from_db(
    profile: Dict[str, Any], supabase
) -> List[Dict[str, Any]]:
    suggestions: List[Dict[str, Any]] = []

    templates_result = supabase.table("goal_templates").select("*").execute()
    if not templates_result.data:
        logger.error("No goal templates found in database for fallback suggestions")
        return suggestions

    base_templates = templates_result.data
    fitness_level = profile.get("fitness_level", "")
    primary_goal = profile.get("primary_goal", "")
    current_frequency = profile.get("current_frequency", "")
    preferred_location = profile.get("preferred_location", "")
    available_time = profile.get("available_time", "")

    for template in base_templates:
        match_reason = ""
        score = 0

        if template.get("match_reason"):
            match_reason += f"{template['match_reason']} "
            score += 1

        if (
            fitness_level == "beginner"
            and template.get("category") == "fitness"
            and template.get("frequency") == "weekly"
        ):
            match_reason += "Perfect for beginners. "
            score += 3
        elif fitness_level == "intermediate" and template.get("category") == "fitness":
            match_reason += "Great for intermediate level. "
            score += 3
        elif fitness_level in ["advanced", "athlete"]:
            match_reason += "Challenging for advanced users. "
            score += 3

        title = (template.get("title") or template.get("name") or "").lower()
        if (
            primary_goal == "lose_weight"
            and template.get("category") == "fitness"
            and "weight" in title
        ):
            match_reason += "Designed for weight loss. "
            score += 4
        elif primary_goal == "build_muscle" and "strength" in title:
            match_reason += "Focused on muscle building. "
            score += 4
        elif primary_goal == "stay_active" and template.get("frequency") == "daily":
            match_reason += "Keeps you consistently active. "
            score += 3

        if current_frequency == "never" and template.get("frequency") == "weekly":
            match_reason += "Good starting point for beginners. "
            score += 2
        elif (
            current_frequency in ["1-2x_week", "3-4x_week"]
            and template.get("frequency") == "daily"
        ):
            match_reason += "Helps increase your frequency. "
            score += 2

        if preferred_location == "gym" and "gym" in title:
            match_reason += "Gym-based workout. "
            score += 2
        elif preferred_location == "home" and template.get("frequency") == "daily":
            match_reason += "Can be done at home. "
            score += 2
        elif preferred_location == "outdoor" and "run" in title:
            match_reason += "Outdoor activity. "
            score += 2

        if available_time == "less_30min" and template.get("frequency") == "daily":
            match_reason += "Quick and effective. "
            score += 2
        elif (
            available_time in ["30-60min", "1-2hrs"]
            and template.get("frequency") == "weekly"
        ):
            match_reason += "Perfect for your time availability. "
            score += 2

        if score >= 2:
            template["match_reason"] = match_reason.strip()
            template["score"] = score
            suggestions.append(template)

    suggestions.sort(key=lambda x: x.get("score", 0), reverse=True)
    return suggestions[:5]


def _fetch_user_timezone(supabase, user_id: str) -> Optional[str]:
    """Fetch user's timezone from the users table."""
    try:
        # Get timezone from users table (timezone column exists there, not in user_fitness_profiles)
        result = (
            supabase.table("users")
            .select("timezone")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        if result.data and result.data.get("timezone"):
            return result.data["timezone"]

    except Exception as exc:
        logger.warning(
            "Failed to fetch user timezone",
            {"user_id": user_id, "error": str(exc)},
        )
    return None


def generate_suggested_goals_for_user(
    user_id: str,
    goal_type: str = "habit",
    user_timezone: Optional[str] = None,
) -> Tuple[SuggestedGoalsStatus, Optional[List[SuggestedGoalItem]], Optional[str]]:
    """
    Generate suggested goals for a user.

    Args:
        user_id: The user's ID
        goal_type: Type of goals to generate - "habit", "time_challenge",
                   "target_challenge", or "mixed". Defaults to "habit".
        user_timezone: Optional user timezone (e.g., 'America/New_York').
                       If not provided, will attempt to fetch from user profile.
    """
    supabase = get_supabase_client()
    profile = _fetch_fitness_profile(supabase, user_id)
    if not profile:
        message = "Fitness profile not found. Complete onboarding first."
        logger.error(message, {"user_id": user_id})
        return "failed", None, message

    # Get user timezone if not provided
    if not user_timezone:
        user_timezone = _fetch_user_timezone(supabase, user_id)

    user_plan = _fetch_user_plan(supabase, user_id)
    ai_goals = _generate_ai_goals(
        profile,
        user_plan,
        goal_type=goal_type,
        user_timezone=user_timezone,
        user_id=user_id,
    )
    transformed_goals: List[SuggestedGoalItem] = []

    if ai_goals:
        transformed_goals = [
            _transform_goal(goal)
            for goal in ai_goals
            if goal.get("title") or goal.get("description")
        ]

    if not transformed_goals:
        fallback_goals = _get_suggested_goals_from_db(profile, supabase)
        if fallback_goals:
            transformed_goals = [_transform_goal(goal) for goal in fallback_goals]

    if not transformed_goals:
        message = "Unable to generate goal suggestions. Please try again later."
        logger.error(message, {"user_id": user_id})
        return "failed", None, message

    return "ready", transformed_goals, None
