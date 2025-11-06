"""
Plan Generator Service

Uses AI to convert abstract goals into actionable structured plans.
Generates meal plans, workout routines, and habit tracking templates.
"""

import json
import asyncio
from typing import Dict, Any, Optional, List
from app.services.logger import logger
from app.services.openai_service import OpenAIService
from app.core.config import settings


# System prompt for plan generation
PLAN_GENERATION_SYSTEM_PROMPT = """You are an expert fitness coach and nutritionist working for an AI-powered fitness accountability app. Your role is to convert user goals into detailed, actionable plans that help users succeed.

IMPORTANT CONTEXT:
- This is an AI accountability app focused on consistency, not detailed tracking
- Users track progress through daily check-ins (yes/no + optional reflection)
- The app emphasizes accountability, streaks, and motivation
- Plans should be simple, actionable, and focused on building habits
- Users don't track detailed metrics like sets/reps/weight or calorie counts
- Focus on what users should DO, not what they should LOG

PLAN TYPES:
1. **meal_plan**: For nutrition goals - protein targets, meal timing, accountability check-ins
2. **workout_plan**: For fitness goals - exercise routines, progression, consistency tracking
3. **habit_plan**: For wellness/mindfulness/sleep goals - simple habit tracking
4. **accountability_plan**: Default for any other goal - general accountability structure

REQUIRED JSON FORMAT:
{
  "plan_type": "meal_plan|workout_plan|habit_plan|accountability_plan",
  "structure": {
    // Structure varies by plan_type (see examples below)
  },
  "guidance": {
    "description": "Clear, motivating description of what this plan helps achieve",
    "tips": ["Tip 1", "Tip 2", "Tip 3"]  // 3-5 actionable tips
  }
}

STRUCTURE EXAMPLES BY PLAN TYPE:

1. MEAL_PLAN:
{
  "plan_type": "meal_plan",
  "structure": {
    "meal_tracking": {
      "enabled": true,
      "meals_per_day": 3,
      "snacks_per_day": 2
    },
    "nutritional_targets": {
      "protein": 100,  // in grams, extract from goal or set reasonable default
      "calories": null,  // null unless specified
      "track_carbs": false,
      "track_fats": false
    },
    "reminders": {
      "breakfast": "08:00",
      "lunch": "13:00",
      "dinner": "19:00"
    },
    "accountability": {
      "check_in_frequency": "daily",
      "target_days_per_week": 7,
      "tracking_method": "daily_check_ins"
    }
  },
  "guidance": {
    "description": "...",
    "tips": ["..."]
  }
}

2. WORKOUT_PLAN:
{
  "plan_type": "workout_plan",
  "structure": {
    "routine": {
      "exercises": [
        {"name": "Squats", "sets": 3, "reps": "10-12"},
        {"name": "Push-ups", "sets": 3, "reps": "8-12"},
        // Extract from goal title/description, or create appropriate routine
      ],
      "duration_minutes": 25,  // Extract from goal or set reasonable default
      "rest_between_exercises": "30-60 seconds",
      "warm_up": "5 minutes light movement",
      "cool_down": "5 minutes stretching"
    },
    "progression": {
      "method": "linear",
      "increment": "Add 1-2 reps or 5% weight each week",
      "tracking": "Use check-in reflection to note improvements"
    },
    "schedule": {
      "frequency": "weekly",
      "days_per_week": 3,
      "days_of_week": ["Monday", "Wednesday", "Friday"]  // Suggest based on days_per_week
    },
    "accountability": {
      "check_in_after_workout": true,
      "track_strength_gains": false,
      "track_consistency": true
    }
  },
  "guidance": {
    "description": "...",
    "tips": ["..."]
  }
}

3. HABIT_PLAN:
{
  "plan_type": "habit_plan",
  "structure": {
    "habit_tracking": {
      "check_in_frequency": "daily",
      "target_days_per_week": 7,
      "tracking_method": "daily_check_ins"
    },
    "reminders": {
      "optimal_times": ["09:00", "18:00"]
    }
  },
  "guidance": {
    "description": "...",
    "tips": ["..."]
  }
}

4. ACCOUNTABILITY_PLAN:
{
  "plan_type": "accountability_plan",
  "structure": {
    "tracking": {
      "method": "daily_check_ins",
      "frequency": "weekly",
      "target_days_per_week": 3
    }
  },
  "guidance": {
    "description": "...",
    "tips": ["..."]
  }
}

CRITICAL GUIDELINES:
1. Analyze the goal title and description to extract:
   - Specific exercises mentioned (for workout plans)
   - Protein targets (for meal plans)
   - Duration/time (for workout plans)
   - Frequency and target days from goal.frequency and goal.target_days

2. Choose plan_type based on goal.category and goal title:
   - nutrition/meal/protein → meal_plan
   - fitness/workout/strength/circuit → workout_plan
   - wellness/mindfulness/sleep/habit → habit_plan
   - everything else → accountability_plan

3. Make plans ACTIONABLE but SIMPLE:
   - Focus on what to DO, not what to track
   - Use check-ins, not detailed logging
   - Create realistic, achievable structures
   - Personalize based on user profile if available

4. Guidance should be:
   - Motivating and clear
   - Action-oriented
   - Focused on consistency and accountability
   - Helpful for the specific goal

Generate the plan in valid JSON format only."""


class PlanGenerator:
    """Generate actionable plans from goals using AI"""

    def __init__(self):
        self.openai_service = OpenAIService()

    async def generate_plan(
        self, goal: Dict[str, Any], user_profile: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Generate an actionable plan from a goal using AI.

        Args:
            goal: Goal dictionary with title, description, category, frequency, etc.
            user_profile: Optional user profile for personalization

        Returns:
            Structured plan dictionary matching database schema or None if generation fails
        """
        try:
            user_prompt = self._build_plan_prompt(goal, user_profile)

            # Combine system prompt and user prompt
            full_input = f"{PLAN_GENERATION_SYSTEM_PROMPT}\n\n{user_prompt}\n\nPlease respond with valid JSON only in the format specified above."

            # Call OpenAI with timeout
            response = await asyncio.wait_for(
                self.openai_service.client.responses.create(
                    model="gpt-5-mini",
                    input=full_input,
                    reasoning={"effort": "low"},
                ),
                timeout=30.0,
            )

            # Parse response
            plan_json = self._extract_json_from_response(response)

            if not plan_json:
                logger.error("Failed to extract JSON from AI response")
                return None

            # Validate plan structure
            if not self._validate_plan(plan_json):
                logger.error("Generated plan failed validation")
                return None

            logger.info(
                f"Successfully generated {plan_json.get('plan_type')} plan for goal: {goal.get('title')}",
                {"goal_id": goal.get("id"), "plan_type": plan_json.get("plan_type")},
            )

            return plan_json

        except asyncio.TimeoutError:
            logger.error("Plan generation timed out after 30 seconds")
            return None
        except Exception as e:
            logger.error(
                f"AI plan generation failed: {str(e)}",
                {"goal_id": goal.get("id"), "error": str(e)},
            )
            return None

    def _build_plan_prompt(
        self, goal: Dict[str, Any], user_profile: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Build the user prompt for plan generation based on goal and user profile.

        Args:
            goal: Goal dictionary
            user_profile: Optional user profile for personalization

        Returns:
            Formatted prompt string
        """
        title = goal.get("title", "")
        description = goal.get("description", "")
        category = goal.get("category", "fitness")
        frequency = goal.get("frequency", "weekly")
        target_days = goal.get("target_days", 3)

        prompt = f"""Generate an actionable plan for this fitness goal:

GOAL DETAILS:
Title: {title}
Description: {description or "No description provided"}
Category: {category}
Frequency: {frequency}
Target Days per Week: {target_days}

"""

        if user_profile:
            fitness_level = user_profile.get("fitness_level", "beginner")
            primary_goal = user_profile.get("primary_goal", "")
            biggest_challenge = user_profile.get("biggest_challenge", "")

            prompt += f"""USER PROFILE (for personalization):
Fitness Level: {fitness_level}
Primary Goal: {primary_goal}
Biggest Challenge: {biggest_challenge}

"""

        prompt += """INSTRUCTIONS:
1. Analyze the goal to determine the appropriate plan_type
2. Extract specific details from the title and description:
   - For workout plans: exercises mentioned, duration, intensity
   - For meal plans: protein targets, meal timing preferences
   - For habit plans: optimal check-in times, frequency
3. Create a realistic, actionable plan that focuses on accountability through check-ins
4. Make it personalized and helpful based on the goal details
5. Ensure the structure matches the format exactly as specified in the examples

Generate the complete plan JSON now."""

        return prompt

    def _extract_json_from_response(self, response) -> Optional[Dict[str, Any]]:
        """Extract JSON from OpenAI response"""
        try:
            output_text = ""
            for item in response.output:
                if hasattr(item, "content"):
                    # Skip reasoning items
                    if hasattr(item, "type") and item.type == "reasoning":
                        continue
                    for content_part in item.content:
                        if hasattr(content_part, "text"):
                            output_text += content_part.text
                        elif hasattr(content_part, "content") and content_part.content:
                            # Handle nested content
                            for nested in content_part.content:
                                if hasattr(nested, "text"):
                                    output_text += nested.text

            if not output_text:
                logger.warning("No text content found in AI response")
                return None

            # Try to extract JSON from the text
            # Look for JSON block
            json_start = output_text.find("{")
            json_end = output_text.rfind("}") + 1

            if json_start == -1 or json_end == 0:
                logger.warning("No JSON found in AI response")
                return None

            json_text = output_text[json_start:json_end]
            plan = json.loads(json_text)

            return plan

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from AI response: {e}")
            logger.error(f"Response text: {output_text[:500]}")
            return None
        except Exception as e:
            logger.error(f"Error extracting JSON from response: {e}")
            return None

    def _validate_plan(self, plan: Dict[str, Any]) -> bool:
        """Validate that plan has required structure"""
        # Check required top-level fields
        if "plan_type" not in plan:
            logger.error("Plan missing plan_type")
            return False

        if "structure" not in plan:
            logger.error("Plan missing structure")
            return False

        if "guidance" not in plan:
            logger.error("Plan missing guidance")
            return False

        # Validate plan_type
        valid_types = ["meal_plan", "workout_plan", "habit_plan", "accountability_plan"]
        if plan["plan_type"] not in valid_types:
            logger.error(f"Invalid plan_type: {plan['plan_type']}")
            return False

        # Validate guidance has required fields
        guidance = plan.get("guidance", {})
        if "description" not in guidance or "tips" not in guidance:
            logger.error("Guidance missing description or tips")
            return False

        if not isinstance(guidance["tips"], list) or len(guidance["tips"]) < 1:
            logger.error("Guidance tips must be a non-empty list")
            return False

        return True
