# 🏋️ FitNudge - Fitness Motivation AI App

An AI-powered motivation and accountability app that helps users stay consistent with their fitness and gym habits through scheduled motivational notifications, smart reminders, and progress tracking.

## 🎯 Project Overview

**Goal**: Build a minimal, mobile-first, emotionally engaging experience that feels alive—a friendly AI that "checks in" daily to help users maintain their fitness goals.

### 🏗️ Architecture

This is a **monorepo** structured for scalability, shared logic, and clean maintainability between frontend, backend, and mobile clients.

### 📱 Apps and Packages

**Apps:**

- `apps/web`: Marketing landing page (Next.js)
- `apps/api`: FastAPI backend (Python)
- `apps/mobile`: React Native app (Expo)
- `apps/admin-portal`: Admin dashboard for managing users, plans, analytics
- `apps/docs`: Developer & user documentation

**Packages:**

- `packages/ui`: Shared shadcn/ui components with design system
- `packages/lib`: Utilities and hooks shared across apps
- `packages/db`: Supabase ORM client, migrations, and schema
- `packages/ai`: GPT-5 prompt templates and logic
- `packages/notifications`: FCM and scheduling utilities
- `packages/types`: Shared TypeScript types and DTOs
- `packages/themes`: Design tokens, CSS variables
- `packages/n8n`: Localization automation for mobile/web
- `packages/config`: Environment configs and tokens

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

## 🚀 Tech Stack

**Frontend:**

- **Mobile**: React Native (Expo) with TypeScript
- **Web**: Next.js with TypeScript
- **Design System**: Custom design tokens with light/dark mode
- **State Management**: Zustand (mobile), React Query

**Backend:**

- **API**: FastAPI (Python) with async/await
- **Database**: Supabase (PostgreSQL) with realtime
- **Authentication**: Supabase Auth + OAuth (Apple, Google)
- **AI**: OpenAI GPT-5 + ElevenLabs for voice
- **Notifications**: Firebase Cloud Messaging
- **Media**: Cloudflare R2 for images and voice files

**Infrastructure:**

- **Monorepo**: Turborepo for build orchestration
- **Deployment**: Vercel (web), Railway/Render (API), EAS (mobile)
- **Monitoring**: Sentry, PostHog
- **Localization**: n8n automation for mobile/web only

## 🛠️ Development Tools

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting
- [Supabase CLI](https://supabase.com/docs/guides/cli) for database management
- [Expo CLI](https://docs.expo.dev/workflow/expo-cli/) for mobile development

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- pnpm
- Supabase CLI
- Expo CLI

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd fitnudge

# Install dependencies
pnpm install

# Set up environment variables (see apps/docs/EnvironmentSetup.md)
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
cp apps/web/.env.local.example apps/web/.env.local
```

### Build

To build all apps and packages:

```bash
# Build everything
pnpm turbo build

# Build specific app
pnpm turbo build --filter=web
pnpm turbo build --filter=mobile
pnpm turbo build --filter=api
```

### Development

Start all development servers:

```bash
# Start all apps
pnpm turbo dev

# Start specific app
pnpm turbo dev --filter=web      # Marketing site
pnpm turbo dev --filter=mobile   # React Native app
pnpm turbo dev --filter=api      # FastAPI backend
```

### Database Setup

```bash
# Start Supabase locally
npx supabase start

# Run migrations
npx supabase db push --linked
```

## 📚 Documentation

Comprehensive documentation is available in `apps/docs/`:

- **[ProjectOverview.md](apps/docs/ProjectOverview.md)** - Product vision, features, tech stack
- **[Architecture.md](apps/docs/Architecture.md)** - System architecture and design patterns
- **[DataModels.md](apps/docs/DataModels.md)** - Database schema with OAuth support
- **[API-Spec.md](apps/docs/API-Spec.md)** - API endpoints with examples
- **[EnvironmentSetup.md](apps/docs/EnvironmentSetup.md)** - Setup guide with credentials
- **[Marketing.md](apps/docs/Marketing.md)** - Pricing strategy and growth tactics

## 🎨 Design System

FitNudge uses a comprehensive design system with:

- **Semantic Color Tokens**: Light/dark mode support with success/warning states
- **Typography**: Space Grotesk font family
- **Spacing Scale**: Consistent 4px base unit system
- **Component Library**: Shared shadcn/ui components
- **Theme Switching**: Auto-detect system preference + manual override

## 🔐 Authentication

- **Email/Password**: Traditional signup and login
- **Apple Sign In**: iOS native authentication
- **Google Sign In**: Cross-platform OAuth
- **JWT Tokens**: Secure session management

## 💳 Monetization

- **In-App Purchases**: Apple IAP and Google Play Billing via RevenueCat
- **Subscription Tiers**: Free and Premium ($9.99/month, $79.99/year)
- **Free Trial**: 3-day trial on annual plans
- **Platform Compliance**: Full App Store and Play Store compliance

## 🌍 Localization

- **Scope**: Mobile app and web landing page only
- **Languages**: English, Spanish, French, German (initial)
- **Admin Portal**: English only
- **Automation**: n8n workflows for translation management

## 🚀 Deployment

- **Web**: Vercel with automatic deployments
- **API**: Railway/Render with health checks
- **Mobile**: EAS Build for iOS/Android
- **Database**: Supabase with realtime sync

## 📞 Support

For development questions, refer to the comprehensive documentation in `apps/docs/` or check the individual app README files.
