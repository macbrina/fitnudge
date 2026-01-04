# AI Progress Reflections

## Overview

AI Progress Reflections provide premium, deep insights into user progress with actionable coaching recommendations. This is an enhanced version of weekly recaps, available to Premium users only.

## Features

### 1. Progress Reflection Generation

**API Endpoint**: `GET /api/v1/progress-reflections/weekly`

Generate weekly AI progress reflection.

**API Endpoint**: `GET /api/v1/progress-reflections/monthly`

Generate monthly AI progress reflection.

**Query Parameters**:

- `goal_id`: Optional specific goal to focus on

**Access Control**: Premium users only

**Implementation**: `apps/api/app/services/ai_progress_reflections_service.py`

### 2. Deep Analysis Content

**Response Structure**:

- `period`: "weekly" or "monthly"
- `start_date`: Period start date
- `end_date`: Period end date
- `goal_id`: Focused goal (if specified)
- `goal`: Goal details
- `stats`: Calculated statistics
- `reflection`: AI-generated deep reflection text
- `generated_at`: Generation timestamp

**Statistics Included**:

- Total days in period
- Total completed check-ins
- Completion rate percentage
- Current streak
- Longest streak in period
- Average mood (if tracked)
- Check-in count

### 3. AI-Generated Reflection

**AI Model**: OpenAI GPT-5 mini with medium effort reasoning (higher quality than weekly recaps)

**Prompt Structure**:

- User context (goal, fitness level, motivation style, biggest challenge)
- Performance data (completion rate, streaks, check-ins)
- Period-specific metrics

**Content Format**:

- **Opening**: Context and overall assessment
- **Strengths**: What user is doing well
- **Challenges**: Areas for improvement
- **Insights**: Pattern analysis and observations
- **Recommendations**: 2-3 specific, actionable next steps
- **Closing**: Encouragement and motivation

**Length**: 4-5 paragraphs (more detailed than weekly recaps)

**Tone**: Professional coaching tone, personalized to user's motivation style

### 4. Service Implementation

**Service**: `apps/api/app/services/ai_progress_reflections_service.py`

**Key Methods**:

- `generate_reflection()`: Main reflection generation
- `_calculate_stats()`: Calculate period statistics
- `_generate_ai_reflection()`: AI text generation
- `_generate_fallback_reflection()`: Basic fallback if AI fails

### 5. Data Sources

**Check-Ins**:

- Fetches check-ins for the period (weekly: 7 days, monthly: 30 days)
- Filters by completion status
- Includes mood data if available

**Goal Information**:

- Gets specified goal or active goals
- Includes goal details for context

**User Profile**:

- Retrieves fitness profile for personalization
- Uses motivation style and biggest challenge

### 6. Fallback Reflection

If AI generation fails:

- Generates basic reflection with key statistics
- Acknowledges completion rate
- Mentions streak if applicable
- Provides encouragement
- Less detailed but still useful

## Comparison with Weekly Recaps

| Feature              | Weekly Recaps  | AI Progress Reflections |
| -------------------- | -------------- | ----------------------- |
| **Access**           | All users      | Premium                 |
| **AI Effort**        | Low            | Medium                  |
| **Length**           | 2-3 paragraphs | 4-5 paragraphs          |
| **Depth**            | Summary        | Deep analysis           |
| **Insights**         | Basic          | Comprehensive           |
| **Recommendations**  | 1-2 tips       | 2-3 actionable steps    |
| **Pattern Analysis** | Limited        | Detailed                |
| **Tone**             | Friendly       | Professional coaching   |

## Flow Diagram

```
1. Premium User Requests Reflection (GET /progress-reflections/{period})
   ↓
2. Verify User Subscription Level
   ↓
3. Fetch Check-Ins for Period (weekly: 7 days, monthly: 30 days)
   ↓
4. Get Goal Information (specified or active)
   ↓
5. Calculate Statistics:
   - Completion rate
   - Streaks
   - Mood average
   - Check-in count
   ↓
6. Get User Profile for Personalization
   ↓
7. Generate AI Reflection:
   - Build comprehensive prompt
   - Call OpenAI with medium effort
   - Extract reflection text
   ↓
8. Return Reflection with Stats + Deep Analysis
```

## Key Files

- **Backend**: `apps/api/app/api/v1/endpoints/progress_reflections.py`
- **Service**: `apps/api/app/services/ai_progress_reflections_service.py`
- **Subscription Check**: Plan verification required

## Frontend Integration

- Progress reflection display screen
- Premium badge/indicator
- Statistics visualization
- Share reflection (optional)
- Reflection history (future feature)
