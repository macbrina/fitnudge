"""
FitNudge V2 - AI Coach Chat Service

Provides personalized AI coaching via async (Celery) processing only.
Features:
- Queue message → Celery task calls OpenAI; user sees message immediately, response via realtime
- Context-aware coaching (goals, progress, history) handled in task via tools
- Token tracking and rate limiting
- Conversation memory; function calling in task (create goals, get suggestions)

Following SCALABILITY.md: batch context, rate limits, O(1) where possible.
"""

import json
import uuid
from datetime import date, datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from app.core.database import get_supabase_client
from app.services.logger import logger

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
2. **Be Specific**: Reference their actual goals, streaks, and patterns (use tools to fetch when needed)
3. **Be Actionable**: End with a clear next step or question
4. **Use Formatting**: **bold** for emphasis, bullet points for lists
5. **Personalize**: Match their motivation_style preference
6. **Stay Focused**: Only discuss what's relevant to their accountability journey
7. **Be Confident**: You have full conversation history. NEVER say "I lost context" - just ask clarifying questions naturally.

## SCOPE & OFF-TOPIC (STRICT)
You ONLY help with the user's **goals** in FitNudge (habit check-ins, streaks, motivation, patterns, accountability). You must **never** engage with unrelated topics.

### COURTESY: Always respond to greetings
- **Greetings** (hi, hello, hey, good morning, thanks, thank you, etc.) are basic courtesy. **Always** respond with a warm, friendly reply (e.g. "Hi! How can I help you today?"). Never reject greetings as off-topic—this applies even in goal-focused conversations.

### Goal-specific conversation (Focused goal_id present)
- If the user asks something **unrelated** to that goal (other than greetings—see above) → respond **exactly** in this spirit: "I can't help with that because it's outside the scope of **[goal title]**. Let's get back to **[goal title]**." Use the actual goal title (from get_goals(goal_id) if needed). Keep it brief and warm.
- Do **NOT** say things like "while I'm here to support your fitness goals, [unrelated topic] is valuable too" or engage with the off-topic question at all. **Strictly redirect.**

### General conversation (no focused goal)
- First ask: **Does this question relate to any of their goals?** Use get_goals() to see their goals if unsure.
- **No** → "I can't help with that because it's outside the scope of **your goals**. Let's get back to **your goals**." Keep it brief and warm.
- **Yes** → Discuss the relevant goal(s) as usual.

## YOUR TOOLS
You have tools to **fetch** user data (goals, check-ins, recaps, etc.) and to **act** (create goals, check plan limits). Use them so you can give accurate, personalized advice.

### When to be GOAL-SPECIFIC
- **Goal-specific conversation**: The context includes a **Focused goal_id** (user opened chat from a specific goal). You MUST only discuss that goal. When calling tools, **always pass that goal_id** to: get_goals, get_pattern_insights, get_goal_stats, get_checkins, get_weekly_recap. Do not fetch or mention other goals.
- **General conversation**: No focused goal_id. User may have multiple goals. Use tools **without** goal_id to fetch all goals / all insights / all check-ins, or **with** goal_id only when the user clearly asks about one specific goal (e.g. "my running goal") and you've identified which one (e.g. via get_goals first).

### Tool reference

**Fetch tools (use when you need data to answer):**
- **get_goals(goal_id?, limit?)** – Active goals. Use for "what are my goals?", streaks, list. Pass goal_id only when goal-specific or user asked about one goal.
- **get_pattern_insights(goal_id?)** – Best/worst days, skip reasons, etc. Pass goal_id when goal-specific or when discussing one goal.
- **get_goal_stats(goal_id)** – Completion rates, streaks, best/worst days for **one** goal. goal_id required. Use for "how am I doing on X?".
- **get_checkins(goal_id?, from_date, to_date, include_voice_transcripts?)** – Check-ins in a date range. Use for "how was last week?", "what did I say?", mood/notes. Pass goal_id when goal-specific or when filtering to one goal. Max 30 days range; set include_voice_transcripts true when user asks about voice notes.
- **get_weekly_recap(week_start? | from_week & to_week, goal_id?)** – Weekly recap(s). Use for "how was my week?", "last week". Pass goal_id when goal-specific or to filter recap to one goal. Max 8 weeks.

**Other tools:**
- **get_feature_inventory()** – User's plan, feature limits, premium-only features. Use when user asks about capabilities, limits, or premium.
- **create_goal(...)** – Create a new goal. Use only when user **explicitly** asks to create one. Confirm title, frequency, reminder times, and "why" first.

### Tool usage guidelines
- **Fetch proactively** when the user's question needs goals, check-ins, stats, or recaps. Don't guess—call the right tool.
- **Goal-specific**: If context has a focused goal_id, always pass it to fetch tools. Never fetch or discuss other goals.
- **create_goal**: Only when user explicitly requests. Confirm details first. Don't mention "tools"—say "I've created..." or "Let me set that up."
- **FREQUENCY (create_goal)**: **daily** = every day; **weekly** = specific days (target_days). For exercise, suggest 3–5 days with rest. Always ask: "How many days per week can you realistically commit?"

### Data accuracy (goal-specific)
- **current_streak**: Always from the **goal itself** (get_goals or get_goal_stats). Never use max across goals when discussing one goal.
- **Completion rate**: For goal-specific chats, use the goal's completion_rate from goal_breakdown (or get_goal_stats), NOT the aggregated stats.completion_rate across all goals.
- **Best/Strongest day, Worst/Weakest day**: Use get_goal_stats(goal_id) – it returns best_day_index, worst_day_index (completion-rate based, same as Pattern Insights). These match what the user sees in the app.
- **get_weekly_recap with goal_id**: When the response includes goal_specific_note, summary/win/insight/focus_next_week are suppressed (they were for all goals). Use ONLY goal_breakdown and stats. Stats are overridden with goal-specific values (current_streak, completion_rate, strongest_day, weakest_day). Generate your own focus/suggestions from that goal's data. **Never suggest actions for other goals** (e.g. "one more workout" when the focused goal is language learning).

### Weekly recap / "how did I do this week"
When the user asks about their week, weekly progress, or recap:
- First try `get_weekly_recap(week_start=...)` for the relevant week. Use **Current week Monday** and **Last week Monday** from context for dates.
- If the recap returns **empty** for the requested period (current week not yet cached), combine:
  1. **Last available recap** – `get_weekly_recap(week_start=last_week_monday_iso)`. If it has data, use it to summarize what they did last week.
  2. **Current progress** – `get_checkins(from_date=current_week_monday_iso, to_date=today_iso)` (and optionally `get_goal_stats`) for how they are doing so far this week.
- Respond naturally so the user gets a useful picture: e.g. "As of last week you…" plus "So far this week you've…" or "Currently you're…". Use your judgment; don't hardcode phrases.

### MUST: Intent → tool mapping (never guess)
- If the user asks about **today's check-ins** (e.g. "Did I check in today?", "What are my check-ins today?", "How did I do today?") you MUST call:
  - `get_checkins(from_date=YYYY-MM-DD, to_date=YYYY-MM-DD, goal_id=...)`
  - Use **today in the user's timezone** (provided in context as `Today (user timezone): YYYY-MM-DD`) unless the user specifies a different date range.
  - In goal-specific chats, you MUST include the focused `goal_id`.
- If the user asks **"how am I doing" / progress / stats** for a goal, you MUST call `get_goal_stats(goal_id)` (and/or `get_weekly_recap(...)` for week-level summaries). Do not invent percentages or streaks.
- If you do not have enough data to answer, you MUST call the appropriate fetch tool. Never guess.

## SAFETY
- If user mentions serious mental health issues, express care and suggest professional help
- Encourage balanced, sustainable approaches
- Off-topic handling: **SCOPE & OFF-TOPIC** above. Never engage with unrelated topics; always redirect.

## CONVERSATION MEMORY
You have access to the conversation history. Reference previous messages to maintain context.

{context_injection_point}

{goal_focus_context}

Remember: You're their personal accountability partner who genuinely wants to see them succeed. Help them stay consistent, one check-in at a time."""


class AICoachService:
    """
    AI Coach Chat Service (async-only via Celery).

    Use queue_message() to send; Celery task processes OpenAI. User sees message
    immediately; response arrives via realtime when task completes.
    """

    # Rate limiting defaults (used only if DB lookup fails)
    DEFAULT_FREE_DAILY_MESSAGE_LIMIT = 3  # Fallback for free users
    DEFAULT_PREMIUM_DAILY_MESSAGE_LIMIT = 100  # Fallback for premium users
    MAX_CONVERSATION_MESSAGES = 20  # Keep last N messages for context
    MAX_CONTEXT_TOKENS = 4000  # Reserve tokens for context

    def __init__(self):
        self.supabase = get_supabase_client()

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
            logger.warning(
                f"Failed to get ai_coach_chat limit from DB: {e}, using defaults"
            )
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

    async def get_conversation_by_goal(
        self, user_id: str, goal_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get the persistent conversation for a goal, if it exists."""
        try:
            result = (
                self.supabase.table("ai_coach_conversations")
                .select("*")
                .eq("user_id", user_id)
                .eq("goal_id", goal_id)
                .eq("is_archived", False)
                .limit(1)
                .execute()
            )
            if result.data and len(result.data) > 0:
                conv = result.data[0]
                if isinstance(conv.get("messages"), str):
                    conv["messages"] = json.loads(conv["messages"])
                return conv
            return None
        except Exception as e:
            logger.error(f"Get conversation by goal error: {e}")
            return None

    async def get_conversation_history(
        self,
        user_id: str,
        conversation_id: Optional[str] = None,
        goal_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Optional[Dict[str, Any]]:
        """
        Get conversation history for a user with pagination support.

        When goal_id is provided and conversation_id is not, returns the
        goal-specific thread (or None if it doesn't exist yet).

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
                result = query.execute()
            elif goal_id:
                # Get goal-specific thread (at most one per user per goal)
                conv = await self.get_conversation_by_goal(user_id, goal_id)
                if not conv:
                    return None
                result = type("Result", (), {"data": [conv]})()
            else:
                # Get most recent general (non-goal) conversation only
                query = (
                    query.is_("goal_id", "null")
                    .order("last_message_at", desc=True)
                    .limit(1)
                )
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

    async def start_new_conversation(
        self, user_id: str, goal_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Start a fresh conversation. goal_id=None for general chat."""
        try:
            payload: Dict[str, Any] = {
                "user_id": user_id,
                "messages": [],
                "message_count": 0,
                "total_tokens_used": 0,
            }
            if goal_id is not None:
                payload["goal_id"] = goal_id
            result = (
                self.supabase.table("ai_coach_conversations").insert(payload).execute()
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
            conversation = await self._get_or_create_conversation(
                user_id, conversation_id, force_new=force_new, goal_id=goal_id
            )
            # Goal-scoped first message: no thread yet -> create one
            if not conversation and goal_id and not force_new:
                conversation = await self.start_new_conversation(
                    user_id, goal_id=goal_id
                )
            if not conversation:
                return {"success": False, "error": "Failed to get/create conversation"}

            conversation_id = conversation["id"]

            # Get current messages
            messages = conversation.get("messages", [])
            if isinstance(messages, str):
                messages = json.loads(messages)

            # Create a stable request_id + message_ids so UI/task can be idempotent.
            request_id = str(uuid.uuid4())
            user_message_id = str(uuid.uuid4())
            assistant_message_id = str(uuid.uuid4())

            message_index = len(messages)

            # Add user message with "pending" status (skip on retry - already exists)
            if not is_retry:
                messages.append(
                    {
                        "role": "user",
                        "content": message,
                        "status": "pending",
                        "message_id": user_message_id,
                        "request_id": request_id,
                        "created_at": datetime.utcnow().isoformat(),
                    }
                )
                # Add assistant placeholder immediately so "generating" persists across reopen.
                messages.append(
                    {
                        "role": "assistant",
                        "content": "",
                        "status": "generating",
                        "message_id": assistant_message_id,
                        "request_id": request_id,
                        "created_at": datetime.utcnow().isoformat(),
                    }
                )
            else:
                # On retry, find the last user message and update its status to pending
                # The message_index should point to this existing message
                # Also reuse request_id/message_id so retries update the same assistant placeholder.
                found_request_id: Optional[str] = None
                found_user_message_id: Optional[str] = None
                found_assistant_message_id: Optional[str] = None
                for i in range(len(messages) - 1, -1, -1):
                    if messages[i].get("role") == "user":
                        messages[i]["status"] = "pending"
                        message_index = i
                        found_request_id = messages[i].get("request_id")
                        found_user_message_id = messages[i].get("message_id")
                        break

                # Try to find the matching assistant placeholder (by request_id).
                if found_request_id:
                    for i in range(len(messages) - 1, -1, -1):
                        if (
                            messages[i].get("role") == "assistant"
                            and messages[i].get("request_id") == found_request_id
                        ):
                            found_assistant_message_id = messages[i].get("message_id")
                            # Reset placeholder state for retry
                            messages[i]["status"] = "generating"
                            messages[i]["content"] = ""
                            break

                # If we couldn't find a placeholder (legacy messages), create one now.
                request_id = found_request_id or request_id
                user_message_id = found_user_message_id or user_message_id
                assistant_message_id = (
                    found_assistant_message_id or assistant_message_id
                )
                if not found_assistant_message_id:
                    messages.append(
                        {
                            "role": "assistant",
                            "content": "",
                            "status": "generating",
                            "message_id": assistant_message_id,
                            "request_id": request_id,
                            "created_at": datetime.utcnow().isoformat(),
                        }
                    )

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
                request_id=request_id,
                user_message_id=user_message_id,
                assistant_message_id=assistant_message_id,
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
                "request_id": request_id,
                "user_message_id": user_message_id,
                "assistant_message_id": assistant_message_id,
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
        goal_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Get existing conversation or create new one.

        Args:
            user_id: User ID
            conversation_id: Optional specific conversation ID to load
            force_new: If True, always create a new conversation (goal_id=None, general chat)
            goal_id: When set, use or create goal-scoped thread. force_new ignores this.
        """
        try:
            if force_new:
                return await self.start_new_conversation(user_id, goal_id=None)

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
                    # Enforce thread purity:
                    # - If goal_id is provided, never reuse a conversation from a different goal (or general).
                    # - If goal_id is not provided (general), never reuse a goal-scoped conversation.
                    conv_goal_id = conv.get("goal_id")
                    if goal_id:
                        if conv_goal_id != goal_id:
                            # Ignore mismatched conversation_id; we'll load the goal thread below.
                            conv = None
                        else:
                            return conv
                    else:
                        if conv_goal_id is not None:
                            # Ignore goal-scoped thread when user is in general chat.
                            conv = None
                        else:
                            return conv

            if goal_id:
                conv = await self.get_conversation_by_goal(user_id, goal_id)
                if conv:
                    return conv
                # None: create on first message (caller creates via start_new_conversation)
                return None

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

            return await self.start_new_conversation(user_id, goal_id=None)

        except Exception as e:
            logger.error(f"Get/create conversation error: {e}")
            return None


# Singleton instance
_ai_coach_service: Optional[AICoachService] = None


def get_ai_coach_service() -> AICoachService:
    """Get singleton AI Coach service instance."""
    global _ai_coach_service
    if _ai_coach_service is None:
        _ai_coach_service = AICoachService()
    return _ai_coach_service
