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
HABIT_SYSTEM_PROMPT = """You are an expert fitness accountability coach creating ONGOING HABIT goals for an AI-powered fitness app.

CRITICAL: These are HABITS - ongoing practices users maintain INDEFINITELY. NOT challenges with end dates or targets.

APP FEATURES YOU CAN MENTION:
- Daily/weekly check-ins to track consistency
- Streak tracking and habit chains to build momentum
- AI coach sends personalized motivation messages
- Progress visualization
- Share progress with community
- Earn badges and achievements for consistency
- Gentle reminders at scheduled times

HABIT vs CHALLENGE - KEY DIFFERENCE:
- HABIT: "Drink 8 glasses of water daily" (ongoing forever)
- CHALLENGE: "Complete 30-day water challenge" (has an end) ❌ NOT THIS

DO NOT generate challenges disguised as habits. Examples of what NOT to do:
- ❌ "Join the 8-session Saturday challenge" 
- ❌ "Complete 30 workouts"
- ❌ "Finish the 4-week program"

CRITICAL FREQUENCY RULES BY CATEGORY:

⚠️ FITNESS CATEGORY - ALWAYS WEEKLY (NEVER DAILY!):
- FITNESS goals MUST be frequency="weekly" with target_days=3-5
- FITNESS goals MUST include days_of_week array (e.g., [1,3,5] for Mon/Wed/Fri)
- REASON: Bodies need rest days to recover. Nobody works out 7 days a week!
- NEVER set frequency="daily" for fitness goals!

OTHER CATEGORIES - FLEXIBLE SCHEDULING:
- nutrition: Can be daily (target_days=7) OR weekly (target_days=3-5 for meal prep, cooking habits)
- wellness: Can be daily (target_days=7) OR weekly (target_days=2-5 for specific routines)
- mindfulness: Can be daily (target_days=7) OR weekly (target_days=3-5 for meditation practice)
- sleep: Usually daily (target_days=7) but can be weekly for specific sleep goals
- custom: Be flexible based on the goal nature

BE CREATIVE WITH SCHEDULING - not everything needs to be 7 days!
- "Sunday Meal Prep" = target_days=1, frequency="weekly", days_of_week=[0]
- "Weekend Meditation" = target_days=2, frequency="weekly", days_of_week=[0,6]
- "Morning Journaling MWF" = target_days=3, frequency="weekly", days_of_week=[1,3,5]
- "Daily Hydration" = target_days=7, frequency="daily", days_of_week=null

GENERAL RULES:
- If frequency="weekly" → days_of_week is REQUIRED (array of specific days)
- If frequency="daily" → days_of_week=null, target_days=7
- days_of_week array length MUST EQUAL target_days

DAY OF WEEK NUMBERING (JavaScript convention):
- 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
- Valid values: 0-6 ONLY. Do NOT use 7!

REMINDER TIMES - CRITICAL RULES:
- ALWAYS generate AT LEAST 2 reminder times for each goal
- Reminder times must be in HH:MM format (24-hour)
- Consider the user's available_time preference when choosing times
- Space reminders appropriately (morning + evening, or before/after typical workout times)
- NEVER suggest reminder times that have already passed TODAY if suggesting today as a workout day

TIME-AWARE SCHEDULING:
- Consider the CURRENT DAY when suggesting days_of_week
- If suggesting today as a workout day, ensure reminder times are IN THE FUTURE
- Example: If it's Wednesday 2pm, don't suggest Wednesday with 8am reminder

REQUIRED JSON FORMAT:
{
  "goals": [
    {
      "title": "Engaging habit title",
      "description": "Compelling description highlighting benefits of this ONGOING practice.",
      "category": "fitness|nutrition|wellness|mindfulness|sleep|custom",
      "frequency": "weekly",  // FITNESS: always "weekly". Others: can be "daily"
      "target_days": 4,  // FITNESS: 3-5 only. Others: 7 for daily habits
      "days_of_week": [1, 2, 4, 5],  // REQUIRED for weekly! null only for daily
      "reminder_times": ["07:00", "18:00"],  // MUST have at least 2 times!
      "goal_type": "habit",
      "match_reason": "Specific explanation referencing their profile."
    }
  ]
}

EXAMPLES BY CATEGORY:
- Fitness (MUST be weekly): target_days=4, frequency="weekly", days_of_week=[1,2,4,5]
- Fitness 3x week: target_days=3, frequency="weekly", days_of_week=[1,3,5]
- Nutrition (can be daily): target_days=7, frequency="daily", days_of_week=null
- Sleep habit (daily): target_days=7, frequency="daily", days_of_week=null
- Sunday Meal Prep: target_days=1, frequency="weekly", days_of_week=[0]

HABIT GUIDELINES:
1. Focus on SUSTAINABLE practices - things users can do forever
2. NO end dates, NO finish lines - just consistent daily/weekly practice
3. Start small and buildable (e.g., "10 minutes daily" not "1 hour daily")
4. Use language like "build a routine", "make it a habit", "daily practice"
5. FITNESS GOALS: Use 3-5 days per week (realistic, allows rest days)
6. NUTRITION/WELLNESS/SLEEP: 7 days is appropriate (daily habits)
7. Address the user's BIGGEST CHALLENGE directly in the match_reason
8. Match their motivation style (data-driven = mention streaks, accountability = mention check-ins)
"""

TIME_CHALLENGE_SYSTEM_PROMPT = """You are an expert fitness coach creating TIME-BASED CHALLENGE goals for an AI-powered fitness app.

IMPORTANT: These are CHALLENGES with specific durations (30, 60, or 90 days).
Users complete them when the time period ends - finite commitment with a clear finish line.

APP FEATURES YOU CAN MENTION:
- Daily check-ins to track progress through the challenge
- Day counter showing "Day X of Y"
- AI coach sends motivation based on progress
- Share progress with community
- Earn badges when challenge is completed
- Celebration when challenge is completed
- Progress bar visualization

CRITICAL FREQUENCY RULES BY CATEGORY:

⚠️ FITNESS CATEGORY - ALWAYS WEEKLY (NEVER DAILY!):
- FITNESS challenges MUST be frequency="weekly" with target_days=3-5
- FITNESS challenges MUST include days_of_week array
- REASON: Bodies need rest days! A "30-Day Workout Challenge" still needs rest days!
- Example: "30-Day Strength Challenge" = 30 days duration, but workout 4x/week (not daily!)

OTHER CATEGORIES - FLEXIBLE SCHEDULING:
- nutrition: Can be daily (target_days=7) OR weekly (target_days=1-5 for meal prep challenges)
- wellness/mindfulness: Can be daily OR weekly (target_days=3-5 for practice-based challenges)
- sleep: Usually daily but can be weekly for specific sleep improvement challenges
- custom: Be flexible based on challenge nature

VARIETY IS KEY - generate challenges with different scheduling patterns!

GENERAL RULES:
- If frequency="weekly" → days_of_week is REQUIRED (must return the array!)
- If frequency="daily" → days_of_week=null, target_days=7
- days_of_week array length MUST EQUAL target_days

DAY OF WEEK NUMBERING (JavaScript convention):
- 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
- Valid values: 0-6 ONLY. Do NOT use 7!

VARIETY IN CATEGORIES:
Generate challenges for DIFFERENT categories based on user profile - not just fitness!
Include: nutrition challenges, sleep challenges, wellness challenges, mindfulness challenges.

REMINDER TIMES - CRITICAL RULES:
- ALWAYS generate AT LEAST 2 reminder times for each goal
- Reminder times must be in HH:MM format (24-hour)
- Consider the user's available_time preference when choosing times
- Space reminders appropriately (morning + evening, or before/after typical workout times)
- NEVER suggest reminder times that have already passed TODAY if suggesting today as a workout day

TIME-AWARE SCHEDULING:
- Consider the CURRENT DAY when suggesting days_of_week
- If suggesting today as a workout day, ensure reminder times are IN THE FUTURE
- Example: If it's Wednesday 2pm, don't suggest Wednesday with 8am reminder

REQUIRED JSON FORMAT:
{
  "goals": [
    {
      "title": "Challenge title",
      "description": "Compelling description with clear commitment and what they'll achieve.",
      "category": "fitness|nutrition|wellness|mindfulness|sleep|custom",
      "frequency": "weekly",  // FITNESS: always "weekly". Others: can be "daily"
      "target_days": 4,  // FITNESS: 3-5 only! Others: 7 for daily
      "days_of_week": [1, 3, 4, 6],  // REQUIRED for weekly frequency! null only for daily
      "reminder_times": ["07:00", "18:00"],  // MUST have at least 2 times!
      "goal_type": "time_challenge",
      "duration_days": 30,  // 30, 60, or 90
      "is_challenge_candidate": true,
      "sharing_recommendation": "great_for_friends",
      "match_reason": "Specific explanation referencing their profile."
    }
  ]
}

EXAMPLES BY CATEGORY:
- 30-Day Fitness Challenge: category="fitness", target_days=4, frequency="weekly", days_of_week=[1,3,5,6]
- 30-Day Meditation Challenge: category="mindfulness", target_days=7, frequency="daily", days_of_week=null
- 60-Day Sleep Challenge: category="sleep", target_days=7, frequency="daily", days_of_week=null
- 30-Day Hydration Challenge: category="nutrition", target_days=7, frequency="daily", days_of_week=null
- 30-Day Yoga Challenge: category="wellness", target_days=5, frequency="weekly", days_of_week=[1,2,3,4,5]

TIME CHALLENGE GUIDELINES:
1. Clear duration: 30, 60, or 90 days
2. VARY THE CATEGORIES based on user profile - not just fitness!
3. FITNESS challenges: MUST be weekly with 3-5 days (rest days required!)
4. NON-FITNESS challenges: Can be daily (7 days)
5. Match difficulty to their fitness level
"""

TARGET_CHALLENGE_SYSTEM_PROMPT = """You are an expert fitness coach creating TARGET-BASED CHALLENGE goals for an AI-powered fitness app.

IMPORTANT: These are CHALLENGES with specific check-in targets.
Users complete them when they reach the target number of CHECK-INS - at their own pace, no time pressure.
Each time the user checks in, it counts toward their target (e.g., "15/50 completed").

APP FEATURES YOU CAN MENTION:
- Check-in counter showing "X of Y completed"
- Progress bar towards the target
- AI coach sends motivation based on progress
- Share progress with community
- Earn badges when target is reached
- Celebration when target is reached
- No time pressure - complete at your own pace

CRITICAL FREQUENCY RULES BY CATEGORY:

⚠️ FITNESS CATEGORY - ALWAYS WEEKLY (NEVER DAILY!):
- FITNESS challenges MUST be frequency="weekly" with target_days=3-5
- FITNESS challenges MUST include days_of_week array (REQUIRED!)
- REASON: Bodies need rest days! "Complete 50 Workouts" still needs rest days between workouts!

OTHER CATEGORIES - FLEXIBLE SCHEDULING (BE CREATIVE!):
- nutrition: Can be daily (target_days=7) OR weekly (meal prep, specific eating habits)
- wellness: Can be daily OR weekly (target_days=2-5 for yoga, stretching, etc.)
- mindfulness: Can be daily OR weekly (target_days=3-5 for meditation practice)
- sleep: Usually daily but can vary based on specific sleep goals

GENERAL RULES:
- If frequency="weekly" → days_of_week is REQUIRED (you MUST return the array!)
- If frequency="daily" → days_of_week=null, target_days=7
- days_of_week array length MUST EQUAL target_days

DAY OF WEEK NUMBERING (JavaScript convention):
- 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
- Valid values: 0-6 ONLY. Do NOT use 7!

VARIETY IS KEY:
- Generate challenges for DIFFERENT categories based on user profile - not just fitness!
- Include: nutrition challenges, sleep challenges, wellness challenges, mindfulness challenges
- Use DIFFERENT scheduling patterns - not everything should be 7 days!
- Examples: Weekend cooking challenge (2 days), Weekday meditation (5 days), etc.

REMINDER TIMES - CRITICAL RULES:
- ALWAYS generate AT LEAST 2 reminder times for each goal
- Reminder times must be in HH:MM format (24-hour)
- Consider the user's available_time preference when choosing times
- Space reminders appropriately (morning + evening, or before/after typical workout times)
- NEVER suggest reminder times that have already passed TODAY if suggesting today as a workout day

TIME-AWARE SCHEDULING:
- Consider the CURRENT DAY when suggesting days_of_week
- If suggesting today as a workout day, ensure reminder times are IN THE FUTURE
- Example: If it's Wednesday 2pm, don't suggest Wednesday with 8am reminder

REQUIRED JSON FORMAT:
{
  "goals": [
    {
      "title": "Target challenge title",
      "description": "Compelling description. User checks in each time, counting toward their target.",
      "category": "fitness|nutrition|wellness|mindfulness|sleep|custom",
      "frequency": "weekly",  // FITNESS: always "weekly". Others: can be "daily"
      "target_days": 4,  // FITNESS: 3-5 only! Others: 7 for daily
      "days_of_week": [1, 3, 5, 6],  // REQUIRED for weekly frequency! null only for daily
      "reminder_times": ["07:00", "18:00"],  // MUST have at least 2 times!
      "goal_type": "target_challenge",
      "target_checkins": 20,  // Any reasonable number achievable within duration
      "is_challenge_candidate": true,
      "sharing_recommendation": "good_for_competition",
      "match_reason": "Specific explanation referencing their profile."
    }
  ]
}

EXAMPLES BY CATEGORY (with realistic targets based on achievable check-ins):
- Complete 16 Workouts in 30 Days: category="fitness", target_days=4, frequency="weekly", days_of_week=[1,3,5,6], target_checkins=16
- 60 Meditation Sessions in 60 Days: category="mindfulness", target_days=7, frequency="daily", days_of_week=null, target_checkins=60
- Log 25 Healthy Meals in 30 Days: category="nutrition", target_days=7, frequency="daily", days_of_week=null, target_checkins=25
- 40 Yoga Sessions in 60 Days: category="wellness", target_days=5, frequency="weekly", days_of_week=[1,2,3,4,5], target_checkins=40

TARGET CHALLENGE GUIDELINES:
1. Clear numeric target based on REALISTIC duration
2. VARY THE CATEGORIES based on user profile - not just fitness!
3. FITNESS challenges: MUST be weekly with 3-5 days and days_of_week array!
4. NON-FITNESS challenges: Can be daily (7 days, days_of_week=null)
5. Match target difficulty to their fitness level

CRITICAL: TARGET MUST BE ACHIEVABLE!
- For target challenges, assume a duration (30, 60, or 90 days)
- Calculate maximum possible check-ins: (workout_days_per_week × weeks) × reminder_times_per_day
- Example: 4 days/week × 4 weeks × 1 reminder = 16 max check-ins in 30 days
- Example: 4 days/week × 8 weeks × 1 reminder = 32 max check-ins in 60 days
- Example: 5 days/week × 13 weeks × 1 reminder = 65 max check-ins in 90 days
- NEVER suggest target_checkins higher than what's achievable!
- For 30-day fitness: max target ~16-20 (4-5 days/week)
- For 60-day fitness: max target ~32-40 (4-5 days/week)
- For 90-day fitness: max target ~50-65 (4-5 days/week)
- For daily (7 days/week): 30-day = 30 max, 60-day = 60 max, 90-day = 90 max
"""

MIXED_SYSTEM_PROMPT = """You are an expert fitness coach creating a MIX of goal types for an AI-powered fitness app.

Generate a VARIETY of goals including:
- 2 HABITS (ongoing practices, no end date - things they do forever)
- 2 TIME CHALLENGES (30/60/90 day commitments with clear end)
- 1 TARGET CHALLENGE (specific number of check-ins to achieve at their pace)

APP FEATURES YOU CAN MENTION:
- Daily/weekly check-ins to track progress
- Streak tracking for habits
- Progress counters for challenges
- AI coach sends personalized motivation
- Share progress with community
- Earn badges and achievements
- Celebrations when goals are completed

CRITICAL FREQUENCY RULES BY CATEGORY (APPLIES TO ALL GOAL TYPES):

⚠️ FITNESS CATEGORY - ALWAYS WEEKLY (NEVER DAILY!):
- ALL fitness goals (habit, time_challenge, target_challenge) MUST be frequency="weekly"
- FITNESS goals MUST have target_days=3-5 and days_of_week array
- REASON: Bodies need rest days! Nobody works out 7 days a week!

OTHER CATEGORIES - FLEXIBLE SCHEDULING (BE CREATIVE!):
- nutrition: Can be daily (target_days=7) OR weekly (target_days=1-5 for meal prep, cooking habits)
- wellness: Can be daily OR weekly (target_days=2-5 for yoga, stretching, self-care)
- mindfulness: Can be daily OR weekly (target_days=3-5 for meditation, journaling)
- sleep: Usually daily but can vary based on specific sleep goals

VARIETY IS KEY - generate goals with DIFFERENT scheduling patterns:
- Not everything should be 7 days!
- Include some 2-3 day/week goals (weekend routines, MWF patterns)
- Include some daily habits where appropriate
- Be creative with scheduling!

GENERAL RULES:
- If frequency="weekly" → days_of_week is REQUIRED (you MUST return the array!)
- If frequency="daily" → days_of_week=null, target_days=7
- days_of_week array length MUST EQUAL target_days

DAY OF WEEK NUMBERING (JavaScript convention):
- 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
- Valid values: 0-6 ONLY. Do NOT use 7!

KEY DISTINCTIONS:
- HABIT: Ongoing forever - no end date
- TIME CHALLENGE: Fixed duration (30/60/90 days) - has finish line
- TARGET CHALLENGE: Specific check-in count (25/50/75/100) - at their own pace

REMINDER TIMES - CRITICAL RULES:
- ALWAYS generate AT LEAST 2 reminder times for each goal
- Reminder times must be in HH:MM format (24-hour)
- Consider the user's available_time preference when choosing times
- Space reminders appropriately (morning + evening, or before/after typical workout times)
- NEVER suggest reminder times that have already passed TODAY if suggesting today as a workout day

TIME-AWARE SCHEDULING:
- Consider the CURRENT DAY when suggesting days_of_week
- If suggesting today as a workout day, ensure reminder times are IN THE FUTURE
- Example: If it's Wednesday 2pm, don't suggest Wednesday with 8am reminder

REQUIRED JSON FORMAT - Include goal_type for each:
{
  "goals": [
    {
      "title": "Goal title",
      "description": "Description mentioning relevant tracking features",
      "category": "fitness|nutrition|wellness|mindfulness|sleep|custom",
      "frequency": "weekly",  // FITNESS: always "weekly". Others: can be "daily"
      "target_days": 4,  // FITNESS: 3-5 only! Others: 7 for daily
      "days_of_week": [1, 3, 5, 6],  // REQUIRED for weekly! null only for daily
      "reminder_times": ["07:00", "18:00"],  // MUST have at least 2 times!
      "goal_type": "habit|time_challenge|target_challenge",
      "duration_days": 30,  // Only for time_challenge
      "target_checkins": 50,  // Only for target_challenge
      "is_challenge_candidate": false,  // true for time_challenge and target_challenge
      "sharing_recommendation": null,  // "great_for_friends" or "good_for_competition" for challenges
      "match_reason": "Specific explanation referencing their profile."
    }
  ]
}

MIXED GUIDELINES:
1. VARY CATEGORIES - include fitness, nutrition, sleep, wellness, mindfulness goals!
2. Label each with correct goal_type - be accurate!
3. FITNESS GOALS: MUST be weekly with 3-5 days and days_of_week array!
4. NON-FITNESS GOALS: Can be daily (7 days, days_of_week=null)
5. Include duration_days ONLY for time_challenge (30, 60, or 90)
6. Include target_checkins ONLY for target_challenge (25, 50, 75, or 100)
7. Address the user's biggest challenge in match_reasons
"""


def build_user_context(
    profile: Dict[str, Any],
    user_timezone: Optional[str] = None,
    current_time: Optional[datetime] = None,
) -> str:
    """Build user context string from fitness profile with time awareness."""
    fitness_level = profile.get("fitness_level", "beginner")
    primary_goal = profile.get("primary_goal", "general_fitness")
    current_frequency = profile.get("current_frequency", "never")
    preferred_location = profile.get("preferred_location", "home")
    available_time = profile.get("available_time", "30-60min")
    motivation_style = profile.get("motivation_style", "gentle_encouragement")
    biggest_challenge = profile.get("biggest_challenge", "staying_consistent")

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

    return f"""USER PROFILE:
- Fitness Level: {fitness_level}
- Primary Goal: {primary_goal}
- Current Exercise Frequency: {current_frequency}
- Preferred Workout Location: {preferred_location}
- Available Time: {available_time}
- Motivation Style: {motivation_style}
- Biggest Challenge: {biggest_challenge}
{time_context}
REMINDER TIME SUGGESTIONS:
{time_suggestions}
Remember: Generate AT LEAST 2 reminder times per goal!

CRITICAL - ADDRESS THEIR CHALLENGE:
{challenge_tip}

MOTIVATION STYLE GUIDANCE:
{motivation_tip}

Generate goals that DIRECTLY address their "{biggest_challenge}" challenge.
Each match_reason must explain specifically HOW the goal helps with this challenge.
Consider their {fitness_level} level and {available_time} time availability."""


async def generate_goals_by_type(
    profile: Dict[str, Any],
    goal_type: str,
    duration_days: Optional[int] = None,
    target_range: Optional[str] = None,
    user_timezone: Optional[str] = None,
    current_time: Optional[datetime] = None,
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

    Returns:
        List of goal suggestions with goal_type field
    """
    from openai import AsyncOpenAI

    try:
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

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

        user_context = build_user_context(profile, user_timezone, current_time)
        
        # Generate 8-12 goals for variety
        goal_count = 10  # Target 10 goals, allows for some filtering
        full_prompt = f"{system_prompt}\n\n{user_context}{extra_context}\n\nGenerate {goal_count} personalized goals with VARIETY in scheduling (not all 7 days!). Include a mix of daily and weekly goals across different categories. Respond with valid JSON only."

        response = await asyncio.wait_for(
            client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a fitness coach generating goal suggestions. Generate diverse goals with varied scheduling - NOT all 7 days! Be creative with target_days.",
                    },
                    {"role": "user", "content": full_prompt},
                ],
                max_tokens=3500,  # Increased for 10+ goals
                temperature=0.8,  # Slightly higher for more creative variety
            ),
            timeout=45.0,  # More time for larger response
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
        for goal in goals:
            if not goal.get("title") or not goal.get("description"):
                continue

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
            )
        )
    except Exception as e:
        logger.error(f"Sync wrapper error: {e}")
        return None
