"""
Celery Client for Admin API
Connects to the same Celery broker to monitor tasks
"""

from celery import Celery
from app.core.config import settings

# Create Celery app instance for monitoring
# This connects to the same broker as the main worker
celery_app = Celery(
    "fitnudge",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

# Configure Celery
celery_app.conf.update(
    # Timezone
    timezone="UTC",
    enable_utc=True,
    # Result backend settings
    result_expires=3600,  # 1 hour
    # Broker settings for SSL (Upstash)
    broker_use_ssl=(
        {"ssl_cert_reqs": "none"} if "rediss://" in settings.REDIS_URL else None
    ),
    redis_backend_use_ssl=(
        {"ssl_cert_reqs": "none"} if "rediss://" in settings.REDIS_URL else None
    ),
)


def get_celery_inspect():
    """Get Celery inspect instance for querying workers"""
    return celery_app.control.inspect()


def get_celery_control():
    """Get Celery control instance for managing tasks"""
    return celery_app.control
