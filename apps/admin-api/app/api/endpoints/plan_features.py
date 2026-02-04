"""
Plan Features Management Endpoints
CRUD for plan_features table (feature gating per plan).
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from app.core.admin_auth import get_current_admin, log_admin_action
from app.core.database import get_supabase_client, first_row

router = APIRouter(prefix="/plan-features", tags=["Plan Features"])


class PlanFeatureItem(BaseModel):
    id: str
    plan_id: str
    feature_key: str
    feature_name: str
    feature_description: Optional[str]
    feature_value: Optional[int]
    is_enabled: bool
    sort_order: int
    ai_description: Optional[str]
    created_at: str
    updated_at: str


class PlanFeaturesListResponse(BaseModel):
    items: List[PlanFeatureItem]


class PlanFeatureUpdatePayload(BaseModel):
    feature_name: Optional[str] = None
    feature_description: Optional[str] = None
    feature_value: Optional[int] = None
    is_enabled: Optional[bool] = None
    sort_order: Optional[int] = None
    ai_description: Optional[str] = None


def _row_to_feature(row: dict) -> PlanFeatureItem:
    return PlanFeatureItem(
        id=row["id"],
        plan_id=row["plan_id"],
        feature_key=row["feature_key"],
        feature_name=row["feature_name"],
        feature_description=row.get("feature_description"),
        feature_value=row.get("feature_value"),
        is_enabled=row.get("is_enabled", True),
        sort_order=row.get("sort_order", 0),
        ai_description=row.get("ai_description"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.get("/by-plan/{plan_id}", response_model=PlanFeaturesListResponse)
async def list_plan_features(
    plan_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """
    List all features for a plan.
    """
    supabase = get_supabase_client()

    result = (
        supabase.table("plan_features")
        .select("*")
        .eq("plan_id", plan_id)
        .order("sort_order")
        .order("feature_key")
        .execute()
    )

    items = [_row_to_feature(row) for row in (result.data or [])]
    return PlanFeaturesListResponse(items=items)


@router.put("/{feature_id}", response_model=PlanFeatureItem)
async def update_plan_feature(
    feature_id: str,
    payload: PlanFeatureUpdatePayload,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Update a plan feature. Audited.
    """
    supabase = get_supabase_client()

    existing = (
        supabase.table("plan_features")
        .select("*")
        .eq("id", feature_id)
        .maybe_single()
        .execute()
    )

    if not existing.data:
        raise HTTPException(status_code=404, detail="Plan feature not found")

    try:
        old_row = first_row(existing.data)
        update_data = payload.model_dump(exclude_unset=True)

        if not update_data:
            return _row_to_feature(old_row)

        result = (
            supabase.table("plan_features")
            .update(update_data)
            .eq("id", feature_id)
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=500, detail="Update failed")

        await log_admin_action(
            admin_user_id=current_admin["id"],
            action="update",
            resource_type="plan_feature",
            resource_id=feature_id,
            details={
                "plan_id": old_row["plan_id"],
                "feature_key": old_row["feature_key"],
                "old_values": {k: old_row.get(k) for k in update_data},
                "new_values": update_data,
            },
        )

        return _row_to_feature(first_row(result.data))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
