# Meal Tracking

## Overview

Meal tracking allows users to log meals with nutritional data for accountability and progress tracking. The system aggregates daily nutrition summaries automatically.

## Features

### 1. Meal Logging

**API Endpoint**: `POST /api/v1/meals`

Log a meal with optional nutritional information.

**Request**:
```python
class MealLogCreate(BaseModel):
    meal_type: str  # breakfast, lunch, dinner, snack, other
    logged_date: date
    meal_name: Optional[str] = None
    meal_description: Optional[str] = None
    logged_time: Optional[time] = None
    goal_id: Optional[str] = None
    estimated_protein: Optional[int] = None  # grams
    estimated_calories: Optional[int] = None
    notes: Optional[str] = None
    photo_urls: Optional[List[str]] = None
```

**Database Table**: `meal_logs`
- Stores individual meal entries
- Links to user and optional goal
- Tracks meal type, date, time
- Stores nutritional estimates
- Supports photo attachments

**Implementation**: `apps/api/app/services/meal_tracking_service.py`

### 2. Meal Retrieval

**API Endpoint**: `GET /api/v1/meals`

Get user's meal logs with filtering:
- Filter by date range
- Filter by meal type
- Filter by goal
- Pagination support

**Query Parameters**:
- `start_date`: Filter from date
- `end_date`: Filter to date
- `meal_type`: Filter by meal type
- `goal_id`: Filter by goal
- `page`: Page number
- `limit`: Items per page

### 3. Meal Updates and Deletion

**API Endpoint**: `PUT /api/v1/meals/{meal_log_id}`

Update an existing meal log.

**API Endpoint**: `DELETE /api/v1/meals/{meal_log_id}`

Delete a meal log.

### 4. Daily Nutrition Summary

**API Endpoint**: `GET /api/v1/meals/nutrition/summary/{summary_date}`

Get aggregated nutrition data for a specific date.

**Response**:
- Total calories
- Total protein
- Meal count
- Meal breakdown by type
- Photo count

**Implementation**: Automatically aggregates from `meal_logs` table

### 5. Nutrition Summaries by Date Range

**API Endpoint**: `GET /api/v1/meals/nutrition/summaries`

Get nutrition summaries for a date range.

**Query Parameters**:
- `start_date`: Start date
- `end_date`: End date

**Response**: List of daily summaries

**Use Cases**:
- Weekly nutrition overview
- Monthly progress tracking
- Trend analysis

### 6. Meal Tracking Service

**Service**: `apps/api/app/services/meal_tracking_service.py`

**Key Methods**:
- `log_meal()`: Create meal log
- `update_meal_log()`: Update existing meal
- `delete_meal_log()`: Delete meal
- `get_daily_nutrition_summary()`: Get daily aggregated data
- `get_nutrition_summaries_by_date_range()`: Get range of summaries

### 7. Daily Nutrition Summaries Table

**Database Table**: `daily_nutrition_summaries`
- Pre-aggregated daily summaries
- Reduces query time for statistics
- Can be updated via trigger or batch job

**Fields**:
- `user_id`
- `summary_date`
- `total_calories`
- `total_protein`
- `meal_count`
- Additional aggregated metrics

**Optimization**:
- Reduces need for real-time aggregation
- Enables fast statistics queries
- Can be updated incrementally

## Flow Diagram

```
1. User Logs Meal (POST /meals)
   ↓
2. Meal Log Saved to Database
   ↓
3. Daily Summary Updated (if cached)
   ↓
4. User Views Daily Summary (GET /nutrition/summary/{date})
   ↓
5. System Aggregates:
   - Total calories
   - Total protein
   - Meal count
   - Meal types
   ↓
6. Summary Returned to User
```

## Key Files

- **Backend**: `apps/api/app/api/v1/endpoints/meals.py`
- **Service**: `apps/api/app/services/meal_tracking_service.py`
- **Database**: `meal_logs` table
- **Database**: `daily_nutrition_summaries` table

## Frontend Integration

- Meal logging form
- Photo upload for meals
- Daily nutrition summary display
- Weekly/monthly nutrition charts
- Meal history list
- Nutrition goal tracking

