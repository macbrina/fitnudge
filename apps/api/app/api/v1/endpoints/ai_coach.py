"""
AI Coach Chat API Endpoints

Provides streaming chat with AI coach for personalized fitness guidance.
Premium feature with daily message limits for rate control.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date, timedelta
import json
from app.core.flexible_auth import get_current_user
from app.core.database import get_supabase_client
from app.services.ai_coach_service import get_ai_coach_service
from app.services.subscription_service import has_user_feature
from app.services.logger import logger

router = APIRouter(
    redirect_slashes=False
)  # Disable redirects to preserve Authorization header


# =====================================================
# REQUEST/RESPONSE MODELS
# =====================================================


class ChatMessageRequest(BaseModel):
    """Request to send a chat message."""

    message: str = Field(..., min_length=1, max_length=2000, description="User message")
    conversation_id: Optional[str] = Field(
        None, description="Continue existing conversation"
    )
    language: str = Field(
        "en", description="Language code for AI responses (ISO 639-1)"
    )
    is_retry: bool = Field(
        False,
        description="If true, skip saving user message (already saved on first attempt)",
    )
    force_new: bool = Field(
        False,
        description="If true, always create a new conversation (ignores conversation_id)",
    )
    goal_id: Optional[str] = Field(
        None,
        description="Optional goal ID to focus the conversation on a specific goal",
    )


class ConversationSummary(BaseModel):
    """Summary of a conversation (without full messages)."""

    id: str
    title: Optional[str]
    message_count: int
    last_message_at: Optional[str]
    created_at: str


class ConversationsListResponse(BaseModel):
    """Paginated list of conversations."""

    conversations: List[ConversationSummary]
    has_more: bool = False  # True if there are more conversations to load
    total_count: int = 0  # Total number of conversations


class MessageItem(BaseModel):
    """Individual message in a conversation."""

    role: str  # 'user' or 'assistant'
    content: str
    created_at: Optional[str]
    status: Optional[str] = (
        None  # 'pending', 'completed', 'failed' (for async messages)
    )


class ConversationDetail(BaseModel):
    """Full conversation with messages."""

    id: str
    title: Optional[str]
    messages: List[MessageItem]
    message_count: int
    last_message_at: Optional[str]
    created_at: str
    has_more_messages: bool = False  # True if there are older messages to load
    total_messages: int = 0  # Total count of all messages in conversation


class RateLimitStatus(BaseModel):
    """Rate limit status for the user."""

    can_send: bool
    remaining_messages: int
    daily_limit: int
    resets_at: str  # ISO timestamp when limit resets


class FeatureAccessResponse(BaseModel):
    """Feature access status."""

    has_access: bool
    reason: Optional[str] = None


# =====================================================
# FEATURE GATING HELPER
# =====================================================


async def check_ai_coach_access(user_id: str) -> tuple[bool, Optional[str]]:
    """
    Check if user has access to AI Coach Chat.

    V2: Free users now have limited access (3 messages/day).
    Premium users have 100 messages/day.

    Uses has_user_feature from subscription_service for proper tier inheritance.

    Returns:
        (has_access, reason_if_denied)
    """
    supabase = get_supabase_client()

    # Check if user has ai_coach_chat feature
    # V2: Free users get 3 messages/day (feature returns limit number, not boolean)
    feature_value = await has_user_feature(supabase, user_id, "ai_coach_chat")

    # Feature can return:
    # - True/None = unlimited access (premium)
    # - Number (e.g., 3) = limited access (free tier with daily limit)
    # - False = no access
    if feature_value is False:
        return (
            False,
            "AI Coach Chat is not available for your plan. Please upgrade to continue.",
        )

    # Both premium (True/None) and free with limit (number > 0) have access
    return True, None


# =====================================================
# ENDPOINTS
# =====================================================


@router.get("/access", response_model=FeatureAccessResponse)
async def check_access(current_user: dict = Depends(get_current_user)):
    """
    Check if user has access to AI Coach Chat.
    Used by frontend to show/hide the feature.
    """
    user_id = current_user["id"]

    has_access, reason = await check_ai_coach_access(user_id)

    return FeatureAccessResponse(has_access=has_access, reason=reason)


@router.get("/rate-limit", response_model=RateLimitStatus)
async def get_rate_limit_status(current_user: dict = Depends(get_current_user)):
    """
    Get current rate limit status for the user.
    """
    user_id = current_user["id"]
    user_plan = current_user.get("plan", "free")

    service = get_ai_coach_service()
    can_send, remaining, limit = await service.check_rate_limit(user_id, user_plan)

    # Calculate reset time (midnight UTC)
    tomorrow = datetime.utcnow().replace(
        hour=0, minute=0, second=0, microsecond=0
    ) + timedelta(days=1)

    return RateLimitStatus(
        can_send=can_send,
        remaining_messages=remaining,
        daily_limit=limit,
        resets_at=tomorrow.isoformat() + "Z",
    )


class AsyncChatResponse(BaseModel):
    """Response from async chat endpoint."""

    success: bool
    conversation_id: Optional[str] = None
    message_status: str = "pending"  # pending, processing, completed, failed
    task_id: Optional[str] = None
    error: Optional[str] = None


@router.post("/chat/async", response_model=AsyncChatResponse)
async def chat_with_coach_async(
    request: ChatMessageRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Send a message to AI Coach for background processing (ChatGPT-style).

    Returns immediately after queuing the message. The AI response is processed
    in the background via Celery. User can leave the app and come back to see
    the response.

    Use GET /conversations/{id} to poll for the response, or use realtime
    subscriptions to get notified when the response is ready.

    Returns:
        - success: Whether the message was queued successfully
        - conversation_id: The conversation ID
        - message_status: "pending" (will become "completed" when AI responds)
        - task_id: Celery task ID for tracking
    """
    user_id = current_user["id"]
    user_plan = current_user.get("plan", "free")

    # Check feature access
    has_access, reason = await check_ai_coach_access(user_id)
    if not has_access:
        raise HTTPException(status_code=403, detail=reason)

    # Check rate limit
    service = get_ai_coach_service()
    can_send, remaining, limit = await service.check_rate_limit(user_id, user_plan)

    if not can_send:
        raise HTTPException(
            status_code=429,
            detail=f"Daily message limit reached ({limit} messages). Limit resets at midnight UTC.",
        )

    # Queue message for background processing
    result = await service.queue_message(
        user_id=user_id,
        message=request.message,
        conversation_id=request.conversation_id,
        language=request.language,
        is_retry=request.is_retry,
        force_new=request.force_new,
        goal_id=request.goal_id,
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Failed to queue message"),
        )

    return AsyncChatResponse(
        success=True,
        conversation_id=result.get("conversation_id"),
        message_status=result.get("message_status", "pending"),
        task_id=result.get("task_id"),
    )


@router.post("/chat")
async def chat_with_coach(
    request: ChatMessageRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Send a message to AI Coach and receive streaming response.

    NOTE: For true background processing (ChatGPT-style where you can leave
    and come back), use POST /chat/async instead.

    Returns Server-Sent Events (SSE) stream with:
    - {"type": "start", "conversation_id": str}
    - {"type": "chunk", "content": str}
    - {"type": "end", "full_response": str, "tokens_used": int}
    - {"type": "error", "message": str}
    """
    user_id = current_user["id"]
    user_plan = current_user.get("plan", "free")

    # Check feature access
    has_access, reason = await check_ai_coach_access(user_id)
    if not has_access:
        raise HTTPException(status_code=403, detail=reason)

    # Check rate limit (still needs plan for limit calculation)
    service = get_ai_coach_service()
    can_send, remaining, limit = await service.check_rate_limit(user_id, user_plan)

    if not can_send:
        raise HTTPException(
            status_code=429,
            detail=f"Daily message limit reached ({limit} messages). Limit resets at midnight UTC.",
        )

    async def generate():
        """Generate SSE stream."""
        chunk_count = 0
        try:
            async for event in service.chat_stream(
                user_id=user_id,
                message=request.message,
                conversation_id=request.conversation_id,
                language=request.language,
                is_retry=request.is_retry,
                goal_id=request.goal_id,
            ):
                event_type = event.get("type", "unknown")
                if event_type == "chunk":
                    chunk_count += 1

                yield f"data: {json.dumps(event)}\n\n"

        except Exception as e:
            logger.error(
                f"[AI Coach] Chat stream error for user {user_id[:8]}...: {e}",
                exc_info=True,
            )
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@router.get("/conversations", response_model=ConversationsListResponse)
async def list_conversations(
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
):
    """
    List user's AI Coach conversations with pagination.

    Use `has_more` to determine if there are more conversations to load.
    """
    user_id = current_user["id"]

    # Check feature access
    has_access, reason = await check_ai_coach_access(user_id)
    if not has_access:
        raise HTTPException(status_code=403, detail=reason)

    service = get_ai_coach_service()
    result = await service.list_conversations_paginated(user_id, limit, offset)

    return ConversationsListResponse(
        conversations=[
            ConversationSummary(
                id=conv["id"],
                title=conv.get("title"),
                message_count=conv.get("message_count", 0),
                last_message_at=conv.get("last_message_at"),
                created_at=conv["created_at"],
            )
            for conv in result["conversations"]
        ],
        has_more=result["has_more"],
        total_count=result["total_count"],
    )


@router.get("/conversations/current", response_model=Optional[ConversationDetail])
async def get_current_conversation(
    message_limit: int = Query(50, ge=1, le=100, description="Max messages to return"),
    message_offset: int = Query(
        0, ge=0, description="Offset from most recent messages"
    ),
    current_user: dict = Depends(get_current_user),
):
    """
    Get the user's most recent conversation with paginated messages.
    Returns null if no conversations exist.

    NOTE: This route MUST be defined before /conversations/{conversation_id}
    to avoid "current" being matched as a conversation_id.
    """
    user_id = current_user["id"]

    # Check feature access
    has_access, reason = await check_ai_coach_access(user_id)
    if not has_access:
        raise HTTPException(status_code=403, detail=reason)

    service = get_ai_coach_service()
    conversation = await service.get_conversation_history(
        user_id, limit=message_limit, offset=message_offset
    )

    if not conversation:
        return None

    return ConversationDetail(
        id=conversation["id"],
        title=conversation.get("title"),
        messages=[
            MessageItem(
                role=msg.get("role", "user"),
                content=msg.get("content", ""),
                created_at=msg.get("created_at"),
                status=msg.get("status"),
            )
            for msg in conversation.get("messages", [])
        ],
        message_count=conversation.get("message_count", 0),
        last_message_at=conversation.get("last_message_at"),
        created_at=conversation["created_at"],
        has_more_messages=conversation.get("has_more_messages", False),
        total_messages=conversation.get("total_messages", 0),
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: str,
    message_limit: int = Query(50, ge=1, le=100, description="Max messages to return"),
    message_offset: int = Query(
        0, ge=0, description="Offset from most recent messages"
    ),
    current_user: dict = Depends(get_current_user),
):
    """
    Get a specific conversation with paginated message history.

    Messages are returned in chronological order (oldest first).
    Pagination works from the END (most recent first):
    - offset=0, limit=50: Returns the 50 most recent messages
    - offset=50, limit=50: Returns older messages (51-100 from the end)

    Use `has_more_messages` to know if there are older messages to load.
    """
    user_id = current_user["id"]

    # Check feature access
    has_access, reason = await check_ai_coach_access(user_id)
    if not has_access:
        raise HTTPException(status_code=403, detail=reason)

    service = get_ai_coach_service()
    conversation = await service.get_conversation_history(
        user_id, conversation_id, limit=message_limit, offset=message_offset
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return ConversationDetail(
        id=conversation["id"],
        title=conversation.get("title"),
        messages=[
            MessageItem(
                role=msg.get("role", "user"),
                content=msg.get("content", ""),
                created_at=msg.get("created_at"),
                status=msg.get("status"),
            )
            for msg in conversation.get("messages", [])
        ],
        message_count=conversation.get("message_count", 0),
        last_message_at=conversation.get("last_message_at"),
        created_at=conversation["created_at"],
        has_more_messages=conversation.get("has_more_messages", False),
        total_messages=conversation.get("total_messages", 0),
    )


@router.post("/conversations/new", response_model=ConversationSummary)
async def start_new_conversation(
    current_user: dict = Depends(get_current_user),
):
    """
    Start a new conversation.
    Does NOT archive existing conversations - users can have multiple active conversations.
    """
    user_id = current_user["id"]

    # Check feature access
    has_access, reason = await check_ai_coach_access(user_id)
    if not has_access:
        raise HTTPException(status_code=403, detail=reason)

    service = get_ai_coach_service()

    # Create new conversation (don't archive existing ones)
    conversation = await service.start_new_conversation(user_id)

    if not conversation:
        raise HTTPException(status_code=500, detail="Failed to create conversation")

    return ConversationSummary(
        id=conversation["id"],
        title=None,
        message_count=0,
        last_message_at=None,
        created_at=conversation["created_at"],
    )


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Delete a conversation permanently.
    """
    user_id = current_user["id"]

    # Check feature access
    has_access, reason = await check_ai_coach_access(user_id)
    if not has_access:
        raise HTTPException(status_code=403, detail=reason)

    service = get_ai_coach_service()
    success = await service.clear_conversation(user_id, conversation_id)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete conversation")

    return {"success": True, "message": "Conversation deleted"}


# =====================================================
# AD REWARD ENDPOINTS (Free users only)
# =====================================================


class UnlockMessageRequest(BaseModel):
    """Request to unlock additional message after watching ad."""

    reward_type: str = Field(
        "ai_message", description="Type of reward (must be 'ai_message')"
    )
    reward_amount: int = Field(
        1, ge=1, le=5, description="Number of messages to unlock"
    )


class UnlockMessageResponse(BaseModel):
    """Response after unlocking additional messages."""

    success: bool
    messages_unlocked: int
    remaining_messages: int
    daily_limit: int


# Maximum bonus messages per day (anti-abuse limit)
MAX_DAILY_BONUS_MESSAGES = 10


@router.post("/unlock-message", response_model=UnlockMessageResponse)
async def unlock_message_with_ad(
    request: UnlockMessageRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Unlock additional AI coach message(s) after watching a rewarded ad.

    This endpoint is called after the user watches a rewarded ad on the frontend.
    It grants the user additional messages for the current day.

    For free users only - premium users don't need to watch ads.

    SECURITY MEASURES:
    1. Daily bonus cap: Max 10 bonus messages/day (even with unlimited ad watches)
    2. Premium users blocked: Cannot call this endpoint at all
    3. Frontend validation: SDK's isEarnedReward only true after full ad watch

    PRODUCTION TODO - Server-Side Verification (SSV):
    For maximum security, implement AdMob SSV where Google sends a callback
    to your server to verify the reward. See:
    https://developers.google.com/admob/android/rewarded-video-ssv

    With SSV, you would:
    1. Configure SSV callback URL in AdMob console
    2. Receive signed callback from Google when user earns reward
    3. Only then call this endpoint or grant reward directly
    """
    user_id = current_user["id"]
    user_plan = current_user.get("plan", "free")

    # Only free users need to unlock messages
    if user_plan == "premium":
        raise HTTPException(
            status_code=400,
            detail="Premium users don't need to watch ads for additional messages.",
        )

    # Validate reward type
    if request.reward_type != "ai_message":
        raise HTTPException(
            status_code=400,
            detail=f"Invalid reward type: {request.reward_type}. Expected 'ai_message'.",
        )

    supabase = get_supabase_client()
    service = get_ai_coach_service()

    try:
        today = date.today().isoformat()

        # Get or create daily usage record
        result = (
            supabase.table("ai_coach_daily_usage")
            .select("id, message_count, tokens_used, bonus_messages")
            .eq("user_id", user_id)
            .eq("usage_date", today)
            .execute()
        )

        if result.data and len(result.data) > 0:
            record = result.data[0]
            current_bonus = record.get("bonus_messages", 0) or 0

            # Anti-abuse: Check daily bonus limit
            if current_bonus >= MAX_DAILY_BONUS_MESSAGES:
                raise HTTPException(
                    status_code=429,
                    detail=f"Daily bonus limit reached ({MAX_DAILY_BONUS_MESSAGES} bonus messages). "
                    "Upgrade to Premium for unlimited messages!",
                )

            new_bonus = min(
                current_bonus + request.reward_amount, MAX_DAILY_BONUS_MESSAGES
            )
            actual_granted = new_bonus - current_bonus

            # Update bonus messages
            supabase.table("ai_coach_daily_usage").update(
                {
                    "bonus_messages": new_bonus,
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).eq("id", record["id"]).execute()

            message_count = record.get("message_count", 0)
        else:
            # Create new record with bonus
            new_bonus = min(request.reward_amount, MAX_DAILY_BONUS_MESSAGES)
            actual_granted = new_bonus

            supabase.table("ai_coach_daily_usage").insert(
                {
                    "user_id": user_id,
                    "usage_date": today,
                    "message_count": 0,
                    "tokens_used": 0,
                    "bonus_messages": new_bonus,
                }
            ).execute()
            message_count = 0

        # Calculate new remaining messages
        base_limit = service.FREE_DAILY_MESSAGE_LIMIT
        total_limit = base_limit + new_bonus
        remaining = max(0, total_limit - message_count)

        logger.info(
            f"[AI Coach] User {user_id[:8]}... unlocked {actual_granted} bonus message(s)",
            {
                "bonus_total": new_bonus,
                "remaining": remaining,
                "daily_limit": total_limit,
            },
        )

        return UnlockMessageResponse(
            success=True,
            messages_unlocked=actual_granted,
            remaining_messages=remaining,
            daily_limit=total_limit,
        )

    except Exception as e:
        logger.error(f"[AI Coach] Failed to unlock message: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to unlock additional messages. Please try again.",
        )
