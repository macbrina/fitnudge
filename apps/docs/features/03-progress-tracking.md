# Progress Tracking

## Overview

The progress tracking system provides visual and statistical insights into user's goal completion, including streaks, habit chains, and goal-specific statistics.

## Features

### 1. Goal Statistics

**API Endpoint**: `GET /api/v1/goals/{goal_id}/stats`

Returns comprehensive statistics for a specific goal:
- Total check-ins
- Completed check-ins
- Completion rate
- Current streak (consecutive completed days)
- Longest streak
- Goal creation date

**Implementation**: `apps/api/app/api/v1/endpoints/goals.py`

### 2. Habit Chains (Visual Streak Visualization)

**API Endpoint**: `GET /api/v1/goals/{goal_id}/habit-chains`

Returns habit chain data for visualization, showing:
- Chain of completed days
- Broken chains (missed days)
- Visual representation of consistency

**Database Table**: `habit_chains`
- Stores daily chain entries per goal
- Tracks `is_completed` status
- Automatically updated via database trigger when check-ins change

**Automatic Updates**:
- Trigger: `update_habit_chain_from_checkin()`
- Fires on INSERT, UPDATE, DELETE of `check_ins`
- Maintains habit chain data in real-time

**Implementation**: `apps/api/supabase/migrations/20251101000200_habit_chains.sql`

### 3. Check-In Statistics

**API Endpoint**: `GET /api/v1/check-ins/stats`

Overall statistics across all goals or filtered by goal:
- Total check-ins
- Completed check-ins
- Completion rate
- Current streak
- Longest streak
- Average mood (if mood tracking enabled)
- Mood trend over time

**Implementation**: `apps/api/app/api/v1/endpoints/checkins.py`

### 4. Streak Calculation

**Current Streak**:
- Calculated from most recent check-in backwards
- Counts consecutive completed days
- Resets when a day is missed

**Longest Streak**:
- Tracks the longest consecutive streak in history
- Never resets, only updates if new streak exceeds previous record

**Implementation**:
- Calculated in real-time from `check_ins` table
- Uses date sorting to identify consecutive days
- Accounts for gaps in check-in dates

### 5. Progress Photos Timeline

**API Endpoint**: `GET /api/v1/check-ins` (with photo_urls)

Users can view progress photos attached to check-ins:
- Photos displayed in chronological order
- Linked to specific check-in date
- Optional descriptions stored in `progress_photos` table

**Database**:
- `check_ins.photo_urls`: Array of photo URLs per check-in
- `progress_photos`: Detailed photo records with metadata

## Data Flow

```
Check-In Recorded
   ↓
Habit Chain Updated (via trigger)
   ↓
Statistics Calculated
   ↓
UI Displays:
- Streak Counter
- Habit Chain Visualization
- Progress Photos Timeline
- Completion Rate
```

## Key Files

- **Backend**: `apps/api/app/api/v1/endpoints/goals.py` (stats endpoint)
- **Backend**: `apps/api/app/api/v1/endpoints/checkins.py` (stats endpoint)
- **Database**: `habit_chains` table with trigger function
- **Migration**: `20251101000200_habit_chains.sql`

## Frontend Integration

- Streak visualization components
- Habit chain calendar/chain view
- Progress photo gallery
- Statistics dashboard
- Completion rate charts

