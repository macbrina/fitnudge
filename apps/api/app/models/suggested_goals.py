from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


SuggestedGoalsStatus = Literal["pending", "ready", "failed"]


class SuggestedGoalItem(BaseModel):
    id: str = Field(..., description="Unique identifier for the suggested goal")
    title: str = Field(..., description="Goal title to display to the user")
    description: str = Field(..., description="Detailed explanation of the goal")
    category: str = Field(..., description="Goal category aligned with goal table enum")
    frequency: str = Field(..., description="Frequency string (e.g., weekly)")
    target_days: Optional[int] = Field(
        None, description="Optional number of target days per week"
    )
    days_of_week: Optional[List[int]] = Field(
        None,
        description="Array of day numbers (0-6) for weekly goals. 0=Sunday, 1=Monday, ..., 6=Saturday",
    )
    reminder_times: List[str] = Field(
        default_factory=list,
        description="ISO time strings for reminders associated with the goal",
    )
    match_reason: Optional[str] = Field(
        None, description="Explanation of why this goal matches the user"
    )
    # Goal type fields
    goal_type: Optional[str] = Field(
        default="habit",
        description="Type of goal: habit, time_challenge, or target_challenge",
    )
    duration_days: Optional[int] = Field(
        None, description="For time_challenge: duration in days (30, 60, 90)"
    )
    target_checkins: Optional[int] = Field(
        None, description="For target_challenge: number of check-ins to complete"
    )
    # Social/sharing fields
    is_challenge_candidate: Optional[bool] = Field(
        default=False,
        description="Whether this goal is good for sharing as a challenge with friends",
    )
    sharing_recommendation: Optional[str] = Field(
        None,
        description="Sharing recommendation: great_for_friends, good_for_competition, or null",
    )


class SuggestedGoalsRecord(BaseModel):
    id: str
    user_id: str
    status: SuggestedGoalsStatus = "pending"
    goals: Optional[List[SuggestedGoalItem]] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
