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
    Creates a 4-week progressive workout plan.

    Progression principles:
    - Week 1: Foundation - Learn form, establish baseline
    - Week 2: Building - Slight increase in volume/intensity
    - Week 3: Challenge - Push harder, test limits
    - Week 4: Peak/Deload - Either peak performance or recovery

    For beginners: More gradual progression
    For advanced: More aggressive progression
    """

    MODEL = "gpt-4o-mini"
    MAX_RETRIES = 2
    TIMEOUT_SECONDS = 25.0

    @property
    def system_prompt(self) -> str:
        return """You are an expert fitness coach that designs progressive workout programs.

Your role is to create a 4-week progression plan that gradually increases difficulty while preventing injury and burnout.

PROGRESSION PRINCIPLES:

By Fitness Level:
- Beginner: Focus on form first, very gradual progression (+1-2 reps/week)
- Intermediate: Moderate progression (+2-3 reps or +1 set/week)
- Advanced: Aggressive progression, may include deload week
- Athlete: Periodized approach with planned peaks

Weekly Structure:
- Week 1: Foundation - Establish baseline, focus on form
- Week 2: Building - Small increase in reps or intensity
- Week 3: Challenging - Push harder, increased volume
- Week 4: Options:
  - Beginner: Continue building
  - Intermediate: Slight deload or maintain
  - Advanced: Deload week (reduce volume 40-50%)

REQUIRED OUTPUT FORMAT:
{
  "progression": {
    "current_week": 1,
    "total_weeks": 4,
    "weekly_adjustments": [
      {
        "week": 1,
        "intensity": "foundation",
        "reps_modifier": 0,
        "sets_modifier": 0,
        "rest_modifier": 0,
        "focus": "Learn proper form, establish baseline",
        "tips": ["Focus on form over speed", "Don't push to failure"]
      },
      {
        "week": 2,
        "intensity": "building",
        "reps_modifier": 2,
        "sets_modifier": 0,
        "rest_modifier": 0,
        "focus": "Increase reps while maintaining form",
        "tips": ["Add 2 reps to each set", "Maintain quality"]
      },
      {
        "week": 3,
        "intensity": "challenging",
        "reps_modifier": 2,
        "sets_modifier": 1,
        "rest_modifier": -5,
        "focus": "Push your limits, add a set",
        "tips": ["This week is meant to challenge you", "Rest if needed"]
      },
      {
        "week": 4,
        "intensity": "peak",
        "reps_modifier": 4,
        "sets_modifier": 1,
        "rest_modifier": -10,
        "focus": "Peak performance week",
        "tips": ["Give it your all", "Celebrate your progress"]
      }
    ],
    "weekly_focus": "Focus on building consistency and proper form"
  }
}

Modifiers explanation:
- reps_modifier: Add this many reps to each set (can be negative for deload)
- sets_modifier: Add this many sets to each exercise (can be negative for deload)
- rest_modifier: Adjust rest time in seconds (negative = less rest = harder)"""

    def build_user_prompt(self, context: Dict[str, Any]) -> str:
        """Build the prompt for progression planning."""

        goal = context.get("goal", {})
        user_profile = context.get("user_profile", {})
        settings = context.get("settings", {})
        selected_exercises = context.get("selected_exercises", [])

        # Check if this is a challenge with specific duration
        goal_type = goal.get("goal_type", "habit")
        challenge_duration = goal.get("challenge_duration_days")

        prompt = f"""Create a 4-week progression plan for this workout:

GOAL:
- Title: {goal.get("title", "Workout")}
- Type: {goal_type}
- Primary Goal: {user_profile.get("primary_goal", "general_fitness")}
{f"- Challenge Duration: {challenge_duration} days" if challenge_duration else ""}

USER PROFILE:
- Fitness Level: {user_profile.get("fitness_level", "beginner")}
- Current Exercise Frequency: {user_profile.get("current_frequency", "never")}
- Biggest Challenge: {user_profile.get("biggest_challenge", "staying_consistent")}

CURRENT WORKOUT BASELINE:
- Default sets per exercise: {settings.get("default_sets", 3)}
- Exercises in workout: {len(selected_exercises)}

Design a 4-week progression that:
1. Starts at an appropriate level for a {user_profile.get("fitness_level", "beginner")}
2. Gradually increases difficulty without causing burnout
3. Addresses their challenge of: {user_profile.get("biggest_challenge", "staying_consistent")}
4. Includes weekly focus areas and tips

{"For a beginner, be very conservative with progression. Focus on consistency over intensity." if user_profile.get("fitness_level") == "beginner" else ""}

Return the progression plan in the JSON format specified."""

        return prompt

    def validate_output(self, output: Dict[str, Any]) -> bool:
        """Validate the progression plan output."""

        if not output:
            return False

        # Check for progression section
        progression = output.get("progression", {})
        if not progression or not isinstance(progression, dict):
            logger.warning("ProgressionAgent: No progression in output")
            return False

        # Check for weekly_adjustments
        weekly_adjustments = progression.get("weekly_adjustments", [])
        if not weekly_adjustments or not isinstance(weekly_adjustments, list):
            logger.warning("ProgressionAgent: No weekly_adjustments")
            return False

        # Should have at least 4 weeks
        if len(weekly_adjustments) < 4:
            logger.warning(
                f"ProgressionAgent: Only {len(weekly_adjustments)} weeks, need 4"
            )
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
                            "Watch the demo GIFs before each exercise",
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
