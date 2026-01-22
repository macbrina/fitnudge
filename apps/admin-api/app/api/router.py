"""
Admin API Router
Combines all admin endpoints
"""

from fastapi import APIRouter
from app.api.endpoints import auth, users, subscriptions, tasks, analytics

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(subscriptions.router)
api_router.include_router(tasks.router)
api_router.include_router(analytics.router)
