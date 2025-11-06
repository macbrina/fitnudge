# Habit Chains

## Overview

Habit chains provide a visual representation of consistency by showing a chain of completed days. The system automatically maintains chain data based on check-ins.

## Features

### 1. Habit Chain Data

**API Endpoint**: `GET /api/v1/goals/{goal_id}/habit-chains`

Returns habit chain entries for a specific goal.

**Query Parameters**:
- `start_date`: Optional start date filter
- `end_date`: Optional end date filter

**Response**: List of habit chain entries, each containing:
- `chain_date`: Date of the entry
- `is_completed`: Whether goal was completed that day
- `streak_count`: Current streak length at that date
- `goal_id`: Associated goal
- `user_id`: User who owns the chain

**Implementation**: `apps/api/app/api/v1/endpoints/goals.py`

### 2. Automatic Chain Updates

**Database Trigger**: `update_habit_chain_from_checkin()`

Automatically maintains habit chain data whenever check-ins are:
- **INSERTED**: Creates new chain entry
- **UPDATED**: Updates existing chain entry
- **DELETED**: Removes chain entry

**Trigger Events**:
- `INSERT` on `check_ins`
- `UPDATE` on `check_ins`
- `DELETE` on `check_ins`

**Implementation**: `apps/api/supabase/migrations/20251101000200_habit_chains.sql`

### 3. Chain Entry Structure

**Database Table**: `habit_chains`
- `user_id`: User who owns the chain
- `goal_id`: Associated goal
- `chain_date`: Date of the entry
- `is_completed`: Boolean indicating completion
- `streak_count`: Current streak length at that date
- `created_at`: When entry was created
- `updated_at`: When entry was last updated

### 4. Streak Calculation

**Streak Count**:
- Calculated automatically when chain entry is created/updated
- Increments for consecutive completed days
- Resets when a day is missed
- Tracks longest streak in the chain

**Logic**:
1. Check previous day's chain entry
2. If previous day completed and consecutive, increment streak
3. If previous day missed or non-consecutive, reset streak to 1
4. Store streak count in chain entry

### 5. Visual Representation

**Frontend Use Cases**:
- Calendar view showing completed/missed days
- Chain visualization (linked circles)
- Streak indicators
- Progress graphs

**Data Format**:
```json
[
  {
    "chain_date": "2025-01-01",
    "is_completed": true,
    "streak_count": 5
  },
  {
    "chain_date": "2025-01-02",
    "is_completed": true,
    "streak_count": 6
  },
  {
    "chain_date": "2025-01-03",
    "is_completed": false,
    "streak_count": 0
  }
]
```

### 6. Database Function

**Function**: `update_habit_chain_from_checkin()`

**Process**:
1. Determines operation type (INSERT/UPDATE/DELETE)
2. For DELETE: Removes corresponding chain entry
3. For INSERT/UPDATE:
   - Calculates streak count
   - Upserts chain entry
   - Updates adjacent entries if needed (for streak recalculation)

**Implementation**:
- PL/pgSQL function in PostgreSQL
- Triggered automatically by database
- Ensures data consistency

## Flow Diagram

```
1. User Creates/Updates Check-In
   ↓
2. Check-In Saved to Database
   ↓
3. Database Trigger Fires: update_habit_chain_from_checkin()
   ↓
4. Trigger Function:
   - Determines operation (INSERT/UPDATE/DELETE)
   - Calculates streak count
   - Updates habit_chains table
   ↓
5. Chain Entry Created/Updated
   ↓
6. Frontend Fetches Chain Data (GET /goals/{id}/habit-chains)
   ↓
7. Chain Visualized in UI
```

## Key Files

- **Backend**: `apps/api/app/api/v1/endpoints/goals.py` (habit-chains endpoint)
- **Database**: `habit_chains` table
- **Migration**: `20251101000200_habit_chains.sql`
- **Trigger**: `update_habit_chain_from_checkin()` function

## Frontend Integration

- Habit chain calendar component
- Chain visualization (linked circles)
- Streak display
- Progress graphs
- Date range filtering

