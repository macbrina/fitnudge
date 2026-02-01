"""
Live Activity Tasks (ActivityKit)

Server-driven Mode B:
- Called when pending check-ins are precreated (day start)
- Called when check-in status changes (pending -> completed/skipped/rest_day/missed)

Implementation notes:
- Fire-and-forget (best effort). Failures should not break core check-in flow.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict

from app.services.tasks.base import celery_app, logger
from app.services.live_activity_service import refresh_live_activity_for_user


@celery_app.task(
    name="refresh_live_activity_for_user",
    bind=True,
    max_retries=1,
    default_retry_delay=10,
)
def refresh_live_activity_for_user_task(self, user_id: str) -> Dict[str, Any]:
    try:
        result = asyncio.run(refresh_live_activity_for_user(user_id))
        return {"success": True, **result}
    except Exception as e:
        logger.warning(f"[LiveActivity] refresh failed for user {user_id}: {e}")
        return {"success": False, "error": str(e)}
