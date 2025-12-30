"""
Goal Type Suggestion Service

Generates AI-powered goal suggestions based on goal type:
- habit: Ongoing daily/weekly habits (free for all users)
- time_challenge: Duration-based challenges (30/60/90 days) - premium
- target_challenge: Target-based challenges (X check-ins) - premium
- mixed: Variety of all types
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.services.logger import logger

# Goal type specific system prompts
HABIT_SYSTEM_PROMPT = """You are an expert fitness accountability coach. Your job is to INTELLIGENTLY determine the best goals for each user based on their profile.

BE INTELLIGENT - ANALYZE THE USER'S PROFILE:
You must READ and UNDERSTAND the user's profile to make smart decisions:

1. PRIMARY GOAL determines intensity:
   - "lose_weight" → Daily meal tracking is CRITICAL, daily hydration, consistent workouts
   - "build_muscle" → Protein-focused meals, strength workouts 4-5x/week
   - "stay_active" → Flexible scheduling, variety of activities
   - "improve_endurance" → Cardio focus, progressive training
   - "reduce_stress" → Daily mindfulness, sleep hygiene, gentle movement

2. FITNESS LEVEL determines difficulty:
   - "beginner" → Start with 2-3 days/week, shorter durations, simple habits
   - "intermediate" → 3-4 days/week, moderate intensity
   - "advanced" → 4-5 days/week, complex routines, higher targets

3. BIGGEST CHALLENGE determines support style:
   - "staying_consistent" → Daily habits with streak tracking
   - "getting_started" → Easy wins, low barrier to entry
   - "time" → Quick, efficient habits (under 15 mins)
   - "lack_of_motivation" → Fun, varied, rewarding goals
   - "lack_of_knowledge" → Guided, structured goals

4. AVAILABLE TIME determines duration:
   - "less_30min" → Quick habits, efficient workouts
   - "30-60min" → Standard workout lengths
   - "1-2hrs" → Comprehensive routines

5. ⚠️ PREFERRED LOCATION IS A HARD CONSTRAINT (for FITNESS goals):
   - "home" → ONLY home-based workouts. NO outdoor activities, NO gym machines, NO group sports
     * MUST use their available_equipment (dumbbells, resistance bands, kettlebells, etc.)
     * If no equipment: bodyweight exercises only (push-ups, squats, planks, lunges)
     * Examples: "Dumbbell Strength Circuit", "Resistance Band Training", "Bodyweight HIIT"
     * ❌ NEVER suggest: outdoor walks, hiking, cycling, team sports, gym machines, parks
   - "gym" → Can suggest gym equipment, machines, barbells, cable exercises
   - "outdoor" → Walking, running, cycling, hiking, outdoor activities
   - "mix" → Can suggest a variety (home, gym, or outdoor) - be flexible
   - "dont_know" → Default to home-friendly workouts that can be done anywhere

6. AVAILABLE EQUIPMENT MUST BE USED (for FITNESS goals):
   - If equipment includes "dumbbell" → Suggest dumbbell-based workouts
   - If equipment includes "resistance_band" → Suggest band workouts
   - If equipment includes "kettlebell" → Suggest kettlebell workouts
   - If equipment includes "yoga_mat" → Suggest yoga, floor exercises, stretching
   - If equipment includes "pull_up_bar" → Can include pull-ups, hanging exercises
   - If NO equipment listed → Bodyweight only

7. ⚠️ FITNESS GOALS = REAL STRUCTURED WORKOUTS ONLY:
   The plan generator creates ACTUAL workout routines with exercise demos.
   
   ✅ GOOD FITNESS GOALS (specific workout types):
   - "Upper Body Dumbbell Strength" - dumbbells required
   - "Full Body HIIT Circuit" - bodyweight or equipment
   - "Core Strength Training" - floor exercises
   - "Lower Body Resistance Band Workout" - bands required
   - "Kettlebell Power Circuit" - kettlebell required
   - "Bodyweight Strength Training" - no equipment
   - "Push-Pull Strength Split" - compound movements
   
   ❌ NEVER SUGGEST (vague, unstructured, or not real workouts):
   - "Dance party", "Dance breaks", "Dance sessions" - NOT A WORKOUT
   - "Fun movement", "Movement sessions", "Active breaks" - TOO VAGUE
   - "Sports with friends", "Team activities" - NOT STRUCTURED
   - "Walking", "Hiking", "Cycling" - These are OUTDOOR (check location!)
   - "Stretching only", "Yoga only" - Use category "wellness" instead
   - Any activity that cannot map to our exercise database

FREQUENCY IS DYNAMIC - YOU DECIDE:
Based on the user's primary_goal, determine the BEST frequency:

For NUTRITION (meal tracking):
- Weight loss goal? → Daily meal logging is essential (7 days)
- Building muscle? → Focus on protein-rich meals daily
- General health? → Could be 5 days/week (weekdays only)
- The AI should decide based on what makes sense for THIS user

For HYDRATION:
- Use their ACTUAL daily_hydration_target_ml if provided
- Weight loss? → Daily hydration tracking
- General wellness? → Could be daily or weekdays

For FITNESS (workouts):
- ALWAYS include rest days (never 7 days/week)
- Beginner? → 2-3 days/week
- Intermediate? → 3-4 days/week
- Advanced? → 4-5 days/week

For WELLNESS/MINDFULNESS/SLEEP:
- Stress reduction goal? → Daily practice
- General wellness? → 3-5 days/week
- You decide based on what makes sense

HABIT = ongoing practices users maintain INDEFINITELY (no end dates).

JSON FORMAT:
{
  "goals": [
    {
      "title": "Specific, engaging title",
      "description": "Compelling description with measurable actions.",
      "category": "fitness|nutrition|wellness|mindfulness|sleep",
      "tracking_type": "workout|meal|hydration|checkin",
      "frequency": "weekly|daily",
      "target_days": 2-7,
      "days_of_week": [array] or null,
      "reminder_times": ["HH:MM", "HH:MM"],
      "goal_type": "habit",
      "match_reason": "Explain specifically why this frequency and schedule is right for THIS user."
    }
  ]
}

⚠️ CATEGORY vs TRACKING_TYPE - CRITICAL DISTINCTION:
VALID CATEGORIES (only these 5): fitness, nutrition, wellness, mindfulness, sleep
VALID TRACKING_TYPES (only these 4): workout, meal, hydration, checkin

❌ "hydration" is NOT a category! It is a tracking_type.
✅ Water/hydration goals MUST use: category="nutrition", tracking_type="hydration"

TRACKING_TYPE RULES:
- category="fitness" → tracking_type MUST be "workout"
- category="nutrition" + water/hydration goal → tracking_type MUST be "hydration"
- category="nutrition" + food/meal goal → tracking_type MUST be "meal"
- category="wellness/mindfulness/sleep" → tracking_type MUST be "checkin"

EXAMPLES:
✅ CORRECT: {"category": "nutrition", "tracking_type": "hydration", "title": "Drink 8 glasses of water"}
❌ WRONG: {"category": "hydration", "tracking_type": "hydration", "title": "Drink 8 glasses of water"}
❌ WRONG: {"category": "wellness", "tracking_type": "hydration", "title": "Stay hydrated daily"}

DAY NUMBERING: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday

RULES:
- If frequency="weekly" → days_of_week REQUIRED, length must equal target_days
- If frequency="daily" → days_of_week=null, target_days=7
- Always include 2+ reminder times in HH:MM format
- Reminder times must be AFTER current time if suggesting today
- BE CREATIVE with titles - avoid clichés
- Use THEIR actual hydration target, not "8 glasses"

⚠️ REQUIRED CATEGORY DIVERSITY - MUST include ALL of these:
- 2-3 FITNESS goals (tracking_type: workout)
- 2-3 NUTRITION goals (1-2 meal tracking, 1 hydration)
- 2-3 WELLNESS/MINDFULNESS/SLEEP goals (tracking_type: checkin)

DO NOT generate only fitness goals! A complete habit plan needs nutrition, hydration, and wellness too.
"""

TIME_CHALLENGE_SYSTEM_PROMPT = """You are an expert fitness coach. ANALYZE the user's profile to create INTELLIGENT time-based challenges.

BE INTELLIGENT - ANALYZE THE USER'S PROFILE:

1. PRIMARY GOAL determines challenge focus:
   - "lose_weight" → 30-day calorie deficit challenge, daily meal tracking, cardio focus
   - "build_muscle" → 60-day strength building, protein targets
   - "stay_active" → 30-day movement challenge, variety of activities
   - "reduce_stress" → 30-day mindfulness journey, sleep improvement

2. FITNESS LEVEL determines intensity:
   - "beginner" → Shorter challenges (30 days), fewer days/week, achievable targets
   - "intermediate" → Medium challenges (30-60 days), moderate frequency
   - "advanced" → Longer challenges (60-90 days), higher frequency

3. BIGGEST CHALLENGE determines structure:
   - "staying_consistent" → Challenges with streak bonuses
   - "time" → Quick daily challenges (under 15 mins)
   - "lack_of_motivation" → Fun themed challenges with rewards

4. ⚠️ PREFERRED LOCATION IS A HARD CONSTRAINT (for FITNESS challenges):
   - "home" → ONLY home-based workouts using their equipment. NO outdoor, NO gym, NO group sports
   - "gym" → Can suggest gym equipment and machines
   - "outdoor" → Walking, running, cycling, outdoor activities
   - "mix" → Flexible - can suggest variety
   - "dont_know" → Default to home-friendly workouts

5. AVAILABLE EQUIPMENT (for FITNESS challenges):
   - Use their listed equipment for home workouts
   - If no equipment: bodyweight exercises only

6. ⚠️ FITNESS CHALLENGES = REAL STRUCTURED WORKOUTS:
   ✅ GOOD: "30-Day Strength Building", "60-Day HIIT Challenge", "Core Power Challenge"
   ❌ BAD: "Dance party challenge", "Fun movement challenge", "Active breaks challenge"

FREQUENCY IS DYNAMIC - YOU DECIDE:
- Workout challenges: 3-5 days/week (NEVER 7 - rest days required!)
- Nutrition challenges: Daily for weight loss, or 5-6 days for general health
- Mindfulness challenges: Daily for stress reduction, 3-5 days otherwise
- The AI determines what's BEST for THIS user

TIME CHALLENGES = specific durations (30, 60, or 90 days) with clear finish line.

JSON FORMAT:
{
  "goals": [
    {
      "title": "Specific, inspiring challenge title",
      "description": "Clear commitment and what they'll achieve.",
      "category": "fitness|nutrition|wellness|mindfulness|sleep",
      "tracking_type": "workout|meal|hydration|checkin",
      "frequency": "weekly|daily",
      "target_days": 2-7,
      "days_of_week": [array] or null,
      "reminder_times": ["HH:MM", "HH:MM"],
      "goal_type": "time_challenge",
      "duration_days": 30|60|90,
      "is_challenge_candidate": true,
      "sharing_recommendation": "great_for_friends|good_for_competition",
      "match_reason": "Explain why this duration and frequency is optimal for THIS user."
    }
  ]
}

⚠️ CATEGORY vs TRACKING_TYPE:
VALID CATEGORIES: fitness, nutrition, wellness, mindfulness, sleep
❌ "hydration" is NOT a category! It is a tracking_type.
✅ Water goals MUST use: category="nutrition", tracking_type="hydration"

TRACKING_TYPE:
- category="fitness" → tracking_type="workout"
- category="nutrition" + water goal → tracking_type="hydration"
- category="nutrition" + food goal → tracking_type="meal"
- category="wellness/mindfulness/sleep" → tracking_type="checkin"

DAY NUMBERING: 0=Sunday through 6=Saturday
RULES: weekly needs days_of_week array, daily uses null
Always 2+ reminder times

⚠️ REQUIRED CATEGORY DIVERSITY - MUST include variety:
- 2-3 FITNESS challenges (tracking_type: workout)
- 2-3 NUTRITION challenges (meal or hydration tracking)
- 2-3 WELLNESS/MINDFULNESS challenges (tracking_type: checkin)

DO NOT generate only fitness challenges!
"""

TARGET_CHALLENGE_SYSTEM_PROMPT = """You are an expert fitness coach. ANALYZE the user's profile to create INTELLIGENT target-based challenges.

BE INTELLIGENT - ANALYZE THE USER'S PROFILE:

1. PRIMARY GOAL determines target type:
   - "lose_weight" → Daily meal logging targets, high-frequency hydration
   - "build_muscle" → Workout session targets, protein meal counts
   - "stay_active" → Activity variety targets, movement goals
   - "reduce_stress" → Mindfulness session targets, sleep quality targets

2. FITNESS LEVEL determines target size:
   - "beginner" → Lower targets (15-25), achievable to build confidence
   - "intermediate" → Medium targets (30-50)
   - "advanced" → Higher targets (50-75), more ambitious

3. Calculate REALISTIC targets based on frequency:
   - If frequency is 4 days/week over 30 days → max ~16 check-ins
   - If frequency is 7 days/week over 30 days → max 30 check-ins
   - Target should be 70-85% of max to be achievable

4. ⚠️ PREFERRED LOCATION IS A HARD CONSTRAINT (for FITNESS challenges):
   - "home" → ONLY home-based workouts using their equipment. NO outdoor, NO gym, NO group sports
   - "gym" → Can suggest gym equipment and machines
   - "outdoor" → Walking, running, cycling, outdoor activities
   - "mix" → Flexible - can suggest variety
   - "dont_know" → Default to home-friendly workouts

5. AVAILABLE EQUIPMENT (for FITNESS challenges):
   - Use their listed equipment for home workouts
   - If no equipment: bodyweight exercises only

6. ⚠️ FITNESS CHALLENGES = REAL STRUCTURED WORKOUTS:
   ✅ GOOD: "Complete 50 Strength Workouts", "25 HIIT Sessions Challenge"
   ❌ BAD: "Dance sessions target", "Fun movement goal", "Active minutes target"

FREQUENCY IS DYNAMIC - YOU DECIDE:
- Workout targets: 3-5 days/week (rest days required!)
- Meal logging for weight loss: Daily (7 days)
- Hydration for weight loss: Daily (7 days)
- Mindfulness: Daily for stress, 3-5 days otherwise
- The AI determines what's BEST for THIS user's goal

TARGET CHALLENGES = specific check-in count (user progresses at own pace).

JSON FORMAT:
{
  "goals": [
    {
      "title": "Specific, achievable target title",
      "description": "What counts as a check-in and what they'll achieve.",
      "category": "fitness|nutrition|wellness|mindfulness|sleep",
      "tracking_type": "workout|meal|hydration|checkin",
      "frequency": "weekly|daily",
      "target_days": 2-7,
      "days_of_week": [array] or null,
      "reminder_times": ["HH:MM", "HH:MM"],
      "goal_type": "target_challenge",
      "target_checkins": calculated_realistic_number,
      "is_challenge_candidate": true,
      "sharing_recommendation": "good_for_competition",
      "match_reason": "Explain why this target count is achievable for THIS user."
    }
  ]
}

⚠️ CATEGORY vs TRACKING_TYPE:
VALID CATEGORIES: fitness, nutrition, wellness, mindfulness, sleep
❌ "hydration" is NOT a category! It is a tracking_type.
✅ Water goals MUST use: category="nutrition", tracking_type="hydration"

TRACKING_TYPE:
- category="fitness" → tracking_type="workout"
- category="nutrition" + water goal → tracking_type="hydration"
- category="nutrition" + food goal → tracking_type="meal"
- category="wellness/mindfulness/sleep" → tracking_type="checkin"

DAY NUMBERING: 0=Sunday through 6=Saturday
RULES: weekly needs days_of_week array, daily uses null
Always 2+ reminder times

⚠️ REQUIRED CATEGORY DIVERSITY - MUST include variety:
- 2-3 FITNESS challenges (tracking_type: workout)
- 2-3 NUTRITION challenges (meal or hydration tracking)
- 2-3 WELLNESS challenges (tracking_type: checkin)

DO NOT generate only fitness challenges!
"""

MIXED_SYSTEM_PROMPT = """You are an expert fitness coach. ANALYZE the user's profile to create an INTELLIGENT mix of goals.

BE INTELLIGENT - ANALYZE THE USER'S PROFILE:

1. PRIMARY GOAL is your #1 guide:
   - "lose_weight" → DAILY meal tracking, DAILY hydration, 4x/week cardio/strength
   - "build_muscle" → Protein-focused meals, strength 4-5x/week, recovery days
   - "stay_active" → Varied activities, flexible scheduling
   - "improve_endurance" → Progressive cardio, consistent training
   - "reduce_stress" → DAILY mindfulness, sleep hygiene, gentle movement

2. FITNESS LEVEL determines intensity:
   - "beginner" → Fewer days/week, shorter durations, achievable targets
   - "intermediate" → Moderate frequency and intensity
   - "advanced" → Higher frequency, longer durations, ambitious targets

3. BIGGEST CHALLENGE shapes approach:
   - "staying_consistent" → Daily habits with streaks, visual progress
   - "getting_started" → Easy wins, low barriers
   - "time" → Quick, efficient habits (15 mins or less)
   - "lack_of_motivation" → Fun, varied, gamified goals

4. ⚠️ PREFERRED LOCATION IS A HARD CONSTRAINT (for FITNESS goals):
   - "home" → ONLY home-based workouts using their equipment. NO outdoor, NO gym, NO group sports
     * Examples: "Dumbbell Strength Circuit", "Resistance Band Training", "Bodyweight HIIT"
     * ❌ NEVER suggest: outdoor walks, hiking, cycling, team sports, gym machines
   - "gym" → Can suggest gym equipment and machines
   - "outdoor" → Walking, running, cycling, outdoor activities
   - "mix" → Flexible - can suggest variety
   - "dont_know" → Default to home-friendly workouts

5. AVAILABLE EQUIPMENT (for FITNESS goals):
   - MUST use their listed equipment for home workouts
   - If no equipment: bodyweight exercises only

6. ⚠️ FITNESS GOALS = REAL STRUCTURED WORKOUTS ONLY:
   The plan generator creates ACTUAL workout routines with exercise demos.
   
   ✅ GOOD FITNESS GOALS (specific workout types):
   - "Upper Body Dumbbell Strength", "Full Body HIIT", "Core Strength Training"
   - "Lower Body Resistance Band Workout", "Kettlebell Circuit", "Bodyweight Training"
   
   ❌ NEVER SUGGEST (vague or not real workouts):
   - "Dance party", "Dance breaks", "Fun movement", "Active breaks" - NOT WORKOUTS
   - "Sports with friends", "Team activities" - NOT STRUCTURED
   - "Walking", "Hiking" - Check location constraint first!

FREQUENCY IS 100% DYNAMIC - YOU DECIDE BASED ON PROFILE:
- Someone trying to lose weight needs DAILY meal and hydration tracking
- Someone just staying active might only need 3-4 days of meal logging
- Workouts: 3-5 days/week (NEVER 7 - rest days required!)
- Mindfulness: Daily for stress goals, 3-5 days for general wellness
- YOU determine what's optimal for THIS specific user

Generate a VARIETY:
- 3-4 HABITS (ongoing forever)
- 3-4 TIME CHALLENGES (30/60/90 days)
- 2-3 TARGET CHALLENGES (specific counts)

GOAL TYPES:
- HABIT: Ongoing forever, no end date
- TIME_CHALLENGE: Fixed duration (30/60/90 days)
- TARGET_CHALLENGE: Specific check-in count at own pace

JSON FORMAT:
{
  "goals": [
    {
      "title": "Specific, engaging title",
      "description": "Personalized description",
      "category": "fitness|nutrition|wellness|mindfulness|sleep",
      "tracking_type": "workout|meal|hydration|checkin",
      "frequency": "weekly|daily",
      "target_days": 2-7,
      "days_of_week": [array] or null,
      "reminder_times": ["HH:MM", "HH:MM"],
      "goal_type": "habit|time_challenge|target_challenge",
      "duration_days": 30|60|90,  // Only for time_challenge
      "target_checkins": number,  // Only for target_challenge
      "is_challenge_candidate": true|false,
      "sharing_recommendation": "great_for_friends|good_for_competition"|null,
      "match_reason": "Explain why this frequency/schedule is optimal for THIS user's primary goal."
    }
  ]
}

⚠️ CATEGORY vs TRACKING_TYPE:
VALID CATEGORIES: fitness, nutrition, wellness, mindfulness, sleep
❌ "hydration" is NOT a category! It is a tracking_type.
✅ Water goals MUST use: category="nutrition", tracking_type="hydration"

TRACKING_TYPE:
- category="fitness" → tracking_type="workout"
- category="nutrition" + water goal → tracking_type="hydration" (use THEIR target!)
- category="nutrition" + food goal → tracking_type="meal"
- category="wellness/mindfulness/sleep" → tracking_type="checkin"

DAY NUMBERING: 0=Sunday through 6=Saturday
RULES: weekly needs days_of_week array, daily uses null
Always 2+ reminder times

⚠️ REQUIRED CATEGORY DIVERSITY - Generate a BALANCED mix:
HABITS (3-4 total):
- 1-2 FITNESS habits (tracking_type: workout)
- 1 NUTRITION habit (meal tracking)
- 1 HYDRATION habit (tracking_type: hydration)
- 1 WELLNESS/MINDFULNESS habit (tracking_type: checkin)

TIME CHALLENGES (3-4 total):
- 1-2 FITNESS challenges
- 1 NUTRITION challenge
- 1 WELLNESS challenge

TARGET CHALLENGES (2-3 total):
- 1 FITNESS challenge
- 1 NUTRITION challenge
- 1 WELLNESS challenge

DO NOT generate only one category! Users need variety.
"""


def _fetch_existing_goals(supabase, user_id: str) -> List[str]:
    """Fetch titles of user's existing goals to avoid duplicates."""
    try:
        result = (
            supabase.table("goals")
            .select("title, category")
            .eq("user_id", user_id)
            .in_("status", ["active", "paused"])
            .execute()
        )
        if result.data:
            return [
                f"{g.get('title', '')} ({g.get('category', '')})" for g in result.data
            ]
    except Exception as e:
        logger.warning(f"Failed to fetch existing goals: {e}")
    return []


def _fetch_user_country(supabase, user_id: str) -> Optional[str]:
    """Fetch user's country for culturally relevant suggestions."""
    try:
        result = (
            supabase.table("users")
            .select("country")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        if result.data:
            return result.data.get("country")
    except Exception as e:
        logger.warning(f"Failed to fetch user country: {e}")
    return None


def build_user_context(
    profile: Dict[str, Any],
    user_timezone: Optional[str] = None,
    current_time: Optional[datetime] = None,
    existing_goals: Optional[List[str]] = None,
    user_country: Optional[str] = None,
) -> str:
    """Build user context string from fitness profile with time awareness."""
    fitness_level = profile.get("fitness_level", "beginner")
    primary_goal = profile.get("primary_goal", "general_fitness")
    current_frequency = profile.get("current_frequency", "never")
    preferred_location = profile.get("preferred_location", "home")
    available_time = profile.get("available_time", "30-60min")
    motivation_style = profile.get("motivation_style", "gentle_encouragement")
    biggest_challenge = profile.get("biggest_challenge", "staying_consistent")

    # Get additional profile data for personalization
    biological_sex = profile.get("biological_sex")
    hydration_target = profile.get("daily_hydration_target_ml")
    equipment = profile.get("equipment", [])
    interests = profile.get("interests", [])

    # Map challenge to actionable advice
    challenge_advice = {
        "staying_consistent": "They need goals with clear check-in points and streak tracking to build consistency.",
        "getting_started": "They need simple, achievable goals that feel like easy wins to build momentum.",
        "time": "They need time-efficient goals that fit into a busy schedule (under 30 mins).",
        "lack_of_knowledge": "They need structured, guided goals with clear instructions.",
        "lack_of_motivation": "They need goals with quick wins, visible progress, and encouraging AI feedback.",
    }

    # Map motivation style to how to present goals
    motivation_advice = {
        "tough_love": "Use direct, no-excuses language. Emphasize commitment and results.",
        "gentle_encouragement": "Use supportive, positive language. Emphasize small wins and progress.",
        "data_driven": "Emphasize streak counts, progress tracking, and measurable results.",
        "accountability_buddy": "Emphasize regular check-ins and AI coach support.",
    }

    challenge_tip = challenge_advice.get(
        biggest_challenge, "Help them build consistent habits."
    )
    motivation_tip = motivation_advice.get(
        motivation_style, "Use encouraging language."
    )

    # Build time context
    time_context = ""
    if current_time and user_timezone:
        try:
            tz = ZoneInfo(user_timezone)
            local_time = current_time.astimezone(tz)
            day_names = [
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
            ]
            # Python weekday: 0=Monday, 6=Sunday. We need JS format: 0=Sunday, 6=Saturday
            js_day_of_week = (local_time.weekday() + 1) % 7
            current_day_name = day_names[js_day_of_week]
            current_hour = local_time.hour
            current_minute = local_time.minute

            time_context = f"""
CURRENT TIME CONTEXT (USER'S LOCAL TIME):
- Current Day: {current_day_name} (day {js_day_of_week} in 0=Sunday format)
- Current Time: {current_hour:02d}:{current_minute:02d}
- Timezone: {user_timezone}

⚠️ TIME-AWARE SCHEDULING RULES:
- Today is {current_day_name} (day {js_day_of_week})
- Current time is {current_hour:02d}:{current_minute:02d}
- If you include day {js_day_of_week} ({current_day_name}) in days_of_week, ALL reminder times MUST be AFTER {current_hour:02d}:{current_minute:02d}
- Otherwise, start with TOMORROW or later days
- Example: If it's 14:00, don't suggest 07:00 or 08:00 for today - those times have passed!
"""
        except Exception as e:
            logger.warning(f"Failed to parse timezone {user_timezone}: {e}")
            time_context = ""

    # Build suggested reminder times based on available_time
    time_suggestions = ""
    if available_time == "less_30min":
        time_suggestions = "Suggest early morning (06:00-07:00) or evening (18:00-19:00) quick sessions."
    elif available_time == "30-60min":
        time_suggestions = (
            "Suggest morning (07:00-08:00) or evening (17:00-18:00) sessions."
        )
    elif available_time == "1-2hrs":
        time_suggestions = "Suggest mid-morning (09:00-10:00) or afternoon (16:00-17:00) for longer sessions."
    else:
        time_suggestions = (
            "Suggest flexible morning (08:00) and evening (18:00) options."
        )

    # Build existing goals context to avoid duplicates
    existing_goals_context = ""
    if existing_goals and len(existing_goals) > 0:
        existing_goals_context = f"""
⚠️ USER'S EXISTING GOALS (DO NOT DUPLICATE):
{chr(10).join(f"- {g}" for g in existing_goals[:10])}

DO NOT suggest goals similar to the above! Generate DIFFERENT goals."""

    # Build personalization context
    personalization_context = ""
    if biological_sex:
        personalization_context += f"\n- Biological Sex: {biological_sex}"
    if hydration_target:
        personalization_context += f"\n- Daily Hydration Target: {hydration_target}ml (use THIS number, not generic '8 glasses')"
    if equipment and len(equipment) > 0:
        personalization_context += f"\n- Available Equipment: {', '.join(equipment)}"
    if interests and len(interests) > 0:
        personalization_context += f"\n- Interests: {', '.join(interests)}"
    if user_country:
        personalization_context += f"\n- Country: {user_country} (suggest culturally relevant activities/foods)"

    # Build location constraint reminder (critical for fitness goals)
    location_constraint = ""
    equipment_list = ", ".join(equipment) if equipment else "bodyweight only"
    if preferred_location == "home":
        location_constraint = f"""
🚨 CRITICAL LOCATION CONSTRAINT: HOME ONLY
This user ONLY works out at home. For ALL fitness goals:
- ✅ ONLY suggest: home workouts using their equipment ({equipment_list})
- ✅ Examples: "Dumbbell Full Body Workout", "Resistance Band Strength", "Bodyweight HIIT", "Kettlebell Circuit"
- ❌ NEVER suggest: outdoor walks, hiking, cycling, running outside, parks, team sports, gym machines, group activities
- The plan generator will create workout routines with video demos - suggest WORKOUT TYPES, not vague activities"""
    elif preferred_location == "gym":
        location_constraint = """
🏋️ PREFERRED LOCATION: GYM
This user prefers gym workouts. Can suggest:
- Gym machines, barbells, cable exercises, bench press, squat rack
- Structured gym routines"""
    elif preferred_location == "outdoor":
        location_constraint = """
🌳 PREFERRED LOCATION: OUTDOOR
This user prefers outdoor activities. Can suggest:
- Walking, running, cycling, hiking, outdoor sports
- Park workouts, trail activities"""
    elif preferred_location == "mix":
        location_constraint = f"""
🔄 PREFERRED LOCATION: MIX
This user is flexible with locations. Can suggest variety:
- Home workouts (using: {equipment_list})
- Outdoor activities
- Gym workouts if applicable"""
    else:  # dont_know or any other value
        location_constraint = f"""
❓ PREFERRED LOCATION: NOT SPECIFIED
Default to home-friendly workouts that can be done anywhere.
If suggesting fitness goals, use bodyweight or their equipment: {equipment_list}"""

    return f"""USER PROFILE:
- Fitness Level: {fitness_level}
- Primary Goal: {primary_goal}
- Current Exercise Frequency: {current_frequency}
- Preferred Workout Location: {preferred_location}
- Available Time: {available_time}
- Motivation Style: {motivation_style}
- Biggest Challenge: {biggest_challenge}{personalization_context}
{time_context}
{existing_goals_context}
{location_constraint}

REMINDER TIME SUGGESTIONS:
{time_suggestions}
Remember: Generate AT LEAST 2 reminder times per goal!

CRITICAL - ADDRESS THEIR CHALLENGE:
{challenge_tip}

MOTIVATION STYLE GUIDANCE:
{motivation_tip}

🎯 PERSONALIZATION REQUIREMENTS:
1. Generate goals that DIRECTLY address their "{biggest_challenge}" challenge
2. Each match_reason must explain specifically HOW the goal helps THIS user
3. Consider their {fitness_level} level and {available_time} time availability
4. If they have a hydration target, use THAT number (not generic "8 glasses")
5. Suggest activities/foods relevant to their country if provided
6. DO NOT repeat any goals they already have
7. BE CREATIVE - avoid cliché suggestions like "Morning stretching", "Gratitude journaling", "Sunday meal prep"
8. Vary the days_of_week - not everything should be on the same days!
9. FOR FITNESS GOALS: Respect the location constraint above - NO outdoor/gym if location is "home"!"""


async def generate_goals_by_type(
    profile: Dict[str, Any],
    goal_type: str,
    duration_days: Optional[int] = None,
    target_range: Optional[str] = None,
    user_timezone: Optional[str] = None,
    current_time: Optional[datetime] = None,
    user_id: Optional[str] = None,
) -> Optional[List[Dict[str, Any]]]:
    """
    Generate goal suggestions based on goal type.

    Args:
        profile: User's fitness profile
        goal_type: 'habit', 'time_challenge', 'target_challenge', or 'mixed'
        duration_days: For time_challenge - 30, 60, or 90
        target_range: For target_challenge - 'small', 'medium', 'ambitious'
        user_timezone: User's timezone (e.g., 'America/New_York')
        current_time: Current UTC time
        user_id: User's ID for fetching existing goals

    Returns:
        List of goal suggestions with goal_type field
    """
    from openai import AsyncOpenAI
    from app.core.database import get_supabase_client

    try:
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        # Fetch existing goals and user data to avoid duplicates and personalize
        existing_goals: List[str] = []
        user_country: Optional[str] = None

        if user_id:
            supabase = get_supabase_client()
            existing_goals = _fetch_existing_goals(supabase, user_id)
            user_country = _fetch_user_country(supabase, user_id)

        # Use current UTC time if not provided
        if current_time is None:
            current_time = datetime.now(timezone.utc)

        # Select system prompt based on goal type
        if goal_type == "habit":
            system_prompt = HABIT_SYSTEM_PROMPT
            extra_context = ""
        elif goal_type == "time_challenge":
            system_prompt = TIME_CHALLENGE_SYSTEM_PROMPT
            duration = duration_days or 30
            extra_context = f"\nGenerate challenges with duration_days = {duration}"
        elif goal_type == "target_challenge":
            system_prompt = TARGET_CHALLENGE_SYSTEM_PROMPT
            target_map = {"small": "25-30", "medium": "50-75", "ambitious": "100-150"}
            target = target_map.get(target_range, "50-75")
            extra_context = f"\nSuggest target_checkins in the range: {target}"
        else:  # mixed
            system_prompt = MIXED_SYSTEM_PROMPT
            extra_context = ""

        user_context = build_user_context(
            profile,
            user_timezone,
            current_time,
            existing_goals=existing_goals,
            user_country=user_country,
        )

        # Generate 8-12 goals for variety
        goal_count = 10  # Target 10 goals, allows for some filtering

        # Get primary goal for intelligent frequency determination
        primary_goal = profile.get("primary_goal", "general_fitness")
        fitness_level = profile.get("fitness_level", "beginner")

        full_prompt = f"""{system_prompt}

{user_context}{extra_context}

Generate {goal_count} UNIQUE, PERSONALIZED goals.

🎯 CRITICAL - USE THEIR PROFILE INTELLIGENTLY:
- Primary Goal: {primary_goal}
- Fitness Level: {fitness_level}

INTELLIGENT FREQUENCY DECISIONS:
{"- For weight loss: Daily meal tracking and hydration are ESSENTIAL (7 days/week)" if primary_goal == "lose_weight" else ""}
{"- For muscle building: Focus on protein meals and strength training 4-5x/week" if primary_goal == "build_muscle" else ""}
{"- For stress reduction: Daily mindfulness and sleep habits are KEY" if primary_goal == "reduce_stress" else ""}
{"- For staying active: Flexible scheduling, variety is important" if primary_goal == "stay_active" else ""}

YOU DECIDE THE FREQUENCY based on what's OPTIMAL for their "{primary_goal}" goal.
Don't use fixed rules - think about what ACTUALLY helps someone achieve "{primary_goal}".

Respond with valid JSON only."""

        # Build context for system message
        preferred_location = profile.get("preferred_location", "home")
        location_warning = ""
        if preferred_location == "home":
            location_warning = "For FITNESS goals: User works out at HOME only - NO outdoor, NO gym, NO team sports!"

        # Determine diversity requirements based on goal type
        if goal_type == "habit":
            diversity_req = "Generate: 2-3 FITNESS, 1-2 NUTRITION (meal), 1 HYDRATION, 2 WELLNESS/MINDFULNESS goals"
        elif goal_type == "time_challenge":
            diversity_req = "Generate: 2-3 FITNESS challenges, 2 NUTRITION challenges, 2 WELLNESS challenges"
        elif goal_type == "target_challenge":
            diversity_req = (
                "Generate: 2 FITNESS targets, 2 NUTRITION targets, 2 WELLNESS targets"
            )
        else:  # mixed
            diversity_req = "Generate VARIETY: 3-4 habits, 3-4 time challenges, 2-3 target challenges across ALL categories"

        response = await asyncio.wait_for(
            client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": f"""You are an INTELLIGENT wellness coach covering ALL aspects of health.

⚠️ CATEGORY DIVERSITY IS MANDATORY:
{diversity_req}

Categories: fitness, nutrition, wellness, mindfulness, sleep
Tracking types: workout (fitness), meal (eating), hydration (water), checkin (wellness/mindfulness/sleep)

RULES FOR FITNESS GOALS ONLY:
1. {location_warning}
2. NEVER suggest "dance party", "fun movement" - only structured workouts
3. Suggest workout TYPES: "Strength Training", "HIIT", "Core Workout"

For user with goal '{primary_goal}' at '{fitness_level}' level, determine optimal frequency per category.""",
                    },
                    {"role": "user", "content": full_prompt},
                ],
                max_tokens=3500,
                temperature=0.8,
            ),
            timeout=45.0,
        )

        output_text = response.choices[0].message.content.strip()

        # Clean up potential markdown formatting
        if output_text.startswith("```"):
            output_text = output_text.split("```")[1]
            if output_text.startswith("json"):
                output_text = output_text[4:]
            output_text = output_text.strip()

        result = json.loads(output_text)
        goals = result.get("goals", [])

        if not goals:
            logger.warning(f"No goals generated for type: {goal_type}")
            return None

        # Validate and ensure goal_type is set
        validated_goals = []
        valid_categories = ["fitness", "nutrition", "wellness", "mindfulness", "sleep"]

        for goal in goals:
            if not goal.get("title") or not goal.get("description"):
                continue

            # === CATEGORY SANITIZATION ===
            # Fix common AI mistakes with category/tracking_type confusion
            category = goal.get("category", "").lower()
            tracking_type = goal.get("tracking_type", "").lower()
            combined_text = (
                f"{goal.get('title', '')} {goal.get('description', '')}".lower()
            )

            # Hydration keywords to detect hydration goals
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
            is_hydration_goal = any(kw in combined_text for kw in hydration_keywords)

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

            # Fix 3: If it's clearly a hydration goal but category is wrong (e.g., wellness)
            elif is_hydration_goal and category not in ["nutrition"]:
                goal["category"] = "nutrition"
                goal["tracking_type"] = "hydration"
                logger.info(
                    f"Fixed category '{category}' -> 'nutrition' for detected hydration goal: {goal.get('title')}"
                )

            # Fix 4: Validate category is in valid list, default to wellness if not
            if goal.get("category", "").lower() not in valid_categories:
                logger.warning(
                    f"Invalid category '{goal.get('category')}' for goal '{goal.get('title')}', defaulting to 'wellness'"
                )
                goal["category"] = "wellness"
                goal["tracking_type"] = "checkin"

            # Ensure goal_type is set correctly
            if goal_type != "mixed":
                goal["goal_type"] = goal_type

            # Ensure at least 2 reminder times
            reminder_times = goal.get("reminder_times") or []
            if len(reminder_times) < 2:
                # Generate default reminder times based on available_time
                available_time = profile.get("available_time", "30-60min")
                if available_time == "less_30min":
                    default_times = ["06:30", "18:30"]
                elif available_time == "1-2hrs":
                    default_times = ["09:00", "17:00"]
                else:  # 30-60min or flexible
                    default_times = ["07:00", "18:00"]

                # Merge existing with defaults if only 1 exists
                if len(reminder_times) == 1:
                    existing = reminder_times[0]
                    # Add a second time that's different from existing
                    if existing < "12:00":
                        # Morning time exists, add evening
                        goal["reminder_times"] = [existing, "18:00"]
                    else:
                        # Evening time exists, add morning
                        goal["reminder_times"] = ["07:00", existing]
                else:
                    goal["reminder_times"] = default_times

                logger.info(
                    f"Added default reminder times for goal: {goal.get('title')} -> {goal['reminder_times']}"
                )

            # Validate type-specific fields
            current_goal_type = goal.get("goal_type", "habit")

            if current_goal_type == "time_challenge":
                if not goal.get("duration_days"):
                    goal["duration_days"] = duration_days or 30
                # Set default sharing fields for time challenges
                goal["is_challenge_candidate"] = True
                if not goal.get("sharing_recommendation"):
                    goal["sharing_recommendation"] = "great_for_friends"

            elif current_goal_type == "target_challenge":
                if not goal.get("target_checkins"):
                    goal["target_checkins"] = 50  # Default

                # Validate that target_checkins is achievable
                # Assume 90-day duration for target challenges (no fixed end date)
                days_of_week = goal.get("days_of_week") or []
                frequency = goal.get("frequency", "weekly")
                reminder_times = goal.get("reminder_times") or ["07:00"]
                num_reminder_times = len(reminder_times)

                if frequency == "weekly" and days_of_week:
                    # Weekly: workout_days_per_week × weeks × reminder_times
                    workout_days_per_week = len(days_of_week)
                    max_weeks = 13  # ~90 days
                    max_checkins = (
                        workout_days_per_week * max_weeks * num_reminder_times
                    )
                else:
                    # Daily: 90 days × reminder_times
                    max_checkins = 90 * num_reminder_times

                # Cap target_checkins to realistic maximum
                target = goal.get("target_checkins", 50)
                if target > max_checkins:
                    # Adjust to 80% of max to be achievable
                    goal["target_checkins"] = max(25, int(max_checkins * 0.8))
                    logger.info(
                        f"Adjusted target_checkins from {target} to {goal['target_checkins']} (max={max_checkins})"
                    )

                # Set default sharing fields for target challenges
                goal["is_challenge_candidate"] = True
                if not goal.get("sharing_recommendation"):
                    goal["sharing_recommendation"] = "good_for_competition"

            else:  # habit
                # Habits are not challenge candidates
                goal["is_challenge_candidate"] = False
                goal["sharing_recommendation"] = None

            validated_goals.append(goal)

        logger.info(f"Generated {len(validated_goals)} {goal_type} goals")
        return validated_goals

    except asyncio.TimeoutError:
        logger.error(f"Timeout generating {goal_type} goals")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error for {goal_type} goals: {e}")
        return None
    except Exception as e:
        logger.error(f"Error generating {goal_type} goals: {e}")
        return None


def generate_goals_by_type_sync(
    profile: Dict[str, Any],
    goal_type: str,
    duration_days: Optional[int] = None,
    target_range: Optional[str] = None,
    user_timezone: Optional[str] = None,
    current_time: Optional[datetime] = None,
    user_id: Optional[str] = None,
) -> Optional[List[Dict[str, Any]]]:
    """Synchronous wrapper for generate_goals_by_type."""
    try:
        try:
            loop = asyncio.get_event_loop()
            if loop.is_closed():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        return loop.run_until_complete(
            generate_goals_by_type(
                profile,
                goal_type,
                duration_days,
                target_range,
                user_timezone,
                current_time,
                user_id,
            )
        )
    except Exception as e:
        logger.error(f"Sync wrapper error: {e}")
        return None
