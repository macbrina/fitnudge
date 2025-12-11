from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date, timedelta
from app.core.flexible_auth import get_current_user
from app.core.daily_motivation_styles import (
    BACKGROUND_STYLE_NAMES,
    BACKGROUND_STYLE_METADATA,
    get_available_styles_for_ai,
)
import random

router = APIRouter(
    redirect_slashes=False
)  # Disable redirects to preserve Authorization header


# Pydantic models
class DailyMotivationResponse(BaseModel):
    id: str
    user_id: str
    message: str
    background_style: str
    background_colors: List[str]  # Color array for the gradient
    date: str
    generated_at: str
    share_count: int
    created_at: str


class DailyMotivationListResponse(BaseModel):
    motivations: List[DailyMotivationResponse]
    total: int


def get_user_context_for_motivation(supabase, user_id: str) -> dict:
    """Get user context for AI motivation generation - includes actual goal details"""
    from datetime import datetime, timedelta

    # Get user info
    user_result = supabase.table("users").select("*").eq("id", user_id).execute()
    user = user_result.data[0] if user_result.data else None

    # Get active goals with full details (title, category, description)
    goals_result = (
        supabase.table("goals")
        .select("id, title, category, description, is_active")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
    )
    active_goals_list = goals_result.data or []
    active_goals_count = len(active_goals_list)

    # Get check-ins stats
    checkins_result = (
        supabase.table("check_ins")
        .select("date, completed")
        .eq("user_id", user_id)
        .execute()
    )

    total_check_ins = len(checkins_result.data)
    completed_check_ins = len([c for c in checkins_result.data if c["completed"]])

    # Calculate current streak
    current_streak = 0
    sorted_checkins = sorted(
        checkins_result.data, key=lambda x: x["date"], reverse=True
    )
    temp_streak = 0
    for checkin in sorted_checkins:
        if checkin["completed"]:
            temp_streak += 1
            current_streak = max(current_streak, temp_streak)
        else:
            break

    # Get recent check-ins (last 7 days)
    seven_days_ago = (datetime.now() - timedelta(days=7)).date()
    recent_checkins = [
        c
        for c in checkins_result.data
        if datetime.fromisoformat(c["date"]).date() >= seven_days_ago
    ]
    recent_completed = len([c for c in recent_checkins if c["completed"]])

    # Build goal details for AI context
    goal_details = []
    for goal in active_goals_list:
        goal_info = {
            "title": goal.get("title", ""),
            "category": goal.get("category", "general"),
            "description": goal.get("description", ""),
        }
        goal_details.append(goal_info)

    context = {
        "user_name": user["name"] if user else "Champion",
        "active_goals_count": active_goals_count,
        "active_goals": goal_details,  # Full goal details for AI
        "total_check_ins": total_check_ins,
        "completed_check_ins": completed_check_ins,
        "current_streak": current_streak,
        "recent_completed": recent_completed,
        "recent_total": len(recent_checkins),
    }

    return context


def generate_daily_motivation_ai(
    supabase, user_id: str, context: dict, is_regeneration: bool = False
) -> tuple:
    """Generate AI-powered daily motivation message and optionally suggest background style

    Args:
        supabase: Supabase client
        user_id: User ID
        context: User context dictionary
        is_regeneration: If True, request a different/varied message

    Returns:
        tuple: (message, suggested_background_style) where suggested_background_style can be None
    """
    from app.core.config import settings
    from openai import OpenAI
    import json
    import random

    try:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        # Build goal details string
        goals_str = ""
        if context.get("active_goals"):
            goals_list = []
            for goal in context["active_goals"]:
                goal_str = f"- {goal['title']} ({goal['category']})"
                if goal.get("description"):
                    # Truncate long descriptions
                    desc = (
                        goal["description"][:200] + "..."
                        if len(goal.get("description", "")) > 200
                        else goal.get("description", "")
                    )
                    goal_str += f": {desc}"
                goals_list.append(goal_str)
            goals_str = "\n".join(goals_list)
        else:
            goals_str = "No active goals yet"

        # Build context string with actual goals
        context_str = f"""User: {context['user_name']}

ACTIVE GOALS:
{goals_str}

PROGRESS:
- Current Streak: {context['current_streak']} days
- Recent: {context['recent_completed']}/{context['recent_total']} check-ins completed in last 7 days
- Total Check-ins Completed: {context['completed_check_ins']}"""

        available_styles_info = get_available_styles_for_ai()

        system_prompt = """You are a world-class motivational writer creating shareable, inspiring quotes for a health and wellness accountability app.

YOUR MISSION: Create motivational messages that are so inspiring, users would want to screenshot and share them with friends.

CRITICAL RULES:
1. DO NOT use time-based greetings (Good morning, Good afternoon, Good evening) - the message should feel timeless
2. DO NOT use generic fitness phrases - be SPECIFIC to their actual goals (nutrition, exercise, mindset, etc.)
3. Create messages that sound like profound quotes from a wise mentor or coach
4. Keep it concise: 1-2 powerful sentences maximum
5. Make it personal by referencing their specific goal category and journey
6. The tone should be inspiring, authentic, and empowering - not cheesy or cliché
7. Focus on the deeper "why" behind their goals, not just the actions

STYLE INSPIRATION: Think of how great coaches like Phil Jackson, quotes from Stoic philosophers, or wellness thought leaders speak - timeless wisdom that applies to their specific journey.

You can also suggest an appropriate background gradient style based on the message mood."""

        # Add variation instruction if this is a regeneration
        regeneration_note = ""
        if is_regeneration:
            regeneration_note = "\n\nIMPORTANT: Generate a COMPLETELY DIFFERENT motivational message with fresh wording, different angles, or varied perspectives. Avoid repeating similar phrases or themes from previous messages. Be creative and bring new energy to this message!"

        # Add some randomness to the prompt for variation
        variation_angles = [
            "Focus on the compound effect of small daily choices",
            "Connect their goal to their deeper purpose and identity",
            "Celebrate consistency over perfection",
            "Remind them that every expert was once a beginner",
            "Emphasize self-compassion alongside discipline",
            "Inspire them with the transformation they're creating",
            "Focus on being better than yesterday, not perfect",
            "Connect nutrition/fitness to energy, clarity, and life quality",
        ]
        selected_angle = random.choice(variation_angles)

        user_prompt = f"""Create a shareable, inspiring motivational message for this user based on their ACTUAL goals:

{context_str}

Creative Direction: {selected_angle}
{regeneration_note}

Available background gradient styles:
{available_styles_info}

CRITICAL: You MUST respond with ONLY valid JSON in this exact format (no other text):
{{
  "message": "Your inspiring quote here - make it specific to their goals and shareable",
  "suggested_background_style": "gradient_sunset" or null
}}

Remember:
- NO time greetings (Good morning, etc.)
- Be SPECIFIC to their goal category (nutrition, fitness, mindset, etc.)
- Make it sound like a quote worth sharing
- Keep it to 1-2 powerful sentences

Return ONLY the JSON object, nothing else."""

        # Slightly increase temperature for regenerations to get more variation
        temperature = 1.0 if is_regeneration else 0.9

        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=200,
            temperature=temperature,
        )

        # Extract JSON from response (may contain extra text)
        response_text = response.choices[0].message.content.strip()

        # Try to find JSON in the response
        json_start = response_text.find("{")
        json_end = response_text.rfind("}") + 1

        if json_start != -1 and json_end > json_start:
            json_text = response_text[json_start:json_end]
            ai_response = json.loads(json_text)
        else:
            # Fallback: treat entire response as message
            ai_response = {"message": response_text, "suggested_background_style": None}

        ai_message = ai_response.get("message", "")
        suggested_style = ai_response.get("suggested_background_style")

        # Validate suggested style is valid
        if suggested_style and suggested_style not in BACKGROUND_STYLE_NAMES:
            suggested_style = None

        return ai_message, suggested_style

    except Exception as e:
        # Log the error for debugging
        import traceback

        print(f"ERROR in generate_daily_motivation_ai: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")

        # Fallback messages based on context
        if context["current_streak"] > 0:
            message = f"Keep that {context['current_streak']}-day streak going! Every day you show up is a win. You've got this! 💪"
        elif context["active_goals"] > 0:
            message = "Every journey begins with a single step. You've started, now let's keep the momentum going! 🌟"
        else:
            message = "Today is a fresh start. What small step will you take towards your goals? I believe in you! ✨"

        return message, None


@router.get("/today", response_model=DailyMotivationResponse)
async def get_today_daily_motivation(
    current_user: dict = Depends(get_current_user),
):
    """Get today's daily motivation, generate if it doesn't exist"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    today = date.today().isoformat()

    # Check if today's motivation already exists
    existing = (
        supabase.table("daily_motivations")
        .select("*")
        .eq("user_id", current_user["id"])
        .eq("date", today)
        .execute()
    )

    if existing.data:
        # Get colors for existing motivation
        existing_motivation = existing.data[0]
        style_metadata = BACKGROUND_STYLE_METADATA.get(
            existing_motivation["background_style"],
            BACKGROUND_STYLE_METADATA["gradient_sunset"],
        )
        existing_motivation["background_colors"] = style_metadata["colors"]
        return existing_motivation

    # Delete any existing motivation for today before generating (ensures clean state)
    supabase.table("daily_motivations").delete().eq("user_id", current_user["id"]).eq(
        "date", today
    ).execute()

    # Generate new motivation for today
    context = get_user_context_for_motivation(supabase, current_user["id"])
    ai_message, suggested_style = generate_daily_motivation_ai(
        supabase, current_user["id"], context, is_regeneration=False
    )

    # Use AI-suggested style or fall back to random selection
    if suggested_style:
        background_style = suggested_style
    else:
        # Select random background style based on time of day
        time_of_day = context.get("time_of_day", "afternoon")

        # Filter styles suitable for current time of day
        suitable_styles = [
            style_name
            for style_name in BACKGROUND_STYLE_NAMES
            if time_of_day in BACKGROUND_STYLE_METADATA[style_name]["suitable_for"]
            or "anytime" in BACKGROUND_STYLE_METADATA[style_name]["suitable_for"]
        ]

        # Fall back to all styles if none match
        if not suitable_styles:
            suitable_styles = BACKGROUND_STYLE_NAMES

        background_style = random.choice(suitable_styles)

    # Get colors for the selected style
    style_metadata = BACKGROUND_STYLE_METADATA[background_style]

    # Create daily motivation
    motivation = {
        "user_id": current_user["id"],
        "message": ai_message,
        "background_style": background_style,
        "date": today,
        "generated_at": datetime.utcnow().isoformat(),
    }

    result = supabase.table("daily_motivations").insert(motivation).execute()
    motivation_data = result.data[0]

    # Add colors to response
    motivation_data["background_colors"] = style_metadata["colors"]
    return motivation_data


@router.get("/", response_model=List[DailyMotivationResponse])
async def get_daily_motivations(
    current_user: dict = Depends(get_current_user),
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Get list of past daily motivations"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    result = (
        supabase.table("daily_motivations")
        .select("*")
        .eq("user_id", current_user["id"])
        .order("date", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    # Add colors to each motivation
    motivations = []
    for motivation in result.data:
        style_metadata = BACKGROUND_STYLE_METADATA.get(
            motivation["background_style"],
            BACKGROUND_STYLE_METADATA["gradient_sunset"],
        )
        motivation["background_colors"] = style_metadata["colors"]
        motivations.append(motivation)

    return motivations


@router.get("/{motivation_id}", response_model=DailyMotivationResponse)
async def get_daily_motivation(
    motivation_id: str, current_user: dict = Depends(get_current_user)
):
    """Get specific daily motivation by ID"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    result = (
        supabase.table("daily_motivations")
        .select("*")
        .eq("id", motivation_id)
        .eq("user_id", current_user["id"])
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Daily motivation not found"
        )

    motivation = result.data[0]
    # Add colors to response
    style_metadata = BACKGROUND_STYLE_METADATA.get(
        motivation["background_style"],
        BACKGROUND_STYLE_METADATA["gradient_sunset"],
    )
    motivation["background_colors"] = style_metadata["colors"]
    return motivation


@router.post("/{motivation_id}/share")
async def share_daily_motivation(
    motivation_id: str, current_user: dict = Depends(get_current_user)
):
    """Increment share count for a daily motivation"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Verify motivation exists and belongs to user
    motivation = (
        supabase.table("daily_motivations")
        .select("*")
        .eq("id", motivation_id)
        .eq("user_id", current_user["id"])
        .execute()
    )

    if not motivation.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Daily motivation not found"
        )

    # Increment share count
    current_count = motivation.data[0].get("share_count", 0)
    supabase.table("daily_motivations").update({"share_count": current_count + 1}).eq(
        "id", motivation_id
    ).execute()

    return {
        "message": "Motivation shared successfully",
        "share_count": current_count + 1,
    }


@router.post("/regenerate", response_model=DailyMotivationResponse)
async def regenerate_today_motivation(
    current_user: dict = Depends(get_current_user),
):
    """Regenerate today's daily motivation (requires unlimited_text_motivation feature)"""
    from app.core.database import get_supabase_client
    from app.core.subscriptions import check_user_has_feature

    supabase = get_supabase_client()

    # Check if user has unlimited_text_motivation feature
    user_plan = current_user.get("plan", "free")
    has_unlimited = check_user_has_feature(
        user_id=current_user["id"],
        feature_key="unlimited_text_motivation",
        user_plan=user_plan,
        supabase=supabase,
    )

    if not has_unlimited:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unlimited text motivation is required to regenerate daily motivations. Please upgrade your plan.",
        )

    today = date.today().isoformat()

    # Delete any existing motivation for today before generating (ensures clean state)
    supabase.table("daily_motivations").delete().eq("user_id", current_user["id"]).eq(
        "date", today
    ).execute()

    # Generate new motivation for today (mark as regeneration for variation)
    context = get_user_context_for_motivation(supabase, current_user["id"])
    ai_message, suggested_style = generate_daily_motivation_ai(
        supabase, current_user["id"], context, is_regeneration=True
    )

    # Use AI-suggested style or fall back to random selection
    if suggested_style:
        background_style = suggested_style
    else:
        # Select random background style based on time of day
        time_of_day = context.get("time_of_day", "afternoon")

        # Filter styles suitable for current time of day
        suitable_styles = [
            style_name
            for style_name in BACKGROUND_STYLE_NAMES
            if time_of_day in BACKGROUND_STYLE_METADATA[style_name]["suitable_for"]
            or "anytime" in BACKGROUND_STYLE_METADATA[style_name]["suitable_for"]
        ]

        # Fall back to all styles if none match
        if not suitable_styles:
            suitable_styles = BACKGROUND_STYLE_NAMES

        background_style = random.choice(suitable_styles)

    # Get colors for the selected style
    style_metadata = BACKGROUND_STYLE_METADATA[background_style]

    # Create daily motivation
    motivation = {
        "user_id": current_user["id"],
        "message": ai_message,
        "background_style": background_style,
        "date": today,
        "generated_at": datetime.utcnow().isoformat(),
    }

    result = supabase.table("daily_motivations").insert(motivation).execute()
    motivation_data = result.data[0]

    # Add colors to response
    motivation_data["background_colors"] = style_metadata["colors"]
    return motivation_data
