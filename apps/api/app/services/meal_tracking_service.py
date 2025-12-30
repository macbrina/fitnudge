"""
Meal Tracking Service

Handles meal logging and daily nutrition summaries for accountability tracking.
"""

import json
import asyncio
from typing import Dict, Any, List, Optional
from datetime import date, time
from openai import AsyncOpenAI
from app.core.database import get_supabase_client
from app.core.config import settings
from app.services.logger import logger


class MealTrackingService:
    """Service for managing meal tracking"""

    def __init__(self):
        self.openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    async def estimate_meal_nutrition(
        self,
        meal_description: str,
        meal_name: Optional[str] = None,
        photo_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Use AI to estimate nutrition values for a meal.
        If a photo_url is provided, uses GPT-4 Vision to analyze the image.

        Args:
            meal_description: Description of the meal
            meal_name: Optional name of the meal
            photo_url: Optional photo URL for vision-based analysis

        Returns:
            Dict with estimated_calories, estimated_protein, health_rating, confidence
        """
        try:
            # Use vision model if photo is provided
            if photo_url:
                return await self._estimate_with_vision(
                    meal_description, meal_name, photo_url
                )

            # Text-only estimation
            return await self._estimate_from_text(meal_description, meal_name)

        except asyncio.TimeoutError:
            logger.warning("AI nutrition estimation timed out")
            return self._default_estimation()
        except json.JSONDecodeError as e:
            logger.warning(
                f"🍽️ Failed to parse AI nutrition response: {e}",
                {"photo_url": photo_url[:50] if photo_url else None},
            )
            return self._default_estimation()
        except ValueError as e:
            logger.warning(
                f"🍽️ AI returned invalid response: {e}",
                {"photo_url": photo_url[:50] if photo_url else None},
            )
            return self._default_estimation()
        except Exception as e:
            logger.error(
                f"🍽️ AI nutrition estimation failed: {e}",
                {
                    "photo_url": photo_url[:50] if photo_url else None,
                    "error_type": type(e).__name__,
                },
            )
            return self._default_estimation()

    def _default_estimation(self) -> Dict[str, Any]:
        """Return default estimation when AI fails"""
        return {
            "estimated_calories": 0,
            "estimated_protein": 0,
            "health_rating": "okay",
            "confidence": "low",
        }

    async def _estimate_from_text(
        self,
        meal_description: str,
        meal_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Estimate nutrition from text description only"""
        # Build prompt - ask for suggested_name if meal_name not provided
        needs_name = not meal_name

        prompt = f"""You are a nutrition estimation AI. Based on the meal description, estimate:
1. Calories (integer)
2. Protein in grams (integer)
3. Health rating: "healthy", "okay", or "unhealthy"
4. Confidence: "high" (common foods with known values), "medium" (reasonable estimate), "low" (vague description)
{f'5. Suggested meal name - a concise, descriptive name (2-4 words) for this meal' if needs_name else ''}

{f'User provided meal name: {meal_name}' if meal_name else 'No meal name provided - please suggest one.'}
Description: {meal_description}

Respond with valid JSON only:
{{"estimated_calories": 450, "estimated_protein": 25, "health_rating": "healthy", "confidence": "medium"{', "suggested_name": "Grilled Chicken Salad"' if needs_name else ''}}}

Guidelines:
- "healthy": Balanced, nutritious, whole foods, reasonable portions
- "okay": Moderate nutrition, some processed foods, or slightly unbalanced
- "unhealthy": High sugar/fat, heavily processed, or excessive portions
- Be realistic - a small salad is ~100-200 cal, a burger is ~500-700 cal
- Average protein: chicken breast ~30g, egg ~6g, beans ~15g per cup
{f'- For suggested_name: Use concise, appetizing names like "Jollof Rice with Chicken", "Veggie Stir Fry", "Beef Burger with Fries"' if needs_name else ''}
"""

        response = await asyncio.wait_for(
            self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a nutrition estimation assistant. Return only valid JSON.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                max_tokens=150,  # Increased to accommodate suggested_name
            ),
            timeout=15.0,
        )

        return self._parse_nutrition_response(
            response, include_suggested_name=needs_name
        )

    async def _estimate_with_vision(
        self,
        meal_description: str,
        meal_name: Optional[str] = None,
        photo_url: str = None,
    ) -> Dict[str, Any]:
        """
        Estimate nutrition using GPT-4 Vision to analyze the meal image.

        Args:
            meal_description: Description of the meal
            meal_name: Optional name of the meal
            photo_url: URL of the meal photo (or base64 data URL)

        Returns:
            Dict with estimated nutrition values
        """
        # Only ask for suggested_name if meal_name not provided
        needs_name = not meal_name

        prompt = f"""You are an expert nutritionist AI that analyzes food images to estimate nutritional content.

Analyze the provided meal image and estimate:
1. Calories (integer) - be accurate based on visible portion sizes
2. Protein in grams (integer)
3. Health rating: "healthy", "okay", or "unhealthy"
4. Confidence: "high" (clearly visible, identifiable foods), "medium" (somewhat visible), "low" (unclear image)
{f'5. Suggested meal name - a concise, descriptive name (2-4 words) for this meal based on what you see' if needs_name else ''}

{f'User provided meal name: {meal_name}' if meal_name else 'No meal name provided - please suggest a concise, appetizing name based on the image.'}
{f'User description: {meal_description}' if meal_description else ''}

Respond with valid JSON only:
{{"estimated_calories": 450, "estimated_protein": 25, "health_rating": "healthy", "confidence": "high"{', "suggested_name": "Grilled Chicken Salad"' if needs_name else ''}}}

Guidelines:
- Carefully examine portion sizes in the image
- "healthy": Fresh vegetables, lean proteins, whole grains, balanced portions
- "okay": Mixed nutrition, moderate processed foods, typical restaurant portions
- "unhealthy": High-fat, fried foods, large sugary items, very large portions
- Be realistic based on what you see - don't underestimate fast food portions
{f'- For suggested_name: Use concise, appetizing names like "Jollof Rice with Chicken", "Veggie Stir Fry", "Beef Burger with Fries", "Fried Rice with Egg"' if needs_name else ''}
"""

        # Build the message content with image
        message_content = [
            {"type": "text", "text": prompt},
            {
                "type": "image_url",
                "image_url": {
                    "url": photo_url,
                    "detail": "low",  # Use low detail for faster processing and lower cost
                },
            },
        ]

        response = await asyncio.wait_for(
            self.openai_client.chat.completions.create(
                model="gpt-4o",  # Use GPT-4o for vision capability
                messages=[
                    {
                        "role": "system",
                        "content": "You are a nutrition analysis AI that examines food images. Return only valid JSON.",
                    },
                    {"role": "user", "content": message_content},
                ],
                temperature=0.3,
                max_tokens=150,
            ),
            timeout=30.0,  # Longer timeout for vision processing
        )

        return self._parse_nutrition_response(
            response, include_suggested_name=needs_name
        )

    def _parse_nutrition_response(
        self, response, include_suggested_name: bool = False
    ) -> Dict[str, Any]:
        """Parse and validate the AI nutrition response"""
        # Get the raw content from the response
        raw_content = response.choices[0].message.content

        # Handle None or empty response
        if not raw_content:
            raise ValueError("AI returned empty response")

        content = raw_content.strip()

        # Also check if empty after stripping
        if not content:
            raise ValueError("AI returned empty response after stripping")

        # Remove markdown code blocks if present
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()

        result = json.loads(content)

        # Validate and sanitize the response
        parsed = {
            "estimated_calories": max(0, int(result.get("estimated_calories", 0))),
            "estimated_protein": max(0, int(result.get("estimated_protein", 0))),
            "health_rating": (
                result.get("health_rating", "okay")
                if result.get("health_rating") in ["healthy", "okay", "unhealthy"]
                else "okay"
            ),
            "confidence": (
                result.get("confidence", "medium")
                if result.get("confidence") in ["high", "medium", "low"]
                else "medium"
            ),
        }

        if include_suggested_name and result.get("suggested_name"):
            parsed["suggested_name"] = result.get("suggested_name")

        return parsed

    async def log_meal(
        self,
        user_id: str,
        meal_type: str,
        logged_date: date,
        meal_name: Optional[str] = None,
        meal_description: Optional[str] = None,
        logged_time: Optional[time] = None,
        goal_id: Optional[str] = None,
        challenge_id: Optional[str] = None,
        estimated_protein: Optional[int] = None,
        estimated_calories: Optional[int] = None,
        health_rating: Optional[str] = None,
        notes: Optional[str] = None,
        photo_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Log a meal for a user.

        Saves meal data to the database. AI estimation (if needed) should be
        handled by the API endpoint before calling this method.

        Args:
            user_id: User ID
            meal_type: Type of meal (breakfast, lunch, dinner, snack, other)
            logged_date: Date of meal
            meal_name: Name of meal (optional)
            meal_description: Description of meal (optional)
            logged_time: Time of meal (optional)
            goal_id: Optional goal ID if meal is related to a goal
            challenge_id: Optional challenge ID if meal is related to a challenge
            estimated_protein: Estimated protein in grams (optional)
            estimated_calories: Estimated calories (optional)
            health_rating: Health rating (healthy, okay, unhealthy) (optional)
            notes: Additional notes (optional)
            photo_url: Photo URL of the meal (optional)

        Returns:
            Created meal log data

        Note:
            AI estimation (if needed) is handled by the API endpoint before calling this method.
            This service just saves the data to the database.
        """
        supabase = get_supabase_client()

        try:
            # Verify goal belongs to user if provided
            if goal_id:
                goal = (
                    supabase.table("goals")
                    .select("id, user_id")
                    .eq("id", goal_id)
                    .eq("user_id", user_id)
                    .maybe_single()
                    .execute()
                )

                if not goal.data:
                    raise ValueError("Goal not found or you don't have permission")

            # Verify challenge participation if provided
            if challenge_id:
                participant = (
                    supabase.table("challenge_participants")
                    .select("id")
                    .eq("challenge_id", challenge_id)
                    .eq("user_id", user_id)
                    .maybe_single()
                    .execute()
                )

                if not participant.data:
                    raise ValueError("Challenge not found or you are not a participant")

            meal_data = {
                "user_id": user_id,
                "goal_id": goal_id,
                "challenge_id": challenge_id,
                "meal_type": meal_type,
                "meal_name": meal_name,
                "meal_description": meal_description,
                "logged_date": logged_date.isoformat(),
                "logged_time": logged_time.isoformat() if logged_time else None,
                "estimated_protein": estimated_protein,
                "estimated_calories": estimated_calories,
                "health_rating": health_rating,
                "notes": notes,
                "photo_url": photo_url,
            }

            result = supabase.table("meal_logs").insert(meal_data).execute()

            # Daily nutrition summary will be updated automatically via trigger

            logger.info(
                f"Meal logged for user {user_id}",
                {
                    "user_id": user_id,
                    "meal_type": meal_type,
                    "logged_date": logged_date.isoformat(),
                },
            )

            # Note: auto_complete_checkin is called by the meals.py endpoint
            # to avoid duplicate check-in creation

            return result.data[0] if result.data else None

        except Exception as e:
            logger.error(
                f"Failed to log meal for user {user_id}: {e}",
                {"error": str(e), "user_id": user_id},
            )
            raise

    async def get_meal_logs(
        self,
        user_id: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        goal_id: Optional[str] = None,
        meal_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        Get meal logs for a user.

        Args:
            user_id: User ID
            start_date: Start date filter (optional)
            end_date: End date filter (optional)
            goal_id: Goal ID filter (optional)
            meal_type: Meal type filter (optional)
            limit: Number of records to return
            offset: Offset for pagination

        Returns:
            List of meal logs
        """
        supabase = get_supabase_client()

        try:
            query = (
                supabase.table("meal_logs")
                .select(
                    """
                *,
                goal:goals(id, title, category)
                """
                )
                .eq("user_id", user_id)
            )

            if start_date:
                query = query.gte("logged_date", start_date.isoformat())
            if end_date:
                query = query.lte("logged_date", end_date.isoformat())
            if goal_id:
                query = query.eq("goal_id", goal_id)
            if meal_type:
                query = query.eq("meal_type", meal_type)

            result = (
                query.order("logged_date", desc=True)
                .order("logged_time", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )

            return result.data if result.data else []

        except Exception as e:
            logger.error(
                f"Failed to get meal logs for user {user_id}: {e}",
                {"error": str(e), "user_id": user_id},
            )
            raise

    async def update_meal_log(
        self,
        meal_log_id: str,
        user_id: str,
        meal_type: Optional[str] = None,
        meal_name: Optional[str] = None,
        meal_description: Optional[str] = None,
        logged_time: Optional[time] = None,
        estimated_protein: Optional[int] = None,
        estimated_calories: Optional[int] = None,
        health_rating: Optional[str] = None,
        notes: Optional[str] = None,
        photo_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Update a meal log.

        Args:
            meal_log_id: Meal log ID
            user_id: User ID (for verification)
            meal_type: Type of meal (optional)
            meal_name: Name of meal (optional)
            meal_description: Description of meal (optional)
            logged_time: Time of meal (optional)
            estimated_protein: Estimated protein in grams (optional)
            estimated_calories: Estimated calories (optional)
            health_rating: Health rating (optional)
            notes: Additional notes (optional)
            photo_url: Photo URL (optional)

        Returns:
            Updated meal log data
        """
        supabase = get_supabase_client()

        try:
            # Verify meal log belongs to user
            meal_log = (
                supabase.table("meal_logs")
                .select("id, user_id")
                .eq("id", meal_log_id)
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )

            if not meal_log.data:
                raise ValueError("Meal log not found or you don't have permission")

            # Build update data (only include non-None values)
            update_data = {}
            if meal_type is not None:
                update_data["meal_type"] = meal_type
            if meal_name is not None:
                update_data["meal_name"] = meal_name
            if meal_description is not None:
                update_data["meal_description"] = meal_description
            if logged_time is not None:
                update_data["logged_time"] = logged_time.isoformat()
            if estimated_protein is not None:
                update_data["estimated_protein"] = estimated_protein
            if estimated_calories is not None:
                update_data["estimated_calories"] = estimated_calories
            if health_rating is not None:
                update_data["health_rating"] = health_rating
            if notes is not None:
                update_data["notes"] = notes
            if photo_url is not None:
                update_data["photo_url"] = photo_url

            if not update_data:
                # No updates to make
                result = (
                    supabase.table("meal_logs")
                    .select("*")
                    .eq("id", meal_log_id)
                    .maybe_single()
                    .execute()
                )
                return result.data if result.data else None

            result = (
                supabase.table("meal_logs")
                .update(update_data)
                .eq("id", meal_log_id)
                .execute()
            )

            return result.data[0] if result.data else None

        except Exception as e:
            logger.error(
                f"Failed to update meal log {meal_log_id}: {e}",
                {"error": str(e), "meal_log_id": meal_log_id},
            )
            raise

    async def delete_meal_log(self, meal_log_id: str, user_id: str) -> bool:
        """
        Delete a meal log.

        Args:
            meal_log_id: Meal log ID
            user_id: User ID (for verification)

        Returns:
            True if successful
        """
        supabase = get_supabase_client()

        try:
            # Verify meal log belongs to user
            meal_log = (
                supabase.table("meal_logs")
                .select("id")
                .eq("id", meal_log_id)
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )

            if not meal_log.data:
                raise ValueError("Meal log not found or you don't have permission")

            supabase.table("meal_logs").delete().eq("id", meal_log_id).execute()

            return True

        except Exception as e:
            logger.error(
                f"Failed to delete meal log {meal_log_id}: {e}",
                {"error": str(e), "meal_log_id": meal_log_id},
            )
            raise


# Global instance
meal_tracking_service = MealTrackingService()
