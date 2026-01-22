# Deployment Guide

This document captures the production deployment plan for the FitNudge stack, using [Railway](https://railway.app/) for application hosting. It focuses on the API, Celery workers, queues, and supporting services that must be configured before you publish the mobile and web clients.

---

## 1. Architecture Overview

- **API:** FastAPI application (`apps/api`, served by `uvicorn`), exposes REST endpoints and health checks.
- **Task Queue:** Celery worker pool using Redis for broker + result backend.
- **Database:** Supabase (Postgres + Auth). Credentials supplied via environment variables.
- **Storage:** Cloudflare R2 for media assets.
- **Email:** Namecheap Private Email SMTP relay.
- **AI Integrations:** OpenAI, ElevenLabs for content generation and speech.
- **Feature Flags:** LaunchDarkly (from the mobile app).
- **Analytics:** PostHog (mobile + web clients).

Production requires the API service and at least one Celery worker process online at all times. Mobile and web clients communicate with the API and expect healthy `/health` responses.

---

## 2. Railway Project Setup

1. **Create a Railway project.**
2. **Connect GitHub repo** (recommended) or use the CLI to push images.
3. **Add the API service:**
   - Deploy the `apps/api` directory.
   - Set build command to `poetry install --no-root`.
   - Set start command to `poetry run uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}`.
4. **Add a Celery worker service (separate Railway service):**
   - Same build command.
   - Start command: `poetry run celery -A app.core.celery_app.celery_app worker --loglevel=info`.
   - Configure the same environment variables as the API service so both can reach Redis, Supabase, etc.

Railway automatically provides the `PORT` environment variable. Ensure the API binds to `0.0.0.0`.

---

## 3. Environment Variables

Create a shared “Environment Group” in Railway (or copy the same variables into each service). Required keys:

| Key                                                                                                                                    | Description                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `ENVIRONMENT`                                                                                                                          | e.g. `production`.                                                                             |
| `DEBUG`                                                                                                                                | `false` in production.                                                                         |
| `DATABASE_URL`                                                                                                                         | Supabase Postgres connection string (if API performs direct DB access).                        |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`                                                                                                | Supabase REST and service credentials.                                                         |
| `SECRET_KEY`                                                                                                                           | JWT signing secret.                                                                            |
| `ACCESS_TOKEN_EXPIRE_MINUTES` / `REFRESH_TOKEN_EXPIRE_DAYS`                                                                            | Override defaults if needed.                                                                   |
| `ALLOWED_ORIGINS`                                                                                                                      | Comma list of frontend domains (`https://app.fitnudge.app,https://fitnudge.app`).              |
| `ALLOWED_HOSTS`                                                                                                                        | Domains that can reach the API.                                                                |
| `REDIS_URL`                                                                                                                            | `rediss://...` Upstash endpoint. Append `?ssl_cert_reqs=none` if you rely on Upstash defaults. |
| `OPENAI_API_KEY`                                                                                                                       | If prompting features are enabled.                                                             |
| `ELEVENLABS_API_KEY`                                                                                                                   | Voice synthesis.                                                                               |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ACCESS_KEY_ID`, `CLOUDFLARE_SECRET_ACCESS_KEY`, `CLOUDFLARE_BUCKET_NAME`, `CLOUDFLARE_PUBLIC_URL` | R2 credentials.                                                                                |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `FROM_EMAIL`, `FROM_NAME`, `REPLY_TO_EMAIL`                                | Namecheap Private Email settings.                                                              |
| `POSTHOG_API_KEY`, `POSTHOG_HOST`                                                                                                      | Analytics for API-triggered events.                                                            |
| `NEW_RELIC_LICENSE_KEY`, `NEW_RELIC_APP_NAME`                                                                                          | Optional monitoring.                                                                           |

Other keys (OAuth client IDs, LaunchDarkly, Supabase anon keys, etc.) live in the mobile/web configs via Expo/Next environment handling. Keep them in the hosting platform you use for those clients.

---

## 4. Redis / Queue Configuration

- **Broker:** Upstash Redis (serverless). Create a database, copy the `rediss://` URL.
- **TLS:** Celery requires explicit SSL options. Either append `?ssl_cert_reqs=none` to the URL or set the broker/result SSL options in `celery_app.py` (already handled in the repo).
- **REST tokens:** Only needed if you plan to interact with Upstash REST API; Celery uses the Redis URL.

### Celery Production Commands

In production, run **separate processes** instead of combining `--beat` with the worker:

#### Development (combined - fine for local dev):
```bash
poetry run celery -A celery_worker worker --beat --loglevel=info
```

#### Production (recommended - separate services):
```bash
# Service 1: Worker (can have multiple instances for scaling)
poetry run celery -A celery_worker worker --loglevel=info

# Service 2: Beat scheduler (ONLY ONE instance - never scale this)
poetry run celery -A celery_worker beat --loglevel=info

# Service 3: Flower monitoring (optional)
poetry add flower  # if not already installed
poetry run celery -A celery_worker flower --port=5555
```

#### Why Separate in Production?

| Component | Instances | Purpose |
|-----------|-----------|---------|
| **Worker** | 1-4+ | Executes tasks. Scale based on load. |
| **Beat** | Exactly 1 | Schedules periodic tasks. Multiple instances = duplicate tasks! |
| **Flower** | 0-1 | Web UI for monitoring. Optional but recommended. |

#### Railway Service Configuration

For Railway, create separate services:

1. **celery-worker** service:
   - Start command: `poetry run celery -A celery_worker worker --loglevel=info`
   - Can scale replicas if needed

2. **celery-beat** service:
   - Start command: `poetry run celery -A celery_worker beat --loglevel=info`
   - Keep at 1 replica only

3. **celery-flower** service (optional):
   - Start command: `poetry run celery -A celery_worker flower --port=${PORT:-5555}`
   - Expose via Railway domain for admin access

---

## 5. Storage & Media

- Provision a Cloudflare R2 bucket.
- Generate access keys (S3-compatible) and add the env vars listed above.
- Ensure bucket CORS allows API origin for PUT/GET if signed URLs are generated server side.

---

## 6. Email

- Validate SMTP credentials from Namecheap Private Email.
- In production set `SMTP_PORT=587`, `SMTP_HOST=mail.privateemail.com`.
- Confirm that outbound 587 is allowed on Railway (it is). Emails are sent via `email_service.py`.

---

## 7. Monitoring & Health Checks

- Railway Health Check: point to `/health` (JSON response). It merges multiple component checks (Supabase, Redis, Celery, SMTP, Cloudflare, AI keys).
- Optionally integrate New Relic by setting the env vars and adding the agent start-up script.

### Celery Task Monitoring

#### Option 1: Flower (Recommended for Quick Setup)
Real-time web-based monitor:
```bash
poetry run celery -A celery_worker flower --port=5555
```
Features:
- Task success/failure rates and history
- Real-time task progress
- Worker status and resource usage
- Can be password-protected for production

#### Option 2: Custom Admin Dashboard (Future)
For a fully integrated admin, use Celery signals to log task results to the database:

```python
from celery.signals import task_success, task_failure, task_prerun

@task_prerun.connect
def task_started(task_id, task, *args, **kwargs):
    # Log task start to DB

@task_success.connect
def task_succeeded(sender, result, **kwargs):
    # Log success to DB

@task_failure.connect
def task_failed(sender, task_id, exception, **kwargs):
    # Log failure with error details to DB
```

This allows querying task history, building dashboards, and alerting on failures.

---

## 8. Deploying the Mobile App

Although Railway hosts the backend, you still publish the Expo app:

1. Ensure `EXPO_PUBLIC_API_URL` (or runtime base URL) points to the Railway API domain (e.g. `https://api.fitnudge.app/api/v1`).
2. Run `expo prebuild` to refresh native configs when OAuth or Google Sign-In values change.
3. Use EAS Build/App Store & Play Store for distribution (outside the scope of this doc).

For web (Next.js / `apps/web`), deploy separately (Vercel, Netlify, Railway). Set `NEXT_PUBLIC_API_URL` or equivalent environment variables to the same API base.

---

## 9. Admin API & Dashboard

The admin system consists of two components:

### Admin API (`apps/admin-api`)

Separate FastAPI application providing administrative endpoints:

```bash
# Development
cd apps/admin-api
poetry install
poetry run uvicorn main:app --reload --port 8001

# Production
poetry run uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001}
```

#### Railway Configuration

Create a separate Railway service for admin-api:

| Setting | Value |
|---------|-------|
| **Root Directory** | `apps/admin-api` |
| **Build Command** | `poetry install --no-root` |
| **Start Command** | `poetry run uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001}` |

#### Security Recommendations

- **Restrict access**: Use Railway's private networking or IP allowlist
- **Separate domain**: e.g., `admin-api.fitnudge.app` (not public)
- **Admin users only**: API checks `role = 'admin'` on every request

#### Admin API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/login` | Admin login |
| `GET /api/users` | List/search users |
| `GET /api/users/{id}` | User details |
| `PATCH /api/users/{id}` | Update user |
| `GET /api/subscriptions` | List subscriptions |
| `GET /api/subscriptions/stats` | MRR and subscription metrics |
| `POST /api/subscriptions/grant` | Grant subscription to user |
| `GET /api/tasks/overview` | Celery task queue status |
| `GET /api/tasks/workers` | Worker details |
| `GET /api/tasks/{id}` | Task status |
| `POST /api/tasks/{id}/revoke` | Cancel a task |
| `GET /api/analytics/dashboard` | Admin dashboard stats |

### Admin Dashboard (`apps/admin`)

Next.js frontend for the admin interface. Connects to the Admin API.

```bash
# Environment
NEXT_PUBLIC_ADMIN_API_URL=https://admin-api.fitnudge.app
```

---

## 10. Deployment Workflow

1. Commit to `main` or a release branch.
2. Railway detects the change, rebuilds the container image, and restarts the API service.
3. Celery worker restarts with the same build; confirm logs show successful Redis connection.
4. Run database migrations if needed (Supabase SQL migrations via `supabase db push` or the provided migration scripts).
5. Smoke-test `/health` and key endpoints.
6. Publish mobile/web client releases referencing the new API.

---

## 11. Post-Deployment Checklist

- [ ] `/health` returns `status: "ok"` and component checks pass.
- [ ] Celery worker logs show “Ready” without TLS errors.
- [ ] Emails send successfully (trigger a password reset).
- [ ] Media upload/download works (Cloudflare R2).
- [ ] Feature flags, analytics, AI endpoints confirm connectivity.
- [ ] Observability: verify logs, alerts, and metrics on Railway.

### Admin API
- [ ] Admin API `/health` returns OK with database and Celery connected.
- [ ] Admin login works with an admin user (`role = 'admin'`).
- [ ] Task monitoring shows active Celery workers.
- [ ] User management endpoints return data.
- [ ] Access is restricted (not publicly accessible).

Keep this file updated as infrastructure evolves (e.g. if you move to managed Postgres or add additional services).
