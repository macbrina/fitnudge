"""
FitNudge V2 - AI Coach Chat Service

Provides personalized AI coaching conversations with streaming support.
Features:
- Streaming responses via Server-Sent Events (SSE)
- Context-aware coaching based on user's goals, progress, and history
- Token tracking for rate limiting
- Conversation memory within session
- Function calling for actions (create goals, get suggestions)

Following SCALABILITY.md best practices:
- Batch queries for user context
- Token limits to prevent overflow
- Rate limiting per user per day
"""

import json
import asyncio
from datetime import date, datetime, timedelta
from typing import AsyncGenerator, Dict, Any, List, Optional, Tuple
from openai import AsyncOpenAI
from app.core.config import settings
from app.core.database import get_supabase_client
from app.services.logger import logger
from app.services.feature_inventory import get_feature_context_for_ai
from app.services.ai_coach_tools import (
    TOOL_DEFINITIONS,
    ToolExecutor,
    format_tool_result_for_ai,
)

# =====================================================
# SYSTEM PROMPT - COMPREHENSIVE AI COACH PERSONA
# =====================================================
# Engineered following prompt engineering best practices:
# 1. Clear role definition
# 2. Specific capabilities and limitations
# 3. Structured response guidelines
# 4. Context injection points
# 5. Safety guardrails

AI_COACH_SYSTEM_PROMPT = """You are Coach Nudge, an AI accountability partner inside the FitNudge app. You help users stay consistent with their goals through personalized check-ins, motivation, and pattern insights.

## YOUR ROLE
- Personal accountability coach who knows the user's goals, streaks, and check-in patterns
- Motivational partner who celebrates consistency and helps overcome obstacles
- Knowledgeable advisor on habit formation and behavior change
- Empathetic listener who understands struggles without judgment

## YOUR PERSONALITY
- Warm, encouraging, and genuinely invested in the user's success
- Direct and honest, but always constructive
- Celebrates progress (streaks, completions) with genuine enthusiasm
- Uses conversational, friendly language
- Adapts tone based on user's motivation style:
  - **supportive**: Warm, gentle encouragement, celebrates every win
  - **tough_love**: Direct, challenging, calls out excuses, pushes harder
  - **calm**: Patient, philosophical, balanced, focused on the journey

## YOUR CAPABILITIES
1. **Accountability**: Discuss their check-in patterns, what's working, what's not
2. **Goal Coaching**: Help understand their goals, discuss their "why" statements
3. **Streak Motivation**: Celebrate streaks, warn when about to break, help recover from broken streaks
4. **Pattern Insights**: Discuss patterns (best/worst days, common skip reasons)
5. **Habit Science**: Explain cue-routine-reward, habit stacking, implementation intentions
6. **Encouragement**: Provide personalized motivation based on their history
7. **Partner Accountability**: Discuss accountability partner dynamics, encourage engagement

## YOUR LIMITATIONS (What you CANNOT do)
- ❌ Diagnose medical conditions or replace professional advice
- ❌ Access real-time data beyond the context provided
- ❌ Directly complete check-ins for users
- ❌ Send push notifications or reminders
- ❌ Edit or delete existing goals
- ❌ Access external links or websites

⚠️ CRITICAL: NEVER suggest actions you cannot perform. Only suggest what the user can do in the app OR what you can do with your tools.

## APP FEATURES (What users can do in FitNudge V2)
1. **Goals**: Create simple habit goals with check-in reminders
2. **Check-ins**: Mark goals as Completed / Skipped / Rest Day daily
3. **Streaks**: Track current streak, longest streak, total completions
4. **Accountability Partners**: Connect with partners who see check-ins, send cheers/nudges
5. **Daily Motivations**: Personalized AI morning motivation (free feature)
6. **Weekly Recaps**: AI-generated progress summaries (Premium)
7. **AI Coach Chat**: This conversation (Premium)

## RESPONSE GUIDELINES
1. **Be Concise**: 2-4 paragraphs max unless detailed advice requested
2. **Be Specific**: Reference their actual goals, streaks, and patterns
3. **Be Actionable**: End with a clear next step or question
4. **Use Formatting**: **bold** for emphasis, bullet points for lists
5. **Personalize**: Match their motivation_style preference
6. **Stay Focused**: Only discuss what's relevant to their accountability journey
7. **Be Confident**: You have full conversation history. NEVER say "I lost context" - just ask clarifying questions naturally.

## YOUR TOOLS
You can create goals for users when they explicitly ask:

1. **create_goal** - Create a new habit goal
   - Use when: "Create a goal for me", "Help me set up a reading habit"
   - ALWAYS confirm details first (title, frequency, reminder times)
   - Ask about their "why" - it's powerful for motivation

### Tool Usage Guidelines:
- ⚠️ ONLY use tools when user EXPLICITLY requests action
- For questions like "should I create a goal?" - discuss first, then offer
- ALWAYS confirm goal details before creating
- Ask for their "why" statement - helps with future motivation

**HOW TO USE TOOLS:**
- Confirm with user before creating goals
- Tell them what configuration you'll use (frequency, days, reminders)
- Don't mention "tools" or "functions" - just say "I've created..." or "Let me set that up..."

**FREQUENCY SELECTION:**
- **daily**: Every day (for habits like journaling, hydration)
- **weekly**: Specific days only (for exercise, reading - allows rest days)
- For exercise: Recommend 3-5 days with rest days between
- ALWAYS ask: "How many days per week can you realistically commit?"

## SAFETY
- If user mentions serious mental health issues, express care and suggest professional help
- Encourage balanced, sustainable approaches
- Redirect off-topic questions to accountability/habits

## CONVERSATION MEMORY
You have access to the conversation history. Reference previous messages to maintain context.

{context_injection_point}

{goal_focus_context}

Remember: You're their personal accountability partner who genuinely wants to see them succeed. Help them stay consistent, one check-in at a time."""


class AICoachService:
    """
    AI Coach Chat Service with streaming support.

    Usage:
        service = AICoachService()
        async for chunk in service.chat_stream(user_id, message, conversation_id):
            yield chunk
    """

    # Rate limiting defaults (used only if DB lookup fails)
    DEFAULT_FREE_DAILY_MESSAGE_LIMIT = 3  # Fallback for free users
    DEFAULT_PREMIUM_DAILY_MESSAGE_LIMIT = 100  # Fallback for premium users
    MAX_CONVERSATION_MESSAGES = 20  # Keep last N messages for context
    MAX_CONTEXT_TOKENS = 4000  # Reserve tokens for context

    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.supabase = get_supabase_client()

    async def chat_stream(
        self,
        user_id: str,
        message: str,
        conversation_id: Optional[str] = None,
        language: str = "en",
        is_retry: bool = False,
        goal_id: Optional[str] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream AI coach response with real-time token delivery.

        Args:
            user_id: The user's ID
            message: The user's message
            conversation_id: Optional existing conversation ID
            language: Language code for AI responses (ISO 639-1, e.g., 'en', 'es', 'fr')
            is_retry: If True, skip saving user message (already saved on first attempt)
            goal_id: Optional goal ID to focus the conversation on a specific goal

        Yields:
            {"type": "start", "conversation_id": str}
            {"type": "chunk", "content": str}
            {"type": "end", "full_response": str, "tokens_used": int}
            {"type": "error", "message": str}
        """
        try:
            # Get or create conversation
            conversation = await self._get_or_create_conversation(
                user_id, conversation_id
            )
            if not conversation:
                yield {"type": "error", "message": "Failed to create conversation"}
                return

            conversation_id = conversation["id"]
            yield {"type": "start", "conversation_id": conversation_id}

            # Save user message immediately (awaited to ensure it's saved)
            # Skip if this is a retry - message was already saved on first attempt
            if not is_retry:
                await self._save_message(
                    conversation_id=conversation_id,
                    role="user",
                    content=message,
                )

                # Check AI conversation achievements (non-blocking)
                try:
                    from app.services.tasks import check_achievements_task

                    check_achievements_task.delay(
                        user_id=user_id,
                        source_type="ai_conversation",
                        source_id=conversation_id,
                    )
                except Exception as e:
                    logger.warning(
                        f"Failed to queue achievement check for AI chat: {e}"
                    )

            # Get user context for personalization
            user_context = await self._get_user_context(user_id)

            # Get goal focus context if goal_id is provided
            goal_focus_context = ""
            if goal_id:
                goal_focus_context = await self._get_goal_focus_context(
                    user_id, goal_id
                )

            # Build messages array for OpenAI
            messages = await self._build_messages(
                conversation=conversation,
                new_message=message,
                user_context=user_context,
                language=language,
                goal_focus_context=goal_focus_context,
            )

            # Stream response from OpenAI with tool support
            full_response = ""
            tokens_used = 0
            chunk_count = 0
            tool_executor = ToolExecutor(user_id, self.supabase)

            try:
                # First API call - may return tool calls or direct response
                response = await self.client.chat.completions.create(
                    model="gpt-4o-mini",  # Fast, efficient model for chat
                    messages=messages,
                    temperature=0.8,  # Balanced creativity
                    max_tokens=1000,
                    tools=TOOL_DEFINITIONS,
                    tool_choice="auto",  # Let model decide when to use tools
                )

                assistant_message = response.choices[0].message

                # Check if the model wants to call tools
                if assistant_message.tool_calls:
                    # Yield a processing indicator
                    yield {"type": "chunk", "content": ""}

                    # Process each tool call
                    tool_results = []
                    for tool_call in assistant_message.tool_calls:
                        tool_name = tool_call.function.name
                        try:
                            tool_args = json.loads(tool_call.function.arguments)
                        except json.JSONDecodeError:
                            tool_args = {}

                        logger.info(
                            f"[AI Coach Service] Tool call: {tool_name}",
                            {"user_id": user_id[:8], "args": tool_args},
                        )

                        # Execute the tool
                        result = await tool_executor.execute(tool_name, tool_args)
                        tool_results.append(
                            {
                                "tool_call_id": tool_call.id,
                                "name": tool_name,
                                "result": result,
                            }
                        )

                    # Build messages for the follow-up call
                    follow_up_messages = messages + [
                        {
                            "role": "assistant",
                            "content": assistant_message.content,
                            "tool_calls": [
                                {
                                    "id": tc.id,
                                    "type": "function",
                                    "function": {
                                        "name": tc.function.name,
                                        "arguments": tc.function.arguments,
                                    },
                                }
                                for tc in assistant_message.tool_calls
                            ],
                        }
                    ]

                    # Add tool results
                    for tr in tool_results:
                        follow_up_messages.append(
                            {
                                "role": "tool",
                                "tool_call_id": tr["tool_call_id"],
                                "content": json.dumps(tr["result"]),
                            }
                        )

                    # Get the final response after tool execution (non-streaming for reliability)
                    follow_up_response = await self.client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=follow_up_messages,
                        temperature=0.8,
                        max_tokens=1000,
                    )

                    full_response = follow_up_response.choices[0].message.content or ""
                    if follow_up_response.usage:
                        tokens_used = follow_up_response.usage.total_tokens

                else:
                    # No tool calls - get direct response (non-streaming for reliability)
                    direct_response = await self.client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=messages,
                        temperature=0.8,
                        max_tokens=1000,
                    )

                    full_response = direct_response.choices[0].message.content or ""
                    if direct_response.usage:
                        tokens_used = direct_response.usage.total_tokens

                # Save assistant message IMMEDIATELY after receiving full response
                # Awaited to ensure message is persisted before streaming to client
                await self._save_message(
                    conversation_id=conversation_id,
                    role="assistant",
                    content=full_response,
                )

                # Generate AI title in background (doesn't block streaming)
                # This is less critical - if it fails, user just sees default title
                _title_task = asyncio.create_task(
                    self._update_conversation_title(
                        conversation_id, message, full_response
                    )
                )

                # Now simulate streaming to the client for a nice UX
                # Even if client disconnects here, message is already saved
                # Use character-based streaming for smoother effect
                chunk_size = 8  # Characters per chunk for smooth typing effect
                for i in range(0, len(full_response), chunk_size):
                    content = full_response[i : i + chunk_size]
                    yield {"type": "chunk", "content": content}
                    chunk_count += 1
                    # Small delay for natural typing feel (20ms)
                    await asyncio.sleep(0.02)

            except Exception as e:
                logger.error(
                    f"[AI Coach Service] OpenAI streaming error for user {user_id[:8]}...: {e}",
                    exc_info=True,
                )
                yield {
                    "type": "error",
                    "message": "Failed to get AI response. Please try again.",
                }
                return

            # Estimate tokens if not provided by API
            if tokens_used == 0:
                tokens_used = len(full_response.split()) * 1.3  # Rough estimate

            # Note: User and assistant messages are saved (awaited) before streaming starts
            # This ensures persistence even if client disconnects during streaming

            # Update usage tracking
            await self._update_daily_usage(user_id, int(tokens_used))

            yield {
                "type": "end",
                "full_response": full_response,
                "tokens_used": int(tokens_used),
                "conversation_id": conversation_id,
            }

        except Exception as e:
            logger.error(
                f"[AI Coach Service] Chat error for user {user_id[:8]}...: {e}",
                exc_info=True,
            )
            yield {"type": "error", "message": str(e)}

    async def check_rate_limit(
        self, user_id: str, user_plan: str = "free"
    ) -> Tuple[bool, int, int]:
        """
        Check if user has remaining messages for today.

        V2: Gets limit from database (plan_features.ai_coach_chat).
        Free users get base limit + bonus messages from watching ads.
        Premium users get their plan limit (typically 100/day).

        Returns:
            (can_send, remaining_messages, effective_daily_limit)
        """
        from app.services.subscription_service import get_user_feature_value

        # Get limit from database based on user's plan
        try:
            db_limit = await get_user_feature_value(
                self.supabase, user_id, "ai_coach_chat"
            )
            # db_limit: number = limit, None = unlimited (shouldn't happen for this feature)
            if db_limit is None:
                # Unlimited - use a high number
                base_limit = 9999
            elif db_limit == 0:
                # Feature disabled
                return False, 0, 0
            else:
                base_limit = int(db_limit)
        except Exception as e:
            logger.warning(f"Failed to get ai_coach_chat limit from DB: {e}, using defaults")
            # Fallback to hardcoded defaults
            base_limit = (
                self.DEFAULT_PREMIUM_DAILY_MESSAGE_LIMIT
                if user_plan == "premium"
                else self.DEFAULT_FREE_DAILY_MESSAGE_LIMIT
            )

        try:
            today = date.today().isoformat()
            result = (
                self.supabase.table("ai_coach_daily_usage")
                .select("message_count, bonus_messages")
                .eq("user_id", user_id)
                .eq("usage_date", today)
                .execute()
            )

            if result.data and len(result.data) > 0:
                used = result.data[0].get("message_count", 0)
                bonus = result.data[0].get("bonus_messages", 0) or 0
                # Effective limit = base limit + any bonus from ads
                effective_limit = base_limit + bonus
                remaining = max(0, effective_limit - used)
                return remaining > 0, remaining, effective_limit

            return True, base_limit, base_limit

        except Exception as e:
            logger.error(f"Rate limit check error: {e}")
            # On error, allow the message (fail open)
            return True, base_limit, base_limit

    async def get_conversation_history(
        self,
        user_id: str,
        conversation_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Optional[Dict[str, Any]]:
        """
        Get conversation history for a user with pagination support.

        Messages are returned in chronological order (oldest first in the array).
        Pagination works from the END of the array (most recent messages first):
        - offset=0, limit=20: Returns the 20 most recent messages
        - offset=20, limit=20: Returns messages 21-40 from the end (older messages)

        Returns:
            Conversation dict with additional fields:
            - has_more_messages: True if there are older messages to load
            - total_messages: Total count of messages in the conversation
        """
        try:
            query = (
                self.supabase.table("ai_coach_conversations")
                .select("*")
                .eq("user_id", user_id)
                .eq("is_archived", False)
            )

            if conversation_id:
                query = query.eq("id", conversation_id)
            else:
                # Get most recent conversation
                query = query.order("last_message_at", desc=True).limit(1)

            result = query.execute()

            if result.data and len(result.data) > 0:
                conversation = result.data[0]
                # Parse messages JSONB
                if isinstance(conversation.get("messages"), str):
                    conversation["messages"] = json.loads(conversation["messages"])

                all_messages = conversation.get("messages") or []
                total_messages = len(all_messages)

                # Paginate from the end (most recent first)
                # offset=0 means start from the end
                if total_messages > 0:
                    # Calculate start and end indices for slicing
                    # We want to return messages from the end, going backwards
                    end_idx = total_messages - offset
                    start_idx = max(0, end_idx - limit)

                    # Slice the messages (returns in chronological order)
                    conversation["messages"] = all_messages[start_idx:end_idx]

                    # Check if there are more older messages
                    conversation["has_more_messages"] = start_idx > 0
                else:
                    conversation["messages"] = []
                    conversation["has_more_messages"] = False

                conversation["total_messages"] = total_messages
                return conversation

            return None

        except Exception as e:
            logger.error(f"Get conversation history error: {e}")
            return None

    async def list_conversations(
        self,
        user_id: str,
        limit: int = 20,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """List user's conversations (without full message history)."""
        try:
            result = (
                self.supabase.table("ai_coach_conversations")
                .select("id, title, message_count, last_message_at, created_at")
                .eq("user_id", user_id)
                .eq("is_archived", False)
                .order("last_message_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )

            return result.data or []

        except Exception as e:
            logger.error(f"List conversations error: {e}")
            return []

    async def list_conversations_paginated(
        self,
        user_id: str,
        limit: int = 20,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        List user's conversations with pagination info.

        Returns:
            {
                "conversations": [...],
                "has_more": bool,
                "total_count": int
            }
        """
        try:
            # Get total count first
            count_result = (
                self.supabase.table("ai_coach_conversations")
                .select("id", count="exact")
                .eq("user_id", user_id)
                .eq("is_archived", False)
                .execute()
            )
            total_count = count_result.count or 0

            # Get paginated conversations
            result = (
                self.supabase.table("ai_coach_conversations")
                .select("id, title, message_count, last_message_at, created_at")
                .eq("user_id", user_id)
                .eq("is_archived", False)
                .order("last_message_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )

            conversations = result.data or []
            has_more = (offset + len(conversations)) < total_count

            return {
                "conversations": conversations,
                "has_more": has_more,
                "total_count": total_count,
            }

        except Exception as e:
            logger.error(f"List conversations paginated error: {e}")
            return {
                "conversations": [],
                "has_more": False,
                "total_count": 0,
            }

    async def clear_conversation(self, user_id: str, conversation_id: str) -> bool:
        """Delete a conversation permanently."""
        try:
            self.supabase.table("ai_coach_conversations").delete().eq(
                "id", conversation_id
            ).eq("user_id", user_id).execute()

            return True
        except Exception as e:
            logger.error(f"Clear conversation error: {e}")
            return False

    async def start_new_conversation(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Start a fresh conversation."""
        try:
            result = (
                self.supabase.table("ai_coach_conversations")
                .insert(
                    {
                        "user_id": user_id,
                        "messages": [],
                        "message_count": 0,
                        "total_tokens_used": 0,
                    }
                )
                .execute()
            )

            if result.data and len(result.data) > 0:
                return result.data[0]
            return None

        except Exception as e:
            logger.error(f"Start new conversation error: {e}")
            return None

    async def queue_message(
        self,
        user_id: str,
        message: str,
        conversation_id: Optional[str] = None,
        language: str = "en",
        is_retry: bool = False,
        force_new: bool = False,
        goal_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Queue a message for background processing (ChatGPT-style).

        This method:
        1. Gets or creates a conversation
        2. Saves the user message with status "pending" (unless is_retry=True)
        3. Queues a Celery task to process the AI response
        4. Returns immediately - user can leave the app

        When user returns, they'll see the AI response (or still processing).

        Args:
            user_id: User ID
            message: User's message
            conversation_id: Optional existing conversation ID
            language: Language code for AI response
            is_retry: If True, skip saving user message (already exists)
            force_new: If True, always create a new conversation
            goal_id: Optional goal ID to focus the conversation on

        Returns:
            Dict with conversation_id and message status
        """
        try:
            # Get or create conversation
            conversation = await self._get_or_create_conversation(
                user_id, conversation_id, force_new=force_new
            )
            if not conversation:
                return {"success": False, "error": "Failed to get/create conversation"}

            conversation_id = conversation["id"]

            # Get current messages
            messages = conversation.get("messages", [])
            if isinstance(messages, str):
                messages = json.loads(messages)

            message_index = len(messages)

            # Add user message with "pending" status (skip on retry - already exists)
            if not is_retry:
                messages.append(
                    {
                        "role": "user",
                        "content": message,
                        "status": "pending",
                        "created_at": datetime.utcnow().isoformat(),
                    }
                )
            else:
                # On retry, find the last user message and update its status to pending
                # The message_index should point to this existing message
                for i in range(len(messages) - 1, -1, -1):
                    if messages[i].get("role") == "user":
                        messages[i]["status"] = "pending"
                        message_index = i
                        break

            # Save to database
            self.supabase.table("ai_coach_conversations").update(
                {
                    "messages": json.dumps(messages),
                    "message_count": len(messages),
                    "last_message_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).eq("id", conversation_id).execute()

            # Queue Celery task for background processing
            from app.services.tasks import process_ai_coach_message_task

            task = process_ai_coach_message_task.delay(
                user_id=user_id,
                conversation_id=conversation_id,
                message=message,
                message_index=message_index,
                language=language,
                goal_id=goal_id,
            )

            logger.info(
                f"[AI Coach] Queued message for background processing",
                {
                    "user_id": user_id[:8],
                    "conversation_id": conversation_id,
                    "task_id": task.id,
                },
            )

            return {
                "success": True,
                "conversation_id": conversation_id,
                "message_status": "pending",
                "task_id": task.id,
            }

        except Exception as e:
            logger.error(f"Queue message error: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    # =====================================================
    # PRIVATE METHODS
    # =====================================================

    async def _get_or_create_conversation(
        self,
        user_id: str,
        conversation_id: Optional[str] = None,
        force_new: bool = False,
    ) -> Optional[Dict[str, Any]]:
        """Get existing conversation or create new one.

        Args:
            user_id: User ID
            conversation_id: Optional specific conversation ID to load
            force_new: If True, always create a new conversation (ignores conversation_id)
        """
        try:
            # Force create new conversation if requested
            if force_new:
                return await self.start_new_conversation(user_id)

            if conversation_id:
                result = (
                    self.supabase.table("ai_coach_conversations")
                    .select("*")
                    .eq("id", conversation_id)
                    .eq("user_id", user_id)
                    .eq("is_archived", False)
                    .execute()
                )

                if result.data and len(result.data) > 0:
                    conv = result.data[0]
                    if isinstance(conv.get("messages"), str):
                        conv["messages"] = json.loads(conv["messages"])
                    return conv

            # Get most recent non-archived conversation
            result = (
                self.supabase.table("ai_coach_conversations")
                .select("*")
                .eq("user_id", user_id)
                .eq("is_archived", False)
                .order("last_message_at", desc=True)
                .limit(1)
                .execute()
            )

            if result.data and len(result.data) > 0:
                conv = result.data[0]
                if isinstance(conv.get("messages"), str):
                    conv["messages"] = json.loads(conv["messages"])
                return conv

            # Create new conversation
            return await self.start_new_conversation(user_id)

        except Exception as e:
            logger.error(f"Get/create conversation error: {e}")
            return None

    async def _get_user_context(self, user_id: str) -> Dict[str, Any]:
        """
        Fetch user context for personalization using optimized RPC.

        Uses build_ai_context() PostgreSQL function for O(1) single-call efficiency.
        Falls back to individual queries if RPC fails.

        Returns context with:
        - user_name, motivation_style, timezone
        - goals (with streaks, why_statement, frequency)
        - patterns (best_day, worst_day, skip_reason_pattern)
        - recent_performance (completion_rate, total_checkins)
        """
        context = {
            "user_name": "there",
            "motivation_style": "supportive",
            "user_plan": "free",
            "goals": [],
            "patterns": [],
            "recent_performance": {},
            "current_streak": 0,
            "longest_streak": 0,
            "partner_count": 0,
        }

        try:
            # Use the optimized build_ai_context RPC - single database call
            rpc_result = self.supabase.rpc(
                "build_ai_context", {"p_user_id": user_id}
            ).execute()

            if rpc_result.data:
                ai_context = rpc_result.data

                # Extract user info
                name = ai_context.get("user_name", "there")
                context["user_name"] = name.split()[0] if name else "there"
                context["motivation_style"] = ai_context.get(
                    "motivation_style", "supportive"
                )
                context["timezone"] = ai_context.get("timezone")

                # Extract goals
                goals = ai_context.get("goals", [])
                if goals:
                    context["goals"] = goals
                    # Calculate best streaks
                    current_streaks = [g.get("current_streak", 0) for g in goals]
                    longest_streaks = [g.get("longest_streak", 0) for g in goals]
                    context["current_streak"] = (
                        max(current_streaks) if current_streaks else 0
                    )
                    context["longest_streak"] = (
                        max(longest_streaks) if longest_streaks else 0
                    )

                # Extract patterns (from pattern_insights table)
                context["patterns"] = ai_context.get("patterns", [])

                # Extract recent performance
                context["recent_performance"] = ai_context.get("recent_performance", {})

                # Get user's effective plan (still needed separately for tier check)
                from app.core.subscriptions import get_user_effective_plan

                context["user_plan"] = get_user_effective_plan(
                    user_id, supabase=self.supabase
                )

                # Get partner count (quick count query)
                partners_result = (
                    self.supabase.table("accountability_partners")
                    .select("id", count="exact")
                    .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
                    .eq("status", "accepted")
                    .execute()
                )
                context["partner_count"] = partners_result.count or 0

                # Get feature context for plan-aware coaching
                context["feature_context"] = get_feature_context_for_ai(
                    context["user_plan"]
                )

                logger.debug(
                    f"[AI Coach] Context loaded via RPC for user {user_id[:8]}..."
                )
                return context

        except Exception as e:
            logger.warning(f"build_ai_context RPC failed, using fallback: {e}")

        # Fallback to individual queries if RPC fails
        return await self._get_user_context_fallback(user_id)

    async def _get_user_context_fallback(self, user_id: str) -> Dict[str, Any]:
        """
        Fallback context fetching using individual queries.
        Used when build_ai_context RPC is unavailable.
        """
        context = {
            "user_name": "there",
            "motivation_style": "supportive",
            "user_plan": "free",
            "goals": [],
            "patterns": [],
            "recent_performance": {},
            "current_streak": 0,
            "longest_streak": 0,
            "partner_count": 0,
        }

        try:
            # 1. User info with motivation style
            user_result = (
                self.supabase.table("users")
                .select("name, motivation_style")
                .eq("id", user_id)
                .single()
                .execute()
            )

            if user_result.data:
                name = user_result.data.get("name", "there")
                context["user_name"] = name.split()[0] if name else "there"
                context["motivation_style"] = user_result.data.get(
                    "motivation_style", "supportive"
                )

            # Get EFFECTIVE plan
            from app.core.subscriptions import get_user_effective_plan

            context["user_plan"] = get_user_effective_plan(
                user_id, supabase=self.supabase
            )

            # 2. Active goals with V2 details
            goals_result = (
                self.supabase.table("goals")
                .select(
                    "id, title, frequency_type, frequency_count, "
                    "current_streak, longest_streak, why_statement, week_completions"
                )
                .eq("user_id", user_id)
                .eq("status", "active")
                .order("current_streak", desc=True)
                .limit(10)
                .execute()
            )

            if goals_result.data:
                context["goals"] = [
                    {
                        "title": g["title"],
                        "frequency_type": g.get("frequency_type", "daily"),
                        "frequency_count": g.get("frequency_count", 1),
                        "frequency": (
                            "Daily"
                            if g.get("frequency_type") == "daily"
                            else f"{g.get('frequency_count', 1)}x per week"
                        ),
                        "current_streak": g.get("current_streak", 0),
                        "longest_streak": g.get("longest_streak", 0),
                        "why_statement": g.get("why_statement"),
                        "week_completions": g.get("week_completions", 0),
                    }
                    for g in goals_result.data
                ]

                # Get best streak across all goals
                context["current_streak"] = goals_result.data[0].get(
                    "current_streak", 0
                )
                context["longest_streak"] = max(
                    g.get("longest_streak", 0) for g in goals_result.data
                )

            # 3. Get AI-generated pattern insights (pre-computed)
            patterns_result = (
                self.supabase.table("pattern_insights")
                .select("goal_id, insights, current_metrics, nudge_config")
                .eq("user_id", user_id)
                .eq("status", "completed")
                .limit(10)
                .execute()
            )

            if patterns_result.data:
                all_insights = []
                for p in patterns_result.data:
                    insights_list = p.get("insights") or []
                    for insight in insights_list:
                        all_insights.append(
                            {
                                "type": insight.get("type", "pattern"),
                                "text": insight.get("text", ""),
                                "goal_id": p.get("goal_id"),
                            }
                        )
                context["patterns"] = all_insights

            # 4. Recent check-ins (last 30 days) for completion rate (V2: use status)
            month_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()[:10]
            checkins_result = (
                self.supabase.table("check_ins")
                .select("check_in_date, status")
                .eq("user_id", user_id)
                .gte("check_in_date", month_ago)
                .limit(100)
                .execute()
            )

            if checkins_result.data:
                # V2.1: Use status field instead of completed boolean
                completed = sum(
                    1 for c in checkins_result.data if c.get("status") == "completed"
                )
                total = len(
                    [c for c in checkins_result.data if c.get("status") != "pending"]
                )
                context["recent_performance"] = {
                    "total_checkins": total,
                    "completed_checkins": completed,
                    "completion_rate": (
                        round(completed / total * 100) if total > 0 else 0
                    ),
                }

            # 5. Partner count
            partners_result = (
                self.supabase.table("accountability_partners")
                .select("id", count="exact")
                .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
                .eq("status", "accepted")
                .execute()
            )
            context["partner_count"] = partners_result.count or 0

            # 6. Feature context for plan-aware coaching
            context["feature_context"] = get_feature_context_for_ai(
                context["user_plan"]
            )

        except Exception as e:
            logger.warning(f"Failed to fetch user context (fallback): {e}")

        return context

    def _build_context_string(self, user_context: Dict[str, Any]) -> str:
        """
        Build context injection for system prompt (V2 focused).

        Includes:
        - User info (name, plan, motivation style)
        - Active goals with streaks and why statements
        - Pattern insights (best days, worst days, common barriers)
        - Recent performance stats
        - Accountability partners
        """
        lines = []

        lines.append("## USER CONTEXT")
        lines.append(f"- Name: {user_context.get('user_name', 'there')}")
        lines.append(f"- Plan: {user_context.get('user_plan', 'free').title()}")

        motivation = user_context.get("motivation_style", "supportive")
        motivation_display = motivation.replace("_", " ").title()
        lines.append(f"- Motivation Style: {motivation_display}")

        # Goals with V2 details
        goals = user_context.get("goals", [])
        if goals:
            lines.append(f"\n## ACTIVE GOALS ({len(goals)})")
            for goal in goals[:5]:  # Limit for token efficiency
                # Handle both RPC format and fallback format
                freq = goal.get("frequency")
                if not freq:
                    freq_type = goal.get("frequency_type", "daily")
                    freq_count = goal.get("frequency_count", 1)
                    freq = "Daily" if freq_type == "daily" else f"{freq_count}x/week"

                goal_line = f"- 🎯 {goal.get('title', 'Goal')}"
                goal_line += f" ({freq})"

                # Add streak if any
                streak = goal.get("current_streak", 0)
                if streak > 0:
                    goal_line += f" - 🔥 {streak} day streak"

                # Add week progress for weekly goals
                week_completions = goal.get("week_completions")
                freq_count = goal.get("frequency_count")
                if week_completions is not None and freq_count:
                    goal_line += f" [{week_completions}/{freq_count} this week]"

                lines.append(goal_line)

                # Add why statement if available (powerful for motivation)
                why = goal.get("why_statement")
                if why:
                    lines.append(f'  💡 Why: "{why}"')

        # Pattern Insights - the key addition for intelligent coaching
        patterns = user_context.get("patterns", [])
        if patterns:
            lines.append("\n## PATTERN INSIGHTS (Use these to coach specifically)")
            for pattern in patterns:
                insight_type = pattern.get("type", "")
                insight_text = pattern.get("text", "")

                if insight_type == "best_day":
                    lines.append(f"✅ Strength: {insight_text}")
                elif insight_type == "worst_day":
                    lines.append(f"⚠️ Challenge: {insight_text}")
                elif insight_type == "skip_reason_pattern":
                    lines.append(f"🚧 Common Barrier: {insight_text}")
                elif insight_type == "success_pattern":
                    lines.append(f"🏆 Achievement: {insight_text}")
                else:
                    lines.append(f"📊 {insight_text}")

        # Recent Performance (30-day stats)
        recent_perf = user_context.get("recent_performance", {})
        if recent_perf:
            completion_rate = recent_perf.get("completion_rate", 0)
            total_checkins = recent_perf.get("total_checkins", 0)

            if total_checkins > 0:
                lines.append("\n## 30-DAY PERFORMANCE")
                lines.append(f"- Completion Rate: {completion_rate}%")
                lines.append(f"- Total Check-ins: {total_checkins}")

                # Add performance coaching hint
                if completion_rate >= 80:
                    lines.append(
                        "  → User is highly consistent - celebrate and challenge them!"
                    )
                elif completion_rate >= 50:
                    lines.append(
                        "  → Good progress - help identify what's working and what's not"
                    )
                else:
                    lines.append(
                        "  → Needs support - focus on small wins and removing barriers"
                    )

        # Best streak across all goals
        if user_context.get("longest_streak", 0) > 0:
            lines.append(
                f"- Longest Streak Ever: {user_context['longest_streak']} days"
            )

        # Accountability partners
        if user_context.get("partner_count", 0) > 0:
            lines.append(f"\n## ACCOUNTABILITY")
            lines.append(f"- Partners: {user_context['partner_count']}")
            lines.append(
                "  → Encourage engaging with partners for extra accountability"
            )

        # Feature context - what user can and cannot do
        feature_context = user_context.get("feature_context", {})
        if feature_context:
            lines.append("\n## PLAN FEATURES & LIMITS")
            lines.append(f"User's Plan: {feature_context.get('plan', 'free').title()}")
            lines.append(
                "Note: Each feature has a feature_value. If null = unlimited. If a number = that's the limit."
            )

            # Show features with their limits from the features list
            features = feature_context.get("features", [])
            if features:
                lines.append("\nAvailable Features:")
                for feature in features:
                    name = feature.get("name", feature.get("key", "Unknown"))
                    value = feature.get("feature_value")
                    if value is not None:
                        lines.append(f"  - {name}: {value}")
                    else:
                        lines.append(f"  - {name}: Unlimited")

            # Show restrictions
            restrictions = feature_context.get("restrictions", [])
            if restrictions:
                lines.append("\nPlan Restrictions:")
                for r in restrictions:
                    lines.append(f"  - {r}")

            # Premium-only features (for contextual upselling)
            premium_only = feature_context.get("premium_only_features", [])
            if premium_only:
                lines.append(
                    "\nPremium-Only Features (mention naturally when relevant):"
                )
                for feature in premium_only[:5]:  # Limit for token efficiency
                    desc = feature.get("ai_description") or feature.get("name", "")
                    if desc:
                        lines.append(f"  - {desc}")
                lines.append(
                    "  → When user asks for these features, explain they're Premium and suggest upgrading"
                )

        return "\n".join(lines)

    async def _get_goal_focus_context(self, user_id: str, goal_id: str) -> str:
        """
        Build focused context for a specific goal.
        Used when user navigates to AI coach from a specific goal.
        """
        try:
            # Fetch the specific goal with all details
            goal_result = (
                self.supabase.table("goals")
                .select(
                    "id, title, emoji, description, category, "
                    "frequency_type, frequency_count, target_days, "
                    "current_streak, longest_streak, total_completions, "
                    "why_statement, reminder_times, status, created_at"
                )
                .eq("id", goal_id)
                .eq("user_id", user_id)
                .single()
                .execute()
            )

            if not goal_result.data:
                return ""

            goal = goal_result.data
            lines = ["\n## 🎯 FOCUSED GOAL (User opened chat from this goal)"]
            lines.append(
                "The user started this conversation from a specific goal. Focus your coaching on this goal primarily:\n"
            )

            # Goal details
            lines.append(f"**{goal.get('emoji', '🎯')} {goal['title']}**")

            if goal.get("description"):
                lines.append(f"Description: {goal['description']}")

            # Schedule
            freq_type = goal.get("frequency_type", "daily")
            freq_count = goal.get("frequency_count", 1)
            if freq_type == "weekly":
                target_days = goal.get("target_days", [])
                day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
                days_str = (
                    ", ".join([day_names[d] for d in target_days if d < 7])
                    if target_days
                    else "Not set"
                )
                lines.append(f"Schedule: {freq_count}x per week on {days_str}")
            else:
                lines.append("Schedule: Daily")

            # Reminder times
            reminders = goal.get("reminder_times", [])
            if reminders:
                lines.append(f"Reminders: {', '.join(reminders)}")

            # Stats
            lines.append(f"\nStats:")
            lines.append(f"- Current Streak: {goal.get('current_streak', 0)} days")
            lines.append(f"- Longest Streak: {goal.get('longest_streak', 0)} days")
            lines.append(f"- Total Completions: {goal.get('total_completions', 0)}")

            # Why statement (important for motivation)
            why = goal.get("why_statement")
            if why:
                lines.append(f'\n**Their Why:** "{why}"')
                lines.append("(Use this to motivate them - it's their personal reason)")

            # Fetch recent check-ins for this goal (V2: use status instead of completed)
            week_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()[:10]
            checkins_result = (
                self.supabase.table("check_ins")
                .select("check_in_date, status, mood, note, skip_reason")
                .eq("goal_id", goal_id)
                .gte("check_in_date", week_ago)
                .order("check_in_date", desc=True)
                .limit(7)
                .execute()
            )

            if checkins_result.data:
                lines.append("\n**Recent Check-ins (Last 7 days):**")
                for ci in checkins_result.data[:5]:
                    date_str = ci["check_in_date"]
                    # V2: Use status field instead of completed
                    ci_status = ci.get("status", "pending")
                    if ci_status == "completed":
                        status = "✓ Completed"
                    elif ci_status == "skipped":
                        status = "⏭ Skipped"
                    elif ci_status == "rest_day":
                        status = "💤 Rest Day"
                    elif ci_status == "missed":
                        status = "✗ Missed"
                    else:
                        status = "○ Pending"

                    mood = ci.get("mood")
                    mood_str = f" (mood: {mood})" if mood else ""
                    lines.append(f"- {date_str}: {status}{mood_str}")

                    note = ci.get("note")
                    if note:
                        lines.append(f'  Note: "{note[:100]}"')

            return "\n".join(lines)

        except Exception as e:
            logger.warning(f"Failed to get goal focus context: {e}")
            return ""

    async def _build_messages(
        self,
        conversation: Dict[str, Any],
        new_message: str,
        user_context: Dict[str, Any],
        language: str = "en",
        goal_focus_context: str = "",
    ) -> List[Dict[str, str]]:
        """Build messages array for OpenAI API."""

        # Build system prompt with context injection
        context_string = self._build_context_string(user_context)
        system_prompt = AI_COACH_SYSTEM_PROMPT.replace(
            "{context_injection_point}", context_string
        ).replace("{goal_focus_context}", goal_focus_context)

        # Add language instruction if not English
        if language != "en":
            language_instruction = f"\n\nIMPORTANT: Respond in {self._get_language_name(language)}. The user prefers communication in this language."
            system_prompt += language_instruction

        messages = [{"role": "system", "content": system_prompt}]

        # Add conversation history (limited)
        history = conversation.get("messages", [])
        if history:
            # Keep last N messages for context
            recent_history = history[-self.MAX_CONVERSATION_MESSAGES :]
            for msg in recent_history:
                messages.append(
                    {
                        "role": msg.get("role", "user"),
                        "content": msg.get("content", ""),
                    }
                )

        # Add new user message
        messages.append({"role": "user", "content": new_message})

        return messages

    def _get_language_name(self, language_code: str) -> str:
        """Convert ISO 639-1 language code to full language name."""
        language_names = {
            "en": "English",
            "es": "Spanish",
            "fr": "French",
            "de": "German",
            "pt": "Portuguese",
            "it": "Italian",
            "ja": "Japanese",
            "ko": "Korean",
            "zh": "Chinese",
            "ar": "Arabic",
            "hi": "Hindi",
            "ru": "Russian",
        }
        return language_names.get(language_code, "English")

    async def _save_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        status: str = "completed",
    ) -> None:
        """Append message to conversation."""
        try:
            # Get current conversation (retry handled by ResilientSupabaseClient)
            result = (
                self.supabase.table("ai_coach_conversations")
                .select("messages, message_count, title")
                .eq("id", conversation_id)
                .single()
                .execute()
            )

            if not result.data:
                return

            messages = result.data.get("messages", [])
            if isinstance(messages, str):
                messages = json.loads(messages)

            # Append new message with status (used by realtime to trigger UI updates)
            messages.append(
                {
                    "role": role,
                    "content": content,
                    "status": status,
                    "created_at": datetime.utcnow().isoformat(),
                }
            )

            # Trim if too long
            if len(messages) > 100:
                messages = messages[-100:]

            # Build update data
            update_data = {
                "messages": json.dumps(messages),
                "message_count": result.data.get("message_count", 0) + 1,
                "last_message_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }

            # Update conversation (retry handled by ResilientSupabaseClient)
            self.supabase.table("ai_coach_conversations").update(update_data).eq(
                "id", conversation_id
            ).execute()

        except Exception as e:
            logger.error(f"Save message error: {e}")

    async def _update_conversation_title(
        self,
        conversation_id: str,
        user_message: str,
        assistant_response: str,
    ) -> None:
        """
        Generate and update conversation title using AI.
        Only updates if conversation doesn't have a title yet.
        """
        try:
            # Check if conversation already has a title
            result = (
                self.supabase.table("ai_coach_conversations")
                .select("title")
                .eq("id", conversation_id)
                .single()
                .execute()
            )

            if result.data and result.data.get("title"):
                # Already has a title, skip
                return

            # Generate AI title
            title = await self._generate_ai_title(user_message, assistant_response)

            # Update conversation with new title
            self.supabase.table("ai_coach_conversations").update(
                {"title": title, "updated_at": datetime.utcnow().isoformat()}
            ).eq("id", conversation_id).execute()

            logger.debug(f"Generated AI title for conversation: {title}")

        except Exception as e:
            logger.warning(f"Failed to update conversation title: {e}")

    async def _generate_ai_title(
        self, user_message: str, assistant_response: str
    ) -> str:
        """
        Generate a smart, descriptive title using AI.
        Similar to how ChatGPT generates conversation titles.

        Args:
            user_message: The user's first message
            assistant_response: The AI's response

        Returns:
            A short, descriptive title (max 50 chars)
        """
        try:
            prompt = f"""Generate a very short title (max 5 words) for this fitness/wellness conversation.
The title should capture the main topic or goal discussed.

User: {user_message[:500]}
Assistant: {assistant_response[:500]}

Rules:
- Maximum 5 words
- No quotes or punctuation at the end
- Be specific and descriptive
- Examples: "Weight Loss Motivation", "Morning Workout Routine", "Healthy Meal Ideas", "Sleep Schedule Help"

Title:"""

            response = await asyncio.wait_for(
                self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=20,
                    temperature=0.3,
                ),
                timeout=5.0,  # Quick timeout - title is not critical
            )

            title = response.choices[0].message.content.strip()
            # Clean up any quotes or trailing punctuation
            title = title.strip("\"'").rstrip(".")
            # Limit length
            if len(title) > 50:
                title = title[:47] + "..."

            return title if title else "New conversation"

        except asyncio.TimeoutError:
            logger.warning("AI title generation timed out, using fallback")
            return self._generate_fallback_title(user_message)
        except Exception as e:
            logger.warning(f"AI title generation failed: {e}, using fallback")
            return self._generate_fallback_title(user_message)

    def _generate_fallback_title(self, message: str, max_length: int = 40) -> str:
        """
        Fallback title generation - takes first sentence or truncates.
        Used when AI title generation fails.
        """
        clean = message.strip()

        # Try to get first sentence
        for delimiter in [".", "?", "!"]:
            if delimiter in clean:
                first_sentence = clean.split(delimiter)[0].strip()
                if len(first_sentence) > 5:
                    clean = first_sentence
                    break

        # Truncate if too long
        if len(clean) > max_length:
            truncate_at = clean.rfind(" ", 0, max_length - 3)
            if truncate_at == -1:
                truncate_at = max_length - 3
            clean = clean[:truncate_at].rstrip() + "..."

        return clean if clean else "New conversation"

    async def _update_daily_usage(self, user_id: str, tokens: int) -> None:
        """Update daily usage tracking."""
        try:
            today = date.today().isoformat()

            # Try to update existing record
            result = (
                self.supabase.table("ai_coach_daily_usage")
                .select("id, message_count, tokens_used")
                .eq("user_id", user_id)
                .eq("usage_date", today)
                .execute()
            )

            if result.data and len(result.data) > 0:
                record = result.data[0]
                self.supabase.table("ai_coach_daily_usage").update(
                    {
                        "message_count": record.get("message_count", 0) + 1,
                        "tokens_used": record.get("tokens_used", 0) + tokens,
                        "updated_at": datetime.utcnow().isoformat(),
                    }
                ).eq("id", record["id"]).execute()
            else:
                # Create new record
                self.supabase.table("ai_coach_daily_usage").insert(
                    {
                        "user_id": user_id,
                        "usage_date": today,
                        "message_count": 1,
                        "tokens_used": tokens,
                    }
                ).execute()

        except Exception as e:
            logger.warning(f"Update daily usage error: {e}")


# Singleton instance
_ai_coach_service: Optional[AICoachService] = None


def get_ai_coach_service() -> AICoachService:
    """Get singleton AI Coach service instance."""
    global _ai_coach_service
    if _ai_coach_service is None:
        _ai_coach_service = AICoachService()
    return _ai_coach_service
