"""
Admin API Configuration
Uses same environment variables as main API
"""

from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    # JWT
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # Shorter for admin

    # Redis (for Celery monitoring)
    REDIS_URL: str = ""

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000"
    ALLOWED_HOSTS: str = "localhost,127.0.0.1"

    # Admin Security
    ADMIN_ALLOWED_IPS: str = ""  # Comma-separated list of allowed IPs

    @property
    def allowed_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    @property
    def allowed_hosts_list(self) -> List[str]:
        return [host.strip() for host in self.ALLOWED_HOSTS.split(",")]

    @property
    def admin_allowed_ips_list(self) -> List[str]:
        if not self.ADMIN_ALLOWED_IPS:
            return []
        return [ip.strip() for ip in self.ADMIN_ALLOWED_IPS.split(",") if ip.strip()]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
