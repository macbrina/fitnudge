"""
Admin API Celery Worker Entry Point

Run from admin-api directory (use -Q admin to avoid consuming main API tasks):
    poetry run celery -A celery_worker worker -Q admin --loglevel=info

Workers pick up admin tasks (e.g. admin.generate_user_data_export).
Shares Redis broker with main API but uses separate "admin" queue.
"""

from app.core.celery_client import celery_app

__all__ = ["celery_app"]
