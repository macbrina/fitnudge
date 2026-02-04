"""
FitNudge - Weekly Recap Service

Generates AI-powered weekly progress summaries for users.

Schema Notes:
- goals: has current_streak, longest_streak, total_completions
- check_ins: has mood (tough, good, amazing), skip_reason, note
- daily_checkin_summaries: Pre-aggregated daily stats (total_check_ins, completed_count, rest_day_count,
  skipped_count, streak_at_date). Populated automatically by trigger on check_ins table.
  Used for faster analytics calculation. Falls back to raw check_ins if summaries unavailable.
- weekly_recaps: has goals_hit, goals_total, consistency_percent, summary, win, insight, focus_next_week, motivational_close
"""

from typing import Dict, Any, Optional, List
from datetime import date, timedelta, datetime
from collections import defaultdict, Counter
from openai import AsyncOpenAI
from app.core.database import get_supabase_client
from app.core.config import settings
from app.services.logger import logger


# Initialize OpenAI client
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


class WeeklyRecapService:
    """Service for generating weekly recaps with rich insights"""

    async def get_weekly_recap(
        self,
        user_id: str,
        force_regenerate: bool = False,
        for_previous_week: bool = False,
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached weekly recap or generate on-demand.
        Cache-first pattern per SCALABILITY.md.

        Args:
            user_id: User ID
            force_regenerate: Skip cache and generate fresh
            for_previous_week: If True, generate for the week that just ended (Mon-Sun).
                Used by the Monday batch job. If False, uses week-to-date (Mon-today).
        """
        supabase = get_supabase_client()
        today = date.today()

        if for_previous_week:
            # Week that just ended: Sunday = yesterday, Monday = 6 days before that
            week_end = today - timedelta(days=1)  # Sunday
            week_start = week_end - timedelta(days=6)  # Monday
        else:
            # Week-to-date: Mon → today (for on-demand / current week view)
            week_start = today - timedelta(days=today.weekday())
            week_end = today

        if not force_regenerate:
            # Try to get cached recap first
            try:
                cached = (
                    supabase.table("weekly_recaps")
                    .select("*")
                    .eq("user_id", user_id)
                    .eq("week_start", week_start.isoformat())
                    .eq("week_end", week_end.isoformat())
                    .maybe_single()
                    .execute()
                )

                if cached.data:
                    logger.info(f"Returning cached weekly recap for user {user_id}")
                    return cached.data
            except Exception as e:
                logger.warning(f"Failed to fetch cached recap: {e}")

        # Generate fresh recap
        recap = await self.generate_weekly_recap(
            user_id, goal_id=None, week_start=week_start, week_end=week_end
        )

        # Store in cache for future requests
        if recap:
            try:
                # Calculate goals_hit (goals that met their weekly target)
                goal_breakdown = recap.get("goal_breakdown", [])
                goals_hit = len(
                    [
                        g
                        for g in goal_breakdown
                        if g.get("status") in ["excellent", "good"]
                    ]
                )
                goals_total = len(goal_breakdown)

                # weekly_recaps schema with JSONB columns for full data caching
                cache_data = {
                    "user_id": user_id,
                    "week_start": recap["week_start"],
                    "week_end": recap["week_end"],
                    # Basic stats (DB columns)
                    "goals_hit": goals_hit,
                    "goals_total": goals_total,
                    "consistency_percent": recap.get("stats", {}).get(
                        "completion_rate", 0
                    ),
                    # AI-generated text fields
                    "summary": recap.get("recap_text"),  # AI summary paragraph
                    "win": recap.get("win"),
                    "insight": recap.get("insight"),
                    "focus_next_week": recap.get("focus_next_week"),
                    "motivational_close": recap.get("motivational_close"),
                    "recap_text": recap.get("recap_text"),  # Same as summary for now
                    # JSONB cached data
                    "stats": recap.get("stats", {}),
                    "goal_breakdown": recap.get("goal_breakdown", []),
                    "completion_rate_trend": recap.get("completion_rate_trend", []),
                    "achievements_unlocked": recap.get("achievements_unlocked", []),
                    "partner_context": recap.get("partner_context"),
                    # Metadata
                    "generated_at": recap["generated_at"],
                }
                supabase.table("weekly_recaps").upsert(
                    cache_data,
                    on_conflict="user_id,week_start",
                ).execute()
                logger.info(f"Cached weekly recap for user {user_id}")
            except Exception as e:
                logger.warning(f"Failed to cache recap: {e}")

        return recap

    async def generate_weekly_recap(
        self,
        user_id: str,
        goal_id: Optional[str] = None,
        week_start: Optional[date] = None,
        week_end: Optional[date] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a weekly recap for a user.

        - Only uses goals
        - Uses goals.current_streak and goals.longest_streak directly
        - Uses daily_checkin_summaries
        """
        supabase = get_supabase_client()

        try:
            today = date.today()
            # Default to week-to-date (Mon → today) unless explicitly provided.
            week_start = week_start or (today - timedelta(days=today.weekday()))
            week_end = week_end or today

            # =========================================
            # 0. Get user's active goals (ONLY)
            # =========================================
            if goal_id:
                goal_result = (
                    supabase.table("goals")
                    .select("*")
                    .eq("id", goal_id)
                    .eq("user_id", user_id)
                    .eq("status", "active")
                    .maybe_single()
                    .execute()
                )
                personal_goals = [goal_result.data] if goal_result.data else []
            else:
                goal_result = (
                    supabase.table("goals")
                    .select("*")
                    .eq("user_id", user_id)
                    .eq("status", "active")
                    .execute()
                )
                personal_goals = goal_result.data or []

            if not personal_goals:
                logger.warning(f"No active goals found for user {user_id}")
                return None

            active_goal_ids = [g.get("id") for g in personal_goals if g.get("id")]

            # =========================================
            # 1. Get check-ins for the week (active goals only)
            # =========================================
            checkins_query = (
                supabase.table("check_ins")
                .select("*")
                .eq("user_id", user_id)
                .gte("check_in_date", week_start.isoformat())
                .lte("check_in_date", week_end.isoformat())
            )

            if goal_id:
                checkins_query = checkins_query.eq("goal_id", goal_id)
            else:
                checkins_query = checkins_query.in_("goal_id", active_goal_ids)

            checkins_result = checkins_query.execute()
            check_ins = checkins_result.data or []

            # =========================================
            # 2. Get daily summaries for the week (for trend analysis)
            # =========================================
            summaries = []
            try:
                summary_query = (
                    supabase.table("daily_checkin_summaries")
                    .select(
                        "summary_date, total_check_ins, completed_count, rest_day_count, skipped_count, streak_at_date"
                    )
                    .eq("user_id", user_id)
                    .gte("summary_date", week_start.isoformat())
                    .lte("summary_date", week_end.isoformat())
                )

                if goal_id:
                    summary_query = summary_query.eq("goal_id", goal_id)
                else:
                    summary_query = summary_query.in_("goal_id", active_goal_ids)

                summary_result = summary_query.execute()
                summaries = summary_result.data or []
            except Exception as e:
                logger.warning(f"Failed to fetch summaries: {e}")

            # =========================================
            # 3. Check if we have any check-in data for the week
            # =========================================
            if not check_ins:
                logger.info(f"No check-ins found for user {user_id} this week")
                return None

            # =========================================
            # 4. Get user profile for motivation style
            # =========================================
            user_result = (
                supabase.table("users")
                .select("name, motivation_style")
                .eq("id", user_id)
                .maybe_single()
                .execute()
            )
            user_data = user_result.data or {}
            motivation_style = user_data.get("motivation_style", "supportive")
            user_name = user_data.get("name", "there")

            # =========================================
            # 5. Calculate statistics
            # =========================================
            stats = self._calculate_stats(
                check_ins, personal_goals, week_start, week_end, summaries
            )

            # =========================================
            # 6. Get previous week for comparison
            # =========================================
            previous_week_start = week_start - timedelta(days=7)
            previous_week_end = week_start - timedelta(days=1)
            prev_checkins = (
                supabase.table("check_ins")
                .select("id")
                .eq("user_id", user_id)
                .gte("check_in_date", previous_week_start.isoformat())
                .lte("check_in_date", previous_week_end.isoformat())
            )
            # Match app definition: rest_day counts as a successful completion
            prev_checkins = prev_checkins.in_("status", ["completed", "rest_day"])
            if goal_id:
                prev_checkins = prev_checkins.eq("goal_id", goal_id)
            else:
                prev_checkins = prev_checkins.in_("goal_id", active_goal_ids)
            prev_checkins = prev_checkins.execute()
            previous_week_count = len(prev_checkins.data or [])
            stats["previous_week_checkins"] = previous_week_count
            stats["week_over_week_change"] = (
                stats["completed_check_ins"] - previous_week_count
            )

            # =========================================
            # 7. Get partner context
            # =========================================
            partner_context = await self._get_partner_context(supabase, user_id)

            # =========================================
            # 8. Get achievements unlocked this week
            # =========================================
            achievements_unlocked = self._get_weekly_achievements(
                supabase, user_id, week_start, week_end
            )

            # =========================================
            # 9. Calculate goal breakdown
            # =========================================
            goal_breakdown = self._calculate_goal_breakdown(check_ins, personal_goals)

            # =========================================
            # 10. Get historical trend (4 weeks)
            # =========================================
            completion_rate_trend = self._get_historical_trend(
                supabase, user_id, week_start, goal_id, active_goal_ids=active_goal_ids
            )

            # =========================================
            # 11. Generate AI recap
            # =========================================
            ai_recap = await self._generate_ai_recap(
                user_name=user_name,
                personal_goals=personal_goals,
                stats=stats,
                motivation_style=motivation_style,
                week_start=week_start,
                week_end=week_end,
                goal_breakdown=goal_breakdown,
                partner_context=partner_context,
                achievements_unlocked=achievements_unlocked,
                completion_rate_trend=completion_rate_trend,
            )

            # Calculate goals_hit (goals that met their weekly target)
            goals_hit = len(
                [g for g in goal_breakdown if g.get("status") in ["excellent", "good"]]
            )
            goals_total = len(goal_breakdown)

            recap = {
                "week_start": week_start.isoformat(),
                "week_end": week_end.isoformat(),
                "goal_id": goal_id,
                "goal_title": personal_goals[0].get("title")
                if goal_id and personal_goals
                else "Multiple Goals",
                # DB columns
                "goals_hit": goals_hit,
                "goals_total": goals_total,
                "consistency_percent": stats.get("completion_rate", 0),
                # Full stats object
                "stats": stats,
                "goal_breakdown": goal_breakdown,
                "partner_context": partner_context,
                "achievements_unlocked": achievements_unlocked,
                "completion_rate_trend": completion_rate_trend,
                # AI-generated content
                "recap_text": ai_recap.get("summary"),
                "summary": ai_recap.get("summary"),  # Alias for recap_text
                "win": ai_recap.get("win"),
                "insight": ai_recap.get("insight"),
                "focus_next_week": ai_recap.get("focus_next_week"),
                "motivational_close": ai_recap.get("motivational_close"),
                "generated_at": datetime.now().isoformat(),
            }

            logger.info(f"Generated weekly recap for user {user_id}")
            return recap

        except Exception as e:
            logger.error(f"Failed to generate weekly recap for user {user_id}: {e}")
            return None

    def _calculate_stats(
        self,
        check_ins: List[Dict[str, Any]],
        personal_goals: List[Dict[str, Any]],
        week_start: date,
        week_end: date,
        summaries: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Calculate weekly statistics from check-ins, goals, and summaries.

        Uses pre-aggregated summaries when available for faster calculation,
        falls back to counting raw check-ins when summaries are empty.
        """
        # Scheduled opportunities for this week (across goals):
        # - include pending (e.g. today, before user checks in)
        # - rest_day is still a scheduled day; it just counts as "met"
        total_scheduled = len([c for c in check_ins if c.get("status") is not None])

        # Use summaries for aggregate counts if available (faster) BUT compute completion% against
        # scheduled opportunities (multi-goal safe).
        if summaries:
            completed_only_count = sum(
                int(s.get("completed_count", 0) or 0) for s in summaries
            )
            rest_day_count = sum(int(s.get("rest_day_count", 0) or 0) for s in summaries)
            completed_count = completed_only_count + rest_day_count
            total_check_ins = sum(int(s.get("total_check_ins", 0) or 0) for s in summaries)
            peak_streak_this_week = max(
                (int(s.get("streak_at_date", 0) or 0) for s in summaries), default=0
            )
        else:
            # Match app definition: rest_day counts as a successful completion
            completed_count = len(
                [c for c in check_ins if c.get("status") in ("completed", "rest_day")]
            )
            rest_day_count = len([c for c in check_ins if c.get("status") == "rest_day"])
            total_check_ins = len([c for c in check_ins if c.get("status") != "pending"])
            peak_streak_this_week = 0

        days_with_checkins = len(
            set(
                c.get("check_in_date")
                for c in check_ins
                if c.get("status") in ("completed", "rest_day") and c.get("check_in_date")
            )
        )

        # Get current/longest streak from goals (V2 stores streaks on goals table)
        current_streak = max(
            (g.get("current_streak", 0) for g in personal_goals), default=0
        )
        longest_streak = max(
            (g.get("longest_streak", 0) for g in personal_goals), default=0
        )

        # Analyze mood (still needs raw check-ins)
        moods = [c.get("mood") for c in check_ins if c.get("mood")]
        mood_distribution = Counter(moods)

        completion_rate = round((completed_count / total_scheduled) * 100, 1) if total_scheduled > 0 else 0

        # Analyze day patterns (still needs raw check-ins)
        strongest_day, weakest_day = self._analyze_day_patterns(check_ins)

        return {
            "completed_check_ins": completed_count,
            "rest_day_count": rest_day_count,
            "total_check_ins": total_check_ins,
            "total_scheduled": total_scheduled,
            "days_with_checkins": days_with_checkins,
            "current_streak": current_streak,
            "longest_streak": longest_streak,
            "peak_streak_this_week": peak_streak_this_week,
            "completion_rate": completion_rate,
            "mood_distribution": dict(mood_distribution),
            "strongest_day": strongest_day,
            "weakest_day": weakest_day,
        }

    def _analyze_day_patterns(
        self, check_ins: List[Dict[str, Any]]
    ) -> tuple[Optional[str], Optional[str]]:
        """Analyze check-ins by day of week to find strongest/weakest days."""
        day_counts: Counter = Counter()

        for checkin in check_ins:
            # V2.1: Use status field instead of completed boolean
            if checkin.get("status") == "completed":
                try:
                    d = date.fromisoformat(checkin["check_in_date"])
                    day_name = d.strftime("%A")
                    day_counts[day_name] += 1
                except (ValueError, KeyError):
                    pass

        if not day_counts:
            return None, None

        sorted_days = day_counts.most_common()
        strongest = sorted_days[0][0] if sorted_days else None
        weakest = sorted_days[-1][0] if len(sorted_days) > 1 else None

        return strongest, weakest

    def _calculate_goal_breakdown(
        self,
        check_ins: List[Dict[str, Any]],
        personal_goals: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Calculate per-goal breakdown from check-ins."""
        goal_lookup = {g["id"]: g for g in personal_goals}

        # Aggregate by goal_id
        goal_stats: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {"completed": 0, "total": 0, "days": set(), "moods": []}
        )

        for checkin in check_ins:
            goal_id = checkin.get("goal_id")
            if not goal_id:
                continue
            # V2.1: Use status instead of completed boolean
            checkin_status = checkin.get("status", "pending")
            # Scheduled opportunities for this goal (include pending; rest_day is still scheduled)
            if checkin_status is not None:
                goal_stats[goal_id]["total"] += 1
            # Match app definition: rest_day counts as a successful completion
            if checkin_status in ("completed", "rest_day"):
                goal_stats[goal_id]["completed"] += 1
                goal_stats[goal_id]["days"].add(checkin.get("check_in_date"))
            if checkin.get("mood"):
                goal_stats[goal_id]["moods"].append(checkin["mood"])

        breakdown = []
        for gid, stats in goal_stats.items():
            goal_info = goal_lookup.get(gid, {})
            scheduled = int(stats.get("total", 0) or 0)
            completion_rate = round((stats["completed"] / scheduled) * 100, 1) if scheduled > 0 else 0

            status = (
                "excellent"
                if completion_rate >= 80
                else "good" if completion_rate >= 50 else "needs_attention"
            )

            breakdown.append(
                {
                    "goal_id": gid,
                    "title": goal_info.get("title", "Unknown Goal"),
                    "completed": stats["completed"],
                    "total": scheduled,
                    "days_active": len(stats["days"]),
                    "completion_rate": completion_rate,
                    "status": status,
                    "current_streak": goal_info.get("current_streak", 0),
                    "longest_streak": goal_info.get("longest_streak", 0),
                }
            )

        breakdown.sort(key=lambda x: x["completion_rate"], reverse=True)
        return breakdown

    async def _get_partner_context(
        self, supabase, user_id: str
    ) -> Optional[List[Dict[str, Any]]]:
        """Get accountability partners context for the recap."""
        partners = []
        partner_ids_seen = set()

        try:
            # Get partners where user is the requester
            partner_result = (
                supabase.table("accountability_partners")
                .select(
                    "*, partner:users!accountability_partners_partner_user_id_fkey(id, name)"
                )
                .eq("user_id", user_id)
                .eq("status", "accepted")
                .execute()
            )

            for partner_data in partner_result.data or []:
                partner_info = partner_data.get("partner", {})
                partner_user_id = partner_info.get("id")
                if partner_user_id and partner_user_id not in partner_ids_seen:
                    partner_ids_seen.add(partner_user_id)
                    # Get partner's best streak from their goals
                    partner_goals = (
                        supabase.table("goals")
                        .select("current_streak")
                        .eq("user_id", partner_user_id)
                        .eq("status", "active")
                        .execute()
                    )
                    best_streak = max(
                        (
                            g.get("current_streak", 0)
                            for g in (partner_goals.data or [])
                        ),
                        default=0,
                    )
                    partners.append(
                        {
                            "partner_id": partner_user_id,
                            "partner_name": partner_info.get("name", "Partner"),
                            "partner_streak": best_streak,
                        }
                    )

            # Get partners where user is the partner (reverse relationship)
            reverse_result = (
                supabase.table("accountability_partners")
                .select(
                    "*, partner:users!accountability_partners_user_id_fkey(id, name)"
                )
                .eq("partner_user_id", user_id)
                .eq("status", "accepted")
                .execute()
            )

            for partner_data in reverse_result.data or []:
                partner_info = partner_data.get("partner", {})
                partner_user_id = partner_info.get("id")
                if partner_user_id and partner_user_id not in partner_ids_seen:
                    partner_ids_seen.add(partner_user_id)
                    # Get partner's best streak
                    partner_goals = (
                        supabase.table("goals")
                        .select("current_streak")
                        .eq("user_id", partner_user_id)
                        .eq("status", "active")
                        .execute()
                    )
                    best_streak = max(
                        (
                            g.get("current_streak", 0)
                            for g in (partner_goals.data or [])
                        ),
                        default=0,
                    )
                    partners.append(
                        {
                            "partner_id": partner_user_id,
                            "partner_name": partner_info.get("name", "Partner"),
                            "partner_streak": best_streak,
                        }
                    )

            return partners if partners else None

        except Exception as e:
            logger.warning(f"Failed to get partner context: {e}")
            return None

    def _get_historical_trend(
        self,
        supabase,
        user_id: str,
        current_week_start: date,
        goal_id: Optional[str],
        active_goal_ids: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Get completion rate trend for the last 4 weeks using check_ins table."""
        trend = []

        try:
            for weeks_ago in range(3, -1, -1):
                week_start = current_week_start - timedelta(weeks=weeks_ago)
                week_end = week_start + timedelta(days=6)

                # V2.1: Select status instead of completed
                query = (
                    supabase.table("check_ins")
                    .select("id, status")
                    .eq("user_id", user_id)
                    .gte("check_in_date", week_start.isoformat())
                    .lte("check_in_date", week_end.isoformat())
                )

                if goal_id:
                    query = query.eq("goal_id", goal_id)
                elif active_goal_ids:
                    query = query.in_("goal_id", active_goal_ids)

                result = query.execute()
                check_ins = result.data or []

                # V2.1: Count by status instead of completed boolean
                # Match app definition: rest_day counts as a successful completion
                completed = len(
                    [c for c in check_ins if c.get("status") in ("completed", "rest_day")]
                )
                total_scheduled = len([c for c in check_ins if c.get("status") is not None])
                completion_rate = (
                    round((completed / total_scheduled) * 100, 1)
                    if total_scheduled > 0
                    else 0
                )

                trend.append(
                    {
                        "week_start": week_start.isoformat(),
                        "week_label": f"Week {4 - weeks_ago}",
                        "completed": completed,
                        "total": total_scheduled,
                        "completion_rate": completion_rate,
                        "is_current": weeks_ago == 0,
                    }
                )

        except Exception as e:
            logger.warning(f"Failed to get historical trend: {e}")

        return trend

    def _get_weekly_achievements(
        self, supabase, user_id: str, week_start: date, week_end: date
    ) -> List[Dict[str, Any]]:
        """Get achievements unlocked during this week."""
        achievements = []

        try:
            result = (
                supabase.table("user_achievements")
                .select(
                    "*, achievement_type:achievement_types(badge_key, badge_name, badge_description, category, rarity)"
                )
                .eq("user_id", user_id)
                .gte("unlocked_at", f"{week_start.isoformat()}T00:00:00")
                .lte("unlocked_at", f"{week_end.isoformat()}T23:59:59")
                .execute()
            )

            for achievement in result.data or []:
                type_info = achievement.get("achievement_type", {})
                achievements.append(
                    {
                        "badge_key": type_info.get("badge_key"),
                        "badge_name": type_info.get("badge_name", "Achievement"),
                        "description": type_info.get("badge_description", ""),
                        "category": type_info.get("category", "general"),
                        "rarity": type_info.get("rarity", "common"),
                        "unlocked_at": achievement.get("unlocked_at"),
                    }
                )

        except Exception as e:
            logger.warning(f"Failed to get weekly achievements: {e}")

        return achievements

    async def _generate_ai_recap(
        self,
        user_name: str,
        personal_goals: List[Dict[str, Any]],
        stats: Dict[str, Any],
        motivation_style: str,
        week_start: date,
        week_end: date,
        goal_breakdown: List[Dict[str, Any]],
        partner_context: Optional[List[Dict[str, Any]]],
        achievements_unlocked: List[Dict[str, Any]],
        completion_rate_trend: List[Dict[str, Any]],
    ) -> Dict[str, str]:
        """Generate AI-powered recap using gpt-4o-mini."""
        # Style mapping
        style_prompts = {
            "supportive": "Warm, encouraging, celebrates every small win.",
            "tough_love": "Direct, challenging, pushes them to be better.",
            "calm": "Patient, balanced, philosophical.",
        }
        tone = style_prompts.get(motivation_style, style_prompts["supportive"])

        # Build goal breakdown
        goal_breakdown_str = ""
        for g in goal_breakdown[:5]:  # Limit to 5 goals
            status_emoji = (
                "🏆"
                if g["status"] == "excellent"
                else "✅" if g["status"] == "good" else "⚠️"
            )
            goal_breakdown_str += f"- {g['title']}: {g['completed']}/{g['total']} ({g['completion_rate']}%) {status_emoji}, streak: {g['current_streak']}d\n"

        # Build trend
        trend_str = ""
        if completion_rate_trend:
            rates = [f"{t['completion_rate']}%" for t in completion_rate_trend]
            trend_str = " → ".join(rates)

        # Build achievements
        achievements_str = ""
        for a in achievements_unlocked[:3]:
            achievements_str += f"- {a['badge_name']}\n"

        # Build partner context
        partner_str = ""
        if partner_context:
            for p in partner_context[:3]:
                partner_str += f"- {p['partner_name']}: {p['partner_streak']}d streak\n"

        # Week over week
        wow_change = stats.get("week_over_week_change", 0)
        wow_str = f"+{wow_change}" if wow_change > 0 else str(wow_change)

        # Mood distribution for insight
        mood_dist = stats.get("mood_distribution", {})
        mood_str = ", ".join(f"{k}: {v}" for k, v in mood_dist.items()) if mood_dist else "None"

        prompt = f"""Generate a personalized weekly recap for {user_name} in a fitness accountability app.

TONE: {tone}

GOALS:
{goal_breakdown_str if goal_breakdown_str else "No goals tracked"}

STATS (Week of {week_start.strftime('%b %d')} - {week_end.strftime('%b %d')}):
- Completed: {stats['completed_check_ins']} check-ins ({wow_str} vs last week)
- Streak: {stats['current_streak']} days (longest: {stats.get('longest_streak', 0)})
- Completion: {stats['completion_rate']}%
- Strongest day: {stats.get('strongest_day', 'N/A')}
- Weakest day: {stats.get('weakest_day', 'N/A')}
- Mood when checked in: {mood_str}

4-WEEK TREND: {trend_str if trend_str else 'N/A'}

ACHIEVEMENTS THIS WEEK:
{achievements_str if achievements_str else 'None'}

PARTNERS:
{partner_str if partner_str else 'None'}

Generate a helpful, actionable recap with these 4 sections. Be specific—reference their actual goals, stats, and patterns. Write 2-4 sentences per section so users get real value:

1. SUMMARY: How the week went across their goals. Mention completion rate and week-over-week change. Call out their strongest day (if available) and any noticeable patterns.
2. WIN: Their biggest accomplishment—be specific (e.g. streak, goal hit, consistency).
3. INSIGHT: One concrete pattern or observation from the data (e.g. "You crushed it on Mondays but slipped midweek—consider a midweek checkpoint" or "Mood was mostly 'amazing' when you completed—momentum helps").
4. FOCUS_NEXT_WEEK: One specific, actionable tip based on their weakest area or trend. Make it something they can actually do.

Respond in JSON format:
{{"summary": "...", "win": "...", "insight": "...", "focus_next_week": "..."}}"""

        try:
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an accountability coach. Respond only in valid JSON.",
                    },
                    {"role": "user", "content": prompt},
                ],
                max_tokens=600,
                temperature=0.8,
            )

            import json

            content = response.choices[0].message.content.strip()
            # Remove markdown code blocks if present
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            result = json.loads(content)
            return {
                "summary": result.get("summary", "Great week!"),
                "win": result.get("win", "You showed up."),
                "insight": result.get("insight", "Consistency matters."),
                "focus_next_week": result.get("focus_next_week", "Keep it up!"),
                "motivational_close": f"Keep going, {user_name}! 💪",
            }

        except Exception as e:
            logger.error(f"Failed to generate AI recap: {e}")
            return self._generate_fallback_recap(user_name, stats)

    def _generate_fallback_recap(
        self, user_name: str, stats: Dict[str, Any]
    ) -> Dict[str, str]:
        """Generate a basic fallback recap if AI fails."""
        completed = stats.get("completed_check_ins", 0)
        streak = stats.get("current_streak", 0)

        return {
            "summary": f"Great work this week, {user_name}! You completed {completed} check-ins.",
            "win": (
                f"You maintained a {streak}-day streak!"
                if streak > 0
                else "You showed up and that matters!"
            ),
            "insight": "Consistency is key to building lasting habits.",
            "focus_next_week": "Try to check in at the same time each day to build routine.",
            "motivational_close": f"Keep it up, {user_name}! You've got this! 💪",
        }


# Global instance
weekly_recap_service = WeeklyRecapService()
