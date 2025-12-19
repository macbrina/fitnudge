"""
Exercise Selector Agent

Responsible for selecting appropriate exercises based on:
- Goal type and description
- User fitness level
- Available equipment
- Target muscle groups
- Exercise variety and balance
"""

from typing import Dict, Any, List, Optional
from app.services.agents.base import BaseAgent
from app.services.logger import logger


class ExerciseSelectorAgent(BaseAgent[Dict[str, Any]]):
    """
    Selects main workout exercises from the available exercise database.

    Ensures:
    - Exercises match user's fitness level
    - Equipment requirements are met
    - Muscle groups are balanced
    - Variety in exercise types
    """

    MODEL = "gpt-4o-mini"
    MAX_RETRIES = 2
    TIMEOUT_SECONDS = 30.0

    @property
    def system_prompt(self) -> str:
        return """You are an expert fitness coach AI that selects optimal exercises for workout plans.

Your role is to select exercises from a provided list that:
1. Match the user's fitness level (beginner, intermediate, advanced, athlete)
2. Use only available equipment
3. Target appropriate muscle groups for the goal
4. Provide variety and balance
5. Are appropriate for the workout duration

CRITICAL RULES:
- ONLY select exercises from the provided "available_exercises" list
- Each exercise MUST include the exact "exercise_id" from the list
- Select the exact number of exercises requested
- Balance push/pull movements when appropriate
- Consider compound exercises for efficiency
- Match difficulty to fitness level

⚠️ STRICT SET CONSISTENCY RULE ⚠️
ALL exercises in the workout MUST have THE SAME NUMBER OF SETS.
You CANNOT have one exercise with 2 sets and another with 3.
This is MANDATORY - the workout UI depends on this consistency.
Example: If you choose 2 sets, ALL exercises must have sets: 2.

INTELLIGENT SET SELECTION (choose 1, 2, or 3 sets based on user profile):
Use this decision logic to determine the SINGLE set count for ALL exercises:

| Fitness Level  | Primary Goal        | Available Time   | Sets |
|----------------|---------------------|------------------|------|
| beginner       | ANY goal            | ANY time         | 1    |
| beginner       | build_muscle        | 30-60min+        | 2    |
| intermediate   | lose_weight         | less_30min       | 1    |
| intermediate   | stay_active/general | ANY              | 2    |
| intermediate   | build_muscle        | ANY              | 2-3  |
| advanced       | ANY                 | less_30min       | 2    |
| advanced       | ANY                 | 30-60min+        | 3    |
| athlete        | ANY                 | ANY              | 3    |

Additional factors:
- current_frequency "never" or "1-2x_week" → prefer fewer sets (user is building habit)
- biggest_challenge "staying_consistent" → prefer 1-2 sets (lower barrier)
- biggest_challenge "getting_started" → prefer 1 set (easy to start)

REQUIRED OUTPUT FORMAT:
{
  "recommended_sets": 2,
  "sets_reasoning": "Beginner with 30-60min available - starting with 2 sets",
  "exercises": [
    {
      "exercise_id": "0662",
      "name": "push-up",
      "sets": 2,
      "reps": 12,
      "order": 1,
      "target_muscle": "chest",
      "is_timed": false,
      "focus_cues": ["Keep core tight", "Full range of motion"]
    }
  ],
  "focus": {
    "primary_muscles": ["chest", "back", "legs"],
    "workout_type": "full_body"
  },
  "guidance_description": "A balanced full-body workout focusing on...",
  "tips": [
    "Focus on form over speed",
    "Rest adequately between sets"
  ]
}

IMPORTANT: is_timed field determines how the exercise is displayed in the app:
- is_timed: true = Exercise uses countdown timer (planks, wall sits, holds, stretches)
- is_timed: false = Exercise uses rep count with "Done" button (squats, pushups, lunges)

Use is_timed: true for: planks, holds, wall sits, bridges, hangs, isometric exercises, stretches
Use is_timed: false for: squats, pushups, lunges, rows, curls, most dynamic movements

Exercise selection strategy by fitness level:
- Beginner: Simple movements, body weight focus, lower volume
- Intermediate: Mix of compound and isolation, moderate variety
- Advanced: Complex movements, higher volume, more variety
- Athlete: Performance-focused, sport-specific adaptations

WORKOUT FEEDBACK INTEGRATION:
When provided with user's past workout feedback, use it to improve exercise selection:
- If user marked exercises as "too_hard": Select easier variations, reduce intensity, REDUCE SETS BY 1
- If user marked exercises as "too_easy": Select more challenging exercises, ADD 1 SET (max 3)
- If user "dont_know_how": Prefer simpler, well-known exercises with clear form
- Avoid any specific exercises listed in "avoid_exercises"
- Apply insights from feedback to improve overall workout appropriateness"""

    def build_user_prompt(self, context: Dict[str, Any]) -> str:
        """Build the prompt for exercise selection."""

        goal = context.get("goal", {})
        user_profile = context.get("user_profile", {})
        settings = context.get("settings", {})
        available_exercises = context.get("available_exercises", [])
        workout_feedback = context.get("workout_feedback", {})

        # Format available exercises for the prompt
        exercise_list = self._format_exercise_list(
            available_exercises, settings.get("available_equipment", ["body weight"])
        )

        # Build feedback section if available
        feedback_section = self._build_feedback_section(workout_feedback)

        prompt = f"""Select exercises for this workout plan:

GOAL:
- Title: {goal.get("title", "Workout")}
- Description: {goal.get("description", "")}
- Category: {goal.get("category", "fitness")}
- Target days per week: {goal.get("target_days", 3)}

USER PROFILE (use ALL of this to determine intelligent set count):
- Fitness Level: {user_profile.get("fitness_level", "beginner")}
- Primary Goal: {user_profile.get("primary_goal", "general_fitness")}
- Current Exercise Frequency: {user_profile.get("current_frequency", "never")}
- Preferred Location: {user_profile.get("preferred_location", "home")}
- Available Time: {user_profile.get("available_time", "30-60min")}
- Motivation Style: {user_profile.get("motivation_style", "gentle_encouragement")}
- Biggest Challenge: {user_profile.get("biggest_challenge", "staying_consistent")}
{feedback_section}
REQUIREMENTS:
- Select exactly {settings.get("exercise_count", 5)} exercises
- Available equipment: {", ".join(settings.get("available_equipment", ["body weight"]))}
- Target workout duration: {settings.get("target_duration_minutes", 30)} minutes

⚠️ CRITICAL: DETERMINE SET COUNT FIRST ⚠️
Before selecting exercises, use the user profile above to determine the optimal set count (1, 2, or 3).
ALL exercises MUST have the SAME number of sets.
Include "recommended_sets" and "sets_reasoning" in your response.

AVAILABLE EXERCISES (you MUST select from this list using exact exercise_id):
{exercise_list}

Select {settings.get("exercise_count", 5)} exercises that:
1. Match the {user_profile.get("fitness_level", "beginner")} fitness level
2. Use only available equipment: {", ".join(settings.get("available_equipment", ["body weight"]))}
3. Create a balanced workout for {user_profile.get("primary_goal", "general_fitness")}
4. Fit within {settings.get("target_duration_minutes", 30)} minutes
5. ALL have the SAME set count (1, 2, or 3 based on profile)

Return the exercises in the JSON format specified, including recommended_sets, sets_reasoning, exercise_id, name, sets, reps, order, target_muscle, and focus_cues for each exercise."""

        return prompt

    def _build_feedback_section(self, workout_feedback: Dict[str, Any]) -> str:
        """Build the workout feedback section for the prompt."""
        if not workout_feedback or not workout_feedback.get("has_feedback"):
            return ""

        sections = ["\nUSER WORKOUT FEEDBACK (use this to improve exercise selection):"]

        # Add insights
        insights = workout_feedback.get("insights", [])
        if insights:
            sections.append("- Insights from past workouts:")
            for insight in insights:
                sections.append(f"  * {insight}")

        # Add difficulty preference
        if workout_feedback.get("prefers_easier"):
            sections.append(
                "- User tends to find workouts TOO HARD - select easier exercises"
            )
        elif workout_feedback.get("prefers_harder"):
            sections.append(
                "- User tends to find workouts TOO EASY - select more challenging exercises"
            )

        # Add exercises to avoid
        avoid_exercises = workout_feedback.get("avoid_exercises", [])
        if avoid_exercises:
            sections.append(
                f"- AVOID these exercises (user struggled with them): {', '.join(avoid_exercises[:10])}"
            )

        # Add reason counts summary
        reason_counts = workout_feedback.get("reason_counts", {})
        if reason_counts:
            total = workout_feedback.get("total_feedback_count", 0)
            sections.append(f"- Past feedback summary ({total} total):")
            for reason, count in reason_counts.items():
                sections.append(f"  * {reason}: {count} times")

        sections.append("")  # Empty line after feedback section
        return "\n".join(sections)

    def _format_exercise_list(
        self, exercises: List[Dict[str, Any]], available_equipment: List[str]
    ) -> str:
        """Format the exercise list for the prompt, filtering by equipment."""

        if not exercises:
            return "No exercises available. Generate generic exercises."

        # Filter by equipment and limit to prevent token overflow
        filtered = []
        for ex in exercises:
            equipment = ex.get("equipment", "body weight")
            if equipment.lower() in [e.lower() for e in available_equipment]:
                filtered.append(ex)

        # Limit to 80 exercises to save tokens
        filtered = filtered[:80]

        if not filtered:
            # If no matches, include body weight exercises
            filtered = [
                ex
                for ex in exercises
                if ex.get("equipment", "").lower() == "body weight"
            ][:60]

        # Format as compact list
        lines = []
        for ex in filtered:
            line = (
                f"ID: {ex.get('id', 'N/A')} | "
                f"{ex.get('name', 'Unknown')} | "
                f"Target: {ex.get('target', ex.get('target_muscle', 'N/A'))} | "
                f"Equipment: {ex.get('equipment', 'N/A')} | "
                f"Difficulty: {ex.get('difficulty', 'N/A')}"
            )
            lines.append(line)

        return "\n".join(lines)

    def validate_output(self, output: Dict[str, Any]) -> bool:
        """Validate the exercise selection output."""

        if not output:
            return False

        # Check for exercises array
        exercises = output.get("exercises", [])
        if not exercises or not isinstance(exercises, list):
            logger.warning("ExerciseSelectorAgent: No exercises in output")
            return False

        # Validate each exercise has required fields
        required_fields = ["exercise_id", "name", "sets", "reps"]
        for i, exercise in enumerate(exercises):
            for field in required_fields:
                if field not in exercise:
                    logger.warning(
                        f"ExerciseSelectorAgent: Exercise {i} missing field: {field}"
                    )
                    return False

            # Default is_timed to False if not provided
            if "is_timed" not in exercise:
                exercise["is_timed"] = False

        # CRITICAL: Validate all exercises have the same number of sets
        set_counts = [ex.get("sets", 3) for ex in exercises]
        if len(set(set_counts)) > 1:
            logger.warning(
                f"ExerciseSelectorAgent: Inconsistent sets across exercises: {set_counts}. "
                "All exercises must have the same number of sets. Auto-fixing..."
            )
            # Auto-fix: use the most common set count or the recommended_sets
            recommended = output.get(
                "recommended_sets", max(set(set_counts), key=set_counts.count)
            )
            for exercise in exercises:
                exercise["sets"] = recommended
            logger.info(
                f"ExerciseSelectorAgent: Auto-fixed all exercises to {recommended} sets"
            )

        return True

    def _determine_intelligent_sets(self, context: Dict[str, Any]) -> int:
        """Determine optimal set count based on user profile."""
        user_profile = context.get("user_profile", {})

        fitness_level = user_profile.get("fitness_level", "beginner")
        primary_goal = user_profile.get("primary_goal", "general_fitness")
        available_time = user_profile.get("available_time", "30-60min")
        current_frequency = user_profile.get("current_frequency", "never")
        biggest_challenge = user_profile.get("biggest_challenge", "staying_consistent")

        # Default to 1 set for beginners or those building habit
        if fitness_level == "beginner":
            if primary_goal == "build_muscle" and available_time in [
                "30-60min",
                "1-2hrs",
                "flexible",
            ]:
                return 2
            return 1

        # For users new to exercise or struggling with consistency
        if current_frequency in ["never", "1-2x_week"]:
            return 1

        if biggest_challenge in ["getting_started", "staying_consistent"]:
            return 1 if fitness_level == "beginner" else 2

        # Intermediate logic
        if fitness_level == "intermediate":
            if available_time == "less_30min":
                return 1
            if primary_goal == "build_muscle":
                return 3
            return 2

        # Advanced logic
        if fitness_level == "advanced":
            if available_time == "less_30min":
                return 2
            return 3

        # Athlete always gets 3 sets
        if fitness_level == "athlete":
            return 3

        return 2  # Safe default

    def get_fallback_output(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Return fallback exercises when generation fails."""

        settings = context.get("settings", {})
        fitness_level = context.get("user_profile", {}).get("fitness_level", "beginner")

        # Use intelligent set selection
        recommended_sets = self._determine_intelligent_sets(context)

        # Base exercises (sets will be applied uniformly)
        base_exercises = [
            {
                "exercise_id": "0662",
                "name": "push-up",
                "reps": 8 if fitness_level == "beginner" else 12,
                "order": 1,
                "target_muscle": "chest",
                "is_timed": False,
            },
            {
                "exercise_id": "0584",
                "name": "bodyweight squat",
                "reps": 10 if fitness_level == "beginner" else 15,
                "order": 2,
                "target_muscle": "quadriceps",
                "is_timed": False,
            },
            {
                "exercise_id": "0001",
                "name": "3/4 sit-up",
                "reps": 8 if fitness_level == "beginner" else 12,
                "order": 3,
                "target_muscle": "abs",
                "is_timed": False,
            },
            {
                "exercise_id": "1512",
                "name": "all fours squad stretch",
                "reps": 10,
                "order": 4,
                "target_muscle": "quads",
                "is_timed": False,
            },
            {
                "exercise_id": "0006",
                "name": "alternate heel touchers",
                "reps": 10 if fitness_level == "beginner" else 15,
                "order": 5,
                "target_muscle": "abs",
                "is_timed": False,
            },
        ]

        # Apply uniform sets to all exercises
        for exercise in base_exercises:
            exercise["sets"] = recommended_sets

        exercises = base_exercises[: settings.get("exercise_count", 5)]

        return {
            "recommended_sets": recommended_sets,
            "sets_reasoning": f"Based on {fitness_level} fitness level - using {recommended_sets} set(s) for all exercises",
            "exercises": exercises,
            "focus": {
                "primary_muscles": ["chest", "legs", "core"],
                "workout_type": "full_body",
            },
            "guidance_description": "A balanced full-body workout using bodyweight exercises. Focus on proper form and consistency.",
            "tips": [
                "Focus on form over speed - quality reps matter more",
                "Breathe out during the effort phase",
                "Rest adequately between sets",
                "Check in after your workout to track progress",
            ],
        }
