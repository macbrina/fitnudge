# 🗄️ Database Schema & Data Models

---

## 📊 Database Overview

**Database**: PostgreSQL via Supabase  
**Primary Keys**: UUID (universally unique identifiers)  
**Relationships**: Cascade delete for data integrity  
**Realtime**: Enabled for partners, nudges, and notifications  
**Row Level Security**: Enabled on all tables

---

## 🏗️ Core Tables

### 👤 Users & Authentication

**users**

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    username TEXT UNIQUE,
    profile_picture_url TEXT,
    bio TEXT,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
    timezone TEXT DEFAULT 'UTC',
    language TEXT DEFAULT 'en',
    motivation_style TEXT DEFAULT 'supportive' CHECK (motivation_style IN ('supportive', 'tough_love', 'balanced', 'analytical')),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    expo_push_token TEXT,
    morning_motivation_enabled BOOLEAN DEFAULT true,
    morning_motivation_time TIME DEFAULT '08:00',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 🎯 Goals & Check-ins

**goals**

```sql
CREATE TABLE goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    emoji TEXT DEFAULT '🎯',
    category TEXT CHECK (category IN ('fitness', 'wellness', 'learning', 'productivity', 'mindfulness', 'health', 'other')),
    frequency_type TEXT NOT NULL DEFAULT 'daily' CHECK (frequency_type IN ('daily', 'weekly')),
    target_days_per_week INTEGER DEFAULT 7 CHECK (target_days_per_week BETWEEN 1 AND 7),
    reminder_times JSONB DEFAULT '["09:00"]',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    total_completions INTEGER DEFAULT 0,
    streak_start_date DATE,
    last_checkin_date DATE,
    last_completed_date DATE,
    week_completions INTEGER DEFAULT 0,
    week_start_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**check_ins**

```sql
CREATE TABLE check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    check_in_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped', 'missed', 'rest_day')),
    mood TEXT CHECK (mood IN ('great', 'good', 'okay', 'tired', 'stressed')),
    skip_reason TEXT CHECK (skip_reason IN ('work', 'tired', 'sick', 'schedule', 'other')),
    note TEXT,
    voice_note_url TEXT,
    voice_note_duration INTEGER,
    ai_response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, goal_id, check_in_date)
);

-- V2: status is the single source of truth
-- pending: Pre-created, awaiting user response
-- completed: User checked in (Yes)
-- skipped: User explicitly skipped (No + optional skip_reason)
-- missed: Day passed without response (set by Celery task)
-- rest_day: User marked as rest day
```

### 🤖 AI & Motivation

**daily_motivations**

```sql
CREATE TABLE daily_motivations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    motivation_date DATE NOT NULL,
    is_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, motivation_date)
);
```

**ai_coach_sessions**

```sql
CREATE TABLE ai_coach_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
    title TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**ai_coach_messages**

```sql
CREATE TABLE ai_coach_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES ai_coach_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 👥 Accountability Partners

**accountability_partners**

```sql
CREATE TABLE accountability_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'declined', 'blocked')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(requester_id, recipient_id)
);
```

**nudges**

```sql
CREATE TABLE nudges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nudge_type TEXT NOT NULL CHECK (nudge_type IN ('cheer', 'nudge', 'celebrate')),
    message TEXT,
    goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
    check_in_id UUID REFERENCES check_ins(id) ON DELETE SET NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 🔔 Notifications

**notification_history**

```sql
CREATE TABLE notification_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    entity_type TEXT,
    entity_id UUID,
    is_read BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);
```

**notification_preferences**

```sql
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT true,
    reminder_enabled BOOLEAN DEFAULT true,
    motivation_enabled BOOLEAN DEFAULT true,
    partner_enabled BOOLEAN DEFAULT true,
    achievement_enabled BOOLEAN DEFAULT true,
    weekly_recap BOOLEAN DEFAULT true,
    quiet_hours_enabled BOOLEAN DEFAULT false,
    quiet_hours_start TIME DEFAULT '22:00',
    quiet_hours_end TIME DEFAULT '07:00',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 🏆 Achievements

**achievements**

```sql
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_type TEXT NOT NULL,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    notified BOOLEAN DEFAULT false,
    UNIQUE(user_id, achievement_type)
);
```

**achievement_definitions**

```sql
CREATE TABLE achievement_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    points INTEGER DEFAULT 10,
    category TEXT CHECK (category IN ('streak', 'completion', 'social', 'milestone')),
    requirement_value INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 📊 Analytics & Insights

**weekly_recaps**

```sql
CREATE TABLE weekly_recaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    total_goals INTEGER DEFAULT 0,
    completed_checkins INTEGER DEFAULT 0,
    total_checkins INTEGER DEFAULT 0,
    completion_rate NUMERIC(5,2) DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    insights JSONB,
    ai_summary TEXT,
    is_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, week_start)
);
```

**pattern_insights**

```sql
CREATE TABLE pattern_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    insight_type TEXT NOT NULL,
    insight_data JSONB NOT NULL,
    confidence NUMERIC(3,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);
```

### 📝 Blog

**blog_posts**

```sql
CREATE TABLE blog_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL,
    cover_image_url TEXT,
    author_name TEXT DEFAULT 'FitNudge Team',
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    published_at TIMESTAMPTZ,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**blog_categories**

```sql
CREATE TABLE blog_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 💳 Subscriptions

**subscriptions**

```sql
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    revenuecat_customer_id TEXT,
    plan_id TEXT DEFAULT 'free',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'grace_period')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    auto_renew BOOLEAN DEFAULT true,
    platform TEXT CHECK (platform IN ('ios', 'android', 'web')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**user_reports**

```sql
CREATE TABLE user_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (reason IN ('inappropriate_username', 'harassment', 'spam', 'other')),
    details TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 📊 Materialized Views (Analytics)

**mv_user_daily_stats** - Pre-aggregated daily stats per user for analytics dashboard

**mv_goal_stats** - Pre-aggregated goal completion rates

---

## 🔗 Key Relationships

```
users
  ├── goals (1:many)
  │     └── check_ins (1:many)
  ├── daily_motivations (1:many)
  ├── ai_coach_sessions (1:many)
  │     └── ai_coach_messages (1:many)
  ├── accountability_partners (many:many via join)
  ├── nudges (sender/recipient)
  ├── notification_history (1:many)
  ├── notification_preferences (1:1)
  ├── achievements (1:many)
  ├── weekly_recaps (1:many)
  ├── pattern_insights (1:many)
  └── subscriptions (1:1)
```

---

## 🔒 Row Level Security

All tables have RLS enabled with policies ensuring:
- Users can only read/write their own data
- Partners can see limited data of connected users
- Admins have full access via service role
