import json

from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse

from app.core.cache import get_redis_client
from app.core.health import build_health_report

router = APIRouter()

CACHE_KEY = "system_health:report"
CACHE_TTL_SECONDS = 120


async def _get_cached_health_report(api_version: str, force: bool = False) -> dict:
    redis_client = get_redis_client()

    if redis_client and not force:
        cached_report = redis_client.get(CACHE_KEY)
        if cached_report:
            try:
                return json.loads(cached_report)
            except json.JSONDecodeError:
                pass

    report = await build_health_report(api_version=api_version)
    report_payload = report.model_dump(mode="json")

    if redis_client:
        try:
            redis_client.setex(CACHE_KEY, CACHE_TTL_SECONDS, json.dumps(report_payload))
        except Exception:
            # Ignore cache storage errors; the live report is still returned
            pass

    return report_payload


async def read_health(request: Request, force: bool = False):
    """
    Return the cached system health report, refreshing it when necessary.
    Always returns 200 to avoid triggering "offline" status in UI for non-critical issues.
    The actual status is in the response body.
    """
    try:
        api_version = getattr(request.app, "version", "1.0.0")
        report_payload = await _get_cached_health_report(api_version, force=force)

        # Always return 200 - let the client interpret the status from the body
        # Only return 503 if the database (Supabase) is unreachable
        supabase_critical = False
        for check in report_payload.get("checks", []):
            if (
                check.get("component") == "supabase"
                and check.get("status") == "critical"
            ):
                supabase_critical = True
                break

        status_code = (
            status.HTTP_503_SERVICE_UNAVAILABLE
            if supabase_critical
            else status.HTTP_200_OK
        )

        return JSONResponse(content=report_payload, status_code=status_code)
    except Exception as e:
        # If health check itself fails, return degraded status (not 503)
        fallback_payload = {
            "status": "degraded",
            "version": getattr(request.app, "version", "1.0.0"),
            "environment": "unknown",
            "timestamp": None,
            "checks": [],
            "error": str(e),
        }
        return JSONResponse(content=fallback_payload, status_code=status.HTTP_200_OK)


@router.get("/health", summary="Get cached system health report")
async def cached_health(request: Request, force: bool = False):
    """
    Return the cached health report when available. Pass `force=true` to bypass
    the cache and rebuild the report.
    """
    return await read_health(request, force=force)
