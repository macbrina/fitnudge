"""
Celery Application Configuration

Celery task queue using Redis as broker and backend.
"""

from celery import Celery
from app.core.config import settings

# Create Celery app instance
celery_app = Celery(
    "fitnudge",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.services.tasks"],  # Include task modules
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=60,  # 60 seconds max per task
    task_soft_time_limit=50,  # 50 seconds soft limit
    worker_prefetch_multiplier=1,  # Prefetch only one task at a time for better distribution
    worker_max_tasks_per_child=1000,  # Restart worker after 1000 tasks to prevent memory leaks
    result_expires=3600,  # Results expire after 1 hour
    task_acks_late=True,  # Acknowledge task only after completion
    task_reject_on_worker_lost=True,  # Reject task if worker dies
    # Beat schedule for periodic tasks
    beat_schedule={
        "generate-weekly-recaps": {
            "task": "generate_weekly_recaps",
            "schedule": 60.0
            * 60.0
            * 24.0,  # Run daily (check if it's time for weekly recaps)
            # Alternatively: use crontab for specific day/time
            # "schedule": crontab(hour=8, minute=0, day_of_week=1),  # Monday 8am
        },
    },
)

# Task routing (optional - can be used for task prioritization)
celery_app.conf.task_routes = {
    "app.services.tasks.generate_plan_task": {"queue": "plan_generation"},
}
