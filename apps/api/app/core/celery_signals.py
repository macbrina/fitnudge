"""
Celery Signal Handlers

Hooks for Celery lifecycle events (e.g., worker startup).
"""

from celery.signals import worker_ready


@worker_ready.connect
def on_worker_ready(sender, **kwargs):
    """
    Run critical tasks immediately when worker starts.

    This ensures check-ins are created/verified without waiting for
    the first scheduled beat interval.
    """
    from app.services.tasks import auto_create_daily_checkins_task

    print("🚀 Celery worker ready! Running initial check-in creation...")

    # Run check-in creation immediately (countdown=0)
    auto_create_daily_checkins_task.apply_async(countdown=0)

    print("✅ Initial check-in creation task queued")
