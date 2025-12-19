# 🚀 Environment Setup Guide

---

## 📋 Prerequisites

### Required Software

- **Node.js**: 18.0+ (LTS recommended)
- **Python**: 3.11+
- **pnpm**: Latest version
- **Git**: Latest version
- **Supabase CLI**: Latest version
- **Expo CLI**: Latest version

### System Requirements

- **macOS**: 10.15+ (for iOS development)
- **Windows**: 10+ (for Android development)
- **Linux**: Ubuntu 20.04+ (for backend development)
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 10GB free space

---

## 🔧 Environment Variables

### Backend (.env)

```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/fitnudge
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# JWT Authentication
JWT_SECRET_KEY=your-super-secret-jwt-key-here
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

# OAuth - Apple Sign In
APPLE_CLIENT_ID=com.fitnudge.app
APPLE_TEAM_ID=ABC123DEF4
APPLE_KEY_ID=XYZ789
APPLE_PRIVATE_KEY_PATH=./certs/AuthKey_XYZ789.p8

# OAuth - Google Sign In (Mobile)
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=123456789-hijklmn.apps.googleusercontent.com

# AI Services
OPENAI_API_KEY=sk-your-openai-api-key
ELEVENLABS_API_KEY=your-elevenlabs-api-key

# Media Storage
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_ACCESS_KEY_ID=your-access-key
CLOUDFLARE_SECRET_ACCESS_KEY=your-secret-key
CLOUDFLARE_BUCKET_NAME=fitnudge-media
CLOUDFLARE_PUBLIC_URL=https://your-bucket.your-account.r2.cloudflarestorage.com

# Push Notifications
FCM_SERVER_KEY=your-firebase-server-key
EXPO_ACCESS_TOKEN=your-expo-access-token

# Infrastructure
REDIS_URL=redis://localhost:6379
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Email Service (Namecheap Private Email)
SMTP_HOST=mail.privateemail.com
SMTP_PORT=587
SMTP_USERNAME=noreply@fitnudge.app
SMTP_PASSWORD=your-email-password
FROM_EMAIL=noreply@fitnudge.app

# Feature Flags
LAUNCHDARKLY_SDK_KEY=your-launchdarkly-sdk-key

# Monitoring
NEW_RELIC_LICENSE_KEY=your-newrelic-license-key
NEW_RELIC_APP_NAME=fitnudge-api

# PostHog Analytics
POSTHOG_API_KEY=phc_your-posthog-project-api-key
POSTHOG_HOST=https://us.i.posthog.com
POSTHOG_ENABLE_EXCEPTION_AUTOCAPTURE=true
```

### Mobile (.env)

```bash
# API Configuration
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
EXPO_PUBLIC_CLOUDFLARE_BUCKET_NAME=fitnudge-media

# OAuth - Apple Sign In (iOS only)
EXPO_PUBLIC_APPLE_CLIENT_ID=com.fitnudge.app

# OAuth - Google Sign In (iOS + Android)
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=123456789-hijklmn.apps.googleusercontent.com

# Analytics
EXPO_PUBLIC_POSTHOG_API_KEY=your-posthog-api-key
EXPO_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Feature Flags
EXPO_PUBLIC_LAUNCHDARKLY_CLIENT_ID=your-launchdarkly-client-id
```

### Web (.env.local)

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Analytics
NEXT_PUBLIC_POSTHOG_API_KEY=your-posthog-api-key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Feature Flags
NEXT_PUBLIC_LAUNCHDARKLY_CLIENT_ID=your-launchdarkly-client-id
```

---

## 🔑 API Keys Setup Guide

### 1. OpenAI API

**Purpose**: AI motivation message generation

**Setup Steps**:

1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create account or sign in
3. Navigate to API Keys section
4. Click "Create new secret key"
5. Copy the key and add to backend `.env` as `OPENAI_API_KEY`
6. Set up billing (pay-per-use model)

**Cost**: ~$0.002 per 1K tokens (very affordable for motivation messages)

### 2. Apple Sign In (iOS)

**Purpose**: OAuth authentication for iOS users

**Setup Steps**:

1. **Apple Developer Account** ($99/year)
   - Enroll at [Apple Developer](https://developer.apple.com/programs/)
   - Complete verification process

2. **Create App ID**
   - Go to Certificates, Identifiers & Profiles
   - Create new App ID: `com.fitnudge.app`
   - Enable "Sign In with Apple" capability

3. **Create Service ID**
   - Create Service ID for web authentication
   - Configure return URLs: `https://yourdomain.com/auth/apple/callback`

4. **Generate Private Key**
   - Go to Keys section
   - Create new key with "Sign In with Apple" enabled
   - Download `.p8` file (keep secure!)
   - Note down Key ID and Team ID

5. **Configure Backend**
   ```bash
   APPLE_CLIENT_ID=com.fitnudge.app
   APPLE_TEAM_ID=ABC123DEF4
   APPLE_KEY_ID=XYZ789
   APPLE_PRIVATE_KEY_PATH=./certs/AuthKey_XYZ789.p8
   ```

### 3. Google Sign In (iOS + Android)

**Purpose**: OAuth authentication for both iOS and Android users

**Setup Steps**:

1. **Google Cloud Console**
   - Visit [Google Cloud Console](https://console.cloud.google.com/)
   - Create new project: "FitNudge"
   - Enable Google Sign-In API

2. **Create OAuth 2.0 Client IDs**
   - Go to Credentials → Create Credentials → OAuth 2.0 Client ID
   - Create separate clients for:
     - **iOS**: Application type "iOS", Bundle ID `com.fitnudge.app`
     - **Android**: Application type "Android", Package name `com.fitnudge.app`, SHA-1 fingerprint

3. **Download Config Files**
   - **Android**: Download `google-services.json`
     - Place in `apps/mobile/android/app/`
     - Add SHA-1 fingerprint from keystore
   - **iOS**: Download `GoogleService-Info.plist`
     - Add to Xcode project
     - Configure URL schemes

4. **Configure Backend**

   ```bash
   # Mobile apps don't need client secrets - they use config files
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=123456789-hijklmn.apps.googleusercontent.com
   ```

5. **Configure Mobile**
   ```bash
   # Mobile environment variables
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=123456789-hijklmn.apps.googleusercontent.com
   ```

**Note**: Mobile Google Sign In uses the config files (`google-services.json` and `GoogleService-Info.plist`) for authentication. No client secret is needed for mobile apps.

### 4. Cloudflare R2

**Purpose**: Media storage and optimization

**Setup Steps**:

1. Sign up at [Cloudflare](https://cloudflare.com) and enable R2
2. Go to R2 Object Storage → Create Bucket
3. Create API Token with R2 permissions
4. Copy Account ID, Access Key ID, Secret Access Key
5. Configure bucket settings:
   - **Public Access**: Enable for media files
   - **CORS**: Configure for web uploads
   - **Blog Images**: Responsive, WebP format

**Configuration**:

```bash
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_ACCESS_KEY_ID=your-access-key
CLOUDFLARE_SECRET_ACCESS_KEY=your-secret-key
CLOUDFLARE_BUCKET_NAME=fitnudge-media
CLOUDFLARE_PUBLIC_URL=https://your-bucket.your-account.r2.cloudflarestorage.com
```

### 5. Firebase/FCM

**Purpose**: Push notifications

**Setup Steps**:

1. **Firebase Console**
   - Create project at [Firebase Console](https://console.firebase.google.com/)
   - Add iOS app: Bundle ID `com.fitnudge.app`
   - Add Android app: Package name `com.fitnudge.app`

2. **Download Config Files**
   - iOS: `GoogleService-Info.plist`
   - Android: `google-services.json`

3. **Generate Server Key**
   - Go to Project Settings → Cloud Messaging
   - Generate server key
   - Add to backend `.env` as `FCM_SERVER_KEY`

4. **Configure Mobile**
   - Install Firebase SDK
   - Initialize with config files
   - Request notification permissions

### 6. Supabase

**Purpose**: Database, authentication, realtime

**Setup Steps**:

1. **Create Project**
   - Sign up at [Supabase](https://supabase.com)
   - Create new project: "FitNudge"
   - Choose region closest to users

2. **Get API Keys**
   - Go to Settings → API
   - Copy Project URL and anon key
   - Generate service role key for backend

3. **Configure Database**
   - Run migrations from `packages/db/migrations/`
   - Set up Row Level Security (RLS)
   - Enable Realtime for social features

4. **Configure Authentication**
   - Enable email/password auth
   - Configure OAuth providers (Apple, Google)
   - Set up email templates

### 7. Apple Developer Account (for IAP)

**Purpose**: In-App Purchases for iOS

**Setup Steps**:

1. **Enroll in Apple Developer Program** ($99/year)
2. **App Store Connect**
   - Create app: "FitNudge"
   - Configure In-App Purchases
   - Set up product IDs:
     - `com.fitnudge.pro.monthly` ($9.99/month)
     - `com.fitnudge.pro.yearly` ($99.99/year)
     - `com.fitnudge.coach.monthly` ($19.99/month)

3. **App Store Server Notifications**
   - Set up webhook endpoint
   - Configure server-to-server notifications
   - Test with sandbox environment

### 8. Google Play Console (for IAP)

**Purpose**: In-App Purchases for Android

**Setup Steps**:

1. **Create Developer Account** ($25 one-time)
2. **Create App**
   - Upload app bundle
   - Configure store listing
   - Set up In-App Products:
     - `pro_monthly` ($9.99/month)
     - `pro_yearly` ($99.99/year)
     - `coach_monthly` ($19.99/month)

3. **Real-time Developer Notifications**
   - Set up Cloud Pub/Sub topic
   - Configure webhook endpoint
   - Test with license testing accounts

### 9. Namecheap Private Email

**Purpose**: Transactional emails via SMTP

**Setup Steps**:

1. **Create Namecheap Account**
   - Sign up at [Namecheap](https://namecheap.com)
   - Purchase domain (e.g., fitnudge.app)

2. **Set Up Private Email**
   - Go to Domain List → Manage → Private Email
   - Create email account: `noreply@fitnudge.app`
   - Set up email password

3. **Configure SMTP Settings**
   - **SMTP Host**: `mail.privateemail.com`
   - **SMTP Port**: `587` (TLS) or `465` (SSL)
   - **Username**: `noreply@fitnudge.app`
   - **Password**: Your email password

4. **Configure Backend**
   ```bash
   SMTP_HOST=mail.privateemail.com
   SMTP_PORT=587
   SMTP_USERNAME=noreply@fitnudge.app
   SMTP_PASSWORD=your-email-password
   FROM_EMAIL=noreply@fitnudge.app
   ```

**Benefits**:

- **Cost Effective**: Included with domain purchase
- **Reliable**: Professional email service
- **Simple Setup**: Standard SMTP configuration
- **No API Limits**: Direct SMTP sending

### 10. Redis

**Purpose**: Caching and session storage

**Setup Options**:

1. **Local Development**: `docker run -p 6379:6379 redis:alpine`
2. **Production**: Redis Cloud or AWS ElastiCache
3. **Configuration**:
   ```bash
   REDIS_URL=redis://localhost:6379
   ```

### 11. Monitoring & Analytics

**Purpose**: Error tracking, performance monitoring, business metrics

**Setup Steps**:

1. **Sentry** (Error Tracking)
   - Create project at [Sentry](https://sentry.io)
   - Get DSN and add to backend `.env`

2. **New Relic** (APM)
   - Sign up at [New Relic](https://newrelic.com)
   - Install agent and get license key

3. **PostHog** (Analytics)
   - Create account at [PostHog](https://posthog.com)
   - Create a new project
   - Get project API key from Project Settings
   - Set `POSTHOG_API_KEY` in your environment variables

4. **LaunchDarkly** (Feature Flags)
   - Sign up at [LaunchDarkly](https://launchdarkly.com)
   - Create project and get SDK key

---

## 🛠️ Development Setup Steps

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/fitnudge.git
cd fitnudge
```

### 2. Install Dependencies

```bash
# Install pnpm if not already installed
npm install -g pnpm

# Install all dependencies
pnpm install
```

### 3. Environment Configuration

```bash
# Copy environment files
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
cp apps/web/.env.local.example apps/web/.env.local

# Edit environment files with your API keys
```

### 4. Database Setup

```bash
# Start Supabase locally (optional for development)
npx supabase start

# Or use remote Supabase instance
npx supabase db push --linked
```

### 5. Start Development Servers

**Backend (FastAPI)**:

```bash
cd apps/api
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Mobile (Expo)**:

```bash
cd apps/mobile
npx expo start
```

**Web (Next.js)**:

```bash
cd apps/web
pnpm dev
```

### 6. Verify Setup

- **Backend**: http://localhost:8000/docs (Swagger UI)
- **Mobile**: Scan QR code with Expo Go app
- **Web**: http://localhost:3000

---

## 🧪 Testing Credentials

### Test Users

```bash
# Email/Password User
Email: test@fitnudge.app
Password: Test123!

# OAuth Test Users
Apple: Use sandbox Apple ID
Google: Use test account in Google Cloud Console
```

### Test IAP Products

```bash
# iOS Sandbox
Apple ID: Use sandbox Apple ID
Products: Test with sandbox environment

# Android Testing
License Testing: Add test accounts in Play Console
Products: Test with license testing accounts
```

---

## 🚀 Deployment Configuration

### Backend (Railway/Render)

```bash
# Environment Variables
- Set all environment variables in deployment platform
- Configure health check endpoint: /health
- Set up auto-deploy from main branch
- Configure custom domain
```

### Mobile (EAS Build)

```bash
# Configure app.json
{
  "expo": {
    "name": "FitNudge",
    "slug": "fitnudge",
    "version": "1.0.0",
    "platforms": ["ios", "android"],
    "ios": {
      "bundleIdentifier": "com.fitnudge.app"
    },
    "android": {
      "package": "com.fitnudge.app"
    }
  }
}

# EAS Configuration
eas build:configure
eas build --platform all
```

### Web (Vercel)

```bash
# Connect GitHub repository
# Set environment variables
# Configure custom domain
# Enable automatic deployments
```

---

## 🔧 Troubleshooting

### Common Issues

**1. Supabase Connection Issues**

```bash
# Check if Supabase is running
npx supabase status

# Restart Supabase
npx supabase stop
npx supabase start
```

**2. Mobile Build Issues**

```bash
# Clear Expo cache
npx expo start --clear

# Reset Metro bundler
npx expo start --reset-cache
```

**3. OAuth Issues**

- Verify client IDs and secrets
- Check redirect URIs
- Ensure certificates are valid
- Test with sandbox/test accounts

**4. Database Migration Issues**

```bash
# Reset database
npx supabase db reset

# Run specific migration
npx supabase db push --linked
```

### Getting Help

- Check logs in terminal
- Verify environment variables
- Test API endpoints with Postman/Insomnia
- Check Supabase dashboard for database issues
- Review Expo logs for mobile issues

---

## 📚 Additional Resources

### Documentation

- [Supabase Docs](https://supabase.com/docs)
- [Expo Docs](https://docs.expo.dev/)
- [Next.js Docs](https://nextjs.org/docs)
- [FastAPI Docs](https://fastapi.tiangolo.com/)

### Community

- [Supabase Discord](https://discord.supabase.com/)
- [Expo Discord](https://chat.expo.dev/)
- [React Native Community](https://reactnative.dev/community/overview)

### Tools

- [Postman](https://www.postman.com/) - API testing
- [Insomnia](https://insomnia.rest/) - API testing
- [TablePlus](https://tableplus.com/) - Database management
- [Expo Dev Tools](https://docs.expo.dev/workflow/development-tools/)
