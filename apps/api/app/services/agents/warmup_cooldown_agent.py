"""
Warmup/Cooldown Generator Agent

AI-powered agent for selecting appropriate warm-up and cool-down exercises:
- Selects exercises from the database (not AI-generated exercises)
- Dynamic stretches for warm-up
- Static stretches for cool-down
- Muscle-specific preparation based on main workout
- Considers user's preferred_location for equipment selection
- 1-2 exercises per phase, 30 seconds each
"""

from typing import Dict, Any, List
from app.services.agents.base import BaseAgent
from app.services.logger import logger


class WarmupCooldownAgent(BaseAgent[Dict[str, Any]]):
    """
    AI agent that selects warm-up and cool-down exercises from the database.

    Unlike other agents, this doesn't generate exercises - it intelligently
    selects from the exercises database based on:
    - Target muscles used in the main workout
    - User's preferred location (home, gym, outdoor)
    - Available equipment
    - Appropriate stretch types (dynamic for warmup, static for cooldown)

    Warm-up principles:
    - 1-2 dynamic stretches/movements
    - 30-45 seconds each
    - Target muscles that will be used in main workout

    Cool-down principles:
    - 1-2 static stretches
    - 30-45 seconds each
    - Focus on muscles used during workout
    """

    MODEL = "gpt-4o-mini"
    MAX_RETRIES = 2
    TIMEOUT_SECONDS = 20.0
    TEMPERATURE = 0.5  # Lower for more consistent selections

    @property
    def system_prompt(self) -> str:
        return """You are an expert fitness coach AI that selects optimal warmup and cooldown exercises.

Your role is to select exercises from a provided list that:
1. Are appropriate for warming up or cooling down
2. Target the muscles that will be/were used in the main workout
3. Use available equipment based on user's location preference
4. Provide proper preparation and recovery

WARMUP SELECTION RULES:
- Select EXACTLY 1 exercise from the "available_warmup_exercises" list
- Prefer dynamic movements and stretches
- Focus on muscles that will be used in the main workout
- The exercise should be 30 seconds
- ONLY select exercises from the provided warmup list using exact exercise_id

COOLDOWN SELECTION RULES:
- Select EXACTLY 1 exercise from the "available_cooldown_exercises" list
- Prefer static stretches and recovery movements
- Focus on muscles that were used during the workout
- The exercise should be 30-45 seconds
- ONLY select exercises from the provided cooldown list using exact exercise_id

REQUIRED OUTPUT FORMAT:
{
  "warm_up": {
    "duration_seconds": 60,
    "description": "Brief description of warmup focus",
    "exercises": [
      {
        "exercise_id": "1234",
        "name": "exercise name",
        "duration_seconds": 30,
        "is_timed": true,
        "type": "warmup",
        "reason": "Why this exercise is good for warmup"
      }
    ]
  },
  "cool_down": {
    "duration_seconds": 60,
    "description": "Brief description of cooldown focus",
    "exercises": [
      {
        "exercise_id": "5678",
        "name": "exercise name",
        "duration_seconds": 30,
        "is_timed": true,
        "type": "cooldown",
        "reason": "Why this exercise aids recovery"
      }
    ]
  }
}

IMPORTANT:
- ONLY use exercise_id values from the provided lists
- All exercises must have is_timed: true
- Duration should be 30 seconds for warmup, 30-45 for cooldown
- Select exercises that complement the main workout muscles"""

    def build_user_prompt(self, context: Dict[str, Any]) -> str:
        """Build the prompt for warmup/cooldown selection."""

        selected_exercises = context.get("selected_exercises", [])
        user_profile = context.get("user_profile", {})
        available_warmup = context.get("available_warmup_exercises", [])
        available_cooldown = context.get("available_cooldown_exercises", [])

        # Extract target muscles from main workout
        target_muscles = self._extract_target_muscles(selected_exercises)

        # Get main exercise names for context
        main_exercises = [ex.get("name", "") for ex in selected_exercises[:5]]

        # Format available exercises
        warmup_list = self._format_exercise_list(available_warmup)
        cooldown_list = self._format_exercise_list(available_cooldown)

        prompt = f"""Select warmup and cooldown exercises for this workout:

MAIN WORKOUT EXERCISES:
{', '.join(main_exercises) if main_exercises else 'General full-body workout'}

TARGET MUSCLES IN MAIN WORKOUT:
{', '.join(target_muscles) if target_muscles else 'full body'}

USER PROFILE:
- Fitness Level: {user_profile.get("fitness_level", "beginner")}
- Primary Goal: {user_profile.get("primary_goal", "general_fitness")}
- Current Exercise Frequency: {user_profile.get("current_frequency", "1-2x_week")}
- Preferred Location: {user_profile.get("preferred_location", "home")}
- Available Time: {user_profile.get("available_time", "30-60min")}
- Motivation Style: {user_profile.get("motivation_style", "gentle_encouragement")}
- Biggest Challenge: {user_profile.get("biggest_challenge", "staying_consistent")}
- Biological Sex: {user_profile.get("biological_sex", "not specified")}

IMPORTANT: Select exercises appropriate for a {user_profile.get("fitness_level", "beginner")} fitness level!

AVAILABLE WARMUP EXERCISES (select 1-2 from this list using exact exercise_id):
{warmup_list if warmup_list else "No specific warmup exercises available - use fallback"}

AVAILABLE COOLDOWN EXERCISES (select 1-2 from this list using exact exercise_id):
{cooldown_list if cooldown_list else "No specific cooldown exercises available - use fallback"}

REQUIREMENTS:
- Select EXACTLY 1 warmup exercise that prepares the muscles listed above
- Select EXACTLY 1 cooldown exercise that helps recover the muscles listed above
- The warmup exercise should be 30 seconds
- The cooldown exercise should be 30-45 seconds
- Use ONLY exercise_id values from the provided lists
- Consider user's fitness level when selecting exercises

Return the exercises in the JSON format specified, with exercise_id, name, duration_seconds, is_timed, type, and reason for each."""

        return prompt

    def _extract_target_muscles(self, exercises: List[Dict[str, Any]]) -> List[str]:
        """Extract unique target muscles from selected exercises."""
        muscles = set()

        for ex in exercises:
            target = ex.get("target_muscle") or ex.get("target")
            if target:
                muscles.add(target)

        return list(muscles) if muscles else ["full body"]

    def _format_exercise_list(self, exercises: List[Dict[str, Any]]) -> str:
        """Format exercises for the AI prompt."""
        if not exercises:
            return ""

        lines = []
        for ex in exercises[:20]:  # Limit to save tokens
            line = (
                f"ID: {ex.get('id', 'N/A')} | "
                f"{ex.get('name', 'Unknown')} | "
                f"Target: {ex.get('target_muscle', 'N/A')} | "
                f"Equipment: {ex.get('equipment', 'N/A')}"
            )
            lines.append(line)

        return "\n".join(lines)

    def validate_output(self, output: Dict[str, Any]) -> bool:
        """Validate the warmup/cooldown output structure."""
        if not output:
            return False

        # Check for required sections
        warm_up = output.get("warm_up")
        cool_down = output.get("cool_down")

        if not warm_up or not cool_down:
            logger.warning("WarmupCooldownAgent: Missing warm_up or cool_down section")
            return False

        # Validate warm_up exercises
        warmup_exercises = warm_up.get("exercises", [])
        if not warmup_exercises or not isinstance(warmup_exercises, list):
            logger.warning("WarmupCooldownAgent: No warmup exercises")
            return False

        # Validate cool_down exercises
        cooldown_exercises = cool_down.get("exercises", [])
        if not cooldown_exercises or not isinstance(cooldown_exercises, list):
            logger.warning("WarmupCooldownAgent: No cooldown exercises")
            return False

        # Validate each exercise has required fields
        required_fields = ["exercise_id", "name", "duration_seconds"]
        for section, exercises in [
            ("warmup", warmup_exercises),
            ("cooldown", cooldown_exercises),
        ]:
            for i, exercise in enumerate(exercises):
                for field in required_fields:
                    if field not in exercise:
                        logger.warning(
                            f"WarmupCooldownAgent: {section} exercise {i} missing: {field}"
                        )
                        return False

                # Ensure is_timed is set to True
                exercise["is_timed"] = True

        return True

    async def generate(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate warmup/cooldown by selecting exercises from database using AI.

        First fetches available exercises from database, then uses AI to select
        the most appropriate ones based on the main workout and user profile.
        """
        from app.services.exercise_service import search_exercises

        user_profile = context.get("user_profile", {})

        # Determine equipment based on preferred_location
        preferred_location = user_profile.get("preferred_location", "home")
        equipment_options = self._get_equipment_for_location(preferred_location)

        # Fetch available warmup exercises (stretching category)
        available_warmup = []
        for equipment in equipment_options:
            exercises = search_exercises(
                category="stretching", equipment=equipment, limit=15
            )
            available_warmup.extend(exercises)

        # Fetch available cooldown exercises (stretching category)
        available_cooldown = []
        for equipment in equipment_options:
            exercises = search_exercises(
                category="stretching", equipment=equipment, limit=15
            )
            available_cooldown.extend(exercises)

        # Remove duplicates
        seen_ids = set()
        unique_warmup = []
        for ex in available_warmup:
            if ex["id"] not in seen_ids:
                seen_ids.add(ex["id"])
                unique_warmup.append(ex)

        seen_ids = set()
        unique_cooldown = []
        for ex in available_cooldown:
            if ex["id"] not in seen_ids:
                seen_ids.add(ex["id"])
                unique_cooldown.append(ex)

        # Add available exercises to context
        context["available_warmup_exercises"] = unique_warmup
        context["available_cooldown_exercises"] = unique_cooldown

        logger.info(
            f"WarmupCooldownAgent: Found {len(unique_warmup)} warmup, "
            f"{len(unique_cooldown)} cooldown exercises for {preferred_location}"
        )

        # If we have no exercises, return fallback
        if not unique_warmup or not unique_cooldown:
            logger.warning("No exercises found in database, using fallback")
            return self.get_fallback_output(context)

        # Use AI to select the best exercises
        result = await super().generate(context)

        # Enhance selected exercises with full data from database
        result = self._enhance_with_exercise_data(
            result, unique_warmup, unique_cooldown
        )

        return result

    def _get_equipment_for_location(self, preferred_location: str) -> List[str]:
        """Get appropriate equipment options based on user's preferred location."""
        location_lower = preferred_location.lower() if preferred_location else "home"

        if location_lower in ["gym", "fitness center"]:
            # Gym has all equipment available
            return [
                "body weight",
                "dumbbell",
                "barbell",
                "cable",
                "kettlebell",
                "medicine ball",
                "foam roll",
                "resistance band",
            ]
        elif location_lower in ["outdoor", "park", "outside"]:
            # Outdoor - primarily bodyweight
            return ["body weight"]
        else:
            # Home - bodyweight plus common home equipment
            return [
                "body weight",
                "dumbbell",
                "kettlebell",
                "resistance band",
                "foam roll",
            ]

    def _enhance_with_exercise_data(
        self,
        result: Dict[str, Any],
        warmup_exercises: List[Dict[str, Any]],
        cooldown_exercises: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Enhance AI-selected exercises with full database data (GIFs, instructions)."""

        # Create lookup dicts
        warmup_lookup = {ex["id"]: ex for ex in warmup_exercises}
        cooldown_lookup = {ex["id"]: ex for ex in cooldown_exercises}

        # Enhance warmup exercises
        if "warm_up" in result and "exercises" in result["warm_up"]:
            for exercise in result["warm_up"]["exercises"]:
                exercise_id = exercise.get("exercise_id")
                if exercise_id and exercise_id in warmup_lookup:
                    db_exercise = warmup_lookup[exercise_id]
                    exercise["gif_url"] = db_exercise.get("gif_url_360")
                    exercise["gif_url_thumb"] = db_exercise.get("gif_url_180")
                    exercise["target_muscle"] = db_exercise.get("target_muscle")
                    exercise["instructions"] = db_exercise.get("instructions", [])
                    exercise["equipment"] = db_exercise.get("equipment")

        # Enhance cooldown exercises
        if "cool_down" in result and "exercises" in result["cool_down"]:
            for exercise in result["cool_down"]["exercises"]:
                exercise_id = exercise.get("exercise_id")
                if exercise_id and exercise_id in cooldown_lookup:
                    db_exercise = cooldown_lookup[exercise_id]
                    exercise["gif_url"] = db_exercise.get("gif_url_360")
                    exercise["gif_url_thumb"] = db_exercise.get("gif_url_180")
                    exercise["target_muscle"] = db_exercise.get("target_muscle")
                    exercise["instructions"] = db_exercise.get("instructions", [])
                    exercise["equipment"] = db_exercise.get("equipment")

        return result

    def get_fallback_output(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Return fallback warmup/cooldown when AI selection fails."""

        return {
            "warm_up": {
                "duration_seconds": 30,
                "description": "Dynamic movement to prepare your body for exercise",
                "exercises": [
                    {
                        "name": "Arm circles",
                        "duration_seconds": 30,
                        "is_timed": True,
                        "type": "warmup",
                        "instructions": ["Circle arms forward then backward"],
                    },
                ],
            },
            "cool_down": {
                "duration_seconds": 30,
                "description": "Static stretch to aid recovery and reduce soreness",
                "exercises": [
                    {
                        "name": "Standing quad stretch",
                        "duration_seconds": 30,
                        "is_timed": True,
                        "type": "cooldown",
                        "instructions": ["Hold ankle behind you, 15 seconds each leg"],
                    },
                ],
            },
        }
