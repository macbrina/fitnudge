-- =====================================================
-- FitNudge V2 - Row Level Security Policies
-- =====================================================

-- Enable RLS on all user-facing tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checkin_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE accountability_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_nudges ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coach_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coach_daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_recaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_motivations ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_deactivation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_export_requests ENABLE ROW LEVEL SECURITY;

-- Blog posts are public for reading
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTION: Get user ID from auth
-- =====================================================
-- Since public.users.id = auth.users.id, we can return auth.uid() directly
CREATE OR REPLACE FUNCTION get_user_id_from_auth()
RETURNS UUID AS $$
  SELECT auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================
-- USERS POLICIES
-- =====================================================
CREATE POLICY users_select_own ON users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY users_update_own ON users
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY users_insert_own ON users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY users_delete_own ON users
  FOR DELETE TO authenticated
  USING (id = auth.uid());

-- =====================================================
-- GOALS POLICIES
-- =====================================================
CREATE POLICY goals_select_own ON goals
  FOR SELECT TO authenticated
  USING (user_id = get_user_id_from_auth());

CREATE POLICY goals_insert_own ON goals
  FOR INSERT TO authenticated
  WITH CHECK (user_id = get_user_id_from_auth());

CREATE POLICY goals_update_own ON goals
  FOR UPDATE TO authenticated
  USING (user_id = get_user_id_from_auth());

CREATE POLICY goals_delete_own ON goals
  FOR DELETE TO authenticated
  USING (user_id = get_user_id_from_auth());

-- =====================================================
-- CHECK-INS POLICIES
-- =====================================================
CREATE POLICY check_ins_select_own ON check_ins
  FOR SELECT TO authenticated
  USING (user_id = get_user_id_from_auth());

CREATE POLICY check_ins_insert_own ON check_ins
  FOR INSERT TO authenticated
  WITH CHECK (user_id = get_user_id_from_auth());

CREATE POLICY check_ins_update_own ON check_ins
  FOR UPDATE TO authenticated
  USING (user_id = get_user_id_from_auth());

-- =====================================================
-- DAILY CHECKIN SUMMARIES POLICIES
-- =====================================================
CREATE POLICY checkin_summaries_select_own ON daily_checkin_summaries
  FOR SELECT TO authenticated
  USING (user_id = get_user_id_from_auth());

-- =====================================================
-- ACCOUNTABILITY PARTNERS POLICIES
-- =====================================================
CREATE POLICY partners_select_involved ON accountability_partners
  FOR SELECT TO authenticated
  USING (
    user_id = get_user_id_from_auth() 
    OR partner_user_id = get_user_id_from_auth()
  );

CREATE POLICY partners_insert_own ON accountability_partners
  FOR INSERT TO authenticated
  WITH CHECK (user_id = get_user_id_from_auth());

CREATE POLICY partners_update_involved ON accountability_partners
  FOR UPDATE TO authenticated
  USING (
    user_id = get_user_id_from_auth() 
    OR partner_user_id = get_user_id_from_auth()
  );

CREATE POLICY partners_delete_involved ON accountability_partners
  FOR DELETE TO authenticated
  USING (
    user_id = get_user_id_from_auth() 
    OR partner_user_id = get_user_id_from_auth()
  );

-- =====================================================
-- SOCIAL NUDGES POLICIES
-- =====================================================
CREATE POLICY nudges_select_involved ON social_nudges
  FOR SELECT TO authenticated
  USING (
    sender_id = get_user_id_from_auth() 
    OR recipient_id = get_user_id_from_auth()
  );

CREATE POLICY nudges_insert_own ON social_nudges
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = get_user_id_from_auth());

CREATE POLICY nudges_update_recipient ON social_nudges
  FOR UPDATE TO authenticated
  USING (recipient_id = get_user_id_from_auth());

-- =====================================================
-- ACHIEVEMENTS POLICIES
-- =====================================================
-- Achievement types are public read (anyone can see available badges)
CREATE POLICY achievement_types_public_read ON achievement_types
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- Users can only see their own unlocked achievements
CREATE POLICY user_achievements_select_own ON user_achievements
  FOR SELECT TO authenticated
  USING (user_id = get_user_id_from_auth());

-- =====================================================
-- AI COACH POLICIES
-- =====================================================
CREATE POLICY ai_conversations_select_own ON ai_coach_conversations
  FOR SELECT TO authenticated
  USING (user_id = get_user_id_from_auth());

CREATE POLICY ai_conversations_insert_own ON ai_coach_conversations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = get_user_id_from_auth());

CREATE POLICY ai_conversations_update_own ON ai_coach_conversations
  FOR UPDATE TO authenticated
  USING (user_id = get_user_id_from_auth());

CREATE POLICY ai_conversations_delete_own ON ai_coach_conversations
  FOR DELETE TO authenticated
  USING (user_id = get_user_id_from_auth());

-- =====================================================
-- AI COACH DAILY USAGE POLICIES
-- =====================================================
CREATE POLICY ai_usage_select_own ON ai_coach_daily_usage
  FOR SELECT TO authenticated
  USING (user_id = get_user_id_from_auth());

CREATE POLICY ai_usage_insert_own ON ai_coach_daily_usage
  FOR INSERT TO authenticated
  WITH CHECK (user_id = get_user_id_from_auth());

CREATE POLICY ai_usage_update_own ON ai_coach_daily_usage
  FOR UPDATE TO authenticated
  USING (user_id = get_user_id_from_auth());

-- =====================================================
-- PATTERN INSIGHTS POLICIES
-- =====================================================
CREATE POLICY pattern_insights_select_own ON pattern_insights
  FOR SELECT TO authenticated
  USING (user_id = get_user_id_from_auth());

-- =====================================================
-- WEEKLY RECAPS POLICIES
-- =====================================================
CREATE POLICY weekly_recaps_select_own ON weekly_recaps
  FOR SELECT TO authenticated
  USING (user_id = get_user_id_from_auth());

CREATE POLICY weekly_recaps_update_own ON weekly_recaps
  FOR UPDATE TO authenticated
  USING (user_id = get_user_id_from_auth());

-- =====================================================
-- DAILY MOTIVATIONS POLICIES
-- =====================================================
CREATE POLICY daily_motivations_select_own ON daily_motivations
  FOR SELECT TO authenticated
  USING (user_id = get_user_id_from_auth());

-- =====================================================
-- NOTIFICATIONS POLICIES
-- =====================================================
CREATE POLICY device_tokens_select_own ON device_tokens
  FOR SELECT TO authenticated
  USING (user_id = get_user_id_from_auth());

CREATE POLICY device_tokens_insert_own ON device_tokens
  FOR INSERT TO authenticated
  WITH CHECK (user_id = get_user_id_from_auth());

CREATE POLICY device_tokens_update_own ON device_tokens
  FOR UPDATE TO authenticated
  USING (user_id = get_user_id_from_auth());

CREATE POLICY device_tokens_delete_own ON device_tokens
  FOR DELETE TO authenticated
  USING (user_id = get_user_id_from_auth());

CREATE POLICY notification_history_select_own ON notification_history
  FOR SELECT TO authenticated
  USING (user_id = get_user_id_from_auth());

CREATE POLICY notification_preferences_select_own ON notification_preferences
  FOR SELECT TO authenticated
  USING (user_id = get_user_id_from_auth());

CREATE POLICY notification_preferences_insert_own ON notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = get_user_id_from_auth());

CREATE POLICY notification_preferences_update_own ON notification_preferences
  FOR UPDATE TO authenticated
  USING (user_id = get_user_id_from_auth());

-- =====================================================
-- SUBSCRIPTIONS POLICIES
-- =====================================================
CREATE POLICY subscriptions_select_own ON subscriptions
  FOR SELECT TO authenticated
  USING (user_id = get_user_id_from_auth());

-- =====================================================
-- SUBSCRIPTION DEACTIVATION LOGS POLICIES
-- =====================================================
CREATE POLICY subscription_deactivation_logs_select_own ON subscription_deactivation_logs
  FOR SELECT TO authenticated
  USING (user_id = get_user_id_from_auth());

-- =====================================================
-- SUBSCRIPTION PLANS & FEATURES (Public Read)
-- =====================================================
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscription_plans_public_read ON subscription_plans
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

CREATE POLICY plan_features_public_read ON plan_features
  FOR SELECT TO anon, authenticated
  USING (true);

-- =====================================================
-- APP VERSIONS (Public Read)
-- =====================================================
ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_versions_public_read ON app_versions
  FOR SELECT TO anon, authenticated
  USING (true);

-- =====================================================
-- OAUTH ACCOUNTS POLICIES
-- =====================================================
ALTER TABLE oauth_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY oauth_accounts_select_own ON oauth_accounts
  FOR SELECT TO authenticated
  USING (user_id = get_user_id_from_auth());

CREATE POLICY oauth_accounts_insert_own ON oauth_accounts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = get_user_id_from_auth());

CREATE POLICY oauth_accounts_delete_own ON oauth_accounts
  FOR DELETE TO authenticated
  USING (user_id = get_user_id_from_auth());

-- =====================================================
-- BLOG POLICIES (Public Read)
-- =====================================================
ALTER TABLE blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY blog_posts_public_read ON blog_posts
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

CREATE POLICY blog_categories_public_read ON blog_categories
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY blog_tags_public_read ON blog_tags
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY blog_post_categories_public_read ON blog_post_categories
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY blog_post_tags_public_read ON blog_post_tags
  FOR SELECT TO anon, authenticated
  USING (true);

-- =====================================================
-- DATA EXPORT POLICIES
-- =====================================================
CREATE POLICY data_export_select_own ON data_export_requests
  FOR SELECT TO authenticated
  USING (user_id = get_user_id_from_auth());

CREATE POLICY data_export_insert_own ON data_export_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = get_user_id_from_auth());

-- =====================================================
-- REFERRAL POLICIES
-- =====================================================
CREATE POLICY referral_codes_select_own ON referral_codes
  FOR SELECT TO authenticated
  USING (user_id = get_user_id_from_auth());

CREATE POLICY referral_redemptions_select_own ON referral_redemptions
  FOR SELECT TO authenticated
  USING (
    referrer_id = get_user_id_from_auth() 
    OR referred_id = get_user_id_from_auth()
  );

-- =====================================================
-- AUTH TOKENS (User-specific or denied)
-- =====================================================
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_codes ENABLE ROW LEVEL SECURITY;

-- Refresh tokens: users can only access their own
CREATE POLICY refresh_tokens_all ON refresh_tokens
  FOR ALL TO authenticated
  USING (user_id = get_user_id_from_auth())
  WITH CHECK (user_id = get_user_id_from_auth());

-- Password reset tokens: no user access (service role only)
CREATE POLICY password_reset_tokens_deny ON password_reset_tokens
  FOR ALL TO authenticated
  USING (false);

-- Email verification codes: no user access (service role only)
CREATE POLICY email_verification_codes_deny ON email_verification_codes
  FOR ALL TO authenticated
  USING (false);

-- =====================================================
-- API KEYS
-- =====================================================
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- API keys: no user access (admin/service role only)
CREATE POLICY api_keys_deny ON api_keys
  FOR ALL TO authenticated
  USING (false);

-- =====================================================
-- AUDIT LOGS (Admin only via role column)
-- =====================================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit logs: only admins can access
CREATE POLICY audit_logs_admin_only ON audit_logs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = get_user_id_from_auth()
      AND u.role = 'admin'
    )
  );

-- =====================================================
-- WEBHOOK EVENTS (No user access)
-- =====================================================
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Webhook events: no user access (service role only)
CREATE POLICY webhook_events_deny ON webhook_events
  FOR ALL TO authenticated
  USING (false);

-- =====================================================
-- ENABLE REALTIME FOR CORE TABLES
-- =====================================================
-- CRITICAL: users table must be enabled for security (auto-logout on ban/suspend)
ALTER PUBLICATION supabase_realtime ADD TABLE users;

-- Core features
ALTER PUBLICATION supabase_realtime ADD TABLE goals;
ALTER PUBLICATION supabase_realtime ADD TABLE check_ins;
ALTER PUBLICATION supabase_realtime ADD TABLE daily_checkin_summaries;

-- Subscriptions (RevenueCat webhook updates)
ALTER PUBLICATION supabase_realtime ADD TABLE subscriptions;

-- Notifications
ALTER PUBLICATION supabase_realtime ADD TABLE daily_motivations;
ALTER PUBLICATION supabase_realtime ADD TABLE notification_history;

-- Social features
ALTER PUBLICATION supabase_realtime ADD TABLE accountability_partners;
ALTER PUBLICATION supabase_realtime ADD TABLE social_nudges;
ALTER PUBLICATION supabase_realtime ADD TABLE user_achievements;

-- AI features
ALTER PUBLICATION supabase_realtime ADD TABLE ai_coach_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE weekly_recaps;

-- Blog
ALTER PUBLICATION supabase_realtime ADD TABLE blog_posts;

-- =====================================================
-- REPLICA IDENTITY FULL FOR REALTIME TABLES
-- =====================================================
-- By default, Supabase only returns primary key in oldRecord for UPDATE/DELETE events.
-- REPLICA IDENTITY FULL enables full old row data in realtime payloads.
-- This is needed to detect what actually changed (e.g., status transitions).
--
-- IMPORTANT: Only enable for tables where we need to compare old vs new values.
-- This has a small storage/performance overhead.
-- =====================================================

-- Users: detect status changes (active → banned/suspended)
ALTER TABLE users REPLICA IDENTITY FULL;

-- Goals: detect status changes (active → paused → archived)
ALTER TABLE goals REPLICA IDENTITY FULL;

-- Check-ins: detect completed changes
ALTER TABLE check_ins REPLICA IDENTITY FULL;

-- Subscriptions: detect plan/status changes
ALTER TABLE subscriptions REPLICA IDENTITY FULL;

-- Partners: detect status changes (pending → accepted/rejected)
ALTER TABLE accountability_partners REPLICA IDENTITY FULL;

-- Nudges: detect is_read changes
ALTER TABLE social_nudges REPLICA IDENTITY FULL;

-- Blog posts: detect status changes (draft → published)
ALTER TABLE blog_posts REPLICA IDENTITY FULL;

-- Pattern insights: detect status changes (pending → generating)
ALTER TABLE pattern_insights REPLICA IDENTITY FULL;

-- AI Coach: detect message additions/status changes
ALTER TABLE ai_coach_conversations REPLICA IDENTITY FULL;

-- Notification history: detect opened_at changes
ALTER TABLE notification_history REPLICA IDENTITY FULL;

-- Daily checkin summaries: trigger-maintained, detect summary updates
ALTER TABLE daily_checkin_summaries REPLICA IDENTITY FULL;

-- Daily motivations: detect regeneration
ALTER TABLE daily_motivations REPLICA IDENTITY FULL;

-- Weekly recaps: detect recap generation
ALTER TABLE weekly_recaps REPLICA IDENTITY FULL;

-- User achievements: detect new achievements unlocked
ALTER TABLE user_achievements REPLICA IDENTITY FULL;

