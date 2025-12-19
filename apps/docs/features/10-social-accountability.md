# Social Accountability

## Overview

Social accountability features enable users to share goals with friends and find accountability partners for collaborative motivation.

## Features

### 1. Goal Sharing

**API Endpoint**: `POST /api/v1/social-accountability/goals/{goal_id}/share`

Share a goal with specific users with different permission levels.

**Request**:
```python
class GoalShareCreate(BaseModel):
    shared_with_user_id: str
    permission_level: str = "view"  # view, comment, motivate
```

**Permission Levels**:
- **view**: Can view goal and progress
- **comment**: Can view and comment on progress
- **motivate**: Can view, comment, and send motivation messages

**Database Table**: `goal_shares`
- Links goal to shared users
- Stores permission level
- Tracks active/inactive status

**Implementation**: `apps/api/app/services/social_accountability_service.py`

### 2. Viewing Shared Goals

**API Endpoint**: `GET /api/v1/social-accountability/goals/shared-with-me`

Returns goals that have been shared with the current user:
- Shows permission level for each goal
- Includes goal owner information
- Shows progress based on permissions

### 3. Accountability Partners

**API Endpoint**: `POST /api/v1/social-accountability/accountability-partners/request`

Request an accountability partnership with another user.

**Process**:
1. User A sends request to User B
2. User B receives notification
3. User B accepts/declines request
4. If accepted, partnership is created

**API Endpoint**: `POST /api/v1/social-accountability/accountability-partners/{partner_id}/accept`

Accept an accountability partner request.

**Database Table**: `accountability_partners`
- Links two users in partnership
- Tracks request/accept status
- Stores partnership metadata

**Features**:
- Mutual motivation and support
- Shared progress visibility
- Partner-specific communication

### 4. Social Accountability Service

**Service**: `apps/api/app/services/social_accountability_service.py`

**Key Methods**:
- `share_goal_with_user()`: Share goal with specific user
- `get_shared_goals()`: Get goals shared with user
- `request_accountability_partner()`: Request partnership
- `accept_accountability_partner()`: Accept partnership

## Flow Diagrams

### Goal Sharing Flow:
```
1. User Shares Goal (POST /goals/{id}/share)
   ↓
2. Goal Share Record Created
   ↓
3. Shared User Receives Notification
   ↓
4. Shared User Views Goal (GET /goals/shared-with-me)
   ↓
5. Permission Level Determines Access
```

### Accountability Partner Flow:
```
1. User Requests Partner (POST /accountability-partners/request)
   ↓
2. Partner Request Created
   ↓
3. Partner Receives Notification
   ↓
4. Partner Accepts (POST /accountability-partners/{id}/accept)
   ↓
5. Partnership Created
   ↓
6. Mutual Access to Progress
```

## Key Files

- **Backend**: `apps/api/app/api/v1/endpoints/social_accountability.py`
- **Service**: `apps/api/app/services/social_accountability_service.py`
- **Database**: `goal_shares` table
- **Database**: `accountability_partners` table

## Frontend Integration

- Goal sharing interface
- Permission level selection
- Partner request/accept UI
- Shared goal viewing

