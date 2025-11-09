from pydantic_settings import BaseSettings
from typing import List
from dotenv import load_dotenv
import os

load_dotenv()


class Settings(BaseSettings):
    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", True)

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")

    # JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 15)
    REFRESH_TOKEN_EXPIRE_DAYS: int = os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", 7)

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

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")

    # Cloudflare R2 Storage
    CLOUDFLARE_ACCOUNT_ID: str = os.getenv("CLOUDFLARE_ACCOUNT_ID", "")
    CLOUDFLARE_ACCESS_KEY_ID: str = os.getenv("CLOUDFLARE_ACCESS_KEY_ID", "")
    CLOUDFLARE_SECRET_ACCESS_KEY: str = os.getenv("CLOUDFLARE_SECRET_ACCESS_KEY", "")
    CLOUDFLARE_BUCKET_NAME: str = os.getenv("CLOUDFLARE_BUCKET_NAME", "")
    CLOUDFLARE_PUBLIC_URL: str = os.getenv("CLOUDFLARE_PUBLIC_URL", "")

    # Apple OAuth
    APPLE_CLIENT_IDS: str = os.getenv("APPLE_CLIENT_IDS", "")
    APPLE_CLIENT_SECRET: str = os.getenv("APPLE_CLIENT_SECRET", "")
    APPLE_TEAM_ID: str = os.getenv("APPLE_TEAM_ID", "")
    APPLE_KEY_ID: str = os.getenv("APPLE_KEY_ID", "")
    APPLE_PRIVATE_KEY: str = os.getenv("APPLE_PRIVATE_KEY", "")

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

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = os.getenv("RATE_LIMIT_PER_MINUTE", 100)

    # Email (Namecheap Private Email)
    SMTP_HOST: str = os.getenv("SMTP_HOST", "mail.privateemail.com")
    SMTP_PORT: int = os.getenv("SMTP_PORT", 587)
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    REPLY_TO_EMAIL: str = os.getenv("REPLY_TO_EMAIL", "hello@fitnudge.app")
    FROM_EMAIL: str = os.getenv("FROM_EMAIL", "noreply@fitnudge.app")
    FROM_NAME: str = os.getenv("FROM_NAME", "FitNudge")
    BASE_URL: str = os.getenv("BASE_URL", "https://fitnudge.app")

    # Monitoring
    NEW_RELIC_LICENSE_KEY: str = os.getenv("NEW_RELIC_LICENSE_KEY", "")
    NEW_RELIC_APP_NAME: str = os.getenv("NEW_RELIC_APP_NAME", "fitnudge-api")

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
