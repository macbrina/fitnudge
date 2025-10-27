# 🔌 API Specification

---

## 🔐 Authentication

### JWT Token Format

- **Access Token**: 15 minutes expiration
- **Refresh Token**: 7 days expiration
- **Algorithm**: HS256
- **Header**: `Authorization: Bearer <access_token>`

### Token Refresh Flow

1. Client receives 401 with expired token
2. Send refresh token to `/api/v1/auth/refresh`
3. Receive new access token
4. Retry original request with new token

---

## 🔑 Authentication Endpoints

### POST /api/v1/auth/signup

**Description**: Create new user account with email/password

**Request Body**:

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "username": "johndoe"
}
```

**Response** (201 Created):

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@example.com",
    "name": "John Doe",
    "username": "johndoe",
    "plan": "free",
    "email_verified": false,
    "auth_provider": "email",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

### POST /api/v1/auth/login

**Description**: Authenticate user with email/password

**Request Body**:

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response** (200 OK):

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@example.com",
    "name": "John Doe",
    "username": "johndoe",
    "plan": "free",
    "email_verified": true,
    "auth_provider": "email",
    "last_login_at": "2024-01-15T10:30:00Z"
  }
}
```

### POST /api/v1/auth/oauth/apple

**Description**: Sign in with Apple (iOS only)

**Request Body**:

```json
{
  "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "authorization_code": "c1234567890abcdef",
  "user": {
    "name": {
      "firstName": "John",
      "lastName": "Doe"
    },
    "email": "user@privaterelay.appleid.com"
  }
}
```

**Response** (200 OK):

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@privaterelay.appleid.com",
    "name": "John Doe",
    "username": "johndoe",
    "plan": "free",
    "email_verified": true,
    "auth_provider": "apple",
    "last_login_at": "2024-01-15T10:30:00Z"
  },
  "is_new_user": true
}
```

### POST /api/v1/auth/oauth/google

**Description**: Sign in with Google (iOS + Android)

**Request Body**:

```json
{
  "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "access_token": "ya29.a0AfH6SMC..."
}
```

**Response** (200 OK):

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@gmail.com",
    "name": "John Doe",
    "username": "johndoe",
    "plan": "free",
    "email_verified": true,
    "auth_provider": "google",
    "last_login_at": "2024-01-15T10:30:00Z"
  },
  "is_new_user": false
}
```

### POST /api/v1/auth/refresh

**Description**: Refresh access token

**Request Body**:

```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response** (200 OK):

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### POST /api/v1/auth/logout

**Description**: Logout user and invalidate tokens

**Headers**: `Authorization: Bearer <access_token>`

**Response** (200 OK):

```json
{
  "message": "Successfully logged out"
}
```

### POST /api/v1/auth/verify-email

**Description**: Verify email address

**Request Body**:

```json
{
  "token": "verification_token_here"
}
```

**Response** (200 OK):

```json
{
  "message": "Email verified successfully"
}
```

### POST /api/v1/auth/forgot-password

**Description**: Send password reset email

**Request Body**:

```json
{
  "email": "user@example.com"
}
```

**Response** (200 OK):

```json
{
  "message": "Password reset email sent"
}
```

### POST /api/v1/auth/reset-password

**Description**: Reset password with token

**Request Body**:

```json
{
  "token": "reset_token_here",
  "new_password": "NewSecurePass123!"
}
```

**Response** (200 OK):

```json
{
  "message": "Password reset successfully"
}
```

---

## 🎯 Goals Endpoints

### GET /api/v1/goals

**Description**: Get user's goals

**Headers**: `Authorization: Bearer <access_token>`

**Query Parameters**:

- `active` (boolean): Filter active goals only
- `category` (string): Filter by category

**Response** (200 OK):

```json
{
  "goals": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "title": "Go to gym 3x weekly",
      "description": "Maintain consistent gym routine",
      "category": "fitness",
      "frequency": "weekly",
      "target_days": 3,
      "reminder_times": ["09:00", "18:00"],
      "is_active": true,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### POST /api/v1/goals

**Description**: Create new goal

**Headers**: `Authorization: Bearer <access_token>`

**Request Body**:

```json
{
  "title": "Go to gym 3x weekly",
  "description": "Maintain consistent gym routine",
  "category": "fitness",
  "frequency": "weekly",
  "target_days": 3,
  "reminder_times": ["09:00", "18:00"]
}
```

**Response** (201 Created):

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "Go to gym 3x weekly",
  "description": "Maintain consistent gym routine",
  "category": "fitness",
  "frequency": "weekly",
  "target_days": 3,
  "reminder_times": ["09:00", "18:00"],
  "is_active": true,
  "created_at": "2024-01-15T10:30:00Z"
}
```

### PUT /api/v1/goals/:id

**Description**: Update goal

**Headers**: `Authorization: Bearer <access_token>`

**Request Body**:

```json
{
  "title": "Updated goal title",
  "reminder_times": ["08:00", "19:00"]
}
```

**Response** (200 OK):

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "Updated goal title",
  "description": "Maintain consistent gym routine",
  "category": "fitness",
  "frequency": "weekly",
  "target_days": 3,
  "reminder_times": ["08:00", "19:00"],
  "is_active": true,
  "updated_at": "2024-01-15T11:00:00Z"
}
```

### DELETE /api/v1/goals/:id

**Description**: Delete goal

**Headers**: `Authorization: Bearer <access_token>`

**Response** (200 OK):

```json
{
  "message": "Goal deleted successfully"
}
```

---

## ✅ Check-ins Endpoints

### GET /api/v1/goals/:id/check-ins

**Description**: Get check-ins for a goal

**Headers**: `Authorization: Bearer <access_token>`

**Query Parameters**:

- `start_date` (string): Start date (YYYY-MM-DD)
- `end_date` (string): End date (YYYY-MM-DD)

**Response** (200 OK):

```json
{
  "check_ins": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "date": "2024-01-15",
      "completed": true,
      "reflection": "Great workout today!",
      "mood": 5,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### POST /api/v1/goals/:id/check-ins

**Description**: Create check-in

**Headers**: `Authorization: Bearer <access_token>`

**Request Body**:

```json
{
  "date": "2024-01-15",
  "completed": true,
  "reflection": "Great workout today!",
  "mood": 5
}
```

**Response** (201 Created):

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "date": "2024-01-15",
  "completed": true,
  "reflection": "Great workout today!",
  "mood": 5,
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

## 🤖 AI Motivation Endpoints

### GET /api/v1/motivations

**Description**: Get AI motivation messages

**Headers**: `Authorization: Bearer <access_token>`

**Query Parameters**:

- `goal_id` (string): Filter by goal ID
- `limit` (integer): Number of messages (default: 10)

**Response** (200 OK):

```json
{
  "motivations": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "message": "You're doing amazing! Keep up the great work! 💪",
      "message_type": "ai",
      "is_sent": true,
      "sent_at": "2024-01-15T09:00:00Z",
      "created_at": "2024-01-15T08:30:00Z"
    }
  ]
}
```

### POST /api/v1/motivations/generate

**Description**: Generate new AI motivation message

**Headers**: `Authorization: Bearer <access_token>`

**Request Body**:

```json
{
  "goal_id": "123e4567-e89b-12d3-a456-426614174000",
  "context": "User completed workout yesterday"
}
```

**Response** (201 Created):

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "message": "Amazing progress! You're building unstoppable momentum! 🚀",
  "message_type": "ai",
  "is_sent": false,
  "scheduled_for": "2024-01-15T18:00:00Z",
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

## 🌐 Social Feed Endpoints

### GET /api/v1/feed

**Description**: Get combined AI + community feed

**Headers**: `Authorization: Bearer <access_token>`

**Query Parameters**:

- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 20)
- `type` (string): Filter by type (ai, community, all)
- `category` (string): Filter by category

**Response** (200 OK):

```json
{
  "feed": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "type": "ai",
      "content": "You're doing amazing! Keep up the great work! 💪",
      "created_at": "2024-01-15T09:00:00Z"
    },
    {
      "id": "123e4567-e89b-12d3-a456-426614174001",
      "type": "post",
      "user": {
        "id": "123e4567-e89b-12d3-a456-426614174002",
        "username": "fitnessfan",
        "profile_picture_url": "https://..."
      },
      "content": "Just finished an amazing workout! 💪",
      "media_url": null,
      "media_type": "text",
      "likes_count": 5,
      "comments_count": 2,
      "user_liked": false,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "has_next": true
  }
}
```

### POST /api/v1/posts

**Description**: Create new post

**Headers**: `Authorization: Bearer <access_token>`

**Request Body**:

```json
{
  "content": "Just finished an amazing workout! 💪",
  "media_url": null,
  "media_type": "text",
  "is_public": true
}
```

**Response** (201 Created):

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "content": "Just finished an amazing workout! 💪",
  "media_url": null,
  "media_type": "text",
  "is_public": true,
  "likes_count": 0,
  "comments_count": 0,
  "created_at": "2024-01-15T10:30:00Z"
}
```

### POST /api/v1/posts/:id/like

**Description**: Like/unlike a post

**Headers**: `Authorization: Bearer <access_token>`

**Request Body**:

```json
{
  "reaction_type": "like"
}
```

**Response** (200 OK):

```json
{
  "liked": true,
  "likes_count": 6
}
```

### POST /api/v1/posts/:id/comments

**Description**: Add comment to post

**Headers**: `Authorization: Bearer <access_token>`

**Request Body**:

```json
{
  "content": "Great job! Keep it up! 🔥"
}
```

**Response** (201 Created):

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "content": "Great job! Keep it up! 🔥",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174001",
    "username": "motivator",
    "profile_picture_url": "https://..."
  },
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

## 👥 User & Following Endpoints

### GET /api/v1/users/:id

**Description**: Get user profile

**Headers**: `Authorization: Bearer <access_token>`

**Response** (200 OK):

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "username": "fitnessfan",
  "name": "John Doe",
  "profile_picture_url": "https://...",
  "bio": "Fitness enthusiast",
  "followers_count": 150,
  "following_count": 75,
  "posts_count": 25,
  "is_following": false,
  "created_at": "2024-01-01T00:00:00Z"
}
```

### POST /api/v1/users/:id/follow

**Description**: Follow/unfollow user

**Headers**: `Authorization: Bearer <access_token>`

**Response** (200 OK):

```json
{
  "following": true,
  "followers_count": 151
}
```

### GET /api/v1/users/search

**Description**: Search users

**Headers**: `Authorization: Bearer <access_token>`

**Query Parameters**:

- `q` (string): Search query
- `limit` (integer): Number of results (default: 20)

**Response** (200 OK):

```json
{
  "users": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "username": "fitnessfan",
      "name": "John Doe",
      "profile_picture_url": "https://...",
      "followers_count": 150,
      "is_following": false
    }
  ]
}
```

---

## 💳 Subscription & IAP Endpoints

### GET /api/v1/subscriptions/plans

**Description**: Get available subscription plans

**Response** (200 OK):

```json
{
  "plans": [
    {
      "id": "free",
      "name": "Free",
      "price": 0,
      "currency": "USD",
      "interval": null,
      "features": ["Basic motivation", "1 goal", "Community access"],
      "platform_products": {
        "ios": null,
        "android": null
      }
    },
    {
      "id": "pro",
      "name": "Pro",
      "price": 9.99,
      "currency": "USD",
      "interval": "month",
      "features": ["Unlimited goals", "Voice posts", "Advanced analytics"],
      "platform_products": {
        "ios": "com.fitnudge.pro.monthly",
        "android": "pro_monthly"
      }
    }
  ]
}
```

### GET /api/v1/subscriptions/me

**Description**: Get current user subscription

**Headers**: `Authorization: Bearer <access_token>`

**Response** (200 OK):

```json
{
  "plan": "pro",
  "status": "active",
  "platform": "ios",
  "product_id": "com.fitnudge.pro.monthly",
  "purchase_date": "2024-01-01T00:00:00Z",
  "expires_date": "2024-02-01T00:00:00Z",
  "auto_renew": true
}
```

### POST /api/v1/iap/apple/verify-receipt

**Description**: Verify Apple receipt after purchase

**Headers**: `Authorization: Bearer <access_token>`

**Request Body**:

```json
{
  "receipt_data": "base64_encoded_receipt",
  "product_id": "com.fitnudge.pro.monthly"
}
```

**Response** (200 OK):

```json
{
  "valid": true,
  "subscription": {
    "plan": "pro",
    "status": "active",
    "expires_date": "2024-02-01T00:00:00Z"
  }
}
```

### POST /api/v1/iap/google/verify-purchase

**Description**: Verify Google Play purchase

**Headers**: `Authorization: Bearer <access_token>`

**Request Body**:

```json
{
  "purchase_token": "purchase_token_here",
  "product_id": "pro_monthly"
}
```

**Response** (200 OK):

```json
{
  "valid": true,
  "subscription": {
    "plan": "pro",
    "status": "active",
    "expires_date": "2024-02-01T00:00:00Z"
  }
}
```

---

## 📝 Blog Endpoints

### GET /api/v1/blog/posts

**Description**: Get published blog posts

**Query Parameters**:

- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 10)
- `category` (string): Filter by category
- `tag` (string): Filter by tag

**Response** (200 OK):

```json
{
  "posts": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "title": "How AI is Revolutionizing Fitness Motivation",
      "slug": "ai-revolutionizing-fitness-motivation",
      "excerpt": "Discover how artificial intelligence is transforming...",
      "featured_image_url": "https://...",
      "author": {
        "name": "FitNudge Team",
        "profile_picture_url": "https://..."
      },
      "categories": ["AI Motivation"],
      "tags": ["AI", "Fitness", "Technology"],
      "published_at": "2024-01-15T10:00:00Z",
      "read_time": "5 min"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "has_next": true
  }
}
```

### GET /api/v1/blog/posts/:slug

**Description**: Get single blog post

**Response** (200 OK):

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "How AI is Revolutionizing Fitness Motivation",
  "slug": "ai-revolutionizing-fitness-motivation",
  "content": "<p>Full blog post content...</p>",
  "excerpt": "Discover how artificial intelligence is transforming...",
  "featured_image_url": "https://...",
  "author": {
    "name": "FitNudge Team",
    "profile_picture_url": "https://..."
  },
  "categories": ["AI Motivation"],
  "tags": ["AI", "Fitness", "Technology"],
  "published_at": "2024-01-15T10:00:00Z",
  "read_time": "5 min",
  "views_count": 1250
}
```

---

## 🔧 Error Response Format

### Standard Error Response

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect",
    "details": {
      "field": "password",
      "suggestion": "Please check your password and try again"
    }
  }
}
```

### Common Error Codes

- `INVALID_CREDENTIALS`: Authentication failed
- `UNAUTHORIZED`: Token expired or invalid
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Request validation failed
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `SUBSCRIPTION_REQUIRED`: Premium feature access denied
- `OAUTH_ERROR`: OAuth authentication failed

### HTTP Status Codes

- `200 OK`: Success
- `201 Created`: Resource created
- `400 Bad Request`: Invalid request
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Access denied
- `404 Not Found`: Resource not found
- `422 Unprocessable Entity`: Validation error
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

---

## 🔗 Webhook Payloads

### Apple App Store Server Notifications

```json
{
  "notificationType": "SUBSCRIBED",
  "subtype": "INITIAL_BUY",
  "notificationUUID": "123e4567-e89b-12d3-a456-426614174000",
  "data": {
    "appAppleId": 123456789,
    "bundleId": "com.fitnudge.app",
    "bundleVersion": "1.0.0",
    "environment": "Sandbox",
    "signedTransactionInfo": "signed_transaction_info_here",
    "signedRenewalInfo": "signed_renewal_info_here"
  }
}
```

### Google Play Developer Notifications

```json
{
  "version": "1.0",
  "packageName": "com.fitnudge.app",
  "eventTimeMillis": "1642252800000",
  "subscriptionNotification": {
    "version": "1.0",
    "notificationType": 4,
    "purchaseToken": "purchase_token_here",
    "subscriptionId": "pro_monthly"
  }
}
```

---

## 📊 Rate Limiting

### Limits

- **Authentication**: 5 requests per minute
- **General API**: 100 requests per minute
- **File Upload**: 10 requests per minute
- **Social Actions**: 50 requests per minute

### Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642252800
```

---

## 🔒 Security Headers

### Required Headers

```
Content-Type: application/json
Authorization: Bearer <token>
X-Request-ID: unique-request-id
```

### Response Headers

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

---

## 📱 Mobile-Specific Considerations

### Offline Support

- Cache user data locally
- Queue API requests when offline
- Sync when connection restored
- Handle network errors gracefully

### Push Notifications

- FCM token registration
- Notification preferences
- Deep linking support
- Background sync

### Media Upload

- Chunked upload for large files
- Progress tracking
- Retry mechanism
- Compression optimization
