"""
AI Coach Tasks

Celery tasks for background AI coach message processing.
Allows users to send a message and leave - response is processed in background.
"""

import json
from typing import Dict, Any, Optional
from datetime import datetime
from app.services.tasks.base import celery_app, get_supabase_client, logger
from app.core.config import settings


def _run_async(coro):
    """Helper to run async code in sync Celery task context."""
    import asyncio

    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    return loop.run_until_complete(coro)


@celery_app.task(
    name="process_ai_coach_message",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    autoretry_for=(Exception,),
    retry_backoff=True,
    time_limit=120,  # 2 minutes max (AI responses can take time)
    soft_time_limit=100,
)
def process_ai_coach_message_task(
    self,
    user_id: str,
    conversation_id: str,
    message: str,
    message_index: int,
    language: str = "en",
    goal_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Process an AI coach message in the background.

    This task:
    1. Calls OpenAI to get the AI response
    2. Saves the response to the conversation
    3. Updates the message status to "completed"

    Args:
        user_id: User ID
        conversation_id: Conversation ID
        message: The user's message text
        message_index: Index of the user message in the conversation
        language: Language code for AI response
        goal_id: Optional goal ID to focus the conversation on

    Returns:
        Dict with success status and response info
    """
    from openai import OpenAI

    supabase = get_supabase_client()

    try:
        logger.info(
            f"[AI Coach Task] Processing message for user {user_id[:8]}...",
            {"conversation_id": conversation_id, "message_index": message_index},
        )

        # Get the conversation (retry handled by ResilientSupabaseClient)
        conv_result = (
            supabase.table("ai_coach_conversations")
            .select("*")
            .eq("id", conversation_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )

        if not conv_result.data:
            raise Exception(f"Conversation {conversation_id} not found")

        conversation = conv_result.data
        messages = conversation.get("messages", [])
        if isinstance(messages, str):
            messages = json.loads(messages)

        # Get user context for personalization
        user_context = _get_user_context_sync(supabase, user_id)

        # Get goal focus context if goal_id is provided
        goal_focus_context = ""
        if goal_id:
            goal_focus_context = _get_goal_focus_context_sync(
                supabase, user_id, goal_id
            )

        # Build messages for OpenAI
        openai_messages = _build_openai_messages(
            conversation=conversation,
            user_context=user_context,
            language=language,
            goal_focus_context=goal_focus_context,
        )

        # Import tools
        from app.services.ai_coach_tools import TOOL_DEFINITIONS, ToolExecutor

        # Call OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=openai_messages,
            temperature=0.8,
            max_tokens=1000,
            tools=TOOL_DEFINITIONS,
            tool_choice="auto",
        )

        assistant_message = response.choices[0].message
        full_response = ""
        tokens_used = 0

        # Handle tool calls if any
        if assistant_message.tool_calls:
            tool_executor = ToolExecutor(user_id, supabase)
            tool_results = []

            for tool_call in assistant_message.tool_calls:
                tool_name = tool_call.function.name
                try:
                    tool_args = json.loads(tool_call.function.arguments)
                except json.JSONDecodeError:
                    tool_args = {}

                logger.info(
                    f"[AI Coach Task] Executing tool: {tool_name}",
                    {"user_id": user_id[:8], "args": tool_args},
                )

                # Execute tool (async in sync context)
                result = _run_async(tool_executor.execute(tool_name, tool_args))
                tool_results.append(
                    {
                        "tool_call_id": tool_call.id,
                        "name": tool_name,
                        "result": result,
                    }
                )

            # Build follow-up messages
            follow_up_messages = openai_messages + [
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

            for tr in tool_results:
                follow_up_messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tr["tool_call_id"],
                        "content": json.dumps(tr["result"]),
                    }
                )

            # Get final response
            follow_up_response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=follow_up_messages,
                temperature=0.8,
                max_tokens=1000,
            )

            full_response = follow_up_response.choices[0].message.content or ""
            if follow_up_response.usage:
                tokens_used = follow_up_response.usage.total_tokens
        else:
            full_response = assistant_message.content or ""
            if response.usage:
                tokens_used = response.usage.total_tokens

        # Update the user message status to "completed" and add assistant response
        # Find the pending message and update it
        for i, msg in enumerate(messages):
            if msg.get("status") == "pending" and msg.get("role") == "user":
                messages[i]["status"] = "completed"
                break

        # Add assistant message with status "completed" (triggers realtime UI update)
        messages.append(
            {
                "role": "assistant",
                "content": full_response,
                "status": "completed",
                "created_at": datetime.utcnow().isoformat(),
            }
        )

        # Update conversation (retry handled by ResilientSupabaseClient)
        supabase.table("ai_coach_conversations").update(
            {
                "messages": json.dumps(messages),
                "message_count": len(messages),
                "last_message_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }
        ).eq("id", conversation_id).execute()

        # Generate title if needed
        if not conversation.get("title"):
            _generate_and_save_title(
                supabase, client, conversation_id, message, full_response
            )

        # Update daily usage
        _update_daily_usage_sync(supabase, user_id, tokens_used)

        logger.info(
            f"[AI Coach Task] Successfully processed message for user {user_id[:8]}...",
            {"conversation_id": conversation_id, "tokens_used": tokens_used},
        )

        return {
            "success": True,
            "conversation_id": conversation_id,
            "response_length": len(full_response),
            "tokens_used": tokens_used,
        }

    except Exception as e:
        logger.error(
            f"[AI Coach Task] Failed to process message for user {user_id[:8]}...: {e}",
            {"conversation_id": conversation_id, "error": str(e)},
            exc_info=True,
        )

        # Mark the message as failed
        try:
            conv_result = (
                supabase.table("ai_coach_conversations")
                .select("messages")
                .eq("id", conversation_id)
                .single()
                .execute()
            )

            if conv_result.data:
                messages = conv_result.data.get("messages", [])
                if isinstance(messages, str):
                    messages = json.loads(messages)

                for i, msg in enumerate(messages):
                    if msg.get("status") == "pending" and msg.get("role") == "user":
                        messages[i]["status"] = "failed"
                        break

                supabase.table("ai_coach_conversations").update(
                    {
                        "messages": json.dumps(messages),
                        "updated_at": datetime.utcnow().isoformat(),
                    }
                ).eq("id", conversation_id).execute()
        except Exception as update_error:
            logger.error(f"Failed to mark message as failed: {update_error}")

        raise  # Re-raise for Celery retry


def _get_user_context_sync(supabase, user_id: str) -> Dict[str, Any]:
    """
    Get user context for AI personalization (sync version, V2).
    Uses build_ai_context RPC for efficiency with fallback.
    """
    from datetime import timedelta, date

    context = {
        "user_name": "there",
        "motivation_style": "supportive",
        "user_plan": "free",
        "goals": [],
        "patterns": [],
        "recent_performance": {},
        "current_streak": 0,
        "longest_streak": 0,
    }

    try:
        # Try the optimized build_ai_context RPC first
        rpc_result = supabase.rpc("build_ai_context", {"p_user_id": user_id}).execute()

        if rpc_result.data:
            ai_context = rpc_result.data

            # Extract user info
            name = ai_context.get("user_name", "there")
            context["user_name"] = name.split()[0] if name else "there"
            context["motivation_style"] = ai_context.get(
                "motivation_style", "supportive"
            )

            # Extract goals
            goals = ai_context.get("goals", [])
            if goals:
                context["goals"] = goals
                current_streaks = [g.get("current_streak", 0) for g in goals]
                longest_streaks = [g.get("longest_streak", 0) for g in goals]
                context["current_streak"] = (
                    max(current_streaks) if current_streaks else 0
                )
                context["longest_streak"] = (
                    max(longest_streaks) if longest_streaks else 0
                )

            # Extract patterns
            context["patterns"] = ai_context.get("patterns", [])

            # Extract recent performance
            context["recent_performance"] = ai_context.get("recent_performance", {})

            # Get effective plan
            from app.core.subscriptions import get_user_effective_plan

            context["user_plan"] = get_user_effective_plan(user_id, supabase=supabase)

            logger.debug(
                f"[AI Coach Task] Context loaded via RPC for user {user_id[:8]}..."
            )
            return context

    except Exception as e:
        logger.warning(f"build_ai_context RPC failed in task, using fallback: {e}")

    # Fallback to individual queries
    try:
        # User info with motivation style
        user_result = (
            supabase.table("users")
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

        # Get effective plan
        from app.core.subscriptions import get_user_effective_plan

        context["user_plan"] = get_user_effective_plan(user_id, supabase=supabase)

        # Active goals with V2 details
        goals_result = (
            supabase.table("goals")
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

            context["current_streak"] = goals_result.data[0].get("current_streak", 0)
            context["longest_streak"] = max(
                g.get("longest_streak", 0) for g in goals_result.data
            )

        # Get AI-generated pattern insights
        patterns_result = (
            supabase.table("pattern_insights")
            .select("goal_id, insights, current_metrics")
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

    except Exception as e:
        logger.warning(f"Failed to fetch user context (fallback): {e}")

    return context


def _get_goal_focus_context_sync(supabase, user_id: str, goal_id: str) -> str:
    """Get focused context for a specific goal (sync version)."""
    from datetime import timedelta

    try:
        # Fetch the specific goal with all details
        goal_result = (
            supabase.table("goals")
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
            supabase.table("check_ins")
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


def _build_openai_messages(
    conversation: Dict[str, Any],
    user_context: Dict[str, Any],
    language: str = "en",
    goal_focus_context: str = "",
) -> list:
    """Build messages array for OpenAI API (V2) with pattern insights."""
    from app.services.ai_coach_service import AI_COACH_SYSTEM_PROMPT

    # Build context string (V2 format with patterns)
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
        for goal in goals[:5]:
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

            # Add why statement if available
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

    # Recent Performance
    recent_perf = user_context.get("recent_performance", {})
    if recent_perf:
        completion_rate = recent_perf.get("completion_rate", 0)
        total_checkins = recent_perf.get("total_checkins", 0)

        if total_checkins > 0:
            lines.append("\n## 30-DAY PERFORMANCE")
            lines.append(f"- Completion Rate: {completion_rate}%")
            lines.append(f"- Total Check-ins: {total_checkins}")

    # Best streak across all goals
    if user_context.get("longest_streak", 0) > 0:
        lines.append(f"- Longest Streak Ever: {user_context['longest_streak']} days")

    context_string = "\n".join(lines)
    system_prompt = AI_COACH_SYSTEM_PROMPT.replace(
        "{context_injection_point}", context_string
    ).replace("{goal_focus_context}", goal_focus_context)

    # Add language instruction
    if language != "en":
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
        lang_name = language_names.get(language, "English")
        system_prompt += f"\n\nIMPORTANT: Respond in {lang_name}. The user prefers communication in this language."

    messages = [{"role": "system", "content": system_prompt}]

    # Add conversation history
    history = conversation.get("messages", [])
    if isinstance(history, str):
        history = json.loads(history)

    MAX_MESSAGES = 20
    recent_history = history[-MAX_MESSAGES:]
    for msg in recent_history:
        # Include all user and assistant messages (pending or completed)
        role = msg.get("role")
        if role in ["user", "assistant"]:
            messages.append(
                {
                    "role": role,
                    "content": msg.get("content", ""),
                }
            )

    return messages


def _generate_and_save_title(
    supabase, client, conversation_id: str, user_message: str, assistant_response: str
):
    """Generate and save conversation title."""
    try:
        prompt = f"""Generate a very short title (max 5 words) for this fitness/wellness conversation.
The title should capture the main topic or goal discussed.

User: {user_message[:500]}
Assistant: {assistant_response[:500]}

Rules:
- Maximum 5 words
- No quotes or punctuation at the end
- Be specific and descriptive

Title:"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=20,
            temperature=0.3,
        )

        title = response.choices[0].message.content.strip()
        title = title.strip("\"'").rstrip(".")
        if len(title) > 50:
            title = title[:47] + "..."

        supabase.table("ai_coach_conversations").update(
            {
                "title": title,
                "updated_at": datetime.utcnow().isoformat(),
            }
        ).eq("id", conversation_id).execute()

    except Exception as e:
        logger.warning(f"Failed to generate title: {e}")


def _update_daily_usage_sync(supabase, user_id: str, tokens: int):
    """Update daily usage tracking."""
    from datetime import date

    try:
        today = date.today().isoformat()

        result = (
            supabase.table("ai_coach_daily_usage")
            .select("id, message_count, tokens_used")
            .eq("user_id", user_id)
            .eq("usage_date", today)
            .execute()
        )

        if result.data and len(result.data) > 0:
            record = result.data[0]
            supabase.table("ai_coach_daily_usage").update(
                {
                    "message_count": record.get("message_count", 0) + 1,
                    "tokens_used": record.get("tokens_used", 0) + tokens,
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).eq("id", record["id"]).execute()
        else:
            supabase.table("ai_coach_daily_usage").insert(
                {
                    "user_id": user_id,
                    "usage_date": today,
                    "message_count": 1,
                    "tokens_used": tokens,
                }
            ).execute()

    except Exception as e:
        logger.warning(f"Update daily usage error: {e}")
