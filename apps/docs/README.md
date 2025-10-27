# 📚 FitNudge Documentation

Comprehensive documentation for the FitNudge fitness motivation AI app, including project overview, architecture, API specifications, and setup guides.

## 📖 Documentation Overview

This directory contains all the essential documentation for understanding, developing, and maintaining the FitNudge application.

## 📁 Documentation Files

### Core Documentation

- **[ProjectOverview.md](./ProjectOverview.md)** - Product vision, MVP features, tech stack, and monorepo structure
- **[Architecture.md](./Architecture.md)** - System architecture, design patterns, scalability, and security
- **[DataModels.md](./DataModels.md)** - Complete database schema with OAuth support and relationships
- **[API-Spec.md](./API-Spec.md)** - All API endpoints with request/response examples and authentication
- **[EnvironmentSetup.md](./EnvironmentSetup.md)** - Step-by-step setup guide with all credentials and configuration
- **[Marketing.md](./Marketing.md)** - Pricing strategy, revenue projections, and growth tactics

## 🎯 Project Overview

FitNudge is an AI-powered motivation and accountability app that helps users stay consistent with their fitness and gym habits through:

- **AI Motivation**: Personalized motivational messages and voice notes
- **Progress Tracking**: Goal setting, check-ins, and streak tracking
- **Social Features**: Community posts, comments, likes, and following
- **Smart Reminders**: Scheduled notifications and "AI calls"
- **Subscription Tiers**: Free, Pro, and Coach+ plans with In-App Purchases

## 🏗️ Architecture

### Monorepo Structure

```
apps/
├── web/           # Marketing landing page (Next.js)
├── api/           # FastAPI backend (Python)
├── mobile/        # React Native app (Expo)
├── admin-portal/  # Admin dashboard (Next.js)
└── docs/          # Documentation (this directory)

packages/
├── ui/            # Shared components
├── lib/           # Utilities and hooks
├── db/            # Database client and migrations
├── ai/            # AI prompt templates
├── themes/        # Design system and tokens
├── types/         # TypeScript definitions
└── n8n/           # Localization automation
```

### Tech Stack

- **Frontend**: React Native (mobile), Next.js (web/admin)
- **Backend**: FastAPI (Python) with async/await
- **Database**: Supabase (PostgreSQL) with realtime
- **Authentication**: Supabase Auth + OAuth (Apple, Google)
- **AI**: OpenAI GPT-5 + ElevenLabs for voice
- **Media**: Cloudflare R2 for images and voice files
- **Notifications**: Firebase Cloud Messaging
- **Monorepo**: Turborepo for build orchestration

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- pnpm
- Supabase CLI
- Expo CLI

### Setup

```bash
# Clone repository
git clone <repository-url>
cd fitnudge

# Install dependencies
pnpm install

# Set up environment variables
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
cp apps/web/.env.local.example apps/web/.env.local

# Start development servers
pnpm turbo dev
```

## 📱 Apps Overview

### Web App (`apps/web/`)

- **Purpose**: Marketing landing page and blog
- **Tech**: Next.js with TypeScript
- **Features**: Hero section, features, testimonials, blog, download CTAs
- **SEO**: Optimized for search engines and social sharing

### API (`apps/api/`)

- **Purpose**: Backend API for all clients
- **Tech**: FastAPI with Python
- **Features**: Authentication, AI motivation, social features, IAP
- **Endpoints**: 50+ RESTful endpoints with comprehensive documentation

### Mobile App (`apps/mobile/`)

- **Purpose**: Core user experience
- **Tech**: React Native with Expo
- **Features**: AI motivation, social feed, progress tracking, subscriptions
- **Platforms**: iOS and Android with native features

### Admin Portal (`apps/admin-portal/`)

- **Purpose**: Management dashboard
- **Tech**: Next.js with TypeScript
- **Features**: User management, content moderation, analytics, blog management
- **Access**: Role-based access control for admin users

## 🎨 Design System

### Color Tokens

- **Light Mode**: Clean whites and subtle grays with blue primary
- **Dark Mode**: Deep slate backgrounds with brighter accents
- **Semantic Colors**: Success, warning, destructive states
- **Accessibility**: WCAG 2.1 AA compliant contrast ratios

### Typography

- **Font Family**: Space Grotesk for modern, clean appearance
- **Scale**: 12px to 36px with consistent hierarchy
- **Weights**: Normal to bold with semantic usage

### Components

- **Shared Library**: shadcn/ui components across all apps
- **Theme Support**: Light/dark mode with system detection
- **Responsive**: Mobile-first design with consistent breakpoints

## 🔐 Authentication

### OAuth Integration

- **Apple Sign In**: iOS native authentication
- **Google Sign In**: Cross-platform OAuth
- **Email/Password**: Traditional authentication
- **JWT Tokens**: Secure session management with refresh

### Security

- **Row Level Security**: Database-level access control
- **Encryption**: Data encryption at rest and in transit
- **Audit Logging**: Comprehensive action tracking
- **GDPR Compliance**: Data protection and user rights

## 💳 Monetization

### Subscription Tiers

- **Free**: 1 goal, basic motivation, community access
- **Pro ($4.99/month)**: Multiple goals, voice posts, analytics
- **Coach+ ($9.99/month)**: All Pro features + AI memory, integrations

### In-App Purchases

- **Apple IAP**: iOS App Store integration
- **Google Play Billing**: Android Play Store integration
- **Platform Compliance**: Full App Store and Play Store compliance
- **Webhook Handling**: Automated subscription management

## 🌍 Localization

### Scope

- **Mobile App**: Full translation support
- **Web Landing Page**: Marketing content translation
- **Admin Portal**: English only (no translation needed)

### Languages

- **Initial**: English, Spanish, French, German
- **Future**: Arabic, Hebrew, Portuguese, Japanese
- **Automation**: n8n workflows for translation management

## 📊 Analytics & Monitoring

### User Analytics

- **PostHog**: User behavior and conversion tracking
- **Custom Events**: Business-specific metrics
- **Cohort Analysis**: User retention and engagement

### System Monitoring

- **Sentry**: Error tracking and performance monitoring
- **New Relic**: Application performance monitoring
- **Health Checks**: System status and uptime monitoring

## 🚀 Deployment

### Platforms

- **Web**: Vercel with automatic deployments
- **API**: Railway/Render with health checks
- **Mobile**: EAS Build for iOS/Android
- **Database**: Supabase with realtime sync

### CI/CD

- **GitHub Actions**: Automated testing and deployment
- **Environment Management**: Staging and production environments
- **Rollback**: Automatic rollback on failures

## 📞 Support

For questions about the documentation or development:

1. **Check the relevant documentation file** for specific information
2. **Review the Architecture.md** for system design questions
3. **Consult the API-Spec.md** for endpoint details
4. **Follow the EnvironmentSetup.md** for configuration issues

## 🔗 External Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Expo Documentation](https://docs.expo.dev/)
- [Next.js Documentation](https://nextjs.org/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
