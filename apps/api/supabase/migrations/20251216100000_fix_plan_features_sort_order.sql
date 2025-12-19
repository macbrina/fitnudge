-- Fix plan_features sort_order for logical display
-- Order: Limits/Values → AI Features → Analytics → Social → Misc → No Ads (last)

-- =============================================
-- 1. LIMITS/VALUES (features with numeric values first)
-- =============================================

-- Goals (1)
UPDATE plan_features SET sort_order = 1 WHERE feature_key = 'goals';

-- Active Goal Limit (2) - right after goals
UPDATE plan_features SET sort_order = 2 WHERE feature_key = 'active_goal_limit';

-- Challenge Limit (3)
UPDATE plan_features SET sort_order = 3 WHERE feature_key = 'challenge_limit';

-- Accountability Partner Limit (4)
UPDATE plan_features SET sort_order = 4 WHERE feature_key = 'accountability_partner_limit';

-- AI Goal Generations (5)
UPDATE plan_features SET sort_order = 5 WHERE feature_key = 'ai_goal_generations';

-- =============================================
-- 2. AI FEATURES
-- =============================================

-- Text Motivation (10)
UPDATE plan_features SET sort_order = 10 WHERE feature_key = 'text_motivation';
UPDATE plan_features SET sort_order = 10 WHERE feature_key = 'unlimited_text_motivation';

-- AI Chat Motivation (11)
UPDATE plan_features SET sort_order = 11 WHERE feature_key = 'ai_chat_motivation';

-- AI Progress Reflections (12)
UPDATE plan_features SET sort_order = 12 WHERE feature_key = 'ai_progress_reflections';

-- AI Voice Motivation (13) - coming soon
UPDATE plan_features SET sort_order = 13 WHERE feature_key = 'ai_voice_motivation';

-- AI Memory & Personalization (14)
UPDATE plan_features SET sort_order = 14 WHERE feature_key = 'ai_memory_personalization';

-- =============================================
-- 3. ANALYTICS & TRACKING
-- =============================================

-- Basic Analytics (20)
UPDATE plan_features SET sort_order = 20 WHERE feature_key = 'basic_analytics';

-- Advanced Analytics (21)
UPDATE plan_features SET sort_order = 21 WHERE feature_key = 'advanced_analytics';

-- Weekly Recap (22)
UPDATE plan_features SET sort_order = 22 WHERE feature_key = 'weekly_recap';

-- Meal Tracking Basic (23)
UPDATE plan_features SET sort_order = 23 WHERE feature_key = 'meal_tracking_basic';

-- Meal Tracking Full (24)
UPDATE plan_features SET sort_order = 24 WHERE feature_key = 'meal_tracking_full';

-- Meal Tracking Analytics (25)
UPDATE plan_features SET sort_order = 25 WHERE feature_key = 'meal_tracking_analytics';

-- Progress Photos (26)
UPDATE plan_features SET sort_order = 26 WHERE feature_key = 'progress_photos';

-- Habit Chains (27)
UPDATE plan_features SET sort_order = 27 WHERE feature_key = 'habit_chains';

-- =============================================
-- 4. SOCIAL & COMMUNITY
-- =============================================

-- Community Access (30)
UPDATE plan_features SET sort_order = 30 WHERE feature_key = 'community_access';

-- Social Accountability (31)
UPDATE plan_features SET sort_order = 31 WHERE feature_key = 'social_accountability';

-- Challenge Create (32)
UPDATE plan_features SET sort_order = 32 WHERE feature_key = 'challenge_create';

-- Challenge Join (33)
UPDATE plan_features SET sort_order = 33 WHERE feature_key = 'challenge_join';

-- Voice Posts (34)
UPDATE plan_features SET sort_order = 34 WHERE feature_key = 'voice_posts';

-- =============================================
-- 5. MISC/PERKS
-- =============================================

-- Achievement Badges (40)
UPDATE plan_features SET sort_order = 40 WHERE feature_key = 'achievement_badges';

-- Custom Reminders (41)
UPDATE plan_features SET sort_order = 41 WHERE feature_key = 'custom_reminders';

-- Priority Features (42)
UPDATE plan_features SET sort_order = 42 WHERE feature_key = 'priority_features';

-- Priority Support (43)
UPDATE plan_features SET sort_order = 43 WHERE feature_key = 'priority_support';

-- API Integrations (44)
UPDATE plan_features SET sort_order = 44 WHERE feature_key = 'api_integrations';

-- =============================================
-- 6. NO ADS (LAST)
-- =============================================

-- No Ads (99) - Always last
UPDATE plan_features SET sort_order = 99 WHERE feature_key = 'no_ads';

