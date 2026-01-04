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

        # Fetch all plan features with their plan info
        response = (
            supabase.table("plan_features")
            .select(
                "feature_key, feature_name, feature_description, ai_description, "
                "feature_value, is_enabled, minimum_tier, plan_id"
            )
            .execute()
        )

        if not response.data:
            logger.warning("No features found in database")
            return {}

        # Group features by feature_key and collect which plans have access
        features: Dict[str, Dict[str, Any]] = {}

        for row in response.data:
            feature_key = row["feature_key"]
            plan_id = row["plan_id"]
            is_enabled = row.get("is_enabled", True)
            minimum_tier = row.get("minimum_tier", 0)

            if feature_key not in features:
                features[feature_key] = {
                    "name": row["feature_name"],
                    "description": row.get("feature_description", ""),
                    "ai_description": row.get("ai_description", ""),
                    "plans": set(),  # Plans that have this feature
                    "is_enabled": is_enabled,
                    "minimum_tier": minimum_tier,
                    "feature_value": row.get("feature_value"),  # For limits
                }
            else:
                # Update if this row has a value and existing doesn't
                if row.get("feature_value") and not features[feature_key].get(
                    "feature_value"
                ):
                    features[feature_key]["feature_value"] = row["feature_value"]

            # Add this plan to the feature's access list if enabled
            if is_enabled:
                features[feature_key]["plans"].add(plan_id)

            # Track the minimum tier across all entries
            if minimum_tier < features[feature_key]["minimum_tier"]:
                features[feature_key]["minimum_tier"] = minimum_tier

        # Convert plans set to access list and determine status
        for feature_key, feature_data in features.items():
            plans = feature_data["plans"]

            # Determine access based on which plans have this feature (2-tier system)
            if "free" in plans:
                # If free plan has it, check if premium also has it
                if "premium" in plans:
                    feature_data["access"] = [FeatureAccess.ALL]
                else:
                    feature_data["access"] = [FeatureAccess.FREE]
            else:
                # Only premium has access
                feature_data["access"] = []
                if "premium" in plans:
                    feature_data["access"].append(FeatureAccess.PREMIUM)

            # Determine status based on is_enabled
            if feature_data["is_enabled"]:
                feature_data["status"] = FeatureStatus.IMPLEMENTED
            else:
                feature_data["status"] = FeatureStatus.PLANNED

            # Clean up temporary fields
            del feature_data["plans"]
            del feature_data["is_enabled"]

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
    plan_access = _plan_to_access(plan)
    plan_tier = PLAN_TIERS.get(plan.lower(), 0)

    available_features = []

    for feature_key, feature_data in features.items():
        # Skip non-implemented features
        if feature_data.get("status") != FeatureStatus.IMPLEMENTED:
            continue

        access_levels = feature_data.get("access", [])
        minimum_tier = feature_data.get("minimum_tier", 0)

        # Check if plan has access
        has_access = False

        # ALL means everyone has access
        if FeatureAccess.ALL in access_levels:
            has_access = True
        # Check if plan is in access list
        elif plan_access in access_levels:
            has_access = True
        # Check tier-based access (higher tiers inherit lower tier features)
        elif plan_tier >= minimum_tier and minimum_tier > 0:
            has_access = True

        if has_access:
            available_features.append(
                {
                    "key": feature_key,
                    "name": feature_data.get("name", feature_key),
                    "description": feature_data.get("description", ""),
                    "ai_description": feature_data.get("ai_description", ""),
                    "feature_value": feature_data.get("feature_value"),
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

    # Get goal limit from database
    goal_limit = _get_goal_limit_for_plan(plan)

    if goal_limit == 1:
        restrictions.append("Free users can only have 1 active goal at a time.")
    elif goal_limit:
        restrictions.append(
            f"{plan.capitalize()} users can have up to {goal_limit} goals."
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

    # Check access
    plan_access = _plan_to_access(plan)
    plan_tier = PLAN_TIERS.get(plan.lower(), 0)
    access_levels = feature.get("access", [])
    minimum_tier = feature.get("minimum_tier", 0)

    # Check if plan has access
    if FeatureAccess.ALL in access_levels:
        return True
    if plan_access in access_levels:
        return True
    if plan_tier >= minimum_tier and minimum_tier > 0:
        return True

    return False


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


def _get_goal_limit_for_plan(plan: str) -> Optional[int]:
    """
    Get goal limit for a plan from database (None means unlimited).

    Looks for the "goals" feature and its feature_value.
    """
    features = _get_cached_features()
    plan_lower = plan.lower()

    # Premium has unlimited goals
    if plan_lower == "premium":
        return None

    # Look for "goals" feature with feature_value for this plan's tier
    goals_feature = features.get("goals", {})
    if goals_feature.get("feature_value"):
        return goals_feature["feature_value"]

    # Fallback: Check based on plan tier (2-tier system)
    # Free = 1, Premium = unlimited
    defaults = {
        "free": 1,
        "premium": None,
    }
    return defaults.get(plan_lower, 1)


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
