from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import time
import redis
from app.core.config import settings

# Redis client for rate limiting
redis_client = redis.from_url(settings.REDIS_URL)


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, calls: int = 100, period: int = 60):
        super().__init__(app)
        self.calls = calls
        self.period = period

    async def dispatch(self, request: Request, call_next):
        # Get client IP
        client_ip = request.client.host

        # Create rate limit key
        key = f"rate_limit:{client_ip}"

        # Check current count
        current = redis_client.get(key)

        if current is None:
            # First request, set counter
            redis_client.setex(key, self.period, 1)
        else:
            # Increment counter
            count = int(current)
            if count >= self.calls:
                raise HTTPException(status_code=429, detail="Rate limit exceeded")
            redis_client.incr(key)

        # Process request
        response = await call_next(request)
        return response
