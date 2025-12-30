# Social & Challenge Features Guide

This document explains how social accountability and challenges work in FitNudge. Use this as a reference for implementation and help center content.

---

## Table of Contents

1. [Overview](#overview)
2. [Feature Summary](#feature-summary)
3. [Accountability Partners](#1-accountability-partners)
4. [Challenges](#2-challenges-competitive)
   - [Standalone Challenges](#21-standalone-challenges)
   - [Challenge Lifecycle](#22-challenge-lifecycle)
5. [Check-In Systems](#3-check-in-systems)
6. [Feature Access by Plan](#4-feature-access-by-plan)
7. [GoalCard Menu Items](#5-goalcard-menu-items)
8. [Database Schema](#6-database-schema)
9. [Social Nudges & Motivation](#7-social-nudges--motivation)
10. [Push Notifications](#8-push-notifications)
11. [AI Integration](#9-ai-integration)
12. [Implementation Priority](#10-implementation-priority)
13. [Help Center FAQs](#help-center-faqs)

---

## Overview

FitNudge offers several ways for users to connect and stay motivated:

| Feature                     | Purpose               | Competition?      |
| --------------------------- | --------------------- | ----------------- |
| **Accountability Partners** | 1-on-1 mutual support | No                |
| **Challenges**              | Compete with others   | Yes (leaderboard) |

> **Important Notes:**
>
> - There is **no follows/following system** in FitNudge
> - All social connections are made through **accountability partners** or **challenge invitations**
> - To invite someone to a challenge, you send them a partner request or share an invite link

---

## Feature Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        SOCIAL FEATURES                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Accountability Partners        Challenges (Competitive)        │
│  ┌─────┐    ┌─────┐            ┌─────────────────┐            │
│  │User │◄──►│User │            │   SAME CHALLENGE │            │
│  │  A  │    │  B  │            │  ┌───┐ ┌───┐    │            │
│  └─────┘    └─────┘            │  │ A │ │ B │    │            │
│  Mutual visibility             │  └───┘ └───┘    │            │
│  Each has own goals            │  A: 25  B: 20   │            │
│                                 │  🏆 Leaderboard │            │
│                                 └─────────────────┘            │
│                                 Everyone competes               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Accountability Partners

### What It Is

A "fitness buddy" system where two users support each other by having mutual visibility into each other's goals and progress.

### How It Works

1. User A sends a partner request to User B
2. User B receives a notification
3. User B accepts (or declines) the request
4. If accepted, both users can see each other's:
   - All active goals
   - Check-in history
   - Streaks and progress

### Check-Ins

- **No change to check-in system**
- Each person checks into their OWN goals
- Partners just have visibility, not shared work

### Database Table

```sql
accountability_partners
- user_id
- partner_user_id
- status: 'pending' | 'accepted' | 'rejected' | 'blocked'
- initiated_by_user_id
```

### User Experience

```
John's App:
┌────────────────────────────┐
│ 👥 Accountability Partner  │
│ ─────────────────────────  │
│ Jane (Partner)             │
│ • 3 active goals           │
│ • 🔥 15 day streak         │
│ • Last check-in: Today     │
└────────────────────────────┘
```

---

## 2. Challenges (Competitive)

### 2.1 Standalone Challenges

#### What It Is

Challenges are **standalone competitive entities** separate from goals. Users create challenges directly with all necessary properties.

#### How It Works

**Step 1: User Creates Challenge Directly**

```
User creates challenge:
- Title: "30 Day Fitness Challenge"
- challenge_type: 'streak' or 'checkin_count'
- category: 'fitness', 'nutrition', etc.
- tracking_type: 'workout', 'meal', 'hydration', 'checkin'
- duration_days: 30
- start_date, end_date
```

**Step 2: AI Generates Plan**

- Challenge gets its own actionable plan
- Plan is generated based on challenge properties
- Stored directly in `actionable_plans` table with `challenge_id`

**Step 3: Others Join**

```
Friends see challenge:
- Can join BEFORE start date (or within grace period)
- Added to challenge_participants
```

**Step 4: Everyone Checks In**

```
All participants (including creator):
- Check into challenge_check_ins table
- Leaderboard updates automatically
```

#### Challenge Types

| Type            | Description                          | Example                    |
| --------------- | ------------------------------------ | -------------------------- |
| `streak`        | Complete within a time period        | "30 Day Workout Challenge" |
| `checkin_count` | Reach a specific number of check-ins | "Complete 50 Workouts"     |

#### Tracking Types

| Type       | Description            | Check-in UI         |
| ---------- | ---------------------- | ------------------- |
| `workout`  | Fitness activities     | Workout player      |
| `meal`     | Nutrition tracking     | Meal logging modal  |
| `hydration`| Water intake tracking  | Hydration modal     |
| `checkin`  | General habit tracking | Simple check-in     |

#### Check-Ins

- **All participants check into `challenge_check_ins`**
- Tracking type determines the check-in UI/experience
- Leaderboard is calculated from check-ins

#### Database Tables

```sql
challenges
- id
- title, description
- category (fitness, nutrition, mindfulness, etc.)
- tracking_type (workout, meal, hydration, checkin)
- challenge_type: 'streak' | 'checkin_count'
- duration_days
- start_date, end_date
- join_deadline (when joining closes)
- is_public, is_active
- max_participants
- created_by

challenge_participants
- challenge_id
- user_id
- joined_at
- points, rank
- progress_data (JSONB)

challenge_check_ins
- challenge_id
- user_id
- check_in_date
- notes, mood
- UNIQUE(challenge_id, user_id, check_in_date)
```

---

### 2.2 Challenge Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHALLENGE LIFECYCLE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  UPCOMING              ACTIVE                 COMPLETED         │
│  (before start)        (in progress)          (after end)       │
│                                                                 │
│  ✅ Can join           ❌ Cannot join         ❌ Cannot join    │
│  ❌ Cannot check-in    ✅ Can check-in        ❌ Cannot check-in│
│                                                                 │
│  ──────────────────────────────────────────────────────────►   │
│  │                     │                      │                 │
│  start_date            │                      end_date          │
│                        │                                        │
│                   join_deadline                                 │
│                   (optional grace period)                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Status Transitions

| Current Status | When               | New Status  |
| -------------- | ------------------ | ----------- |
| `upcoming`     | start_date reached | `active`    |
| `active`       | end_date reached   | `completed` |

#### Late Joiners Policy

**Recommendation: Lock after start (simplest)**

- Once `start_date` passes → No new participants
- Everyone follows the same dates
- No "fresh start" option (too complex)
- Optional: Allow grace period (join within first X days)

#### When Challenge Ends

1. Status changes to `completed`
2. No more check-ins accepted
3. Leaderboard is frozen
4. Winner can be announced
5. Achievements/badges can be awarded

#### Challenge Management Actions

| Action     | Endpoint                       | Who Can Do It              | When Allowed          | What Happens                      |
| ---------- | ------------------------------ | -------------------------- | --------------------- | --------------------------------- |
| **Cancel** | `POST /challenges/{id}/cancel` | Creator only               | Anytime               | `is_active=false`, data preserved |
| **Delete** | `DELETE /challenges/{id}`      | Creator only               | No other participants | Permanent removal                 |
| **Leave**  | `POST /challenges/{id}/leave`  | Participants (not creator) | Anytime               | Removed from challenge            |

**Cancel Challenge:**

- Creator deactivates the challenge before it naturally ends
- All data is preserved (participants, check-ins, leaderboard)
- Participants are notified
- Optional `reason` can be provided

**Delete Challenge:**

- Permanently removes the challenge and all associated data
- Only allowed if no one else has joined
- If others joined, must use Cancel instead

**Leave Challenge:**

- Participant removes themselves from a challenge
- Creator cannot leave (must cancel instead)
- Participant's check-ins are deleted
- No longer counts toward their `challenge_join_limit`

---

## 3. Check-In Systems

### Summary Table

| Feature                 | Check-In Table        | Who Checks In        |
| ----------------------- | --------------------- | -------------------- |
| Regular Goal            | `check_ins`           | Owner only           |
| Accountability Partners | `check_ins`           | Each their own goals |
| Private Challenge       | `check_ins`           | Owner only           |
| Shared Challenge        | `challenge_check_ins` | All participants     |

### Database Table: challenge_check_ins

```sql
CREATE TABLE challenge_check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    check_in_date DATE NOT NULL,
    notes TEXT,
    mood TEXT CHECK (mood IN ('great', 'good', 'okay', 'bad', 'terrible')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(challenge_id, user_id, check_in_date)
);
```

---

## 4. Feature Access by Plan

Feature access is controlled by the `plan_features` database table. All access checks should use the `check_user_has_feature()` function.

### Feature Keys

| Feature Key             | Description                  | Minimum Tier |
| ----------------------- | ---------------------------- | ------------ |
| `challenge_create`      | Create and share challenges  | Starter (1)  |
| `social_accountability` | Find accountability partners | Starter (1)  |

### Limits by Plan

| Feature                 | Free | Starter | Pro | Elite |
| ----------------------- | ---- | ------- | --- | ----- |
| Goals (create)          | 1    | 3       | ∞   | ∞     |
| Active Goals/Challenges | 1    | 3       | 5   | ∞     |
| Challenge Join          | 1    | 2       | 3   | 3     |

**Important:** Goals and challenges **share the same active limit**. This prevents users from gaming the system by creating unlimited challenges instead of goals.

### Combined Active Limit

```python
# Active count = goals + challenges I created
active_count = (
    count(goals where is_active=true) +
    count(challenges where created_by=me AND is_active=true)
)

# Must not exceed plan limit
if active_count >= active_goal_limit:
    raise "Limit reached"
```

### Challenge Join Limit

The `challenge_join_limit` controls how many challenges (created by others) a user can participate in simultaneously:

- **Free:** 1 challenge at a time
- **Starter:** 2 challenges at a time
- **Pro/Elite:** 3 challenges at a time

Note: Challenges you CREATE don't count toward this limit - they count toward your active goal limit instead.

### Access Check Example

```python
# Backend
from app.services.feature_inventory import check_user_has_feature

if not check_user_has_feature(user_id, "challenge_create", user_plan):
    raise HTTPException(403, "Upgrade to access challenges")
```

```typescript
// Mobile
const canCreateChallenge = subscriptionStore.hasFeature("challenge_create");
```

---

## 5. GoalCard Menu Items

### For ALL Goals

```
• Activate Goal     (if goal is inactive)
• Deactivate Goal   (if goal is active)
• Archive Goal
• Delete Goal
```

**Activation Logic:**

- Check `active_goal_limit` from subscription features (includes both goals + challenges)
- If user is at limit → Show alert: "You can only have X active goals/challenges. Deactivate one first."

**Deletion Logic:**

Users can delete any goal, including those with check-ins. However, the frontend should warn users that their progress data will be permanently lost and suggest archiving instead.

| Goal State    | Can Delete? | Frontend Warning                                                         |
| ------------- | ----------- | ------------------------------------------------------------------------ |
| No check-ins  | ✅ Yes      | No warning needed                                                        |
| Has check-ins | ✅ Yes      | "Your progress will be permanently deleted. Consider archiving instead." |

### Menu Visibility Logic

```typescript
const menuOptions = [];

// Always available
if (goal.status === "active") {
  menuOptions.push({ id: "deactivate", label: "Deactivate Goal" });
} else if (goal.status === "paused") {
  menuOptions.push({ id: "activate", label: "Activate Goal" });
}

// Archive option
if (goal.status !== "archived") {
  menuOptions.push({ id: "archive", label: "Archive Goal" });
} else {
  menuOptions.push({ id: "unarchive", label: "Unarchive Goal" });
}

// Delete (always last)
menuOptions.push({ id: "delete", label: "Delete Goal", destructive: true });
```

---

## 6. Database Schema

### Core Tables

- `accountability_partners` ✅ - Used for all partner/friend connections and challenge invitations
- `challenges` ✅
- `challenge_participants` ✅
- `challenge_leaderboard` ✅
- `challenge_check_ins` ✅

> **Note:** There are no `goal_shares` or `follows` tables. All social connections are managed through the `accountability_partners` table.

### Database Table: accountability_partners

This table is the **single source of truth** for all social connections:

```sql
accountability_partners
- id UUID PRIMARY KEY
- user_id UUID                    -- User who initiated
- partner_user_id UUID            -- User who receives request
- status: 'pending' | 'accepted' | 'rejected' | 'blocked'
- initiated_by_user_id UUID       -- Track who sent the request
- scope: 'global' | 'goal' | 'challenge'  -- Context of partnership
- goal_id UUID (optional)         -- If scoped to a specific goal
- challenge_id UUID (optional)    -- If scoped to a specific challenge
- invite_code TEXT (optional)     -- For shareable invite links
- created_at, accepted_at, updated_at
```

### How Partner Invitations Work

1. **Direct Partner Request**: User A sends request to User B → creates `accountability_partners` record with `status: 'pending'`
2. **Invite Link**: User A generates shareable link → creates placeholder record with `invite_code`
3. **Challenge Invitation**: Same flow as partner request but with `scope: 'challenge'` and `challenge_id` set

### Database Table: challenge_check_ins

```sql
CREATE TABLE challenge_check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    check_in_date DATE NOT NULL,
    notes TEXT,
    mood TEXT CHECK (mood IN ('great', 'good', 'okay', 'bad', 'terrible')),
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(challenge_id, user_id, check_in_date)
);

-- Indexes
CREATE INDEX idx_challenge_check_ins_challenge_id ON challenge_check_ins(challenge_id);
CREATE INDEX idx_challenge_check_ins_user_id ON challenge_check_ins(user_id);
CREATE INDEX idx_challenge_check_ins_date ON challenge_check_ins(check_in_date);

-- RLS
ALTER TABLE challenge_check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view challenge check-ins for challenges they're in"
ON challenge_check_ins FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM challenge_participants cp
        WHERE cp.challenge_id = challenge_check_ins.challenge_id
        AND cp.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM challenges c
        WHERE c.id = challenge_check_ins.challenge_id
        AND c.is_public = true
    )
);

CREATE POLICY "Users can create their own challenge check-ins"
ON challenge_check_ins FOR INSERT
WITH CHECK (user_id = auth.uid());
```

---

## 7. Social Nudges & Motivation

Social nudges allow users to motivate each other across all social features. This is crucial for engagement and retention.

### Motivation Mechanics by Feature

#### Accountability Partners

| Mechanic               | Description                       | Trigger                                    |
| ---------------------- | --------------------------------- | ------------------------------------------ |
| **Nudge**              | "Hey, have you checked in today?" | Manual or auto (if partner missed 2+ days) |
| **Cheer**              | "🎉 Great job!" quick reaction    | When partner checks in                     |
| **Streak Celebration** | "Jane hit a 7-day streak!"        | Automatic milestone                        |
| **Custom Message**     | Send personalized encouragement   | Manual                                     |

#### Challenges (Competitive)

| Mechanic               | Description                        | Trigger         |
| ---------------------- | ---------------------------------- | --------------- |
| **Leaderboard Update** | "John just took 1st place!"        | Automatic       |
| **Competitive Nudge**  | "You're 2 check-ins behind Jane!"  | Automatic/daily |
| **Taunt/Challenge**    | "Think you can beat me? 😏"        | Manual          |
| **Final Sprint Alert** | "3 days left! You're in 3rd place" | Automatic       |

### Database Table: `social_nudges`

```sql
CREATE TABLE social_nudges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Who and where
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Context (one of these will be set)
    goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    partnership_id UUID REFERENCES accountability_partners(id) ON DELETE CASCADE,

    -- Content
    nudge_type TEXT NOT NULL CHECK (nudge_type IN (
        'nudge',           -- Reminder to check in
        'cheer',           -- Quick encouragement
        'milestone',       -- Celebrating achievement
        'competitive',     -- Competitive banter
        'custom'           -- Custom message
    )),
    message TEXT,                    -- Custom message (optional)
    emoji TEXT,                      -- Quick reaction emoji
    is_ai_generated BOOLEAN DEFAULT false,

    -- Status
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Rate limiting
    nudge_date DATE DEFAULT CURRENT_DATE
);

-- Indexes
CREATE INDEX idx_social_nudges_recipient ON social_nudges(recipient_id, is_read, created_at DESC);
CREATE INDEX idx_social_nudges_sender ON social_nudges(sender_id, created_at DESC);
CREATE INDEX idx_social_nudges_goal ON social_nudges(goal_id) WHERE goal_id IS NOT NULL;
CREATE INDEX idx_social_nudges_challenge ON social_nudges(challenge_id) WHERE challenge_id IS NOT NULL;

-- Rate limiting: Only 1 nudge per sender-recipient pair per day
CREATE UNIQUE INDEX idx_nudge_daily_limit
ON social_nudges(sender_id, recipient_id, nudge_type, nudge_date)
WHERE nudge_type = 'nudge';

-- RLS
ALTER TABLE social_nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view nudges sent to them"
ON social_nudges FOR SELECT
USING (recipient_id = auth.uid() OR sender_id = auth.uid());

CREATE POLICY "Users can create nudges"
ON social_nudges FOR INSERT
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can mark their nudges as read"
ON social_nudges FOR UPDATE
USING (recipient_id = auth.uid());
```

### Rate Limiting

To prevent spam:

| Nudge Type    | Limit                      |
| ------------- | -------------------------- |
| `nudge`       | 1 per day per recipient    |
| `cheer`       | 1 per check-in (unlimited) |
| `competitive` | 3 per day per recipient    |
| `custom`      | 5 per day per recipient    |
| `milestone`   | Automatic only             |

### UI Components

#### Quick Actions on Partner/Member Card

```
┌────────────────────────────┐
│ 👤 Jane (Partner)          │
│ 🔥 15 day streak           │
│ Last check-in: Today       │
│                            │
│ [👋 Nudge] [🎉 Cheer] [💬] │
└────────────────────────────┘
```

#### Notification Feed

```
┌────────────────────────────┐
│ 🔔 Social Activity         │
│ ─────────────────────────  │
│ 👋 John nudged you         │
│    "Let's go! Check in!"   │
│                            │
│ 🎉 Jane cheered your       │
│    check-in!               │
│                            │
│ 🏆 Mike took 1st place     │
│    in "30 Day Challenge"   │
└────────────────────────────┘
```

#### AI-Suggested Nudges (Pro+)

```
┌────────────────────────────┐
│ 💡 Suggested Nudge         │
│ ─────────────────────────  │
│ Jane hasn't checked in     │
│ for 2 days. Send a nudge?  │
│                            │
│ "Hey Jane! Miss seeing     │
│  your check-ins! 💪"       │
│                            │
│ [Send] [Customize] [Skip]  │
└────────────────────────────┘
```

### Feature Access

| Feature             | Who Can Use                                                   |
| ------------------- | ------------------------------------------------------------- |
| Send Nudge          | Anyone with the relationship (partner, challenge participant) |
| AI-Generated Nudges | Pro+ (ties into AI features)                                  |
| Custom Messages     | All users                                                     |

---

## 8. Push Notifications

Push notifications are essential for engagement in social features. All social interactions trigger notifications.

### Notification Types by Feature

#### Accountability Partners

| Event                         | Push Notification                                           | Priority |
| ----------------------------- | ----------------------------------------------------------- | -------- |
| Partner request received      | "👋 John wants to be your accountability partner"           | High     |
| Partner request accepted      | "🎉 Jane accepted your partner request!"                    | High     |
| Partner nudges you            | "👋 John: Have you checked in today?"                       | Medium   |
| Partner cheers your check-in  | "🎉 John cheered your workout!"                             | Low      |
| Partner hits streak milestone | "🔥 Jane hit a 7-day streak!"                               | Low      |
| Partner missed 2+ days        | "💙 Jane hasn't checked in for 2 days. Send encouragement?" | Low      |

#### Challenges

| Event                         | Push Notification                           | Priority |
| ----------------------------- | ------------------------------------------- | -------- |
| Invited to challenge          | "🏆 John invited you to '30 Day Challenge'" | High     |
| Someone joined your challenge | "🙌 Jane joined your challenge!"            | Medium   |
| You got overtaken             | "😱 Jane just passed you! You're now #3"    | Medium   |
| You took the lead             | "👑 You're now in 1st place!"               | Medium   |
| Competitive nudge             | "🏃 John: Think you can catch up? 😏"       | Medium   |
| Challenge starts tomorrow     | "⏰ '30 Day Challenge' starts tomorrow!"    | High     |
| Challenge ending soon         | "⏰ 3 days left! You're in #2 place"        | High     |
| Challenge ended               | "🏆 Challenge complete! You finished #2!"   | High     |

### Notification Templates

```python
# Backend notification templates
SOCIAL_NOTIFICATION_TEMPLATES = {
    # Accountability Partners
    "partner_request": "👋 {sender_name} wants to be your accountability partner",
    "partner_accepted": "🎉 {sender_name} accepted your partner request!",
    "partner_nudge": "👋 {sender_name}: {message}",
    "partner_cheer": "🎉 {sender_name} cheered your check-in!",
    "partner_streak": "🔥 Your partner {sender_name} just hit a {count}-day streak!",
    "partner_inactive": "💙 {sender_name} hasn't checked in for {days} days. Send encouragement?",

    # Challenges
    "challenge_invite": "🏆 {sender_name} invited you to '{challenge_title}'",
    "challenge_joined": "🙌 {sender_name} joined your challenge!",
    "challenge_overtaken": "😱 {sender_name} just passed you! You're now #{rank}",
    "challenge_lead": "👑 You're now in 1st place!",
    "challenge_nudge": "🏃 {sender_name}: {message}",
    "challenge_starting": "⏰ '{challenge_title}' starts tomorrow!",
    "challenge_ending": "⏰ {days} days left in '{challenge_title}'! You're #{rank}",
    "challenge_ended": "🏆 '{challenge_title}' complete! You finished #{rank}!",

}
```

### User Notification Preferences

Users can control what they receive. Add to `notification_preferences` table:

```sql
-- Add social notification preferences
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS social_partner_requests BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS social_partner_nudges BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS social_partner_cheers BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS social_partner_milestones BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS social_challenge_invites BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS social_challenge_leaderboard BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS social_challenge_nudges BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS social_challenge_reminders BOOLEAN DEFAULT true;
```

### Notification Preferences UI

```
┌────────────────────────────────────────┐
│ 🔔 Social Notifications                │
├────────────────────────────────────────┤
│                                        │
│ ACCOUNTABILITY PARTNERS                │
│ ─────────────────────────────────────  │
│ Partner requests           [✓]         │
│ Nudges from partners       [✓]         │
│ Cheers on check-ins        [✓]         │
│ Partner milestones         [✓]         │
│                                        │
│ CHALLENGES                             │
│ ─────────────────────────────────────  │
│ Challenge invitations      [✓]         │
│ Leaderboard updates        [✓]         │
│ Competitive nudges         [✓]         │
│ Start/end reminders        [✓]         │
│                                        │
└────────────────────────────────────────┘
```

### Backend Integration

```python
# In notification service
from enum import Enum

class SocialNotificationType(Enum):
    # Partners
    PARTNER_REQUEST = "partner_request"
    PARTNER_ACCEPTED = "partner_accepted"
    PARTNER_NUDGE = "partner_nudge"
    PARTNER_CHEER = "partner_cheer"
    PARTNER_MILESTONE = "partner_milestone"
    PARTNER_INACTIVE = "partner_inactive"

    # Challenges
    CHALLENGE_INVITE = "challenge_invite"
    CHALLENGE_JOINED = "challenge_joined"
    CHALLENGE_OVERTAKEN = "challenge_overtaken"
    CHALLENGE_LEAD = "challenge_lead"
    CHALLENGE_NUDGE = "challenge_nudge"
    CHALLENGE_STARTING = "challenge_starting"
    CHALLENGE_ENDING = "challenge_ending"
    CHALLENGE_ENDED = "challenge_ended"


async def send_social_notification(
    notification_type: SocialNotificationType,
    recipient_id: str,
    sender_id: str,
    data: dict,
    supabase
):
    """Send a social notification if user has enabled it."""

    # Check user preferences
    prefs = await get_notification_preferences(recipient_id, supabase)
    pref_key = f"social_{notification_type.value}"

    if not prefs.get(pref_key, True):
        return  # User disabled this notification type

    # Get template and format message
    template = SOCIAL_NOTIFICATION_TEMPLATES[notification_type.value]
    message = template.format(**data)

    # Determine entity_type and entity_id for notification_history tracking
    # This allows handling deleted entities gracefully on the frontend
    entity_type = None
    entity_id = None

    if notification_type.value.startswith("challenge_"):
        entity_type = "challenge"
        entity_id = data.get("challenge_id")
    elif notification_type.value.startswith("partner_"):
        entity_type = "partner_request"
        entity_id = data.get("request_id")

    # Send push notification
    await send_push_to_user(
        user_id=recipient_id,
        title=get_notification_title(notification_type),
        body=message,
        data={
            "type": notification_type.value,
            "sender_id": sender_id,
            **data
        },
        notification_type=notification_type.value,
        entity_type=entity_type,  # For tracking deleted entities
        entity_id=entity_id,
    )
```

### Entity Reference Pattern

All notifications are stored in `notification_history` with optional entity references:

```sql
-- Generic entity reference (NO foreign keys for flexibility)
entity_type TEXT,  -- 'goal', 'challenge', 'post', 'achievement', 'partner_request', etc.
entity_id UUID,    -- The ID of the referenced entity
```

**Why no foreign keys?**

- Flexibility to add new entity types without schema changes
- Performance at scale (no FK overhead on writes)
- Handle deleted entities at application level

**Frontend handling for deleted entities:**

```typescript
const handleNotificationPress = async (notification) => {
  if (notification.entity_type && notification.entity_id) {
    const exists = await checkEntityExists(
      notification.entity_type,
      notification.entity_id
    );
    if (!exists) {
      showToast("This item is no longer available");
      return;
    }
  }
  router.push(notification.data.deepLink);
};
```

---

## 9. AI Integration

The following AI services have been updated to support social/challenge features:

### 1. AI Progress Reflections (`ai_progress_reflections_service.py`)

**Status: ✅ Implemented**

The service now fetches social context and includes it in AI prompts for more personalized reflections.

#### Social Context Fetched

```python
social_context = {
    "is_challenge": bool,               # Is user in a challenge?
    "challenge_rank": 2,                # Current leaderboard position
    "challenge_participants": 5,        # Total participants
    "challenge_title": "30-Day Fitness Challenge",
    "accountability_partner": "Jane",   # Partner name if exists
    "partner_streak": 7,                # Partner's current streak
}
```

#### AI Prompt Additions

The AI now receives context like:

- "You're currently in 2nd place out of 5 participants"
- "Your accountability partner Jane is on a 7-day streak"

#### Usage

```python
from app.services.ai_progress_reflections_service import ai_progress_reflections_service

reflection = await ai_progress_reflections_service.generate_reflection(
    user_id=user_id,
    goal_id=goal_id,  # Optional: focus on specific goal
    period="weekly"    # or "monthly"
)
# Returns reflection with social context integrated
```

---

### 2. Goal Suggestions (`suggested_goals_service.py`, `goal_type_suggestion_service.py`)

**Status: ✅ Implemented**

Goal suggestions now include sharing recommendations for challenge-type goals.

#### New Fields in Suggested Goals

```python
{
    "title": "30-Day Fitness Challenge",
    "goal_type": "time_challenge",
    # NEW social/sharing fields:
    "is_challenge_candidate": True,           # Good for sharing as challenge
    "sharing_recommendation": "great_for_friends",  # or "good_for_competition"
    "match_reason": "...perfect for competing with friends!"
}
```

#### Sharing Recommendations Logic

| Goal Type        | is_challenge_candidate | Default sharing_recommendation |
| ---------------- | ---------------------- | ------------------------------ |
| habit            | `false`                | `null`                         |
| time_challenge   | `true`                 | `"great_for_friends"`          |
| target_challenge | `true`                 | `"good_for_competition"`       |

#### AI Prompt Guidance

The AI is instructed to:

- Mark time/target challenges as good candidates for sharing
- Use `"great_for_friends"` for fun, supportive challenges
- Use `"good_for_competition"` for competitive, race-to-finish challenges
- Include social aspects in `match_reason` when appropriate

---

### 3. AI Motivation Messages

**Status: 🔄 Planned**

Future updates should include:

- Challenge progress references ("You're in 2nd place!")
- Partner encouragement ("Jane just checked in!")

---

### Implementation Files

| Service               | File                                              | Changes                                                               |
| --------------------- | ------------------------------------------------- | --------------------------------------------------------------------- |
| Progress Reflections  | `app/services/ai_progress_reflections_service.py` | Added `_get_social_context()` method, updated AI prompts              |
| Suggested Goals       | `app/services/suggested_goals_service.py`         | Added `is_challenge_candidate`, `sharing_recommendation` to transform |
| Goal Type Suggestions | `app/services/goal_type_suggestion_service.py`    | Updated prompts with social sharing guidance                          |
| Suggested Goal Model  | `app/models/suggested_goals.py`                   | Added new Pydantic fields                                             |

---

## 10. Implementation Priority

### Phase 1: Goal Activation/Deactivation

- Add menu items for activate/deactivate
- Enforce `active_goal_limit` from subscription
- No database changes needed

### Phase 2: Private Challenges

- Already works with `goal_type`
- Just UI polish

### Phase 3: Shared Challenges

- Create `challenge_check_ins` table
- Implement "Share as Challenge" flow
- Build challenge detail screen
- Build leaderboard component

### Phase 4: Accountability Partners

- Implement partner request flow
- Build partner dashboard
- Add partner visibility to goals

### Phase 5: Social Nudges & Notifications

- Create `social_nudges` table
- Implement nudge/cheer/message UI
- Add push notification handlers
- Build notification preferences UI
- Implement AI-suggested nudges (Pro+)

---

## Help Center FAQs

### How do I create a challenge?

Navigate to the Challenges tab and tap "Create Challenge." Fill in the details like title, category, tracking type, and duration. Your challenge will be created and you can invite friends to join!

### What happens when a challenge ends?

The leaderboard is frozen, no more check-ins are accepted, and a winner is declared based on total check-ins or streak.

### Can people join a challenge after it starts?

No. To keep things fair, challenges are locked once they start. Make sure to invite friends before the start date!

### What's an Accountability Partner?

An Accountability Partner is like a fitness buddy. You can see each other's goals and progress, helping you both stay motivated. To add a partner, search for users and send them a partner request.

### How do I invite someone to a challenge?

You can either:

1. Send them a partner request with the challenge scope
2. Share an invite link that they can use to join

### How do I send a nudge to my partner?

On their profile card, you'll see quick action buttons: 👋 Nudge, 🎉 Cheer, and 💬 Message. Tap any of these to send encouragement!

### Can I turn off social notifications?

Yes! Go to Settings → Notifications → Social. You can customize which notifications you receive for partners, challenges, and more.

### What's the difference between a Nudge and a Cheer?

- **Nudge**: A gentle reminder, like "Hey, have you checked in today?" Use this when someone hasn't been active.
- **Cheer**: A celebration, like "🎉 Great job!" Use this when someone checks in or hits a milestone.

### How often can I nudge someone?

To prevent spam, you can only send one nudge per day to each person. Cheers are unlimited but limited to one per check-in.

### Will I get notified when I'm overtaken in a challenge?

Yes! You'll receive a push notification when someone passes you on the leaderboard. You can turn this off in Settings → Notifications → Challenges.

---

## Related Documentation

- [Feature Documentation Index](./features/README.md)
- [Social Accountability Feature](./features/10-social-accountability.md)
- [Community Challenges Feature](./features/08-community-challenges.md)
- [Data Models](./DataModels.md)
- [API Specification](./API-Spec.md)
