"""
Multi-Agent System for Workout Plan Generation

This module provides a multi-agent architecture for generating
detailed, interactive workout plans with timing, progression,
warm-up/cool-down routines, and exercise selection.

Includes an Evaluator Agent that validates all outputs and auto-fixes
missing data (like gif_urls) by fetching from the database.
"""

from app.services.agents.base import BaseAgent
from app.services.agents.orchestrator_agent import OrchestratorAgent
from app.services.agents.exercise_selector_agent import ExerciseSelectorAgent
from app.services.agents.timing_calculator_agent import TimingCalculatorAgent
from app.services.agents.warmup_cooldown_agent import WarmupCooldownAgent
from app.services.agents.progression_agent import ProgressionAgent
from app.services.agents.evaluator_agent import EvaluatorAgent

__all__ = [
    "BaseAgent",
    "OrchestratorAgent",
    "ExerciseSelectorAgent",
    "TimingCalculatorAgent",
    "WarmupCooldownAgent",
    "ProgressionAgent",
    "EvaluatorAgent",
]
