# Subscription System Implementation

This document outlines the subscription system implementation for FitNudge using **RevenueCat** for iOS and Android.

## Overview

The subscription system includes:

1. **RevenueCat Integration** - Handles all IAP operations, receipt validation, and subscription management
2. **Upgrade UI Components** - Banner, prompt modal, exit intent discount
3. **Feature Gating** - Check user's subscription tier before allowing access
4. **Promotional Offers** - 50% off exit intent offer for Pro Annual (iOS)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     RevenueCatProvider                       │
│  (wraps entire app, initializes on startup)                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │ useRevenueCat() │───▶│ RevenueCat SDK               │   │
│  │ (hook)          │    │ (react-native-purchases)     │   │
│  └─────────────────┘    └──────────────────────────────┘   │
│           │                         │                        │
│           ▼                         ▼                        │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │ Components      │    │ App Store / Play Store       │   │
│  │ - ExitIntent    │    │ (handles actual payments)    │   │
│  │ - UpgradeBanner │    └──────────────────────────────┘   │
│  │ - UpgradePrompt │                                        │
│  └─────────────────┘                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Files

### Context Provider

- `src/contexts/RevenueCatContext.tsx` - **Main IAP logic** - handles initialization, purchases, promotional offers

### Types

- `src/services/iap/types.ts` - Type definitions for IAP
- `src/services/iap/index.ts` - Type exports

### UI Components

- `src/components/subscription/UpgradeBanner.tsx` - Dismissible banner for free users
- `src/components/subscription/UpgradePrompt.tsx` - Modal for feature gates and goal limits
- `src/components/subscription/ExitIntentModal.tsx` - 50% discount popup (Pro only)
- `src/components/subscription/FloatingOfferButton.tsx` - Floating button for active exit offer
- `src/components/subscription/index.ts` - Component exports

### Stores

- `src/stores/subscriptionStore.ts` - Local subscription state and feature gating
- `src/stores/exitOfferStore.ts` - Exit offer countdown state

## Product IDs

Same product IDs for both iOS and Android:

| Plan    | Monthly                        | Annual                        |
| ------- | ------------------------------ | ----------------------------- |
| Starter | `com.fitnudge.starter.monthly` | `com.fitnudge.starter.annual` |
| Pro     | `com.fitnudge.pro.monthly`     | `com.fitnudge.pro.annual`     |
| Elite   | `com.fitnudge.elite.monthly`   | `com.fitnudge.elite.annual`   |

## RevenueCat Entitlements

| Entitlement ID   | Tier    |
| ---------------- | ------- |
| `starter_access` | Starter |
| `pro_access`     | Pro     |
| `elite_access`   | Elite   |

## Exit Offer (Pro Only)

The exit offer provides 50% off Pro Annual when users try to close the subscription screen:

| Platform | Product ID                | Exit Offer Method                |
| -------- | ------------------------- | -------------------------------- |
| iOS      | `com.fitnudge.pro.annual` | Promotional Offer: `pro_exit_50` |
| Android  | `com.fitnudge.pro.annual` | Discounted Base Plan             |

**Exit Offer Logic:**

- Shows every 7 days for users who have NEVER subscribed
- Maximum 5 times total (~5 weeks of opportunities)
- 15-minute countdown timer when shown
- Never shows again after user subscribes (even if they later cancel)

## Setup Instructions

### 1. Install RevenueCat SDK

```bash
cd apps/mobile
pnpm add react-native-purchases
cd ios && pod install
```

### 2. Configure Environment Variables

```bash
# .env
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=appl_xxxxxxxxxx
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=goog_xxxxxxxxxx
```

### 3. RevenueCat Dashboard Setup

1. Create project in RevenueCat
2. Add iOS and Android apps
3. Create entitlements: `starter_access`, `pro_access`, `elite_access`
4. Import products from stores
5. Create offerings with packages
6. Upload `.p8` key for iOS promotional offers

### 4. App Store Connect (iOS)

1. Create subscription products with product IDs
2. Create subscription group
3. Create promotional offer `pro_exit_50` for Pro Annual

### 5. Google Play Console (Android)

1. Create subscription products with product IDs
2. Create base plans
3. Create discounted base plan for exit offer

## Usage

### Using the RevenueCat Hook

```tsx
import { useRevenueCat } from "@/contexts/RevenueCatContext";

function MyComponent() {
  const {
    isReady,
    subscriptionStatus,
    purchaseState,
    error,

    // Actions
    purchase,
    purchaseProExitOffer,
    restorePurchases,

    // Getters
    getCurrentTier,
    hasActiveSubscription,
  } = useRevenueCat();

  // Purchase annual subscription
  const handlePurchase = async () => {
    const success = await purchase("annual");
    if (success) {
      // Purchase completed!
    }
  };

  // Purchase with exit offer (50% off)
  const handleExitOffer = async () => {
    const success = await purchaseProExitOffer();
    if (success) {
      // User got the discount!
    }
  };
}
```

### Check if User Can Create Goals

```tsx
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useActiveGoals } from "@/hooks/api/useGoals";

const { canCreateGoal, getPlan } = useSubscriptionStore();
const { data: activeGoalsResponse } = useActiveGoals();
const activeGoalCount = activeGoalsResponse?.data?.length || 0;

if (!canCreateGoal(activeGoalCount)) {
  // Show upgrade prompt
}
```

### Show Upgrade Banner

```tsx
import { UpgradeBanner } from "@/components/subscription";

<UpgradeBanner onUpgrade={() => setShowSubscriptionScreen(true)} />;
```

### Show Upgrade Prompt Modal

```tsx
import { UpgradePrompt } from "@/components/subscription";

<UpgradePrompt
  visible={showPrompt}
  onClose={() => setShowPrompt(false)}
  onUpgrade={() => navigation.navigate("Subscription")}
  type="goal_limit" // or "feature_locked" or "generic"
  featureName="Challenges" // for feature_locked type
/>;
```

## Feature Gating

The subscription store provides methods for feature gating:

- `hasFeature(featureKey)` - Check if user has access to a feature
- `canCreateGoal(currentCount)` - Check if user can create more goals
- `getPlan()` - Get current plan name ('free', 'starter', 'pro', 'elite')
- `getTier()` - Get tier number (0, 1, 2, 3)

## Analytics Events

RevenueCat and the subscription screens track:

**Purchase Events:**

- `iap_purchase_started` - User initiated purchase
- `iap_purchase_success` - Purchase successful
- `iap_purchase_cancelled` - User cancelled
- `iap_purchase_error` - Purchase failed

**Exit Offer Events:**

- `iap_exit_offer_purchase_started` - Exit offer purchase started
- `subscription_exit_intent_shown` - Exit modal displayed
- `subscription_exit_intent_accepted` - User accepted offer
- `subscription_exit_intent_declined` - User declined offer

**Restore Events:**

- `iap_restore_started` - Restore initiated
- `iap_restore_success` - Purchases restored
- `iap_restore_failed` - Restore failed

## Testing

### Sandbox Testing

1. Create sandbox tester in App Store Connect / Play Console
2. Use test accounts on device
3. Enable debug logging: `Purchases.setLogLevel(LOG_LEVEL.DEBUG)`

### Testing Exit Offer

To reset exit offer state for testing:

```tsx
import { storageUtil } from "@/utils/storageUtil";

// Clear exit offer history
await storageUtil.multiRemove([
  "EXIT_OFFER_LAST_SHOWN",
  "EXIT_OFFER_SHOW_COUNT",
]);
```

## Pricing

| Tier    | Monthly | Annual  | Exit Offer (Annual)  |
| ------- | ------- | ------- | -------------------- |
| Starter | $6.99   | $54.99  | -                    |
| Pro     | $12.99  | $99.99  | **$49.99** (50% off) |
| Elite   | $19.99  | $159.99 | -                    |

See `apps/docs/Marketing.md` for detailed pricing strategy and setup guides.

## Backend Webhook Integration

### Why Webhooks?

The mobile app cannot be trusted as the single source of truth for subscription status because:

- Users can cancel/change subscriptions outside the app (App Store/Play Store settings)
- Subscriptions can auto-renew while the app is closed
- Payment failures happen server-side

**RevenueCat Webhooks** notify your backend of all subscription events in real-time.

### Webhook Endpoint

**URL:** `POST /api/v1/webhooks/revenuecat`

**File:** `apps/api/app/api/v1/endpoints/webhooks.py`

### Handled Events

| Event              | What Happens                                  |
| ------------------ | --------------------------------------------- |
| `INITIAL_PURCHASE` | Create/update subscription, set user plan     |
| `RENEWAL`          | Update subscription, extend expiry            |
| `CANCELLATION`     | Mark as cancelled (still active until expiry) |
| `EXPIRATION`       | Expire subscription, downgrade to free        |
| `BILLING_ISSUE`    | Mark billing issue, store grace period expiry |
| `PRODUCT_CHANGE`   | Update plan (upgrade/downgrade)               |
| `UNCANCELLATION`   | Re-enable auto-renew                          |
| `TRANSFER`         | Transfer subscription to different user       |

### Setup in RevenueCat Dashboard

1. Go to **Project Settings → Integrations → Webhooks**
2. Click **+ New Webhook**
3. Enter your webhook URL:
   ```
   https://your-api-domain.com/api/v1/webhooks/revenuecat
   ```
4. Set **Authorization header value** (this is RevenueCat's security method):
   ```
   Bearer your-secure-random-token
   ```
5. Enable these event types:
   - `INITIAL_PURCHASE`
   - `RENEWAL`
   - `CANCELLATION`
   - `EXPIRATION`
   - `BILLING_ISSUE`
   - `PRODUCT_CHANGE`
   - `UNCANCELLATION`
   - `TRANSFER`

### Environment Variables

Add to your backend environment:

```bash
# RevenueCat Webhook Secret - must match the Authorization header value in RevenueCat Dashboard
# Example: "Bearer super_long_random_string_here"
REVENUECAT_WEBHOOK_SECRET=Bearer your-secure-random-token
```

> **Note:** RevenueCat uses the Authorization header for webhook security (not signature verification). Set the same value in both RevenueCat Dashboard and your environment variable.

### Testing Webhooks

1. **Health Check:**

   ```bash
   curl https://your-api.com/api/v1/webhooks/revenuecat/health
   ```

2. **RevenueCat Dashboard:**
   - Go to Webhooks → Send Test Event
   - Check your server logs for the event

3. **Sandbox Mode:**
   - Events from sandbox purchases will have `environment: "SANDBOX"`
   - You can filter these in production if needed

### Database Updates

The webhook handler updates two tables:

1. **`subscriptions`** - Stores subscription details
   - `user_id`, `plan`, `status`, `platform`, `product_id`, `expires_date`, `auto_renew`
   - `grace_period_ends_at` - End date of grace period during billing issues
   - `revenuecat_event_id` - Last processed RevenueCat event ID
   - `environment` - SANDBOX or PRODUCTION

2. **`users`** - Updates user's current plan
   - `plan` field is updated to reflect current subscription tier

### Grace Period Support

When a `BILLING_ISSUE` event is received:

- The `grace_period_ends_at` timestamp is stored (if provided by RevenueCat)
- User retains full access until this date
- Apple: Up to 16 days automatic retry
- Google: 3-30 days (configurable in Play Console)

For server-side access checks during billing issues:

```python
# Check if user is still in grace period
if subscription.status == "billing_issue":
    if subscription.grace_period_ends_at and subscription.grace_period_ends_at > now():
        # User still has access
        return True
    else:
        # Grace period expired
        return False
```

Note: RevenueCat SDK handles grace period automatically on the client side.

### Flow Diagram

```
User subscribes in app
        │
        ▼
RevenueCat processes purchase
        │
        ├──► RevenueCat sends webhook to backend
        │           │
        │           ▼
        │    Backend receives POST /api/v1/webhooks/revenuecat
        │           │
        │           ▼
        │    Update subscriptions table
        │           │
        │           ▼
        │    Update users.plan
        │
        └──► App calls refreshSubscription()
                    │
                    ▼
             Fetch updated data from backend ✅
```
