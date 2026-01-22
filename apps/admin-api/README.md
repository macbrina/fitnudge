# FitNudge Admin API

Administrative backend API for the FitNudge admin dashboard.

## Overview

This is a separate FastAPI application that provides administrative endpoints for:
- User management
- Subscription management
- Celery task monitoring
- Feature flag management
- Analytics and reporting

## Authentication

Admin API uses the same authentication system as the main API but requires users to have `role = 'admin'` in the database.

## Setup

```bash
cd apps/admin-api
poetry install
```

## Development

```bash
poetry run uvicorn main:app --reload --port 8001
```

## Production

```bash
poetry run uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001}
```

## Environment Variables

Uses the same environment variables as the main API:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `SECRET_KEY`
- `REDIS_URL`
- `ALLOWED_ORIGINS` (set to admin dashboard domain)

## Endpoints

### Health
- `GET /health` - Health check

### Auth
- `POST /api/auth/login` - Admin login

### Users
- `GET /api/users` - List users
- `GET /api/users/{id}` - Get user details
- `PATCH /api/users/{id}` - Update user

### Subscriptions
- `GET /api/subscriptions` - List subscriptions
- `GET /api/subscriptions/stats` - Subscription statistics

### Tasks (Celery)
- `GET /api/tasks/overview` - Task queue overview
- `GET /api/tasks/workers` - Worker status
- `GET /api/tasks/{id}` - Task details
- `POST /api/tasks/{id}/revoke` - Revoke a task

### Analytics
- `GET /api/analytics/dashboard` - Admin dashboard stats
