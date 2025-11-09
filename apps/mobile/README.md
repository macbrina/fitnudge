# 📱 FitNudge Mobile - React Native App

The mobile application for FitNudge, built with React Native and Expo, providing AI-powered fitness motivation and social features.

## 🎯 Purpose

- **Core App**: Primary user experience for fitness motivation
- **AI Integration**: Personalized motivation messages and voice notes
- **Social Features**: Community posts, comments, and following
- **Progress Tracking**: Goal setting and check-in system
- **Offline-First**: Works without internet connection
- **Cross-Platform**: iOS and Android support

## 🚀 Features

### User Experience

- **Onboarding**: Guided setup with goal creation wizard
- **Authentication**: Apple Sign In, Google Sign In, email/password
- **Profile Management**: User profiles with preferences
- **Theme Support**: Light/dark mode with system detection

### AI Motivation System

- **Smart Reminders**: Scheduled motivational notifications
- **Voice Messages**: AI-generated voice motivation (Pro feature)
- **Context Awareness**: Personalized based on goals and history
- **Multiple Tones**: Friendly, tough-love, calm coaching styles

### Social Features

- **Feed**: Combined AI and community posts
- **Posts**: Text and voice posts with media
- **Interactions**: Likes, comments, and reactions
- **Following**: User discovery and following system
- **Search**: Find users and content

### Progress Tracking

- **Goals**: Create and manage fitness goals
- **Check-ins**: Daily progress tracking
- **Analytics**: Streaks, success rates, and insights
- **Achievements**: Milestone celebrations

### Subscriptions

- **In-App Purchases**: Apple IAP and Google Play Billing
- **Subscription Tiers**: Free, Pro, Coach+
- **Feature Gating**: Premium features and limitations
- **Restore Purchases**: Cross-device subscription sync

## 🛠️ Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **State Management**: Zustand + React Query
- **Navigation**: Expo Router
- **Storage**: AsyncStorage with utility wrapper
- **Media**: Cloudflare R2 integration
- **Notifications**: Expo Notifications + FCM
- **Authentication**: Supabase Auth + OAuth

## 🚀 Development

### Prerequisites

- Node.js 18+
- Expo CLI
- iOS Simulator (macOS) or Android Studio
- Supabase account

### Setup

```bash
# Install dependencies (always use latest versions)
pnpm install

# Add new packages using npx expo install (preferred for mobile)
npx expo install <package-name>

# For Expo-compatible packages
npx expo install react-native-gesture-handler
npx expo install react-native-reanimated
npx expo install expo-notifications

# For non-Expo packages
pnpm add <package-name>

# Copy environment variables
cp .env.example .env

# Start development server
npx expo start
```

### Quick backend availability check

Before launching the app, make sure the API is up. From `apps/mobile` run:

```bash
# Check http://localhost:8000/health (or API_HEALTH_URL if set)
pnpm run check:backend
```

If you prefer running from the monorepo root, you can target the mobile package directly:

```bash
pnpm --filter @fitnudge/mobile run check:backend
```

The script exits early with a clear message if the backend is offline, which helps avoid debugging stale "network request failed" errors.

### Adding Dependencies

```bash
# ALWAYS use npx expo install for React Native packages (preferred)
npx expo install react-native-gesture-handler@latest
npx expo install react-native-reanimated@latest
npx expo install expo-camera@latest
npx expo install expo-image-picker@latest

# For JavaScript packages
pnpm add zustand@latest
pnpm add @tanstack/react-query@latest

# Never edit package.json manually - always use CLI commands
```

### Environment Variables

```bash
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
EXPO_PUBLIC_CLOUDFLARE_BUCKET_NAME=fitnudge-media

# OAuth (iOS)
EXPO_PUBLIC_APPLE_CLIENT_ID=com.fitnudge.app

# OAuth (Android + iOS)
EXPO_PUBLIC_GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456789-hijklmn.apps.googleusercontent.com

# Derived iOS URL scheme (reverse client ID used by config plugin)
GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.123456789-abcdefg

# Analytics
EXPO_PUBLIC_POSTHOG_API_KEY=your-posthog-api-key
EXPO_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

### Rebuilding the development client

Installing native Google Sign-In requires a fresh native build. After updating any of the above credentials, rebuild the Expo dev client and reinstall it on your devices:

```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

Then launch the app with `expo start --dev-client` to test the native sheets.

## 📁 Project Structure

```
apps/mobile/
├── app/                    # Expo Router pages
│   ├── (auth)/            # Authentication screens
│   ├── (tabs)/            # Main app tabs
│   ├── +not-found.tsx     # 404 page
│   └── _layout.tsx        # Root layout
├── components/             # React components
│   ├── ui/                # Reusable UI components
│   ├── forms/             # Form components
│   └── social/            # Social feature components
├── store/                 # Zustand stores
│   ├── userStore.ts       # User state
│   ├── settingsStore.ts  # App settings
│   └── index.ts           # Store exports
├── utils/                 # Utility functions
│   ├── storageUtil.ts     # AsyncStorage wrapper
│   ├── api.ts             # API client
│   └── constants.ts       # App constants
├── hooks/                 # Custom React hooks
├── types/                 # TypeScript types
└── assets/                # Images, fonts, etc.
```

## 🎨 Design System

Uses the shared design system from `packages/themes`:

- **Colors**: Semantic color tokens with light/dark mode
- **Typography**: Space Grotesk font family
- **Spacing**: Consistent 4px base unit system
- **Components**: Shared UI components
- **Theme Switching**: Auto-detect + manual override

## 📱 Platform Features

### iOS

- **Apple Sign In**: Native iOS authentication
- **In-App Purchases**: Apple StoreKit integration
- **Push Notifications**: APNs with sound support
- **Haptic Feedback**: Tactile feedback for interactions
- **Dynamic Type**: Accessibility text sizing

### Android

- **Google Sign In**: Native Android authentication
- **Google Play Billing**: Play Store billing integration
- **Push Notifications**: FCM with sound support
- **Material Design**: Android design guidelines
- **Back Button**: Android navigation handling

## 🔄 Offline Support

- **Local Storage**: AsyncStorage for user data
- **Queue System**: Offline action queuing
- **Background Sync**: Data synchronization on reconnection
- **Cache Management**: Intelligent data caching
- **Offline Indicators**: Clear offline state communication

## 🧪 Testing

```bash
# Run tests
npm test

# Run E2E tests with Detox
npm run test:e2e

# Run specific test
npm test -- --testNamePattern="Auth"
```

## 📦 Building

### Development Build

```bash
# Create development build
eas build --profile development --platform ios
eas build --profile development --platform android
```

### Production Build

```bash
# Create production build
eas build --profile production --platform all
```

### App Store Submission

```bash
# Submit to App Store
eas submit --platform ios

# Submit to Google Play
eas submit --platform android
```

## 🚀 Deployment

### EAS Build

```bash
# Configure EAS
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

### App Store Optimization

- **Metadata**: App name, description, keywords
- **Screenshots**: Device-specific screenshots
- **Preview Videos**: App preview videos
- **Localization**: Multi-language support
- **ASO**: Keyword optimization and A/B testing

## 📊 Analytics

- **PostHog**: User behavior and conversion tracking
- **Crashlytics**: Crash reporting and stability
- **Performance**: App performance monitoring
- **Custom Events**: Business-specific metrics

## 🔗 Related Documentation

- [ProjectOverview.md](../../docs/ProjectOverview.md) - Product vision and features
- [Architecture.md](../../docs/Architecture.md) - System architecture
- [API-Spec.md](../../docs/API-Spec.md) - API documentation
- [EnvironmentSetup.md](../../docs/EnvironmentSetup.md) - Setup guide
