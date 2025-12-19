"""
Exercise API Endpoints

Provides access to exercise database for exercise details, search, and filtering.
"""

from fastapi import APIRouter, HTTPException, status, Query
from typing import Optional, List
from pydantic import BaseModel

from app.services.exercise_service import (
    get_exercise_by_id,
    search_exercises,
    get_popular_exercises,
)

router = APIRouter()


class ExerciseResponse(BaseModel):
    """Exercise response model"""

    id: str
    name: str
    body_part: Optional[str] = None
    equipment: Optional[str] = None
    target_muscle: Optional[str] = None
    secondary_muscles: Optional[List[str]] = None
    instructions: Optional[List[str]] = None
    description: Optional[str] = None
    difficulty: Optional[str] = None
    category: Optional[str] = None
    mp4_url: Optional[str] = None


class ExerciseListResponse(BaseModel):
    """Exercise list response model"""

    exercises: List[ExerciseResponse]
    total: int


@router.get("/{exercise_id}", response_model=ExerciseResponse)
async def get_exercise(exercise_id: str):
    """
    Get exercise details by ID.

    Returns full exercise information including MP4 video URL, instructions,
    target muscles, and metadata.
    """
    exercise = get_exercise_by_id(exercise_id)

    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exercise with ID '{exercise_id}' not found",
        )

    return exercise


@router.get("/", response_model=ExerciseListResponse)
async def list_exercises(
    query: Optional[str] = Query(None, description="Search query for exercise name"),
    body_part: Optional[str] = Query(None, description="Filter by body part"),
    equipment: Optional[str] = Query(None, description="Filter by equipment"),
    difficulty: Optional[str] = Query(None, description="Filter by difficulty level"),
    category: Optional[str] = Query(None, description="Filter by category"),
    target_muscle: Optional[str] = Query(None, description="Filter by target muscle"),
    limit: int = Query(50, ge=1, le=100, description="Maximum results to return"),
):
    """
    Search and filter exercises.

    Supports filtering by body part, equipment, difficulty, category, and target muscle.
    """
    exercises = search_exercises(
        query=query or "",
        body_part=body_part,
        equipment=equipment,
        difficulty=difficulty,
        category=category,
        target_muscle=target_muscle,
        limit=limit,
    )

    return ExerciseListResponse(exercises=exercises, total=len(exercises))


@router.get("/popular/list", response_model=ExerciseListResponse)
async def get_popular(
    limit: int = Query(20, ge=1, le=100, description="Number of exercises to return"),
):
    """
    Get most popular exercises based on usage in generated plans.
    """
    exercises = get_popular_exercises(limit=limit)

    return ExerciseListResponse(exercises=exercises, total=len(exercises))
