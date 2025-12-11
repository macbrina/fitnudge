"""
Manual script to invoke the goals.create_goal endpoint directly.

Usage:
    poetry run python apps/api/tests/manual/create_goal_manual.py \ 
        --user-id <UUID> \
        --plan free \
        --title "Beginner 3x-Weekly Strength Launch — 25-Min Circuits"

If no arguments are provided the script uses the payload captured from the
debug logs during manual testing.
"""

import argparse
import asyncio
import json
from datetime import datetime

from app.api.v1.endpoints.goals import GoalCreate, create_goal


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Manually invoke create_goal")
    parser.add_argument("--user-id", default="bfd7a276-93e6-4eb9-b3e0-168daa8feb51")
    parser.add_argument("--plan", default="free")
    parser.add_argument(
        "--title",
        default="Beginner 3x-Weekly Strength Launch — 25-Min Circuits",
    )
    parser.add_argument(
        "--description",
        default=(
            "Three times a week you’ll commit to a 25-minute full-body strength "
            "circuit that’s simple, progressive, and home-friendly. Each session "
            "focuses on fundamental moves with clear progression steps so you "
            "always know the next move. Use daily check-ins on workout days, watch "
            "your streaks build in the progress view, and get direct, no-nonsense "
            "AI motivation after missed sessions to push you back into action."
        ),
    )
    parser.add_argument("--category", default="fitness")
    parser.add_argument("--frequency", default="weekly")
    parser.add_argument("--target-days", type=int, default=3)
    return parser


async def main() -> None:
    args = build_parser().parse_args()

    goal_payload = GoalCreate(
        title=args.title,
        description=args.description,
        category=args.category,
        frequency=args.frequency,
        target_days=args.target_days,
        reminder_times=[],
    )

    current_user = {
        "id": args.user_id,
        "plan": args.plan,
    }

    print("=== Calling create_goal with payload ===")
    print(
        json.dumps(
            {
                "current_user": current_user,
                "goal_payload": goal_payload.dict(),
                "timestamp": datetime.utcnow().isoformat(),
            },
            indent=2,
        )
    )

    try:
        result = await create_goal(goal_payload, current_user=current_user)
    except Exception as exc:  # pylint: disable=broad-except
        print("❌ create_goal raised an exception:")
        print(repr(exc))
        return

    print("\n✅ Goal created successfully:")
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(main())
