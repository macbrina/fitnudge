from pydantic_settings import BaseSettings
from typing import List, Optional
from dotenv import load_dotenv
from pathlib import Path
import os

# Get the directory where config.py lives (apps/api/app/core/)
# Then go up to apps/api/ to find .env files
CONFIG_DIR = Path(__file__).resolve().parent  # apps/api/app/core/
API_DIR = CONFIG_DIR.parent.parent  # apps/api/

# Load .env.local first, then .env as fallback (using absolute paths)
env_local = API_DIR / ".env.local"
env_file = API_DIR / ".env"

if env_local.exists():
    load_dotenv(env_local)
    print(f"✅ Loaded env from: {env_local}")
elif env_file.exists():
    load_dotenv(env_file)
    print(f"✅ Loaded env from: {env_file}")
else:
    print(f"⚠️ No .env file found in {API_DIR}")


class Settings(BaseSettings):
    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"

    # Uvicorn workers: used when ENVIRONMENT != "development" (reload and workers are mutually exclusive).
    # Multiple workers ensure sync Supabase/DB work in one request doesn't block others—no per-route changes.
    UVICORN_WORKERS: int = int(os.getenv("UVICORN_WORKERS", "4"))

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")

    # Connection Pooling (for direct Postgres connections if needed)
    # Supabase provides pooler URLs in the format:
    # postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
    # Use mode=transaction for Celery workers
    DATABASE_POOL_URL: str = os.getenv("DATABASE_POOL_URL", "")
    DATABASE_POOL_MIN_SIZE: int = int(os.getenv("DATABASE_POOL_MIN_SIZE", "2"))
    DATABASE_POOL_MAX_SIZE: int = int(os.getenv("DATABASE_POOL_MAX_SIZE", "10"))

    # JWT - Use Supabase JWT secret for compatibility with Supabase Realtime
    # Get your SUPABASE_JWT_SECRET from: Supabase Dashboard → Settings → API → JWT Secret
    SECRET_KEY: str = os.getenv("SUPABASE_JWT_SECRET", os.getenv("SECRET_KEY", ""))
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))

    # CORS
    ALLOWED_ORIGINS: str = os.getenv("ALLOWED_ORIGINS", "*")
    ALLOWED_HOSTS: str = os.getenv("ALLOWED_HOSTS", "*")

    @property
    def allowed_origins_list(self) -> List[str]:
        return self.ALLOWED_ORIGINS.split(",")

    @property
    def allowed_hosts_list(self) -> List[str]:
        return self.ALLOWED_HOSTS.split(",")

    # AI Services
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")
    AI_COACH_STREAMING_ENABLED: bool = (
        os.getenv("AI_COACH_STREAMING_ENABLED", "true").lower() == "true"
    )
    AI_COACH_STREAM_VIA_REDIS: bool = (
        os.getenv("AI_COACH_STREAM_VIA_REDIS", "false").lower() == "true"
    )

    # Redis Configuration
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_PASSWORD: str = os.getenv("REDIS_PASSWORD", "")
    REDIS_DB: int = int(os.getenv("REDIS_DB", "0"))
    REDIS_SSL: bool = os.getenv("REDIS_SSL", "false").lower() == "true"

    # Legacy support: If REDIS_URL is provided, use it (for backward compatibility)
    REDIS_URL: Optional[str] = os.getenv("REDIS_URL", None)

    @property
    def redis_connection_url(self) -> str:
        """Build Redis connection URL from individual components."""
        # Legacy support: If REDIS_URL is provided, use it
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

    # Cloudflare R2 Storage
    CLOUDFLARE_ACCOUNT_ID: str = os.getenv("CLOUDFLARE_ACCOUNT_ID", "")
    CLOUDFLARE_ACCESS_KEY_ID: str = os.getenv("CLOUDFLARE_ACCESS_KEY_ID", "")
    CLOUDFLARE_SECRET_ACCESS_KEY: str = os.getenv("CLOUDFLARE_SECRET_ACCESS_KEY", "")
    CLOUDFLARE_BUCKET_NAME: str = os.getenv("CLOUDFLARE_BUCKET_NAME", "")
    CLOUDFLARE_PUBLIC_URL: str = os.getenv("CLOUDFLARE_PUBLIC_URL", "")

    # Cloudflare R2 - Alias names used by media service
    @property
    def CLOUDFLARE_R2_ENDPOINT_URL(self) -> str:
        """R2 S3-compatible endpoint URL"""
        if self.CLOUDFLARE_ACCOUNT_ID:
            return f"https://{self.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com"
        return ""

    @property
    def CLOUDFLARE_R2_ACCESS_KEY_ID(self) -> str:
        return self.CLOUDFLARE_ACCESS_KEY_ID

    @property
    def CLOUDFLARE_R2_SECRET_ACCESS_KEY(self) -> str:
        return self.CLOUDFLARE_SECRET_ACCESS_KEY

    @property
    def CLOUDFLARE_R2_BUCKET_NAME(self) -> str:
        return self.CLOUDFLARE_BUCKET_NAME

    @property
    def CLOUDFLARE_R2_PUBLIC_URL(self) -> str:
        return self.CLOUDFLARE_PUBLIC_URL

    # Apple OAuth
    APPLE_CLIENT_IDS: str = os.getenv("APPLE_CLIENT_IDS", "")
    APPLE_CLIENT_SECRET: str = os.getenv("APPLE_CLIENT_SECRET", "")
    APPLE_TEAM_ID: str = os.getenv("APPLE_TEAM_ID", "")
    APPLE_KEY_ID: str = os.getenv("APPLE_KEY_ID", "")
    APPLE_PRIVATE_KEY: str = os.getenv("APPLE_PRIVATE_KEY", "")

    # ActivityKit (iOS Live Activities) - APNs Token-based auth (provider)
    # IMPORTANT: Store private key server-side only (never in mobile app).
    ACTIVITYKIT_APNS_TEAM_ID: str = os.getenv("ACTIVITYKIT_APNS_TEAM_ID", "")
    ACTIVITYKIT_APNS_KEY_ID: str = os.getenv("ACTIVITYKIT_APNS_KEY_ID", "")
    ACTIVITYKIT_APNS_PRIVATE_KEY: str = os.getenv("ACTIVITYKIT_APNS_PRIVATE_KEY", "")
    # Must be "<bundleId>.push-type.liveactivity", e.g. "com.fitnudge.app.push-type.liveactivity"
    ACTIVITYKIT_APNS_TOPIC: str = os.getenv("ACTIVITYKIT_APNS_TOPIC", "")
    # Set true for sandbox (development builds)
    ACTIVITYKIT_APNS_USE_SANDBOX: bool = (
        os.getenv("ACTIVITYKIT_APNS_USE_SANDBOX", "false").lower() == "true"
    )

    # Android Mode B: FCM (server-driven NextUp ongoing notification)
    # Use a Firebase service account JSON (server-side only).
    # Recommended: store the full JSON string in secrets.
    FCM_SERVICE_ACCOUNT_JSON: str = os.getenv("FCM_SERVICE_ACCOUNT_JSON", "")

    # Google OAuth
    GOOGLE_CLIENT_IDS: str = os.getenv("GOOGLE_CLIENT_IDS", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")

    @property
    def google_client_ids(self) -> List[str]:
        ids = []
        if self.GOOGLE_CLIENT_IDS:
            ids.extend(
                [
                    client_id.strip()
                    for client_id in self.GOOGLE_CLIENT_IDS.split(",")
                    if client_id.strip()
                ]
            )
        # Remove duplicates while preserving order
        seen = set()
        unique_ids = []
        for client_id in ids:
            if client_id and client_id not in seen:
                seen.add(client_id)
                unique_ids.append(client_id)
        return unique_ids

    @property
    def apple_client_ids(self) -> List[str]:
        ids = []
        if self.APPLE_CLIENT_IDS:
            ids.extend(
                [
                    client_id.strip()
                    for client_id in self.APPLE_CLIENT_IDS.split(",")
                    if client_id.strip()
                ]
            )
        seen = set()
        unique_ids = []
        for client_id in ids:
            if client_id and client_id not in seen:
                seen.add(client_id)
                unique_ids.append(client_id)
        return unique_ids

    # RevenueCat (for promotional entitlements / referral bonuses)
    REVENUECAT_SECRET_KEY: str = os.getenv("REVENUECAT_SECRET_KEY", "")

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "100"))

    # Email (Namecheap Private Email)
    SMTP_HOST: str = os.getenv("SMTP_HOST", "mail.privateemail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    REPLY_TO_EMAIL: str = os.getenv("REPLY_TO_EMAIL", "hello@fitnudge.app")
    FROM_EMAIL: str = os.getenv("FROM_EMAIL", "noreply@fitnudge.app")
    FROM_NAME: str = os.getenv("FROM_NAME", "FitNudge")
    BASE_URL: str = os.getenv("BASE_URL", "https://fitnudge.app")

    # PostHog Analytics
    POSTHOG_API_KEY: str = os.getenv("POSTHOG_API_KEY", "")
    POSTHOG_HOST: str = os.getenv("POSTHOG_HOST", "https://us.i.posthog.com")
    POSTHOG_ENABLE_EXCEPTION_AUTOCAPTURE: bool = (
        os.getenv("POSTHOG_ENABLE_EXCEPTION_AUTOCAPTURE", "true").lower() == "true"
    )

    class Config:
        env_file = [".env.local", ".env"]
        case_sensitive = True
        extra = "ignore"


# Create settings instance
settings = Settings()
