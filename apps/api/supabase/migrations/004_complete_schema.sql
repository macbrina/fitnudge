-- Complete schema migration to match DataModels.md
-- This migration adds all missing tables and indexes

-- Add missing columns to existing tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
ALTER TABLE users ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Rename ai_motivations to motivations to match DataModels.md
ALTER TABLE ai_motivations RENAME TO motivations;

-- Add missing columns to motivations table
ALTER TABLE motivations ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'ai' CHECK (message_type IN ('ai', 'community', 'system'));

-- Rename post_reactions to likes to match DataModels.md
ALTER TABLE post_reactions RENAME TO likes;

-- Rename user_follows to follows to match DataModels.md
ALTER TABLE user_follows RENAME TO follows;

-- Add missing columns to subscriptions table
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS original_transaction_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT true;

-- Create feed_preferences table
CREATE TABLE IF NOT EXISTS feed_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    show_ai_posts BOOLEAN DEFAULT true,
    show_community_posts BOOLEAN DEFAULT true,
    show_following_only BOOLEAN DEFAULT false,
    categories TEXT[], -- array of categories to show
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create iap_receipts table
CREATE TABLE IF NOT EXISTS iap_receipts (
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

-- Create offer_codes table
CREATE TABLE IF NOT EXISTS offer_codes (
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

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'moderator', 'support')),
    permissions JSONB, -- specific permissions
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
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

-- Create media_uploads table
CREATE TABLE IF NOT EXISTS media_uploads (
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

-- Create blog_categories table
CREATE TABLE IF NOT EXISTS blog_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create blog_post_categories table
CREATE TABLE IF NOT EXISTS blog_post_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES blog_categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(post_id, category_id)
);

-- Create blog_tags table
CREATE TABLE IF NOT EXISTS blog_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create blog_post_tags table
CREATE TABLE IF NOT EXISTS blog_post_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES blog_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(post_id, tag_id)
);

-- Create user_consents table
CREATE TABLE IF NOT EXISTS user_consents (
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

-- Create goal_templates table
CREATE TABLE IF NOT EXISTS goal_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    frequency TEXT NOT NULL,
    target_days INTEGER,
    reminder_times TEXT[],
    is_premium BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Update blog_posts table to match DataModels.md
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived'));
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES users(id);
ALTER TABLE blog_posts DROP COLUMN IF EXISTS author_name;
ALTER TABLE blog_posts DROP COLUMN IF EXISTS author_profile_picture_url;
ALTER TABLE blog_posts DROP COLUMN IF EXISTS categories;
ALTER TABLE blog_posts DROP COLUMN IF EXISTS tags;
ALTER TABLE blog_posts DROP COLUMN IF EXISTS is_published;
ALTER TABLE blog_posts DROP COLUMN IF EXISTS views_count;
ALTER TABLE blog_posts DROP COLUMN IF EXISTS read_time;

-- Create all missing indexes from DataModels.md
CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider_user_id ON oauth_accounts(provider, provider_user_id);
CREATE INDEX IF NOT EXISTS idx_goals_category ON goals(category);
CREATE INDEX IF NOT EXISTS idx_check_ins_user_id ON check_ins(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_media_type ON posts(media_type);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_platform ON subscriptions(platform);
CREATE INDEX IF NOT EXISTS idx_iap_receipts_user_id ON iap_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_iap_receipts_transaction_id ON iap_receipts(transaction_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at DESC);

-- Create analytics views
CREATE OR REPLACE VIEW user_engagement_summary AS
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

CREATE OR REPLACE VIEW subscription_analytics AS
SELECT
    plan,
    status,
    platform,
    COUNT(*) as user_count,
    AVG(EXTRACT(EPOCH FROM (expires_date - purchase_date))/86400) as avg_duration_days
FROM subscriptions
GROUP BY plan, status, platform;

-- Insert sample data
INSERT INTO goal_templates (name, description, category, frequency, target_days, reminder_times, is_premium) VALUES
('Gym 3x Weekly', 'Go to the gym 3 times per week', 'fitness', 'weekly', 3, ARRAY['09:00', '18:00'], false),
('Daily Workout', 'Exercise every day', 'fitness', 'daily', 7, ARRAY['07:00'], false),
('Morning Run', 'Run every morning', 'fitness', 'daily', 7, ARRAY['06:00'], false),
('Premium Coaching', 'Personalized coaching program', 'wellness', 'daily', 7, ARRAY['08:00', '20:00'], true)
ON CONFLICT DO NOTHING;

INSERT INTO blog_categories (name, slug, description) VALUES
('Success Stories', 'success-stories', 'Real user transformation stories'),
('AI Motivation', 'ai-motivation', 'How AI helps with fitness motivation'),
('Fitness Tips', 'fitness-tips', 'Expert fitness advice and tips'),
('Industry News', 'industry-news', 'Latest fitness industry updates')
ON CONFLICT DO NOTHING;
