"""
Base Agent Class for Multi-Agent Workout Plan Generation

Provides common functionality for all specialized agents:
- OpenAI API integration
- JSON extraction and validation
- Retry logic with exponential backoff
- Error handling and logging
"""

import json
import asyncio
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List, TypeVar, Generic
from openai import AsyncOpenAI
from app.core.config import settings
from app.services.logger import logger

T = TypeVar("T")


class BaseAgent(ABC, Generic[T]):
    """
    Abstract base class for all workout plan generation agents.

    Each agent has a specific responsibility and generates a focused
    output that the orchestrator combines into the final plan.
    """

    # Default configuration - subclasses can override
    MODEL = "gpt-4o-mini"
    MAX_RETRIES = 2
    TIMEOUT_SECONDS = 30.0
    TEMPERATURE = 0.7

    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self._name = self.__class__.__name__

    @property
    @abstractmethod
    def system_prompt(self) -> str:
        """Return the system prompt for this agent."""
        pass

    @abstractmethod
    def build_user_prompt(self, context: Dict[str, Any]) -> str:
        """Build the user prompt from the given context."""
        pass

    @abstractmethod
    def validate_output(self, output: Dict[str, Any]) -> bool:
        """Validate the agent's output structure."""
        pass

    @abstractmethod
    def get_fallback_output(self, context: Dict[str, Any]) -> T:
        """Return a fallback output if generation fails."""
        pass

    async def generate(self, context: Dict[str, Any]) -> T:
        """
        Generate output using the OpenAI API with retry logic.

        Args:
            context: Dictionary containing all necessary input data

        Returns:
            The generated output of type T, or fallback if generation fails
        """
        last_error = None

        for attempt in range(self.MAX_RETRIES + 1):
            try:
                result = await self._call_openai(context)

                if result and self.validate_output(result):
                    logger.info(
                        f"{self._name} generated valid output", {"attempt": attempt + 1}
                    )
                    return result
                else:
                    logger.warning(
                        f"{self._name} generated invalid output on attempt {attempt + 1}"
                    )

            except asyncio.TimeoutError:
                last_error = f"Timeout after {self.TIMEOUT_SECONDS}s"
                logger.warning(
                    f"{self._name} timed out on attempt {attempt + 1}",
                    {"timeout": self.TIMEOUT_SECONDS},
                )
            except json.JSONDecodeError as e:
                last_error = f"JSON parse error: {str(e)}"
                logger.warning(
                    f"{self._name} JSON parse error on attempt {attempt + 1}",
                    {"error": str(e)},
                )
            except Exception as e:
                last_error = str(e)
                logger.error(
                    f"{self._name} error on attempt {attempt + 1}", {"error": str(e)}
                )

            # Exponential backoff before retry
            if attempt < self.MAX_RETRIES:
                await asyncio.sleep(2**attempt)

        # All retries failed, return fallback
        logger.error(
            f"{self._name} failed after {self.MAX_RETRIES + 1} attempts, using fallback",
            {"last_error": last_error},
        )
        return self.get_fallback_output(context)

    async def _call_openai(self, context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Make the actual OpenAI API call and extract JSON from response.

        Args:
            context: The context to pass to build_user_prompt

        Returns:
            Parsed JSON dictionary or None if extraction fails
        """
        user_prompt = self.build_user_prompt(context)
        full_input = (
            f"{self.system_prompt}\n\n{user_prompt}\n\nRespond with valid JSON only."
        )

        response = await asyncio.wait_for(
            self.client.chat.completions.create(
                model=self.MODEL,
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=self.TEMPERATURE,
                response_format={"type": "json_object"},
            ),
            timeout=self.TIMEOUT_SECONDS,
        )

        # Extract text from response
        output_text = response.choices[0].message.content

        if not output_text:
            logger.warning(f"{self._name} received empty response from OpenAI")
            return None

        # Parse JSON
        return self._extract_json(output_text)

    def _extract_json(self, text: str) -> Optional[Dict[str, Any]]:
        """
        Extract JSON from text response.

        Handles cases where JSON might be wrapped in markdown code blocks.

        Args:
            text: Raw text response from OpenAI

        Returns:
            Parsed JSON dictionary or None
        """
        # First, try direct JSON parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try to find JSON in code blocks
        if "```json" in text:
            start = text.find("```json") + 7
            end = text.find("```", start)
            if end > start:
                try:
                    return json.loads(text[start:end].strip())
                except json.JSONDecodeError:
                    pass

        # Try to find JSON object boundaries
        json_start = text.find("{")
        json_end = text.rfind("}") + 1

        if json_start != -1 and json_end > json_start:
            try:
                return json.loads(text[json_start:json_end])
            except json.JSONDecodeError:
                pass

        return None

    def _validate_required_fields(
        self, data: Dict[str, Any], required_fields: List[str]
    ) -> bool:
        """
        Utility method to validate required fields exist in data.

        Args:
            data: Dictionary to validate
            required_fields: List of field names that must exist

        Returns:
            True if all required fields exist, False otherwise
        """
        for field in required_fields:
            if field not in data:
                logger.warning(f"{self._name} missing required field: {field}")
                return False
        return True
