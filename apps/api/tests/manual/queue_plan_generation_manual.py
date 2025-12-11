"""
Manual script to enqueue the plan generation task for an existing goal.

Usage:
    poetry run python apps/api/tests/manual/queue_plan_generation_manual.py \
        --goal-id 5570c90e-e466-4dcb-8bdc-b1481149f658 \
        --user-id bfd7a276-93e6-4eb9-b3e0-168daa8feb51

If no arguments are provided, the script defaults to the payload captured in the
debug log for goal 5570c90e-e466-4dcb-8bdc-b1481149f658.
"""

import argparse
import asyncio
import json
from datetime import datetime
from typing import Any, Dict

from app.services.task_queue import task_queue
from app.services.logger import logger


DEFAULT_GOAL_DATA: Dict[str, Any] = {
    "id": "5570c90e-e466-4dcb-8bdc-b1481149f658",
    "title": "Beginner 3x-Weekly Strength Launch — 25-Min Circuits",
    "description": (
        "Three times a week you’ll commit to a 25-minute full-body strength circuit "
        "that’s simple, progressive, and home-friendly. Each session focuses on "
        "fundamental moves with clear progression steps so you always know the next "
        "move. Use daily check-ins on workout days, watch your streaks build in the "
        "progress view, and get direct, no-nonsense AI motivation after missed "
        "sessions to push you back into action."
    ),
    "category": "fitness",
    "frequency": "weekly",
    "target_days": 3,
}

DEFAULT_USER_PROFILE: Dict[str, Any] = {
    "id": "799bd8d9-5d5c-4bf3-b047-2c8ddbdf764f",
    "user_id": "bfd7a276-93e6-4eb9-b3e0-168daa8feb51",
    "fitness_level": "beginner",
    "primary_goal": "lose_weight",
    "current_frequency": "never",
    "preferred_location": "home",
    "available_time": "less_30min",
    "motivation_style": "tough_love",
    "biggest_challenge": "lack_of_motivation",
    "completed_at": "2025-11-09T17:02:06.845106+00:00",
    "created_at": "2025-11-09T17:02:06.845106+00:00",
    "updated_at": "2025-11-09T17:05:14.266247+00:00",
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Manually queue plan generation for an existing goal"
    )
    parser.add_argument("--goal-id", default=DEFAULT_GOAL_DATA["id"])
    parser.add_argument("--user-id", default=DEFAULT_USER_PROFILE["user_id"])
    parser.add_argument("--title", default=DEFAULT_GOAL_DATA["title"])
    parser.add_argument("--category", default=DEFAULT_GOAL_DATA["category"])
    parser.add_argument("--frequency", default=DEFAULT_GOAL_DATA["frequency"])
    parser.add_argument(
        "--target-days", type=int, default=DEFAULT_GOAL_DATA["target_days"]
    )
    parser.add_argument(
        "--description",
        default=DEFAULT_GOAL_DATA["description"],
    )
    parser.add_argument(
        "--use-profile",
        action="store_true",
        help="Include the default user fitness profile in the task payload",
    )
    return parser


async def main() -> None:
    args = build_parser().parse_args()

    goal_id = args.goal_id

    goal_payload = {
        "id": goal_id,
        "title": args.title,
        "description": args.description,
        "category": args.category,
        "frequency": args.frequency,
        "target_days": args.target_days,
    }

    user_profile = DEFAULT_USER_PROFILE if args.use_profile else None

    debug_payload = {
        "timestamp": datetime.utcnow().isoformat(),
        "goal_id": goal_id,
        "goal_data": goal_payload,
        "user_profile": user_profile,
    }

    print("=== Queueing plan generation with payload ===")
    print(json.dumps(debug_payload, indent=2, default=str))

    try:
        success = await task_queue.queue_plan_generation(
            goal_id=goal_id,
            goal_data=goal_payload,
            user_profile=user_profile,
        )
    except Exception as exc:  # pylint: disable=broad-except
        print("❌ queue_plan_generation raised an exception:")
        print(repr(exc))
        return

    if success:
        print("\n✅ Task queued successfully.")
    else:
        print("\n⚠️ Task queueing returned False. Check logs for more details.")


if __name__ == "__main__":
    logger.setLevel("DEBUG")
    asyncio.run(main())
