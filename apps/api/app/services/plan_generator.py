"""
Plan Generator Service

Uses AI to convert abstract goals into actionable structured plans.
Generates meal plans, workout routines, and habit tracking templates.

Supports three goal types:
- habit: Ongoing habits with no end date (default)
- time_challenge: Duration-based challenges (30/60/90 days)
- target_challenge: Target-based challenges (X check-ins to complete)
"""

import json
import asyncio
from typing import Dict, Any, Optional, List
from app.services.logger import logger
from app.services.openai_service import OpenAIService
from app.core.config import settings
from app.services.feature_inventory import get_feature_context_for_ai
from app.core.subscriptions import check_user_has_feature


# ==============================================================================
# GOAL TYPE: HABIT (ongoing, no end date)
# ==============================================================================
HABIT_PLAN_CONTEXT = """
GOAL TYPE: ONGOING HABIT
This goal is an ONGOING HABIT - a practice the user wants to maintain indefinitely.

HABIT-SPECIFIC REQUIREMENTS:
- Focus on building sustainable, long-term routines
- Emphasize consistency, streaks, and habit formation
- NO end date, NO completion target - this continues forever
- Track progress through daily/weekly check-ins and streak counts
- Celebrate consistency milestones (7 days, 30 days, 100 days, etc.)

DO NOT include:
- "challenge_info" field (habits don't have challenges)
- Duration or end date references
- Target completion numbers
"""

# ==============================================================================
# GOAL TYPE: TIME CHALLENGE (duration-based)
# ==============================================================================
TIME_CHALLENGE_PLAN_CONTEXT = """
GOAL TYPE: TIME CHALLENGE
This goal is a TIME CHALLENGE - a focused effort with a specific duration.

CHALLENGE DETAILS:
- Duration: {duration_days} days
- Start Date: {start_date}
- End Date: {end_date}

TIME CHALLENGE REQUIREMENTS:
- Create a PROGRESSIVE plan that builds over the {duration_days} days
- Include weekly milestones and checkpoints
- Plan should have phases (e.g., Week 1-2: Foundation, Week 3-4: Build, etc.)
- Emphasize completion and celebration at the end
- This challenge can be shared with friends for accountability

REQUIRED: Include "challenge_info" in your plan structure:
"challenge_info": {{
  "type": "time_challenge",
  "duration_days": {duration_days},
  "start_date": "{start_date}",
  "end_date": "{end_date}",
  "milestones": [
    {{"day": 7, "title": "Week 1 Complete", "description": "You've built the foundation!"}},
    {{"day": 14, "title": "Week 2 Complete", "description": "Habits are forming!"}},
    {{"day": 21, "title": "Week 3 Complete", "description": "You're in the groove!"}},
    {{"day": {duration_days}, "title": "Challenge Complete!", "description": "Amazing achievement!"}}
  ],
  "weekly_focus": [
    {{"week": 1, "focus": "Building foundation", "intensity": "light"}},
    {{"week": 2, "focus": "Establishing rhythm", "intensity": "moderate"}},
    // ... add appropriate weeks based on duration
  ]
}}
"""

# ==============================================================================
# GOAL TYPE: TARGET CHALLENGE (check-in count based)
# ==============================================================================
TARGET_CHALLENGE_PLAN_CONTEXT = """
GOAL TYPE: TARGET CHALLENGE
This goal is a TARGET CHALLENGE - complete a specific number of check-ins.

CHALLENGE DETAILS:
- Target: {target_checkins} check-ins to complete the challenge
- No time limit - user completes at their own pace

TARGET CHALLENGE REQUIREMENTS:
- Track progress toward the target (e.g., "25/50 check-ins complete")
- Create milestones at 25%, 50%, 75%, and 100% of target
- Emphasize the achievement of reaching the target
- Celebrate each milestone reached
- This challenge can be shared with friends to compete

REQUIRED: Include "challenge_info" in your plan structure:
"challenge_info": {{
  "type": "target_challenge",
  "target_checkins": {target_checkins},
  "milestones": [
    {{"count": {milestone_25}, "percent": 25, "title": "25% Complete", "description": "Great start!"}},
    {{"count": {milestone_50}, "percent": 50, "title": "Halfway There!", "description": "You're crushing it!"}},
    {{"count": {milestone_75}, "percent": 75, "title": "75% Complete", "description": "Almost there!"}},
    {{"count": {target_checkins}, "percent": 100, "title": "Challenge Complete!", "description": "You did it!"}}
  ],
  "rewards": [
    {{"at_percent": 25, "reward": "First milestone badge"}},
    {{"at_percent": 50, "reward": "Halfway champion badge"}},
    {{"at_percent": 100, "reward": "Challenge master badge"}}
  ]
}}
"""

# ==============================================================================
# BASE SYSTEM PROMPT (shared across all goal types)
# ==============================================================================
# Base system prompt for plan generation (will be enhanced with feature context)
PLAN_GENERATION_SYSTEM_PROMPT_BASE = """You are an expert fitness coach and nutritionist working for an AI-powered fitness accountability app. Your role is to convert user goals into detailed, actionable plans that help users succeed.

IMPORTANT CONTEXT:
- This is an AI accountability app focused on consistency, not detailed tracking
- Users track progress through daily check-ins (yes/no + optional reflection)
- The app emphasizes accountability, streaks, and motivation
- Plans should be simple, actionable, and focused on building habits
- Users don't track detailed metrics like sets/reps/weight or calorie counts
- Focus on what users should DO, not what they should LOG

CRITICAL FEATURE CONSTRAINTS:
- You will be provided with a list of AVAILABLE FEATURES for this user's subscription plan
- ONLY use features that are explicitly listed as available
- If the user's goal description mentions unavailable features, adapt the plan to use only available features
- NEVER include features like "detailed workout logging", "calorie tracking", "macro tracking", "advanced analytics" unless explicitly listed as available
- ALWAYS use "daily_check_ins" as the primary tracking method (this is always available)
- If unsure about a feature, default to simple accountability check-ins
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
        {"exercise_id": "0562", "name": "barbell squat", "sets": 3, "reps": "10-12"},
        {"exercise_id": "0662", "name": "push-up", "sets": 3, "reps": "8-12"},
        // CRITICAL: Use exercise_id from AVAILABLE EXERCISES list below
        // Always include BOTH exercise_id (for demo lookup) AND name (for display)
        // Select exercises appropriate for user's fitness level and equipment
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

=== CHALLENGE-SPECIFIC STRUCTURES ===

For TIME CHALLENGES (goal_type: "time_challenge"), ADD "challenge_info" to structure:
{
  "plan_type": "workout_plan",  // or any other plan type
  "structure": {
    // ... normal structure fields ...
    "challenge_info": {
      "type": "time_challenge",
      "duration_days": 30,
      "start_date": "2024-01-01",
      "end_date": "2024-01-31",
      "milestones": [
        {"day": 7, "title": "Week 1 Complete", "description": "Foundation built!"},
        {"day": 14, "title": "Week 2 Complete", "description": "Habits forming!"},
        {"day": 21, "title": "Week 3 Complete", "description": "You're unstoppable!"},
        {"day": 30, "title": "Challenge Complete!", "description": "You did it!"}
      ],
      "weekly_focus": [
        {"week": 1, "focus": "Building foundation", "intensity": "light"},
        {"week": 2, "focus": "Establishing rhythm", "intensity": "moderate"},
        {"week": 3, "focus": "Pushing limits", "intensity": "moderate-high"},
        {"week": 4, "focus": "Finishing strong", "intensity": "high"}
      ]
    }
  },
  "guidance": {...}
}

For TARGET CHALLENGES (goal_type: "target_challenge"), ADD "challenge_info" to structure:
{
  "plan_type": "habit_plan",  // or any other plan type
  "structure": {
    // ... normal structure fields ...
    "challenge_info": {
      "type": "target_challenge",
      "target_checkins": 50,
      "milestones": [
        {"count": 13, "percent": 25, "title": "25% Complete", "description": "Great start!"},
        {"count": 25, "percent": 50, "title": "Halfway!", "description": "Keep going!"},
        {"count": 38, "percent": 75, "title": "75% Complete", "description": "Almost there!"},
        {"count": 50, "percent": 100, "title": "Challenge Complete!", "description": "Champion!"}
      ],
      "rewards": [
        {"at_percent": 25, "reward": "First milestone badge"},
        {"at_percent": 50, "reward": "Halfway hero badge"},
        {"at_percent": 100, "reward": "Challenge master badge"}
      ]
    }
  },
  "guidance": {...}
}

IMPORTANT: 
- ONLY include "challenge_info" if goal_type is "time_challenge" or "target_challenge"
- For regular habits (goal_type: "habit"), do NOT include "challenge_info"
- The plan_type (meal_plan, workout_plan, etc.) is based on CATEGORY
- The challenge_info is based on GOAL TYPE

CRITICAL GUIDELINES:
1. Analyze the goal title and description to extract:
   - Specific exercises mentioned (for workout plans)
   - Protein targets (for meal plans)
   - Duration/time (for workout plans)
   - Frequency and target days from goal.frequency and goal.target_days

2. ⚠️ MANDATORY: Choose plan_type based on goal.category - THIS IS NON-NEGOTIABLE:
   - category = "fitness" → plan_type MUST be "workout_plan" (ALWAYS, no exceptions!)
   - category = "nutrition" → plan_type MUST be "meal_plan" (ALWAYS, no exceptions!)
   - category = "wellness" → plan_type MUST be "habit_plan"
   - category = "mindfulness" → plan_type MUST be "habit_plan"
   - category = "sleep" → plan_type MUST be "habit_plan"
   - category = "custom" → plan_type = "accountability_plan"
   
   DO NOT use accountability_plan for fitness, nutrition, wellness, mindfulness, or sleep categories!
   The category determines the plan_type - this is a HARD RULE.

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

5. HANDLING EDGE CASES:
   - If goal description mentions unavailable features: Adapt the plan to use only available features, focus on accountability check-ins
   - If goal description is vague: Still generate the correct plan_type based on category, just make it simpler
   - If goal description seems contradictory: Use the CATEGORY to determine plan_type, adapt content to make sense
   - Always prioritize simplicity and accountability over complex tracking
   - NEVER change plan_type based on description - ALWAYS respect the category!

Generate the plan in valid JSON format only."""


class PlanGenerator:
    """Generate actionable plans from goals using AI"""

    def __init__(self):
        self.openai_service = OpenAIService()

    async def generate_plan(
        self,
        goal: Dict[str, Any],
        user_profile: Optional[Dict[str, Any]] = None,
        user_plan: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Generate an actionable plan from a goal using AI.

        Args:
            goal: Goal dictionary with title, description, category, frequency, etc.
            user_profile: Optional user profile for personalization
            user_plan: User's subscription plan (free, starter, pro, elite)
            user_id: User ID for feature checking (optional, for sanitization)

        Returns:
            Structured plan dictionary matching database schema or None if generation fails
        """
        try:
            # Build enhanced system prompt with feature context
            system_prompt = self._build_system_prompt_with_features(user_plan)

            # Build user prompt
            user_prompt = self._build_plan_prompt(goal, user_profile, user_plan)

            # Combine system prompt and user prompt
            full_input = f"{system_prompt}\n\n{user_prompt}\n\nPlease respond with valid JSON only in the format specified above."

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
                logger.warning(
                    "Failed to extract JSON from AI response, creating fallback plan"
                )
                return self._create_fallback_plan(goal)

            # CRITICAL: Enforce category → plan_type mapping
            # This is a safety net in case AI generates wrong plan_type
            category = goal.get("category", "custom")
            plan_json = self._fix_plan_type_for_category(plan_json, category)

            # Fix missing exercise_ids before validation (if possible)
            if plan_json.get("plan_type") == "workout_plan":
                plan_json = self._fix_missing_exercise_ids(plan_json)

            # Validate plan structure
            if not self._validate_plan(plan_json):
                logger.warning(
                    "Generated plan failed validation, creating fallback plan"
                )
                return self._create_fallback_plan(goal)

            # Sanitize plan to remove unavailable features
            if user_plan and user_id:
                plan_json = self._sanitize_plan_for_user(plan_json, user_plan, user_id)

            # Enhance exercises with GIF demos and instructions
            plan_json = self._enhance_exercises_with_demos(plan_json)

            return plan_json

        except asyncio.TimeoutError:
            logger.error(
                "Plan generation timed out after 30 seconds, creating fallback plan"
            )
            return self._create_fallback_plan(goal)
        except Exception as e:
            logger.error(
                f"AI plan generation failed: {str(e)}, creating fallback plan",
                {"goal_id": goal.get("id"), "error": str(e)},
            )
            return self._create_fallback_plan(goal)

    def _build_system_prompt_with_features(
        self, user_plan: Optional[str] = None
    ) -> str:
        """
        Build enhanced system prompt with feature context.

        Args:
            user_plan: User's subscription plan

        Returns:
            Enhanced system prompt string
        """
        prompt = PLAN_GENERATION_SYSTEM_PROMPT_BASE

        if user_plan:
            try:
                feature_context = get_feature_context_for_ai(user_plan)
                available_features = feature_context.get("available_features", [])
                features_summary = feature_context.get("features_summary", "")
                restrictions = feature_context.get("restrictions", [])

                prompt += f"""

AVAILABLE FEATURES FOR THIS USER ({user_plan.upper()} PLAN):
{features_summary}

FEATURE LIST:
{chr(10).join(f"- {feature}" for feature in available_features) if available_features else "- Basic accountability check-ins (always available)"}

RESTRICTIONS:
{chr(10).join(f"- {restriction}" for restriction in restrictions) if restrictions else "- No specific restrictions"}

CRITICAL REMINDER:
- ONLY use features listed above
- If goal description mentions unavailable features, adapt to use only available features
- Default to simple accountability check-ins if unsure
- Focus on what the user CAN do, not what they can't
"""
            except Exception as e:
                logger.warning(
                    f"Failed to get feature context: {e}, proceeding without feature constraints"
                )

        # Add the rest of the base prompt
        prompt += """

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
      "track_carbs": false,  // ONLY set to true if advanced_nutrition_tracking is available
      "track_fats": false  // ONLY set to true if advanced_nutrition_tracking is available
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
        {"exercise_id": "0562", "name": "barbell squat", "sets": 3, "reps": "10-12"},
        {"exercise_id": "0662", "name": "push-up", "sets": 3, "reps": "8-12"},
        // CRITICAL: Select from AVAILABLE EXERCISES list using exercise_id
        // Always include exercise_id AND name
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
      "track_strength_gains": false,  // NEVER set to true - not a feature
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

=== CHALLENGE-SPECIFIC STRUCTURES ===

For TIME CHALLENGES (goal_type: "time_challenge"), ADD "challenge_info" to structure:
{
  "plan_type": "workout_plan",  // or any other plan type
  "structure": {
    // ... normal structure fields ...
    "challenge_info": {
      "type": "time_challenge",
      "duration_days": 30,
      "start_date": "2024-01-01",
      "end_date": "2024-01-31",
      "milestones": [
        {"day": 7, "title": "Week 1 Complete", "description": "Foundation built!"},
        {"day": 14, "title": "Week 2 Complete", "description": "Habits forming!"},
        {"day": 21, "title": "Week 3 Complete", "description": "You're unstoppable!"},
        {"day": 30, "title": "Challenge Complete!", "description": "You did it!"}
      ],
      "weekly_focus": [
        {"week": 1, "focus": "Building foundation", "intensity": "light"},
        {"week": 2, "focus": "Establishing rhythm", "intensity": "moderate"},
        {"week": 3, "focus": "Pushing limits", "intensity": "moderate-high"},
        {"week": 4, "focus": "Finishing strong", "intensity": "high"}
      ]
    }
  },
  "guidance": {...}
}

For TARGET CHALLENGES (goal_type: "target_challenge"), ADD "challenge_info" to structure:
{
  "plan_type": "habit_plan",  // or any other plan type
  "structure": {
    // ... normal structure fields ...
    "challenge_info": {
      "type": "target_challenge",
      "target_checkins": 50,
      "milestones": [
        {"count": 13, "percent": 25, "title": "25% Complete", "description": "Great start!"},
        {"count": 25, "percent": 50, "title": "Halfway!", "description": "Keep going!"},
        {"count": 38, "percent": 75, "title": "75% Complete", "description": "Almost there!"},
        {"count": 50, "percent": 100, "title": "Challenge Complete!", "description": "Champion!"}
      ],
      "rewards": [
        {"at_percent": 25, "reward": "First milestone badge"},
        {"at_percent": 50, "reward": "Halfway hero badge"},
        {"at_percent": 100, "reward": "Challenge master badge"}
      ]
    }
  },
  "guidance": {...}
}

IMPORTANT: 
- ONLY include "challenge_info" if goal_type is "time_challenge" or "target_challenge"
- For regular habits (goal_type: "habit"), do NOT include "challenge_info"
- The plan_type (meal_plan, workout_plan, etc.) is based on CATEGORY
- The challenge_info is based on GOAL TYPE

CRITICAL GUIDELINES:
1. Analyze the goal title and description to extract:
   - Specific exercises mentioned (for workout plans)
   - Protein targets (for meal plans)
   - Duration/time (for workout plans)
   - Frequency and target days from goal.frequency and goal.target_days

2. ⚠️ MANDATORY: Choose plan_type based on goal.category - THIS IS NON-NEGOTIABLE:
   - category = "fitness" → plan_type MUST be "workout_plan" (ALWAYS, no exceptions!)
   - category = "nutrition" → plan_type MUST be "meal_plan" (ALWAYS, no exceptions!)
   - category = "wellness" → plan_type MUST be "habit_plan"
   - category = "mindfulness" → plan_type MUST be "habit_plan"
   - category = "sleep" → plan_type MUST be "habit_plan"
   - category = "custom" → plan_type = "accountability_plan"
   
   DO NOT use accountability_plan for fitness, nutrition, wellness, mindfulness, or sleep categories!
   The category determines the plan_type - this is a HARD RULE.

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

5. HANDLING EDGE CASES:
   - If goal description mentions unavailable features: Adapt the plan to use only available features, focus on accountability check-ins
   - If goal description is vague: Still generate the correct plan_type based on category, just make it simpler
   - If goal description seems contradictory: Use the CATEGORY to determine plan_type, adapt content to make sense
   - Always prioritize simplicity and accountability over complex tracking
   - NEVER change plan_type based on description - ALWAYS respect the category!
"""

        return prompt

    def _build_plan_prompt(
        self,
        goal: Dict[str, Any],
        user_profile: Optional[Dict[str, Any]] = None,
        user_plan: Optional[str] = None,
    ) -> str:
        """
        Build the user prompt for plan generation based on goal and user profile.

        Args:
            goal: Goal dictionary
            user_profile: Optional user profile for personalization
            user_plan: User's subscription plan

        Returns:
            Formatted prompt string
        """
        title = goal.get("title", "")
        description = goal.get("description", "")
        category = goal.get("category", "fitness")
        frequency = goal.get("frequency", "weekly")
        target_days = goal.get("target_days", 3)

        # Goal type fields
        goal_type = goal.get("goal_type", "habit")
        target_checkins = goal.get("target_checkins")
        challenge_duration_days = goal.get("challenge_duration_days")
        challenge_start_date = goal.get("challenge_start_date")
        challenge_end_date = goal.get("challenge_end_date")

        prompt = f"""Generate an actionable plan for this fitness goal:

GOAL DETAILS:
Title: {title}
Description: {description or "No description provided"}
Category: {category}
Frequency: {frequency}
Target Days per Week: {target_days}

"""

        # Add goal type specific context with required structure
        if goal_type == "habit":
            prompt += HABIT_PLAN_CONTEXT
        elif goal_type == "time_challenge":
            duration = challenge_duration_days or 30
            start = challenge_start_date or "Today"
            end = challenge_end_date or f"{duration} days from start"

            # Generate weekly focus based on duration
            weeks = duration // 7

            prompt += TIME_CHALLENGE_PLAN_CONTEXT.format(
                duration_days=duration,
                start_date=start,
                end_date=end,
            )
        elif goal_type == "target_challenge":
            target = target_checkins or 50
            milestone_25 = int(target * 0.25)
            milestone_50 = int(target * 0.50)
            milestone_75 = int(target * 0.75)

            prompt += TARGET_CHALLENGE_PLAN_CONTEXT.format(
                target_checkins=target,
                milestone_25=milestone_25,
                milestone_50=milestone_50,
                milestone_75=milestone_75,
            )

        prompt += "\n"

        # Add available exercises for workout plans
        if category in ["fitness", "workout", "strength", "cardio"] or any(
            keyword in title.lower()
            for keyword in [
                "workout",
                "exercise",
                "training",
                "strength",
                "cardio",
                "hiit",
            ]
        ):
            from app.services.exercise_service import get_exercises_for_ai_prompt

            # Get filtered exercises based on user profile
            available_exercises = get_exercises_for_ai_prompt(user_profile, limit=100)

            if available_exercises:
                # Format exercise list for AI (concise to save tokens)
                exercise_lines = [
                    f"{ex['id']}: {ex['name']} ({ex['target_muscle']}, {ex['equipment']}, {ex['difficulty']})"
                    for ex in available_exercises[:80]  # Limit to 80 to save tokens
                ]
                exercise_list = "\n".join(exercise_lines)

                prompt += f"""AVAILABLE EXERCISES (YOU MUST SELECT FROM THESE):
{exercise_list}

⚠️  CRITICAL REQUIREMENT FOR WORKOUT PLANS:
1. You MUST use exercise_id from the list above
2. You MUST include BOTH exercise_id AND name in EVERY exercise
3. DO NOT create custom exercise names - use the exact names from the list
4. DO NOT invent exercise_id values - use only IDs from the list above

REQUIRED FORMAT (non-negotiable):
{{
  "exercises": [
    {{"exercise_id": "0001", "name": "3/4 sit-up", "sets": 3, "reps": "10-12"}},
    {{"exercise_id": "0003", "name": "air bike", "sets": 3, "reps": "15-20"}}
  ]
}}

❌ WRONG (missing exercise_id):
{{"name": "Push-ups", "sets": 3, "reps": "10"}}

✅ CORRECT (has exercise_id):
{{"exercise_id": "0662", "name": "push-up", "sets": 3, "reps": "10"}}

If you generate a workout plan without exercise_id fields, it will be REJECTED.

"""

        if user_profile:
            fitness_level = user_profile.get("fitness_level", "beginner")
            primary_goal = user_profile.get("primary_goal", "")
            biggest_challenge = user_profile.get("biggest_challenge", "")
            current_frequency = user_profile.get("current_frequency", "")
            preferred_location = user_profile.get("preferred_location", "")
            available_time = user_profile.get("available_time", "")
            motivation_style = user_profile.get("motivation_style", "")

            prompt += f"""USER PROFILE (for personalization and adaptation):
Fitness Level: {fitness_level}
Primary Goal: {primary_goal}
Current Exercise Frequency: {current_frequency}
Preferred Workout Location: {preferred_location}
Available Time: {available_time}
Motivation Style: {motivation_style}
Biggest Challenge: {biggest_challenge}

"""

        if user_plan:
            prompt += f"""USER SUBSCRIPTION PLAN: {user_plan.upper()}
Remember: Only use features available to this plan. If the goal description mentions unavailable features, adapt the plan accordingly.

"""

        prompt += """PLAN GENERATION STRATEGY - CRITICAL:

STEP 1: ANALYZE GOAL SPECIFICITY
Determine if the goal description is SPECIFIC or VAGUE:

SPECIFIC GOAL (has concrete details):
- Mentions specific exercises, activities, or targets
- Examples: "Do 100 push-ups daily", "Hit 150g protein", "Run 5K in 30 mins"
- ACTION: Honor the user's specific intent, use profile only to adjust difficulty/intensity

VAGUE GOAL (generic or minimal details):
- General statements like "Get fit", "Eat healthy", "Exercise more", "Be more active"
- No specific exercises, targets, or activities mentioned
- ACTION: Use user profile heavily to generate specific, personalized details

STEP 2: APPLY APPROPRIATE STRATEGY

IF GOAL IS SPECIFIC:
1. Extract and honor all specific details from the goal (exercises, targets, timing, etc.)
2. Use user profile ONLY to:
   - Adjust difficulty based on fitness_level
   - Set appropriate progression based on current_frequency
   - Adapt reminders to preferred times
3. DO NOT override the user's specific intent with profile-based suggestions
4. Example: "50 burpees every morning" → Keep the 50 burpees, adjust progression for beginners if needed

IF GOAL IS VAGUE:
1. Heavily rely on user profile to fill in ALL details:
   - Use primary_goal to determine focus (strength, cardio, flexibility, etc.)
   - Use fitness_level to set appropriate difficulty and volume
   - Use preferred_location to choose exercises (home/gym/outdoor)
   - Use available_time to determine workout duration
   - Use current_frequency to set realistic target_days
   - Use biggest_challenge to address specific obstacles in the plan
2. Create a SPECIFIC, ACTIONABLE plan based on their profile
3. Example: "Get fit" + (beginner, lose_weight, struggle with time, prefer home, less_30min)
   → "20-minute bodyweight HIIT circuit at home 3x weekly"

IF GOAL MENTIONS UNAVAILABLE FEATURES:
1. Identify the CORE INTENT of the goal
2. Use user profile to understand context and needs
3. Adapt to available features while keeping the intent
4. Use profile data to make the adaptation relevant
5. Example: "Track all macros" but no advanced tracking available + (beginner, lose_weight)
   → "Track meals with daily check-ins, focus on hitting 80g protein for weight loss"

INSTRUCTIONS:
1. Analyze the goal description to determine specificity level
2. Choose the appropriate strategy (specific vs vague) from above
3. Extract relevant details from title and description:
   - For workout plans: exercises mentioned, duration, intensity, specific targets
   - For meal plans: protein targets, meal timing preferences, nutritional goals
   - For habit plans: specific habits mentioned, optimal check-in times, frequency
4. Use user profile data intelligently based on goal specificity
5. Create a realistic, actionable plan that focuses on accountability through check-ins
6. Ensure the structure matches the format exactly as specified in the examples
7. If goal mentions unavailable features, adapt using profile context

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

        # STRICT VALIDATION: Workout plans MUST have exercise_id
        if plan["plan_type"] == "workout_plan":
            exercises = (
                plan.get("structure", {}).get("routine", {}).get("exercises", [])
            )

            if exercises:
                missing_ids = []
                for i, exercise in enumerate(exercises):
                    if not exercise.get("exercise_id"):
                        exercise_name = exercise.get("name", f"Exercise {i+1}")
                        missing_ids.append(exercise_name)

                if missing_ids:
                    logger.error(
                        f"❌ VALIDATION FAILED: Workout plan missing exercise_id for: {', '.join(missing_ids)}"
                    )
                    print(
                        f"\n⚠️  PLAN REJECTED: Missing exercise_id in {len(missing_ids)} exercises"
                    )
                    print(f"   Exercises without IDs: {missing_ids}")
                    print(
                        f"   AI must return exercise_id for all exercises in workout plans!"
                    )
                    return False

                logger.info(
                    f"✅ Workout plan validation passed: All {len(exercises)} exercises have exercise_id"
                )

        return True

    def _sanitize_plan_for_user(
        self, plan: Dict[str, Any], user_plan: str, user_id: str
    ) -> Dict[str, Any]:
        """
        Sanitize generated plan to remove/disable features not available to user.
        This is a safety net in case AI still includes unavailable features.

        Args:
            plan: Generated plan dictionary
            user_plan: User's subscription plan
            user_id: User ID for feature checking

        Returns:
            Sanitized plan dictionary
        """
        from app.core.database import get_supabase_client

        try:
            supabase = get_supabase_client()
            sanitized = json.loads(json.dumps(plan))  # Deep copy

            plan_type = sanitized.get("plan_type")
            structure = sanitized.get("structure", {})

            # Sanitize meal_plan features
            if plan_type == "meal_plan":
                nutritional_targets = structure.get("nutritional_targets", {})

                # Check if user has advanced nutrition tracking
                has_advanced_nutrition = check_user_has_feature(
                    user_id, "advanced_nutrition_tracking", user_plan, supabase
                )

                if not has_advanced_nutrition:
                    # Disable advanced tracking features
                    if nutritional_targets.get("track_carbs"):
                        nutritional_targets["track_carbs"] = False

                    if nutritional_targets.get("track_fats"):
                        nutritional_targets["track_fats"] = False

                    # Remove calories if it's not a basic feature
                    if nutritional_targets.get("calories") is not None:
                        # Only keep calories if explicitly mentioned in goal
                        # For now, we'll keep it but could remove if needed
                        pass

            # Sanitize workout_plan features
            elif plan_type == "workout_plan":
                accountability = structure.get("accountability", {})

                # Ensure track_strength_gains is always False (not a feature)
                if accountability.get("track_strength_gains"):
                    accountability["track_strength_gains"] = False

            # Ensure all plans use daily_check_ins as tracking method
            if "accountability" in structure:
                structure["accountability"]["tracking_method"] = "daily_check_ins"
            elif "tracking" in structure:
                structure["tracking"]["method"] = "daily_check_ins"
            elif "habit_tracking" in structure:
                structure["habit_tracking"]["tracking_method"] = "daily_check_ins"

            sanitized["structure"] = structure
            return sanitized

        except Exception as e:
            logger.error(f"Error sanitizing plan: {e}, returning original plan")
            return plan

    def _get_expected_plan_type(self, category: str) -> str:
        """
        Get the expected plan_type based on goal category.
        This is the MANDATORY mapping - category determines plan_type.

        Args:
            category: Goal category

        Returns:
            Expected plan_type string
        """
        category_to_plan_type = {
            "fitness": "workout_plan",
            "nutrition": "meal_plan",
            "wellness": "habit_plan",
            "mindfulness": "habit_plan",
            "sleep": "habit_plan",
            "custom": "accountability_plan",
        }
        return category_to_plan_type.get(category.lower(), "accountability_plan")

    def _fix_plan_type_for_category(
        self, plan: Dict[str, Any], category: str
    ) -> Dict[str, Any]:
        """
        Fix the plan_type if AI generated the wrong type for the category.
        This is a safety net to enforce category → plan_type mapping.

        Args:
            plan: Generated plan dictionary
            category: Goal category

        Returns:
            Plan with corrected plan_type
        """
        expected_plan_type = self._get_expected_plan_type(category)
        current_plan_type = plan.get("plan_type")

        if current_plan_type != expected_plan_type:
            logger.warning(
                f"⚠️ AI generated wrong plan_type '{current_plan_type}' for category '{category}'. "
                f"Correcting to '{expected_plan_type}'"
            )
            plan["plan_type"] = expected_plan_type

            # If changing to workout_plan but missing routine, add basic structure
            if expected_plan_type == "workout_plan" and "routine" not in plan.get(
                "structure", {}
            ):
                plan["structure"]["routine"] = {
                    "exercises": [],
                    "duration_minutes": 30,
                    "rest_between_exercises": "30-60 seconds",
                    "warm_up": "5 minutes light movement",
                    "cool_down": "5 minutes stretching",
                }
                plan["structure"]["schedule"] = {
                    "frequency": "weekly",
                    "days_per_week": 3,
                    "days_of_week": ["Monday", "Wednesday", "Friday"],
                }
            # If changing to meal_plan but missing structure
            elif expected_plan_type == "meal_plan" and "meal_tracking" not in plan.get(
                "structure", {}
            ):
                plan["structure"]["meal_tracking"] = {
                    "enabled": True,
                    "meals_per_day": 3,
                    "snacks_per_day": 2,
                }
                plan["structure"]["accountability"] = {
                    "check_in_frequency": "daily",
                    "target_days_per_week": 7,
                    "tracking_method": "daily_check_ins",
                }
            # If changing to habit_plan but missing structure
            elif (
                expected_plan_type == "habit_plan"
                and "habit_tracking" not in plan.get("structure", {})
            ):
                plan["structure"]["habit_tracking"] = {
                    "check_in_frequency": "daily",
                    "target_days_per_week": 7,
                    "tracking_method": "daily_check_ins",
                }

        return plan

    def _create_fallback_plan(self, goal: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a simple fallback plan when AI generation fails.
        Respects category → plan_type mapping.

        Args:
            goal: Goal dictionary

        Returns:
            Simple plan dictionary matching the category
        """
        title = goal.get("title", "Your Goal")
        description = goal.get("description", "")
        category = goal.get("category", "custom")
        frequency = goal.get("frequency", "daily")
        target_days = goal.get("target_days", 7)

        # Determine appropriate frequency for fallback
        if frequency == "daily":
            check_in_frequency = "daily"
            target_days_per_week = 7
        elif frequency == "weekly":
            check_in_frequency = "weekly"
            target_days_per_week = min(target_days, 7)
        else:
            check_in_frequency = "daily"
            target_days_per_week = 7

        # Get the correct plan_type based on category
        plan_type = self._get_expected_plan_type(category)

        # Create category-appropriate fallback plan
        if plan_type == "workout_plan":
            fallback_plan = {
                "plan_type": "workout_plan",
                "structure": {
                    "routine": {
                        "exercises": [],
                        "duration_minutes": 30,
                        "rest_between_exercises": "30-60 seconds",
                        "warm_up": "5 minutes light movement",
                        "cool_down": "5 minutes stretching",
                    },
                    "schedule": {
                        "frequency": check_in_frequency,
                        "days_per_week": target_days_per_week,
                        "days_of_week": ["Monday", "Wednesday", "Friday"],
                    },
                    "accountability": {
                        "check_in_after_workout": True,
                        "track_consistency": True,
                        "tracking_method": "daily_check_ins",
                    },
                },
                "guidance": {
                    "description": f"Workout plan for: {title}. Focus on consistency through regular check-ins and build your fitness habit.",
                    "tips": [
                        "Check in after each workout to track your progress",
                        "Start with what feels comfortable and gradually increase intensity",
                        "Use the reflection field to note how your workout went",
                        "Stay consistent - regular workouts lead to lasting results",
                    ],
                },
            }
        elif plan_type == "meal_plan":
            fallback_plan = {
                "plan_type": "meal_plan",
                "structure": {
                    "meal_tracking": {
                        "enabled": True,
                        "meals_per_day": 3,
                        "snacks_per_day": 2,
                    },
                    "accountability": {
                        "check_in_frequency": check_in_frequency,
                        "target_days_per_week": target_days_per_week,
                        "tracking_method": "daily_check_ins",
                    },
                },
                "guidance": {
                    "description": f"Nutrition plan for: {title}. Track your meals through daily check-ins.",
                    "tips": [
                        "Check in daily to track your nutrition progress",
                        "Focus on making small, sustainable changes",
                        "Use the reflection field to note what you ate",
                        "Stay consistent - good nutrition habits compound over time",
                    ],
                },
            }
        elif plan_type == "habit_plan":
            fallback_plan = {
                "plan_type": "habit_plan",
                "structure": {
                    "habit_tracking": {
                        "check_in_frequency": check_in_frequency,
                        "target_days_per_week": target_days_per_week,
                        "tracking_method": "daily_check_ins",
                    }
                },
                "guidance": {
                    "description": f"Habit tracking for: {title}. Build consistency through daily check-ins.",
                    "tips": [
                        "Check in daily to build your streak",
                        "Start small and build up gradually",
                        "Use the reflection field to note your progress",
                        "Celebrate small wins - they add up!",
                    ],
                },
            }
        else:
            fallback_plan = {
                "plan_type": "accountability_plan",
                "structure": {
                    "tracking": {
                        "method": "daily_check_ins",
                        "frequency": check_in_frequency,
                        "target_days_per_week": target_days_per_week,
                    }
                },
                "guidance": {
                    "description": f"Simple accountability tracking for: {title}. Focus on consistency through daily check-ins and build your streak.",
                    "tips": [
                        "Check in daily to track your progress and maintain your streak",
                        "Use the reflection field to note what went well and what you learned",
                        "Stay consistent - even small daily actions lead to big results",
                        "Celebrate your wins, no matter how small they seem",
                    ],
                },
            }

        logger.info(
            f"Created fallback {plan_type} for category '{category}': {title}",
            {"goal_id": goal.get("id"), "frequency": frequency},
        )

        return fallback_plan

    def _fix_missing_exercise_ids(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        Attempt to fix missing exercise_ids by looking up exercises by name.
        This is a safety net in case AI doesn't follow the format.

        Args:
            plan: Workout plan that might have missing exercise_ids

        Returns:
            Plan with exercise_ids filled in where possible
        """
        from app.services.exercise_service import get_exercise_by_name

        exercises = plan.get("structure", {}).get("routine", {}).get("exercises", [])

        if not exercises:
            return plan

        fixed_count = 0
        for exercise in exercises:
            if not exercise.get("exercise_id") and exercise.get("name"):
                # Try to find exercise by name
                exercise_data = get_exercise_by_name(exercise["name"])
                if exercise_data:
                    exercise["exercise_id"] = exercise_data["id"]
                    fixed_count += 1
                    print(
                        f"  🔧 Fixed missing ID for '{exercise['name']}' → {exercise_data['id']}"
                    )

        if fixed_count > 0:
            print(f"✅ Auto-fixed {fixed_count} missing exercise_ids by name lookup")

        return plan

    def _enhance_exercises_with_demos(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enhance workout plan exercises with GIF demonstrations and instructions.

        Uses exercise_id for guaranteed matching (if available), falls back to name search.

        Looks up each exercise in the local database and adds:
        - GIF URLs (180px and 360px resolutions)
        - Step-by-step instructions
        - Target muscles and equipment
        - Difficulty level

        Args:
            plan: Generated plan dictionary

        Returns:
            Enhanced plan with exercise demo data
        """
        from app.services.exercise_service import (
            get_exercise_by_id,
            enhance_exercise_with_demo,
        )

        # Only enhance workout plans that have exercises
        if plan.get("plan_type") != "workout_plan":
            return plan

        # Get exercises from plan structure
        exercises = plan.get("structure", {}).get("routine", {}).get("exercises", [])

        if not exercises or not isinstance(exercises, list):
            return plan

        # Enhance each exercise with demo data
        enhanced_count = 0
        for exercise in exercises:
            if not isinstance(exercise, dict):
                continue

            # Prefer exercise_id (guaranteed match!), fallback to name
            exercise_id = exercise.get("exercise_id")
            exercise_name = exercise.get("name", "")

            demo_data = None

            if exercise_id:
                # Use ID for guaranteed match (no name issues!)
                exercise_data = get_exercise_by_id(exercise_id)
                if exercise_data:
                    demo_data = {
                        "id": exercise_data["id"],
                        "gif_url": exercise_data["gif_url_360"],
                        "gif_url_thumb": exercise_data["gif_url_180"],
                        "target_muscle": exercise_data["target_muscle"],
                        "body_part": exercise_data["body_part"],
                        "equipment": exercise_data["equipment"],
                        "difficulty": exercise_data["difficulty"],
                        "secondary_muscles": exercise_data["secondary_muscles"],
                        "instructions": exercise_data["instructions"],
                        "description": exercise_data["description"],
                        "category": exercise_data["category"],
                    }
                    logger.info(
                        f"Enhanced exercise by ID: {exercise_id} ({exercise_name})"
                    )

            # Fallback to name search (for old plans without exercise_id)
            if not demo_data and exercise_name:
                demo_data = enhance_exercise_with_demo(exercise_name)
                if demo_data:
                    logger.info(f"Enhanced exercise by name: {exercise_name}")

            if demo_data:
                exercise["demo"] = demo_data
                enhanced_count += 1
            else:
                logger.warning(
                    f"No demo found for exercise: {exercise_name} (ID: {exercise_id or 'none'})"
                )

        logger.info(f"Enhanced {enhanced_count}/{len(exercises)} exercises with demos")

        return plan
