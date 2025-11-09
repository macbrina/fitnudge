from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    goals,
    motivation,
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
    progress_reflections,
    system_health,
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
    progress_reflections.router,
    prefix="/progress-reflections",
    tags=["AI Progress Reflections"],
)
api_router.include_router(
    system_health.router,
    prefix="/system/health",
    tags=["System Health"],
)
