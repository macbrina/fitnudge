-- =====================================================
-- SIMPLIFY SUBSCRIPTION TO TWO TIERS: FREE + PREMIUM
-- =====================================================
-- This migration consolidates the 4-tier system (free, starter, pro, elite)
-- into a simpler 2-tier system (free, premium).
--
-- Pricing: Premium = $9.99/month, $79.99/year
-- All premium features are unlocked with a single subscription.
--
-- This is a CLEAN SLATE migration for development - no backward compatibility
-- with existing subscribers (there are none in production yet).
-- =====================================================

-- =====================================================
-- STEP 1: Delete all plan_features for old tiers
-- =====================================================
DELETE FROM plan_features WHERE plan_id IN ('starter', 'pro', 'elite');

-- =====================================================
-- STEP 2: Delete old subscription plans
-- =====================================================
DELETE FROM subscription_plans WHERE id IN ('starter', 'pro', 'elite');

-- =====================================================
-- STEP 3: Create the new Premium plan
-- =====================================================
INSERT INTO subscription_plans (
  id, 
  name, 
  description, 
  monthly_price, 
  annual_price, 
  goal_limit, 
  active_goal_limit, 
  is_popular, 
  has_trial, 
  trial_days, 
  sort_order,
  tier,
  is_active
) VALUES (
  'premium',
  'Premium',
  'Unlock everything - unlimited goals, AI coaching, challenges, and more',
  9.99,
  79.99,
  NULL,  -- unlimited goals
  NULL,  -- unlimited active goals
  true,  -- is_popular
  true,  -- has_trial (annual only - frontend handles this)
  3,     -- 3-day trial (annual only)
  2,     -- sort after free
  1,     -- tier 1 (free=0, premium=1)
  true   -- is_active
);

-- =====================================================
-- STEP 4: Update Free plan description and ensure settings
-- =====================================================
UPDATE subscription_plans
SET 
  description = 'Get started with basic goal tracking',
  goal_limit = 1,
  active_goal_limit = 1,
  tier = 0,
  is_active = true,
  sort_order = 1
WHERE id = 'free';

-- =====================================================
-- STEP 5: Update existing plan_features for Free tier
-- Keep essential free features, ensure minimum_tier = 0
-- =====================================================
UPDATE plan_features
SET minimum_tier = 0
WHERE plan_id = 'free';

-- =====================================================
-- STEP 6: Create Premium plan_features (minimum_tier = 1)
-- Mirrors ELITE tier features exactly, respecting is_enabled
-- Premium = Everything elite has (which includes all lower tiers)
-- =====================================================

-- Unlimited Goals (elite has NULL = unlimited)
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order, minimum_tier, ai_description)
VALUES ('premium', 'goals', 'Unlimited Goals', 'Create unlimited goals to track all aspects of your fitness', NULL, true, 1, 1, 'unlimited goals to track your fitness progress');

-- Unlimited Active Goals (from elite)
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order, minimum_tier, ai_description)
VALUES ('premium', 'active_goal_limit', 'Unlimited Active Goals', 'No limit on active goals - track everything at once', NULL, true, 2, 1, 'unlimited active goals at a time');

-- Unlimited Challenges (from elite)
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order, minimum_tier, ai_description)
VALUES ('premium', 'challenge_limit', 'Unlimited Challenges', 'Maximum challenges you can participate in', NULL, true, 3, 1, 'unlimited challenges');

-- Unlimited Partners (from elite)
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order, minimum_tier, ai_description)
VALUES ('premium', 'accountability_partner_limit', 'Unlimited Partners', 'Unlimited accountability partners', NULL, true, 4, 1, 'unlimited accountability partners');

-- Unlimited AI Goal Generations (from starter+)
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order, minimum_tier, ai_description)
VALUES ('premium', 'ai_goal_generations', 'Unlimited AI Goal Generations', 'AI-generated personalized goal suggestions based on your profile', NULL, true, 5, 1, 'AI-powered goal generation');

-- Unlimited Text Motivation (from starter+)
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order, minimum_tier, ai_description)
VALUES ('premium', 'unlimited_text_motivation', 'Unlimited Text Motivation', 'Unlimited AI-powered text motivation messages', NULL, true, 10, 1, 'unlimited AI-powered motivation messages');

-- AI Chat Motivation (from pro+, elite has "Enhanced" version)
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order, minimum_tier, ai_description)
VALUES ('premium', 'ai_chat_motivation', 'AI Chat Motivation', 'Personalized AI coaching conversations for motivation and guidance', NULL, true, 11, 1, 'personalized AI coaching conversations');

-- AI Progress Reflections (from elite - "Premium AI Reflections")
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order, minimum_tier, ai_description)
VALUES ('premium', 'ai_progress_reflections', 'AI Progress Reflections', 'Deep AI analysis with personalized coaching, pattern recognition, and actionable recommendations', NULL, true, 12, 1, 'AI progress reflections and coaching insights');

-- AI Voice Motivation (from elite - is_enabled: FALSE, Coming Soon)
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order, minimum_tier, ai_description)
VALUES ('premium', 'ai_voice_motivation', 'AI Voice Motivation', 'AI-powered voice motivation calls (Coming Soon)', NULL, false, 13, 1, 'AI voice motivation calls');

-- AI Memory & Personalization (from elite)
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order, minimum_tier, ai_description)
VALUES ('premium', 'ai_memory_personalization', 'AI Memory & Personalization', 'AI learns and adapts to your preferences over time', NULL, true, 14, 1, 'AI that learns and adapts to your preferences');

-- Advanced Analytics (from elite - this covers basic_analytics too, no need for separate basic_analytics)
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order, minimum_tier, ai_description)
VALUES ('premium', 'advanced_analytics', 'Advanced Analytics', 'Detailed progress and performance analytics with insights', NULL, true, 20, 1, 'advanced analytics for deep insights');

-- Weekly Recaps (from starter+)
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order, minimum_tier, ai_description)
VALUES ('premium', 'weekly_recap', 'Weekly Recaps', 'AI-generated weekly progress summaries', NULL, true, 22, 1, 'weekly recap summaries of your progress');

-- Meal Tracking Analytics (from pro+)
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order, minimum_tier, ai_description)
VALUES ('premium', 'meal_tracking_analytics', 'Meal Tracking Analytics', 'Advanced nutrition insights, trends, and meal analytics', NULL, true, 25, 1, 'advanced meal tracking analytics and nutrition insights');

-- Social Accountability (from starter+)
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order, minimum_tier, ai_description)
VALUES ('premium', 'social_accountability', 'Social Accountability', 'Share goals with accountability partners for motivation', NULL, true, 31, 1, 'share goals with friends for accountability');

-- Create Challenges (from starter+)
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order, minimum_tier, ai_description)
VALUES ('premium', 'challenge_create', 'Create Challenges', 'Create and manage public community challenges with leaderboards. Set duration, rules, and track participants.', NULL, true, 32, 1, 'create community challenges for others to join and compete');

-- Priority Features (from elite)
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order, minimum_tier, ai_description)
VALUES ('premium', 'priority_features', 'Priority Features', 'Early access to new features before general release', NULL, true, 42, 1, 'early access to new features');

-- Priority Support (from elite)
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order, minimum_tier, ai_description)
VALUES ('premium', 'priority_support', 'Priority Support', 'Priority customer support with faster response times', NULL, true, 43, 1, 'priority customer support');

-- API Integrations (from elite - is_enabled: FALSE, Coming Soon)
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order, minimum_tier, ai_description)
VALUES ('premium', 'api_integrations', 'API Integrations', 'Connect with external fitness apps and devices (Coming Soon)', NULL, false, 44, 1, 'integrations with external fitness apps and devices');

-- No Ads (from starter+)
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order, minimum_tier, ai_description)
VALUES ('premium', 'no_ads', 'No Ads', 'Ad-free experience without interruptions', NULL, true, 99, 1, 'ad-free experience');

-- =====================================================
-- STEP 7: Drop old check constraints (they only allow 'free', 'starter', 'pro', 'coach_plus')
-- =====================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_check;
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

-- =====================================================
-- STEP 8: Update any existing users/subscriptions
-- Map old tiers to new: starter/pro/elite/coach_plus -> premium
-- =====================================================

-- Update users table
UPDATE users
SET plan = 'premium'
WHERE plan IN ('starter', 'pro', 'elite', 'coach_plus');

-- Update subscriptions table
UPDATE subscriptions
SET plan = 'premium'
WHERE plan IN ('starter', 'pro', 'elite', 'coach_plus');

-- =====================================================
-- STEP 8b: Add new check constraints with 2-tier system
-- =====================================================
ALTER TABLE users ADD CONSTRAINT users_plan_check CHECK (plan IN ('free', 'premium'));
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_check CHECK (plan IN ('free', 'premium'));

-- =====================================================
-- STEP 9: Set product IDs for Premium plan (columns already exist)
-- =====================================================
UPDATE subscription_plans
SET 
  product_id_ios_monthly = 'com.fitnudge.premium.monthly',
  product_id_ios_annual = 'com.fitnudge.premium.annual',
  product_id_android_monthly = 'com.fitnudge.premium.monthly',
  product_id_android_annual = 'com.fitnudge.premium.annual'
WHERE id = 'premium';

-- =====================================================
-- STEP 10: Update exit offer configuration (columns already exist)
-- Exit offer = 50% off annual only (trial is also annual-only)
-- =====================================================
UPDATE subscription_plans
SET 
  exit_offer_enabled = true,
  exit_offer_monthly_price = 4.99,  -- 50% off $9.99
  exit_offer_annual_price = 39.99  -- 50% off $79.99
WHERE id = 'premium';

-- =====================================================
-- VERIFICATION QUERY (for manual checking)
-- =====================================================
-- Run this after migration to verify:
-- SELECT id, name, tier, monthly_price, annual_price, is_active FROM subscription_plans ORDER BY tier;
-- SELECT plan_id, feature_key, minimum_tier FROM plan_features ORDER BY plan_id, minimum_tier, sort_order;

