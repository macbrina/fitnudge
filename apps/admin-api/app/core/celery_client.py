"""
Celery Client for Admin API
Connects to the same Celery broker. Used for:
- Monitoring (inspect, control) via tasks endpoints
- Dispatching admin tasks (data export) - runs in admin-api workers
"""

from celery import Celery
from app.core.config import settings

redis_url = settings.redis_connection_url

# Create Celery app instance - same broker as main API
celery_app = Celery(
    "fitnudge_admin",
    broker=redis_url,
    backend=redis_url,
    include=["app.services.tasks"],
)

# Configure Celery
celery_app.conf.update(
    # Timezone
    timezone="UTC",
    enable_utc=True,
    # Result backend settings
    result_expires=3600,  # 1 hour
    result_extended=True,  # Store task name in result backend (for admin portal logs)
    # Broker settings for SSL (Upstash)
    broker_use_ssl=(
        {"ssl_cert_reqs": "none"} if redis_url and "rediss://" in redis_url else None
    ),
    redis_backend_use_ssl=(
        {"ssl_cert_reqs": "none"} if redis_url and "rediss://" in redis_url else None
    ),
    # Admin tasks use separate queue - main API tasks stay on default "celery" queue
    task_routes={"admin.*": {"queue": "admin"}},
    # Workers consume from "admin" queue by default (run without -Q admin)
    task_default_queue="admin",
)


def get_celery_inspect():
    """Get Celery inspect instance for querying workers"""
    return celery_app.control.inspect()


def get_celery_control():
    """Get Celery control instance for managing tasks"""
    return celery_app.control
