"""
AI Coach Redis Stream Service

Publishes streaming chunks to Redis pub/sub for SSE delivery.
When AI_COACH_STREAM_VIA_REDIS is enabled, Celery task publishes chunks here
instead of writing to DB during streaming. Single DB write when complete.
"""

import json
from typing import Optional

from app.core.cache import get_redis_client
from app.services.logger import logger

STREAM_CHANNEL_PREFIX = "ai_coach:stream:"
DONE_KEY_PREFIX = "ai_coach:done:"
DONE_KEY_TTL_SECONDS = 60


def channel_for_request(request_id: str) -> str:
    """Return Redis channel name for a request_id."""
    return f"{STREAM_CHANNEL_PREFIX}{request_id}"


def _channel(request_id: str) -> str:
    return channel_for_request(request_id)


def _done_key(request_id: str) -> str:
    return f"{DONE_KEY_PREFIX}{request_id}"


def publish_chunk(request_id: str, content: str) -> bool:
    """Publish a streaming chunk to Redis. Returns True if published."""
    try:
        redis = get_redis_client()
        if not redis or not hasattr(redis, "publish"):
            return False
        channel = _channel(request_id)
        payload = json.dumps({"type": "chunk", "content": content})
        redis.publish(channel, payload)
        return True
    except Exception as e:
        logger.warning(f"[AI Coach Stream] Failed to publish chunk: {e}")
        return False


def publish_done(request_id: str, full_response: str) -> bool:
    """Publish done event and set short-lived key for late-connecting SSE."""
    try:
        redis = get_redis_client()
        if not redis or not hasattr(redis, "publish"):
            return False
        channel = _channel(request_id)
        payload = json.dumps({"type": "done", "content": full_response})
        redis.publish(channel, payload)
        done_key = _done_key(request_id)
        redis.set(done_key, full_response, ex=DONE_KEY_TTL_SECONDS)
        return True
    except Exception as e:
        logger.warning(f"[AI Coach Stream] Failed to publish done: {e}")
        return False


def publish_error(request_id: str, message: str) -> bool:
    """Publish error event to Redis."""
    try:
        redis = get_redis_client()
        if not redis or not hasattr(redis, "publish"):
            return False
        channel = _channel(request_id)
        payload = json.dumps({"type": "error", "message": message})
        redis.publish(channel, payload)
        return True
    except Exception as e:
        logger.warning(f"[AI Coach Stream] Failed to publish error: {e}")
        return False


def check_done(request_id: str) -> Optional[str]:
    """Check if response is already complete (for late-connecting SSE). Returns content or None."""
    try:
        redis = get_redis_client()
        if not redis or not hasattr(redis, "get"):
            return None
        done_key = _done_key(request_id)
        content = redis.get(done_key)
        return content.decode("utf-8") if isinstance(content, bytes) else content
    except Exception as e:
        logger.warning(f"[AI Coach Stream] Failed to check done: {e}")
        return None
