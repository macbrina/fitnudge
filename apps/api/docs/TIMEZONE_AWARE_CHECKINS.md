# Timezone-Aware Check-ins and AI Notifications

## Overview

This system ensures that check-ins are created and notifications are sent at the correct time for each user, regardless of their timezone.

## Key Components

### 1. Timezone-Aware Check-in Creation

**Task**: `auto_create_daily_checkins_task`
**Schedule**: Runs every hour (not every 24 hours)
**Purpose**: Create check-ins at midnight in each user's timezone

#### How It Works:

```python
# For each active goal:
1. Get user's timezone from users.timezone
2. Calculate current time in user's timezone
3. Check if it's midnight hour (00:00-00:59)
4. If yes, create check-in for user's "today"
5. Skip if check-in already exists
```

#### Example:

```
UTC Time: 2025-01-01 00:00 (Midnight UTC)
- User in Tokyo (UTC+9): 09:00 → Skip (not midnight)
- User in London (UTC+0): 00:00 → Create check-in ✓
- User in LA (UTC-8): 16:00 (previous day) → Skip

UTC Time: 2025-01-01 08:00
- User in Tokyo (UTC+9): 17:00 → Skip
- User in London (UTC+0): 08:00 → Skip
- User in LA (UTC-8): 00:00 → Create check-in ✓
```

### 2. AI-Generated Motivations

**Task**: `send_scheduled_ai_motivations_task`
**Schedule**: Runs every minute
**Purpose**: Send AI-generated motivations at user's reminder times

#### How It Works:

```python
# For each active goal:
1. Get user's timezone and reminder_times
2. Calculate current time in user's timezone (HH:MM)
3. Check if current time matches any reminder_time
4. If yes:
   - Check notification preferences
   - Check quiet hours
   - Generate AI motivation using OpenAI
   - Send push notification with AI message
```

#### Example:

```
User in Tokyo (UTC+9):
- reminder_times: ["09:00", "14:00", "20:00"]
- Notifications sent at: 09:00 JST, 14:00 JST, 20:00 JST

User in LA (UTC-8):
- reminder_times: ["09:00", "14:00", "20:00"]
- Notifications sent at: 09:00 PST, 14:00 PST, 20:00 PST

Same times, different UTC offsets!
```

### 3. Initial Check-in Creation

**Function**: `create_initial_checkin`
**Called**: When a goal is created
**Purpose**: Create check-in for "today" immediately

#### Logic:

```python
if goal.is_active:
    user_today = datetime.now(user_timezone).date()

    if frequency == "daily":
        create_checkin(user_today)
    elif frequency == "weekly" and today in days_of_week:
        create_checkin(user_today)
```

## Database Schema

### Users Table

```sql
CREATE TABLE users (
    ...
    timezone TEXT DEFAULT 'UTC',
    ...
);
```

### Goals Table

```sql
CREATE TABLE goals (
    ...
    reminder_times TEXT[], -- ['09:00', '14:00', '20:00']
    days_of_week INTEGER[], -- [1, 3, 5] for Mon, Wed, Fri (0=Sun)
    ...
);
```

### Check-ins Table

```sql
CREATE TABLE check_ins (
    ...
    date DATE NOT NULL, -- User's local date
    UNIQUE(goal_id, date) -- One check-in per day
);
```

## Notification Flow

### 1. User Creates Goal

```
User in Tokyo creates goal at 2025-01-01 14:00 JST
↓
Backend creates goal
↓
create_initial_checkin() called
↓
User's today = 2025-01-01 (JST)
↓
Create check-in for 2025-01-01 ✓
```

### 2. Frontend Schedules Local Notifications

```
NotificationContext (mobile):
- Schedules check-in reminder at first reminder_time
- Schedules motivation placeholders at all reminder_times
- Uses device local time for triggers
```

### 3. Backend Sends AI Motivations

```
Every minute, Celery checks:
User in Tokyo, reminder_time: 09:00
Current Tokyo time: 09:00 ✓
↓
Generate AI motivation
↓
Send push notification with actual AI message
↓
User receives: "You've crushed 5 days! Let's make it 6! 🔥"
```

### 4. Midnight Check-in Creation

```
Every hour, Celery checks:
UTC: 2025-01-01 15:00
Tokyo: 2025-01-02 00:00 (midnight) ✓
↓
Create check-in for 2025-01-02 (Tokyo)
↓
User wakes up → check-in already exists ✓
```

## Quiet Hours

Users can set quiet hours to prevent notifications:

```python
# User preferences
quiet_hours_enabled: True
quiet_hours_start: "22:00"
quiet_hours_end: "08:00"

# Check before sending
if is_in_quiet_hours("23:00", "22:00", "08:00"):
    skip_notification()  # User is sleeping
```

Handles midnight-spanning ranges (e.g., 22:00 - 08:00).

## Edge Cases Handled

1. **Timezone not set**: Defaults to UTC
2. **Invalid timezone**: Logs error, skips user
3. **Duplicate check-ins**: Unique constraint prevents duplicates
4. **Goal created mid-day**: Only creates check-in if applicable (weekly goals)
5. **Notifications disabled**: Checks user preferences before sending
6. **Quiet hours**: Respects user's sleep schedule
7. **App reinstall**: Frontend reschedules local notifications on login

## Performance Considerations

### Hourly Check-in Task

- **Frequency**: Runs every hour
- **Processing**: ~1ms per active goal
- **Scaling**: For 100k active goals, ~100ms total
- **Optimization**: Only processes goals where user's hour = 0

### Minute-by-Minute Notification Task

- **Frequency**: Runs every minute
- **Processing**: ~500ms per notification (OpenAI API)
- **Scaling**: For 1000 concurrent reminders, ~8 minutes total
- **Optimization**:
  - Check preferences first (skip disabled users)
  - Batch notifications per minute
  - Use async/await for parallel processing

## Monitoring

### Metrics to Track

- Check-ins created per hour
- Notifications sent per minute
- AI generation failures
- Timezone parsing errors
- Duplicate check-in attempts

### Logs

```python
# Success
print(f"Created check-in for goal {goal_id} (user timezone: {tz}, date: {date})")

# Error
logger.error(f"Invalid timezone for user {user_id}: {tz}")
```

## Testing

### Unit Tests

```python
# Test timezone conversion
assert user_today(tokyo_tz, utc_now) == "2025-01-02"
assert user_today(la_tz, utc_now) == "2025-01-01"

# Test quiet hours
assert is_in_quiet_hours("23:00", "22:00", "08:00") == True
assert is_in_quiet_hours("12:00", "22:00", "08:00") == False
```

### Integration Tests

1. Create goal in Tokyo timezone → Check-in created for JST date
2. Set reminder for 09:00 LA time → Notification sent at 09:00 PST
3. Enable quiet hours 22:00-08:00 → No notifications during sleep

## Migration Notes

### Before This Update

- Check-ins created at midnight UTC for all users
- User in Tokyo: Check-in created at 09:00 local time (too late!)
- User in LA: Check-in created at 16:00 previous day (too early!)

### After This Update

- Check-ins created at midnight in user's timezone
- User in Tokyo: Check-in created at 00:00 JST ✓
- User in LA: Check-in created at 00:00 PST ✓

### Rollout Strategy

1. Deploy timezone-aware tasks to staging
2. Test with users in different timezones
3. Monitor Celery logs for errors
4. Deploy to production during low-traffic hours
5. Verify check-ins created correctly for next 24 hours

## Dependencies

```
pytz==2024.1  # Timezone support
```

Install with:

```bash
pip install pytz
```
