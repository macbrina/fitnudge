"""
Push Notification Motivation Generator

Generates SHORT, concise motivational messages specifically designed for push notifications.
Different from daily_motivations which are longer, more detailed messages for in-app display.

Push notifications appear on lock screen and need to be:
- Title: 4-6 words max
- Body: One sentence, 10-15 words max
- Glanceable and actionable
"""

from openai import OpenAI
from app.core.config import settings
import json
import random


def generate_push_notification_ai(goal_title: str, user_context: dict) -> dict:
    """
    Generate SHORT push notification for AI motivation.
    Optimized for mobile push notifications (lock screen display).

    Args:
        goal_title: The goal title (e.g., "7-Day Beginner Fat-Burn Walk")
        user_context: Dict with:
            - current_streak: int
            - recent_completed: int
            - recent_total: int (usually 7)
            - time_of_day: "morning" | "afternoon" | "evening"
            - user_name: str (optional)

    Returns:
        dict: {
            "title": "Short title (4-6 words)",
            "body": "One sentence (10-15 words)"
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

        system_prompt = """You are a motivational fitness coach creating PUSH NOTIFICATIONS.

CRITICAL CONSTRAINTS:
- Title: 4-6 words MAX (appears on lock screen)
- Body: ONE sentence, 10-15 words MAX
- Be personal, energizing, and action-oriented
- Use emojis sparingly (1-2 max, only in title)
- Make every word count - push notifications are glanceable

Tone by time of day:
- Morning: Energizing, fresh start, "rise and shine" energy
- Afternoon: Supportive, momentum, "keep going" energy
- Evening: Reflective, completion, "finish strong" energy

Focus on:
- Creating urgency without pressure
- Celebrating their commitment
- Making them WANT to check in"""

        context_str = f"""Goal: "{goal_title}"
Streak: {streak} days
Recent: {recent_completed}/{recent_total} check-ins (last 7 days)
Time: {time_of_day}
User: {user_name}"""

        # Add variety angles
        angles = [
            "Focus on their growing streak",
            "Celebrate their consistency",
            "Emphasize momentum and progress",
            "Inspire action with enthusiasm",
            "Create positive anticipation",
            "Remind them of their commitment",
        ]
        selected_angle = random.choice(angles)

        user_prompt = f"""{context_str}
Angle: {selected_angle}

Generate a SHORT push notification.

Return ONLY valid JSON (no markdown, no extra text):
{{
  "title": "4-6 words with optional emoji",
  "body": "One short sentence (10-15 words max)"
}}

Good examples:
{{"title": "💪 Crush Your Workout!", "body": "Your 5-day streak is waiting. Let's keep it alive!"}}
{{"title": "🔥 You're On Fire!", "body": "Don't break that streak now. One more day!"}}
{{"title": "⏰ It's Go Time!", "body": "Your future self will thank you for showing up today."}}
"""

        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=100,  # Short response
            temperature=0.9,
        )

        response_text = response.choices[0].message.content.strip()

        # Extract JSON (handle markdown code blocks)
        response_text = response_text.replace("```json", "").replace("```", "")
        json_start = response_text.find("{")
        json_end = response_text.rfind("}") + 1

        if json_start != -1 and json_end > json_start:
            json_text = response_text[json_start:json_end]
            result = json.loads(json_text)

            title = result.get("title", "")[:50]  # Enforce max length
            body = result.get("body", "")[:120]  # Enforce max length

            # Validate we got something
            if title and body:
                return {"title": title, "body": body}

        # Fallback if JSON parsing fails
        raise ValueError("Failed to parse AI response")

    except Exception as e:
        print(f"ERROR in generate_push_notification_ai: {str(e)}")

        # Context-aware fallback messages
        time_of_day = user_context.get("time_of_day", "day")
        streak = user_context.get("current_streak", 0)

        if time_of_day == "morning":
            if streak > 0:
                return {
                    "title": "🌅 Good Morning Champion!",
                    "body": f"Day {streak + 1} is calling. Let's keep that streak alive!",
                }
            else:
                return {
                    "title": "🌅 Fresh Start Today!",
                    "body": f"Ready to crush your {goal_title}? Let's go!",
                }
        elif time_of_day == "evening":
            return {
                "title": "🌙 Evening Check-In",
                "body": f"How did your {goal_title} go today? Tap to log it!",
            }
        else:
            if streak > 0:
                return {
                    "title": "🔥 Keep It Going!",
                    "body": f"Your {streak}-day streak is counting on you. One more rep!",
                }
            else:
                return {
                    "title": "💪 Time to Move!",
                    "body": f"Your {goal_title} is waiting. Small steps, big results!",
                }
