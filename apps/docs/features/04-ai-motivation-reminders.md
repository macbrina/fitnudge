# AI Motivation & Smart Reminders

## Overview

The AI motivation system generates personalized motivational messages based on user goals and progress. Smart reminders schedule notifications at user-specified times to keep users accountable.

## Features

### 1. AI Motivation Message Generation

**API Endpoint**: `POST /api/v1/motivation/generate`

Generates AI-powered motivational messages using OpenAI GPT-4.

**Implementation**: `apps/api/app/api/v1/endpoints/motivation.py`

**Request**:
```python
class MotivationGenerate(BaseModel):
    goal_id: Optional[str] = None
    tone: Optional[str] = "friendly"  # friendly, tough-love, calm
    context: Optional[str] = None
```

**How It Works**:
1. Retrieves user's goal details (if `goal_id` provided)
2. Gets recent check-ins (last 7 days)
3. Builds context from goal + progress data
4. Calls OpenAI API with personalized prompt
5. Stores generated message in `motivations` table

**AI Prompt Structure**:
- System prompt: Defines motivational coach persona
- User context: Goal details, recent performance, user preferences
- Tone: Matches user's preferred motivation style

### 2. Motivation Message Storage

**Database Table**: `motivations`
- `user_id`: User who owns the message
- `goal_id`: Optional goal association
- `message`: Generated AI message
- `message_type`: "ai" for AI-generated
- `is_sent`: Whether message was delivered
- `scheduled_for`: Optional scheduled delivery time
- `sent_at`: Actual delivery timestamp

### 3. Smart Reminders ("AI Call")

**Notification Scheduling**:
- Users set reminder times when creating/updating goals
- Multiple reminder times per goal supported
- Reminders use timezone-aware scheduling

**API Endpoint**: `POST /api/v1/motivation/schedule`

**Implementation**: `apps/api/app/api/v1/endpoints/motivation.py`

```python
class MotivationSchedule(BaseModel):
    goal_id: Optional[str] = None
    scheduled_for: datetime
    message: Optional[str] = None
    tone: Optional[str] = "friendly"
```

### 4. Notification Delivery

**Local Notifications** (Mobile):
- Scheduled using Expo Notifications
- Timezone conversion from user's timezone to device timezone
- Uses `date-fns-tz` for accurate timezone handling

**Implementation**: `apps/mobile/src/services/notifications/notificationScheduler.ts`

**Features**:
- Daily reminders at specified times
- Alarm sound for "AI Call" notifications
- Tapping notification opens motivation message
- Handles timezone changes and DST

### 5. Timezone Handling

**User Timezone**:
- Stored in `users.timezone` field
- Default: Device timezone or "UTC"
- Set during signup or updated in profile

**Timezone Conversion**:
- User specifies reminder time in their timezone
- System converts to device's local timezone for scheduling
- Handles DST transitions automatically

**Implementation**: `apps/mobile/src/utils/helper.ts`
```typescript
convertTimeToDeviceTimezone(reminderTime, userTimezone)
```

### 6. Custom Reminder Messages

**Feature**: Users can set custom reminder messages per goal

**Database**: `goals.custom_reminder_message`
- Optional text field
- Overrides default reminder text
- Used in notification scheduling

**API**: Included in `GoalCreate` and `GoalUpdate` models

### 7. Reminder Management

**When Goal is Activated**:
- Reminders are scheduled for all `reminder_times`
- Uses goal's `custom_reminder_message` if set
- Respects user's timezone

**When Goal is Deactivated**:
- All reminders for that goal are cancelled
- Prevents unnecessary notifications

**On App Startup**:
- All active goals' reminders are rescheduled
- Handles app restart scenarios

**Implementation**: `apps/mobile/src/hooks/notifications/useGoalNotifications.ts`

## Flow Diagram

```
1. User Creates/Updates Goal with Reminder Times
   ↓
2. Goal Saved with reminder_times
   ↓
3. If Goal is Active:
   - Schedule Notifications (using timezone conversion)
   ↓
4. Notification Fires at Scheduled Time
   ↓
5. User Taps Notification
   ↓
6. App Opens Motivation Screen
   ↓
7. AI Generates Message (on-demand or scheduled)
   ↓
8. Message Displayed to User
```

## Key Files

- **Backend**: `apps/api/app/api/v1/endpoints/motivation.py`
- **Backend**: `apps/api/app/api/v1/endpoints/goals.py` (reminder_times field)
- **Frontend**: `apps/mobile/src/services/notifications/notificationScheduler.ts`
- **Frontend**: `apps/mobile/src/hooks/notifications/useGoalNotifications.ts`
- **Database**: `motivations` table
- **Database**: `goals.custom_reminder_message` field

## Frontend Integration

- Notification permission handling
- Reminder time selection UI
- Custom message input
- Motivation message display
- Notification tap handling

