"""
Progression Planner Agent

Responsible for creating progressive overload schedules:
- Weekly intensity adjustments
- Rep/set progression over 4 weeks
- Recovery weeks (deload)
- Milestone definitions
"""

from typing import Dict, Any, List
from app.services.agents.base import BaseAgent
from app.services.logger import logger


class ProgressionAgent(BaseAgent[Dict[str, Any]]):
    """
    Creates a progressive workout plan based on goal type.

    For HABITS (ongoing):
    - No fixed duration, focus on streak-based milestones
    - Provide general progression guidance

    For TIME CHALLENGES:
    - Dynamic weeks based on duration_days
    - Progressive intensity across the full challenge

    For TARGET CHALLENGES:
    - Milestone-based (25%, 50%, 75%, 100%)
    - No weekly structure - progress by check-in count

    Progression principles:
    - First 25% of duration: Foundation phase
    - Next 25%: Building phase
    - Next 25%: Intensifying phase
    - Final 25%: Peak/finish phase
    """

    MODEL = "gpt-4o-mini"
    MAX_RETRIES = 2
    TIMEOUT_SECONDS = 25.0

    @property
    def system_prompt(self) -> str:
        return """You are an expert fitness coach that designs progressive workout programs.

Your role is to create a progression plan based on the GOAL TYPE provided:

=== HABIT GOALS (ongoing, no end date) ===
For habits, focus on STREAK MILESTONES not weekly phases:
{
  "progression": {
    "goal_type": "habit",
    "weekly_focus": "Build consistency through small daily wins",
    "streak_milestones": [
      {"days": 7, "title": "First Week!", "description": "You're building momentum!"},
      {"days": 30, "title": "30-Day Streak!", "description": "Habit is forming!"},
      {"days": 60, "title": "60-Day Streak!", "description": "This is part of you now!"},
      {"days": 100, "title": "100 Days!", "description": "You've mastered this habit!"}
    ]
  }
}
DO NOT include weekly_adjustments for habits - they are ongoing!

=== TIME CHALLENGES (specific duration) ===
Generate DYNAMIC weeks based on challenge_duration_days:
- Calculate num_weeks = ceil(duration_days / 7)
- Generate exactly num_weeks entries in weekly_adjustments
- Intensity progression: first 25% "light", next 25% "moderate", next 25% "moderate-high", final 25% "high"

Example for 30-day challenge (5 weeks):
{
  "progression": {
    "goal_type": "time_challenge",
    "current_week": 1,
    "total_weeks": 5,
    "weekly_focus": "Week 1 focus here",
    "weekly_adjustments": [
      {"week": 1, "intensity": "light", "focus": "...", "reps_modifier": 0, "sets_modifier": 0, "rest_modifier": 0},
      {"week": 2, "intensity": "moderate", "focus": "...", "reps_modifier": 1, "sets_modifier": 0, "rest_modifier": 0},
      {"week": 3, "intensity": "moderate-high", "focus": "...", "reps_modifier": 2, "sets_modifier": 0, "rest_modifier": -5},
      {"week": 4, "intensity": "high", "focus": "...", "reps_modifier": 2, "sets_modifier": 1, "rest_modifier": -5},
      {"week": 5, "intensity": "high", "focus": "Final push!", "reps_modifier": 3, "sets_modifier": 1, "rest_modifier": -10}
    ]
  }
}

=== TARGET CHALLENGES (check-in based) ===
For target challenges, progress is by COUNT not TIME:
{
  "progression": {
    "goal_type": "target_challenge",
    "target_checkins": 50,
    "milestones": [
      {"count": 13, "percent": 25, "title": "25% Complete", "description": "Great start!"},
      {"count": 25, "percent": 50, "title": "Halfway!", "description": "Keep pushing!"},
      {"count": 38, "percent": 75, "title": "75% Done!", "description": "Almost there!"},
      {"count": 50, "percent": 100, "title": "Challenge Complete!", "description": "You did it!"}
    ]
  }
}
DO NOT include weekly_adjustments for target challenges!

PROGRESSION BY FITNESS LEVEL:
- Beginner: Very gradual (+1-2 reps/week), focus on form
- Intermediate: Moderate (+2-3 reps or +1 set every 2 weeks)
- Advanced: Aggressive, may include deload weeks
- Athlete: Periodized with planned peaks

BIOLOGICAL SEX CONSIDERATIONS (when provided):
- Adjust intensity expectations appropriately
- Consider recovery time differences

Modifiers explanation:
- reps_modifier: Add this many reps to each set
- sets_modifier: Add this many sets to each exercise
- rest_modifier: Adjust rest time in seconds (negative = less rest = harder)"""

    def build_user_prompt(self, context: Dict[str, Any]) -> str:
        """Build the prompt for progression planning."""

        goal = context.get("goal", {})
        user_profile = context.get("user_profile", {})
        settings = context.get("settings", {})
        selected_exercises = context.get("selected_exercises", [])

        # Determine goal type and duration
        goal_type = goal.get("goal_type", "habit")
        challenge_duration = goal.get("challenge_duration_days")
        target_checkins = goal.get("target_checkins")

        # Calculate number of weeks for time challenges
        num_weeks = None
        if goal_type == "time_challenge" and challenge_duration:
            num_weeks = (challenge_duration + 6) // 7  # Round up

        # Build goal type specific instructions
        if goal_type == "habit":
            type_instruction = """
⚠️ This is a HABIT (ongoing, no end date).
Generate STREAK MILESTONES, not weekly_adjustments.
Focus on celebrating consistency: 7 days, 30 days, 60 days, 100 days."""
        elif goal_type == "time_challenge":
            type_instruction = f"""
⚠️ This is a TIME CHALLENGE with {challenge_duration} days ({num_weeks} weeks).
Generate exactly {num_weeks} weeks of weekly_adjustments.
Intensity should progress: light → moderate → moderate-high → high across {num_weeks} weeks."""
        elif goal_type == "target_challenge":
            type_instruction = f"""
⚠️ This is a TARGET CHALLENGE with {target_checkins} check-ins to complete.
Generate milestones at 25%, 50%, 75%, 100% of {target_checkins}.
DO NOT include weekly_adjustments - progress is by check-in count."""
        else:
            type_instruction = "Generate a standard 4-week progression plan."

        prompt = f"""Create a progression plan for this workout:

GOAL:
- Title: {goal.get("title", "Workout")}
- Type: {goal_type}
- Primary Goal: {user_profile.get("primary_goal", "general_fitness")}
{f"- Challenge Duration: {challenge_duration} days ({num_weeks} weeks)" if challenge_duration else ""}
{f"- Target Check-ins: {target_checkins}" if target_checkins else ""}

{type_instruction}

USER PROFILE:
- Fitness Level: {user_profile.get("fitness_level", "beginner")}
- Current Exercise Frequency: {user_profile.get("current_frequency", "never")}
- Biggest Challenge: {user_profile.get("biggest_challenge", "staying_consistent")}
- Biological Sex: {user_profile.get("biological_sex", "not specified")}

CURRENT WORKOUT BASELINE:
- Default sets per exercise: {settings.get("default_sets", 3)}
- Exercises in workout: {len(selected_exercises)}

Design a progression that:
1. Matches the GOAL TYPE above (habit/time_challenge/target_challenge)
2. Starts at an appropriate level for a {user_profile.get("fitness_level", "beginner")}
3. Gradually increases difficulty without causing burnout
4. Addresses their challenge of: {user_profile.get("biggest_challenge", "staying_consistent")}

{"For a beginner, be very conservative with progression. Focus on consistency over intensity." if user_profile.get("fitness_level") == "beginner" else ""}

Return the progression plan in the JSON format specified for this goal type."""

        return prompt

    def validate_output(self, output: Dict[str, Any]) -> bool:
        """Validate the progression plan output based on goal type."""

        if not output:
            return False

        # Check for progression section
        progression = output.get("progression", {})
        if not progression or not isinstance(progression, dict):
            logger.warning("ProgressionAgent: No progression in output")
            return False

        goal_type = progression.get("goal_type", "habit")

        # Validate based on goal type
        if goal_type == "habit":
            # Habits should have streak_milestones
            streak_milestones = progression.get("streak_milestones", [])
            if streak_milestones and isinstance(streak_milestones, list):
                return True
            # Fallback: also accept weekly_focus for simpler habit plans
            if progression.get("weekly_focus"):
                return True
            logger.warning("ProgressionAgent: Habit missing streak_milestones")
            return False

        elif goal_type == "target_challenge":
            # Target challenges should have milestones
            milestones = progression.get("milestones", [])
            if not milestones or not isinstance(milestones, list):
                logger.warning("ProgressionAgent: Target challenge missing milestones")
                return False
            return True

        else:
            # Time challenge or default: validate weekly_adjustments
            weekly_adjustments = progression.get("weekly_adjustments", [])
            if not weekly_adjustments or not isinstance(weekly_adjustments, list):
                logger.warning("ProgressionAgent: No weekly_adjustments")
                return False

            # Should have at least 1 week
            if len(weekly_adjustments) < 1:
                logger.warning("ProgressionAgent: No weeks in weekly_adjustments")
                return False

            # Validate each week has required fields
            required_fields = ["week", "intensity", "focus"]
            for week in weekly_adjustments:
                for field in required_fields:
                    if field not in week:
                        logger.warning(f"ProgressionAgent: Week missing field: {field}")
                        return False

            return True

    def get_fallback_output(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Return fallback progression when planning fails."""

        fitness_level = context.get("user_profile", {}).get("fitness_level", "beginner")

        # Different progression profiles by fitness level
        progressions = {
            "beginner": {
                "weekly_adjustments": [
                    {
                        "week": 1,
                        "intensity": "foundation",
                        "reps_modifier": 0,
                        "sets_modifier": 0,
                        "rest_modifier": 0,
                        "focus": "Focus on learning proper form for each exercise",
                        "tips": [
                            "Don't worry about speed - quality matters more",
                            "Stop if you feel pain (discomfort is okay)",
                            "Watch the demo videos before each exercise",
                        ],
                    },
                    {
                        "week": 2,
                        "intensity": "building",
                        "reps_modifier": 1,
                        "sets_modifier": 0,
                        "rest_modifier": 0,
                        "focus": "Add 1 rep to each set while maintaining form",
                        "tips": [
                            "You've got the form down - now add 1 rep",
                            "Keep the same quality as last week",
                            "Your body is adapting!",
                        ],
                    },
                    {
                        "week": 3,
                        "intensity": "moderate",
                        "reps_modifier": 2,
                        "sets_modifier": 0,
                        "rest_modifier": 0,
                        "focus": "Continue building with 2 more reps per set",
                        "tips": [
                            "You're getting stronger!",
                            "This might feel challenging - that's good",
                            "Rest as needed between sets",
                        ],
                    },
                    {
                        "week": 4,
                        "intensity": "solidifying",
                        "reps_modifier": 2,
                        "sets_modifier": 0,
                        "rest_modifier": 0,
                        "focus": "Maintain this level and build consistency",
                        "tips": [
                            "You've made amazing progress!",
                            "Focus on making this your new baseline",
                            "Celebrate finishing the 4-week program!",
                        ],
                    },
                ],
                "weekly_focus": "Focus on building consistency and proper form before increasing intensity",
            },
            "intermediate": {
                "weekly_adjustments": [
                    {
                        "week": 1,
                        "intensity": "foundation",
                        "reps_modifier": 0,
                        "sets_modifier": 0,
                        "rest_modifier": 0,
                        "focus": "Establish your baseline and refine form",
                        "tips": [
                            "Use this week to find your rhythm",
                            "Focus on mind-muscle connection",
                            "Note which exercises feel hardest",
                        ],
                    },
                    {
                        "week": 2,
                        "intensity": "building",
                        "reps_modifier": 2,
                        "sets_modifier": 0,
                        "rest_modifier": -5,
                        "focus": "Increase reps and reduce rest slightly",
                        "tips": [
                            "Add 2 reps to each set",
                            "Cut 5 seconds from rest periods",
                            "Push through the burn",
                        ],
                    },
                    {
                        "week": 3,
                        "intensity": "challenging",
                        "reps_modifier": 2,
                        "sets_modifier": 1,
                        "rest_modifier": -5,
                        "focus": "Add an extra set to each exercise",
                        "tips": [
                            "This is the hardest week - embrace it!",
                            "One extra set makes a big difference",
                            "Quality over quantity still matters",
                        ],
                    },
                    {
                        "week": 4,
                        "intensity": "peak",
                        "reps_modifier": 3,
                        "sets_modifier": 1,
                        "rest_modifier": -10,
                        "focus": "Peak performance - give it everything!",
                        "tips": [
                            "This is your peak week",
                            "Push your limits safely",
                            "You've earned this challenge!",
                        ],
                    },
                ],
                "weekly_focus": "Progressive overload with balanced recovery",
            },
            "advanced": {
                "weekly_adjustments": [
                    {
                        "week": 1,
                        "intensity": "foundation",
                        "reps_modifier": 0,
                        "sets_modifier": 0,
                        "rest_modifier": 0,
                        "focus": "Establish baseline with perfect form",
                        "tips": [
                            "Perfect reps only",
                            "Focus on time under tension",
                            "Note your starting numbers",
                        ],
                    },
                    {
                        "week": 2,
                        "intensity": "building",
                        "reps_modifier": 2,
                        "sets_modifier": 1,
                        "rest_modifier": -10,
                        "focus": "Increase volume significantly",
                        "tips": [
                            "Add a full set to each exercise",
                            "Reduce rest to 10 sec less",
                            "Push past comfort zone",
                        ],
                    },
                    {
                        "week": 3,
                        "intensity": "peak",
                        "reps_modifier": 3,
                        "sets_modifier": 1,
                        "rest_modifier": -15,
                        "focus": "Maximum intensity week",
                        "tips": [
                            "This is your hardest week",
                            "Go to near-failure on last sets",
                            "Fuel and sleep are critical",
                        ],
                    },
                    {
                        "week": 4,
                        "intensity": "deload",
                        "reps_modifier": -2,
                        "sets_modifier": -1,
                        "rest_modifier": 15,
                        "focus": "Active recovery - reduce volume 40%",
                        "tips": [
                            "Deload week = growth week",
                            "Reduce weight/reps by 40%",
                            "Focus on mobility and form",
                        ],
                    },
                ],
                "weekly_focus": "Periodized training with deload for optimal adaptation",
            },
        }

        # Get progression for fitness level, default to beginner
        level_progression = progressions.get(fitness_level, progressions["beginner"])

        return {
            "progression": {
                "current_week": 1,
                "total_weeks": 4,
                "weekly_adjustments": level_progression["weekly_adjustments"],
                "weekly_focus": level_progression["weekly_focus"],
            }
        }
