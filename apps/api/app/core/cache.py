import redis
from typing import Any, Optional

from app.core.config import settings


class DummyRedis:
    """No-op redis client used when Redis is unavailable."""

    def get(self, *args: Any, **kwargs: Any) -> Optional[str]:
        return None

    def setex(self, *args: Any, **kwargs: Any) -> None:
        return None

    def incr(self, *args: Any, **kwargs: Any) -> int:
        return 1

    def delete(self, *args: Any, **kwargs: Any) -> None:
        return None

    def lpush(self, *args: Any, **kwargs: Any) -> None:
        return None

    def ltrim(self, *args: Any, **kwargs: Any) -> None:
        return None

    def exists(self, *args: Any, **kwargs: Any) -> int:
        return 0

    def sadd(self, *args: Any, **kwargs: Any) -> None:
        return None

    def expire(self, *args: Any, **kwargs: Any) -> None:
        return None

    def smembers(self, *args: Any, **kwargs: Any):
        return set()

    def srem(self, *args: Any, **kwargs: Any) -> None:
        return None

    def ping(self, *args: Any, **kwargs: Any) -> None:
        return None


_redis_client: Optional[redis.Redis] = None


def get_redis_client() -> Optional[redis.Redis]:
    """
    Lazily initialize and return a shared Redis client. Falls back to a no-op
    dummy instance when Redis is unavailable so callers can continue gracefully.
    """

    global _redis_client

    if _redis_client is not None:
        return _redis_client

    redis_url = settings.redis_connection_url
    if not redis_url:
        return None

    try:
        client = redis.from_url(redis_url)
        client.ping()
        _redis_client = client  # type: ignore[assignment]
    except Exception as exc:
        print(
            f"⚠️ Redis connection failed ({exc}). "
            "Falling back to in-memory dummy client."
        )
        _redis_client = DummyRedis()  # type: ignore[assignment]

    return _redis_client
