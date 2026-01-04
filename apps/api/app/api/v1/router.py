from fastapi import APIRouter
from app.api.v1.endpoints import (
    app_version,
    auth,
    data_export,
    goals,
    motivation,
    daily_motivations,
    social,
    subscriptions,
    blog,
    users,
    checkins,
    social_features,
    media,
    analytics,
    api_keys,
    notifications,
    onboarding,
    subscription_plans,
    achievements,
    challenges,
    recaps,
    social_accountability,
    meals,
    hydration,
    progress_reflections,
    system_health,
    webhooks,
    nudges,
    partners,
    home,
    workout_sessions,
    exercises,
    workout_music,
    audio_preferences,
    tracking_stats,
)

# Create main API router
api_router = APIRouter(
    redirect_slashes=False
)  # Disable redirects to preserve Authorization header

# Include all endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(goals.router, prefix="/goals", tags=["Goals"])
api_router.include_router(
    motivation.router, prefix="/motivation", tags=["AI Motivation"]
)
api_router.include_router(
    daily_motivations.router, prefix="/daily-motivations", tags=["Daily Motivations"]
)
api_router.include_router(social.router, prefix="/social", tags=["Social Features"])
api_router.include_router(
    subscriptions.router, prefix="/subscriptions", tags=["Subscriptions"]
)
api_router.include_router(blog.router, prefix="/blog", tags=["Blog"])
api_router.include_router(users.router, prefix="/users", tags=["User Management"])
api_router.include_router(checkins.router, prefix="/check-ins", tags=["Check-ins"])
api_router.include_router(social_features.router, prefix="", tags=["Social Features"])
api_router.include_router(media.router, prefix="/media", tags=["Media"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
api_router.include_router(api_keys.router, prefix="/api-keys", tags=["API Keys"])
api_router.include_router(
    notifications.router, prefix="/notifications", tags=["Notifications"]
)
api_router.include_router(onboarding.router, prefix="/onboarding", tags=["Onboarding"])
api_router.include_router(
    subscription_plans.router, prefix="/subscription-plans", tags=["Subscription Plans"]
)
api_router.include_router(
    achievements.router, prefix="/achievements", tags=["Achievements"]
)
api_router.include_router(challenges.router, prefix="/challenges", tags=["Challenges"])
api_router.include_router(recaps.router, prefix="/recaps", tags=["Weekly Recaps"])
api_router.include_router(
    social_accountability.router,
    prefix="/social-accountability",
    tags=["Social Accountability"],
)
api_router.include_router(meals.router, prefix="/meals", tags=["Meal Tracking"])
api_router.include_router(
    hydration.router, prefix="/hydration", tags=["Hydration Tracking"]
)
api_router.include_router(
    progress_reflections.router,
    prefix="/progress-reflections",
    tags=["AI Progress Reflections"],
)
api_router.include_router(
    system_health.router,
    prefix="/system/health",
    tags=["System Health"],
)
api_router.include_router(
    webhooks.router,
    prefix="/webhooks",
    tags=["Webhooks"],
)
api_router.include_router(
    nudges.router,
    prefix="/nudges",
    tags=["Social Nudges"],
)
api_router.include_router(
    partners.router,
    prefix="/partners",
    tags=["Accountability Partners"],
)
api_router.include_router(
    home.router,
    prefix="/home",
    tags=["Home Dashboard"],
)
api_router.include_router(
    workout_sessions.router,
    prefix="/workout-sessions",
    tags=["Workout Sessions"],
)
api_router.include_router(
    exercises.router,
    prefix="/exercises",
    tags=["Exercises"],
)
api_router.include_router(
    workout_music.router,
    tags=["Workout Music"],
)
api_router.include_router(
    audio_preferences.router,
    prefix="/audio-preferences",
    tags=["Audio Preferences"],
)
api_router.include_router(
    tracking_stats.router,
    prefix="/tracking-stats",
    tags=["Tracking Stats"],
)
api_router.include_router(
    app_version.router,
    prefix="/app-version",
    tags=["App Version"],
)
api_router.include_router(
    data_export.router,
    prefix="/data-export",
    tags=["Data Export"],
)
