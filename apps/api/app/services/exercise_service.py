"""
Exercise Service

Provides exercise data from local database (no external API calls).
Fast, reliable, and self-hosted exercise demonstrations and metadata.

Source: ExerciseDB one-time purchase ($129) - 1324 exercises
"""

from typing import Optional, Dict, Any, List
from app.core.database import get_supabase_client
from app.services.logger import logger


def get_exercise_by_name(exercise_name: str) -> Optional[Dict[str, Any]]:
    """
    Get exercise data by name from local database.

    Args:
        exercise_name: Name of the exercise (case-insensitive)

    Returns:
        Exercise dict with GIF URLs and metadata, or None if not found

    Performance: ~5-10ms (database lookup with index)
    """
    if not exercise_name:
        return None

    supabase = get_supabase_client()

    try:
        # Search by name (case-insensitive)
        result = (
            supabase.table("exercises")
            .select("*")
            .ilike("name", exercise_name.strip())
            .limit(1)
            .execute()
        )

        if result.data and len(result.data) > 0:
            exercise = result.data[0]

            # Update usage tracking (fire and forget)
            try:
                supabase.table("exercises").update(
                    {
                        "usage_count": exercise.get("usage_count", 0) + 1,
                        "last_used_at": "now()",
                    }
                ).eq("id", exercise["id"]).execute()
            except Exception:
                pass  # Don't fail if tracking update fails

            print(f"Exercise found: {exercise_name}")
            return exercise

        # Try fuzzy search if exact match fails
        fuzzy_result = (
            supabase.table("exercises")
            .select("*")
            .ilike("name", f"%{exercise_name.strip()}%")
            .limit(1)
            .execute()
        )

        if fuzzy_result.data and len(fuzzy_result.data) > 0:
            print(f"Exercise found (fuzzy): {exercise_name}")
            return fuzzy_result.data[0]

        print(f"Exercise not found: {exercise_name}")
        return None

    except Exception as e:
        logger.error(f"Error fetching exercise '{exercise_name}': {e}")
        return None


def get_exercise_by_id(exercise_id: str) -> Optional[Dict[str, Any]]:
    """
    Get exercise data by ID.

    Args:
        exercise_id: Exercise ID (e.g., "0001")

    Returns:
        Exercise dict with GIF URLs and metadata, or None if not found
    """
    if not exercise_id:
        return None

    supabase = get_supabase_client()

    try:
        result = (
            supabase.table("exercises")
            .select("*")
            .eq("id", exercise_id)
            .maybe_single()
            .execute()
        )

        if result.data:
            logger.info(f"Exercise found by ID: {exercise_id}")
            return result.data

        return None

    except Exception as e:
        logger.error(f"Error fetching exercise by ID '{exercise_id}': {e}")
        return None


def search_exercises(
    query: str = "",
    body_part: Optional[str] = None,
    equipment: Optional[str] = None,
    difficulty: Optional[str] = None,
    category: Optional[str] = None,
    target_muscle: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """
    Search exercises with filters.

    Args:
        query: Search query (searches name and description)
        body_part: Filter by body part (e.g., "chest", "legs")
        equipment: Filter by equipment (e.g., "barbell", "body weight")
        difficulty: Filter by difficulty (e.g., "beginner")
        category: Filter by category (e.g., "strength", "cardio")
        target_muscle: Filter by target muscle (e.g., "pectorals")
        limit: Maximum results to return

    Returns:
        List of exercise dicts
    """
    supabase = get_supabase_client()

    try:
        query_builder = supabase.table("exercises").select("*")

        # Text search
        if query:
            query_builder = query_builder.ilike("name", f"%{query}%")

        # Filters
        if body_part:
            query_builder = query_builder.eq("body_part", body_part)
        if equipment:
            query_builder = query_builder.eq("equipment", equipment)
        if difficulty:
            query_builder = query_builder.eq("difficulty", difficulty)
        if category:
            query_builder = query_builder.eq("category", category)
        if target_muscle:
            query_builder = query_builder.eq("target_muscle", target_muscle)

        # Order by usage (most popular first) and limit
        result = query_builder.order("usage_count", desc=True).limit(limit).execute()

        return result.data or []

    except Exception as e:
        logger.error(f"Error searching exercises: {e}")
        return []


def get_popular_exercises(limit: int = 20) -> List[Dict[str, Any]]:
    """
    Get most frequently used exercises in generated plans.
    Useful for analytics and trending exercises.

    Args:
        limit: Number of exercises to return

    Returns:
        List of most popular exercises
    """
    supabase = get_supabase_client()

    try:
        result = (
            supabase.table("exercises")
            .select("*")
            .order("usage_count", desc=True)
            .limit(limit)
            .execute()
        )

        return result.data or []

    except Exception as e:
        logger.error(f"Error fetching popular exercises: {e}")
        return []


def get_exercises_by_body_part(body_part: str, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Get all exercises for a specific body part.

    Args:
        body_part: Body part (e.g., "chest", "back", "legs")
        limit: Maximum results

    Returns:
        List of exercises
    """
    return search_exercises(body_part=body_part, limit=limit)


def get_exercises_by_equipment(equipment: str, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Get all exercises for specific equipment.
    Useful for home workouts (body weight) vs gym workouts (barbell).

    Args:
        equipment: Equipment type (e.g., "body weight", "barbell", "dumbbell")
        limit: Maximum results

    Returns:
        List of exercises
    """
    return search_exercises(equipment=equipment, limit=limit)


def get_beginner_exercises(limit: int = 50) -> List[Dict[str, Any]]:
    """Get beginner-friendly exercises"""
    return search_exercises(difficulty="beginner", limit=limit)


def get_exercises_for_ai_prompt(
    user_profile: Optional[Dict[str, Any]] = None, limit: int = 100
) -> List[Dict[str, Any]]:
    """
    Get filtered exercise list for AI prompt based on user fitness profile.
    Filters by difficulty level, equipment availability, and location preferences.

    Args:
        user_profile: User fitness profile (fitness_level, preferred_location, etc.)
        limit: Maximum exercises to return (default 100)

    Returns:
        List of exercises with id, name, target_muscle, equipment, difficulty
    """
    supabase = get_supabase_client()

    try:
        # Select minimal fields for AI prompt (reduces token usage)
        query = supabase.table("exercises").select(
            "id, name, target_muscle, equipment, difficulty, body_part, category"
        )

        if user_profile:
            # Filter by fitness level
            fitness_level = user_profile.get("fitness_level", "beginner")
            if fitness_level == "beginner":
                # Beginner: only beginner exercises
                query = query.eq("difficulty", "beginner")
            elif fitness_level == "intermediate":
                # Intermediate: beginner + intermediate
                query = query.in_("difficulty", ["beginner", "intermediate"])
            # Advanced: all difficulties (no filter)

            # Filter by location/equipment availability
            preferred_location = user_profile.get("preferred_location", "")
            if preferred_location in ["home", "Home", "HOME"]:
                # Home: body weight, dumbbells, resistance bands (no gym equipment)
                query = query.in_(
                    "equipment",
                    [
                        "body weight",
                        "dumbbell",
                        "kettlebell",
                        "resistance band",
                        "medicine ball",
                    ],
                )
            elif preferred_location in ["outdoor", "Outdoor", "OUTDOOR"]:
                # Outdoor: body weight only
                query = query.eq("equipment", "body weight")
            # Gym: all equipment types (no filter)

        # Order by popularity (most used exercises first = better AI suggestions)
        result = query.order("usage_count", desc=True).limit(limit).execute()

        exercises = result.data or []
        print(
            f"Filtered {len(exercises)} exercises for AI prompt (profile: {user_profile.get('fitness_level') if user_profile else 'none'})"
        )

        return exercises

    except Exception as e:
        logger.error(f"Error filtering exercises for AI: {e}")
        # Fallback: return popular exercises
        return get_popular_exercises(limit)


def enhance_exercise_with_demo(exercise_name: str) -> Dict[str, Any]:
    """
    Enhance an exercise name with full demo data.
    Used by plan generator to add MP4 videos and instructions to plans.

    Args:
        exercise_name: Name of exercise from AI-generated plan

    Returns:
        Dict with demo data (mp4_url, instructions, etc.) or empty dict
    """
    exercise = get_exercise_by_name(exercise_name)

    if not exercise:
        return {}

    return {
        "id": exercise["id"],
        "mp4_url": exercise["mp4_url"],  # MP4 video for mobile
        "target_muscle": exercise["target_muscle"],
        "body_part": exercise["body_part"],
        "equipment": exercise["equipment"],
        "difficulty": exercise["difficulty"],
        "secondary_muscles": exercise["secondary_muscles"],
        "instructions": exercise["instructions"],
        "description": exercise["description"],
        "category": exercise["category"],
    }


def get_warmup_exercises(
    target_muscles: Optional[List[str]] = None,
    equipment: str = "body weight",
    limit: int = 2,
) -> List[Dict[str, Any]]:
    """
    Get warmup exercises from database.

    Prioritizes stretching category exercises suitable for warmup.
    All warmup exercises should be dynamic stretches (not static holds).

    Args:
        target_muscles: List of muscles to warm up (from main workout)
        equipment: Equipment filter (default: body weight for accessibility)
        limit: Maximum exercises to return (1-2 as per plan)

    Returns:
        List of warmup exercises with 30s duration each
    """
    supabase = get_supabase_client()

    try:
        # Query stretching exercises, prefer body weight
        query = (
            supabase.table("exercises")
            .select("*")
            .eq("category", "stretching")
            .eq("equipment", equipment)
        )

        # Filter by target muscles if provided
        if target_muscles and len(target_muscles) > 0:
            # Try to find exercises targeting these muscles
            query = query.in_("target_muscle", target_muscles)

        result = query.order("usage_count", desc=True).limit(limit * 2).execute()

        exercises = result.data or []

        # If no muscle-specific stretches found, get general stretches
        if len(exercises) < limit:
            fallback_result = (
                supabase.table("exercises")
                .select("*")
                .eq("category", "stretching")
                .order("usage_count", desc=True)
                .limit(limit)
                .execute()
            )
            exercises = fallback_result.data or []

        # Format warmup exercises with 30s duration
        warmup_exercises = []
        for ex in exercises[:limit]:
            warmup_exercises.append(
                {
                    "exercise_id": ex["id"],
                    "name": ex["name"],
                    "duration_seconds": 30,
                    "is_timed": True,  # Warmups are always timed
                    "type": "warmup",
                    "target_muscle": ex.get("target_muscle"),
                    "mp4_url": ex.get("mp4_url"),
                    "instructions": ex.get("instructions", []),
                }
            )

        logger.info(f"Retrieved {len(warmup_exercises)} warmup exercises from database")
        return warmup_exercises

    except Exception as e:
        logger.error(f"Error fetching warmup exercises: {e}")
        return []


def get_cooldown_exercises(
    target_muscles: Optional[List[str]] = None,
    equipment: str = "body weight",
    limit: int = 2,
) -> List[Dict[str, Any]]:
    """
    Get cooldown exercises from database.

    Prioritizes stretching category exercises suitable for cooldown.
    Cooldown exercises should be static stretches (held positions).

    Args:
        target_muscles: List of muscles to stretch (from main workout)
        equipment: Equipment filter (default: body weight)
        limit: Maximum exercises to return (1-2 as per plan)

    Returns:
        List of cooldown exercises with 30-60s duration each
    """
    supabase = get_supabase_client()

    try:
        # Query stretching exercises for cooldown
        query = (
            supabase.table("exercises")
            .select("*")
            .eq("category", "stretching")
            .eq("equipment", equipment)
        )

        # Filter by target muscles if provided
        if target_muscles and len(target_muscles) > 0:
            query = query.in_("target_muscle", target_muscles)

        result = query.order("usage_count", desc=True).limit(limit * 2).execute()

        exercises = result.data or []

        # If no muscle-specific stretches found, get general stretches
        if len(exercises) < limit:
            fallback_result = (
                supabase.table("exercises")
                .select("*")
                .eq("category", "stretching")
                .order("usage_count", desc=True)
                .limit(limit)
                .execute()
            )
            exercises = fallback_result.data or []

        # Format cooldown exercises with 30-60s duration
        cooldown_exercises = []
        for i, ex in enumerate(exercises[:limit]):
            # Alternate between 30s and 45s for variety
            duration = 30 if i % 2 == 0 else 45
            cooldown_exercises.append(
                {
                    "exercise_id": ex["id"],
                    "name": ex["name"],
                    "duration_seconds": duration,
                    "is_timed": True,  # Cooldowns are always timed
                    "type": "cooldown",
                    "target_muscle": ex.get("target_muscle"),
                    "mp4_url": ex.get("mp4_url"),
                    "instructions": ex.get("instructions", []),
                }
            )

        logger.info(
            f"Retrieved {len(cooldown_exercises)} cooldown exercises from database"
        )
        return cooldown_exercises

    except Exception as e:
        logger.error(f"Error fetching cooldown exercises: {e}")
        return []


def is_timed_exercise(exercise_name: str) -> bool:
    """
    Determine if an exercise should be timed (countdown) or rep-based (done button).

    Timed exercises: planks, holds, wall sits, static stretches
    Rep-based exercises: squats, pushups, lunges, etc.

    Args:
        exercise_name: Name of the exercise

    Returns:
        True if exercise should show timer, False if it should show "Do X reps"
    """
    name_lower = exercise_name.lower()

    # Keywords that indicate timed exercises
    timed_keywords = [
        "plank",
        "hold",
        "wall sit",
        "bridge hold",
        "dead hang",
        "isometric",
        "static",
        "stretch",
        "pose",
        "position",
        "hang",
        "sit",
        "hollow",
        "superman hold",
        "l-sit",
        "split",
        "pike",
    ]

    for keyword in timed_keywords:
        if keyword in name_lower:
            return True

    return False
