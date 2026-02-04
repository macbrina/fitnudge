"""
Legal Documents Management Endpoints
CRUD for legal_documents table (ToS, Privacy Policy, Cookie Policy).
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from typing_extensions import Literal

from app.core.admin_auth import get_current_admin, log_admin_action
from app.core.database import get_supabase_client, first_row

router = APIRouter(prefix="/legal-documents", tags=["Legal Documents"])

DocType = Literal["terms_of_service", "privacy_policy", "cookie_policy"]


class LegalDocumentItem(BaseModel):
    id: str
    type: str
    version: str
    title: str
    content: str
    summary: Optional[str]
    effective_date: str
    is_current: bool
    created_at: str
    updated_at: str


class LegalDocumentListResponse(BaseModel):
    items: List[LegalDocumentItem]


class LegalDocumentCreatePayload(BaseModel):
    type: DocType
    version: str
    title: str
    content: str
    summary: Optional[str] = None
    effective_date: str
    is_current: bool = False


class LegalDocumentUpdatePayload(BaseModel):
    version: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    summary: Optional[str] = None
    effective_date: Optional[str] = None
    is_current: Optional[bool] = None


def _row_to_item(row: dict) -> LegalDocumentItem:
    return LegalDocumentItem(
        id=row["id"],
        type=row["type"],
        version=row["version"],
        title=row["title"],
        content=row["content"],
        summary=row.get("summary"),
        effective_date=row["effective_date"],
        is_current=row.get("is_current", False),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.get("", response_model=LegalDocumentListResponse)
async def list_legal_documents(
    current_admin: dict = Depends(get_current_admin),
    type_filter: Optional[DocType] = Query(None, alias="type"),
):
    """
    List legal documents, optionally filtered by type.
    """
    supabase = get_supabase_client()

    query = supabase.table("legal_documents").select("*").order("type").order(
        "effective_date", desc=True
    )

    if type_filter:
        query = query.eq("type", type_filter)

    result = query.execute()
    items = [_row_to_item(row) for row in (result.data or [])]
    return LegalDocumentListResponse(items=items)


@router.get("/{doc_id}", response_model=LegalDocumentItem)
async def get_legal_document(
    doc_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Get a single legal document by ID.
    """
    supabase = get_supabase_client()

    result = (
        supabase.table("legal_documents")
        .select("*")
        .eq("id", doc_id)
        .maybe_single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found")

    return _row_to_item(result.data)


@router.post("", response_model=LegalDocumentItem)
async def create_legal_document(
    payload: LegalDocumentCreatePayload,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Create a new legal document version. Audited.
    """
    supabase = get_supabase_client()

    insert_data = {
        "type": payload.type,
        "version": payload.version,
        "title": payload.title,
        "content": payload.content,
        "summary": payload.summary,
        "effective_date": payload.effective_date,
        "is_current": payload.is_current,
    }

    try:
        result = (
            supabase.table("legal_documents")
            .insert(insert_data)
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=500, detail="Create failed")

        row = first_row(result.data)
        await log_admin_action(
            admin_user_id=current_admin["id"],
            action="create",
            resource_type="legal_document",
            resource_id=row["id"],
            details={"type": payload.type, "version": payload.version},
        )

        return _row_to_item(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{doc_id}", response_model=LegalDocumentItem)
async def update_legal_document(
    doc_id: str,
    payload: LegalDocumentUpdatePayload,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Update a legal document. Audited.
    """
    supabase = get_supabase_client()

    existing = (
        supabase.table("legal_documents")
        .select("*")
        .eq("id", doc_id)
        .maybe_single()
        .execute()
    )

    if not existing.data:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        old_row = first_row(existing.data)
        update_data = payload.model_dump(exclude_unset=True)

        if not update_data:
            return _row_to_item(old_row)

        result = (
            supabase.table("legal_documents")
            .update(update_data)
            .eq("id", doc_id)
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=500, detail="Update failed")

        await log_admin_action(
            admin_user_id=current_admin["id"],
            action="update",
            resource_type="legal_document",
            resource_id=doc_id,
            details={"old_values": {k: old_row.get(k) for k in update_data}, "new_values": update_data},
        )

        return _row_to_item(first_row(result.data))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{doc_id}/set-current", response_model=LegalDocumentItem)
async def set_current_legal_document(
    doc_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Mark a legal document as the current version for its type. Audited.
    """
    supabase = get_supabase_client()

    existing = (
        supabase.table("legal_documents")
        .select("*")
        .eq("id", doc_id)
        .maybe_single()
        .execute()
    )

    if not existing.data:
        raise HTTPException(status_code=404, detail="Document not found")

    result = (
        supabase.table("legal_documents")
        .update({"is_current": True})
        .eq("id", doc_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=500, detail="Update failed")

    old_row = first_row(existing.data)
    await log_admin_action(
        admin_user_id=current_admin["id"],
        action="set_current",
        resource_type="legal_document",
        resource_id=doc_id,
        details={"type": old_row["type"], "version": old_row["version"]},
    )

    return _row_to_item(first_row(result.data))


@router.delete("/{doc_id}")
async def delete_legal_document(
    doc_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Delete a legal document. Only allowed if not current.
    """
    supabase = get_supabase_client()

    existing = (
        supabase.table("legal_documents")
        .select("id, is_current, type, version")
        .eq("id", doc_id)
        .maybe_single()
        .execute()
    )

    if not existing.data:
        raise HTTPException(status_code=404, detail="Document not found")

    old_row = first_row(existing.data)
    if old_row.get("is_current"):
        raise HTTPException(
            status_code=400,
            detail="Cannot delete the current version. Set another as current first.",
        )

    supabase.table("legal_documents").delete().eq("id", doc_id).execute()

    await log_admin_action(
        admin_user_id=current_admin["id"],
        action="delete",
        resource_type="legal_document",
        resource_id=doc_id,
        details={"type": old_row["type"], "version": old_row["version"]},
    )

    return {"message": "Document deleted"}
