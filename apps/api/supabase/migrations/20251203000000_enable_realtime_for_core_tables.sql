-- =====================================================
-- Enable Realtime for Core User-Facing Tables
-- =====================================================
-- Migration: 20251203000000_enable_realtime_for_core_tables.sql
-- Purpose: Enable Supabase Realtime for tables that need instant updates
-- 
-- Tables enabled (by priority):
-- HIGH PRIORITY (critical for UX):
--   - check_ins: TodaysActionsCard, ProgressHub, RecentActivity, GoalDetailScreen
--   - goals: ActiveGoalsList, GoalsScreen, QuickStatsGrid
--
-- MEDIUM PRIORITY (AI features):
--   - actionable_plans: AI plan status (generating → completed)
--   - daily_motivations: Motivation regeneration
--
-- FUTURE FEATURES (not yet in mobile):
--   - user_achievements: Badge unlocks (prepare for future)
--   - challenges: Challenge updates (prepare for future)
--   - challenge_participants: Participant updates (prepare for future)
--   - challenge_leaderboard: Leaderboard updates (prepare for future)
--
-- Note: Already enabled: posts, comments, likes, follows (social features)
-- =====================================================

-- Helper function to safely add table to Realtime publication
CREATE OR REPLACE FUNCTION add_table_to_realtime_if_not_exists(table_name TEXT)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = table_name
  ) THEN
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', table_name);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PHASE 1: Critical Security & User Management
-- =====================================================

-- Enable Realtime for users (CRITICAL - Security)
-- Use case: Instant logout when admin bans/suspends/disables user account
-- Purpose: Force logout disabled/suspended users immediately across all devices
-- Impact: Auto-logout triggers in base.ts and authUtils.ts
-- Security: Prevents banned users from continuing to use the app
SELECT add_table_to_realtime_if_not_exists('users');

-- =====================================================
-- PHASE 2: Core Features (Currently Used in Mobile)
-- =====================================================

-- Enable Realtime for check_ins (HIGH PRIORITY)
-- Use case: Instant updates when check-ins are created/completed by Celery or user
-- Impact: TodaysActionsCard, ProgressHub, GoalDetailScreen, RecentActivitySection
SELECT add_table_to_realtime_if_not_exists('check_ins');

-- Enable Realtime for goals (HIGH PRIORITY)
-- Use case: Instant updates when goals are created/updated/archived on any device
-- Impact: ActiveGoalsList, GoalsScreen, QuickStatsGrid
SELECT add_table_to_realtime_if_not_exists('goals');

-- Enable Realtime for actionable_plans (MEDIUM PRIORITY)
-- Use case: Real-time AI plan generation status updates (generating → completed)
-- Impact: GoalCard plan status badges, GoalDetailScreen plan section
SELECT add_table_to_realtime_if_not_exists('actionable_plans');

-- Enable Realtime for daily_motivations (MEDIUM PRIORITY)
-- Use case: Instant updates when new motivations are generated/regenerated
-- Impact: MotivationCard
SELECT add_table_to_realtime_if_not_exists('daily_motivations');

-- =====================================================
-- PHASE 2: Notification & Motivation System
-- =====================================================

-- Enable Realtime for motivations (MEDIUM PRIORITY)
-- Use case: Real-time updates for scheduled AI motivation pushes
-- Purpose: Track is_sent status, scheduled_for times, sent_at timestamps
-- Impact: Backend notification system, future motivation history screen
SELECT add_table_to_realtime_if_not_exists('motivations');

-- Enable Realtime for notification_history (LOW PRIORITY)
-- Use case: Track notification delivery, open rates, failures
-- Purpose: Monitor notification performance, user engagement analytics
-- Impact: Future notification history screen, analytics dashboard
SELECT add_table_to_realtime_if_not_exists('notification_history');

-- =====================================================
-- PHASE 3: Meal Tracking System
-- =====================================================

-- Enable Realtime for meal_logs (MEDIUM PRIORITY)
-- Use case: Instant updates when users log meals throughout the day
-- Purpose: Real-time meal tracking, multi-device sync
-- Impact: Future meal logging screen, daily nutrition tracker
SELECT add_table_to_realtime_if_not_exists('meal_logs');

-- Enable Realtime for daily_nutrition_summaries (LOW PRIORITY)
-- Use case: Auto-updated nutrition summaries as meals are logged
-- Purpose: Real-time nutritional progress tracking
-- Impact: Future daily nutrition summary card, progress tracking
SELECT add_table_to_realtime_if_not_exists('daily_nutrition_summaries');

-- =====================================================
-- PHASE 4: Gamification & Social Features
-- =====================================================

-- Enable Realtime for achievement_types (LOW PRIORITY)
-- Use case: Updates when new achievement types are added by admins
-- Purpose: Instant availability of new badges/achievements
-- Impact: Future achievements screen, badge catalog
SELECT add_table_to_realtime_if_not_exists('achievement_types');

-- Enable Realtime for user_achievements (MEDIUM PRIORITY)
-- Use case: Instant badge unlock notifications when achievements are earned
-- Purpose: Real-time achievement unlocks, badge notifications
-- Impact: Future achievement notification toasts, badges screen, profile
SELECT add_table_to_realtime_if_not_exists('user_achievements');

-- Enable Realtime for accountability_partners (MEDIUM PRIORITY)
-- Use case: Instant updates when partner requests are sent/accepted/rejected
-- Purpose: Real-time partnership status changes
-- Impact: Future accountability partners screen, request notifications
SELECT add_table_to_realtime_if_not_exists('accountability_partners');

-- Enable Realtime for challenges (MEDIUM PRIORITY)
-- Use case: Live challenge updates (start, end, new challenges available)
-- Purpose: Real-time challenge status changes
-- Impact: Future challenges screen, challenge notifications
SELECT add_table_to_realtime_if_not_exists('challenges');

-- Enable Realtime for challenge_participants (MEDIUM PRIORITY)
-- Use case: Live updates when users join/leave challenges
-- Purpose: Real-time participant list updates, team formation
-- Impact: Future challenge detail screen, participant list
SELECT add_table_to_realtime_if_not_exists('challenge_participants');

-- Enable Realtime for challenge_leaderboard (HIGH PRIORITY for challenges)
-- Use case: Live leaderboard rank updates during active challenges
-- Purpose: Real-time competitive rankings, point updates
-- Impact: Future challenge leaderboard screen - critical for engagement
SELECT add_table_to_realtime_if_not_exists('challenge_leaderboard');

-- Enable Realtime for group_goals (MEDIUM PRIORITY)
-- Use case: Live updates for shared goals with teammates
-- Purpose: Real-time collaboration, multi-user goal progress
-- Impact: Future group goals screen, team accountability features
SELECT add_table_to_realtime_if_not_exists('group_goals');

-- Clean up helper function
DROP FUNCTION IF EXISTS add_table_to_realtime_if_not_exists(TEXT);

-- =====================================================
-- TABLES INTENTIONALLY EXCLUDED FROM REALTIME
-- =====================================================
-- 
-- ❌ suggested_goals: Only used during onboarding, polling every 5s is sufficient
-- ❌ habit_chains: Auto-updated by database trigger, derived from check_ins
-- ❌ subscriptions: Very infrequent changes (monthly billing), REST API sufficient
-- ❌ iap_receipts: Backend-only validation records, never shown in UI
-- ❌ offer_codes: Backend-only promo codes, applied at checkout only
-- ❌ user_fitness_profiles: Rare updates (onboarding + settings), REST API sufficient
-- ❌ notification_preferences: Infrequent changes (user settings), REST API sufficient
-- ❌ device_tokens: Backend-only FCM registration, no UI display
-- ❌ subscription_plans: Static pricing data, REST API sufficient
-- ❌ plan_features: Static feature definitions, REST API sufficient
-- ❌ goal_templates: Static templates, REST API sufficient
-- ❌ blog_posts: Content updates are rare, REST API sufficient
-- ❌ media_uploads: Upload/download flow doesn't benefit from Realtime
-- ❌ password_reset_tokens: Backend-only, security-sensitive
-- ❌ email_verification_codes: Backend-only, security-sensitive
-- ❌ oauth_accounts: Backend-only, rarely changes
-- ❌ admin_users: Admin dashboard only, separate from mobile
-- ❌ audit_logs: Admin logs only, not shown in mobile
-- ❌ system_health_updates: Status page only, separate from mobile
-- =====================================================

