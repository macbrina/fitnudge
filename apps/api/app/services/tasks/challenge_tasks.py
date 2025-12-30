"""
Challenge Lifecycle Tasks

Celery tasks for challenge lifecycle management:
- Checking for ended challenges
- Deactivating completed challenges
- Calculating final rankings
- Sending winner notifications
"""

from datetime import date
from typing import Dict, Any, List
from app.services.tasks.base import celery_app, get_supabase_client, logger


@celery_app.task(
    name="check_ended_challenges",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def check_ended_challenges_task(self) -> Dict[str, Any]:
    """
    Periodic task to check for challenges that have ended.

    This task should be run daily (e.g., at midnight UTC or early morning).
    It finds all active challenges where end_date has passed,
    deactivates them, calculates final rankings, and sends notifications.

    Returns:
        Dict with count of processed challenges and any errors
    """
    import asyncio

    supabase = get_supabase_client()
    today = date.today()

    try:
        # Find active challenges that have ended
        ended_challenges = (
            supabase.table("challenges")
            .select("*")
            .eq("status", "active")
            .lt("end_date", today.isoformat())  # end_date < today
            .execute()
        )

        if not ended_challenges.data:
            print("✅ [CHALLENGE LIFECYCLE] No ended challenges to process")
            return {"success": True, "processed": 0, "errors": []}

        processed = 0
        errors = []

        for challenge in ended_challenges.data:
            try:
                _process_ended_challenge(supabase, challenge)
                processed += 1
            except Exception as e:
                error_msg = f"Failed to process challenge {challenge['id']}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)

        print(
            f"✅ [CHALLENGE LIFECYCLE] Processed {processed} ended challenges, {len(errors)} errors"
        )

        return {
            "success": True,
            "processed": processed,
            "errors": errors,
        }

    except Exception as e:
        logger.error(
            f"Failed to check ended challenges: {str(e)}",
            {"error": str(e), "retry_count": self.request.retries},
        )

        if self.request.retries >= self.max_retries:
            return {"success": False, "error": str(e)}

        raise self.retry(exc=e)


def _process_ended_challenge(supabase, challenge: Dict[str, Any]) -> None:
    """
    Process a single ended challenge:
    1. Calculate final rankings
    2. Deactivate the challenge
    3. Send notifications to participants
    """
    import asyncio

    challenge_id = challenge["id"]
    challenge_title = challenge.get("title", "Challenge")

    print(f"  📊 Processing ended challenge: {challenge_title} ({challenge_id})")

    # 1. Get all participants (membership only)
    participants_result = (
        supabase.table("challenge_participants")
        .select("id, user_id, user:users(id, display_name, email)")
        .eq("challenge_id", challenge_id)
        .execute()
    )
    participants = participants_result.data or []

    # 2. Get leaderboard entries (all scoring data)
    leaderboard_result = (
        supabase.table("challenge_leaderboard")
        .select("user_id, points, progress_data")
        .eq("challenge_id", challenge_id)
        .order("points", desc=True)
        .execute()
    )
    leaderboard_entries = leaderboard_result.data or []

    if not participants:
        print(f"    ⚠️ No participants in challenge {challenge_id}")
        # Still mark challenge as completed
        supabase.table("challenges").update(
            {
                "status": "completed",
                "metadata": {
                    **challenge.get("metadata", {}),
                    "completed": True,
                    "completed_at": date.today().isoformat(),
                },
            }
        ).eq("id", challenge_id).execute()

        # Cleanup pending invites and notifications
        from app.services.cleanup_service import (
            cleanup_challenge_invites_and_notifications_sync,
        )

        cleanup_challenge_invites_and_notifications_sync(
            supabase, challenge_id, reason="completed"
        )
        return

    # 3. Mark all participants as completed
    for participant in participants:
        supabase.table("challenge_participants").update(
            {"completed_at": date.today().isoformat()}
        ).eq("id", participant["id"]).execute()

    # 4. Update final ranks in leaderboard
    for rank, entry in enumerate(leaderboard_entries, start=1):
        supabase.table("challenge_leaderboard").update({"rank": rank}).eq(
            "challenge_id", challenge_id
        ).eq("user_id", entry["user_id"]).execute()

    # 5. Determine winner(s) - could be ties
    top_points = leaderboard_entries[0]["points"] if leaderboard_entries else 0
    winners = [e for e in leaderboard_entries if e["points"] == top_points]

    # 4. Update challenge metadata with results
    challenge_metadata = {
        **challenge.get("metadata", {}),
        "completed": True,
        "completed_at": date.today().isoformat(),
        "final_participant_count": len(participants),
        "winner_count": len(winners),
        "winner_ids": [w["user_id"] for w in winners],
        "top_score": top_points,
    }

    supabase.table("challenges").update(
        {
            "status": "completed",
            "metadata": challenge_metadata,
        }
    ).eq("id", challenge_id).execute()

    # Cleanup pending invites and notifications
    from app.services.cleanup_service import (
        cleanup_challenge_invites_and_notifications_sync,
    )

    cleanup_challenge_invites_and_notifications_sync(
        supabase, challenge_id, reason="completed"
    )

    print(f"    ✅ Completed challenge with {len(participants)} participants")

    # 5. Send notifications to all participants
    _send_challenge_completion_notifications(supabase, challenge, participants, winners)

    # 6. Notify all participants' partners that the challenge has ended
    from app.services.social_accountability_service import social_accountability_service

    participant_user_ids = [p["user_id"] for p in participants]
    social_accountability_service.notify_partners_for_multiple_users_sync(
        participant_user_ids, "challenge_completed"
    )


def _send_challenge_completion_notifications(
    supabase,
    challenge: Dict[str, Any],
    participants: List[Dict[str, Any]],
    winners: List[Dict[str, Any]],
) -> None:
    """
    Send push notifications to all participants about challenge completion.
    """
    import asyncio
    from app.services.expo_push_service import send_push_to_user

    challenge_id = challenge["id"]
    challenge_title = challenge.get("title", "Challenge")
    winner_ids = set(w["user_id"] for w in winners)

    # Get all scoring data from leaderboard
    leaderboard_result = (
        supabase.table("challenge_leaderboard")
        .select("user_id, rank, points")
        .eq("challenge_id", challenge_id)
        .execute()
    )
    leaderboard_lookup = {
        entry["user_id"]: entry for entry in (leaderboard_result.data or [])
    }

    # Get or create event loop
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    for participant in participants:
        user_id = participant["user_id"]
        user_name = participant.get("user", {}).get("display_name", "Participant")
        leaderboard_entry = leaderboard_lookup.get(user_id, {})
        rank = leaderboard_entry.get("rank", 0)
        points = leaderboard_entry.get("points", 0)
        is_winner = user_id in winner_ids

        # Customize message based on result
        if is_winner:
            if len(winners) == 1:
                title = "🏆 You Won!"
                body = f'Congratulations! You won "{challenge_title}" with {points} points!'
            else:
                title = "🏆 It's a Tie!"
                body = f'You tied for 1st place in "{challenge_title}" with {points} points!'
        else:
            title = "🏁 Challenge Complete!"
            body = f'"{challenge_title}" has ended. You finished #{rank} with {points} points.'

        try:
            loop.run_until_complete(
                send_push_to_user(
                    user_id=user_id,
                    title=title,
                    body=body,
                    data={
                        "type": "challenge_completed",
                        "challengeId": challenge_id,
                        "rank": rank,
                        "points": points,
                        "isWinner": is_winner,
                        "deepLink": f"/(user)/challenges/{challenge_id}",
                    },
                    notification_type="challenge",
                    entity_type="challenge",
                    entity_id=challenge_id,
                )
            )
            print(f"    📬 Sent completion notification to {user_name} (rank #{rank})")
        except Exception as e:
            logger.warning(
                f"Failed to send challenge completion notification",
                {
                    "error": str(e),
                    "user_id": user_id,
                    "challenge_id": challenge_id,
                },
            )


@celery_app.task(
    name="send_challenge_reminder",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
)
def send_challenge_reminder_task(
    self, challenge_id: str, message_type: str = "ending_soon"
) -> Dict[str, Any]:
    """
    Send reminder notifications to challenge participants.

    Args:
        challenge_id: Challenge ID
        message_type: Type of reminder (ending_soon, check_in_prompt, etc.)

    Returns:
        Dict with notification results
    """
    import asyncio
    from app.services.expo_push_service import send_push_to_user

    supabase = get_supabase_client()

    try:
        # Get challenge
        challenge_result = (
            supabase.table("challenges")
            .select("*")
            .eq("id", challenge_id)
            .in_("status", ["upcoming", "active"])
            .maybe_single()
            .execute()
        )

        if not challenge_result.data:
            return {"success": False, "error": "Challenge not found or inactive"}

        challenge = challenge_result.data
        challenge_title = challenge.get("title", "Challenge")

        # Get participants
        participants = (
            supabase.table("challenge_participants")
            .select("user_id")
            .eq("challenge_id", challenge_id)
            .execute()
        )

        if not participants.data:
            return {"success": True, "sent": 0}

        # Get or create event loop
        try:
            loop = asyncio.get_event_loop()
            if loop.is_closed():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        # Determine message based on type
        if message_type == "ending_soon":
            end_date = challenge.get("end_date", "soon")
            title = "⏰ Challenge Ending Soon!"
            body = f'"{challenge_title}" ends on {end_date}. Make sure to complete your check-ins!'
        elif message_type == "final_day":
            title = "🏁 Final Day!"
            body = f'Today is the last day of "{challenge_title}". Give it your all!'
        else:
            title = "💪 Challenge Reminder"
            body = f'Don\'t forget to check in for "{challenge_title}"!'

        # SCALABILITY: For large challenges, use chunked task dispatch
        user_ids = [p["user_id"] for p in participants.data if p.get("user_id")]

        INLINE_THRESHOLD = 10
        if len(user_ids) <= INLINE_THRESHOLD:
            # Small number - process inline
            sent_count = 0
            for user_id in user_ids:
                try:
                    loop.run_until_complete(
                        send_push_to_user(
                            user_id=user_id,
                            title=title,
                            body=body,
                            data={
                                "type": "challenge_reminder",
                                "challengeId": challenge_id,
                                "messageType": message_type,
                                "deepLink": f"/(user)/challenges/{challenge_id}",
                            },
                            notification_type="challenge",
                            entity_type="challenge",
                            entity_id=challenge_id,
                        )
                    )
                    sent_count += 1
                except Exception as e:
                    logger.warning(
                        f"Failed to send challenge reminder",
                        {
                            "error": str(e),
                            "user_id": user_id,
                            "challenge_id": challenge_id,
                        },
                    )
            return {"success": True, "sent": sent_count}
        else:
            # Large number - dispatch chunked tasks
            from app.services.tasks.task_utils import dispatch_chunked_tasks

            result = dispatch_chunked_tasks(
                task=send_challenge_reminder_chunk_task,
                items=user_ids,
                chunk_size=50,
                challenge_id=challenge_id,
                title=title,
                body=body,
                message_type=message_type,
            )
            return {
                "success": True,
                "dispatched": result["dispatched"],
                "total": len(user_ids),
            }

    except Exception as e:
        logger.error(
            f"Failed to send challenge reminders for {challenge_id}",
            {"error": str(e), "challenge_id": challenge_id},
        )

        if self.request.retries >= self.max_retries:
            return {"success": False, "error": str(e)}

        raise self.retry(exc=e)


@celery_app.task(
    name="check_challenges_ending_soon",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def check_challenges_ending_soon_task(self) -> Dict[str, Any]:
    """
    Periodic task to send reminders for challenges ending soon.

    Should be run daily. Sends reminders for:
    - Challenges ending tomorrow (final_day)
    - Challenges ending in 3 days (ending_soon)
    """
    from datetime import timedelta

    supabase = get_supabase_client()
    today = date.today()
    tomorrow = today + timedelta(days=1)
    three_days = today + timedelta(days=3)

    try:
        reminders_sent = 0

        # Find challenges ending tomorrow
        ending_tomorrow = (
            supabase.table("challenges")
            .select("id, title")
            .eq("status", "active")
            .eq("end_date", tomorrow.isoformat())
            .execute()
        )

        for challenge in ending_tomorrow.data or []:
            send_challenge_reminder_task.delay(challenge["id"], "final_day")
            reminders_sent += 1
            print(f"  📅 Queued final day reminder for: {challenge['title']}")

        # Find challenges ending in 3 days
        ending_soon = (
            supabase.table("challenges")
            .select("id, title")
            .eq("status", "active")
            .eq("end_date", three_days.isoformat())
            .execute()
        )

        for challenge in ending_soon.data or []:
            send_challenge_reminder_task.delay(challenge["id"], "ending_soon")
            reminders_sent += 1
            print(f"  📅 Queued ending soon reminder for: {challenge['title']}")

        print(f"✅ [CHALLENGE REMINDERS] Queued {reminders_sent} reminders")

        return {"success": True, "reminders_queued": reminders_sent}

    except Exception as e:
        logger.error(
            f"Failed to check challenges ending soon: {str(e)}",
            {"error": str(e)},
        )

        if self.request.retries >= self.max_retries:
            return {"success": False, "error": str(e)}

        raise self.retry(exc=e)


# =====================================================
# CHUNKED NOTIFICATION TASKS
# =====================================================


@celery_app.task(
    name="send_challenge_reminder_chunk",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def send_challenge_reminder_chunk_task(
    self,
    user_ids: list,
    challenge_id: str,
    title: str,
    body: str,
    message_type: str,
) -> dict:
    """
    Process a chunk of challenge reminder notifications.

    SCALABILITY: Called by send_challenge_reminder_task for challenges
    with many participants (10+).
    """
    import asyncio
    from app.services.expo_push_service import send_push_to_user

    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    sent_count = 0
    for user_id in user_ids:
        try:
            loop.run_until_complete(
                send_push_to_user(
                    user_id=user_id,
                    title=title,
                    body=body,
                    data={
                        "type": "challenge_reminder",
                        "challengeId": challenge_id,
                        "messageType": message_type,
                        "deepLink": f"/(user)/challenges/{challenge_id}",
                    },
                    notification_type="challenge",
                    entity_type="challenge",
                    entity_id=challenge_id,
                )
            )
            sent_count += 1
        except Exception as e:
            logger.warning(
                f"Failed to send challenge reminder in chunk",
                {"error": str(e), "user_id": user_id, "challenge_id": challenge_id},
            )

    return {"processed": len(user_ids), "sent": sent_count}
