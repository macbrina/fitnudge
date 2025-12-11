"""
Daily Motivation Background Styles Configuration

Centralized definition of available background gradient styles for daily motivations.
This ensures consistency between backend and frontend.
"""

from typing import Dict, List

# Available background style names
BACKGROUND_STYLE_NAMES = [
    "gradient_sunset",
    "gradient_mountain",
    "gradient_ocean",
    "gradient_forest",
    "gradient_purple",
    "gradient_pink",
]

# Background style metadata (for AI to understand)
BACKGROUND_STYLE_METADATA: Dict[str, Dict[str, any]] = {
    "gradient_sunset": {
        "name": "gradient_sunset",
        "colors": ["#FF9A9E", "#FECFEF", "#FECFEF"],
        "mood": "warm",  # warm, calm, energetic, serene, playful
        "description": "Warm sunset gradient with pink and purple tones",
        "suitable_for": ["evening", "relaxation", "reflection"],
    },
    "gradient_mountain": {
        "name": "gradient_mountain",
        "colors": ["#E0C3FC", "#C8A8FF", "#9B7BFF"],
        "mood": "calm",
        "description": "Serene purple mountain gradient",
        "suitable_for": ["morning", "meditation", "peace"],
    },
    "gradient_ocean": {
        "name": "gradient_ocean",
        "colors": ["#667EEA", "#764BA2", "#667EEA"],
        "mood": "serene",
        "description": "Deep blue ocean gradient",
        "suitable_for": ["anytime", "calm", "focused"],
    },
    "gradient_forest": {
        "name": "gradient_forest",
        "colors": ["#84FAB0", "#8FD3F4", "#84FAB0"],
        "mood": "energetic",
        "description": "Fresh green forest gradient",
        "suitable_for": ["morning", "growth", "energy"],
    },
    "gradient_purple": {
        "name": "gradient_purple",
        "colors": ["#A8EDEA", "#FED6E3", "#D299C2"],
        "mood": "playful",
        "description": "Playful purple-pink gradient",
        "suitable_for": ["afternoon", "motivation", "fun"],
    },
    "gradient_pink": {
        "name": "gradient_pink",
        "colors": ["#FFECD2", "#FCB69F", "#FF9A9E"],
        "mood": "warm",
        "description": "Warm pink-coral gradient",
        "suitable_for": ["anytime", "encouragement", "positivity"],
    },
}


# Helper function to get style metadata
def get_background_style_metadata(style_name: str) -> Dict[str, any]:
    """Get metadata for a specific background style"""
    return BACKGROUND_STYLE_METADATA.get(
        style_name, BACKGROUND_STYLE_METADATA["gradient_sunset"]
    )


# Helper function to get all available styles for AI
def get_available_styles_for_ai() -> str:
    """Get a formatted string of available styles for AI prompts"""
    styles_info = []
    for style_name, metadata in BACKGROUND_STYLE_METADATA.items():
        styles_info.append(
            f"- {style_name}: {metadata['description']} (mood: {metadata['mood']}, suitable for: {', '.join(metadata['suitable_for'])})"
        )
    return "\n".join(styles_info)
