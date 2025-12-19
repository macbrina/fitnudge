"""
Timing Calculator Agent

Responsible for calculating optimal work and rest durations for exercises:
- Work duration per set (based on exercise type and reps)
- Rest between sets (based on intensity and fitness level)
- Rest between exercises
- Total workout timing optimization
"""

from typing import Dict, Any, List
from app.services.agents.base import BaseAgent
from app.services.logger import logger


class TimingCalculatorAgent(BaseAgent[Dict[str, Any]]):
    """
    Calculates work/rest timing for each exercise in the workout.
    
    Considers:
    - Exercise type (strength, cardio, stretching, plyometrics)
    - User fitness level
    - Rep count and set structure
    - Target total duration
    """
    
    MODEL = "gpt-4o-mini"
    MAX_RETRIES = 2
    TIMEOUT_SECONDS = 25.0
    
    @property
    def system_prompt(self) -> str:
        return """You are an expert fitness timing coach that calculates optimal work and rest periods for workouts.

Your role is to determine:
1. Work duration for each exercise (time to complete one set)
2. Rest between sets (recovery time between sets of same exercise)
3. Rest between exercises (transition time to next exercise)

TIMING PRINCIPLES:

By Exercise Category:
- strength: 30-60 sec work, 30-90 sec rest between sets, 60-90 sec between exercises
- cardio: 20-45 sec work, 15-30 sec rest between sets, 30-45 sec between exercises  
- stretching: 20-45 sec hold, 10-15 sec rest, 15-30 sec between exercises
- plyometrics: 15-30 sec work, 30-60 sec rest between sets, 45-60 sec between exercises

By Fitness Level:
- beginner: Longer rest periods (1.3x multiplier), shorter work periods (0.8x)
- intermediate: Standard timing (1.0x)
- advanced: Shorter rest periods (0.8x), longer work periods (1.2x)
- athlete: Minimal rest (0.7x), intense work periods (1.3x)

CALCULATION FORMULA:
- Work duration = base_time * reps_factor * level_modifier
- Rest between sets = base_rest * level_modifier
- Rest between exercises = base_transition * level_modifier

REQUIRED OUTPUT FORMAT:
{
  "exercise_timing": {
    "exercise_id_1": {
      "work_duration_seconds": 45,
      "rest_between_sets_seconds": 30,
      "tempo": "2-1-2",
      "intensity_notes": "Moderate pace, focus on form"
    },
    "exercise_id_2": { ... }
  },
  "rest_between_exercises_seconds": 60,
  "total_estimated_duration_seconds": 1800,
  "timing_notes": "Optimized for beginner level with adequate recovery"
}

Tempo format: "eccentric-pause-concentric" in seconds (e.g., "2-1-2" = 2 sec down, 1 sec pause, 2 sec up)"""
    
    def build_user_prompt(self, context: Dict[str, Any]) -> str:
        """Build the prompt for timing calculation."""
        
        user_profile = context.get("user_profile", {})
        settings = context.get("settings", {})
        selected_exercises = context.get("selected_exercises", [])
        
        # Format exercise list for timing calculation
        exercise_info = self._format_exercises_for_timing(selected_exercises)
        
        prompt = f"""Calculate optimal timing for this workout:

USER PROFILE:
- Fitness Level: {user_profile.get("fitness_level", "beginner")}
- Primary Goal: {user_profile.get("primary_goal", "general_fitness")}
- Available Time: {user_profile.get("available_time", "30-60min")}

TARGET DURATION: {settings.get("target_duration_minutes", 30)} minutes total
(includes {settings.get("warmup_duration_seconds", 300) // 60} min warmup and {settings.get("cooldown_duration_seconds", 300) // 60} min cooldown)

EXERCISES TO TIME:
{exercise_info}

Calculate:
1. Work duration for each exercise (time to complete one set)
2. Rest between sets for each exercise
3. Rest between different exercises
4. Suggested tempo for each exercise

Consider the user's {user_profile.get("fitness_level", "beginner")} fitness level when setting rest periods.
Ensure the total workout fits within the target duration.

Return timing data in the JSON format specified."""
        
        return prompt
    
    def _format_exercises_for_timing(self, exercises: List[Dict[str, Any]]) -> str:
        """Format exercises for the timing prompt."""
        
        if not exercises:
            return "No exercises provided."
        
        lines = []
        for ex in exercises:
            line = (
                f"- ID: {ex.get('exercise_id', 'N/A')}\n"
                f"  Name: {ex.get('name', 'Unknown')}\n"
                f"  Sets: {ex.get('sets', 3)}\n"
                f"  Reps: {ex.get('reps', 10)}\n"
                f"  Target: {ex.get('target_muscle', 'general')}\n"
                f"  Category: {ex.get('category', 'strength')}"
            )
            lines.append(line)
        
        return "\n".join(lines)
    
    def validate_output(self, output: Dict[str, Any]) -> bool:
        """Validate the timing calculation output."""
        
        if not output:
            return False
        
        # Check for exercise_timing dictionary
        exercise_timing = output.get("exercise_timing", {})
        if not exercise_timing or not isinstance(exercise_timing, dict):
            logger.warning("TimingCalculatorAgent: No exercise_timing in output")
            return False
        
        # Validate each exercise has required timing fields
        for exercise_id, timing in exercise_timing.items():
            if not isinstance(timing, dict):
                continue
            if "work_duration_seconds" not in timing:
                logger.warning(
                    f"TimingCalculatorAgent: Exercise {exercise_id} missing work_duration_seconds"
                )
                return False
            if "rest_between_sets_seconds" not in timing:
                logger.warning(
                    f"TimingCalculatorAgent: Exercise {exercise_id} missing rest_between_sets_seconds"
                )
                return False
        
        # Check for rest between exercises
        if "rest_between_exercises_seconds" not in output:
            logger.warning("TimingCalculatorAgent: Missing rest_between_exercises_seconds")
            return False
        
        return True
    
    def get_fallback_output(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Return fallback timing when calculation fails."""
        
        fitness_level = context.get("user_profile", {}).get("fitness_level", "beginner")
        selected_exercises = context.get("selected_exercises", [])
        
        # Default timing by fitness level
        level_config = {
            "beginner": {
                "work_base": 40,
                "rest_sets": 45,
                "rest_exercises": 75,
                "tempo": "2-1-2"
            },
            "intermediate": {
                "work_base": 45,
                "rest_sets": 35,
                "rest_exercises": 60,
                "tempo": "2-0-2"
            },
            "advanced": {
                "work_base": 50,
                "rest_sets": 30,
                "rest_exercises": 50,
                "tempo": "2-0-1"
            },
            "athlete": {
                "work_base": 55,
                "rest_sets": 25,
                "rest_exercises": 45,
                "tempo": "1-0-1"
            }
        }
        
        config = level_config.get(fitness_level, level_config["beginner"])
        
        # Generate timing for each exercise
        exercise_timing = {}
        total_duration = 0
        
        for exercise in selected_exercises:
            exercise_id = exercise.get("exercise_id", str(id(exercise)))
            sets = exercise.get("sets", 3)
            
            work_duration = config["work_base"]
            rest_sets = config["rest_sets"]
            
            exercise_timing[exercise_id] = {
                "work_duration_seconds": work_duration,
                "rest_between_sets_seconds": rest_sets,
                "tempo": config["tempo"],
                "intensity_notes": f"Standard {fitness_level} pace"
            }
            
            # Calculate total time for this exercise
            exercise_time = (sets * work_duration) + ((sets - 1) * rest_sets)
            total_duration += exercise_time
        
        # Add rest between exercises
        if len(selected_exercises) > 1:
            total_duration += (len(selected_exercises) - 1) * config["rest_exercises"]
        
        return {
            "exercise_timing": exercise_timing,
            "rest_between_exercises_seconds": config["rest_exercises"],
            "total_estimated_duration_seconds": total_duration,
            "timing_notes": f"Default timing optimized for {fitness_level} level"
        }

