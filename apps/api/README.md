# 🚀 FitNudge API - FastAPI Backend

The backend API for FitNudge, built with FastAPI and Python, providing authentication, AI motivation, social features, and subscription management.

## 🎯 Purpose

- **RESTful API**: Complete API for mobile and web clients
- **Authentication**: JWT tokens, OAuth (Apple, Google), email/password
- **AI Integration**: OpenAI GPT-5 for motivation messages
- **Social Features**: Posts, comments, likes, following system
- **Subscriptions**: Apple IAP and Google Play Billing integration
- **Real-time**: Supabase Realtime for live updates

## 🚀 Features

### Authentication & Users

- **JWT Authentication**: Access and refresh tokens
- **OAuth Integration**: Apple Sign In, Google Sign In
- **User Management**: Profiles, preferences, settings
- **Email Verification**: Account verification and password reset

### AI Motivation System

- **Message Generation**: Personalized AI motivation based on goals
- **Voice Synthesis**: ElevenLabs integration for voice messages
- **Scheduling**: Smart reminder scheduling and delivery
- **Context Awareness**: Goal history and user preferences

### Social Features

- **Posts**: Text and voice posts with media
- **Interactions**: Likes, comments, and reactions
- **Following**: User following and feed system
- **Discovery**: Search and filtering capabilities

### Subscriptions & Payments

- **Apple IAP**: iOS In-App Purchase verification
- **Google Play**: Android billing integration
- **Subscription Management**: Plan upgrades, cancellations
- **Webhooks**: Platform notification handling

## 🛠️ Tech Stack

- **Framework**: FastAPI with async/await
- **Language**: Python 3.11+
- **Database**: Supabase (PostgreSQL) with realtime
- **Authentication**: Supabase Auth + JWT
- **AI**: OpenAI GPT-5 + ElevenLabs
- **Media**: Cloudflare R2 for file storage
- **Notifications**: Firebase Cloud Messaging
- **Caching**: Redis for performance
- **Queue**: Celery for background tasks

## 🚀 Development

### Prerequisites

- Python 3.11+
- Poetry (for dependency management)
- Redis (for caching and queues) - See [Redis Setup Guide](docs/REDIS_SETUP.md)
- Supabase account
- OpenAI API key

### Setup

```bash
# Install Poetry (if not already installed)
curl -sSL https://install.python-poetry.org | python3 -

# Install dependencies
poetry install

# Activate virtual environment
poetry shell

# Copy environment variables
cp .env.example .env

# Start development server
poetry run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Running Celery Worker for Background Tasks

The API uses Celery for background tasks (like generating suggested goals). You need to run a Celery worker process in addition to the API server.

#### 1. Verify Redis is Running

First, make sure Redis is running locally:

```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# Or check with docker (if using Docker)
docker ps | grep redis

# Or check the process
ps aux | grep redis-server
```

If Redis isn't running, start it (see [Redis Setup Guide](docs/REDIS_SETUP.md) for details):

```bash
# Using Homebrew (macOS)
brew services start redis

# Or using Docker
docker run -d -p 6379:6379 redis:7-alpine

# Or start Redis server directly
redis-server
```

#### 2. Start Celery Worker

In a **separate terminal** (keep the API server running in the first terminal), start the Celery worker:

```bash
# Navigate to apps/api directory
cd apps/api

# Activate Poetry environment (if not already)
poetry shell

# Start Celery worker
poetry run celery -A celery_worker worker --loglevel=info

# Note: Celery workers don't auto-reload code changes.
# Restart the worker manually when you modify task code.
```

**What you should see:**

```
[INFO/MainProcess] Connected to redis://localhost:6379/0
[INFO/MainProcess] celery@your-hostname ready.
```

#### 3. Verify Worker is Running

You can verify the worker is connected to Redis and ready:

**Option A: Using Redis CLI**

```bash
redis-cli
> KEYS celery*
> GET celery-task-meta-*
```

**Option B: Using Celery CLI**

```bash
# In another terminal, while worker is running
poetry run celery -A celery_worker inspect active
poetry run celery -A celery_worker inspect registered
```

**Option C: Check Health Endpoint**
The API has a health check endpoint that verifies Celery workers:

```bash
curl http://localhost:8000/health
```

Look for the `celery` component in the response - it should show worker status.

#### 4. Testing Task Execution

When you call `requestSuggestedGoals()` from your mobile app, here's what happens:

1. **API receives request** → Creates a "pending" record in `suggested_goals` table
2. **Task queued** → Celery task `generate_suggested_goals_task` is enqueued to Redis
3. **Worker picks up task** → You'll see log output in the Celery worker terminal:

   ```
   [INFO/MainProcess] Task generate_suggested_goals[task-id] received
   [INFO/ForkPoolWorker-1] Starting suggested goals generation...
   [INFO/ForkPoolWorker-1] Generated AI goals for user
   [INFO/MainProcess] Task generate_suggested_goals[task-id] succeeded
   ```

4. **Task completes** → Status in database updates to "ready" or "failed"

#### 5. Monitoring Task Status

**Check task logs in worker terminal:**

- Success: `Task generate_suggested_goals[...] succeeded`
- Failure: `Task generate_suggested_goals[...] failed` (with error details)

**Check database status:**

```sql
-- In Supabase SQL editor
SELECT user_id, status, error_message, updated_at
FROM suggested_goals
WHERE user_id = 'your-user-id';
```

**Status values:**

- `pending` - Task is queued, waiting for worker
- `ready` - Task completed successfully, goals are available
- `failed` - Task failed (check `error_message` field)

#### 6. Troubleshooting

**Problem: Tasks aren't being processed**

- ✅ Check Redis is running: `redis-cli ping`
- ✅ Check worker is running: Look for `celery@hostname ready` in worker logs
- ✅ Check Redis connection: Worker logs should show `Connected to redis://...`
- ✅ Verify environment variables: `REDIS_HOST`, `REDIS_PORT`, etc. match your Redis setup

**Problem: Worker can't connect to Redis**

- Check Redis is accessible: `redis-cli -h localhost -p 6379 ping`
- Verify environment variables in `.env` file
- Check for firewall/network issues

**Problem: Tasks fail immediately**

- Check worker logs for error messages
- Verify all dependencies are installed: `poetry install`
- Check API keys (OpenAI, etc.) are set correctly
- Look for database connection issues

**Problem: Worker shows tasks but doesn't execute**

- Check if worker has the task registered: `celery -A celery_worker inspect registered`
- Restart worker if you just added a new task
- Verify task name matches exactly: `generate_suggested_goals`

#### 7. Running Worker in Production

For production, you'll want to run the worker as a service. See the [Deployment Guide](docs/Deployment.md) for details.

## 📊 Monitoring

### New Relic APM

New Relic monitoring is automatically enabled when `NEW_RELIC_LICENSE_KEY` is set in your environment variables. The monitoring includes:

- **Application Performance Monitoring (APM)**
- **Error tracking and alerting**
- **Database query monitoring**
- **Custom metrics and dashboards**
- **Distributed tracing**

### PostHog Analytics

PostHog analytics is automatically enabled when `POSTHOG_API_KEY` is set in your environment variables. The analytics includes:

- **User event tracking**
- **User identification and properties**
- **Exception autocapture**
- **Custom event tracking**
- **User journey analytics**

#### Usage Example

```python
from app.core.analytics import track_event, identify_user, track_user_signup

# Identify a user
identify_user(user_id="user123", properties={"email": "user@example.com"})

# Track custom events
track_event(user_id="user123", event_name="goal_created", properties={"category": "fitness"})

# Track user signup
track_user_signup(user_id="user123", auth_provider="google")
```

### Adding Dependencies

```bash
# Add production dependencies
poetry add fastapi@latest uvicorn@latest
poetry add sqlalchemy@latest alembic@latest
poetry add openai@latest

# Add development dependencies
poetry add --group dev pytest@latest black@latest mypy@latest

# Add specific version
poetry add "fastapi>=0.100.0,<0.101.0"

# Add with extras
poetry add "uvicorn[standard]"
```

### Poetry Commands

```bash
# Install dependencies
poetry install

# Add new dependency
poetry add <package-name>

# Add development dependency
poetry add --group dev <package-name>

# Update dependencies
poetry update

# Show dependency tree
poetry show --tree

# Export to requirements.txt (if needed)
poetry export -f requirements.txt --output requirements.txt

# Run commands in virtual environment
poetry run <command>

# Activate shell
poetry shell
```

### Database Migrations

```bash
# Generate migration (never create migration files manually)
alembic revision --autogenerate -m "Add users table"

# Run migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1

# Check migration status
alembic current
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_KEY=eyJhbGc...

# JWT
JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# OAuth
APPLE_CLIENT_IDS=com.fitnudge.app,com.fitnudge.dev (optional, comma-separated list)
APPLE_TEAM_ID=ABC123DEF4
APPLE_KEY_ID=XYZ789
APPLE_PRIVATE_KEY_PATH=./certs/AuthKey_XYZ789.p8
GOOGLE_CLIENT_IDS=ios-client-id.apps.googleusercontent.com,android-client-id.apps.googleusercontent.com (optional, comma-separated list)
GOOGLE_CLIENT_SECRET=GOCSPX-...

# AI
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...

# Media
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_ACCESS_KEY_ID=your-access-key
CLOUDFLARE_SECRET_ACCESS_KEY=your-secret-key
CLOUDFLARE_BUCKET_NAME=fitnudge-media
CLOUDFLARE_PUBLIC_URL=https://your-bucket.your-account.r2.cloudflarestorage.com

# Email
SMTP_HOST=mail.privateemail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@fitnudge.app
SMTP_PASSWORD=your-password
FROM_EMAIL=noreply@fitnudge.app
FROM_NAME=FitNudge
REPLY_TO_EMAIL=hello@fitnudge.app
BASE_URL=https://fitnudge.app  # For development: http://localhost:3000

# Notifications
FCM_SERVER_KEY=...
EXPO_ACCESS_TOKEN=...

# Infrastructure - Redis Configuration
# For local development (defaults shown - optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_SSL=false

# For production (or legacy URL format)
# REDIS_URL=redis://:password@host:6379/0

# See docs/REDIS_SETUP.md for detailed Redis setup instructions
SENTRY_DSN=https://...
```

## 📁 Project Structure

```
apps/api/
├── main.py                 # FastAPI application
├── requirements.txt        # Python dependencies
├── app/
│   ├── __init__.py
│   ├── auth/              # Authentication routes
│   ├── goals/             # Goals management
│   ├── motivation/        # AI motivation system
│   ├── social/            # Social features
│   ├── subscriptions/     # IAP and billing
│   ├── admin/             # Admin endpoints
│   ├── blog/              # Blog management
│   ├── core/              # Core utilities
│   ├── models/             # Database models
│   ├── schemas/           # Pydantic schemas
│   └── utils/             # Helper functions
├── tests/                 # Test files
└── migrations/            # Database migrations
```

## 🔌 API Endpoints

### Authentication

- `POST /api/v1/auth/signup` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/oauth/apple` - Apple Sign In
- `POST /api/v1/auth/oauth/google` - Google Sign In
- `POST /api/v1/auth/refresh` - Token refresh
- `POST /api/v1/auth/logout` - User logout

### Goals & Progress

- `GET /api/v1/goals` - Get user goals
- `POST /api/v1/goals` - Create goal
- `PUT /api/v1/goals/:id` - Update goal
- `DELETE /api/v1/goals/:id` - Delete goal
- `POST /api/v1/goals/:id/check-ins` - Record check-in

### AI Motivation

- `GET /api/v1/motivations` - Get motivation messages
- `POST /api/v1/motivations/generate` - Generate AI message
- `POST /api/v1/motivations/schedule` - Schedule reminder

### Social Features

- `GET /api/v1/feed` - Get combined feed
- `POST /api/v1/posts` - Create post
- `POST /api/v1/posts/:id/like` - Like/unlike post
- `POST /api/v1/posts/:id/comments` - Add comment
- `GET /api/v1/users/search` - Search users
- `POST /api/v1/users/:id/follow` - Follow user

### Subscriptions

- `GET /api/v1/subscriptions/plans` - Get available plans
- `GET /api/v1/subscriptions/me` - Get user subscription
- `POST /api/v1/iap/apple/verify-receipt` - Verify Apple purchase
- `POST /api/v1/iap/google/verify-purchase` - Verify Google purchase

## 🧪 Testing

```bash
# Run tests
pytest

# Run with coverage
pytest --cov=app

# Run specific test file
pytest tests/test_auth.py
```

## 📊 Monitoring

- **Health Checks**: `/health` endpoint for monitoring
- **Error Tracking**: Sentry integration
- **Performance**: New Relic APM
- **Logging**: Structured JSON logging
- **Metrics**: Custom business metrics

## 🚀 Deployment

### Railway/Render

```bash
# Deploy to Railway
railway deploy

# Environment variables set in dashboard
```

### Docker

```bash
# Build image
docker build -t fitnudge-api .

# Run container
docker run -p 8000:8000 fitnudge-api
```

## 🔗 Related Documentation

- [API-Spec.md](../../docs/API-Spec.md) - Complete API documentation
- [DataModels.md](../../docs/DataModels.md) - Database schema
- [Architecture.md](../../docs/Architecture.md) - System architecture
- [EnvironmentSetup.md](../../docs/EnvironmentSetup.md) - Setup guide
