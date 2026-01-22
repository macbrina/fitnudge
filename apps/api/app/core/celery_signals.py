"""
FitNudge V2 - Celery Signal Handlers

Hooks for Celery lifecycle events (e.g., worker startup).

V2 Changes:
- Removed auto_create_daily_checkins_task (V1 - check-ins are now on-demand)
- Worker ready just logs startup, no automatic task queuing
"""

from celery.signals import worker_ready
from app.services.logger import logger


@worker_ready.connect
def on_worker_ready(sender, **kwargs):
    """
    V2: Log worker startup.

    In V2, check-ins are created on-demand when users respond to notifications,
    not pre-created. So we don't need to run any tasks on worker startup.
    """
    logger.info("🚀 FitNudge V2 Celery worker ready!")
    print("🚀 FitNudge V2 Celery worker ready!")
