# Social & Challenge Features Guide

This document explains how social accountability, goal sharing, group goals, and challenges work in FitNudge. Use this as a reference for implementation and help center content.

---

## Table of Contents

1. [Overview](#overview)
2. [Feature Summary](#feature-summary)
3. [Accountability Partners](#1-accountability-partners)
4. [Goal Sharing](#2-goal-sharing)
5. [Group Goals](#3-group-goals-collaborative)
6. [Challenges](#4-challenges-competitive)
   - [Private Challenges](#41-private-challenges-solo)
   - [Shared Challenges](#42-shared-challenges-social)
   - [Challenge Lifecycle](#43-challenge-lifecycle)
7. [Check-In Systems](#5-check-in-systems)
8. [Feature Access by Plan](#6-feature-access-by-plan)
9. [GoalCard Menu Items](#7-goalcard-menu-items)
10. [Database Schema](#8-database-schema)
11. [Social Nudges & Motivation](#11-social-nudges--motivation)
12. [Push Notifications](#12-push-notifications)
13. [AI Integration](#13-ai-integration)
14. [Implementation Priority](#14-implementation-priority)
15. [Help Center FAQs](#help-center-faqs)

---

## Overview

FitNudge offers several ways for users to connect and stay motivated:

| Feature                     | Purpose                        | Competition?       |
| --------------------------- | ------------------------------ | ------------------ |
| **Accountability Partners** | 1-on-1 mutual support          | No                 |
| **Goal Sharing**            | Let friends view your progress | No                 |
| **Group Goals**             | Work together on the same goal | No (collaborative) |
| **Challenges**              | Compete with others            | Yes (leaderboard)  |

---

## Feature Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        SOCIAL FEATURES                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Accountability Partners     Goal Sharing                       │
│  ┌─────┐    ┌─────┐         ┌─────┐                            │
│  │User │◄──►│User │         │User │──► Friends can VIEW        │
│  │  A  │    │  B  │         │     │    (view/comment/motivate) │
│  └─────┘    └─────┘         └─────┘                            │
│  Mutual visibility          One-way visibility                  │
│  Each has own goals         Only owner checks in                │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Group Goals (Collaborative)    Challenges (Competitive)        │
│  ┌─────────────────┐            ┌─────────────────┐            │
│  │   SAME GOAL     │            │   SAME CHALLENGE │            │
│  │  ┌───┐ ┌───┐   │            │  ┌───┐ ┌───┐    │            │
│  │  │ A │ │ B │   │            │  │ A │ │ B │    │            │
│  │  └───┘ └───┘   │            │  └───┘ └───┘    │            │
│  │  Combined: 50   │            │  A: 25  B: 20   │            │
│  └─────────────────┘            │  🏆 Leaderboard │            │
│  Everyone contributes           └─────────────────┘            │
│  to team total                  Everyone competes               │
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

## 2. Goal Sharing

### What It Is

One-way sharing where a user lets specific friends view their goal progress.

### How It Works

1. User selects a goal to share
2. Chooses friends to share with
3. Sets permission level for each friend

### Permission Levels

| Level      | Can View | Can Comment | Can Send Motivation |
| ---------- | -------- | ----------- | ------------------- |
| `view`     | ✅       | ❌          | ❌                  |
| `comment`  | ✅       | ✅          | ❌                  |
| `motivate` | ✅       | ✅          | ✅                  |

### Check-Ins

- **Only the goal owner checks in**
- Shared users can only view (and optionally comment/motivate)

### Database Table

```sql
goal_shares
- goal_id
- shared_with_user_id
- shared_by_user_id
- permission_level: 'view' | 'comment' | 'motivate'
- is_active
```

---

## 3. Group Goals (Collaborative)

### What It Is

Multiple users working together on the SAME goal, with combined progress.

### How It Works

1. User creates a goal
2. Converts it to a group goal
3. Invites members (friends, accountability partners)
4. All members check into the SAME goal
5. Progress is combined (e.g., "Team total: 50 workouts")

### Check-Ins

- **All members check into the SAME goal_id**
- Each member's check-in is tracked separately
- Combined progress shown on goal card

### Database Table

```sql
group_goals
- goal_id
- user_id
- role: 'owner' | 'admin' | 'member'
- joined_at
- is_active
```

### Roles

| Role   | Can Invite | Can Remove | Can Edit Goal | Can Delete Goal |
| ------ | ---------- | ---------- | ------------- | --------------- |
| Owner  | ✅         | ✅         | ✅            | ✅              |
| Admin  | ✅         | ✅         | ❌            | ❌              |
| Member | ❌         | ❌         | ❌            | ❌              |

### User Experience

```
Group Goal: "Team 100 Workouts"
┌────────────────────────────┐
│ 💪 Team 100 Workouts       │
│ ─────────────────────────  │
│ Team Progress: 67/100      │
│ ████████████░░░░░░ 67%     │
│                            │
│ 👤 John: 25 check-ins      │
│ 👤 Jane: 22 check-ins      │
│ 👤 Mike: 20 check-ins      │
└────────────────────────────┘
```

---

## 4. Challenges (Competitive)

### 4.1 Private Challenges (Solo)

#### What It Is

A personal challenge that is NOT shared with others. It's just a goal with challenge properties.

#### How It Works

1. User creates a goal with `goal_type = 'time_challenge'` or `'target_challenge'`
2. User tracks it alone
3. No entry in `challenges` table
4. It's essentially a personal goal with a deadline/target

#### Goal Types

| Type               | Description                          | Example                    |
| ------------------ | ------------------------------------ | -------------------------- |
| `time_challenge`   | Complete within a time period        | "30 Day Workout Challenge" |
| `target_challenge` | Reach a specific number of check-ins | "Complete 50 Workouts"     |

#### Check-Ins

- User checks into their **goal** via `check_ins` table
- Standard goal check-in flow

---

### 4.2 Shared Challenges (Social)

#### What It Is

A competitive challenge where multiple users work toward the same goal and compete on a leaderboard.

#### How It Works

**Step 1: User Creates Challenge Goal**

```
User creates goal:
- Title: "30 Day Fitness Challenge"
- goal_type: 'time_challenge'
- challenge_start_date: Dec 1
- challenge_end_date: Dec 30
```

**Step 2: User Shares as Challenge**

User clicks "Share as Challenge" and sees a modal:

```
┌─────────────────────────────────────────────────────┐
│ 🏆 Share "30 Day Fitness Challenge"                 │
│                                                      │
│ ⚠️ IMPORTANT:                                       │
│ • Challenge starts fresh for everyone (Day 1)       │
│ • Your current progress won't transfer              │
│                                                      │
│ What would you like to do with your current goal?   │
│                                                      │
│ ○ Archive goal (recommended)                        │
│   Only track progress in the challenge              │
│                                                      │
│ ○ Keep goal active                                  │
│   Track both separately (counts as 2 toward limit)  │
│                                                      │
│ [ Cancel ]                    [ Create Challenge ]  │
└─────────────────────────────────────────────────────┘
```

What happens:

1. Challenge is created **self-contained** in `challenges` table
2. `goal_template` includes full goal data AND actionable plan
3. If user chose "Archive": goal is archived with `archived_reason = 'converted_to_challenge'`
4. If user chose "Keep active": both goal and challenge count toward active limit
5. User becomes first participant

**Key Design Decision:** The challenge is **completely independent** of the original goal:

- No foreign key to goal_id
- Actionable plan is copied into `goal_template`
- User can delete their archived goal without breaking the challenge
- All participants see the same plan

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
- NOT into the original goal
- Leaderboard updates automatically
```

#### Check-Ins

- **All participants check into `challenge_check_ins`**
- NOT the original goal
- Creator's existing check-ins can be migrated or shown as "head start"

#### Database Tables

```sql
challenges
- id
- title, description
- challenge_type: 'streak' | 'checkin_count' | 'community' | 'custom'
- duration_days
- start_date, end_date
- join_deadline (when joining closes)
- is_public, is_active
- max_participants
- created_by
- goal_template (JSONB - stores original goal properties)

challenge_participants
- challenge_id
- user_id
- joined_at
- points, rank
- progress_data (JSONB)

challenge_check_ins (NEW)
- challenge_id
- user_id
- check_in_date
- notes, mood
- UNIQUE(challenge_id, user_id, check_in_date)
```

---

### 4.3 Challenge Lifecycle

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
- If challenge came from a goal, clears the goal's `converted_to_challenge_id`

**Leave Challenge:**

- Participant removes themselves from a challenge
- Creator cannot leave (must cancel instead)
- Participant's check-ins are deleted
- No longer counts toward their `challenge_join_limit`

---

## 5. Check-In Systems

### Summary Table

| Feature                 | Check-In Table        | Who Checks In             |
| ----------------------- | --------------------- | ------------------------- |
| Regular Goal            | `check_ins`           | Owner only                |
| Goal Sharing            | `check_ins`           | Owner only                |
| Accountability Partners | `check_ins`           | Each their own goals      |
| Group Goals             | `check_ins`           | All members, same goal_id |
| Private Challenge       | `check_ins`           | Owner only                |
| Shared Challenge        | `challenge_check_ins` | All participants          |

### Required Changes

#### For Group Goals

Modify `check_ins` unique constraint:

```sql
-- FROM: UNIQUE(goal_id, check_in_date)
-- TO: UNIQUE(user_id, goal_id, check_in_date)
```

#### For Shared Challenges

Create new table:

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

## 6. Feature Access by Plan

Feature access is controlled by the `plan_features` database table. All access checks should use the `check_user_has_feature()` function.

### Feature Keys

| Feature Key               | Description                      | Minimum Tier |
| ------------------------- | -------------------------------- | ------------ |
| `goal_shares`             | Share goals with friends         | Starter (1)  |
| `challenge_create`        | Create and share challenges      | Starter (1)  |
| `group_goals`             | Create collaborative group goals | Pro (2)      |
| `accountability_partners` | Find accountability partners     | Pro (2)      |

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

## 7. GoalCard Menu Items

### For ALL Goals

```
• Activate Goal     (if goal is inactive)
• Deactivate Goal   (if goal is active)
• Delete Goal
```

**Activation Logic:**

- Check `active_goal_limit` from subscription features (includes both goals + challenges)
- If user is at limit → Show alert: "You can only have X active goals/challenges. Deactivate one first."
- Goals with `archived_reason = 'converted_to_challenge'` **cannot be reactivated**

**Deletion Logic:**

Users can delete any goal, including those with check-ins. However, the frontend should warn users that their progress data will be permanently lost and suggest archiving instead.

| Goal State    | Can Delete? | Frontend Warning                                                         |
| ------------- | ----------- | ------------------------------------------------------------------------ |
| No check-ins  | ✅ Yes      | No warning needed                                                        |
| Has check-ins | ✅ Yes      | "Your progress will be permanently deleted. Consider archiving instead." |

**Note:** Goals with `archived_reason = 'converted_to_challenge'` can also be deleted since challenges are self-contained.

### For Habits (`goal_type = 'habit'`)

```
• Share Goal        (requires goal_shares feature)
```

### For Challenges (`goal_type = 'time_challenge'` or `'target_challenge'`)

```
• Share as Challenge    (requires challenge_create feature)
                        (only if NOT already converted)
• View Challenge        (if converted_to_challenge_id exists)
• Make Private          (if shared, removes from challenges)
```

### For Group Goals (`is_group_goal = true`)

```
• Invite Members        (requires group_goals feature)
• View Members
• Leave Group           (if member, not owner)
```

### Menu Visibility Logic

```typescript
const menuOptions = [];

// Always available
if (goal.is_active) {
  menuOptions.push({ id: "deactivate", label: "Deactivate Goal" });
} else {
  menuOptions.push({ id: "activate", label: "Activate Goal" });
}

// Goal sharing (for any goal type)
if (hasFeature("goal_shares") && !goal.is_group_goal) {
  menuOptions.push({ id: "share", label: "Share Goal" });
}

// Challenge sharing (for challenge types only)
if (
  hasFeature("challenge_create") &&
  ["time_challenge", "target_challenge"].includes(goal.goal_type) &&
  !goal.converted_to_challenge_id
) {
  menuOptions.push({ id: "share_challenge", label: "Share as Challenge" });
}

// Group goals
if (hasFeature("group_goals") && goal.is_group_goal) {
  menuOptions.push({ id: "invite", label: "Invite Members" });
  menuOptions.push({ id: "members", label: "View Members" });
}

// Delete (always last)
menuOptions.push({ id: "delete", label: "Delete Goal", destructive: true });
```

---

## 8. Database Schema

### Existing Tables (No Changes Needed)

- `accountability_partners` ✅
- `goal_shares` ✅
- `group_goals` ✅
- `challenges` ✅
- `challenge_participants` ✅
- `challenge_leaderboard` ✅

### Tables Needing Modification

#### `goals` table

```sql
-- Add column for tracking converted challenges
ALTER TABLE goals
ADD COLUMN converted_to_challenge_id UUID REFERENCES challenges(id);
```

#### `challenges` table

```sql
-- Add columns for goal template and join deadline
ALTER TABLE challenges
ADD COLUMN goal_template JSONB,
ADD COLUMN join_deadline DATE;
```

#### `check_ins` table

```sql
-- Modify unique constraint for group goals
-- (Allows multiple users to check into same goal on same day)
ALTER TABLE check_ins
DROP CONSTRAINT IF EXISTS check_ins_unique_constraint,
ADD CONSTRAINT check_ins_user_goal_date_unique
    UNIQUE(user_id, goal_id, check_in_date);
```

### New Tables

#### `challenge_check_ins`

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

## 11. Social Nudges & Motivation

Social nudges allow users to motivate each other across all social features. This is crucial for engagement and retention.

### Motivation Mechanics by Feature

#### Accountability Partners

| Mechanic               | Description                       | Trigger                                    |
| ---------------------- | --------------------------------- | ------------------------------------------ |
| **Nudge**              | "Hey, have you checked in today?" | Manual or auto (if partner missed 2+ days) |
| **Cheer**              | "🎉 Great job!" quick reaction    | When partner checks in                     |
| **Streak Celebration** | "Jane hit a 7-day streak!"        | Automatic milestone                        |
| **Custom Message**     | Send personalized encouragement   | Manual                                     |

#### Group Goals (Collaborative)

| Mechanic                  | Description                               | Trigger               |
| ------------------------- | ----------------------------------------- | --------------------- |
| **Team Nudge**            | "Team needs 3 more check-ins today!"      | Manual by owner/admin |
| **Contribution Alert**    | "Jane just added 1 workout! Team: 67/100" | Automatic on check-in |
| **Milestone Celebration** | "🎉 Team hit 50%!"                        | Automatic             |
| **Shoutout**              | Highlight top contributor                 | Weekly/manual         |

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

| Feature             | Who Can Use                                                                 |
| ------------------- | --------------------------------------------------------------------------- |
| Send Nudge          | Anyone with the relationship (partner, group member, challenge participant) |
| AI-Generated Nudges | Pro+ (ties into AI features)                                                |
| Custom Messages     | All users                                                                   |

---

## 12. Push Notifications

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

#### Group Goals

| Event                  | Push Notification                            | Priority |
| ---------------------- | -------------------------------------------- | -------- |
| Added to group goal    | "👥 John invited you to 'Team 100 Workouts'" | High     |
| Team milestone reached | "🎉 Your team hit 50 workouts!"              | Medium   |
| Team nudge sent        | "💪 John: Team needs 5 more today!"          | Medium   |
| Someone contributed    | "✅ Jane added 1 workout. Team: 67/100"      | Low      |

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

#### Goal Sharing

| Event                       | Push Notification                         | Priority |
| --------------------------- | ----------------------------------------- | -------- |
| Goal shared with you        | "👀 John shared 'Daily Workout' with you" | Medium   |
| Motivation message received | "💪 John: You've got this!"               | Medium   |

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

    # Group Goals
    "group_invite": "👥 {sender_name} invited you to '{goal_title}'",
    "group_milestone": "🎉 Your team hit {milestone}!",
    "group_nudge": "💪 {sender_name}: {message}",
    "group_contribution": "✅ {sender_name} contributed! Team progress: {progress}",

    # Challenges
    "challenge_invite": "🏆 {sender_name} invited you to '{challenge_title}'",
    "challenge_joined": "🙌 {sender_name} joined your challenge!",
    "challenge_overtaken": "😱 {sender_name} just passed you! You're now #{rank}",
    "challenge_lead": "👑 You're now in 1st place!",
    "challenge_nudge": "🏃 {sender_name}: {message}",
    "challenge_starting": "⏰ '{challenge_title}' starts tomorrow!",
    "challenge_ending": "⏰ {days} days left in '{challenge_title}'! You're #{rank}",
    "challenge_ended": "🏆 '{challenge_title}' complete! You finished #{rank}!",

    # Goal Sharing
    "goal_shared": "👀 {sender_name} shared '{goal_title}' with you",
    "motivation_message": "💪 {sender_name}: {message}",
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
ADD COLUMN IF NOT EXISTS social_group_invites BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS social_group_milestones BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS social_group_nudges BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS social_group_contributions BOOLEAN DEFAULT false,  -- Off by default (noisy)
ADD COLUMN IF NOT EXISTS social_challenge_invites BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS social_challenge_leaderboard BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS social_challenge_nudges BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS social_challenge_reminders BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS social_goal_shared BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS social_motivation_messages BOOLEAN DEFAULT true;
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
│ GROUP GOALS                            │
│ ─────────────────────────────────────  │
│ Group invitations          [✓]         │
│ Team milestones            [✓]         │
│ Team nudges                [✓]         │
│ Member contributions       [ ]         │
│                                        │
│ CHALLENGES                             │
│ ─────────────────────────────────────  │
│ Challenge invitations      [✓]         │
│ Leaderboard updates        [✓]         │
│ Competitive nudges         [✓]         │
│ Start/end reminders        [✓]         │
│                                        │
│ GOAL SHARING                           │
│ ─────────────────────────────────────  │
│ When goals shared with me  [✓]         │
│ Motivation messages        [✓]         │
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

    # Group Goals
    GROUP_INVITE = "group_invite"
    GROUP_MILESTONE = "group_milestone"
    GROUP_NUDGE = "group_nudge"
    GROUP_CONTRIBUTION = "group_contribution"

    # Challenges
    CHALLENGE_INVITE = "challenge_invite"
    CHALLENGE_JOINED = "challenge_joined"
    CHALLENGE_OVERTAKEN = "challenge_overtaken"
    CHALLENGE_LEAD = "challenge_lead"
    CHALLENGE_NUDGE = "challenge_nudge"
    CHALLENGE_STARTING = "challenge_starting"
    CHALLENGE_ENDING = "challenge_ending"
    CHALLENGE_ENDED = "challenge_ended"

    # Goal Sharing
    GOAL_SHARED = "goal_shared"
    MOTIVATION_MESSAGE = "motivation_message"


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

    # Send push notification
    await send_push_notification(
        user_id=recipient_id,
        title=get_notification_title(notification_type),
        body=message,
        data={
            "type": notification_type.value,
            "sender_id": sender_id,
            **data
        }
    )
```

---

## 13. AI Integration

The following AI services have been updated to support social/challenge features:

### 1. AI Progress Reflections (`ai_progress_reflections_service.py`)

**Status: ✅ Implemented**

The service now fetches social context and includes it in AI prompts for more personalized reflections.

#### Social Context Fetched

```python
social_context = {
    "is_group_goal": bool,              # Is this a team goal?
    "group_members": ["Jane", "Mike"],  # Team member names
    "group_total_progress": 67,         # Combined team check-ins
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

- "Your team has completed 67 check-ins together"
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

- Group goal awareness (motivate the team)
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

## 14. Implementation Priority

### Phase 1: Goal Activation/Deactivation

- Add menu items for activate/deactivate
- Enforce `active_goal_limit` from subscription
- No database changes needed

### Phase 2: Goal Sharing

- Implement share modal
- Use existing `goal_shares` table
- Add shared goals view

### Phase 3: Private Challenges

- Already works with `goal_type`
- Just UI polish

### Phase 4: Shared Challenges

- Create `challenge_check_ins` table
- Implement "Share as Challenge" flow
- Build challenge detail screen
- Build leaderboard component

### Phase 5: Group Goals

- Modify `check_ins` constraint
- Implement group invitation flow
- Build combined progress view

### Phase 6: Accountability Partners

- Implement partner request flow
- Build partner dashboard
- Add partner visibility to goals

### Phase 7: Social Nudges & Notifications

- Create `social_nudges` table
- Implement nudge/cheer/message UI
- Add push notification handlers
- Build notification preferences UI
- Implement AI-suggested nudges (Pro+)

---

## Help Center FAQs

### What's the difference between sharing a goal and creating a challenge?

**Goal Sharing:** Your friends can see your progress, but they don't participate. It's one-way visibility.

**Challenge:** Your friends JOIN and compete with you. Everyone does the same activity and there's a leaderboard.

### Can I convert a private challenge to a shared challenge?

Yes! Go to your goal, tap the menu (•••), and select "Share as Challenge." Your friends can then join.

### What happens when a challenge ends?

The leaderboard is frozen, no more check-ins are accepted, and a winner is declared based on total check-ins.

### Can people join a challenge after it starts?

No. To keep things fair, challenges are locked once they start. Make sure to invite friends before the start date!

### What's a Group Goal?

A Group Goal is collaborative - everyone contributes to the SAME goal. For example, "Team 100 Workouts" where your team works together to reach 100 total workouts.

### What's an Accountability Partner?

An Accountability Partner is like a fitness buddy. You can see each other's goals and progress, helping you both stay motivated.

### How do I send a nudge to my partner or teammate?

On their profile card, you'll see quick action buttons: 👋 Nudge, 🎉 Cheer, and 💬 Message. Tap any of these to send encouragement!

### Can I turn off social notifications?

Yes! Go to Settings → Notifications → Social. You can customize which notifications you receive for partners, group goals, challenges, and more.

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
