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
- Celebrate STREAK milestones (7 days, 30 days, 60 days, 100 days, etc.)

DO NOT include:
- "challenge_info" field (habits don't have challenges)
- "weekly_focus" field (habits are ongoing, not time-boxed phases)
- Duration or end date references
- Target completion numbers
- Finite progression phases (no Week 1-4 structure!)

REQUIRED OUTPUT FORMAT for HABITS:
Put "streak_milestones" in guidance (NOT in structure or challenge_info):

"guidance": {{
  "description": "...",
  "tips": ["...", "..."],
  "streak_milestones": [
    {{"days": 7, "title": "First Week!", "description": "You're building momentum!"}},
    {{"days": 30, "title": "30-Day Streak!", "description": "Habit is forming!"}},
    {{"days": 60, "title": "60-Day Streak!", "description": "This is becoming part of you!"}},
    {{"days": 100, "title": "100 Days!", "description": "You've mastered this habit!"}}
  ]
}}

DO NOT include "progression" with weekly_adjustments for habits - they are ongoing!
"""

# ==============================================================================
# GOAL TYPE: TIME CHALLENGE (duration-based)
# ==============================================================================
TIME_CHALLENGE_PLAN_CONTEXT = """
GOAL TYPE: TIME CHALLENGE
This goal is a TIME CHALLENGE - a focused effort with a specific duration.

CHALLENGE DETAILS:
- Duration: {duration_days} days ({num_weeks} weeks)
- Start Date: {start_date}
- End Date: {end_date}

TIME CHALLENGE REQUIREMENTS:
- Create a PROGRESSIVE plan that builds over {num_weeks} weeks
- Generate weekly milestones for EACH week (not hardcoded 4 weeks!)
- Plan phases based on ACTUAL duration:
  - 30 days (4-5 weeks): Foundation → Build → Push → Finish
  - 60 days (8-9 weeks): Foundation (2w) → Build (2w) → Intensify (2w) → Peak (2w)
  - 90 days (12-13 weeks): Foundation (3w) → Build (3w) → Intensify (3w) → Peak (2w) → Finish (2w)
- Emphasize completion and celebration at the end
- This challenge can be shared with friends for accountability

REQUIRED OUTPUT FORMAT for TIME CHALLENGES:
Include BOTH "challenge_info" AND "progression" in structure:

"structure": {{
  // ... other fields ...
  "challenge_info": {{
    "type": "time_challenge",
    "duration_days": {duration_days},
    "start_date": "{start_date}",
    "end_date": "{end_date}",
    "milestones": [
      // Generate milestone for EACH week + final day
      {{"day": 7, "title": "Week 1 Complete", "description": "Foundation built!"}},
      {{"day": 14, "title": "Week 2 Complete", "description": "Habits forming!"}},
      // ... continue for all weeks ...
      {{"day": {duration_days}, "title": "Challenge Complete!", "description": "You did it!"}}
    ]
  }},
  "progression": {{
    "current_week": 1,
    "weekly_focus": "Week 1 focus description here",
    "weekly_adjustments": [
      // Generate EXACTLY {num_weeks} entries - one for each week
      {{"week": 1, "focus": "Building foundation", "intensity": "light"}},
      {{"week": 2, "focus": "Establishing rhythm", "intensity": "moderate"}},
      // ... continue for all {num_weeks} weeks with progressive intensity
    ]
  }}
}}

INTENSITY PROGRESSION for {num_weeks} weeks:
- First 25% of weeks: "light" intensity
- Next 25% of weeks: "moderate" intensity  
- Next 25% of weeks: "moderate-high" intensity
- Final 25% of weeks: "high" intensity
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
- Progress measured by CHECK-IN COUNT, not by weeks/days

TARGET CHALLENGE REQUIREMENTS:
- Track progress toward the target (e.g., "25/50 check-ins complete")
- Create milestones at 25%, 50%, 75%, and 100% of target
- Emphasize the achievement of reaching the target
- Celebrate each milestone reached
- This challenge can be shared with friends to compete

⚠️ DO NOT include:
- "weekly_focus" or "weekly_adjustments" - target challenges are PACE-BASED, not TIME-BASED!
- "progression" field - progress is measured by check-in count, not by weeks

REQUIRED OUTPUT FORMAT for TARGET CHALLENGES:
Put "challenge_info" in structure with count-based milestones:

"structure": {{
  // ... other fields ...
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
      {{"at_percent": 50, "reward": "Halfway hero badge"}},
      {{"at_percent": 100, "reward": "Challenge master badge"}}
    ]
  }}
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

REQUIRED JSON OUTPUT FORMAT:
{
  "plan_type": "meal_plan|workout_plan|habit_plan|accountability_plan",
  "tracking_type": "workout|meal|hydration|checkin",
  "structure": {
    // Structure varies by plan_type (see examples below)
  },
  "guidance": {
    "description": "Clear, motivating description of what this plan helps achieve",
    "tips": ["Tip 1", "Tip 2", "Tip 3"]  // 3-5 actionable tips
  }
}

⚠️ CRITICAL: tracking_type DETERMINES THE USER'S CHECK-IN INTERFACE:
- "workout" → Opens the WorkoutPlayerScreen (guided workout with video demos)
- "meal" → Opens the MealLogModal (log meals with AI nutrition estimation)  
- "hydration" → Opens the HydrationModal (track water intake)
- "checkin" → Opens the simple CheckInModal (yes/no with notes)

HOW TO DETERMINE tracking_type:
- category = "fitness" → tracking_type MUST be "workout"
- category = "nutrition" → ANALYZE the goal title/description:
  - If about water, hydration, drinking fluids → tracking_type = "hydration"
  - If about food, meals, eating, protein, calories, diet → tracking_type = "meal"
- category = "wellness" → tracking_type = "checkin"
- category = "mindfulness" → tracking_type = "checkin"
- category = "sleep" → tracking_type = "checkin"

NUTRITION CATEGORY EXAMPLES:
- "Drink 8 glasses of water daily" → tracking_type: "hydration"
- "Stay hydrated throughout the day" → tracking_type: "hydration"
- "Track my water intake" → tracking_type: "hydration"
- "Eat 150g protein daily" → tracking_type: "meal"
- "Log my meals" → tracking_type: "meal"
- "Eat healthier" → tracking_type: "meal"
- "Hit my calorie goal" → tracking_type: "meal"

STRUCTURE EXAMPLES BY PLAN TYPE:

=== INTELLIGENT MEAL PLAN GENERATION ===

For MEAL_PLAN, you MUST analyze the user's profile to determine appropriate targets:

USER PROFILE ANALYSIS (use these fields when available):
- biological_sex: "male" | "female" | "prefer_not_to_say" (for accurate calorie calculations)
- primary_goal: "lose_weight" | "build_muscle" | "stay_active" | "general_fitness" | "sport_specific"
- fitness_level: "beginner" | "intermediate" | "advanced" | "athlete"
- biggest_challenge: "staying_consistent" | "getting_started" | "time_management" | "lack_of_knowledge"
- country: ISO 3166-1 alpha-2 code (for localized meal suggestions)

CALORIE & PROTEIN CALCULATION GUIDELINES (adjust based on biological_sex):
1. For weight loss (primary_goal = "lose_weight"):
   - Female: 1400-1700 cal/day (moderate deficit)
   - Male: 1800-2100 cal/day (moderate deficit)
   - Prefer not to say/unknown: 1600-2000 cal/day
   - Protein: 1.0-1.2g per kg bodyweight (or 80-120g as general guideline)
   - Focus: portion_control, balanced_eating

2. For muscle building (primary_goal = "build_muscle"):
   - Female: 1900-2300 cal/day (moderate surplus)
   - Male: 2400-2900 cal/day (moderate surplus)
   - Prefer not to say/unknown: 2200-2600 cal/day
   - Protein: 1.6-2.2g per kg bodyweight (or 120-180g as general guideline)
   - Focus: high_protein, meal_timing

3. For maintenance/general fitness:
   - Female: 1700-2000 cal/day
   - Male: 2200-2500 cal/day
   - Prefer not to say/unknown: 1900-2200 cal/day
   - Protein: 0.8-1.0g per kg bodyweight (or 60-100g as general guideline)
   - Focus: balanced_eating, consistency

4. If no user profile available, use conservative general guidelines.

LOCALIZED MEAL SUGGESTIONS (based on country):
- Suggest foods commonly available and culturally appropriate for the user's country
- Examples by country code:
  - NG (Nigeria): jollof rice, plantain, egusi soup, beans, fish stew, puff puff, moi moi
  - US (United States): oatmeal, chicken breast, salads, quinoa, Greek yogurt, eggs
  - IN (India): dal, roti, paneer, lentils, rice dishes, idli, dosa
  - GB (United Kingdom): porridge, fish, roasted vegetables, whole grain bread
  - MX (Mexico): beans, rice, grilled chicken, corn tortillas, avocado
- If country not specified, suggest internationally common foods

REMINDER TIMES (must be dynamic):
- Use the provided user_timezone to suggest appropriate meal times
- If no timezone, use general times like "morning", "midday", "evening" (not specific hours)
- Consider user's available_time preference (less_30min = suggest quick prep meals)

1. MEAL_PLAN (for food/eating goals):
{
  "plan_type": "meal_plan",
  "tracking_type": "meal",
  "structure": {
    "daily_targets": {
      "calories": 2000,  // Calculate based on user profile, or null if not primary focus
      "protein_grams": 100,  // Calculate based on user profile and goal
      "focus_area": "balanced_eating"  // One of: portion_control, high_protein, balanced_eating, calorie_deficit, calorie_surplus, meal_timing
    },
    "meal_schedule": {
      "meals_per_day": 3,
      "include_snacks": true,
      "suggested_times": {
        "breakfast": "08:00",  // Adjust based on user_timezone or use "morning" if unknown
        "lunch": "12:30",
        "dinner": "19:00",
        "snacks": ["10:30", "15:30"]  // Optional, only if include_snacks is true
      }
    },
    "meal_suggestions": {
      "breakfast_ideas": ["Greek yogurt with berries", "Oatmeal with banana"],
      "lunch_ideas": ["Grilled chicken salad", "Turkey wrap with veggies"],
      "dinner_ideas": ["Salmon with roasted vegetables", "Lean beef stir-fry"],
      "snack_ideas": ["Almonds", "Apple with peanut butter", "Protein shake"]
    },
    "accountability": {
      "check_in_frequency": "daily",
      "target_days_per_week": 7,
      "tracking_method": "meal_logging"
    }
  },
  "guidance": {
    "description": "Personalized description based on user's goal and challenges",
    "tips": ["Personalized tips based on biggest_challenge and primary_goal"]
  }
}

2. HYDRATION_PLAN (for water/hydration goals):
{
  "plan_type": "meal_plan",
  "tracking_type": "hydration",
  "structure": {
    "daily_targets": {
      "glasses": 8,  // Typical recommendation, adjust based on user activity
      "total_ml": 2000,  // 8 glasses × 250ml
      "glass_size_ml": 250
    },
    "reminder_schedule": {
      "frequency": "every_2_hours",  // Or "custom"
      "suggested_times": ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"]
      // Adjust based on user_timezone
    },
    "hydration_tips": [
      "Start your day with a glass of water",
      "Keep a water bottle at your desk",
      "Drink before you feel thirsty"
    ],
    "accountability": {
      "check_in_frequency": "daily",
      "target_days_per_week": 7,
      "tracking_method": "hydration_logging"
    }
  },
  "guidance": {
    "description": "Personalized hydration plan description",
    "tips": ["Personalized tips"]
  }
}

2. WORKOUT_PLAN:
{
  "plan_type": "workout_plan",
  "tracking_type": "workout",  // ALWAYS "workout" for fitness goals
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

3. HABIT_PLAN (for ongoing habits - NO end date, NO weekly_focus!):
{
  "plan_type": "habit_plan",
  "tracking_type": "checkin",  // ALWAYS "checkin" for wellness/mindfulness/sleep goals
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
    "tips": ["..."],
    "streak_milestones": [
      {"days": 7, "title": "First Week!", "description": "You're building momentum!"},
      {"days": 30, "title": "30-Day Streak!", "description": "Habit is forming!"},
      {"days": 60, "title": "60-Day Streak!", "description": "This is becoming part of you!"},
      {"days": 100, "title": "100 Days!", "description": "You've mastered this habit!"}
    ]
  }
}

4. ACCOUNTABILITY_PLAN:
{
  "plan_type": "accountability_plan",
  "tracking_type": "checkin",  // ALWAYS "checkin" for general accountability
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
⚠️ IMPORTANT: Generate DYNAMIC milestones and weekly_focus based on ACTUAL duration!
- 30 days = 5 milestones (7, 14, 21, 28, 30) + 5 weekly_focus entries
- 60 days = 9 milestones + 9 weekly_focus entries  
- 90 days = 13 milestones + 13 weekly_focus entries

Example for 30-day challenge:
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
        {"day": 28, "title": "Week 4 Complete", "description": "Almost there!"},
        {"day": 30, "title": "Challenge Complete!", "description": "You did it!"}
      ],
      "weekly_focus": [
        {"week": 1, "focus": "Building foundation", "intensity": "light"},
        {"week": 2, "focus": "Establishing rhythm", "intensity": "moderate"},
        {"week": 3, "focus": "Pushing limits", "intensity": "moderate-high"},
        {"week": 4, "focus": "Finishing strong", "intensity": "high"},
        {"week": 5, "focus": "Final push", "intensity": "high"}
      ]
    }
  },
  "guidance": {...}
}
For 60+ day challenges, generate proportionally more entries with progressive intensity!

For TARGET CHALLENGES (goal_type: "target_challenge"), ADD "challenge_info" to structure:
⚠️ DO NOT include "weekly_focus" - progress is by CHECK-IN COUNT, not time!
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
        use_multi_agent: bool = True,
    ) -> Optional[Dict[str, Any]]:
        """
        Generate an actionable plan from a goal using AI.

        Args:
            goal: Goal dictionary with title, description, category, frequency, etc.
            user_profile: Optional user profile for personalization
            user_plan: User's subscription plan (free, starter, pro, elite)
            user_id: User ID for feature checking (optional, for sanitization)
            use_multi_agent: Use multi-agent system for fitness plans (default: True)

        Returns:
            Structured plan dictionary matching database schema or None if generation fails
        """
        category = goal.get("category", "wellness")

        # Use multi-agent system for fitness category (workout plans)
        if use_multi_agent and category == "fitness":
            logger.info(
                "Using multi-agent system for fitness plan generation",
                {"goal_id": goal.get("id"), "category": category},
            )
            return await self._generate_with_multi_agent(
                goal, user_profile, user_plan, user_id
            )

        # Use single-prompt approach for other plan types
        return await self._generate_with_single_prompt(
            goal, user_profile, user_plan, user_id
        )

    async def _generate_with_multi_agent(
        self,
        goal: Dict[str, Any],
        user_profile: Optional[Dict[str, Any]],
        user_plan: Optional[str],
        user_id: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a workout plan using the multi-agent system.

        The orchestrator coordinates multiple specialized agents:
        - Exercise Selector: Picks appropriate exercises
        - Timing Calculator: Calculates work/rest durations
        - Warmup/Cooldown: Generates warm-up and cool-down routines
        - Progression: Creates 4-week progression schedule
        """
        try:
            from app.services.agents import OrchestratorAgent
            from app.services.exercise_service import get_exercises_for_ai_prompt

            # Get available exercises for the orchestrator
            available_exercises = get_exercises_for_ai_prompt(user_profile, limit=150)

            # Fetch user's workout feedback to improve plan generation
            workout_feedback = None
            if user_id:
                workout_feedback = self._fetch_workout_feedback(user_id)

            # Create orchestrator and generate plan
            orchestrator = OrchestratorAgent()
            plan_json = await orchestrator.generate_workout_plan(
                goal=goal,
                user_profile=user_profile,
                available_exercises=available_exercises,
                workout_feedback=workout_feedback,
            )

            if not plan_json:
                logger.warning(
                    "Multi-agent system returned empty plan, falling back to single prompt"
                )
                return await self._generate_with_single_prompt(
                    goal, user_profile, user_plan, user_id
                )

            # Validate plan structure
            if not self._validate_plan(plan_json):
                logger.warning(
                    "Multi-agent plan failed validation, falling back to single prompt"
                )
                return await self._generate_with_single_prompt(
                    goal, user_profile, user_plan, user_id
                )

            # Sanitize plan to remove unavailable features
            if user_plan and user_id:
                plan_json = self._sanitize_plan_for_user(plan_json, user_plan, user_id)

            # Enhance exercises with MP4 video demos and instructions
            plan_json = self._enhance_exercises_with_demos(plan_json)

            # Also enhance warm-up and cool-down exercises
            plan_json = self._enhance_warmup_cooldown_with_demos(plan_json)

            logger.info(
                "Multi-agent system successfully generated workout plan",
                {
                    "goal_id": goal.get("id"),
                    "exercise_count": len(
                        plan_json.get("structure", {})
                        .get("main_workout", {})
                        .get("exercises", [])
                    ),
                    "total_duration": plan_json.get("structure", {}).get(
                        "total_duration_minutes", 0
                    ),
                },
            )

            return plan_json

        except Exception as e:
            logger.error(
                f"Multi-agent plan generation failed: {str(e)}, falling back to single prompt",
                {"goal_id": goal.get("id"), "error": str(e)},
            )
            return await self._generate_with_single_prompt(
                goal, user_profile, user_plan, user_id
            )

    async def _generate_with_single_prompt(
        self,
        goal: Dict[str, Any],
        user_profile: Optional[Dict[str, Any]],
        user_plan: Optional[str],
        user_id: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a plan using the original single-prompt approach.
        Used for non-fitness plans or as fallback.
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
            category = goal.get("category", "wellness")
            plan_json = self._fix_plan_type_for_category(plan_json, category)

            # CRITICAL: Ensure tracking_type is present and valid
            plan_json = self._ensure_tracking_type(
                plan_json, category, goal.get("title", ""), goal.get("description", "")
            )

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

            # Enhance exercises with MP4 video demos and instructions
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
  "tracking_type": "meal",
  "structure": {
    "daily_targets": {
      "calories": <integer or null>,  // SMART CALCULATION: Use user's weight, height, age, activity_level, and goal (weight loss/gain/maintenance). Set null if calorie counting is not the focus.
      "protein_grams": <integer>,  // SMART CALCULATION: Based on user's weight (typically 1.6-2.2g per kg for active individuals, 0.8-1g for sedentary). Extract specific targets from goal description if mentioned.
      "focus_area": "<string>"  // Choose based on goal analysis. Options: "portion_control", "high_protein", "balanced_eating", "calorie_deficit", "calorie_surplus", "meal_timing"
    },
    "meal_schedule": {
      "meals_per_day": <integer>,  // Analyze goal and user preferences. Typically 3-5 meals.
      "include_snacks": <boolean>,  // Based on goal - weight loss may prefer no snacks, muscle building may want snacks
      "suggested_times": {
        "breakfast": "<HH:MM>",  // Adjust based on user_timezone if provided
        "lunch": "<HH:MM>",
        "dinner": "<HH:MM>",
        "snacks": ["<HH:MM>", ...]  // Only if include_snacks is true
      }
    },
    "meal_suggestions": {
      // IMPORTANT: Personalize based on user's country/region (if known from timezone) and dietary preferences
      // Consider cultural eating patterns, locally available foods, and user's fitness goals
      "breakfast_ideas": ["<culturally relevant + goal-aligned breakfast>", ...],  // 3-4 ideas
      "lunch_ideas": ["<culturally relevant + goal-aligned lunch>", ...],  // 3-4 ideas
      "dinner_ideas": ["<culturally relevant + goal-aligned dinner>", ...],  // 3-4 ideas
      "snack_ideas": ["<healthy, goal-aligned snacks>", ...]  // 2-3 ideas
    },
    "accountability": {
      "check_in_frequency": "daily",
      "target_days_per_week": <integer>,  // From goal.target_days or default to 7
      "tracking_method": "meal_logging"
    }
  },
  "guidance": {
    "description": "...",
    "tips": ["..."]  // Personalized tips based on user's specific goal and situation
  }
}

MEAL PLAN INTELLIGENCE GUIDELINES:
- Calculate calories using: BMR × Activity Multiplier ± deficit/surplus based on goal
  - BMR (Mifflin-St Jeor): Men = 10×weight(kg) + 6.25×height(cm) - 5×age + 5
  - BMR (Mifflin-St Jeor): Women = 10×weight(kg) + 6.25×height(cm) - 5×age - 161
  - Activity multipliers: sedentary=1.2, light=1.375, moderate=1.55, active=1.725, very_active=1.9
- Protein recommendations: Weight loss = 1.6-2g/kg, Muscle gain = 1.8-2.2g/kg, Maintenance = 1.2-1.6g/kg
- Meal suggestions should reflect the user's likely cultural context (infer from timezone if country not specified)
- If user timezone suggests Asia: consider rice-based meals, Asian proteins, local vegetables
- If user timezone suggests Europe: consider Mediterranean options, local cuisines
- If user timezone suggests Americas: consider local preferences while keeping meals healthy
- Always align meal suggestions with the user's stated goal (high protein for muscle building, low calorie for weight loss, etc.)

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

3. HABIT_PLAN (for ongoing habits - NO end date, NO weekly_focus!):
{
  "plan_type": "habit_plan",
  "tracking_type": "checkin",  // ALWAYS "checkin" for wellness/mindfulness/sleep goals
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
    "tips": ["..."],
    "streak_milestones": [
      {"days": 7, "title": "First Week!", "description": "You're building momentum!"},
      {"days": 30, "title": "30-Day Streak!", "description": "Habit is forming!"},
      {"days": 60, "title": "60-Day Streak!", "description": "This is becoming part of you!"},
      {"days": 100, "title": "100 Days!", "description": "You've mastered this habit!"}
    ]
  }
}

4. ACCOUNTABILITY_PLAN:
{
  "plan_type": "accountability_plan",
  "tracking_type": "checkin",  // ALWAYS "checkin" for general accountability
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
⚠️ IMPORTANT: Generate DYNAMIC milestones and weekly_focus based on ACTUAL duration!
- 30 days = 5 milestones (7, 14, 21, 28, 30) + 5 weekly_focus entries
- 60 days = 9 milestones + 9 weekly_focus entries  
- 90 days = 13 milestones + 13 weekly_focus entries

Example for 30-day challenge:
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
        {"day": 28, "title": "Week 4 Complete", "description": "Almost there!"},
        {"day": 30, "title": "Challenge Complete!", "description": "You did it!"}
      ],
      "weekly_focus": [
        {"week": 1, "focus": "Building foundation", "intensity": "light"},
        {"week": 2, "focus": "Establishing rhythm", "intensity": "moderate"},
        {"week": 3, "focus": "Pushing limits", "intensity": "moderate-high"},
        {"week": 4, "focus": "Finishing strong", "intensity": "high"},
        {"week": 5, "focus": "Final push", "intensity": "high"}
      ]
    }
  },
  "guidance": {...}
}
For 60+ day challenges, generate proportionally more entries with progressive intensity!

For TARGET CHALLENGES (goal_type: "target_challenge"), ADD "challenge_info" to structure:
⚠️ DO NOT include "weekly_focus" - progress is by CHECK-IN COUNT, not time!
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

            # Calculate number of weeks (round up to include partial weeks)
            num_weeks = (
                duration + 6
            ) // 7  # e.g., 30 days = 5 weeks, 60 days = 9 weeks, 90 days = 13 weeks

            prompt += TIME_CHALLENGE_PLAN_CONTEXT.format(
                duration_days=duration,
                num_weeks=num_weeks,
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
            biological_sex = user_profile.get("biological_sex", "")
            user_timezone = user_profile.get("timezone", "")
            user_country = user_profile.get("country", "")
            hydration_unit = user_profile.get("hydration_unit", "ml")
            hydration_daily_target_ml = user_profile.get(
                "hydration_daily_target_ml", 2000
            )

            prompt += f"""USER PROFILE (for personalization and adaptation):
Biological Sex: {biological_sex or "Not specified - use general calorie guidelines"}
Fitness Level: {fitness_level}
Primary Goal: {primary_goal}
Current Exercise Frequency: {current_frequency}
Preferred Workout Location: {preferred_location}
Available Time: {available_time}
Motivation Style: {motivation_style}
Biggest Challenge: {biggest_challenge}
User Timezone: {user_timezone or "Not specified - use general time references like 'morning', 'afternoon', 'evening'"}
User Country: {user_country or "Not specified - suggest internationally common foods"}
Hydration Preference: {hydration_unit} (daily target: {hydration_daily_target_ml}ml)

⚠️ IMPORTANT FOR NUTRITION PLANS:
- CALORIE CALCULATIONS based on biological_sex:
  - If "male": Use male baseline (2000-2500 cal for maintenance, adjust for goal)
  - If "female": Use female baseline (1600-2000 cal for maintenance, adjust for goal)
  - If not specified: Use general guidelines (1800-2200 cal)
- If primary_goal is "lose_weight": Focus on calorie deficit (subtract 300-500 cal from maintenance)
- If primary_goal is "build_muscle": Focus on protein intake (1.6-2.2g/kg bodyweight), calorie surplus (add 300-500 cal)
- If primary_goal is "stay_active" or "general_fitness": Focus on balanced eating, moderate targets
- Use biggest_challenge to personalize tips (e.g., "time_management" = suggest quick meal prep ideas)
- Use available_time to adjust meal complexity (e.g., "less_30min" = simple, quick meals)

⚠️ MEAL SUGGESTIONS - LOCALIZED:
- If country is specified, suggest foods commonly available in that country
- Consider cultural food preferences and local ingredients
- For unspecified country, suggest internationally common, accessible foods
- Examples:
  - Nigeria (NG): Include foods like jollof rice, plantain, egusi soup, beans
  - United States (US): Include oatmeal, chicken breast, salads, quinoa
  - India (IN): Include dal, roti, paneer, lentils, rice dishes
  - UK (GB): Include porridge, fish, vegetables, whole grain bread

⚠️ REMINDER TIMES:
- If timezone is specified, calculate appropriate local times for meals/hydration reminders
- If timezone is NOT specified, use descriptive times: "morning", "midday", "afternoon", "evening"
- Never hardcode times like "08:00" without knowing the user's timezone

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

    def _fetch_workout_feedback(self, user_id: str) -> Optional[List[Dict[str, Any]]]:
        """
        Fetch user's past workout feedback to improve plan generation.

        Returns recent feedback (last 30 days, max 50 entries) with reasons
        why user quit workouts. This helps AI avoid exercises that are:
        - Too hard for the user
        - Too easy (boring)
        - User doesn't know how to do
        """
        try:
            from app.db.supabase import get_supabase_client
            from datetime import datetime, timedelta, timezone

            supabase = get_supabase_client()

            # Get feedback from last 30 days
            thirty_days_ago = (
                datetime.now(timezone.utc) - timedelta(days=30)
            ).isoformat()

            result = (
                supabase.table("workout_feedback")
                .select("quit_reason, created_at, plan_id, exercise_name")
                .eq("user_id", user_id)
                .gte("created_at", thirty_days_ago)
                .order("created_at", desc=True)
                .limit(50)
                .execute()
            )

            if result.data:
                logger.info(
                    f"Fetched {len(result.data)} workout feedback entries for user",
                    {"user_id": user_id, "feedback_count": len(result.data)},
                )
                return result.data

            return None

        except Exception as e:
            logger.warning(
                f"Failed to fetch workout feedback: {e}",
                {"user_id": user_id, "error": str(e)},
            )
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
                daily_targets = structure.get("daily_targets", {})

                # Check if user has advanced nutrition tracking
                has_advanced_nutrition = check_user_has_feature(
                    user_id, "advanced_nutrition_tracking", user_plan, supabase
                )

                if not has_advanced_nutrition:
                    # Basic users don't get detailed macro tracking
                    # But calories and protein are allowed for all users
                    if daily_targets.get("track_carbs"):
                        daily_targets["track_carbs"] = False
                    if daily_targets.get("track_fats"):
                        daily_targets["track_fats"] = False

                # Ensure tracking_type is set for meal plans
                if "tracking_type" not in sanitized:
                    sanitized["tracking_type"] = "meal"

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
        }
        return category_to_plan_type.get(category.lower(), "habit_plan")

    def _get_tracking_type(
        self, category: str, title: str = "", description: str = ""
    ) -> str:
        """
        Get the tracking_type based on category and goal content.

        This determines which check-in UI the user will see:
        - "workout" → WorkoutPlayerScreen (guided workout with video demos)
        - "meal" → MealLogModal (log meals with AI nutrition estimation)
        - "hydration" → HydrationModal (track water intake)
        - "checkin" → CheckInModal (simple yes/no with notes)

        Args:
            category: Goal category
            title: Goal title
            description: Goal description

        Returns:
            tracking_type string
        """
        category_lower = category.lower()

        # Fitness always uses workout tracking
        if category_lower == "fitness":
            return "workout"

        # Nutrition can be either meal or hydration - analyze the content
        if category_lower == "nutrition":
            combined_text = f"{title} {description}".lower()

            # Keywords that indicate hydration tracking
            hydration_keywords = [
                "water",
                "hydrat",  # hydration, hydrated, hydrating
                "drink",
                "fluid",
                "glass",
                "liter",
                "litre",
                "oz",
                "ounce",
                "ml",
                "h2o",
            ]

            for keyword in hydration_keywords:
                if keyword in combined_text:
                    return "hydration"

            # Default to meal for nutrition category
            return "meal"

        # All other categories use simple check-in
        return "checkin"

    def _ensure_tracking_type(
        self,
        plan: Dict[str, Any],
        category: str,
        title: str = "",
        description: str = "",
    ) -> Dict[str, Any]:
        """
        Ensure the plan has a valid tracking_type.

        If AI didn't provide tracking_type or provided an invalid one,
        derive it from the category and goal content.

        Args:
            plan: Generated plan dictionary
            category: Goal category
            title: Goal title
            description: Goal description

        Returns:
            Plan with valid tracking_type
        """
        current_tracking_type = plan.get("tracking_type")
        valid_tracking_types = ["workout", "meal", "hydration", "checkin"]

        if current_tracking_type not in valid_tracking_types:
            expected_tracking_type = self._get_tracking_type(
                category, title, description
            )

            if current_tracking_type:
                logger.warning(
                    f"⚠️ AI generated invalid tracking_type '{current_tracking_type}'. "
                    f"Correcting to '{expected_tracking_type}' based on category '{category}'"
                )
            else:
                logger.info(
                    f"AI did not provide tracking_type. "
                    f"Deriving '{expected_tracking_type}' from category '{category}'"
                )

            plan["tracking_type"] = expected_tracking_type

        return plan

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
            elif expected_plan_type == "meal_plan" and "daily_targets" not in plan.get(
                "structure", {}
            ):
                plan["structure"]["daily_targets"] = {
                    "calories": None,
                    "protein_grams": None,
                    "focus_area": "balanced_eating",
                }
                plan["structure"]["meal_schedule"] = {
                    "meals_per_day": 3,
                    "include_snacks": True,
                    "suggested_times": {
                        "breakfast": "morning",
                        "lunch": "midday",
                        "dinner": "evening",
                    },
                }
                plan["structure"]["accountability"] = {
                    "check_in_frequency": "daily",
                    "target_days_per_week": 7,
                    "tracking_method": "meal_logging",
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
        category = goal.get("category", "wellness")
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

        # Get the correct tracking_type based on category and goal title/description
        tracking_type = self._get_tracking_type(category, title, description)

        # Create category-appropriate fallback plan
        if plan_type == "workout_plan":
            fallback_plan = {
                "plan_type": "workout_plan",
                "tracking_type": tracking_type,
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
            # For nutrition, determine if it's meal or hydration tracking
            if tracking_type == "hydration":
                fallback_plan = {
                    "plan_type": "meal_plan",
                    "tracking_type": "hydration",
                    "structure": {
                        "daily_targets": {
                            "glasses": 8,
                            "total_ml": 2000,
                            "glass_size_ml": 250,
                        },
                        "reminder_schedule": {
                            "frequency": "every_2_hours",
                            "suggested_times": [
                                "morning",
                                "mid-morning",
                                "noon",
                                "afternoon",
                                "evening",
                            ],
                        },
                        "hydration_tips": [
                            "Start your day with a glass of water",
                            "Keep a water bottle at your desk",
                            "Drink before you feel thirsty",
                        ],
                        "accountability": {
                            "check_in_frequency": check_in_frequency,
                            "target_days_per_week": target_days_per_week,
                            "tracking_method": "hydration_logging",
                        },
                    },
                    "guidance": {
                        "description": f"Hydration plan for: {title}. Track your water intake daily to stay energized and healthy.",
                        "tips": [
                            "Keep a water bottle with you throughout the day",
                            "Set reminders to drink water regularly",
                            "Drink a glass of water before each meal",
                            "Stay consistent - proper hydration improves energy and focus",
                        ],
                    },
                }
            else:
                fallback_plan = {
                    "plan_type": "meal_plan",
                    "tracking_type": "meal",
                    "structure": {
                        "daily_targets": {
                            "calories": None,  # Will be personalized when user profile is available
                            "protein_grams": None,
                            "focus_area": "balanced_eating",
                        },
                        "meal_schedule": {
                            "meals_per_day": 3,
                            "include_snacks": True,
                            "suggested_times": {
                                "breakfast": "morning",
                                "lunch": "midday",
                                "dinner": "evening",
                            },
                        },
                        "meal_suggestions": {
                            "breakfast_ideas": [
                                "Greek yogurt with berries",
                                "Oatmeal with banana",
                                "Eggs with whole grain toast",
                            ],
                            "lunch_ideas": [
                                "Grilled chicken salad",
                                "Turkey wrap with veggies",
                                "Quinoa bowl with vegetables",
                            ],
                            "dinner_ideas": [
                                "Salmon with roasted vegetables",
                                "Lean beef stir-fry",
                                "Grilled chicken with sweet potato",
                            ],
                            "snack_ideas": [
                                "Almonds",
                                "Apple with peanut butter",
                                "Greek yogurt",
                            ],
                        },
                        "accountability": {
                            "check_in_frequency": check_in_frequency,
                            "target_days_per_week": target_days_per_week,
                            "tracking_method": "meal_logging",
                        },
                    },
                    "guidance": {
                        "description": f"Nutrition plan for: {title}. Track your meals and build healthy eating habits.",
                        "tips": [
                            "Log your meals to stay aware of what you eat",
                            "Focus on making small, sustainable changes",
                            "Eat protein with every meal to stay satisfied",
                            "Stay consistent - good nutrition habits compound over time",
                        ],
                    },
                }
        elif plan_type == "habit_plan":
            fallback_plan = {
                "plan_type": "habit_plan",
                "tracking_type": tracking_type,
                "structure": {
                    "habit_tracking": {
                        "check_in_frequency": check_in_frequency,
                        "target_days_per_week": target_days_per_week,
                        "tracking_method": "daily_check_ins",
                    },
                    "reminders": {
                        "optimal_times": ["morning", "evening"],
                    },
                },
                "guidance": {
                    "description": f"Habit tracking for: {title}. Build consistency through daily check-ins.",
                    "tips": [
                        "Check in daily to build your streak",
                        "Start small and build up gradually",
                        "Use the reflection field to note your progress",
                        "Celebrate small wins - they add up!",
                    ],
                    "streak_milestones": [
                        {
                            "days": 7,
                            "title": "First Week!",
                            "description": "You're building momentum!",
                        },
                        {
                            "days": 30,
                            "title": "30-Day Streak!",
                            "description": "Habit is forming!",
                        },
                        {
                            "days": 60,
                            "title": "60-Day Streak!",
                            "description": "This is becoming part of you!",
                        },
                        {
                            "days": 100,
                            "title": "100 Days!",
                            "description": "You've mastered this habit!",
                        },
                    ],
                },
            }
        else:
            fallback_plan = {
                "plan_type": "accountability_plan",
                "tracking_type": tracking_type,
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
        Enhance workout plan exercises with MP4 video demonstrations and instructions.

        Uses exercise_id for guaranteed matching (if available), falls back to name search.

        Looks up each exercise in the local database and adds:
        - MP4 video URL
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
        # Support both legacy format (routine.exercises) and new format (main_workout.exercises)
        structure = plan.get("structure", {})
        exercises = structure.get("routine", {}).get("exercises", [])

        # Also check main_workout.exercises (multi-agent format)
        if not exercises:
            exercises = structure.get("main_workout", {}).get("exercises", [])

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
                        "mp4_url": exercise_data["mp4_url"],
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
                # Also add mp4_url directly for easier access on frontend
                if demo_data.get("mp4_url") and not exercise.get("mp4_url"):
                    exercise["mp4_url"] = demo_data["mp4_url"]
                enhanced_count += 1
            else:
                logger.error(
                    f"CRITICAL: No demo found for exercise: {exercise_name} (ID: {exercise_id or 'none'}). "
                    f"This exercise will not display properly!"
                )

        logger.info(f"Enhanced {enhanced_count}/{len(exercises)} exercises with demos")

        return plan

    def _enhance_warmup_cooldown_with_demos(
        self, plan: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Enhance warm-up and cool-down exercises with MP4 video demonstrations.

        Similar to _enhance_exercises_with_demos but for warm-up/cool-down sections
        generated by the multi-agent system.

        Args:
            plan: Generated plan dictionary with warm_up and cool_down sections

        Returns:
            Enhanced plan with demo data for warm-up/cool-down exercises
        """
        from app.services.exercise_service import (
            get_exercise_by_id,
            get_exercise_by_name,
        )

        if plan.get("plan_type") != "workout_plan":
            return plan

        structure = plan.get("structure", {})

        # Helper to enhance an exercise
        def enhance_exercise(exercise: Dict[str, Any], section_name: str) -> None:
            if not isinstance(exercise, dict):
                return

            exercise_id = exercise.get("exercise_id")
            exercise_name = exercise.get("name", "")
            exercise_data = None

            if exercise_id:
                exercise_data = get_exercise_by_id(exercise_id)

            if not exercise_data and exercise_name:
                exercise_data = get_exercise_by_name(exercise_name)
                if exercise_data:
                    exercise["exercise_id"] = exercise_data["id"]

            if exercise_data:
                exercise["demo"] = {
                    "id": exercise_data["id"],
                    "mp4_url": exercise_data["mp4_url"],
                    "target_muscle": exercise_data["target_muscle"],
                    "instructions": exercise_data["instructions"],
                }
                # Also add mp4_url directly for easier frontend access
                if not exercise.get("mp4_url"):
                    exercise["mp4_url"] = exercise_data["mp4_url"]
                logger.info(f"Enhanced {section_name} exercise: {exercise_name}")
            else:
                logger.error(
                    f"CRITICAL: Could not find {section_name} exercise: {exercise_name} "
                    f"(ID: {exercise_id or 'none'})"
                )

        # Enhance warm-up exercises
        warm_up = structure.get("warm_up", {})
        warm_up_exercises = warm_up.get("exercises", [])
        for exercise in warm_up_exercises:
            enhance_exercise(exercise, "warmup")

        # Enhance cool-down exercises
        cool_down = structure.get("cool_down", {})
        cool_down_exercises = cool_down.get("exercises", [])
        for exercise in cool_down_exercises:
            enhance_exercise(exercise, "cooldown")

        return plan
