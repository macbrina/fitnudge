"""
Push Notification Motivation Generator

Generates SHORT, concise REMINDER messages specifically designed for push notifications.
Different from daily_motivations which are longer, more detailed messages for in-app display.

Push notifications appear on lock screen and need to be:
- Title: 4-6 words max, MUST include activity name
- Body: One sentence, 10-15 words max, MUST remind what to DO
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
    Generate SHORT push notification REMINDER for fitness activities.
    Optimized for mobile push notifications (lock screen display).

    Args:
        goal_title: The goal/challenge title (e.g., "Cardio Challenge", "Morning Run")
        user_context: Dict with:
            - current_streak: int
            - recent_completed: int
            - recent_total: int (usually 7)
            - time_of_day: "morning" | "afternoon" | "evening"
            - user_name: str
            - day_number: int (which day of the goal/challenge)
            - total_days: int (total duration if applicable)
            - progress_percent: float (0-100)
        motivation_style: User's preferred motivation style from fitness profile
            Options: "tough_love", "supportive", "data_driven", "balanced"
        item_type: "goal" or "challenge"

    Returns:
        dict: {
            "title": "Short title (4-6 words) WITH activity name",
            "body": "Reminder of what to do (10-15 words)"
        }
    """
    try:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        # Extract context
        streak = user_context.get("current_streak", 0)
        recent_completed = user_context.get("recent_completed", 0)
        recent_total = user_context.get("recent_total", 7)
        time_of_day = user_context.get("time_of_day", "day")
        user_name = user_context.get("user_name", "Champion")
        day_number = user_context.get("day_number", 0)
        total_days = user_context.get("total_days", 0)
        progress_percent = user_context.get("progress_percent", 0)

        # Map motivation styles to coaching tones
        style_descriptions = {
            "tough_love": """Direct and challenging. Push them to action NOW.
Examples: "No excuses - Cardio time!", "Get moving on your workout NOW, no delays."
Be firm but believe in them. Make it urgent.""",
            "supportive": """Warm and encouraging. Gently remind them it's time.
Examples: "Time for your Cardio Challenge! You've got this!", "Your workout is calling - let's do this together!"
Make them feel supported while reminding them what to do.""",
            "data_driven": """Focus on progress and metrics. Use numbers.
Examples: "Day 8 of Cardio Challenge awaits!", "85% done - today's cardio session is next."
Use their progress to motivate action.""",
            "balanced": """Mix reminder with encouragement. Clear but warm.
Examples: "Cardio Challenge time - Day 8 awaits!", "Your workout is ready - let's make it count!"
Balance warmth with clear call to action.""",
        }

        style_instruction = style_descriptions.get(
            motivation_style, style_descriptions["supportive"]
        )

        # Build progress context
        progress_context = ""
        if item_type == "challenge" and total_days > 0:
            progress_context = f"""
Challenge Progress:
- Day {day_number} of {total_days}
- {progress_percent:.0f}% complete
- {total_days - day_number} days remaining"""
        elif streak > 0:
            progress_context = f"""
Streak Status:
- Current streak: {streak} days
- Recent: {recent_completed}/{recent_total} days completed"""
        elif day_number > 0:
            progress_context = f"""
Progress:
- Day {day_number} of your journey"""

        system_prompt = f"""You are a fitness coach creating REMINDER push notifications.
Your coaching style is: {motivation_style.upper()}

{style_instruction}

CRITICAL RULES - MUST FOLLOW:
1. Title (4-6 words): MUST include "{goal_title}" or a shortened version of the activity
2. Body (10-15 words): MUST remind them WHAT to do - this is a REMINDER, not just motivation
3. The user should think "Oh right, I need to do my [activity]!" when they see this
4. Use 1-2 emojis MAX, only in title
5. Include their name ({user_name}) in the body for personalization

THIS IS A REMINDER NOTIFICATION, NOT GENERIC MOTIVATION.

❌ BAD examples (too generic, no action):
- Title: "You've got this!" / Body: "Keep up the great work!"
- Title: "Stay strong!" / Body: "You're doing amazing!"
- Title: "Believe in yourself!" / Body: "You can do anything!"

✅ GOOD examples (specific activity + action reminder):
- Title: "🏃 Cardio Challenge Time!" / Body: "Day 8 is here - time for your cardio workout, {user_name}!"
- Title: "💪 Morning Run Reminder" / Body: "Your run is waiting, {user_name}. Lace up and let's go!"
- Title: "⏰ Workout Check-in" / Body: "Have you done your {goal_title} today? Time to move!"
- Title: "🔥 {goal_title} Day {day_number}" / Body: "Your fitness session awaits - don't skip today, {user_name}!"

The notification MUST answer: "What activity should I be doing right now?"

Time-appropriate tone:
- Morning: "Rise and shine - time for your [activity]!"
- Afternoon: "Afternoon check - your [activity] awaits!"
- Evening: "Evening reminder - complete your [activity] before bed!"""

        context_str = f"""{item_type.title()}: "{goal_title}"
User name: {user_name}
Time of day: {time_of_day}
{progress_context}"""

        user_prompt = f"""{context_str}

Generate a REMINDER push notification that:
1. Has title with "{goal_title}" or activity type (4-6 words)
2. Has body that reminds {user_name} what to DO (10-15 words)
3. Matches your {motivation_style} coaching style
4. Makes them think "Oh right, time for my workout!"

Return ONLY valid JSON (no markdown):
{{
  "title": "4-6 words with activity name and optional emoji",
  "body": "Reminder sentence with {user_name}'s name (10-15 words)"
}}"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=100,
            temperature=0.8,
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
            body = result.get("body", "")[:120]

            if title and body:
                return {"title": title, "body": body}

        raise ValueError("Failed to parse AI response")

    except Exception as e:
        print(f"ERROR in generate_push_notification_ai: {str(e)}")

        # Context-aware REMINDER fallback messages (not generic motivation)
        time_of_day = user_context.get("time_of_day", "day")
        streak = user_context.get("current_streak", 0)
        user_name = user_context.get("user_name", "Champion")
        day_number = user_context.get("day_number", 0)

        # Fallback messages that are REMINDERS, not generic motivation
        if motivation_style == "tough_love":
            if time_of_day == "morning":
                return {
                    "title": f"⚡ {goal_title} Time!",
                    "body": f"No excuses, {user_name}. Your workout is waiting - get moving NOW!",
                }
            elif time_of_day == "evening":
                return {
                    "title": f"💪 {goal_title} Check",
                    "body": f"Did you complete your {goal_title} today, {user_name}? Don't skip it!",
                }
            else:
                return {
                    "title": f"🔥 {goal_title} Now!",
                    "body": f"Stop scrolling, {user_name}. Time for your {goal_title}!",
                }
        elif motivation_style == "data_driven":
            if streak > 0:
                return {
                    "title": f"📊 {goal_title} Day {streak + 1}",
                    "body": f"Streak: {streak} days. Keep it going with today's session, {user_name}!",
                }
            elif day_number > 0:
                return {
                    "title": f"📈 {goal_title} Day {day_number}",
                    "body": f"Day {day_number} workout awaits. Complete it to track progress, {user_name}!",
                }
            else:
                return {
                    "title": f"📊 {goal_title} Reminder",
                    "body": f"Time to log your {goal_title} activity, {user_name}!",
                }
        else:  # supportive or balanced
            if time_of_day == "morning":
                return {
                    "title": f"🌅 {goal_title} Time!",
                    "body": f"Good morning, {user_name}! Time for your {goal_title}. You've got this!",
                }
            elif time_of_day == "evening":
                return {
                    "title": f"🌙 {goal_title} Check-in",
                    "body": f"Evening, {user_name}! Have you done your {goal_title} today?",
                }
            else:
                if streak > 0:
                    return {
                        "title": f"🔥 {goal_title} Reminder",
                        "body": f"Your {streak}-day streak awaits, {user_name}! Time for today's session.",
                    }
                else:
                    return {
                        "title": f"💪 {goal_title} Time!",
                        "body": f"Hey {user_name}, your {goal_title} is waiting. Let's do this!",
                    }
