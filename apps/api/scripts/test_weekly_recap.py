"""
Test script for weekly recap service.

Usage:
    cd apps/api
    poetry run python scripts/test_weekly_recap.py

Update USER_ID below before running.
"""

import asyncio
from app.services.weekly_recap_service import weekly_recap_service

# ============================================
# UPDATE THIS WITH YOUR USER ID
# ============================================
USER_ID = "6e0d36c2-fbde-41e4-b381-a92b711986fc"


async def test():
    print(f"\n🔄 Generating weekly recap for user: {USER_ID}\n")

    recap = await weekly_recap_service.get_weekly_recap(
        user_id=USER_ID,
        force_regenerate=True,  # Skip cache, generate fresh
    )

    if recap:
        print("✅ Weekly recap generated successfully!\n")
        print(f"Week: {recap.get('week_start')} to {recap.get('week_end')}")
        print(f"Goals Hit: {recap.get('goals_hit')}/{recap.get('goals_total')}")
        print(f"Consistency: {recap.get('consistency_percent')}%")
        print(f"\n📝 Summary: {recap.get('summary')}")
        print(f"🏆 Win: {recap.get('win')}")
        print(f"💡 Insight: {recap.get('insight')}")
        print(f"🎯 Focus Next Week: {recap.get('focus_next_week')}")
        print(f"\n📊 Full recap data:")
        print(recap)
    else:
        print("❌ Failed to generate recap. Check:")
        print("  - User has active goals")
        print("  - User has check-ins for this week")


if __name__ == "__main__":
    asyncio.run(test())
