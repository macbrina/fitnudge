# 🚀 FitNudge Pre-Launch Checklist

> Track all items that need to be completed before launching the app.

---

## 📱 Mobile App (`apps/mobile/`)

### ✅ Core Features (Completed)

- [x] Goal setting with templates
- [x] Daily AI check-ins
- [x] Streak tracking and milestones
- [x] AI Coach chat (Premium)
- [x] Accountability partners with cheers/nudges
- [x] Voice notes for check-ins
- [x] Weekly AI recaps
- [x] Pattern detection and adaptive nudging
- [x] Blog section with external links
- [x] Block/report partner functionality
- [x] Data export (GDPR)

### 🔧 Pre-Launch Tasks

| Task                                     | Priority | Status     |
| ---------------------------------------- | -------- | ---------- |
| Install & integrate `expo-store-review`  | High     | ✅ Done    |
| Update `APP_STORE_URLS` with real IDs    | High     | ⬜ Pending |
| Test all deep links end-to-end           | High     | ⬜ Pending |
| Test push notification flows (all types) | High     | ⬜ Pending |
| Test subscription purchase/restore       | High     | ⬜ Pending |
| Test voice note recording/playback       | Medium   | ⬜ Pending |
| Test AI Coach streaming responses        | Medium   | ⬜ Pending |
| Final UI/UX polish pass                  | Medium   | ⬜ Pending |
| App Store screenshots & metadata         | High     | ⬜ Pending |
| Play Store screenshots & metadata        | High     | ⬜ Pending |
| Privacy policy & terms of service URLs   | High     | ⬜ Pending |

---

## 🔧 Admin Portal (`apps/admin-portal/`)

> Currently a basic shell. Needs full implementation.

### 📝 Blog Management

| Task                                     | Priority | Status     |
| ---------------------------------------- | -------- | ---------- |
| Authentication (admin login)             | High     | ⬜ Pending |
| Blog posts list view                     | High     | ⬜ Pending |
| Create/edit blog post (rich text editor) | High     | ⬜ Pending |
| Blog categories CRUD                     | Medium   | ⬜ Pending |
| Blog tags CRUD                           | Medium   | ⬜ Pending |
| Image upload for blog posts              | Medium   | ⬜ Pending |
| Publish/unpublish posts                  | High     | ⬜ Pending |
| Preview post before publishing           | Medium   | ⬜ Pending |

### 👥 User Management

| Task                          | Priority | Status     |
| ----------------------------- | -------- | ---------- |
| Users list with search/filter | Medium   | ⬜ Pending |
| View user details             | Medium   | ⬜ Pending |
| Subscription status overview  | Medium   | ⬜ Pending |
| User reports moderation       | Medium   | ⬜ Pending |

### 📊 Analytics Dashboard

| Task                     | Priority | Status     |
| ------------------------ | -------- | ---------- |
| Active users count       | Low      | ⬜ Pending |
| Check-in completion rate | Low      | ⬜ Pending |
| Subscription metrics     | Low      | ⬜ Pending |
| Retention charts         | Low      | ⬜ Pending |

---

## 🌐 Marketing Website (`apps/web/`)

> Landing page exists. Blog needs real data.

### 🏠 Landing Page

| Task                                         | Priority | Status     |
| -------------------------------------------- | -------- | ---------- |
| Review/update hero section copy              | Medium   | ⬜ Pending |
| Update app screenshots                       | High     | ⬜ Pending |
| Add real testimonials                        | Medium   | ⬜ Pending |
| Update download links (App Store/Play Store) | High     | ⬜ Pending |
| SEO meta tags optimization                   | Medium   | ⬜ Pending |
| Open Graph images                            | Medium   | ⬜ Pending |

### 📰 Blog (Web)

| Task                                        | Priority | Status     |
| ------------------------------------------- | -------- | ---------- |
| Connect to real blog API (remove mock data) | High     | ⬜ Pending |
| Individual blog post page (`/blog/[slug]`)  | High     | ⬜ Pending |
| Category/tag filtering                      | Medium   | ⬜ Pending |
| Search functionality                        | Low      | ⬜ Pending |
| RSS feed                                    | Low      | ⬜ Pending |

### 📄 Legal Pages

| Task                      | Priority | Status     |
| ------------------------- | -------- | ---------- |
| Privacy Policy page       | High     | ⬜ Pending |
| Terms of Service page     | High     | ⬜ Pending |
| Cookie policy (if needed) | Medium   | ⬜ Pending |

---

## 🔌 Backend API (`apps/api/`)

### ✅ Core Features (Completed)

- [x] All API endpoints implemented
- [x] Push notifications with categories
- [x] Celery background tasks
- [x] AI integration (OpenAI)
- [x] Voice note handling (R2 storage)
- [x] RevenueCat webhooks
- [x] Blog API endpoints
- [x] Analytics dashboard (Premium)
- [x] Analytics scalability (indexes, materialized views, Redis cache)

### 🔧 Pre-Launch Tasks

| Task                                              | Priority | Status     |
| ------------------------------------------------- | -------- | ---------- |
| Load testing (100+ concurrent users)              | Medium   | ⬜ Pending |
| Review rate limiting settings                     | Medium   | ⬜ Pending |
| Verify Celery beat schedule                       | High     | ⬜ Pending |
| Test email delivery (data export, password reset) | High     | ⬜ Pending |
| Database indexes optimization                     | Medium   | ✅ Done    |
| Error monitoring setup (Sentry)                   | High     | ⬜ Pending |
| Run migration `012_analytics_rpc.sql`             | High     | ⬜ Pending |

---

## 🔐 Security & Compliance

| Task                            | Priority | Status     |
| ------------------------------- | -------- | ---------- |
| Security audit of API endpoints | High     | ⬜ Pending |
| RLS policies verification       | High     | ⬜ Pending |
| GDPR compliance check           | High     | ⬜ Pending |
| App Store privacy labels        | High     | ⬜ Pending |
| Play Store data safety section  | High     | ⬜ Pending |

---

## 📦 Deployment & Infrastructure

| Task                                   | Priority | Status     |
| -------------------------------------- | -------- | ---------- |
| Production Supabase project setup      | High     | ⬜ Pending |
| Production environment variables       | High     | ⬜ Pending |
| API deployment (Railway/Vercel)        | High     | ⬜ Pending |
| Web deployment (Vercel)                | High     | ⬜ Pending |
| Admin portal deployment                | Medium   | ⬜ Pending |
| Domain setup (fitnudge.app or similar) | High     | ⬜ Pending |
| SSL certificates                       | High     | ⬜ Pending |
| CDN for static assets                  | Medium   | ⬜ Pending |

---

## 📱 App Store Submission

### Apple App Store

| Task                           | Priority | Status     |
| ------------------------------ | -------- | ---------- |
| Apple Developer account setup  | High     | ⬜ Pending |
| App Store Connect app created  | High     | ⬜ Pending |
| Screenshots (6.5", 5.5", iPad) | High     | ⬜ Pending |
| App icon (1024x1024)           | High     | ⬜ Pending |
| App description & keywords     | High     | ⬜ Pending |
| Privacy policy URL             | High     | ⬜ Pending |
| Build uploaded via EAS         | High     | ⬜ Pending |
| TestFlight beta testing        | Medium   | ⬜ Pending |
| Submit for review              | High     | ⬜ Pending |

### Google Play Store

| Task                          | Priority | Status     |
| ----------------------------- | -------- | ---------- |
| Google Play Console setup     | High     | ⬜ Pending |
| App listing created           | High     | ⬜ Pending |
| Screenshots & feature graphic | High     | ⬜ Pending |
| App icon (512x512)            | High     | ⬜ Pending |
| Store listing copy            | High     | ⬜ Pending |
| Content rating questionnaire  | High     | ⬜ Pending |
| Data safety section           | High     | ⬜ Pending |
| AAB uploaded via EAS          | High     | ⬜ Pending |
| Internal/closed testing       | Medium   | ⬜ Pending |
| Production release            | High     | ⬜ Pending |

---

## 💳 Payments & Subscriptions

| Task                            | Priority | Status     |
| ------------------------------- | -------- | ---------- |
| RevenueCat project configured   | High     | ⬜ Pending |
| iOS in-app purchases created    | High     | ⬜ Pending |
| Android in-app products created | High     | ⬜ Pending |
| Product IDs matched in code     | High     | ⬜ Pending |
| Webhook URL configured          | High     | ⬜ Pending |
| Test purchase flow (sandbox)    | High     | ⬜ Pending |
| Restore purchases tested        | High     | ⬜ Pending |

---

## 📊 Analytics & Monitoring

| Task                  | Priority | Status     |
| --------------------- | -------- | ---------- |
| PostHog setup         | Medium   | ⬜ Pending |
| Key events tracked    | Medium   | ⬜ Pending |
| Sentry error tracking | High     | ⬜ Pending |
| Uptime monitoring     | Medium   | ⬜ Pending |
| Database monitoring   | Medium   | ⬜ Pending |

---

## 🎯 Launch Day Checklist

| Task                             | Status |
| -------------------------------- | ------ |
| Final production build           | ⬜     |
| All environment variables set    | ⬜     |
| Database migrations applied      | ⬜     |
| Celery workers running           | ⬜     |
| Push notifications tested        | ⬜     |
| App Store approved               | ⬜     |
| Play Store approved              | ⬜     |
| Marketing website live           | ⬜     |
| Social media announcements ready | ⬜     |
| Support email monitored          | ⬜     |

---

## 📝 Notes

### App Store IDs to Update

- `apps/mobile/src/constants/general.ts` - `APP_STORE_URLS`
  - iOS: `https://apps.apple.com/app/fitnudge/id[REAL_ID]`
  - Android: `https://play.google.com/store/apps/details?id=[REAL_PACKAGE]`

### Environment Variables Needed

- Production Supabase URL & keys
- Production RevenueCat API key
- OpenAI API key
- Expo push notification credentials
- Cloudflare R2 credentials
- Email service credentials (SendGrid/Resend)
- Sentry DSN

---

_Last updated: January 2026_
