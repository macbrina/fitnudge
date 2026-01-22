"""
Smart Partner Matching Service

Handles goal similarity scoring and partner matching based on:
- Goal type/category matching (40% weight)
- Schedule/frequency similarity (25% weight)
- Timezone proximity (25% weight)
- Experience level similarity (10% weight)

Designed for scalability with 100K+ users:
- O(1) keyword lookups using sets
- Batch database queries
- Pre-filtering before scoring
- Cached category extraction
"""

from typing import Dict, List, Set, Any, Tuple, Optional
from rapidfuzz import fuzz
from functools import lru_cache


# =====================================================
# GOAL KEYWORD CATEGORIES
# =====================================================
# Each category contains keywords that indicate a goal type.
# Keywords are lowercase for O(1) lookup performance.

GOAL_KEYWORDS: Dict[str, Set[str]] = {
    # Fitness & Exercise
    "fitness": {
        "workout",
        "gym",
        "exercise",
        "run",
        "running",
        "jog",
        "jogging",
        "swim",
        "swimming",
        "lift",
        "lifting",
        "cardio",
        "strength",
        "train",
        "training",
        "fitness",
        "sport",
        "walk",
        "walking",
        "hike",
        "hiking",
        "cycle",
        "cycling",
        "bike",
        "biking",
        "yoga",
        "stretch",
        "stretching",
        "pushup",
        "pushups",
        "squat",
        "squats",
        "plank",
        "planking",
        "weights",
        "weightlifting",
        "crossfit",
        "hiit",
        "pilates",
        "zumba",
        "aerobics",
        "marathon",
        "triathlon",
        "tennis",
        "basketball",
        "soccer",
        "football",
        "golf",
        "climbing",
        "bouldering",
        "rowing",
        "skiing",
        "snowboarding",
        "surfing",
        "martial",
        "boxing",
        "kickboxing",
        "mma",
        "karate",
        "judo",
        "taekwondo",
        "jump",
        "jumping",
        "burpee",
        "burpees",
        "crunches",
        "situps",
        "deadlift",
        "bench",
        "pull-up",
        "pullup",
        "dumbbell",
        "barbell",
        "kettlebell",
        "treadmill",
        "elliptical",
        "stairmaster",
        "spinning",
        "peloton",
        "steps",
        "10000steps",
    },
    # Reading & Learning
    "reading": {
        "read",
        "reading",
        "book",
        "books",
        "study",
        "studying",
        "learn",
        "learning",
        "article",
        "articles",
        "literature",
        "novel",
        "novels",
        "pages",
        "chapter",
        "chapters",
        "audiobook",
        "audiobooks",
        "kindle",
        "library",
        "education",
        "educational",
        "course",
        "courses",
        "lesson",
        "lessons",
        "tutorial",
        "tutorials",
        "podcast",
        "podcasts",
        "listen",
        "lecture",
        "lectures",
        "research",
        "paper",
        "papers",
        "magazine",
        "newspaper",
        "blog",
        "blogs",
        "ebook",
        "ebooks",
        "nonfiction",
        "fiction",
        "biography",
        "memoir",
        "textbook",
        "vocabulary",
        "language",
        "spanish",
        "french",
        "german",
        "mandarin",
        "japanese",
        "duolingo",
    },
    # Meditation & Mindfulness
    "meditation": {
        "meditate",
        "meditation",
        "mindful",
        "mindfulness",
        "breathe",
        "breathing",
        "calm",
        "relax",
        "relaxation",
        "peace",
        "zen",
        "contemplation",
        "reflection",
        "stillness",
        "quiet",
        "silence",
        "prayer",
        "praying",
        "spiritual",
        "spirituality",
        "yoga",
        "tai-chi",
        "qigong",
        "headspace",
        "calm",
        "insight",
        "timer",
        "guided",
        "visualization",
        "affirmation",
        "affirmations",
        "mantra",
        "mantras",
        "chakra",
        "energy",
        "grounding",
        "centering",
        "presence",
        "present",
    },
    # Nutrition & Diet
    "nutrition": {
        "eat",
        "eating",
        "diet",
        "dieting",
        "water",
        "drink",
        "drinking",
        "healthy",
        "meal",
        "meals",
        "food",
        "nutrition",
        "cook",
        "cooking",
        "vegetable",
        "vegetables",
        "fruit",
        "fruits",
        "protein",
        "calorie",
        "calories",
        "macro",
        "macros",
        "keto",
        "vegan",
        "vegetarian",
        "paleo",
        "whole30",
        "intermittent",
        "fasting",
        "portion",
        "portions",
        "sugar",
        "sodium",
        "fiber",
        "vitamins",
        "supplements",
        "smoothie",
        "smoothies",
        "juice",
        "juicing",
        "prep",
        "mealprep",
        "grocery",
        "hydration",
        "hydrate",
        "liters",
        "glasses",
        "oz",
        "ounces",
        "breakfast",
        "lunch",
        "dinner",
        "snack",
        "snacks",
        "weight",
        "weightloss",
        "bulking",
        "cutting",
        "clean",
        "cleaneating",
    },
    # Sleep & Rest
    "sleep": {
        "sleep",
        "sleeping",
        "rest",
        "resting",
        "bed",
        "bedtime",
        "wake",
        "waking",
        "nap",
        "napping",
        "morning",
        "night",
        "routine",
        "alarm",
        "hours",
        "7hours",
        "8hours",
        "insomnia",
        "melatonin",
        "circadian",
        "rem",
        "deep",
        "quality",
        "tracker",
        "tracking",
        "oura",
        "whoop",
        "recovery",
        "recharge",
        "dreams",
        "dreaming",
        "pillow",
        "mattress",
    },
    # Productivity & Work
    "productivity": {
        "work",
        "working",
        "focus",
        "focusing",
        "task",
        "tasks",
        "code",
        "coding",
        "write",
        "writing",
        "study",
        "project",
        "projects",
        "goal",
        "goals",
        "plan",
        "planning",
        "organize",
        "organizing",
        "productivity",
        "habit",
        "habits",
        "pomodoro",
        "deep",
        "deepwork",
        "flow",
        "inbox",
        "email",
        "emails",
        "meeting",
        "meetings",
        "deadline",
        "deadlines",
        "priority",
        "priorities",
        "todo",
        "checklist",
        "calendar",
        "schedule",
        "scheduling",
        "time",
        "timeblock",
        "blocking",
        "batch",
        "batching",
        "automation",
        "automate",
        "delegate",
        "delegating",
        "efficiency",
        "efficient",
        "optimize",
        "optimizing",
        "gtd",
        "notion",
        "todoist",
        "asana",
        "trello",
        "jira",
        "sprint",
        "agile",
        "kanban",
    },
    # Mental Health & Wellness
    "wellness": {
        "health",
        "healthy",
        "wellness",
        "self-care",
        "selfcare",
        "mental",
        "emotional",
        "stress",
        "anxiety",
        "therapy",
        "therapist",
        "journal",
        "journaling",
        "gratitude",
        "grateful",
        "positive",
        "positivity",
        "happy",
        "happiness",
        "mood",
        "moods",
        "feelings",
        "emotions",
        "mindset",
        "growth",
        "personal",
        "development",
        "improvement",
        "confidence",
        "self-esteem",
        "boundaries",
        "boundary",
        "toxic",
        "detox",
        "digital",
        "screentime",
        "unplugging",
        "disconnect",
        "nature",
        "outdoors",
        "sunshine",
        "vitamin",
        "depression",
        "cbt",
        "dbt",
        "mindfulness",
        "awareness",
        "intention",
        "intentional",
    },
    # Creative & Artistic
    "creative": {
        "art",
        "artistic",
        "draw",
        "drawing",
        "paint",
        "painting",
        "sketch",
        "sketching",
        "create",
        "creating",
        "creative",
        "creativity",
        "design",
        "designing",
        "write",
        "writing",
        "blog",
        "blogging",
        "music",
        "instrument",
        "piano",
        "guitar",
        "drums",
        "singing",
        "song",
        "songs",
        "compose",
        "composing",
        "photography",
        "photo",
        "photos",
        "video",
        "filming",
        "editing",
        "podcast",
        "podcasting",
        "youtube",
        "content",
        "craft",
        "crafts",
        "diy",
        "knitting",
        "sewing",
        "pottery",
        "sculpt",
        "sculpture",
        "dance",
        "dancing",
        "choreography",
        "theater",
        "acting",
    },
    # Social & Relationships
    "social": {
        "friend",
        "friends",
        "family",
        "relationship",
        "relationships",
        "connect",
        "connecting",
        "call",
        "calling",
        "text",
        "texting",
        "date",
        "dating",
        "quality",
        "time",
        "together",
        "support",
        "supporting",
        "listen",
        "listening",
        "communicate",
        "communication",
        "network",
        "networking",
        "meetup",
        "social",
        "community",
        "group",
        "groups",
        "club",
        "clubs",
        "volunteer",
        "volunteering",
        "help",
        "helping",
        "give",
        "giving",
        "charity",
        "donate",
        "donating",
    },
    # Financial
    "financial": {
        "save",
        "saving",
        "savings",
        "money",
        "budget",
        "budgeting",
        "invest",
        "investing",
        "investment",
        "debt",
        "loan",
        "loans",
        "credit",
        "pay",
        "paying",
        "payoff",
        "expense",
        "expenses",
        "income",
        "earn",
        "earning",
        "side",
        "hustle",
        "freelance",
        "retirement",
        "401k",
        "ira",
        "stock",
        "stocks",
        "crypto",
        "bitcoin",
        "finance",
        "financial",
        "frugal",
        "spending",
        "track",
        "tracking",
        "net",
        "worth",
        "emergency",
        "fund",
    },
    # Home & Environment
    "home": {
        "clean",
        "cleaning",
        "organize",
        "organizing",
        "declutter",
        "decluttering",
        "tidy",
        "tidying",
        "minimalist",
        "minimalism",
        "home",
        "house",
        "room",
        "rooms",
        "laundry",
        "dishes",
        "vacuum",
        "dust",
        "dusting",
        "mop",
        "mopping",
        "garden",
        "gardening",
        "plant",
        "plants",
        "watering",
        "yard",
        "lawn",
        "maintenance",
        "repair",
        "fixing",
        "diy",
        "renovation",
        "decorating",
        "interior",
        "space",
    },
    # Spiritual & Faith
    "spiritual": {
        "pray",
        "prayer",
        "praying",
        "bible",
        "quran",
        "torah",
        "scripture",
        "scriptures",
        "devotion",
        "devotional",
        "worship",
        "faith",
        "church",
        "mosque",
        "temple",
        "synagogue",
        "spiritual",
        "spirituality",
        "god",
        "divine",
        "soul",
        "souls",
        "sermon",
        "preach",
        "tithe",
        "tithing",
        "fast",
        "fasting",
        "lent",
        "ramadan",
        "sabbath",
        "religious",
    },
}

# Flatten all keywords into a set for quick category lookup
ALL_KEYWORDS: Dict[str, str] = {}
for category, keywords in GOAL_KEYWORDS.items():
    for keyword in keywords:
        ALL_KEYWORDS[keyword] = category


@lru_cache(maxsize=1000)
def extract_goal_categories(goal_title: str) -> Tuple[str, ...]:
    """
    Extract matching categories from goal title using keyword matching.
    Uses LRU cache for O(1) repeated lookups on same titles.

    Returns tuple for hashability (caching).
    """
    title_lower = goal_title.lower()
    categories: Set[str] = set()

    # Split title into words for O(n) word-by-word lookup
    words = title_lower.replace("-", " ").replace("_", " ").split()

    for word in words:
        # O(1) lookup in ALL_KEYWORDS dict
        if word in ALL_KEYWORDS:
            categories.add(ALL_KEYWORDS[word])

    # Also check for multi-word phrases
    for category, keywords in GOAL_KEYWORDS.items():
        for keyword in keywords:
            if " " in keyword and keyword in title_lower:
                categories.add(category)
                break

    return tuple(categories) if categories else ("general",)


def calculate_goal_similarity(
    user_goal_titles: List[str], candidate_goal_titles: List[str]
) -> Tuple[float, List[str]]:
    """
    Calculate goal similarity score (0-1) and matching categories.
    Uses both category overlap and fuzzy string matching.

    Optimized for performance:
    - LRU cached category extraction
    - Early exit for empty inputs
    - Set operations for O(1) overlap calculation
    """
    if not user_goal_titles or not candidate_goal_titles:
        return 0.0, []

    # Extract categories for both users (cached per title)
    user_categories: Set[str] = set()
    for title in user_goal_titles:
        user_categories.update(extract_goal_categories(title))

    candidate_categories: Set[str] = set()
    for title in candidate_goal_titles:
        candidate_categories.update(extract_goal_categories(title))

    # Remove "general" for overlap calculation
    user_categories.discard("general")
    candidate_categories.discard("general")

    # Calculate category overlap (Jaccard similarity)
    if not user_categories or not candidate_categories:
        category_score = 0.0
        matched_categories = []
    else:
        overlap = user_categories & candidate_categories
        union = user_categories | candidate_categories
        category_score = len(overlap) / len(union) if union else 0.0
        matched_categories = list(overlap)

    # Also check fuzzy title similarity for direct matches
    # Limit to first 5 titles each to cap at O(25) comparisons
    fuzzy_score = 0.0
    for user_title in user_goal_titles[:5]:
        for cand_title in candidate_goal_titles[:5]:
            ratio = (
                fuzz.token_sort_ratio(user_title.lower(), cand_title.lower()) / 100.0
            )
            fuzzy_score = max(fuzzy_score, ratio)

    # Combined score: 70% category, 30% fuzzy
    combined_score = (category_score * 0.7) + (fuzzy_score * 0.3)

    return combined_score, matched_categories


def calculate_timezone_diff_hours(tz1: str, tz2: str) -> float:
    """
    Calculate approximate timezone difference in hours.

    Cached implicitly via timezone library.
    Falls back gracefully on invalid timezones.
    """
    if tz1 == tz2:
        return 0.0  # Fast path for same timezone

    try:
        from zoneinfo import ZoneInfo
        from datetime import datetime as dt

        now = dt.now()

        tz1_offset = now.astimezone(ZoneInfo(tz1)).utcoffset()
        tz2_offset = now.astimezone(ZoneInfo(tz2)).utcoffset()

        if tz1_offset is None or tz2_offset is None:
            return 12.0  # Max difference if unknown

        diff_seconds = abs((tz1_offset - tz2_offset).total_seconds())
        return diff_seconds / 3600.0

    except Exception:
        # Fallback: assume moderate difference if we can't determine
        return 6.0


def calculate_partner_match_score(
    user_data: Dict[str, Any], candidate_data: Dict[str, Any]
) -> Tuple[float, List[str]]:
    """
    Calculate overall partner match score (0-100) and match reasons.

    Scoring weights (per FITNUDGE_V2_SPEC.md):
    - Goal similarity: 40%
    - Frequency match: 25%
    - Timezone proximity: 25%
    - Streak level similarity: 10%

    Returns:
        Tuple of (score 0-100, list of match reason strings)
    """
    match_reasons: List[str] = []
    total_score = 0.0

    # 1. Goal Similarity (40% weight)
    goal_score, matched_cats = calculate_goal_similarity(
        user_data.get("goal_titles", []), candidate_data.get("goal_titles", [])
    )
    total_score += goal_score * 40

    if matched_cats:
        # Capitalize category names for display
        display_cats = [cat.capitalize() for cat in matched_cats[:2]]
        match_reasons.append(f"Similar goals: {', '.join(display_cats)}")
    elif goal_score > 0.3:
        match_reasons.append("Similar goals")

    # 2. Frequency Match (25% weight)
    user_freqs = set(user_data.get("frequencies", []))
    cand_freqs = set(candidate_data.get("frequencies", []))

    if user_freqs and cand_freqs:
        freq_overlap = len(user_freqs & cand_freqs) / len(user_freqs | cand_freqs)
        total_score += freq_overlap * 25

        if freq_overlap >= 0.5:
            match_reasons.append("Similar schedule")

    # 3. Timezone Proximity (25% weight)
    user_tz = user_data.get("timezone", "UTC")
    cand_tz = candidate_data.get("timezone", "UTC")
    tz_diff = calculate_timezone_diff_hours(user_tz, cand_tz)

    if tz_diff <= 3:
        # Full points if within 3 hours, linear decay
        tz_points = 25 - (tz_diff * (25 / 3))
        total_score += max(0, tz_points)

        if tz_diff <= 1:
            match_reasons.append("Same timezone")
        elif tz_diff <= 3:
            match_reasons.append("Similar timezone")

    # 4. Streak Level Similarity (10% weight)
    user_streak = user_data.get("max_streak", 0) or 0
    cand_streak = candidate_data.get("max_streak", 0) or 0

    def get_streak_level(s: int) -> str:
        if s <= 7:
            return "beginner"
        elif s <= 30:
            return "intermediate"
        else:
            return "advanced"

    if get_streak_level(user_streak) == get_streak_level(cand_streak):
        total_score += 10
        if user_streak > 0 and cand_streak > 0:
            match_reasons.append("Similar experience")
    elif abs(user_streak - cand_streak) <= 10:
        total_score += 5

    return round(total_score, 1), match_reasons


def find_matched_goal_titles(
    user_goal_titles: List[str],
    candidate_goal_titles: List[str],
    threshold: int = 70,
    max_results: int = 3,
) -> List[str]:
    """
    Find goal titles from candidate that match user's goals.
    Uses fuzzy matching with rapidfuzz.

    Args:
        user_goal_titles: User's goal titles
        candidate_goal_titles: Candidate's goal titles
        threshold: Minimum similarity ratio (0-100)
        max_results: Maximum number of matched titles to return

    Returns:
        List of matched candidate goal titles
    """
    matched_goals: List[str] = []

    for user_title in user_goal_titles[:5]:  # Limit comparisons
        for cand_title in candidate_goal_titles[:5]:
            if cand_title not in matched_goals:
                if fuzz.token_sort_ratio(user_title, cand_title) > threshold:
                    matched_goals.append(cand_title)
                    if len(matched_goals) >= max_results:
                        return matched_goals
                    break

    return matched_goals


def get_category_display_name(category: str) -> str:
    """Get user-friendly display name for a category."""
    display_names = {
        "fitness": "Fitness",
        "reading": "Reading",
        "meditation": "Mindfulness",
        "nutrition": "Nutrition",
        "sleep": "Sleep",
        "productivity": "Productivity",
        "wellness": "Wellness",
        "creative": "Creative",
        "social": "Social",
        "financial": "Financial",
        "home": "Home",
        "spiritual": "Spiritual",
        "general": "General",
    }
    return display_names.get(category, category.capitalize())
