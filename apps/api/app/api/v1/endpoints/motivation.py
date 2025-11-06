from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.core.flexible_auth import get_current_user

router = APIRouter(
    redirect_slashes=False
)  # Disable redirects to preserve Authorization header


# Pydantic models
class MotivationGenerate(BaseModel):
    goal_id: Optional[str] = None
    tone: Optional[str] = "friendly"  # friendly, tough-love, calm
    context: Optional[str] = None


class MotivationResponse(BaseModel):
    id: str
    user_id: str
    goal_id: Optional[str]
    message: str
    message_type: str
    is_sent: bool
    scheduled_for: Optional[str]
    sent_at: Optional[str]
    created_at: str


class MotivationSchedule(BaseModel):
    goal_id: Optional[str] = None
    scheduled_for: datetime
    message: Optional[str] = None
    tone: Optional[str] = "friendly"


@router.post("/generate", response_model=MotivationResponse)
async def generate_motivation(
    motivation_data: MotivationGenerate, current_user: dict = Depends(get_current_user)
):
    """Generate AI motivational message"""
    from app.core.database import get_supabase_client
    from app.core.config import settings
    import openai

    supabase = get_supabase_client()

    # Get user's recent progress if goal_id provided
    context = ""
    if motivation_data.goal_id:
        # Get goal details
        goal = (
            supabase.table("goals")
            .select("*")
            .eq("id", motivation_data.goal_id)
            .eq("user_id", current_user["id"])
            .execute()
        )
        if goal.data:
            goal_info = goal.data[0]
            context += f"Goal: {goal_info['title']} - {goal_info['description']}\n"

            # Get recent check-ins
            checkins = (
                supabase.table("check_ins")
                .select("*")
                .eq("goal_id", motivation_data.goal_id)
                .order("date", desc=True)
                .limit(7)
                .execute()
            )
            if checkins.data:
                completed_count = sum(1 for c in checkins.data if c["completed"])
                context += f"Recent progress: {completed_count}/{len(checkins.data)} days completed\n"

    # Add user context
    context += f"User: {current_user['name']}, Plan: {current_user['plan']}\n"
    if motivation_data.context:
        context += f"Additional context: {motivation_data.context}\n"

    # Generate AI motivation using OpenAI
    try:
        openai.api_key = settings.OPENAI_API_KEY

        system_prompt = f"""You are a friendly motivational coach specializing in fitness consistency.
Your job is to keep the user emotionally engaged and accountable.
Personalize each message using the user's goal and recent performance.
Tone: {motivation_data.tone}
Always end with a short emotional nudge."""

        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"Generate a motivational message for this user:\n{context}",
                },
            ],
            max_tokens=150,
            temperature=0.8,
        )

        ai_message = response.choices[0].message.content.strip()

    except Exception as e:
        # Fallback message if AI fails
        ai_message = "You're doing amazing! Every step forward counts. Keep pushing towards your goals! 💪"

    # Store motivation in database
    motivation = {
        "user_id": current_user["id"],
        "goal_id": motivation_data.goal_id,
        "message": ai_message,
        "message_type": "ai",
        "is_sent": False,
    }

    result = supabase.table("motivations").insert(motivation).execute()
    return result.data[0]


@router.post(
    "/schedule", response_model=MotivationResponse, status_code=status.HTTP_201_CREATED
)
async def schedule_motivation(
    schedule_data: MotivationSchedule, current_user: dict = Depends(get_current_user)
):
    """Schedule a motivational message"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Verify goal belongs to user if provided
    if schedule_data.goal_id:
        goal = (
            supabase.table("goals")
            .select("*")
            .eq("id", schedule_data.goal_id)
            .eq("user_id", current_user["id"])
            .execute()
        )
        if not goal.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
            )

    motivation = {
        "user_id": current_user["id"],
        "goal_id": schedule_data.goal_id,
        "message": schedule_data.message,
        "message_type": "ai",
        "is_sent": False,
        "scheduled_for": schedule_data.scheduled_for.isoformat(),
    }

    result = supabase.table("motivations").insert(motivation).execute()
    return result.data[0]


@router.get("/", response_model=List[MotivationResponse])
async def get_motivations(
    current_user: dict = Depends(get_current_user),
    goal_id: Optional[str] = None,
    sent_only: bool = False,
):
    """Get user's motivational messages"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    query = supabase.table("motivations").select("*").eq("user_id", current_user["id"])

    if goal_id:
        query = query.eq("goal_id", goal_id)

    if sent_only:
        query = query.eq("is_sent", True)

    result = query.order("created_at", desc=True).execute()
    return result.data


@router.get("/{motivation_id}", response_model=MotivationResponse)
async def get_motivation(
    motivation_id: str, current_user: dict = Depends(get_current_user)
):
    """Get specific motivation by ID"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    result = (
        supabase.table("motivations")
        .select("*")
        .eq("id", motivation_id)
        .eq("user_id", current_user["id"])
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Motivation not found"
        )

    return result.data[0]


@router.post("/{motivation_id}/send")
async def send_motivation(
    motivation_id: str, current_user: dict = Depends(get_current_user)
):
    """Manually send a scheduled motivation"""
    from app.core.database import get_supabase_client
    from app.core.notifications import send_push_notification

    supabase = get_supabase_client()

    # Get motivation
    motivation = (
        supabase.table("motivations")
        .select("*")
        .eq("id", motivation_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not motivation.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Motivation not found"
        )

    motivation_data = motivation.data[0]

    if motivation_data["is_sent"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Motivation already sent"
        )

    # Send push notification
    try:
        await send_push_notification(
            user_id=current_user["id"],
            title="💪 Your Daily Motivation",
            body=motivation_data["message"],
            data={"type": "motivation", "motivation_id": motivation_id},
        )

        # Mark as sent
        supabase.table("motivations").update(
            {"is_sent": True, "sent_at": datetime.utcnow().isoformat()}
        ).eq("id", motivation_id).execute()

        return {"message": "Motivation sent successfully"}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send motivation",
        )


@router.delete("/{motivation_id}")
async def delete_motivation(
    motivation_id: str, current_user: dict = Depends(get_current_user)
):
    """Delete a motivation"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Check if motivation exists and belongs to user
    motivation = (
        supabase.table("motivations")
        .select("*")
        .eq("id", motivation_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not motivation.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Motivation not found"
        )

    supabase.table("motivations").delete().eq("id", motivation_id).execute()
    return {"message": "Motivation deleted successfully"}
