# 📚 FitNudge Documentation

Comprehensive documentation for FitNudge — an AI-powered goal and habit accountability app.

## 📖 Documentation Overview

This directory contains all essential documentation for understanding, developing, and maintaining FitNudge.

## 📁 Documentation Files

### Core Documentation

| File                                         | Description                                            |
| -------------------------------------------- | ------------------------------------------------------ |
| [ProjectOverview.md](./ProjectOverview.md)   | Product vision, features, tech stack, and architecture |
| [Architecture.md](./Architecture.md)         | System design, patterns, and scalability               |
| [DataModels.md](./DataModels.md)             | Database schema and relationships                      |
| [API-Spec.md](./API-Spec.md)                 | API endpoints with examples                            |
| [EnvironmentSetup.md](./EnvironmentSetup.md) | Development setup guide                                |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)       | UI components and theming                              |
| [SCALABILITY.md](./SCALABILITY.md)           | Performance patterns for 100K+ users                   |

### Feature Documentation

| File                                                               | Description                      |
| ------------------------------------------------------------------ | -------------------------------- |
| [BACKEND_PUSH_NOTIFICATIONS.md](./BACKEND_PUSH_NOTIFICATIONS.md)   | Push notification implementation |
| [PUSH_NOTIFICATIONS_FLOW.md](./PUSH_NOTIFICATIONS_FLOW.md)         | Notification flow diagrams       |
| [SUBSCRIPTION_IMPLEMENTATION.md](./SUBSCRIPTION_IMPLEMENTATION.md) | RevenueCat integration           |
| [REALTIME_IMPLEMENTATION.md](./REALTIME_IMPLEMENTATION.md)         | Supabase realtime setup          |
| [REACT_QUERY_GUIDE.md](./REACT_QUERY_GUIDE.md)                     | React Query patterns             |

### Setup Guides

| File                                             | Description           |
| ------------------------------------------------ | --------------------- |
| [SETUP_DEV_SUPABASE.md](./SETUP_DEV_SUPABASE.md) | Local Supabase setup  |
| [Deployment.md](./Deployment.md)                 | Production deployment |

## 🎯 What is FitNudge?

FitNudge is an AI-powered motivation and accountability app that helps users stay consistent with **any goal or habit** — whether it's working out, reading, meditating, learning, or building any positive routine.

**Core Features:**

- **AI Check-ins**: Daily "How did it go?" prompts with personalized AI responses
- **Goal Templates**: Pre-built templates for common goals (workout, read, meditate, water, etc.)
- **Streak Tracking**: Visual progress with milestone celebrations (7, 14, 21, 30, 50, 100 days)
- **Accountability Partners**: Connect with others for mutual motivation
- **AI Coach Chat**: Real-time chat with AI for support and advice
- **Smart Notifications**: Adaptive nudges based on behavior patterns
- **Analytics Dashboard**: Charts and insights for premium users

## 🏗️ Project Structure

```
apps/
├── mobile/        # React Native app (Expo)
├── api/           # FastAPI backend (Python)
├── web/           # Marketing landing page (Next.js)
├── admin-portal/  # Admin dashboard (Next.js)
└── docs/          # This documentation

packages/
├── ui/            # Shared components
├── lib/           # Utilities
├── assets/        # Fonts
└── tsconfig/      # TypeScript configs
```

## 🧭 Tech Stack

| Layer         | Technology            |
| ------------- | --------------------- |
| Mobile        | React Native + Expo   |
| Backend       | FastAPI (Python)      |
| Database      | Supabase (PostgreSQL) |
| AI            | OpenAI GPT-4          |
| Subscriptions | RevenueCat            |
| Task Queue    | Celery + Redis        |
| Media Storage | Cloudflare R2         |

## 🚀 Quick Start

```bash
# Clone repository
git clone <repository-url>
cd fitnudge

# Install dependencies
pnpm install

# Set up environment variables
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env

# Start development
pnpm dev
```

## 💳 Subscription Tiers

| Plan    | Price    | Features                                       |
| ------- | -------- | ---------------------------------------------- |
| Free    | $0       | 1 goal, template motivation, basic tracking    |
| Premium | $9.99/mo | Unlimited goals, AI coach, partners, analytics |

## 📱 Core Features

### Free Features

- 1 fitness goal with templates
- Daily check-in prompts
- Template-based motivation messages
- Basic streak tracking
- Blog access

### Premium Features

- Unlimited goals
- AI-generated personalized motivation
- AI Coach chat
- Accountability partners
- Voice notes
- Weekly AI recaps
- Advanced analytics dashboard
- Pattern detection & adaptive nudging

## 🔗 External Resources

- [Supabase Docs](https://supabase.com/docs)
- [Expo Docs](https://docs.expo.dev/)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [RevenueCat Docs](https://docs.revenuecat.com/)
