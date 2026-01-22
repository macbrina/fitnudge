"""
Database connection for Admin API
Uses Supabase service role for full access
"""

from supabase import create_client, Client
from app.core.config import settings
from typing import Optional

_supabase_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """Get Supabase client with service role (full access)"""
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(
            settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY
        )
    return _supabase_client
