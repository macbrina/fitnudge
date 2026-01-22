# FitNudge Mobile App Testing Guide

This guide outlines features that require different users or user states for comprehensive testing.

---

## Table of Contents

- [Features Requiring Multiple Users](#features-requiring-multiple-users)
  - [Accountability Partners](#1-accountability-partners)
  - [Referral System](#2-referral-system)
- [Features Requiring Different User States](#features-requiring-different-user-states)
  - [Free vs Premium Users](#3-free-vs-premium-users)
  - [Exit Offer / Trial Eligibility](#4-exit-offer--trial-eligibility)
  - [Onboarding States](#5-onboarding-states)
  - [Authentication Providers](#6-authentication-providers)
  - [Push Notifications](#7-push-notifications)
  - [AI Coach](#8-ai-coach)
- [Recommended Test User Setup](#recommended-test-user-setup)
- [Quick Test Checklist](#quick-test-checklist)

---

## Features Requiring Multiple Users

### 1. Accountability Partners

Requires 2+ users to test the full partner flow.

| Test Case              | Steps                                              |
| ---------------------- | -------------------------------------------------- |
| Send partner request   | User A searches for User B → sends request         |
| Accept/decline request | User B receives notification → accepts or declines |
| View partner's goals   | Both users see each other's goals after accepting  |
| Send nudge             | User A taps nudge button on partner's goal         |
| Receive nudge          | User B gets push notification                      |
| Send cheer             | User A cheers partner's check-in                   |
| Remove partner         | Either user removes the partnership                |
| Block partner          | User blocks partner → verify blocked list          |

**Relevant Screens:**

- `FindPartnerScreen`
- `PartnersScreen`
- `PartnerDetailScreen`
- `BlockedPartnersScreen`

---

### 2. Referral System

Requires 2 users to test referral flow.

| Test Case             | Steps                                          |
| --------------------- | ---------------------------------------------- |
| Share referral code   | User A copies/shares referral code             |
| Sign up with referral | User B uses referral code during signup        |
| Referral reward       | Both users receive referral benefits           |
| Deep link referral    | User B clicks referral link → signup prefilled |

**Relevant Screens:**

- `ReferralScreen`
- `SignupScreen`

---

## Features Requiring Different User States

### 3. Free vs Premium Users

Test feature gating between subscription tiers.

| Feature                 | Free User                     | Premium User     |
| ----------------------- | ----------------------------- | ---------------- |
| Active goals            | Limited (`active_goal_limit`) | Unlimited        |
| Multiple reminder times | 1                             | Multiple         |
| AI Coach responses      | Upsell prompt                 | Full AI response |
| Voice notes             | Upsell prompt                 | Full feature     |
| Advanced analytics      | Limited                       | Full             |
| Weekly recaps           | Limited                       | Full             |
| Partner limit           | Limited                       | Unlimited        |
| Daily motivation styles | Basic                         | All styles       |

**Test with these user types:**

- Fresh free user (no subscription history)
- User who cancelled subscription
- Active premium subscriber

**Relevant Screens:**

- `SubscriptionScreen`
- `AICoachScreen`
- `AnalyticsScreen`
- `WeeklyRecapsScreen`
- `CreateGoalScreen`
- `CheckInModal`

---

### 4. Exit Offer / Trial Eligibility

Test exit offer display logic.

| Test Case             | User State                                           |
| --------------------- | ---------------------------------------------------- |
| Show exit offer       | Free user, never subscribed, never seen offer        |
| Hide exit offer       | User already used trial (`checkTrialEligibilityApi`) |
| Exit offer dismissed  | User dismissed once → shouldn't show again           |
| Floating offer button | Free user on HomeScreen                              |

**Relevant Screens:**

- `SubscriptionScreen`
- `ExitIntentModal`
- `FloatingOfferButton`
- `HomeScreen`

---

### 5. Onboarding States

Test different onboarding scenarios.

| Test Case                | User State                               |
| ------------------------ | ---------------------------------------- |
| Fresh signup             | New user → full onboarding flow          |
| Return user (incomplete) | User quit mid-onboarding → resume        |
| Return user (complete)   | User completed onboarding → skip to home |
| Social signup (new)      | Google/Apple new user → onboarding       |
| Social login (existing)  | Google/Apple existing user → home        |

**Relevant Screens:**

- `PersonalizationFlow`
- `NotificationPermissionScreen`
- `SubscriptionScreen`
- `LoginScreen`
- `SignupScreen`

---

### 6. Authentication Providers

Test all authentication methods.

| Test Case     | Steps                              |
| ------------- | ---------------------------------- |
| Email signup  | Full flow with email verification  |
| Email login   | Existing email user                |
| Google signup | New Google user                    |
| Google login  | Existing Google user               |
| Apple signup  | New Apple user (iOS only)          |
| Apple login   | Existing Apple user                |
| Link accounts | Link Google/Apple to email account |

**Relevant Screens:**

- `LoginScreen`
- `SignupScreen`
- `LinkedAccountsScreen`
- `VerifyEmailScreen`

---

### 7. Push Notifications

Requires real device for full testing.

| Test Case         | Trigger                        |
| ----------------- | ------------------------------ |
| Check-in reminder | Scheduled reminder time        |
| Partner nudge     | Partner sends nudge            |
| Partner cheer     | Partner cheers check-in        |
| Partner request   | Someone sends partner request  |
| Partner accepted  | Partner request accepted       |
| Daily motivation  | Morning motivation time        |
| Streak at risk    | Missed check-in warning        |
| AI Coach response | AI generates check-in feedback |

**Relevant Screens:**

- `NotificationsScreen`
- `NotificationSettingsScreen`

---

### 8. AI Coach

Test AI features across subscription tiers.

| Test Case            | User State                      | Expected Behavior            |
| -------------------- | ------------------------------- | ---------------------------- |
| Free user - upsell   | Free user opens check-in detail | Show upgrade prompt          |
| Premium - generating | Check-in done, AI pending       | Show "AI generating" message |
| Premium - response   | AI response available           | Show AI response             |
| Chat feature         | Premium user                    | Full AI chat access          |

**Relevant Screens:**

- `AICoachScreen`
- `CheckInDetailModal`

---

## Recommended Test User Setup

| User       | Purpose             | Subscription            | Partner        |
| ---------- | ------------------- | ----------------------- | -------------- |
| **User A** | Primary free user   | Free (never subscribed) | Partner with B |
| **User B** | Secondary free user | Free (never subscribed) | Partner with A |
| **User C** | Premium user        | Active premium          | —              |
| **User D** | Cancelled user      | Had premium, now free   | —              |
| **User E** | Trial used          | Used trial, now free    | —              |
| **User F** | Fresh signup        | New account             | —              |

---

## Quick Test Checklist

### Auth Flow

- [ ] Email signup → email verification
- [ ] Email login
- [ ] Google signup/login
- [ ] Apple signup/login (iOS)
- [ ] Forgot password flow
- [ ] Logout clears all data
- [ ] Inputs disabled during loading

### Onboarding

- [ ] Full flow completes successfully
- [ ] Back navigation works on all steps
- [ ] Resume after app kill (persisted state)
- [ ] Translations display correctly (no hardcoded text)
- [ ] Skip option works where applicable

### Subscription

- [ ] Free user sees feature limits
- [ ] Premium user sees full features
- [ ] Exit offer shows for eligible users
- [ ] Exit offer hidden for trial-used users
- [ ] Purchase flow completes
- [ ] Restore purchases works
- [ ] Subscription modal opens from upsell prompts

### Goals

- [ ] Create goal (free limit enforced)
- [ ] Edit goal
- [ ] Archive/unarchive goal
- [ ] Delete goal
- [ ] Check-in flow (complete/skip/rest day)
- [ ] Reminder times work
- [ ] Voice note recording (premium)

### Partners

- [ ] Search and find user by username
- [ ] Send partner request
- [ ] Receive partner request notification
- [ ] Accept/decline requests
- [ ] View partner's goals and progress
- [ ] Nudge partner
- [ ] Cheer partner's check-in
- [ ] Remove partner
- [ ] Block partner

### Notifications

- [ ] Permission request on first launch
- [ ] Reminder notifications fire at scheduled time
- [ ] Partner notifications arrive
- [ ] Tap notification → navigates to correct screen
- [ ] Notification settings toggle works

### AI Features

- [ ] Free user sees upsell in check-in detail
- [ ] Premium user sees "AI generating" when pending
- [ ] Premium user sees AI response when ready
- [ ] AI chat works for premium users
- [ ] Chat history persists

### Referral

- [ ] Copy referral code
- [ ] Share referral link
- [ ] Sign up with referral code (prefilled)
- [ ] Referral rewards applied

### Profile & Settings

- [ ] Edit profile (name, bio, photo)
- [ ] Change notification settings
- [ ] Link/unlink social accounts
- [ ] View analytics (premium features gated)
- [ ] View weekly recaps
- [ ] Export data
- [ ] Delete account

---

## Device-Specific Tests

### iOS Only

- [ ] Apple Sign-In
- [ ] App Store purchase flow
- [ ] iOS notifications

### Android Only

- [ ] Google Play purchase flow
- [ ] Android notifications
- [ ] Back button behavior

### Real Device Only

- [ ] Push notifications
- [ ] Background notification scheduling
- [ ] Voice recording
- [ ] Camera/gallery access for profile photo

---

## Notes

- Use two physical devices or one device + simulator for partner testing
- Clear AsyncStorage/MMKV between test runs for clean state: Settings → Apps → FitNudge → Clear Data
- For subscription testing, use sandbox/test accounts in App Store Connect / Google Play Console
- Check console logs for any errors during testing
