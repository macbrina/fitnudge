"""
Push Notification Motivation Generator

Generates SHORT, concise REMINDER messages specifically designed for push notifications.
Different from daily_motivations which are longer, more detailed messages for in-app display.

Push notifications appear on lock screen and need to be:
- Title: 4-6 words max, MUST include activity/goal name
- Body: 15-20 words, personalized reminder of what to DO
- Glanceable and actionable - answer "What should I be doing right now?"
"""

from openai import OpenAI
from app.core.config import settings
import json
import random


def generate_push_notification_ai(
    goal_title: str,
    user_context: dict,
    motivation_style: str = "supportive",
    item_type: str = "goal",
) -> dict:
    """
    Generate SHORT push notification REMINDER for goals/challenges.
    Optimized for mobile push notifications (lock screen display).

    Args:
        goal_title: The goal/challenge title (e.g., "Cardio Challenge", "Learn Spanish")
        user_context: Dict with:
            - current_streak: int
            - recent_completed: int
            - recent_total: int (usually 7)
            - time_of_day: "morning" | "afternoon" | "evening"
            - user_name: str
            - day_number: int (which day of the goal/challenge)
            - total_days: int (total duration if applicable)
            - progress_percent: float (0-100)
        motivation_style: User's preferred motivation style
            Options: "tough_love", "supportive", "data_driven", "balanced"
        item_type: "goal" or "challenge"

    Returns:
        dict: {
            "title": "Short title (4-6 words) WITH activity name",
            "body": "Personalized reminder (15-20 words)"
        }
    """
    try:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        # Extract context
        streak = user_context.get("current_streak", 0)
        recent_completed = user_context.get("recent_completed", 0)
        recent_total = user_context.get("recent_total", 7)
        time_of_day = user_context.get("time_of_day", "day")
        user_name = user_context.get("user_name", "there")
        day_number = user_context.get("day_number", 0)
        total_days = user_context.get("total_days", 0)
        progress_percent = user_context.get("progress_percent", 0)

        # Map motivation styles to coaching tones
        style_descriptions = {
            "tough_love": """Direct and challenging. Push them to action immediately.
Be firm, urgent, and believe in them. No sugar-coating. Make them feel they MUST act now.""",
            "supportive": """Warm and encouraging. Gently remind them it's time.
Make them feel supported and capable. Use positive, uplifting language.""",
            "data_driven": """Focus on progress, metrics, and achievements.
Use numbers, percentages, streaks. Appeal to their logical side with concrete data.""",
            "balanced": """Mix reminder with encouragement. Clear but warm.
Balance facts with motivation. Professional yet friendly tone.""",
        }

        style_instruction = style_descriptions.get(
            motivation_style, style_descriptions["supportive"]
        )

        # Build progress context
        progress_context = ""
        if item_type == "challenge" and total_days > 0:
            progress_context = f"""
Progress Info:
- Day {day_number} of {total_days}
- {progress_percent:.0f}% complete
- {total_days - day_number} days remaining"""
        elif streak > 0:
            progress_context = f"""
Streak Info:
- Current streak: {streak} days
- Recent: {recent_completed}/{recent_total} days completed"""
        elif day_number > 0:
            progress_context = f"""
Progress:
- Day {day_number} of their journey"""

        # Random variety seed to encourage different outputs
        variety_hints = [
            "Focus on the excitement of making progress today.",
            "Emphasize the importance of consistency.",
            "Highlight what they'll achieve by completing this.",
            "Make it feel personal and urgent.",
            "Connect to their long-term goals.",
            "Remind them how good they'll feel after.",
            "Create a sense of momentum.",
            "Celebrate how far they've come.",
        ]
        variety_hint = random.choice(variety_hints)

        system_prompt = f"""You are a personal coach creating REMINDER push notifications.
Your coaching style is: {motivation_style.upper()}

{style_instruction}

CRITICAL REQUIREMENTS:
1. Title (4-6 words): MUST include "[goal_title]" or a clear reference to the activity
2. Body (15-20 words): Personalized reminder that tells them WHAT to do and WHY it matters
3. Include their name ({user_name}) naturally in the body
4. Use 1-2 emojis MAX, typically in title only
5. BE CREATIVE AND VARIED - never use the same patterns repeatedly

VARIETY HINT FOR THIS NOTIFICATION: {variety_hint}

THIS IS A REMINDER, NOT GENERIC MOTIVATION. The user should think "Oh right, I need to do [activity]!"

❌ AVOID these overused patterns:
- "Rise and shine" / "Good morning"
- "Time to [activity]!" as the only body
- Generic phrases like "You've got this!" without context
- Same sentence structures every time

✅ VARIED examples (notice different structures):
- Title: "🎯 [goal_title] Awaits!" / Body: "Hey [name], day [X] is ready for you. Take 15 minutes now and keep your [streak]-day momentum going strong!"
- Title: "💪 Don't Skip [goal_title]!" / Body: "[name], you're [X]% through this journey. Today's session will push you even closer to your goal!"
- Title: "📈 [goal_title] Progress" / Body: "Quick reminder [name] - completing today means [X] days in a row. Your future self will thank you!"
- Title: "🔥 [goal_title] Check" / Body: "[name], have you tackled [goal_title] yet? You're too close to your goal to slow down now!"
- Title: "⚡ [goal_title] Time" / Body: "This is your nudge, [name]. [goal_title] won't complete itself, and you're capable of crushing it today!"

Adapt tone for time of day ({time_of_day}):
- Morning: [energizing start, set intention for the day]
- Afternoon: [midday check-in, still time to complete]
- Evening: [last chance, wrap up the day strong]

Generate UNIQUE content - avoid repeating the same phrases across notifications."""

        context_str = f"""{item_type.title()}: "{goal_title}"
User name: {user_name}
Time of day: {time_of_day}
{progress_context}"""

        user_prompt = f"""{context_str}

Generate a UNIQUE reminder notification that:
1. Has title with "{goal_title}" or clear activity reference (4-6 words)
2. Has body that reminds {user_name} what to DO with context (15-20 words)
3. Matches your {motivation_style} coaching style
4. Uses the variety hint: "{variety_hint}"
5. Feels fresh and different from typical notifications

Return ONLY valid JSON (no markdown):
{{
  "title": "4-6 words with activity name and emoji",
  "body": "15-20 word personalized reminder with {user_name}'s name"
}}"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=150,  # Increased for longer body
            temperature=0.95,  # Higher for more variety
        )

        response_text = response.choices[0].message.content.strip()

        # Extract JSON (handle markdown code blocks)
        response_text = response_text.replace("```json", "").replace("```", "")
        json_start = response_text.find("{")
        json_end = response_text.rfind("}") + 1

        if json_start != -1 and json_end > json_start:
            json_text = response_text[json_start:json_end]
            result = json.loads(json_text)

            title = result.get("title", "")[:50]
            body = result.get("body", "")[:150]  # Increased for 15-20 words

            if title and body:
                return {"title": title, "body": body}

        raise ValueError("Failed to parse AI response")

    except Exception as e:
        print(f"ERROR in generate_push_notification_ai: {str(e)}")
        return _get_fallback_notification(
            goal_title, user_context, motivation_style, item_type
        )


def _get_fallback_notification(
    goal_title: str,
    user_context: dict,
    motivation_style: str,
    item_type: str,
) -> dict:
    """
    Generate varied fallback notifications when AI fails.
    Uses randomization to avoid repetitive patterns.
    """
    time_of_day = user_context.get("time_of_day", "day")
    streak = user_context.get("current_streak", 0)
    user_name = user_context.get("user_name", "there")
    day_number = user_context.get("day_number", 0)
    progress_percent = user_context.get("progress_percent", 0)

    # Fallback templates with variety
    tough_love_templates = [
        {
            "title": f"⚡ {goal_title} Now!",
            "body": f"No more waiting, {user_name}. Your {goal_title} won't complete itself - get started right now and prove you're serious!",
        },
        {
            "title": f"💪 Stop Scrolling, {user_name}!",
            "body": f"Your {goal_title} is calling. Every minute you delay is a minute wasted. Take action now and show up for yourself!",
        },
        {
            "title": f"🔥 {goal_title} Check!",
            "body": f"{user_name}, have you done your {goal_title} yet? Don't let today be the day you break your commitment. Move!",
        },
    ]

    supportive_templates = [
        {
            "title": f"🌟 {goal_title} Time!",
            "body": f"Hey {user_name}, just a friendly reminder about your {goal_title}. You've been doing great, and today is another chance to shine!",
        },
        {
            "title": f"💫 {goal_title} Awaits!",
            "body": f"{user_name}, your {goal_title} is waiting for you. Take a moment when you can, and remember - every small step counts!",
        },
        {
            "title": f"✨ {goal_title} Reminder",
            "body": f"Thinking of you, {user_name}! Your {goal_title} is ready whenever you are. You've got the strength to make it happen today!",
        },
    ]

    data_driven_templates = [
        {
            "title": f"📊 {goal_title} Day {day_number or streak + 1}",
            "body": f"{user_name}, you're {progress_percent:.0f}% through your journey. Complete today's {goal_title} to maintain your progress and build momentum!",
        },
        {
            "title": f"📈 {goal_title} Stats",
            "body": f"Data check, {user_name}: {streak} day streak active. One more {goal_title} session keeps your consistency metrics strong!",
        },
        {
            "title": f"🎯 {goal_title} Tracking",
            "body": f"{user_name}, your {goal_title} completion rate needs today's check-in. Log your progress to keep your data accurate and motivating!",
        },
    ]

    balanced_templates = [
        {
            "title": f"📌 {goal_title} Nudge",
            "body": f"Quick reminder, {user_name} - your {goal_title} is on the agenda today. Find a moment to make progress and keep moving forward!",
        },
        {
            "title": f"🎯 {goal_title} Check-in",
            "body": f"{user_name}, this is your {goal_title} reminder. Whether it's 5 minutes or 50, any progress today is a win worth celebrating!",
        },
        {
            "title": f"⭐ {goal_title} Today",
            "body": f"Hey {user_name}, don't forget about {goal_title} today. A little effort now means big results over time. You've got this!",
        },
    ]

    # Select template based on style
    templates = {
        "tough_love": tough_love_templates,
        "supportive": supportive_templates,
        "data_driven": data_driven_templates,
        "balanced": balanced_templates,
    }

    selected_templates = templates.get(motivation_style, balanced_templates)
    return random.choice(selected_templates)
