"""
Challenge Service

Handles challenge creation, participation, and leaderboard management.
"""

from typing import Dict, Any, Optional, List
from datetime import date, datetime, timedelta
from app.core.database import get_supabase_client
from app.services.logger import logger


class ChallengeService:
    """Service for managing challenges"""

    async def create_challenge(
        self,
        user_id: str,
        title: str,
        description: Optional[str],
        challenge_type: str,
        duration_days: int,
        start_date: date,
        end_date: Optional[date] = None,  # Optional - calculated if not provided
        is_public: bool = True,
        max_participants: Optional[int] = None,
        join_deadline: Optional[date] = None,
        # Goal-like fields for plan generation
        category: Optional[str] = None,
        frequency: Optional[str] = "daily",
        days_of_week: Optional[List[int]] = None,
        target_days: Optional[int] = None,
        target_checkins: Optional[int] = None,
        reminder_times: Optional[List[str]] = None,
        tracking_type: Optional[str] = None,  # workout, meal, hydration, checkin
        metadata: Optional[Dict[str, Any]] = None,
        # User context for plan generation (same as goals.py)
        user_plan: Optional[str] = None,
        user_timezone: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a new standalone challenge.

        This creates the challenge and queues plan generation.
        The plan will be stored in actionable_plans with challenge_id.
        Mirrors the flow in goals.py for consistency.

        Args:
            user_id: User creating the challenge
            title: Challenge title
            description: Challenge description
            challenge_type: Type of challenge (streak or checkin_count)
            duration_days: Challenge duration in days
            start_date: Start date
            end_date: End date (optional, calculated from duration_days if not provided)
            is_public: Whether challenge is public
            max_participants: Maximum participants (None for unlimited)
            join_deadline: Optional deadline to join (defaults to start_date)
            category: Goal category (fitness, nutrition, wellness, mindfulness, sleep)
            frequency: Check-in frequency (daily, weekly)
            days_of_week: Days for weekly frequency (0=Sunday, 6=Saturday)
            target_days: Target days to complete
            target_checkins: Target check-ins (for checkin_count type)
            reminder_times: Reminder notification times
            metadata: Additional challenge data
            user_plan: User's subscription plan (for plan generation quality)
            user_timezone: User's timezone (for scheduling)

        Returns:
            Created challenge data
        """
        supabase = get_supabase_client()

        # Validate challenge_type - only streak and checkin_count are supported
        valid_challenge_types = ["streak", "checkin_count"]
        if challenge_type not in valid_challenge_types:
            raise ValueError(
                f"Invalid challenge_type '{challenge_type}'. Must be one of: {valid_challenge_types}"
            )

        try:
            # Calculate end date if not provided
            if end_date is None:
                end_date = start_date + timedelta(days=duration_days - 1)

            # Determine tracking_type - default based on category if not provided
            effective_tracking_type = tracking_type
            if not effective_tracking_type:
                if category == "fitness":
                    effective_tracking_type = "workout"
                elif category == "nutrition":
                    # Check if it's a hydration challenge based on title/description
                    combined_text = f"{title} {description or ''}".lower()
                    hydration_keywords = [
                        "water",
                        "hydration",
                        "hydrate",
                        "drink",
                        "glasses",
                        "ml",
                        "fluid",
                        "h2o",
                    ]
                    is_hydration = any(kw in combined_text for kw in hydration_keywords)
                    effective_tracking_type = "hydration" if is_hydration else "meal"
                elif (
                    category == "wellness"
                    or category == "mindfulness"
                    or category == "sleep"
                ):
                    effective_tracking_type = "checkin"
                else:
                    effective_tracking_type = "checkin"

            challenge = {
                "title": title,
                "description": description,
                "challenge_type": challenge_type,
                "duration_days": duration_days,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "join_deadline": join_deadline.isoformat() if join_deadline else None,
                "is_public": is_public,
                "status": "upcoming",  # Challenges start as upcoming
                "max_participants": max_participants,
                "created_by": user_id,
                # Goal-like fields stored directly on challenge
                "category": category,
                "frequency": frequency,
                "days_of_week": days_of_week,
                "target_days": target_days,
                "target_checkins": target_checkins,
                "reminder_times": reminder_times,
                "tracking_type": effective_tracking_type,
                "metadata": metadata or {},
            }

            result = supabase.table("challenges").insert(challenge).execute()

            if not result.data:
                raise Exception("Failed to create challenge")

            created_challenge = result.data[0]
            challenge_id = created_challenge["id"]

            logger.info(
                f"Created challenge '{title}' by user {user_id}",
                {
                    "challenge_id": challenge_id,
                    "user_id": user_id,
                    "duration_days": duration_days,
                    "category": category,
                },
            )

            # Auto-join creator as first participant
            participant = {
                "challenge_id": challenge_id,
                "user_id": user_id,
                "goal_id": None,  # Standalone challenge - no goal
            }
            supabase.table("challenge_participants").insert(participant).execute()

            # Queue plan generation for categories that need plans
            # Same categories as goals.py: fitness, nutrition, wellness, mindfulness, sleep
            valid_categories = [
                "fitness",
                "nutrition",
                "wellness",
                "mindfulness",
                "sleep",
            ]
            if category and category.lower() in valid_categories:
                await self._queue_plan_generation(
                    supabase=supabase,
                    challenge_id=challenge_id,
                    user_id=user_id,
                    title=title,
                    description=description,
                    category=category,
                    challenge_type=challenge_type,
                    duration_days=duration_days,
                    frequency=frequency,
                    days_of_week=days_of_week,
                    target_days=target_days,
                    user_plan=user_plan,
                    user_timezone=user_timezone,
                )

            return created_challenge

        except Exception as e:
            logger.error(
                f"Failed to create challenge for user {user_id}",
                {"error": str(e), "user_id": user_id, "title": title},
            )
            raise

    async def _queue_plan_generation(
        self,
        supabase,
        challenge_id: str,
        user_id: str,
        title: str,
        description: Optional[str],
        category: str,
        challenge_type: str,
        duration_days: int,
        frequency: Optional[str],
        days_of_week: Optional[List[int]],
        target_days: Optional[int],
        user_plan: Optional[str] = None,
        user_timezone: Optional[str] = None,
    ) -> None:
        """
        Queue plan generation for a challenge.

        Creates a pending actionable_plan entry and triggers async generation.
        Mirrors the flow in goals.py for consistency - fetches user_profile,
        passes user_plan and user_timezone for proper personalization.
        """
        from app.services.tasks import generate_challenge_plan_task

        try:
            # Get user's fitness profile for personalization (same as goals.py)
            profile_result = (
                supabase.table("user_fitness_profiles")
                .select("*")
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )
            user_profile = (
                profile_result.data if profile_result and profile_result.data else {}
            )

            # Get user record for plan, timezone, and country
            user_result = (
                supabase.table("users")
                .select("plan, timezone, country")
                .eq("id", user_id)
                .maybe_single()
                .execute()
            )

            # If user_plan not provided, get it from user record
            if not user_plan and user_result and user_result.data:
                user_plan = user_result.data.get("plan", "free")

            # If user_timezone not provided, get it from user record
            if not user_timezone and user_result and user_result.data:
                user_timezone = user_result.data.get("timezone", "UTC")

            # Merge timezone and country into user_profile for AI personalization
            user_profile["timezone"] = user_timezone or "UTC"
            if user_result and user_result.data:
                user_profile["country"] = user_result.data.get("country")

            # Create pending plan entry with challenge_id (not goal_id)
            plan_entry = {
                "challenge_id": challenge_id,
                "goal_id": None,  # Explicitly null - this is a challenge plan
                "plan_type": self._get_plan_type_for_category(category),
                "status": "pending",
                "structured_data": {},
            }

            plan_result = (
                supabase.table("actionable_plans").insert(plan_entry).execute()
            )

            if not plan_result.data:
                logger.error(
                    f"Failed to create plan entry for challenge {challenge_id}"
                )
                return

            plan_id = plan_result.data[0]["id"]

            # Build goal-like object for plan generator (same structure as goals.py)
            # The plan generator expects this structure
            challenge_as_goal = {
                "id": challenge_id,
                "user_id": user_id,
                "title": title,
                "description": description or "",
                "category": category,
                "frequency": frequency or "daily",
                "days_of_week": days_of_week,  # For scheduling
                "target_days": target_days or duration_days,
                "duration_days": duration_days,
                "is_challenge": True,  # Flag for plan generator
            }

            # Queue for async generation using Celery (same pattern as goals.py)
            generate_challenge_plan_task.delay(
                plan_id=plan_id,
                challenge_id=challenge_id,
                challenge_data=challenge_as_goal,
                user_id=user_id,
                user_profile=user_profile,
                user_plan=user_plan,
            )

            logger.info(
                f"Queued plan generation for challenge {challenge_id}",
                {
                    "challenge_id": challenge_id,
                    "plan_id": plan_id,
                    "category": category,
                    "user_plan": user_plan,
                    "has_profile": user_profile is not None,
                },
            )

        except Exception as e:
            logger.error(
                f"Failed to queue plan generation for challenge {challenge_id}",
                {"error": str(e), "challenge_id": challenge_id},
            )
            # Don't raise - challenge is created, plan generation is optional

    def _get_plan_type_for_category(self, category: str) -> str:
        """
        Map category to plan type.

        Uses the same mapping as PlanGenerator._get_expected_plan_type()
        to ensure consistency across the codebase.

        Supported categories: fitness, nutrition, wellness, mindfulness, sleep
        """
        category_to_plan_type = {
            "fitness": "workout_plan",
            "nutrition": "meal_plan",
            "wellness": "habit_plan",
            "mindfulness": "habit_plan",
            "sleep": "habit_plan",
        }
        return category_to_plan_type.get(category.lower(), "habit_plan")

    async def join_challenge(
        self, challenge_id: str, user_id: str, goal_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Join a challenge.

        Args:
            challenge_id: Challenge ID
            user_id: User ID
            goal_id: Optional goal ID to use for this challenge

        Returns:
            Challenge participant data
        """
        supabase = get_supabase_client()

        try:
            # Verify challenge exists and is joinable
            challenge = (
                supabase.table("challenges")
                .select("*")
                .eq("id", challenge_id)
                .in_("status", ["upcoming", "active"])
                .maybe_single()
                .execute()
            )

            if not challenge.data:
                raise ValueError("Challenge not found or not active")

            challenge_data = challenge.data
            today = date.today()

            # Check join deadline - users can only join before start_date or join_deadline
            challenge_start = date.fromisoformat(challenge_data["start_date"])
            join_deadline_str = challenge_data.get("join_deadline")

            if join_deadline_str:
                # If join_deadline is set, use it
                join_deadline = date.fromisoformat(join_deadline_str)
                if today > join_deadline:
                    raise ValueError(
                        "Join deadline has passed. You can no longer join this challenge."
                    )
            else:
                # If no join_deadline, use start_date (lock after start)
                if today > challenge_start:
                    raise ValueError(
                        "Challenge has already started. You can no longer join."
                    )

            # Check if challenge has ended
            challenge_end = date.fromisoformat(challenge_data["end_date"])
            if today > challenge_end:
                raise ValueError("Challenge has ended")

            # Check participant limit
            if challenge_data.get("max_participants"):
                participants = (
                    supabase.table("challenge_participants")
                    .select("id", count="exact")
                    .eq("challenge_id", challenge_id)
                    .execute()
                )
                participant_count = (
                    participants.count
                    if hasattr(participants, "count")
                    else len(participants.data or [])
                )

                if participant_count >= challenge_data["max_participants"]:
                    raise ValueError("Challenge is full")

            # Check if user already joined
            existing = (
                supabase.table("challenge_participants")
                .select("id")
                .eq("challenge_id", challenge_id)
                .eq("user_id", user_id)
                .execute()
            )

            if existing.data:
                raise ValueError("Already joined this challenge")

            # For private challenges, check if user has a valid invite
            if not challenge_data.get("is_public", True):
                # Creator doesn't need an invite
                if challenge_data.get("created_by") != user_id:
                    invite = (
                        supabase.table("challenge_invites")
                        .select("id, status")
                        .eq("challenge_id", challenge_id)
                        .eq("invited_user_id", user_id)
                        .in_("status", ["pending", "accepted"])
                        .maybe_single()
                        .execute()
                    )
                    if not invite.data:
                        raise ValueError(
                            "This is a private challenge. You need an invite to join."
                        )

            # Join challenge (membership only - no scoring data)
            participant = {
                "challenge_id": challenge_id,
                "user_id": user_id,
                "goal_id": goal_id,
            }

            result = (
                supabase.table("challenge_participants").insert(participant).execute()
            )

            if result.data:
                print(
                    f"User {user_id} joined challenge {challenge_id}",
                    {"challenge_id": challenge_id, "user_id": user_id},
                )

                # Update leaderboard
                await self._update_leaderboard(challenge_id)

                return result.data[0]

            raise Exception("Failed to join challenge")

        except Exception as e:
            logger.error(
                f"Failed to join challenge {challenge_id} for user {user_id}",
                {"error": str(e), "challenge_id": challenge_id, "user_id": user_id},
            )
            raise

    async def update_participant_progress(
        self, challenge_id: str, user_id: str
    ) -> Dict[str, Any]:
        """
        Update participant progress based on check-ins.

        Args:
            challenge_id: Challenge ID
            user_id: User ID

        Returns:
            Updated participant data
        """
        supabase = get_supabase_client()

        try:
            # Get challenge details
            challenge = (
                supabase.table("challenges")
                .select("*")
                .eq("id", challenge_id)
                .maybe_single()
                .execute()
            )

            if not challenge.data:
                raise ValueError("Challenge not found")

            challenge_data = challenge.data
            challenge_start = date.fromisoformat(challenge_data["start_date"])
            challenge_end = date.fromisoformat(challenge_data["end_date"])

            # Get participant
            participant = (
                supabase.table("challenge_participants")
                .select("*")
                .eq("challenge_id", challenge_id)
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )

            if not participant.data:
                raise ValueError("Not a participant in this challenge")

            participant_data = participant.data
            goal_id = participant_data.get("goal_id")

            # Get check-ins during challenge period
            query = (
                supabase.table("check_ins")
                .select("id, check_in_date, completed")
                .eq("user_id", user_id)
                .eq("completed", True)
                .gte("check_in_date", challenge_start.isoformat())
                .lte("check_in_date", challenge_end.isoformat())
            )

            if goal_id:
                query = query.eq("goal_id", goal_id)

            check_ins_result = query.execute()
            check_ins = check_ins_result.data or []

            # Calculate progress based on challenge type
            # Only streak and checkin_count are supported
            challenge_type = challenge_data["challenge_type"]
            progress_data = {}
            points = 0
            current_streak = 0

            if challenge_type == "streak":
                # Time Challenge: Calculate current streak
                current_streak = await self._calculate_streak(check_ins)
                progress_data["current_streak"] = current_streak
                points = current_streak * 10  # 10 points per day of streak

            elif challenge_type == "checkin_count":
                # Target Challenge: Count total check-ins
                count = len(check_ins)
                progress_data["checkin_count"] = count
                points = count * 5  # 5 points per check-in

            else:
                # Fallback for any legacy types - treat as streak
                logger.warning(
                    f"Unknown challenge_type '{challenge_type}', treating as streak",
                    {"challenge_id": challenge_id, "challenge_type": challenge_type},
                )
                current_streak = await self._calculate_streak(check_ins)
                progress_data["current_streak"] = current_streak
                points = current_streak * 10

            # Update participant
            update_data = {
                "progress_data": progress_data,
                "points": points,
            }

            # Check if challenge is completed
            if challenge_type == "streak":
                # Streak challenge: complete when target streak reached
                target_streak = challenge_data.get("target_days") or challenge_data.get(
                    "duration_days", 0
                )
                if current_streak >= target_streak:
                    update_data["completed_at"] = "now()"

            elif challenge_type == "checkin_count":
                # Target challenge: complete when target check-ins reached
                target_checkins = challenge_data.get("target_checkins", 0)
                if (
                    target_checkins
                    and progress_data.get("checkin_count", 0) >= target_checkins
                ):
                    update_data["completed_at"] = "now()"

            result = (
                supabase.table("challenge_participants")
                .update(update_data)
                .eq("challenge_id", challenge_id)
                .eq("user_id", user_id)
                .execute()
            )

            # Update leaderboard
            await self._update_leaderboard(challenge_id)

            if result.data:
                return result.data[0]

            return participant_data

        except Exception as e:
            logger.error(
                f"Failed to update progress for challenge {challenge_id}, user {user_id}",
                {"error": str(e), "challenge_id": challenge_id, "user_id": user_id},
            )
            raise

    async def _calculate_streak(self, check_ins: List[Dict[str, Any]]) -> int:
        """Calculate current streak from check-ins (legacy, used for goal-based challenge progress)"""
        if not check_ins:
            return 0

        # Sort by date descending
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
        today = date.today()
        current_date = today

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

    async def get_cached_challenge_stats(
        self, challenge_id: str, user_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get cached statistics from challenge_statistics table"""
        supabase = get_supabase_client()

        try:
            result = (
                supabase.table("challenge_statistics")
                .select("*")
                .eq("challenge_id", challenge_id)
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )

            return result.data if result.data else None
        except Exception as e:
            logger.warning(
                f"Failed to get cached challenge stats: {e}",
                {"challenge_id": challenge_id, "user_id": user_id},
            )
            return None

    async def _update_leaderboard(self, challenge_id: str) -> None:
        """
        Recalculate ranks for challenge leaderboard.

        The leaderboard table stores all scoring data (rank, points, progress_data).
        This method only recalculates ranks based on points already in the table.
        """
        supabase = get_supabase_client()

        try:
            # Get all leaderboard entries ordered by points
            entries = (
                supabase.table("challenge_leaderboard")
                .select("id, user_id, points")
                .eq("challenge_id", challenge_id)
                .order("points", desc=True)
                .execute()
            )

            if not entries.data:
                return

            # SCALABILITY: Build updates and apply in batch if RPC exists,
            # otherwise fall back to individual updates (acceptable for <100 entries)
            if len(entries.data) <= 100:
                # For small leaderboards, individual updates are acceptable
                for rank, entry in enumerate(entries.data, start=1):
                    supabase.table("challenge_leaderboard").update({"rank": rank}).eq(
                        "id", entry["id"]
                    ).execute()
            else:
                # For large leaderboards, use batch approach
                # Group entries by rank ranges and update in batches
                batch_size = 50
                for i in range(0, len(entries.data), batch_size):
                    batch = entries.data[i : i + batch_size]
                    for rank, entry in enumerate(batch, start=i + 1):
                        supabase.table("challenge_leaderboard").update(
                            {"rank": rank}
                        ).eq("id", entry["id"]).execute()

            print(
                f"Updated leaderboard ranks for challenge {challenge_id}",
                {
                    "challenge_id": challenge_id,
                    "entries_count": len(entries.data),
                },
            )

        except Exception as e:
            logger.error(
                f"Failed to update leaderboard for challenge {challenge_id}",
                {"error": str(e), "challenge_id": challenge_id},
            )

    async def get_challenges(
        self,
        user_id: Optional[str] = None,
        is_public: Optional[bool] = None,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get available challenges.

        Args:
            user_id: Optional user ID to filter user's challenges
            is_public: Filter by public status
            status: Filter by status ('upcoming', 'active', 'completed', 'cancelled')

        Returns:
            List of challenges
        """
        supabase = get_supabase_client()

        try:
            query = supabase.table("challenges").select("*")

            if is_public is not None:
                query = query.eq("is_public", is_public)

            if status is not None:
                query = query.eq("status", status)
            else:
                # Default: exclude cancelled challenges
                query = query.neq("status", "cancelled")

            if user_id:
                query = query.eq("created_by", user_id)

            result = query.order("created_at", desc=True).execute()
            return result.data or []

        except Exception as e:
            logger.error(
                f"Failed to get challenges",
                {"error": str(e), "user_id": user_id},
            )
            return []

    async def get_my_challenges(
        self,
        user_id: str,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get all challenges the user has access to (created or joined).

        Args:
            user_id: User ID
            status: Optional filter by status (upcoming, active, completed, cancelled)

        Returns:
            List of challenges with user's participation info

        Status is stored in 'status' column.
        """
        from datetime import date

        supabase = get_supabase_client()

        def get_status(challenge: dict) -> str:
            """Get status from stored field."""
            stored_status = challenge.get("status")
            if stored_status and stored_status in (
                "upcoming",
                "active",
                "completed",
                "cancelled",
            ):
                return stored_status
            return "upcoming"  # Default fallback

        try:
            # Get challenges created by user
            created_result = (
                supabase.table("challenges")
                .select("*")
                .eq("created_by", user_id)
                .execute()
            )
            created_challenges = created_result.data or []

            # Get challenge IDs user has joined
            participants_result = (
                supabase.table("challenge_participants")
                .select("challenge_id")
                .eq("user_id", user_id)
                .execute()
            )
            joined_challenge_ids = [
                p["challenge_id"] for p in (participants_result.data or [])
            ]

            # Get challenges user has joined (excluding ones they created to avoid duplicates)
            created_ids = {c["id"] for c in created_challenges}
            joined_ids_to_fetch = [
                cid for cid in joined_challenge_ids if cid not in created_ids
            ]

            joined_challenges = []
            if joined_ids_to_fetch:
                joined_result = (
                    supabase.table("challenges")
                    .select("*")
                    .in_("id", joined_ids_to_fetch)
                    .execute()
                )
                joined_challenges = joined_result.data or []

            # Combine all challenges
            all_challenges = created_challenges + joined_challenges

            # Compute status for each challenge and filter if needed
            for challenge in all_challenges:
                challenge["status"] = get_status(challenge)

            # Filter by status if provided
            if status:
                all_challenges = [c for c in all_challenges if c["status"] == status]

            # Sort by created_at
            all_challenges.sort(key=lambda x: x.get("created_at", ""), reverse=True)

            # Add user context (is_creator, participation info)
            for challenge in all_challenges:
                challenge["is_creator"] = challenge.get("created_by") == user_id
                challenge["is_participant"] = challenge["id"] in joined_challenge_ids

                # Get user's scoring data from leaderboard (all in one place)
                if challenge["is_participant"] or challenge["is_creator"]:
                    try:
                        leaderboard_result = (
                            supabase.table("challenge_leaderboard")
                            .select("rank, points, progress_data")
                            .eq("challenge_id", challenge["id"])
                            .eq("user_id", user_id)
                            .maybe_single()
                            .execute()
                        )
                        if leaderboard_result and leaderboard_result.data:
                            challenge["my_rank"] = leaderboard_result.data.get("rank")
                            challenge["my_progress"] = leaderboard_result.data.get(
                                "points", 0
                            )
                        else:
                            # Not in leaderboard yet (no check-ins)
                            challenge["my_rank"] = None
                            challenge["my_progress"] = 0
                    except Exception:
                        challenge["my_rank"] = None
                        challenge["my_progress"] = 0

                # Get participant count
                try:
                    count_result = (
                        supabase.table("challenge_participants")
                        .select("id", count="exact")
                        .eq("challenge_id", challenge["id"])
                        .execute()
                    )
                    challenge["participants_count"] = count_result.count or 0
                except Exception:
                    challenge["participants_count"] = 0

                # Set target_value based on challenge type for progress tracking
                challenge_type = challenge.get("challenge_type")
                if challenge_type == "checkin_count":
                    challenge["target_value"] = challenge.get("target_checkins")
                elif challenge_type == "streak":
                    challenge["target_value"] = challenge.get("duration_days")

            return all_challenges

        except Exception as e:
            logger.error(
                f"Failed to get user's challenges: {str(e)}",
                {"error": str(e), "user_id": user_id},
            )
            raise e  # Re-raise to see the full stack trace

    async def get_challenge_leaderboard(
        self, challenge_id: str, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get challenge leaderboard.

        All scoring data (rank, points, progress_data) is in challenge_leaderboard.

        Args:
            challenge_id: Challenge ID
            limit: Maximum number of entries to return

        Returns:
            List of leaderboard entries with user info under 'user' key
        """
        supabase = get_supabase_client()

        try:
            # Get leaderboard with all data and user info
            result = (
                supabase.table("challenge_leaderboard")
                .select("*, users(id, name, username, profile_picture_url)")
                .eq("challenge_id", challenge_id)
                .order("rank")
                .limit(limit)
                .execute()
            )

            # Transform 'users' to 'user' for frontend compatibility
            entries = []
            for entry in result.data or []:
                transformed = {**entry}
                if "users" in transformed:
                    transformed["user"] = transformed.pop("users")
                # Add total_check_ins from progress_data
                progress_data = entry.get("progress_data", {}) or {}
                transformed["total_check_ins"] = progress_data.get("checkin_count", 0)
                entries.append(transformed)

            return entries

        except Exception as e:
            logger.error(
                f"Failed to get leaderboard for challenge {challenge_id}",
                {"error": str(e), "challenge_id": challenge_id},
            )
            return []


# Global instance
challenge_service = ChallengeService()
