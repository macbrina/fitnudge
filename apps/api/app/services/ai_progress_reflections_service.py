"""
AI Progress Reflections Service

Premium AI-powered progress reflections for Pro/Coach+ users.
Enhanced version of weekly recap with deeper insights and coaching.
"""

from typing import Dict, Any, Optional, List
from datetime import date, timedelta
from app.core.database import get_supabase_client
from app.services.logger import logger
from app.services.openai_service import OpenAIService


class AIProgressReflectionsService:
    """Service for generating premium AI progress reflections"""

    def __init__(self):
        self.openai_service = OpenAIService()

    async def generate_reflection(
        self, user_id: str, goal_id: Optional[str] = None, period: str = "weekly"
    ) -> Optional[Dict[str, Any]]:
        """
        Generate an AI-powered progress reflection.

        Args:
            user_id: User ID
            goal_id: Optional goal ID to focus on specific goal
            period: Time period for reflection (weekly, monthly)

        Returns:
            Reflection data with insights, coaching, and actionable recommendations
        """
        supabase = get_supabase_client()

        try:
            # Determine date range based on period
            today = date.today()
            if period == "weekly":
                start_date = today - timedelta(days=7)
                end_date = today
            elif period == "monthly":
                start_date = today - timedelta(days=30)
                end_date = today
            else:
                start_date = today - timedelta(days=7)
                end_date = today

            # Get check-ins for the period
            query = (
                supabase.table("check_ins")
                .select(
                    """
                *,
                goal:goals(id, title, category, frequency, target_days)
                """
                )
                .eq("user_id", user_id)
                .gte("date", start_date.isoformat())
                .lte("date", end_date.isoformat())
            )

            if goal_id:
                query = query.eq("goal_id", goal_id)

            result = query.order("date", desc=True).execute()
            check_ins = result.data if result.data else []

            if not check_ins:
                return None

            # Get user profile for personalization
            user_profile = (
                supabase.table("user_fitness_profiles")
                .select("*")
                .eq("user_id", user_id)
                .single()
                .execute()
            )

            profile_data = user_profile.data if user_profile.data else {}

            # Calculate stats
            stats = self._calculate_stats(check_ins, start_date, end_date)

            # Get goal details
            if goal_id:
                goal = (
                    supabase.table("goals")
                    .select("*")
                    .eq("id", goal_id)
                    .single()
                    .execute()
                )
                goal_data = goal.data if goal.data else None
            else:
                goal_data = None

            # Generate AI reflection
            reflection_text = await self._generate_ai_reflection(
                check_ins, stats, goal_data, profile_data, period
            )

            return {
                "period": period,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "goal_id": goal_id,
                "goal": goal_data,
                "stats": stats,
                "reflection": reflection_text,
                "generated_at": date.today().isoformat(),
            }

        except Exception as e:
            logger.error(
                f"Failed to generate AI progress reflection for user {user_id}: {e}",
                {"error": str(e), "user_id": user_id, "goal_id": goal_id},
            )
            raise

    def _calculate_stats(
        self, check_ins: List[Dict[str, Any]], start_date: date, end_date: date
    ) -> Dict[str, Any]:
        """Calculate reflection statistics"""
        total_days = (end_date - start_date).days + 1
        completed_checkins = [c for c in check_ins if c.get("completed")]
        total_completed = len(completed_checkins)
        completion_rate = (total_completed / total_days * 100) if total_days > 0 else 0

        # Calculate streaks
        sorted_checkins = sorted(
            check_ins, key=lambda x: x.get("date", ""), reverse=True
        )
        current_streak = 0
        for checkin in sorted_checkins:
            if checkin.get("completed"):
                current_streak += 1
            else:
                break

        # Calculate longest streak in period
        longest_streak = 0
        temp_streak = 0
        for checkin in sorted_checkins:
            if checkin.get("completed"):
                temp_streak += 1
                longest_streak = max(longest_streak, temp_streak)
            else:
                temp_streak = 0

        # Mood analysis
        mood_checkins = [c for c in check_ins if c.get("mood")]
        average_mood = (
            sum(c["mood"] for c in mood_checkins) / len(mood_checkins)
            if mood_checkins
            else None
        )

        return {
            "total_days": total_days,
            "total_completed": total_completed,
            "completion_rate": round(completion_rate, 1),
            "current_streak": current_streak,
            "longest_streak": longest_streak,
            "average_mood": round(average_mood, 2) if average_mood else None,
            "check_in_count": len(check_ins),
        }

    async def _generate_ai_reflection(
        self,
        check_ins: List[Dict[str, Any]],
        stats: Dict[str, Any],
        goal_data: Optional[Dict[str, Any]],
        profile_data: Dict[str, Any],
        period: str,
    ) -> str:
        """Generate AI-powered reflection text"""
        from datetime import datetime

        prompt = f"""You are an expert fitness coach and accountability partner providing a deep, personalized progress reflection for a Pro/Coach+ user.

USER CONTEXT:
- Primary Goal: {goal_data.get('title', 'General fitness') if goal_data else 'Multiple goals'}
- Fitness Level: {profile_data.get('fitness_level', 'unknown')}
- Motivation Style: {profile_data.get('motivation_style', 'balanced')}
- Biggest Challenge: {profile_data.get('biggest_challenge', 'consistency')}

PERFORMANCE DATA ({period}):
- Completion Rate: {stats['completion_rate']}%
- Total Check-ins: {stats['total_completed']} out of {stats['total_days']} days
- Current Streak: {stats['current_streak']} days
- Longest Streak: {stats['longest_streak']} days
- Average Mood: {stats['average_mood'] if stats['average_mood'] else 'N/A'}

INSTRUCTIONS:
1. Provide a comprehensive, deep analysis (not just a summary)
2. Identify patterns and trends in their behavior
3. Celebrate wins and acknowledge challenges
4. Provide 2-3 actionable coaching recommendations
5. Connect their progress to their stated goals and challenges
6. Use a {profile_data.get('motivation_style', 'friendly')} tone but be professional
7. Write 4-5 paragraphs with specific insights

FORMAT:
- Opening: Context and overall assessment
- Strengths: What they're doing well
- Challenges: Areas for improvement
- Insights: Pattern analysis and observations
- Recommendations: 2-3 specific, actionable next steps
- Closing: Encouragement and motivation

Generate the reflection now:"""

        try:
            response = await self.openai_service.client.responses.create(
                model="gpt-5-mini",
                input=prompt,
                reasoning={"effort": "medium"},  # Higher effort for premium reflections
            )

            # Extract text from response
            reflection_text = ""
            for item in response.output:
                if hasattr(item, "content"):
                    if hasattr(item, "type") and item.type == "reasoning":
                        continue
                    for content_part in item.content:
                        if hasattr(content_part, "text"):
                            reflection_text += content_part.text
                        elif hasattr(content_part, "content") and content_part.content:
                            for nested in content_part.content:
                                if hasattr(nested, "text"):
                                    reflection_text += nested.text

            return reflection_text.strip()

        except Exception as e:
            logger.error(
                f"Failed to generate AI reflection text: {e}",
                {"error": str(e)},
            )
            # Fallback reflection
            return self._generate_fallback_reflection(stats, goal_data)

    def _generate_fallback_reflection(
        self, stats: Dict[str, Any], goal_data: Optional[Dict[str, Any]]
    ) -> str:
        """Generate a basic fallback reflection if AI fails"""
        goal_title = goal_data.get("title", "your goals") if goal_data else "your goals"
        completion_rate = stats.get("completion_rate", 0)
        current_streak = stats.get("current_streak", 0)

        reflection = f"Great work on {goal_title}! "

        if completion_rate >= 80:
            reflection += f"You've maintained an impressive {completion_rate}% completion rate, showing strong consistency and dedication. "
        elif completion_rate >= 60:
            reflection += (
                f"Your {completion_rate}% completion rate shows good progress. "
            )
        else:
            reflection += f"Your {completion_rate}% completion rate indicates there's room for improvement. "

        if current_streak >= 7:
            reflection += f"You're on an amazing {current_streak}-day streak - keep this momentum going! "
        elif current_streak >= 3:
            reflection += (
                f"You have a {current_streak}-day streak - build on this foundation! "
            )

        reflection += "Continue showing up consistently and remember why you started. You have the power to make lasting change!"

        return reflection


# Global instance
ai_progress_reflections_service = AIProgressReflectionsService()
