"""
Entity validation utilities for goals and challenges.

These helpers ensure that actions are only performed on active entities.
"""

from fastapi import HTTPException, status
from typing import Optional


def validate_entity_is_active(
    entity: dict,
    entity_type: str = "goal",  # "goal" or "challenge"
    allow_upcoming: bool = False,  # For challenges, sometimes upcoming is valid
) -> None:
    """
    Validate that a goal or challenge is active before allowing actions.

    Args:
        entity: The entity dict (goal or challenge data)
        entity_type: Either "goal" or "challenge"
        allow_upcoming: If True, also allows "upcoming" status (useful for challenges)

    Raises:
        HTTPException: If entity is not in an allowed status
    """
    entity_status = entity.get("status")

    allowed_statuses = ["active"]
    if allow_upcoming:
        allowed_statuses.append("upcoming")

    if entity_status in allowed_statuses:
        return  # Valid status, proceed

    # Build user-friendly error messages
    status_messages = {
        "archived": f"This {entity_type} is paused. Resume it to continue.",
        "cancelled": f"This {entity_type} has been cancelled.",
        "completed": f"This {entity_type} has been completed.",
        "upcoming": f"This {entity_type} hasn't started yet.",
        "draft": f"This {entity_type} is still in draft mode.",
    }

    message = status_messages.get(entity_status, f"This {entity_type} is not active.")

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=message,
    )


def get_entity_for_validation(
    supabase,
    entity_id: str,
    entity_type: str,  # "goal" or "challenge"
) -> Optional[dict]:
    """
    Fetch an entity (goal or challenge) for validation.

    Args:
        supabase: Supabase client
        entity_id: The ID of the entity
        entity_type: Either "goal" or "challenge"

    Returns:
        Entity dict or None if not found
    """
    table_name = "goals" if entity_type == "goal" else "challenges"

    try:
        # Use limit(1) instead of maybe_single() to avoid 204 response issues
        # Note: goals table uses user_id, challenges table uses created_by
        select_fields = (
            "id, status, user_id, tracking_type"
            if entity_type == "goal"
            else "id, status, created_by, tracking_type"
        )
        result = (
            supabase.table(table_name)
            .select(select_fields)
            .eq("id", entity_id)
            .limit(1)
            .execute()
        )

        if result.data and len(result.data) > 0:
            return result.data[0]

        return None
    except Exception as e:
        raise


def validate_entity_is_active_by_id(
    supabase,
    entity_id: str,
    entity_type: str,  # "goal" or "challenge"
    allow_upcoming: bool = False,
) -> dict:
    """
    Fetch and validate that an entity is active.

    Args:
        supabase: Supabase client
        entity_id: The ID of the entity
        entity_type: Either "goal" or "challenge"
        allow_upcoming: If True, also allows "upcoming" status

    Returns:
        The entity dict if valid

    Raises:
        HTTPException: If entity not found or not in an allowed status
    """
    entity = get_entity_for_validation(supabase, entity_id, entity_type)

    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{entity_type.capitalize()} not found",
        )

    validate_entity_is_active(entity, entity_type, allow_upcoming)

    return entity
