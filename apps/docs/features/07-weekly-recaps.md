# Weekly Recaps

## Overview

Weekly recaps provide AI-generated summaries of user's progress over the past week, including insights, statistics, and motivational encouragement.

## Features

### 1. Weekly Recap Generation

**API Endpoint**: `GET /api/v1/recaps/weekly`

Generates a weekly recap for the user's active goal or a specific goal.

**Query Parameters**:
- `goal_id`: Optional specific goal to focus on

**Implementation**: `apps/api/app/services/weekly_recap_service.py`

### 2. Recap Content

**Response Structure**:
```python
class WeeklyRecapResponse(BaseModel):
    week_start: str
    week_end: str
    goal_id: str
    goal_title: str
    stats: dict
    recap_text: str  # AI-generated summary
    generated_at: str
```

**Statistics Included**:
- Completed check-ins count
- Days with check-ins
- Current streak
- Longest streak in the week
- Average mood (if mood tracking enabled)
- Completion rate percentage

### 3. AI-Generated Recap Text

**AI Prompt**:
- User's goal information
- Weekly statistics
- Recent check-in data
- User's motivation style preference
- Biggest challenge (from fitness profile)

**Tone**: Matches user's preferred motivation style (friendly, tough-love, calm)

**Content**:
- Celebrates wins and progress
- Addresses completion rate constructively
- Highlights streak momentum
- Provides 1-2 actionable insights
- Encouraging and motivating (2-3 paragraphs)

**Implementation**: Uses OpenAI GPT-5 mini with low effort reasoning

### 4. Automatic Generation

**Scheduled Task**: `generate_weekly_recaps_task`

**Schedule**: Runs daily via Celery Beat, but only generates recaps on Mondays

**Implementation**: `apps/api/app/services/tasks.py`

```python
@celery_app.task
def generate_weekly_recaps_task():
    # Runs daily, generates recaps on Mondays
    # Fetches all users and generates recaps
```

**Process**:
1. Check if today is Monday
2. Fetch all active users
3. For each user, generate weekly recap
4. Store recap (future: can be stored in database)

### 5. Data Sources

**Check-Ins**:
- Fetches check-ins from past 7 days
- Filters by `completed=True` if needed
- Includes mood data if available

**Goal Information**:
- Gets active goal or specified goal
- Includes title, description, category

**User Profile**:
- Gets fitness profile for personalization
- Uses motivation style and biggest challenge

### 6. Fallback Recap

If AI generation fails, a basic fallback recap is generated:
- Acknowledges completion count
- Mentions streak if applicable
- Provides encouragement
- Less personalized but still motivating

**Implementation**: `_generate_fallback_recap()` method

## Flow Diagram

```
1. Weekly Recap Requested (GET /recaps/weekly)
   ↓
2. Fetch Past 7 Days of Check-Ins
   ↓
3. Get Active Goal (or specified goal)
   ↓
4. Calculate Statistics:
   - Completion count
   - Streak length
   - Mood average
   - Completion rate
   ↓
5. Get User Profile for Personalization
   ↓
6. Generate AI Recap Text:
   - Build prompt with stats + profile
   - Call OpenAI API
   - Extract recap text
   ↓
7. Return Recap with Stats + Text
```

**OR** (Scheduled Task):

```
1. Celery Beat Runs Daily
   ↓
2. Check if Monday
   ↓
3. If Monday, Generate Recaps for All Users
   ↓
4. Background Task Processes Each User
```

## Key Files

- **Backend**: `apps/api/app/api/v1/endpoints/recaps.py`
- **Service**: `apps/api/app/services/weekly_recap_service.py`
- **Tasks**: `apps/api/app/services/tasks.py` (generate_weekly_recaps_task)
- **Celery Config**: `apps/api/app/core/celery_app.py` (beat schedule)

## Frontend Integration

- Weekly recap display screen
- Statistics visualization
- Share recap functionality
- Recap history (future feature)

