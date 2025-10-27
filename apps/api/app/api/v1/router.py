from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    goals,
    motivation,
    social,
    subscriptions,
    blog,
)

# Create main API router
api_router = APIRouter()

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
