"""
Orchestrator Agent for Multi-Agent Workout Plan Generation

Coordinates all specialized agents and assembles the final workout plan:
1. Exercise Selector Agent - Picks main workout exercises
2. Timing Calculator Agent - Calculates work/rest durations
3. Warmup/Cooldown Agent - Generates warm-up and cool-down routines
4. Progression Agent - Creates weekly progression schedule
"""

import asyncio
from typing import Dict, Any, Optional, List
from app.services.agents.base import BaseAgent
from app.services.logger import logger


class OrchestratorAgent:
    """
    Orchestrates multiple specialized agents to generate a complete workout plan.

    The orchestrator:
    1. Receives the goal and user profile context
    2. Coordinates parallel execution of independent agents
    3. Passes data between dependent agents
    4. Assembles the final structured workout plan
    """

    def __init__(self):
        # Lazy import to avoid circular imports
        from app.services.agents.exercise_selector_agent import ExerciseSelectorAgent
        from app.services.agents.timing_calculator_agent import TimingCalculatorAgent
        from app.services.agents.warmup_cooldown_agent import WarmupCooldownAgent
        from app.services.agents.progression_agent import ProgressionAgent
        from app.services.agents.evaluator_agent import EvaluatorAgent

        self.exercise_selector = ExerciseSelectorAgent()
        self.timing_calculator = TimingCalculatorAgent()
        self.warmup_cooldown = WarmupCooldownAgent()
        self.progression = ProgressionAgent()
        self.evaluator = EvaluatorAgent()

    async def generate_workout_plan(
        self,
        goal: Dict[str, Any],
        user_profile: Optional[Dict[str, Any]] = None,
        available_exercises: Optional[List[Dict[str, Any]]] = None,
        workout_feedback: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Generate a complete workout plan using multiple specialized agents.

        Args:
            goal: Goal dictionary with title, description, category, frequency, etc.
            user_profile: Optional user profile for personalization
            available_exercises: List of available exercises from database
            workout_feedback: User's past workout feedback to improve recommendations

        Returns:
            Complete workout plan structure with timing, progression, etc.
        """
        logger.info(
            "OrchestratorAgent starting workout plan generation",
            {"goal_id": goal.get("id"), "goal_title": goal.get("title")},
        )

        # Build base context for all agents
        context = self._build_context(
            goal, user_profile, available_exercises, workout_feedback
        )

        try:
            # Phase 1: Select exercises (must complete first)
            logger.info("Phase 1: Selecting exercises")
            selected_exercises = await self.exercise_selector.generate(context)

            # Add selected exercises to context for subsequent agents
            context["selected_exercises"] = selected_exercises.get("exercises", [])
            context["exercise_focus"] = selected_exercises.get("focus", {})

            # Phase 2: Run parallel agents (timing, warmup/cooldown, progression)
            logger.info(
                "Phase 2: Running parallel agents (timing, warmup, progression)"
            )

            timing_task = asyncio.create_task(self.timing_calculator.generate(context))
            warmup_task = asyncio.create_task(self.warmup_cooldown.generate(context))
            progression_task = asyncio.create_task(self.progression.generate(context))

            # Wait for all parallel tasks
            timing_result, warmup_result, progression_result = await asyncio.gather(
                timing_task, warmup_task, progression_task
            )

            # Phase 3: Assemble final plan
            logger.info("Phase 3: Assembling final workout plan")
            final_plan = self._assemble_plan(
                context=context,
                exercises=selected_exercises,
                timing=timing_result,
                warmup_cooldown=warmup_result,
                progression=progression_result,
            )

            # Phase 4: Validate and auto-fix with Evaluator Agent
            logger.info("Phase 4: Validating plan with Evaluator Agent")
            is_valid, validated_plan, errors = self.evaluator.validate_workout_plan(
                final_plan
            )

            if not is_valid:
                logger.warning(
                    "Evaluator found issues (auto-fixed where possible)",
                    {"errors": errors},
                )

            # Use the validated plan (with auto-fixes applied)
            final_plan = validated_plan

            logger.info(
                "OrchestratorAgent completed workout plan generation",
                {
                    "exercise_count": len(
                        final_plan.get("structure", {})
                        .get("main_workout", {})
                        .get("exercises", [])
                    ),
                    "total_duration": final_plan.get("structure", {}).get(
                        "total_duration_minutes", 0
                    ),
                    "validation_passed": is_valid,
                },
            )

            return final_plan

        except Exception as e:
            logger.error(
                f"OrchestratorAgent failed to generate plan: {str(e)}",
                {"goal_id": goal.get("id"), "error": str(e)},
            )
            # Return a basic fallback plan (also validated)
            fallback = self._create_fallback_plan(goal, user_profile)
            _, validated_fallback, _ = self.evaluator.validate_workout_plan(fallback)
            return validated_fallback

    def _build_context(
        self,
        goal: Dict[str, Any],
        user_profile: Optional[Dict[str, Any]],
        available_exercises: Optional[List[Dict[str, Any]]],
        workout_feedback: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Build the context dictionary for all agents."""
        from datetime import datetime

        # Extract user profile data with defaults
        profile = user_profile or {}

        # Calculate challenge duration from dates if not provided directly
        challenge_duration_days = goal.get("challenge_duration_days")
        if not challenge_duration_days:
            start_date = goal.get("challenge_start_date")
            end_date = goal.get("challenge_end_date")
            if start_date and end_date:
                try:
                    # Handle both string and date objects
                    if isinstance(start_date, str):
                        start = datetime.fromisoformat(
                            start_date.replace("Z", "+00:00").split("+")[0]
                        )
                    else:
                        start = start_date
                    if isinstance(end_date, str):
                        end = datetime.fromisoformat(
                            end_date.replace("Z", "+00:00").split("+")[0]
                        )
                    else:
                        end = end_date
                    challenge_duration_days = (end - start).days
                except (ValueError, TypeError) as e:
                    logger.warning(f"Failed to calculate challenge duration: {e}")
                    challenge_duration_days = None

        # Parse days_of_week - may be strings like ["0","1","2"] or ints [0,1,2]
        days_of_week_raw = goal.get("days_of_week", [])
        days_of_week = []
        if days_of_week_raw:
            try:
                days_of_week = [int(d) for d in days_of_week_raw]
            except (ValueError, TypeError):
                days_of_week = []

        context = {
            # Goal information
            "goal": {
                "id": goal.get("id"),
                "title": goal.get("title", ""),
                "description": goal.get("description", ""),
                "category": goal.get("category", "fitness"),
                "frequency": goal.get("frequency", "weekly"),
                "target_days": goal.get("target_days", 3),
                "goal_type": goal.get("goal_type", "habit"),
                "challenge_duration_days": challenge_duration_days,
                "days_of_week": days_of_week,
                "target_checkins": goal.get("target_checkins"),
                "challenge_start_date": goal.get("challenge_start_date"),
                "challenge_end_date": goal.get("challenge_end_date"),
            },
            # User profile information
            "user_profile": {
                "fitness_level": profile.get("fitness_level", "beginner"),
                "primary_goal": profile.get("primary_goal", "general_fitness"),
                "preferred_location": profile.get("preferred_location", "home"),
                "available_time": profile.get("available_time", "30-60min"),
                "current_frequency": profile.get("current_frequency", "never"),
                "motivation_style": profile.get(
                    "motivation_style", "gentle_encouragement"
                ),
                "biggest_challenge": profile.get(
                    "biggest_challenge", "staying_consistent"
                ),
            },
            # Available exercises (will be used by exercise selector)
            "available_exercises": available_exercises or [],
            # Derived settings
            "settings": self._derive_settings(goal, profile, days_of_week),
            # User's past workout feedback (used to avoid exercises they struggled with)
            "workout_feedback": self._process_workout_feedback(workout_feedback),
        }

        return context

    def _process_workout_feedback(
        self, feedback: Optional[List[Dict[str, Any]]]
    ) -> Dict[str, Any]:
        """
        Process workout feedback into actionable insights for AI agents.

        Aggregates feedback to identify patterns like:
        - Exercises that are too hard/easy
        - Exercises user doesn't know how to do
        - Overall difficulty preferences
        """
        if not feedback:
            return {"has_feedback": False, "insights": [], "avoid_exercises": []}

        # Count feedback reasons
        reason_counts = {}
        exercises_by_reason = {
            "too_hard": [],
            "too_easy": [],
            "dont_know_how": [],
        }

        for item in feedback:
            reason = item.get("quit_reason", "other")
            reason_counts[reason] = reason_counts.get(reason, 0) + 1

            # Track which exercises caused issues (if we have exercise info)
            exercise_name = item.get("exercise_name")
            if exercise_name and reason in exercises_by_reason:
                exercises_by_reason[reason].append(exercise_name)

        # Build insights
        insights = []

        if reason_counts.get("too_hard", 0) >= 2:
            insights.append(
                "User has struggled with workout difficulty - prefer easier exercises and longer rest periods"
            )

        if reason_counts.get("too_easy", 0) >= 2:
            insights.append(
                "User finds workouts too easy - increase intensity and reduce rest periods"
            )

        if reason_counts.get("dont_know_how", 0) >= 2:
            insights.append(
                "User struggles with exercise technique - prefer simpler, well-known exercises"
            )

        # Collect exercises to avoid (user couldn't do them or found too hard)
        avoid_exercises = list(
            set(exercises_by_reason["too_hard"] + exercises_by_reason["dont_know_how"])
        )

        return {
            "has_feedback": True,
            "total_feedback_count": len(feedback),
            "reason_counts": reason_counts,
            "insights": insights,
            "avoid_exercises": avoid_exercises,
            "prefers_harder": reason_counts.get("too_easy", 0)
            > reason_counts.get("too_hard", 0),
            "prefers_easier": reason_counts.get("too_hard", 0)
            > reason_counts.get("too_easy", 0),
        }

    def _derive_settings(
        self,
        goal: Dict[str, Any],
        profile: Dict[str, Any],
        days_of_week: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """Derive workout settings from goal and profile."""

        fitness_level = profile.get("fitness_level", "beginner")
        available_time = profile.get("available_time", "30-60min")
        preferred_location = profile.get("preferred_location", "home")

        # Use days_of_week from goal if provided, otherwise use target_days
        workout_days_per_week = (
            len(days_of_week) if days_of_week else goal.get("target_days", 3)
        )

        # Determine exercise count based on fitness level and time
        exercise_counts = {
            "beginner": {"less_30min": 4, "30-60min": 5, "1-2hrs": 6, "flexible": 6},
            "intermediate": {
                "less_30min": 5,
                "30-60min": 6,
                "1-2hrs": 7,
                "flexible": 7,
            },
            "advanced": {"less_30min": 5, "30-60min": 7, "1-2hrs": 8, "flexible": 8},
            "athlete": {"less_30min": 6, "30-60min": 8, "1-2hrs": 10, "flexible": 10},
        }

        exercise_count = exercise_counts.get(
            fitness_level, exercise_counts["beginner"]
        ).get(available_time, 5)

        # Determine sets based on fitness level
        sets_by_level = {
            "beginner": 2,
            "intermediate": 3,
            "advanced": 4,
            "athlete": 4,
        }
        default_sets = sets_by_level.get(fitness_level, 3)

        # Determine equipment availability based on location
        equipment_options = {
            "home": ["body weight", "dumbbell", "resistance band"],
            "gym": [
                "body weight",
                "barbell",
                "dumbbell",
                "cable",
                "machine",
                "kettlebell",
            ],
            "outdoor": ["body weight"],
            "mix": ["body weight", "dumbbell", "barbell"],
            "dont_know": ["body weight", "dumbbell"],
        }
        available_equipment = equipment_options.get(preferred_location, ["body weight"])

        # Duration settings
        duration_minutes = {
            "less_30min": 20,
            "30-60min": 35,
            "1-2hrs": 60,
            "flexible": 45,
        }
        target_duration = duration_minutes.get(available_time, 35)

        return {
            "exercise_count": exercise_count,
            "default_sets": default_sets,
            "available_equipment": available_equipment,
            "target_duration_minutes": target_duration,
            "fitness_level": fitness_level,
            "include_warmup": True,
            "include_cooldown": True,
            "warmup_duration_seconds": 300,  # 5 minutes
            "cooldown_duration_seconds": 300,  # 5 minutes
            "workout_days_per_week": workout_days_per_week,
            "days_of_week": days_of_week or [],
        }

    def _assemble_plan(
        self,
        context: Dict[str, Any],
        exercises: Dict[str, Any],
        timing: Dict[str, Any],
        warmup_cooldown: Dict[str, Any],
        progression: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Assemble all agent outputs into the final plan structure."""

        settings = context.get("settings", {})
        goal = context.get("goal", {})

        # Merge timing data into exercises
        exercise_list = exercises.get("exercises", [])
        timing_data = timing.get("exercise_timing", {})

        for exercise in exercise_list:
            exercise_id = exercise.get("exercise_id", "")
            if exercise_id in timing_data:
                exercise.update(timing_data[exercise_id])
            else:
                # Use default timing if not calculated
                exercise.setdefault("work_duration_seconds", 45)
                exercise.setdefault("rest_between_sets_seconds", 30)

        # Calculate total duration
        main_workout_duration = self._calculate_main_workout_duration(
            exercise_list, timing.get("rest_between_exercises_seconds", 60)
        )

        warmup_duration = warmup_cooldown.get("warm_up", {}).get(
            "duration_seconds", 300
        )
        cooldown_duration = warmup_cooldown.get("cool_down", {}).get(
            "duration_seconds", 300
        )
        total_duration_seconds = (
            main_workout_duration + warmup_duration + cooldown_duration
        )
        total_duration_minutes = round(total_duration_seconds / 60)

        # Build the final plan structure
        plan = {
            "plan_type": "workout_plan",
            "structure": {
                "total_duration_minutes": total_duration_minutes,
                "warm_up": warmup_cooldown.get(
                    "warm_up",
                    {
                        "duration_seconds": 300,
                        "description": "Light movement to prepare your body",
                        "exercises": [],
                    },
                ),
                "main_workout": {
                    "style": "traditional",
                    "rest_between_exercises_seconds": timing.get(
                        "rest_between_exercises_seconds", 60
                    ),
                    "exercises": exercise_list,
                },
                "cool_down": warmup_cooldown.get(
                    "cool_down",
                    {
                        "duration_seconds": 300,
                        "description": "Stretches to aid recovery",
                        "exercises": [],
                    },
                ),
                "progression": progression.get(
                    "progression",
                    {"current_week": 1, "total_weeks": 4, "weekly_adjustments": []},
                ),
                # Legacy fields for backward compatibility
                "routine": {
                    "exercises": exercise_list,
                    "duration_minutes": total_duration_minutes,
                    "rest_between_exercises": f"{timing.get('rest_between_exercises_seconds', 60)} seconds",
                    "warm_up": warmup_cooldown.get("warm_up", {}).get(
                        "description", "5 minutes light movement"
                    ),
                    "cool_down": warmup_cooldown.get("cool_down", {}).get(
                        "description", "5 minutes stretching"
                    ),
                },
                "schedule": {
                    "frequency": goal.get("frequency", "weekly"),
                    "days_per_week": goal.get("target_days", 3),
                    "days_of_week": self._format_days_of_week(
                        goal.get("days_of_week", []), goal.get("target_days", 3)
                    ),
                },
                "accountability": {
                    "check_in_after_workout": True,
                    "track_consistency": True,
                    "tracking_method": "daily_check_ins",
                },
            },
            "guidance": {
                "description": exercises.get(
                    "guidance_description",
                    f"A personalized {total_duration_minutes}-minute workout designed for your fitness level. "
                    "Follow along with the exercises, rest periods, and track your progress through check-ins.",
                ),
                "tips": exercises.get(
                    "tips",
                    [
                        "Focus on form over speed - quality reps matter more",
                        "Use the rest periods to catch your breath",
                        "Stay hydrated throughout your workout",
                        "Check in after your workout to track progress",
                    ],
                ),
                "weekly_focus": progression.get("progression", {}).get(
                    "weekly_focus", "Focus on learning proper form for each exercise"
                ),
            },
        }

        return plan

    def _calculate_main_workout_duration(
        self, exercises: List[Dict[str, Any]], rest_between_exercises: int
    ) -> int:
        """Calculate total main workout duration in seconds."""
        total = 0

        for exercise in exercises:
            sets = exercise.get("sets", 3)
            work_duration = exercise.get("work_duration_seconds", 45)
            rest_between_sets = exercise.get("rest_between_sets_seconds", 30)

            # Time for all sets + rest between sets (not after last set)
            exercise_time = (sets * work_duration) + ((sets - 1) * rest_between_sets)
            total += exercise_time

        # Add rest between exercises (not after last exercise)
        if len(exercises) > 1:
            total += (len(exercises) - 1) * rest_between_exercises

        return total

    def _get_suggested_days(self, target_days: int) -> List[str]:
        """Get suggested workout days based on target days per week."""
        day_suggestions = {
            1: ["Wednesday"],
            2: ["Monday", "Thursday"],
            3: ["Monday", "Wednesday", "Friday"],
            4: ["Monday", "Tuesday", "Thursday", "Friday"],
            5: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            6: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
            7: [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
            ],
        }
        return day_suggestions.get(target_days, ["Monday", "Wednesday", "Friday"])

    def _format_days_of_week(
        self, days_of_week: List[int], target_days: int
    ) -> List[str]:
        """
        Convert integer days (0=Sunday, 6=Saturday) to day names.
        Falls back to suggested days if days_of_week is empty.
        """
        if not days_of_week:
            return self._get_suggested_days(target_days)

        # Map integers to day names (0=Sunday, 1=Monday, ..., 6=Saturday)
        day_names = {
            0: "Sunday",
            1: "Monday",
            2: "Tuesday",
            3: "Wednesday",
            4: "Thursday",
            5: "Friday",
            6: "Saturday",
        }

        return [day_names.get(d, "Monday") for d in sorted(days_of_week)]

    def _create_fallback_plan(
        self, goal: Dict[str, Any], user_profile: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Create a basic fallback plan when agent coordination fails."""

        title = goal.get("title", "Your Workout")
        target_days = goal.get("target_days", 3)

        return {
            "plan_type": "workout_plan",
            "structure": {
                "total_duration_minutes": 30,
                "warm_up": {
                    "duration_seconds": 300,
                    "description": "5 minutes of light movement to prepare your body",
                    "exercises": [],
                },
                "main_workout": {
                    "style": "traditional",
                    "rest_between_exercises_seconds": 60,
                    "exercises": [],
                },
                "cool_down": {
                    "duration_seconds": 300,
                    "description": "5 minutes of stretching to aid recovery",
                    "exercises": [],
                },
                "progression": {
                    "current_week": 1,
                    "total_weeks": 4,
                    "weekly_adjustments": [],
                },
                "routine": {
                    "exercises": [],
                    "duration_minutes": 30,
                    "rest_between_exercises": "60 seconds",
                    "warm_up": "5 minutes light movement",
                    "cool_down": "5 minutes stretching",
                },
                "schedule": {
                    "frequency": goal.get("frequency", "weekly"),
                    "days_per_week": target_days,
                    "days_of_week": self._get_suggested_days(target_days),
                },
                "accountability": {
                    "check_in_after_workout": True,
                    "track_consistency": True,
                    "tracking_method": "daily_check_ins",
                },
            },
            "guidance": {
                "description": f"Workout plan for: {title}. Focus on consistency through regular check-ins.",
                "tips": [
                    "Start with what feels comfortable",
                    "Focus on form over speed",
                    "Stay hydrated during workouts",
                    "Check in after each workout to track progress",
                ],
            },
        }
