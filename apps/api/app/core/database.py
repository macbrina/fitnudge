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


# Create Supabase client (uses REST API - already pooled)
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


async def create_tables():
    """Create database tables if they don't exist"""
    # Tables are created via Supabase migrations
    # This function can be used for additional setup if needed
    pass


def get_supabase_client() -> Client:
    """
    Get Supabase client instance.
    
    This uses the REST API which is already connection-pooled via PostgREST.
    For most operations, this is the preferred approach.
    """
    return supabase


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
