# Social Feed

## Overview

The social feed combines AI-generated motivation messages with community posts in a unified feed, allowing users to engage with both AI content and other users' updates.

## Features

### 1. Combined Feed

**API Endpoint**: `GET /api/v1/social/feed`

Returns a unified feed containing:

- **AI Motivation Messages**: Personalized AI messages for the user
- **Community Posts**: Public posts from other users

**Implementation**: `apps/api/app/api/v1/endpoints/social.py`

**Features**:

- Merges AI and community content
- Sorted by creation date (newest first)
- Pagination support
- Filtering options

**Query Parameters**:

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 50)
- `category`: Filter by category (future feature)
- `user_id`: Filter by specific user

### 2. Feed Preferences

**Database Table**: `feed_preferences`

- User-specific feed settings
- Controls what appears in feed:
  - `show_ai_posts`: Show AI motivation messages (default: true)
  - `show_following_only`: Only show posts from followed users

**Implementation**:

- Preferences checked when building feed query
- If `show_following_only` is true, only shows posts from users being followed

### 3. Text Post Creation

**API Endpoint**: `POST /api/v1/social/posts`

Users can create text posts to share:

- Progress updates
- Thoughts and reflections
- Achievements
- General motivation

**Request**:

```python
class PostCreate(BaseModel):
    content: str
    media_url: Optional[str] = None
    media_type: str = "text"  # text, voice, image
    is_public: bool = True
```

**Database Table**: `posts`

- Stores community posts
- Tracks likes and comments counts
- Links to user via `user_id`

### 4. Voice Post Creation

**API Endpoint**: `POST /api/v1/social/posts` (with `media_type: "voice"`)

**Access Control**:

**Implementation**:

- Checks user's plan before allowing voice post creation
- Returns 403 Forbidden for free users

### 5. Like & Cheer System

**API Endpoint**: `POST /api/v1/social/posts/{post_id}/like`

**Reaction Types**:

- `like`: Standard like
- `cheer`: Encouragement reaction
- `love`: Strong positive reaction

**Request**:

```python
class LikeCreate(BaseModel):
    reaction_type: str = "like"  # like, cheer, love
```

**Database Table**: `likes`

- Tracks reactions to posts
- Links user to post
- Stores reaction type

**Features**:

- Update existing like (change reaction type)
- Remove like: `DELETE /api/v1/social/posts/{post_id}/like`
- Like counts displayed on posts

### 6. Comments on Posts

**API Endpoint**: `POST /api/v1/social/posts/{post_id}/comments`

Users can comment on posts to engage in discussions.

**Request**:

```python
class CommentCreate(BaseModel):
    content: str
```

**API Endpoint**: `GET /api/v1/social/posts/{post_id}/comments`

Retrieve comments for a post:

- Pagination support
- Sorted by creation date (newest first)
- Includes user information

**Database Table**: `comments`

- Stores post comments
- Links to post and user
- Tracks comment count on posts

### 7. User Following System

**API Endpoint**: `POST /api/v1/social/users/{user_id}/follow`

Follow a user to see their posts in your feed.

**API Endpoint**: `DELETE /api/v1/social/users/{user_id}/follow`

Unfollow a user.

**API Endpoint**: `GET /api/v1/social/users/{user_id}/followers`

Get list of user's followers.

**API Endpoint**: `GET /api/v1/social/users/{user_id}/following`

Get list of users that this user is following.

**Database Table**: `follows`

- `follower_id`: User who is following
- `following_id`: User being followed

### 8. Advanced Filtering

**Future Features**:

- Filter by category
- Filter by date range
- Filter by popularity (most liked)
- Filter by post type (text, voice, image)

**Current Implementation**:

- Filter by user_id
- Filter by following status (via feed preferences)

## Flow Diagram

```
1. User Opens Feed
   ↓
2. Fetch Feed (GET /social/feed)
   - Applies feed preferences
   - Fetches AI messages (if enabled)
   - Fetches community posts
   ↓
3. Merge and Sort by Date
   ↓
4. Display Unified Feed
   ↓
5. User Interactions:
   - Like/Unlike Post
   - Comment on Post
   - Follow/Unfollow User
   - Create New Post
```

## Key Files

- **Backend**: `apps/api/app/api/v1/endpoints/social.py`
- **Database**: `posts` table
- **Database**: `comments` table
- **Database**: `likes` table
- **Database**: `follows` table
- **Database**: `feed_preferences` table

## Frontend Integration

- Feed component with infinite scroll
- Post creation screen
- Like/comment UI
- User profile viewing
- Follow/unfollow buttons
