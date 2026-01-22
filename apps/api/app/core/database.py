"""
Database Configuration

Supabase client for REST API access (already pooled via PostgREST).

SCALABILITY NOTES:
- Supabase REST API (PostgREST) handles connection pooling automatically
- For direct Postgres (if needed), use DATABASE_POOL_URL with Supabase's pooler
- Pooler URL format: postgresql://postgres.[ref]:[pwd]@aws-0-[region].pooler.supabase.com:6543/postgres
- Recommended: mode=transaction for short-lived connections (Celery workers)

Connection Limits (Supabase):
- Free: 60 direct connections
- Pro: 200 direct connections
- With pooler: 200+ concurrent connections per pool

The REST API approach is PREFERRED for most operations as it:
1. Handles pooling automatically
2. Respects RLS policies
3. Is optimized for high concurrency
"""

from supabase import create_client, Client
from app.core.config import settings
import asyncio
import time
import functools
from typing import TypeVar, Callable, Any
import logging

logger = logging.getLogger(__name__)

# Retry configuration
MAX_RETRIES = 3
INITIAL_RETRY_DELAY = 1  # seconds

# Transient error patterns that should trigger a retry
TRANSIENT_ERROR_PATTERNS = [
    "ssl",
    "tls",
    "bad record mac",
    "connection reset",
    "connection refused",
    "connection closed",
    "timeout",
    "temporarily unavailable",
    "service unavailable",
    "502",
    "503",
    "504",
    "network",
    "socket",
    "broken pipe",
    "eof",
]


def is_transient_error(error: Exception) -> bool:
    """Check if an error is transient and should be retried."""
    error_str = str(error).lower()
    return any(pattern in error_str for pattern in TRANSIENT_ERROR_PATTERNS)


T = TypeVar("T")


def with_retry(
    max_retries: int = MAX_RETRIES,
    initial_delay: float = INITIAL_RETRY_DELAY,
    backoff_multiplier: float = 2.0,
) -> Callable:
    """
    Decorator for retrying functions on transient errors (SSL/TLS, network, etc.)

    Usage:
        @with_retry()
        def my_database_operation():
            return supabase.table("users").select("*").execute()

        @with_retry(max_retries=5, initial_delay=2)
        async def my_async_operation():
            ...
    """

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs) -> T:
            last_error = None
            delay = initial_delay

            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_error = e
                    if not is_transient_error(e) or attempt >= max_retries:
                        raise

                    logger.warning(
                        f"[Retry] {func.__name__} failed with transient error, "
                        f"retrying in {delay}s (attempt {attempt + 1}/{max_retries + 1})",
                        extra={"error": str(e)[:200]},
                    )
                    time.sleep(delay)
                    delay *= backoff_multiplier

            raise last_error

        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs) -> T:
            last_error = None
            delay = initial_delay

            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_error = e
                    if not is_transient_error(e) or attempt >= max_retries:
                        raise

                    logger.warning(
                        f"[Retry] {func.__name__} failed with transient error, "
                        f"retrying in {delay}s (attempt {attempt + 1}/{max_retries + 1})",
                        extra={"error": str(e)[:200]},
                    )
                    await asyncio.sleep(delay)
                    delay *= backoff_multiplier

            raise last_error

        # Return appropriate wrapper based on function type
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator


def retry_on_error(
    operation: Callable[[], T],
    max_retries: int = MAX_RETRIES,
    initial_delay: float = INITIAL_RETRY_DELAY,
    operation_name: str = "database operation",
) -> T:
    """
    Execute an operation with retry logic for transient errors.

    Use this for inline retry wrapping when a decorator isn't suitable.

    Usage:
        result = retry_on_error(
            lambda: supabase.table("users").select("*").execute(),
            operation_name="fetch users"
        )
    """
    last_error = None
    delay = initial_delay

    for attempt in range(max_retries + 1):
        try:
            return operation()
        except Exception as e:
            last_error = e
            if not is_transient_error(e) or attempt >= max_retries:
                raise

            logger.warning(
                f"[Retry] {operation_name} failed with transient error, "
                f"retrying in {delay}s (attempt {attempt + 1}/{max_retries + 1})",
                extra={"error": str(e)[:200]},
            )
            time.sleep(delay)
            delay *= 2

    raise last_error


async def async_retry_on_error(
    operation: Callable[[], T],
    max_retries: int = MAX_RETRIES,
    initial_delay: float = INITIAL_RETRY_DELAY,
    operation_name: str = "database operation",
) -> T:
    """
    Execute an async operation with retry logic for transient errors.

    Usage:
        result = await async_retry_on_error(
            lambda: some_async_db_call(),
            operation_name="fetch users"
        )
    """
    last_error = None
    delay = initial_delay

    for attempt in range(max_retries + 1):
        try:
            result = operation()
            if asyncio.iscoroutine(result):
                return await result
            return result
        except Exception as e:
            last_error = e
            if not is_transient_error(e) or attempt >= max_retries:
                raise

            logger.warning(
                f"[Retry] {operation_name} failed with transient error, "
                f"retrying in {delay}s (attempt {attempt + 1}/{max_retries + 1})",
                extra={"error": str(e)[:200]},
            )
            await asyncio.sleep(delay)
            delay *= 2

    raise last_error


# =============================================================================
# RESILIENT SUPABASE CLIENT WITH AUTOMATIC RETRY
# =============================================================================


class RetryingQueryBuilder:
    """
    Wrapper around Supabase query builders that adds automatic retry
    on transient errors (SSL/TLS, network, timeouts, etc.)

    This is transparent - all methods are proxied to the underlying builder,
    but execute() gets retry logic.
    """

    def __init__(self, builder, max_retries: int = MAX_RETRIES):
        self._builder = builder
        self._max_retries = max_retries

    def __getattr__(self, name):
        """Proxy all attribute access to the underlying builder."""
        attr = getattr(self._builder, name)

        # If it's a method that returns a builder, wrap the result
        if callable(attr):

            def wrapper(*args, **kwargs):
                result = attr(*args, **kwargs)
                # If result looks like a query builder (has execute method), wrap it
                if hasattr(result, "execute"):
                    return RetryingQueryBuilder(result, self._max_retries)
                return result

            return wrapper
        return attr

    def execute(self):
        """Execute the query with automatic retry on transient errors."""
        last_error = None
        delay = INITIAL_RETRY_DELAY

        for attempt in range(self._max_retries + 1):
            try:
                return self._builder.execute()
            except Exception as e:
                last_error = e
                if not is_transient_error(e) or attempt >= self._max_retries:
                    raise

                logger.warning(
                    f"[DB Retry] Query failed with transient error, "
                    f"retrying in {delay}s (attempt {attempt + 1}/{self._max_retries + 1}): {str(e)[:100]}"
                )
                time.sleep(delay)
                delay *= 2

        raise last_error


class ResilientSupabaseClient:
    """
    A wrapper around the Supabase client that adds automatic retry
    for all database operations on transient errors.

    Usage is identical to the regular Supabase client:
        client.table("users").select("*").execute()

    But now all execute() calls automatically retry on:
    - SSL/TLS errors
    - Network errors
    - Connection resets
    - 502/503/504 gateway errors
    - Timeouts
    """

    def __init__(self, client: Client, max_retries: int = MAX_RETRIES):
        self._client = client
        self._max_retries = max_retries

    def table(self, table_name: str):
        """Get a table reference with retry-enabled query builder."""
        return RetryingQueryBuilder(self._client.table(table_name), self._max_retries)

    def rpc(self, fn_name: str, params: dict = None):
        """Call an RPC function with retry."""
        return RetryingQueryBuilder(
            self._client.rpc(fn_name, params or {}), self._max_retries
        )

    def __getattr__(self, name):
        """Proxy other attributes to the underlying client."""
        return getattr(self._client, name)


# Create the raw Supabase client
_raw_supabase: Client = create_client(
    settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY
)

# Create the resilient wrapper (this is what all code should use)
supabase: ResilientSupabaseClient = ResilientSupabaseClient(_raw_supabase)


async def create_tables():
    """Create database tables if they don't exist"""
    # Tables are created via Supabase migrations
    # This function can be used for additional setup if needed
    pass


def get_supabase_client() -> ResilientSupabaseClient:
    """
    Get resilient Supabase client instance with automatic retry.

    This uses the REST API which is already connection-pooled via PostgREST.
    All execute() calls automatically retry on transient errors (SSL, network, etc.)
    """
    return supabase


def get_raw_supabase_client() -> Client:
    """
    Get the raw Supabase client without retry wrapper.

    Use this only if you need direct access to the underlying client
    (e.g., for operations that don't go through execute()).
    """
    return _raw_supabase


# For future direct Postgres access (if needed for complex queries)
# Uncomment and configure DATABASE_POOL_URL if required
#
# from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
# from sqlalchemy.orm import sessionmaker
#
# if settings.DATABASE_POOL_URL:
#     engine = create_async_engine(
#         settings.DATABASE_POOL_URL,
#         pool_size=settings.DATABASE_POOL_MIN_SIZE,
#         max_overflow=settings.DATABASE_POOL_MAX_SIZE - settings.DATABASE_POOL_MIN_SIZE,
#         pool_pre_ping=True,  # Verify connections are alive
#         pool_recycle=300,    # Recycle connections after 5 minutes
#     )
#     AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
