# 🏋️ Fitness Motivation AI App — ProjectOverview.md

---

## 🎯 Overview

**Goal:** Build an AI-powered motivation and accountability app that helps users stay consistent with their **fitness and gym habits** through scheduled motivational notifications, smart reminders, and progress tracking.  
The MVP focuses on a **minimal, mobile-first**, emotionally engaging experience that feels _alive_—a friendly AI that “checks in” daily.

---

## 📦 MVP Scope (What We’re Building Now)

### ✅ Core MVP Features (Phase: NOW)

| Feature                          | Description                                                                                           | Access        |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------- |
| **User Onboarding & Goal Setup** | Simple onboarding: users sign up and define a single fitness goal (e.g., "Go to the gym 3x/week").    | Free          |
| **AI Motivation Message**        | AI-generated motivational message based on user's goal and progress, delivered via push notification. | Free          |
| **Smart Reminders ("AI Call")**  | Scheduled notifications (with sound) that act like an alarm to "call" the user at chosen times.       | Free (1 goal) |
| **Quick Check-In**               | Daily question: "Did you work out today?" with Yes/No and optional reflection text.                   | Free          |
| **Progress Tracker**             | Weekly streaks and summary cards (e.g., "You worked out 4/7 days!").                                  | Free          |
| **Social Feed (Combined)**       | AI motivation + community text/voice posts in unified feed.                                           | Free          |
| **Text Post Creation**           | Share progress, thoughts, achievements publicly.                                                      | Free          |
| **Voice Post Creation**          | Record and share voice motivation (Pro/Coach+ feature).                                               | Paid          |
| **Like & Cheer System**          | React to posts with encouragement and support.                                                        | Free          |
| **Comments on Posts**            | Reply and engage in discussions on community posts.                                                   | Free          |
| **User Profiles**                | View other users' profiles with their activity and stats.                                             | Free          |
| **User Following System**        | Follow users to see their updates in your feed.                                                       | Free          |
| **Advanced Filtering**           | Filter feed by date, user, category, post type, popularity.                                           | Free          |
| **Notification Scheduling**      | Users choose custom times for AI reminders.                                                           | Free          |
| **Dark/Light Mode**              | Clean, minimal design with auto theme switch.                                                         | Free          |

---

## 🔁 Later (Post-MVP / Growth Phase)

| Feature                             | Description                                                                  | Access |
| ----------------------------------- | ---------------------------------------------------------------------------- | ------ |
| **AI Voice Messages**               | Generate short pep-talk voice notes via ElevenLabs.                          | Paid   |
| **Integration with Fitness APIs**   | Pull activity data from Apple Health, Fitbit, Strava.                        | Paid   |
| **Mood Check-In**                   | Ask “How do you feel today?” and adapt tone accordingly.                     | Free   |
| **AI Progress Reflection**          | Weekly “AI coach summary” referencing user’s emotional and workout patterns. | Paid   |
| **Reminders via Multiple Channels** | Telegram, WhatsApp, or Email check-ins.                                      | Paid   |
| **Direct Messaging**                | Private one-on-one conversations between users.                              | Free   |
| **Custom Routine Templates**        | Choose predefined training templates.                                        | Paid   |
| **Community Challenges**            | 21-day streak or group challenges.                                           | Paid   |

---

## 🧱 Future (Scaling Phase)

| Feature                        | Description                                                                    | Access |
| ------------------------------ | ------------------------------------------------------------------------------ | ------ |
| **AI Coach Memory**            | Long-term memory for personal context: “Remember week 3 when you almost quit?” | Paid   |
| **Voice Conversations**        | Real-time, interactive AI “calls” up to 60 seconds.                            | Paid   |
| **Behavior Prediction Engine** | Detects when users skip and suggests adaptive nudges.                          | Paid   |
| **Multi-Habit Support**        | Expand beyond fitness (nutrition, sleep, mindfulness).                         | Paid   |
| **AI Video Reactions**         | Personalized avatar-based motivational videos.                                 | Paid   |
| **Gym Partnerships**           | Integration with gyms for loyalty perks.                                       | B2B    |
| **Coach Marketplace**          | Blend AI + human coaching dashboard.                                           | Paid   |
| **AR Progress Visualization**  | AR-based confidence tracker.                                                   | Paid   |

---

## 🧩 System Architecture

### 📁 Folder Structure (Monorepo)

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
├── n8n/ # Localization automation and translation workflows
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

apps/mobile/
├── store/ # Zustand stores
│ ├── userStore.ts
│ ├── settingsStore.ts
│ └── index.ts
├── screens/
├── components/
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
└── ...

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

## 📱 Mobile App Architecture

### 🔄 Offline-First Strategy

- **React Query**: Persistent cache with background sync
- **Queue Mutations**: Store changes when offline, sync on reconnection
- **Local Storage**: `storageUtil.setItem()`, `storageUtil.getItem()` wrapper
- **Background Sync**: Expo Background Fetch for data synchronization

### 🗄️ State Management

- **Zustand**: Global app state (user, settings, preferences)
- **React Query**: Server state management (API data, caching)
- **Store Structure**: `apps/mobile/store/` with typed stores
- **Persistence**: AsyncStorage for user preferences and settings

### 📸 Media Handling

- **Cloudflare R2 Integration**: All images and voice notes via Cloudflare R2
- **Upload Flow**: Signed URLs for secure direct uploads
- **Image Caching**: react-native-fast-image for Cloudflare R2 URLs
- **Optimization**: Automatic format selection and compression

### 🔔 Push Notifications

- **Expo Notifications**: Cross-platform notification handling
- **FCM Integration**: Firebase Cloud Messaging for delivery
- **Background Processing**: Handle notifications when app is closed
- **User Preferences**: Customizable notification settings

### ⚡ Performance Optimization

- **Hermes Engine**: Faster startup and reduced memory usage
- **FlatList Virtualization**: Efficient rendering for social feeds
- **Lazy Loading**: Screen-based lazy loading for heavy components
- **Bundle Splitting**: Separate bundles for different app sections

---

## 🧠 Database Layer

**DB:** Supabase (PostgreSQL)  
**Why:**

- Supports `ON DELETE CASCADE` for clean relational management.
- Realtime sync for progress updates and social feed.
- Scalable + self-hostable for cost efficiency.

**Key Tables:**

- `users` — basic profile, subscription tier, preferences.
- `goals` — each user’s fitness target (1 per Free user).
- `check_ins` — daily progress (date, success, reflection).
- `motivations` — AI-generated messages per goal.
- `posts` — social wall content (text, voice, created_at).
- `comments` — post comments (post_id, user_id, text, created_at).
- `likes` — reaction system.
- `follows` — user following relationships (follower_id, following_id).
- `feed_preferences` — user feed filter preferences.
- `subscriptions` — user subscription details (platform, product_id, expires_at, status).
- `iap_receipts` — Apple/Google receipt storage for verification.
- `offer_codes` — promotional offer codes and usage tracking.

---

## 🔔 Notifications

**Tool:** Firebase Cloud Messaging (FCM)

- Triggers local push notifications using scheduled CRON jobs.
- Fallback: Twilio/Email optional integration for reminders.
- Each “AI Call” triggers:
  1. Local push → alarm sound.
  2. User taps → opens motivation message page.

---

## 🔌 API Endpoints (MVP)

| Endpoint                      | Method   | Description                              |
| ----------------------------- | -------- | ---------------------------------------- |
| `/api/v1/auth/signup`         | POST     | Register user.                           |
| `/api/v1/auth/login`          | POST     | User login.                              |
| `/api/v1/goals`               | POST     | Create goal (Free = 1 limit).            |
| `/api/v1/goals/:id/checkin`   | POST     | Record daily check-in.                   |
| `/api/v1/motivation/generate` | POST     | Generate AI motivational message.        |
| `/api/v1/motivation/schedule` | POST     | Schedule reminder via FCM.               |
| `/api/v1/feed`                | GET      | Fetch motivational feed.                 |
| `/api/v1/posts`               | GET/POST | Get or create community posts.           |
| `/api/v1/posts/:id/comments`  | GET/POST | Get or create comments on posts.         |
| `/api/v1/likes`               | POST     | Add/remove cheer on post.                |
| `/api/v1/users/:id/follow`    | POST     | Follow/unfollow users.                   |
| `/api/v1/users/:id/profile`   | GET      | Get user profile details.                |
| `/api/v1/feed/filter`         | GET      | Get filtered feed with query params.     |
| `/api/v1/analytics`           | GET      | Weekly summary (Pro users).              |
| `/api/v1/media/upload`        | POST     | Get signed upload URL for Cloudflare R2. |
| `/api/v1/users/me/data`       | GET      | Export user data (GDPR compliance).      |
| `/api/v1/users/me/delete`     | DELETE   | Delete user account and data.            |

## 📱 Subscription & In-App Purchase Endpoints

### Subscription Management

| `/api/v1/subscriptions/plans` | GET | List available plans with platform-specific product IDs |
| `/api/v1/subscriptions/me` | GET | Get current user subscription status |
| `/api/v1/subscriptions/sync` | POST | Sync subscription from Apple/Google |
| `/api/v1/subscriptions/features` | GET | Get features available for current plan |

### Apple In-App Purchase (iOS)

| `/api/v1/iap/apple/verify-receipt` | POST | Verify Apple receipt after purchase |
| `/api/v1/iap/apple/webhook` | POST | Apple App Store Server Notifications |
| `/api/v1/iap/apple/products` | GET | Get Apple product IDs (com.fitnudge.pro.monthly, etc.) |
| `/api/v1/iap/apple/restore` | POST | Restore previous purchases |
| `/api/v1/iap/apple/validate-offer` | POST | Validate Apple Offer Code |

### Google Play Billing (Android)

| `/api/v1/iap/google/verify-purchase` | POST | Verify Google purchase token |
| `/api/v1/iap/google/webhook` | POST | Google Real-time Developer Notifications (RTDN) |
| `/api/v1/iap/google/products` | GET | Get Google Play product IDs |
| `/api/v1/iap/google/acknowledge` | POST | Acknowledge purchase (required by Google) |
| `/api/v1/iap/google/validate-promo` | POST | Validate Google promo code |

### Admin Subscription Management

| `/api/v1/admin/subscriptions` | GET | List all subscriptions with filters |
| `/api/v1/admin/subscriptions/:id` | GET | Get detailed subscription info |
| `/api/v1/admin/subscriptions/:id/grant` | POST | Grant free subscription (for partnerships) |
| `/api/v1/admin/revenue` | GET | Revenue analytics (gross vs net) |
| `/api/v1/admin/iap/offer-codes` | GET | List active offer codes |
| `/api/v1/admin/iap/offer-codes` | POST | Create new offer code campaign |

## 📝 Blog Endpoints

### Public Blog Endpoints

| `/api/v1/blog/posts` | GET | List published blog posts (paginated) |
| `/api/v1/blog/posts/:slug` | GET | Get single post by slug |
| `/api/v1/blog/categories` | GET | List categories with post counts |
| `/api/v1/blog/posts/:id/view` | POST | Track post view for analytics |

### Admin Blog Management

| `/api/v1/admin/blog/posts` | GET | List all posts (including drafts) |
| `/api/v1/admin/blog/posts` | POST | Create new blog post |
| `/api/v1/admin/blog/posts/:id` | PUT | Update blog post |
| `/api/v1/admin/blog/posts/:id` | DELETE | Delete blog post |
| `/api/v1/admin/blog/posts/:id/publish` | POST | Publish/schedule post |
| `/api/v1/admin/blog/categories` | GET | Manage categories |
| `/api/v1/admin/blog/categories` | POST | Create category |
| `/api/v1/admin/blog/analytics` | GET | Blog performance metrics |

**API Features:**

- **Versioning**: All endpoints under `/api/v1/` prefix
- **Rate Limiting**: 100 req/min (authenticated), 20 uploads/hour
- **Media Upload**: Cloudflare R2 signed URLs for secure direct uploads
- **Documentation**: Auto-generated Swagger docs at `/api/v1/docs`
- **Error Handling**: Standardized error responses with request IDs

---

## 🔒 Security & Compliance

### 🛡️ GDPR Compliance

- **Data Export**: `/api/v1/users/me/data` for user data download
- **Data Deletion**: `/api/v1/users/me/delete` with Cloudflare R2 media cleanup
- **Consent Management**: User consent tracking for data processing
- **Privacy Policy**: Clear data usage and retention policies

### 🔐 Data Protection

- **Encryption at Rest**: PII data encrypted in Supabase
- **JWT Authentication**: Secure token-based auth with refresh tokens
- **RLS Policies**: Row-level security for data isolation
- **Media Security**: Cloudflare R2 signed URLs for uploads, access control

### 💾 Backup & Recovery

- **Daily Backups**: Automated database backups, 30-day retention
- **Media Backup**: Cloudflare R2 automatic backup to S3
- **Point-in-Time Recovery**: < 4 hour RTO, < 1 hour RPO
- **Disaster Recovery**: Monthly testing and documentation

---

## 🧠 AI Logic: Motivation Prompt Design

**System Prompt Template:**
You are a friendly motivational coach specializing in fitness consistency.
Your job is to keep the user emotionally engaged and accountable.
Personalize each message using:

The user’s goal (“Lose 5kg”, “Gym 3x/week”)

Their recent performance (e.g., skipped days, streaks)

Their chosen tone (Friendly, Tough-love, Calm)

Always end with a short emotional nudge.

Example outputs:

Friendly: “You’re doing amazing! Even one step forward counts. Gym today?”

Tough-love: “Excuses don’t build muscle. You said you’d show up. Let’s go.”

Calm: “Remember why you started—today’s effort is tomorrow’s reward.”

**AI Tools:**

- GPT-5 API (text)
- ElevenLabs (voice synthesis for premium plans)

---

## 🧾 Feature Access Table (Free vs Paid Summary)

| Category            | Free                                    | Paid                         |
| ------------------- | --------------------------------------- | ---------------------------- |
| Goal creation       | 1 goal                                  | Multiple goals               |
| Motivation messages | Text only                               | Voice + text                 |
| Personality tone    | Default                                 | Custom tones                 |
| Analytics           | Basic streak                            | Weekly insights              |
| Notifications       | Single daily                            | Multiple / adaptive          |
| Social wall         | Text + Voice posts (Voice = Pro/Coach+) | Comments, following, filters |
| Integrations        | —                                       | Fitbit, Apple Health         |
| Challenges          | —                                       | Group & leaderboard          |
| Memory AI           | —                                       | Personalized recall          |

---

## 🧭 Tech Stack Summary

| Layer                 | Tool                                                  |
| --------------------- | ----------------------------------------------------- |
| **Frontend (Web)**    | Next.js + Tailwind v4 + shadcn/ui                     |
| **Frontend (Mobile)** | React Native + Expo                                   |
| **Backend**           | FastAPI (Python)                                      |
| **Database**          | Supabase (PostgreSQL)                                 |
| **Auth**              | Supabase Auth                                         |
| **Notifications**     | Firebase Cloud Messaging                              |
| **AI Generation**     | OpenAI GPT-5                                          |
| **Voice Synthesis**   | ElevenLabs / Play.ht                                  |
| **Analytics**         | Posthog (usage)                                       |
| **Caching**           | Redis (API responses, AI messages)                    |
| **CDN**               | Vercel Edge Network (web) + Cloudflare R2 CDN (media) |
| **Media Storage**     | Cloudflare R2 (images, voice notes)                   |
| **Monitoring**        | Sentry (errors) + New Relic (APM)                     |
| **Testing**           | Pytest (backend) + Detox (mobile E2E)                 |
| **Design System**     | `packages/themes` with CSS variables + React hooks    |
| **IAP (iOS)**         | Apple StoreKit + expo-in-app-purchases                |
| **IAP (Android)**     | Google Play Billing + expo-in-app-purchases           |

---

## 🏗️ Infrastructure & Operations

### 🚀 CI/CD Pipeline

- **GitHub Actions**: Automated testing and deployment
- **Environments**: Local, Staging, Production
- **Deployment Strategy**: Feature branches → Staging, Main → Production
- **Rollback**: Automatic rollback on health check failures

### 📊 Monitoring & Observability

- **Error Tracking**: Sentry for backend + mobile app
- **APM**: New Relic for application performance monitoring
- **Analytics**: Posthog for user behavior tracking
- **Logging**: Structured JSON logging with centralized collection

### 📸 Media Storage & CDN

- **Cloudflare R2**: Auto-scaling media storage and delivery
- **CDN**: Global edge locations for fast media delivery
- **Optimization**: Automatic image compression and format selection
- **Backup**: Automated media backup to S3

### 💾 Backup & Recovery

- **Database**: Daily automated backups, 30-day retention
- **Media**: Cloudflare R2 automatic backup to S3
- **Recovery**: Point-in-time recovery, < 4 hour RTO
- **Testing**: Monthly disaster recovery drills

### 💰 Cost Controls

- **AI Budget**: Token limits and monthly budget alerts
- **Media Quotas**: User storage limits and bandwidth monitoring
- **Resource Alerts**: Cost thresholds and usage optimization
- **Efficiency**: Cost per user tracking and optimization

---

## ♿ Accessibility Requirements

### 🎯 WCAG 2.1 AA Compliance Target

**Accessibility Standards:**

- **Color Contrast**: 4.5:1 for normal text, 3:1 for large text and UI components
- **Touch Targets**: Minimum 44x44px for all interactive elements
- **Screen Reader Support**: Full compatibility with VoiceOver (iOS) and TalkBack (Android)
- **Keyboard Navigation**: Complete keyboard accessibility for web interface
- **Focus Management**: Visible focus indicators and logical tab order

### 📱 Mobile Accessibility Features

**React Native Accessibility:**

- **Semantic Elements**: Proper use of `accessibilityRole` and `accessibilityLabel`
- **Screen Reader Support**: All content announced correctly by assistive technologies
- **Voice Control**: Support for voice commands and dictation
- **Dynamic Type**: Respect user's preferred text size settings
- **Reduced Motion**: Honor user's motion preferences

### 🌐 Web Accessibility

**Web Interface Standards:**

- **Skip Navigation**: Skip links for keyboard users
- **ARIA Labels**: Comprehensive ARIA labeling for complex interactions
- **Form Accessibility**: Proper labels, error messages, and validation
- **Color Independence**: Information not conveyed by color alone
- **Focus Indicators**: Clear visual focus indicators

---

## 🚀 User Onboarding Flow

### 📋 Step-by-Step Onboarding

**Onboarding Sequence:**

1. **Welcome Screen**: App introduction and value proposition
2. **Account Creation**: Email/password or social login (Apple, Google)
3. **Profile Setup**: Name, profile picture, basic preferences
4. **Goal Creation Wizard**: Guided goal setting with examples and templates
5. **Notification Permissions**: Clear explanation of notification benefits
6. **First Motivation Preview**: Show user what AI motivation looks like
7. **Optional Tour**: Interactive walkthrough of key features

**Onboarding Features:**

- **Progress Indicator**: "Step 2 of 7" with visual progress bar
- **Skip Options**: Allow users to skip non-essential steps
- **Smart Defaults**: Pre-filled options based on user behavior
- **Help Tooltips**: Contextual help throughout the process
- **Back Navigation**: Easy return to previous steps

### 🎯 Goal Creation Wizard

**Guided Goal Setting:**

- **Goal Templates**: Pre-built templates for common fitness goals
- **Smart Suggestions**: AI-powered goal recommendations
- **Frequency Selection**: Visual calendar for workout frequency
- **Motivation Style**: Choose AI coach personality (friendly, tough-love, calm)
- **Reminder Timing**: Select preferred notification times

---

## 💳 Payment & Subscription Details

### 💰 Pricing Tiers

**Subscription Plans:**

| Plan       | Price       | Features                                                     |
| ---------- | ----------- | ------------------------------------------------------------ |
| **Free**   | $0/month    | 1 goal, text motivation, basic tracking                      |
| **Pro**    | $4.99/month | Multiple goals, voice messages, analytics, social features   |
| **Coach+** | $9.99/month | All Pro features + AI memory, integrations, priority support |

**Payment Methods:**

- **Credit Cards**: Visa, Mastercard, American Express
- **Digital Wallets**: Apple Pay, Google Pay
- **Regional Options**: PayPal, local payment methods

### 🆓 Free Trial & Billing

**Trial Period:**

- **7-Day Free Trial**: Full access to Pro features
- **No Credit Card Required**: Trial starts immediately
- **Easy Cancellation**: Cancel anytime during trial
- **Trial Reminders**: 3-day and 1-day trial expiration notices

**Billing Features:**

- **Automatic Renewal**: Seamless subscription management
- **Proration**: Automatic adjustments for plan changes
- **Invoice Generation**: Detailed receipts via email
- **Refund Policy**: 14-day money-back guarantee

### 📱 In-App Purchase (IAP) Implementation

**Platform Requirements:**

FitNudge uses platform-native payment systems for all subscriptions:

- **iOS**: Apple In-App Purchase (StoreKit)
- **Android**: Google Play Billing
- **Web**: No subscriptions (landing page only)

**Product IDs:**

iOS (Apple):

- `com.fitnudge.starter.monthly` - Starter Monthly ($2.99)
- `com.fitnudge.starter.annual` - Starter Annual ($29.99)
- `com.fitnudge.pro.monthly` - Pro Monthly ($4.99)
- `com.fitnudge.pro.annual` - Pro Annual ($49.99)
- `com.fitnudge.coach.monthly` - Coach+ Monthly ($9.99)
- `com.fitnudge.coach.annual` - Coach+ Annual ($99.99)

Android (Google Play):

- `starter_monthly` - Starter Monthly ($2.99)
- `starter_annual` - Starter Annual ($29.99)
- `pro_monthly` - Pro Monthly ($4.99)
- `pro_annual` - Pro Annual ($49.99)
- `coach_monthly` - Coach+ Monthly ($9.99)
- `coach_annual` - Coach+ Annual ($99.99)

**Promotional Offers:**

- **Apple Offer Codes**: Up to 6 months free or discounted (managed in App Store Connect)
- **Google Promo Codes**: Discounts and free trials (managed in Play Console)
- **Introductory Offers**: First-time subscriber discounts (e.g., first month $2.99)
- **Win-Back Offers**: Lapsed subscriber re-engagement offers

**Subscription Management:**

- Users manage subscriptions through App Store / Play Store
- Backend verifies receipts and syncs subscription status
- Automatic renewal handled by Apple/Google
- Refunds processed through Apple/Google (not FitNudge)

---

## 👨‍💼 Admin Portal Features

### 📊 Dashboard & Analytics

**Admin Dashboard Metrics:**

- **User Statistics**: Total users, active users, new signups
- **Revenue Metrics**: MRR, ARR, churn rate, LTV
- **Engagement Data**: DAU, MAU, retention rates, feature usage
- **System Health**: API performance, error rates, uptime

### 👥 User Management

**User Administration:**

- **User Search**: Advanced search and filtering capabilities
- **Profile Management**: View and edit user profiles
- **Account Actions**: Suspend, activate, or delete accounts
- **Support Tools**: View user activity, reset passwords, refund subscriptions
- **Bulk Operations**: Mass actions for user management

### 🛡️ Content Moderation

**Moderation Tools:**

- **Flagged Content**: Review user-reported posts and comments
- **Automated Filtering**: AI-powered content moderation
- **Manual Review**: Human oversight for edge cases
- **User Warnings**: Issue warnings or temporary restrictions
- **Appeal Process**: Handle user appeals for moderation actions

### 📈 Analytics & Reporting

**Business Intelligence:**

- **Custom Reports**: Create and schedule custom analytics reports
- **Data Export**: Export user data and analytics in various formats
- **A/B Test Results**: Track and analyze experiment outcomes
- **Revenue Analytics**: Detailed financial reporting and forecasting

### 📝 Blog Management

**Content Creation & Publishing:**

- **Rich Text Editor**: Create and edit blog posts with media support
- **SEO Metadata**: Manage title, description, keywords, and meta tags
- **Post Scheduling**: Schedule posts for optimal publishing times
- **Category Management**: Organize posts by fitness topics and themes
- **Tag System**: Tag posts for better discoverability and organization

**Content Analytics:**

- **Post Performance**: Track views, engagement, and conversion rates
- **SEO Metrics**: Monitor keyword rankings and organic traffic
- **Content Insights**: Identify top-performing content and topics
- **User Engagement**: Track time on page, bounce rate, and social shares

---

## 🌐 Web Landing Page Details

### 🎯 Landing Page Sections

**Hero Section:**

- **Headline**: "Transform Your Fitness Journey with AI-Powered Motivation"
- **Subheadline**: "Your personal AI coach that helps you stay consistent with your gym and fitness goals"
- **App Screenshots**: High-quality mockups showing key features
- **Call-to-Action**: "Download Now" buttons for App Store and Google Play
- **Social Proof**: User testimonials and success stories

**Features Section:**

- **AI Motivation**: Personalized motivational messages
- **Progress Tracking**: Visual progress charts and streak counters
- **Smart Reminders**: Intelligent notification system
- **Community**: Social features and peer support
- **Analytics**: Detailed insights for Pro users

**Blog Section:**

- **SEO-Optimized Articles**: Fitness motivation, habit formation, and AI coaching insights
- **Success Stories**: Real user transformations and testimonials
- **AI Motivation Tips**: How to leverage AI for fitness consistency
- **Fitness Industry Insights**: Latest trends and research-backed advice
- **User Guides**: How to maximize FitNudge features for best results

### 📱 How It Works

**3-Step Process:**

1. **Set Your Goal**: Choose from templates or create custom fitness goals
2. **Get AI Motivation**: Receive personalized messages and reminders
3. **Track Progress**: Monitor your consistency and celebrate achievements

### 💬 Testimonials & Social Proof

**User Success Stories:**

- **Before/After Stories**: Real user transformations
- **Video Testimonials**: Short video testimonials from satisfied users
- **Success Metrics**: "Users who stick to their goals 3x longer"
- **Media Mentions**: Press coverage and awards

### ❓ FAQ Section

**Common Questions:**

- **How does the AI motivation work?**
- **Is my data secure and private?**
- **Can I cancel my subscription anytime?**
- **Does it work offline?**
- **What makes this different from other fitness apps?**

### 📧 Email Capture

**Waitlist & Updates:**

- **Email Signup**: "Get notified when we launch" form
- **Early Access**: Beta testing opportunities
- **Newsletter**: Fitness tips and app updates
- **Social Links**: Connect on social media platforms

---

## 📱 Mobile App Store Strategy

### 🏪 App Store Submission

**App Store Connect Setup:**

- **App Information**: Complete app metadata and descriptions
- **Screenshots**: 6-8 screenshots per device (iPhone, iPad)
- **App Preview Video**: 15-30 second promotional video
- **Keywords**: Optimized for App Store search
- **Categories**: Health & Fitness, Lifestyle
- **Age Rating**: 4+ (suitable for all ages)

### 📸 App Store Assets

**Visual Assets Required:**

- **App Icon**: 1024x1024px with clear, recognizable design
- **Screenshots**: Device-specific screenshots showcasing key features
- **App Preview**: Short video demonstrating app functionality
- **Marketing Images**: Promotional banners and graphics

### 🔍 App Store Optimization (ASO)

**ASO Strategy:**

- **Keyword Research**: Target high-volume, relevant keywords
- **Title Optimization**: "FitNudge - AI Fitness Coach"
- **Description**: Compelling description with key benefits
- **Localization**: App store listings in multiple languages
- **A/B Testing**: Test different screenshots and descriptions

### 🧪 Beta Testing Strategy

**Pre-Launch Testing:**

- **TestFlight (iOS)**: Internal and external beta testing
- **Google Play Beta (Android)**: Closed and open beta tracks
- **Beta Feedback**: Collect and analyze user feedback
- **Crash Reporting**: Monitor and fix issues before launch
- **Performance Testing**: Ensure smooth performance across devices

---

## 📧 Email Communications

### 📨 Email Types

**Transactional Emails:**

- **Welcome Email**: Onboarding tips and getting started guide
- **Password Reset**: Secure password reset with expiration
- **Email Verification**: Account verification with confirmation
- **Payment Receipts**: Subscription confirmations and invoices
- **Account Updates**: Important account changes and security alerts

**Marketing Emails:**

- **Weekly Digest**: Personalized fitness tips and progress summaries
- **Feature Updates**: New features and improvements
- **Motivational Content**: Fitness tips, success stories, and motivation
- **Re-engagement**: Win back inactive users with special offers
- **Seasonal Campaigns**: New Year resolutions, summer fitness, etc.

### 📊 Email Analytics

**Performance Tracking:**

- **Open Rates**: Track email engagement and optimize subject lines
- **Click Rates**: Monitor link clicks and optimize content
- **Unsubscribe Rates**: Monitor and improve email relevance
- **Conversion Rates**: Track email-to-app conversion
- **A/B Testing**: Test different email designs and content

---

## 🔍 Search Functionality

### 🔎 Search Features

**Search Capabilities:**

- **Goal Search**: Find goals by title, description, or category
- **Community Search**: Search posts, users, and discussions
- **User Discovery**: Find and connect with other users
- **Content Search**: Search through motivational messages and tips

### 🎯 Search Experience

**Search Interface:**

- **Search Bar**: Prominent search bar in navigation
- **Autocomplete**: Real-time search suggestions
- **Search Filters**: Filter by date, user, category, popularity
- **Recent Searches**: Quick access to previous searches
- **Search History**: Track and learn from user search patterns

### 📊 Search Analytics

**Search Insights:**

- **Popular Queries**: Track most searched terms
- **Zero Results**: Identify content gaps
- **Search Conversion**: Track search-to-action conversion
- **User Behavior**: Understand search patterns and preferences

---

## 🌍 Enhanced Internationalization

### 🌐 Supported Languages

**Scope**: Translation applies to **mobile app and web landing page only**. Admin portal uses English exclusively.

**Initial Languages:**

- **English (en)**: Primary language with full feature support
- **Spanish (es)**: Complete translation including AI messages
- **French (fr)**: Localized content and cultural adaptation
- **German (de)**: German-specific fitness terminology

**Future Languages:**

- **Arabic (ar)**: RTL support and cultural adaptation
- **Hebrew (he)**: RTL support for Hebrew speakers
- **Portuguese (pt)**: Brazilian Portuguese localization
- **Japanese (ja)**: Japanese fitness culture adaptation

### 🕐 Localization Features

**Cultural Adaptation:**

- **Date/Time Formats**: Locale-appropriate formatting
- **Number Formats**: Currency and number formatting
- **Cultural References**: Fitness culture and terminology
- **Holiday Awareness**: Local holidays and observances
- **Measurement Units**: Metric vs Imperial system preferences

### 🔄 Translation Management

**Translation Workflow:**

- **Automated Translation**: AI-powered initial translations
- **Human Review**: Native speaker review and refinement
- **Context Awareness**: Understand fitness and motivation context
- **Continuous Updates**: Regular translation updates and improvements
- **Quality Assurance**: Translation quality monitoring and feedback

---

## 🪩 Design Philosophy

- **Clean, distraction-free interface** with semantic design tokens
- **Mobile-first design** with responsive breakpoints
- **Theme-aware components** using `useStyles` hook for consistent theming
- **Light + dark mode support** with auto-detect + manual override
- **Semantic color system** with generic naming (background, foreground, primary, etc.)
- **Design token architecture** in `packages/themes` for maintainable styling
- **Rounded UI elements**, soft shadows, and micro-interactions
- **Typography**: Space Grotesk font family with balanced hierarchy
- **Consistent accent color** for motivation energy (#2563EB as primary token)
- **Signature sound** for motivational "calls"

---

## 🎨 Design System & Tokens

### 🎨 Color Tokens (Semantic Palette)

**Light Mode:**

- `background`: #ffffff (Main app background)
- `foreground`: #0f172a (Primary text color)
- `card`: #f8fafc (Card/surface background)
- `card-foreground`: #1e293b (Text on cards)
- `popover`: #ffffff / `popover-foreground`: #0f172a
- `primary`: #2563eb / `primary-foreground`: #ffffff (Motivation blue)
- `secondary`: #f1f5f9 / `secondary-foreground`: #475569
- `muted`: #f8fafc / `muted-foreground`: #64748b
- `accent`: #e0e7ff / `accent-foreground`: #3730a3
- `destructive`: #ef4444 / `destructive-foreground`: #ffffff
- `success`: #10b981 / `success-foreground`: #ffffff (Positive states)
- `warning`: #f59e0b / `warning-foreground`: #ffffff (Gentle reminders)
- `border`: #e2e8f0 (Dividers and borders)
- `input`: #e2e8f0 (Form input borders)
- `ring`: #2563eb (Focus rings)

**Dark Mode:**

- `background`: #0f172a (Main app background)
- `foreground`: #f8fafc (Primary text color)
- `card`: #1e293b (Card/surface background)
- `card-foreground`: #f1f5f9 (Text on cards)
- `popover`: #1e293b / `popover-foreground`: #f8fafc
- `primary`: #3b82f6 / `primary-foreground`: #ffffff (Motivation blue)
- `secondary`: #334155 / `secondary-foreground`: #cbd5e1
- `muted`: #1e293b / `muted-foreground`: #94a3b8
- `accent`: #1e40af / `accent-foreground`: #dbeafe
- `destructive`: #dc2626 / `destructive-foreground`: #ffffff
- `success`: #34d399 / `success-foreground`: #064e3b (Positive states)
- `warning`: #fbbf24 / `warning-foreground`: #78350f (Gentle reminders)
- `border`: #334155 (Dividers and borders)
- `input`: #334155 (Form input borders)
- `ring`: #3b82f6 (Focus rings)

### 📝 Typography Tokens

**Font Families:**

- Primary: `Space Grotesk` (per user preference)
- Fallback: `system-ui, -apple-system, sans-serif`

**Font Scale:**

- `xs`: 12px (0.75rem)
- `sm`: 14px (0.875rem)
- `base`: 16px (1rem)
- `lg`: 18px (1.125rem)
- `xl`: 20px (1.25rem)
- `2xl`: 24px (1.5rem)
- `3xl`: 30px (1.875rem)
- `4xl`: 36px (2.25rem)

**Font Weights:**

- `normal`: 400
- `medium`: 500
- `semibold`: 600
- `bold`: 700

### 📏 Spacing Scale

- `xs`: 4px (0.25rem)
- `sm`: 8px (0.5rem)
- `md`: 16px (1rem)
- `lg`: 24px (1.5rem)
- `xl`: 32px (2rem)
- `2xl`: 48px (3rem)
- `3xl`: 64px (4rem)

### 🔲 Border Radius

- `sm`: 4px (0.25rem)
- `md`: 8px (0.5rem)
- `lg`: 12px (0.75rem)
- `xl`: 16px (1rem)
- `full`: 9999px (fully rounded)

### 🌟 Shadow System

- `sm`: `0 1px 2px 0 rgb(0 0 0 / 0.05)` (subtle elevation)
- `md`: `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)` (card elevation)
- `lg`: `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` (modal/dialog elevation)

### 🎯 Theme Usage

Components use style factory functions from the styles folder:

```typescript
// packages/ui/styles/card.styles.ts
export const makeCardStyles = (theme) => ({
  container: {
    backgroundColor: theme.colors.card,
    color: theme.colors.cardForeground,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    boxShadow: theme.shadows.md
  }
});

// Component usage
import { makeCardStyles } from '@fitnudge/ui/styles';
import { theme } from '@/themes';

const Card = ({ children }) => {
  const styles = makeCardStyles(theme);
  return <div style={styles.container}>{children}</div>;
};
```

**Theme Switching:**

- Auto-detect system preference on first visit
- Manual override with manual toggle
- Persist user preference in localStorage
- CSS classes: `.light` and `.dark` on root element

---

## 🚀 What Cursor Should Scaffold Now

Cursor should scaffold the **MVP scope only**, including:

- Frontend pages:
  - `/signup`
  - `/goals`
  - `/checkin`
  - `/progress`
  - `/feed`
- Backend endpoints listed above.
- Supabase schema + cascade relations.
- FCM integration for notifications.
- AI motivation generator endpoint using GPT-5.
- Basic UI components from `/packages/ui`.
- Design token system from `/packages/themes`.
- Tailwind v4 integration with theme tokens.

---

### 🌍 Localization & Automation

**Package:** `/packages/n8n`

**Purpose:**  
Automates translations for motivational messages, UI copy, and AI prompt responses.  
All locale data is stored in `/packages/n8n/locales` and synced to Supabase for live use.

**Workflows:**

- `translate_common_words.workflow.json` — translates English base strings to supported locales.
- `sync_supabase_locales.workflow.json` — updates Supabase localization tables.
- `utils.py` — helper for managing versioning, local file sync, and fallback.

**Supported Languages (initially):**

- English (`en`)
- Spanish (`es`)
- French (`fr`)
- German (`de`)

Future languages can be added automatically by updating the workflow list in n8n.
