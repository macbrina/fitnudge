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

            # =========================================
            # 1. Get goal check-ins for the week
            # =========================================
            query = (
                supabase.table("check_ins")
                .select("*")
                .eq("user_id", user_id)
                .eq("completed", True)
                .gte("check_in_date", week_start.isoformat())
                .lte("check_in_date", week_end.isoformat())
            )

            if goal_id:
                query = query.eq("goal_id", goal_id)

            check_ins_result = query.execute()
            goal_check_ins = check_ins_result.data or []

            # =========================================
            # 2. Get challenge check-ins for the week (completed only)
            # =========================================
            challenge_check_ins = []
            try:
                challenge_checkins_result = (
                    supabase.table("challenge_check_ins")
                    .select("*")
                    .eq("user_id", user_id)
                    .eq("completed", True)
                    .gte("check_in_date", week_start.isoformat())
                    .lte("check_in_date", week_end.isoformat())
                    .execute()
                )
                challenge_check_ins = challenge_checkins_result.data or []
            except Exception:
                pass

            # =========================================
            # 3. Get active personal goals
            # =========================================
            if goal_id:
                goal_result = (
                    supabase.table("goals")
                    .select("*")
                    .eq("id", goal_id)
                    .eq("user_id", user_id)
                    .maybe_single()
                    .execute()
                )
                goal = goal_result.data if goal_result.data else None
                personal_goals = [goal] if goal else []
            else:
                goal_result = (
                    supabase.table("goals")
                    .select("*")
                    .eq("user_id", user_id)
                    .eq("status", "active")
                    .execute()
                )
                personal_goals = goal_result.data or []
                goal = personal_goals[0] if personal_goals else None

            # =========================================
            # 4. Get active challenges
            # =========================================
            active_challenges = []
            try:
                participant_result = (
                    supabase.table("challenge_participants")
                    .select(
                        "challenges(id, title, description, start_date, end_date, status)"
                    )
                    .eq("user_id", user_id)
                    .execute()
                )
                for p in participant_result.data or []:
                    challenge = p.get("challenges")
                    if not challenge or challenge.get("status") not in (
                        "upcoming",
                        "active",
                    ):
                        continue
                    start_date_c = (
                        date.fromisoformat(challenge["start_date"])
                        if challenge.get("start_date")
                        else None
                    )
                    end_date_c = (
                        date.fromisoformat(challenge["end_date"])
                        if challenge.get("end_date")
                        else None
                    )
                    if start_date_c and today < start_date_c:
                        continue
                    if end_date_c and today > end_date_c:
                        continue
                    active_challenges.append(challenge)
            except Exception:
                pass

            if not goal and not active_challenges:
                logger.warning(
                    f"No active goals or challenges found for user {user_id}"
                )
                return None

            # =========================================
            # 5. Calculate combined statistics
            # =========================================
            # Combine check-in dates for streak calculation
            all_checkin_dates: set[str] = set()
            for c in goal_check_ins:
                all_checkin_dates.add(c["check_in_date"])
            for c in challenge_check_ins:
                all_checkin_dates.add(c["check_in_date"])

            # Get goal_id for cache optimization
            current_goal_id = goal.get("id") if goal else None
            stats = self._calculate_stats(
                goal_check_ins, week_start, week_end, current_goal_id, None, user_id
            )
            # Add challenge stats
            stats["challenge_check_ins"] = len(challenge_check_ins)
            stats["total_check_ins"] = stats["completed_check_ins"] + len(
                challenge_check_ins
            )

            # Get aggregated challenge stats from cache
            challenge_stats = self._get_aggregated_challenge_stats(
                user_id, [c["id"] for c in active_challenges]
            )
            stats["challenge_current_streak"] = challenge_stats.get("current_streak", 0)
            stats["challenge_longest_streak"] = challenge_stats.get("longest_streak", 0)
            stats["challenge_total_points"] = challenge_stats.get("total_points", 0)

            # Recalculate streak from combined dates
            stats["current_streak"] = self._calculate_combined_streak(
                all_checkin_dates, week_end
            )

            # =========================================
            # 6. Get user profile for personalization
            # =========================================
            profile_result = (
                supabase.table("user_fitness_profiles")
                .select("*")
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )
            user_profile = profile_result.data if profile_result.data else None

            # =========================================
            # 7. Generate AI recap with full context
            # =========================================
            recap_text = await self._generate_ai_recap(
                goal=goal,
                personal_goals=personal_goals,
                active_challenges=active_challenges,
                goal_check_ins=goal_check_ins,
                challenge_check_ins=challenge_check_ins,
                stats=stats,
                user_profile=user_profile,
                week_start=week_start,
                week_end=week_end,
            )

            recap = {
                "week_start": week_start.isoformat(),
                "week_end": week_end.isoformat(),
                "goal_id": goal["id"] if goal else None,
                "goal_title": goal["title"] if goal else "Multiple Activities",
                "stats": stats,
                "recap_text": recap_text,
                "generated_at": datetime.now().isoformat(),
            }

            print(
                f"Generated weekly recap for user {user_id}",
                {
                    "user_id": user_id,
                    "goal_id": goal_id,
                    "goal_check_ins": stats["completed_check_ins"],
                    "challenge_check_ins": stats["challenge_check_ins"],
                    "challenges": len(active_challenges),
                },
            )

            return recap

        except Exception as e:
            logger.error(
                f"Failed to generate weekly recap for user {user_id}",
                {"error": str(e), "user_id": user_id, "goal_id": goal_id},
            )
            return None

    def _calculate_combined_streak(
        self, checkin_dates: set[str], end_date: date
    ) -> int:
        """Calculate streak from combined goal and challenge check-in dates"""
        if not checkin_dates:
            return 0

        streak = 0
        check_date = end_date

        while check_date.isoformat() in checkin_dates:
            streak += 1
            check_date = check_date - timedelta(days=1)

        # If today not checked, check if streak continues from yesterday
        if streak == 0:
            check_date = end_date - timedelta(days=1)
            while check_date.isoformat() in checkin_dates:
                streak += 1
                check_date = check_date - timedelta(days=1)

        return streak

    def _get_aggregated_challenge_stats(
        self, user_id: str, challenge_ids: List[str]
    ) -> Dict[str, Any]:
        """Get aggregated challenge statistics from challenge_statistics cache

        Args:
            user_id: User ID
            challenge_ids: List of challenge IDs to aggregate stats for

        Returns:
            Aggregated stats including best streak, total points
        """
        from app.core.database import get_supabase_client

        result = {
            "current_streak": 0,
            "longest_streak": 0,
            "total_points": 0,
            "total_checkins": 0,
        }

        if not challenge_ids:
            return result

        try:
            supabase = get_supabase_client()
            stats_result = (
                supabase.table("challenge_statistics")
                .select("current_streak, longest_streak, points, total_checkins")
                .eq("user_id", user_id)
                .in_("challenge_id", challenge_ids)
                .execute()
            )

            if stats_result.data:
                # Aggregate: best current streak, best longest streak, sum of points/checkins
                for stat in stats_result.data:
                    result["current_streak"] = max(
                        result["current_streak"], stat.get("current_streak", 0)
                    )
                    result["longest_streak"] = max(
                        result["longest_streak"], stat.get("longest_streak", 0)
                    )
                    result["total_points"] += stat.get("points", 0)
                    result["total_checkins"] += stat.get("total_checkins", 0)

        except Exception as e:
            logger.warning(f"Failed to get aggregated challenge stats: {e}")

        return result

    def _calculate_stats(
        self,
        check_ins: List[Dict[str, Any]],
        week_start: date,
        week_end: date,
        goal_id: str = None,
        challenge_id: str = None,
        user_id: str = None,
    ) -> Dict[str, Any]:
        """Calculate weekly statistics

        Args:
            check_ins: List of check-in records
            week_start: Start date of the week
            week_end: End date of the week
            goal_id: Optional goal ID for using cached goal_statistics
            challenge_id: Optional challenge ID for using cached challenge_statistics
            user_id: Optional user ID for challenge_statistics lookup
        """
        # Count completed check-ins
        completed_count = len(check_ins)

        # Calculate current streak (uses cache if goal_id or challenge_id provided and end_date is today)
        current_streak = self._calculate_streak(
            check_ins, week_end, goal_id, challenge_id, user_id
        )

        # Calculate average mood
        moods = [c.get("mood") for c in check_ins if c.get("mood") is not None]
        average_mood = sum(moods) / len(moods) if moods else None

        # Count days with check-ins
        days_with_checkins = len(
            set(
                (
                    c["check_in_date"]
                    if isinstance(c["check_in_date"], date)
                    else date.fromisoformat(str(c["check_in_date"]))
                )
                for c in check_ins
            )
        )

        # Get longest streak in the week (uses cache if goal_id or challenge_id provided)
        longest_streak = self._calculate_longest_streak(
            check_ins, goal_id, challenge_id, user_id
        )

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

    def _calculate_streak(
        self,
        check_ins: List[Dict[str, Any]],
        end_date: date,
        goal_id: str = None,
        challenge_id: str = None,
        user_id: str = None,
    ) -> int:
        """Calculate current streak ending on end_date

        If goal_id is provided and end_date is today, use cached goal_statistics
        If challenge_id and user_id are provided and end_date is today, use cached challenge_statistics
        """
        from app.core.database import get_supabase_client

        # Optimization: Use cached goal_statistics if available and end_date is today
        if goal_id and end_date == date.today():
            try:
                supabase = get_supabase_client()
                stats_result = (
                    supabase.table("goal_statistics")
                    .select("current_streak")
                    .eq("goal_id", goal_id)
                    .maybe_single()
                    .execute()
                )
                if stats_result.data:
                    return stats_result.data.get("current_streak", 0)
            except Exception:
                pass  # Fall back to calculation

        # Optimization: Use cached challenge_statistics if available and end_date is today
        if challenge_id and user_id and end_date == date.today():
            try:
                supabase = get_supabase_client()
                stats_result = (
                    supabase.table("challenge_statistics")
                    .select("current_streak")
                    .eq("challenge_id", challenge_id)
                    .eq("user_id", user_id)
                    .maybe_single()
                    .execute()
                )
                if stats_result.data:
                    return stats_result.data.get("current_streak", 0)
            except Exception:
                pass  # Fall back to calculation

        if not check_ins:
            return 0

        sorted_check_ins = sorted(
            check_ins,
            key=lambda x: (
                x["check_in_date"]
                if isinstance(x["check_in_date"], date)
                else date.fromisoformat(str(x["check_in_date"]))
            ),
            reverse=True,
        )

        streak = 0
        current_date = end_date

        for check_in in sorted_check_ins:
            check_in_date = (
                check_in["check_in_date"]
                if isinstance(check_in["check_in_date"], date)
                else date.fromisoformat(str(check_in["check_in_date"]))
            )

            if check_in_date == current_date:
                streak += 1
                current_date -= timedelta(days=1)
            elif check_in_date < current_date:
                break

        return streak

    def _calculate_longest_streak(
        self,
        check_ins: List[Dict[str, Any]],
        goal_id: str = None,
        challenge_id: str = None,
        user_id: str = None,
    ) -> int:
        """Calculate longest consecutive streak in check-ins

        If goal_id is provided, try to use cached goal_statistics first
        If challenge_id and user_id are provided, try to use cached challenge_statistics first
        """
        from app.core.database import get_supabase_client

        # Optimization: Use cached goal_statistics if available
        if goal_id:
            try:
                supabase = get_supabase_client()
                stats_result = (
                    supabase.table("goal_statistics")
                    .select("longest_streak")
                    .eq("goal_id", goal_id)
                    .maybe_single()
                    .execute()
                )
                if stats_result.data:
                    return stats_result.data.get("longest_streak", 0)
            except Exception:
                pass  # Fall back to calculation

        # Optimization: Use cached challenge_statistics if available
        if challenge_id and user_id:
            try:
                supabase = get_supabase_client()
                stats_result = (
                    supabase.table("challenge_statistics")
                    .select("longest_streak")
                    .eq("challenge_id", challenge_id)
                    .eq("user_id", user_id)
                    .maybe_single()
                    .execute()
                )
                if stats_result.data:
                    return stats_result.data.get("longest_streak", 0)
            except Exception:
                pass  # Fall back to calculation

        if not check_ins:
            return 0

        sorted_dates = sorted(
            [
                (
                    c["check_in_date"]
                    if isinstance(c["check_in_date"], date)
                    else date.fromisoformat(str(c["check_in_date"]))
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
        goal: Optional[Dict[str, Any]],
        personal_goals: List[Dict[str, Any]],
        active_challenges: List[Dict[str, Any]],
        goal_check_ins: List[Dict[str, Any]],
        challenge_check_ins: List[Dict[str, Any]],
        stats: Dict[str, Any],
        user_profile: Optional[Dict[str, Any]],
        week_start: date,
        week_end: date,
    ) -> str:
        """
        Generate AI-powered recap text with full context.

        Args:
            goal: Primary goal data (for backward compat)
            personal_goals: List of personal goals
            active_challenges: List of active challenges
            goal_check_ins: List of goal check-ins for the week
            challenge_check_ins: List of challenge check-ins for the week
            stats: Calculated statistics
            user_profile: Optional user profile
            week_start: Week start date
            week_end: Week end date

        Returns:
            Generated recap text
        """
        # Get motivation style
        motivation_style = (
            user_profile.get("motivation_style", "friendly")
            if user_profile
            else "friendly"
        )

        # Map motivation style to tone description
        tone_map = {
            "tough_love": "direct, challenging, and no-nonsense",
            "gentle_encouragement": "warm, supportive, and compassionate",
            "data_driven": "analytical, metric-focused, and logical",
            "accountability_buddy": "friendly but firm, like a supportive friend",
        }
        tone_description = tone_map.get(motivation_style, "friendly and encouraging")

        # Build personal goals section
        personal_goals_str = ""
        if personal_goals:
            goals_list = [
                f"- {g.get('title', 'Unknown')} ({g.get('category', 'general')})"
                for g in personal_goals
            ]
            personal_goals_str = "\n".join(goals_list)
        else:
            personal_goals_str = "None"

        # Build challenges section
        challenges_str = ""
        if active_challenges:
            challenges_list = [
                f"- {c.get('title', 'Unknown')}" for c in active_challenges
            ]
            challenges_str = "\n".join(challenges_list)
        else:
            challenges_str = "None"

        # Build prompt for AI
        prompt = f"""Generate a personalized weekly recap for a fitness accountability app user.

PERSONAL GOALS ({len(personal_goals)} active):
{personal_goals_str}

ACTIVE CHALLENGES ({len(active_challenges)} active):
{challenges_str}

WEEKLY STATS (Week of {week_start.strftime('%B %d')} - {week_end.strftime('%B %d, %Y')}):
- Goal Check-ins: {stats['completed_check_ins']}
- Challenge Check-ins: {stats.get('challenge_check_ins', 0)}
- Total Check-ins: {stats.get('total_check_ins', stats['completed_check_ins'])}
- Active Days: {stats['days_with_checkins']} out of 7 days
- Current Streak: {stats['current_streak']} days (combined goals + challenges)
- Longest Streak This Week: {stats['longest_streak']} days
- Completion Rate: {stats['completion_rate']}%
- Challenge Points Earned: {stats.get('challenge_total_points', 0)} points
- Best Challenge Streak: {stats.get('challenge_current_streak', 0)} days
"""

        if stats.get("average_mood"):
            prompt += f"- Average Mood: {stats['average_mood']}/5\n"

        if user_profile:
            prompt += f"""
USER PREFERENCES:
- Motivation Style: {motivation_style} ({tone_description})
- Biggest Challenge: {user_profile.get("biggest_challenge", "Not specified")}
- Fitness Level: {user_profile.get("fitness_level", "Not specified")}
"""

        prompt += f"""
INSTRUCTIONS:
1. Write in a {tone_description} tone - MATCH their preferred motivation style
2. Celebrate their wins across goals AND challenges
3. If they have group goals or challenges, mention the power of community/accountability
4. Address their completion rate ({stats['completion_rate']}%) constructively
5. Highlight their {stats['current_streak']}-day streak momentum
6. Provide 1-2 actionable insights or tips
7. Keep it encouraging and motivating
8. Be concise (2-3 paragraphs max)

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
