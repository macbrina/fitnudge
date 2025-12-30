"""
Evaluator Agent

Quality gate agent that validates outputs from other agents.
Ensures all exercises have required fields, valid IDs, and GIF URLs.
Returns feedback for corrections if validation fails.
"""

from typing import Dict, Any, List, Tuple, Optional
from app.services.logger import logger


class EvaluatorAgent:
    """
    Quality gate agent that validates outputs from other agents.

    Validates:
    - All required fields are present
    - Exercise IDs exist in database
    - GIF URLs are present and valid
    - Timing data is complete

    Auto-enhances:
    - Missing demo/gif_url data by fetching from database
    - Missing timing fields with sensible defaults
    """

    MAX_RETRIES = 2

    # Required fields by exercise type
    REQUIRED_FIELDS = {
        "main": ["exercise_id", "name", "sets"],
        "warmup": ["exercise_id", "name", "duration_seconds"],
        "cooldown": ["exercise_id", "name", "duration_seconds"],
    }

    def validate_set_consistency(
        self, exercises: List[Dict[str, Any]]
    ) -> Tuple[bool, List[Dict[str, Any]], List[str]]:
        """
        Validate that ALL main workout exercises have the same number of sets.
        Auto-fixes by using the most common set count if inconsistent.

        Args:
            exercises: List of main workout exercises

        Returns:
            Tuple of (is_valid, validated_exercises, error_messages)
        """
        errors = []
        validated = [dict(ex) for ex in exercises]

        if not exercises:
            return True, validated, errors

        # Get all set counts
        set_counts = [ex.get("sets", 1) for ex in exercises]
        unique_sets = set(set_counts)

        if len(unique_sets) > 1:
            # Inconsistent sets - auto-fix
            # Use the most common set count
            from collections import Counter

            most_common_sets = Counter(set_counts).most_common(1)[0][0]

            error_msg = (
                f"Set consistency violation: Exercises have mixed sets {list(unique_sets)}. "
                f"Auto-fixed to {most_common_sets} sets for all exercises."
            )
            errors.append(error_msg)
            logger.warning(f"Evaluator: {error_msg}")

            # Apply fix
            for exercise in validated:
                exercise["sets"] = most_common_sets

        return len(errors) == 0, validated, errors

    def validate_exercises(
        self, exercises: List[Dict[str, Any]], exercise_type: str = "main"
    ) -> Tuple[bool, List[Dict[str, Any]], List[str]]:
        """
        Validate a list of exercises and auto-enhance missing data.

        Args:
            exercises: List of exercise dictionaries
            exercise_type: "main", "warmup", or "cooldown"

        Returns:
            Tuple of (is_valid, validated_exercises, error_messages)
        """
        from app.services.exercise_service import (
            get_exercise_by_id,
            get_exercise_by_name,
        )

        errors = []
        validated = []
        required = self.REQUIRED_FIELDS.get(exercise_type, self.REQUIRED_FIELDS["main"])

        for i, exercise in enumerate(exercises):
            exercise_errors = []
            validated_exercise = dict(exercise)
            exercise_name = exercise.get("name", f"Exercise {i+1}")

            # Check required fields
            missing_fields = []
            for field in required:
                if field not in exercise or exercise[field] is None:
                    missing_fields.append(field)

            if missing_fields:
                exercise_errors.append(f"Missing fields: {', '.join(missing_fields)}")

            # Validate and enhance exercise data
            exercise_id = exercise.get("exercise_id")
            db_exercise = None

            # Try to get exercise from database by ID
            if exercise_id:
                db_exercise = get_exercise_by_id(exercise_id)
                if not db_exercise:
                    exercise_errors.append(
                        f"exercise_id '{exercise_id}' not found in database"
                    )
                    # Try to find by name as fallback
                    db_exercise = get_exercise_by_name(exercise_name)
                    if db_exercise:
                        validated_exercise["exercise_id"] = db_exercise["id"]
                        logger.info(
                            f"Evaluator: Fixed exercise_id for '{exercise_name}' "
                            f"from '{exercise_id}' to '{db_exercise['id']}'"
                        )
            else:
                # No exercise_id - try to find by name
                db_exercise = get_exercise_by_name(exercise_name)
                if db_exercise:
                    validated_exercise["exercise_id"] = db_exercise["id"]
                    logger.info(
                        f"Evaluator: Added exercise_id for '{exercise_name}': {db_exercise['id']}"
                    )
                else:
                    exercise_errors.append(
                        f"Could not find exercise '{exercise_name}' in database"
                    )

            # Auto-enhance with demo data if we found the exercise
            if db_exercise:
                # Check if demo/mp4_url is missing
                has_mp4 = exercise.get("mp4_url") or exercise.get("demo", {}).get(
                    "mp4_url"
                )

                if not has_mp4:
                    validated_exercise["demo"] = {
                        "id": db_exercise["id"],
                        "mp4_url": db_exercise.get("mp4_url"),
                        "target_muscle": db_exercise.get("target_muscle"),
                        "body_part": db_exercise.get("body_part"),
                        "equipment": db_exercise.get("equipment"),
                        "difficulty": db_exercise.get("difficulty"),
                        "instructions": db_exercise.get("instructions", []),
                        "description": db_exercise.get("description"),
                        "category": db_exercise.get("category"),
                    }
                    logger.info(f"Evaluator: Added demo data for '{exercise_name}'")

                # Also add mp4_url directly for easier access
                if not exercise.get("mp4_url"):
                    validated_exercise["mp4_url"] = db_exercise.get("mp4_url")

                # Ensure name matches database (fixes capitalization)
                if db_exercise.get("name"):
                    validated_exercise["name"] = db_exercise["name"]

            # Final check for mp4_url
            final_has_mp4 = validated_exercise.get("mp4_url") or validated_exercise.get(
                "demo", {}
            ).get("mp4_url")
            if not final_has_mp4:
                exercise_errors.append(
                    "No mp4_url available - exercise will not display properly"
                )

            if exercise_errors:
                errors.append(
                    f"Exercise {i+1} ({exercise_name}): {'; '.join(exercise_errors)}"
                )

            validated.append(validated_exercise)

        is_valid = len(errors) == 0
        return is_valid, validated, errors

    def validate_timing(
        self, timing: Dict[str, Any], exercises: List[Dict[str, Any]]
    ) -> Tuple[bool, Dict[str, Any], List[str]]:
        """
        Validate timing data and add defaults if missing.

        Args:
            timing: Timing dictionary from plan
            exercises: List of exercises to check timing for

        Returns:
            Tuple of (is_valid, validated_timing, error_messages)
        """
        errors = []
        validated_timing = dict(timing) if timing else {}

        # Required timing fields with defaults
        timing_defaults = {
            "rest_between_exercises_seconds": 60,
            "rest_between_sets_seconds": 30,
            "default_work_duration_seconds": 45,
        }

        for field, default in timing_defaults.items():
            if field not in validated_timing or validated_timing[field] is None:
                validated_timing[field] = default
                logger.info(f"Evaluator: Added default {field}: {default}")

        # Validate exercise-specific timing
        exercise_timing = validated_timing.get("exercise_timing", {})
        for exercise in exercises:
            exercise_id = exercise.get("exercise_id")
            if exercise_id and exercise_id not in exercise_timing:
                # Add default timing for this exercise
                exercise_timing[exercise_id] = {
                    "work_duration_seconds": exercise.get("work_duration_seconds", 45),
                    "rest_between_sets_seconds": 30,
                    "tempo": "controlled",
                }

        validated_timing["exercise_timing"] = exercise_timing

        is_valid = len(errors) == 0
        return is_valid, validated_timing, errors

    def validate_warmup_cooldown(
        self, section: Dict[str, Any], section_type: str  # "warm_up" or "cool_down"
    ) -> Tuple[bool, Dict[str, Any], List[str]]:
        """
        Validate warmup or cooldown section.

        Args:
            section: Warmup or cooldown dictionary
            section_type: "warm_up" or "cool_down"

        Returns:
            Tuple of (is_valid, validated_section, error_messages)
        """
        errors = []
        validated_section = dict(section) if section else {}

        exercises = validated_section.get("exercises", [])
        exercise_type = "warmup" if section_type == "warm_up" else "cooldown"

        if exercises:
            is_valid, validated_exercises, exercise_errors = self.validate_exercises(
                exercises, exercise_type
            )
            validated_section["exercises"] = validated_exercises
            if not is_valid:
                errors.extend(exercise_errors)

        # Ensure duration is set
        if "duration_seconds" not in validated_section:
            total_duration = sum(
                ex.get("duration_seconds", 30)
                for ex in validated_section.get("exercises", [])
            )
            validated_section["duration_seconds"] = total_duration or 30

        # Ensure description is set
        if "description" not in validated_section:
            if section_type == "warm_up":
                validated_section["description"] = (
                    "Dynamic movements to prepare your body"
                )
            else:
                validated_section["description"] = "Static stretches to aid recovery"

        is_valid = len(errors) == 0
        return is_valid, validated_section, errors

    def validate_workout_plan(
        self, plan: Dict[str, Any]
    ) -> Tuple[bool, Dict[str, Any], Dict[str, List[str]]]:
        """
        Validate a complete workout plan and auto-fix issues.

        Args:
            plan: Complete workout plan dictionary

        Returns:
            Tuple of (is_valid, validated_plan, errors_by_section)
        """
        all_errors: Dict[str, List[str]] = {}
        validated_plan = dict(plan)
        structure = validated_plan.get("structure", {})

        logger.info("Evaluator: Starting workout plan validation")

        # Validate main workout exercises
        main_workout = structure.get("main_workout", {}) or structure.get("routine", {})
        main_exercises = main_workout.get("exercises", [])

        if main_exercises:
            is_valid, validated_exercises, errors = self.validate_exercises(
                main_exercises, "main"
            )
            if not is_valid:
                all_errors["main_workout"] = errors

            # CRITICAL: Validate set consistency across all main workout exercises
            sets_valid, validated_exercises, set_errors = self.validate_set_consistency(
                validated_exercises
            )
            if not sets_valid:
                if "main_workout" not in all_errors:
                    all_errors["main_workout"] = []
                all_errors["main_workout"].extend(set_errors)

            # Update exercises in the correct location
            if "main_workout" in structure:
                validated_plan["structure"]["main_workout"][
                    "exercises"
                ] = validated_exercises
            elif "routine" in structure:
                validated_plan["structure"]["routine"][
                    "exercises"
                ] = validated_exercises

            # Log the set count being used
            if validated_exercises:
                uniform_sets = validated_exercises[0].get("sets", 1)
                logger.info(
                    f"Evaluator: Validated {len(validated_exercises)} main exercises with {uniform_sets} set(s) each"
                )
        else:
            all_errors["main_workout"] = ["No exercises found in main workout"]

        # Validate warmup
        warm_up = structure.get("warm_up", {})
        if warm_up:
            is_valid, validated_warmup, errors = self.validate_warmup_cooldown(
                warm_up, "warm_up"
            )
            if not is_valid:
                all_errors["warm_up"] = errors
            validated_plan["structure"]["warm_up"] = validated_warmup
            logger.info(
                f"Evaluator: Validated warmup with {len(validated_warmup.get('exercises', []))} exercises"
            )

        # Validate cooldown
        cool_down = structure.get("cool_down", {})
        if cool_down:
            is_valid, validated_cooldown, errors = self.validate_warmup_cooldown(
                cool_down, "cool_down"
            )
            if not is_valid:
                all_errors["cool_down"] = errors
            validated_plan["structure"]["cool_down"] = validated_cooldown
            logger.info(
                f"Evaluator: Validated cooldown with {len(validated_cooldown.get('exercises', []))} exercises"
            )

        # Validate timing
        timing = structure.get("timing", {})
        is_valid, validated_timing, timing_errors = self.validate_timing(
            timing, main_exercises
        )
        if not is_valid:
            all_errors["timing"] = timing_errors
        validated_plan["structure"]["timing"] = validated_timing

        # Validate guidance
        guidance = validated_plan.get("guidance", {})
        if not guidance.get("description"):
            validated_plan["guidance"] = validated_plan.get("guidance", {})
            validated_plan["guidance"][
                "description"
            ] = "Complete this workout to build strength and endurance"
        if not guidance.get("tips"):
            validated_plan["guidance"]["tips"] = [
                "Focus on proper form over speed",
                "Stay hydrated throughout your workout",
                "Listen to your body and rest when needed",
            ]

        # Check plan_type
        if "plan_type" not in validated_plan:
            validated_plan["plan_type"] = "workout_plan"

        # Ensure tracking_type is set (workout plans always use workout tracking)
        if "tracking_type" not in validated_plan:
            validated_plan["tracking_type"] = "workout"

        overall_valid = len(all_errors) == 0

        if overall_valid:
            logger.info(
                "Evaluator: ✅ Plan validation PASSED - all exercises have required data"
            )
        else:
            logger.warning(
                f"Evaluator: ⚠️ Plan validation had issues (auto-fixed where possible)",
                {"errors": all_errors},
            )

        return overall_valid, validated_plan, all_errors

    def generate_fix_instructions(self, errors: Dict[str, List[str]]) -> str:
        """
        Generate human-readable instructions for fixing validation errors.

        Args:
            errors: Dictionary of errors by section

        Returns:
            Formatted instruction string
        """
        lines = ["VALIDATION ERRORS - Please fix the following issues:\n"]

        for section, section_errors in errors.items():
            lines.append(f"\n## {section.upper()}:")
            for error in section_errors:
                lines.append(f"  - {error}")

        lines.append("\n\nREQUIREMENTS:")
        lines.append("1. ALL exercises MUST have a valid exercise_id from the database")
        lines.append("2. ALL exercises MUST have mp4_url (or demo.mp4_url)")
        lines.append("3. Main exercises MUST have: exercise_id, name, sets, reps")
        lines.append(
            "4. Warmup/cooldown exercises MUST have: exercise_id, name, duration_seconds"
        )
        lines.append("5. Timing section MUST have rest_between_exercises_seconds")
        lines.append(
            "6. ⚠️ CRITICAL: ALL main exercises MUST have the SAME number of sets (1, 2, or 3)"
        )

        return "\n".join(lines)
