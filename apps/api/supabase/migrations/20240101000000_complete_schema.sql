-- =====================================================
-- FitNudge Complete Database Schema Migration
-- Based on DataModels.md, Architecture.md, ProjectOverview.md
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. CUSTOM TYPES
-- =====================================================

-- Create custom types
CREATE TYPE auth_provider_type AS ENUM ('email', 'apple', 'google');
CREATE TYPE goal_frequency AS ENUM ('daily', 'weekly', 'monthly', 'custom');
CREATE TYPE goal_category AS ENUM ('fitness', 'nutrition', 'wellness', 'mindfulness', 'sleep', 'custom');
CREATE TYPE post_media_type AS ENUM ('text', 'image', 'voice', 'video');
CREATE TYPE reaction_type AS ENUM ('like', 'cheer', 'love', 'fire');
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'expired', 'past_due', 'pending');
CREATE TYPE subscription_platform AS ENUM ('ios', 'android');
CREATE TYPE admin_role AS ENUM ('admin', 'moderator', 'support');
CREATE TYPE consent_type AS ENUM ('marketing', 'analytics', 'data_processing');
CREATE TYPE offer_type AS ENUM ('introductory', 'promotional', 'win_back');
CREATE TYPE message_type AS ENUM ('ai', 'community', 'system');

-- =====================================================
-- 2. CORE TABLES (in dependency order)
-- =====================================================

-- Users table (base table for all relationships)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT, -- NULL for OAuth users
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    profile_picture_url TEXT,
    bio TEXT,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'coach_plus')),
    timezone TEXT DEFAULT 'UTC',
    language TEXT DEFAULT 'en',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    auth_provider auth_provider_type DEFAULT 'email',
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- OAuth accounts table
CREATE TABLE oauth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider auth_provider_type NOT NULL,
    provider_user_id TEXT NOT NULL, -- Apple/Google user ID
    provider_email TEXT,
    provider_name TEXT,
    provider_picture TEXT,
    access_token TEXT, -- encrypted
    refresh_token TEXT, -- encrypted
    token_expires_at TIMESTAMP WITH TIME ZONE,
    raw_user_data JSONB, -- store full OAuth response
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(provider, provider_user_id)
);

-- Goals table
CREATE TABLE goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category goal_category NOT NULL,
    frequency goal_frequency NOT NULL,
    target_days INTEGER, -- for weekly goals
    reminder_times TEXT[], -- array of times like ['09:00', '18:00']
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Check-ins table
CREATE TABLE check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    completed BOOLEAN NOT NULL,
    reflection TEXT,
    mood INTEGER CHECK (mood >= 1 AND mood <= 5), -- 1-5 scale
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(goal_id, date)
);

-- Motivations table (renamed from ai_motivations)
CREATE TABLE motivations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    message_type message_type DEFAULT 'ai',
    is_sent BOOLEAN DEFAULT false,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Posts table for social feed
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    media_url TEXT, -- for voice posts
    media_type post_media_type DEFAULT 'text',
    is_public BOOLEAN DEFAULT true,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comments table
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Likes table (renamed from post_reactions)
CREATE TABLE likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type reaction_type DEFAULT 'like',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- Follows table (renamed from user_follows)
CREATE TABLE follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, following_id),
    CHECK(follower_id != following_id)
);

-- Feed preferences table
CREATE TABLE feed_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    show_ai_posts BOOLEAN DEFAULT true,
    show_community_posts BOOLEAN DEFAULT true,
    show_following_only BOOLEAN DEFAULT false,
    categories TEXT[], -- array of categories to show
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. SUBSCRIPTION & PAYMENT TABLES
-- =====================================================

-- Subscriptions table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL CHECK (plan IN ('free', 'starter', 'pro', 'coach_plus')),
    status subscription_status NOT NULL,
    platform subscription_platform NOT NULL,
    product_id TEXT NOT NULL, -- Apple/Google product ID
    original_transaction_id TEXT, -- Apple/Google transaction ID
    purchase_date TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_date TIMESTAMP WITH TIME ZONE,
    auto_renew BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- IAP receipts table
CREATE TABLE iap_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
    platform subscription_platform NOT NULL,
    transaction_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    receipt_data TEXT NOT NULL, -- encrypted receipt
    purchase_date TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_date TIMESTAMP WITH TIME ZONE,
    is_sandbox BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Offer codes table
CREATE TABLE offer_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    offer_type offer_type NOT NULL,
    platform subscription_platform NOT NULL,
    product_id TEXT NOT NULL,
    discount_percentage INTEGER, -- for percentage discounts
    discount_amount DECIMAL(10,2), -- for fixed amount discounts
    duration_days INTEGER, -- for time-limited offers
    max_uses INTEGER,
    used_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    valid_from TIMESTAMP WITH TIME ZONE,
    valid_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. ADMIN & MANAGEMENT TABLES
-- =====================================================

-- Admin users table
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role admin_role NOT NULL,
    permissions JSONB, -- specific permissions
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit logs table
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. MEDIA & FILES TABLES
-- =====================================================

-- Media uploads table
CREATE TABLE media_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    cloudflare_r2_key TEXT NOT NULL,
    cloudflare_r2_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    duration INTEGER, -- for audio/video files
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. BLOG & CONTENT TABLES
-- =====================================================

-- Blog posts table
CREATE TABLE blog_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL, -- rich text content
    excerpt TEXT,
    featured_image_url TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    author_id UUID NOT NULL REFERENCES users(id),
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blog categories table
CREATE TABLE blog_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blog post categories junction table
CREATE TABLE blog_post_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES blog_categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, category_id)
);

-- Blog tags table
CREATE TABLE blog_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blog post tags junction table
CREATE TABLE blog_post_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES blog_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, tag_id)
);

-- =====================================================
-- 7. PRIVACY & COMPLIANCE TABLES
-- =====================================================

-- User consents table
CREATE TABLE user_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type consent_type NOT NULL,
    granted BOOLEAN NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 8. GOAL TEMPLATES TABLE
-- =====================================================

-- Goal templates table
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

-- =====================================================
-- 9. INDEXES FOR PERFORMANCE
-- =====================================================

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_auth_provider ON users(auth_provider);
CREATE INDEX idx_users_plan ON users(plan);

-- OAuth indexes
CREATE INDEX idx_oauth_accounts_user_id ON oauth_accounts(user_id);
CREATE INDEX idx_oauth_accounts_provider_user_id ON oauth_accounts(provider, provider_user_id);

-- Goals & Progress indexes
CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_goals_category ON goals(category);
CREATE INDEX idx_check_ins_goal_id ON check_ins(goal_id);
CREATE INDEX idx_check_ins_date ON check_ins(date);
CREATE INDEX idx_check_ins_user_id ON check_ins(user_id);

-- Social Features indexes
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_media_type ON posts(media_type);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_likes_post_id ON likes(post_id);
CREATE INDEX idx_likes_user_id ON likes(user_id);
CREATE INDEX idx_follows_follower_id ON follows(follower_id);
CREATE INDEX idx_follows_following_id ON follows(following_id);

-- Subscriptions indexes
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_platform ON subscriptions(platform);
CREATE INDEX idx_iap_receipts_user_id ON iap_receipts(user_id);
CREATE INDEX idx_iap_receipts_transaction_id ON iap_receipts(transaction_id);

-- Blog indexes
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_published_at ON blog_posts(published_at DESC);

-- =====================================================
-- 10. TRIGGERS AND FUNCTIONS
-- =====================================================

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_blog_posts_updated_at BEFORE UPDATE ON blog_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_feed_preferences_updated_at BEFORE UPDATE ON feed_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to update post reaction counts
CREATE OR REPLACE FUNCTION update_post_reaction_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE posts SET likes_count = (
            SELECT COUNT(*) FROM likes 
            WHERE post_id = NEW.post_id AND reaction_type = 'like'
        ) WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE posts SET likes_count = (
            SELECT COUNT(*) FROM likes 
            WHERE post_id = OLD.post_id AND reaction_type = 'like'
        ) WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Create trigger for post reaction counts
CREATE TRIGGER update_post_reaction_counts_trigger
    AFTER INSERT OR DELETE ON likes
    FOR EACH ROW EXECUTE FUNCTION update_post_reaction_counts();

-- Create function to update comment counts
CREATE OR REPLACE FUNCTION update_post_comment_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Create trigger for comment counts
CREATE TRIGGER update_post_comment_counts_trigger
    AFTER INSERT OR DELETE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_post_comment_counts();

-- =====================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE motivations ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE iap_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can read own data" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view public profiles" ON users
    FOR SELECT USING (true);

-- OAuth accounts policies
CREATE POLICY "Users can read own oauth accounts" ON oauth_accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own oauth accounts" ON oauth_accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own oauth accounts" ON oauth_accounts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own oauth accounts" ON oauth_accounts
    FOR DELETE USING (auth.uid() = user_id);

-- Goals policies
CREATE POLICY "Users can view own goals" ON goals
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals" ON goals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals" ON goals
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals" ON goals
    FOR DELETE USING (auth.uid() = user_id);

-- Check-ins policies
CREATE POLICY "Users can view own check-ins" ON check_ins
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own check-ins" ON check_ins
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own check-ins" ON check_ins
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own check-ins" ON check_ins
    FOR DELETE USING (auth.uid() = user_id);

-- Motivations policies
CREATE POLICY "Users can view own motivations" ON motivations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own motivations" ON motivations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own motivations" ON motivations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own motivations" ON motivations
    FOR DELETE USING (auth.uid() = user_id);

-- Posts policies
CREATE POLICY "Anyone can read public posts" ON posts
    FOR SELECT USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Users can create posts" ON posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts" ON posts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts" ON posts
    FOR DELETE USING (auth.uid() = user_id);

-- Comments policies
CREATE POLICY "Anyone can read comments" ON comments
    FOR SELECT USING (true);

CREATE POLICY "Users can create comments" ON comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments" ON comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON comments
    FOR DELETE USING (auth.uid() = user_id);

-- Likes policies
CREATE POLICY "Anyone can read likes" ON likes
    FOR SELECT USING (true);

CREATE POLICY "Users can create likes" ON likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes" ON likes
    FOR DELETE USING (auth.uid() = user_id);

-- Follows policies
CREATE POLICY "Anyone can read follows" ON follows
    FOR SELECT USING (true);

CREATE POLICY "Users can create follows" ON follows
    FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can delete own follows" ON follows
    FOR DELETE USING (auth.uid() = follower_id);

-- Feed preferences policies
CREATE POLICY "Users can manage own feed preferences" ON feed_preferences
    FOR ALL USING (auth.uid() = user_id);

-- Subscriptions policies
CREATE POLICY "Users can view own subscriptions" ON subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create subscriptions" ON subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions" ON subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

-- IAP receipts policies
CREATE POLICY "Users can view own receipts" ON iap_receipts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create receipts" ON iap_receipts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admin policies
CREATE POLICY "Only admins can access admin_users" ON admin_users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admin_users au
            WHERE au.user_id = auth.uid()
            AND au.role = 'admin'
            AND au.is_active = true
        )
    );

CREATE POLICY "Only admins can access audit_logs" ON audit_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admin_users au
            WHERE au.user_id = auth.uid()
            AND au.role = 'admin'
            AND au.is_active = true
        )
    );

-- Media uploads policies
CREATE POLICY "Users can manage own media" ON media_uploads
    FOR ALL USING (auth.uid() = user_id);

-- User consents policies
CREATE POLICY "Users can manage own consents" ON user_consents
    FOR ALL USING (auth.uid() = user_id);

-- Blog posts policies (public read access)
CREATE POLICY "Anyone can view published blog posts" ON blog_posts
    FOR SELECT USING (status = 'published');

-- =====================================================
-- 12. REALTIME CONFIGURATION
-- =====================================================

-- Enable realtime for social features (must be last)
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE likes;
ALTER PUBLICATION supabase_realtime ADD TABLE follows;

-- =====================================================
-- 13. ANALYTICS VIEWS
-- =====================================================

-- User engagement summary view
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

-- Subscription analytics view
CREATE VIEW subscription_analytics AS
SELECT
    plan,
    status,
    platform,
    COUNT(*) as user_count,
    AVG(EXTRACT(EPOCH FROM (expires_date - purchase_date))/86400) as avg_duration_days
FROM subscriptions
GROUP BY plan, status, platform;

-- =====================================================
-- 14. SAMPLE DATA
-- =====================================================

-- Goal templates
INSERT INTO goal_templates (title, description, category, frequency, target_days, reminder_times, is_ai_generated, match_reason) VALUES
('Gym 3x Weekly', 'Go to the gym 3 times per week', 'fitness', 'weekly', 3, ARRAY['09:00', '18:00'], false, 'Perfect for beginners starting their fitness journey'),
('Daily Workout', 'Exercise every day', 'fitness', 'daily', 7, ARRAY['07:00'], false, 'Great for building consistent habits'),
('Morning Run', 'Run every morning', 'fitness', 'daily', 7, ARRAY['06:00'], false, 'Outdoor activity to start your day'),
('Weight Loss Journey', 'Lose weight through consistent exercise and healthy habits', 'fitness', 'daily', 7, ARRAY['08:00', '20:00'], false, 'Designed for weight loss goals'),
('Strength Building', 'Build muscle and strength through progressive training', 'fitness', 'weekly', 4, ARRAY['18:00'], false, 'Focused on muscle building'),
('Home Workout', 'Exercise at home with bodyweight exercises', 'fitness', 'daily', 7, ARRAY['19:00'], false, 'Can be done at home'),
('Nutrition Tracking', 'Track your daily nutrition and eating habits', 'nutrition', 'daily', 7, ARRAY['08:00', '20:00'], false, 'Focus on healthy eating'),
('Meditation Practice', 'Daily mindfulness and meditation', 'mindfulness', 'daily', 7, ARRAY['07:00'], false, 'Mental wellness and stress relief'),
('Sleep Optimization', 'Improve your sleep quality and duration', 'sleep', 'daily', 7, ARRAY['22:00'], false, 'Better sleep for better health'),
('Premium Coaching', 'Personalized coaching program', 'wellness', 'daily', 7, ARRAY['08:00', '20:00'], false, 'Advanced program for serious fitness enthusiasts')
ON CONFLICT DO NOTHING;

-- Blog categories
INSERT INTO blog_categories (name, slug, description) VALUES
('Success Stories', 'success-stories', 'Real user transformation stories'),
('AI Motivation', 'ai-motivation', 'How AI helps with fitness motivation'),
('Fitness Tips', 'fitness-tips', 'Expert fitness advice and tips'),
('Industry News', 'industry-news', 'Latest fitness industry updates')
ON CONFLICT DO NOTHING;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
