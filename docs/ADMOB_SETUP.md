# AdMob Setup Guide for FitNudge

This guide walks you through setting up Google AdMob for both iOS and Android in the FitNudge app.

## Table of Contents

1. [Create AdMob Account](#1-create-admob-account)
2. [Register Your Apps](#2-register-your-apps)
3. [Get App IDs](#3-get-app-ids)
4. [Create Ad Units](#4-create-ad-units)
5. [Configure app.json](#5-configure-appjson)
6. [Testing Ads](#6-testing-ads)
7. [Ad Placement Strategy](#7-ad-placement-strategy)
8. [Implementation Guide](#8-implementation-guide)

---

## 1. Create AdMob Account

1. Go to [Google AdMob](https://admob.google.com/)
2. Sign in with your Google account
3. Accept the Terms of Service
4. Complete account setup with payment information

---

## 2. Register Your Apps

### Register iOS App

1. In AdMob dashboard, click **Apps** in the sidebar
2. Click **Add App**
3. Select **iOS**
4. If your app is published:
   - Search for "FitNudge" in the App Store
   - Select it
5. If NOT published yet:
   - Click **No** when asked "Is this app listed on a supported app store?"
   - Enter app name: `FitNudge`
   - Click **Add App**
6. **Save the App ID** shown (format: `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`)

### Register Android App

1. Click **Add App** again
2. Select **Android**
3. If your app is published:
   - Search for "FitNudge" on Google Play
   - Select it
4. If NOT published yet:
   - Click **No**
   - Enter app name: `FitNudge`
   - Package name: `com.fitnudge.app`
   - Click **Add App**
5. **Save the App ID** shown

---

## 3. Get App IDs

After registering both apps, you'll have:

| Platform | App ID Format                            |
| -------- | ---------------------------------------- |
| iOS      | `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY` |
| Android  | `ca-app-pub-XXXXXXXXXXXXXXXX~ZZZZZZZZZZ` |

> **Note**: The publisher ID (first part) is the same, but the app-specific ID (after `~`) is different for each platform.

### Where to Find App IDs Later

1. Go to **Apps** in AdMob sidebar
2. Click on your app
3. Click **App settings**
4. Copy the **App ID**

---

## 4. Create Ad Units

For each platform, create the following ad units:

### 4.1 Banner Ad Unit (Home Screen)

1. In AdMob, go to **Apps** → Select your app
2. Click **Ad units** → **Add ad unit**
3. Select **Banner**
4. Configure:
   - **Ad unit name**: `home_banner`
   - **Advanced settings**: Default is fine
5. Click **Create ad unit**
6. **Save the Ad Unit ID** (format: `ca-app-pub-XXXXXXXXXXXXXXXX/AAAAAAAAAA`)

### 4.2 Banner Ad Unit (Goal Detail)

1. Click **Add ad unit** → **Banner**
2. Configure:
   - **Ad unit name**: `goal_detail_banner`
3. Click **Create ad unit**
4. **Save the Ad Unit ID**

### 4.3 Banner Ad Unit (Progress Screen)

1. Click **Add ad unit** → **Banner**
2. Configure:
   - **Ad unit name**: `progress_banner`
3. Click **Create ad unit**
4. **Save the Ad Unit ID**

### 4.4 Native Advanced Ad Unit (Blog Feed)

1. Click **Add ad unit** → **Native advanced**
2. Configure:
   - **Ad unit name**: `blog_native`
3. Click **Create ad unit**
4. **Save the Ad Unit ID**

### 4.5 Rewarded Ad Unit (AI Coach Message - Free Users Only)

1. Click **Add ad unit** → **Rewarded**
2. Configure:
   - **Ad unit name**: `reward_ai_message`
   - **Reward settings** (you'll be prompted for these):
     - **Reward amount**: `1`
     - **Reward item**: `ai_message`
3. Click **Create ad unit**
4. **Save the Ad Unit ID**

> **Note**: This rewarded ad is only shown to FREE users who have hit their AI coach rate limit. Watching an ad unlocks 1 additional message (max 10 bonus/day). Premium users have unlimited AI coach access.

### Summary - Create These for EACH Platform (iOS & Android)

| Ad Unit Name         | Type            | Use Case                              | Reward Settings             |
| -------------------- | --------------- | ------------------------------------- | --------------------------- |
| `home_banner`        | Banner          | HomeScreen after main cards           | N/A                         |
| `goal_detail_banner` | Banner          | GoalDetailScreen bottom               | N/A                         |
| `progress_banner`    | Banner          | ProgressScreen bottom                 | N/A                         |
| `blog_native`        | Native advanced | BlogScreen between posts              | N/A                         |
| `reward_ai_message`  | Rewarded        | Free users: watch ad for 1 AI message | Amount: 1, Item: ai_message |

### Mapping AdMob Ad Units to Code (`AD_UNITS` keys)

After creating ad units in AdMob, update `src/constants/adUnits.ts` with your IDs:

| AdMob Ad Unit Name   | Code Key (`AD_UNITS`) | Where to Paste ID                               |
| -------------------- | --------------------- | ----------------------------------------------- |
| `home_banner`        | `HOME_BANNER`         | `AD_UNITS.ios.HOME_BANNER` / `.android.`        |
| `goal_detail_banner` | `GOAL_DETAIL_BANNER`  | `AD_UNITS.ios.GOAL_DETAIL_BANNER` / `.android.` |
| `progress_banner`    | `PROGRESS_BANNER`     | `AD_UNITS.ios.PROGRESS_BANNER` / `.android.`    |
| `blog_native`        | `BLOG_NATIVE`         | `AD_UNITS.ios.BLOG_NATIVE` / `.android.`        |
| `reward_ai_message`  | `AI_MESSAGE`          | `AD_UNITS.ios.AI_MESSAGE` / `.android.`         |

**Example after filling in your IDs:**

```typescript
// src/constants/adUnits.ts
const AD_UNITS = {
  ios: {
    HOME_BANNER: "ca-app-pub-1234567890123456/1111111111",
    GOAL_DETAIL_BANNER: "ca-app-pub-1234567890123456/2222222222",
    PROGRESS_BANNER: "ca-app-pub-1234567890123456/3333333333",
    BLOG_NATIVE: "ca-app-pub-1234567890123456/4444444444",
    AI_MESSAGE: "ca-app-pub-1234567890123456/5555555555",
  },
  android: {
    HOME_BANNER: "ca-app-pub-1234567890123456/6666666666",
    GOAL_DETAIL_BANNER: "ca-app-pub-1234567890123456/7777777777",
    PROGRESS_BANNER: "ca-app-pub-1234567890123456/8888888888",
    BLOG_NATIVE: "ca-app-pub-1234567890123456/9999999999",
    AI_MESSAGE: "ca-app-pub-1234567890123456/0000000000",
  },
} as const;
```

> **Important**: iOS and Android have DIFFERENT ad unit IDs even for the same ad placement. Create separate ad units for each platform in AdMob.

---

## 5. Configure app.json

Update `apps/mobile/app.json` with your App IDs:

```json
[
  "react-native-google-mobile-ads",
  {
    "androidAppId": "ca-app-pub-XXXXXXXXXXXXXXXX~ANDROIDAPPID",
    "iosAppId": "ca-app-pub-XXXXXXXXXXXXXXXX~IOSAPPID",
    "userTrackingUsageDescription": "This identifier will be used to deliver personalized ads to you."
  }
]
```

---

## 6. Testing Ads

### Use Test IDs During Development

**NEVER use production ad unit IDs during development** - this violates AdMob policy and can get you banned.

```typescript
import { TestIds } from "react-native-google-mobile-ads";

// Always use test IDs in development
const adUnitId = __DEV__ ? TestIds.BANNER : "ca-app-pub-xxx/yyy"; // Production ID
```

### Available Test IDs

| Ad Type               | Test ID Constant                |
| --------------------- | ------------------------------- |
| Banner                | `TestIds.BANNER`                |
| Interstitial          | `TestIds.INTERSTITIAL`          |
| Rewarded              | `TestIds.REWARDED`              |
| Native                | `TestIds.NATIVE`                |
| Rewarded Interstitial | `TestIds.REWARDED_INTERSTITIAL` |
| App Open              | `TestIds.APP_OPEN`              |

### Enable Test Device (for Production IDs in Debug)

If you need to test with production ad unit IDs:

```typescript
import mobileAds from "react-native-google-mobile-ads";

// Add your test device ID
mobileAds().setRequestConfiguration({
  testDeviceIdentifiers: ["EMULATOR", "YOUR_DEVICE_ID"],
});
```

To get your device ID:

1. Run your app with a production ad unit
2. Check the logs for: "To get test ads on this device, set..."
3. Copy the device ID shown

---

## 7. Ad Placement Strategy

### FitNudge Ad Placement Map

```
┌─────────────────────────────────────────┐
│  HomeScreen                             │
│  ├── Greeting + Daily Motivation        │
│  ├── GoalsCard (active goals)           │
│  ├── PartnersCard                       │
│  ├── [BANNER AD] ← Free users only      │
│  │    └── Subtle "Go Premium" CTA       │
│  └── Recent Check-ins                   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  GoalDetailScreen                       │
│  ├── Goal Header & Progress             │
│  ├── Current Streak                     │
│  ├── Weekly Calendar View               │
│  ├── Check-in History                   │
│  └── [BANNER AD] ← Bottom, free users   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  ProgressScreen                         │
│  ├── Stats Overview                     │
│  ├── Consistency Chart                  │
│  ├── Achievement Preview                │
│  └── [BANNER AD] ← Bottom, free users   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  BlogScreen                             │
│  ├── Featured Post                      │
│  ├── Post 1                             │
│  ├── Post 2                             │
│  ├── [NATIVE AD] ← Blends with content  │
│  ├── Post 3                             │
│  └── ...                                │
└─────────────────────────────────────────┘
```

### Revenue Optimization Tips

1. **Anchored Adaptive Banners**: Best for fixed positions - adjusts to screen width
2. **Native Ads**: Best UX for feeds - blends with content (BlogScreen)
3. **Rewarded Ads**: Highest CPM - offer value exchange (e.g., 24hr premium trial)
4. **Don't overdo it**: Max 1 banner per screen, native ads every 4-5 items
5. **Respect user flow**: Never interrupt check-ins or goal creation

---

## 8. Implementation Guide

### 8.1 Initialize AdMob SDK with ATT (Required)

The AdMob SDK **must be initialized** before using any ad components. On iOS, you must also request App Tracking Transparency (ATT) permission before initializing ads.

**First, install the ATT package:**

```bash
npx expo install expo-tracking-transparency
```

**Add to `app.json` plugins:**

```json
[
  "expo-tracking-transparency",
  {
    "userTrackingPermission": "This allows FitNudge to provide personalized ads. You can change this anytime in Settings."
  }
]
```

**Then add this to your root layout (`app/_layout.tsx`):**

```typescript
import mobileAds from "react-native-google-mobile-ads";
import { Platform } from "react-native";

// In your RootLayout component:
useEffect(() => {
  const initializeAds = async () => {
    try {
      // Request App Tracking Transparency on iOS before initializing ads
      if (Platform.OS === "ios") {
        const { getTrackingPermissionsAsync, requestTrackingPermissionsAsync } =
          await import("expo-tracking-transparency");

        const { status } = await getTrackingPermissionsAsync();
        if (status === "undetermined") {
          await requestTrackingPermissionsAsync();
        }
      }

      // Initialize AdMob after ATT (or immediately on Android)
      const adapterStatuses = await mobileAds().initialize();
      console.log("[RootLayout] AdMob initialized:", adapterStatuses);
    } catch (error) {
      console.warn("[RootLayout] AdMob initialization failed:", error);
    }
  };

  initializeAds();
}, []);
```

> **Important**:
>
> - If you skip SDK initialization, you'll get `View config getter callback for component RNGoogleMobileAdsBannerView must be a function` error.
> - ATT is required for iOS 14.5+ to show personalized ads and maximize revenue.

### 8.2 Create the Ad Utility Hook

Create `apps/mobile/src/hooks/useShowAds.ts`:

```typescript
import { useSubscriptionStore } from "@/stores/subscriptionStore";

/**
 * Hook to determine if ads should be shown to the current user.
 *
 * Ads are shown only to FREE tier users.
 * Premium users never see ads.
 */
export function useShowAds(): boolean {
  const getPlan = useSubscriptionStore((state) => state.getPlan);
  const plan = getPlan();

  // Show ads only to free users
  return plan === "free";
}

/**
 * Non-hook version for use outside React components.
 * Use this in callbacks or utility functions.
 */
export function shouldShowAds(): boolean {
  const plan = useSubscriptionStore.getState().getPlan();
  return plan === "free";
}
```

### 8.3 Create Ad Unit Constants

Create `apps/mobile/src/constants/adUnits.ts`:

```typescript
import { TestIds } from "react-native-google-mobile-ads";
import { Platform } from "react-native";

const AD_UNITS = {
  ios: {
    HOME_BANNER: "ca-app-pub-xxx/ios-home-banner",
    GOAL_DETAIL_BANNER: "ca-app-pub-xxx/ios-goal-detail",
    PROGRESS_BANNER: "ca-app-pub-xxx/ios-progress",
    BLOG_NATIVE: "ca-app-pub-xxx/ios-blog-native",
    AI_MESSAGE: "ca-app-pub-xxx/ios-ai-message",
  },
  android: {
    HOME_BANNER: "ca-app-pub-xxx/android-home-banner",
    GOAL_DETAIL_BANNER: "ca-app-pub-xxx/android-goal-detail",
    PROGRESS_BANNER: "ca-app-pub-xxx/android-progress",
    BLOG_NATIVE: "ca-app-pub-xxx/android-blog-native",
    AI_MESSAGE: "ca-app-pub-xxx/android-ai-message",
  },
};

type AdUnitKey = keyof typeof AD_UNITS.ios;

export const getAdUnitId = (key: AdUnitKey): string => {
  if (__DEV__) {
    // Return test IDs in development
    switch (key) {
      case "AI_MESSAGE":
        return TestIds.REWARDED;
      case "BLOG_NATIVE":
        return TestIds.NATIVE;
      default:
        return TestIds.BANNER;
    }
  }

  const platform = Platform.OS === "ios" ? "ios" : "android";
  return AD_UNITS[platform][key];
};
```

### 8.4 Create Reusable Ad Banner Component

Create `apps/mobile/src/components/ads/AdBanner.tsx`:

```typescript
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { useShowAds } from "@/hooks/useShowAds";
import { getAdUnitId } from "@/constants/adUnits";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useTheme } from "@/themes";
import { Ionicons } from "@expo/vector-icons";

interface AdBannerProps {
  unitId: "HOME_BANNER" | "GOAL_DETAIL_BANNER" | "PROGRESS_BANNER";
  size?: BannerAdSize;
  showUpgradeCTA?: boolean;
}

export function AdBanner({
  unitId,
  size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER,
  showUpgradeCTA = true
}: AdBannerProps) {
  const showAds = useShowAds();
  const openModal = useSubscriptionStore((state) => state.openModal);
  const { colors, brandColors } = useTheme();

  // Don't render anything for premium users
  if (!showAds) {
    return null;
  }

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={getAdUnitId(unitId)}
        size={size}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdFailedToLoad={(error) => {
          console.log("Ad failed to load:", error);
        }}
      />

      {showUpgradeCTA && (
        <TouchableOpacity
          style={[styles.upgradeCTA, { backgroundColor: `${brandColors.primary}10` }]}
          onPress={openModal}
          activeOpacity={0.7}
        >
          <Ionicons name="sparkles" size={14} color={brandColors.primary} />
          <Text style={[styles.upgradeText, { color: brandColors.primary }]}>
            Go Premium to remove ads
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginVertical: 16,
  },
  upgradeCTA: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
  },
  upgradeText: {
    fontSize: 12,
    fontWeight: "500",
  },
});
```

### 8.5 Example: Adding Ad to HomeScreen

```typescript
// In HomeScreen.tsx
import { AdBanner } from "@/components/ads/AdBanner";

export default function HomeScreen() {
  return (
    <ScrollView>
      {/* Greeting */}
      <GreetingCard />

      {/* Goals Card */}
      <GoalsCard />

      {/* Partners Card */}
      <PartnersCard />

      {/* Ad Banner - Only shows for free users */}
      <AdBanner unitId="HOME_BANNER" />

      {/* Recent Activity */}
      <RecentActivity />
    </ScrollView>
  );
}
```

### 8.6 Example: Native Ads in BlogScreen

For native ads in the blog feed, insert ad components every N posts:

```typescript
// In BlogScreen.tsx
import { useShowAds } from "@/hooks/useShowAds";

const AD_FREQUENCY = 4; // Show ad every 4 posts

export default function BlogScreen() {
  const showAds = useShowAds();

  const renderPostsWithAds = () => {
    const items = [];

    regularPosts.forEach((post, index) => {
      items.push(renderBlogCard(post, index));

      // Insert native ad every N posts (for free users only)
      if (showAds && (index + 1) % AD_FREQUENCY === 0 && index < regularPosts.length - 1) {
        items.push(
          <NativeAdCard key={`ad-${index}`} unitId="BLOG_NATIVE" />
        );
      }
    });

    return items;
  };

  return (
    <ScrollView>
      {featuredPost && renderFeaturedPost()}
      {renderPostsWithAds()}
    </ScrollView>
  );
}
```

### 8.7 Rewarded Ad: AI Coach Message Unlock (Free Users)

Free users get 3 AI coach messages per day. When they hit the limit, they can watch a rewarded ad to unlock 1 additional message.

**Implementation in AICoachScreen.tsx:**

```typescript
import { useRewardedAd } from "react-native-google-mobile-ads";
import { getAdUnitId } from "@/constants/adUnits";

// Inside component
const isFreeUser = getPlan() === "free";

// Only load ad for free users
const { isLoaded, load, show, isEarnedReward, isClosed } = useRewardedAd(
  isFreeUser ? getAdUnitId("AI_MESSAGE") : null,
  { requestNonPersonalizedAdsOnly: false }
);

// Load ad when component mounts
useEffect(() => {
  if (isFreeUser && !isLoaded) {
    load();
  }
}, [isFreeUser, isLoaded, load]);

// Handle reward earned
useEffect(() => {
  if (isEarnedReward && isClosed) {
    // Call API to unlock additional message
    aiCoachService.unlockMessage(1);
    // Refetch rate limit
    refetchRateLimit();
    // Load next ad
    load();
  }
}, [isEarnedReward, isClosed]);

// Show limit reached modal with watch ad button
const handleWatchAd = () => {
  if (isLoaded) {
    show();
  }
};
```

**Backend API (POST /api/v1/ai-coach/unlock-message):**

```python
@router.post("/unlock-message")
async def unlock_message_with_ad(
    request: UnlockMessageRequest,  # { reward_type: "ai_message", reward_amount: 1 }
    current_user: dict = Depends(get_current_user),
):
    # Adds bonus_messages to user's daily usage record
    # Returns { success, messages_unlocked, remaining_messages, daily_limit }
```

**UX Flow:**

```
Free user sends message #3 → Rate limit reached
                            ↓
           ┌────────────────────────────────┐
           │  Daily Limit Reached           │
           │  You've used all 3 messages    │
           │                                │
           │  [📺 Watch Ad → +1 Message]    │
           │  [💎 Go Premium → Unlimited]   │
           └────────────────────────────────┘
                            ↓
           User watches rewarded ad
                            ↓
           API grants +1 bonus message
                            ↓
           User can continue chatting
```

---

## 9. Checklist Before Going Live

- [ ] Created AdMob account
- [ ] Registered iOS app in AdMob
- [ ] Registered Android app in AdMob
- [ ] Created all required ad units for iOS
- [ ] Created all required ad units for Android
- [ ] Updated `app.json` with App IDs
- [ ] Created `adUnits.ts` constants file
- [ ] Created `useShowAds.ts` hook
- [ ] Created `AdBanner` component
- [ ] Tested with TestIds in development
- [ ] Verified ads load correctly
- [ ] Premium users don't see ads
- [ ] Added "Go Premium" CTA near ads
- [ ] Ads don't interrupt core user flows
- [ ] Rewarded ad works for AI coach message unlock
- [ ] Database has `bonus_messages` column in `ai_coach_daily_usage` table

---

## 10. Troubleshooting

### Ads Not Loading

1. **Check App ID**: Ensure correct App ID in `app.json`
2. **Wait for propagation**: New ad units take 1-2 hours to activate
3. **Check device connection**: Ads need internet
4. **Verify ad unit ID**: Platform-specific IDs are different

### "Ad failed to load" Error

- New accounts may have limited ad fill - wait 24-48 hours
- Test with TestIds first to verify integration works

### App Store/Play Store Rejection

- Ensure ads are not near interactive elements
- Don't place ads where accidental clicks can occur
- Include privacy policy mentioning ad usage

---

## Resources

- [AdMob Console](https://admob.google.com/)
- [react-native-google-mobile-ads Docs](https://docs.page/invertase/react-native-google-mobile-ads)
- [AdMob Policies](https://support.google.com/admob/answer/6128543)
- [iOS App Tracking Transparency](https://developer.apple.com/documentation/apptrackingtransparency)
