# 🌐 FitNudge Web - Marketing Landing Page

The marketing and documentation website for FitNudge, built with Next.js and TypeScript.

## 🎯 Purpose

- **Marketing Site**: Showcase FitNudge features and benefits
- **User Onboarding**: Download app links and waitlist signup
- **Content Hub**: Blog posts, success stories, and fitness tips
- **SEO Optimized**: Search engine friendly with structured data

## 🚀 Features

### Marketing Pages

- **Hero Section**: Compelling headline with app screenshots
- **Features**: AI motivation, progress tracking, community
- **How It Works**: 3-step user journey
- **Testimonials**: User success stories and social proof
- **FAQ**: Common questions and answers
- **Download CTAs**: App Store and Google Play links

### Blog System

- **SEO-Optimized Articles**: Success stories, AI tips, fitness insights
- **Rich Content**: Images, videos, and interactive elements
- **Category Management**: Organized by topics and tags
- **Search Functionality**: Find articles by keywords
- **Social Sharing**: Easy sharing to social platforms

### Email Capture

- **Waitlist Signup**: Early access and beta testing
- **Newsletter**: Weekly fitness tips and motivation
- **Social Links**: Connect on social media platforms

## 🛠️ Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with design tokens
- **Components**: shadcn/ui component library
- **Analytics**: PostHog for user behavior tracking
- **SEO**: Next.js built-in SEO optimization

## 🚀 Development

### Prerequisites

- Node.js 18+
- pnpm

### Setup

```bash
# Install dependencies (always use latest versions)
pnpm install

# Add new packages using CLI (never edit package.json manually)
pnpm add <package-name>
pnpm add -D <dev-package-name>

# Copy environment variables
cp .env.local.example .env.local

# Start development server
pnpm dev
```

### Adding Dependencies

```bash
# Always use CLI commands to add packages
pnpm add next@latest react@latest react-dom@latest
pnpm add -D typescript@latest @types/node@latest @types/react@latest

# For shadcn/ui components
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
```

### Environment Variables

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
NEXT_PUBLIC_POSTHOG_API_KEY=your-posthog-api-key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

## 📁 Project Structure

```
apps/web/
├── app/                    # Next.js App Router
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Homepage
│   ├── blog/               # Blog pages
│   ├── about/              # About page
│   └── contact/            # Contact page
├── components/             # React components
│   ├── ui/                 # shadcn/ui components
│   ├── sections/           # Page sections
│   └── blog/               # Blog components
├── lib/                    # Utilities
├── public/                 # Static assets
└── styles/                 # Additional styles
```

## 🎨 Design System

Uses the shared design system from `packages/themes`:

- **Colors**: Semantic color tokens with light/dark mode
- **Typography**: Space Grotesk font family
- **Spacing**: Consistent 4px base unit system
- **Components**: Shared shadcn/ui components

## 📱 Responsive Design

- **Mobile-First**: Optimized for mobile devices
- **Breakpoints**: sm, md, lg, xl, 2xl
- **Touch-Friendly**: 44px minimum touch targets
- **Performance**: Optimized images and lazy loading

## 🔍 SEO Features

- **Meta Tags**: Dynamic meta descriptions and titles
- **Structured Data**: JSON-LD for rich snippets
- **Sitemap**: Automatic sitemap generation
- **Robots.txt**: Search engine crawling rules
- **Open Graph**: Social media sharing optimization

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Deploy to Vercel
vercel --prod

# Environment variables are set in Vercel dashboard
```

### Build Commands

```bash
# Build for production
pnpm build

# Start production server
pnpm start

# Lint and type check
pnpm lint
pnpm type-check
```

## 📊 Analytics

- **PostHog**: User behavior and conversion tracking
- **Google Analytics**: Search console and analytics
- **Core Web Vitals**: Performance monitoring
- **A/B Testing**: Feature flag testing with LaunchDarkly

## 🔗 Related Documentation

- [ProjectOverview.md](../../docs/ProjectOverview.md) - Product vision and features
- [Architecture.md](../../docs/Architecture.md) - System architecture
- [EnvironmentSetup.md](../../docs/EnvironmentSetup.md) - Setup guide
