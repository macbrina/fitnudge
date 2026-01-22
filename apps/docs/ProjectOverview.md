# 🎯 FitNudge — Project Overview

---

## 🎯 Overview

**FitNudge** is an AI-powered motivation and accountability app that helps users stay consistent with **any goal or habit** through personalized AI check-ins, smart reminders, accountability partners, and progress tracking.

Whether it's working out, reading, meditating, learning a new skill, or building any positive habit — FitNudge provides the daily nudge and support users need to stay on track.

The app focuses on a **minimal, mobile-first** experience with an AI coach that "checks in" daily.

---

## 📦 Core Features

### ✅ Implemented Features

| Feature                         | Description                                                                                   | Access                                    |
| ------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Goal Setting with Templates** | Create goals using 8 pre-built templates (workout, read, meditate, etc.) or custom goals      | Free (1 goal) / Premium (unlimited)       |
| **AI Check-In System**          | Daily "How did it go?" prompts with Yes/No/Rest Day responses                                 | Free                                      |
| **AI Motivation Messages**      | Personalized AI-generated responses based on check-in results and mood                        | Free (templates) / Premium (AI-generated) |
| **Push Notification Actions**   | Reply directly from notification with Yes ✓ / No ✗ / Rest Day 💤 buttons                      | Free                                      |
| **Voice Notes**                 | Record voice reflections during check-ins                                                     | Premium                                   |
| **Streak Tracking**             | Visual streak counters with milestone celebrations (7, 14, 21, 30, 50, 100 days)              | Free                                      |
| **AI Coach Chat**               | Real-time chat with AI accountability partner                                                 | Premium                                   |
| **Accountability Partners**     | Find and connect with accountability partners, send cheers/nudges                             | Premium                                   |
| **Weekly AI Recaps**            | AI-generated weekly summaries with insights                                                   | Premium                                   |
| **Analytics Dashboard**         | Charts and detailed stats (weekly consistency, streak history, goal comparison, skip reasons) | Premium                                   |
| **Pattern Detection**           | AI detects patterns in behavior and suggests improvements                                     | Premium                                   |
| **Adaptive Nudging**            | Smart notifications based on user behavior (at-risk streaks, crushing it celebrations)        | Premium                                   |
| **Blog Section**                | In-app blog with fitness and motivation content                                               | Free                                      |
| **Block/Report Partners**       | Safety features for partner interactions                                                      | Free                                      |
| **Data Export (GDPR)**          | Export all user data for compliance                                                           | Free                                      |
| **Dark/Light Mode**             | Theme support with auto-detect                                                                | Free                                      |
| **In-App Review**               | Native app store review prompts                                                               | Free                                      |

---

## 🧩 System Architecture

### 📁 Monorepo Structure

```
apps/
├── web/           # Marketing landing page (Next.js)
├── api/           # FastAPI backend (Python)
├── mobile/        # React Native app (Expo)
├── admin-portal/  # Admin dashboard (Next.js)
└── docs/          # Developer documentation

packages/
├── ui/            # Shared shadcn/ui components
├── lib/           # Utilities and hooks
├── assets/        # Shared fonts
├── tsconfig/      # TypeScript configs
└── eslint-config/ # ESLint configurations
```

---

## 📱 Mobile App Architecture

### 🔄 State Management

- **Zustand**: Global app state (user, settings, preferences)
- **React Query**: Server state management (API data, caching, optimistic updates)
- **AsyncStorage**: Persistence for user preferences

### 📸 Media Handling

- **Cloudflare R2**: Voice note storage
- **Upload Flow**: Signed URLs for secure direct uploads
- **Audio Recording**: expo-av for voice notes

### 🔔 Push Notifications

- **Expo Notifications**: Cross-platform notification handling
- **Notification Categories**: Action buttons (Yes/No/Rest Day, Cheer Back)
- **Deep Linking**: Navigate to specific screens from notifications
- **Quiet Hours**: Respect user preferences

### ⚡ Performance

- **Hermes Engine**: Faster startup and reduced memory usage
- **React Query Caching**: Offline-first with background sync
- **Lazy Loading**: Screen-based lazy loading

---

## 🧠 Database Layer

**Database:** Supabase (PostgreSQL)

**Key Tables:**

- `users` — Profile, preferences, subscription tier
- `goals` — Fitness targets with streak tracking
- `check_ins` — Daily progress records with mood and notes
- `daily_motivations` — AI-generated motivation messages
- `notification_history` — Push notification log
- `notification_preferences` — User notification settings
- `accountability_partners` — Partner relationships
- `nudges` — Cheers and nudges between partners
- `achievements` — Unlocked badges and milestones
- `weekly_recaps` — AI-generated weekly summaries
- `pattern_insights` — Detected behavior patterns
- `blog_posts` — Blog content
- `subscriptions` — RevenueCat subscription data

---

## 🔔 Notifications

**Tool:** Expo Push Notifications

**Notification Types:**

- **Morning Motivation**: Goal-specific morning messages
- **Check-in Prompt**: "How did your [goal] go?" at reminder times
- **Check-in Follow-up**: 2-hour follow-up if no response (same day only)
- **Streak Milestone**: Celebration when hitting 7, 14, 21, 30, 50, 100 days
- **Partner Activity**: When partner checks in, cheers, or nudges
- **Weekly Recap**: AI-generated weekly summary
- **Adaptive Nudges**: Crushing it celebrations, at-risk alerts, pattern suggestions

---

## 🔌 API Endpoints

### Authentication

| Endpoint                    | Method | Description                  |
| --------------------------- | ------ | ---------------------------- |
| `/api/v1/auth/signup`       | POST   | Register with email/password |
| `/api/v1/auth/login`        | POST   | Login with credentials       |
| `/api/v1/auth/oauth/apple`  | POST   | Apple Sign In                |
| `/api/v1/auth/oauth/google` | POST   | Google Sign In               |

### Goals

| Endpoint             | Method         | Description          |
| -------------------- | -------------- | -------------------- |
| `/api/v1/goals`      | GET/POST       | List or create goals |
| `/api/v1/goals/{id}` | GET/PUT/DELETE | Goal operations      |

### Check-ins

| Endpoint                       | Method   | Description              |
| ------------------------------ | -------- | ------------------------ |
| `/api/v1/check-ins`            | GET/POST | List or create check-ins |
| `/api/v1/check-ins/{id}/voice` | POST     | Upload voice note        |

### AI Coach

| Endpoint                    | Method | Description              |
| --------------------------- | ------ | ------------------------ |
| `/api/v1/ai-coach/chat`     | POST   | Send message to AI coach |
| `/api/v1/ai-coach/sessions` | GET    | Get chat history         |

### Partners

| Endpoint                      | Method | Description          |
| ----------------------------- | ------ | -------------------- |
| `/api/v1/partners`            | GET    | List active partners |
| `/api/v1/partners/request`    | POST   | Send partner request |
| `/api/v1/partners/{id}/block` | POST   | Block a partner      |

### Analytics

| Endpoint                      | Method | Description                |
| ----------------------------- | ------ | -------------------------- |
| `/api/v1/analytics/dashboard` | GET    | Dashboard charts (Premium) |

### Blog

| Endpoint                  | Method | Description          |
| ------------------------- | ------ | -------------------- |
| `/api/v1/blog/posts`      | GET    | List published posts |
| `/api/v1/blog/categories` | GET    | List categories      |

---

## 💳 Subscription Model

### Pricing Tiers (2-Tier System)

| Plan        | Price                      | Features                                                     |
| ----------- | -------------------------- | ------------------------------------------------------------ |
| **Free**    | $0                         | 1 goal, template motivation, basic tracking                  |
| **Premium** | $9.99/month or $79.99/year | Unlimited goals, AI coach, partners, analytics, all features |

### RevenueCat Integration

- **iOS**: Apple In-App Purchase (StoreKit)
- **Android**: Google Play Billing
- **Webhook Handling**: Automatic subscription sync
- **Feature Gating**: Server-side feature access control

---

## 🧭 Tech Stack

| Layer             | Technology              |
| ----------------- | ----------------------- |
| **Mobile**        | React Native + Expo     |
| **Web**           | Next.js + Tailwind CSS  |
| **Backend**       | FastAPI (Python)        |
| **Database**      | Supabase (PostgreSQL)   |
| **Auth**          | Supabase Auth + OAuth   |
| **AI**            | OpenAI GPT-4            |
| **Notifications** | Expo Push Notifications |
| **Subscriptions** | RevenueCat              |
| **Media Storage** | Cloudflare R2           |
| **Task Queue**    | Celery + Redis          |
| **Caching**       | Redis                   |

---

## 🎨 Design System

- **Font**: Space Grotesk family
- **Theme**: Light/dark mode with system detection
- **Primary Color**: #2563EB (Motivation Blue)
- **Components**: Custom design system following `DESIGN_SYSTEM.md`
- **Mobile**: `useStyles` hook with design tokens

---

## 🔐 Security & Compliance

- **Row Level Security**: Database-level access control
- **JWT Authentication**: Secure token-based auth
- **GDPR Compliance**: Data export and deletion
- **Encryption**: Data encrypted at rest and in transit
- **Quiet Hours**: Respect user notification preferences

---

## 🌍 Localization

**Scope**: Mobile app only (admin portal uses English)

**Languages**:

- English (en) - Primary
- Spanish (es) - Future
- French (fr) - Future
- German (de) - Future
