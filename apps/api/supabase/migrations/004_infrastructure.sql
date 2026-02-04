-- =====================================================
-- FitNudge V2 - Infrastructure
-- Auth, subscriptions, notifications, blog, system health
-- =====================================================

-- =====================================================
-- DEVICE TOKENS (Push Notifications)
-- =====================================================
CREATE TABLE device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token TEXT NOT NULL, -- Expo push token (named fcm_token for V1 compatibility)
  device_type TEXT NOT NULL CHECK (device_type IN ('ios', 'android')),
  device_id TEXT NOT NULL, -- Unique device identifier
  timezone TEXT NOT NULL DEFAULT 'UTC',
  app_version TEXT NOT NULL,
  os_version TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fcm_token)
);

CREATE INDEX idx_device_tokens_user ON device_tokens(user_id);
CREATE INDEX idx_device_tokens_token ON device_tokens(fcm_token);
CREATE INDEX idx_device_tokens_active ON device_tokens(is_active) WHERE is_active = true;

-- =====================================================
-- NOTIFICATION HISTORY
-- Stores all push notifications sent to users
-- entity_type/entity_id used by cleanup_orphaned_notifications task
-- =====================================================
CREATE TABLE notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- V2 notification types (matches NOTIFICATION_TYPE_TO_PREFERENCE in expo_push_service.py)
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    -- Core types
    'ai_motivation',        -- AI-generated motivation at reminder times
    'reminder',             -- Check-in prompts ("How did it go?")
    'reengagement',         -- Re-engagement for inactive users
    'achievement',          -- Badge/milestone achievements
    'subscription',         -- Subscription-related notifications
    'general',              -- Default fallback type
    
    -- Partner notifications (V2 social)
    'social',               -- General social notification
    'partner_request',      -- Someone sent a partner request
    'partner_accepted',     -- Partner request was accepted
    'partner_nudge',        -- Partner sent a nudge
    'partner_cheer',        -- Partner sent a cheer
    'partner_milestone',    -- Partner hit a milestone
    'partner_inactive',     -- Partner has been inactive
    
    -- Achievement variants
    'streak_milestone',     -- Streak milestone reached
    'goal_complete',        -- Goal completed
    
    -- Adaptive nudging (premium)
    'adaptive_nudge',       -- Smart proactive notifications based on patterns
    
    -- Other
    'weekly_recap'          -- Weekly AI recaps
  )),
  
  -- Content
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  
  -- Entity reference (for cleanup_orphaned_notifications task)
  -- When entity is deleted, notification remains but entity_id becomes orphaned
  entity_type TEXT, -- 'goal', 'achievement', 'partner_request', 'social_nudge', 'checkin', 'weekly_recap'
  entity_id UUID,   -- ID of referenced entity (no FK - handle orphans at app level)
  
  -- Status
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  response TEXT, -- For check-ins: 'yes', 'no', 'rest'
  failed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_history_user ON notification_history(user_id);
CREATE INDEX idx_notification_history_type ON notification_history(notification_type);
CREATE INDEX idx_notification_history_sent ON notification_history(user_id, sent_at DESC);
CREATE INDEX idx_notification_history_entity ON notification_history(entity_type, entity_id) WHERE entity_type IS NOT NULL;

COMMENT ON COLUMN notification_history.entity_type IS 'Type of entity: goal, achievement, partner_request, social_nudge, checkin, weekly_recap';
COMMENT ON COLUMN notification_history.entity_id IS 'ID of the referenced entity. No FK constraint - handle deleted entities at application level via cleanup_orphaned_notifications task.';

-- =====================================================
-- NOTIFICATION PREFERENCES
-- =====================================================
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  
  -- Global toggle
  enabled BOOLEAN DEFAULT true,
  
  -- Notification channels
  push_notifications BOOLEAN DEFAULT true,  -- Push notifications enabled
  email_notifications BOOLEAN DEFAULT true, -- Email notifications enabled
  
  -- Individual notification types
  ai_motivation BOOLEAN DEFAULT true,      -- Daily motivation messages
  reminders BOOLEAN DEFAULT true,          -- Check-in reminders
  social BOOLEAN DEFAULT true,             -- Partner activity, cheers, nudges
  achievements BOOLEAN DEFAULT true,       -- Streak milestones, badges
  weekly_recaps BOOLEAN DEFAULT true,      -- Weekly AI recaps
  reengagement BOOLEAN DEFAULT true,       -- Re-engagement notifications for inactive users
  
  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '08:00',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_preferences_user ON notification_preferences(user_id);

-- =====================================================
-- SUBSCRIPTIONS (RevenueCat)
-- =====================================================
CREATE TABLE subscription_plans (
  id TEXT PRIMARY KEY, -- 'free', 'premium'
  name TEXT NOT NULL,
  description TEXT,
  monthly_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  annual_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  active_goal_limit INTEGER DEFAULT 1,
  tier INTEGER DEFAULT 0, -- 0=free, 1=premium
  is_popular BOOLEAN DEFAULT false,
  has_trial BOOLEAN DEFAULT false,
  trial_days INTEGER,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  
  -- RevenueCat Product IDs
  product_id_ios_monthly TEXT,
  product_id_ios_annual TEXT,
  product_id_android_monthly TEXT,
  product_id_android_annual TEXT,
  
  -- Exit offer (discount when user tries to cancel)
  exit_offer_enabled BOOLEAN DEFAULT false,
  exit_offer_monthly_price DECIMAL(10,2),
  exit_offer_annual_price DECIMAL(10,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free' REFERENCES subscription_plans(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'trial', 'grace_period', 'billing_issue')),
  platform TEXT CHECK (platform IN ('ios', 'android', 'web', 'admin_granted', 'promo')), -- Platform: ios/android/web (IAP), admin_granted, promo (referral)
  product_id TEXT, -- RevenueCat product identifier
  original_transaction_id TEXT, -- Apple/Google transaction ID
  purchase_date TIMESTAMPTZ, -- When the subscription was originally purchased
  expires_date TIMESTAMPTZ, -- When the current period ends
  auto_renew BOOLEAN DEFAULT true, -- Whether subscription will auto-renew
  provider TEXT DEFAULT 'revenuecat',
  provider_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancel_reason TEXT,
  grace_period_ends_at TIMESTAMPTZ, -- End date of grace period during billing issues
  revenuecat_event_id TEXT, -- The ID of the last RevenueCat webhook event processed
  environment TEXT CHECK (environment IN ('SANDBOX', 'PRODUCTION')), -- SANDBOX or PRODUCTION
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT subscriptions_plan_check CHECK (plan IN ('free', 'premium'))
);

CREATE INDEX idx_subscriptions_grace_period ON subscriptions(grace_period_ends_at) WHERE grace_period_ends_at IS NOT NULL;

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

COMMENT ON COLUMN subscriptions.purchase_date IS 
'When the subscription was originally purchased. Used for tracking first subscription date.';
COMMENT ON COLUMN subscriptions.expires_date IS 
'When the current subscription period ends.';
COMMENT ON COLUMN subscriptions.grace_period_ends_at IS 
'End date of grace period during billing issues. User retains access until this date. Apple: 16 days, Google: configurable 3-30 days.';
COMMENT ON COLUMN subscriptions.revenuecat_event_id IS 
'The ID of the last RevenueCat webhook event processed for this subscription.';
COMMENT ON COLUMN subscriptions.environment IS 
'Whether this subscription is from SANDBOX (testing) or PRODUCTION.';

-- =====================================================
-- SUBSCRIPTION DEACTIVATION LOGS (Audit Trail)
-- =====================================================
CREATE TABLE subscription_deactivation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  previous_plan TEXT NOT NULL,
  new_plan TEXT NOT NULL DEFAULT 'free',
  goals_deactivated INTEGER DEFAULT 0,
  deactivation_reason TEXT NOT NULL CHECK (deactivation_reason IN ('subscription_expired', 'subscription_expired_cleanup', 'billing_issue', 'manual', 'transfer')),
  deactivated_goal_ids JSONB, -- Array of goal IDs that were deactivated
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscription_deactivation_logs_user_id ON subscription_deactivation_logs(user_id);
CREATE INDEX idx_subscription_deactivation_logs_created_at ON subscription_deactivation_logs(created_at DESC);

COMMENT ON TABLE subscription_deactivation_logs IS 
'Tracks all subscription-related deactivations for auditing and support.
When a subscription expires, this logs:
- How many goals were deactivated
- Which goal IDs were deactivated';

-- =====================================================
-- PLAN FEATURES (Feature Gating)
-- =====================================================
CREATE TABLE plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id TEXT NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE, -- 'free' or 'premium'
  feature_key TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  feature_description TEXT,
  feature_value INTEGER, -- NULL = unlimited, number = limit
  is_enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  ai_description TEXT, -- For AI context when generating responses
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, feature_key)
);

CREATE INDEX idx_plan_features_plan ON plan_features(plan_id);
CREATE INDEX idx_plan_features_key ON plan_features(feature_key);

-- =====================================================
-- AUTHENTICATION
-- =====================================================
CREATE TABLE refresh_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_family VARCHAR(32) NOT NULL,
  token_id VARCHAR(32) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_used_at TIMESTAMP WITH TIME ZONE,
  device_name VARCHAR(100), -- Human-readable device name (e.g., iPhone 14 Pro, Chrome on Windows)
  device_id VARCHAR(100), -- Unique device identifier from client
  device_type VARCHAR(20), -- 'ios', 'android', 'web'
  ip_address INET, -- IP address when session was created
  user_agent TEXT, -- User agent string from client
  location VARCHAR(100), -- Optional: city/country from IP
  UNIQUE(token_family, token_id)
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(token_family);
CREATE INDEX idx_refresh_tokens_active ON refresh_tokens(is_active) WHERE is_active = true;
CREATE INDEX idx_refresh_tokens_user_active ON refresh_tokens(user_id, is_active) WHERE is_active = true;

CREATE TABLE oauth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('apple', 'google')),
  provider_user_id TEXT NOT NULL, -- Apple/Google user ID
  provider_email TEXT,
  provider_name TEXT,
  provider_picture TEXT,
  access_token TEXT, -- Encrypted
  refresh_token TEXT, -- Encrypted
  token_expires_at TIMESTAMPTZ,
  raw_user_data JSONB, -- Store full OAuth response
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, provider_user_id)
);

CREATE INDEX idx_oauth_accounts_user ON oauth_accounts(user_id);
CREATE INDEX idx_oauth_accounts_provider ON oauth_accounts(provider, provider_user_id);

CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(token)
);

CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token) WHERE used = false;
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id) WHERE used = false;
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

COMMENT ON TABLE password_reset_tokens IS 'Stores password reset tokens for users';
COMMENT ON COLUMN password_reset_tokens.token IS 'Unique token for password reset';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Token expiration timestamp';
COMMENT ON COLUMN password_reset_tokens.used IS 'Whether the token has been used';

-- Create email_verification_codes table for storing 6-digit verification codes
CREATE TABLE email_verification_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT false,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT max_attempts CHECK (attempts <= 5)
);

-- Create indexes for efficient lookups
CREATE INDEX idx_email_verification_codes_user_id ON email_verification_codes(user_id);
CREATE INDEX idx_email_verification_codes_code ON email_verification_codes(code);
CREATE INDEX idx_email_verification_codes_expires_at ON email_verification_codes(expires_at);

-- Create index for unverified codes (expiration check done in queries, not in index)
CREATE INDEX idx_email_verification_codes_unverified ON email_verification_codes(user_id, expires_at)
WHERE verified = false;

-- Function to cleanup expired codes (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM email_verification_codes
  WHERE expires_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON TABLE email_verification_codes IS 'Stores 6-digit email verification codes with 24-hour expiration';
COMMENT ON COLUMN email_verification_codes.code IS '6-digit verification code';
COMMENT ON COLUMN email_verification_codes.expires_at IS 'Code expiration time (24 hours from creation)';
COMMENT ON COLUMN email_verification_codes.verified IS 'Whether this code has been successfully verified';
COMMENT ON COLUMN email_verification_codes.attempts IS 'Number of verification attempts (max 5)';

-- =====================================================
-- COMPLIANCE (GDPR)
-- =====================================================
CREATE TABLE data_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  download_url TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_data_export_requests_user_id ON data_export_requests(user_id);
CREATE INDEX idx_data_export_requests_status ON data_export_requests(status);
CREATE INDEX idx_data_export_requests_created_at ON data_export_requests(created_at);

COMMENT ON TABLE data_export_requests IS 'Tracks user data export requests for GDPR compliance';
COMMENT ON COLUMN data_export_requests.status IS 'Current status of the export: pending, processing, completed, or failed';
COMMENT ON COLUMN data_export_requests.download_url IS 'URL to download the export (if stored in cloud storage)';
COMMENT ON COLUMN data_export_requests.expires_at IS 'When the download URL expires';

-- =====================================================
-- AUDIT
-- =====================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES users(id), -- References admin user (if admin action)
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_admin_user ON audit_logs(admin_user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

CREATE TABLE api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_id VARCHAR(32) NOT NULL UNIQUE,
  key_hash VARCHAR(64) NOT NULL,
  app_name VARCHAR(50) NOT NULL DEFAULT 'mobile',
  permissions TEXT[] NOT NULL DEFAULT ARRAY['read', 'write'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_id ON api_keys(key_id);
CREATE INDEX idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

-- =====================================================
-- OPERATIONS & MONITORING
-- =====================================================
CREATE TABLE app_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')) UNIQUE,
  latest_version TEXT NOT NULL, -- e.g., '1.2.0'
  minimum_version TEXT NOT NULL, -- Users below this MUST update
  release_notes TEXT, -- Optional release notes to show users
  store_url TEXT, -- Optional custom store URL (uses default if not set)
  force_update BOOLEAN DEFAULT false, -- If true, users must update regardless of version
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_app_versions_platform ON app_versions(platform);

COMMENT ON TABLE app_versions IS 'Stores current and minimum required app versions for each platform. Managed by admin.';
COMMENT ON COLUMN app_versions.latest_version IS 'The latest available version in the app store';
COMMENT ON COLUMN app_versions.minimum_version IS 'Minimum version required - users below this must update';
COMMENT ON COLUMN app_versions.force_update IS 'If true, forces update regardless of version comparison';

-- =====================================================
-- WEBHOOK EVENTS (Idempotency & Retry)
-- =====================================================
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,  -- RevenueCat event ID (idempotency key)
  event_type TEXT NOT NULL,       -- INITIAL_PURCHASE, RENEWAL, etc.
  user_id TEXT,                   -- App user ID
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  payload JSONB,                  -- Full webhook payload for debugging
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX idx_webhook_events_user_id ON webhook_events(user_id);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at DESC);

-- Index for finding failed events that need retry
CREATE INDEX idx_webhook_events_failed_retry 
ON webhook_events(status, retry_count, created_at) 
WHERE status = 'failed' AND retry_count < 5;

CREATE TRIGGER update_webhook_events_updated_at
  BEFORE UPDATE ON webhook_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- BLOG (for website)
-- =====================================================
CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL, -- rich text content
  excerpt TEXT,
  featured_image_url TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  author_id UUID NOT NULL REFERENCES users(id),
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE blog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE blog_post_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES blog_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, category_id)
);

CREATE TABLE blog_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE blog_post_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES blog_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, tag_id)
);

CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_published ON blog_posts(published_at DESC) WHERE status = 'published';
CREATE INDEX idx_blog_posts_is_featured ON blog_posts(is_featured) WHERE is_featured = true;

-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_device_tokens_updated_at
  BEFORE UPDATE ON device_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plan_features_updated_at
  BEFORE UPDATE ON plan_features
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- When a post is set to is_featured=true, unset all other featured posts (only one featured at a time)
CREATE OR REPLACE FUNCTION unset_other_featured_posts()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_featured = true AND (TG_OP = 'INSERT' OR OLD.is_featured IS DISTINCT FROM NEW.is_featured) THEN
    UPDATE blog_posts
    SET is_featured = false
    WHERE id != NEW.id AND is_featured = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_unset_other_featured
  BEFORE INSERT OR UPDATE ON blog_posts
  FOR EACH ROW
  WHEN (NEW.is_featured = true)
  EXECUTE FUNCTION unset_other_featured_posts();

CREATE TRIGGER update_oauth_accounts_updated_at
  BEFORE UPDATE ON oauth_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_app_versions_updated_at
  BEFORE UPDATE ON app_versions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ANALYTICS MATERIALIZED VIEWS (V2)
-- For performance: fast pre-computed analytics
-- =====================================================

-- Drop if exists (for re-running migrations)
DROP MATERIALIZED VIEW IF EXISTS user_engagement_summary;
DROP MATERIALIZED VIEW IF EXISTS subscription_analytics;

-- =====================================================
-- USER ENGAGEMENT SUMMARY (Materialized)
-- V2: Uses goals, check_ins, accountability_partners
-- =====================================================
CREATE MATERIALIZED VIEW user_engagement_summary AS
SELECT
    u.id,
    u.username,
    u.name,
    u.plan,
    u.email,
    u.created_at as user_created_at,
    COUNT(DISTINCT g.id) as total_goals,
    COUNT(DISTINCT CASE WHEN g.status = 'active' THEN g.id END) as active_goals,
    COUNT(DISTINCT ci.id) as total_check_ins,
    COUNT(DISTINCT CASE WHEN ci.completed THEN ci.id END) as completed_check_ins,
    COUNT(DISTINCT ap.id) as partner_count,
    MAX(g.current_streak) as best_streak,
    MAX(ci.check_in_date) as last_check_in_date,
    MAX(u.last_login_at) as last_login,
    NOW() as refreshed_at
FROM users u
LEFT JOIN goals g ON u.id = g.user_id
LEFT JOIN check_ins ci ON g.id = ci.goal_id
LEFT JOIN accountability_partners ap ON (u.id = ap.user_id OR u.id = ap.partner_user_id) AND ap.status = 'accepted'
GROUP BY u.id, u.username, u.name, u.plan, u.email, u.created_at;

-- =====================================================
-- SUBSCRIPTION ANALYTICS (Materialized)
-- =====================================================
CREATE MATERIALIZED VIEW subscription_analytics AS
SELECT
    plan,
    status,
    platform,
    COUNT(*) as subscription_count,
    COUNT(DISTINCT user_id) as unique_users,
    AVG(EXTRACT(EPOCH FROM (expires_date - purchase_date))/86400) as avg_duration_days,
    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
    SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_count,
    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
    MIN(purchase_date) as first_purchase,
    MAX(purchase_date) as last_purchase,
    NOW() as refreshed_at
FROM subscriptions
GROUP BY plan, status, platform;

-- =====================================================
-- INDEXES FOR FAST QUERIES
-- =====================================================

-- User engagement indexes
CREATE UNIQUE INDEX idx_user_engagement_id ON user_engagement_summary(id);
CREATE INDEX idx_user_engagement_plan ON user_engagement_summary(plan);
CREATE INDEX idx_user_engagement_active_goals ON user_engagement_summary(active_goals DESC);
CREATE INDEX idx_user_engagement_last_login ON user_engagement_summary(last_login DESC NULLS LAST);
CREATE INDEX idx_user_engagement_total_checkins ON user_engagement_summary(total_check_ins DESC);

-- Subscription analytics indexes
CREATE INDEX idx_subscription_analytics_plan_status ON subscription_analytics(plan, status);
CREATE INDEX idx_subscription_analytics_platform ON subscription_analytics(platform);

-- =====================================================
-- REFRESH FUNCTION (Called by Celery hourly)
-- =====================================================
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    -- CONCURRENTLY allows queries to continue during refresh
    -- Requires unique index (which we have on user_engagement_summary.id)
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_engagement_summary;
    REFRESH MATERIALIZED VIEW subscription_analytics;
    
    RAISE NOTICE 'Analytics views refreshed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INITIAL REFRESH
-- =====================================================
REFRESH MATERIALIZED VIEW user_engagement_summary;
REFRESH MATERIALIZED VIEW subscription_analytics;

-- =====================================================
-- ACCESS CONTROL
-- =====================================================

-- Revoke public access
REVOKE ALL ON user_engagement_summary FROM PUBLIC;
REVOKE ALL ON subscription_analytics FROM PUBLIC;

-- Grant to authenticated users for reading their own data
GRANT SELECT ON user_engagement_summary TO authenticated;

-- Subscription analytics: service role only (admin)
GRANT SELECT ON subscription_analytics TO service_role;

-- =====================================================
-- DOCUMENTATION
-- =====================================================
COMMENT ON MATERIALIZED VIEW user_engagement_summary IS 
'Pre-computed user engagement metrics for analytics dashboards. 
Refreshed hourly via Celery task (refresh_analytics_views_task).
V2: Uses goals, check_ins, accountability_partners.';

COMMENT ON MATERIALIZED VIEW subscription_analytics IS 
'Pre-computed subscription metrics for business analytics. 
Refreshed hourly via Celery task. Admin/service role only.';

COMMENT ON FUNCTION refresh_analytics_views() IS 
'Refreshes all analytics materialized views. 
Called by Celery task hourly. Uses CONCURRENTLY to avoid locking.';

