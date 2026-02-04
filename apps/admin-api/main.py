"""
FitNudge Admin API
Administrative backend for the admin dashboard

Security: This API has stricter security than the public API:
- IP whitelisting (in production)
- Stricter rate limits
- Shorter session timeouts
- All actions are audit logged
- Account lockout after fewer failed attempts
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from dotenv import load_dotenv

from app.core.config import settings
from app.api.router import api_router
from app.core.middleware import (
    SecurityHeadersMiddleware,
    RateLimitMiddleware,
    IPWhitelistMiddleware,
    AccountLockoutMiddleware,
    AuditLoggingMiddleware,
    SessionTimeoutMiddleware,
)

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="FitNudge Admin API",
    description="Administrative API for FitNudge Dashboard",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
)

# Add CORS middleware (more restrictive for admin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],  # Explicit methods
    allow_headers=["Authorization", "Content-Type"],  # Explicit headers
)

# Add trusted host middleware in production
if settings.ENVIRONMENT == "production" and "*" not in settings.allowed_hosts_list:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts_list)

# Add security middleware (order matters - first added = last executed)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(AuditLoggingMiddleware)
app.add_middleware(SessionTimeoutMiddleware)
app.add_middleware(AccountLockoutMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(IPWhitelistMiddleware)

# Include API router
app.include_router(api_router, prefix="/api")


@app.get("/health")
async def health_check():
    """Health check endpoint for uptime monitoring.
    Returns status and component health: database, redis, celery.
    """
    import redis
    from app.core.database import get_supabase_client
    from app.core.celery_client import get_celery_inspect

    health = {
        "status": "ok",
        "service": "admin-api",
        "components": {},
    }

    # Check Supabase (database)
    try:
        supabase = get_supabase_client()
        supabase.table("users").select("id").limit(1).execute()
        health["components"]["database"] = "ok"
    except Exception as e:
        health["components"]["database"] = f"error: {str(e)}"
        health["status"] = "degraded"

    # Check Redis (direct connectivity)
    try:
        redis_url = settings.redis_connection_url
        if redis_url and "rediss://" in redis_url:
            client = redis.from_url(
                redis_url,
                decode_responses=True,
                ssl_cert_reqs=None,
            )
        else:
            client = redis.from_url(redis_url, decode_responses=True)
        client.ping()
        health["components"]["redis"] = "ok"
    except Exception as e:
        health["components"]["redis"] = f"error: {str(e)}"
        health["status"] = "degraded"

    # Check Celery (workers via inspect)
    try:
        inspect = get_celery_inspect()
        ping = inspect.ping()
        if ping:
            health["components"]["celery"] = f"ok ({len(ping)} workers)"
        else:
            health["components"]["celery"] = "no workers online"
    except Exception as e:
        health["components"]["celery"] = f"error: {str(e)}"
        health["status"] = "degraded"

    return health


@app.on_event("startup")
async def startup_event():
    print("🔐 FitNudge Admin API started!")
    print(f"   Environment: {settings.ENVIRONMENT}")

    # Bootstrap admin user if ADMIN_EMAIL and ADMIN_PASSWORD are set
    try:
        from app.core.create_admin import ensure_admin_user

        admin_id = ensure_admin_user()
        if admin_id:
            print("   Admin user ensured (ADMIN_EMAIL/ADMIN_PASSWORD set)")
    except Exception as e:
        print(f"   Warning: Could not ensure admin user: {e}")


@app.on_event("shutdown")
async def shutdown_event():
    print("👋 FitNudge Admin API shutting down...")


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=settings.ENVIRONMENT == "development",
    )
