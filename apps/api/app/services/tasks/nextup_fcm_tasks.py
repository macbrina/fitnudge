from __future__ import annotations

from app.core.celery_app import celery_app
from app.services.nextup_fcm_service import refresh_nextup_fcm_for_user


@celery_app.task(name="nextup_fcm.refresh_nextup_fcm_for_user")
def refresh_nextup_fcm_for_user_task(user_id: str) -> None:
    try:
        import asyncio

        asyncio.run(refresh_nextup_fcm_for_user(user_id))
    except Exception:
        # Best effort; don't crash worker.
        return
