# 🎯 FitNudge - AI Accountability App

> **The AI that actually holds you accountable.**

A focused, clean mobile app that helps users stay consistent with **any goal or habit** through personalized AI check-ins, streak tracking, and accountability partnerships.

Whether it's working out, reading, meditating, learning, or building any positive habit — FitNudge provides the daily nudge and support users need.

---

## 📋 Table of Contents

1. [Core Concept](#core-concept)
2. [Value Proposition](#value-proposition)
3. [Feature List](#feature-list)
4. [User Flows](#user-flows)
5. [Screen Specifications](#screen-specifications)
6. [Project Structure](#project-structure)
7. [Database Schema](#database-schema)
8. [API Endpoints](#api-endpoints)
9. [Push Notification System](#push-notification-system)
10. [AI Integration](#ai-integration)
11. [Tech Stack](#tech-stack)

---

## 🧠 Core Concept

### The Problem

Most people don't fail at their goals because they don't know what to do. They fail because they can't stay consistent. They start strong, miss a day, then another, and quietly quit.

### The Solution

FitNudge is an AI accountability partner that:

- **Checks in daily** at your chosen time
- **Knows your patterns** (you always skip Wednesdays)
- **Remembers your "why"** and uses it when you need motivation
- **Adapts to you** (supportive, tough love, or calm - your choice)
- **Never judges, but never lets you off the hook**

### The Core Loop

```
1. User sets a goal ("Work out 3x/week")
2. AI sends check-in notification at scheduled time
3. User taps notification to open app and check in
4. AI responds with personalized message based on:
   - Current streak
   - Historical patterns
   - User's "why"
   - Chosen motivation style
5. Repeat daily
```

---

## 💡 Value Proposition

**"Most apps track what you do. FitNudge makes sure you actually do it."**

| Other Apps        | FitNudge                  |
| ----------------- | ------------------------- |
| Track calories    | Track consistency         |
| Show you workouts | Make sure you show up     |
| Passive logging   | Active accountability     |
| Generic reminders | Personalized AI nudges    |
| You vs. the app   | AI partner in your corner |

---

## 📦 Feature List

### 🆓 FREE TIER

#### 1. Goal Setting

**What it does:** Users create simple, trackable goals.

**How it works:**

- User can create up to **2 goals** on free tier
- Each goal has:
  - **Title** (e.g., "Work out", "Read", "Meditate")
  - **Frequency** (daily, X times per week)
  - **Reminder time(s)** (when to send check-in notification)
  - **"Why" statement** (motivation anchor, optional but encouraged)
  - **Days of week** (optional - which days count)
- Goal types supported:
  - **Daily habits** ("Drink 8 glasses of water every day")
  - **Weekly targets** ("Go to gym 3 times this week")
- No AI generation - user defines their own goals
- Simple Yes/No tracking (not complex metrics)

**UI Elements:**

- Goal title input (text field, max 50 chars)
- Frequency selector (daily / X per week toggle)
- Day selector (M T W Th F S Su chips - for weekly goals)
- Time picker for reminder (using ReminderTimesPicker component)
- "Why" text area (optional, max 200 chars)
- Popular goal templates for quick selection

---

#### 2. Daily AI Check-Ins

**What it does:** AI sends a push notification at the user's chosen time asking if they completed their goal.

**How it works:**

- Backend scheduler (Celery) triggers notifications at each user's specified time
- Notification includes:
  - Personalized greeting using user's name
  - Goal-specific question
  - Current progress context ("You're 2 for 3 this week!")
- User taps notification to open the app's check-in screen
- Response is recorded in database with timestamp
- AI generates personalized response based on outcome

**Notification Examples:**

_Morning (pre-emptive):_

```
Hey Mike! 🌅
Today's the day for workout #3 this week.
You've got this!
```

_Check-in time:_

```
Hey Mike! 🏋️ Did you work out today?
You're 2 for 3 this week - one more and you've hit your goal!
Tap to check in.
```

_Missed check-in (30 minutes after scheduled time):_

```
Hey Mike, I didn't hear back from you.
How did the workout go today? Tap to check in.
```

**AI Response Logic:**

| Response                        | AI Reaction                                          |
| ------------------------------- | ---------------------------------------------------- |
| Yes (continuing streak)         | Celebrate progress, mention streak                   |
| Yes (breaking losing streak)    | Extra celebration, "welcome back" energy             |
| Yes (achieving weekly goal)     | Big celebration, weekly achievement                  |
| No (first miss)                 | Gentle, understanding, reference "why"               |
| No (multiple misses)            | More direct, ask what's getting in the way           |
| No (about to break long streak) | More serious, "let's talk about this"                |
| Rest Day                        | Acknowledge, remind that rest is part of the process |

---

#### 3. Streak Tracking

**What it does:** Visual tracking of consistency over time.

**How it works:**

- **Current streak**: Consecutive days/sessions of hitting goal
- **Longest streak**: Personal best for motivation
- **Weekly progress**: X/Y completed this week (for weekly goals)
- **Monthly consistency %**: What percentage of targets hit this month
- **Heat map calendar**: Visual representation of last 30/90 days

**Streak Rules:**

- For daily goals: Streak breaks on any missed day
- For weekly goals: Streak = consecutive weeks of hitting target
- Rest days preserve streaks (don't break, but don't increment either)
- Streaks reset at midnight in user's timezone

**Streak Milestones:**

- 3 days: "Getting started!"
- 7 days: "One week strong!"
- 14 days: "Two weeks! Habit forming."
- 21 days: "21 days - it's becoming automatic!"
- 30 days: "One month! You're transformed."
- 50 days: "50 days - elite consistency!"
- 100 days: "100 days! Legendary status."

---

#### 4. Basic AI Motivation

**What it does:** Daily motivational messages beyond just check-ins.

**How it works:**

- **Morning motivation** (optional, configurable time):
  - Short, personalized message to start the day
  - References user's goals and current progress
  - Different every day (AI-generated)
- **Contextual encouragement**:
  - "You've never worked out 4 days in a row before - today could be the day!"
  - "Last time you hit a 10-day streak, you said you felt unstoppable. You're at day 9."
  - "You usually skip Wednesdays. Prove yourself wrong today?"

**Motivation Style Options (user chooses during onboarding):**

| Style               | Tone                                    | Example                                                          |
| ------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| 🤗 Supportive Coach | Warm, encouraging, celebrates every win | "Every step forward counts. You're doing amazing!"               |
| 💪 Tough Love       | Direct, challenging, calls out excuses  | "Excuses don't build muscle. You said you'd show up. Let's go."  |
| 🧘 Calm & Steady    | Patient, balanced, philosophical        | "Remember why you started. Today's effort is tomorrow's reward." |

---

#### 5. Simple Reflection

**What it does:** Optional post-check-in reflection to help AI understand user better.

**How it works:**

- After responding to check-in, user can optionally add:
  - **Quick mood**: 😤 Tough / 😊 Good / 🔥 Amazing (for "Yes")
  - **Quick reason**: 🏢 Work / 😴 Tired / 🤒 Sick / 📅 Schedule (for "No")
  - **Text note**: One sentence reflection (max 140 chars)
- AI stores and uses this data for:
  - Pattern detection ("You always skip when tired from work")
  - Personalized future messages
  - Weekly recap insights

---

### 💎 PREMIUM TIER ($9.99/month or $79.99/year)

#### 6. Unlimited Goals

**What it does:** Remove the 2-goal limit.

**How it works:**

- Free users: Max 2 active goals
- Premium users: Unlimited goals (soft cap at 10)
- Soft warning at 10+ goals ("Focus is key - are you sure?")
- Archived goals don't count toward limit

---

#### 7. AI Coach Chat

**What it does:** On-demand conversation with your AI accountability coach.

**How it works:**

- Accessible anytime from home screen or dedicated tab
- Conversation is contextual - AI knows:
  - All your goals and progress
  - Your check-in history
  - Your patterns and struggles
  - Your reflections and notes
  - Your "why" statements
- Streaming responses (real-time typing effect)
- Conversation history preserved (last 50 messages)

**Use Cases:**

- "I'm feeling unmotivated today" → Personalized pep talk
- "I keep skipping Fridays" → Pattern analysis and suggestions
- "Why do I always quit after 2 weeks?" → Deep dive into psychology
- "What should I focus on this week?" → Prioritization advice
- "I hit my goal!" → Celebration and next-level challenge

**AI Context Prompt:**

```
You are the user's personal accountability coach. You know:
- Their active goals: [list]
- Current streaks: [data]
- Check-in history: [last 30 days]
- Patterns: [detected patterns]
- Their "why" statements: [list]
- Their chosen style: [supportive/tough love/calm]
- Recent reflections: [last 10 notes]

Be conversational, remember previous messages, and always tie advice
back to their specific data - not generic motivation.
```

---

#### 8. Smart Pattern Detection

**What it does:** AI analyzes user's history to find patterns and provide insights.

**How it works:**

- Backend job runs weekly (or on-demand in chat)
- Analyzes check-in data to find:
  - **Day patterns**: "You skip 60% of Wednesday workouts"
  - **Time patterns**: "Your best days start with morning check-ins"
  - **Streak patterns**: "You historically drop off around week 3"
  - **Reason patterns**: "Work is your #1 barrier (mentioned 12 times)"
  - **Success patterns**: "You're 90% consistent when you work out before 9am"

**Pattern Detection Queries:**

```sql
-- Day of week success rate
SELECT
  EXTRACT(DOW FROM check_in_date) as day,
  COUNT(*) FILTER (WHERE completed = true) * 100.0 / COUNT(*) as success_rate
FROM check_ins
WHERE user_id = ? AND check_in_date > NOW() - INTERVAL '90 days'
GROUP BY day;

-- Streak dropout points
SELECT streak_length, COUNT(*) as frequency
FROM (
  SELECT COUNT(*) as streak_length
  FROM check_ins
  WHERE completed = true
  -- ... streak calculation logic
) streaks
GROUP BY streak_length
ORDER BY frequency DESC;
```

**How patterns are used:**

- Displayed in weekly recap
- Referenced in AI coach chat
- Used to customize check-in messages
- Power adaptive nudging

---

#### 9. Adaptive Nudging

**What it does:** Smart, proactive notifications based on user's patterns.

**How it works:**

| Trigger                    | Action                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| About to break long streak | Extra check-in: "You're at 14 days - your longest is 18. Don't break the chain!"         |
| Historically risky day     | Morning reminder: "Wednesdays are tough for you. What's your plan today?"                |
| 2+ days missed             | Intervention: "Hey, I've noticed you've been quiet. Everything okay?"                    |
| Crushing it                | Celebration: "5 for 5 this week! But don't get complacent - winners stay hungry."        |
| Approaching milestone      | Hype: "3 more days and you hit 30 days. That's legendary."                               |
| Pattern detected           | Suggestion: "You've marked 'tired' 4 times this month. Have you tried morning workouts?" |

**Nudge Frequency Limits:**

- Max 1 nudge per type per day (per-type deduplication via `data->>'nudge_type'`)
- No nudges between 10pm - 7am (user's timezone)
- User can disable adaptive nudging in settings

**Nudge Types:**

| Nudge Type | Celery Task | Schedule |
| --- | --- | --- |
| `streak_at_risk` | `check_streak_at_risk` | Hourly (2-8 PM) |
| `risky_day` | `check_risky_day_warning` | Every 15 min |
| `missed_days_intervention` | `check_missed_days_intervention` | Daily 10 AM |
| `milestone_approaching` | `check_approaching_milestone` | Daily 9 AM |
| `pattern_suggestion` | `check_pattern_suggestion` | Daily 11 AM |
| `crushing_it` | `check_crushing_it` | Daily 6 PM |

**Deduplication Strategy:**

Each task batch-prefetches existing nudges of its type for today:
```python
existing_nudges_result = (
    supabase.table("notification_history")
    .select("user_id")
    .in_("user_id", user_ids)
    .eq("notification_type", "adaptive_nudge")
    .gte("sent_at", f"{utc_today}T00:00:00")
    .filter("data->>nudge_type", "eq", "{nudge_type}")
    .execute()
)
```
Users in the result set are skipped (O(1) lookup via Python set).

---

#### 10. Weekly AI Recap

**What it does:** Personalized weekly summary with insights and action items.

**How it works:**

- Generated every Sunday evening (or user's chosen day)
- Sent as push notification linking to full recap screen
- AI analyzes the week's data and generates:
  - **Summary**: What happened this week (stats)
  - **Win**: One specific thing to celebrate
  - **Pattern/Insight**: Something the AI noticed
  - **Focus for next week**: One actionable suggestion
  - **Motivational close**: Personalized encouragement

**Recap Template:**

```
📊 Week of January 6-12

Hey Mike,

SUMMARY
You hit 3/3 workouts and read 5/7 days.
Overall consistency: 76% (↑ from 68% last week)

🏆 WIN
You pushed through Thursday even when you said you were tired.
That's the discipline that separates talkers from doers.

📍 INSIGHT
You missed reading on Wednesday and Saturday - both days
you worked late. Consider moving reading to mornings on busy days.

🎯 NEXT WEEK
You're 6 days from matching your longest streak (18 days).
Let's make this the week you break through.

"Consistency beats intensity. You're proving it."

— Your AI Coach
```

---

#### 11. Accountability Partner Matching

**What it does:** Connect users with similar goals for mutual accountability.

**Availability:**

- **Both free and premium users can have partners** (partnerships are not paywalled)
- Free users: 1 active partnership max
- Premium users: Up to 3 active partnerships + AI insights about partner patterns

**How it works:**

**Request Flow:**

1. User taps "Find Partner" → sees potential matches based on criteria
2. User sends request → other user gets notification
3. Other user accepts/rejects → if accepted, partnership is active
4. Request stored in `accountability_partners` table with `status: 'pending'`
5. On accept: status changes to `'accepted'`, both users notified

**Matching Criteria:**

- Similar goal types (fitness, reading, meditation, etc.)
- Similar frequency (daily vs 3x/week)
- Similar timezone (within 3 hours)
- Optional: Similar streak level (beginner with beginner)
- Free ↔ Free, Premium ↔ Premium, or Free ↔ Premium (all allowed)

**What partners can see:**

- First name and last initial
- Active goals (titles only, not "why" statements)
- Daily check-in status (✓ or ○)
- Current streak
- NO personal info, photos, or contact details

**What partners can do:**

- See each other's check-in status
- Send "cheers" (one-tap encouragement: 👏 💪 🔥)
- See when partner completes their goal (notification)
- Send "nudges" to encourage partner
- End partnership anytime (no-questions-asked)

**Cheers System:**

- Cheers are stored in `social_nudges` table with `nudge_type: 'cheer'`
- Predefined emoji reactions (👏 💪 🔥 ⭐ 🎯) - no custom text
- Recipient receives push notification
- Cheers are NOT visible publicly, only to partner

**Partner Notifications:**

- "Sarah just completed her workout! 💪 Your turn?"
- "Mike sent you a cheer! 👏"
- "Your partner is on a 10-day streak - don't fall behind!"

**Safety & Privacy:**

- No direct messaging (prevents spam/harassment)
- Either party can end partnership instantly
- Report button for inappropriate usernames
- Block option: prevents future matching

---

#### 12. Voice Notes (Premium)

**What it does:** Record voice reflections instead of typing.

**How it works:**

- After check-in, option to record voice note (max 60 seconds)
- Audio stored securely (Cloudflare R2)
- AI transcribes audio using Whisper API
- Transcription stored and used for pattern detection
- User can replay past voice notes

**Why voice:**

- Faster than typing
- More natural/authentic reflections
- Captures emotion and context
- Great for on-the-go users

---

#### 13. Multiple Reminder Times (Premium)

**What it does:** Set multiple check-in times per goal.

**How it works:**

- Free users: 1 reminder time per goal
- Premium users: Up to 5 reminder times per goal
- Use case: Morning motivation + Evening check-in
- Use case: Pre-workout reminder + Post-workout check-in

---

## 🚶 User Flows

### Flow 1: Registration & Onboarding

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  SCREEN 1: Welcome                                              │
│  ─────────────────                                              │
│  [App Logo / AI Character]                                      │
│  "Meet your AI accountability buddy"                            │
│  [Get Started] [I have an account]                              │
│                                                                 │
│  SCREEN 2: Sign Up                                              │
│  ─────────────────                                              │
│  [Continue with Apple]                                          │
│  [Continue with Google]                                         │
│  ─── or ───                                                     │
│  [Email] [Password]                                             │
│  [Create Account]                                               │
│                                                                 │
│  SCREEN 3: Your Name                                            │
│  ─────────────────                                              │
│  "What should I call you?"                                      │
│  [First name field]                                             │
│  [Continue]                                                     │
│                                                                 │
│  SCREEN 4: Motivation Style                                     │
│  ─────────────────                                              │
│  "How should I motivate you?"                                   │
│  [🤗 Supportive Coach] [💪 Tough Love] [🧘 Calm & Steady]       │
│  [Continue]                                                     │
│                                                                 │
│  SCREEN 5: First Goal                                           │
│  ─────────────────                                              │
│  "What do you want to stay accountable to?"                     │
│  Popular: [🏋️ Work out] [📚 Read] [🧘 Meditate] [💧 Water]      │
│  [✨ Create my own]                                             │
│                                                                 │
│  SCREEN 6: Goal Details                                         │
│  ─────────────────                                              │
│  "Work out regularly"                                           │
│  How often? [2x] [3x] [4x] [5x] [6x] [7x] per week              │
│  Which days? [M] [T] [W] [Th] [F] [S] [Su]                      │
│  Check-in time? [6:00 PM ▼]                                     │
│  [Create Goal]                                                  │
│                                                                 │
│  SCREEN 7: Your Why (Optional)                                  │
│  ─────────────────                                              │
│  "Why is this goal important?"                                  │
│  [Text area]                                                    │
│  "I'll use this to motivate you when things get tough."         │
│  [Continue] [Skip]                                              │
│                                                                 │
│  SCREEN 8: Enable Notifications                                 │
│  ─────────────────                                              │
│  [Notification illustration]                                    │
│  "Never miss a check-in"                                        │
│  [Enable Notifications] [Maybe Later]                           │
│                                                                 │
│  SCREEN 9: All Set!                                             │
│  ─────────────────                                              │
│  [Celebration animation]                                        │
│  "You're ready, [Name]!"                                        │
│  "First check-in: Today at 6:00 PM"                             │
│  [Start Using FitNudge]                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Total time: ~90 seconds
No AI wait time
```

---

### Flow 2: Daily Check-In (from Push Notification)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  PUSH NOTIFICATION (Lock Screen)                                │
│  ─────────────────                                              │
│  FitNudge                                    6:00 PM            │
│  Hey Mike! 🏋️ Did you work out today?                           │
│  You're 2 for 3 this week! Tap to check in.                     │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  USER TAPS NOTIFICATION → Opens app to Check-in Screen:         │
│  ─────────────────                                              │
│                                                                 │
│  [Yes ✓] [No ✗] [Rest Day 💤]                                   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  IF USER TAPS [Yes ✓]:                                          │
│  ─────────────────                                              │
│  Shows Success Screen:                                   │
│                                                                 │
│  [Celebration animation]                                        │
│  "That's 13 days in a row, Mike!"                               │
│  "You're building something real."                              │
│                                                                 │
│  How was it? (optional)                                         │
│  [😤 Tough] [😊 Good] [🔥 Amazing]                               │
│                                                                 │
│  Add a note?                                                    │
│  [Finally hit 100kg squat!___]                                  │
│                                                                 │
│  [Done]                                                         │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  IF USER TAPS [No ✗]:                                           │
│  ─────────────────                                              │
│  Shows Miss Screen:                                      │
│                                                                 │
│  "No worries, Mike."                                            │
│  "Everyone has off days."                                       │
│                                                                 │
│  "Remember why you started:"                                    │
│  "I want to feel stronger and more confident."                  │
│                                                                 │
│  What got in the way?                                           │
│  [🏢 Work] [😴 Tired] [🤒 Sick] [📅 Schedule] [Other]           │
│                                                                 │
│  "Tomorrow's a new chance."                                     │
│  [Done]                                                         │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  IF USER TAPS [Rest Day 💤]:                                    │
│  ─────────────────                                              │
│  Records as rest day (streak preserved)                         │
│  Brief confirmation:                                            │
│                                                                 │
│  "Rest day logged. 💤"                                          │
│  "Recovery is part of the process."                             │
│  "See you tomorrow!"                                            │
│                                                                 │
│  [Done]                                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Flow 3: AI Coach Chat (Premium)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ← Your Coach                                        ···        │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│                           ┌─────────────────────────────┐       │
│                           │ I'm struggling to stay      │       │
│                           │ motivated this week...      │ You   │
│                           └─────────────────────────────┘       │
│                                                                 │
│  ┌─────────────────────────────────────┐                        │
│  │ I hear you, Mike.                   │                        │
│  │                                     │ Coach                  │
│  │ Looking at your history, you've     │                        │
│  │ felt this way before - usually      │                        │
│  │ around week 2-3. But you pushed     │                        │
│  │ through last time and hit a         │                        │
│  │ 18-day streak.                      │                        │
│  │                                     │                        │
│  │ What specifically is making it      │                        │
│  │ hard right now?                     │                        │
│  └─────────────────────────────────────┘                        │
│                                                                 │
│                           ┌─────────────────────────────┐       │
│                           │ I'm just tired after work   │ You   │
│                           └─────────────────────────────┘       │
│                                                                 │
│  ┌─────────────────────────────────────┐                        │
│  │ That's real. Looking at your        │                        │
│  │ check-ins, you've marked "tired"    │ Coach                  │
│  │ as a reason 4 times this month -    │                        │
│  │ all on weekdays after 6pm.          │                        │
│  │                                     │                        │
│  │ Here's what I'm thinking: what if   │                        │
│  │ you tried ONE morning workout this  │                        │
│  │ week? Just to test it.              │                        │
│  │                                     │                        │
│  │ Your best consistency was back in   │                        │
│  │ October when you were doing 7am     │                        │
│  │ sessions. Worth a shot?             │                        │
│  └─────────────────────────────────────┘                        │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  [Type a message...                              🎤 📤]         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Flow 4: Accountability Partner

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  FINDING A PARTNER                                              │
│  ─────────────────                                              │
│  "Find an Accountability Partner"                               │
│                                                                 │
│  Get matched with someone working on similar goals.             │
│  You'll see each other's check-ins and cheer each other on.     │
│                                                                 │
│  Your goals:                                                    │
│  • Work out 3x/week                                             │
│  • Read daily                                                   │
│                                                                 │
│  [Find My Partner]                                              │
│                                                                 │
│  How matching works:                                            │
│  • Similar goals and schedule                                   │
│  • You only see check-ins, not personal info                    │
│  • Either person can end anytime                                │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  PARTNER FOUND                                                  │
│  ─────────────────                                              │
│  🎉 You're matched!                                             │
│                                                                 │
│  ┌─────────────────────────────────────┐                        │
│  │ [Avatar/Initials]                   │                        │
│  │ Sarah M.                            │                        │
│  │                                     │                        │
│  │ Working on:                         │                        │
│  │ • Work out 4x/week                  │                        │
│  │ • Meditate daily                    │                        │
│  │                                     │                        │
│  │ 🔥 23 day streak                    │                        │
│  └─────────────────────────────────────┘                        │
│                                                                 │
│  [Start Partnership]                                            │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  PARTNER WIDGET (on Home Screen)                                │
│  ─────────────────                                              │
│  ┌─────────────────────────────────────┐                        │
│  │ Your Partner                        │                        │
│  │                                     │                        │
│  │ [👤] Sarah M.        🔥 24 days     │                        │
│  │                                     │                        │
│  │ Today:                              │                        │
│  │ ✓ Worked out                        │                        │
│  │ ○ Meditation pending                │                        │
│  │                                     │                        │
│  │ [👏 Send Cheer]                     │                        │
│  └─────────────────────────────────────┘                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📱 Screen Specifications

### Tab Structure

```
[Home] [Goals] [Progress] [Profile]
```

---

### Home Screen

```
┌─────────────────────────────────────────────────────────────────┐
│  Good morning, Mike! 👋                                         │
│  "Small steps lead to big changes"      ← AI daily quote        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────┐                        │
│  │ 🔥 Current Streak                   │                        │
│  │                                     │                        │
│  │      12 days                        │                        │
│  │    ━━━━━━━━━━━━━━━                  │                        │
│  │    Best: 18 days                    │                        │
│  └─────────────────────────────────────┘                        │
│                                                                 │
│  TODAY'S GOALS                                                  │
│  ─────────────────────────────────────                          │
│                                                                 │
│  ┌─────────────────────────────────────┐                        │
│  │ 🏋️ Work out                         │                        │
│  │ 2/3 this week • Check-in at 6:00 PM │                        │
│  │ ○ Not checked in yet                │                        │
│  │                               [→]   │                        │
│  └─────────────────────────────────────┘                        │
│                                                                 │
│  ┌─────────────────────────────────────┐                        │
│  │ 📚 Read                             │                        │
│  │ Daily • 🔥 5 day streak             │                        │
│  │ ✓ Completed today                   │                        │
│  │                               [→]   │                        │
│  └─────────────────────────────────────┘                        │
│                                                                 │
│  ─────────────────────────────────────                          │
│                                                                 │
│  ┌─────────────────────────────────────┐                        │
│  │         💬 Talk to your Coach       │   ← Premium            │
│  └─────────────────────────────────────┘                        │
│                                                                 │
│  ┌─────────────────────────────────────┐                        │
│  │ Your Partner: Sarah M.              │   ← If has partner     │
│  │ ✓ Worked out today • 🔥 24 days     │                        │
│  │ [👏 Cheer]                          │                        │
│  └─────────────────────────────────────┘                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

[Home] [Goals] [Progress] [Profile]
```

---

### Goals Screen

```
┌─────────────────────────────────────────────────────────────────┐
│  Your Goals                                          [+ Add]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ACTIVE                                                         │
│  ─────────────────────────────────────                          │
│                                                                 │
│  ┌─────────────────────────────────────┐                        │
│  │ 🏋️ Work out                         │                        │
│  │ 3x per week                         │                        │
│  │ Reminder: 6:00 PM                   │                        │
│  │                                     │                        │
│  │ This week: 2/3                      │                        │
│  │ Current streak: 12 days             │                        │
│  │ Best: 18 days                       │                        │
│  │                               [→]   │                        │
│  └─────────────────────────────────────┘                        │
│                                                                 │
│  ┌─────────────────────────────────────┐                        │
│  │ 📚 Read                             │                        │
│  │ Daily                               │                        │
│  │ Reminder: 9:00 PM                   │                        │
│  │                                     │                        │
│  │ This week: 5/7                      │                        │
│  │ Current streak: 5 days              │                        │
│  │ Best: 12 days                       │                        │
│  │                               [→]   │                        │
│  └─────────────────────────────────────┘                        │
│                                                                 │
│  ─────────────────────────────────────                          │
│  ARCHIVED (2)                                          [▼]      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

[Home] [Goals] [Progress] [Profile]
```

---

### Progress Screen

```
┌─────────────────────────────────────────────────────────────────┐
│  Your Progress                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  THIS WEEK                                                      │
│  ─────────────────────────────────────                          │
│  M   T   W   Th  F   S   Su                                     │
│  ✓   ✓   ✗   ✓   ·   ·   ·                                     │
│                                                                 │
│  Workouts: 3/3 ✓                                                │
│  Reading: 4/7                                                   │
│                                                                 │
│  ─────────────────────────────────────                          │
│                                                                 │
│  CONSISTENCY                                                    │
│  ─────────────────────────────────────                          │
│  This month: 78%  ↑ from last month                             │
│                                                                 │
│  [  Calendar heat map showing last 30 days  ]                   │
│  [  ■ = completed, □ = missed, · = rest     ]                   │
│                                                                 │
│  ─────────────────────────────────────                          │
│                                                                 │
│  INSIGHTS                                   [Premium badge]      │
│  ─────────────────────────────────────                          │
│  📊 Best day: Monday (92% success rate)                         │
│  📊 Hardest day: Wednesday (45%)                                │
│  📊 Current streak: 12 days                                     │
│  📊 Longest streak: 18 days                                     │
│                                                                 │
│  ─────────────────────────────────────                          │
│                                                                 │
│  WEEKLY RECAP                               [Premium badge]      │
│  ─────────────────────────────────────                          │
│  ┌─────────────────────────────────────┐                        │
│  │ 📊 Week of Jan 6-12                 │                        │
│  │ "Solid week! You pushed through..." │                        │
│  │                          [View →]   │                        │
│  └─────────────────────────────────────┘                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

[Home] [Goals] [Progress] [Profile]
```

---

### Profile Screen

```
┌─────────────────────────────────────────────────────────────────┐
│  Profile                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Avatar - selectable from preset list]                         │
│  Mike Johnson                                                   │
│  Member since Jan 2025                                          │
│                                                                 │
│  ┌─────────────────────────────────────┐                        │
│  │ 🔥 12        │ 📅 78%    │ 🏆 3     │                        │
│  │ Day Streak  │ This Month│ Goals    │                        │
│  └─────────────────────────────────────┘                        │
│                                                                 │
│  ─────────────────────────────────────                          │
│                                                                 │
│  💎 SUBSCRIPTION (if not premium)                               │
│  ─────────────────────────────────────                          │
│  ┌─────────────────────────────────────┐                        │
│  │ Upgrade to Premium                   │                       │
│  │ Unlimited goals, AI coach, patterns  │                       │
│  │                      [Upgrade Now →] │                       │
│  └─────────────────────────────────────┘                        │
│                                                                 │
│  ─────────────────────────────────────                          │
│                                                                 │
│  SOCIAL                                                         │
│  ─────────────────────────────────────                          │
│  [👥] My Partners        2 partners • 1 pending [→]             │
│  [🔔] Partner Activity     Nudges & cheers (3) [→]              │
│                                                                 │
│  ─────────────────────────────────────                          │
│                                                                 │
│  INSIGHTS                                                       │
│  ─────────────────────────────────────                          │
│  [📊] Weekly Recaps       AI progress summaries [⭐→]           │
│  [📈] Analytics           Charts & detailed stats [⭐→]         │
│  [🏆] Achievements        Milestones & badges [→]               │
│                                                                 │
│  ─────────────────────────────────────                          │
│                                                                 │
│  SETTINGS                                                       │
│  ─────────────────────────────────────                          │
│  [👤] Account Settings                               [→]        │
│  [🎯] Personalization       Motivation style & prefs [→]        │
│  [🔔] Notifications                      Reminders [→]          │
│  [🌙] Theme                                    Auto [→]         │
│                                                                 │
│  ─────────────────────────────────────                          │
│                                                                 │
│  SUPPORT                                                        │
│  ─────────────────────────────────────                          │
│  [❓] Help Center                      FAQs & guides [→]        │
│  [✉️] Contact Us                    Email or chat [→]           │
│  [⭐] Rate the App                         v1.0.0 [→]           │
│  [📤] Invite Friends             Share & get rewards [→]        │
│                                                                 │
│  ─────────────────────────────────────                          │
│                                                                 │
│  LEGAL                                                          │
│  ─────────────────────────────────────                          │
│  [📥] Export My Data                       (GDPR) [→]           │
│  [📜] Privacy Policy                              [→]           │
│  [📜] Terms of Service                            [→]           │
│                                                                 │
│  ─────────────────────────────────────                          │
│                                                                 │
│  [Log Out]                                                      │
│                                                                 │
│  App version 1.0.0                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

[Home] [Goals] [Progress] [Profile]
```

**Profile Menu Structure (Implementation Reference):**

```typescript
// Sections and menu items for ProfileScreen

const socialMenuItems = [
  {
    id: "partners",
    icon: "people",
    label: "My Partners",
    route: ROUTES.PARTNERS,
    badge: pendingRequestsCount,
  },
  {
    id: "activity",
    icon: "notifications",
    label: "Partner Activity",
    route: ROUTES.ACTIVITY,
    badge: unreadNudgesCount,
  },
];

const insightsMenuItems = [
  {
    id: "weekly_recaps",
    icon: "analytics",
    label: "Weekly Recaps",
    route: ROUTES.WEEKLY_RECAPS,
    premium: true,
  },
  {
    id: "analytics",
    icon: "bar-chart",
    label: "Analytics",
    route: ROUTES.ANALYTICS,
    premium: true,
  },
  {
    id: "achievements",
    icon: "trophy",
    label: "Achievements",
    route: ROUTES.ACHIEVEMENTS,
  },
];

const settingsMenuItems = [
  {
    id: "account_settings",
    icon: "person",
    label: "Account Settings",
    route: ROUTES.ACCOUNT_SETTINGS,
  },
  {
    id: "personalization",
    icon: "options-outline",
    label: "Personalization",
    route: ROUTES.PERSONALIZATION,
  },
  {
    id: "notifications",
    icon: "notifications-outline",
    label: "Notifications",
    route: ROUTES.NOTIFICATION_SETTINGS,
  },
  {
    id: "theme",
    icon: "moon-outline",
    label: "Theme",
    value: currentTheme,
    action: openThemeModal,
  },
];

const supportMenuItems = [
  {
    id: "help",
    icon: "help-circle-outline",
    label: "Help Center",
    route: ROUTES.HELP_CENTER,
  },
  {
    id: "contact",
    icon: "mail-outline",
    label: "Contact Us",
    route: ROUTES.CONTACT,
  },
  {
    id: "rate_app",
    icon: "star-outline",
    label: "Rate the App",
    action: openStoreReview,
  },
  {
    id: "referral",
    icon: "share-outline",
    label: "Invite Friends",
    route: ROUTES.REFERRAL,
  },
];

const legalMenuItems = [
  {
    id: "export_data",
    icon: "download-outline",
    label: "Export My Data",
    action: requestDataExport,
  },
  {
    id: "privacy",
    icon: "document-text-outline",
    label: "Privacy Policy",
    action: openPrivacyPolicy,
  },
  {
    id: "terms",
    icon: "document-text-outline",
    label: "Terms of Service",
    action: openTerms,
  },
];
```

---

## 📁 Project Structure

This section outlines the monorepo structure and database architecture.

### Folder Structure

```
fitnudge/
├── apps/
│   ├── mobile/              # React Native app (Expo)
│   │   └── src/             # All source code
│   ├── api/                 # FastAPI Backend (Python)
│   │   └── supabase/        # Database migrations
│   ├── web/                 # Marketing website/blog
│   ├── admin-portal/        # Admin dashboard
│   └── docs/                # Documentation
├── packages/                # Shared packages
│   ├── ui/                  # Shared components
│   ├── lib/                 # Utilities
│   ├── assets/              # Fonts
│   └── tsconfig/            # TypeScript configs
├── oldfiles/                # Archived experimental code (reference only)
```

**Structure benefits:**

1. **Clean codebase** - Production-ready code in `apps/`
2. **Standard paths** - `apps/mobile` and `apps/api` are intuitive
3. **Monorepo ready** - pnpm workspace picks up apps automatically
4. **Shared packages** - Common code in `packages/`

**Database:**

- Supabase (PostgreSQL) with Row Level Security
- Migrations in `apps/api/supabase/migrations/`
- Realtime enabled for partners and notifications

### Core Tables

These tables are essential for the app:

| Table                      | Purpose                     | Notes                          |
| -------------------------- | --------------------------- | ------------------------------ |
| `users`                    | Core user data              | Includes language, preferences |
| `goals`                    | User goals                  | Simplified goal structure      |
| `check_ins`                | Daily check-ins             | Core feature                   |
| `accountability_partners`  | Partner matching            | Premium feature                |
| `nudges`                   | Cheers, nudges, milestones  | Social feature                 |
| `daily_motivations`        | Morning motivation messages | Free feature                   |
| `ai_coach_sessions`        | AI chat sessions            | Premium feature                |
| `ai_coach_messages`        | Chat message history        | Premium feature                |
| `weekly_recaps`            | Weekly AI summaries         | Premium feature                |
| `pattern_insights`         | Pattern detection           | Premium feature                |
| `notification_history`     | Notification log            | Analytics                      |
| `notification_preferences` | User notification settings  | Settings                       |
| `subscriptions`            | User subscription status    | RevenueCat                     |
| `achievements`             | User badges                 | Gamification                   |
| `achievement_definitions`  | Badge definitions           | Gamification                   |
| `oauth_accounts`           | SSO connections             | Apple/Google login             |
| `data_export_requests`     | GDPR data exports           | Compliance                     |
| `blog_posts`               | Blog content                | Website                        |
| `blog_categories`          | Blog categories             | Website                        |
| `user_reports`             | User safety reports         | Moderation                     |
| `referral_codes`           | User referral codes         | Keep - growth                  |
| `referral_redemptions`     | Referral tracking           | Keep - growth                  |
| `achievements`             | Milestones & badges         | Keep - gamification            |

**Notes:**

- `admin_users` table REMOVED → use `role` column in `users` table instead
- `user_consents` table REMOVED → not needed for this app
- `partnerships` renamed to `accountability_partners` to match existing code
- `cheers` replaced by `social_nudges` (more flexible)

### Tables to ARCHIVE/REMOVE (V1-Specific)

These tables were for V1 features that are being removed:

| Table                    | V1 Purpose              | V2 Action      |
| ------------------------ | ----------------------- | -------------- |
| `meal_logs`              | Meal tracking           | Archive & drop |
| `meal_plans`             | AI-generated meal plans | Archive & drop |
| `workout_logs`           | Workout tracking        | Archive & drop |
| `workout_plans`          | AI-generated workouts   | Archive & drop |
| `habit_plans`            | AI-generated habits     | Archive & drop |
| `exercises`              | Exercise database       | Archive & drop |
| `user_exercises`         | User custom exercises   | Archive & drop |
| `actionable_plans`       | AI plan generation      | Archive & drop |
| `hydration_logs`         | Water tracking          | Archive & drop |
| `fitness_profiles`       | Complex questionnaire   | Archive & drop |
| `social_posts`           | Social feed             | Archive & drop |
| `post_likes`             | Social engagement       | Archive & drop |
| `post_comments`          | Social comments         | Archive & drop |
| `challenges`             | Group challenges        | Archive & drop |
| `challenge_participants` | Challenge members       | Archive & drop |
| `challenge_invitations`  | Challenge invites       | Archive & drop |
| `progress_photos`        | Before/after photos     | Archive & drop |

### Users Table Simplification

The `users` table can be simplified, removing V1-specific fitness columns:

```sql
-- Columns to KEEP in users table:
id, auth_id, email, first_name, last_name, avatar_url, timezone,
language, -- NEW: for multilingual support (e.g., 'en', 'es', 'fr')
role, -- NEW: 'user' (default) or 'admin' (replaces admin_users table)
motivation_style, morning_motivation_enabled, morning_motivation_time,
subscription_tier, subscription_expires_at,
notifications_enabled, created_at, updated_at, last_active_at

-- Columns to REMOVE (V1 fitness-specific):
height, weight, date_of_birth, gender, fitness_goal, activity_level,
dietary_preferences, fitness_experience, weekly_workout_frequency,
onboarding_completed_at, fitness_profile_completed, expo_push_token

-- NOTE: expo_push_token removed because device_tokens table handles this
-- NOTE: admin_users table removed - use role column instead
```

### Migration Steps

1. **Backup** - Full database backup before any changes
2. **Archive** - Export V1 table data to cold storage (S3/GCS)
3. **Add new columns** - Any new columns for V2 features
4. **Remove columns** - Drop unused columns from `users`
5. **Drop tables** - Remove V1-specific tables
6. **Vacuum** - Reclaim storage space

---

## 🗄️ Database Schema

### Core Tables

```sql
-- =====================================================
-- USERS
-- =====================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Auth (linked to Supabase Auth)
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,

  -- Profile
  first_name TEXT NOT NULL,
  last_name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'UTC',
  language TEXT DEFAULT 'en', -- Multilingual support: 'en', 'es', 'fr', etc.

  -- Role (replaces admin_users table)
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),

  -- Preferences
  motivation_style TEXT DEFAULT 'supportive' CHECK (motivation_style IN ('supportive', 'tough_love', 'calm')),
  morning_motivation_enabled BOOLEAN DEFAULT true,
  morning_motivation_time TIME DEFAULT '08:00',

  -- Subscription
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium')),
  subscription_expires_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- GOALS
-- =====================================================
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Goal definition
  title TEXT NOT NULL,

  -- Frequency
  frequency_type TEXT NOT NULL CHECK (frequency_type IN ('daily', 'weekly')),
  frequency_count INTEGER DEFAULT 7, -- For weekly: how many times per week
  target_days INTEGER[] DEFAULT ARRAY[]::INTEGER[], -- 0=Sun, 1=Mon, etc. Empty = any day

  -- Reminder
  reminder_times TIME[] NOT NULL DEFAULT ARRAY['18:00'::TIME],

  -- Motivation
  why_statement TEXT, -- User's personal "why"

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),

  -- Stats (denormalized for performance)
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  total_completions INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_goals_status ON goals(status);

-- =====================================================
-- CHECK-INS
-- =====================================================
CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,

  -- Check-in data
  check_in_date DATE NOT NULL,
  completed BOOLEAN NOT NULL,
  is_rest_day BOOLEAN DEFAULT false,

  -- Reflection (optional)
  mood TEXT CHECK (mood IN ('tough', 'good', 'amazing')),
  skip_reason TEXT CHECK (skip_reason IN ('work', 'tired', 'sick', 'schedule', 'other')),
  note TEXT,

  -- Voice note (Premium)
  voice_note_url TEXT,
  voice_note_transcript TEXT,

  -- AI response
  ai_response TEXT, -- The personalized message AI sent after check-in

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, goal_id, check_in_date)
);

CREATE INDEX idx_check_ins_user_date ON check_ins(user_id, check_in_date);
CREATE INDEX idx_check_ins_goal_date ON check_ins(goal_id, check_in_date);

-- =====================================================
-- ACCOUNTABILITY PARTNERS (handles pending requests via status)
-- =====================================================
CREATE TABLE accountability_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Partners
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Status: pending (request sent), accepted (active), rejected, blocked
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
  initiated_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,

  -- Ensure unique partnership per user pair
  UNIQUE(user_id, partner_user_id)
);

CREATE INDEX idx_partners_user ON accountability_partners(user_id);
CREATE INDEX idx_partners_partner ON accountability_partners(partner_user_id);
CREATE INDEX idx_partners_status ON accountability_partners(status);

-- =====================================================
-- SOCIAL NUDGES (Cheers, Nudges, Milestones)
-- =====================================================
CREATE TABLE social_nudges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who and where
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Context
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  partnership_id UUID REFERENCES accountability_partners(id) ON DELETE CASCADE,

  -- Content
  nudge_type TEXT NOT NULL CHECK (nudge_type IN (
    'nudge',     -- Reminder to check in
    'cheer',     -- Quick encouragement (👏 💪 🔥 ⭐ 🎯)
    'milestone', -- Celebrating streak/achievement
    'message'    -- Custom message (if enabled)
  )),
  emoji TEXT, -- For cheers: the emoji used
  message TEXT, -- Optional custom message

  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nudges_recipient ON social_nudges(recipient_id);
CREATE INDEX idx_nudges_unread ON social_nudges(recipient_id, is_read) WHERE is_read = false;

-- =====================================================
-- AI CONVERSATIONS (Premium)
-- =====================================================
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Conversation metadata
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  message_count INTEGER DEFAULT 0
);

CREATE TABLE ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,

  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_messages_conversation ON ai_messages(conversation_id);

-- =====================================================
-- WEEKLY RECAPS (Premium)
-- =====================================================
CREATE TABLE weekly_recaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Week info
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,

  -- Stats
  goals_hit INTEGER DEFAULT 0,
  goals_total INTEGER DEFAULT 0,
  consistency_percent DECIMAL(5,2),

  -- AI-generated content
  summary TEXT,
  win TEXT,
  insight TEXT,
  focus_next_week TEXT,
  motivational_close TEXT,

  -- Metadata
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,

  UNIQUE(user_id, week_start)
);

-- =====================================================
-- PATTERN INSIGHTS (Premium)
-- =====================================================
CREATE TABLE pattern_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE, -- NULL for cross-goal insights

  -- Insight data
  insight_type TEXT NOT NULL CHECK (insight_type IN (
    'best_day', 'worst_day', 'dropout_point',
    'skip_reason_pattern', 'success_pattern', 'time_pattern'
  )),
  insight_text TEXT NOT NULL,
  insight_data JSONB, -- Raw data backing the insight

  -- Validity
  valid_from DATE NOT NULL,
  valid_until DATE, -- NULL = still valid

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- NOTIFICATIONS LOG
-- =====================================================
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'check_in', 'morning_motivation', 'adaptive_nudge',
    'partner_activity', 'weekly_recap', 'streak_milestone'
  )),

  -- Content
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,

  -- Status
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  response TEXT, -- For check-ins: 'yes', 'no', 'rest'

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_log_user ON notification_log(user_id);

-- =====================================================
-- DAILY MOTIVATIONS (Free feature)
-- =====================================================
CREATE TABLE daily_motivations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  background_style TEXT DEFAULT 'gradient_sunset',
  date DATE NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  share_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_motivations_user_id ON daily_motivations(user_id);
CREATE INDEX idx_daily_motivations_date ON daily_motivations(date DESC);
CREATE INDEX idx_daily_motivations_user_date ON daily_motivations(user_id, date DESC);

-- =====================================================
-- ACHIEVEMENT TYPES (Badge Definitions)
-- =====================================================
CREATE TABLE achievement_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_key TEXT UNIQUE NOT NULL,
  badge_name TEXT NOT NULL,
  badge_description TEXT,
  badge_icon TEXT,
  unlock_condition JSONB NOT NULL, -- e.g., {"type": "streak", "value": 7}
  category TEXT DEFAULT 'general' CHECK (category IN ('streak', 'milestone', 'consistency', 'social', 'special')),
  rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  points INTEGER DEFAULT 10,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- USER ACHIEVEMENTS (Unlocked Badges)
-- =====================================================
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_type_id UUID NOT NULL REFERENCES achievement_types(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, achievement_type_id, goal_id)
);

CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);
```

### Infrastructure Tables

These tables already exist in the codebase and should be kept as-is:

```sql
-- =====================================================
-- DEVICE TOKENS (Push Notifications)
-- =====================================================
CREATE TABLE device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL, -- Expo push token
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  device_id TEXT, -- Unique device identifier
  timezone TEXT DEFAULT 'UTC',
  app_version TEXT,
  os_version TEXT,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(token)
);

-- =====================================================
-- NOTIFICATION PREFERENCES
-- =====================================================
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,

  -- Global toggle
  enabled BOOLEAN DEFAULT true,

  -- Individual notification types
  ai_motivation BOOLEAN DEFAULT true,      -- Daily motivation messages
  reminders BOOLEAN DEFAULT true,          -- Check-in reminders
  social BOOLEAN DEFAULT true,             -- Partner activity, cheers, nudges
  achievements BOOLEAN DEFAULT true,       -- Streak milestones, badges
  weekly_recaps BOOLEAN DEFAULT true,      -- Weekly AI recaps

  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '08:00',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SUBSCRIPTIONS (RevenueCat)
-- =====================================================
CREATE TABLE subscription_plans (
  id TEXT PRIMARY KEY, -- 'free', 'premium'
  name TEXT NOT NULL,
  description TEXT,
  monthly_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  annual_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  active_goal_limit INTEGER DEFAULT 1,
  tier INTEGER DEFAULT 0, -- 0=free, 1=premium
  is_popular BOOLEAN DEFAULT false,
  has_trial BOOLEAN DEFAULT false,
  trial_days INTEGER,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,

  -- RevenueCat Product IDs
  product_id_ios_monthly TEXT,
  product_id_ios_annual TEXT,
  product_id_android_monthly TEXT,
  product_id_android_annual TEXT,

  -- Exit offer (discount when user tries to cancel)
  exit_offer_enabled BOOLEAN DEFAULT false,
  exit_offer_monthly_price DECIMAL(10,2),
  exit_offer_annual_price DECIMAL(10,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free' REFERENCES subscription_plans(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'trial', 'grace_period', 'billing_issue')),
  provider TEXT DEFAULT 'revenuecat',
  provider_subscription_id TEXT,
  product_id TEXT, -- RevenueCat product identifier
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT subscriptions_plan_check CHECK (plan IN ('free', 'premium'))
);

CREATE TABLE plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id TEXT NOT NULL, -- 'free' or 'premium'
  feature_key TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  feature_description TEXT,
  feature_value INTEGER, -- NULL = unlimited, number = limit
  is_enabled BOOLEAN DEFAULT true, -- true = user has access, false = upgrade required
  sort_order INTEGER DEFAULT 0,
  ai_description TEXT, -- For AI context when generating responses
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, feature_key)
);

CREATE INDEX idx_plan_features_plan ON plan_features(plan_id);
CREATE INDEX idx_plan_features_key ON plan_features(feature_key);

-- =====================================================
-- AUTHENTICATION
-- =====================================================
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE TABLE oauth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('apple', 'google')),
  provider_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, provider_user_id)
);

CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE email_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- COMPLIANCE (GDPR)
-- =====================================================
CREATE TABLE user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,
  consented BOOLEAN NOT NULL,
  consented_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE TABLE data_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  file_url TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- =====================================================
-- AUDIT (admin_users removed - use role column in users table)
-- =====================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID, -- Can be user or admin
  actor_type TEXT CHECK (actor_type IN ('user', 'admin', 'system')),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  permissions JSONB,
  rate_limit INTEGER DEFAULT 1000,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- OPERATIONS & MONITORING
-- =====================================================
CREATE TABLE app_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  version TEXT NOT NULL,
  build_number INTEGER,
  min_required BOOLEAN DEFAULT false,
  release_notes TEXT,
  released_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, version)
);

-- System health history (for tracking degraded/critical states)
CREATE TABLE system_health_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  status TEXT NOT NULL CHECK (status IN ('degraded', 'critical')),
  environment TEXT NOT NULL,
  version TEXT,
  summary_key TEXT NOT NULL,
  summary_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  impacted JSONB NOT NULL DEFAULT '[]'::jsonb,
  report JSONB NOT NULL
);

CREATE INDEX idx_system_health_history_created ON system_health_history(created_at DESC);

-- System health updates (for tracking resolution status)
CREATE TABLE system_health_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  history_id UUID NOT NULL REFERENCES system_health_history(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'identified' CHECK (status IN ('identified', 'monitoring', 'resolved'))
);

CREATE INDEX idx_system_health_updates_history ON system_health_updates(history_id, created_at);

CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- AI COACH USAGE TRACKING
-- =====================================================
CREATE TABLE ai_coach_daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  message_count INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_ai_coach_usage_user_date ON ai_coach_daily_usage(user_id, date);

-- =====================================================
-- REFERRAL SYSTEM
-- =====================================================
CREATE TABLE referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  code TEXT NOT NULL UNIQUE,
  uses_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE referral_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES users(id) ON DELETE CASCADE,
  referral_code_id UUID REFERENCES referral_codes(id),
  reward_granted BOOLEAN DEFAULT false,
  redeemed_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- DAILY CHECK-IN SUMMARIES (for scalability)
-- =====================================================
CREATE TABLE daily_checkin_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  summary_date DATE NOT NULL,

  -- Aggregated stats
  total_check_ins INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  rest_day_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,

  -- Streak info at end of day
  streak_at_date INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, goal_id, summary_date)
);

CREATE INDEX idx_checkin_summaries_user_date ON daily_checkin_summaries(user_id, summary_date DESC);
CREATE INDEX idx_checkin_summaries_goal ON daily_checkin_summaries(goal_id);

-- =====================================================
-- BLOG (for website)
-- =====================================================
CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT,
  excerpt TEXT,
  featured_image_url TEXT,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE blog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE blog_post_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES blog_categories(id) ON DELETE CASCADE,
  UNIQUE(post_id, category_id)
);

CREATE TABLE blog_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE blog_post_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES blog_tags(id) ON DELETE CASCADE,
  UNIQUE(post_id, tag_id)
);

CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_published ON blog_posts(published_at DESC) WHERE status = 'published';
```

---

### Subscription Plans & Features (V2 Seed Data)

```sql
-- =====================================================
-- SUBSCRIPTION PLANS
-- =====================================================
INSERT INTO subscription_plans (
  id, name, description, monthly_price, annual_price,
  active_goal_limit, tier, is_popular, has_trial, trial_days, sort_order,
  product_id_ios_monthly, product_id_ios_annual,
  product_id_android_monthly, product_id_android_annual,
  exit_offer_enabled, exit_offer_monthly_price, exit_offer_annual_price, is_active
) VALUES
(
  'free', 'Free', 'Get started with basic goal tracking',
  0.00, 0.00, 2, 2, 0, false, false, null, 1,
  null, null, null, null,
  false, null, null, true
),
(
  'premium', 'Premium', 'Unlock everything - unlimited goals, AI coaching, and insights',
  9.99, 79.99, null, null, 1, true, true, 3, 2,
  'com.fitnudge.premium.monthly', 'com.fitnudge.premium.annual',
  'com.fitnudge.premium.monthly', 'com.fitnudge.premium.annual',
  true, 4.99, 39.99, true
);

-- =====================================================
-- PLAN FEATURES - FREE TIER
-- =====================================================
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order, ai_description)
VALUES
  -- Goal limits
  ('free', 'active_goal_limit', 'Active Goals', 'Maximum active goals at a time', 2, true, 1, 'User can have 2 active goals'),

  -- Partner limits
  ('free', 'accountability_partner_limit', 'Accountability Partners', 'Maximum accountability partners', 1, true, 2, 'User can have 1 accountability partner'),

  -- Core features (enabled)
  ('free', 'daily_checkins', 'Daily Check-ins', 'Yes/No check-ins with AI response', NULL, true, 10, 'daily check-ins with AI responses'),
  ('free', 'streak_tracking', 'Streak Tracking', 'Track current and longest streaks', NULL, true, 11, 'streak tracking'),
  ('free', 'daily_motivation', 'Daily Motivation', 'Morning AI motivation messages', NULL, true, 12, 'daily AI motivation messages'),
  ('free', 'basic_stats', 'Basic Stats', 'Consistency percentage and basic stats', NULL, true, 13, 'basic progress stats'),

  -- Premium features (disabled on free - shown in UI as "upgrade to unlock")
  ('free', 'ai_coach_chat', 'AI Coach Chat', 'Chat with your AI coach anytime', NULL, false, 20, 'AI coaching chat (upgrade to unlock)'),
  ('free', 'pattern_detection', 'Smart Pattern Detection', 'AI detects your habit patterns', NULL, false, 21, 'pattern detection (upgrade to unlock)'),
  ('free', 'weekly_recap', 'Weekly AI Recaps', 'Personalized weekly summaries', NULL, false, 22, 'weekly recaps (upgrade to unlock)'),
  ('free', 'advanced_analytics', 'Advanced Analytics', 'Detailed charts and insights', NULL, false, 23, 'advanced analytics (upgrade to unlock)'),
  ('free', 'adaptive_nudging', 'Adaptive Nudging', 'Smart nudges based on patterns', NULL, false, 24, 'adaptive nudging (upgrade to unlock)'),
  ('free', 'voice_notes', 'Voice Notes', 'Record voice reflections', NULL, false, 25, 'voice notes (upgrade to unlock)');

-- =====================================================
-- PLAN FEATURES - PREMIUM TIER ($9.99/month)
-- =====================================================
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order, ai_description)
VALUES
  -- Unlimited limits (NULL = unlimited)
  ('premium', 'active_goal_limit', 'Unlimited Goals', 'No limit on active goals', NULL, true, 1, 'User can have unlimited goals'),
  ('premium', 'accountability_partner_limit', 'Up to 3 Partners', 'Connect with up to 3 accountability partners', 3, true, 2, 'User can have up to 3 accountability partners'),

  -- All free features (inherited)
  ('premium', 'daily_checkins', 'Daily Check-ins', 'Yes/No check-ins with AI response', NULL, true, 10, 'daily check-ins with AI responses'),
  ('premium', 'streak_tracking', 'Streak Tracking', 'Track current and longest streaks', NULL, true, 11, 'streak tracking'),
  ('premium', 'daily_motivation', 'Daily Motivation', 'Morning AI motivation messages', NULL, true, 12, 'daily AI motivation messages'),
  ('premium', 'basic_stats', 'Basic Stats', 'Consistency percentage and basic stats', NULL, true, 13, 'basic progress stats'),

  -- Premium-only features (all enabled)
  ('premium', 'ai_coach_chat', 'AI Coach Chat', 'Chat with your AI coach anytime for personalized guidance', NULL, true, 20, 'AI coaching chatbot for personalized guidance'),
  ('premium', 'pattern_detection', 'Smart Pattern Detection', 'AI detects patterns like best/worst days, dropout points', NULL, true, 21, 'AI pattern detection for habit insights'),
  ('premium', 'weekly_recap', 'Weekly AI Recaps', 'Personalized weekly summaries with wins, insights, focus areas', NULL, true, 22, 'weekly AI-generated progress summaries'),
  ('premium', 'advanced_analytics', 'Advanced Analytics', 'Detailed charts, heatmaps, and trend analysis', NULL, true, 23, 'advanced analytics and insights'),
  ('premium', 'adaptive_nudging', 'Adaptive Nudging', 'Extra check-ins when you are about to break streak', NULL, true, 24, 'smart nudges based on behavior patterns'),
  ('premium', 'voice_notes', 'Voice Notes', 'Record voice reflections after check-ins (60 sec max)', NULL, true, 25, 'voice note reflections'),
  ('premium', 'partner_insights', 'Partner Insights', 'AI insights about your partnership patterns', NULL, true, 26, 'AI insights about accountability partnerships'),
  ('premium', 'priority_support', 'Priority Support', 'Faster response times from support team', NULL, true, 40, 'priority customer support');
```

**Feature Keys Quick Reference:**

| Feature Key                    | Free | Premium          | Description           |
| ------------------------------ | ---- | ---------------- | --------------------- |
| `active_goal_limit`            | 2    | NULL (unlimited) | Max active goals      |
| `accountability_partner_limit` | 1    | 3                | Max partners          |
| `daily_checkins`               | ✅   | ✅               | Core check-in feature |
| `streak_tracking`              | ✅   | ✅               | Streak tracking       |
| `daily_motivation`             | ✅   | ✅               | Morning AI messages   |
| `basic_stats`                  | ✅   | ✅               | Basic stats           |
| `ai_coach_chat`                | ❌   | ✅               | AI chat coach         |
| `pattern_detection`            | ❌   | ✅               | Smart patterns        |
| `weekly_recap`                 | ❌   | ✅               | Weekly summaries      |
| `advanced_analytics`           | ❌   | ✅               | Charts & insights     |
| `adaptive_nudging`             | ❌   | ✅               | Smart nudges          |
| `voice_notes`                  | ❌   | ✅               | Voice reflections     |
| `partner_insights`             | ❌   | ✅               | Partnership AI        |
| `priority_support`             | ❌   | ✅               | Fast support          |

---

### Row Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE accountability_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_nudges ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coach_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_recaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_motivations ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY users_own_data ON users
  FOR ALL USING (auth.uid() = auth_id);

CREATE POLICY goals_own_data ON goals
  FOR ALL USING (user_id IN (
    SELECT id FROM users WHERE auth_id = auth.uid()
  ));

CREATE POLICY check_ins_own_data ON check_ins
  FOR ALL USING (user_id IN (
    SELECT id FROM users WHERE auth_id = auth.uid()
  ));

-- Partners can see each other's limited data
CREATE POLICY partners_participants ON accountability_partners
  FOR SELECT USING (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR partner_user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- Nudges: users can see nudges they sent or received
CREATE POLICY nudges_own_data ON social_nudges
  FOR SELECT USING (
    sender_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR recipient_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- Blog posts are public for reading
CREATE POLICY blog_posts_public_read ON blog_posts
  FOR SELECT USING (status = 'published');
```

---

## 🔌 API Endpoints

### Authentication

```
POST   /api/v1/auth/signup          # Create account
POST   /api/v1/auth/login           # Login
POST   /api/v1/auth/logout          # Logout
POST   /api/v1/auth/refresh         # Refresh token
POST   /api/v1/auth/forgot-password # Request password reset
POST   /api/v1/auth/reset-password  # Reset password
DELETE /api/v1/auth/account         # Delete account (GDPR)
```

### Users

```
GET    /api/v1/users/me             # Get current user profile
PATCH  /api/v1/users/me             # Update profile
PATCH  /api/v1/users/me/preferences # Update preferences
POST   /api/v1/users/me/push-token  # Register push token
GET    /api/v1/users/me/stats       # Get user statistics
```

### Goals

```
GET    /api/v1/goals                # List all goals
POST   /api/v1/goals                # Create goal
GET    /api/v1/goals/:id            # Get goal details
PATCH  /api/v1/goals/:id            # Update goal
DELETE /api/v1/goals/:id            # Delete goal
POST   /api/v1/goals/:id/archive    # Archive goal
POST   /api/v1/goals/:id/unarchive  # Unarchive goal
```

### Check-ins

**V2.1 Architecture: Pre-created Check-ins**

Check-ins are now PRE-CREATED with `status='pending'` to enable accurate "missed" tracking:

1. **Daily Task**: `precreate_daily_checkins` runs hourly, creating pending check-ins for all active goals where today is a scheduled day
2. **Goal Creation Trigger**: When a goal is created/reactivated, a pending check-in is created if today is scheduled
3. **User Response**: When user responds (Yes/No/Rest), the pending check-in is UPDATED (not inserted)
4. **End of Day**: `mark_missed_checkins` runs hourly, marking remaining pending check-ins as 'missed'

**Check-in Status Values:**
- `pending` - Pre-created, awaiting user response
- `completed` - User marked as done
- `skipped` - User explicitly skipped (with optional skip_reason)
- `missed` - Day passed without user response
- `rest_day` - User marked as rest day (preserves streak)

```
GET    /api/v1/check-ins            # List check-ins (with date filters)
POST   /api/v1/check-ins            # Update pending check-in with response
GET    /api/v1/check-ins/today      # Get today's check-ins
PATCH  /api/v1/check-ins/:id        # Update check-in (add note, etc.)
```

**Check-in Request:**

```json
{
  "goal_id": "uuid",
  "completed": true,
  "is_rest_day": false,
  "mood": "good",
  "note": "Felt great today!"
}
```

**Check-in Response (includes AI message and status):**

```json
{
  "id": "uuid",
  "goal_id": "uuid",
  "status": "completed",
  "completed": true,
  "ai_response": "That's 13 days in a row, Mike! You're building something real. Keep this momentum going! 🔥",
  "current_streak": 13,
  "is_new_milestone": true,
  "milestone_message": "🏆 New personal best! 13 days!"
}
```

### Streaks

```
GET    /api/v1/streaks              # Get all streak data
GET    /api/v1/streaks/:goal_id     # Get streak for specific goal
GET    /api/v1/streaks/history      # Get streak history
```

### AI Coach (Premium)

```
GET    /api/v1/ai/conversations              # List conversations
POST   /api/v1/ai/conversations              # Start new conversation
GET    /api/v1/ai/conversations/:id          # Get conversation
POST   /api/v1/ai/conversations/:id/messages # Send message (SSE streaming response)
```

**Send Message Request:**

```json
{
  "content": "I'm struggling to stay motivated this week"
}
```

**Streaming Response (SSE):**

```
data: {"type": "start"}
data: {"type": "token", "content": "I"}
data: {"type": "token", "content": " hear"}
data: {"type": "token", "content": " you"}
...
data: {"type": "done", "message_id": "uuid"}
```

### Partners (Premium)

```
GET    /api/v1/partners              # Get current partner
POST   /api/v1/partners/find         # Request partner matching
DELETE /api/v1/partners              # End partnership
POST   /api/v1/partners/cheer        # Send cheer to partner
GET    /api/v1/partners/activity     # Get partner's recent activity
```

### Weekly Recaps (Premium)

```
GET    /api/v1/recaps                # List recaps
GET    /api/v1/recaps/current        # Get current week's recap
GET    /api/v1/recaps/:id            # Get specific recap
POST   /api/v1/recaps/:id/viewed     # Mark as viewed
```

### Insights (Premium)

```
GET    /api/v1/insights              # Get all insights
GET    /api/v1/insights/patterns     # Get pattern insights
GET    /api/v1/insights/summary      # Get insights summary
```

### Subscriptions

```
GET    /api/v1/subscriptions/status  # Get subscription status
POST   /api/v1/subscriptions/verify  # Verify receipt (RevenueCat webhook)
GET    /api/v1/subscriptions/plans   # Get available plans
```

---

## 🔔 Push Notification System

### Notification Behavior

All notifications use **tap-to-open** behavior:
- User taps notification → App opens via deep link
- For check-in prompts: Opens goal detail screen which auto-opens `CheckInModal` if:
  - Goal is active
  - Today is a scheduled day
  - User hasn't checked in yet

> **Note**: iOS doesn't execute JavaScript in the background when notification action buttons are tapped, so we use tap-to-open for all notifications.

### Notification Types

| Type               | Trigger                          | Deep Link Target          |
| ------------------ | -------------------------------- | ------------------------- |
| check_in           | Scheduled (user's reminder time) | Goal detail + CheckInModal |
| morning_motivation | Scheduled (morning)              | Home screen               |
| adaptive_nudge     | Pattern-triggered                | Goal detail               |
| partner_activity   | Partner checks in                | Partner detail screen     |
| streak_milestone   | On milestone hit                 | Goal detail               |
| weekly_recap       | Sunday evening                   | Weekly recap screen       |
| cheer_received     | Partner sends cheer              | Partner detail screen     |

### Backend Notification Service

```python
# app/services/notifications.py

from httpx import AsyncClient
from datetime import datetime, time
from typing import List, Optional

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

class NotificationService:
    def __init__(self):
        self.client = AsyncClient()

    async def send_check_in(
        self,
        push_token: str,
        user_name: str,
        goal_title: str,
        goal_id: str,
        progress_text: str  # e.g., "2/3 this week"
    ):
        """Send check-in notification (tap to open app)."""
        await self.client.post(
            EXPO_PUSH_URL,
            json={
                "to": push_token,
                "title": "FitNudge",
                "body": f"Hey {user_name}! 🏋️ Did you {goal_title.lower()} today?\n{progress_text}\nTap to check in.",
                "data": {
                    "type": "check_in",
                    "goal_id": goal_id,
                    # openCheckIn=true triggers auto-open of CheckInModal on goal detail screen
                    "deepLink": f"/(user)/(goals)/details?id={goal_id}&openCheckIn=true"
                },
                "sound": "default",
                "priority": "high"
            }
        )

    async def send_morning_motivation(
        self,
        push_token: str,
        user_name: str,
        message: str
    ):
        """Send morning motivation message."""
        await self.client.post(
            EXPO_PUSH_URL,
            json={
                "to": push_token,
                "title": f"Good morning, {user_name}! ☀️",
                "body": message,
                "data": {
                    "type": "morning_motivation"
                },
                "sound": "default"
            }
        )

    async def send_partner_activity(
        self,
        push_token: str,
        partner_name: str,
        goal_title: str
    ):
        """Notify when partner completes a goal."""
        await self.client.post(
            EXPO_PUSH_URL,
            json={
                "to": push_token,
                "title": f"{partner_name} crushed it! 💪",
                "body": f"Your partner just completed their {goal_title.lower()}. Your turn?",
                "categoryId": "partner_activity",
                "data": {
                    "type": "partner_activity"
                },
                "sound": "default"
            }
        )

    async def send_streak_milestone(
        self,
        push_token: str,
        user_name: str,
        streak_length: int,
        goal_title: str
    ):
        """Celebrate streak milestones."""
        milestone_messages = {
            7: "One week strong! 🔥",
            14: "Two weeks! The habit is forming! 💪",
            21: "21 days! It's becoming automatic! 🚀",
            30: "One month! You're transformed! 🏆",
            50: "50 days - elite consistency! ⭐",
            100: "100 DAYS! LEGENDARY! 👑"
        }

        message = milestone_messages.get(
            streak_length,
            f"{streak_length} days! Keep going! 🔥"
        )

        await self.client.post(
            EXPO_PUSH_URL,
            json={
                "to": push_token,
                "title": f"🎉 Milestone: {streak_length} Days!",
                "body": f"{user_name}, {message}",
                "data": {
                    "type": "streak_milestone",
                    "streak_length": streak_length
                },
                "sound": "default"
            }
        )
```

### Celery Scheduled Tasks

```python
# app/tasks/notifications.py

from celery import Celery
from datetime import datetime, timedelta
import pytz

celery = Celery('tasks')

@celery.task
def schedule_check_in_notifications():
    """
    Run every minute. Find users whose reminder time is now
    and send check-in notifications.
    """
    now = datetime.now(pytz.UTC)

    # Find goals with reminder times matching current time (±1 min)
    goals = db.query("""
        SELECT g.*, u.first_name, u.expo_push_token, u.timezone
        FROM goals g
        JOIN users u ON g.user_id = u.id
        WHERE g.status = 'active'
          AND u.expo_push_token IS NOT NULL
          AND u.notifications_enabled = true
          -- Check if any reminder_time matches current time in user's timezone
    """)

    for goal in goals:
        user_tz = pytz.timezone(goal['timezone'])
        user_time = now.astimezone(user_tz).time()

        for reminder_time in goal['reminder_times']:
            if times_match(user_time, reminder_time):
                # Calculate progress
                progress = get_goal_progress(goal['id'])
                progress_text = f"{progress['completed']}/{progress['target']} this week"

                # Send notification
                notification_service.send_check_in(
                    push_token=goal['expo_push_token'],
                    user_name=goal['first_name'],
                    goal_title=goal['title'],
                    goal_id=goal['id'],
                    progress_text=progress_text
                )

@celery.task
def send_morning_motivations():
    """
    Run every minute. Send morning motivation to users
    at their configured time.
    """
    # Similar pattern to check-in notifications
    pass

@celery.task
def generate_weekly_recaps():
    """
    Run every Sunday at 6pm. Generate and send weekly recaps
    for premium users.
    """
    pass

@celery.task
def detect_patterns():
    """
    Run daily. Analyze user data and generate pattern insights.
    """
    pass
```

---

### Backend Push Notification Implementation Guide

This guide covers how to properly send notifications in V2 using the centralized push service.

#### Core Functions

```python
# ASYNC version - for FastAPI endpoints and async services
from app.services.expo_push_service import send_push_to_user

await send_push_to_user(
    user_id=user_id,
    title="Notification Title",
    body="Notification body message",
    data={"deepLink": "/(user)/(goals)/details?id=..."},  # Deep link for tap-to-open
    notification_type="reminder",  # For preference filtering
    entity_type="goal",            # Optional: for tracking
    entity_id=goal_id,             # Optional: for tracking
)

# SYNC version - for Celery tasks (no async/await needed)
from app.services.expo_push_service import send_push_to_user_sync

result = send_push_to_user_sync(
    user_id=user_id,
    title="Notification Title",
    body="Notification body message",
    data={"deepLink": "/(user)/(goals)/details?id=..."},
    notification_type="reminder",
    entity_type="goal",
    entity_id=goal_id,
)
```

#### Notification Types

| Type               | `notification_type` | Deep Link Target              |
| ------------------ | ------------------- | ----------------------------- |
| Check-in Prompt    | `reminder`          | Goal detail + auto CheckInModal |
| Check-in Follow-up | `reminder`          | Goal detail + auto CheckInModal |
| Morning Motivation | `ai_motivation`     | Home screen                   |
| Adaptive Nudge     | `adaptive_nudge`    | Goal detail                   |
| Partner Cheer      | `partner_cheer`     | Partner detail                |
| Partner Nudge      | `partner_nudge`     | Partner detail                |
| Partner Milestone  | `partner_milestone` | Partner detail                |
| Streak Milestone   | `streak_milestone`  | Goal detail                   |
| Weekly Recap       | `weekly_recap`      | Weekly recap screen           |
| Achievement        | `achievement`       | Achievements screen           |
| Subscription       | `subscription`      | None               | Tap only                   | Yes             |

#### Data Payload Structure

```python
# For check-in notifications (opens goal detail with CheckInModal)
data = {
    "type": "reminder",           # Notification type for app routing
    "subtype": "checkin_prompt",  # Optional subtype
    "goalId": goal_id,            # Entity ID (camelCase for frontend)
    # openCheckIn=true auto-opens CheckInModal if goal is active, scheduled, and not checked in
    "deepLink": f"/(user)/(goals)/details?id={goal_id}&openCheckIn=true",
}

# For notifications WITHOUT deep link (just mark as read)
data = {
    "type": "partner_cheer",
    "sender_id": partner_id,
    # No deepLink = tap just marks as read
}
```

#### Common Deep Links

```python
# Goal details (with auto-open CheckInModal)
f"/(user)/(goals)/details?id={goal_id}&openCheckIn=true"

# Goal details (without CheckInModal)
f"/(user)/(goals)/details?id={goal_id}"

# Weekly recaps list
"/(user)/profile/weekly-recaps"

# Specific recap
f"/(user)/profile/weekly-recaps?weekStart={week_start}"

# Partners screen
"/(user)/profile/partners"

# Achievements
"/(user)/profile/achievements"

# Profile/Settings
"/(user)/profile"
```

#### Fire-and-Forget Pattern (Celery)

For notifications that shouldn't block user actions, use `.delay()`:

```python
# ✅ GOOD: Fire-and-forget (user doesn't wait)
from app.services.tasks.notification_tasks import send_streak_milestone_notification
send_streak_milestone_notification.delay(
    user_id=user_id,
    goal_id=goal_id,
    goal_title=goal_title,
    streak=new_streak,
)

# ❌ BAD: Blocking call (user waits for notification to send)
await send_push_to_user(...)  # In a request handler
```

#### When to Use Each Pattern

```python
# Pattern 1: Celery task calling sync function (PREFERRED for background tasks)
@celery_app.task
def my_celery_task():
    result = send_push_to_user_sync(...)  # No await needed

# Pattern 2: Fire-and-forget from endpoint (for non-critical notifications)
@router.post("/checkin")
async def create_checkin(...):
    # ... create checkin ...

    # Queue notification to Celery (fire-and-forget)
    send_streak_milestone_notification.delay(user_id, goal_id, streak)

    return {"success": True}  # Returns immediately

# Pattern 3: Awaited in endpoint (only for CRITICAL notifications)
@router.post("/subscription/cancel")
async def cancel_subscription(...):
    # ... cancel subscription ...

    # Must wait to ensure user sees this important notification
    await send_push_to_user(
        user_id=user_id,
        title="Subscription Cancelled",
        body="...",
        skip_preference_check=True,  # Critical notification
    )
```

#### Built-in Features

The push service automatically handles:

1. **Preference Check** - Respects user's notification settings
2. **Quiet Hours** - Won't send during user's quiet hours (unless `skip_preference_check=True`)
3. **Notification History** - Creates record in `notification_history` table
4. **Invalid Token Cleanup** - Deactivates tokens that fail
5. **Batch Sending** - Uses Expo SDK's `publish_multiple()` for efficiency

#### Example: Complete Check-in Notification

```python
result = send_push_to_user_sync(
    user_id=user_id,
    title=f"How did your {goal_title} go? ✅",
    body=f"Tap to check in, {user_name}!",
    data={
        "type": "reminder",
        "subtype": "checkin_prompt",
        "goalId": goal_id,
        "deepLink": f"/(user)/(goals)/details?id={goal_id}&openCheckIn=true",
    },
    notification_type="reminder",
    entity_type="goal",
    entity_id=goal_id,
)
```

---

## 🤖 AI Integration

### System Prompts

#### Check-in Response Generator

```python
CHECK_IN_RESPONSE_PROMPT = """
You are the user's personal accountability coach. Generate a short,
personalized response to their check-in.

User: {user_name}
Motivation Style: {motivation_style}
Goal: {goal_title}
Check-in: {completed} (True = they did it, False = they didn't)
Current Streak: {current_streak} days
Longest Streak: {longest_streak} days
Their "Why": {why_statement}
Time of Day: {time_of_day}
Recent Pattern: {recent_pattern}

Guidelines:
- Keep response under 50 words
- Match the motivation style:
  - supportive: Warm, encouraging, celebrate every win
  - tough_love: Direct, challenging, no excuses
  - calm: Patient, philosophical, balanced
- If they completed: Celebrate appropriately based on streak length
- If they missed: Be understanding but reference their "why"
- Reference specific data (streak, patterns) to make it personal
- End with forward-looking encouragement

Response:
"""

MORNING_MOTIVATION_PROMPT = """
Generate a short morning motivation message for {user_name}.

Their goals: {goals}
Current progress: {progress}
Motivation style: {motivation_style}
Day of week: {day_of_week}
Recent wins: {recent_wins}
Recent struggles: {recent_struggles}

Guidelines:
- Keep under 30 words
- Match their motivation style
- Be specific to their goals and progress
- Create energy for the day ahead
- Vary the message (don't repeat yesterday's)

Message:
"""
```

#### AI Coach Chat

```python
AI_COACH_SYSTEM_PROMPT = """
You are FitNudge, a personal AI accountability coach. You have a warm,
supportive personality but you're also honest and data-driven.

USER CONTEXT:
- Name: {user_name}
- Motivation Style Preference: {motivation_style}
- Active Goals: {goals_list}
- Current Streaks: {streaks_data}
- This Week's Progress: {weekly_progress}
- Check-in History (last 30 days): {check_in_history}
- Detected Patterns: {patterns}
- Their "Why" Statements: {why_statements}
- Recent Reflections/Notes: {recent_notes}

YOUR ROLE:
1. Be conversational and remember the conversation context
2. Reference their specific data - don't give generic advice
3. When they share struggles, acknowledge emotions first, then offer insights
4. Use their data to identify patterns they might not see
5. Challenge excuses gently but firmly (based on their style preference)
6. Celebrate wins but push for consistency
7. Keep responses concise (under 150 words usually)

NEVER:
- Give medical or professional advice
- Shame or judge harshly
- Be preachy or repetitive
- Give generic motivation that doesn't reference their data
"""
```

### AI Service

```python
# app/services/ai_service.py

import openai
from typing import Optional

class AIService:
    def __init__(self):
        self.client = openai.AsyncOpenAI()

    async def generate_check_in_response(
        self,
        user_name: str,
        motivation_style: str,
        goal_title: str,
        completed: bool,
        current_streak: int,
        longest_streak: int,
        why_statement: Optional[str],
        recent_pattern: Optional[str]
    ) -> str:
        """Generate personalized check-in response."""

        prompt = CHECK_IN_RESPONSE_PROMPT.format(
            user_name=user_name,
            motivation_style=motivation_style,
            goal_title=goal_title,
            completed=completed,
            current_streak=current_streak,
            longest_streak=longest_streak,
            why_statement=why_statement or "Not specified",
            time_of_day=get_time_of_day(),
            recent_pattern=recent_pattern or "No clear pattern yet"
        )

        response = await self.client.chat.completions.create(
            model="gpt-4o-mini",  # Fast and cheap for short responses
            messages=[
                {"role": "system", "content": "You are a motivational coach. Be concise."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=100,
            temperature=0.8
        )

        return response.choices[0].message.content

    async def chat_stream(
        self,
        user_context: dict,
        conversation_history: list,
        user_message: str
    ):
        """Stream AI coach response."""

        system_prompt = AI_COACH_SYSTEM_PROMPT.format(**user_context)

        messages = [
            {"role": "system", "content": system_prompt},
            *conversation_history,
            {"role": "user", "content": user_message}
        ]

        stream = await self.client.chat.completions.create(
            model="gpt-4o",  # Better model for conversations
            messages=messages,
            max_tokens=500,
            temperature=0.7,
            stream=True
        )

        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
```

---

## 🛠️ Tech Stack

### Frontend (Mobile)

| Technology         | Purpose                   |
| ------------------ | ------------------------- |
| React Native       | Cross-platform mobile app |
| Expo               | Build and deploy tooling  |
| Expo Router        | File-based navigation     |
| Zustand            | State management          |
| React Query        | Server state & caching    |
| expo-notifications | Push notifications        |
| NativeWind         | Tailwind for React Native |

### Backend

| Technology | Purpose                    |
| ---------- | -------------------------- |
| FastAPI    | Python REST API            |
| Supabase   | PostgreSQL database + Auth |
| Celery     | Background task scheduling |
| Redis      | Celery broker + caching    |
| OpenAI API | AI text generation         |
| Expo Push  | Push notification delivery |

### Infrastructure

| Technology     | Purpose                 |
| -------------- | ----------------------- |
| Vercel/Railway | API hosting             |
| Supabase       | Database + Auth hosting |
| Cloudflare R2  | Voice note storage      |
| RevenueCat     | Subscription management |
| Sentry         | Error monitoring        |

---

## 📂 Project Structure

> **Note:** V1 code is archived in `oldfiles/` for reference.

```
fitnudge/
├── apps/
│   ├── mobile/                    # React Native app (main)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/            # Reusable UI components
│   │   │   │   │   ├── Button.tsx
│   │   │   │   │   ├── Card.tsx
│   │   │   │   │   ├── ReminderTimesPicker.tsx
│   │   │   │   │   └── ...
│   │   │   │   ├── goals/
│   │   │   │   │   ├── GoalCard.tsx
│   │   │   │   │   ├── GoalForm.tsx
│   │   │   │   │   └── StreakBadge.tsx
│   │   │   │   ├── checkin/
│   │   │   │   │   ├── CheckInModal.tsx
│   │   │   │   │   ├── SuccessScreen.tsx
│   │   │   │   │   └── MissScreen.tsx
│   │   │   │   ├── chat/
│   │   │   │   │   ├── ChatScreen.tsx
│   │   │   │   │   ├── ChatBubble.tsx
│   │   │   │   │   └── ChatInput.tsx
│   │   │   │   └── partner/
│   │   │   │       ├── PartnerCard.tsx
│   │   │   │       └── FindPartnerScreen.tsx
│   │   │   │
│   │   │   ├── screens/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── LoginScreen.tsx
│   │   │   │   │   ├── SignupScreen.tsx
│   │   │   │   │   └── ForgotPasswordScreen.tsx
│   │   │   │   ├── onboarding/
│   │   │   │   │   ├── WelcomeScreen.tsx
│   │   │   │   │   ├── NameScreen.tsx
│   │   │   │   │   ├── StyleScreen.tsx
│   │   │   │   │   ├── FirstGoalScreen.tsx
│   │   │   │   │   ├── GoalDetailsScreen.tsx
│   │   │   │   │   ├── WhyScreen.tsx
│   │   │   │   │   ├── NotificationsScreen.tsx
│   │   │   │   │   └── AllSetScreen.tsx
│   │   │   │   ├── tabs/
│   │   │   │   │   ├── home/
│   │   │   │   │   │   └── HomeScreen.tsx
│   │   │   │   │   ├── goals/
│   │   │   │   │   │   ├── GoalsScreen.tsx
│   │   │   │   │   │   ├── GoalDetailScreen.tsx
│   │   │   │   │   │   └── CreateGoalScreen.tsx
│   │   │   │   │   ├── progress/
│   │   │   │   │   │   ├── ProgressScreen.tsx
│   │   │   │   │   │   └── RecapDetailScreen.tsx
│   │   │   │   │   └── profile/
│   │   │   │   │       ├── ProfileScreen.tsx
│   │   │   │   │       ├── SettingsScreen.tsx
│   │   │   │   │       └── PartnerScreen.tsx
│   │   │   │   └── premium/
│   │   │   │       ├── CoachChatScreen.tsx
│   │   │   │       └── UpgradeScreen.tsx
│   │   │   │
│   │   │   ├── hooks/
│   │   │   │   ├── api/
│   │   │   │   │   ├── useGoals.ts
│   │   │   │   │   ├── useCheckIns.ts
│   │   │   │   │   ├── useStreaks.ts
│   │   │   │   │   ├── usePartner.ts
│   │   │   │   │   └── useAICoach.ts
│   │   │   │   └── useNotifications.ts
│   │   │   │
│   │   │   ├── services/
│   │   │   │   ├── api/
│   │   │   │   │   ├── client.ts
│   │   │   │   │   ├── goals.ts
│   │   │   │   │   ├── checkins.ts
│   │   │   │   │   └── ai.ts
│   │   │   │   └── notifications/
│   │   │   │       ├── setup.ts
│   │   │   │       └── handlers.ts
│   │   │   │
│   │   │   ├── stores/
│   │   │   │   ├── authStore.ts
│   │   │   │   └── subscriptionStore.ts
│   │   │   │
│   │   │   ├── themes/
│   │   │   │   ├── tokens.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   └── lib/
│   │   │       ├── i18n.ts
│   │   │       └── utils.ts
│   │   │
│   │   ├── app/                   # Expo Router
│   │   │   ├── (auth)/
│   │   │   ├── (onboarding)/
│   │   │   ├── (tabs)/
│   │   │   └── _layout.tsx
│   │   │
│   │   └── package.json
│   │
│   ├── web/                       # Website/blog
│   ├── admin-portal/              # Admin dashboard
│   │
│   └── api/                       # FastAPI Backend (main)
│       ├── app/
│       │   ├── api/
│       │   │   └── v1/
│       │   │       ├── endpoints/
│       │   │       │   ├── auth.py
│       │   │       │   ├── users.py
│       │   │       │   ├── goals.py
│       │   │       │   ├── checkins.py
│       │   │       │   ├── streaks.py
│       │   │       │   ├── partners.py
│       │   │       │   ├── ai.py
│       │   │       │   ├── recaps.py
│       │   │       │   └── subscriptions.py
│       │   │       └── router.py
│       │   │
│       │   ├── core/
│       │   │   ├── config.py
│       │   │   ├── security.py
│       │   │   └── database.py
│       │   │
│       │   ├── services/
│       │   │   ├── ai_service.py
│       │   │   ├── notification_service.py
│       │   │   ├── streak_service.py
│       │   │   ├── pattern_service.py
│       │   │   └── recap_service.py
│       │   │
│       │   └── tasks/
│       │       ├── notifications.py
│       │       ├── recaps.py
│       │       └── patterns.py
│       │
│       ├── supabase/
│       │   └── migrations/
│       │       ├── 001_initial_schema.sql
│       │       ├── 002_core_features.sql
│       │       ├── 003_infrastructure.sql
│       │       └── ...
│       │
│       ├── main.py
│       ├── celery_worker.py
│
├── oldfiles/                      # Archived V1 code (reference only)
│   ├── mobile-v1/                 # Original mobile app
│   └── api-v1/                    # Original API
│       ├── requirements.txt
│       └── pyproject.toml
│
└── package.json                   # Monorepo root
```

---

## ✅ Implementation Checklist

### Phase 1: Core MVP (Week 1-2)

- [ ] Database schema setup
- [ ] User authentication (Supabase Auth)
- [ ] Goal CRUD operations
- [ ] Check-in system
- [ ] Streak calculation
- [ ] Basic push notifications
- [ ] Check-in notifications with deep link to goal detail
- [ ] Basic AI check-in responses

### Phase 2: AI Integration (Week 2-3)

- [ ] Morning motivation messages
- [ ] Personalized check-in responses
- [ ] AI Coach chat (Premium)
- [ ] Pattern detection
- [ ] Weekly recap generation

### Phase 3: Social (Week 3-4)

- [ ] Partner matching algorithm
- [ ] Partner activity notifications
- [ ] Cheers system
- [ ] Partnership management

### Phase 4: Polish (Week 4)

- [ ] Subscription integration (RevenueCat)
- [ ] Paywall screens
- [ ] Settings screens
- [ ] Error handling
- [ ] Analytics integration

---

## 🎯 Success Metrics

| Metric                        | Target       |
| ----------------------------- | ------------ |
| Daily Active Users (DAU)      | Track growth |
| Check-in completion rate      | > 70%        |
| 7-day retention               | > 40%        |
| 30-day retention              | > 25%        |
| Conversion to Premium         | > 5%         |
| Average streak length         | > 7 days     |
| Partner match acceptance rate | > 60%        |

---

## 📈 Scalability Patterns

FitNudge is designed to support **100K+ users**. Key patterns already implemented:

### Database Optimization

- **REST API over direct connections** - Supabase PostgREST handles connection pooling automatically
- **Batch operations** - O(1) instead of O(n) for bulk updates
- **N+1 query fixes** - Prefetch with `.in_()` instead of loop queries
- **Strategic indexes** - On all foreign keys and common query patterns

### Background Tasks (Celery)

- **Task chunking** - Large user batches split into 100-user chunks
- **Priority queues** - Critical tasks (auth, payments) on separate queue
- **Paginated cleanup** - Cleanup jobs process in pages, not all at once
- **Rate limiting** - Expo push notifications capped at 600/sec

### Push Notifications

- **Batch sending** - Up to 100 notifications per Expo API call
- **Token management** - Automatic deactivation of invalid tokens
- **Timezone-aware scheduling** - Notifications sent at user's local time

### Caching

- **React Query** - Client-side caching with configurable stale times
- **Redis** - Server-side caching for frequently accessed data
- **Optimistic updates** - UI updates immediately, syncs in background

For full details, see `apps/docs/SCALABILITY.md`.

---

## 📝 Notes

### What We Removed from V1

- ❌ Meal tracking / nutrition
- ❌ Workout player / exercise database
- ❌ AI-generated goal suggestions
- ❌ AI-generated plans (meal, workout, habit)
- ❌ Hydration tracking
- ❌ Social feed / posts
- ❌ Challenges / leaderboards
- ❌ Complex fitness profile questionnaire
- ❌ Progress photos

### Why This is Better

1. **Faster onboarding** - No AI wait time
2. **Clearer value prop** - "AI that holds you accountable"
3. **Less competition** - Not competing with MyFitnessPal, Nike, Strava
4. **Unique positioning** - The emotional/psychological support gap
5. **Lower complexity** - Easier to build, maintain, and explain
6. **Broader audience** - Works for any habit, not just fitness

### What We're Keeping from V1

**Core Infrastructure:**

- Authentication system (`apps/api/app/core/auth.py` - complete JWT + refresh token + OAuth)
- Push notification system (Expo Push via Celery)
- Subscription management (RevenueCat integration)
- Background task processing (Celery + Redis)
- Realtime updates (Supabase Realtime)
- AI service infrastructure (OpenAI integration)
- i18n/Multilingual support (`language` column in users)

**Theme System (`apps/mobile/src/themes/`):**

- `tokens.ts` - Design tokens (colors, typography, spacing, shadows)
- `semanticColors.ts` - Semantic color mappings (light/dark)
- `provider.tsx` - Theme provider with system preference detection
- `makeStyles.ts` - Style factory for components
- `brandVariants.ts` - Brand color variants
- Light mode: Clean white (#f9fafc) with blue (#0066ff) accent
- Dark mode: Pure black (#000000) with electric blue (#00a3ff) accent

**UI Components (reuse/adapt):**

- `Button`, `Card`, `Input` - Core UI primitives
- `ReminderTimesPicker` - Time selection for reminders
- `StreakBadge` - Streak display component
- `MotivationCard` - Daily motivation display
- `AILoadingAnimation` - Loading state for AI responses
- `SkeletonBox` - Skeleton loaders
- All form components (text inputs, selectors, etc.)

**Screens to Keep (simplified):**

- Auth screens (Login, Signup, ForgotPassword)
- Profile screen (with updated menu structure)
- Settings screens (Account, Notifications, Theme)
- Partner screens (Find Partner, Partner Detail)
- AI Coach chat screen
- Onboarding screens (simplified - no fitness questionnaire)

**Screens to Remove:**

- Meal tracking screens
- Workout player screens
- Social feed screens
- Challenge screens
- Fitness profile questionnaire
- Complex onboarding (fitness questions)

### Existing Documentation to Reference

| Document           | Location                                     | Purpose                |
| ------------------ | -------------------------------------------- | ---------------------- |
| Scalability        | `apps/docs/SCALABILITY.md`                   | Performance patterns   |
| Push Notifications | `apps/docs/BACKEND_PUSH_NOTIFICATIONS.md`    | Notification system    |
| Database Security  | `apps/docs/DATABASE_SECURITY_PERFORMANCE.md` | RLS & security         |
| React Query Guide  | `apps/docs/REACT_QUERY_GUIDE.md`             | Data fetching patterns |
| Realtime           | `apps/docs/REALTIME_IMPLEMENTATION.md`       | Live updates           |
| Subscription       | `apps/docs/SUBSCRIPTION_IMPLEMENTATION.md`   | RevenueCat integration |

---

_This document serves as the complete specification for FitNudge. Any developer should be able to use this to understand and build upon the app._
