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
    """Get user context for AI motivation generation - includes goals, challenges, group goals, and user preferences"""
    from datetime import datetime, timedelta

    today = date.today()

    # Get user info
    user_result = supabase.table("users").select("*").eq("id", user_id).execute()
    user = user_result.data[0] if user_result.data else None

    # Get user fitness profile for motivation style
    motivation_style = "gentle_encouragement"  # default
    fitness_profile = None
    try:
        profile_result = (
            supabase.table("user_fitness_profiles")
            .select("*")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if profile_result.data:
            fitness_profile = profile_result.data
            motivation_style = fitness_profile.get("motivation_style", "friendly")
    except Exception:
        pass

    # =========================================
    # 1. Get active goals
    # =========================================
    goals_result = (
        supabase.table("goals")
        .select("id, title, category, description, is_active")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
    )
    personal_goals = goals_result.data or []

    # =========================================
    # 3. Get active challenges user participates in
    # =========================================
    active_challenges = []
    try:
        participant_result = (
            supabase.table("challenge_participants")
            .select(
                "challenge_id, challenges(id, title, description, start_date, end_date, is_active)"
            )
            .eq("user_id", user_id)
            .execute()
        )
        for participation in participant_result.data or []:
            challenge = participation.get("challenges")
            if not challenge or not challenge.get("is_active"):
                continue
            # Check if challenge is currently active (between start and end date)
            start_date = (
                date.fromisoformat(challenge["start_date"])
                if challenge.get("start_date")
                else None
            )
            end_date = (
                date.fromisoformat(challenge["end_date"])
                if challenge.get("end_date")
                else None
            )
            if start_date and today < start_date:
                continue  # Not started yet
            if end_date and today > end_date:
                continue  # Already ended
            active_challenges.append(challenge)
    except Exception:
        pass

    # =========================================
    # 4. Calculate combined streak from goals AND challenges
    # =========================================
    all_checkin_dates: set[str] = set()

    # Get completed goal check-ins
    try:
        goal_checkins_result = (
            supabase.table("check_ins")
            .select("date, completed")
            .eq("user_id", user_id)
            .eq("completed", True)
            .execute()
        )
        for checkin in goal_checkins_result.data or []:
            all_checkin_dates.add(checkin["date"])
    except Exception:
        pass

    # Get challenge check-ins (completed only)
    try:
        challenge_checkins_result = (
            supabase.table("challenge_check_ins")
            .select("check_in_date")
            .eq("user_id", user_id)
            .eq("completed", True)
            .execute()
        )
        for checkin in challenge_checkins_result.data or []:
            all_checkin_dates.add(checkin["check_in_date"])
    except Exception:
        pass

    # Calculate current streak from combined dates
    current_streak = 0
    if all_checkin_dates:
        check_date = today
        while check_date.isoformat() in all_checkin_dates:
            current_streak += 1
            check_date = check_date - timedelta(days=1)
        # If today not checked, check if streak continues from yesterday
        if current_streak == 0:
            check_date = today - timedelta(days=1)
            while check_date.isoformat() in all_checkin_dates:
                current_streak += 1
                check_date = check_date - timedelta(days=1)

    # =========================================
    # 5. Get recent stats (last 7 days)
    # =========================================
    seven_days_ago = (datetime.now() - timedelta(days=7)).date()
    recent_completed = sum(
        1 for d in all_checkin_dates if date.fromisoformat(d) >= seven_days_ago
    )
    total_check_ins = len(all_checkin_dates)

    # =========================================
    # 6. Build context for AI
    # =========================================
    # Personal goals details
    goal_details = [
        {
            "title": g.get("title", ""),
            "category": g.get("category", "general"),
            "description": g.get("description", ""),
        }
        for g in personal_goals
    ]

    # Challenge details
    challenge_details = [
        {"title": c.get("title", ""), "description": c.get("description", "")}
        for c in active_challenges
    ]

    # Map motivation style to description
    motivation_style_map = {
        "tough_love": "direct and challenging - push them hard with honest feedback",
        "gentle_encouragement": "warm and supportive - focus on progress and compassion",
        "data_driven": "analytical and metric-focused - use numbers and measurable progress",
        "accountability_buddy": "friendly but firm - like a supportive friend who keeps them on track",
    }
    motivation_style_description = motivation_style_map.get(
        motivation_style, "friendly and encouraging"
    )

    context = {
        "user_name": user["name"] if user else "Champion",
        # Goals
        "active_goals_count": len(personal_goals),
        "active_goals": goal_details,
        # Challenges
        "active_challenges_count": len(active_challenges),
        "active_challenges": challenge_details,
        # Stats
        "total_check_ins": total_check_ins,
        "current_streak": current_streak,
        "recent_completed": recent_completed,
        "recent_total": 7,  # Last 7 days
        # User preferences
        "motivation_style": motivation_style,
        "motivation_style_description": motivation_style_description,
        "fitness_level": (
            fitness_profile.get("fitness_level") if fitness_profile else None
        ),
        "biggest_challenge": (
            fitness_profile.get("biggest_challenge") if fitness_profile else None
        ),
    }

    return context


def generate_daily_motivation_ai(
    supabase, user_id: str, context: dict, is_regeneration: bool = False
) -> tuple:
    """Generate AI-powered daily motivation message and optionally suggest background style

    Args:
        supabase: Supabase client
        user_id: User ID
        context: User context dictionary (includes goals, challenges, group goals, motivation style)
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

        # Build personal goals string
        goals_str = ""
        if context.get("active_goals"):
            goals_list = []
            for goal in context["active_goals"]:
                goal_str = f"- {goal['title']} ({goal['category']})"
                if goal.get("description"):
                    desc = (
                        goal["description"][:150] + "..."
                        if len(goal.get("description", "")) > 150
                        else goal.get("description", "")
                    )
                    goal_str += f": {desc}"
                goals_list.append(goal_str)
            goals_str = "\n".join(goals_list)
        else:
            goals_str = "No personal goals yet"

        # Build challenges string
        challenges_str = ""
        if context.get("active_challenges"):
            challenge_list = []
            for challenge in context["active_challenges"]:
                challenge_str = f"- {challenge['title']}"
                if challenge.get("description"):
                    desc = (
                        challenge["description"][:100] + "..."
                        if len(challenge.get("description", "")) > 100
                        else challenge.get("description", "")
                    )
                    challenge_str += f": {desc}"
                challenge_list.append(challenge_str)
            challenges_str = "\n".join(challenge_list)
        else:
            challenges_str = "None"

        # Get motivation style
        motivation_style = context.get("motivation_style", "friendly")
        motivation_style_description = context.get(
            "motivation_style_description", "friendly and encouraging"
        )

        # Build context string with all data
        context_str = f"""User: {context['user_name']}

GOALS ({context.get('active_goals_count', 0)} active):
{goals_str}

ACTIVE CHALLENGES ({context.get('active_challenges_count', 0)} active):
{challenges_str}

PROGRESS:
- Current Streak: {context['current_streak']} days (combined goals + challenges)
- Recent: {context['recent_completed']}/{context['recent_total']} check-ins in last 7 days
- Total Check-ins: {context['total_check_ins']}

USER PREFERENCES:
- Motivation Style: {motivation_style} ({motivation_style_description})
- Biggest Challenge: {context.get('biggest_challenge', 'Not specified')}
- Fitness Level: {context.get('fitness_level', 'Not specified')}"""

        available_styles_info = get_available_styles_for_ai()

        # Customize system prompt based on motivation style
        tone_instructions = {
            "tough_love": "Be DIRECT and CHALLENGING. Push them hard with honest, no-nonsense feedback. Use phrases like 'No excuses', 'Get it done', 'Rise up'. Be the tough coach they need.",
            "gentle_encouragement": "Be WARM and SUPPORTIVE. Focus on their progress and show compassion for their journey. Use phrases like 'You're doing amazing', 'Every step counts', 'Be kind to yourself'. Be their encouraging friend.",
            "data_driven": "Be ANALYTICAL and METRIC-FOCUSED. Reference their numbers (streak, check-ins). Use phrases like 'Your data shows', 'X days of consistency', 'Measurable progress'. Be their performance analyst.",
            "accountability_buddy": "Be FRIENDLY but FIRM. Like a supportive friend who won't let them off the hook. Use phrases like 'I've got your back', 'Let's do this together', 'You promised yourself'. Be their accountability partner.",
        }
        tone_instruction = tone_instructions.get(
            motivation_style, "Be friendly and encouraging."
        )

        system_prompt = f"""You are a world-class motivational writer creating shareable, inspiring quotes for a health and wellness accountability app.

YOUR MISSION: Create motivational messages that are so inspiring, users would want to screenshot and share them with friends.

TONE INSTRUCTION (CRITICAL - match their preferred motivation style):
{tone_instruction}

CRITICAL RULES:
1. DO NOT use time-based greetings (Good morning, Good afternoon, Good evening) - the message should feel timeless
2. DO NOT use generic fitness phrases - be SPECIFIC to their actual goals, challenges, and group activities
3. Create messages that sound like profound quotes from a wise mentor or coach
4. Keep it concise: 1-2 powerful sentences maximum
5. Make it personal by referencing their specific goals, challenges, or group activities
6. If they have active challenges or group goals, occasionally reference the power of community/competition
7. Focus on the deeper "why" behind their goals, not just the actions
8. MATCH THEIR MOTIVATION STYLE - this is crucial for personalization

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
            "Reference their challenge or group goal for community motivation",
            "Emphasize self-compassion alongside discipline",
            "Inspire them with the transformation they're creating",
            "Focus on being better than yesterday, not perfect",
            "Connect their fitness journey to energy, clarity, and life quality",
            "Highlight the power of accountability and community",
            "Address their biggest challenge with encouragement",
        ]
        selected_angle = random.choice(variation_angles)

        user_prompt = f"""Create a shareable, inspiring motivational message for this user based on their ACTUAL goals, challenges, and preferences:

{context_str}

Creative Direction: {selected_angle}
{regeneration_note}

Available background gradient styles:
{available_styles_info}

CRITICAL: You MUST respond with ONLY valid JSON in this exact format (no other text):
{{
  "message": "Your inspiring quote here - match their {motivation_style} motivation style",
  "suggested_background_style": "gradient_sunset" or null
}}

Remember:
- NO time greetings (Good morning, etc.)
- MATCH their motivation style: {motivation_style_description}
- Be SPECIFIC to their goals, challenges, or group activities
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

        # Fallback messages based on context and motivation style
        motivation_style = context.get("motivation_style", "friendly")

        if context["current_streak"] > 0:
            if motivation_style == "tough_love":
                message = f"{context['current_streak']}-day streak. Don't break it now. Show up today like you mean it. 💪"
            elif motivation_style == "data_driven":
                message = f"Streak: {context['current_streak']} days. Your consistency data is building. Keep the metrics strong. 📊"
            else:
                message = f"Keep that {context['current_streak']}-day streak going! Every day you show up is a win. You've got this! 💪"
        elif (
            context.get("active_goals_count", 0) > 0
            or context.get("active_challenges_count", 0) > 0
        ):
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

    # Delete ALL existing motivations for this user before generating new one
    # Each user only keeps one motivation in the database at a time
    supabase.table("daily_motivations").delete().eq(
        "user_id", current_user["id"]
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

    # Delete ALL existing motivations for this user before regenerating
    # Each user only keeps one motivation in the database at a time
    supabase.table("daily_motivations").delete().eq(
        "user_id", current_user["id"]
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
