# Push Notifications Flow

## Overview

FitNudge uses a **backend-controlled push notification system** for AI motivations. This ensures:

- ✅ Timezone-aware delivery (respects user's local time)
- ✅ No duplicates (tracked in database)
- ✅ AI-generated content that varies
- ✅ No local/push conflicts

## Types of Notifications

### 1. Check-In Reminders (Local - Mobile App)

**Scheduled by**: Mobile app locally  
**When**: Daily at first reminder time  
**Content**: Static "Time for your check-in!"  
**Purpose**: Remind user to log their daily check-in

### 2. AI Motivation Push (Remote - Backend)

**Scheduled by**: Backend Celery task  
**When**: At user's reminder times (timezone-aware)  
**Content**: AI-generated SHORT title + body  
**Purpose**: Motivate user with personalized message  
**Delivery**: Expo Push Service → User's device

---

## Backend Flow (AI Motivation Push)

### Task Schedule

```python
# Runs EVERY MINUTE
"send-scheduled-ai-motivations": {
    "task": "send_scheduled_ai_motivations",
    "schedule": 60.0,  # Every minute
}
```

### Execution Flow (Every Minute)

```
1. Get all active goals with reminder_times
   └─ Join with users table for timezone

2. For each goal:
   a. Calculate current time in user's timezone
   b. Check if current_time matches any reminder_time

   c. ✅ NEW: Check if already sent today at this time
      └─ Query motivations table for duplicate
      └─ If found, SKIP (prevent duplicates)

   d. Check notification preferences
      └─ Skip if disabled or in quiet hours

   e. Generate SHORT push notification via AI
      └─ Call: generate_push_notification_ai(goal_title, context)
      └─ Returns: {"title": "...", "body": "..."}

   f. Send via Expo Push
      └─ Call: send_push_to_user(title, body, data)
      └─ Expo delivers to device

   g. ✅ NEW: Save to motivations table
      └─ Record: sent_date, reminder_time, is_sent=true
      └─ Prevents future duplicates

3. Summary logged: sent X, skipped Y
```

---

## AI Generation

### Daily Motivation (In-App Screen)

**Function**: `generate_daily_motivation_ai()`  
**File**: `apps/api/app/api/v1/endpoints/daily_motivations.py`  
**Output**: 2-3 sentences, detailed, with background style  
**Used for**: Daily motivation screen in app  
**Example**:

```
"Keep that 5-day streak going! Every day you show up is a win.
You've got this - your commitment is inspiring! 💪"
```

### Push Notification (Lock Screen)

**Function**: `generate_push_notification_ai()`  
**File**: `apps/api/app/services/push_motivation_generator.py`  
**Output**: Short title (4-6 words) + body (10-15 words)  
**Used for**: Push notifications to device  
**Example**:

```json
{
  "title": "💪 Crush Your Workout!",
  "body": "Your 5-day streak is waiting. Let's keep it alive!"
}
```

---

## Database Tracking

### Motivations Table Schema

```sql
CREATE TABLE motivations (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    goal_id UUID REFERENCES goals(id),
    message TEXT NOT NULL,
    message_type message_type DEFAULT 'ai',
    is_sent BOOLEAN DEFAULT false,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    sent_date DATE,           -- ✅ NEW: For duplicate checking
    reminder_time TIME,       -- ✅ NEW: For duplicate checking
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Duplicate Check Query

```python
already_sent = supabase.table("motivations")\
    .select("id")\
    .eq("goal_id", goal_id)\
    .eq("is_sent", True)\
    .eq("sent_date", "2024-12-05")  # User's today
    .eq("reminder_time", "08:00")   # Current reminder time
    .execute()

if already_sent.data:
    # Already sent, skip!
```

---

## Timezone Handling

### User's Local Time

```python
# Get user's timezone from database
user_tz = pytz.timezone("America/New_York")  # Example

# Calculate current time in user's timezone
user_now = datetime.now(user_tz)
user_today = user_now.date()        # 2024-12-05
current_time = user_now.strftime("%H:%M")  # "08:00"
```

### Matching Logic

```python
# User's reminder_times: ["08:00", "18:00"]
# Current time in user's TZ: "08:00"

if current_time in reminder_times:  # ✅ Match!
    # Check if sent today at 08:00 → Skip if yes
    # Generate and send → Save with sent_date=today, reminder_time=08:00
```

---

## Mobile App (Local Notifications Only)

### What Mobile Schedules

- ✅ **Check-in reminders** (local notifications)
  - "Time for your check-in!"
  - Scheduled locally using device time
  - Not tracked in backend

### What Mobile Doesn't Schedule

- ❌ **AI motivation calls** (backend handles via push)
  - Removed from `useGoalNotifications`
  - Marked as deprecated in `notificationScheduler`

### Mobile Code

```typescript
// ✅ Keep this (check-in reminders)
await notificationScheduler.scheduleCheckInReminders({
  goalId: goal.id,
  goalTitle: goal.title,
  reminderTime: goal.reminderTimes[0], // First reminder time
  timezone: goal.timezone,
});

// ❌ Removed (backend handles this)
// await notificationScheduler.scheduleMotivationCalls(goal);
```

---

## Testing

### Verify No Duplicates

1. **Set reminder time**: Create goal with reminder at current time + 1 minute
2. **Wait for notification**: Should receive ONCE
3. **Check database**:
   ```sql
   SELECT * FROM motivations
   WHERE sent_date = CURRENT_DATE
   AND is_sent = true
   ORDER BY sent_at DESC;
   ```
4. **Verify**: Only ONE row per goal/time/day

### Verify AI Variation

Each push should have:

- ✅ Different title/body (AI generates variety)
- ✅ Appropriate for time of day
- ✅ Short and concise (not truncated)

---

## Files Changed

### Backend

- ✅ `apps/api/supabase/migrations/20251205000000_track_sent_motivations.sql`
- ✅ `apps/api/app/services/push_motivation_generator.py` (new)
- ✅ `apps/api/app/services/tasks.py` (updated duplicate check + new AI)

### Mobile

- ✅ `apps/mobile/src/hooks/notifications/useGoalNotifications.ts` (removed AI scheduling)
- ✅ `apps/mobile/src/services/notifications/notificationScheduler.ts` (deprecated AI method)

---

## Summary

**Before**:

- Backend sends same push 60× during 8:00-8:01 minute
- Mobile schedules local AI notifications (conflict with backend push)
- Long daily motivation message used for push (truncated)

**After**:

- Backend checks database, sends ONCE per goal/time/day ✅
- Mobile only schedules check-in reminders ✅
- SHORT AI-generated title/body for push notifications ✅
- All timezone-aware ✅
