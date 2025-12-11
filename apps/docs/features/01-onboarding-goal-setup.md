# User Onboarding & Goal Setup

## Overview

The onboarding system guides new users through personalization and goal creation. Users complete a fitness profile that captures their preferences, then receive AI-suggested goals tailored to their profile.

## How It Works

### 1. Personalization Flow

Users provide information about:

- **Fitness Level**: Current fitness status
- **Primary Goal**: Main fitness objective
- **Current Frequency**: How often they currently exercise
- **Preferred Location**: Where they prefer to work out (home, gym, outdoors)
- **Available Time**: Time available for workouts
- **Motivation Style**: Preferred motivation approach (friendly, tough-love, calm)
- **Biggest Challenge**: Their main obstacle to consistency

**API Endpoint**: `POST /api/v1/onboarding/profile`

**Implementation**: `apps/api/app/api/v1/endpoints/onboarding.py`

```python
class FitnessProfileRequest(BaseModel):
    fitness_level: str
    primary_goal: str
    current_frequency: str
    preferred_location: str
    available_time: str
    motivation_style: str
    biggest_challenge: str
```

**Database Table**: `user_fitness_profiles`

- Stores user personalization data
- Used by AI to generate personalized goal suggestions

### 2. AI Goal Suggestions

After completing the profile, users receive AI-generated goal suggestions using OpenAI GPT-5 mini.

**API Endpoint**: `GET /api/v1/onboarding/suggested-goals`

**Key Features**:

- Generates 5-7 personalized goal suggestions
- Each suggestion includes:
  - **Title**: Goal name
  - **Description**: Detailed explanation
  - **Category**: fitness, nutrition, wellness, mindfulness, sleep, custom
  - **Frequency**: daily, weekly, monthly, custom
  - **Target Days**: Specific days per week/month (optional)
  - **Reminder Times**: Suggested reminder times
  - **Match Reason**: Why this goal matches the user's profile

**Implementation Details**:

- Uses `OpenAIService` to generate suggestions
- System prompt emphasizes accountability and personalization
- Considers user's subscription plan (Free/Starter/Pro/Elite) to suggest appropriate features
- Timeout: 25 seconds
- Fallback: If AI fails, returns empty list (user can create custom goal)

### 3. Goal Creation

Users can:

1. **Select Suggested Goals**: Choose one or more AI-suggested goals
2. **Create Custom Goal**: Manually create a goal

**API Endpoint**: `POST /api/v1/goals`

- **Free**: 1 goal total, 1 active
- **Starter**: 3 goals total, 2 active
- **Pro**: Unlimited goals, 3 active
- **Elite**: Unlimited goals, 3 active

**Implementation**: `apps/api/app/api/v1/endpoints/goals.py`

```python
class GoalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str
    frequency: str
    target_days: Optional[int] = None
    reminder_times: Optional[List[str]] = None
    custom_reminder_message: Optional[str] = None
```

**Database Table**: `goals`

- Stores user goals
- Tracks active/inactive status
- Links to user's subscription plan for limit checking

### 4. Dynamic Goal Limits

The system dynamically checks user's subscription plan to enforce limits:

```python
def get_user_goal_limit(user_plan: str, supabase) -> Optional[int]:
    """Get total goal limit for user's plan"""

def get_user_active_goal_limit(user_plan: str, supabase) -> int:
    """Get active goal limit (how many can be active simultaneously)"""
```

**Active Goal Management**:

- When creating a goal, if `current_active_count < active_goal_limit`, goal is created as active
- When activating a goal, checks if limit is reached
- Users can manually activate/deactivate goals within their plan limits

## Flow Diagram

```
1. User Signs Up
   ↓
2. Complete Fitness Profile (POST /onboarding/profile)
   ↓
3. Receive AI Suggestions (GET /onboarding/suggested-goals)
   ↓
4. Select Goals OR Create Custom Goal
   ↓
5. Create Goal(s) (POST /goals)
   ↓
6. Goal Created with Actionable Plan (background task)
   ↓
7. Onboarding Complete
```

## Key Files

- **Backend**: `apps/api/app/api/v1/endpoints/onboarding.py`
- **Backend**: `apps/api/app/api/v1/endpoints/goals.py`
- **Service**: `apps/api/app/services/openai_service.py`
- **Database**: `user_fitness_profiles` table
- **Database**: `goals` table

## Frontend Integration

- **Onboarding Flow**: `apps/mobile/src/screens/onboarding/personalization/PersonalizationFlow.tsx`
- **Goal Suggestions**: `apps/mobile/src/screens/onboarding/SuggestedGoalsScreen.tsx`
- **Custom Goal Creation**: `apps/mobile/src/screens/goals/CreateGoalScreen.tsx`
