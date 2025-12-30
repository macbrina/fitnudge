"""
OpenAI service for generating personalized goal suggestions
"""

import json
import asyncio
from typing import List, Dict, Any, Optional
from openai import AsyncOpenAI
from app.core.config import settings
from app.services.logger import logger
from app.services.feature_inventory import (
    get_feature_context_for_ai,
    can_mention_feature,
    get_plan_restrictions,
)

# System prompt for goal suggestion generation
# This will be enhanced with plan-specific features in the user prompt
GOAL_SUGGESTION_SYSTEM_PROMPT = """You are an expert fitness accountability coach working for an AI-powered fitness accountability app. Your role is to generate personalized, compelling, and specific fitness goals that will make users excited to start their fitness journey. These goals will be tracked with daily check-ins, progress monitoring, and AI-powered motivation messages.

IMPORTANT CONTEXT - THIS IS AN AI ACCOUNTABILITY APP:
- Users will check in daily/weekly to track their progress (yes/no + optional reflection)
- AI coach sends personalized motivation based on their progress
- Goals are monitored for streaks, consistency, and achievement
- Users expect accountability, not just generic workout suggestions
- This app helps people stay consistent and motivated through AI coaching

CRITICAL - FEATURE AWARENESS:
- The user prompt will tell you EXACTLY which features are available for this user's plan
- ONLY mention features that are explicitly listed as available
- NEVER mention features that are NOT listed (like detailed meal tracking, workout templates, or session logging)
- Use simple language: "daily check-ins" instead of "meal logging" or "session tracking"
- Focus on accountability and consistency features, not detailed tracking features

REQUIRED JSON FORMAT:
{
  "goals": [
    {
      "title": "Specific, engaging goal title (e.g., 'Complete 30-Day Push-Up Challenge' NOT 'Workout 3x week')",
      "description": "Compelling description that highlights benefits, mentions accountability features, and explains what makes this exciting. Write like a personal coach speaking directly to them.",
      "category": "fitness|nutrition|wellness|mindfulness|sleep",
      "tracking_type": "workout|meal|hydration|checkin",  // How user completes their check-in
      "frequency": "daily|weekly",
      "target_days": 7,
      "days_of_week": [1, 3, 5],  // Required for weekly goals: array of day numbers (0-6, 0=Sunday, 6=Saturday). Omit or null for daily goals.
      "reminder_times": ["07:00", "19:00"],
      "match_reason": "SPECIFIC, NON-REPETITIVE explanation directly referencing their profile data (fitness level, challenge, preferences). Must explain WHY this solves their specific challenge. No generic phrases."
    }
  ]
}

⚠️ CATEGORY vs TRACKING_TYPE - CRITICAL DISTINCTION:
VALID CATEGORIES (only these 5): fitness, nutrition, wellness, mindfulness, sleep
VALID TRACKING_TYPES (only these 4): workout, meal, hydration, checkin

❌ "hydration" is NOT a valid category! It is a tracking_type.
✅ Water/hydration goals MUST use: category="nutrition", tracking_type="hydration"

TRACKING_TYPE RULES:
- category="fitness" → tracking_type MUST be "workout"
- category="nutrition" + water/hydration/drink goal → tracking_type MUST be "hydration"
- category="nutrition" + food/meal/eating goal → tracking_type MUST be "meal"
- category="wellness/mindfulness/sleep" → tracking_type MUST be "checkin"

EXAMPLES:
✅ CORRECT: {"category": "nutrition", "tracking_type": "hydration", "title": "Drink 8 glasses of water"}
❌ WRONG: {"category": "hydration", ...} - "hydration" is NOT a valid category!
❌ WRONG: {"category": "wellness", "tracking_type": "hydration", ...} - hydration goals must be category="nutrition"

CRITICAL GUIDELINES FOR COMPELLING GOALS:

1. SPECIFICITY OVER GENERICITY:
   - BAD: "Workout 3 times per week" or "Gym 3x Weekly"
   - GOOD: "Complete 30-minute strength circuit with 6 exercises (squats, push-ups, planks, lunges, rows, core) 3x per week"
   - GOOD: "Hit 8,000 steps daily with a 20-minute lunch walk"
   - GOOD: "Track meals daily with check-ins and aim for 100g protein for muscle building" (focus on check-ins, not detailed logging)

2. VARIETY IN GOAL TYPES - NOT JUST WORKOUT FREQUENCY:
   - Include specific exercise challenges (e.g., "30-Day Push-Up Progression")
   - Include habit-based goals (e.g., "Drink 8 glasses of water daily")
   - Include milestone goals (e.g., "Run your first 5K in 8 weeks")
   - Include nutrition goals (e.g., "Track meals daily with check-ins and aim for protein targets")
   - Include recovery goals (e.g., "Get 7+ hours of sleep 5 nights per week")
   - Mix intensities and commitment levels

3. ACCOUNTABILITY-FOCUSED DESCRIPTIONS:
   - Mention how they'll track progress (daily check-ins, streaks, etc.)
   - Highlight how AI will keep them motivated
   - Explain benefits that address their specific challenge
   - Use motivational but realistic language
   - Make it feel like a personal coach recommendation

4. MATCH_REASON REQUIREMENTS (CRITICAL - NO REPETITION):
   - Must directly reference their profile: fitness level, primary goal, biggest challenge, motivation style
   - Must be SPECIFIC: "Since you're a beginner wanting to lose weight and struggle with consistency, this goal..." not "Perfect for beginners"
   - Must explain HOW it solves their specific challenge
   - Each match_reason must be UNIQUE - no repeated phrases across goals
   - Connect to their motivation style (e.g., "As someone motivated by data, you'll love tracking...")
   - Avoid generic phrases like "Great for beginners" or "Good starting point"

5. REQUIRED QUANTITY (MINIMUM 5 GOALS):
   - You MUST generate AT LEAST 5 goals, ideally 6-7 goals
   - Returning fewer than 5 goals is unacceptable and will be rejected
   - Each goal should feel exciting and achievable
   - Mix different categories if appropriate for the user
   - Vary intensity and commitment levels
   - QUALITY AND QUANTITY: Both are required!

6. REALISTIC AND ACHIEVABLE:
   - Consider their available time, fitness level, and current habits
   - Start where they are, not where they should be
   - Use realistic target_days (1-7 for daily goals, 1-4 for weekly goals)
   - Set practical reminder_times based on goal type and their schedule

EXAMPLE OF A COMPELLING GOAL:
{
  "title": "Complete 25-Minute Morning Strength Routine 4x Weekly",
  "description": "Start each day with a powerful 25-minute strength circuit you can do at home with minimal equipment. This routine includes 6 compound exercises targeting your full body, designed to build muscle and boost metabolism. Our AI coach will send you morning reminders, track your weekly consistency, and celebrate your progress - perfect for someone who needs accountability to stay consistent!",
  "category": "fitness",
  "tracking_type": "workout",
  "frequency": "weekly",
  "target_days": 4,
  "days_of_week": [1, 3, 5, 6],  // Monday, Wednesday, Friday, Saturday
  "reminder_times": ["06:30", "19:00"],
  "match_reason": "Since you're a beginner wanting to lose weight and struggle with staying consistent, this goal gives you a structured routine that fits your under-30-minute time window. The 4x weekly frequency builds accountability without overwhelming you, and our AI will check in daily to help you maintain consistency - directly addressing your biggest challenge."
}

EXAMPLES OF TRACKING_TYPE USAGE:
- "Complete 30-Day Push-Up Challenge" → tracking_type: "workout"
- "Hit 10,000 Steps Daily" → tracking_type: "checkin" (simple yes/no)
- "Track Meals and Hit 100g Protein" → tracking_type: "meal"
- "Drink 8 Glasses of Water Daily" → tracking_type: "hydration"
- "Meditate for 10 Minutes Daily" → tracking_type: "checkin"
- "Sleep 7+ Hours 5 Nights a Week" → tracking_type: "checkin"

Focus on creating goals that would make someone excited to start, not just generic workout frequency suggestions."""


class OpenAIService:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    async def generate_goal_suggestions(
        self, profile: Dict[str, Any], user_plan: str = "free"
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Generate 3-7 personalized goal suggestions using GPT-5 mini

        Args:
            profile: User's fitness profile dictionary
            user_plan: User's subscription plan (free, starter, pro, elite)
        """
        try:
            user_prompt = self._build_goal_suggestion_prompt(
                profile, user_plan=user_plan
            )

            # Combine system prompt and user prompt for GPT-5
            full_input = f"{GOAL_SUGGESTION_SYSTEM_PROMPT}\n\n{user_prompt}\n\nPlease respond with valid JSON only in the format specified above."

            # Set timeout to prevent hanging - reduced for faster failure handling
            response = await asyncio.wait_for(
                self.client.responses.create(
                    model="gpt-5-mini",
                    input=full_input,
                    reasoning={
                        "effort": "low"
                    },  # Reduce processing time for faster responses
                ),
                timeout=45.0,  # 45 second timeout for faster failure handling
            )

            # Process GPT-5 response structure
            output_text = ""
            for item in response.output:
                # Skip reasoning items - we only want the final output
                if hasattr(item, "type") and item.type == "reasoning":
                    continue

                # Process message items with content
                if hasattr(item, "content"):
                    # content can be None or a list
                    content_list = item.content
                    if content_list is None:
                        continue

                    # If it's a list, iterate through it
                    if isinstance(content_list, list):
                        for content_part in content_list:
                            # Check if content_part has a text attribute
                            if hasattr(content_part, "text") and content_part.text:
                                output_text += content_part.text
                    # If it's a direct text attribute, use it directly
                    elif hasattr(content_list, "text") and content_list.text:
                        output_text += content_list.text

            if not output_text:
                logger.warning("OpenAI returned empty response")
                logger.debug(
                    f"Response output items: {[getattr(item, 'type', 'unknown') for item in response.output]}"
                )
                return None

            # Parse JSON response
            result = json.loads(output_text)
            goals = result.get("goals", [])

            # Validate the response format
            if not goals or not isinstance(goals, list):
                logger.warning("OpenAI returned invalid goals format")
                return None

            # Log what AI generated before validation
            logger.info(
                f"OpenAI generated {len(goals)} goals before validation",
                {"user_plan": "unknown", "goal_count": len(goals)},
            )

            # === CATEGORY SANITIZATION (before validation) ===
            # Fix common AI mistakes with category/tracking_type confusion
            hydration_keywords = [
                "water",
                "hydration",
                "hydrate",
                "drink",
                "glasses",
                "ml",
                "fluid",
                "h2o",
            ]
            valid_categories = [
                "fitness",
                "nutrition",
                "wellness",
                "mindfulness",
                "sleep",
            ]

            for goal in goals:
                category = goal.get("category", "").lower()
                tracking_type = goal.get("tracking_type", "").lower()
                combined_text = (
                    f"{goal.get('title', '')} {goal.get('description', '')}".lower()
                )
                is_hydration_goal = any(
                    kw in combined_text for kw in hydration_keywords
                )

                # Fix 1: If AI incorrectly set category as "hydration", change to "nutrition"
                if category == "hydration":
                    goal["category"] = "nutrition"
                    goal["tracking_type"] = "hydration"
                    logger.info(
                        f"Fixed category 'hydration' -> 'nutrition' for: {goal.get('title')}"
                    )

                # Fix 2: If tracking_type is "hydration" but category is not "nutrition", fix it
                elif tracking_type == "hydration" and category != "nutrition":
                    goal["category"] = "nutrition"
                    logger.info(
                        f"Fixed category '{category}' -> 'nutrition' for hydration goal: {goal.get('title')}"
                    )

                # Fix 3: If it's clearly a hydration goal but category is wrong
                elif is_hydration_goal and category not in ["nutrition"]:
                    goal["category"] = "nutrition"
                    goal["tracking_type"] = "hydration"
                    logger.info(
                        f"Fixed category '{category}' -> 'nutrition' for detected hydration goal: {goal.get('title')}"
                    )

                # Fix 4: If category is invalid, default to wellness
                if goal.get("category", "").lower() not in valid_categories:
                    logger.warning(
                        f"Invalid category '{goal.get('category')}' for goal '{goal.get('title')}', defaulting to 'wellness'"
                    )
                    goal["category"] = "wellness"
                    goal["tracking_type"] = "checkin"

            # Validate each goal has required fields
            validated_goals = []
            invalid_goals = []
            for idx, goal in enumerate(goals):
                if self._validate_goal(goal):
                    validated_goals.append(goal)
                else:
                    invalid_goals.append(
                        {
                            "index": idx,
                            "title": goal.get("title", "N/A"),
                            "missing_fields": [
                                field
                                for field in [
                                    "title",
                                    "description",
                                    "category",
                                    "frequency",
                                    "target_days",
                                    "reminder_times",
                                    "match_reason",
                                ]
                                if field not in goal
                            ],
                        }
                    )
                    logger.warning(
                        f"Invalid goal #{idx + 1}: {goal.get('title', 'N/A')}",
                        {"goal": goal, "validation_failed": True},
                    )

            # Check minimum requirement (at least 3 valid goals)
            if len(validated_goals) < 3:
                logger.warning(
                    f"OpenAI returned only {len(validated_goals)} valid goals (minimum 3 required). "
                    f"Total generated: {len(goals)}, Invalid: {len(invalid_goals)}",
                    {
                        "valid_count": len(validated_goals),
                        "invalid_count": len(invalid_goals),
                        "invalid_goals": invalid_goals,
                    },
                )
                return None

            logger.info(
                f"Successfully validated {len(validated_goals)} goals",
                {
                    "valid_count": len(validated_goals),
                    "invalid_count": len(invalid_goals),
                },
            )

            return validated_goals

        except asyncio.TimeoutError:
            logger.error("OpenAI request timed out after 25 seconds")
            return None
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse OpenAI JSON response: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"OpenAI goal generation failed: {str(e)}")
            return None

    def _build_goal_suggestion_prompt(
        self, profile: Dict[str, Any], user_plan: str = "free"
    ) -> str:
        """
        Build the user prompt based on their fitness profile and subscription plan

        Args:
            profile: User's fitness profile dictionary
            user_plan: User's subscription plan
        """

        # Extract key profile information
        fitness_level = profile.get("fitness_level", "beginner")
        primary_goal = profile.get("primary_goal", "general_fitness")
        current_frequency = profile.get("current_frequency", "never")
        preferred_location = profile.get("preferred_location", "home")
        available_time = profile.get("available_time", "30-60min")
        motivation_style = profile.get("motivation_style", "gentle_encouragement")
        biggest_challenge = profile.get("biggest_challenge", "staying_consistent")

        # Map values to more readable format
        level_map = {
            "beginner": "Complete beginner (just starting their fitness journey)",
            "intermediate": "Intermediate (some experience with exercise)",
            "advanced": "Advanced (regular exerciser with good fitness base)",
            "athlete": "Athlete level (very experienced and highly motivated)",
        }

        goal_map = {
            "lose_weight": "lose weight and burn fat",
            "build_muscle": "build muscle and gain strength",
            "stay_active": "stay active and maintain fitness",
            "general_fitness": "improve overall fitness and health",
            "sport_specific": "improve performance in a specific sport",
        }

        frequency_map = {
            "never": "currently doesn't exercise at all",
            "1-2x_week": "exercises 1-2 times per week",
            "3-4x_week": "exercises 3-4 times per week",
            "5+_week": "exercises 5+ times per week",
            "daily": "exercises daily",
        }

        location_map = {
            "gym": "prefers working out at the gym",
            "home": "prefers working out at home",
            "outdoor": "prefers outdoor activities",
            "mix": "enjoys a mix of gym, home, and outdoor workouts",
            "dont_know": "isn't sure where they prefer to work out",
        }

        time_map = {
            "less_30min": "has less than 30 minutes available for workouts",
            "30-60min": "has 30-60 minutes available for workouts",
            "1-2hrs": "has 1-2 hours available for workouts",
            "flexible": "has flexible time availability for workouts",
        }

        motivation_map = {
            "tough_love": "responds well to tough love and direct motivation",
            "gentle_encouragement": "prefers gentle encouragement and positive reinforcement",
            "data_driven": "is motivated by data, numbers, and measurable progress",
            "accountability_buddy": "thrives with accountability and social support",
        }

        challenge_map = {
            "staying_consistent": "struggles with staying consistent and building habits",
            "getting_started": "has trouble getting started and taking the first step",
            "time": "struggles with finding time for fitness",
            "lack_of_knowledge": "lacks knowledge about proper exercise and nutrition",
        }

        # Get feature context for this plan
        feature_context = get_feature_context_for_ai(user_plan)
        restrictions = get_plan_restrictions(user_plan)

        restrictions_text = ""
        if restrictions:
            restrictions_text = "\n\nPLAN RESTRICTIONS:\n" + "\n".join(
                f"- {r}" for r in restrictions
            )

        prompt = f"""Generate personalized fitness goals for this user who is using an AI-powered fitness accountability app.

AVAILABLE FEATURES FOR {user_plan.upper()} PLAN:
{feature_context['features_summary']}

IMPORTANT - FEATURE USAGE GUIDELINES:
- ONLY mention features that are available to {user_plan} users
- Focus on accountability features: daily check-ins, streak tracking, progress visualization
- DO NOT mention features like "meal tracking", "detailed workout logging", or "workout templates"
- Instead of "Log every meal", say "Track your meals with daily check-ins"
- Instead of "Session logging", say "Record your workouts with simple check-ins"
- For nutrition goals, focus on daily check-ins rather than detailed meal logging
- For fitness goals, focus on consistency and accountability, not detailed exercise tracking
{restrictions_text}

This app provides daily check-ins, progress tracking, streak monitoring, and AI motivation messages.

USER PROFILE:
FITNESS LEVEL: {level_map.get(fitness_level, fitness_level)}
PRIMARY GOAL: Wants to {goal_map.get(primary_goal, primary_goal)}
CURRENT HABITS: {frequency_map.get(current_frequency, current_frequency)}
WORKOUT PREFERENCE: {location_map.get(preferred_location, preferred_location)}
AVAILABLE TIME: {time_map.get(available_time, available_time)}
MOTIVATION STYLE: {motivation_map.get(motivation_style, motivation_style)}
BIGGEST CHALLENGE: {challenge_map.get(biggest_challenge, biggest_challenge)}

CRITICAL REQUIREMENTS:

1. ADDRESS THEIR BIGGEST CHALLENGE DIRECTLY:
   - Each goal must specifically tackle: {challenge_map.get(biggest_challenge, biggest_challenge)}
   - Explain in the match_reason HOW this goal solves their challenge
   - If they struggle with consistency, give them goals with clear check-in points
   - If they struggle with time, give them time-efficient goals
   - If they struggle with getting started, give them very achievable entry-level goals
   - If they lack knowledge, give them structured, guided goals

2. CREATE DIVERSE, SPECIFIC GOAL TYPES (NOT JUST WORKOUT FREQUENCY):
   - Include specific exercise routines/challenges (e.g., "30-Day Push-Up Challenge", "Complete 5K in 8 weeks")
   - Include habit-based goals (e.g., "10,000 steps daily", "Track meals daily with check-ins", "7+ hours sleep")
   - Include structured routines (e.g., "25-minute strength circuit with 6 exercises")
   - Include milestone goals (e.g., "Run your first 5K", "Complete 100 consecutive days")
   - Mix categories: fitness, nutrition, wellness, mindfulness, sleep
   - Vary intensity levels based on their fitness level
   - Don't just generate "workout X times per week" - be creative and specific!

3. MAKE GOALS ACCOUNTABILITY-FOCUSED:
   - Emphasize how daily check-ins will help them stay on track
   - Mention how progress tracking will motivate them
   - Connect to their motivation style: {motivation_map.get(motivation_style, motivation_style)}
   - If they're data-driven, include measurable metrics
   - If they need accountability, mention how AI will check in with them

4. PERSONALIZE MATCH_REASONS DEEPLY:
   - Each match_reason must reference specific profile data (fitness level, goal, challenge)
   - Be SPECIFIC: "Since you're {level_map.get(fitness_level, fitness_level)} wanting to {goal_map.get(primary_goal, primary_goal)} and {challenge_map.get(biggest_challenge, biggest_challenge)}, this goal..."
   - Explain WHY this goal is perfect for THIS specific person
   - NO generic phrases - every match_reason must be unique and specific
   - Connect dots between their challenge, preferences, and goal benefits

5. WRITE COMPELLING DESCRIPTIONS:
   - Write like a personal coach speaking directly to them
   - Highlight benefits that matter to their primary goal
   - Mention accountability features using ONLY features available to their plan (check-ins, streaks, AI motivation)
   - Make it exciting and motivating
   - Be realistic but inspiring
   - IMPORTANT: Use feature-aware language (e.g., "Track meals with daily check-ins" not "Log every meal in detail")

EXAMPLES OF CREATIVE, SPECIFIC GOALS (not generic "workout 3x week"):
- "Complete 25-Minute Full-Body Strength Circuit 3x Weekly" (specific routine)
- "Hit 10,000 Steps Daily with a 20-Minute Lunch Walk" (habit + specific action)
- "Track Meals Daily with Check-Ins and Hit 100g Protein" (nutrition accountability via check-ins)
- "Complete 30-Day Push-Up Progression Challenge" (structured challenge)
- "Run Your First 5K in 8 Weeks" (milestone goal)
- "Get 7+ Hours of Sleep 5 Nights Per Week" (recovery goal)

CRITICAL - MINIMUM REQUIREMENT:
You MUST generate AT LEAST 5 goals, ideally 6-7 goals.
Returning fewer than 5 goals is unacceptable and will be rejected.

Generate 5-7 goals that would make this person excited to start their fitness journey. Each goal should feel like it was personally crafted for them, addressing their specific challenge and preferences.

REMEMBER: Return a JSON object with a "goals" array containing AT LEAST 5 goal objects."""

        return prompt

    def _validate_goal(self, goal: Dict[str, Any]) -> bool:
        """Validate that a goal has all required fields with correct types"""
        required_fields = {
            "title": str,
            "description": str,
            "category": str,
            "frequency": str,
            "target_days": int,
            "reminder_times": list,
            "match_reason": str,
        }

        # Check all required fields exist
        for field, field_type in required_fields.items():
            if field not in goal:
                return False
            if not isinstance(goal[field], field_type):
                return False

        # Validate category and frequency enums
        valid_categories = [
            "fitness",
            "nutrition",
            "wellness",
            "mindfulness",
            "sleep",
        ]
        valid_frequencies = ["daily", "weekly"]
        valid_tracking_types = ["workout", "meal", "hydration", "checkin"]

        if goal["category"] not in valid_categories:
            return False
        if goal["frequency"] not in valid_frequencies:
            return False

        # Validate tracking_type if present (default to 'checkin' if missing)
        tracking_type = goal.get("tracking_type", "checkin")
        if tracking_type not in valid_tracking_types:
            return False

        # Set default tracking_type based on category if not provided by AI
        if "tracking_type" not in goal:
            if goal["category"] == "fitness":
                goal["tracking_type"] = "workout"
            elif goal["category"] == "nutrition":
                goal["tracking_type"] = "meal"
            elif (
                goal["category"] == "wellness"
                or goal["category"] == "mindfulness"
                or goal["category"] == "sleep"
            ):
                goal["tracking_type"] = "checkin"
            else:
                goal["tracking_type"] = "checkin"

        # Validate target_days is reasonable
        if goal["target_days"] < 1 or goal["target_days"] > 7:
            return False

        # Validate days_of_week for weekly goals
        if goal["frequency"] == "weekly":
            if "days_of_week" not in goal or not isinstance(goal["days_of_week"], list):
                return False
            if len(goal["days_of_week"]) == 0:
                return False
            if len(goal["days_of_week"]) > goal["target_days"]:
                return False
            for day in goal["days_of_week"]:
                if not isinstance(day, int) or day < 0 or day > 6:
                    return False

        # Validate reminder_times format
        if not isinstance(goal["reminder_times"], list):
            return False
        for time_str in goal["reminder_times"]:
            if not isinstance(time_str, str) or not self._is_valid_time_format(
                time_str
            ):
                return False

        return True

    def _is_valid_time_format(self, time_str: str) -> bool:
        """Validate time format (HH:MM)"""
        try:
            parts = time_str.split(":")
            if len(parts) != 2:
                return False
            hour, minute = int(parts[0]), int(parts[1])
            return 0 <= hour <= 23 and 0 <= minute <= 59
        except (ValueError, IndexError):
            return False
