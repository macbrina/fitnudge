"""
AI Progress Reflections Service

Premium AI-powered progress reflections for Pro/Elite users.
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

            # =========================================
            # 1. Get goal check-ins for the period
            # =========================================
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
            goal_check_ins = result.data if result.data else []

            # =========================================
            # 2. Get challenge check-ins for the period (completed only)
            # =========================================
            challenge_check_ins = []
            try:
                challenge_result = (
                    supabase.table("challenge_check_ins")
                    .select("*, challenges(id, title)")
                    .eq("user_id", user_id)
                    .eq("completed", True)
                    .gte("check_in_date", start_date.isoformat())
                    .lte("check_in_date", end_date.isoformat())
                    .execute()
                )
                challenge_check_ins = challenge_result.data or []
            except Exception:
                pass

            # =========================================
            # 3. Get active personal goals
            # =========================================
            personal_goals = []
            try:
                goals_result = (
                    supabase.table("goals")
                    .select("id, title, category, description")
                    .eq("user_id", user_id)
                    .eq("is_active", True)
                    .execute()
                )
                personal_goals = goals_result.data or []
            except Exception:
                pass

            # =========================================
            # 4. Get active challenges
            # =========================================
            active_challenges = []
            try:
                participant_result = (
                    supabase.table("challenge_participants")
                    .select("challenges(id, title, description)")
                    .eq("user_id", user_id)
                    .execute()
                )
                for p in participant_result.data or []:
                    challenge = p.get("challenges")
                    if challenge:
                        active_challenges.append(challenge)
            except Exception:
                pass

            # Check if we have any data
            if not goal_check_ins and not challenge_check_ins:
                return None

            # =========================================
            # 5. Get user profile for personalization
            # =========================================
            user_profile = (
                supabase.table("user_fitness_profiles")
                .select("*")
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )

            profile_data = user_profile.data if user_profile.data else {}

            # =========================================
            # 6. Calculate combined stats
            # =========================================
            # Combine check-in dates for streak calculation
            all_checkin_dates: set[str] = set()
            for c in goal_check_ins:
                if c.get("completed"):
                    all_checkin_dates.add(c["date"])
            for c in challenge_check_ins:
                all_checkin_dates.add(c["check_in_date"])

            stats = self._calculate_stats(goal_check_ins, start_date, end_date)
            # Add challenge stats
            stats["challenge_check_ins"] = len(challenge_check_ins)
            stats["total_all_check_ins"] = stats["total_completed"] + len(
                challenge_check_ins
            )
            # Recalculate streak from combined dates
            stats["current_streak"] = self._calculate_combined_streak(
                all_checkin_dates, end_date
            )

            # =========================================
            # 7. Get goal details (for backward compat)
            # =========================================
            if goal_id:
                goal = (
                    supabase.table("goals")
                    .select("*")
                    .eq("id", goal_id)
                    .maybe_single()
                    .execute()
                )
                goal_data = goal.data if goal.data else None
            else:
                goal_data = None

            # =========================================
            # 8. Get social context for enhanced reflections
            # =========================================
            social_context = await self._get_social_context(
                supabase, user_id, goal_id, start_date, end_date
            )

            # =========================================
            # 9. Generate AI reflection with full context
            # =========================================
            reflection_text = await self._generate_ai_reflection(
                goal_check_ins=goal_check_ins,
                challenge_check_ins=challenge_check_ins,
                personal_goals=personal_goals,
                active_challenges=active_challenges,
                stats=stats,
                goal_data=goal_data,
                profile_data=profile_data,
                period=period,
                social_context=social_context,
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

    async def _get_social_context(
        self,
        supabase,
        user_id: str,
        goal_id: Optional[str],
        start_date: date,
        end_date: date,
    ) -> Dict[str, Any]:
        """
        Fetch social context for the user and goal.

        Returns context about:
        - Challenge participation and ranking
        - Accountability partners
        """
        social_context = {
            "is_challenge": False,
            "challenge_rank": None,
            "challenge_participants": 0,
            "challenge_title": None,
            "accountability_partner": None,
            "partner_streak": None,
        }

        try:
            # Check if user is in a challenge related to this goal
            if goal_id:
                # Check if goal was converted to a challenge
                goal_result = (
                    supabase.table("goals")
                    .select("converted_to_challenge_id")
                    .eq("id", goal_id)
                    .maybe_single()
                    .execute()
                )

                challenge_id = (
                    goal_result.data.get("converted_to_challenge_id")
                    if goal_result.data
                    else None
                )

                if challenge_id:
                    # Get challenge info
                    challenge_result = (
                        supabase.table("challenges")
                        .select("id, title")
                        .eq("id", challenge_id)
                        .maybe_single()
                        .execute()
                    )

                    if challenge_result.data:
                        social_context["is_challenge"] = True
                        social_context["challenge_title"] = challenge_result.data.get(
                            "title"
                        )

                        # Get participant count
                        participants = (
                            supabase.table("challenge_participants")
                            .select("id", count="exact")
                            .eq("challenge_id", challenge_id)
                            .execute()
                        )
                        social_context["challenge_participants"] = (
                            participants.count if hasattr(participants, "count") else 0
                        )

                        # Get user's rank from leaderboard
                        rank_result = (
                            supabase.table("challenge_leaderboard")
                            .select("rank")
                            .eq("challenge_id", challenge_id)
                            .eq("user_id", user_id)
                            .maybe_single()
                            .execute()
                        )
                        if rank_result.data:
                            social_context["challenge_rank"] = rank_result.data.get(
                                "rank"
                            )

            # Check for accountability partner
            partner_result = (
                supabase.table("accountability_partners")
                .select(
                    "*, partner:users!accountability_partners_partner_user_id_fkey(id, name)"
                )
                .eq("user_id", user_id)
                .eq("status", "accepted")
                .limit(1)
                .execute()
            )

            if partner_result.data:
                partner = partner_result.data[0]
                partner_info = partner.get("partner", {})
                social_context["accountability_partner"] = partner_info.get("name")

                # Get partner's current streak (if available)
                partner_id = partner_info.get("id")
                if partner_id:
                    streak_result = (
                        supabase.table("users")
                        .select("current_streak")
                        .eq("id", partner_id)
                        .maybe_single()
                        .execute()
                    )
                    if streak_result.data:
                        social_context["partner_streak"] = streak_result.data.get(
                            "current_streak"
                        )

        except Exception as e:
            logger.warning(
                f"Failed to fetch social context: {e}",
                {"user_id": user_id, "goal_id": goal_id, "error": str(e)},
            )

        return social_context

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
        goal_check_ins: List[Dict[str, Any]],
        challenge_check_ins: List[Dict[str, Any]],
        personal_goals: List[Dict[str, Any]],
        active_challenges: List[Dict[str, Any]],
        stats: Dict[str, Any],
        goal_data: Optional[Dict[str, Any]],
        profile_data: Dict[str, Any],
        period: str,
        social_context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Generate AI-powered reflection text with full context"""
        from datetime import datetime

        # Get motivation style and map to tone
        motivation_style = profile_data.get("motivation_style", "friendly")
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

        # Build social context section
        social_section = ""
        if social_context:
            social_parts = []

            if social_context.get("is_challenge"):
                social_parts.append(
                    f"- Active Challenge: {social_context.get('challenge_title', 'Unknown')}"
                )
                rank = social_context.get("challenge_rank")
                participants = social_context.get("challenge_participants", 0)
                if rank:
                    social_parts.append(
                        f"- Current Rank: #{rank} out of {participants} participants"
                    )
                else:
                    social_parts.append(f"- Challenge Participants: {participants}")

            if social_context.get("accountability_partner"):
                partner_info = f"- Accountability Partner: {social_context['accountability_partner']}"
                if social_context.get("partner_streak"):
                    partner_info += (
                        f" (on a {social_context['partner_streak']}-day streak)"
                    )
                social_parts.append(partner_info)

            if social_parts:
                social_section = "\n\nSOCIAL CONTEXT:\n" + "\n".join(social_parts)

        prompt = f"""You are an expert fitness coach and accountability partner providing a deep, personalized progress reflection for a premium subscriber.

PERSONAL GOALS ({len(personal_goals)} active):
{personal_goals_str}

ACTIVE CHALLENGES ({len(active_challenges)} active):
{challenges_str}

USER PREFERENCES:
- Primary Goal: {goal_data.get('title', 'General fitness') if goal_data else 'Multiple goals'}
- Fitness Level: {profile_data.get('fitness_level', 'unknown')}
- Motivation Style: {motivation_style} ({tone_description})
- Biggest Challenge: {profile_data.get('biggest_challenge', 'consistency')}

PERFORMANCE DATA ({period}):
- Goal Check-ins: {stats['total_completed']} completed
- Challenge Check-ins: {stats.get('challenge_check_ins', 0)}
- Total All Check-ins: {stats.get('total_all_check_ins', stats['total_completed'])}
- Completion Rate: {stats['completion_rate']}%
- Current Streak: {stats['current_streak']} days (combined goals + challenges)
- Longest Streak: {stats['longest_streak']} days
- Average Mood: {stats['average_mood'] if stats['average_mood'] else 'N/A'}{social_section}

INSTRUCTIONS:
1. Provide a comprehensive, deep analysis (not just a summary)
2. Write in a {tone_description} tone - MATCH their preferred motivation style
3. Reference their specific goals AND challenges
4. If they have challenges, celebrate the power of community/accountability
5. Identify patterns and trends in their behavior
6. Celebrate wins and acknowledge challenges
7. Provide 2-3 actionable coaching recommendations
8. Write 4-5 paragraphs with specific insights

FORMAT:
- Opening: Context and overall assessment
- Strengths: What they're doing well across goals AND challenges
- Challenges: Areas for improvement
- Insights: Pattern analysis (include challenge dynamics if relevant)
- Recommendations: 2-3 specific, actionable next steps
- Closing: Encouragement matching their motivation style

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
