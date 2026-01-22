# Accountability Partners Guide

This document explains how accountability partners work in FitNudge. Use this as a reference for implementation and help center content.

---

## Table of Contents

1. [Overview](#overview)
2. [Accountability Partners](#accountability-partners)
3. [Social Nudges & Cheers](#social-nudges--cheers)
4. [Feature Access by Plan](#feature-access-by-plan)
5. [Push Notifications](#push-notifications)
6. [Database Schema](#database-schema)
7. [Help Center FAQs](#help-center-faqs)

---

## Overview

FitNudge offers accountability partnerships for mutual motivation:

| Feature                     | Purpose               | Access  |
| --------------------------- | --------------------- | ------- |
| **Accountability Partners** | 1-on-1 mutual support | Premium |
| **Cheers & Nudges**         | Encourage partners    | Premium |
| **Partner Check-in Alerts** | See partner progress  | Premium |

> **Important Notes:**
>
> - There is **no follows/following system** in FitNudge
> - All social connections are made through **accountability partners**
> - Partners can see each other's check-in activity and send encouragement

---

## Accountability Partners

### What Are Partners?

Partners are users who've mutually agreed to support each other. When you become partners:

- You can see when they check in
- You can send cheers (congratulations) and nudges (reminders)
- You get notified of their streak milestones
- Your AI coach may reference your partner activity for motivation

### Partner Request Flow

```
┌─────────────┐    Send Request    ┌─────────────┐
│   User A    │ ─────────────────▶ │   User B    │
│ (Requester) │                    │ (Recipient) │
└─────────────┘                    └─────────────┘
                                          │
                              ┌───────────┴───────────┐
                              ▼                       ▼
                         ┌─────────┐            ┌─────────┐
                         │ Accept  │            │ Decline │
                         └────┬────┘            └────┬────┘
                              │                      │
                              ▼                      ▼
                    ┌─────────────────┐    ┌─────────────────┐
                    │  Now Partners!  │    │ Request Removed │
                    │ (status:active) │    │                 │
                    └─────────────────┘    └─────────────────┘
```

### Partner Statuses

| Status     | Meaning                         |
| ---------- | ------------------------------- |
| `pending`  | Request sent, awaiting response |
| `active`   | Mutually connected as partners  |
| `declined` | Request was declined            |
| `blocked`  | User has blocked the other      |

### Finding Partners

Users can find partners by:

1. **Username search** - Search for a specific username
2. **Invite link** - Share a link (future feature)

### Partner Limits

| Plan    | Partner Limit |
| ------- | ------------- |
| Free    | 0 (disabled)  |
| Premium | Unlimited     |

---

## Social Nudges & Cheers

### Types of Social Interactions

| Type             | Purpose                       | When to Use                          |
| ---------------- | ----------------------------- | ------------------------------------ |
| **Cheer** 👏     | Celebrate partner's check-in  | When partner completes a check-in    |
| **Nudge** 💪     | Remind partner to check in    | When partner hasn't checked in today |
| **Celebrate** 🎉 | Celebrate partner's milestone | When partner hits streak milestone   |

### Cheer Flow

```
Partner A checks in → Partner B gets notification → Partner B taps "👏 Cheer Back"
                                                           │
                                                           ▼
                                                  Partner A gets cheer!
```

### Nudge Flow

```
Partner A hasn't checked in → Partner B taps "Nudge" → Partner A gets push notification
                                                              │
                                                              ▼
                                                    "💪 [Partner B] is nudging you!"
```

### Rate Limiting

- **Cheers**: 1 per check-in per user
- **Nudges**: 1 per partner per day

---

## Feature Access by Plan

### Free Plan

| Feature              | Access |
| -------------------- | ------ |
| Find partners        | ❌     |
| Send partner request | ❌     |
| Accept requests      | ❌     |
| Send cheers/nudges   | ❌     |
| See partner activity | ❌     |

### Premium Plan

| Feature              | Access |
| -------------------- | ------ |
| Find partners        | ✅     |
| Send partner request | ✅     |
| Accept requests      | ✅     |
| Send cheers/nudges   | ✅     |
| See partner activity | ✅     |
| Partner insights     | ✅     |

---

## Push Notifications

### Partner-Related Notifications

| Event                    | Recipient      | Message Example                                    |
| ------------------------ | -------------- | -------------------------------------------------- |
| Partner request received | Recipient      | "👋 Sarah wants to be your accountability partner" |
| Partner request accepted | Requester      | "🎉 Sarah accepted your partner request!"          |
| Partner checked in       | Partner        | "✅ Sarah just completed their workout!"           |
| Partner hit milestone    | Partner        | "🔥 Sarah just hit a 7-day streak!"                |
| Received cheer           | Check-in owner | "👏 Sarah cheered your check-in!"                  |
| Received nudge           | Recipient      | "💪 Sarah is nudging you to check in!"             |

### Notification Action Buttons

Partner activity notifications include:

- **👏 Cheer Back** - Quickly cheer without opening app

---

## Database Schema

### accountability_partners

```sql
CREATE TABLE accountability_partners (
    id UUID PRIMARY KEY,
    requester_id UUID NOT NULL REFERENCES users(id),
    recipient_id UUID NOT NULL REFERENCES users(id),
    status TEXT DEFAULT 'pending',  -- pending, active, declined, blocked
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(requester_id, recipient_id)
);
```

### nudges

```sql
CREATE TABLE nudges (
    id UUID PRIMARY KEY,
    sender_id UUID NOT NULL REFERENCES users(id),
    recipient_id UUID NOT NULL REFERENCES users(id),
    nudge_type TEXT NOT NULL,  -- cheer, nudge, celebrate
    message TEXT,
    goal_id UUID REFERENCES goals(id),
    check_in_id UUID REFERENCES check_ins(id),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### user_reports

```sql
CREATE TABLE user_reports (
    id UUID PRIMARY KEY,
    reporter_id UUID NOT NULL REFERENCES users(id),
    reported_user_id UUID NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,  -- inappropriate_username, harassment, spam, other
    details TEXT,
    status TEXT DEFAULT 'pending',  -- pending, reviewed, resolved, dismissed
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Help Center FAQs

### What are accountability partners?

Accountability partners are other FitNudge users who've agreed to support each other. You can see when they check in, send them encouragement, and get motivated by their progress.

### How do I find an accountability partner?

1. Go to **Profile** → **Partners**
2. Tap **Find Partner**
3. Search by username
4. Send a request

### Can I have multiple partners?

Yes! Premium users can have unlimited accountability partners.

### What happens when I get a partner request?

You'll receive a push notification and see the request in your Partners screen. You can accept or decline. Accepting means you'll be able to see each other's activity.

### What are cheers and nudges?

- **Cheers** 👏 are congratulations you send when your partner checks in
- **Nudges** 💪 are friendly reminders you send when your partner hasn't checked in

### Can I block or report a partner?

Yes. Tap on the partner's name, then select:

- **Block** - They can't contact you or see your activity
- **Report** - Flag inappropriate behavior for review

### Do partners see all my goals?

Partners can see your check-in activity, but not the details of your reflections or voice notes. Your AI Coach conversations are always private.
