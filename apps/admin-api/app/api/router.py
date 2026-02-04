"""
Admin API Router
Combines all admin endpoints
"""

from fastapi import APIRouter
from app.api.endpoints import (
    auth,
    users,
    subscriptions,
    tasks,
    analytics,
    user_reports,
    blog,
    app_config,
    app_versions,
    audit_logs,
    broadcasts,
    data_export,
    deactivation_logs,
    referrals,
    subscription_plans,
    plan_features,
    legal_documents,
)

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router)
api_router.include_router(app_config.router)
api_router.include_router(app_versions.router)
api_router.include_router(audit_logs.router)
api_router.include_router(data_export.router)
api_router.include_router(deactivation_logs.router)
api_router.include_router(referrals.router)
api_router.include_router(subscription_plans.router)
api_router.include_router(plan_features.router)
api_router.include_router(legal_documents.router)
api_router.include_router(broadcasts.router)
api_router.include_router(users.router)
api_router.include_router(subscriptions.router)
api_router.include_router(user_reports.router)
api_router.include_router(blog.router)
api_router.include_router(tasks.router)
api_router.include_router(analytics.router)
