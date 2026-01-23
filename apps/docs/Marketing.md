# 📈 FitNudge Marketing Strategy & Growth Plan

> FitNudge is an AI-powered goal and habit accountability app that helps users stay consistent with any goal they set.

---

## 💰 Pricing Strategy & Subscription Tiers

### 📊 Simplified 2-Tier Pricing

> **Rationale**: Simplified to a 2-tier system (Free + Premium) for:
>
> - **Higher conversion**: Less choice = faster decisions
> - **Cleaner communication**: "Get everything for $9.99/month"
> - **Easier development**: No complex feature-gating logic
> - **Better App Store UX**: Apple/Google subscription UIs work best with fewer options

| Tier        | Monthly   | Annual     | Monthly Equiv | Savings | Target User                     |
| ----------- | --------- | ---------- | ------------- | ------- | ------------------------------- |
| **Free**    | $0        | $0         | -             | -       | Trial users, exploring the app  |
| **Premium** | **$9.99** | **$79.99** | $6.67/mo      | 33%     | Committed users who want it all |

### 🎁 Exit Intent Offer Pricing (50% Off Annual)

> **Strategy**: One clear choice for maximum conversion
>
> - AI Chat Motivation is the hook that creates long-term stickiness
> - Users who experience premium features are more likely to renew
> - Discount percentage calculated dynamically from database prices

| Tier        | Regular Annual | Exit Offer | Monthly Equiv | Savings |
| ----------- | -------------- | ---------- | ------------- | ------- |
| **Premium** | $79.99         | **$39.99** | $3.33/mo      | $40/yr  |

### 🎯 Feature Matrix (2-Tier System)

| Feature                   | Free | Premium |
| ------------------------- | ---- | ------- |
| **Limits**                |      |         |
| Active Goals              | 1    | ∞       |
| Accountability Partners   | 0    | ∞       |
| **AI Features**           |      |         |
| Template Motivation       | ✅   | ✅      |
| AI-Generated Motivation   | ❌   | ✅      |
| AI Coach Chat             | ❌   | ✅      |
| Voice Notes               | ❌   | ✅      |
| Pattern Detection         | ❌   | ✅      |
| Adaptive Nudging          | ❌   | ✅      |
| **Tracking & Analytics**  |      |         |
| Streak Tracking           | ✅   | ✅      |
| Weekly Progress View      | ❌   | ✅      |
| Activity Heat Map         | ❌   | ✅      |
| Advanced Analytics Charts | ❌   | ✅      |
| Weekly AI Recaps          | ❌   | ✅      |
| **Social Features**       |      |         |
| Find Partners             | ❌   | ✅      |
| Send Cheers/Nudges        | ❌   | ✅      |
| Partner Insights          | ❌   | ✅      |
| **Content**               |      |         |
| Blog Access               | ✅   | ✅      |
| Achievement Badges        | ✅   | ✅      |
| Custom Reminders          | ✅   | ✅      |
| **Premium Perks**         |      |         |
| Priority Support          | ❌   | ✅      |
| Ad-Free Experience        | ❌   | ✅      |

---

## 💵 Cost Analysis & Profit Margins

### Platform Commissions (Unavoidable)

| Platform       | Year 1 | Year 2+ | Notes                               |
| -------------- | ------ | ------- | ----------------------------------- |
| **Apple**      | 30%    | 15%     | 15% for Small Business Program <$1M |
| **Google**     | 15%    | 15%     | Flat rate for subscriptions         |
| **RevenueCat** | 0-1%   | 1%      | Free up to $2.5K MTR, then 1%       |

**Blended Average Commission**: ~23-25% (iOS/Android mix)

### AI Costs per Active User (OpenAI)

| Tier    | Features Used            | Est. Cost/User/Month |
| ------- | ------------------------ | -------------------- |
| Free    | Limited text motivation  | ~$0.02               |
| Premium | All AI features + Memory | ~$0.50               |

### Infrastructure Costs (Monthly Fixed)

| Service         | Cost/Month | Notes                   |
| --------------- | ---------- | ----------------------- |
| Supabase Pro    | $25        | Database, Auth, Storage |
| Vercel/Railway  | $20        | API Hosting             |
| Redis           | $0         | Self-hosted             |
| Sentry          | $26        | Error tracking          |
| Domain/SSL      | $2         | Annual amortized        |
| **Total Fixed** | **~$75**   |                         |

### Profit Margin Analysis

**Premium ($9.99/month) ⭐ SINGLE REVENUE TIER**

```
Gross Revenue:                    $9.99
- Platform Commission (25%):     -$2.50
- RevenueCat (1%):               -$0.10
- AI Costs:                      -$0.50
─────────────────────────────────────────
Net Profit:                       $6.89 (69% margin) ✅
```

**Premium Annual ($79.99/year = $6.67/month equivalent)**

```
Gross Revenue:                    $79.99/year
- Platform Commission (25%):     -$20.00
- RevenueCat (1%):               -$0.80
- AI Costs:                      -$6.00 (12 months × $0.50)
─────────────────────────────────────────
Net Profit:                       $53.19/year (~$4.43/month, 66% margin) ✅
```

---

## 🛠️ IAP Setup Guide: RevenueCat + Apple + Google

### 📋 Product ID Naming Convention (2-Tier System)

Use consistent naming across all platforms:

| Tier    | Period  | iOS Product ID                 | Android Product ID             |
| ------- | ------- | ------------------------------ | ------------------------------ |
| Premium | Monthly | `com.fitnudge.premium.monthly` | `com.fitnudge.premium.monthly` |
| Premium | Annual  | `com.fitnudge.premium.annual`  | `com.fitnudge.premium.annual`  |

### 🍎 App Store Connect Setup (iOS)

#### Step 1: Create Subscription Group

1. Go to **App Store Connect** → **My Apps** → **FitNudge**
2. Click **Subscriptions** in the sidebar
3. Click **+** next to "Subscription Groups"
4. **Name**: `FitNudge Premium`
5. **Reference Name**: `fitnudge_premium_subscriptions`

#### Step 2: Create Subscription Products (2-Tier System)

For Premium tier, create in App Store Connect:

**Premium Monthly ($9.99)**

```
Reference Name: Premium Monthly
Product ID: com.fitnudge.premium.monthly
Subscription Duration: 1 Month
Price: Tier 10 ($9.99 USD)
```

**Premium Annual ($79.99)**

```
Reference Name: Premium Annual
Product ID: com.fitnudge.premium.annual
Subscription Duration: 1 Year
Price: Tier 80 ($79.99 USD)
Introductory Offer: 3-day FREE TRIAL
```

> **Strategy**: Free trial on Annual to maximize conversion and LTV.

#### Step 3: Add Localization (Required for Review)

For **each** subscription product, add:

**Display Name Examples:**

- Premium Monthly: "Premium Plan"
- Premium Annual: "Premium Plan (Annual)"

**Description Examples:**

**Premium Plan:**

```
Unlock your full fitness potential with FitNudge Premium:
• Unlimited fitness goals
• AI Chat Motivation (our signature feature!)
• Advanced analytics and insights
• Full social features and accountability partners
• AI memory - your coach remembers your journey
• Priority customer support
• Ad-free experience

The complete AI fitness coaching experience.
```

#### Step 4: Screenshots for Review (iOS Requires This)

**Required Screenshots** (upload in App Store Connect for each subscription):

1. **Subscription Screen Screenshot** - Shows all plan options with pricing
2. **Feature Comparison Screenshot** - Shows what each tier includes
3. **In-App Usage Screenshot** - Shows the feature being used (e.g., voice message playing)

**Screenshot Specifications:**

- Format: PNG or JPEG
- Size: 640x920 pixels (minimum)
- Must clearly show pricing
- Must show what user gets

#### Step 5: Review Notes for Apple (IMPORTANT)

Add these notes when submitting for review:

**Review Notes Template:**

```
SUBSCRIPTION INFORMATION:

FitNudge is an AI-powered goal and habit accountability app. Our subscription unlocks premium features:

TEST ACCOUNT (if needed):
Email: review@fitnudge.app
Password: [Provided separately or use sandbox account]

SUBSCRIPTION TIERS (2-Tier System):
1. Free - 1 goal, limited text motivation
2. Premium ($9.99/mo, $79.99/yr) - Unlimited goals, AI Chat Motivation, all features

KEY DIFFERENTIATOR:
Our Premium plan includes AI Chat Motivation - personalized AI coaching conversations that provide encouragement, guidance, and strategies based on user's fitness goals and progress. This is a unique, high-value feature that justifies the premium pricing.

HOW TO TEST:
1. Create account or use test account above
2. Complete onboarding (personalization questions)
3. Navigate to Profile → Subscription
4. Select any plan to see the subscription flow
5. For voice messages (Pro+): Create a goal and wait for daily motivation

CONTENT DELIVERY:
- Text motivations: Generated via OpenAI GPT-4
- Voice messages: Generated via OpenAI TTS (Text-to-Speech)
- All content is dynamically generated and personalized

CANCELLATION:
Users can cancel anytime via iOS Settings → Subscriptions.

Thank you for reviewing FitNudge!
```

### 🤖 Google Play Console Setup (Android)

#### Step 1: Create Subscription Products

1. Go to **Google Play Console** → **FitNudge** → **Monetize** → **Subscriptions**
2. Click **Create subscription**

For Premium tier (2-Tier System):

**Premium Monthly**

```
Product ID: com.fitnudge.premium.monthly
Name: Premium Plan (Monthly)
Description: [Same as iOS]
Default price: $9.99 USD
Billing period: Monthly
```

**Premium Annual**

```
Product ID: com.fitnudge.premium.annual
Name: Premium Plan (Annual)
Description: [Same as iOS]
Default price: $79.99 USD
Billing period: Yearly
Introductory Offer: 3-day FREE TRIAL
```

#### Step 2: Base Plans and Offers

For each subscription, create a **Base Plan**:

```
Base Plan ID: standard
Price: [as above]
Renewal type: Auto-renewing
Grace period: 7 days
Account hold: 30 days
```

For **Premium Annual**, add a **Free Trial Offer**:

```
Offer ID: free-trial
Offer type: Free trial
Duration: 3 days
Eligibility: New customers only
```

For **Premium Annual Exit Offer**, add a **Discounted Base Plan** (for Exit Intent):

```
Offer ID: exit-50-off
Offer type: Pay Up Front
Duration: 1 Year
Price: $39.99 (50% off)
Eligibility: Custom targeting for exit intent
```

#### Step 3: Link to RevenueCat

After creating products in Google Play:

1. Note all Product IDs
2. Enable **Real-time developer notifications**
3. Create a **Service Account** for RevenueCat
4. Grant service account access to Play Console

### 🐱 RevenueCat Setup

#### Step 1: Create RevenueCat Account

1. Go to https://app.revenuecat.com
2. Sign up / Log in
3. Create new project: "FitNudge"

#### Step 2: Configure Apps

**iOS App:**

```
App Name: FitNudge iOS
Bundle ID: com.fitnudge.app
App Store Connect API Key: [Generate in App Store Connect]
```

**Android App:**

```
App Name: FitNudge Android
Package Name: com.fitnudge.app
Service Account JSON: [Upload from Google Cloud]
```

#### Step 3: Create Entitlements (2-Tier System)

Entitlements define what features users unlock:

| Entitlement ID   | Description                     |
| ---------------- | ------------------------------- |
| `premium_access` | Access to Premium tier features |

#### Step 4: Create Products in RevenueCat

After creating your products in App Store Connect and Google Play Console, you need to add them to RevenueCat.

**Step 4a: Navigate to Products**

1. Go to **RevenueCat Dashboard** → **Project Settings** → **Products**
2. Click **+ New** to add a product

**Step 4b: Add iOS Products (2-Tier System)**

For each iOS subscription, create a product:

| App Store Product ID           | Entitlement      | Display Name    |
| ------------------------------ | ---------------- | --------------- |
| `com.fitnudge.premium.monthly` | `premium_access` | Premium Monthly |
| `com.fitnudge.premium.annual`  | `premium_access` | Premium Annual  |

**How to add each product:**

```
1. Click "+ New"
2. Select "App Store" as the store
3. Enter Product Identifier: e.g., "com.fitnudge.premium.monthly"
4. Click "Create"
5. In the product details, click "Attach to an Entitlement"
6. Select "premium_access"
7. Click "Save"
```

**Step 4c: Add Android Products (2-Tier System)**

For Android, product IDs are the same as iOS:

| Google Play Product ID         | Entitlement      | Display Name    |
| ------------------------------ | ---------------- | --------------- |
| `com.fitnudge.premium.monthly` | `premium_access` | Premium Monthly |
| `com.fitnudge.premium.annual`  | `premium_access` | Premium Annual  |

> **Note**: Using same product IDs for both iOS and Android for simplicity.

**How to add each Android product:**

```
1. Click "+ New"
2. Select "Play Store" as the store
3. Enter Product Identifier: e.g., "com.fitnudge.premium.monthly"
4. Click "Create"
5. In the product details, click "Attach to an Entitlement"
6. Select "premium_access"
7. Click "Save"
```

**Step 4d: Verify Products Import (Optional)**

RevenueCat can auto-import products if your API credentials are set up correctly:

1. Go to **Project Settings** → **Apps** → Select your app
2. Click **"Import Products"**
3. RevenueCat will fetch all products from the connected store
4. Review and attach entitlements to any new products

**Product Status Check:**

After adding products, verify they show the correct status:

| Status     | Meaning                                       |
| ---------- | --------------------------------------------- |
| ✅ Active  | Product is live and purchasable               |
| ⏳ Pending | Waiting for store approval                    |
| ❌ Missing | Product not found in store (check Product ID) |

#### Step 5: Create Offerings

Offerings are groups of packages that you show to users. You can have multiple offerings for A/B testing or special promotions.

**Step 5a: Create Default Offering**

1. Go to **RevenueCat Dashboard** → **Project Settings** → **Offerings**
2. Click **+ New** to create an offering
3. Fill in the details:

```
Offering Identifier: default
Display Name: Standard Pricing
Description: Default pricing shown to all users
☑️ Make this the current offering (checked)
```

4. Click **Create**

**Step 5b: Add Packages to Default Offering**

After creating the offering, add packages (products grouped by duration):

1. Click on the "default" offering
2. Click **+ Add Package**
3. Create each package:

| Package ID    | Display Name    | Product (iOS & Android)        |
| ------------- | --------------- | ------------------------------ |
| `$rc_monthly` | Premium Monthly | `com.fitnudge.premium.monthly` |
| `$rc_annual`  | Premium Annual  | `com.fitnudge.premium.annual`  |

> **Note**: `$rc_monthly` and `$rc_annual` are RevenueCat's default package identifiers.

**How to add each package:**

```
1. Click "+ Add Package"
2. Enter Package Identifier: e.g., "$rc_monthly"
3. Enter Display Name: e.g., "Premium Monthly"
4. Under "Products", click "+ Add Product"
5. Select the iOS product for this package
6. Click "+ Add Product" again
7. Select the Android product for this package
8. Click "Save"
```

**Step 5c: Create Exit Offer Offering (Premium Annual Only)**

1. Create new offering:

```
Offering Identifier: exit_offer
Display Name: Special Exit Offer
Description: 50% off Premium annual (shown during exit intent)
☐ Make this the current offering (unchecked)
```

2. Add single package:

| Package ID            | Display Name           | Product (iOS)                                                | Product (Android)                                         |
| --------------------- | ---------------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| `premium_annual_exit` | Premium Annual 50% Off | `com.fitnudge.premium.annual` (with promo `premium_exit_50`) | `com.fitnudge.premium.annual` (with exit offer base plan) |

> **Note**: For iOS, you'll use promotional offers. For Android, you'll use a separate base plan with discounted pricing.

**Step 5d: Verify Offerings in App**

In your React Native code, fetch offerings to verify:

```typescript
import Purchases from "react-native-purchases";

const checkOfferings = async () => {
  const offerings = await Purchases.getOfferings();
  console.log("Current offering:", offerings.current);
  console.log("All offerings:", offerings.all);

  // Access specific offering
  const exitOffer = offerings.all["exit_offer"];
  if (exitOffer) {
    console.log("Exit offer packages:", exitOffer.availablePackages);
  }
};
```

#### Step 6: Configure Environment Variables

Add RevenueCat API keys to your app:

**For React Native (Expo):**

```bash
# .env or app.config.ts
REVENUECAT_API_KEY_IOS=appl_xxxxxxxxxxxxxxxxxx
REVENUECAT_API_KEY_ANDROID=goog_xxxxxxxxxxxxxxxxxx
```

**Where to find API keys:**

1. Go to **RevenueCat Dashboard** → **Project Settings** → **API Keys**
2. Copy the **Public API Key** for each platform
3. Never expose these in client code directly - use environment variables

#### Step 7: Test Your Setup

**RevenueCat Sandbox Testing:**

1. Create a **Sandbox Test User** in App Store Connect / Google Play Console
2. In RevenueCat Dashboard, enable **Sandbox Mode** for testing
3. Use `Purchases.setLogLevel(LOG_LEVEL.DEBUG)` during development
4. Make test purchases - they won't charge real money

**Verify in RevenueCat Dashboard:**

After a test purchase:

1. Go to **Customers** → Search for your test user
2. Verify the subscription appears with correct entitlement
3. Check **Events** tab for purchase events

---

### 🎁 Exit Offer Implementation (iOS & Android)

The exit offer shows 50% off annual pricing when users try to leave the subscription screen. Here's how to set this up on both platforms:

#### ⚠️ IMPORTANT: Introductory Offers vs Promotional Offers

Before setting up your exit offer, understand the difference:

| Type                   | Target Audience                                    | Setup Complexity                         | Eligibility                 |
| ---------------------- | -------------------------------------------------- | ---------------------------------------- | --------------------------- |
| **Introductory Offer** | **NEW subscribers only** (never subscribed before) | Simple - configure in App Store Connect  | Apple handles automatically |
| **Promotional Offer**  | **Existing/lapsed subscribers** (win-back)         | Complex - requires server-side signature | Must check manually         |

**For Exit Intent (targeting new users who haven't subscribed):**

- ✅ **Use Introductory Offer** - simpler setup, Apple handles eligibility
- ❌ Promotional Offer will show "User is ineligible" for new users

**For Win-Back Campaigns (targeting users who cancelled):**

- ✅ **Use Promotional Offer** - specifically designed for lapsed subscribers
- ❌ Introductory Offer won't work for returning users

---

#### Option A: Introductory Offers (Recommended for Exit Intent - NEW Users)

Introductory offers are **automatically available** to first-time subscribers. Apple handles all eligibility checks - no server-side signature required.

##### 🍎 iOS: Introductory Offers in App Store Connect

> **Strategy (2-Tier System)**: Free trial on Annual only
>
> - Premium Annual → 3-day Free Trial (maximize conversion to annual)

**Step 1: Create FREE TRIAL for Premium Annual**

1. Go to **App Store Connect** → **My Apps** → **FitNudge** → **Subscriptions**
2. Click on `com.fitnudge.premium.annual`
3. Scroll to **Introductory Offers** section
4. Click **+** to add offer
5. Configure:

```
Offer Type: Free Trial
Duration: 3 days
Countries: All territories
```

**Step 2: Exit Offer is configured as Promotional Offer (for lapsed users)**

Exit offer ($39.99 = 50% off $79.99) is configured as a promotional offer for users who dismiss the subscription screen.

> **Result**: New users get 3-day trial on annual. Exit intent shows 50% off for users who try to leave.

**Step 2: RevenueCat Automatically Detects Introductory Offers**

RevenueCat SDK automatically:

- Detects if user is eligible for introductory offer
- Shows the discounted price in the product info
- Applies the offer during purchase (no extra code needed)

**Step 3: Check Eligibility in Code**

```typescript
import Purchases, { PurchasesPackage } from "react-native-purchases";

const checkIntroEligibility = async (pkg: PurchasesPackage) => {
  // RevenueCat provides eligibility info on the product
  const product = pkg.product;

  // Check if user is eligible for intro offer
  const isEligible = product.introPrice !== null;

  if (isEligible) {
    console.log("Intro price:", product.introPrice?.priceString);
    console.log("Regular price:", product.priceString);
  }

  return isEligible;
};
```

**Step 4: Display Intro Price in Exit Intent Modal**

```typescript
// In ExitIntentModal, show the intro price if available
const getDisplayPrice = (pkg: PurchasesPackage) => {
  const product = pkg.product;

  // If intro offer available, show that price
  if (product.introPrice) {
    return {
      discountedPrice: product.introPrice.price,
      originalPrice: product.price,
      isIntroOffer: true,
    };
  }

  // No intro offer - user not eligible (already subscribed before)
  return {
    discountedPrice: product.price,
    originalPrice: product.price,
    isIntroOffer: false,
  };
};
```

##### 🤖 Android: Introductory Offers in Google Play Console

**Step 1: Create FREE TRIAL for Premium Annual**

1. Go to **Google Play Console** → **FitNudge** → **Monetize** → **Subscriptions**
2. Click on `com.fitnudge.premium.annual`
3. Click on your base plan → **Add offer** → **Free trial**

```
Offer ID: free-trial-3d
Phases:
  - Phase 1: Free Trial
  - Duration: 3 days
Eligibility: New customers only (default)
```

**Step 2: Create 50% OFF Exit Offer for Premium Annual**

1. Click on `com.fitnudge.premium.annual`
2. Click on your base plan → **Add offer** → **Introductory offer**

```
Offer ID: exit-50-off
Phases:
  - Phase 1: Pay Up Front
  - Duration: 1 Year
  - Price: $39.99 USD (50% off $79.99)
Eligibility: Custom targeting for exit intent
```

**Step 3: Same Code Works for Android**

The RevenueCat SDK handles Android intro offers the same way as iOS.

---

#### Option B: Promotional Offers (For Win-Back Campaigns - LAPSED Users)

> ⚠️ **Only use this for users who PREVIOUSLY subscribed and cancelled.**
> New users will get "User is ineligible" error with promotional offers.

##### 🍎 iOS: Promotional Offers in App Store Connect

**Step 1: Generate Subscription Keys**

1. Go to **App Store Connect** → **Users and Access** → **Integrations** → **In-App Purchase**
2. Click **Generate In-App Purchase Key**
3. Download the `.p8` key file and note the **Key ID**
4. Note your **Issuer ID** from the same page
5. Store these securely - you'll need them for server-side signature generation

**Step 2: Create Promotional Offers for Each Subscription**

For the Premium Annual subscription, create a promotional offer:

1. Go to **App Store Connect** → **My Apps** → **FitNudge** → **Subscriptions**
2. Click on `com.fitnudge.premium.annual`
3. Scroll to **Promotional Offers** section
4. Click **+** to add a new offer

**Premium Annual Exit Offer:**

```
Reference Name: Premium Exit Offer 50% Off
Promotional Offer ID: premium_exit_50
Offer Type: Pay Up Front
Duration: 1 Year
Price: Tier 40 ($39.99 USD) - 50% off $79.99
```

> **Note**: Exit offer only applies to Premium Annual. The 2-tier system keeps things simple.

**Step 3: RevenueCat Handles Signature Generation (No Backend Code Needed!)**

> ⚠️ **IMPORTANT**: Since we're using RevenueCat, you do NOT need to implement `generate_promotional_offer_signature` on your backend. RevenueCat handles all the JWT signing automatically once configured.

RevenueCat handles promotional offers automatically if you configure them:

1. Go to **RevenueCat Dashboard** → **Project** → **iOS App**
2. Navigate to **Subscription Offers**
3. Upload your `.p8` key file
4. Enter your **Key ID** and **Issuer ID**
5. RevenueCat will now automatically generate signatures

**In-App Code (React Native with RevenueCat):**

```typescript
// Fetch promotional offer from RevenueCat
const purchaseWithPromoOffer = async (
  packageToPurchase: PurchasesPackage,
  promoOfferId: string
) => {
  try {
    // RevenueCat handles signature generation automatically
    const { customerInfo } = await Purchases.purchasePackage(
      packageToPurchase,
      {
        promotionalOffer: {
          identifier: promoOfferId, // e.g., "premium_exit_50"
        },
      }
    );
    return customerInfo;
  } catch (error) {
    console.error("Promo offer purchase failed:", error);
    throw error;
  }
};
```

##### 🤖 Android: Offer Tags in Google Play Console

Android uses a different approach - **Offer Tags** on base plans.

**Step 1: Create Discounted Base Plans**

For Premium Annual, create an additional base plan with discounted pricing:

1. Go to **Google Play Console** → **FitNudge** → **Monetize** → **Subscriptions**
2. Click on `com.fitnudge.premium.annual`
3. Click **Add base plan**

**Premium Annual Exit Offer Base Plan:**

```
Base Plan ID: premium-annual-exit-offer
Tag: exit_offer
Price: $39.99 USD (50% off $79.99)
Renewal type: Auto-renewing
Eligibility: Use offer tags to control visibility
```

**Step 2: Configure Offer Tags**

1. In the exit offer base plan, add the tag `exit_offer`
2. This allows you to filter and show this offer programmatically

**Step 3: RevenueCat Integration for Android**

In RevenueCat, the exit offer uses the same product ID but with a discounted base plan:

```
Product ID: com.fitnudge.premium.annual
Base Plan: premium-annual-exit-offer (50% off pricing)
Entitlement: premium_access
```

**Step 4: Create Exit Offer Offering in RevenueCat**

1. Go to **RevenueCat** → **Offerings**
2. Create new offering: `exit_offer`
3. Add packages pointing to the discounted base plans/promo offers

---

#### Option B: Display-Only Discount (Simpler Alternative)

If you don't want to manage promotional offers server-side, you can:

1. **Show discounted price in UI** - Display "~~$79.99~~ $39.99" in the exit modal
2. **Charge regular price** - The actual IAP charges the regular annual price
3. **Apply credit via backend** - Your backend credits the user's account for the difference

**Pros:** No App Store/Play Store promotional offer setup required
**Cons:** User sees full price in IAP confirmation dialog (may cause confusion)

**NOT RECOMMENDED** - Users may feel deceived when the IAP shows full price.

---

#### Exit Offer Product IDs Summary (2-Tier System)

| Tier    | Platform | Product ID                    | Exit Offer Method                    |
| ------- | -------- | ----------------------------- | ------------------------------------ |
| Premium | iOS      | `com.fitnudge.premium.annual` | Promotional Offer: `premium_exit_50` |
| Premium | Android  | `com.fitnudge.premium.annual` | Discounted Base Plan (50% off)       |

> **Strategy**: Exit offer on Premium Annual. AI Chat Motivation is the hook that creates long-term stickiness.

---

#### Exit Offer Flow Implementation

```
User Flow:
1. User opens Subscription Screen
2. User tries to close/dismiss
3. Check eligibility:
   - Not already subscribed
   - Shown < 3 times total
   - Last shown > 7 days ago
4. Show Exit Intent Modal with:
   - 15-minute countdown timer
   - PREMIUM ANNUAL at 50% off ($39.99/year)
   - Highlights AI Chat Motivation as key feature
   - Discount % calculated dynamically from database
5. If user taps "Claim Offer":
   - iOS: Purchase with promotional offer ID (premium_exit_50)
   - Android: Purchase discounted base plan (premium-annual-exit-offer)
6. If user taps "No thanks":
   - Record dismissal
   - Close modal
   - Floating button appears on HomeScreen with countdown
```

**Why Premium Annual Only:**

- AI Chat Motivation creates stickiness (users who try it, stay)
- One choice = higher conversion (no decision paralysis)
- Maximizes LTV with annual commitment

---

#### Step 6: Environment Variables

Add to your `.env` file:

```bash
# RevenueCat API Keys
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=appl_xxxxxxxxxxxxx
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=goog_xxxxxxxxxxxxx
```

Get these keys from:

- RevenueCat Dashboard → Project → API Keys

### 📸 Screenshot Requirements Summary

#### For iOS App Review:

| Screenshot          | Purpose           | What to Show                               |
| ------------------- | ----------------- | ------------------------------------------ |
| Subscription Screen | Price display     | Free vs Premium with Monthly/Annual toggle |
| Feature Comparison  | Value proposition | What Premium unlocks                       |
| AI Chat UI          | Premium feature   | AI Chat Motivation in action               |
| Analytics Screen    | Premium feature   | Charts and insights                        |
| Goal Creation       | Core feature      | Creating a fitness goal                    |

**File naming convention:**

```
review_screenshot_1_subscription.png
review_screenshot_2_features.png
review_screenshot_3_voice_message.png
```

#### For Google Play:

Google typically doesn't require additional screenshots for subscription review, but include subscription UI in your main app screenshots.

### ✅ Pre-Submission Checklist

**App Store Connect (2-Tier System):**

- [ ] 2 subscription products created (Premium Monthly, Premium Annual)
- [ ] Localization added for each product
- [ ] Screenshots uploaded for each product
- [ ] Subscription group created
- [ ] **Promotional offer created for exit intent (premium_exit_50)**
- [ ] **In-App Purchase Key generated (.p8 file)**
- [ ] Review notes prepared
- [ ] Sandbox test account ready

**Google Play Console (2-Tier System):**

- [ ] 2 subscription products created (Premium Monthly, Premium Annual)
- [ ] Base plans configured
- [ ] Free trial offer set for Premium Annual
- [ ] **Exit offer base plan created (50% off annual)**
- [ ] **Offer tag configured (`exit_offer`)**
- [ ] Service account created
- [ ] Real-time notifications enabled

**RevenueCat:**

- [ ] Project created
- [ ] iOS and Android apps configured
- [ ] Entitlements created (1: premium_access)
- [ ] Products mapped to entitlements
- [ ] Default offering configured
- [ ] **Exit offer offering configured**
- [ ] **iOS promotional offer key uploaded (.p8)**
- [ ] API keys added to app

**App Code:**

- [ ] RevenueCat SDK installed
- [ ] API keys in environment variables
- [ ] Subscription screen shows correct prices
- [ ] **Exit intent modal shows promotional pricing**
- [ ] **Promotional offer purchase flow working**
- [ ] Purchase flow tested in sandbox
- [ ] Restore purchases working

---

## 🎯 Onboarding & Conversion Strategy

### 🚀 Complete Onboarding Flow

**User Journey:**

1. **App Launch** → OnboardingCarousel (3 slides about app features)
2. **Signup/Login** → Account creation
3. **Notification Permission** → "Stay on Track" with benefits explanation
4. **Personalization Flow** → 7 mandatory questions to understand user:
   - Fitness level (Beginner/Intermediate/Advanced/Athlete)
   - Primary goal (Lose weight/Build muscle/Stay active/General fitness/Sport-specific)
   - Current habits (Never/1-2x week/3-4x week/5+ week/Daily)
   - Workout setting (Gym/Home/Outdoor/Mix/Don't know)
   - Available time (<30min/30-60min/1-2hrs/Flexible)
   - Motivation style (Tough love/Gentle encouragement/Data-driven/Accountability buddy)
   - Biggest challenge (Staying consistent/Getting started/Time/Lack of knowledge)
5. **AI-Suggested Goals** → Personalized recommendations based on profile
6. **First Goal Creation** → User selects and customizes their first goal
7. **Subscription Screen** → Free vs Premium with Monthly/Annual toggle + exit intent

### 🎯 Free Trial & Discount Strategy (2-Tier System)

**Premium Annual**: 3-day FREE TRIAL
**Exit Offer**: 50% OFF annual ($39.99)

> **Rationale**: Free trial on annual to maximize conversion and LTV.
> Exit offer provides additional 50% discount for users who try to leave.

- **Why Premium Annual Trial?**: Gives users time to experience AI Chat Motivation
- **Why 3 days?**: Long enough to create habit, short enough to create urgency
- **Why Exit Offer?**: Captures users who are interested but hesitant on price

**Trial Conversion Tactics (Premium Annual):**

- Day 1: Welcome email + "Try AI Chat Motivation now"
- Day 2: Push notification: "2 days left in your trial"
- Day 3: Final email: "Trial ends today - Continue for just $79.99/year"

**Exit Intent Flow (Premium Annual):**

- User tries to close subscription screen
- Show Exit Intent Modal with 50% off annual ($39.99)
- Promotional offer configured for exit intent users

**Post-Trial/Purchase:**

- Auto-convert to paid subscription (standard IAP behavior)
- If cancelled: Win-back offer via Promotional Offer (different from intro)

### 🎁 Exit Intent Offers (2-Tier System)

**PREMIUM ANNUAL - 50% Off ($39.99/year):**

- Triggered when user tries to close subscription screen
- Shows once per 7 days, maximum 5 times total
- Only for non-subscribers
- Includes 15-minute countdown timer for urgency
- **Single offer: Premium at $39.99/year** (50% off $79.99)
- Highlights AI Chat Motivation as the key feature (the hook!)
- Discount percentage calculated dynamically from database prices
- "Limited time offer" messaging with countdown

**Why Premium Annual Only:**

- AI Chat Motivation is the killer feature that differentiates FitNudge
- One clear choice = higher conversion rate (no decision paralysis)
- Users who experience AI coaching are more likely to renew
- Maximizes LTV with annual commitment

### 🔒 Strategic Feature Gating

**A. Social Features (Free to Build Engagement):**

- Full access to community posts and comments
- User profiles and following system
- Like and cheer functionality
- Advanced filtering and discovery

**B. Premium Gating (High-Value Features):**

- Voice messages (emotional impact, AI cost)
- Unlimited goals (clear value proposition)
- Advanced analytics (data insights)
- AI memory and personalization

**C. Perfect Upgrade Moments:**

- After 7-day streak: "Unlock AI Chat Motivation to celebrate!"
- When creating 2nd goal: "Premium users can set unlimited goals"
- On analytics page: "See your full progress insights with Premium"
- After 5th social post: "Unlock Premium for more social features"

### ⏰ Time-Limited Offers

**IAP-Compliant Seasonal Campaigns:**

- **New Year**: Create Apple Offer Code "NEWYEAR2025" (50% off 3 months)
- **Summer**: Introductory offer - First month $2.99 (configured in App Store Connect)
- **Fitness Friday**: Offer code "FITFRIDAY" for 1 week free trial
- **Back to School**: Student subscription tier at discounted price (no .edu verification needed)

---

## 🏆 Social Proof & FOMO Marketing

### 📱 In-App Social Proof

**A. Success Stories:**

- "Sarah lost 15lbs with Premium AI coaching"
- "Join 50,000+ users achieving their goals"
- "Our community checked in 1M times this month!"
- Real user testimonials with photos

**B. Community Milestones:**

- Live counters: "1,247 people worked out today"
- Achievement celebrations: "You're in the top 10% this week!"
- Social proof notifications: "3 friends just hit their goals!"

### 🤝 Referral Program

**Program Structure:**

- "Give 1 month free, Get 1 month free"
- Premium users: "Refer 3 friends, get 3 months free"
- Track in-app: Leaderboard for top referrers
- Social sharing: "I just hit my 30-day streak with FitNudge!"

---

## 📝 Content Marketing & SEO

### 🎯 Blog Strategy

**Target Keywords:**

- "AI accountability app"
- "Habit tracker with AI coach"
- "Goal tracking app with AI"
- "Daily habit reminder app"
- "How to stay consistent with goals"
- "AI motivation vs traditional coaching"
- "Building habits that stick"

**Content Pillars:**

1. **Habit Building**: Tips, psychology, habit formation
2. **AI & Technology**: How AI helps build habits, tech trends
3. **Success Stories**: User transformations, case studies
4. **Behavioral Science**: Research-backed habit advice
5. **App Features**: How to use FitNudge effectively

### 📱 Short-Form Content Strategy

**YouTube/TikTok Content Ideas:**

- "POV: Your AI coach calls you out for skipping gym"
- "Reading my AI motivation messages after a bad day"
- "My 100-day fitness streak with FitNudge"
- Before/After transformations with app screenshots
- "AI vs Human Coach: Which is better?"
- "Testing AI motivation for 30 days"

### 🔍 SEO Optimization

**Technical SEO:**

- Mobile-first responsive design
- Core Web Vitals optimization
- Schema markup for fitness content
- Local SEO for gym partnerships

**Content SEO:**

- Long-tail keyword targeting
- Featured snippet optimization
- Voice search optimization
- FAQ schema for common questions

---

## 🤝 Partnership & Integration Marketing

### 🏋️ Gym Partnerships

**Partnership Model:**

- Offer gyms: "Give your members FitNudge Premium for free (you pay $2/member)"
- Co-branded landing pages: "PlanetFitness + FitNudge = Success"
- QR codes in gyms: "Scan to start your fitness journey"
- Gym staff training on app benefits

**Revenue Sharing:**

- 50/50 split on gym member subscriptions
- Bulk pricing for gym chains
- White-label options for premium gyms

### 👥 Fitness Influencer Collaborations

**Influencer Strategy:**

- Custom voice models of popular fitness influencers (licensing)
- Affiliate program: Influencers get 30% commission on conversions
- Limited edition: "Get motivated by [Influencer Name]'s voice"
- Sponsored content: "30-day challenge with [Influencer]"

**Tier Structure:**

- **Micro-influencers** (10K-100K): Free Premium subscription + 20% commission
- **Mid-tier** (100K-500K): Custom voice model + 25% commission
- **Macro-influencers** (500K+): Exclusive partnership + 30% commission

### 🏢 Corporate Wellness

**B2B Offering:**

- Companies pay for employee subscriptions
- ROI pitch: "Healthier employees = Lower healthcare costs"
- Team accountability groups
- Wellness program integration

**Pricing:**

- **Small Business** (10-50 employees): $2/employee/month
- **Medium Business** (50-200 employees): $1.50/employee/month
- **Enterprise** (200+ employees): $1/employee/month + custom features

---

## 🎮 Retention & Upsell Strategies

### 🏅 Gamification

**Badge System:**

- "30-day streak" - Consistency champion
- "AI Coach Pro" - Premium user
- "Community Champion" - Top contributor
- "Goal Crusher" - Multiple goal achiever
- "Motivator" - Helped others succeed

**Unlock System:**

- Complete 10 check-ins → Unlock custom AI tones
- 30-day streak → Unlock exclusive voice messages
- 100 social interactions → Unlock advanced analytics
- Refer 5 friends → Unlock Premium features for 1 month

### 📈 Smart Upselling

**Trigger-Based Offers:**

- **After 2-week streak (Free)**: "Your consistency is amazing! Upgrade to track unlimited goals"
- **When posting 5th social post**: "Premium users get more social features"
- **After viewing analytics 3 times**: "Unlock weekly AI insights with Premium"
- **When creating 2nd goal**: "Premium lets you set unlimited goals for just $9.99/month"

### 🔄 Win-Back Campaigns

**Reactivation Strategy:**

- Email: "We miss you! Come back to your 30-day streak for 50% off"
- Push notification: "Your gym buddy needs you back"
- Offer: "Reactivate within 7 days, get 1 month free"
- Social proof: "Your friends are still crushing their goals"

---

## 🚀 Launch & Growth Marketing

### 🏆 Product Hunt Launch

**Launch Strategy:**

- **Timing**: Tuesday-Thursday for best visibility
- **Offer**: "First 500 users get lifetime 50% off Premium"
- **Maker story**: Share your journey building FitNudge
- **Assets**: High-quality screenshots, demo video, compelling description

**Pre-Launch:**

- Build email list of 1,000+ fitness enthusiasts
- Create buzz with teaser content
- Partner with fitness influencers for launch day
- Prepare press kit and media outreach

### 📱 App Store Optimization (ASO)

**Visual Assets:**

- **Icon**: Friendly AI robot + fitness imagery
- **Screenshots**: Show before/after, voice message UI, social features
- **Video Preview**: 15-sec demo of AI motivation + check-in flow
- **Keywords**: "AI fitness coach", "gym motivation", "accountability partner"

**ASO Strategy:**

- **Title**: "FitNudge - AI Fitness Coach"
- **Subtitle**: "Stay motivated with AI voice messages"
- **Keywords**: AI fitness, gym motivation, habit tracker, accountability
- **Description**: Focus on benefits, not features
- **Reviews**: Encourage satisfied users to leave reviews

### 💰 Paid Acquisition

**Meta Ads Strategy:**

- **Target**: 18-45, interest in fitness, gym memberships
- **Creative**: UGC-style videos showing app in use
- **Budget**: Start with $500/month, test different audiences
- **Placements**: Instagram Stories, Facebook Feed, Reels

**Google Ads:**

- **Keywords**: "fitness accountability app", "gym motivation app"
- **Budget**: $300/month initially
- **Landing pages**: Optimized for each keyword group

**TikTok Ads:**

- **Format**: Short, engaging videos showing AI voice messages
- **Target**: Gen Z fitness enthusiasts
- **Budget**: $200/month for testing

---

## 📧 Email Marketing Sequences

### 🎯 Onboarding Sequence (Day 1-7)

**Day 1**: Welcome! Here's how to set your first goal

- Welcome email with app tour
- Goal-setting tips and templates
- First motivation message preview

**Day 2**: Meet your AI coach - how personalization works

- AI coach personality explanation
- Customization options
- Success story from similar user

**Day 3**: Join the community! See what others are achieving

- Social features walkthrough
- Community guidelines
- How to engage with others

**Day 5**: Your first streak milestone - keep going!

- Streak celebration
- Tips for maintaining consistency
- What happens next

**Day 7**: Trial ending soon - upgrade to Premium for AI Chat Motivation

- AI Chat demo
- Premium features overview
- Special upgrade offer

### 📊 Engagement Sequences

**Weekly Digest:**

- "Your progress this week + motivational tip"
- Community highlights
- New feature announcements

**Monthly Recap:**

- "Your fitness journey recap + special offer"
- Achievement celebrations
- Goal setting for next month

**Milestone Celebrations:**

- "Congratulations on [X] days! Here's 20% off Premium Annual"
- Exclusive rewards for long-term users
- Referral opportunities

---

## 🎉 Seasonal & Event Marketing

### 🎊 New Year (January)

**Campaign**: "2025 Resolution Edition"

- "3 months Premium for price of 2"
- Content: "How to actually keep your fitness resolution"
- Challenge: "January Jumpstart - 31-day community challenge"
- Influencer partnerships for resolution content

### ☀️ Summer (May-June)

**Campaign**: "Summer Body Ready"

- "Start your transformation today"
- Beach body content marketing
- Instagram challenge: "#FitNudgeSummer"
- Pool party workout content

### 🎓 Back to School (September)

**Campaign**: "Student Fitness"

- "Student discount: 50% off all plans with .edu email"
- "Build healthy habits for the new semester"
- Campus fitness challenges
- Study break workout content

### 🎃 Halloween (October)

**Campaign**: "Scare Away Bad Habits"

- "30-day challenge to break bad fitness habits"
- Spooky workout content
- "Trick or Treat" fitness challenges

---

## 📊 Key Metrics to Track

### 🎯 Onboarding Conversion Metrics

- **Signup → Notification Permission Grant Rate**: Target 70-80%
- **Personalization Completion Rate**: Target 85-90% (all 7 screens)
- **First Goal Creation Rate**: Target 80-85%
- **Subscription Screen View → Free Trial Start Rate (Premium)**: Target 25-35%
- **Exit Intent Offer Show → Acceptance Rate**: Target 15-25%
- **Overall Signup → Paid Conversion Rate**: Target 8-12%
- **Time to Complete Onboarding Flow**: Target <5 minutes

### 🎯 Conversion Metrics (2-Tier System)

- **Free to Premium Conversion Rate**: Target 5-10%
- **Trial to Paid Conversion**: Target 40-60%
- **Monthly to Annual Upgrade**: Target 20-30%

### 📈 Retention Metrics

- **Churn Rate**: Target <5% monthly
- **DAU/MAU Ratio**: Target >40%
- **7-Day Retention**: Target >60%
- **30-Day Retention**: Target >35%

### 💰 Revenue Metrics

- **LTV:CAC Ratio**: Target 3:1 minimum
- **Monthly Recurring Revenue (MRR)**: Track growth
- **Annual Recurring Revenue (ARR)**: Track growth
- **Average Revenue Per User (ARPU)**: Track by tier

### 🤝 Engagement Metrics

- **Referral Rate**: Target 20% of paid users refer someone
- **Social Engagement**: Posts, comments, likes per user
- **Feature Adoption**: Voice messages, analytics usage
- **Content Consumption**: Blog views, email opens

---

## 💰 Revenue Projections (2-Tier System)

### 📊 Conservative Year 1 Projections

**User Growth Assumptions:**

- Month 1: 1,000 users
- Month 6: 5,000 users
- Month 12: 10,000 users

**Distribution at 10,000 Users (2-Tier System):**

- **Free**: 8,000 users (80%)
- **Premium Monthly**: 1,000 users (10%) @ $9.99 = $9,990/month
- **Premium Annual**: 1,000 users (10%) @ $6.67 equivalent = $6,670/month

**Gross Monthly Recurring Revenue (MRR)**: ~$16,660
**Gross Annual Run Rate (ARR)**: ~$200,000

### Platform Commission & Cost Impact

**Commission Structure:**

- iOS Year 1: 30% to Apple (15% if <$1M via Small Business Program)
- iOS Year 2+: 15% to Apple (for retained subscribers)
- Android: 15% to Google
- RevenueCat: 1% (after $2.5K MTR)
- Average: ~25% total commission

**Net Revenue Calculation (10,000 users with 2-tier system):**

```
Gross MRR:                        $16,660
- Platform Commissions (25%):    -$4,165
- RevenueCat (1%):               -$167
- AI Costs (~$0.50/premium user):-$1,000
- Infrastructure:                -$75
─────────────────────────────────────────
Net MRR:                          $11,253 (68% margin)
Net ARR:                          $135,036
```

### 📈 Scenario Projections

| Scenario | Year 1 Users | Paid % | Gross ARR | Net ARR  |
| -------- | ------------ | ------ | --------- | -------- |
| Slow     | 5,000        | 15%    | $130,000  | $92,000  |
| Medium   | 10,000       | 20%    | $350,000  | $248,000 |
| Good     | 15,000       | 22%    | $580,000  | $412,000 |

### 🚀 Year 2-3 Projections

**Year 2:**

- **Users**: 25,000+
- **Paid Conversion**: 22-25%
- **Gross ARR**: $900,000-1,200,000
- **Net ARR**: $640,000-850,000 (after all costs)
- **Enterprise**: 10+ corporate clients
- **Potential to hire**: 2-3 team members

**Year 3:**

- **Users**: 50,000+
- **Paid Conversion**: 25-28%
- **Gross ARR**: $1,800,000-2,400,000
- **Net ARR**: $1,280,000-1,700,000 (after all costs)
- **Enterprise**: 30+ corporate clients
- **Team**: 5-8 people

---

## 🎯 Marketing Budget Allocation

### 💰 Year 1 Budget: $50,000

**Paid Acquisition (40% - $20,000):**

- Meta Ads: $8,000
- Google Ads: $5,000
- TikTok Ads: $3,000
- Influencer partnerships: $4,000

**Content Marketing (30% - $15,000):**

- Blog content creation: $8,000
- Video production: $4,000
- SEO tools and optimization: $3,000

**Events & Partnerships (20% - $10,000):**

- Fitness expos and events: $6,000
- Gym partnership setup: $2,000
- Corporate wellness outreach: $2,000

**Tools & Technology (10% - $5,000):**

- Marketing automation: $2,000
- Analytics tools: $1,500
- Design tools: $1,500

### 📈 ROI Expectations

**Target Metrics (2-Tier System):**

- **CAC**: <$25 for Free to Paid conversion
- **LTV**: >$90 for Premium Monthly users (avg 9 months retention × $9.99)
- **LTV**: >$160 for Premium Annual users (avg 2 years × $79.99)
- **Payback Period**: <3 months
- **ROI**: 4:1 minimum

---

## 🎯 Success Milestones (2-Tier System)

### 📅 3-Month Goals

- 2,500 total users
- 200 paid subscribers
- **$2,200 MRR** (avg $11/user)
- 8% conversion rate

### 📅 6-Month Goals

- 5,000 total users
- 600 paid subscribers
- **$6,600 MRR** (~$79K ARR)
- 12% conversion rate

### 📅 12-Month Goals

- 10,000 total users
- 1,800 paid subscribers
- **$19,800 MRR** (~$238K ARR gross)
- 18% conversion rate
- 3 enterprise clients
- **Sustainable salary + growth budget**

---

## 🔄 Continuous Optimization

### 📊 A/B Testing Strategy

**Pricing Tests:**

- Monthly vs Annual positioning
- Free trial length (3 vs 7 vs 14 days)
- Exit offer discount percentage

**Conversion Tests:**

- Landing page variations
- Email subject lines
- Upgrade prompts timing
- Feature gating strategies

**Content Tests:**

- Blog post formats
- Video content styles
- Social media post types
- Email content variations

### 📈 Growth Hacking Tactics

**Viral Features:**

- Social sharing incentives
- Referral rewards
- Community challenges
- Achievement celebrations

**Retention Hooks:**

- Streak maintenance
- Goal progression
- Social connections
- Personalization depth

**Monetization Optimization:**

- Feature value communication
- Upgrade timing optimization
- Pricing psychology
- Value demonstration

---

## 🎁 IAP-Compliant Promotional Strategies

### Apple Offer Codes

**How to Create:**

1. App Store Connect → My Apps → FitNudge → Subscriptions
2. Create Offer Code → Set discount (% or fixed) and duration
3. Generate codes or one-time use URL
4. Distribute via email, social media, influencer partnerships

**Campaign Examples:**

- **New Year**: 50% off for 3 months (Code: NEWYEAR2025)
- **Influencer Partnership**: 1 month free (Code: FITINFLUENCER)
- **Re-engagement**: 2 months for $1.99 (Code: COMEBACK)

### Google Promo Codes

**How to Create:**

1. Play Console → FitNudge → Monetize → Subscriptions → Promo codes
2. Create promo code → Set discount and quantity
3. Download codes or generate one-time URLs
4. Distribute to users

### Introductory Offers

**Setup:**

- Configure in App Store Connect / Play Console
- Automatic for first-time subscribers
- No code needed

**Examples:**

- "First month $4.99, then $12.99/month" (Pro)
- "First 3 months 50% off"
- "3-day free trial, then $79.99/year" (Premium Annual default)

### Win-Back Offers

**For Lapsed Subscribers:**

- Apple: Create "Win-Back Offer" in App Store Connect
- Google: Create "Resubscribe Offer" in Play Console
- Automatically shown to users who cancelled

**Examples:**

- "Come back for 50% off for 2 months"
- "We miss you! First month free"

### Partnership Offers

**Gym Partnerships:**

- Create bulk offer codes for gym members
- Gym distributes codes to members
- Track redemptions via backend analytics

**Corporate Wellness:**

- Create enterprise offer codes
- Company distributes to employees
- Track usage and ROI

### What We CANNOT Do (App Store Compliance):

- ❌ Mention web pricing in the app
- ❌ Link to external payment pages
- ❌ Show "cheaper on web" messaging
- ❌ Use Stripe for iOS/Android subscriptions
- ❌ Verify .edu emails in-app (Apple restriction)

---

## 📊 Competitor Pricing Comparison (December 2024)

### High-End Habit/Productivity Apps

| App              | Monthly | Annual | Key Features                    |
| ---------------- | ------- | ------ | ------------------------------- |
| **Noom**         | $70     | $209   | Psychology coaching, meal plans |
| **Headspace**    | $12.99  | $69.99 | Meditation, mindfulness         |
| **Calm Premium** | $14.99  | $69.99 | Sleep, meditation, wellness     |

### Mid-Tier Habit Apps

| App                | Monthly | Annual | Key Features       |
| ------------------ | ------- | ------ | ------------------ |
| **Fabulous**       | $12.99  | $64.99 | Habit coaching     |
| **Fitbod**         | $12.99  | $79.99 | AI workout plans   |
| **Strava Premium** | $11.99  | $79.99 | Social + analytics |

### Budget Habit Apps

| App          | Monthly | Annual | Key Features         |
| ------------ | ------- | ------ | -------------------- |
| **Habitica** | $4.99   | $47.99 | Gamified habits      |
| **Streaks**  | FREE    | $4.99  | Simple habit tracker |

### FitNudge Positioning (2-Tier System)

| Tier        | Monthly | Annual | vs Competitors                      |
| ----------- | ------- | ------ | ----------------------------------- |
| **Free**    | $0      | $0     | Basic text motivation, 1 goal       |
| **Premium** | $9.99   | $79.99 | Full AI Chat, unlimited goals + all |

**Competitive Advantages:**

- Only app with AI Chat Motivation for any goal (unique feature worth premium)
- Priced competitively but with MORE AI features
- Psychology-based motivation like Noom at 1/7th the price ($70 vs $9.99)
- Social features + AI coaching combo (no competitor has this)
- Works for ANY goal - fitness, learning, meditation, productivity, etc.
- Simple 2-tier pricing = higher conversion (no decision paralysis)

---

## 🔧 Database Schema for Subscription Plans

Update your `subscription_plans` table with 2-tier pricing:

```sql
-- 2-Tier System: Free + Premium
-- See migration: apps/api/supabase/migrations/20251231000000_simplify_to_two_tiers.sql

-- Premium plan configuration
UPDATE subscription_plans SET
  monthly_price = 9.99,
  annual_price = 79.99,
  exit_offer_enabled = true,   -- Exit offer on Premium Annual
  exit_offer_annual_price = 39.99,  -- 50% off $79.99
  has_trial = true  -- 3-day trial on annual
WHERE id = 'premium';

-- Product IDs for RevenueCat/Store integration
UPDATE subscription_plans SET
  product_id_ios_monthly = 'com.fitnudge.premium.monthly',
  product_id_ios_annual = 'com.fitnudge.premium.annual',
  product_id_android_monthly = 'com.fitnudge.premium.monthly',
  product_id_android_annual = 'com.fitnudge.premium.annual'
WHERE id = 'premium';
```

---

_This marketing strategy is designed to grow FitNudge from 0 to 10,000+ users in Year 1, with a focus on sustainable growth, strong retention, and clear monetization paths while maintaining App Store compliance._

**Pricing locked until December 2026.** 🔒
