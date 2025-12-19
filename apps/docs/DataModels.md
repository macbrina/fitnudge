# 🗄️ Database Schema & Data Models

---

## 📊 Database Overview

**Database**: PostgreSQL via Supabase  
**Primary Keys**: UUID (universally unique identifiers)  
**Relationships**: Cascade delete for data integrity  
**Realtime**: Enabled for social features (posts, likes, comments)  
**Indexing**: Comprehensive strategy for performance optimization

---

## 🏗️ Core Tables

### 👤 Users & Authentication

**users**

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT, -- NULL for OAuth users
    name TEXT NOT NULL,
    username TEXT UNIQUE,
    profile_picture_url TEXT,
    bio TEXT,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'elite')),
    timezone TEXT DEFAULT 'UTC',
    language TEXT DEFAULT 'en',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    auth_provider TEXT DEFAULT 'email' CHECK (auth_provider IN ('email', 'apple', 'google')),
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**oauth_accounts**

```sql
CREATE TABLE oauth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('apple', 'google')),
    provider_user_id TEXT NOT NULL, -- Apple/Google user ID
    provider_email TEXT,
    provider_name TEXT,
    provider_picture TEXT,
    access_token TEXT, -- encrypted
    refresh_token TEXT, -- encrypted
    token_expires_at TIMESTAMP,
    raw_user_data JSONB, -- store full OAuth response
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(provider, provider_user_id)
);
```

### 🎯 Goals & Progress

**goals**

```sql
CREATE TABLE goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK (category IN ('fitness', 'nutrition', 'wellness', 'custom')),
    frequency TEXT NOT NULL, -- 'daily', 'weekly', 'custom'
    target_days INTEGER, -- for weekly goals
    reminder_times TEXT[], -- array of times like ['09:00', '18:00']
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**check_ins**

```sql
CREATE TABLE check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    completed BOOLEAN NOT NULL,
    reflection TEXT,
    mood INTEGER CHECK (mood >= 1 AND mood <= 5), -- 1-5 scale
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(goal_id, date)
);
```

**motivations**

```sql
CREATE TABLE motivations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    message_type TEXT DEFAULT 'ai' CHECK (message_type IN ('ai', 'community', 'system')),
    is_sent BOOLEAN DEFAULT false,
    scheduled_for TIMESTAMP,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 🌐 Social Features

**posts**

```sql
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    media_url TEXT, -- for voice posts
    media_type TEXT CHECK (media_type IN ('text', 'voice', 'image')),
    is_public BOOLEAN DEFAULT true,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**comments**

```sql
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**likes**

```sql
CREATE TABLE likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type TEXT DEFAULT 'like' CHECK (reaction_type IN ('like', 'cheer', 'love')),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);
```

**follows**

```sql
CREATE TABLE follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(follower_id, following_id),
    CHECK(follower_id != following_id)
);
```

**feed_preferences**

```sql
CREATE TABLE feed_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    show_ai_posts BOOLEAN DEFAULT true,
    show_community_posts BOOLEAN DEFAULT true,
    show_following_only BOOLEAN DEFAULT false,
    categories TEXT[], -- array of categories to show
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### 💳 Subscriptions & Payments

**subscriptions**

```sql
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL CHECK (plan IN ('free', 'pro', 'elite')),
    status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
    product_id TEXT NOT NULL, -- Apple/Google product ID
    original_transaction_id TEXT, -- Apple/Google transaction ID
    purchase_date TIMESTAMP NOT NULL,
    expires_date TIMESTAMP,
    auto_renew BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**iap_receipts**

```sql
CREATE TABLE iap_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
    transaction_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    receipt_data TEXT NOT NULL, -- encrypted receipt
    purchase_date TIMESTAMP NOT NULL,
    expires_date TIMESTAMP,
    is_sandbox BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**offer_codes**

```sql
CREATE TABLE offer_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    offer_type TEXT NOT NULL CHECK (offer_type IN ('introductory', 'promotional', 'win_back')),
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
    product_id TEXT NOT NULL,
    discount_percentage INTEGER, -- for percentage discounts
    discount_amount DECIMAL(10,2), -- for fixed amount discounts
    duration_days INTEGER, -- for time-limited offers
    max_uses INTEGER,
    used_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    valid_from TIMESTAMP,
    valid_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 👨‍💼 Admin & Management

**admin_users**

```sql
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'moderator', 'support')),
    permissions JSONB, -- specific permissions
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**audit_logs**

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID REFERENCES admin_users(id),
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 📱 Media & Files

**media_uploads**

```sql
CREATE TABLE media_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    cloudflare_r2_key TEXT NOT NULL,
    cloudflare_r2_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    duration INTEGER, -- for audio/video files
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 📝 Blog & Content

**blog_posts**

```sql
CREATE TABLE blog_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL, -- rich text content
    excerpt TEXT,
    featured_image_url TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    author_id UUID NOT NULL REFERENCES users(id),
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**blog_categories**

```sql
CREATE TABLE blog_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**blog_post_categories**

```sql
CREATE TABLE blog_post_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES blog_categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(post_id, category_id)
);
```

**blog_tags**

```sql
CREATE TABLE blog_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**blog_post_tags**

```sql
CREATE TABLE blog_post_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES blog_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(post_id, tag_id)
);
```

### 🔒 Privacy & Compliance

**user_consents**

```sql
CREATE TABLE user_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type TEXT NOT NULL CHECK (consent_type IN ('marketing', 'analytics', 'data_processing')),
    granted BOOLEAN NOT NULL,
    granted_at TIMESTAMP,
    revoked_at TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 🎯 Goal Templates

**goal_templates**

```sql
CREATE TABLE goal_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,  -- Changed from 'name' to match goals table
    description TEXT,
    category goal_category NOT NULL,  -- Use enum instead of TEXT
    frequency goal_frequency NOT NULL,  -- Use enum instead of TEXT
    target_days INTEGER,
    reminder_times TEXT[],
    is_ai_generated BOOLEAN DEFAULT false,  -- Track AI vs manual templates
    match_reason TEXT,  -- For AI suggestion reasoning
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 🔍 Indexes

### Performance Indexes

```sql
-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_auth_provider ON users(auth_provider);
CREATE INDEX idx_users_plan ON users(plan);

-- OAuth
CREATE INDEX idx_oauth_accounts_user_id ON oauth_accounts(user_id);
CREATE INDEX idx_oauth_accounts_provider_user_id ON oauth_accounts(provider, provider_user_id);

-- Goals & Progress
CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_goals_category ON goals(category);
CREATE INDEX idx_check_ins_goal_id ON check_ins(goal_id);
CREATE INDEX idx_check_ins_date ON check_ins(date);
CREATE INDEX idx_check_ins_user_id ON check_ins(user_id);

-- Social Features
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_media_type ON posts(media_type);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_likes_post_id ON likes(post_id);
CREATE INDEX idx_likes_user_id ON likes(user_id);
CREATE INDEX idx_follows_follower_id ON follows(follower_id);
CREATE INDEX idx_follows_following_id ON follows(following_id);

-- Subscriptions
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_platform ON subscriptions(platform);
CREATE INDEX idx_iap_receipts_user_id ON iap_receipts(user_id);
CREATE INDEX idx_iap_receipts_transaction_id ON iap_receipts(transaction_id);

-- Blog
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_published_at ON blog_posts(published_at DESC);
```

---

## 🔐 Row Level Security (RLS)

### Users Table

```sql
-- Users can read their own data
CREATE POLICY "Users can read own data" ON users
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (auth.uid() = id);
```

### OAuth Accounts

```sql
-- Users can read their own OAuth accounts
CREATE POLICY "Users can read own oauth accounts" ON oauth_accounts
    FOR SELECT USING (auth.uid() = user_id);
```

### Posts

```sql
-- All users can read public posts
CREATE POLICY "Anyone can read public posts" ON posts
    FOR SELECT USING (is_public = true);

-- Users can create their own posts
CREATE POLICY "Users can create posts" ON posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own posts
CREATE POLICY "Users can update own posts" ON posts
    FOR UPDATE USING (auth.uid() = user_id);
```

### Admin Tables

```sql
-- Only admins can access admin tables
CREATE POLICY "Only admins can access admin_users" ON admin_users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admin_users au
            WHERE au.user_id = auth.uid()
            AND au.role = 'admin'
            AND au.is_active = true
        )
    );
```

---

## 📊 Sample Data

### Test Users

```sql
-- Test user with email/password
INSERT INTO users (email, password_hash, name, username, auth_provider)
VALUES ('test@fitnudge.app', '$2b$12$...', 'Test User', 'testuser', 'email');

-- Test user with Apple Sign In
INSERT INTO users (email, name, username, auth_provider)
VALUES ('user@privaterelay.appleid.com', 'Apple User', 'appleuser', 'apple');

INSERT INTO oauth_accounts (user_id, provider, provider_user_id, provider_email, provider_name)
VALUES (
    (SELECT id FROM users WHERE email = 'user@privaterelay.appleid.com'),
    'apple',
    '000123.abc456def789',
    'user@privaterelay.appleid.com',
    'Apple User'
);
```

### Goal Templates

```sql
INSERT INTO goal_templates (title, description, category, frequency, target_days, reminder_times, is_ai_generated, match_reason) VALUES
('Gym 3x Weekly', 'Go to the gym 3 times per week', 'fitness', 'weekly', 3, ARRAY['09:00', '18:00'], false, 'Perfect for beginners starting their fitness journey'),
('Daily Workout', 'Exercise every day', 'fitness', 'daily', 7, ARRAY['07:00'], false, 'Great for building consistent habits'),
('Morning Run', 'Run every morning', 'fitness', 'daily', 7, ARRAY['06:00'], false, 'Outdoor activity to start your day'),
('Strength Building', 'Build muscle and strength through progressive training', 'fitness', 'weekly', 4, ARRAY['18:00'], false, 'Focused on muscle building');
```

### Blog Categories

```sql
INSERT INTO blog_categories (name, slug, description) VALUES
('Success Stories', 'success-stories', 'Real user transformation stories'),
('AI Motivation', 'ai-motivation', 'How AI helps with fitness motivation'),
('Fitness Tips', 'fitness-tips', 'Expert fitness advice and tips'),
('Industry News', 'industry-news', 'Latest fitness industry updates');
```

---

## 🔄 Realtime Configuration

### ⚡ Critical: Realtime-Enabled Tables

**All implementations using these tables MUST use Supabase Realtime for instant updates.**

#### 🔒 **PHASE 1: Security & User Management**

- ✅ **`users`** - Force logout on ban/suspend/disable (CRITICAL)

#### 🎯 **PHASE 2: Core Features**

- ✅ **`check_ins`** - Instant updates when Celery creates/completes check-ins
- ✅ **`goals`** - Multi-device goal sync, CRUD operations
- ✅ **`actionable_plans`** - Real-time AI plan generation status (generating → completed)
- ✅ **`daily_motivations`** - Instant motivation regeneration updates

#### 🔔 **PHASE 3: Notifications & Motivation**

- ✅ **`motivations`** - Scheduled push notification status tracking
- ✅ **`notification_history`** - Delivery tracking, analytics

#### 🍎 **PHASE 4: Meal Tracking**

- ✅ **`meal_logs`** - Real-time meal logging, multi-device sync
- ✅ **`daily_nutrition_summaries`** - Auto-updated nutrition totals

#### 🏆 **PHASE 5: Gamification & Social**

- ✅ **`achievement_types`** - New badges added by admins
- ✅ **`user_achievements`** - Instant badge unlock notifications
- ✅ **`accountability_partners`** - Partner request status changes
- ✅ **`challenges`** - Live challenge updates
- ✅ **`challenge_participants`** - Join/leave updates
- ✅ **`challenge_leaderboard`** - Live competitive rankings

#### 🌐 **Already Enabled: Social Features**

- ✅ **`posts`** - Real-time feed updates
- ✅ **`comments`** - Live comment threads
- ✅ **`likes`** - Instant reaction updates
- ✅ **`follows`** - Follow/unfollow notifications

---

### 📋 Implementation Requirements

**When implementing features using Realtime-enabled tables:**

1. **Subscribe to table changes** using Supabase Realtime client
2. **Auto-invalidate React Query cache** on INSERT/UPDATE/DELETE events
3. **Handle connection/reconnection** gracefully with exponential backoff
4. **Force logout** on `users` table status changes (disabled/suspended)
5. **Use optimistic updates** for better UX during network delays
6. **Clean up subscriptions** on component unmount to prevent memory leaks

**Example Implementation:**

```typescript
// Mobile: apps/mobile/src/services/realtime/realtimeService.ts
// Subscribe to check_ins table for instant updates
supabase
  .channel("check_ins_changes")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "check_ins" },
    (payload) => {
      // Invalidate React Query cache for check-ins
      queryClient.invalidateQueries({ queryKey: ["check-ins"] });
    }
  )
  .subscribe();
```

---

### Enable Realtime via Migration

```sql
-- See: apps/api/supabase/migrations/20251203000000_enable_realtime_for_core_tables.sql
-- Uses conditional enablement to avoid errors if already enabled

SELECT add_table_to_realtime_if_not_exists('users');
SELECT add_table_to_realtime_if_not_exists('check_ins');
SELECT add_table_to_realtime_if_not_exists('goals');
-- ... (18 tables total)
```

### Realtime Filters

```sql
-- Only send realtime updates for public posts
ALTER TABLE posts REPLICA IDENTITY FULL;
```

---

## 📈 Analytics Views

### User Engagement Summary

```sql
CREATE VIEW user_engagement_summary AS
SELECT
    u.id,
    u.username,
    u.plan,
    COUNT(DISTINCT g.id) as total_goals,
    COUNT(DISTINCT ci.id) as total_check_ins,
    COUNT(DISTINCT p.id) as total_posts,
    COUNT(DISTINCT f.follower_id) as followers_count,
    COUNT(DISTINCT f2.following_id) as following_count,
    AVG(ci.mood) as avg_mood
FROM users u
LEFT JOIN goals g ON u.id = g.user_id
LEFT JOIN check_ins ci ON g.id = ci.goal_id
LEFT JOIN posts p ON u.id = p.user_id
LEFT JOIN follows f ON u.id = f.following_id
LEFT JOIN follows f2 ON u.id = f2.follower_id
GROUP BY u.id, u.username, u.plan;
```

### Subscription Analytics

```sql
CREATE VIEW subscription_analytics AS
SELECT
    plan,
    status,
    platform,
    COUNT(*) as user_count,
    AVG(EXTRACT(EPOCH FROM (expires_date - purchase_date))/86400) as avg_duration_days
FROM subscriptions
GROUP BY plan, status, platform;
```

---

## 🚀 Migration Strategy

### Initial Migration

1. Create all tables with proper constraints
2. Set up indexes for performance
3. Configure RLS policies
4. Enable realtime for social features
5. Create analytics views
6. Insert sample data for development

### Future Migrations

- Use Alembic for version-controlled migrations
- Test migrations on staging environment
- Backup database before major changes
- Use blue-green deployment for zero downtime

---

## 🔧 Maintenance

### Regular Tasks

- Monitor slow queries and optimize indexes
- Clean up old audit logs (retention policy)
- Archive old posts and media files
- Update statistics for query optimization
- Monitor RLS policy performance

### Backup Strategy

- Daily automated backups
- Point-in-time recovery capability
- Cross-region backup replication
- Test restore procedures monthly
