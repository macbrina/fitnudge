"""
Social Accountability API endpoints

Handles goal sharing, accountability partners, and group goals.
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from app.core.flexible_auth import get_current_user
from app.services.logger import logger
from app.services.social_accountability_service import social_accountability_service

router = APIRouter(redirect_slashes=False)


# Pydantic models
class GoalShareCreate(BaseModel):
    shared_with_user_id: str
    permission_level: str = "view"  # view, comment, motivate


class GoalShareResponse(BaseModel):
    id: str
    goal_id: str
    shared_with_user_id: str
    permission_level: str
    shared_by_user_id: str
    is_active: bool
    created_at: str
    updated_at: str


class AccountabilityPartnerRequest(BaseModel):
    partner_user_id: str


class AccountabilityPartnerResponse(BaseModel):
    id: str
    user_id: str
    partner_user_id: str
    status: str
    initiated_by_user_id: str
    created_at: str
    accepted_at: Optional[str]


class GroupGoalMemberAdd(BaseModel):
    user_id: str
    role: str = "member"  # member, admin


class GroupGoalResponse(BaseModel):
    id: str
    goal_id: str
    user_id: str
    role: str
    joined_at: str
    is_active: bool


# Goal Sharing Endpoints
@router.post(
    "/goals/{goal_id}/share",
    response_model=GoalShareResponse,
    status_code=status.HTTP_201_CREATED,
)
async def share_goal(
    goal_id: str,
    share_data: GoalShareCreate,
    current_user: dict = Depends(get_current_user),
):
    """Share a goal with a specific user"""
    try:
        result = await social_accountability_service.share_goal_with_user(
            goal_id=goal_id,
            shared_with_user_id=share_data.shared_with_user_id,
            owner_user_id=current_user["id"],
            permission_level=share_data.permission_level,
        )
        return result

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            f"Failed to share goal {goal_id} for user {current_user['id']}",
            {"error": str(e), "goal_id": goal_id, "user_id": current_user["id"]},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to share goal",
        )


@router.delete("/goals/{goal_id}/share/{shared_with_user_id}")
async def unshare_goal(
    goal_id: str,
    shared_with_user_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Unshare a goal with a user"""
    try:
        await social_accountability_service.unshare_goal(
            goal_id=goal_id,
            shared_with_user_id=shared_with_user_id,
            owner_user_id=current_user["id"],
        )
        return {"message": "Goal unshared successfully"}

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            f"Failed to unshare goal {goal_id} for user {current_user['id']}",
            {"error": str(e), "goal_id": goal_id, "user_id": current_user["id"]},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to unshare goal",
        )


@router.get("/goals/shared-with-me", response_model=List[dict])
async def get_goals_shared_with_me(
    current_user: dict = Depends(get_current_user),
):
    """Get goals shared with the current user"""
    try:
        result = await social_accountability_service.get_shared_goals(
            user_id=current_user["id"], include_my_shared=False
        )
        return result

    except Exception as e:
        logger.error(
            f"Failed to get shared goals for user {current_user['id']}",
            {"error": str(e), "user_id": current_user["id"]},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get shared goals",
        )


@router.get("/goals/my-shared", response_model=List[dict])
async def get_my_shared_goals(
    current_user: dict = Depends(get_current_user),
):
    """Get goals shared by the current user"""
    try:
        result = await social_accountability_service.get_shared_goals(
            user_id=current_user["id"], include_my_shared=True
        )
        return result

    except Exception as e:
        logger.error(
            f"Failed to get my shared goals for user {current_user['id']}",
            {"error": str(e), "user_id": current_user["id"]},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get shared goals",
        )


# Accountability Partners Endpoints
@router.post(
    "/accountability-partners/request",
    response_model=AccountabilityPartnerResponse,
    status_code=status.HTTP_201_CREATED,
)
async def request_accountability_partner(
    request_data: AccountabilityPartnerRequest,
    current_user: dict = Depends(get_current_user),
):
    """Request an accountability partnership"""
    try:
        result = await social_accountability_service.request_accountability_partner(
            user_id=current_user["id"],
            partner_user_id=request_data.partner_user_id,
        )
        return result

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            f"Failed to request accountability partner for user {current_user['id']}",
            {"error": str(e), "user_id": current_user["id"]},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to request accountability partner",
        )


@router.post("/accountability-partners/{partner_user_id}/accept")
async def accept_accountability_partner(
    partner_user_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Accept an accountability partnership request"""
    try:
        await social_accountability_service.accept_accountability_partner(
            user_id=current_user["id"], partner_user_id=partner_user_id
        )
        return {"message": "Partnership accepted successfully"}

    except Exception as e:
        logger.error(
            f"Failed to accept accountability partner for user {current_user['id']}",
            {"error": str(e), "user_id": current_user["id"]},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to accept accountability partner",
        )


# Group Goals Endpoints
@router.post(
    "/goals/{goal_id}/group",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
)
async def create_group_goal(
    goal_id: str,
    member_user_ids: List[str],
    current_user: dict = Depends(get_current_user),
):
    """Create a group goal and add members"""
    try:
        result = await social_accountability_service.create_group_goal(
            goal_id=goal_id,
            owner_user_id=current_user["id"],
            member_user_ids=member_user_ids,
        )
        return result

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            f"Failed to create group goal {goal_id} for user {current_user['id']}",
            {"error": str(e), "goal_id": goal_id, "user_id": current_user["id"]},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create group goal",
        )


@router.post(
    "/goals/{goal_id}/group/members",
    response_model=GroupGoalResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_group_goal_member(
    goal_id: str,
    member_data: GroupGoalMemberAdd,
    current_user: dict = Depends(get_current_user),
):
    """Add a member to a group goal"""
    try:
        result = await social_accountability_service.add_group_goal_member(
            goal_id=goal_id,
            user_id=member_data.user_id,
            admin_user_id=current_user["id"],
            role=member_data.role,
        )
        return result

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            f"Failed to add member to group goal {goal_id} for user {current_user['id']}",
            {"error": str(e), "goal_id": goal_id, "user_id": current_user["id"]},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add group goal member",
        )


@router.get("/goals/group", response_model=List[dict])
async def get_group_goals(
    current_user: dict = Depends(get_current_user),
):
    """Get all group goals the user is part of"""
    try:
        result = await social_accountability_service.get_group_goals(
            user_id=current_user["id"]
        )
        return result

    except Exception as e:
        logger.error(
            f"Failed to get group goals for user {current_user['id']}",
            {"error": str(e), "user_id": current_user["id"]},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get group goals",
        )
