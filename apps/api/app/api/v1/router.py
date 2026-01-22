"""
V2 API Router

Only includes endpoints needed for V2:
- Auth, Users, Goals, Check-ins (core)
- AI Coach, Daily Motivations, Weekly Recaps (AI)
- Partners, Nudges (social)
- Achievements (gamification)
- Subscriptions (billing)
- Notifications (push)
- Onboarding (setup)
- Media (voice notes)
- System (health, webhooks, app version)
- Blog, Data Export (compliance)
"""

from fastapi import APIRouter
from app.api.v1.endpoints import (
    # Core
    auth,
    users,
    goals,
    checkins,
    home,
    # AI Features
    ai_coach,
    daily_motivations,  # Daily motivations endpoint (V2)
    recaps,
    # Social
    partners,
    nudges,
    # Gamification
    achievements,
    # Billing
    subscriptions,
    subscription_plans,
    # Notifications
    notifications,
    # Setup
    onboarding,
    # Media (includes voice notes - consolidated)
    media,
    # System
    system_health,
    webhooks,
    app_version,
    app_config,
    # Other
    blog,
    data_export,
    analytics,
)

# Create main API router
api_router = APIRouter(redirect_slashes=False)

# ===== Core =====
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(goals.router, prefix="/goals", tags=["Goals"])
api_router.include_router(checkins.router, prefix="/check-ins", tags=["Check-ins"])
api_router.include_router(home.router, prefix="/home", tags=["Home Dashboard"])

# ===== AI Features =====
api_router.include_router(ai_coach.router, prefix="/ai-coach", tags=["AI Coach"])
api_router.include_router(
    daily_motivations.router, prefix="/daily-motivations", tags=["Daily Motivations"]
)
api_router.include_router(recaps.router, prefix="/recaps", tags=["Weekly Recaps"])

# ===== Social =====
api_router.include_router(partners.router, prefix="/partners", tags=["Partners"])
api_router.include_router(nudges.router, prefix="/nudges", tags=["Nudges"])

# ===== Gamification =====
api_router.include_router(
    achievements.router, prefix="/achievements", tags=["Achievements"]
)

# ===== Billing =====
api_router.include_router(
    subscriptions.router, prefix="/subscriptions", tags=["Subscriptions"]
)
api_router.include_router(
    subscription_plans.router, prefix="/subscription-plans", tags=["Plans"]
)

# ===== Notifications =====
api_router.include_router(
    notifications.router, prefix="/notifications", tags=["Notifications"]
)

# ===== Setup =====
api_router.include_router(onboarding.router, prefix="/onboarding", tags=["Onboarding"])

# ===== Media (includes voice notes) =====
api_router.include_router(media.router, prefix="/media", tags=["Media"])

# ===== System =====
api_router.include_router(
    system_health.router, prefix="/system/health", tags=["Health"]
)
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["Webhooks"])
api_router.include_router(
    app_version.router, prefix="/app-version", tags=["App Version"]
)
api_router.include_router(
    app_config.router, prefix="/app-config", tags=["App Config"]
)

# ===== Other =====
api_router.include_router(blog.router, prefix="/blog", tags=["Blog"])
api_router.include_router(
    data_export.router, prefix="/data-export", tags=["Data Export"]
)
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
