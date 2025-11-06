# Check-In System

## Overview

The check-in system allows users to record daily progress on their goals. Users can mark completion, add reflections, track mood, and attach progress photos.

## Features

### 1. Quick Check-In

Daily question: "Did you work out today?" with Yes/No response.

**API Endpoint**: `POST /api/v1/check-ins`

**Implementation**: `apps/api/app/api/v1/endpoints/checkins.py`

```python
class CheckInCreate(BaseModel):
    goal_id: str
    date: date
    completed: bool
    reflection: Optional[str] = None
    mood: Optional[int] = None  # 1-5 scale
    photo_urls: Optional[List[str]] = None
```

**Database Table**: `check_ins`
- Stores daily check-ins
- Tracks completion status
- Links to goals via `goal_id`
- Includes date for streak calculation

### 2. Mood Check-In

Users can track mood on a 1-5 scale with each check-in:
- 1: Very low
- 2: Low
- 3: Neutral
- 4: Good
- 5: Excellent

**Implementation**:
- Mood is stored in `mood` field of `check_ins` table
- Used for analytics and weekly recaps
- Helps identify patterns in motivation

### 3. Progress Photos

Users can attach photos to check-ins to track visual progress.

**Implementation**:
- `photo_urls` field in `check_ins` table (TEXT[] array)
- Also stored in separate `progress_photos` table for detailed tracking
- Photos linked to specific check-in via `check_in_id`

**Database Tables**:
- `check_ins.photo_urls`: Array of photo URLs
- `progress_photos`: Detailed photo records with descriptions

### 4. Check-In Retrieval

**API Endpoint**: `GET /api/v1/check-ins`

**Features**:
- Filter by goal
- Filter by date range
- Pagination support
- Includes goal information

**Query Parameters**:
- `goal_id`: Filter by specific goal
- `start_date`: Filter from date
- `end_date`: Filter to date
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

### 5. Check-In Statistics

**API Endpoint**: `GET /api/v1/check-ins/stats`

Returns:
- Total check-ins
- Completed check-ins
- Completion rate
- Current streak
- Longest streak
- Average mood
- Mood trend

### 6. Automatic Achievement Unlocking

When a check-in is completed (`completed=True`), the system automatically:
1. Queues achievement check (`check_achievements_task`)
2. Updates challenge progress (`update_challenge_progress_task`)

**Implementation**: `apps/api/app/api/v1/endpoints/checkins.py`

```python
# After successful check-in
if checkin_data.completed:
    check_achievements_task.delay(current_user["id"], goal_id)
    update_challenge_progress_task.delay(current_user["id"])
```

## Flow Diagram

```
1. User Opens Check-In Screen
   ↓
2. Selects Goal (if multiple active goals)
   ↓
3. Records Check-In (POST /check-ins)
   - Completed: Yes/No
   - Reflection (optional)
   - Mood (optional, 1-5)
   - Photos (optional)
   ↓
4. Check-In Saved to Database
   ↓
5. Background Tasks Triggered (if completed):
   - Achievement Check
   - Challenge Progress Update
   ↓
6. UI Updates:
   - Streak Counter
   - Progress Tracker
   - Habit Chain Visualization
```

## Key Files

- **Backend**: `apps/api/app/api/v1/endpoints/checkins.py`
- **Database**: `check_ins` table
- **Database**: `progress_photos` table
- **Tasks**: `apps/api/app/services/tasks.py` (achievement/challenge tasks)

## Frontend Integration

- Check-in screens in mobile app
- Progress tracking visualization
- Streak indicators
- Photo upload integration

