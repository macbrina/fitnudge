"""
User Reports Management Endpoints
Review, action, and dismiss user reports (inappropriate_username, harassment, spam, other)
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from app.core.admin_auth import get_current_admin, log_admin_action
from app.core.database import get_supabase_client, first_row

router = APIRouter(prefix="/user-reports", tags=["User Reports"])


class ReportSummary(BaseModel):
    id: str
    reporter_id: str
    reporter_email: str | None
    reported_user_id: str
    reported_user_email: str | None
    reported_username: str | None
    reason: str
    details: str | None
    status: str
    admin_notes: str | None
    created_at: str
    reviewed_at: str | None


class ReportDetail(BaseModel):
    id: str
    reporter_id: str
    reporter_email: str | None
    reporter_name: str | None
    reported_user_id: str
    reported_user_email: str | None
    reported_user_name: str | None
    reported_username: str | None
    reason: str
    details: str | None
    status: str
    admin_notes: str | None
    created_at: str
    reviewed_at: str | None
    reviewed_by: str | None


class ReportStats(BaseModel):
    total: int
    pending: int
    reviewed: int
    actioned: int
    dismissed: int
    by_reason: dict


class ReportUpdate(BaseModel):
    status: Optional[str] = None  # pending, reviewed, actioned, dismissed
    admin_notes: Optional[str] = None


@router.get("/stats", response_model=ReportStats)
async def get_report_stats(current_admin: dict = Depends(get_current_admin)):
    """
    Get user report statistics
    """
    supabase = get_supabase_client()

    total_result = supabase.table("user_reports").select("id", count="exact").execute()

    pending_result = (
        supabase.table("user_reports")
        .select("id", count="exact")
        .eq("status", "pending")
        .execute()
    )
    reviewed_result = (
        supabase.table("user_reports")
        .select("id", count="exact")
        .eq("status", "reviewed")
        .execute()
    )
    actioned_result = (
        supabase.table("user_reports")
        .select("id", count="exact")
        .eq("status", "actioned")
        .execute()
    )
    dismissed_result = (
        supabase.table("user_reports")
        .select("id", count="exact")
        .eq("status", "dismissed")
        .execute()
    )

    # By reason
    reasons = ["inappropriate_username", "harassment", "spam", "other"]
    by_reason = {}
    for r in reasons:
        res = (
            supabase.table("user_reports")
            .select("id", count="exact")
            .eq("reason", r)
            .execute()
        )
        by_reason[r] = res.count or 0

    return ReportStats(
        total=total_result.count or 0,
        pending=pending_result.count or 0,
        reviewed=reviewed_result.count or 0,
        actioned=actioned_result.count or 0,
        dismissed=dismissed_result.count or 0,
        by_reason=by_reason,
    )


@router.get("")
async def list_reports(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by status"),
    reason: Optional[str] = Query(None, description="Filter by reason"),
    current_admin: dict = Depends(get_current_admin),
):
    """
    List user reports with pagination and filtering
    """
    supabase = get_supabase_client()

    # Select report fields + reporter and reported user emails via foreign keys
    # Supabase allows: user_reports(*, reporter:users(email,name), reported:users(email,name))
    # But we need reporter_id -> users, reported_user_id -> users
    # Supabase foreign key syntax: table.column references other_table
    # For user_reports: reporter_id -> users(id), reported_user_id -> users(id)
    query = supabase.table("user_reports").select(
        "id, reporter_id, reported_user_id, reported_username, reason, details, "
        "status, admin_notes, created_at, reviewed_at, reviewed_by",
        count="exact",
    )

    if status:
        query = query.eq("status", status)
    if reason:
        query = query.eq("reason", reason)

    offset = (page - 1) * per_page
    query = query.order("created_at", desc=True).range(offset, offset + per_page - 1)

    result = query.execute()

    # Fetch reporter and reported user emails
    reporter_ids = list({r["reporter_id"] for r in result.data})
    reported_ids = list({r["reported_user_id"] for r in result.data})
    all_user_ids = list(set(reporter_ids + reported_ids))

    user_emails = {}
    user_names = {}
    if all_user_ids:
        users_result = (
            supabase.table("users")
            .select("id, email, name")
            .in_("id", all_user_ids)
            .execute()
        )
        for u in users_result.data or []:
            user_emails[u["id"]] = u.get("email")
            user_names[u["id"]] = u.get("name")

    reports = [
        {
            "id": r["id"],
            "reporter_id": r["reporter_id"],
            "reporter_email": user_emails.get(r["reporter_id"]),
            "reported_user_id": r["reported_user_id"],
            "reported_user_email": user_emails.get(r["reported_user_id"]),
            "reported_username": r.get("reported_username"),
            "reason": r["reason"],
            "details": r.get("details"),
            "status": r["status"],
            "admin_notes": r.get("admin_notes"),
            "created_at": r["created_at"],
            "reviewed_at": r.get("reviewed_at"),
        }
        for r in result.data
    ]

    return {
        "reports": reports,
        "total": result.count or len(reports),
        "page": page,
        "per_page": per_page,
    }


@router.get("/{report_id}")
async def get_report(
    report_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Get report detail
    """
    supabase = get_supabase_client()

    result = (
        supabase.table("user_reports")
        .select("*")
        .eq("id", report_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )

    r = first_row(result.data)
    reporter_id = r["reporter_id"]
    reported_id = r["reported_user_id"]

    # Fetch user details
    users_result = (
        supabase.table("users")
        .select("id, email, name")
        .in_("id", [reporter_id, reported_id])
        .execute()
    )
    by_id = {u["id"]: u for u in (users_result.data or [])}

    reporter = by_id.get(reporter_id, {})
    reported = by_id.get(reported_id, {})

    return {
        "id": r["id"],
        "reporter_id": reporter_id,
        "reporter_email": reporter.get("email"),
        "reporter_name": reporter.get("name"),
        "reported_user_id": reported_id,
        "reported_user_email": reported.get("email"),
        "reported_user_name": reported.get("name"),
        "reported_username": r.get("reported_username"),
        "reason": r["reason"],
        "details": r.get("details"),
        "status": r["status"],
        "admin_notes": r.get("admin_notes"),
        "created_at": r["created_at"],
        "reviewed_at": r.get("reviewed_at"),
        "reviewed_by": r.get("reviewed_by"),
    }


@router.patch("/{report_id}")
async def update_report(
    report_id: str,
    update: ReportUpdate,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Update report status and/or admin notes
    """
    supabase = get_supabase_client()

    update_data = {}
    if update.status is not None:
        if update.status not in ["pending", "reviewed", "actioned", "dismissed"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status value",
            )
        update_data["status"] = update.status
        if update.status in ("reviewed", "actioned", "dismissed"):
            update_data["reviewed_at"] = datetime.now(timezone.utc).isoformat()
            update_data["reviewed_by"] = current_admin["id"]

    if update.admin_notes is not None:
        update_data["admin_notes"] = update.admin_notes

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid fields to update",
        )

    result = (
        supabase.table("user_reports")
        .update(update_data)
        .eq("id", report_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )

    await log_admin_action(
        admin_user_id=current_admin["id"],
        action="update_user_report",
        resource_type="user_report",
        resource_id=report_id,
        details=update_data,
    )

    # Send push notifications when admin updates report status
    if update.status in ("actioned", "reviewed", "dismissed"):
        report_row = first_row(result.data)
        reported_user_id = report_row.get("reported_user_id")
        reporter_id = report_row.get("reporter_id")
        reported_username = report_row.get("reported_username") or ""
        admin_notes = report_row.get("admin_notes") or update_data.get("admin_notes") or ""

        try:
            from app.services.notification_service import send_push_to_user_sync
            import logging

            _logger = logging.getLogger(__name__)
            data_payload = {
                "type": "general",
                "subtype": "report_resolution",
                "entity_type": "user_report",
                "entity_id": report_id,
            }

            # Notify reporter (the one who filed the report) - always when actioned, reviewed, or dismissed
            if reporter_id:
                body_parts = []
                if reported_username:
                    body_parts.append(f"Your report regarding @{reported_username}")
                else:
                    body_parts.append("Your report")
                if update.status == "actioned":
                    body_parts.append("has been reviewed and our team has taken action.")
                elif update.status == "dismissed":
                    body_parts.append("has been dismissed.")
                else:
                    body_parts.append("has been reviewed.")
                if admin_notes:
                    body_parts.append(f"Notes: {admin_notes}")
                try:
                    send_push_to_user_sync(
                        user_id=reporter_id,
                        title="Report update",
                        body=" ".join(body_parts),
                        data=data_payload,
                        notification_type="general",
                        entity_type="user_report",
                        entity_id=report_id,
                        save_to_notification_history=True,
                    )
                except Exception as e:
                    _logger.warning(
                        f"Failed to send report notification to reporter {reporter_id}: {e}"
                    )

            # Notify reported user (the one who was reported) - only when actioned
            if update.status == "actioned" and reported_user_id:
                body_parts = []
                if reported_username:
                    body_parts.append(f"Your account (@{reported_username}) was reported.")
                else:
                    body_parts.append("Your account was reported.")
                body_parts.append("Our team has reviewed and taken action.")
                if admin_notes:
                    body_parts.append(f"Notes: {admin_notes}")
                try:
                    send_push_to_user_sync(
                        user_id=reported_user_id,
                        title="Report resolution",
                        body=" ".join(body_parts),
                        data=data_payload,
                        notification_type="general",
                        entity_type="user_report",
                        entity_id=report_id,
                        save_to_notification_history=True,
                    )
                except Exception as e:
                    _logger.warning(
                        f"Failed to send report resolution notification to reported user {reported_user_id}: {e}"
                    )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to send report notifications: {e}")

    return {"message": "Report updated", "updated_fields": list(update_data.keys())}
