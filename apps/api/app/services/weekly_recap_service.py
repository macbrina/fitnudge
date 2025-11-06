"""
Weekly Recap Service

Generates AI-powered weekly progress summaries for users.
"""

from typing import Dict, Any, Optional, List
from datetime import date, timedelta, datetime
from app.core.database import get_supabase_client
from app.services.logger import logger
from app.services.openai_service import OpenAIService


class WeeklyRecapService:
    """Service for generating weekly recaps"""

    def __init__(self):
        self.openai_service = OpenAIService()

    async def generate_weekly_recap(
        self, user_id: str, goal_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a weekly recap for a user.

        Args:
            user_id: User ID
            goal_id: Optional goal ID to focus recap on specific goal

        Returns:
            Recap data with insights, stats, and motivation
        """
        supabase = get_supabase_client()

        try:
            # Get date range for last week
            today = date.today()
            week_start = today - timedelta(days=7)
            week_end = today

            # Get check-ins for the week
            query = (
                supabase.table("check_ins")
                .select("*")
                .eq("user_id", user_id)
                .eq("completed", True)
                .gte("date", week_start.isoformat())
                .lte("date", week_end.isoformat())
            )

            if goal_id:
                query = query.eq("goal_id", goal_id)

            check_ins_result = query.execute()
            check_ins = check_ins_result.data or []

            # Get goal information
            if goal_id:
                goal_result = (
                    supabase.table("goals")
                    .select("*")
                    .eq("id", goal_id)
                    .eq("user_id", user_id)
                    .single()
                    .execute()
                )
                goal = goal_result.data if goal_result.data else None
            else:
                # Get active goal
                goal_result = (
                    supabase.table("goals")
                    .select("*")
                    .eq("user_id", user_id)
                    .eq("is_active", True)
                    .limit(1)
                    .execute()
                )
                goal = goal_result.data[0] if goal_result.data else None

            if not goal:
                logger.warning(f"No active goal found for user {user_id}")
                return None

            # Calculate statistics
            stats = self._calculate_stats(check_ins, week_start, week_end)

            # Get user profile for personalization
            profile_result = (
                supabase.table("user_fitness_profiles")
                .select("*")
                .eq("user_id", user_id)
                .single()
                .execute()
            )
            user_profile = profile_result.data if profile_result.data else None

            # Generate AI recap
            recap_text = await self._generate_ai_recap(
                goal, check_ins, stats, user_profile, week_start, week_end
            )

            recap = {
                "week_start": week_start.isoformat(),
                "week_end": week_end.isoformat(),
                "goal_id": goal["id"],
                "goal_title": goal["title"],
                "stats": stats,
                "recap_text": recap_text,
                "generated_at": datetime.now().isoformat(),
            }

            logger.info(
                f"Generated weekly recap for user {user_id}",
                {
                    "user_id": user_id,
                    "goal_id": goal_id,
                    "check_in_count": stats["completed_check_ins"],
                },
            )

            return recap

        except Exception as e:
            logger.error(
                f"Failed to generate weekly recap for user {user_id}",
                {"error": str(e), "user_id": user_id, "goal_id": goal_id},
            )
            return None

    def _calculate_stats(
        self, check_ins: List[Dict[str, Any]], week_start: date, week_end: date
    ) -> Dict[str, Any]:
        """Calculate weekly statistics"""
        # Count completed check-ins
        completed_count = len(check_ins)

        # Calculate current streak
        current_streak = self._calculate_streak(check_ins, week_end)

        # Calculate average mood
        moods = [c.get("mood") for c in check_ins if c.get("mood") is not None]
        average_mood = sum(moods) / len(moods) if moods else None

        # Count days with check-ins
        days_with_checkins = len(
            set(
                (
                    c["date"]
                    if isinstance(c["date"], date)
                    else date.fromisoformat(str(c["date"]))
                )
                for c in check_ins
            )
        )

        # Get longest streak in the week
        longest_streak = self._calculate_longest_streak(check_ins)

        return {
            "completed_check_ins": completed_count,
            "days_with_checkins": days_with_checkins,
            "current_streak": current_streak,
            "longest_streak": longest_streak,
            "average_mood": round(average_mood, 2) if average_mood else None,
            "completion_rate": round(
                (completed_count / 7) * 100, 1
            ),  # Assuming 7-day week
        }

    def _calculate_streak(self, check_ins: List[Dict[str, Any]], end_date: date) -> int:
        """Calculate current streak ending on end_date"""
        if not check_ins:
            return 0

        sorted_check_ins = sorted(
            check_ins,
            key=lambda x: (
                x["date"]
                if isinstance(x["date"], date)
                else date.fromisoformat(str(x["date"]))
            ),
            reverse=True,
        )

        streak = 0
        current_date = end_date

        for check_in in sorted_check_ins:
            check_in_date = (
                check_in["date"]
                if isinstance(check_in["date"], date)
                else date.fromisoformat(str(check_in["date"]))
            )

            if check_in_date == current_date:
                streak += 1
                current_date -= timedelta(days=1)
            elif check_in_date < current_date:
                break

        return streak

    def _calculate_longest_streak(self, check_ins: List[Dict[str, Any]]) -> int:
        """Calculate longest consecutive streak in check-ins"""
        if not check_ins:
            return 0

        sorted_dates = sorted(
            [
                (
                    c["date"]
                    if isinstance(c["date"], date)
                    else date.fromisoformat(str(c["date"]))
                )
                for c in check_ins
            ]
        )

        if not sorted_dates:
            return 0

        longest = 1
        current = 1

        for i in range(1, len(sorted_dates)):
            if sorted_dates[i] - sorted_dates[i - 1] == timedelta(days=1):
                current += 1
                longest = max(longest, current)
            else:
                current = 1

        return longest

    async def _generate_ai_recap(
        self,
        goal: Dict[str, Any],
        check_ins: List[Dict[str, Any]],
        stats: Dict[str, Any],
        user_profile: Optional[Dict[str, Any]],
        week_start: date,
        week_end: date,
    ) -> str:
        """
        Generate AI-powered recap text.

        Args:
            goal: Goal data
            check_ins: List of check-ins for the week
            stats: Calculated statistics
            user_profile: Optional user profile
            week_start: Week start date
            week_end: Week end date

        Returns:
            Generated recap text
        """
        # Build prompt for AI
        prompt = f"""Generate a friendly, motivating weekly recap for a fitness accountability app user.

USER'S GOAL: {goal.get('title', 'Unknown')}
GOAL DESCRIPTION: {goal.get('description', 'No description')}

WEEKLY STATS (Week of {week_start.strftime('%B %d')} - {week_end.strftime('%B %d, %Y')}):
- Completed {stats['completed_check_ins']} check-ins
- Active {stats['days_with_checkins']} out of 7 days
- Current streak: {stats['current_streak']} days
- Longest streak this week: {stats['longest_streak']} days
- Completion rate: {stats['completion_rate']}%
"""

        if stats.get("average_mood"):
            prompt += f"- Average mood: {stats['average_mood']}/5\n"

        if user_profile:
            motivation_style = user_profile.get("motivation_style", "friendly")
            biggest_challenge = user_profile.get("biggest_challenge", "")
            prompt += f"\nUSER CONTEXT:\n"
            prompt += f"- Motivation style: {motivation_style}\n"
            prompt += f"- Biggest challenge: {biggest_challenge}\n"

        prompt += f"""
INSTRUCTIONS:
1. Write in a {user_profile.get('motivation_style', 'friendly') if user_profile else 'friendly'} tone
2. Celebrate their wins and progress
3. Address their completion rate ({stats['completion_rate']}%) constructively
4. If streak is {stats['current_streak']}, highlight the momentum
5. Provide 1-2 actionable insights or tips
6. Keep it encouraging and motivating
7. Be concise (2-3 paragraphs max)

Generate the recap now:"""

        try:
            # Use OpenAI to generate recap
            import asyncio

            response = await asyncio.wait_for(
                self.openai_service.client.responses.create(
                    model="gpt-5-mini",
                    input=prompt,
                    reasoning={"effort": "low"},
                ),
                timeout=20.0,
            )

            # Extract text from response
            recap_text = ""
            for item in response.output:
                if hasattr(item, "content"):
                    if hasattr(item, "type") and item.type == "reasoning":
                        continue
                    for content_part in item.content:
                        if hasattr(content_part, "text"):
                            recap_text += content_part.text
                        elif hasattr(content_part, "content") and content_part.content:
                            for nested in content_part.content:
                                if hasattr(nested, "text"):
                                    recap_text += nested.text

            return recap_text.strip()

        except Exception as e:
            logger.error(
                f"Failed to generate AI recap: {e}",
                {"error": str(e)},
            )
            # Fallback to basic recap
            return self._generate_fallback_recap(goal, stats)

    def _generate_fallback_recap(
        self, goal: Dict[str, Any], stats: Dict[str, Any]
    ) -> str:
        """Generate a basic fallback recap if AI fails"""
        goal_title = goal.get("title", "your goal")
        completed = stats.get("completed_check_ins", 0)
        streak = stats.get("current_streak", 0)

        recap = f"Great work this week on {goal_title}! "

        if completed >= 5:
            recap += (
                f"You completed {completed} check-ins - that's amazing consistency! "
            )
        elif completed >= 3:
            recap += f"You completed {completed} check-ins - keep it up! "
        else:
            recap += f"You completed {completed} check-ins. Every step counts! "

        if streak >= 3:
            recap += f"You're on a {streak}-day streak - incredible momentum! "
        elif streak > 0:
            recap += f"You have a {streak}-day streak going - keep building on it! "

        recap += "Keep showing up and remember why you started. You've got this!"

        return recap


# Global instance
weekly_recap_service = WeeklyRecapService()
