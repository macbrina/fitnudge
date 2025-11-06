"""
Feature Inventory Service

Defines which features are implemented, which are planned, and how they map to subscription tiers.
This is used by the AI to ensure goal suggestions only mention features that exist.
"""

from typing import Dict, List, Set, Any
from enum import Enum


class FeatureStatus(Enum):
    """Feature implementation status"""

    IMPLEMENTED = "implemented"
    PLANNED = "planned"
    NOT_PLANNED = "not_planned"


class FeatureAccess(Enum):
    """Feature access level"""

    FREE = "free"
    STARTER = "starter"
    PRO = "pro"
    COACH_PLUS = "coach_plus"
    ALL = "all"  # Available to all plans


# Feature definitions with status and access
FEATURE_DEFINITIONS: Dict[str, Dict[str, Any]] = {
    # ==================== IMPLEMENTED FEATURES ====================
    # Free features (available to all)
    "daily_checkins": {
        "status": FeatureStatus.IMPLEMENTED,
        "access": [FeatureAccess.ALL],
        "name": "Daily Check-Ins",
        "description": "Simple yes/no check-ins with optional reflection text",
        "ai_description": "daily check-ins (yes/no with optional reflection)",
    },
    "streak_tracking": {
        "status": FeatureStatus.IMPLEMENTED,
        "access": [FeatureAccess.ALL],
        "name": "Streak Tracking",
        "description": "Track consecutive days of completing goals",
        "ai_description": "streak tracking to see your consistency",
    },
    "progress_visualization": {
        "status": FeatureStatus.IMPLEMENTED,
        "access": [FeatureAccess.ALL],
        "name": "Progress Visualization",
        "description": "Visual progress charts and summary cards",
        "ai_description": "progress visualization showing your consistency",
    },
    "basic_reminders": {
        "status": FeatureStatus.IMPLEMENTED,
        "access": [FeatureAccess.ALL],
        "name": "Basic Reminders",
        "description": "Scheduled notification reminders",
        "ai_description": "smart reminders at your chosen times",
    },
    "social_feed": {
        "status": FeatureStatus.IMPLEMENTED,
        "access": [FeatureAccess.ALL],
        "name": "Social Feed",
        "description": "Community feed with posts and interactions",
        "ai_description": "community feed to share your journey",
    },
    "text_motivation": {
        "status": FeatureStatus.IMPLEMENTED,
        "access": [FeatureAccess.ALL],
        "name": "Text Motivation",
        "description": "AI-powered text motivation messages",
        "ai_description": "AI-powered motivation messages",
    },
    "mood_tracking": {
        "status": FeatureStatus.IMPLEMENTED,
        "access": [FeatureAccess.ALL],
        "name": "Mood Tracking",
        "description": "Track mood with check-ins (1-5 scale)",
        "ai_description": "mood tracking to understand your emotional patterns",
    },
    # Premium features
    "multiple_goals": {
        "status": FeatureStatus.IMPLEMENTED,
        "access": [FeatureAccess.STARTER, FeatureAccess.PRO, FeatureAccess.COACH_PLUS],
        "name": "Multiple Goals",
        "description": "Create multiple goals (Starter: 3, Pro/Coach+: unlimited)",
        "ai_description": "multiple goals to track different aspects of your fitness",
        "limits": {"free": 1, "starter": 3, "pro": None, "coach_plus": None},
    },
    "voice_motivation": {
        "status": FeatureStatus.IMPLEMENTED,
        "access": [FeatureAccess.PRO, FeatureAccess.COACH_PLUS],
        "name": "Voice Motivation",
        "description": "AI-generated voice motivation messages",
        "ai_description": "AI voice motivation calls",
    },
    "advanced_analytics": {
        "status": FeatureStatus.IMPLEMENTED,
        "access": [FeatureAccess.PRO, FeatureAccess.COACH_PLUS],
        "name": "Advanced Analytics",
        "description": "Detailed progress and performance analytics",
        "ai_description": "advanced analytics for deep insights",
    },
    # ==================== IMPLEMENTED FEATURES (continued) ====================
    "progress_photos": {
        "status": FeatureStatus.IMPLEMENTED,
        "access": [FeatureAccess.ALL],
        "name": "Progress Photos",
        "description": "Photo uploads with check-ins",
        "ai_description": "progress photos to track visual changes",
    },
    "achievement_badges": {
        "status": FeatureStatus.IMPLEMENTED,
        "access": [FeatureAccess.ALL],
        "name": "Achievement Badges",
        "description": "Unlock badges for milestones",
        "ai_description": "achievement badges to celebrate milestones",
    },
    "weekly_recap": {
        "status": FeatureStatus.IMPLEMENTED,
        "access": [FeatureAccess.STARTER, FeatureAccess.PRO, FeatureAccess.COACH_PLUS],
        "name": "Weekly Recap",
        "description": "AI-generated weekly progress summaries",
        "ai_description": "weekly recap summaries of your progress",
    },
    "challenge_mode": {
        "status": FeatureStatus.IMPLEMENTED,
        "access": [FeatureAccess.ALL],
        "name": "Challenge Mode",
        "description": "Community challenges with leaderboards",
        "ai_description": "community challenges to stay motivated",
    },
    "custom_reminders": {
        "status": FeatureStatus.IMPLEMENTED,
        "access": [FeatureAccess.ALL],
        "name": "Custom Reminder Messages",
        "description": "Personalize reminder messages",
        "ai_description": "custom reminder messages tailored to you",
    },
    "meal_tracking": {
        "status": FeatureStatus.IMPLEMENTED,
        "access": [
            FeatureAccess.ALL
        ],  # Basic available to all, enhanced features Starter+
        "name": "Meal Tracking",
        "description": "Log meals with basic info (Free), nutritional data & summaries (Starter+)",
        "ai_description": "meal tracking with nutritional information",
    },
    "habit_chains": {
        "status": FeatureStatus.IMPLEMENTED,
        "access": [FeatureAccess.ALL],
        "name": "Habit Chains",
        "description": "Visual chain visualization for streaks",
        "ai_description": "habit chain visualization to see your consistency",
    },
    "social_accountability": {
        "status": FeatureStatus.IMPLEMENTED,
        "access": [FeatureAccess.ALL],  # Basic available to all, group goals Pro+
        "name": "Social Accountability",
        "description": "Share goals with friends for accountability",
        "ai_description": "share goals with friends for accountability",
    },
    "ai_progress_reflections": {
        "status": FeatureStatus.IMPLEMENTED,
        "access": [FeatureAccess.PRO, FeatureAccess.COACH_PLUS],
        "name": "AI Progress Reflections",
        "description": "Premium AI coach summaries with deep insights",
        "ai_description": "AI progress reflections and coaching insights",
    },
    # ==================== NOT PLANNED (Do not mention) ====================
    "workout_templates": {
        "status": FeatureStatus.NOT_PLANNED,
        "access": [],
        "name": "Workout Templates",
        "description": "Structured workout plans with exercises",
        "ai_description": "",  # Empty - should not be mentioned
    },
    "detailed_session_logging": {
        "status": FeatureStatus.NOT_PLANNED,
        "access": [],
        "name": "Detailed Session Logging",
        "description": "Detailed workout session logging with exercises, sets, reps",
        "ai_description": "",  # Empty - use check-ins instead
    },
}


def get_features_for_plan(plan: str) -> List[Dict[str, Any]]:
    """
    Get all implemented features available for a subscription plan.

    Args:
        plan: User's subscription plan (free, starter, pro, coach_plus)

    Returns:
        List of feature definitions available to this plan
    """
    plan_access = _plan_to_access(plan)

    features = []
    for feature_key, feature_def in FEATURE_DEFINITIONS.items():
        if feature_def["status"] != FeatureStatus.IMPLEMENTED:
            continue

        access_levels = feature_def["access"]
        if FeatureAccess.ALL in access_levels or plan_access in access_levels:
            features.append(
                {
                    "key": feature_key,
                    **feature_def,
                    "access": [a.value for a in access_levels],
                }
            )

    return features


def get_implemented_feature_names(plan: str) -> List[str]:
    """
    Get list of implemented feature names for AI prompt.

    Args:
        plan: User's subscription plan

    Returns:
        List of feature descriptions that can be mentioned
    """
    features = get_features_for_plan(plan)
    return [f["ai_description"] for f in features if f.get("ai_description")]


def get_available_features_summary(plan: str) -> str:
    """
    Get a human-readable summary of available features for AI prompts.

    Args:
        plan: User's subscription plan

    Returns:
        Formatted string describing available features
    """
    features = get_features_for_plan(plan)
    feature_descriptions = [
        f["ai_description"] for f in features if f.get("ai_description")
    ]

    if not feature_descriptions:
        return "Basic check-in and progress tracking."

    # Build summary
    summary = "Available features: "
    summary += ", ".join(feature_descriptions[:-1])
    if len(feature_descriptions) > 1:
        summary += f", and {feature_descriptions[-1]}"
    else:
        summary += feature_descriptions[0]
    summary += "."

    return summary


def get_plan_restrictions(plan: str) -> List[str]:
    """
    Get list of restrictions for a plan to include in AI prompts.

    Args:
        plan: User's subscription plan

    Returns:
        List of restriction messages
    """
    restrictions = []

    # Goal limits
    goal_limits = {
        "free": 1,
        "starter": 3,
        "pro": None,  # unlimited
        "coach_plus": None,  # unlimited
    }

    limit = goal_limits.get(plan, 1)
    if limit == 1:
        restrictions.append("Free users can only have 1 active goal at a time.")
    elif limit:
        restrictions.append(f"{plan.capitalize()} users can have up to {limit} goals.")

    # Feature restrictions
    if plan == "free":
        restrictions.append(
            "Voice motivation messages are only available on Pro/Coach+ plans."
        )
        restrictions.append(
            "Advanced analytics are only available on Pro/Coach+ plans."
        )

    return restrictions


def _plan_to_access(plan: str) -> FeatureAccess:
    """Convert plan string to FeatureAccess enum"""
    mapping = {
        "free": FeatureAccess.FREE,
        "starter": FeatureAccess.STARTER,
        "pro": FeatureAccess.PRO,
        "coach_plus": FeatureAccess.COACH_PLUS,
    }
    return mapping.get(plan.lower(), FeatureAccess.FREE)


def can_mention_feature(feature_key: str, plan: str) -> bool:
    """
    Check if a feature can be mentioned in goal descriptions for a given plan.

    Args:
        feature_key: Feature key to check
        plan: User's subscription plan

    Returns:
        True if feature can be mentioned, False otherwise
    """
    if feature_key not in FEATURE_DEFINITIONS:
        return False

    feature = FEATURE_DEFINITIONS[feature_key]

    # Never mention non-planned features
    if feature["status"] == FeatureStatus.NOT_PLANNED:
        return False

    # Only mention implemented features (for now)
    # Planned features should not be mentioned until implemented
    if feature["status"] == FeatureStatus.PLANNED:
        return False

    # Check access
    plan_access = _plan_to_access(plan)
    access_levels = feature["access"]

    return FeatureAccess.ALL in access_levels or plan_access in access_levels


def get_feature_context_for_ai(plan: str) -> Dict[str, Any]:
    """
    Get complete feature context for AI prompt generation.

    Args:
        plan: User's subscription plan

    Returns:
        Dictionary with feature context for AI
    """
    return {
        "available_features": get_implemented_feature_names(plan),
        "features_summary": get_available_features_summary(plan),
        "restrictions": get_plan_restrictions(plan),
        "plan": plan,
        "goal_limit": _get_goal_limit_for_plan(plan),
    }


def _get_goal_limit_for_plan(plan: str) -> int | None:
    """Get goal limit for a plan (None means unlimited)"""
    limits = {
        "free": 1,
        "starter": 3,
        "pro": None,
        "coach_plus": None,
    }
    return limits.get(plan.lower(), 1)
