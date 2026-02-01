"""
AI Coach Tasks

Celery tasks for background AI coach message processing.
Allows users to send a message and leave - response is processed in background.
Supports streaming: partial content pushed to DB for realtime delivery.
"""

import json
import time
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from app.services.tasks.base import celery_app, get_supabase_client, logger
from app.core.config import settings
from app.core.cache import get_redis_client


def _user_today_iso(user_timezone: Optional[str]) -> str:
    """Today's date (YYYY-MM-DD) in user's timezone. Falls back to UTC on error."""
    try:
        import pytz

        tz = pytz.timezone(user_timezone or "UTC")
        return datetime.now(tz).date().isoformat()
    except Exception:
        return datetime.utcnow().date().isoformat()


def _current_week_monday_iso(today_iso: str) -> str:
    """Monday of the week containing today_iso (YYYY-MM-DD)."""
    try:
        d = datetime.strptime(today_iso, "%Y-%m-%d").date()
        monday = d - timedelta(days=d.weekday())  # Monday = 0
        return monday.isoformat()
    except (ValueError, TypeError):
        return today_iso


def _is_today_checkins_intent(user_message: str) -> bool:
    """Heuristic: user asks about today's check-ins."""
    t = (user_message or "").lower()
    if "today" not in t:
        return False
    keywords = [
        "check in",
        "checkin",
        "check-in",
        "checked in",
        "check ins",
        "checkins",
    ]
    return any(k in t for k in keywords)


def _acquire_conversation_lock(
    conversation_id: str, request_id: str, ttl_seconds: int = 180
) -> bool:
    """
    Per-conversation lock to ensure sequential processing within a thread,
    while allowing different conversations to process concurrently.
    """
    try:
        redis = get_redis_client()
        if not redis or not hasattr(redis, "set"):
            return True  # No redis available; fail open.
        key = f"ai_coach:conversation:{conversation_id}"
        # nx=True: only set if not exists; ex: auto-expire safety
        acquired = redis.set(key, request_id, nx=True, ex=ttl_seconds)
        return bool(acquired)
    except Exception as e:
        logger.warning(f"[AI Coach Task] Failed to acquire conversation lock: {e}")
        return True  # Fail open to avoid blocking production if Redis is flaky.


def _release_conversation_lock(conversation_id: str, request_id: str) -> None:
    """Release lock only if still owned by this request_id."""
    try:
        redis = get_redis_client()
        if not redis or not hasattr(redis, "eval"):
            return
        key = f"ai_coach:conversation:{conversation_id}"
        lua = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
        """
        redis.eval(lua, 1, key, request_id)
    except Exception as e:
        logger.warning(f"[AI Coach Task] Failed to release conversation lock: {e}")


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


def _safe_json_dumps(obj: Any) -> str:
    """JSON-serialize tool results; handle datetime, UUID, etc. via default=str."""
    try:
        return json.dumps(obj, default=str)
    except Exception as e:
        logger.warning(f"[AI Coach Task] Tool result JSON serialization failed: {e}")
        return json.dumps(
            {"success": False, "error": "Serialization failed", "raw": str(obj)}
        )


def _update_conversation_messages(
    supabase,
    conversation_id: str,
    messages: List[Dict[str, Any]],
) -> None:
    """Update conversation with current messages (partial or final)."""
    supabase.table("ai_coach_conversations").update(
        {
            "messages": json.dumps(messages),
            "updated_at": datetime.utcnow().isoformat(),
            "last_message_at": datetime.utcnow().isoformat(),
        }
    ).eq("id", conversation_id).execute()


def _merge_and_write_messages(
    supabase,
    conversation_id: str,
    full_response: str,
    request_id: Optional[str],
    assistant_message_id: Optional[str],
    user_message_id: Optional[str],
    fallback_messages: Optional[List[Dict[str, Any]]] = None
) -> None:
    """
    Re-fetch conversation, merge our assistant response into fresh data, then write.
    Prevents race where concurrent tasks overwrite each other's messages.
    """
    conv_result = (
        supabase.table("ai_coach_conversations")
        .select("messages")
        .eq("id", conversation_id)
        .single()
        .execute()
    )
    if not conv_result.data:
        if fallback_messages:
            supabase.table("ai_coach_conversations").update(
                {
                    "messages": json.dumps(fallback_messages),
                    "message_count": len(fallback_messages),
                    "last_message_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).eq("id", conversation_id).execute()
        else:
            logger.warning("[AI Coach Task] Re-fetch before merge failed, skipping write")
        return

    fresh = conv_result.data.get("messages", [])
    if isinstance(fresh, str):
        fresh = json.loads(fresh) if fresh else []

    now_iso = datetime.utcnow().isoformat()

    # Use fresh as base; add/update our assistant (and user status) so we never overwrite.
    merged = list(fresh)

    # Find our assistant in merged; update if found
    assistant_found = False
    for i, msg in enumerate(merged):
        if msg.get("role") != "assistant":
            continue
        if (request_id and msg.get("request_id") == request_id) or (
            assistant_message_id and msg.get("message_id") == assistant_message_id
        ):
            merged[i] = {**msg, "content": full_response, "status": "completed"}
            merged[i].setdefault("created_at", now_iso)
            assistant_found = True
            break

    if not assistant_found:
        # Our assistant not in DB; insert after our user message to preserve order
        our_assistant = {
            "role": "assistant",
            "content": full_response,
            "status": "completed",
            "created_at": now_iso,
            "request_id": request_id,
            "message_id": assistant_message_id,
        }
        insert_at = len(merged)
        for i, msg in enumerate(merged):
            if msg.get("role") != "user":
                continue
            if (user_message_id and msg.get("message_id") == user_message_id) or (
                request_id and msg.get("request_id") == request_id
            ):
                insert_at = i + 1
                break
        merged.insert(insert_at, our_assistant)

    # Mark our user message completed
    for i, msg in enumerate(merged):
        if msg.get("role") != "user":
            continue
        if (user_message_id and msg.get("message_id") == user_message_id) or (
            request_id and msg.get("request_id") == request_id
        ):
            merged[i] = {**msg, "status": "completed"}
            break

    supabase.table("ai_coach_conversations").update(
        {
            "messages": json.dumps(merged),
            "message_count": len(merged),
            "last_message_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
    ).eq("id", conversation_id).execute()


def _find_or_create_assistant_message(
    messages: List[Dict[str, Any]],
    assistant_message_id: Optional[str],
    request_id: Optional[str],
    now_iso: str,
) -> int:
    """Find assistant message index (most recent match) or append one. Returns index."""
    # Search from end (most recent) to find current turn's assistant placeholder
    for i in range(len(messages) - 1, -1, -1):
        msg = messages[i]
        if msg.get("role") == "assistant":
            if assistant_message_id and msg.get("message_id") == assistant_message_id:
                return i
            if request_id and msg.get("request_id") == request_id:
                return i
    logger.warning(
        "[AI Coach Task] No matching assistant placeholder found, appending one"
    )
    messages.append(
        {
            "role": "assistant",
            "content": "",
            "status": "generating",
            "created_at": now_iso,
            "request_id": request_id,
            "message_id": assistant_message_id,
        }
    )
    return len(messages) - 1


def _stream_first_completion(
    client,
    messages: List[Dict[str, Any]],
    supabase,
    conversation_id: str,
    messages_list: List[Dict[str, Any]],
    assistant_message_id: Optional[str],
    request_id: Optional[str],
) -> Dict[str, Any]:
    """
    Stream first OpenAI completion. Handles both content-only and tool_calls.
    Returns dict with:
    - has_tool_calls: bool
    - content: str (when no tool calls)
    - tokens_used: int
    - follow_up_messages: list (when has_tool_calls, for second completion)
    - tool_calls_list: list (when has_tool_calls)
    """
    from app.services.ai_coach_tools import TOOL_DEFINITIONS

    now_iso = datetime.utcnow().isoformat()
    idx = _find_or_create_assistant_message(
        messages_list, assistant_message_id, request_id, now_iso
    )
    accumulated = ""
    tokens_used = 0
    last_update_at = 0.0
    min_update_interval = 0.25
    min_chunk_chars = 25

    # Tool calls buffer: index -> {id, name, arguments}
    tool_calls_buf: Dict[int, Dict[str, Any]] = {}
    finish_reason = None

    try:
        stream = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.3,
            max_tokens=1000,
            tools=TOOL_DEFINITIONS,
            tool_choice="auto",
            stream=True,
        )
        for chunk in stream:
            # Usage is on chunk, not on choice (OpenAI streaming API)
            chunk_usage = getattr(chunk, "usage", None)
            if chunk_usage and hasattr(chunk_usage, "total_tokens"):
                tokens_used = chunk_usage.total_tokens or 0

            if not chunk.choices:
                continue
            choice = chunk.choices[0]
            delta = getattr(choice, "delta", None) or {}
            if choice.finish_reason:
                finish_reason = choice.finish_reason

            # Content
            if getattr(delta, "content", None):
                accumulated += delta.content
                now_t = time.time()
                should_update = (
                    len(accumulated) >= min_chunk_chars
                    or (now_t - last_update_at >= min_update_interval and accumulated)
                )
                if should_update and accumulated:
                    messages_list[idx]["content"] = accumulated
                    messages_list[idx]["status"] = "generating"
                    messages_list[idx].setdefault("created_at", now_iso)
                    stream_via_redis = getattr(
                        settings, "AI_COACH_STREAM_VIA_REDIS", False
                    ) and request_id
                    if stream_via_redis:
                        from app.services.ai_coach_stream_service import publish_chunk
                        publish_chunk(request_id, accumulated)
                    else:
                        _update_conversation_messages(
                            supabase, conversation_id, messages_list
                        )
                    last_update_at = now_t

            # Tool calls (incremental)
            delta_tc = getattr(delta, "tool_calls", None) or []
            for tc in delta_tc:
                i = getattr(tc, "index", None)
                if i is None:
                    continue
                if i not in tool_calls_buf:
                    tool_calls_buf[i] = {
                        "id": getattr(tc, "id", None) or "",
                        "name": "",
                        "arguments": "",
                    }
                fn = getattr(tc, "function", None)
                if fn:
                    if getattr(fn, "name", None):
                        tool_calls_buf[i]["name"] = fn.name
                    if getattr(fn, "arguments", None):
                        tool_calls_buf[i]["arguments"] += fn.arguments

        if accumulated:
            messages_list[idx]["content"] = accumulated
            messages_list[idx]["status"] = "generating"

        has_tool_calls = finish_reason == "tool_calls" and len(tool_calls_buf) > 0

        if has_tool_calls:
            # Build tool_calls in order
            sorted_indices = sorted(tool_calls_buf.keys())
            tool_calls_list = [
                {
                    "id": tool_calls_buf[i]["id"],
                    "type": "function",
                    "function": {
                        "name": tool_calls_buf[i]["name"],
                        "arguments": tool_calls_buf[i]["arguments"],
                    },
                }
                for i in sorted_indices
            ]
            assistant_msg = {
                "role": "assistant",
                "content": accumulated or None,
                "tool_calls": tool_calls_list,
            }
            follow_up = messages + [assistant_msg]
            return {
                "has_tool_calls": True,
                "content": "",
                "tokens_used": tokens_used,
                "follow_up_messages": follow_up,
                "tool_calls_list": tool_calls_list,
            }
        return {
            "has_tool_calls": False,
            "content": accumulated,
            "tokens_used": tokens_used,
            "follow_up_messages": None,
        }
    except Exception as e:
        logger.warning(f"[AI Coach Task] First completion streaming failed: {e}")
        stream_via_redis = getattr(settings, "AI_COACH_STREAM_VIA_REDIS", False) and request_id
        if stream_via_redis:
            from app.services.ai_coach_stream_service import publish_error
            publish_error(request_id, str(e))
        elif accumulated:
            messages_list[idx]["content"] = accumulated
            messages_list[idx]["status"] = "generating"
            _update_conversation_messages(supabase, conversation_id, messages_list)
        raise


def _stream_completion_and_update_db(
    client,
    messages: List[Dict[str, Any]],
    supabase,
    conversation_id: str,
    messages_list: List[Dict[str, Any]],
    assistant_message_id: Optional[str],
    request_id: Optional[str],
) -> tuple[str, int]:
    """
    Stream OpenAI completion and push partial content to DB for realtime.
    Returns (full_response, tokens_used).
    """
    now_iso = datetime.utcnow().isoformat()
    idx = _find_or_create_assistant_message(
        messages_list, assistant_message_id, request_id, now_iso
    )
    accumulated = ""
    tokens_used = 0
    last_update_at = 0.0
    min_update_interval = 0.25  # 250ms
    min_chunk_chars = 25

    try:
        stream = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.3,
            max_tokens=1000,
            stream=True,
        )
        for chunk in stream:
            # Usage is on chunk, not on choice (OpenAI streaming API)
            chunk_usage = getattr(chunk, "usage", None)
            if chunk_usage and hasattr(chunk_usage, "total_tokens"):
                tokens_used = chunk_usage.total_tokens or 0

            if chunk.choices and chunk.choices[0].delta:
                delta = chunk.choices[0].delta
                if delta.content:
                    accumulated += delta.content

            now = time.time()
            should_update = (
                len(accumulated) >= min_chunk_chars
                or (now - last_update_at >= min_update_interval and accumulated)
            )
            if should_update and accumulated:
                messages_list[idx]["content"] = accumulated
                messages_list[idx]["status"] = "generating"
                messages_list[idx].setdefault("created_at", now_iso)
                stream_via_redis = getattr(
                    settings, "AI_COACH_STREAM_VIA_REDIS", False
                ) and request_id
                if stream_via_redis:
                    from app.services.ai_coach_stream_service import publish_chunk
                    publish_chunk(request_id, accumulated)
                else:
                    _update_conversation_messages(
                        supabase, conversation_id, messages_list
                    )
                last_update_at = now

        if accumulated:
            messages_list[idx]["content"] = accumulated
            messages_list[idx]["status"] = "generating"
        return accumulated, tokens_used
    except Exception as e:
        logger.warning(f"[AI Coach Task] Streaming failed: {e}")
        stream_via_redis = getattr(settings, "AI_COACH_STREAM_VIA_REDIS", False) and request_id
        if stream_via_redis:
            from app.services.ai_coach_stream_service import publish_error
            publish_error(request_id, str(e))
        elif accumulated:
            messages_list[idx]["content"] = accumulated
            messages_list[idx]["status"] = "generating"
            _update_conversation_messages(supabase, conversation_id, messages_list)
        raise


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
    request_id: Optional[str] = None,
    user_message_id: Optional[str] = None,
    assistant_message_id: Optional[str] = None,
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
        lock_request_id = request_id or f"legacy-{conversation_id}-{message_index}"
        if not _acquire_conversation_lock(
            conversation_id, lock_request_id, ttl_seconds=180
        ):
            # Another message is currently processing for this conversation. Retry later.
            raise self.retry(countdown=3)

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

        # If goal_id wasn't passed, fall back to persisted conversation.goal_id.
        if not goal_id:
            goal_id = conversation.get("goal_id")

        # Idempotency: if this request_id already has a completed assistant message, bail out.
        if request_id:
            for msg in messages:
                if (
                    msg.get("role") == "assistant"
                    and msg.get("request_id") == request_id
                    and msg.get("status") == "completed"
                    and (msg.get("content") or "")
                ):
                    logger.info(
                        "[AI Coach Task] Request already completed; skipping.",
                        {"conversation_id": conversation_id, "request_id": request_id},
                    )
                    return {
                        "success": True,
                        "conversation_id": conversation_id,
                        "response_length": len(msg.get("content") or ""),
                        "tokens_used": 0,
                        "skipped": True,
                    }

        # Get user context for personalization
        user_context = _get_user_context_sync(supabase, user_id)
        user_context["today_iso"] = _user_today_iso(user_context.get("timezone"))
        cw_monday = _current_week_monday_iso(user_context["today_iso"])
        user_context["current_week_monday_iso"] = cw_monday
        try:
            d = datetime.strptime(cw_monday, "%Y-%m-%d").date()
            user_context["last_week_monday_iso"] = (
                d - timedelta(days=7)
            ).isoformat()
        except (ValueError, TypeError):
            user_context["last_week_monday_iso"] = cw_monday

        # Goal focus vs general scope: strict instructions for off-topic handling
        goal_focus_context = ""
        if goal_id:
            goal_focus_context = _get_goal_focus_context_sync(goal_id)
        else:
            goal_focus_context = _get_general_scope_context_sync()

        # Build messages for OpenAI (minimal context; tools: get_goals, get_checkins, get_weekly_recap, etc.)
        openai_messages = _build_openai_messages(
            conversation=conversation,
            user_context=user_context,
            language=language,
            goal_focus_context=goal_focus_context,
        )

        # Import tools
        from app.services.ai_coach_tools import TOOL_DEFINITIONS, ToolExecutor

        # If user asks about "today" check-ins, prefetch deterministically (timezone-safe).
        # This avoids the model guessing or using the wrong "today" (UTC vs user timezone).
        try:
            if _is_today_checkins_intent(message):
                tool_executor_prefetch = ToolExecutor(user_id, supabase)
                today_iso = user_context.get("today_iso")
                args: Dict[str, Any] = {"from_date": today_iso, "to_date": today_iso}
                if goal_id:
                    args["goal_id"] = goal_id
                prefetch = _run_async(
                    tool_executor_prefetch.execute("get_checkins", args)
                )
                openai_messages.insert(
                    1,
                    {
                        "role": "system",
                        "content": "\n".join(
                            [
                                "## VERIFIED DATA (do not guess)",
                                f"- Today (user timezone): {today_iso}",
                                f"- Goal-scoped: {bool(goal_id)}",
                                "",
                                "get_checkins(today) result:",
                                _safe_json_dumps(prefetch),
                                "",
                                "Use this tool result. Do NOT claim 'no check-in' unless the data above is empty and success=true.",
                            ]
                        ),
                    },
                )
        except Exception as _prefetch_error:
            logger.warning(
                f"[AI Coach Task] Prefetch today checkins failed: {_prefetch_error}"
            )

        # Call OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        streaming_enabled = getattr(
            settings, "AI_COACH_STREAMING_ENABLED", True
        )

        if streaming_enabled:
            # Stream first completion (works for both content-only and tool_calls)
            result = _stream_first_completion(
                client=client,
                messages=openai_messages,
                supabase=supabase,
                conversation_id=conversation_id,
                messages_list=messages,
                assistant_message_id=assistant_message_id,
                request_id=request_id,
            )
            if result["has_tool_calls"]:
                # Execute tools, then stream second completion
                tool_executor = ToolExecutor(user_id, supabase)
                follow_up = list(result["follow_up_messages"])
                for tc in result["tool_calls_list"]:
                    tool_name = tc["function"]["name"]
                    try:
                        tool_args = json.loads(tc["function"]["arguments"])
                    except json.JSONDecodeError:
                        tool_args = {}
                    exec_result = _run_async(
                        tool_executor.execute(tool_name, tool_args)
                    )
                    follow_up.append(
                        {
                            "role": "tool",
                            "tool_call_id": tc["id"],
                            "content": _safe_json_dumps(exec_result),
                        }
                    )
                full_response, tokens_used = _stream_completion_and_update_db(
                    client=client,
                    messages=follow_up,
                    supabase=supabase,
                    conversation_id=conversation_id,
                    messages_list=messages,
                    assistant_message_id=assistant_message_id,
                    request_id=request_id,
                )
                tokens_used += result.get("tokens_used", 0)
            else:
                full_response = result["content"]
                tokens_used = result.get("tokens_used", 0)
        else:
            # Non-streaming path (legacy)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=openai_messages,
                temperature=0.3,
                max_tokens=1000,
                tools=TOOL_DEFINITIONS,
                tool_choice="auto",
            )
            assistant_message = response.choices[0].message
            full_response = assistant_message.content or ""
            tokens_used = response.usage.total_tokens if response.usage else 0

            if assistant_message.tool_calls:
                # Fall through to tool execution (non-streaming)
                pass
            else:
                assistant_message = None  # Skip tool block

        # Handle tool calls if any (non-streaming path only)
        if not streaming_enabled and assistant_message and assistant_message.tool_calls:
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
                        "content": _safe_json_dumps(tr["result"]),
                    }
                )

            # Get final response (non-streaming path)
            follow_up_response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=follow_up_messages,
                temperature=0.3,
                max_tokens=1000,
            )
            full_response = (
                follow_up_response.choices[0].message.content or ""
            )
            tokens_used = 0
            if follow_up_response.usage:
                tokens_used = follow_up_response.usage.total_tokens

        # Update statuses + fill the assistant placeholder (idempotent).
        now_iso = datetime.utcnow().isoformat()

        # 1) Mark the correct user message completed
        user_updated = False
        if user_message_id:
            for i, msg in enumerate(messages):
                if (
                    msg.get("role") == "user"
                    and msg.get("message_id") == user_message_id
                ):
                    messages[i]["status"] = "completed"
                    user_updated = True
                    break
        if not user_updated and request_id:
            for i, msg in enumerate(messages):
                if msg.get("role") == "user" and msg.get("request_id") == request_id:
                    messages[i]["status"] = "completed"
                    user_updated = True
                    break
        if not user_updated:
            # Legacy fallback: first pending user message
            for i, msg in enumerate(messages):
                if msg.get("status") == "pending" and msg.get("role") == "user":
                    messages[i]["status"] = "completed"
                    break

        # 2) Update assistant placeholder (preferred) or create if missing
        assistant_updated = False
        if assistant_message_id:
            for i, msg in enumerate(messages):
                if (
                    msg.get("role") == "assistant"
                    and msg.get("message_id") == assistant_message_id
                ):
                    messages[i]["content"] = full_response
                    messages[i]["status"] = "completed"
                    messages[i].setdefault("created_at", now_iso)
                    assistant_updated = True
                    break
        if not assistant_updated and request_id:
            for i, msg in enumerate(messages):
                if (
                    msg.get("role") == "assistant"
                    and msg.get("request_id") == request_id
                ):
                    messages[i]["content"] = full_response
                    messages[i]["status"] = "completed"
                    messages[i].setdefault("created_at", now_iso)
                    assistant_updated = True
                    break
        if not assistant_updated:
            messages.append(
                {
                    "role": "assistant",
                    "content": full_response,
                    "status": "completed",
                    "created_at": now_iso,
                    "request_id": request_id,
                    "message_id": assistant_message_id,
                }
            )

        # Publish done to Redis when streaming via Redis (for SSE clients)
        if getattr(settings, "AI_COACH_STREAM_VIA_REDIS", False) and request_id:
            from app.services.ai_coach_stream_service import publish_done
            publish_done(request_id, full_response)

        # Re-fetch, merge our updates into fresh data, then write (prevents race overwrites)
        _merge_and_write_messages(
            supabase=supabase,
            conversation_id=conversation_id,
            full_response=full_response,
            request_id=request_id,
            assistant_message_id=assistant_message_id,
            user_message_id=user_message_id,
            fallback_messages=messages,
        )

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

        # Notify SSE clients when Redis streaming enabled
        if getattr(settings, "AI_COACH_STREAM_VIA_REDIS", False) and request_id:
            try:
                from app.services.ai_coach_stream_service import publish_error
                publish_error(request_id, str(e))
            except Exception:
                pass

        # Mark the message/placeholder as failed
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

                # User message: mark COMPLETED (user successfully sent it - failure is AI-side only)
                if user_message_id:
                    for i, msg in enumerate(messages):
                        if (
                            msg.get("role") == "user"
                            and msg.get("message_id") == user_message_id
                        ):
                            messages[i]["status"] = "completed"
                            break
                elif request_id:
                    for i, msg in enumerate(messages):
                        if (
                            msg.get("role") == "user"
                            and msg.get("request_id") == request_id
                        ):
                            messages[i]["status"] = "completed"
                            break
                else:
                    for i, msg in enumerate(messages):
                        if msg.get("status") == "pending" and msg.get("role") == "user":
                            messages[i]["status"] = "completed"
                            break

                # Assistant placeholder: mark FAILED (AI failed to respond)
                if assistant_message_id:
                    for i, msg in enumerate(messages):
                        if (
                            msg.get("role") == "assistant"
                            and msg.get("message_id") == assistant_message_id
                        ):
                            messages[i]["status"] = "failed"
                            messages[i]["content"] = msg.get("content") or ""
                            break
                elif request_id:
                    for i, msg in enumerate(messages):
                        if (
                            msg.get("role") == "assistant"
                            and msg.get("request_id") == request_id
                        ):
                            messages[i]["status"] = "failed"
                            messages[i]["content"] = msg.get("content") or ""
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

    finally:
        # Release lock if we acquired it
        try:
            lock_request_id = request_id or f"legacy-{conversation_id}-{message_index}"
            _release_conversation_lock(conversation_id, lock_request_id)
        except Exception:
            pass


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
        "timezone": "UTC",
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
            context["timezone"] = ai_context.get("timezone") or "UTC"

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
            .select("name, motivation_style, timezone")
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
            context["timezone"] = user_result.data.get("timezone") or "UTC"

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


def _get_general_scope_context_sync() -> str:
    """General conversation scope: only discuss user's goals; strict off-topic redirect."""
    return """
## 🌐 GENERAL CONVERSATION (User opened chat from home — all goals)

**CRITICAL:** You may discuss **any** of the user's goals. Use get_goals() to see them when needed.

**COURTESY:** Always respond to greetings (hi, hello, hey, thanks, etc.) with a warm reply. Never reject greetings as off-topic.

**OFF-TOPIC (STRICT):** If the user asks something that does **NOT** relate to any of their goals (other than greetings) → respond: "I can't help with that because it's outside the scope of **your goals**. Let's get back to **your goals**." Do **NOT** engage (e.g. "while I'm here to support your fitness goals, X is valuable too") — **strictly redirect**.
"""


def _get_goal_focus_context_sync(goal_id: str) -> str:
    """Strict goal-focus instructions + goal_id. Details via tools (get_goals, get_goal_stats, get_checkins, get_weekly_recap)."""
    return f"""
## 🎯 STRICT: FOCUSED GOAL ONLY (User opened chat from this goal)

**CRITICAL:** This conversation is locked to ONE goal. You MUST:
- ONLY discuss, reference, or summarize **this goal**. Do NOT mention any other goal.
- If the user asks "how am I doing overall" or "how am I doing on my goal", interpret it as **this goal only**. Give a progress overview for **this goal alone**.
- Ignore all other goals in any context. Do not list multiple goals, compare goals, or give cross-goal summaries.
- Focus for next week, suggestions, and next steps must ONLY reference **this goal**. Never suggest actions for other goals (e.g. "complete one more workout" when this goal is language learning).

**COURTESY:** Always respond to greetings (hi, hello, hey, thanks, etc.) with a warm reply. Never reject greetings as off-topic.

**OFF-TOPIC (STRICT):** If the user asks something **unrelated** to this goal (other than greetings) → respond: "I can't help with that because it's outside the scope of **[goal title]**. Let's get back to **[goal title]**." Use the goal title from get_goals(goal_id). Do **NOT** engage (e.g. "while I'm here to support your fitness goals, X is valuable too") — **strictly redirect**.

**Focused goal_id:** `{goal_id}`

Use tools when you need details:
- **get_goals(goal_id)** – goal info (title, schedule, streaks, etc.)
- **get_goal_stats(goal_id)** – completion rates, best/worst days
- **get_checkins(goal_id=..., from_date, to_date, include_voice_transcripts)** – check-ins, notes, voice
- **get_weekly_recap(goal_id=...)** – weekly recap for this goal
"""


def _build_openai_messages(
    conversation: Dict[str, Any],
    user_context: Dict[str, Any],
    language: str = "en",
    goal_focus_context: str = "",
) -> list:
    """Build messages for OpenAI. Minimal context (name, plan, motivation). Use tools for goals, check-ins, recaps, etc."""
    from app.services.ai_coach_service import AI_COACH_SYSTEM_PROMPT

    lines = [
        "## USER CONTEXT",
        f"- Name: {user_context.get('user_name', 'there')}",
        f"- Plan: {user_context.get('user_plan', 'free').title()}",
        f"- Motivation Style: {user_context.get('motivation_style', 'supportive').replace('_', ' ').title()}",
        f"- Timezone: {user_context.get('timezone', 'UTC')}",
        f"- Today (user timezone): {user_context.get('today_iso', '')}",
        f"- Current week Monday: {user_context.get('current_week_monday_iso', '')}",
        f"- Last week Monday (for fallback recap): {user_context.get('last_week_monday_iso', '')}",
        "",
        "Use tools when you need goals, check-ins, patterns, weekly recaps, or goal stats:",
        "get_goals, get_pattern_insights, get_goal_stats, get_checkins, get_weekly_recap.",
    ]
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
        role = msg.get("role")
        status = msg.get("status")
        content = msg.get("content", "") or ""

        # Always include user messages (even pending) so the current question is present.
        if role == "user":
            messages.append({"role": "user", "content": content})
            continue

        # Only include assistant messages that are actually completed (skip generating placeholders).
        if role == "assistant" and status == "completed" and content.strip():
            messages.append({"role": "assistant", "content": content})

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
