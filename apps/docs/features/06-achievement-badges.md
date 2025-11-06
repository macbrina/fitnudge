# Achievement Badges

## Overview

The achievement badge system rewards users for reaching milestones, maintaining streaks, and demonstrating consistency. Badges are automatically unlocked when conditions are met.

## Features

### 1. Achievement Types

**API Endpoint**: `GET /api/v1/achievements/types`

Returns all available achievement types with:
- Badge key (unique identifier)
- Badge name
- Description
- Unlock condition
- Category
- Rarity (common, rare, epic, legendary)
- Points value

**Database Table**: `achievement_types`
- Defines all available achievements
- Includes unlock conditions (e.g., "streak_7", "total_checkins_50")
- Tracks sort order for display
- Active/inactive status

### 2. User Achievements

**API Endpoint**: `GET /api/v1/achievements/me`

Returns user's unlocked achievements:
- All achievements ever unlocked
- Filter by `goal_id` (optional)
- Includes achievement type details
- Shows unlock timestamp
- Metadata stored per achievement

**Database Table**: `user_achievements`
- Links user to achievement type
- Optional `goal_id` for goal-specific achievements
- Tracks `unlocked_at` timestamp
- Stores `metadata` (additional context)

### 3. Automatic Unlocking

**Trigger**: After successful check-in (`completed=True`)

**Background Task**: `check_achievements_task`

**Implementation**: `apps/api/app/services/achievement_service.py`

**Process**:
1. Get all active achievement types
2. Check if user already has each achievement
3. Evaluate unlock condition for each achievement
4. If condition met, unlock achievement
5. Log newly unlocked achievements

**Unlock Conditions**:
- **Streak Achievements**: 
  - `streak_3`: 3-day streak
  - `streak_7`: 7-day streak
  - `streak_30`: 30-day streak
- **Check-In Achievements**:
  - `first_checkin`: First check-in ever
  - `total_checkins_10`: 10 total check-ins
  - `total_checkins_50`: 50 total check-ins
  - `total_checkins_100`: 100 total check-ins
- **Perfect Week**: All days completed in a week
- **Goal-Specific**: Achievements tied to specific goals

### 4. Manual Achievement Check

**API Endpoint**: `POST /api/v1/achievements/check`

Manually trigger achievement check:
- Useful for testing
- Can specify `goal_id` for goal-specific checks
- Returns newly unlocked achievements

**Implementation**: `apps/api/app/api/v1/endpoints/achievements.py`

### 5. Achievement Statistics

**API Endpoint**: `GET /api/v1/achievements/stats`

Returns user's achievement statistics:
- Total achievements unlocked
- Total points earned
- Breakdown by rarity (common, rare, epic, legendary)

### 6. Achievement Service

**Service**: `apps/api/app/services/achievement_service.py`

**Key Methods**:
- `check_and_unlock_achievements()`: Core unlocking logic
- `_check_condition()`: Evaluates if condition is met
- `_unlock_achievement()`: Creates achievement record
- `get_achievement_types()`: Fetches all types
- `get_user_achievements()`: Fetches user's achievements

**Condition Checking**:
- `_check_streak()`: Checks current streak length
- `_check_total_checkins()`: Counts total check-ins
- `_check_perfect_week()`: Checks if all days completed in a week

## Flow Diagram

```
1. User Completes Check-In (completed=True)
   ↓
2. Check-In Saved to Database
   ↓
3. Background Task Queued: check_achievements_task
   ↓
4. Achievement Service Checks Conditions:
   - Streak length
   - Total check-ins
   - Perfect week
   - Goal-specific milestones
   ↓
5. Conditions Evaluated Against Achievement Types
   ↓
6. New Achievements Unlocked
   ↓
7. Achievement Records Created in user_achievements
   ↓
8. User Notified (optional)
   ↓
9. Badge Displayed in UI
```

## Key Files

- **Backend**: `apps/api/app/api/v1/endpoints/achievements.py`
- **Service**: `apps/api/app/services/achievement_service.py`
- **Tasks**: `apps/api/app/services/tasks.py` (check_achievements_task)
- **Database**: `achievement_types` table
- **Database**: `user_achievements` table

## Frontend Integration

- Achievement badge display
- Unlock animations
- Achievement gallery/profile
- Statistics dashboard
- Progress indicators for locked achievements

