from supabase import create_client, Client
from app.core.config import settings
import asyncio


# Create Supabase client
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


async def create_tables():
    """Create database tables if they don't exist"""
    # Tables are created via Supabase migrations
    # This function can be used for additional setup if needed
    pass


def get_supabase_client() -> Client:
    """Get Supabase client instance"""
    return supabase
