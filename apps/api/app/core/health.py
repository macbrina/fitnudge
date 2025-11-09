"""
Health check utilities for FitNudge API.

Provides structured status reporting for core infrastructure and third-party
integrations so both developers and users can understand the system state.
"""

from __future__ import annotations

import asyncio
import logging
import os
import smtplib
import ssl
import time
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

import redis
from fastapi import status
from pydantic import BaseModel, Field

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.database import get_supabase_client


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


class HealthUpdateStatus(str, Enum):
    IDENTIFIED = "identified"
    MONITORING = "monitoring"
    RESOLVED = "resolved"


class HealthHistoryUpdate(BaseModel):
    id: str
    created_at: datetime
    status: HealthUpdateStatus
    title: str
    description: str


class HealthHistoryEntry(BaseModel):
    id: str
    created_at: datetime
    status: HealthStatus
    environment: str
    version: Optional[str] = None
    summary_key: str
    summary_params: Dict[str, Any] = Field(default_factory=dict)
    impacted: List[Dict[str, Any]] = Field(default_factory=list)
    updates: List[HealthHistoryUpdate] = Field(default_factory=list)


logger = logging.getLogger(__name__)

COMPONENT_LABELS: Dict[str, str] = {
    "environment": "Core Configuration",
    "supabase": "Primary Database",
    "redis": "Caching Layer",
    "celery": "Background Jobs",
    "smtp": "Email Delivery",
    "openai": "AI Assistance",
    "elevenlabs": "Voice Coach",
    "cloudflare_r2": "Media Storage",
}


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

    supabase = get_supabase_client()

    try:
        response = await asyncio.to_thread(
            lambda: supabase.table("users")
            .select("id", count="exact")
            .limit(1)
            .execute()
        )

        if getattr(response, "error", None):
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
        return HealthCheckResult(
            component=component,
            status=HealthStatus.CRITICAL,
            details=f"Supabase request failed: {exc}",
            latency_ms=_elapsed_ms(start),
        )


async def _check_redis() -> HealthCheckResult:
    component = "redis"
    start = time.perf_counter()

    if not settings.REDIS_URL:
        return HealthCheckResult(
            component=component,
            status=HealthStatus.NOT_CONFIGURED,
            details="Redis URL is not configured",
        )

    try:
        client = redis.from_url(
            settings.REDIS_URL,
            socket_connect_timeout=2,
            socket_timeout=2,
            decode_responses=True,
        )
        await asyncio.to_thread(client.ping)

        return HealthCheckResult(
            component=component,
            status=HealthStatus.OK,
            details="Redis reachable",
            latency_ms=_elapsed_ms(start),
        )
    except Exception as exc:  # pragma: no cover - network failures
        return HealthCheckResult(
            component=component,
            status=HealthStatus.CRITICAL,
            details=f"Redis unreachable: {exc}",
            latency_ms=_elapsed_ms(start),
        )


async def _check_celery() -> HealthCheckResult:
    component = "celery"
    start = time.perf_counter()

    try:
        result = await asyncio.to_thread(lambda: celery_app.control.ping(timeout=1.0))

        if not result:
            return HealthCheckResult(
                component=component,
                status=HealthStatus.DEGRADED,
                details="No Celery workers responded to ping",
                latency_ms=_elapsed_ms(start),
            )

        return HealthCheckResult(
            component=component,
            status=HealthStatus.OK,
            details=f"{len(result)} worker(s) responding",
            latency_ms=_elapsed_ms(start),
        )
    except Exception as exc:  # pragma: no cover - network failures
        return HealthCheckResult(
            component=component,
            status=HealthStatus.DEGRADED,
            details=f"Celery ping failed: {exc}",
            latency_ms=_elapsed_ms(start),
        )


async def _check_smtp() -> HealthCheckResult:
    component = "smtp"
    start = time.perf_counter()

    host = settings.SMTP_HOST
    port = settings.SMTP_PORT

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

        smtp.quit()

        return HealthCheckResult(
            component=component,
            status=HealthStatus.OK,
            details="SMTP server reachable",
            latency_ms=_elapsed_ms(start),
            metadata={"host": host, "port": port},
        )
    except Exception as exc:  # pragma: no cover - network failures
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


async def _check_elevenlabs() -> HealthCheckResult:
    component = "elevenlabs"

    if not settings.ELEVENLABS_API_KEY:
        return HealthCheckResult(
            component=component,
            status=HealthStatus.NOT_CONFIGURED,
            details="ElevenLabs API key is not configured",
        )

    return HealthCheckResult(
        component=component,
        status=HealthStatus.OK,
        details="ElevenLabs API key configured",
    )


async def _check_cloudflare_r2() -> HealthCheckResult:
    component = "cloudflare_r2"

    required_env = [
        settings.CLOUDFLARE_ACCOUNT_ID,
        settings.CLOUDFLARE_ACCESS_KEY_ID,
        settings.CLOUDFLARE_SECRET_ACCESS_KEY,
        settings.CLOUDFLARE_BUCKET_NAME,
    ]

    if not all(required_env):
        missing = []
        if not settings.CLOUDFLARE_ACCOUNT_ID:
            missing.append("CLOUDFLARE_ACCOUNT_ID")
        if not settings.CLOUDFLARE_ACCESS_KEY_ID:
            missing.append("CLOUDFLARE_ACCESS_KEY_ID")
        if not settings.CLOUDFLARE_SECRET_ACCESS_KEY:
            missing.append("CLOUDFLARE_SECRET_ACCESS_KEY")
        if not settings.CLOUDFLARE_BUCKET_NAME:
            missing.append("CLOUDFLARE_BUCKET_NAME")

        return HealthCheckResult(
            component=component,
            status=HealthStatus.NOT_CONFIGURED,
            details="Cloudflare R2 credentials missing",
            metadata={"missing": missing},
        )

    # Avoid making an S3 call (boto3 optional); treat config as sufficient.
    return HealthCheckResult(
        component=component,
        status=HealthStatus.OK,
        details="Cloudflare R2 credentials configured",
    )


async def _check_environment() -> HealthCheckResult:
    component = "environment"
    metadata = {
        "environment": settings.ENVIRONMENT,
        "debug": settings.DEBUG,
    }

    return HealthCheckResult(
        component=component,
        status=HealthStatus.OK,
        details="Environment variables loaded",
        metadata=metadata,
    )


async def gather_health_checks() -> List[HealthCheckResult]:
    checks = await asyncio.gather(
        _check_environment(),
        _check_supabase(),
        _check_redis(),
        _check_celery(),
        _check_smtp(),
        _check_openai(),
        _check_elevenlabs(),
        _check_cloudflare_r2(),
    )

    return list(checks)


def _aggregate_status(checks: List[HealthCheckResult]) -> HealthStatus:
    if any(check.status == HealthStatus.CRITICAL for check in checks):
        return HealthStatus.CRITICAL

    if any(check.status == HealthStatus.DEGRADED for check in checks):
        return HealthStatus.DEGRADED

    if all(check.status == HealthStatus.NOT_CONFIGURED for check in checks):
        return HealthStatus.NOT_CONFIGURED

    return HealthStatus.OK


async def build_health_report(api_version: str) -> HealthReport:
    checks = await gather_health_checks()
    overall_status = _aggregate_status(checks)

    report = HealthReport(
        status=overall_status,
        version=api_version,
        environment=settings.ENVIRONMENT,
        timestamp=datetime.now(timezone.utc),
        checks=checks,
    )

    try:
        await _record_health_history(report)
    except Exception:  # pragma: no cover - best effort logging
        logger.exception("Failed to record health history snapshot")

    return report


def _derive_history_summary(
    status: HealthStatus, impacted: List[Dict[str, Any]]
) -> Dict[str, Any]:
    if not impacted:
        return {
            "summary_key": "health.history.summary.operational",
            "summary_params": {},
        }

    if len(impacted) == 1:
        item = impacted[0]
        return {
            "summary_key": "health.history.summary.single",
            "summary_params": {
                "component": item["component"],
                "status": item["status"],
            },
        }

    return {
        "summary_key": "health.history.summary.multiple",
        "summary_params": {
            "count": len(impacted),
            "status": status.value,
        },
    }


def _serialize_impacted(checks: List[HealthCheckResult]) -> List[Dict[str, Any]]:
    impacted: List[Dict[str, Any]] = []
    for check in checks:
        if check.status in (HealthStatus.OK, HealthStatus.NOT_CONFIGURED):
            continue
        impacted.append(
            {
                "component": check.component,
                "label": COMPONENT_LABELS.get(
                    check.component, check.component.replace("_", " ").title()
                ),
                "status": check.status.value,
                "details": check.details,
                "latency_ms": check.latency_ms,
            }
        )
    return impacted


async def _record_health_history(report: HealthReport) -> None:
    if report.status not in {HealthStatus.CRITICAL, HealthStatus.DEGRADED}:
        return

    supabase = get_supabase_client()
    impacted = _serialize_impacted(report.checks)
    summary = _derive_history_summary(report.status, impacted)

    payload = {
        "status": report.status.value,
        "environment": report.environment,
        "version": report.version,
        "summary_key": summary["summary_key"],
        "summary_params": summary["summary_params"],
        "impacted": impacted,
        "report": report.model_dump(mode="json"),
    }

    try:
        latest_response = await asyncio.to_thread(
            lambda: supabase.table("system_health_history")
            .select("id,created_at,status,summary_key,summary_params")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception as exc:  # pragma: no cover - logging only
        logger.warning("Unable to read health history: %s", exc)
        latest_response = None

    should_insert = True
    latest_entry = None
    if latest_response and getattr(latest_response, "data", None):
        latest_entry = latest_response.data[0]

    if latest_entry:
        created_raw = latest_entry.get("created_at")
        created_at = (
            datetime.fromisoformat(created_raw.replace("Z", "+00:00"))
            if created_raw
            else None
        )
        same_status = latest_entry.get("status") == payload["status"]
        same_summary = (
            latest_entry.get("summary_key") == payload["summary_key"]
            and latest_entry.get("summary_params") == payload["summary_params"]
        )

        within_24_hours = (
            created_at is not None
            and report.timestamp - created_at <= timedelta(hours=24)
        )

        if within_24_hours and same_status and same_summary:
            should_insert = False

    if not should_insert:
        return

    try:
        insert_response = await asyncio.to_thread(
            lambda: supabase.table("system_health_history").insert(payload).execute()
        )
    except Exception as exc:  # pragma: no cover - logging only
        logger.exception("Failed to write health history snapshot: %s", exc)
        return

    inserted = getattr(insert_response, "data", None) or []
    if not inserted:
        return

    history_id = inserted[0].get("id")
    if not history_id:
        return

    default_status, title, description = _build_default_update_text(
        report.status, impacted
    )
    try:
        await asyncio.to_thread(
            lambda: supabase.table("system_health_updates")
            .insert(
                {
                    "history_id": history_id,
                    "status": default_status.value,
                    "title": title,
                    "description": description,
                }
            )
            .execute()
        )
    except Exception:  # pragma: no cover - logging only
        logger.exception(
            "Failed to record default history update for incident %s", history_id
        )


async def fetch_health_history(limit: int = 20) -> List[HealthHistoryEntry]:
    supabase = get_supabase_client()
    try:
        response = await asyncio.to_thread(
            lambda: supabase.table("system_health_history")
            .select(
                "id,created_at,status,environment,version,summary_key,summary_params,impacted,updates:system_health_updates(id,created_at,status,title,description)"
            )
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
    except Exception as exc:  # pragma: no cover - logging only
        logger.exception("Failed to fetch health history: %s", exc)
        raise

    if getattr(response, "error", None):  # pragma: no cover - upstream error
        raise RuntimeError(str(response.error))

    records = getattr(response, "data", None) or []
    for record in records:
        updates_raw = record.get("updates") or []
        record["updates"] = [
            HealthHistoryUpdate(**update)
            for update in sorted(
                updates_raw, key=lambda item: item.get("created_at", "")
            )
        ]
    return [HealthHistoryEntry(**record) for record in records]


async def fetch_health_history_entry(history_id: str) -> HealthHistoryEntry | None:
    supabase = get_supabase_client()
    try:
        response = await asyncio.to_thread(
            lambda: supabase.table("system_health_history")
            .select(
                "id,created_at,status,environment,version,summary_key,summary_params,impacted,updates:system_health_updates(id,created_at,status,title,description)"
            )
            .eq("id", history_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:  # pragma: no cover - logging only
        logger.exception("Failed to fetch history entry %s: %s", history_id, exc)
        raise

    if getattr(response, "error", None):  # pragma: no cover - upstream error
        raise RuntimeError(str(response.error))

    data = getattr(response, "data", None) or []
    if not data:
        return None

    entry = data[0]
    updates_raw = entry.get("updates") or []
    entry["updates"] = [
        HealthHistoryUpdate(**update)
        for update in sorted(updates_raw, key=lambda item: item.get("created_at", ""))
    ]
    return HealthHistoryEntry(**entry)


async def create_health_history_update(
    history_id: str,
    status: HealthUpdateStatus,
    title: str,
    description: str,
) -> HealthHistoryUpdate:
    supabase = get_supabase_client()
    try:
        response = await asyncio.to_thread(
            lambda: supabase.table("system_health_updates")
            .insert(
                {
                    "history_id": history_id,
                    "status": status.value,
                    "title": title,
                    "description": description,
                }
            )
            .execute()
        )
    except Exception as exc:  # pragma: no cover - logging only
        logger.exception("Failed to create health history update: %s", exc)
        raise

    if getattr(response, "error", None):  # pragma: no cover - upstream error
        raise RuntimeError(str(response.error))

    data = getattr(response, "data", None) or []
    if not data:
        raise RuntimeError("No update returned from Supabase")

    return HealthHistoryUpdate(**data[0])


def _build_default_update_text(
    status: HealthStatus, impacted: List[Dict[str, Any]]
) -> tuple[HealthUpdateStatus, str, str]:
    default_state = HealthUpdateStatus.IDENTIFIED
    title = "Incident detected"

    if not impacted:
        description = (
            "Automated monitoring detected abnormal system behaviour. "
            "Engineering has been notified."
        )
        return default_state, title, description

    if len(impacted) == 1:
        component = impacted[0]
        component_name = component.get("label") or component.get("component")
        component_status = component.get("status", status.value)
        description = (
            f"{component_name} is currently {component_status}. "
            "Engineering has been notified."
        )
        return default_state, title, description

    affected_components = ", ".join(
        (item.get("label") or item.get("component")) for item in impacted
    )
    description = (
        f"Multiple components ({affected_components}) are experiencing "
        f"{status.value} conditions. Engineering has been notified."
    )
    return default_state, title, description
