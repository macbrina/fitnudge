"""
Feature Inventory Service

Fetches ALL feature data from the database (plan_features table).
No hardcoded feature keys - everything comes from the database.

Database is the source of truth for:
- Feature keys, names, descriptions
- AI descriptions for prompts
- Which plans have access to which features
- Whether a feature is enabled/implemented (is_enabled)
- Feature values/limits (feature_value)
"""

from typing import Dict, List, Any, Optional
from enum import Enum
import logging
import time

logger = logging.getLogger(__name__)


class FeatureStatus(Enum):
    """Feature implementation status"""

    IMPLEMENTED = "implemented"
    PLANNED = "planned"
    NOT_PLANNED = "not_planned"
    FUTURE_PENDING = "future_pending"


class FeatureAccess(Enum):
    """Feature access level (2-tier system: free + premium)"""

    FREE = "free"
    PREMIUM = "premium"
    ALL = "all"  # Available to all plans


# Plan tier hierarchy (2-tier system: free + premium)
PLAN_TIERS = {
    "free": 0,
    "premium": 1,
}

# Cache for database features
_features_cache: Optional[Dict[str, Dict[str, Any]]] = None
_cache_timestamp: float = 0
CACHE_TTL_SECONDS = 3600  # 1 hour (features rarely change)


def _get_supabase_client():
    """Get Supabase client - lazy import to avoid circular dependencies"""
    from app.core.database import get_supabase_client

    return get_supabase_client()


def _fetch_features_from_database() -> Dict[str, Dict[str, Any]]:
    """
    Fetch ALL features from the plan_features table.
    No hardcoded keys - everything comes from the database.

    Returns:
        Dictionary mapping feature_key to feature data
    """
    try:
        supabase = _get_supabase_client()

        # Fetch all plan features with their plan info (V2: no minimum_tier)
        response = (
            supabase.table("plan_features")
            .select(
                "feature_key, feature_name, feature_description, ai_description, "
                "feature_value, is_enabled, plan_id"
            )
            .execute()
        )

        if not response.data:
            logger.warning("No features found in database")
            return {}

        # Group features by feature_key and collect plan-specific access
        features: Dict[str, Dict[str, Any]] = {}

        for row in response.data:
            feature_key = row["feature_key"]
            plan_id = row["plan_id"]
            is_enabled = row.get("is_enabled", True)
            feature_value = row.get("feature_value")

            if feature_key not in features:
                features[feature_key] = {
                    "name": row["feature_name"],
                    "description": row.get("feature_description", ""),
                    # Plan-specific access: {"free": True, "premium": False}
                    "plan_access": {},
                    # Plan-specific feature values (for limits that differ by plan)
                    "plan_values": {},
                    # Plan-specific ai_descriptions (different for free vs premium)
                    "plan_ai_descriptions": {},
                }

            # Store plan-specific is_enabled status
            features[feature_key]["plan_access"][plan_id] = is_enabled

            # Store plan-specific feature_value (including None for unlimited)
            # We need to store None explicitly to distinguish "unlimited" from "no entry"
            features[feature_key]["plan_values"][plan_id] = feature_value

            # Store plan-specific ai_description (e.g., free says "upgrade to unlock", premium says actual feature)
            if row.get("ai_description"):
                features[feature_key]["plan_ai_descriptions"][plan_id] = row[
                    "ai_description"
                ]

        # Determine overall status and access for each feature
        for feature_key, feature_data in features.items():
            plan_access = feature_data["plan_access"]

            # Feature is implemented if ANY plan has it enabled
            is_implemented = any(plan_access.values())
            feature_data["status"] = (
                FeatureStatus.IMPLEMENTED if is_implemented else FeatureStatus.PLANNED
            )

            # Determine access levels based on which plans have it enabled
            free_enabled = plan_access.get("free", False)
            premium_enabled = plan_access.get("premium", False)

            if free_enabled and premium_enabled:
                feature_data["access"] = [FeatureAccess.ALL]
            elif free_enabled:
                feature_data["access"] = [FeatureAccess.FREE]
            elif premium_enabled:
                feature_data["access"] = [FeatureAccess.PREMIUM]
            else:
                feature_data["access"] = []  # Not available to any plan

        logger.info(f"Loaded {len(features)} features from database")
        return features

    except Exception as e:
        logger.error(f"Failed to fetch features from database: {e}")
        return {}


def _get_cached_features() -> Dict[str, Dict[str, Any]]:
    """
    Get features from cache or fetch from database if cache is stale.

    Returns:
        Dictionary of feature definitions
    """
    global _features_cache, _cache_timestamp

    current_time = time.time()

    # Check if cache is valid
    if (
        _features_cache is not None
        and (current_time - _cache_timestamp) < CACHE_TTL_SECONDS
    ):
        return _features_cache

    # Fetch from database
    db_features = _fetch_features_from_database()

    if db_features:
        _features_cache = db_features
        _cache_timestamp = current_time
        return _features_cache

    # If database fetch failed and we have old cache, use it
    if _features_cache is not None:
        logger.warning("Using stale feature cache due to database fetch failure")
        return _features_cache

    # Last resort: return empty dict (functions will handle gracefully)
    logger.error("No feature data available - database fetch failed and no cache")
    return {}


def refresh_feature_cache() -> None:
    """Force refresh of the feature cache from database."""
    global _features_cache, _cache_timestamp
    _features_cache = None
    _cache_timestamp = 0
    _get_cached_features()  # Trigger fresh fetch
    logger.info("Feature cache refreshed")


def get_all_features() -> Dict[str, Dict[str, Any]]:
    """
    Get all feature definitions from database.

    Returns:
        Dictionary of feature key to feature data
    """
    return _get_cached_features()


def get_features_for_plan(plan: str) -> List[Dict[str, Any]]:
    """
    Get all implemented features available for a subscription plan.

    Args:
        plan: User's subscription plan (free or premium)

    Returns:
        List of feature definitions available to this plan
    """
    features = _get_cached_features()
    plan_lower = plan.lower()

    available_features = []

    for feature_key, feature_data in features.items():
        # Skip non-implemented features
        if feature_data.get("status") != FeatureStatus.IMPLEMENTED:
            continue

        # V2: Check plan-specific access from plan_access dict
        plan_access = feature_data.get("plan_access", {})
        is_enabled_for_plan = plan_access.get(plan_lower, False)

        if not is_enabled_for_plan:
            continue

        # Get plan-specific feature_value (None = unlimited)
        plan_values = feature_data.get("plan_values", {})
        # Use the plan-specific value if the plan has an entry, otherwise fallback
        if plan_lower in plan_values:
            feature_value = plan_values[plan_lower]
        elif "free" in plan_values:
            feature_value = plan_values["free"]
        elif "premium" in plan_values:
            feature_value = plan_values["premium"]
        else:
            feature_value = None  # No limit defined = unlimited

        # Get plan-specific ai_description (e.g., free says "upgrade to unlock", premium says actual feature)
        plan_ai_descriptions = feature_data.get("plan_ai_descriptions", {})
        if plan_lower in plan_ai_descriptions:
            ai_description = plan_ai_descriptions[plan_lower]
        elif "free" in plan_ai_descriptions:
            ai_description = plan_ai_descriptions["free"]
        elif "premium" in plan_ai_descriptions:
            ai_description = plan_ai_descriptions["premium"]
        else:
            ai_description = feature_data.get("name", feature_key)

        access_levels = feature_data.get("access", [])
        available_features.append(
            {
                "key": feature_key,
                "name": feature_data.get("name", feature_key),
                "description": feature_data.get("description", ""),
                "ai_description": ai_description,
                "feature_value": feature_value,
                "access": [a.value for a in access_levels],
            }
        )

    return available_features


def get_implemented_feature_names(plan: str) -> List[str]:
    """
    Get list of implemented feature AI descriptions for AI prompt.

    Args:
        plan: User's subscription plan

    Returns:
        List of AI descriptions that can be mentioned
    """
    features = get_features_for_plan(plan)
    # Only return features with non-empty ai_description
    return [f["ai_description"] for f in features if f.get("ai_description")]


def get_available_features_summary(plan: str) -> str:
    """
    Get a human-readable summary of available features for AI prompts.
    Uses feature names (generic) - not plan-specific ai_descriptions.
    The AI can reference the features array for plan-specific limits.

    Args:
        plan: User's subscription plan

    Returns:
        Formatted string describing available features (generic names)
    """
    features = get_features_for_plan(plan)

    # Use feature names (generic) - AI will look at feature_value for limits
    feature_names = [f["name"] for f in features if f.get("name")]

    if not feature_names:
        return "Basic check-in and progress tracking."

    # Build summary with generic feature names
    if len(feature_names) > 1:
        summary = "Available features: "
        summary += ", ".join(feature_names[:-1])
        summary += f", and {feature_names[-1]}."
    else:
        summary = f"Available features: {feature_names[0]}."

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

    # Get goal limit from database
    goal_limit = _get_goal_limit_for_plan(plan)

    if goal_limit is None:
        # Unlimited goals (premium)
        pass
    elif goal_limit == 1:
        restrictions.append("Free users can only have 1 active goal at a time.")
    elif goal_limit:
        restrictions.append(
            f"{plan.capitalize()} users can have up to {goal_limit} active goals at a time."
        )

    # Feature restrictions based on plan
    if plan.lower() == "free":
        restrictions.append("Advanced features are only available with Premium.")

    return restrictions


def _plan_to_access(plan: str) -> FeatureAccess:
    """Convert plan string to FeatureAccess enum (2-tier system)"""
    mapping = {
        "free": FeatureAccess.FREE,
        "premium": FeatureAccess.PREMIUM,
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
    features = _get_cached_features()

    if feature_key not in features:
        return False

    feature = features[feature_key]

    # Only mention implemented features
    if feature.get("status") != FeatureStatus.IMPLEMENTED:
        return False

    # Don't mention features with empty ai_description
    if not feature.get("ai_description"):
        return False

    # V2: Check plan-specific access from plan_access dict
    plan_access = feature.get("plan_access", {})
    plan_lower = plan.lower()
    is_enabled_for_plan = plan_access.get(plan_lower, False)

    return is_enabled_for_plan


def get_premium_only_features(plan: str) -> List[Dict[str, Any]]:
    """
    Get features that are available to premium users but NOT to the current plan.
    Useful for AI to know what to upsell.

    Args:
        plan: User's subscription plan

    Returns:
        List of premium-only feature definitions
    """
    if plan.lower() == "premium":
        return []  # Premium has everything

    features = _get_cached_features()
    premium_only = []

    for feature_key, feature_data in features.items():
        # Skip non-implemented features
        if feature_data.get("status") != FeatureStatus.IMPLEMENTED:
            continue

        plan_access = feature_data.get("plan_access", {})
        is_enabled_for_user = plan_access.get(plan.lower(), False)
        is_enabled_for_premium = plan_access.get("premium", False)

        # Feature is premium-only if premium has it but user doesn't
        if is_enabled_for_premium and not is_enabled_for_user:
            plan_values = feature_data.get("plan_values", {})
            # Use premium's ai_description for upselling (not the "upgrade to unlock" text from free)
            plan_ai_descriptions = feature_data.get("plan_ai_descriptions", {})
            ai_description = plan_ai_descriptions.get(
                "premium", feature_data.get("name", feature_key)
            )
            premium_only.append(
                {
                    "key": feature_key,
                    "name": feature_data.get("name", feature_key),
                    "description": feature_data.get("description", ""),
                    "ai_description": ai_description,
                    "premium_value": plan_values.get("premium"),
                }
            )

    return premium_only


def get_feature_limits(plan: str) -> Dict[str, Any]:
    """
    Get all feature limits/values for a plan as a dictionary.
    Useful for AI to understand specific limits.

    Args:
        plan: User's subscription plan

    Returns:
        Dictionary of feature_key -> feature_value
    """
    features = get_features_for_plan(plan)
    limits = {}

    for feature in features:
        if feature.get("feature_value") is not None:
            limits[feature["key"]] = feature["feature_value"]

    return limits


def get_feature_context_for_ai(plan: str) -> Dict[str, Any]:
    """
    Get complete feature context for AI prompt generation.
    Includes full feature data with values from database (no hardcoding).

    Args:
        plan: User's subscription plan

    Returns:
        Dictionary with feature context for AI including:
        - features: Full list of available features with feature_value (null = unlimited)
        - premium_only_features: Features user doesn't have (only for non-premium)
        - restrictions: Human-readable restriction messages
        - features_summary: Generic product feature list (not plan-specific)
    """
    available_features = get_features_for_plan(plan)
    premium_only = get_premium_only_features(plan)

    context = {
        "plan": plan,
        # Full feature data - each feature has feature_value (number = limit, null = unlimited)
        "features": available_features,
        # Human-readable restrictions
        "restrictions": get_plan_restrictions(plan),
        # Generic product summary (feature names only, AI uses features array for limits)
        "features_summary": get_available_features_summary(plan),
    }

    # Only include premium_only_features for non-premium users (for upselling)
    if premium_only:
        context["premium_only_features"] = premium_only

    return context


def _get_goal_limit_for_plan(plan: str) -> Optional[int]:
    """
    Get goal limit for a plan from database (None means unlimited).

    Looks for the "active_goal_limit" feature and its plan-specific feature_value.
    """
    features = _get_cached_features()
    plan_lower = plan.lower()

    # Look for "active_goal_limit" feature
    goal_limit_feature = features.get("active_goal_limit", {})

    # Get plan-specific feature_value (None = unlimited)
    plan_values = goal_limit_feature.get("plan_values", {})

    # Check if plan has an entry in plan_values
    if plan_lower in plan_values:
        return plan_values[plan_lower]  # Can be None (unlimited) or a number

    # Fallback: Check other plans
    if "free" in plan_values:
        return plan_values["free"]
    if "premium" in plan_values:
        return plan_values["premium"]

    # Final fallback: Default limits
    defaults = {
        "free": 2,  # V2: Free tier has 2 goals
        "premium": 10,  # Premium is 10 goals
    }
    return defaults.get(plan_lower, 2)


def get_feature_info(feature_key: str) -> Optional[Dict[str, Any]]:
    """
    Get information about a specific feature.

    Args:
        feature_key: The feature key to look up

    Returns:
        Feature dictionary or None if not found
    """
    features = _get_cached_features()
    return features.get(feature_key)


def is_feature_enabled(feature_key: str) -> bool:
    """
    Check if a feature is enabled (implemented) in the system.

    Args:
        feature_key: The feature key to check

    Returns:
        True if feature is implemented and enabled
    """
    feature = get_feature_info(feature_key)
    if not feature:
        return False
    return feature.get("status") == FeatureStatus.IMPLEMENTED
