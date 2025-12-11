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
        is_public: bool = True,
        max_participants: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Create a new challenge.

        Args:
            user_id: User creating the challenge
            title: Challenge title
            description: Challenge description
            challenge_type: Type of challenge (streak, checkin_count, community, custom)
            duration_days: Challenge duration in days
            start_date: Start date
            is_public: Whether challenge is public
            max_participants: Maximum participants (None for unlimited)
            metadata: Additional challenge data

        Returns:
            Created challenge data
        """
        supabase = get_supabase_client()

        try:
            # Calculate end date
            end_date = start_date + timedelta(days=duration_days - 1)

            challenge = {
                "title": title,
                "description": description,
                "challenge_type": challenge_type,
                "duration_days": duration_days,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "is_public": is_public,
                "is_active": True,
                "max_participants": max_participants,
                "created_by": user_id,
                "metadata": metadata or {},
            }

            result = supabase.table("challenges").insert(challenge).execute()

            if result.data:
                print(
                    f"Created challenge '{title}' by user {user_id}",
                    {
                        "challenge_id": result.data[0]["id"],
                        "user_id": user_id,
                        "duration_days": duration_days,
                    },
                )
                return result.data[0]

            raise Exception("Failed to create challenge")

        except Exception as e:
            logger.error(
                f"Failed to create challenge for user {user_id}",
                {"error": str(e), "user_id": user_id, "title": title},
            )
            raise

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
                .eq("is_active", True)
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

            # Join challenge
            participant = {
                "challenge_id": challenge_id,
                "user_id": user_id,
                "goal_id": goal_id,
                "progress_data": {},
                "points": 0,
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
                .select("id, date, completed")
                .eq("user_id", user_id)
                .eq("completed", True)
                .gte("date", challenge_start.isoformat())
                .lte("date", challenge_end.isoformat())
            )

            if goal_id:
                query = query.eq("goal_id", goal_id)

            check_ins_result = query.execute()
            check_ins = check_ins_result.data or []

            # Calculate progress based on challenge type
            progress_data = {}
            points = 0

            if challenge_data["challenge_type"] == "streak":
                # Calculate current streak
                current_streak = await self._calculate_streak(check_ins)
                progress_data["current_streak"] = current_streak
                points = current_streak * 10  # 10 points per day of streak

            elif challenge_data["challenge_type"] == "checkin_count":
                # Count total check-ins
                count = len(check_ins)
                progress_data["checkin_count"] = count
                points = count * 5  # 5 points per check-in

            elif challenge_data["challenge_type"] == "community":
                # Combined metrics
                streak = await self._calculate_streak(check_ins)
                count = len(check_ins)
                progress_data["current_streak"] = streak
                progress_data["checkin_count"] = count
                points = (streak * 10) + (count * 5)

            # Update participant
            update_data = {
                "progress_data": progress_data,
                "points": points,
            }

            # Check if challenge is completed
            if challenge_data["challenge_type"] == "streak":
                target_streak = challenge_data.get("metadata", {}).get(
                    "target_streak", challenge_data["duration_days"]
                )
                if current_streak >= target_streak:
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
        """Calculate current streak from check-ins"""
        if not check_ins:
            return 0

        # Sort by date descending
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
        today = date.today()
        current_date = today

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

    async def _update_leaderboard(self, challenge_id: str) -> None:
        """Update challenge leaderboard"""
        supabase = get_supabase_client()

        try:
            # Get all participants ordered by points
            participants = (
                supabase.table("challenge_participants")
                .select("user_id, points, progress_data")
                .eq("challenge_id", challenge_id)
                .order("points", desc=True)
                .execute()
            )

            if not participants.data:
                return

            # Clear existing leaderboard
            supabase.table("challenge_leaderboard").delete().eq(
                "challenge_id", challenge_id
            ).execute()

            # Create new leaderboard entries
            leaderboard_entries = []
            for rank, participant in enumerate(participants.data, start=1):
                leaderboard_entries.append(
                    {
                        "challenge_id": challenge_id,
                        "user_id": participant["user_id"],
                        "rank": rank,
                        "points": participant.get("points", 0),
                        "progress_data": participant.get("progress_data", {}),
                    }
                )

            if leaderboard_entries:
                supabase.table("challenge_leaderboard").insert(
                    leaderboard_entries
                ).execute()

            print(
                f"Updated leaderboard for challenge {challenge_id}",
                {
                    "challenge_id": challenge_id,
                    "participant_count": len(leaderboard_entries),
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
        is_active: Optional[bool] = True,
    ) -> List[Dict[str, Any]]:
        """
        Get available challenges.

        Args:
            user_id: Optional user ID to filter user's challenges
            is_public: Filter by public status
            is_active: Filter by active status

        Returns:
            List of challenges
        """
        supabase = get_supabase_client()

        try:
            query = supabase.table("challenges").select("*")

            if is_public is not None:
                query = query.eq("is_public", is_public)

            if is_active is not None:
                query = query.eq("is_active", is_active)

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

    async def get_challenge_leaderboard(
        self, challenge_id: str, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get challenge leaderboard.

        Args:
            challenge_id: Challenge ID
            limit: Maximum number of entries to return

        Returns:
            List of leaderboard entries
        """
        supabase = get_supabase_client()

        try:
            result = (
                supabase.table("challenge_leaderboard")
                .select("*, users(id, name, username, profile_picture_url)")
                .eq("challenge_id", challenge_id)
                .order("rank")
                .limit(limit)
                .execute()
            )

            return result.data or []

        except Exception as e:
            logger.error(
                f"Failed to get leaderboard for challenge {challenge_id}",
                {"error": str(e), "challenge_id": challenge_id},
            )
            return []


# Global instance
challenge_service = ChallengeService()
