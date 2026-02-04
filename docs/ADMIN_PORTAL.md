# FitNudge Admin Portal

> Comprehensive guide for admins managing the FitNudge project. Covers the Admin API, Admin Portal (web), Celery task monitoring, and all features that require administrative control.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Admin API](#admin-api)
4. [Admin Portal (Web)](#admin-portal-web)
5. [Celery Task Monitoring](#celery-task-monitoring)
6. [User Management](#user-management)
7. [Subscription Management](#subscription-management)
8. [Analytics & Reporting](#analytics--reporting)
9. [App Config Management](#app-config-management)
10. [Broadcasts & Notifications](#broadcasts--notifications)
11. [Blog](#blog)
12. [Maintenance Mode](#maintenance-mode)
13. [Audit Logs](#audit-logs)
14. [Database Schema Reference (Migrations)](#database-schema-reference-migrations)
15. [Mobile App Features Requiring Admin](#mobile-app-features-requiring-admin)
16. [Implementation Gaps & Roadmap](#implementation-gaps--roadmap)

---

## Overview

The FitNudge admin system consists of:

- **Admin API** (`apps/admin-api/`): FastAPI backend for administrative operations
- **Admin Portal** (`apps/admin-portal/`): Next.js dashboard for admins
- **Main API** (`apps/api/`): Public API; some admin endpoints (e.g., blog) live here

Admins must have `role = 'admin'` in the `users` table. All admin actions are audit-logged.

**Note**: The main API's blog admin endpoints check `admin_users` table—this table is not in migrations (FITNUDGE_SPEC says it was removed in favor of `users.role`). If blog admin is used, ensure `admin_users` exists or update blog.py to use `users.role = 'admin'`.

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Admin Portal   │────▶│   Admin API     │────▶│   Supabase      │
│  (Next.js)      │     │   (FastAPI)     │     │   PostgreSQL    │
│  Port: 3001     │     │   Port: 8001    │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 │  Celery Inspect / Control
                                 ▼
                        ┌─────────────────┐
                        │   Redis         │
                        │   Celery Workers│
                        └─────────────────┘
```

**Environment Variables** (Admin API uses same as main API):

- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `SECRET_KEY`
- `REDIS_URL`
- `ALLOWED_ORIGINS` (admin dashboard domain)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` (optional) – On startup, create/ensure an admin user with this email. Idempotent: safe to run every time.
- **Password reset** (in `apps/admin-api/.env.local`): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `FROM_EMAIL`, `FROM_NAME`, `REPLY_TO_EMAIL`, `ADMIN_PORTAL_URL` (base URL for reset links, e.g. `https://admin.fitnudge.app` or `http://localhost:3001`)
- **Data export retry**: Handled entirely within Admin API (no cross-service calls). Uses same SMTP config as password reset.

---

## Admin API

### Setup

```bash
cd apps/admin-api
poetry install
```

### Run

```bash
# Development
poetry run uvicorn main:app --reload --port 8001

# Production
poetry run uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001}
```

### Base URL

- Local: `http://localhost:8001`
- API prefix: `/api`

### Authentication

1. **Login**: `POST /api/auth/login` with `{ "email": "...", "password": "..." }`
2. Returns JWT with `type: "admin"`
3. Use header: `Authorization: Bearer <token>`

### Endpoints Summary

| Category | Method | Endpoint | Description |
|----------|--------|----------|-------------|
| **Auth** | POST | `/api/auth/login` | Admin login |
| | GET | `/api/auth/me` | Current admin user |
| | POST | `/api/auth/logout` | Logout (audit) |
| **Health** | GET | `/health` | Health check (DB, Celery, Redis) |
| **Users** | GET | `/api/users` | List users (paginated, filterable) |
| | GET | `/api/users/stats` | User statistics |
| | GET | `/api/users/{id}` | User detail |
| | PATCH | `/api/users/{id}` | Update user |
| | GET | `/api/users/{id}/goals` | User's goals |
| | GET | `/api/users/{id}/activity` | User's check-ins |
| **Subscriptions** | GET | `/api/subscriptions/stats` | Stats + MRR |
| | GET | `/api/subscriptions` | List subscriptions |
| | GET | `/api/subscriptions/{id}` | Subscription detail |
| | POST | `/api/subscriptions/{id}/cancel` | Cancel subscription |
| | POST | `/api/subscriptions/grant` | Grant subscription |
| **Tasks** | See [Celery Task Monitoring](#celery-task-monitoring) |
| **Analytics** | GET | `/api/analytics/dashboard` | Dashboard stats |
| | GET | `/api/analytics/users/growth` | User growth |
| | GET | `/api/analytics/checkins/activity` | Check-in activity |
| | GET | `/api/analytics/retention` | Retention cohorts |
| | DELETE | `/api/analytics/cache` | Clear analytics cache |

---

## Admin Portal (Web)

### Setup

```bash
cd apps/admin-portal
pnpm install
```

### Run

```bash
pnpm dev   # Typically http://localhost:3001
```

### React Query (TanStack Query)

**All API calls in the Admin Portal must use TanStack React Query.** Do not fetch data with `useEffect` + `useState`; use `useQuery` for reads and `useMutation` for writes.

- **Query keys**: Centralized in `src/hooks/api/queryKeys.ts`
- **Hooks**: `useUsersList`, `useUsersStats`, `useUserDetail`, `useSubscriptionsList`, `useSubscriptionsStats`, `useSubscriptionDetail`, `useAuthMe`, etc. in `src/hooks/api/`
- **Benefits**: Automatic caching, background refetch, invalidation after mutations, loading/error states

When adding new API endpoints, create corresponding query keys and hooks; use them in views instead of direct `fetch` or `api()` calls.

### UI & Shared Components

The Admin Portal uses **shared components** from `packages/ui` (shadcn/ui). All reusable UI lives in the monorepo package so it can be used across Admin Portal, Web app, and future apps.

- **Design goal**: Minimal, beautiful admin panel—clean layouts, consistent spacing, accessible components.
- **Component location**: `packages/ui/src/components/` — place reusable components here (e.g. `spinner`, `skeleton`, `badge`, `table`).
- **shadcn components**: Button, Card, Dialog, Input, etc. live in `packages/ui/src/components/ui/`.

**Installing new shadcn components** — if a component is missing, from the **repo root** run:

```bash
pnpm run shadcn add <component-name>
```

Example: `pnpm run shadcn add spinner` or `pnpm run shadcn add skeleton`. This adds the component to `packages/ui`; then import from `@repo/ui` in the Admin Portal.

### Environment (admin-portal)

| Variable | Description |
|----------|-------------|
| `ADMIN_API_URL` | Admin API base URL for auth proxy (default: `http://localhost:8001`) |
| `NEXT_PUBLIC_APP_URL` | App URL for server-side fetch (default: `http://localhost:3001`) |

### Auth Flow

- Visiting `/` → redirects to `/login` if unauthenticated, `/dashboard` if authenticated
- Login page at `/login` → POST to Admin API via Next.js proxy, sets `admin_token` cookie
- Middleware checks cookie on protected routes
- Dashboard at `/dashboard` → requires auth
- Logout clears cookie and redirects

### Navigation (Sidebar)

| Section | Links |
|---------|-------|
| — | Overview |
| **Management** | Users, Subscriptions, **User Reports**, **Referrals**, **Data Export**, **Deactivation Logs** |
| **Content** | Blog |
| **Tasks** | Overview, Task Logs, Task Failures, Beat Schedule, Workers, Active, Scheduled, Registered |
| **Analytics** | Dashboard, User Growth, Check-in Activity, Retention |
| **Settings** | App Config, App Versions, Broadcasts, Maintenance, Audit Logs, Subscription Plans, Legal Documents |

User Reports (review, action, dismiss) lives under Management. See [User Reports & Moderation](#user-reports--moderation) and [Phase 4–5 roadmap](#phase-4-audit--reports).

### Current State

- Login page with form (email/password)
- Dashboard with logout
- Auth context + TanStack Query
- Middleware for route protection
- **Needs**: Full UI for all admin features (see [Implementation Gaps](#implementation-gaps--roadmap))

---

## Celery Task Monitoring

The admin portal must provide a **dedicated Celery monitoring page** with full visibility into task execution.

### Admin API Endpoints (Already Implemented)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks/overview` | Workers online, active/scheduled/reserved counts |
| GET | `/api/tasks/workers` | Detailed worker info (ping, stats, registered, queues) |
| GET | `/api/tasks/active` | Currently executing tasks |
| GET | `/api/tasks/scheduled` | Scheduled/pending tasks (from beat) |
| GET | `/api/tasks/{task_id}` | **Task detail** (state, args, kwargs, result, error, traceback, timing) |
| POST | `/api/tasks/{task_id}/revoke` | Revoke/cancel task (`?terminate=true` to force kill) |
| POST | `/api/tasks/purge` | Purge pending tasks from queue |
| GET | `/api/tasks/registered/list` | All registered task names |
| POST | `/api/tasks/catchup-checkins` | Trigger catch-up task (see below) |
| GET | `/api/tasks/recent` | Recent task completions (success/failure) from Redis |
| GET | `/api/tasks/failures` | Persistent failure log (task_audit_log) |
| DELETE | `/api/tasks/failures/{id}` | Delete failure record |
| GET | `/api/tasks/beat-schedule` | Celery Beat periodic schedule |

### Task Detail Response (`GET /api/tasks/{task_id}`)

```json
{
  "id": "abc-123",
  "name": "send_morning_motivations",
  "state": "FAILURE",
  "args": [],
  "kwargs": {},
  "result": null,
  "error": "ConnectionError: Redis connection refused",
  "traceback": "Traceback (most recent call last):\n  ...",
  "started_at": "2025-01-31T10:00:00Z",
  "completed_at": "2025-01-31T10:00:05Z"
}
```

- **If passed**: `result` contains output; `error`/`traceback` null
- **If failed**: `error` and `traceback` explain why

### UI Requirements for Celery Page

1. **Overview Dashboard**
   - Workers online count
   - Active / scheduled / reserved task counts
   - Worker list with status, active tasks, processed count

2. **Active Tasks**
   - Table: task ID, name, worker, args, kwargs, time started
   - Link to task detail
   - Revoke button

3. **Scheduled Tasks**
   - Table: task ID, name, worker, ETA, priority
   - Revoke button

4. **Task Detail View**
   - State badge (PENDING, STARTED, SUCCESS, FAILURE, REVOKED)
   - Args, kwargs
   - **If passed**: Result output (formatted)
   - **If failed**: Error message + full traceback (expandable)
   - Timing: started_at, completed_at, duration
   - Revoke button (if not terminal)

5. **Registered Tasks**
   - Searchable list of all task names
   - Quick reference for debugging

6. **Task Logs**
   - Recent completions (success and error) from Redis result backend
   - Results expire after ~1 hour; filter by status or task name; copy task ID for lookup
   - Task names require `result_extended=True` in Celery config (main API `celery_app.py`)

7. **Task Failures**
   - Persistent log of failed tasks (30-day retention, configurable)
   - Filter by task name; export CSV; delete records after fixing errors

8. **Beat Schedule**
   - When each periodic task is due (read-only display)

9. **Task Lookup**
   - Paste task ID (from logs or copy from log entry) to inspect result, error, traceback

10. **Actions**
   - Purge queue (with confirmation)
   - Trigger catch-up check-ins (see below)

### Catch-Up Check-Ins Task

After maintenance/downtime, backfill missing check-ins:

- **Auto mode**: `{ "lookback_days": 7 }` or `{}` (defaults to 7)
- **Manual mode**: `{ "start_date": "2025-01-25", "end_date": "2025-01-30" }`

Creates check-ins with `status='pending'` for scheduled days; hourly `mark_missed_checkins` will mark them `missed`.

### Task Failure Recording

Failures are recorded automatically via Celery signal handlers:

- **FAILURE**: Task raises an exception → `task_failure` signal → insert into `task_audit_log`
- **SOFT_FAILURE**: Task returns `{success: false, error: "..."}` → `task_success` signal → insert into `task_audit_log`

Records are kept for **TASK_AUDIT_LOG_RETENTION_DAYS** (default 30). The `cleanup_task_audit_log` task runs weekly (Sunday 4am UTC) to delete older records.

### Failure Alerting

Set `TASK_FAILURE_WEBHOOK_URL` (main API env) to POST failure details to a webhook when a task fails. Payload: `{ task_id, task_name, state, error_message, created_at }`. Works with Slack incoming webhooks, Incident.io, or any HTTP endpoint.

### Configurable Retention

Set `TASK_AUDIT_LOG_RETENTION_DAYS` (main API env) to change how long failure records are kept before cleanup (default 30).

---

## Celery Beat Schedule (Reference)

| Task | Schedule | Purpose |
|------|----------|---------|
| `precreate_daily_checkins` | Hourly | Pre-create pending check-ins |
| `mark_missed_checkins` | Hourly | Mark pending as missed at EOD |
| `send_scheduled_ai_motivations` | Every minute | Reminder notifications |
| `send_morning_motivations` | Every minute | Morning motivation |
| `send_checkin_prompts` | Every minute | "How did it go?" 30 min after reminder |
| `send_checkin_followups` | Every minute | Follow-up 2h after prompt |
| `send_reengagement_notifications` | Daily | Re-engage inactive users (7+ days) |
| `notify_inactive_partners` | Daily | Partner hasn't checked in 3+ days |
| `reset_missed_streaks` | Hourly | Reset streaks for missed days |
| `reset_weekly_completions` | Daily | Reset week_completions (Mondays) |
| `refresh_analytics_views` | Hourly | Refresh materialized views |
| `prewarm_analytics_cache_task` | Every 8h | Pre-compute analytics |
| `generate_weekly_recaps` | Daily | Weekly recaps |
| `check_expiring_subscriptions` | Daily | Warn before expiry |
| `process_failed_webhook_events` | Every 5 min | Retry RevenueCat webhooks |
| `cleanup_expired_partner_requests` | Daily | Clean partner requests |
| `cleanup_inactive_user_partnerships` | Daily | Clean disabled user partnerships |
| `enforce_free_tier_limits` | Daily | Enforce free tier limits |
| `downgrade_expired_promotional_subscriptions` | Daily | Downgrade expired promos |
| `cleanup_expired_refresh_tokens` | Daily | Clean refresh tokens |
| `check_account_age_achievements` | Daily | Account age milestones |
| `cleanup_orphaned_notifications` | Weekly | Remove orphaned notifications |
| `cleanup_blocked_partnership_nudges` | Weekly | Clean blocked partnership nudges |
| `check_streak_at_risk` | Hourly | Streak-at-risk nudges |
| `check_risky_day_warning` | Every 15 min | Risky day warnings |
| `check_missed_days_intervention` | Daily | Missed 2+ days intervention |
| `check_approaching_milestone` | Daily | Approaching streak milestone |

---

## User Management

### Capabilities

- **List users**: Pagination, search (email/name), filter by status/role
- **User detail**: Profile, goals count, check-ins count, onboarding status
- **Update user**: status (`active`, `disabled`, `suspended`), role (`user`, `admin`), display_name
- **User goals**: List user's goals
- **User activity**: Recent check-ins

### User Stats

`GET /api/users/stats` returns:

- Total users
- By status: active, disabled
- By role: admin, user
- By subscription: premium, free

---

## Subscription Management

### Capabilities

- **Stats**: Total, active, by plan, by platform (iOS/Android), by status, MRR
- **List subscriptions**: Pagination, filter by status/platform
- **Subscription detail**: Full record + user info
- **Cancel**: Immediate or at period end (DB only—does not cancel Apple/Google billing)
- **Grant**: Grant premium to user for N days (support/promotions)

### Subscription source (platform)

`subscriptions.platform` distinguishes how a user got premium:

| Platform         | Meaning                                |
|------------------|----------------------------------------|
| `ios`, `android` | User paid via App Store / Play Store   |
| `admin_granted`  | Admin granted via Admin API            |
| `promo`          | Referral bonus or other promo          |

Grant creates/updates `subscriptions` and `users.plan`. Referral bonuses set `platform = 'promo'`.

**Existing databases**: If 004 migration was already applied, run the SQL in `docs/SUPABASE_RUN_SUBSCRIPTION_PLATFORM_UPDATE.sql` to allow `admin_granted` and `promo`.

### Cancel behavior & RevenueCat

**Admin cancel is DB-only.** The Admin Portal and Admin API do not call RevenueCat. Cancelling a subscription updates the `subscriptions` table and (for immediate cancel) the `users.plan` column—nothing in RevenueCat is changed.

- **Promo**: Promo entitlements may exist in RevenueCat (e.g. from referral bonuses). Admin cancel does **not** revoke them in RevenueCat. The mobile app syncs from RevenueCat, so in theory a future sync could overwrite a cancelled promo in the DB. In practice, promos expire naturally and this is rarely an issue.
- **Admin-granted**: These subscriptions are created **only** in the database; RevenueCat has no record of them. The mobile app’s `RevenueCatContext` syncs subscription status from RevenueCat to the backend. To avoid overwriting admin-granted subs, the main API’s `/subscriptions/sync` endpoint **skips sync** when the existing subscription has `platform = 'admin_granted'`. The DB remains the source of truth for admin-granted subscriptions.

### Mobile app: admin-granted sync guide

When a user has an **admin-granted** subscription:

1. The subscription lives only in the DB; RevenueCat has no entitlement.
2. On login/foreground, the mobile app may call `subscriptionsService.syncSubscription()` (via RevenueCatContext).
3. The sync endpoint detects `platform = admin_granted` on the existing subscription and **does not overwrite**. It returns `synced: false` and `"Admin-granted subscription - not syncing from RevenueCat"`.
4. The app continues to use the subscription from the backend (e.g. `/subscriptions/me`), which reflects the admin-granted premium.

No changes are required in the mobile app for this to work; the guard is enforced server-side.

---

## Analytics & Reporting

### Dashboard (`GET /api/analytics/dashboard`)

- Users: total, new this week, active this week
- Goals: total, active
- Check-ins: total, today, this week
- Subscriptions: active count, MRR

### User Growth (`GET /api/analytics/users/growth?days=30`)

- Daily signups
- Cumulative users

### Check-In Activity (`GET /api/analytics/checkins/activity?days=30`)

- Daily completed vs missed
- Completion rate

### Retention (`GET /api/analytics/retention`)

- Cohort retention (last 8 weeks)
- Retention rate per cohort

### Extended Analytics (Phase 2)

- `GET /api/analytics/subscriptions/by-platform` — Subscription breakdown by platform (iOS, Android, Promo, Admin)
- `GET /api/analytics/subscriptions/mrr-trend?days=30` — MRR trend over time
- `GET /api/analytics/referrals` — Referral analytics (count, conversion rate, top referrers)
- `GET /api/analytics/subscriptions/churn?days=30` — Churn / cancellations over time
- `GET /api/analytics/engagement` — DAU/WAU/MAU
- `GET /api/analytics/broadcasts/engagement` — Broadcast engagement (views, clicks) from `notification_history` where `entity_type = admin_broadcast`

### Cache

- `DELETE /api/analytics/cache`: Clear analytics cache (use after schema changes)

---

## App Config Management

### Database

Table: `app_config` (migration `020_app_config.sql`)

| Column | Type | Description |
|--------|------|-------------|
| key | TEXT | Unique key (e.g. `ios_app_store_url`) |
| value | TEXT | Value |
| category | TEXT | Grouping |
| description | TEXT | Admin UI help text |
| is_public | BOOLEAN | Fetchable without auth |

### Categories

- `app_store_urls`: iOS/Android store URLs
- `external_urls`: Privacy, terms, help, contact, Tally, Tawk
- `social_media`: Twitter, Instagram, Facebook, LinkedIn, TikTok
- `maintenance`: See [Maintenance Mode](#maintenance-mode)

### Main API (Read-Only)

- `GET /api/v1/app-config/public` – All public config
- `GET /api/v1/app-config/public/{category}` – By category

### Admin API (To Be Built)

Admin needs CRUD for `app_config`:

- `GET /api/app-config` – List all (including non-public)
- `GET /api/app-config/{key}` – Get one
- `PUT /api/app-config/{key}` – Update
- `POST /api/app-config` – Create (if needed)

---

## Broadcasts & Notifications

### Database

Table: `notifications` (migration `032_maintenance_and_broadcasts.sql`)

Admin broadcast definitions for in-app modals and optional push.

| Column | Type | Description |
|--------|------|-------------|
| title | TEXT | Title |
| body | TEXT | Body |
| image_url | TEXT | Optional image |
| cta_label | TEXT | CTA button label |
| cta_url | TEXT | CTA URL |
| deeplink | TEXT | App deep link |
| source_lang | TEXT | Default locale (e.g. `en`) |
| translations | JSONB | Per-locale title/body/cta_label |
| is_active | BOOLEAN | Show/hide |
| starts_at | TIMESTAMPTZ | Start date |
| ends_at | TIMESTAMPTZ | End date |
| audience | TEXT | `all`, `free`, `premium` |
| delivery | TEXT | `push`, `in_app`, `both` |

### Main API (User-Facing)

- `GET /api/v1/notifications/broadcasts/active` – Active broadcasts for user
- `POST /api/v1/notifications/broadcasts/{id}/mark-seen` – Mark seen

### Admin API (To Be Built)

Admin needs CRUD for `notifications`:

- `GET /api/broadcasts` – List all
- `GET /api/broadcasts/{id}` – Detail
- `POST /api/broadcasts` – Create
- `PUT /api/broadcasts/{id}` – Update
- `DELETE /api/broadcasts/{id}` – Delete
- `POST /api/broadcasts/{id}/send-push` – Push to audience (if delivery includes push)

---

## Blog

### Database (Migration `004_infrastructure.sql`)

Blog tables for website content:

| Table | Description |
|-------|--------------|
| `blog_posts` | id, title, slug, content, excerpt, featured_image_url, status (draft/published/archived), author_id, published_at, created_at, updated_at |
| `blog_categories` | id, name, slug, description, created_at |
| `blog_post_categories` | post_id, category_id (many-to-many) |
| `blog_tags` | id, name, slug, created_at |
| `blog_post_tags` | post_id, tag_id (many-to-many) |

RLS policies (migration `006_rls_policies.sql`): Public read for all blog tables.

### Main API (Blog Endpoints)

**Public (no auth):**

- `GET /api/v1/blog/posts` – List published posts (paginated, filter by category/tag)
- `GET /api/v1/blog/posts/{slug}` – Single post by slug
- `GET /api/v1/blog/categories` – Categories with post counts
- `POST /api/v1/blog/posts/{slug}/view` – Track view (analytics)

**Admin (require auth + `admin_users` or `users.role = 'admin'`):**

- `GET /api/v1/blog/admin/posts` – List all posts (including drafts), filter by status
- `POST /api/v1/blog/admin/posts` – Create post
- `PUT /api/v1/blog/admin/posts/{post_id}` – Update post
- `DELETE /api/v1/blog/admin/posts/{post_id}` – Delete post
- `POST /api/v1/blog/admin/posts/{post_id}/publish` – Publish post
- `GET /api/v1/blog/admin/categories` – List categories
- `POST /api/v1/blog/admin/categories` – Create category
- `GET /api/v1/blog/analytics` – Blog analytics (admin only)

**Note:** The main API's blog admin endpoints currently check the `admin_users` table. Per FITNUDGE_SPEC, `admin_users` may have been removed in favor of `users.role = 'admin'`. If blog admin returns 403, ensure `admin_users` exists or update `blog.py` to use `users.role = 'admin'`.

### Admin Portal

Blog management is available in the Admin Portal sidebar under **Content → Blog**. Full CRUD UI can be built by adding blog endpoints to the Admin API (proxy to Supabase) or by integrating with the main API's blog admin endpoints.

---

## Maintenance Mode

### App Config Keys

| Key | Description |
|-----|-------------|
| `maintenance_enabled` | `true`/`false` – Show maintenance screen |
| `maintenance_title` | Screen title |
| `maintenance_message` | Message |
| `maintenance_image_url` | Optional image |
| `maintenance_cta_label` | Optional CTA label |
| `maintenance_cta_url` | Optional CTA URL |
| `maintenance_bypass_user_ids` | JSON array of user UUIDs allowed to skip |

### Behavior

- When `maintenance_enabled` is `true`, mobile app shows maintenance screen
- Blocks all routes including auth
- `maintenance_bypass_user_ids` allows internal testers to bypass

### Post-Maintenance: Catch-Up Check-Ins (Required)

While maintenance is on, Celery tasks (including `precreate_daily_checkins`) may not run. When **disabling** maintenance, you **must** trigger the catch-up task to backfill missed check-ins:

1. Disable maintenance (set `maintenance_enabled` to `false`)
2. Trigger **catch-up check-ins** via Admin API: `POST /api/tasks/catchup-checkins`  
   - **Auto mode** (recommended): `{ "lookback_days": 7 }` or `{}` (defaults to 7 days)
   - **Manual mode**: `{ "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD" }`

This creates check-ins with `status='pending'` for scheduled days during the maintenance window; the hourly `mark_missed_checkins` task will then mark them as `missed`. Without this step, analytics and streak data will be incomplete for that period.

See [Catch-Up Check-Ins Task](#catch-up-check-ins-task) for details.

### Admin Requirements

- Toggle maintenance mode
- Edit title, message, image, CTA
- Manage bypass user IDs
- **Trigger catch-up check-ins after disabling maintenance** (see above)

---

## Audit Logs

### Database

Table: `audit_logs` (migration `004_infrastructure.sql`)

| Column | Type |
|--------|------|
| admin_user_id | UUID |
| action | TEXT |
| resource_type | TEXT |
| resource_id | UUID |
| old_values | JSONB |
| new_values | JSONB |
| ip_address | INET |
| user_agent | TEXT |
| created_at | TIMESTAMPTZ |

### Logged Actions

- `update_user`
- `cancel_subscription`
- `grant_subscription`
- `revoke_task`
- `purge_queue`
- `trigger_catchup_checkins`
- `logout`

### Admin API (To Be Built)

- `GET /api/audit-logs` – List with filters (admin, action, resource, date range)

### Note: audit_logs Schema vs log_admin_action

The `audit_logs` table (migration `004_infrastructure.sql`) has `old_values` and `new_values` JSONB columns. The admin API's `log_admin_action` currently inserts a `details` key—PostgreSQL will ignore unknown columns, so the insert may succeed but `details` won't be stored. Consider adding `ALTER TABLE audit_logs ADD COLUMN details JSONB` or storing details in `new_values` for full audit trail.

---

## Database Schema Reference (Migrations)

Admin-relevant tables from `apps/api/supabase/migrations/`. Use for building admin CRUD and understanding relationships.

### Core Tables

| Table | Migration | Admin Relevance |
|-------|-----------|-----------------|
| `users` | 001 | id, email, name, username, plan, status, role, onboarding_completed_at, last_active_at |
| `goals` | 001 | user_id, status, title, frequency_type, target_days |
| `check_ins` | 001, 022, 023 | user_id, goal_id, check_in_date, status (completed/pending/missed/rest_day/skipped), skip_reason |
| `daily_checkin_summaries` | 001 | Aggregated stats; retention cleanup suggested (24 months) |

### Subscriptions & Plans

| Table | Migration | Admin Relevance |
|-------|-----------|-----------------|
| `subscriptions` | 004 | user_id, **plan** (not plan_id), status, platform, current_period_end, expires_date, grace_period_ends_at |
| `subscription_plans` | 004, 005 | id (free/premium), monthly_price, active_goal_limit, product_id_ios/android |
| `plan_features` | 004, 005 | plan_id, feature_key, feature_value, is_enabled |
| `subscription_deactivation_logs` | 004 | Audit trail: user_id, previous_plan, goals_deactivated, deactivation_reason |

### Notifications & Push

| Table | Migration | Admin Relevance |
|-------|-----------|-----------------|
| `device_tokens` | 004 | user_id, fcm_token, device_type, is_active |
| `notification_history` | 004, 032 | entity_type (`admin_broadcast` for broadcasts), entity_id, dismissed_at |
| `notification_preferences` | 004, 013 | Per-user toggles (ai_motivation, reminders, partners, etc.) |
| `notifications` | 032 | Admin broadcasts (title, body, audience, delivery, starts_at, ends_at) |

### Live Activity & NextUp

| Table | Migration | Admin Relevance |
|-------|-----------|-----------------|
| `live_activity_devices` | 035 | iOS Live Activity tokens (user_id, device_id, push_to_start_token) |
| `nextup_fcm_devices` | 036 | Android NextUp FCM tokens (user_id, device_id, fcm_token) |

### Blog

| Table | Migration | Admin Relevance |
|-------|-----------|-----------------|
| `blog_posts` | 004 | title, slug, content, excerpt, featured_image_url, status (draft/published/archived), author_id, published_at |
| `blog_categories` | 004 | name, slug, description |
| `blog_post_categories` | 004 | post_id, category_id (many-to-many) |
| `blog_tags` | 004 | name, slug |
| `blog_post_tags` | 004 | post_id, tag_id (many-to-many) |

### User Reports & Moderation

| Table | Migration | Admin Relevance |
|-------|-----------|-----------------|
| `user_reports` | 011 | reporter_id, reported_user_id, reason (inappropriate_username, harassment, spam, other), status (pending, reviewed, actioned, dismissed), admin_notes |

### App Config & Legal

| Table | Migration | Admin Relevance |
|-------|-----------|-----------------|
| `app_config` | 020, 032 | key, value, category, is_public; maintenance keys |
| `app_versions` | 004, 005 | platform, latest_version, minimum_version, force_update, release_notes |
| `legal_documents` | 027 | type (terms_of_service, privacy_policy, cookie_policy), version, content, is_current |
| `user_legal_acceptances` | 027 | user_id, legal_document_id, accepted_at |

### Webhooks & Compliance

| Table | Migration | Admin Relevance |
|-------|-----------|-----------------|
| `webhook_events` | 004 | event_id, event_type, status (pending/processing/completed/failed), retry_count, error_message |
| `data_export_requests` | 004 | GDPR: user_id, status, download_url, expires_at |

### Audit & Infrastructure

| Table | Migration | Admin Relevance |
|-------|-----------|-----------------|
| `audit_logs` | 004 | admin_user_id, action, resource_type, resource_id, old_values, new_values |
| `api_keys` | 004 | User API keys (read/write/admin permissions) |

### Referrals

| Table | Migration | Admin Relevance |
|-------|-----------|-----------------|
| `referrals` | 038 | referrer_user_id, referred_user_id, status (pending, subscribed, processing, rewarded, failed), bonus_days |

### Analytics (Materialized Views)

| View | Migration | Admin Relevance |
|------|-----------|-----------------|
| `user_engagement_summary` | 004, 014 | Pre-computed; refreshed hourly by Celery |
| `subscription_analytics` | 004, 014 | Pre-computed; refreshed hourly |
| `analytics.*` (private schema) | 014 | Per-goal analytics |

### Admin API Column Mappings

- **users**: DB has `name`, `plan`; Admin API may expose as `display_name`, `subscription_plan`—ensure mapping matches your schema.
- **subscriptions**: DB column is `plan` (not `plan_id`). Admin API list uses `plan_id`—align with `plan` if needed.

---

## Mobile App Features Requiring Admin

| Feature | Admin Needs | Admin API Status |
|---------|-------------|------------------|
| **Goals** | View user goals; no direct edit | Via user detail |
| **Check-ins** | View activity; trigger catch-up | Via tasks |
| **Achievements** | View types; no edit | Via main API |
| **Notifications** | Push history; broadcast CRUD | ✅ Broadcasts implemented |
| **Partners** | View partnerships; user reports | ✅ User reports implemented |
| **Subscriptions** | Full CRUD, grant, cancel | ✅ Implemented |
| **AI Coach** | Rate limits, usage | Via main API / analytics |
| **Analytics** | Dashboard, cache clear | ✅ Implemented |
| **Weekly Recaps** | Trigger regenerate | Via Celery |
| **Live Activities** | Tokens, debug refresh | Via main API |
| **NextUp (Android)** | FCM tokens, debug | Via main API |
| **App Config** | URLs, feature flags, maintenance | ✅ Implemented |
| **Broadcasts** | Create, schedule, target | ✅ Implemented |
| **Maintenance** | Toggle, message, bypass | ✅ Via app_config |
| **Blog** | Posts, categories | Main API (admin_users check) |
| **Referrals** | Monitor list, status, conversion | Analytics exists; **admin list/monitor: to build** |
| **User Reports** | Review, action, dismiss | ✅ Implemented |
| **App Versions** | Edit latest/minimum, force_update | Main API `PUT /app-version`; **Admin CRUD: to build** |
| **Webhook Events** | Retry failed RevenueCat webhooks | Celery retries; **admin view: to build** |
| **Data Export** | Monitor requests, help users export | **To build** |
| **Legal Documents** | Edit ToS, Privacy, Cookie versions | **To build** |
| **Subscription Plans** | Edit prices, limits, product IDs | **To build** |
| **Plan Features** | Edit and track feature flags per plan | **To build** |
| **Subscription Deactivation Logs** | Monitor deactivation audit trail | **To build** |

---

## Implementation Gaps & Roadmap

### Phase 1: Celery Monitoring UI (High Priority)

- [x] Celery overview page
- [x] Active tasks table
- [x] Scheduled tasks table
- [x] Task detail page (state, result, error, traceback)
- [x] Revoke task
- [x] Purge queue
- [x] Trigger catch-up check-ins (form + auto/manual mode)
- [x] Registered tasks list
- [x] Task Logs (recent completions, search, filters, auto-refresh, copy ID)
- [x] Task Failures (persistent audit log, export CSV, delete)
- [x] Beat Schedule view
- [x] Task lookup by ID

### Phase 2: Analytics Dashboard

**Chart library:** Tremor (`@tremor/react`) — dashboard-focused, Tailwind-based, built-in stat cards and charts.

**Core (API exists):**

- [ ] Dashboard stats cards (users, goals, check-ins, subs, MRR) — `GET /api/analytics/dashboard`
- [ ] User growth chart (daily signups, cumulative) — `GET /api/analytics/users/growth?days=`
- [ ] Check-in activity chart (completed vs missed) — `GET /api/analytics/checkins/activity?days=`
- [ ] Retention cohorts table/chart — `GET /api/analytics/retention`
- [ ] Time range selector (7d / 30d / 90d) for growth and check-in charts
- [ ] Cache clear button — `DELETE /api/analytics/cache`
- [ ] Loading / skeleton states
- [ ] Add translations to `admin-portal/src/locales/en.json` (and es.json, fr.json) for all analytics UI strings

**Extended (new API endpoints):**

- [ ] Subscription breakdown by platform (iOS, Android, Promo, Admin) — new endpoint or extend dashboard
- [ ] MRR trend chart over time — new `GET /api/analytics/subscriptions/mrr-trend?days=`
- [ ] Referral analytics (count, conversion rate, top referrers) — new `GET /api/analytics/referrals`
- [ ] Churn / cancellations over time — new `GET /api/analytics/subscriptions/churn?days=`
- [ ] DAU/WAU/MAU — new `GET /api/analytics/engagement` or extend dashboard

**Polish:**

- [ ] Stat card deltas (e.g. "↑ 12% vs last week")
- [ ] Export CSV for chart data
- [ ] Broadcast engagement (views, clicks) — `notification_history` where entity_type = admin_broadcast

**Additional metrics (all in scope):**

- [ ] Retention matrix (heatmap: week 0, 1, 2, 3 retention per cohort) — extends current retention API
- [ ] Conversion funnel (Free → Paid conversion rate) — `users.plan` + `subscriptions`
- [ ] Check-in by day of week (best/worst days for completion) — `checkins`
- [ ] Streak distribution (users by streak length) — `goals.current_streak`

**Post-implementation:**

- [ ] Update [docs/ADMIN_PORTAL.md](docs/ADMIN_PORTAL.md) with new developments (mark items done, document new endpoints, add to Quick Reference)

### Phase 3: App Config & Maintenance

- [x] Admin API: CRUD for `app_config`
- [x] Admin Portal: App Config page

- [x] Admin Portal: Maintenance mode toggle + form
- [x] Bypass user IDs management

### Phase 4: Broadcasts

- [x] Admin API: CRUD for `notifications` (broadcasts)
- [x] Admin Portal: Broadcasts list + create/edit form
- [x] Audience (all/free/premium), delivery (push/in_app/both)
- [x] Schedule (starts_at, ends_at)
- [ ] Translations (optional)

### Phase 5: Audit & Reports

- [x] Admin API: `GET /api/audit-logs`
- [x] Admin Portal: Audit log viewer

- [x] Admin API: List user reports (from `user_reports` table)
- [x] Admin Portal: Reports review UI

### Phase 6: User Reports & Webhooks

- [x] Admin API: List/filter `user_reports` (pending, reviewed, etc.)
- [x] Admin API: Update report status, add admin_notes
- [x] Admin Portal: Reports queue with actions (dismiss, action)
- [ ] Admin API: List `webhook_events` (failed, retry count)
- [ ] Admin Portal: Failed webhooks table, manual retry trigger

### Phase 7: App Versions, Legal, Plans, Referrals, Data Export (Completed)

**App Versions** (`app_versions` table)

- [x] Admin API: CRUD for `app_versions` (platform, latest_version, minimum_version, force_update, release_notes)
- [x] Admin Portal: Edit app versions per platform (iOS, Android); set force_update, release notes

**Legal Documents** (`legal_documents` table)

- [x] Admin API: CRUD for `legal_documents` (type: terms_of_service, privacy_policy, cookie_policy; version, content, is_current)
- [x] Admin Portal: Create/edit legal document versions; mark as current; textarea for HTML content

**Data Export Requests** (`data_export_requests` table) — GDPR

- [x] Admin API: List `data_export_requests` (user_id, status, download_url, expires_at); retry failed via main API
- [x] Admin Portal: Monitor export requests; view status (pending/processing/completed/failed); copy download link; retry failed

**Subscription Plans** (`subscription_plans` table)

- [x] Admin API: CRUD for `subscription_plans` (id, monthly_price, active_goal_limit, product_id_ios, product_id_android, etc.)
- [x] Admin Portal: Edit plan prices, limits, product IDs

**Plan Features** (`plan_features` table)

- [x] Admin API: List/update `plan_features` (plan_id, feature_key, feature_value, is_enabled)
- [x] Admin Portal: Edit and track plan features; enable/disable features per plan (nested under Subscription Plans)

**Subscription Deactivation Logs** (`subscription_deactivation_logs` table)

- [x] Admin API: List `subscription_deactivation_logs` (user_id, previous_plan, goals_deactivated, deactivation_reason, created_at)
- [x] Admin Portal: Monitor deactivation audit trail; filter by user, date range; export CSV

**Referrals** (`referrals` table)

- [x] Admin API: List `referrals` with filters (status, referrer, referred); join with users for emails
- [x] Admin Portal: Monitor referrals list; view status (pending, subscribed, processing, rewarded, failed); link to referrer/referred user profiles

### Phase 8: Polish

- [ ] Dashboard widgets (users, subs, goals, check-ins) — stat cards in Phase 2
- [ ] Export (CSV) for users, subscriptions
- [ ] Dark mode, accessibility

Note: Analytics charts and export CSV are in Phase 2.

---

## Quick Reference: Admin API Base Paths

```
/api/auth/login
/api/auth/me
/api/auth/logout
/api/users
/api/users/stats
/api/users/{id}
/api/users/{id}/goals
/api/users/{id}/activity
/api/subscriptions
/api/subscriptions/stats
/api/subscriptions/{id}
/api/subscriptions/{id}/cancel
/api/subscriptions/grant
/api/tasks/overview
/api/tasks/workers
/api/tasks/active
/api/tasks/scheduled
/api/tasks/{id}
/api/tasks/{id}/revoke
/api/tasks/purge
/api/tasks/registered/list
/api/tasks/catchup-checkins
/api/tasks/recent
/api/tasks/failures
/api/tasks/beat-schedule
/api/analytics/dashboard
/api/analytics/users/growth
/api/analytics/checkins/activity
/api/analytics/retention
/api/analytics/subscriptions/by-platform
/api/analytics/subscriptions/mrr-trend
/api/analytics/subscriptions/churn
/api/analytics/referrals
/api/analytics/engagement
/api/analytics/broadcasts/engagement
/api/analytics/cache  (DELETE)
/api/app-config
/api/app-config/{key}
/api/app-versions
/api/app-versions/{platform}
/api/audit-logs
/api/data-export
/api/data-export/{id}
/api/data-export/{id}/retry
/api/legal-documents
/api/legal-documents/{id}
/api/legal-documents/{id}/set-current
/api/plan-features/by-plan/{plan_id}
/api/plan-features/{id}
/api/referrals
/api/subscription-deactivation-logs
/api/subscription-plans
/api/subscription-plans/{id}
/api/broadcasts
/api/broadcasts/{id}
```

---

## Related Docs

- [Architecture](../apps/docs/Architecture.md)
- [Deployment](../apps/docs/Deployment.md)
- [LIVE_ACTIVITY_NEXTUP](../apps/docs/LIVE_ACTIVITY_NEXTUP.md)
- [TESTING_GUIDE](./TESTING_GUIDE.md)
