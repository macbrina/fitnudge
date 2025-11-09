from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.security import HTTPBearer
from fastapi.responses import JSONResponse
import uvicorn
import os
from dotenv import load_dotenv

# Initialize New Relic before other imports
if os.getenv("NEW_RELIC_LICENSE_KEY"):
    import newrelic.agent

    # Initialize with config file
    newrelic.agent.initialize("newrelic.ini")

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
    SQLInjectionProtectionMiddleware,
    SessionManagementMiddleware,
)
from app.core.health import build_health_report, HealthStatus

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="FitNudge API",
    description="Fitness Motivation AI App API",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
    redirect_slashes=False,  # Disable automatic redirects to preserve Authorization header
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

# Add trusted host middleware (skip in development or if wildcard is set)
if settings.ENVIRONMENT == "production" and "*" not in settings.allowed_hosts_list:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts_list)

# Add security middleware (order matters!)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(SQLInjectionProtectionMiddleware)
app.add_middleware(IPWhitelistMiddleware)
app.add_middleware(AccountLockoutMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(AuditLoggingMiddleware)
app.add_middleware(SessionManagementMiddleware)

# Include API router
app.include_router(api_router, prefix="/api/v1")


# Health check endpoint
@app.get("/health")
async def health_check():
    report = await build_health_report(api_version=app.version)
    status_code = (
        status.HTTP_200_OK
        if report.status != HealthStatus.CRITICAL
        else status.HTTP_503_SERVICE_UNAVAILABLE
    )
    return JSONResponse(content=report.model_dump(mode="json"), status_code=status_code)


# Startup event
@app.on_event("startup")
async def startup_event():
    # Create database tables
    await create_tables()

    # Initialize PostHog analytics
    if settings.POSTHOG_API_KEY:
        initialize_posthog()
        print("📈 PostHog analytics active")

    # New Relic is already initialized at module level
    if settings.NEW_RELIC_LICENSE_KEY:
        print("📊 New Relic monitoring active")

    print("🚀 FitNudge API started successfully!")


# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    # Shutdown PostHog analytics
    if settings.POSTHOG_API_KEY:
        try:
            shutdown_posthog()
            print("📈 PostHog analytics shutdown")
        except Exception as e:
            print(f"⚠️ PostHog shutdown failed: {e}")

    # Shutdown New Relic if initialized
    if settings.NEW_RELIC_LICENSE_KEY:
        try:
            import newrelic.agent

            newrelic.agent.shutdown_agent()
            print("📊 New Relic monitoring shutdown")
        except Exception as e:
            print(f"⚠️ New Relic shutdown failed: {e}")

    print("👋 FitNudge API shutting down...")


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.ENVIRONMENT == "development",
    )
