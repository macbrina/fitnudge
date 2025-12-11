-- =====================================================
-- UPDATE SUBSCRIPTION PLANS: Add Store Product IDs & Update Features
-- =====================================================

-- Add App Store and Play Store product ID columns to subscription_plans
ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS product_id_ios_monthly TEXT,
ADD COLUMN IF NOT EXISTS product_id_ios_annual TEXT,
ADD COLUMN IF NOT EXISTS product_id_android_monthly TEXT,
ADD COLUMN IF NOT EXISTS product_id_android_annual TEXT;

-- Add indexes for product IDs (for efficient lookups when verifying subscriptions)
CREATE INDEX IF NOT EXISTS idx_subscription_plans_ios_monthly ON subscription_plans(product_id_ios_monthly);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_ios_annual ON subscription_plans(product_id_ios_annual);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_android_monthly ON subscription_plans(product_id_android_monthly);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_android_annual ON subscription_plans(product_id_android_annual);

-- Update existing plans with product IDs (same IDs for iOS and Android)
UPDATE subscription_plans SET
    product_id_ios_monthly = 'com.fitnudge.starter.monthly',
    product_id_ios_annual = 'com.fitnudge.starter.annual',
    product_id_android_monthly = 'com.fitnudge.starter.monthly',
    product_id_android_annual = 'com.fitnudge.starter.annual'
WHERE id = 'starter';

UPDATE subscription_plans SET
    product_id_ios_monthly = 'com.fitnudge.pro.monthly',
    product_id_ios_annual = 'com.fitnudge.pro.annual',
    product_id_android_monthly = 'com.fitnudge.pro.monthly',
    product_id_android_annual = 'com.fitnudge.pro.annual'
WHERE id = 'pro';

UPDATE subscription_plans SET
    product_id_ios_monthly = 'com.fitnudge.coach.monthly',
    product_id_ios_annual = 'com.fitnudge.coach.annual',
    product_id_android_monthly = 'com.fitnudge.coach.monthly',
    product_id_android_annual = 'com.fitnudge.coach.annual'
WHERE id = 'coach_plus';

-- Update plan features with new feature allocations
-- Free plan: Add new features (keep basic versions)
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order)
SELECT 'free', 'progress_photos', 'Progress Photos', 'Upload photos with check-ins', null, true, 4
WHERE NOT EXISTS (SELECT 1 FROM plan_features WHERE plan_id = 'free' AND feature_key = 'progress_photos');

INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order)
SELECT 'free', 'achievement_badges', 'Achievement Badges', 'Unlock badges for milestones', null, true, 5
WHERE NOT EXISTS (SELECT 1 FROM plan_features WHERE plan_id = 'free' AND feature_key = 'achievement_badges');

INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order)
SELECT 'free', 'habit_chains', 'Habit Chains', 'Visual chain visualization for streaks', null, true, 6
WHERE NOT EXISTS (SELECT 1 FROM plan_features WHERE plan_id = 'free' AND feature_key = 'habit_chains');

INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order)
SELECT 'free', 'custom_reminders', 'Custom Reminder Messages', 'Personalize reminder messages', null, true, 7
WHERE NOT EXISTS (SELECT 1 FROM plan_features WHERE plan_id = 'free' AND feature_key = 'custom_reminders');

INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order)
SELECT 'free', 'meal_tracking_basic', 'Meal Tracking (Basic)', 'Log meals with basic info (name, type, date)', null, true, 8
WHERE NOT EXISTS (SELECT 1 FROM plan_features WHERE plan_id = 'free' AND feature_key = 'meal_tracking_basic');

INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order)
SELECT 'free', 'challenge_join', 'Join Challenges', 'Join community challenges', null, true, 9
WHERE NOT EXISTS (SELECT 1 FROM plan_features WHERE plan_id = 'free' AND feature_key = 'challenge_join');

INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order)
SELECT 'free', 'social_accountability_basic', 'Share Goals (Basic)', 'Share 1 goal with 1 friend', null, true, 10
WHERE NOT EXISTS (SELECT 1 FROM plan_features WHERE plan_id = 'free' AND feature_key = 'social_accountability_basic');

-- Starter plan: Add new features
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order)
SELECT 'starter', 'weekly_recap', 'Weekly Recaps', 'AI-generated weekly progress summaries', null, true, 5
WHERE NOT EXISTS (SELECT 1 FROM plan_features WHERE plan_id = 'starter' AND feature_key = 'weekly_recap');

INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order)
SELECT 'starter', 'meal_tracking_full', 'Meal Tracking (Full)', 'Nutritional data, daily summaries, photo support', null, true, 6
WHERE NOT EXISTS (SELECT 1 FROM plan_features WHERE plan_id = 'starter' AND feature_key = 'meal_tracking_full');

INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order)
SELECT 'starter', 'social_accountability', 'Social Accountability', 'Share multiple goals, accountability partners', null, true, 7
WHERE NOT EXISTS (SELECT 1 FROM plan_features WHERE plan_id = 'starter' AND feature_key = 'social_accountability');

INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order)
SELECT 'starter', 'challenge_create', 'Create Challenges', 'Create and manage community challenges', null, true, 8
WHERE NOT EXISTS (SELECT 1 FROM plan_features WHERE plan_id = 'starter' AND feature_key = 'challenge_create');

-- Pro plan: Add new features
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order)
SELECT 'pro', 'ai_progress_reflections', 'AI Progress Reflections', 'Premium deep AI coach summaries with actionable insights', null, true, 5
WHERE NOT EXISTS (SELECT 1 FROM plan_features WHERE plan_id = 'pro' AND feature_key = 'ai_progress_reflections');

INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order)
SELECT 'pro', 'group_goals', 'Group Goals', 'Create and manage collaborative group goals', 3, true, 6
WHERE NOT EXISTS (SELECT 1 FROM plan_features WHERE plan_id = 'pro' AND feature_key = 'group_goals');

INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order)
SELECT 'pro', 'meal_tracking_analytics', 'Meal Tracking Analytics', 'Advanced nutrition insights and trends', null, true, 7
WHERE NOT EXISTS (SELECT 1 FROM plan_features WHERE plan_id = 'pro' AND feature_key = 'meal_tracking_analytics');

-- Coach+ plan: Add new features
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order)
SELECT 'coach_plus', 'ai_progress_reflections', 'AI Progress Reflections (Enhanced)', 'Premium deep AI coach summaries with monthly reflections', null, true, 5
WHERE NOT EXISTS (SELECT 1 FROM plan_features WHERE plan_id = 'coach_plus' AND feature_key = 'ai_progress_reflections');

INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order)
SELECT 'coach_plus', 'group_goals_premium', 'Group Goals (Premium)', 'Unlimited group goals with advanced management', null, true, 9
WHERE NOT EXISTS (SELECT 1 FROM plan_features WHERE plan_id = 'coach_plus' AND feature_key = 'group_goals_premium');

INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order)
SELECT 'coach_plus', 'social_accountability_premium', 'Social Accountability (Premium)', 'Priority partner matching, unlimited shares', null, true, 10
WHERE NOT EXISTS (SELECT 1 FROM plan_features WHERE plan_id = 'coach_plus' AND feature_key = 'social_accountability_premium');

