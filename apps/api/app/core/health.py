"""
Health check utilities for FitNudge API.

Provides structured status reporting for core infrastructure and third-party
integrations so both developers and users can understand the system state.
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
import ssl
import time
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from supabase import create_client, Client

from app.core.config import settings


def _create_fresh_supabase_client() -> Client:
    """Create a fresh Supabase client to avoid stale SSL sessions.

    This is used for health checks to prevent SSL session resumption errors
    that can occur when connections are proxied through Cloudflare tunnels.
    """
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


class HealthStatus(str, Enum):
    OK = "ok"
    DEGRADED = "degraded"
    CRITICAL = "critical"
    NOT_CONFIGURED = "not_configured"


class HealthCheckResult(BaseModel):
    component: str
    status: HealthStatus
    details: str = ""
    latency_ms: Optional[float] = Field(default=None, ge=0)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class HealthReport(BaseModel):
    status: HealthStatus
    version: str
    environment: str
    timestamp: datetime
    checks: List[HealthCheckResult]

    class Config:
        json_encoders = {datetime: lambda dt: dt.isoformat()}


logger = logging.getLogger(__name__)


def _elapsed_ms(start: float) -> float:
    return round((time.perf_counter() - start) * 1000, 2)


async def _check_supabase() -> HealthCheckResult:
    component = "supabase"
    start = time.perf_counter()

    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        return HealthCheckResult(
            component=component,
            status=HealthStatus.NOT_CONFIGURED,
            details="Supabase credentials are not set",
        )

    # Retry logic for transient errors (SSL, network, broken pipe)
    # Health checks use fresh client to avoid stale SSL, but we retry on transient errors
    max_retries = 2
    last_error = None

    for attempt in range(max_retries + 1):
        try:
            # Use a fresh client to avoid stale SSL sessions (Cloudflare tunnel issue)
            supabase = _create_fresh_supabase_client()

            response = await asyncio.to_thread(
                lambda: supabase.table("users")
                .select("id", count="exact")
                .limit(1)
                .execute()
            )

            if getattr(response, "error", None):
                print(f"[Health] Supabase: Error response - {response.error}")
                return HealthCheckResult(
                    component=component,
                    status=HealthStatus.CRITICAL,
                    details=str(response.error),
                    latency_ms=_elapsed_ms(start),
                )

            metadata = {
                "rows_sampled": len(getattr(response, "data", []) or []),
                "total_users": getattr(response, "count", None),
            }

            return HealthCheckResult(
                component=component,
                status=HealthStatus.OK,
                details="Supabase reachable",
                latency_ms=_elapsed_ms(start),
                metadata=metadata,
            )
        except Exception as exc:  # pragma: no cover - network failures
            last_error = exc
            error_str = str(exc).lower()
            # Check if transient error that should be retried
            transient_patterns = [
                "ssl",
                "tls",
                "broken pipe",
                "connection",
                "timeout",
                "eof",
                "reset",
            ]
            is_transient = any(p in error_str for p in transient_patterns)

            if is_transient and attempt < max_retries:
                print(
                    f"[Health] Supabase: Transient error, retrying ({attempt + 1}/{max_retries}): {exc}"
                )
                await asyncio.sleep(0.5 * (attempt + 1))  # Brief backoff
                continue
            else:
                break

    # All retries failed
    print(f"[Health] Supabase: Exception - {type(last_error).__name__}: {last_error}")
    return HealthCheckResult(
        component=component,
        status=HealthStatus.CRITICAL,
        details=f"Supabase request failed: {last_error}",
        latency_ms=_elapsed_ms(start),
    )


async def _check_smtp() -> HealthCheckResult:
    component = "smtp"
    start = time.perf_counter()

    host = settings.SMTP_HOST
    port = settings.SMTP_PORT
    username = settings.SMTP_USERNAME
    password = settings.SMTP_PASSWORD

    if not host or not port:
        return HealthCheckResult(
            component=component,
            status=HealthStatus.NOT_CONFIGURED,
            details="SMTP host or port is not configured",
        )

    try:
        context = ssl.create_default_context()
        smtp = smtplib.SMTP(host=host, port=port, timeout=5)
        smtp.ehlo()

        if port == 587:
            smtp.starttls(context=context)
            smtp.ehlo()

        # Some providers throttle unauthenticated probes; authenticate when credentials exist.
        if username and password:
            smtp.login(username, password)

        smtp.quit()

        return HealthCheckResult(
            component=component,
            status=HealthStatus.OK,
            details="SMTP server reachable",
            latency_ms=_elapsed_ms(start),
            metadata={"host": host, "port": port},
        )
    except Exception as exc:  # pragma: no cover - network failures
        print(f"[Health] SMTP: Exception - {type(exc).__name__}: {exc}")
        return HealthCheckResult(
            component=component,
            status=HealthStatus.DEGRADED,
            details=f"SMTP connection failed: {exc}",
            latency_ms=_elapsed_ms(start),
        )


async def _check_openai() -> HealthCheckResult:
    component = "openai"

    if not settings.OPENAI_API_KEY:
        return HealthCheckResult(
            component=component,
            status=HealthStatus.NOT_CONFIGURED,
            details="OpenAI API key is not configured",
        )

    # Avoid making a live OpenAI request; treat configuration as sufficient.
    return HealthCheckResult(
        component=component,
        status=HealthStatus.OK,
        details="OpenAI API key configured",
    )


async def gather_health_checks() -> List[HealthCheckResult]:
    """Gather health checks for user-facing components only.

    We check:
    - supabase: Core database/auth services
    - smtp: Email notifications
    - openai: AI features

    Internal components (redis, celery, cloudflare_r2) are not exposed
    to users as they don't need to know about infrastructure details.
    """
    checks = await asyncio.gather(
        _check_supabase(),
        _check_smtp(),
        _check_openai(),
    )

    return list(checks)


def _aggregate_status(checks: List[HealthCheckResult]) -> HealthStatus:
    # Log any non-OK checks for debugging 503s
    non_ok_checks = [
        c
        for c in checks
        if c.status not in (HealthStatus.OK, HealthStatus.NOT_CONFIGURED)
    ]
    if non_ok_checks:
        for check in non_ok_checks:
            print(
                f"[Health] ⚠️ {check.component}: {check.status.value} - {check.details}"
            )

    if any(check.status == HealthStatus.CRITICAL for check in checks):
        critical = [c for c in checks if c.status == HealthStatus.CRITICAL]
        print(f"[Health] 🔴 CRITICAL status due to: {[c.component for c in critical]}")
        return HealthStatus.CRITICAL

    if any(check.status == HealthStatus.DEGRADED for check in checks):
        degraded = [c for c in checks if c.status == HealthStatus.DEGRADED]
        print(f"[Health] 🟡 DEGRADED status due to: {[c.component for c in degraded]}")
        return HealthStatus.DEGRADED

    if all(check.status == HealthStatus.NOT_CONFIGURED for check in checks):
        return HealthStatus.NOT_CONFIGURED

    return HealthStatus.OK


async def build_health_report(api_version: str) -> HealthReport:
    checks = await gather_health_checks()
    overall_status = _aggregate_status(checks)

    return HealthReport(
        status=overall_status,
        version=api_version,
        environment=settings.ENVIRONMENT,
        timestamp=datetime.now(timezone.utc),
        checks=checks,
    )
