# 🧱 Fitness Motivation AI App — Architecture.md

---

## 🧩 Overview

This document defines the **technical architecture** of the Fitness Motivation AI App — a mobile-first product designed to help users stay consistent with their gym and fitness goals through AI-powered motivation, accountability, and daily check-ins.

The stack is structured as a **monorepo** for scalability, shared logic, and clean maintainability between frontend, backend, and mobile clients.

---

## 🧭 Monorepo Structure

apps/
├── web/ # Marketing + documentation site (Next.js)
├── api/ # FastAPI backend (Python)
├── admin-portal/ # Admin dashboard for managing users, plans, analytics
├── mobile/ # React Native app (Expo)
└── docs/ # Developer & user documentation

packages/
├── ui/ # Shared shadcn/ui components
│ ├── src/
│ │ ├── button.tsx
│ │ ├── card.tsx
│ │ └── code.tsx
│ └── styles/
│ ├── button.styles.ts
│ ├── card.styles.ts
│ └── index.ts
├── lib/ # Utilities and hooks shared across apps
├── db/ # Supabase ORM client, migrations, and schema
├── ai/ # GPT-5 prompt templates and logic
├── notifications/ # FCM and scheduling utilities
├── types/ # Shared TypeScript types and DTOs
├── themes/ # Design tokens, CSS variables
│ ├── tokens/
│ │ ├── colors.ts
│ │ ├── typography.ts
│ │ ├── spacing.ts
│ │ ├── shadows.ts
│ │ └── radius.ts
│ ├── stylesheets/
│ │ ├── variables.css
│ │ └── themes.css
│ └── index.ts
├── n8n/ # Localization automation for mobile/web (admin uses English only)
│ ├── locales/
│ │ ├── en.json
│ │ ├── es.json
│ │ ├── fr.json
│ │ ├── de.json
│ │ └── common.json
│ ├── jobs/
│ │ ├── translate_common_words.workflow.json
│ │ └── sync_supabase_locales.workflow.json
│ └── utils.py
└── config/ # Environment configs and tokens for all apps

---

## 🎨 Design System Architecture

### 📦 Theme Package Structure

The `packages/themes` package provides a comprehensive design token system with the following organization:

**Token Files (`tokens/`):**

- `colors.ts` - Semantic color tokens for light/dark modes
- `typography.ts` - Font families, sizes, weights, line-heights
- `spacing.ts` - Consistent spacing scale (xs, sm, md, lg, xl, 2xl, 3xl)
- `shadows.ts` - Elevation system (sm, md, lg)
- `radius.ts` - Border radius tokens (sm, md, lg, xl, full)

**Stylesheets (`stylesheets/`):**

- `variables.css` - CSS custom properties mapped from tokens
- `themes.css` - Light/dark mode class definitions

**Entry Point (`index.ts`):**

- Exports all tokens and utilities

### 🎯 Token Categories

**Color Tokens:**
Semantic naming with light/dark variants:

- `background` / `foreground` - Main app background and text
- `card` / `card-foreground` - Card surfaces and text
- `primary` / `primary-foreground` - Motivation blue (#2563EB base)
- `secondary` / `secondary-foreground` - Secondary actions
- `muted` / `muted-foreground` - Subtle text and backgrounds
- `accent` / `accent-foreground` - Accent colors
- `destructive` / `destructive-foreground` - Error states
- `success` / `success-foreground` - Positive states (check-ins, achievements)
- `warning` / `warning-foreground` - Gentle reminders and alerts
- `border` / `input` / `ring` - UI element borders and focus states

**Typography Tokens:**

- Font families: Space Grotesk (primary), system fallbacks
- Scale: xs (12px) → 4xl (36px)
- Weights: normal (400) → bold (700)

**Spacing Scale:**

- xs: 4px → 3xl: 64px (consistent 4px base unit)

**Border Radius:**

- sm: 4px → full: 9999px (rounded elements)

**Shadow System:**

- sm: subtle elevation
- md: card elevation
- lg: modal/dialog elevation

### 🔧 CSS Variables Strategy

Tokens are mapped to CSS custom properties for runtime theme switching:

```css
:root {
  --color-background: #ffffff;
  --color-foreground: #0f172a;
  --color-primary: #2563eb;
  --color-destructive: #ef4444;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  /* ... all semantic colors */
}

.dark {
  --color-background: #0f172a;
  --color-foreground: #f8fafc;
  --color-primary: #3b82f6;
  --color-destructive: #dc2626;
  --color-success: #34d399;
  --color-warning: #fbbf24;
  /* ... dark mode variants */
}
```

### 🎨 Styles Folder Architecture

**Shared `packages/ui/styles/` for all component styles:**

Style factory functions that accept theme parameter and return style objects:

```typescript
// packages/ui/styles/button.styles.ts
export const makeButtonStyles = (theme) => ({
  primary: {
    backgroundColor: theme.colors.primary,
    color: theme.colors.primaryForeground,
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    borderRadius: theme.radius.md,
    fontWeight: theme.typography.weight.semibold
  },
  secondary: {
    backgroundColor: theme.colors.secondary,
    color: theme.colors.secondaryForeground,
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    borderRadius: theme.radius.md
  }
});

// Component usage
import { makeButtonStyles } from '@fitnudge/ui/styles';
import { theme } from '@/themes';

const Button = ({ variant = 'primary' }) => {
  const styles = makeButtonStyles(theme);
  return <button style={styles[variant]}>Click me</button>;
};
```

**Naming Convention:**

- Style factory functions: `make[Component]Styles`
- Returns style objects for different component parts
- All styles reference theme tokens through factory functions

### 🌓 Theme Switching Implementation

**Auto-detect + Manual Override:**

1. Check system preference on first visit
2. Allow manual toggle with persistence
3. Store preference in localStorage
4. Apply `.light` or `.dark` class to root element
5. CSS variables automatically switch based on class

**Implementation:**

```typescript
// Theme detection and switching
const useTheme = () => {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved) {
      setTheme(saved as "light" | "dark");
    } else {
      setTheme("system");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  return { theme, toggleTheme };
};
```

### 🎨 Tailwind Integration

Tailwind v4 config references theme tokens:

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        primary: "var(--color-primary)",
        // ... all semantic colors
      },
      fontFamily: {
        sans: ["Space Grotesk", "system-ui", "sans-serif"],
      },
      spacing: {
        xs: "var(--spacing-xs)",
        sm: "var(--spacing-sm)",
        // ... all spacing tokens
      },
    },
  },
};
```

This allows Tailwind classes to automatically use theme tokens:

```html
<div class="bg-background text-foreground p-lg rounded-md shadow-md">
  Content
</div>
```

---

## ⚙️ Backend Stack

| Component         | Technology                     | Purpose                                                            |
| ----------------- | ------------------------------ | ------------------------------------------------------------------ |
| **Framework**     | FastAPI (Python)               | Primary API backend.                                               |
| **Database**      | Supabase (PostgreSQL)          | Relational DB with realtime capabilities.                          |
| **Notifications** | Firebase Cloud Messaging (FCM) | Sends motivational push notifications.                             |
| **AI Engine**     | GPT-5 API (OpenAI)             | Generates personalized motivational text.                          |
| **Voice Engine**  | ElevenLabs API                 | Generates AI audio for “motivational voice” messages.              |
| **Analytics**     | Posthog                        | Tracks user behavior and engagement metrics.                       |
| **Task Queue**    | Celery + Redis                 | Background tasks for scheduled notifications and weekly summaries. |
| **Realtime Sync** | Supabase Realtime              | Keeps feed, check-ins, and social wall updated instantly.          |
| **Media Storage** | Cloudflare R2                  | Image, voice note, and user-generated media storage and delivery.  |
| **Automation**    | n8n (via REST trigger)         | Runs translation and localization jobs.                            |

---

## ⚡ Performance & Optimization

### 🚀 Caching Strategy

**Redis Implementation:**

- **API Response Caching**: Cache frequent API responses (TTL: 5-15 minutes)
- **AI Message Caching**: Cache identical prompts for 24 hours to reduce OpenAI costs
- **User Session Caching**: Store user preferences and settings (TTL: 1 hour)
- **Feed Caching**: Cache social feed data (TTL: 10 minutes)

**Cache Keys Pattern:**

```
api:response:{endpoint}:{params_hash}
ai:message:{prompt_hash}
user:session:{user_id}
feed:social:{user_id}
```

### 🌐 CDN Configuration

**Vercel Edge Network:**

- Static assets (JS, CSS, images) served from global edge locations
- Automatic compression (gzip/brotli)
- Cache headers optimized for performance

**Cloudflare R2 CDN:**

- All user-generated media (images, voice notes) served via Cloudflare R2
- Automatic format optimization (WebP, AVIF)
- Responsive image transformations
- Lazy loading with placeholder images

### 🗄️ Database Optimization

**Connection Pooling:**

- PostgreSQL connection pool: min 5, max 20 connections
- Connection timeout: 30 seconds
- Query timeout: 10 seconds

**Indexing Strategy:**

```sql
-- User queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Goal queries
CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_goals_is_active ON goals(is_active);

-- Check-in queries
CREATE INDEX idx_checkins_goal_id_date ON checkins(goal_id, date);
CREATE INDEX idx_checkins_date ON checkins(date);

-- Social feed queries
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_user_id ON posts(user_id);
```

### 📱 Mobile App Performance

**React Native Optimizations:**

- **Hermes Engine**: Enabled for faster startup and reduced memory usage
- **FlatList Virtualization**: For social feeds and long lists
- **Image Caching**: react-native-fast-image with Cloudflare R2 URLs
- **Lazy Loading**: Screen-based lazy loading for heavy components
- **Bundle Splitting**: Separate bundles for different app sections

**Performance Targets:**

- App startup: < 3 seconds
- Screen transitions: < 300ms
- Image load time: < 2 seconds
- API response time: < 1 second

### 🌐 Web Frontend Performance (Landing Page)

**Next.js Optimizations:**

- **Static Site Generation (SSG)**: Pre-render all marketing pages
- **Image Optimization**: next/image with Cloudflare R2 integration
- **Minimal JavaScript**: Only essential JS for landing page
- **Critical CSS**: Inline critical styles, lazy load non-critical

**Performance Targets:**

- First Contentful Paint: < 1.5s
- Largest Contentful Paint: < 2.5s
- Cumulative Layout Shift: < 0.1

### 📊 API Response Optimization

**Pagination Strategy:**

- Default limit: 20 items per page
- Cursor-based pagination for feeds (better performance)
- Offset-based pagination for static lists
- Maximum limit: 100 items per request

**Response Compression:**

- Gzip compression for all API responses
- Brotli compression for static assets
- JSON minification in production

---

## 📈 Scalability & Infrastructure

### 🚀 Horizontal Scaling

**FastAPI Multi-Worker Deployment:**

- **Gunicorn/Uvicorn**: Multi-worker process management
- **Worker Configuration**: 2-4 workers per instance (CPU cores × 2)
- **Load Balancing**: Nginx reverse proxy with round-robin
- **Health Checks**: `/health` endpoint for load balancer monitoring
- **Graceful Shutdown**: 30-second timeout for in-flight requests

**Auto-Scaling Triggers:**

- CPU utilization > 70% for 5 minutes
- Memory usage > 80% for 3 minutes
- Response time p95 > 2 seconds for 10 minutes
- Queue depth > 100 pending tasks

### ⚖️ Load Balancing

**Nginx Configuration:**

```nginx
upstream api_backend {
    server api1:8000 weight=1;
    server api2:8000 weight=1;
    server api3:8000 weight=1;
}

server {
    listen 80;
    location /api/ {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Health Check Strategy:**

- **Liveness Probe**: Check if process is running
- **Readiness Probe**: Check if app can handle requests
- **Circuit Breaker**: Remove unhealthy instances from rotation

### 🗄️ Database Scaling

**Connection Pooling:**

- **Min Connections**: 5 per instance
- **Max Connections**: 20 per instance
- **Connection Timeout**: 30 seconds
- **Idle Timeout**: 10 minutes

**Read Replicas:**

- **Analytics Queries**: Route to read-only replicas
- **Social Feed**: Use read replicas for feed generation
- **Reporting**: Dedicated analytics replica
- **Replication Lag**: < 1 second acceptable

**Database Optimization:**

```sql
-- Partitioning for large tables
CREATE TABLE checkins_2024_01 PARTITION OF checkins
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Materialized views for complex queries
CREATE MATERIALIZED VIEW user_stats AS
SELECT user_id, COUNT(*) as total_checkins
FROM checkins GROUP BY user_id;
```

### 📸 Media Storage Scaling

**Cloudflare R2 Auto-Scaling:**

- **Automatic CDN**: Global edge locations for media delivery
- **Format Optimization**: Automatic WebP/AVIF conversion
- **Responsive Images**: Multiple sizes generated automatically
- **Lazy Loading**: Progressive image loading
- **Bandwidth Optimization**: Adaptive quality based on connection

**Storage Limits:**

- **Free Tier**: 25GB storage, 25GB bandwidth/month
- **Pro Tier**: 100GB storage, 100GB bandwidth/month
- **Enterprise**: Custom limits with dedicated infrastructure

### 🔄 Background Jobs Scaling

**Celery Worker Configuration:**

- **Worker Processes**: 2-4 workers per instance
- **Queue Priorities**: High (notifications), Normal (analytics), Low (cleanup)
- **Auto-Scaling**: Scale workers based on queue depth
- **Dead Letter Queue**: Failed jobs after 3 retries

**Queue Management:**

```python
# Celery configuration
CELERY_WORKER_CONCURRENCY = 4
CELERY_TASK_ROUTES = {
    'send_notification': {'queue': 'notifications'},
    'generate_analytics': {'queue': 'analytics'},
    'cleanup_old_data': {'queue': 'cleanup'},
}
```

### 🚦 Rate Limiting

**API Rate Limits:**

- **Anonymous Users**: 20 requests/minute
- **Authenticated Users**: 100 requests/minute
- **AI Generation**: 10 requests/hour per user
- **Media Uploads**: 20 uploads/hour per user
- **Burst Allowance**: 2x limit for 1 minute

**Rate Limiting Implementation:**

```python
# Redis-based rate limiting
from redis import Redis
from flask_limiter import Limiter

limiter = Limiter(
    app,
    key_func=lambda: request.headers.get('X-User-ID'),
    storage_uri="redis://localhost:6379"
)

@app.route('/api/v1/motivation/generate')
@limiter.limit("10 per hour")
def generate_motivation():
    pass
```

### 📊 Monitoring & Alerting

**Auto-Scaling Metrics:**

- **CPU Usage**: > 70% for 5 minutes → scale up
- **Memory Usage**: > 80% for 3 minutes → scale up
- **Response Time**: p95 > 2s for 10 minutes → scale up
- **Queue Depth**: > 100 tasks → scale workers
- **Error Rate**: > 1% for 5 minutes → alert

**Scaling Policies:**

- **Scale Up**: Add 1 instance when threshold exceeded
- **Scale Down**: Remove 1 instance when < 30% utilization for 15 minutes
- **Cooldown**: 5 minutes between scaling actions
- **Max Instances**: 10 API instances, 5 worker instances

---

## ♿ Accessibility (a11y) Architecture

### 🎯 WCAG 2.1 AA Compliance

**Accessibility Requirements:**

- **Color Contrast**: 4.5:1 for normal text, 3:1 for large text and UI components
- **Touch Targets**: Minimum 44x44px for all interactive elements
- **Screen Reader Support**: ARIA labels, semantic HTML structure
- **Keyboard Navigation**: Full keyboard accessibility for all features
- **Focus Management**: Visible focus indicators and logical tab order

### 📱 Mobile Accessibility

**React Native Accessibility Props:**

```typescript
// Accessible button component
<TouchableOpacity
  accessible={true}
  accessibilityLabel="Create new goal"
  accessibilityRole="button"
  accessibilityHint="Tap to create a new fitness goal"
  accessibilityState={{ disabled: false }}
>
  <Text>Create Goal</Text>
</TouchableOpacity>

// Accessible form input
<TextInput
  accessible={true}
  accessibilityLabel="Goal title"
  accessibilityRole="text"
  placeholder="Enter your fitness goal"
  accessibilityHint="Type your fitness goal here"
/>
```

**Screen Reader Testing:**

- **iOS**: VoiceOver testing with gesture navigation
- **Android**: TalkBack testing with swipe navigation
- **Web**: NVDA, JAWS, and VoiceOver testing

### 🎨 Visual Accessibility

**Color and Contrast:**

```css
/* High contrast mode support */
@media (prefers-contrast: high) {
  :root {
    --color-primary: #0000ff;
    --color-background: #ffffff;
    --color-foreground: #000000;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Focus Indicators:**

```css
/* Visible focus rings */
.focus-visible {
  outline: 2px solid var(--color-ring);
  outline-offset: 2px;
}

/* Skip navigation links */
.skip-link {
  position: absolute;
  top: -40px;
  left: 6px;
  background: var(--color-primary);
  color: var(--color-primary-foreground);
  padding: 8px;
  text-decoration: none;
  z-index: 1000;
}

.skip-link:focus {
  top: 6px;
}
```

### 🧪 Accessibility Testing

**Automated Testing:**

```javascript
// Jest accessibility tests
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

test("should not have accessibility violations", async () => {
  const { container } = render(<GoalCard />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

**Manual Testing Checklist:**

- [ ] All interactive elements have proper ARIA labels
- [ ] Color contrast meets WCAG 2.1 AA standards
- [ ] Keyboard navigation works for all features
- [ ] Screen reader announces content correctly
- [ ] Focus indicators are visible and logical
- [ ] Touch targets are at least 44x44px
- [ ] Alternative text for all images
- [ ] Form validation messages are accessible

---

## 💳 Payment & Subscription Architecture

### 💰 Stripe Integration

**Payment Flow Architecture:**

```python
# Stripe webhook handling
@app.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(400, "Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "Invalid signature")

    # Handle subscription events
    if event['type'] == 'customer.subscription.updated':
        await handle_subscription_update(event['data']['object'])
    elif event['type'] == 'payment_intent.succeeded':
        await handle_payment_success(event['data']['object'])
```

**Subscription State Management:**

```python
# Subscription states
SUBSCRIPTION_STATES = {
    'trialing': 'Free trial period',
    'active': 'Paid subscription active',
    'past_due': 'Payment failed, retrying',
    'canceled': 'Subscription canceled',
    'unpaid': 'Payment failed, access suspended'
}

async def update_user_subscription(user_id: str, subscription_data: dict):
    subscription = {
        'stripe_customer_id': subscription_data['customer'],
        'stripe_subscription_id': subscription_data['id'],
        'status': subscription_data['status'],
        'current_period_start': subscription_data['current_period_start'],
        'current_period_end': subscription_data['current_period_end'],
        'cancel_at_period_end': subscription_data['cancel_at_period_end']
    }

    await update_user_plan(user_id, subscription)
```

### 🔄 Proration Handling

**Plan Upgrades/Downgrades:**

```python
async def handle_plan_change(user_id: str, new_plan: str):
    current_subscription = await get_user_subscription(user_id)

    # Calculate proration
    proration_amount = calculate_proration(
        current_subscription, new_plan
    )

    # Update subscription with proration
    stripe.Subscription.modify(
        current_subscription['stripe_subscription_id'],
        items=[{
            'id': current_subscription['items']['data'][0]['id'],
            'price': get_price_id(new_plan),
        }],
        proration_behavior='create_prorations'
    )
```

### 📧 Invoice Generation

**Email Delivery System:**

```python
# Invoice email template
INVOICE_EMAIL_TEMPLATE = """
Subject: Your FitNudge Invoice

Hi {user_name},

Your subscription has been renewed for {plan_name}.

Invoice Details:
- Amount: ${amount}
- Period: {period_start} to {period_end}
- Payment Method: {payment_method}

Download your invoice: {invoice_url}

Thank you for using FitNudge!
"""

async def send_invoice_email(user_id: str, invoice_data: dict):
    user = await get_user(user_id)
    invoice_url = await generate_invoice_pdf(invoice_data)

    await send_email(
        to=user['email'],
        subject="Your FitNudge Invoice",
        template=INVOICE_EMAIL_TEMPLATE,
        context={
            'user_name': user['name'],
            'amount': invoice_data['amount'],
            'invoice_url': invoice_url
        }
    )
```

### 🔐 PCI Compliance

**Security Requirements:**

- **No Card Data Storage**: All payment data handled by Stripe
- **HTTPS Only**: All payment endpoints require SSL
- **Tokenization**: Use Stripe tokens for payment processing
- **Audit Logging**: Log all payment-related operations

**Payment Endpoints:**

```python
@app.post("/api/v1/subscriptions")
async def create_subscription(
    plan: str,
    payment_method: str,
    user_id: str = Depends(get_current_user)
):
    # Create Stripe customer
    customer = stripe.Customer.create(
        email=user['email'],
        payment_method=payment_method,
        invoice_settings={'default_payment_method': payment_method}
    )

    # Create subscription
    subscription = stripe.Subscription.create(
        customer=customer.id,
        items=[{'price': get_price_id(plan)}],
        expand=['latest_invoice.payment_intent']
    )

    return subscription
```

---

## 👨‍💼 Admin Portal Architecture

### 🔐 Admin Authentication

**Role-Based Access Control:**

```python
# Admin roles and permissions
ADMIN_ROLES = {
    'super_admin': {
        'permissions': ['all'],
        'description': 'Full system access'
    },
    'admin': {
        'permissions': ['users', 'analytics', 'content'],
        'description': 'User and content management'
    },
    'support': {
        'permissions': ['users', 'tickets'],
        'description': 'User support and tickets'
    }
}

async def check_admin_permission(user_id: str, required_permission: str):
    user_role = await get_user_role(user_id)
    user_permissions = ADMIN_ROLES[user_role]['permissions']

    if 'all' in user_permissions or required_permission in user_permissions:
        return True
    raise HTTPException(403, "Insufficient permissions")
```

**Admin-Specific Routes:**

```python
# Admin API endpoints
@app.get("/api/v1/admin/users")
async def get_all_users(
    page: int = 1,
    limit: int = 50,
    search: str = None,
    admin_user: dict = Depends(get_admin_user)
):
    await check_admin_permission(admin_user['id'], 'users')

    users = await get_users_paginated(page, limit, search)
    return {
        'users': users,
        'pagination': {
            'page': page,
            'limit': limit,
            'total': await get_users_count(search)
        }
    }

@app.post("/api/v1/admin/users/{user_id}/suspend")
async def suspend_user(
    user_id: str,
    reason: str,
    admin_user: dict = Depends(get_admin_user)
):
    await check_admin_permission(admin_user['id'], 'users')

    await suspend_user_account(user_id, reason, admin_user['id'])
    await log_admin_action('user_suspended', admin_user['id'], {
        'target_user': user_id,
        'reason': reason
    })
```

### 📊 Dashboard Metrics

**Key Performance Indicators:**

```python
# Admin dashboard metrics
async def get_dashboard_metrics():
    return {
        'users': {
            'total': await get_total_users(),
            'active_today': await get_active_users_today(),
            'new_this_week': await get_new_users_this_week(),
            'churn_rate': await calculate_churn_rate()
        },
        'revenue': {
            'mrr': await get_monthly_recurring_revenue(),
            'arr': await get_annual_recurring_revenue(),
            'growth_rate': await calculate_revenue_growth(),
            'ltv': await calculate_lifetime_value()
        },
        'engagement': {
            'dau': await get_daily_active_users(),
            'mau': await get_monthly_active_users(),
            'retention_7d': await get_7_day_retention(),
            'retention_30d': await get_30_day_retention()
        }
    }
```

### 🛡️ Content Moderation

**Post Moderation Tools:**

```python
@app.get("/api/v1/admin/posts/flagged")
async def get_flagged_posts(admin_user: dict = Depends(get_admin_user)):
    await check_admin_permission(admin_user['id'], 'content')

    flagged_posts = await get_flagged_posts_with_details()
    return {
        'posts': flagged_posts,
        'total_flags': len(flagged_posts)
    }

@app.post("/api/v1/admin/posts/{post_id}/moderate")
async def moderate_post(
    post_id: str,
    action: str,  # 'approve', 'remove', 'warn'
    reason: str,
    admin_user: dict = Depends(get_admin_user)
):
    await check_admin_permission(admin_user['id'], 'content')

    if action == 'remove':
        await remove_post(post_id, reason)
    elif action == 'warn':
        await warn_user(post_id, reason)

    await log_admin_action('post_moderated', admin_user['id'], {
        'post_id': post_id,
        'action': action,
        'reason': reason
    })
```

### 🔍 System Health Monitoring

**Health Dashboard:**

```python
@app.get("/api/v1/admin/system/health")
async def get_system_health(admin_user: dict = Depends(get_admin_user)):
    await check_admin_permission(admin_user['id'], 'system')

    return {
        'database': await check_database_health(),
        'redis': await check_redis_health(),
        'external_services': {
            'openai': await check_openai_health(),
            'cloudflare_r2': await check_cloudflare_r2_health(),
            'stripe': await check_stripe_health()
        },
        'performance': {
            'response_time_p95': await get_p95_response_time(),
            'error_rate': await get_error_rate(),
            'active_connections': await get_active_connections()
        }
    }
```

---

## 🔌 WebSocket/Realtime Architecture

### 📡 Supabase Realtime Integration

**Channel Subscriptions:**

```typescript
// Real-time social feed updates
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Subscribe to posts channel
const postsChannel = supabase
  .channel("posts")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "posts" },
    (payload) => {
      // Add new post to feed
      addPostToFeed(payload.new);
    }
  )
  .on(
    "postgres_changes",
    { event: "UPDATE", schema: "public", table: "posts" },
    (payload) => {
      // Update post in feed
      updatePostInFeed(payload.new);
    }
  )
  .subscribe();

// Subscribe to likes channel
const likesChannel = supabase
  .channel("likes")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "likes" },
    (payload) => {
      // Update like count
      updateLikeCount(payload.new.post_id, 1);
    }
  )
  .on(
    "postgres_changes",
    { event: "DELETE", schema: "public", table: "likes" },
    (payload) => {
      // Update like count
      updateLikeCount(payload.old.post_id, -1);
    }
  )
  .subscribe();
```

**Connection Management:**

```typescript
// Connection state management
class RealtimeManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  private connectionState: "connected" | "disconnected" | "reconnecting" =
    "disconnected";

  subscribeToChannel(channelName: string, config: ChannelConfig) {
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName);
    }

    const channel = supabase.channel(channelName);

    // Configure channel based on config
    config.subscriptions.forEach((sub) => {
      channel.on("postgres_changes", sub, sub.handler);
    });

    channel.subscribe((status) => {
      this.handleConnectionStatus(status);
    });

    this.channels.set(channelName, channel);
    return channel;
  }

  private handleConnectionStatus(status: string) {
    switch (status) {
      case "SUBSCRIBED":
        this.connectionState = "connected";
        break;
      case "CHANNEL_ERROR":
        this.connectionState = "disconnected";
        this.reconnect();
        break;
      case "TIMED_OUT":
        this.connectionState = "reconnecting";
        this.reconnect();
        break;
    }
  }

  private async reconnect() {
    // Implement exponential backoff reconnection
    const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
    setTimeout(() => {
      this.resubscribeAllChannels();
    }, delay);
  }
}
```

### 👥 Presence Tracking

**Online User Management:**

```typescript
// User presence tracking
const presenceChannel = supabase.channel("presence", {
  config: {
    presence: {
      key: user.id,
    },
  },
});

// Track user presence
presenceChannel
  .on("presence", { event: "sync" }, () => {
    const state = presenceChannel.presenceState();
    updateOnlineUsers(state);
  })
  .on("presence", { event: "join" }, ({ key, newPresences }) => {
    console.log("User joined:", key, newPresences);
    addOnlineUser(key, newPresences[0]);
  })
  .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
    console.log("User left:", key, leftPresences);
    removeOnlineUser(key);
  })
  .subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await presenceChannel.track({
        user_id: user.id,
        user_name: user.name,
        online_at: new Date().toISOString(),
        current_screen: "feed",
      });
    }
  });
```

### 🔄 Optimistic UI Updates

**Conflict Resolution:**

```typescript
// Optimistic updates with conflict resolution
class OptimisticUpdateManager {
  private pendingUpdates: Map<string, any> = new Map();

  async updatePost(postId: string, updates: any) {
    // Store original state for rollback
    const originalState = await getPostState(postId);

    // Apply optimistic update
    this.applyOptimisticUpdate(postId, updates);

    try {
      // Send update to server
      const result = await updatePostOnServer(postId, updates);

      // Server update successful, remove from pending
      this.pendingUpdates.delete(postId);
    } catch (error) {
      // Rollback optimistic update
      this.rollbackUpdate(postId, originalState);
      throw error;
    }
  }

  private applyOptimisticUpdate(postId: string, updates: any) {
    this.pendingUpdates.set(postId, updates);
    // Update UI immediately
    updatePostInUI(postId, updates);
  }

  private rollbackUpdate(postId: string, originalState: any) {
    this.pendingUpdates.delete(postId);
    // Restore original state in UI
    restorePostInUI(postId, originalState);
  }
}
```

### 📱 Fallback to Polling

**Connection Fallback Strategy:**

```typescript
// Fallback to polling when WebSocket unavailable
class ConnectionManager {
  private isWebSocketAvailable = true;
  private pollingInterval: NodeJS.Timeout | null = null;

  async initializeConnection() {
    try {
      // Try WebSocket connection
      await this.initializeWebSocket();
      this.isWebSocketAvailable = true;
      this.stopPolling();
    } catch (error) {
      console.warn("WebSocket unavailable, falling back to polling");
      this.isWebSocketAvailable = false;
      this.startPolling();
    }
  }

  private startPolling() {
    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollForUpdates();
      } catch (error) {
        console.error("Polling failed:", error);
      }
    }, 5000); // Poll every 5 seconds
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private async pollForUpdates() {
    const updates = await fetchRecentUpdates();
    updates.forEach((update) => {
      this.handleUpdate(update);
    });
  }
}
```

---

## 📧 Email Service Architecture

### 📨 Email Service Provider

**Namecheap Private Email Integration:**

```python
# Email service configuration
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

class EmailService:
    def __init__(self):
        self.smtp_host = SMTP_HOST
        self.smtp_port = SMTP_PORT
        self.username = SMTP_USERNAME
        self.password = SMTP_PASSWORD

    async def send_transactional_email(self, to_email: str, subject: str, html_content: str):
        msg = MIMEMultipart('alternative')
        msg['From'] = self.username
        msg['To'] = to_email
        msg['Subject'] = subject

        # Add HTML content
        html_part = MIMEText(html_content, 'html')
        msg.attach(html_part)

        # Send email via SMTP
        try:
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.username, self.password)
                server.send_message(msg)
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            raise

        return True
```

**Transactional Email Templates:**

```python
# Welcome email template
WELCOME_EMAIL_TEMPLATE = {
    "template_id": "d-welcome-123",
    "data": {
        "user_name": "{user_name}",
        "onboarding_tips": [
            "Set a specific time for your workouts",
            "Start with small, achievable goals",
            "Track your progress daily"
        ],
        "app_download_url": "https://fitnudge.app/download"
    }
}

# Password reset email
PASSWORD_RESET_TEMPLATE = {
    "template_id": "d-password-reset-456",
    "data": {
        "user_name": "{user_name}",
        "reset_url": "{reset_url}",
        "expires_in": "24 hours"
    }
}

# Payment receipt email
PAYMENT_RECEIPT_TEMPLATE = {
    "template_id": "d-payment-receipt-789",
    "data": {
        "user_name": "{user_name}",
        "amount": "{amount}",
        "plan_name": "{plan_name}",
        "invoice_url": "{invoice_url}",
        "next_billing_date": "{next_billing_date}"
    }
}
```

### 📬 Email Queue System

**Celery Email Queue:**

```python
# Email queue with Celery
from celery import Celery

app = Celery('fitnudge')

@app.task(bind=True, max_retries=3)
def send_email_task(self, to_email: str, template_id: str, data: dict):
    try:
        email_service = EmailService()
        success = await email_service.send_transactional_email(
            to_email, template_id, data
        )

        if not success:
            raise Exception("Email send failed")

    except Exception as exc:
        # Retry with exponential backoff
        raise self.retry(countdown=60 * (2 ** self.request.retries))

# Batch email sending
@app.task
def send_batch_emails(emails: list):
    for email_data in emails:
        send_email_task.delay(
            email_data['to'],
            email_data['template_id'],
            email_data['data']
        )
```

### 📊 Email Analytics

**Email Performance Tracking:**

```python
# Email analytics
class EmailAnalytics:
    async def track_email_sent(self, email_type: str, user_id: str):
        await self.db.execute("""
            INSERT INTO email_analytics (email_type, user_id, sent_at)
            VALUES ($1, $2, $3)
        """, email_type, user_id, datetime.utcnow())

    async def track_email_opened(self, email_id: str, user_id: str):
        await self.db.execute("""
            UPDATE email_analytics
            SET opened_at = $1, open_count = open_count + 1
            WHERE email_id = $2 AND user_id = $3
        """, datetime.utcnow(), email_id, user_id)

    async def track_email_clicked(self, email_id: str, user_id: str, link_url: str):
        await self.db.execute("""
            INSERT INTO email_clicks (email_id, user_id, link_url, clicked_at)
            VALUES ($1, $2, $3, $4)
        """, email_id, user_id, link_url, datetime.utcnow())

    async def get_email_metrics(self, email_type: str, days: int = 30):
        return await self.db.fetchrow("""
            SELECT
                COUNT(*) as total_sent,
                COUNT(opened_at) as total_opened,
                COUNT(DISTINCT user_id) as unique_recipients,
                AVG(open_count) as avg_opens_per_email
            FROM email_analytics
            WHERE email_type = $1
            AND sent_at >= NOW() - INTERVAL '%s days'
        """, email_type, days)
```

### 🚫 Bounce and Complaint Handling

**Email Reputation Management:**

```python
# Email delivery tracking (if needed)
@app.post("/webhooks/email-events")
async def email_webhook(request: Request):
    events = await request.json()

    for event in events:
        if event['event'] == 'bounce':
            await handle_bounce(event)
        elif event['event'] == 'spam_report':
            await handle_spam_report(event)
        elif event['event'] == 'unsubscribe':
            await handle_unsubscribe(event)

async def handle_bounce(event: dict):
    user_id = event.get('user_id')
    bounce_type = event.get('type')  # 'bounce' or 'blocked'

    if bounce_type == 'bounce':
        # Soft bounce - temporary issue
        await mark_email_as_bounced(user_id, temporary=True)
    else:
        # Hard bounce - permanent issue
        await mark_email_as_bounced(user_id, temporary=False)
        await unsubscribe_user(user_id, reason='hard_bounce')

async def handle_spam_report(event: dict):
    user_id = event.get('user_id')
    await mark_user_as_spam_reporter(user_id)
    await reduce_email_frequency(user_id)
```

### 🔐 Email Security

**DKIM, SPF, DMARC Configuration:**

```dns
; SPF record
v=spf1 include:_spf.sendgrid.net ~all

; DKIM record
default._domainkey.fitnudge.app. IN TXT "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC..."

; DMARC record
_dmarc.fitnudge.app. IN TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@fitnudge.app; ruf=mailto:dmarc@fitnudge.app; fo=1"
```

**Email Authentication:**

```python
# Email authentication middleware
async def verify_email_ownership(email: str) -> bool:
    # Send verification email
    verification_code = generate_verification_code()
    await store_verification_code(email, verification_code)

    await send_email_task.delay(
        to_email=email,
        template_id="d-email-verification",
        data={"verification_code": verification_code}
    )

    return True

@app.post("/api/v1/auth/verify-email")
async def verify_email(verification_code: str, email: str):
    stored_code = await get_verification_code(email)

    if stored_code == verification_code:
        await mark_email_as_verified(email)
        await delete_verification_code(email)
        return {"message": "Email verified successfully"}
    else:
        raise HTTPException(400, "Invalid verification code")
```

---

## 🔍 Search Architecture

### 🔎 Full-Text Search Implementation

**PostgreSQL Full-Text Search:**

```sql
-- Search configuration
CREATE TEXT SEARCH CONFIGURATION english_search (COPY = english);

-- Create search indexes
CREATE INDEX idx_posts_search ON posts USING gin(to_tsvector('english_search', title || ' ' || content));
CREATE INDEX idx_goals_search ON goals USING gin(to_tsvector('english_search', title || ' ' || description));
CREATE INDEX idx_users_search ON users USING gin(to_tsvector('english_search', name || ' ' || username));

-- Search function
CREATE OR REPLACE FUNCTION search_posts(search_query text)
RETURNS TABLE(
    id uuid,
    title text,
    content text,
    rank real
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.title,
        p.content,
        ts_rank(to_tsvector('english_search', p.title || ' ' || p.content), plainto_tsquery('english_search', search_query)) as rank
    FROM posts p
    WHERE to_tsvector('english_search', p.title || ' ' || p.content) @@ plainto_tsquery('english_search', search_query)
    ORDER BY rank DESC;
END;
$$ LANGUAGE plpgsql;
```

**Search API Endpoints:**

```python
@app.get("/api/v1/search/posts")
async def search_posts(
    q: str,
    page: int = 1,
    limit: int = 20,
    filters: dict = None
):
    # Build search query
    search_query = build_search_query(q, filters)

    # Execute search
    results = await execute_search('posts', search_query, page, limit)

    return {
        'results': results,
        'pagination': {
            'page': page,
            'limit': limit,
            'total': await get_search_count('posts', search_query)
        }
    }

def build_search_query(query: str, filters: dict = None) -> str:
    # Clean and prepare search query
    cleaned_query = clean_search_query(query)

    # Add filters
    if filters:
        if filters.get('date_range'):
            # Add date filtering
            pass
        if filters.get('user_id'):
            # Add user filtering
            pass

    return cleaned_query

def clean_search_query(query: str) -> str:
    # Remove special characters and normalize
    import re
    cleaned = re.sub(r'[^\w\s]', '', query)
    return cleaned.strip()
```

### 🎯 Search Ranking Algorithm

**Relevance Scoring:**

```python
# Search ranking implementation
class SearchRanker:
    def __init__(self):
        self.weights = {
            'title': 3.0,
            'content': 1.0,
            'user_popularity': 0.5,
            'recency': 0.3,
            'engagement': 0.2
        }

    def calculate_relevance_score(self, result: dict, query: str) -> float:
        score = 0.0

        # Text relevance (from PostgreSQL ts_rank)
        score += result['text_rank'] * 0.4

        # Title match bonus
        if query.lower() in result['title'].lower():
            score += self.weights['title']

        # User popularity factor
        score += result['user_followers'] * self.weights['user_popularity']

        # Recency factor
        days_old = (datetime.now() - result['created_at']).days
        recency_score = max(0, 1 - (days_old / 30))  # Decay over 30 days
        score += recency_score * self.weights['recency']

        # Engagement factor
        engagement_score = (result['likes'] + result['comments']) / 100
        score += engagement_score * self.weights['engagement']

        return score
```

### 🔍 Autocomplete Implementation

**Search Suggestions:**

```python
@app.get("/api/v1/search/suggestions")
async def get_search_suggestions(q: str, limit: int = 5):
    if len(q) < 2:
        return {"suggestions": []}

    # Get suggestions from multiple sources
    suggestions = []

    # Popular search terms
    popular_terms = await get_popular_search_terms(q, limit=2)
    suggestions.extend(popular_terms)

    # User suggestions
    user_suggestions = await get_user_suggestions(q, limit=2)
    suggestions.extend(user_suggestions)

    # Goal category suggestions
    category_suggestions = await get_category_suggestions(q, limit=1)
    suggestions.extend(category_suggestions)

    return {"suggestions": suggestions[:limit]}

async def get_popular_search_terms(query: str, limit: int) -> list:
    return await db.fetch("""
        SELECT term, search_count
        FROM search_analytics
        WHERE term ILIKE $1
        ORDER BY search_count DESC
        LIMIT $2
    """, f"{query}%", limit)
```

### 📊 Search Analytics

**Search Performance Tracking:**

```python
# Search analytics
class SearchAnalytics:
    async def track_search(self, query: str, user_id: str, results_count: int):
        await self.db.execute("""
            INSERT INTO search_analytics (query, user_id, results_count, searched_at)
            VALUES ($1, $2, $3, $4)
        """, query, user_id, results_count, datetime.utcnow())

    async def track_search_click(self, query: str, result_id: str, position: int):
        await self.db.execute("""
            INSERT INTO search_clicks (query, result_id, position, clicked_at)
            VALUES ($1, $2, $3, $4)
        """, query, result_id, position, datetime.utcnow())

    async def get_search_metrics(self, days: int = 30):
        return await self.db.fetchrow("""
            SELECT
                COUNT(*) as total_searches,
                COUNT(DISTINCT user_id) as unique_searchers,
                AVG(results_count) as avg_results_per_search,
                COUNT(CASE WHEN results_count = 0 THEN 1 END) as zero_result_searches
            FROM search_analytics
            WHERE searched_at >= NOW() - INTERVAL '%s days'
        """, days)
```

---

## 🧠 Core Backend Modules

| Module            | Description                                             | Key Tools           |
| ----------------- | ------------------------------------------------------- | ------------------- |
| **auth**          | Manages signup, login, JWT sessions via Supabase Auth.  | FastAPI + Supabase  |
| **goals**         | CRUD for fitness goals (1 free goal per user).          | SQLAlchemy ORM      |
| **checkins**      | Records daily user progress and reflections.            | Supabase            |
| **motivation**    | Handles AI message generation and voice synthesis.      | OpenAI + ElevenLabs |
| **notifications** | Push notifications scheduling and delivery.             | Firebase Admin SDK  |
| **social**        | Manages user posts, reactions, and realtime updates.    | Supabase Realtime   |
| **analytics**     | Computes streaks, engagement, and weekly summaries.     | Posthog             |
| **admin**         | Manages subscription tiers, user reports, and insights. | Stripe (future)     |

---

## 🧰 Backend Folder Structure

api/
├── main.py # FastAPI entry
├── config.py # Environment variables
├── routes/
│ ├── auth.py
│ ├── goals.py
│ ├── checkins.py
│ ├── motivation.py
│ ├── notifications.py
│ ├── social.py
│ └── analytics.py
├── models/
│ ├── user.py
│ ├── goal.py
│ ├── checkin.py
│ ├── motivation.py
│ ├── post.py
│ └── like.py
├── schemas/ # Pydantic DTOs
├── services/
│ ├── ai_service.py # GPT-5 prompt logic
│ ├── voice_service.py # ElevenLabs integration
│ ├── fcm_service.py # Push notification sender
│ ├── supabase_client.py # DB client
│ └── scheduler.py # Celery scheduler for reminders
├── utils/
│ ├── logger.py
│ └── datetime_helpers.py
└── tests/
├── test_goals.py
└── test_auth.py

---

## 🗄️ Database Schema (Supabase)

| Table           | Description                                  | Key Fields                                         |
| --------------- | -------------------------------------------- | -------------------------------------------------- |
| **users**       | Basic user profile, language, plan type.     | `id`, `email`, `plan`, `language`, `created_at`    |
| **goals**       | Fitness goals (e.g., “Gym 3x/week”).         | `id`, `user_id`, `title`, `frequency`, `is_active` |
| **checkins**    | Daily user responses to “Did you go today?”. | `id`, `goal_id`, `date`, `status`, `reflection`    |
| **motivations** | Generated AI messages.                       | `id`, `goal_id`, `text`, `tone`, `created_at`      |
| **posts**       | Social wall content.                         | `id`, `user_id`, `text`, `voice_url`, `created_at` |
| **likes**       | User reactions.                              | `id`, `post_id`, `user_id`                         |
| **reminders**   | Notification scheduling.                     | `id`, `user_id`, `goal_id`, `time`, `is_sent`      |

All foreign keys include **`ON DELETE CASCADE`** for automatic cleanup.

Example:

```sql
ALTER TABLE goals
ADD CONSTRAINT fk_user
FOREIGN KEY (user_id)
REFERENCES users(id)
ON DELETE CASCADE;
```

🔔 Notifications Flow

User sets a reminder via /api/motivation/schedule.

Entry is saved to reminders table.

Celery checks due reminders every minute.

Firebase Cloud Messaging sends a push with sound.

User taps → /api/motivation/generate fetches a new AI message.

Motivation message saved to motivations and displayed in feed.

🧠 AI Logic
Prompt Template (Text)

You are a motivational fitness coach helping the user stay consistent.
Base message on:

- User's goal: {goal}
- Last 3 check-ins: {history}
- Tone: {tone}

End with an emotionally uplifting line.

Examples:

- Friendly: “You’re doing amazing! Even one step forward counts.”
- Tough-love: “No excuses today—show up and prove it to yourself.”
- Calm: “Today’s small effort brings tomorrow’s reward.”

Voice Message (Pro)

If the user is on Pro or Elite, ElevenLabs generates voice message:

POST /ai/voice
{
"text": "No excuses today—let’s hit the gym!",
"voice": "coach_friendly"
}

🌍 Localization & n8n Automation

Package: /packages/n8n

Purpose

Automates translations for **mobile app and web landing page** UI text and AI motivational messages across multiple languages. Admin portal uses English exclusively.

Files & Workflows
File Purpose
locales/en.json Base language (English).
locales/es.json Spanish translations.
locales/fr.json French translations.
locales/de.json German translations.
common.json Shared motivational phrases (used in UI + AI).
translate_common_words.workflow.json Automatically translates new phrases via OpenAI/DeepL.
sync_supabase_locales.workflow.json Pushes updated translations to Supabase localization tables.
utils.py Sync helper to version and upload translations.
Integration

ai_service.py references common.json dynamically to adapt prompts to the user’s selected language.

Future: allow users to set preferred language during onboarding.

## 🔒 Security

### 🔐 Authentication & Authorization

**JWT Token Strategy:**

- **Access Tokens**: Short-lived (15 minutes), stored in httpOnly cookies
- **Refresh Tokens**: Long-lived (7 days), stored in httpOnly cookies
- **Token Rotation**: New refresh token issued on each refresh
- **Secure Cookies**: SameSite=Strict, Secure flag in production
- **Token Blacklisting**: Redis blacklist for revoked tokens

**Supabase Auth Integration:**

```python
# JWT verification middleware
async def verify_token(request: Request):
    token = request.cookies.get('access_token')
    if not token:
        raise HTTPException(401, "Missing access token")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        request.state.user_id = payload["user_id"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
```

**Row-Level Security (RLS):**

```sql
-- Users can only access their own data
CREATE POLICY user_goals_policy ON goals
    FOR ALL TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY user_checkins_policy ON checkins
    FOR ALL TO authenticated
    USING (auth.uid() = (SELECT user_id FROM goals WHERE id = goal_id));
```

### 🌐 CORS & API Security

**CORS Configuration:**

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://fitnudge.app", "https://app.fitnudge.app"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=3600
)
```

**API Versioning:**

- All endpoints under `/api/v1/` prefix
- Deprecation notices 6 months ahead
- Backward compatibility for 1 major version

### 🛡️ Input Validation & Sanitization

**Pydantic Schema Validation:**

```python
from pydantic import BaseModel, validator, Field
import html

class CreateGoalRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    frequency: int = Field(..., ge=1, le=7)

    @validator('title')
    def sanitize_title(cls, v):
        return html.escape(v.strip())
```

**SQL Injection Prevention:**

- Use SQLAlchemy ORM exclusively
- Parameterized queries for raw SQL
- Input sanitization for all user data
- No dynamic SQL construction

### 🔐 Encryption & Data Protection

**Encryption at Rest:**

- **Supabase**: Automatic encryption for PII data
- **Environment Variables**: Encrypted in CI/CD pipeline
- **Database**: TLS 1.3 for all connections
- **Backups**: Encrypted backup files

**Media Security:**

```python
# Cloudflare R2 signed URLs for private content
def generate_upload_signature(user_id: str, folder: str):
    timestamp = int(time.time())
    params = {
        'folder': f'private/{user_id}/{folder}',
        'timestamp': timestamp,
        'access_type': 'authenticated'
    }
    # Generate Cloudflare R2 presigned URL
    presigned_url = generate_presigned_url(
        bucket=CLOUDFLARE_BUCKET_NAME,
        key=f'private/{user_id}/{folder}/{timestamp}',
        expiration=3600
    )
    return {
        'upload_url': presigned_url,
        'bucket': CLOUDFLARE_BUCKET_NAME,
        'key': f'private/{user_id}/{folder}/{timestamp}'
    }
```

### 🔒 HTTPS & SSL

**TLS Configuration:**

- **TLS 1.3**: Minimum version required
- **Certificate Management**: Let's Encrypt auto-renewal
- **HSTS**: HTTP Strict Transport Security headers
- **Certificate Pinning**: For mobile app API calls

**Security Headers:**

```python
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response
```

### 🔐 Secrets Management

**Environment Variables:**

```bash
# Production secrets (never commit)
DATABASE_URL=postgresql://...
JWT_SECRET_KEY=...
OPENAI_API_KEY=...
CLOUDFLARE_SECRET_ACCESS_KEY=...
FCM_SERVER_KEY=...
```

**Secrets Rotation:**

- **API Keys**: Rotate every 90 days
- **JWT Secret**: Rotate every 6 months
- **Database Credentials**: Rotate every 3 months
- **Automated Alerts**: 30 days before expiration

### 💾 Backup & Recovery

**Backup Strategy:**

- **Daily Automated Backups**: Full database backup at 2 AM UTC
- **Point-in-Time Recovery**: 30-day retention period
- **Cross-Region Backup**: Secondary backup in different region
- **Media Backup**: Cloudflare R2 automatic backup to S3

**Recovery Procedures:**

```bash
# Database recovery
pg_restore --clean --if-exists -d fitnudge_prod backup_2024-01-15.dump

# Media recovery
# Cloudflare R2 backup restore (if needed)
# aws s3 sync s3://backup-bucket/2024-01-15/ s3://fitnudge-media/
```

**Disaster Recovery:**

- **RTO (Recovery Time Objective)**: < 4 hours
- **RPO (Recovery Point Objective)**: < 1 hour
- **Failover Testing**: Monthly disaster recovery drills
- **Documentation**: Step-by-step recovery procedures

### 🚨 Security Monitoring

**Security Alerts:**

- **Failed Login Attempts**: > 5 attempts in 10 minutes
- **Suspicious API Usage**: Unusual request patterns
- **Data Breach Indicators**: Unauthorized data access
- **Certificate Expiration**: 30 days before expiry

**Audit Logging:**

```python
# Security event logging
import logging

security_logger = logging.getLogger('security')

@security_logger.info
def log_security_event(event_type: str, user_id: str, details: dict):
    security_logger.info({
        'event': event_type,
        'user_id': user_id,
        'timestamp': datetime.utcnow().isoformat(),
        'details': details
    })
```

### 🔐 CSRF Protection

**CSRF Token Implementation:**

```python
from fastapi_csrf_protect import CsrfProtect

@CsrfProtect.load_config
def get_csrf_config():
    return CsrfSettings(secret_key=CSRF_SECRET_KEY)

@app.post("/api/v1/goals")
async def create_goal(request: Request, csrf_protect: CsrfProtect = Depends()):
    csrf_protect.validate_csrf(request)
    # Process request
```

### 🛡️ Rate Limiting & DDoS Protection

**Advanced Rate Limiting:**

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/v1/motivation/generate")
@limiter.limit("10 per hour")
async def generate_motivation():
    pass

# IP-based rate limiting
@limiter.limit("100 per minute", key_func=lambda request: request.client.host)
```

**DDoS Protection:**

- **Cloudflare**: DDoS protection and rate limiting
- **Request Size Limits**: 10MB max request size
- **Connection Limits**: Max 100 concurrent connections per IP
- **Geographic Blocking**: Block suspicious countries if needed

## 🛠️ Error Handling & Resilience

### 📋 Standardized Error Responses

**Error Response Format:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Goal title must be between 1 and 100 characters",
    "details": {
      "field": "title",
      "constraint": "min_length"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "req_123456789"
  }
}
```

**Error Codes:**

- `VALIDATION_ERROR`: Input validation failed
- `AUTHENTICATION_ERROR`: Invalid or missing credentials
- `AUTHORIZATION_ERROR`: Insufficient permissions
- `RATE_LIMIT_ERROR`: Too many requests
- `SERVICE_UNAVAILABLE`: External service down
- `INTERNAL_ERROR`: Server error

### 🔄 Retry Logic & Circuit Breakers

**Exponential Backoff Strategy:**

```python
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10)
)
async def call_openai_api(prompt: str):
    # OpenAI API call with automatic retry
    pass
```

**Circuit Breaker Implementation:**

```python
from circuit_breaker import CircuitBreaker

# OpenAI circuit breaker
openai_breaker = CircuitBreaker(
    failure_threshold=5,
    recovery_timeout=60,
    expected_exception=OpenAIError
)

@openai_breaker
async def generate_motivation(prompt: str):
    return await openai_client.chat.completions.create(...)

# Cloudflare R2 circuit breaker
cloudflare_r2_breaker = CircuitBreaker(
    failure_threshold=3,
    recovery_timeout=30,
    expected_exception=CloudflareR2Error
)
```

### 🚨 Graceful Degradation

**AI Service Down:**

```python
async def get_motivation_message(user_id: str, goal_id: str):
    try:
        # Try to generate new AI message
        return await generate_ai_message(user_id, goal_id)
    except ServiceUnavailableError:
        # Fallback to cached motivational messages
        cached_messages = await get_cached_motivations(goal_id)
        if cached_messages:
            return random.choice(cached_messages)
        # Ultimate fallback to generic messages
        return get_generic_motivation()
```

**Voice Synthesis Down:**

```python
async def create_voice_message(text: str, user_plan: str):
    if user_plan == 'free':
        return None  # Free users get text only

    try:
        return await elevenlabs.generate_voice(text)
    except ElevenLabsError:
        # Fallback to text-only for paid users
        logger.warning("Voice synthesis failed, falling back to text")
        return None
```

**FCM Service Down:**

```python
async def send_notification(user_id: str, message: str):
    try:
        await fcm_client.send_notification(user_id, message)
    except FCMError:
        # Queue notification for retry
        await queue_notification_for_retry(user_id, message)
        logger.warning("FCM failed, queued for retry")
```

**Cloudflare R2 Upload Down:**

```python
async def upload_media(file_data: bytes, user_id: str):
    try:
        return await cloudflare_r2.upload(file_data)
    except CloudflareR2Error:
        # Queue upload for retry
        await queue_media_upload(file_data, user_id)
        return {"status": "queued", "message": "Upload will be processed shortly"}
```

### ⏱️ Timeout Configurations

**Service Timeouts:**

```python
# API request timeouts
API_TIMEOUT = 30  # seconds
AI_GENERATION_TIMEOUT = 15  # seconds
DATABASE_QUERY_TIMEOUT = 10  # seconds
MEDIA_UPLOAD_TIMEOUT = 60  # seconds

# Async timeout wrapper
async def with_timeout(coro, timeout_seconds):
    try:
        return await asyncio.wait_for(coro, timeout=timeout_seconds)
    except asyncio.TimeoutError:
        raise ServiceTimeoutError(f"Operation timed out after {timeout_seconds}s")
```

### 🔄 Background Job Resilience

**Celery Task Retry:**

```python
from celery import Celery
from celery.exceptions import Retry

app = Celery('fitnudge')

@app.task(bind=True, max_retries=3)
def send_notification_task(self, user_id: str, message: str):
    try:
        send_fcm_notification(user_id, message)
    except FCMError as exc:
        # Exponential backoff retry
        raise self.retry(countdown=60 * (2 ** self.request.retries))
```

**Dead Letter Queue:**

```python
# Failed tasks after max retries go to DLQ
@app.task(bind=True, max_retries=3)
def process_media_upload(self, file_path: str):
    try:
        upload_to_cloudflare_r2(file_path)
    except Exception as exc:
        if self.request.retries >= 3:
            # Send to dead letter queue for manual review
            send_to_dlq(self.request.id, str(exc))
        raise self.retry(countdown=300)
```

### 📊 Health Checks

**API Health Endpoint:**

```python
@app.get("/health")
async def health_check():
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {}
    }

    # Check database
    try:
        await database.execute("SELECT 1")
        health_status["services"]["database"] = "healthy"
    except Exception:
        health_status["services"]["database"] = "unhealthy"
        health_status["status"] = "degraded"

    # Check Redis
    try:
        await redis.ping()
        health_status["services"]["redis"] = "healthy"
    except Exception:
        health_status["services"]["redis"] = "unhealthy"
        health_status["status"] = "degraded"

    # Check external services
    health_status["services"]["openai"] = await check_openai_health()
    health_status["services"]["cloudflare_r2"] = await check_cloudflare_r2_health()

    return health_status
```

### 🚨 Alerting & Monitoring

**Error Rate Monitoring:**

```python
# Error rate alerting
ERROR_RATE_THRESHOLD = 0.01  # 1%

async def check_error_rate():
    error_count = await get_error_count_last_hour()
    total_requests = await get_total_requests_last_hour()
    error_rate = error_count / total_requests

    if error_rate > ERROR_RATE_THRESHOLD:
        await send_alert(f"High error rate: {error_rate:.2%}")
```

**Service Dependency Monitoring:**

```python
# Monitor external service health
async def monitor_service_health():
    services = ["openai", "elevenlabs", "cloudflare_r2", "fcm"]

    for service in services:
        try:
            await check_service_health(service)
        except ServiceUnavailableError:
            await send_alert(f"Service {service} is down")
```

---

## 🚩 Feature Flags & AB Testing

### 🎛️ Feature Flag Provider

**LaunchDarkly Integration:**

```python
# Feature flag configuration
import launchdarkly
from launchdarkly.config import Config

# Initialize LaunchDarkly client
ld_client = launchdarkly.LDClient(
    sdk_key=LAUNCHDARKLY_SDK_KEY,
    config=Config()
)

# Feature flag checks
async def is_feature_enabled(feature_key: str, user_id: str, default: bool = False) -> bool:
    try:
        user_context = {
            "key": user_id,
            "custom": {
                "plan": await get_user_plan(user_id),
                "signup_date": await get_user_signup_date(user_id)
            }
        }
        return ld_client.variation(feature_key, user_context, default)
    except Exception as e:
        logger.error(f"Feature flag check failed: {e}")
        return default

# Usage in endpoints
@app.post("/api/v1/goals")
async def create_goal(
    goal_data: CreateGoalRequest,
    user_id: str = Depends(get_current_user)
):
    # Check if multiple goals feature is enabled
    if not await is_feature_enabled("multiple-goals", user_id):
        existing_goals = await get_user_goals_count(user_id)
        if existing_goals >= 1:
            raise HTTPException(400, "Free users limited to 1 goal")

    return await create_user_goal(user_id, goal_data)
```

**Feature Flag Patterns:**

```python
# Gradual rollout pattern
async def get_rollout_percentage(feature_key: str) -> float:
    # 10% of users get the feature initially
    return 0.1

# User targeting pattern
async def is_user_in_target_group(user_id: str, feature_key: str) -> bool:
    user_plan = await get_user_plan(user_id)

    # Only Pro users get early access
    if feature_key == "ai-voice-messages" and user_plan == "pro":
        return True

    # Beta users get experimental features
    if feature_key == "experimental-ui" and await is_beta_user(user_id):
        return True

    return False
```

### 🧪 AB Testing Framework

**Experiment Configuration:**

```python
# AB testing implementation
class ABTestManager:
    def __init__(self):
        self.experiments = {}

    async def get_experiment_variant(self, experiment_key: str, user_id: str) -> str:
        # Consistent hashing for stable assignment
        hash_value = hash(f"{user_id}:{experiment_key}")
        variant = "control" if (hash_value % 2) == 0 else "treatment"

        # Track assignment
        await self.track_experiment_assignment(experiment_key, user_id, variant)
        return variant

    async def track_experiment_conversion(self, experiment_key: str, user_id: str, event: str):
        variant = await self.get_experiment_variant(experiment_key, user_id)
        await self.db.execute("""
            INSERT INTO experiment_events (experiment_key, user_id, variant, event, timestamp)
            VALUES ($1, $2, $3, $4, $5)
        """, experiment_key, user_id, variant, event, datetime.utcnow())

# Usage in UI experiments
@app.get("/api/v1/onboarding/flow")
async def get_onboarding_flow(user_id: str = Depends(get_current_user)):
    variant = await ab_test_manager.get_experiment_variant("onboarding-flow", user_id)

    if variant == "control":
        return {"flow": "original", "steps": ["welcome", "goal", "notification"]}
    else:
        return {"flow": "simplified", "steps": ["goal", "done"]}
```

**Metrics Tracking:**

```python
# Experiment results analysis
class ExperimentAnalyzer:
    async def get_experiment_results(self, experiment_key: str, days: int = 30):
        return await self.db.fetchrow("""
            SELECT
                variant,
                COUNT(DISTINCT user_id) as users,
                COUNT(CASE WHEN event = 'conversion' THEN 1 END) as conversions,
                COUNT(CASE WHEN event = 'conversion' THEN 1 END)::float / COUNT(DISTINCT user_id) as conversion_rate
            FROM experiment_events
            WHERE experiment_key = $1
            AND timestamp >= NOW() - INTERVAL '%s days'
            GROUP BY variant
        """, experiment_key, days)

    async def is_experiment_significant(self, experiment_key: str) -> bool:
        results = await self.get_experiment_results(experiment_key)

        # Simple significance test (in production, use proper statistical tests)
        control_rate = results[0]['conversion_rate']
        treatment_rate = results[1]['conversion_rate']

        # 95% confidence threshold
        return abs(treatment_rate - control_rate) > 0.05
```

### 🔄 Feature Flag Lifecycle

**Development to Production:**

```python
# Feature flag lifecycle management
class FeatureFlagLifecycle:
    def __init__(self):
        self.stages = ['development', 'staging', 'production']

    async def promote_feature_flag(self, feature_key: str, from_stage: str, to_stage: str):
        # Update flag configuration
        await self.update_flag_configuration(feature_key, to_stage)

        # Log promotion
        await self.log_flag_promotion(feature_key, from_stage, to_stage)

    async def kill_switch(self, feature_key: str):
        # Immediately disable feature for all users
        await self.disable_feature_flag(feature_key)

        # Alert team
        await self.send_alert(f"Feature flag {feature_key} disabled via kill switch")
```

### 🎯 User Targeting

**Advanced Targeting Rules:**

```python
# User targeting implementation
class UserTargeting:
    async def should_show_feature(self, feature_key: str, user_id: str) -> bool:
        user_data = await get_user_data(user_id)

        # Percentage-based rollout
        if feature_key == "new-ui-design":
            return self.percentage_rollout(user_id, 25)  # 25% rollout

        # Plan-based targeting
        if feature_key == "advanced-analytics":
            return user_data['plan'] in ['pro', 'elite']

        # Geographic targeting
        if feature_key == "local-gym-integration":
            return user_data['country'] in ['US', 'CA', 'UK']

        # Behavioral targeting
        if feature_key == "social-features":
            return user_data['social_engagement_score'] > 0.7

        return False

    def percentage_rollout(self, user_id: str, percentage: int) -> bool:
        # Consistent hashing for stable assignment
        hash_value = hash(f"{user_id}:rollout")
        return (hash_value % 100) < percentage
```

---

## 🚀 Migration & Deployment Strategy

### 📦 Database Migration Workflow

**Alembic Migration Management:**

```python
# Migration configuration
from alembic import command
from alembic.config import Config

# Migration workflow
class DatabaseMigration:
    def __init__(self):
        self.alembic_cfg = Config("alembic.ini")

    async def create_migration(self, message: str):
        """Create new migration file"""
        command.revision(self.alembic_cfg, message=message, autogenerate=True)

    async def run_migrations(self, target: str = "head"):
        """Apply migrations to target revision"""
        command.upgrade(self.alembic_cfg, target)

    async def rollback_migration(self, target: str):
        """Rollback to specific revision"""
        command.downgrade(self.alembic_cfg, target)

# Migration compatibility check
async def check_migration_compatibility():
    """Ensure migrations are backward compatible"""
    # Check for breaking changes
    breaking_changes = [
        'DROP COLUMN',
        'ALTER COLUMN TYPE',
        'DROP TABLE'
    ]

    for change in breaking_changes:
        if change in migration_sql:
            raise Exception(f"Breaking change detected: {change}")
```

**Zero-Downtime Deployment:**

```python
# Blue-green deployment strategy
class BlueGreenDeployment:
    def __init__(self):
        self.blue_env = "production-blue"
        self.green_env = "production-green"
        self.current_active = "blue"

    async def deploy_to_inactive(self, version: str):
        """Deploy to inactive environment"""
        inactive_env = self.green_env if self.current_active == "blue" else self.blue_env

        # Deploy application
        await self.deploy_application(inactive_env, version)

        # Run health checks
        if await self.health_check(inactive_env):
            return True
        else:
            await self.rollback_deployment(inactive_env)
            return False

    async def switch_traffic(self):
        """Switch traffic to new environment"""
        # Update load balancer configuration
        await self.update_load_balancer()

        # Verify traffic is flowing
        await self.verify_traffic_switch()

        # Update active environment
        self.current_active = self.green_env if self.current_active == "blue" else self.blue_env
```

### 🔄 Rolling Updates

**Rolling Update Strategy:**

```python
# Rolling update implementation
class RollingUpdate:
    def __init__(self):
        self.instance_count = 3
        self.health_check_timeout = 30

    async def rolling_update(self, new_version: str):
        """Perform rolling update of instances"""
        for i in range(self.instance_count):
            # Update one instance at a time
            await self.update_instance(i, new_version)

            # Wait for health check
            await self.wait_for_health_check(i)

            # Verify instance is healthy
            if not await self.is_instance_healthy(i):
                await self.rollback_instance(i)
                raise Exception(f"Instance {i} failed health check")

    async def update_instance(self, instance_id: int, version: str):
        """Update single instance"""
        # Stop old instance
        await self.stop_instance(instance_id)

        # Deploy new version
        await self.deploy_version(instance_id, version)

        # Start new instance
        await self.start_instance(instance_id)
```

### 📊 Migration Testing

**Staging Environment Testing:**

```python
# Migration testing in staging
class MigrationTester:
    async def test_migration_in_staging(self, migration_file: str):
        """Test migration in staging environment"""

        # Backup staging database
        await self.backup_staging_database()

        try:
            # Apply migration
            await self.apply_migration(migration_file)

            # Run test suite
            test_results = await self.run_migration_tests()

            if not test_results['passed']:
                raise Exception("Migration tests failed")

            # Performance testing
            performance_results = await self.test_migration_performance()

            if performance_results['degradation'] > 0.1:  # 10% threshold
                raise Exception("Performance degradation detected")

        except Exception as e:
            # Rollback staging database
            await self.restore_staging_database()
            raise e

    async def run_migration_tests(self):
        """Run comprehensive migration tests"""
        tests = [
            self.test_data_integrity,
            self.test_foreign_key_constraints,
            self.test_index_performance,
            self.test_application_functionality
        ]

        results = []
        for test in tests:
            result = await test()
            results.append(result)

        return {
            'passed': all(results),
            'details': results
        }
```

### 🔙 Rollback Procedures

**Automated Rollback:**

```python
# Rollback implementation
class RollbackManager:
    async def rollback_deployment(self, reason: str):
        """Rollback to previous version"""

        # Log rollback reason
        await self.log_rollback_event(reason)

        # Get previous version
        previous_version = await self.get_previous_version()

        # Rollback application
        await self.rollback_application(previous_version)

        # Rollback database if needed
        if await self.database_changed():
            await self.rollback_database()

        # Verify rollback
        await self.verify_rollback_success()

    async def rollback_database(self):
        """Rollback database migrations"""
        # Get last successful migration
        last_successful = await self.get_last_successful_migration()

        # Rollback to that point
        command.downgrade(self.alembic_cfg, last_successful)

        # Verify data integrity
        await self.verify_data_integrity()
```

### 🛠️ Maintenance Mode

**Maintenance Mode Implementation:**

```python
# Maintenance mode
class MaintenanceMode:
    def __init__(self):
        self.maintenance_file = "/tmp/maintenance_mode"

    async def enable_maintenance_mode(self, message: str = "System maintenance in progress"):
        """Enable maintenance mode"""
        maintenance_data = {
            "enabled": True,
            "message": message,
            "started_at": datetime.utcnow().isoformat(),
            "estimated_duration": "30 minutes"
        }

        with open(self.maintenance_file, 'w') as f:
            json.dump(maintenance_data, f)

        # Update load balancer to show maintenance page
        await self.update_load_balancer_maintenance()

    async def disable_maintenance_mode(self):
        """Disable maintenance mode"""
        if os.path.exists(self.maintenance_file):
            os.remove(self.maintenance_file)

        # Restore normal load balancer configuration
        await self.restore_load_balancer_normal()

    @app.middleware("http")
    async def maintenance_middleware(self, request: Request, call_next):
        """Check for maintenance mode"""
        if os.path.exists(self.maintenance_file):
            with open(self.maintenance_file, 'r') as f:
                maintenance_data = json.load(f)

            if maintenance_data['enabled']:
                return JSONResponse(
                    status_code=503,
                    content={
                        "error": "Service Unavailable",
                        "message": maintenance_data['message'],
                        "estimated_duration": maintenance_data['estimated_duration']
                    }
                )

        return await call_next(request)
```

---

## 📱 Mobile App Distribution

### 🏗️ EAS Build Configuration

**Build Configuration:**

```json
// eas.json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "production": {
      "ios": {
        "distribution": "store"
      },
      "android": {
        "buildType": "apk"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id",
        "ascAppId": "your-app-store-connect-app-id",
        "appleTeamId": "your-team-id"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

**Automated Build Pipeline:**

```yaml
# .github/workflows/mobile-build.yml
name: Mobile App Build

on:
  push:
    branches: [main]
    tags: ["v*"]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install dependencies
        run: |
          cd apps/mobile
          npm install

      - name: Build iOS
        run: |
          cd apps/mobile
          eas build --platform ios --non-interactive
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}

      - name: Build Android
        run: |
          cd apps/mobile
          eas build --platform android --non-interactive
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

### 🚀 Fastlane Configuration

**iOS Fastlane Setup:**

```ruby
# fastlane/Fastfile
default_platform(:ios)

platform :ios do
  desc "Build and upload to App Store Connect"
  lane :release do
    # Increment build number
    increment_build_number

    # Build app
    build_app(
      scheme: "FitNudge",
      export_method: "app-store"
    )

    # Upload to App Store Connect
    upload_to_app_store(
      force: true,
      skip_metadata: true,
      skip_screenshots: true
    )
  end

  desc "Upload screenshots"
  lane :screenshots do
    capture_screenshots
    upload_to_app_store(
      skip_binary_upload: true,
      skip_metadata: false,
      skip_screenshots: false
    )
  end
end
```

**Android Fastlane Setup:**

```ruby
# fastlane/Fastfile
platform :android do
  desc "Build and upload to Google Play"
  lane :release do
    # Build APK
    gradle(
      task: "bundle",
      build_type: "Release"
    )

    # Upload to Google Play
    upload_to_play_store(
      track: "production",
      aab: "app/build/outputs/bundle/release/app-release.aab"
    )
  end
end
```

### 📱 App Store Optimization

**ASO Metadata Management:**

```python
# ASO metadata generator
class ASOMetadata:
    def __init__(self):
        self.keywords = [
            "fitness", "motivation", "gym", "workout", "health",
            "ai", "coach", "goals", "tracking", "accountability"
        ]

    def generate_app_description(self, language: str = "en") -> str:
        descriptions = {
            "en": """
            Transform your fitness journey with AI-powered motivation!
            FitNudge is your personal AI coach that helps you stay
            consistent with your gym and fitness goals.

            🏋️ Set personalized fitness goals
            🤖 Get AI-generated motivational messages
            📊 Track your progress and streaks
            👥 Connect with a supportive community
            🔔 Smart reminders that actually work

            Download now and start your transformation!
            """,
            "es": """
            ¡Transforma tu viaje fitness con motivación impulsada por IA!
            FitNudge es tu entrenador personal de IA que te ayuda a
            mantenerte constante con tus objetivos de gimnasio y fitness.
            """
        }
        return descriptions.get(language, descriptions["en"])

    def generate_keywords(self, max_length: int = 100) -> str:
        """Generate App Store keywords"""
        return ", ".join(self.keywords[:max_length])
```

### 📸 Screenshot Generation

**Automated Screenshot Generation:**

```javascript
// screenshot-generation.js
const { execSync } = require("child_process");
const fs = require("fs");

class ScreenshotGenerator {
  constructor() {
    this.devices = [
      { name: "iPhone 14 Pro", width: 1179, height: 2556 },
      { name: "iPhone 14 Pro Max", width: 1290, height: 2796 },
      { name: "iPad Pro 12.9", width: 2048, height: 2732 },
    ];
  }

  async generateScreenshots() {
    for (const device of this.devices) {
      console.log(`Generating screenshots for ${device.name}`);

      // Launch app in simulator
      execSync(`xcrun simctl boot "${device.name}"`);

      // Take screenshots of key screens
      const screens = [
        "onboarding",
        "goal-creation",
        "motivation-feed",
        "progress-tracking",
        "social-community",
      ];

      for (const screen of screens) {
        await this.captureScreen(device, screen);
      }
    }
  }

  async captureScreen(device, screenName) {
    const filename = `${device.name.replace(/\s+/g, "-").toLowerCase()}-${screenName}.png`;

    execSync(`xcrun simctl io booted screenshot ${filename}`);

    // Resize and optimize
    execSync(`sips -Z 1179 ${filename}`);
  }
}
```

### 🔄 Release Management

**Version Bumping Strategy:**

```python
# Semantic versioning
class VersionManager:
    def __init__(self):
        self.version_file = "apps/mobile/package.json"

    def bump_version(self, bump_type: str = "patch"):
        """Bump version following semantic versioning"""
        with open(self.version_file, 'r') as f:
            package_data = json.load(f)

        current_version = package_data['version']
        major, minor, patch = map(int, current_version.split('.'))

        if bump_type == "major":
            major += 1
            minor = 0
            patch = 0
        elif bump_type == "minor":
            minor += 1
            patch = 0
        else:  # patch
            patch += 1

        new_version = f"{major}.{minor}.{patch}"

        # Update package.json
        package_data['version'] = new_version
        with open(self.version_file, 'w') as f:
            json.dump(package_data, f, indent=2)

        return new_version

    def generate_release_notes(self, version: str) -> str:
        """Generate release notes from git commits"""
        commits = execSync(
            f"git log --oneline v{self.get_previous_version()}..HEAD",
            text=True
        ).strip().split('\n')

        features = []
        fixes = []

        for commit in commits:
            if commit.startswith('feat:'):
                features.append(commit[5:].strip())
            elif commit.startswith('fix:'):
                fixes.append(commit[4:].strip())

        release_notes = f"## Version {version}\n\n"

        if features:
            release_notes += "### New Features\n"
            for feature in features:
                release_notes += f"- {feature}\n"
            release_notes += "\n"

        if fixes:
            release_notes += "### Bug Fixes\n"
            for fix in fixes:
                release_notes += f"- {fix}\n"

        return release_notes
```

### 🧪 Beta Testing

**TestFlight Integration:**

```python
# Beta testing management
class BetaTestingManager:
    def __init__(self):
        self.testflight_api = TestFlightAPI()

    async def distribute_beta_build(self, build_id: str, testers: list):
        """Distribute build to beta testers"""

        # Add testers to TestFlight
        for tester in testers:
            await self.testflight_api.add_tester(
                email=tester['email'],
                first_name=tester['first_name'],
                last_name=tester['last_name']
            )

        # Distribute build
        await self.testflight_api.distribute_build(
            build_id=build_id,
            groups=["Beta Testers"]
        )

        # Send notification email
        await self.send_beta_notification(testers)

    async def collect_feedback(self, build_id: str):
        """Collect feedback from beta testers"""
        feedback = await self.testflight_api.get_feedback(build_id)

        # Process feedback
        for item in feedback:
            await self.process_feedback(item)

    async def send_beta_notification(self, testers: list):
        """Send beta testing notification"""
        for tester in testers:
            await send_email(
                to=tester['email'],
                subject="FitNudge Beta Build Available",
                template="beta-notification",
                data={
                    "tester_name": tester['first_name'],
                    "download_url": "https://testflight.apple.com/join/ABC123"
                }
            )
```

---

## 🌍 Enhanced Internationalization

### 🔄 RTL Language Support

**Right-to-Left Implementation:**

```typescript
// RTL support configuration
interface RTLConfig {
  isRTL: boolean;
  textAlign: 'left' | 'right';
  flexDirection: 'row' | 'row-reverse';
}

const getRTLConfig = (language: string): RTLConfig => {
  const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
  const isRTL = rtlLanguages.includes(language);

  return {
    isRTL,
    textAlign: isRTL ? 'right' : 'left',
    flexDirection: isRTL ? 'row-reverse' : 'row'
  };
};

// RTL-aware component
const RTLText = ({ children, language }: { children: React.ReactNode; language: string }) => {
  const rtlConfig = getRTLConfig(language);

  return (
    <Text style={{
      textAlign: rtlConfig.textAlign,
      writingDirection: rtlConfig.isRTL ? 'rtl' : 'ltr'
    }}>
      {children}
    </Text>
  );
};
```

**RTL Layout Adjustments:**

```css
/* RTL CSS support */
[dir="rtl"] .container {
  text-align: right;
}

[dir="rtl"] .flex-row {
  flex-direction: row-reverse;
}

[dir="rtl"] .margin-start {
  margin-left: 0;
  margin-right: 16px;
}

[dir="rtl"] .padding-end {
  padding-left: 0;
  padding-right: 16px;
}
```

### 📅 Date and Time Formatting

**Locale-Aware Formatting:**

```typescript
// Date/time formatting with Intl API
class LocaleFormatter {
  formatDate(date: Date, locale: string): string {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  }

  formatTime(date: Date, locale: string): string {
    return new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
      hour12: this.getHour12Preference(locale),
    }).format(date);
  }

  formatRelativeTime(date: Date, locale: string): string {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const diffInDays = Math.floor(
      (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return rtf.format(diffInDays, "day");
  }

  private getHour12Preference(locale: string): boolean {
    // US, UK use 12-hour format, most others use 24-hour
    const hour12Locales = ["en-US", "en-GB"];
    return hour12Locales.includes(locale);
  }
}
```

**Number and Currency Formatting:**

```typescript
// Number formatting
class NumberFormatter {
  formatNumber(value: number, locale: string): string {
    return new Intl.NumberFormat(locale).format(value);
  }

  formatCurrency(
    amount: number,
    locale: string,
    currency: string = "USD"
  ): string {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency,
    }).format(amount);
  }

  formatPercentage(value: number, locale: string): string {
    return new Intl.NumberFormat(locale, {
      style: "percent",
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value / 100);
  }
}
```

### 🕐 Timezone Handling

**User Timezone Management:**

```python
# Timezone handling in backend
import pytz
from datetime import datetime

class TimezoneManager:
    def __init__(self):
        self.default_timezone = pytz.UTC

    async def get_user_timezone(self, user_id: str) -> str:
        """Get user's preferred timezone"""
        user_data = await get_user_data(user_id)
        return user_data.get('timezone', 'UTC')

    async def convert_to_user_timezone(self, utc_datetime: datetime, user_id: str) -> datetime:
        """Convert UTC datetime to user's timezone"""
        user_timezone = await self.get_user_timezone(user_id)
        user_tz = pytz.timezone(user_timezone)

        # Convert UTC to user timezone
        return utc_datetime.replace(tzinfo=pytz.UTC).astimezone(user_tz)

    async def store_in_utc(self, local_datetime: datetime, user_id: str) -> datetime:
        """Convert user's local time to UTC for storage"""
        user_timezone = await self.get_user_timezone(user_id)
        user_tz = pytz.timezone(user_timezone)

        # Localize to user timezone, then convert to UTC
        localized = user_tz.localize(local_datetime)
        return localized.astimezone(pytz.UTC)
```

### 🔤 Pluralization Rules

**ICU MessageFormat Implementation:**

```typescript
// Pluralization with ICU MessageFormat
import { MessageFormat } from "messageformat";

class PluralizationManager {
  private mf: MessageFormat;

  constructor(locale: string) {
    this.mf = new MessageFormat(locale);
  }

  formatPlural(count: number, message: string): string {
    return this.mf.compile(message)({ count });
  }
}

// Usage examples
const pluralManager = new PluralizationManager("en");

// English pluralization
const message = `{count, plural, 
  =0 {No goals set}
  =1 {1 goal set}
  other {# goals set}
}`;

console.log(pluralManager.formatPlural(0, message)); // "No goals set"
console.log(pluralManager.formatPlural(1, message)); // "1 goal set"
console.log(pluralManager.formatPlural(5, message)); // "5 goals set"
```

**Language-Specific Pluralization:**

```json
// Pluralization rules for different languages
{
  "en": {
    "goals_count": "{count, plural, =0 {No goals} =1 {1 goal} other {# goals}}"
  },
  "ru": {
    "goals_count": "{count, plural, =0 {Нет целей} =1 {1 цель} few {# цели} many {# целей} other {# целей}}"
  },
  "ar": {
    "goals_count": "{count, plural, =0 {لا توجد أهداف} =1 {هدف واحد} =2 {هدفان} few {# أهداف} many {# هدف} other {# هدف}}"
  }
}
```

### 🔍 Language Detection

**Automatic Language Detection:**

```typescript
// Language detection and fallback
class LanguageDetector {
  private supportedLanguages = ["en", "es", "fr", "de", "ar", "he"];
  private fallbackLanguage = "en";

  detectLanguage(): string {
    // Try multiple detection methods
    const detectedLanguage =
      this.detectFromDevice() ||
      this.detectFromBrowser() ||
      this.detectFromUserPreference();

    return this.supportedLanguages.includes(detectedLanguage)
      ? detectedLanguage
      : this.fallbackLanguage;
  }

  private detectFromDevice(): string | null {
    // React Native device locale
    if (typeof navigator !== "undefined" && navigator.language) {
      return navigator.language.split("-")[0];
    }
    return null;
  }

  private detectFromBrowser(): string | null {
    // Browser language detection
    if (typeof window !== "undefined" && window.navigator) {
      return window.navigator.language.split("-")[0];
    }
    return null;
  }

  private detectFromUserPreference(): string | null {
    // Check stored user preference
    const stored = localStorage.getItem("user_language");
    return stored;
  }
}
```

### 🧪 Pseudo-Localization

**Testing Tool for i18n Readiness:**

```typescript
// Pseudo-localization for testing
class PseudoLocalizer {
  private pseudoMap = {
    a: "α",
    b: "β",
    c: "ς",
    d: "δ",
    e: "ε",
    f: "φ",
    g: "γ",
    h: "η",
    i: "ι",
    j: "ϑ",
    k: "κ",
    l: "λ",
    m: "μ",
    n: "ν",
    o: "ο",
    p: "π",
    q: "ϙ",
    r: "ρ",
    s: "σ",
    t: "τ",
    u: "υ",
    v: "ϝ",
    w: "ω",
    x: "χ",
    y: "ψ",
    z: "ζ",
  };

  pseudoLocalize(text: string): string {
    // Add brackets to show text boundaries
    const bracketed = `[${text}]`;

    // Apply pseudo character mapping
    let pseudo = bracketed;
    for (const [original, pseudo_char] of Object.entries(this.pseudoMap)) {
      pseudo = pseudo.replace(new RegExp(original, "gi"), pseudo_char);
    }

    // Add length testing characters
    return `${pseudo}ȦȧḂḃĊċḊḋĖėḞḟĠġḢḣİiĴĵḲḳĹĺḾḿŊŋŌōṔṕɊɋṤṥṪṫŬŭṼṽẆẇẊẋẎẏẐẑ`;
  }

  testTextExpansion(originalText: string, pseudoText: string): boolean {
    // Check if pseudo text is significantly longer (common in translations)
    const expansionRatio = pseudoText.length / originalText.length;
    return expansionRatio > 1.3; // 30% expansion threshold
  }
}
```

---

## 🧪 Testing Strategy

### 🔬 Unit Testing

**Backend Testing (Pytest):**

```python
# test_goals.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_create_goal():
    response = client.post("/api/v1/goals", json={
        "title": "Go to gym 3x/week",
        "frequency": 3
    })
    assert response.status_code == 201
    assert response.json()["title"] == "Go to gym 3x/week"

def test_goal_validation():
    response = client.post("/api/v1/goals", json={
        "title": "",  # Invalid empty title
        "frequency": 3
    })
    assert response.status_code == 400
    assert "title" in response.json()["error"]["details"]
```

**Mobile Testing (Jest):**

```javascript
// __tests__/storageUtil.test.js
import { storageUtil } from "../src/utils/storageUtil";

describe("StorageUtil", () => {
  test("should store and retrieve data", async () => {
    await storageUtil.setItem("test_key", "test_value");
    const value = await storageUtil.getItem("test_key");
    expect(value).toBe("test_value");
  });
});
```

**Coverage Requirements:**

- **Backend**: 80% minimum coverage
- **Mobile**: 70% minimum coverage
- **Critical Paths**: 95% coverage (auth, payments, AI generation)

### 🔗 Integration Testing

**API Integration Tests:**

```python
# test_api_integration.py
@pytest.mark.asyncio
async def test_motivation_generation_flow():
    # Create user
    user = await create_test_user()

    # Create goal
    goal = await create_test_goal(user.id)

    # Generate motivation
    response = await client.post(f"/api/v1/motivation/generate",
                                json={"goal_id": goal.id})

    assert response.status_code == 200
    assert "text" in response.json()
```

**Database Integration:**

```python
# test_database_integration.py
@pytest.mark.asyncio
async def test_user_goal_relationship():
    user = await create_test_user()
    goal = await create_test_goal(user.id)

    # Test cascade delete
    await delete_user(user.id)

    # Goal should be deleted
    goal_exists = await get_goal(goal.id)
    assert goal_exists is None
```

### 🎯 End-to-End Testing

**Mobile E2E (Detox):**

```javascript
// e2e/auth.e2e.js
describe("Authentication Flow", () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it("should allow user to sign up", async () => {
    await element(by.id("signup-button")).tap();
    await element(by.id("email-input")).typeText("test@example.com");
    await element(by.id("password-input")).typeText("password123");
    await element(by.id("submit-button")).tap();

    await expect(element(by.id("welcome-screen"))).toBeVisible();
  });
});
```

**Critical User Flows:**

- User signup and onboarding
- Goal creation and management
- Daily check-in process
- AI motivation generation
- Social post creation
- Push notification handling

### 📊 Load Testing

**Performance Benchmarks (k6):**

```javascript
// load-test.js
import http from "k6/http";
import { check } from "k6";

export let options = {
  stages: [
    { duration: "2m", target: 100 }, // Ramp up
    { duration: "5m", target: 100 }, // Stay at 100 users
    { duration: "2m", target: 200 }, // Ramp to 200 users
    { duration: "5m", target: 200 }, // Stay at 200 users
    { duration: "2m", target: 0 }, // Ramp down
  ],
};

export default function () {
  let response = http.get("https://api.fitnudge.app/api/v1/health");
  check(response, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });
}
```

**Performance Targets:**

- **API Response Time**: p95 < 2 seconds
- **Concurrent Users**: 1000+ users
- **Database Queries**: < 100ms average
- **AI Generation**: < 15 seconds

### 🚀 CI/CD Pipeline

**GitHub Actions Workflow:**

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: "3.11"

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-cov

      - name: Run backend tests
        run: pytest --cov=app --cov-report=xml

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install mobile dependencies
        run: |
          cd apps/mobile
          npm install

      - name: Run mobile tests
        run: |
          cd apps/mobile
          npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

**Deployment Strategy:**

- **Feature Branches**: Deploy to staging
- **Develop Branch**: Deploy to staging + run E2E tests
- **Main Branch**: Deploy to production after approval
- **Rollback**: Automatic rollback on health check failures

### 🏗️ Test Environments

**Environment Configuration:**

```bash
# Local Development
DATABASE_URL=postgresql://localhost:5432/fitnudge_dev
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=sk-test-...

# Staging
DATABASE_URL=postgresql://staging-db/fitnudge_staging
REDIS_URL=redis://staging-redis:6379
OPENAI_API_KEY=sk-staging-...

# Production
DATABASE_URL=postgresql://prod-db/fitnudge_prod
REDIS_URL=redis://prod-redis:6379
OPENAI_API_KEY=sk-prod-...
```

**Test Data Management:**

- **Fixtures**: Predefined test data for consistent testing
- **Database Seeding**: Automated test data creation
- **Cleanup**: Automatic cleanup after test runs
- **Isolation**: Each test runs in isolated environment

### 📱 Mobile-Specific Testing

**Detox Configuration:**

```javascript
// .detoxrc.js
module.exports = {
  testRunner: "jest",
  runnerConfig: "e2e/config.json",
  configurations: {
    "ios.sim.debug": {
      type: "ios.simulator",
      binaryPath: "ios/build/Build/Products/Debug-iphonesimulator/FitNudge.app",
      build:
        "xcodebuild -workspace ios/FitNudge.xcworkspace -scheme FitNudge -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build",
      device: {
        type: "iPhone 14",
      },
    },
  },
};
```

**Mobile Test Scenarios:**

- App launch and initialization
- Offline functionality
- Push notification handling
- Background sync
- Image upload and processing
- Voice recording and playback

---

## 🧮 Deployment

| Layer                | Service                  | Notes                           |
| -------------------- | ------------------------ | ------------------------------- |
| **Frontend (Web)**   | Vercel                   | Deploy static Next.js site.     |
| **Backend (API)**    | Railway.app or Render    | Host FastAPI + Celery workers.  |
| **Database**         | Supabase Cloud           | Free + scalable.                |
| **Notifications**    | Firebase Cloud Messaging | Push service.                   |
| **Analytics**        | Posthog Cloud            | Behavior tracking.              |
| **Automation (n8n)** | Self-hosted / Cloud      | For translations and workflows. |

---

## 📊 Observability & Monitoring

### 📝 Logging Strategy

**Structured Logging (JSON):**

```python
import logging
import json
from datetime import datetime

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "service": "fitnudge-api",
            "message": record.getMessage(),
            "user_id": getattr(record, 'user_id', None),
            "request_id": getattr(record, 'request_id', None),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        return json.dumps(log_entry)

# Configure logger
logger = logging.getLogger('fitnudge')
handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logger.addHandler(handler)
```

**Log Levels:**

- **DEBUG**: Development only (detailed execution info)
- **INFO**: Staging (general application flow)
- **WARN**: Production (potential issues)
- **ERROR**: Production (errors that don't crash app)
- **CRITICAL**: Production (system failures)

**Centralized Logging:**

- **Development**: Console output
- **Staging**: Logflare or CloudWatch
- **Production**: Logflare + CloudWatch + Sentry

### 🚨 Error Tracking

**Sentry Integration:**

```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

sentry_sdk.init(
    dsn="https://your-sentry-dsn@sentry.io/project-id",
    integrations=[
        FastApiIntegration(auto_enabling_instrumentations=True),
        SqlalchemyIntegration(),
    ],
    traces_sample_rate=0.1,
    environment="production"
)
```

**Error Categorization:**

- **Authentication Errors**: Invalid tokens, expired sessions
- **Validation Errors**: Input validation failures
- **External Service Errors**: OpenAI, Cloudflare R2, FCM failures
- **Database Errors**: Connection issues, query failures
- **Business Logic Errors**: Goal limits, permission violations

### 📈 Application Performance Monitoring (APM)

**Key Metrics:**

- **Response Time**: p50, p95, p99 percentiles
- **Throughput**: Requests per minute
- **Error Rate**: Percentage of failed requests
- **Database Performance**: Query execution times
- **External API Latency**: OpenAI, Cloudflare R2 response times

### 📊 Business Metrics

**User Engagement (Posthog):**

```javascript
// Track user actions
posthog.capture("goal_created", {
  goal_title: "Go to gym 3x/week",
  frequency: 3,
  user_plan: "free",
});

posthog.capture("checkin_completed", {
  goal_id: "goal_123",
  success: true,
  streak_count: 5,
});
```

**Key Metrics:**

- **Daily Active Users (DAU)**
- **Weekly Active Users (WAU)**
- **Goal Completion Rate**
- **Check-in Consistency**
- **AI Message Engagement**
- **Social Feature Usage**

### 🔍 Distributed Tracing

**OpenTelemetry Setup:**

```python
from opentelemetry import trace
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

# Configure tracing
trace.set_tracer_provider(TracerProvider())
tracer = trace.get_tracer(__name__)

jaeger_exporter = JaegerExporter(
    agent_host_name="jaeger-agent",
    agent_port=6831,
)

span_processor = BatchSpanProcessor(jaeger_exporter)
trace.get_tracer_provider().add_span_processor(span_processor)
```

**Trace Context:**

```python
@tracer.start_as_current_span("generate_motivation")
async def generate_motivation(user_id: str, goal_id: str):
    with tracer.start_as_current_span("fetch_user_data"):
        user = await get_user(user_id)

    with tracer.start_as_current_span("call_openai"):
        response = await openai_client.chat.completions.create(...)

    with tracer.start_as_current_span("save_motivation"):
        await save_motivation(goal_id, response.text)
```

### 🚨 Alerting & Notifications

**Alert Conditions:**

```python
# Error rate alerting
ERROR_RATE_THRESHOLD = 0.01  # 1%

async def check_error_rate():
    error_count = await get_error_count_last_hour()
    total_requests = await get_total_requests_last_hour()
    error_rate = error_count / total_requests

    if error_rate > ERROR_RATE_THRESHOLD:
        await send_slack_alert(f"High error rate: {error_rate:.2%}")

# Response time alerting
RESPONSE_TIME_THRESHOLD = 2000  # 2 seconds

async def check_response_time():
    p95_response_time = await get_p95_response_time_last_hour()

    if p95_response_time > RESPONSE_TIME_THRESHOLD:
        await send_slack_alert(f"High response time: {p95_response_time}ms")
```

**Alert Channels:**

- **Slack**: Critical alerts to #alerts channel
- **Email**: Daily summary reports
- **PagerDuty**: On-call escalation for critical issues
- **SMS**: Database down, payment failures

### 📱 Mobile App Monitoring

**React Native Crash Reporting:**

```javascript
import crashlytics from "@react-native-firebase/crashlytics";

// Track user actions
crashlytics().setUserId(user.id);
crashlytics().setAttributes({
  user_plan: user.plan,
  app_version: "1.0.0",
});

// Log custom events
crashlytics().log("User completed check-in");
```

**Mobile Performance Metrics:**

- **App Launch Time**: < 3 seconds target
- **Screen Transition Time**: < 300ms target
- **Memory Usage**: Monitor for memory leaks
- **Battery Usage**: Optimize background tasks
- **Network Performance**: API call success rates

### 🔄 Health Checks

**Comprehensive Health Monitoring:**

```python
@app.get("/health")
async def health_check():
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "services": {}
    }

    # Database health
    try:
        await database.execute("SELECT 1")
        health_status["services"]["database"] = "healthy"
    except Exception as e:
        health_status["services"]["database"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"

    # Redis health
    try:
        await redis.ping()
        health_status["services"]["redis"] = "healthy"
    except Exception as e:
        health_status["services"]["redis"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"

    # External services
    health_status["services"]["openai"] = await check_openai_health()
    health_status["services"]["cloudflare_r2"] = await check_cloudflare_r2_health()
    health_status["services"]["fcm"] = await check_fcm_health()

    return health_status
```

**Service Dependencies:**

- **Database**: Connection pool status, query performance
- **Redis**: Memory usage, key expiration
- **OpenAI**: API rate limits, response times
- **Cloudflare R2**: Upload success rate, CDN performance
- **FCM**: Delivery success rate, token validity

### 📊 Dashboard & Visualization

**Grafana Dashboards:**

- **System Overview**: CPU, memory, disk usage
- **API Performance**: Response times, error rates
- **Business Metrics**: User engagement, goal completion
- **External Services**: OpenAI costs, Cloudflare R2 usage
- **Mobile App**: Crash rates, performance metrics

**Key Performance Indicators (KPIs):**

- **Uptime**: 99.9% target
- **Response Time**: p95 < 2 seconds
- **Error Rate**: < 1%
- **User Satisfaction**: NPS score tracking
- **Cost Efficiency**: Cost per user, API usage optimization

---

## 💰 Cost Optimization

### 🤖 AI API Cost Controls

**Token Limits & Budgets:**

```python
# OpenAI cost controls
MAX_TOKENS_PER_REQUEST = 500
MONTHLY_AI_BUDGET = 1000  # USD
DAILY_AI_LIMIT = 50  # USD

async def generate_motivation_with_limits(prompt: str):
    # Check daily budget
    daily_spent = await get_daily_ai_cost()
    if daily_spent > DAILY_AI_LIMIT:
        return get_cached_motivation()

    # Limit token usage
    response = await openai_client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=MAX_TOKENS_PER_REQUEST,
        temperature=0.7
    )

    # Track cost
    await track_ai_cost(response.usage.total_tokens)
    return response.choices[0].message.content
```

**Caching Strategy:**

- **Identical Prompts**: Cache for 24 hours (Redis)
- **Similar Prompts**: Use semantic similarity for cache hits
- **Fallback Messages**: Generic motivational messages when budget exceeded

### 📸 Media Storage Optimization

**Cloudflare R2 Transformations:**

```javascript
// Automatic image optimization
const optimizedImageUrl = cloudflareR2.url("sample.jpg", {
  quality: "auto",
  format: "auto", // WebP, AVIF when supported
  width: 400,
  height: 300,
  crop: "fill",
  gravity: "face",
});
```

**Storage Limits:**

- **Free Tier**: 25GB storage, 25GB bandwidth/month
- **Pro Tier**: 100GB storage, 100GB bandwidth/month
- **User Limits**: 100MB per user for free tier, 1GB for paid

**Optimization Strategies:**

- **Image Compression**: Automatic quality optimization
- **Format Selection**: WebP/AVIF for modern browsers
- **Lazy Loading**: Progressive image loading
- **CDN Caching**: Global edge caching

### 🗄️ Database Query Optimization

**Indexing Strategy:**

```sql
-- Optimize frequent queries
CREATE INDEX CONCURRENTLY idx_checkins_user_date
ON checkins(user_id, date DESC);

CREATE INDEX CONCURRENTLY idx_posts_created_at
ON posts(created_at DESC)
WHERE is_public = true;

-- Partial indexes for better performance
CREATE INDEX idx_active_goals
ON goals(user_id)
WHERE is_active = true;
```

**Query Optimization:**

- **Avoid N+1 Queries**: Use eager loading
- **Database Views**: Pre-computed complex queries
- **Connection Pooling**: Reuse database connections
- **Query Timeout**: 10-second timeout for all queries

### 📊 Resource Monitoring

**Cost Alerts:**

```python
# Monthly cost monitoring
async def check_monthly_costs():
    costs = {
        'openai': await get_openai_monthly_cost(),
        'cloudflare_r2': await get_cloudflare_r2_monthly_cost(),
        'supabase': await get_supabase_monthly_cost(),
        'vercel': await get_vercel_monthly_cost()
    }

    total_cost = sum(costs.values())
    if total_cost > MONTHLY_BUDGET:
        await send_cost_alert(f"Monthly budget exceeded: ${total_cost}")
```

**Resource Limits:**

- **API Calls**: 1000 requests/hour per user
- **Database Connections**: Max 20 concurrent
- **Redis Memory**: 512MB limit
- **File Uploads**: 10MB max per file

---

## 🛡️ Data & Compliance

### 🔒 GDPR Compliance

**Data Processing Consent:**

```python
# Consent management
class ConsentManager:
    async def record_consent(self, user_id: str, consent_type: str):
        await self.db.execute("""
            INSERT INTO user_consents (user_id, consent_type, granted_at)
            VALUES ($1, $2, $3)
        """, user_id, consent_type, datetime.utcnow())

    async def has_consent(self, user_id: str, consent_type: str) -> bool:
        result = await self.db.fetchval("""
            SELECT COUNT(*) FROM user_consents
            WHERE user_id = $1 AND consent_type = $2
        """, user_id, consent_type)
        return result > 0
```

**Data Export (Right to Access):**

```python
@app.get("/api/v1/users/me/data")
async def export_user_data(user_id: str = Depends(get_current_user)):
    user_data = {
        "profile": await get_user_profile(user_id),
        "goals": await get_user_goals(user_id),
        "checkins": await get_user_checkins(user_id),
        "posts": await get_user_posts(user_id),
        "motivations": await get_user_motivations(user_id)
    }

    # Generate downloadable JSON file
    return JSONResponse(content=user_data)
```

**Data Deletion (Right to be Forgotten):**

```python
@app.delete("/api/v1/users/me/delete")
async def delete_user_data(user_id: str = Depends(get_current_user)):
    # Delete from database
    await delete_user_account(user_id)

    # Delete from Cloudflare R2
    await delete_user_media(user_id)

    # Log deletion for audit
    await log_data_deletion(user_id)

    return {"message": "Account and data deleted successfully"}
```

### 📅 Data Retention Policy

**Retention Periods:**

- **Active Users**: Indefinite (until account deletion)
- **Deleted Accounts**: 30-day soft delete, then permanent
- **Logs**: 90 days (security logs), 30 days (application logs)
- **Analytics**: 2 years (anonymized)
- **Media**: Deleted with account or after 90 days of inactivity

**Automated Cleanup:**

```python
# Daily cleanup job
@app.task
async def cleanup_expired_data():
    # Delete old logs
    await delete_logs_older_than(days=90)

    # Delete inactive user media
    await delete_inactive_user_media(days=90)

    # Permanently delete soft-deleted accounts
    await permanent_delete_soft_deleted_accounts(days=30)
```

### 🔐 Privacy Protection

**Data Anonymization:**

```python
# Anonymize user data for analytics
def anonymize_user_data(user_data: dict) -> dict:
    return {
        "user_id_hash": hashlib.sha256(user_data["user_id"].encode()).hexdigest()[:8],
        "age_range": get_age_range(user_data["birth_date"]),
        "goal_category": user_data["goal_category"],
        "success_rate": user_data["success_rate"]
    }
```

**Privacy Controls:**

- **Data Minimization**: Only collect necessary data
- **Purpose Limitation**: Use data only for stated purposes
- **Storage Limitation**: Delete data when no longer needed
- **Transparency**: Clear privacy policy and data usage

### 📋 Audit Logging

**Sensitive Operations Tracking:**

```python
# Audit log for sensitive operations
async def log_sensitive_operation(operation: str, user_id: str, details: dict):
    await audit_logger.info({
        "operation": operation,
        "user_id": user_id,
        "timestamp": datetime.utcnow().isoformat(),
        "ip_address": request.client.host,
        "user_agent": request.headers.get("user-agent"),
        "details": details
    })

# Track sensitive operations
@audit_log("account_deletion")
async def delete_user_account(user_id: str):
    # Delete account logic
    pass

@audit_log("data_export")
async def export_user_data(user_id: str):
    # Export data logic
    pass
```

**Audit Requirements:**

- **Account Deletions**: Who, when, why
- **Data Exports**: User requests and system exports
- **Admin Actions**: User management, system changes
- **Security Events**: Failed logins, suspicious activity

---

## 🪩 Design Guidelines (Summary)

### 🎨 Design Principles

- **Minimal Apple-style design** with clean, distraction-free interface
- **Responsive and mobile-first** approach with consistent breakpoints
- **Theme-aware components** using semantic design tokens
- **Rounded cards, soft shadows, and calm animations** for visual hierarchy
- **Default dark mode** with light mode toggle and system preference detection
- **Typography**: Space Grotesk font family with balanced hierarchy
- **Consistent vertical rhythm** using spacing tokens (gap-4, py-6)

### 🎯 Token Usage Patterns

**✅ DO:**

- Always use semantic color tokens (`styles.colors.background`, `styles.colors.primary`)
- Reference spacing tokens for consistent layouts (`styles.spacing.lg`, `styles.spacing.xl`)
- Use typography tokens for text styling (`styles.typography.size.lg`, `styles.typography.weight.semibold`)
- Apply shadow tokens for elevation (`styles.shadows.md`, `styles.shadows.lg`)
- Use radius tokens for rounded elements (`styles.radius.md`, `styles.radius.lg`)

**❌ DON'T:**

- Hardcode color values (avoid `#2563eb`, `#ffffff`, etc.)
- Use arbitrary spacing values (avoid `padding: 16px`, `margin: 24px`)
- Hardcode font sizes or weights (avoid `fontSize: 18px`, `fontWeight: 600`)
- Create custom shadows or border radius values
- Mix token usage with hardcoded values

### 🧩 Theme-Aware Development

**Component Development:**

```typescript
// ✅ Correct: Using styles folder pattern
// packages/ui/styles/card.styles.ts
export const makeCardStyles = (theme) => ({
  container: {
    backgroundColor: theme.colors.card,
    color: theme.colors.cardForeground,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    boxShadow: theme.shadows.md,
    border: `1px solid ${theme.colors.border}`
  }
});

// Component file
import { makeCardStyles } from '@fitnudge/ui/styles';
import { theme } from '@/themes';

const Card = ({ children }) => {
  const styles = makeCardStyles(theme);
  return <div style={styles.container}>{children}</div>;
};

// ❌ Incorrect: Hardcoded values in component
const Card = ({ children }) => {
  return (
    <div style={{
      backgroundColor: '#f8fafc',
      padding: '24px',
      borderRadius: '8px',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
    }}>
      {children}
    </div>
  );
};
```

**Tailwind Integration:**

```html
<!-- ✅ Correct: Using semantic Tailwind classes -->
<div
  class="bg-background text-foreground p-lg rounded-md shadow-md border border-border"
>
  Content
</div>

<!-- ❌ Incorrect: Hardcoded Tailwind values -->
<div
  class="bg-white text-gray-900 p-6 rounded-lg shadow-lg border border-gray-200"
>
  Content
</div>
```

### 🌓 Theme Switching Behavior

**Auto-detect + Manual Override:**

1. **System Preference Detection**: Check `prefers-color-scheme` on first visit
2. **Manual Override**: Provide theme toggle with user preference persistence
3. **Storage**: Save preference in localStorage for future visits
4. **CSS Classes**: Apply `.light` or `.dark` class to root element
5. **Automatic Switching**: CSS variables update based on class

**Implementation Requirements:**

- All components must work seamlessly in both light and dark modes
- No hardcoded colors that break theme switching
- Smooth transitions between theme changes
- Accessibility compliance for both themes
- Consistent visual hierarchy across themes

### 🎨 Accent Color Strategy

**Primary Color Token:**

- Light mode: `#2563EB` (motivation blue)
- Dark mode: `#3B82F6` (slightly lighter for better contrast)
- Usage: Primary actions, motivation elements, focus states
- Semantic naming: `styles.colors.primary` / `styles.colors.primaryForeground`

**Color Hierarchy:**

1. **Primary**: Motivation blue for key actions and motivation elements
2. **Secondary**: Subtle actions and secondary information
3. **Accent**: Highlighting and emphasis
4. **Muted**: Subtle text and backgrounds
5. **Success**: Positive states (check-ins, achievements, streaks)
6. **Warning**: Gentle reminders and alerts
7. **Destructive**: Error states and critical warnings
