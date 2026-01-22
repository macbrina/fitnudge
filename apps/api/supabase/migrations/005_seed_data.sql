-- =====================================================
-- FitNudge V2 - Seed Data
-- Subscription plans, plan features, and app versions
-- =====================================================

-- =====================================================
-- APP VERSIONS (Initial Release)
-- =====================================================
INSERT INTO app_versions (platform, latest_version, minimum_version, release_notes)
VALUES 
  ('ios', '1.0.0', '1.0.0', 'Initial release'),
  ('android', '1.0.0', '1.0.0', 'Initial release');

-- =====================================================
-- SUBSCRIPTION PLANS
-- =====================================================
INSERT INTO subscription_plans (
  id, 
  name, 
  description, 
  monthly_price, 
  annual_price, 
  active_goal_limit, 
  tier,
  is_popular, 
  has_trial, 
  trial_days, 
  sort_order,
  product_id_ios_monthly,
  product_id_ios_annual,
  product_id_android_monthly,
  product_id_android_annual,
  exit_offer_enabled,
  exit_offer_monthly_price,
  exit_offer_annual_price,
  is_active
) VALUES 
(
  'free',
  'Free',
  'Get started with basic goal tracking',
  0.00,
  0.00,
  2,      -- 2 active goals
  0,      -- tier 0
  false,  -- not popular
  false,  -- no trial
  null,
  1,      -- sort order
  null,   -- no product IDs for free
  null,
  null,
  null,
  false,  -- no exit offer
  null,
  null,
  true
),
(
  'premium',
  'Premium',
  'Unlock everything - up to 10 active goals, AI coaching, and insights',
  9.99,
  79.99,
  10,     -- 10 active goals max (for AI context limits)
  1,      -- tier 1
  true,   -- is_popular
  true,   -- has_trial (annual only)
  3,      -- 3-day trial
  2,      -- sort order
  'com.fitnudge.premium.monthly',
  'com.fitnudge.premium.annual',
  'com.fitnudge.premium.monthly',
  'com.fitnudge.premium.annual',
  true,   -- exit offer enabled
  4.99,   -- 50% off monthly
  39.99,  -- 50% off annual
  true
);

-- =====================================================
-- PLAN FEATURES - FREE TIER
-- =====================================================
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order, ai_description)
VALUES
  -- Goal limits
  ('free', 'active_goal_limit', 'Active Goals', 'Maximum active goals at a time', 2, true, 1, 'User can have 2 active goals'),
  
  -- Partner limits
  ('free', 'accountability_partner_limit', 'Accountability Partners', 'Maximum accountability partners', 1, true, 2, 'User can have 1 accountability partner'),
  
  -- Core features (enabled)
  ('free', 'daily_checkins', 'Daily Check-ins', 'Yes/No check-ins with responses', NULL, true, 10, 'daily check-ins'),
  ('free', 'streak_tracking', 'Streak Tracking', 'Track current and longest streaks', NULL, true, 11, 'streak tracking'),
  ('free', 'daily_motivation', 'Daily Motivation', 'AI motivation at your scheduled reminder time', NULL, true, 12, 'daily AI motivation messages'),
  ('free', 'basic_stats', 'Basic Stats', 'Consistency percentage and basic stats', NULL, true, 13, 'basic progress stats'),
  ('free', 'ai_checkin_response', 'Check-in Responses', 'Template-based responses after check-in', NULL, false, 14, 'template check-in responses'),
  
  -- AI Coach Chat (limited on free - 3 messages/day)
  ('free', 'ai_coach_chat', 'AI Coach Chat', 'Chat with your AI coach - 3 messages per day', 3, true, 20, 'AI coaching chat (3 messages per day, watch ads for more)'),
  ('free', 'pattern_detection', 'Smart Pattern Detection', 'AI detects your habit patterns', NULL, false, 21, 'pattern detection (upgrade to unlock)'),
  ('free', 'weekly_recap', 'Weekly AI Recaps', 'Personalized weekly summaries', NULL, false, 22, 'weekly recaps (upgrade to unlock)'),
  ('free', 'advanced_analytics', 'Advanced Analytics', 'Detailed charts and insights', NULL, false, 23, 'advanced analytics (upgrade to unlock)'),
  ('free', 'adaptive_nudging', 'Adaptive Nudging', 'Smart nudges based on patterns', NULL, false, 24, 'adaptive nudging (upgrade to unlock)'),
  ('free', 'voice_notes', 'Voice Notes', 'Record voice reflections', NULL, false, 25, 'voice notes (upgrade to unlock)'),
  ('free', 'multiple_reminder_times', 'Multiple Reminders', 'Set multiple reminder times per goal', 1, true, 26, 'User can set 1 reminder time per goal'),
  ('free', 'ads', 'Ads', 'Free users see ads', NULL, true, 30, 'User will see ads in the app');

-- =====================================================
-- PLAN FEATURES - PREMIUM TIER ($9.99/month)
-- =====================================================
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order, ai_description)
VALUES
  -- Goal limits (10 active for AI context management)
  ('premium', 'active_goal_limit', 'Up to 10 Active Goals', 'Track up to 10 goals at a time', 10, true, 1, 'User can have 10 active goals'),
  ('premium', 'accountability_partner_limit', 'Up to 3 Partners', 'Connect with up to 3 accountability partners', 3, true, 2, 'User can have up to 3 accountability partners'),
  
  -- All free features (inherited)
  ('premium', 'daily_checkins', 'Daily Check-ins', 'Yes/No check-ins with AI response', NULL, true, 10, 'daily check-ins'),
  ('premium', 'streak_tracking', 'Streak Tracking', 'Track current and longest streaks', NULL, true, 11, 'streak tracking'),
  ('premium', 'daily_motivation', 'Daily Motivation', 'AI motivation at your scheduled reminder time', NULL, true, 12, 'daily AI motivation messages'),
  ('premium', 'basic_stats', 'Basic Stats', 'Consistency percentage and basic stats', NULL, true, 13, 'basic progress stats'),
  ('premium', 'ai_checkin_response', 'AI Check-in Responses', 'Personalized AI-generated responses after check-in', NULL, true, 14, 'AI-powered personalized check-in responses'),
  
  -- Premium-only features (all enabled)
  ('premium', 'ai_coach_chat', 'AI Coach Chat', 'Chat with your AI coach - 100 messages per day', 100, true, 20, 'AI coaching chatbot (100 messages per day)'),
  ('premium', 'pattern_detection', 'Smart Pattern Detection', 'AI detects patterns like best/worst days, dropout points', NULL, true, 21, 'AI pattern detection for habit insights'),
  ('premium', 'weekly_recap', 'Weekly AI Recaps', 'Personalized weekly summaries with wins, insights, focus areas', NULL, true, 22, 'weekly AI-generated progress summaries'),
  ('premium', 'advanced_analytics', 'Advanced Analytics', 'Detailed charts, heatmaps, and trend analysis', NULL, true, 23, 'advanced analytics and insights'),
  ('premium', 'adaptive_nudging', 'Adaptive Nudging', 'Extra check-ins when you are about to break streak', NULL, true, 24, 'smart nudges based on behavior patterns'),
  ('premium', 'voice_notes', 'Voice Notes', 'Record voice reflections after check-ins (30 sec max)', NULL, true, 25, 'voice note reflections'),
  ('premium', 'priority_support', 'Priority Support', 'Faster response times from support team', NULL, true, 40, 'priority customer support'),
  ('premium', 'multiple_reminder_times', 'Multiple Reminders', 'Set up to 5 reminder times per goal', 5, true, 27, 'User can set up to 5 reminder times per goal'),
  ('premium', 'ads', 'No Ads', 'Ad-free experience', NULL, false, 30, 'User will not see any ads'),
  
  -- Technical limits (hidden from UI, used by backend)
  ('premium', 'voice_note_max_duration', 'Voice Note Duration', 'Maximum voice note duration in seconds', 30, true, 100, 'Max 30 second voice notes'),
  ('premium', 'voice_note_max_file_size', 'Voice Note File Size', 'Maximum voice note file size in MB', 5, true, 101, 'Max 5MB voice note files');

-- =====================================================
-- ACHIEVEMENT TYPES (V2 - Streak, Check-in, Goal, Partner, Nudge)
-- =====================================================
INSERT INTO achievement_types (badge_key, badge_name, badge_description, unlock_condition, category, rarity, points, sort_order) VALUES
-- Milestone achievements
('first_checkin', 'Getting Started', 'Complete your first check-in', '{"type": "checkin_count", "value": 1}', 'milestone', 'common', 10, 1),
('first_goal', 'Goal Setter', 'Create your first goal', '{"type": "goal_count", "value": 1}', 'milestone', 'common', 15, 2),
('first_partner', 'First Ally', 'Connect with your first accountability partner', '{"type": "partner_count", "value": 1}', 'social', 'common', 20, 3),

-- Streak achievements
('streak_3', 'Three Day Streak', 'Maintain a 3-day streak', '{"type": "streak", "value": 3}', 'streak', 'common', 20, 10),
('streak_7', 'Week Warrior', 'Complete a 7-day streak', '{"type": "streak", "value": 7}', 'streak', 'rare', 50, 11),
('streak_14', 'Two Week Triumph', 'Complete a 14-day streak', '{"type": "streak", "value": 14}', 'streak', 'rare', 75, 12),
('streak_21', 'Habit Forming', 'Complete a 21-day streak', '{"type": "streak", "value": 21}', 'streak', 'rare', 100, 13),
('streak_30', 'Month Master', 'Complete a 30-day streak', '{"type": "streak", "value": 30}', 'streak', 'epic', 200, 14),
('streak_50', 'Fifty Strong', 'Complete a 50-day streak', '{"type": "streak", "value": 50}', 'streak', 'epic', 350, 15),
('streak_100', 'Century Club', 'Complete a 100-day streak', '{"type": "streak", "value": 100}', 'streak', 'legendary', 1000, 16),
('streak_200', 'Half Year Hero', 'Complete a 200-day streak', '{"type": "streak", "value": 200}', 'streak', 'legendary', 2000, 17),
('streak_365', 'Year Long Legend', 'Complete a 365-day streak', '{"type": "streak", "value": 365}', 'streak', 'legendary', 5000, 18),
('streak_500', 'Unstoppable', 'Complete a 500-day streak', '{"type": "streak", "value": 500}', 'streak', 'legendary', 7500, 19),
('streak_730', 'Two Year Titan', 'Complete a 730-day streak (2 years)', '{"type": "streak", "value": 730}', 'streak', 'legendary', 10000, 20),
('streak_1000', 'Thousand Day Legend', 'Complete a 1000-day streak', '{"type": "streak", "value": 1000}', 'streak', 'legendary', 15000, 21),

-- Check-in consistency achievements
('checkins_10', 'Ten Strong', 'Complete 10 check-ins', '{"type": "checkin_count", "value": 10}', 'consistency', 'common', 25, 30),
('checkins_50', 'Consistency Champion', 'Complete 50 check-ins', '{"type": "checkin_count", "value": 50}', 'consistency', 'rare', 100, 31),
('checkins_100', 'Hundred Hero', 'Complete 100 check-ins', '{"type": "checkin_count", "value": 100}', 'consistency', 'epic', 300, 32),
('checkins_250', 'Quarter Thousand', 'Complete 250 check-ins', '{"type": "checkin_count", "value": 250}', 'consistency', 'epic', 500, 33),
('checkins_500', 'Half Thousand', 'Complete 500 check-ins', '{"type": "checkin_count", "value": 500}', 'consistency', 'legendary', 1000, 34),
('checkins_1000', 'Thousand Check-ins', 'Complete 1000 check-ins', '{"type": "checkin_count", "value": 1000}', 'consistency', 'legendary', 2500, 35),
('checkins_2000', 'Two Thousand Strong', 'Complete 2000 check-ins', '{"type": "checkin_count", "value": 2000}', 'consistency', 'legendary', 5000, 36),
('checkins_5000', 'Five Thousand', 'Complete 5000 check-ins', '{"type": "checkin_count", "value": 5000}', 'consistency', 'legendary', 10000, 37),

-- Perfect consistency achievements
('perfect_week', 'Perfect Week', 'Complete all check-ins in a week', '{"type": "perfect_week", "value": 7}', 'consistency', 'rare', 75, 40),
('perfect_month', 'Perfect Month', 'Complete all check-ins in a month', '{"type": "perfect_month", "value": 30}', 'consistency', 'epic', 300, 41),
('perfect_quarter', 'Perfect Quarter', 'Complete all check-ins for 90 days straight', '{"type": "perfect_period", "value": 90}', 'consistency', 'legendary', 1000, 42),
('perfect_half_year', 'Perfect Half Year', 'Complete all check-ins for 180 days straight', '{"type": "perfect_period", "value": 180}', 'consistency', 'legendary', 2500, 43),
('perfect_year', 'Perfect Year', 'Complete all check-ins for 365 days straight', '{"type": "perfect_period", "value": 365}', 'consistency', 'legendary', 7500, 44),

-- Goal achievements
('goals_3', 'Triple Threat', 'Create 3 goals', '{"type": "goal_count", "value": 3}', 'milestone', 'common', 30, 50),
('goals_5', 'Goal Getter', 'Create 5 goals', '{"type": "goal_count", "value": 5}', 'milestone', 'rare', 50, 51),
('goals_10', 'Ambitious', 'Create 10 goals', '{"type": "goal_count", "value": 10}', 'milestone', 'epic', 100, 52),

-- Social/Partner achievements
('first_nudge', 'First Nudge', 'Send your first nudge to a partner', '{"type": "nudges_sent", "value": 1}', 'social', 'common', 15, 60),
('first_cheer', 'Cheerleader', 'Send your first cheer to a partner', '{"type": "cheers_sent", "value": 1}', 'social', 'common', 15, 61),
('nudges_10', 'Supportive Friend', 'Send 10 nudges to your partners', '{"type": "nudges_sent", "value": 10}', 'social', 'common', 50, 62),
('nudges_50', 'Encouragement Champion', 'Send 50 nudges to your partners', '{"type": "nudges_sent", "value": 50}', 'social', 'rare', 100, 63),
('nudges_100', 'Motivation Master', 'Send 100 nudges to your partners', '{"type": "nudges_sent", "value": 100}', 'social', 'epic', 250, 64),
('nudges_250', 'Cheerful Spirit', 'Send 250 nudges to your partners', '{"type": "nudges_sent", "value": 250}', 'social', 'legendary', 500, 65),
('nudges_500', 'Support Legend', 'Send 500 nudges to your partners', '{"type": "nudges_sent", "value": 500}', 'social', 'legendary', 1000, 66),
('nudges_1000', 'Ultimate Supporter', 'Send 1000 nudges to your partners', '{"type": "nudges_sent", "value": 1000}', 'social', 'legendary', 2000, 67),
('partners_3', 'Social Connector', 'Have 3 active accountability partners', '{"type": "partner_count", "value": 3}', 'social', 'rare', 100, 68),

-- AI Coach engagement achievements
('ai_chat_10', 'AI Buddy', 'Have 10 conversations with AI coach', '{"type": "ai_conversations", "value": 10}', 'engagement', 'common', 25, 80),
('ai_chat_50', 'AI Confidant', 'Have 50 conversations with AI coach', '{"type": "ai_conversations", "value": 50}', 'engagement', 'rare', 75, 81),
('ai_chat_100', 'AI Partner', 'Have 100 conversations with AI coach', '{"type": "ai_conversations", "value": 100}', 'engagement', 'epic', 200, 82),
('ai_chat_250', 'AI Expert', 'Have 250 conversations with AI coach', '{"type": "ai_conversations", "value": 250}', 'engagement', 'legendary', 400, 83),
('ai_chat_500', 'AI Best Friend', 'Have 500 conversations with AI coach', '{"type": "ai_conversations", "value": 500}', 'engagement', 'legendary', 750, 84),
('ai_chat_1000', 'AI Soulmate', 'Have 1000 conversations with AI coach', '{"type": "ai_conversations", "value": 1000}', 'engagement', 'legendary', 1500, 85),

-- Weekly recap engagement
('recaps_4', 'First Month Recap', 'Review 4 weekly recaps', '{"type": "recaps_viewed", "value": 4}', 'engagement', 'common', 20, 90),
('recaps_12', 'Quarter Reviewer', 'Review 12 weekly recaps (3 months)', '{"type": "recaps_viewed", "value": 12}', 'engagement', 'rare', 60, 91),
('recaps_26', 'Half Year Reflector', 'Review 26 weekly recaps (6 months)', '{"type": "recaps_viewed", "value": 26}', 'engagement', 'rare', 130, 92),
('recaps_52', 'Year of Insight', 'Review 52 weekly recaps (1 year)', '{"type": "recaps_viewed", "value": 52}', 'engagement', 'epic', 260, 93),
('recaps_104', 'Two Year Sage', 'Review 104 weekly recaps (2 years)', '{"type": "recaps_viewed", "value": 104}', 'engagement', 'legendary', 520, 94),

-- Long-term membership achievements
('account_30', 'Month One', 'Active member for 30 days', '{"type": "account_age", "value": 30}', 'milestone', 'common', 30, 100),
('account_90', 'Quarter Member', 'Active member for 90 days', '{"type": "account_age", "value": 90}', 'milestone', 'rare', 90, 101),
('account_180', 'Half Year Member', 'Active member for 180 days', '{"type": "account_age", "value": 180}', 'milestone', 'rare', 180, 102),
('account_365', 'One Year Member', 'Active member for 1 year', '{"type": "account_age", "value": 365}', 'milestone', 'epic', 365, 103),
('account_730', 'Two Year Veteran', 'Active member for 2 years', '{"type": "account_age", "value": 730}', 'milestone', 'legendary', 730, 104),
('account_1095', 'Three Year Legend', 'Active member for 3 years', '{"type": "account_age", "value": 1095}', 'milestone', 'legendary', 1500, 105),
('account_1825', 'Five Year Champion', 'Active member for 5 years', '{"type": "account_age", "value": 1825}', 'milestone', 'legendary', 3000, 106);

