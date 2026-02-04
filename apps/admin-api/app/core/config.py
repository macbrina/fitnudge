"""
Admin API Configuration
Uses same environment variables as main API.
Loads .env.local first, then .env (from apps/admin-api/).
"""

from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from typing import List, Optional
from dotenv import load_dotenv
from pathlib import Path
import os

# Resolve paths: config.py is in apps/admin-api/app/core/
CONFIG_DIR = Path(__file__).resolve().parent
ADMIN_API_DIR = CONFIG_DIR.parent.parent  # apps/admin-api/

env_local = ADMIN_API_DIR / ".env.local"
env_file = ADMIN_API_DIR / ".env"

if env_local.exists():
    load_dotenv(env_local)
    print(f"✅ Admin API: loaded env from {env_local}")
elif env_file.exists():
    load_dotenv(env_file)
    print(f"✅ Admin API: loaded env from {env_file}")
else:
    print(f"⚠️ Admin API: no .env found in {ADMIN_API_DIR}")


class Settings(BaseSettings):
    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

    # Supabase (same as main API)
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")

    # JWT (no refresh tokens for admin - longer access token instead)
    SECRET_KEY: str = os.getenv("SECRET_KEY", os.getenv("SUPABASE_JWT_SECRET", ""))
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ADMIN_ACCESS_TOKEN_EXPIRE_MINUTES", "480")  # 8 hours
    )

    # Redis (for Celery monitoring - same as main API)
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_PASSWORD: str = os.getenv("REDIS_PASSWORD", "")
    REDIS_DB: int = int(os.getenv("REDIS_DB", "0"))
    REDIS_SSL: bool = os.getenv("REDIS_SSL", "false").lower() == "true"
    REDIS_URL: Optional[str] = os.getenv("REDIS_URL", None)

    @property
    def redis_connection_url(self) -> str:
        """Build Redis URL from components or use REDIS_URL if set."""
        if self.REDIS_URL:
            return self.REDIS_URL
        protocol = "rediss" if self.REDIS_SSL else "redis"
        if self.REDIS_PASSWORD:
            url = f"{protocol}://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}"
        else:
            url = f"{protocol}://{self.REDIS_HOST}:{self.REDIS_PORT}"
        if self.REDIS_DB != 0:
            url = f"{url}/{self.REDIS_DB}"
        return url

    # CORS
    ALLOWED_ORIGINS: str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
    ALLOWED_HOSTS: str = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1")

    # Admin Security
    ADMIN_ALLOWED_IPS: str = os.getenv("ADMIN_ALLOWED_IPS", "")

    # Bootstrap Admin (optional) - create admin user on startup if set
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "")

    # Email (for admin password reset)
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    REPLY_TO_EMAIL: str = os.getenv("REPLY_TO_EMAIL", "hello@fitnudge.app")
    FROM_EMAIL: str = os.getenv("FROM_EMAIL", "")
    FROM_NAME: str = os.getenv("FROM_NAME", "FitNudge Admin")
    ADMIN_PORTAL_URL: str = os.getenv(
        "ADMIN_PORTAL_URL", os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3001")
    )
    # Reset password path (must match admin-portal src/lib/routes.ts RESET_PASSWORD_PATH)
    ADMIN_RESET_PASSWORD_PATH: str = os.getenv("ADMIN_RESET_PASSWORD_PATH", "/reset-password")

    # Cloudflare R2 (for blog image uploads - same bucket as main API)
    CLOUDFLARE_ACCOUNT_ID: str = os.getenv("CLOUDFLARE_ACCOUNT_ID", "")
    CLOUDFLARE_ACCESS_KEY_ID: str = os.getenv("CLOUDFLARE_ACCESS_KEY_ID", "")
    CLOUDFLARE_SECRET_ACCESS_KEY: str = os.getenv("CLOUDFLARE_SECRET_ACCESS_KEY", "")
    CLOUDFLARE_BUCKET_NAME: str = os.getenv("CLOUDFLARE_BUCKET_NAME", "")
    CLOUDFLARE_PUBLIC_URL: str = os.getenv("CLOUDFLARE_PUBLIC_URL", "")

    @property
    def cloudflare_r2_endpoint_url(self) -> str:
        if self.CLOUDFLARE_ACCOUNT_ID:
            return f"https://{self.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com"
        return ""

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

    model_config = ConfigDict(
        env_file=[".env.local", ".env"],
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
