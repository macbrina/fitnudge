"""
Celery Worker Entry Point

Run this file to start Celery workers:
    celery -A celery_worker worker --loglevel=info

Or with specific queue:
    celery -A celery_worker worker --loglevel=info -Q plan_generation

Note: Celery workers don't auto-reload code changes.
Restart the worker manually when you modify task code.

To run Celery Beat (for scheduled tasks like weekly recaps):
    celery -A celery_worker beat --loglevel=info

Or run both worker and beat together:
    celery -A celery_worker worker --beat --loglevel=info
"""

from app.core.celery_app import celery_app
from app.core import celery_signals  # Import to register signal handlers

# This makes Celery discover tasks in the app
__all__ = ["celery_app"]
