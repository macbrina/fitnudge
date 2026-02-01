# incident.io Status Page Setup Guide for FitNudge

This guide covers setting up incident.io as our public status page solution, replacing the custom health page at `/health` while continuing to use our internal health checks (`apps/api/app/core/health.py`) for mobile app monitoring.

## Free Tier vs Premium (API)

| Feature                     | Free (current)       | Premium (later)          |
| --------------------------- | -------------------- | ------------------------ |
| Public status page          | ✅                   | ✅                       |
| Components & sub-components | ✅ (UI only)         | ✅                       |
| Create/update incidents     | ✅ **Manual** via UI | ✅ **Automated** via API |
| Component status updates    | ✅ **Manual** via UI | ✅ **Automated** via API |
| Widget API (embed status)   | ✅ Public, no auth   | ✅                       |
| API / Webhooks              | ❌                   | ✅                       |

**We are not using the API yet** (premium). This guide focuses on **manual** setup and workflows. When we go premium, we’ll add API automation—see [When you go premium](#when-you-go-premium).

---

## Table of Contents

1. [Overview](#overview)
2. [Account Setup](#account-setup)
3. [Component Structure](#component-structure)
4. [Component Mapping](#component-mapping)
5. [Manual Incident Workflow](#manual-incident-workflow)
6. [Status Page vs Widget API](#status-page-vs-widget-api)
7. [Widget API Integration](#widget-api-integration)
8. [Best Practices](#best-practices)
9. [When you go premium](#when-you-go-premium)

---

## Overview

### Why incident.io?

- **Professional Status Page**: Public-facing status page you can link from FitNudge
- **Component Management**: Track Website vs Mobile App and sub-components (API, Database, etc.)
- **Incident History**: Create incidents and post updates via the UI; full history on the status page
- **Widget API**: Public JSON endpoint to embed status in our web app (no API key needed)
- **Later (Premium)**: API + webhooks for automated incidents from our health checks

### Architecture (free tier, no API)

```
┌─────────────────────────────────────────────────────────────┐
│                    FitNudge Health Checks                    │
│              (apps/api/app/core/health.py)                   │
│                                                              │
│  • Supabase, SMTP, OpenAI                                   │
│  • Used by mobile app & internal monitoring only             │
│  • Not synced to incident.io (no API)                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    incident.io (manual)                      │
│                                                              │
│  • Status page, components, incidents                        │
│  • Create/update incidents & component status via UI         │
│  • When you notice issues (alerts, users, health dashboard)  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Widget API (public, no auth)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              FitNudge Web App (/health)                      │
│         Embed or link to incident.io status page             │
└─────────────────────────────────────────────────────────────┘
```

---

## Account Setup

### 1. Create incident.io Account

1. Go to [incident.io](https://incident.io) and sign up
2. Choose a workspace name (e.g., `fitnudge`)
3. Complete initial setup wizard

### 2. Enable Status Page

1. Navigate to **Settings** → **Status Page**
2. Enable **Public Status Page**
3. Configure:
   - **Page Name**: "FitNudge Status"
   - **Page URL**: `https://status.fitnudge.app/` (or your custom domain)
   - **Description**: "Real-time status of FitNudge services and infrastructure"
   - **Logo**: Upload FitNudge logo
   - **Theme Colors**: Match FitNudge brand colors

### 3. API Key (skip for now)

API keys are **premium**. We’re not using the API yet. When we go premium, see [When you go premium](#when-you-go-premium) for generating and using an API key.

---

## Component Structure

### Recommended Component Hierarchy

```
FitNudge Status Page
│
├── Website Component
│   ├── API Backend (Sub-component)
│   ├── Database (Sub-component)
│   └── Authentication (Sub-component)
│
└── Mobile App Component
    ├── API Backend (Sub-component)
    ├── Push Notifications (Sub-component)
    └── AI Features (Sub-component)
```

### Component Configuration

#### 1. Website Component

**Settings:**

- **Name**: `Website`
- **Description**: "FitNudge web application and user-facing services"
- **Status**: Operational (default)
- **Group**: None (top-level)

**Sub-components:**

1. **API Backend**
   - Name: `API Backend`
   - Description: "REST API and core backend services"
   - Maps to: Supabase health check

2. **Database**
   - Name: `Database`
   - Description: "PostgreSQL database and data storage"
   - Maps to: Supabase health check

3. **Authentication**
   - Name: `Authentication`
   - Description: "User authentication and authorization"
   - Maps to: Supabase health check

#### 2. Mobile App Component

**Settings:**

- **Name**: `Mobile App`
- **Description**: "FitNudge iOS and Android mobile applications"
- **Status**: Operational (default)
- **Group**: None (top-level)

**Sub-components:**

1. **API Backend**
   - Name: `API Backend`
   - Description: "Backend API services for mobile app"
   - Maps to: Supabase health check

2. **Push Notifications**
   - Name: `Push Notifications`
   - Description: "Email and push notification delivery"
   - Maps to: SMTP health check

3. **AI Features**
   - Name: `AI Features`
   - Description: "AI-powered check-in responses and coaching"
   - Maps to: OpenAI health check

### Creating Components via UI

1. Navigate to **Status Page** → **Components**
2. Click **Add Component**
3. Fill in component details:
   - **Name**: Component name
   - **Description**: Brief description
   - **Group**: Select parent component (for sub-components) or leave empty
   - **Status**: Operational
4. Repeat for all components and sub-components

### Component IDs (optional for now)

With the **free tier**, you manage everything in the UI. You don’t need to store component IDs unless you later use the Widget API or custom logic. If needed, IDs are visible in the incident.io UI (e.g. in URLs when editing a component).

---

## Component Mapping

### FitNudge Health Checks → incident.io Components

| FitNudge Component | Health Check        | incident.io Component | incident.io Sub-component |
| ------------------ | ------------------- | --------------------- | ------------------------- |
| `supabase`         | Core database/auth  | Website               | API Backend               |
| `supabase`         | Core database/auth  | Website               | Database                  |
| `supabase`         | Core database/auth  | Website               | Authentication            |
| `supabase`         | Core database/auth  | Mobile App            | API Backend               |
| `smtp`             | Email notifications | Mobile App            | Push Notifications        |
| `openai`           | AI features         | Mobile App            | AI Features               |

### Status Mapping

| Health Check Status | incident.io Component Status                |
| ------------------- | ------------------------------------------- |
| `ok`                | `operational`                               |
| `degraded`          | `degraded_performance`                      |
| `critical`          | `major_outage`                              |
| `not_configured`    | `operational` (or exclude from status page) |

---

## Manual Incident Workflow

Without the API, you manage incidents and component status **manually** in the incident.io UI.

### When to create an incident

- You see errors in logs, monitoring, or the health dashboard (`/health` or internal tools)
- Users report issues (support, app store reviews, etc.)
- Supabase, SMTP, or OpenAI checks fail in `health.py` (you’d notice via alerts or manual checks)

### Creating an incident (UI)

1. Log in to incident.io → **Incidents**
2. Click **New incident**
3. Fill in:
   - **Name**: e.g. “Database connectivity issues”
   - **Summary**: Short description of what’s wrong
   - **Severity**: Minor / Major / Critical
   - **Affected components**: Select Website and/or Mobile App sub-components (e.g. API Backend, Database, Push Notifications, AI Features)
4. Save. The incident appears on the status page and affects the selected components.

### Updating an incident (UI)

1. Open the incident in incident.io
2. Add **Updates** with:
   - **Status**: Investigating → Identified → Monitoring → Resolved
   - **Body**: What you found, what you’re doing, ETA if possible
3. Post updates every 15–30 minutes while the incident is active.

### Resolving an incident (UI)

1. When the issue is fixed, add a final **Update**
2. Set **Status** to **Resolved**
3. **Body**: e.g. “The issue has been resolved. We’ll continue to monitor.”

### Updating component status directly (UI)

You can also change a **component’s** status without creating an incident:

1. Go to **Status Page** → **Components**
2. Open the component (e.g. API Backend, AI Features)
3. Set **Status**: Operational / Degraded / Partial outage / Major outage
4. Save. The status page updates immediately.

Use this for small, localized issues (e.g. “AI Features degraded”) when you don’t need a full incident thread.

### Using our health checks (no API)

- **Mobile app**: Keeps using `GET /health` and `health.py` as today. No change.
- **Internal monitoring**: You can still use your health dashboard, logs, or alerts.
- **incident.io**: Updated **manually** when you decide to create/update incidents or component status based on what you see.

---

## Status Page vs Widget API

You typically have **both**; they serve different purposes:

|                | **Status Page**                                                                            | **Widget API**                                                                         |
| -------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| **What it is** | The **human-facing website** users open in a browser (e.g. `https://status.fitnudge.app/`) | A **JSON endpoint** your apps call (e.g. `https://status.fitnudge.app/api/v1/summary`) |
| **Audience**   | People (users, support, you)                                                               | Your code (web app, mobile app, scripts)                                               |
| **Use**        | Read status, incident history, maintenance schedule                                        | **Embed** status in your app, show badges, link to incidents, automate checks          |
| **Format**     | HTML / UI                                                                                  | JSON                                                                                   |

- **Status page** = source of truth. You create/update incidents and components there; users visit it to see what’s going on.
- **Widget API** = same data, machine-readable. Your `/health` page (or mobile app) fetches the JSON and renders it your way, or you simply link to the status page.

**Do you need both?**

- **Status page**: yes. You need a place to manage and display status.
- **Widget API**: optional, but useful if you want to **embed** status (e.g. on your web app’s `/health` page) or **automate** (e.g. “X ongoing incidents” badge, or check before calling critical APIs). If you only **link** to the status page, you don’t need to call the Widget API.

---

## Widget API Integration

### Overview

The **Widget API** is an **unauthenticated** JSON endpoint that returns the **current summary** of your system status (ongoing incidents, maintenances). Same data as the status page, in structured form. Use it to embed status in the web app or to drive badges/links.

### Endpoint

```
https://status.fitnudge.app/api/v1/summary
```

### Response Structure

The API returns only the **summary** (no full component list). Structure:

```json
{
  "page_title": "FitNudge System",
  "page_url": "https://status.fitnudge.app/",
  "ongoing_incidents": [
    {
      "id": "01H0QJ89CRW5BKTY9N89MSDT5S",
      "name": "Login failing for some users",
      "status": "identified",
      "url": "https://status.fitnudge.app/incidents/01H0QJ89CRW5BKTY9N89MSDT5S",
      "last_update_at": "2026-01-26T02:11:43Z",
      "last_update_message": "...",
      "current_worst_impact": "partial_outage",
      "affected_components": [
        {
          "id": "01H0QJ1BXP0E76RGBYRDHKA2KQ",
          "name": "Login",
          "group_name": "Authentication",
          "current_status": "partial_outage"
        }
      ]
    }
  ],
  "in_progress_maintenances": [
    {
      "id": "01FDAG4SAP5TYPT98WGR2N7W91",
      "name": "Database upgrade",
      "status": "maintenance_in_progress",
      "last_update_at": "2026-01-26T02:11:43Z",
      "last_update_message": "...",
      "url": "https://status.fitnudge.app/incidents/01FDAG4SAP5TYPT98WGR2N7W91",
      "affected_components": [],
      "started_at": "2026-01-26T02:11:43Z",
      "scheduled_end_at": "2026-01-26T02:11:43Z"
    }
  ],
  "scheduled_maintenances": [
    {
      "id": "01FCNDV6P870EA6S7TK1DSYD5H",
      "name": "Essential maintenance",
      "status": "maintenance_scheduled",
      "last_update_at": "2026-01-26T02:11:43Z",
      "last_update_message": "...",
      "url": "https://status.fitnudge.app/incidents/01FCNDV6P870EA6S7TK1DSYD5H",
      "affected_components": [],
      "starts_at": "2026-01-26T02:11:43Z",
      "ends_at": "2026-01-26T02:11:43Z"
    }
  ]
}
```

**Status values:**

- **Incident `status`**: `investigating` | `identified` | `monitoring`
- **Incident `current_worst_impact`** / **component `current_status`**: `operational` | `degraded_performance` | `partial_outage` | `full_outage`
- **Maintenance `status`**: `maintenance_scheduled` | `maintenance_in_progress`

**Is this enough?**  
Yes for typical use: embed ongoing incidents + maintenances, link to detail pages, show “All clear” vs “X ongoing” badge. You don’t get a full component list, but you get affected components per incident/maintenance, which is what you need for user-facing status.

### Integration in Web App

Example: fetch summary and use it on your `/health` page (or anywhere you embed status):

```typescript
// apps/web/src/lib/statusSummary.ts

const STATUS_SUMMARY_URL =
  process.env.NEXT_PUBLIC_STATUS_SUMMARY_URL ||
  "https://status.fitnudge.app/api/v1/summary";

export interface AffectedComponent {
  id: string;
  name: string;
  group_name?: string;
  current_status: string;
}

export interface OngoingIncident {
  id: string;
  name: string;
  status: string;
  url: string;
  last_update_at: string;
  last_update_message: string;
  current_worst_impact: string;
  affected_components: AffectedComponent[];
}

export interface Maintenance {
  id: string;
  name: string;
  status: string;
  url: string;
  last_update_at: string;
  last_update_message: string;
  affected_components: AffectedComponent[];
  starts_at?: string;
  ends_at?: string;
  started_at?: string;
  scheduled_end_at?: string;
}

export interface StatusSummary {
  page_title: string;
  page_url: string;
  ongoing_incidents: OngoingIncident[];
  in_progress_maintenances: Maintenance[];
  scheduled_maintenances: Maintenance[];
}

export async function fetchStatusSummary(): Promise<StatusSummary> {
  const response = await fetch(STATUS_SUMMARY_URL, {
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch status summary");
  }

  return response.json();
}

/** Simple "all clear" check for badges etc. */
export function isAllClear(summary: StatusSummary): boolean {
  return (
    summary.ongoing_incidents.length === 0 &&
    summary.in_progress_maintenances.length === 0
  );
}
```

---

## Best Practices

### 1. Component Naming

- Use clear, user-friendly names (e.g. "API Backend", "AI Features")
- Avoid technical jargon in public-facing components
- Keep descriptions short and informative

### 2. Manual Incident Workflow

- **Create an incident** when you confirm an issue (from health checks, logs, or user reports)
- **Post updates** every 15–30 minutes while the incident is active
- **Resolve** only when the issue is actually fixed
- **Avoid duplicates**: check for an existing active incident before creating a new one

### 3. Status Updates

- Write clear, actionable updates
- Include ETA when you have one
- Use status progression: Investigating → Identified → Monitoring → Resolved

### 4. Component Status

- Use **component status** (Operational / Degraded / Partial outage / Major outage) for simple, localized issues
- Use **incidents** when you need a timeline, updates, and affected components

### 5. Widget API

- Cache Widget API responses (e.g. 60s) to avoid hammering the endpoint
- Handle fetch errors gracefully; fall back to “Check status page” link if needed

---

## When you go premium

Once we use the **paid API**:

1. **Generate an API key** (Settings → API Keys) with `incidents:write`, `components:read` / `components:write`, `status_pages:read`.
2. **Store** the key and component IDs in env (e.g. `INCIDENT_IO_API_KEY`, `INCIDENT_IO_COMPONENT_*`).
3. **Automate incident.io from health checks**: add a module (e.g. `incident_io.py`) that calls the API to create/update incidents and component status based on `health.py` results. Use the [incident.io API docs](https://api-docs.incident.io/) for endpoints.
4. **Webhooks** (optional): configure incident.io webhooks to your backend (e.g. `/api/v1/webhooks/incident-io`) to react to incident created/updated/resolved. Verify signatures with Svix.
5. **Remove** manual steps for incidents driven by health checks; keep manual incidents for things not covered by health (e.g. third‑party outages, product bugs).

The earlier version of this doc had full API examples and Python snippets; we removed them to avoid implying we use the API today. When we go premium, we can restore those into a separate `INCIDENT_IO_API.md` or add a “Premium / API” section here.

---

## Migration Checklist (free tier)

- [ ] Create incident.io account and workspace
- [ ] Enable public status page
- [ ] Create Website component and sub-components (API Backend, Database, Authentication)
- [ ] Create Mobile App component and sub-components (API Backend, Push Notifications, AI Features)
- [ ] Replace `/health` with Widget API embed (`https://status.fitnudge.app/api/v1/summary`) or link to status page (`https://status.fitnudge.app/`)
- [ ] Document manual incident workflow for the team (create → update → resolve)
- [ ] Keep mobile app and internal tooling on existing `GET /health` + `health.py`; no changes required
- [ ] **Later (premium):** API key, env vars, `incident_io.py`, webhooks, automated sync from health checks

---

## Resources

- [incident.io Help Center](https://help.incident.io/) — status page, components, incidents (UI)
- [Widget API](https://help.incident.io/articles/7434055319-embed-your-status-page's-data-into-your-own-product) — public JSON for embedding status (no API key)
- [incident.io API](https://api-docs.incident.io/) — **premium**; use when we add API automation
- [Webhooks](https://help.incident.io/articles/4766982100-webhooks) — **premium**; use when we add API automation

---

## Support

For issues or questions:

1. Check [incident.io Help Center](https://help.incident.io/)
2. Verify Widget API URL and response format if embedding status
3. Contact incident.io support if needed

---

**Last Updated**: January 2025  
**Maintained By**: FitNudge Engineering Team  
**Note**: This guide targets the **free tier (no API)**. API automation is planned for when we go premium.
