from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.security import HTTPBearer
from fastapi.responses import JSONResponse
import uvicorn
from dotenv import load_dotenv

from app.core.config import settings
from app.core.database import create_tables
from app.core.analytics import initialize_posthog, shutdown_posthog
from app.api.v1.router import api_router
from app.core.middleware import (
    SecurityHeadersMiddleware,
    RateLimitMiddleware,
    AccountLockoutMiddleware,
    IPWhitelistMiddleware,
    AuditLoggingMiddleware,
    UserActivityMiddleware,
    SQLInjectionProtectionMiddleware,
    SessionManagementMiddleware,
)
from app.api.v1.endpoints.system_health import read_health

# Load environment variables
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await create_tables()
    if settings.POSTHOG_API_KEY:
        initialize_posthog()
        print("📈 PostHog analytics active")
    print("🚀 FitNudge API started successfully!")
    yield
    # Shutdown
    if settings.POSTHOG_API_KEY:
        try:
            shutdown_posthog()
            print("📈 PostHog analytics shutdown")
        except Exception as e:
            print(f"⚠️ PostHog shutdown failed: {e}")
    print("👋 FitNudge API shutting down...")


# Create FastAPI app
app = FastAPI(
    title="FitNudge API",
    description="Fitness Motivation AI App API",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
    redirect_slashes=False,  # Disable automatic redirects to preserve Authorization header
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],  # Explicitly expose all headers including Authorization
)

# TrustedHost: only in production, not DEBUG (local), and explicit ALLOWED_HOSTS.
# Skip when DEBUG so local multi-worker testing (Expo → localhost / tunnel) doesn't get 400.
if (
    settings.ENVIRONMENT == "production"
    and not settings.DEBUG
    and "*" not in settings.allowed_hosts_list
):
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts_list)

# Add security middleware (order matters!)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(SQLInjectionProtectionMiddleware)
app.add_middleware(IPWhitelistMiddleware)
app.add_middleware(AccountLockoutMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(AuditLoggingMiddleware)
app.add_middleware(SessionManagementMiddleware)
app.add_middleware(
    UserActivityMiddleware
)  # Track user activity for partner suggestions

# Include API router
app.include_router(api_router, prefix="/api/v1")

# Health check endpoint (cached)
app.add_api_route(
    "/health",
    read_health,
    methods=["GET"],
    summary="Cached backend health report",
)


if __name__ == "__main__":
    is_dev = settings.ENVIRONMENT == "development"
    # Production: multiple workers so sync Supabase in one request doesn't block others.
    # Dev: single worker only. --reload and --workers > 1 are incompatible; multiple
    # workers also complicate debugging (which process, breakpoints, interleaved logs).
    run_kwargs = {
        "host": "0.0.0.0",
        "port": 8000,
        "reload": is_dev,
    }
    if not is_dev:
        run_kwargs["workers"] = settings.UVICORN_WORKERS
    uvicorn.run("main:app", **run_kwargs)
