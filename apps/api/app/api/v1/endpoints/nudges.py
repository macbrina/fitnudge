"""
Social Nudges API endpoints

Handles sending nudges, cheers, and motivation messages between users.
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import date
from app.core.flexible_auth import get_current_user
from app.services.logger import logger

router = APIRouter(redirect_slashes=False)


# =====================================================
# Pydantic Models
# =====================================================
class NudgeCreate(BaseModel):
    """Request to send a nudge"""

    recipient_id: str
    nudge_type: str  # nudge, cheer, milestone, competitive, custom
    message: Optional[str] = None
    emoji: Optional[str] = None
    # Context - at least one should be provided
    goal_id: Optional[str] = None
    challenge_id: Optional[str] = None
    partnership_id: Optional[str] = None


class NudgeResponse(BaseModel):
    """Nudge response model"""

    id: str
    sender_id: str
    recipient_id: str
    nudge_type: str
    message: Optional[str]
    emoji: Optional[str]
    goal_id: Optional[str]
    challenge_id: Optional[str]
    partnership_id: Optional[str]
    is_ai_generated: bool
    is_read: bool
    created_at: str
    sender: Optional[dict] = None  # Include sender info for display


class NudgeMarkReadRequest(BaseModel):
    """Request to mark nudges as read"""

    nudge_ids: Optional[List[str]] = None  # If None, mark all as read


# =====================================================
# Endpoints
# =====================================================
@router.post("", response_model=NudgeResponse, status_code=status.HTTP_201_CREATED)
async def send_nudge(
    data: NudgeCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Send a nudge to another user.

    Nudge types:
    - nudge: Reminder to check in (limited to 1/day per recipient)
    - cheer: Quick encouragement (unlimited)
    - milestone: Celebrating an achievement (system-generated)
    - competitive: Competitive banter (limited to 3/day per recipient)
    - custom: Custom message (limited to 5/day per recipient)
    """
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    sender_id = current_user["id"]

    # Validate nudge type
    valid_types = ["nudge", "cheer", "milestone", "competitive", "custom"]
    if data.nudge_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid nudge type. Must be one of: {', '.join(valid_types)}",
        )

    # Can't nudge yourself
    if data.recipient_id == sender_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot send a nudge to yourself",
        )

    # Verify recipient exists
    recipient = (
        supabase.table("users")
        .select("id, name")
        .eq("id", data.recipient_id)
        .maybe_single()
        .execute()
    )
    if not recipient.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient not found",
        )

    # Check rate limits based on nudge type
    today = date.today()
    if data.nudge_type in ["nudge", "competitive", "custom"]:
        # Check daily limit
        limit = {"nudge": 1, "competitive": 3, "custom": 5}.get(data.nudge_type, 5)

        existing_count = (
            supabase.table("social_nudges")
            .select("id", count="exact")
            .eq("sender_id", sender_id)
            .eq("recipient_id", data.recipient_id)
            .eq("nudge_type", data.nudge_type)
            .eq("nudge_date", today.isoformat())
            .execute()
        )

        count = (
            existing_count.count
            if hasattr(existing_count, "count")
            else len(existing_count.data or [])
        )

        if count >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Daily limit reached. You can only send {limit} {data.nudge_type}(s) per day to this person.",
            )

    # Create the nudge
    nudge_data = {
        "sender_id": sender_id,
        "recipient_id": data.recipient_id,
        "nudge_type": data.nudge_type,
        "message": data.message,
        "emoji": data.emoji,
        "goal_id": data.goal_id,
        "challenge_id": data.challenge_id,
        "partnership_id": data.partnership_id,
        "is_ai_generated": False,
        "is_read": False,
        "nudge_date": today.isoformat(),
    }

    try:
        result = supabase.table("social_nudges").insert(nudge_data).execute()
    except Exception as e:
        error_msg = str(e)
        if (
            "duplicate key" in error_msg.lower()
            or "unique constraint" in error_msg.lower()
        ):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="You have already sent this type of nudge today",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send nudge",
        )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send nudge",
        )

    nudge = result.data[0]

    # Get sender info for response
    sender_info = {
        "id": sender_id,
        "name": current_user.get("name", "Unknown"),
    }

    logger.info(
        f"Nudge sent from {sender_id} to {data.recipient_id}",
        {
            "nudge_id": nudge["id"],
            "nudge_type": data.nudge_type,
            "sender_id": sender_id,
            "recipient_id": data.recipient_id,
        },
    )

    # TODO: Send push notification to recipient
    # await send_social_notification(...)

    return NudgeResponse(
        id=nudge["id"],
        sender_id=nudge["sender_id"],
        recipient_id=nudge["recipient_id"],
        nudge_type=nudge["nudge_type"],
        message=nudge.get("message"),
        emoji=nudge.get("emoji"),
        goal_id=nudge.get("goal_id"),
        challenge_id=nudge.get("challenge_id"),
        partnership_id=nudge.get("partnership_id"),
        is_ai_generated=nudge.get("is_ai_generated", False),
        is_read=nudge.get("is_read", False),
        created_at=nudge["created_at"],
        sender=sender_info,
    )


@router.get("", response_model=List[NudgeResponse])
async def get_nudges(
    current_user: dict = Depends(get_current_user),
    unread_only: bool = Query(False, description="Only return unread nudges"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Get nudges received by the current user"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    query = (
        supabase.table("social_nudges")
        .select(
            "*, sender:users!social_nudges_sender_id_fkey(id, name, username, profile_picture_url)"
        )
        .eq("recipient_id", user_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )

    if unread_only:
        query = query.eq("is_read", False)

    result = query.execute()

    nudges = []
    for n in result.data or []:
        nudges.append(
            NudgeResponse(
                id=n["id"],
                sender_id=n["sender_id"],
                recipient_id=n["recipient_id"],
                nudge_type=n["nudge_type"],
                message=n.get("message"),
                emoji=n.get("emoji"),
                goal_id=n.get("goal_id"),
                challenge_id=n.get("challenge_id"),
                partnership_id=n.get("partnership_id"),
                is_ai_generated=n.get("is_ai_generated", False),
                is_read=n.get("is_read", False),
                created_at=n["created_at"],
                sender=n.get("sender"),
            )
        )

    return nudges


@router.get("/sent", response_model=List[NudgeResponse])
async def get_sent_nudges(
    current_user: dict = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Get nudges sent by the current user"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    result = (
        supabase.table("social_nudges")
        .select(
            "*, recipient:users!social_nudges_recipient_id_fkey(id, name, username, profile_picture_url)"
        )
        .eq("sender_id", user_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    nudges = []
    for n in result.data or []:
        nudges.append(
            NudgeResponse(
                id=n["id"],
                sender_id=n["sender_id"],
                recipient_id=n["recipient_id"],
                nudge_type=n["nudge_type"],
                message=n.get("message"),
                emoji=n.get("emoji"),
                goal_id=n.get("goal_id"),
                challenge_id=n.get("challenge_id"),
                partnership_id=n.get("partnership_id"),
                is_ai_generated=n.get("is_ai_generated", False),
                is_read=n.get("is_read", False),
                created_at=n["created_at"],
                sender=None,  # Sender is current user
            )
        )

    return nudges


@router.get("/unread-count")
async def get_unread_nudge_count(
    current_user: dict = Depends(get_current_user),
):
    """Get count of unread nudges"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    result = (
        supabase.table("social_nudges")
        .select("id", count="exact")
        .eq("recipient_id", user_id)
        .eq("is_read", False)
        .execute()
    )

    count = result.count if hasattr(result, "count") else len(result.data or [])

    return {"unread_count": count}


@router.patch("/{nudge_id}/read")
async def mark_nudge_read(
    nudge_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Mark a single nudge as read"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Verify nudge exists and belongs to user
    nudge = (
        supabase.table("social_nudges")
        .select("id")
        .eq("id", nudge_id)
        .eq("recipient_id", user_id)
        .maybe_single()
        .execute()
    )

    if not nudge.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nudge not found",
        )

    supabase.table("social_nudges").update({"is_read": True}).eq(
        "id", nudge_id
    ).execute()

    return {"message": "Nudge marked as read"}


@router.patch("/read-all")
async def mark_all_nudges_read(
    current_user: dict = Depends(get_current_user),
):
    """Mark all nudges as read"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    result = (
        supabase.table("social_nudges")
        .update({"is_read": True})
        .eq("recipient_id", user_id)
        .eq("is_read", False)
        .execute()
    )

    count = len(result.data) if result.data else 0

    return {"message": f"Marked {count} nudges as read", "count": count}


@router.delete("/{nudge_id}")
async def delete_nudge(
    nudge_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a nudge (only sender can delete)"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Verify nudge exists and was sent by user
    nudge = (
        supabase.table("social_nudges")
        .select("id")
        .eq("id", nudge_id)
        .eq("sender_id", user_id)
        .maybe_single()
        .execute()
    )

    if not nudge.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nudge not found or you don't have permission to delete it",
        )

    supabase.table("social_nudges").delete().eq("id", nudge_id).execute()

    return {"message": "Nudge deleted successfully"}
