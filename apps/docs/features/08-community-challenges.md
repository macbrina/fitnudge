# Community Challenges

## Overview

Community challenges allow users to participate in fitness challenges with leaderboards, progress tracking, and competitive motivation.

## Features

### 1. Challenge Creation

**API Endpoint**: `POST /api/v1/challenges`

Creates a new challenge.

**Request**:
```python
class ChallengeCreate(BaseModel):
    title: str
    description: Optional[str] = None
    challenge_type: str  # streak, checkin_count, community, custom
    duration_days: int
    start_date: date
    is_public: bool = True
    max_participants: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None
```

**Implementation**: `apps/api/app/services/challenge_service.py`

**Database Table**: `challenges`
- Stores challenge details
- Tracks active/inactive status
- Links to creator via `created_by`
- Calculates `end_date` from `start_date` + `duration_days`

### 2. Challenge Discovery

**API Endpoint**: `GET /api/v1/challenges`

Lists available challenges with filtering:
- `is_public`: Filter public/private challenges
- `is_active`: Filter active/inactive challenges
- `my_challenges`: Show only user's created challenges

**Response**: List of `ChallengeResponse` objects

### 3. Joining Challenges

**API Endpoint**: `POST /api/v1/challenges/{challenge_id}/join`

Users can join challenges, optionally linking a goal.

**Query Parameters**:
- `goal_id`: Optional goal to link to challenge

**Implementation**: `apps/api/app/services/challenge_service.py`

**Database Table**: `challenge_participants`
- Links user to challenge
- Tracks progress data
- Stores join timestamp
- Optional goal association

**Validation**:
- Checks if challenge exists
- Checks if challenge is active
- Checks participant limit (if set)
- Prevents duplicate participation

### 4. Challenge Progress Tracking

**Automatic Updates**:
- Triggered when user completes a check-in
- Background task: `update_challenge_progress_task`
- Updates participant progress based on check-ins

**API Endpoint**: `POST /api/v1/challenges/{challenge_id}/update-progress`

Manually update progress (for testing/admin).

**Implementation**: `apps/api/app/services/challenge_service.py`

**Progress Calculation**:
- For `streak` challenges: Tracks consecutive days
- For `checkin_count` challenges: Counts total check-ins
- For `community` challenges: Aggregates various metrics

### 5. Challenge Leaderboard

**API Endpoint**: `GET /api/v1/challenges/{challenge_id}/leaderboard`

Returns ranked list of participants:
- Sorted by score/progress
- Shows user's rank
- Limited to top N participants

**Database Table**: `challenge_leaderboard`
- Stores calculated rankings
- Updates automatically when progress changes
- Includes rank, score, and user info

**Query Parameters**:
- `limit`: Number of top participants (default: 50, max: 100)

### 6. Challenge Types

**Streak Challenge**:
- Measures consecutive days of completion
- Highest streak wins

**Check-In Count Challenge**:
- Measures total number of completed check-ins
- Most check-ins wins

**Community Challenge**:
- Combines multiple metrics
- Can include custom scoring

**Custom Challenge**:
- User-defined metrics
- Uses metadata for custom rules

### 7. Challenge Service

**Service**: `apps/api/app/services/challenge_service.py`

**Key Methods**:
- `create_challenge()`: Creates new challenge
- `get_challenges()`: Lists challenges with filters
- `join_challenge()`: Adds participant to challenge
- `update_participant_progress()`: Updates progress from check-ins
- `get_leaderboard()`: Returns ranked participants

## Flow Diagram

```
1. Challenge Created (POST /challenges)
   ↓
2. Challenge Stored in Database
   ↓
3. Users Discover Challenge (GET /challenges)
   ↓
4. User Joins Challenge (POST /challenges/{id}/join)
   ↓
5. Participant Record Created
   ↓
6. User Completes Check-In
   ↓
7. Background Task: update_challenge_progress_task
   ↓
8. Challenge Service Updates Progress:
   - Calculates metrics (streak, count, etc.)
   - Updates participant progress
   - Recalculates leaderboard
   ↓
9. Leaderboard Updated (GET /challenges/{id}/leaderboard)
```

## Key Files

- **Backend**: `apps/api/app/api/v1/endpoints/challenges.py`
- **Service**: `apps/api/app/services/challenge_service.py`
- **Tasks**: `apps/api/app/services/tasks.py` (update_challenge_progress_task)
- **Database**: `challenges` table
- **Database**: `challenge_participants` table
- **Database**: `challenge_leaderboard` table

## Frontend Integration

- Challenge discovery screen
- Challenge detail view
- Leaderboard display
- Join challenge button
- Progress visualization
- Challenge creation form

