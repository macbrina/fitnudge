-- =====================================================
-- RENAME COACH_PLUS TO ELITE + FIX FEATURES
-- =====================================================
-- 
-- This migration:
-- 1. Renames coach_plus plan to elite
-- 2. Updates product IDs to com.fitnudge.elite.*
-- 3. Adds missing goal features (goals for Pro/Elite with null = unlimited)
-- 4. Adds active_goal_limit feature for all plans
-- 5. Adds voice_posts feature for audio posting
--

-- =====================================================
-- STEP 1: RENAME COACH_PLUS TO ELITE
-- =====================================================
-- Strategy: INSERT new 'elite' plan, migrate references, then DELETE old plan
-- This avoids foreign key constraint violations

-- Step 1a: Insert new 'elite' plan (copy from coach_plus)
INSERT INTO subscription_plans (
    id, name, description, 
    monthly_price, annual_price, 
    goal_limit, active_goal_limit,
    is_popular, has_trial, trial_days,
    is_active, sort_order,
    product_id_ios_monthly, product_id_ios_annual, 
    product_id_android_monthly, product_id_android_annual,
    tier,
    exit_offer_enabled, exit_offer_monthly_price, exit_offer_annual_price,
    created_at, updated_at
)
SELECT 
    'elite',
    'Elite',
    description, 
    monthly_price, annual_price, 
    goal_limit, active_goal_limit,
    is_popular, has_trial, trial_days,
    is_active, sort_order,
    product_id_ios_monthly, product_id_ios_annual, 
    product_id_android_monthly, product_id_android_annual,
    tier,
    exit_offer_enabled, exit_offer_monthly_price, exit_offer_annual_price,
    created_at, NOW()
FROM subscription_plans 
WHERE id = 'coach_plus'
ON CONFLICT (id) DO NOTHING;

-- Step 1b: Update child tables to point to 'elite'
UPDATE plan_features 
SET plan_id = 'elite'
WHERE plan_id = 'coach_plus';

UPDATE subscriptions 
SET plan = 'elite'
WHERE plan = 'coach_plus';

UPDATE users 
SET plan = 'elite'
WHERE plan = 'coach_plus';

-- Step 1c: Delete old 'coach_plus' plan (now safe, no references)
DELETE FROM subscription_plans 
WHERE id = 'coach_plus';

-- =====================================================
-- STEP 2: UPDATE PRODUCT IDS TO com.fitnudge.elite.*
-- =====================================================

UPDATE subscription_plans 
SET 
    product_id_ios_monthly = 'com.fitnudge.elite.monthly',
    product_id_ios_annual = 'com.fitnudge.elite.annual',
    product_id_android_monthly = 'com.fitnudge.elite.monthly',
    product_id_android_annual = 'com.fitnudge.elite.annual'
WHERE id = 'elite';

-- =====================================================
-- STEP 3: ADD/UPDATE GOALS FEATURES
-- =====================================================
-- 
-- Goals feature explanation:
-- - feature_value = number means the limit
-- - feature_value = null means unlimited
--
-- Current setup:
-- - Free: goals = 1 (can create 1 goal)
-- - Starter: goals = 3 (can create 3 goals)
-- - Pro/Elite: goals = null (unlimited goals)

-- Add goals feature for Pro (unlimited)
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, minimum_tier, sort_order)
VALUES ('pro', 'goals', 'Goals', 'Number of goals you can create (unlimited)', NULL, true, 2, 1)
ON CONFLICT (plan_id, feature_key) DO UPDATE SET
    feature_value = NULL,
    feature_description = 'Number of goals you can create (unlimited)',
    minimum_tier = 2;

-- Add goals feature for Elite (unlimited)
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, minimum_tier, sort_order)
VALUES ('elite', 'goals', 'Goals', 'Number of goals you can create (unlimited)', NULL, true, 3, 1)
ON CONFLICT (plan_id, feature_key) DO UPDATE SET
    feature_value = NULL,
    feature_description = 'Number of goals you can create (unlimited)',
    minimum_tier = 3;

-- =====================================================
-- STEP 4: ADD ACTIVE_GOAL_LIMIT FEATURE
-- =====================================================
--
-- This is how many goals can be ACTIVE simultaneously:
-- - Free: 1 active goal at a time
-- - Starter: 2 active goals at a time
-- - Pro/Elite: 3 active goals at a time

INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, minimum_tier, sort_order)
VALUES 
    ('free', 'active_goal_limit', 'Active Goal Limit', 'Number of goals that can be active simultaneously', 1, true, 0, 2),
    ('starter', 'active_goal_limit', 'Active Goal Limit', 'Number of goals that can be active simultaneously', 2, true, 1, 2),
    ('pro', 'active_goal_limit', 'Active Goal Limit', 'Number of goals that can be active simultaneously', 3, true, 2, 2),
    ('elite', 'active_goal_limit', 'Active Goal Limit', 'Number of goals that can be active simultaneously', 3, true, 3, 2)
ON CONFLICT (plan_id, feature_key) DO UPDATE SET
    feature_value = EXCLUDED.feature_value,
    minimum_tier = EXCLUDED.minimum_tier;

-- =====================================================
-- STEP 5: ADD VOICE_POSTS FEATURE
-- =====================================================
--
-- voice_posts is for audio posting in social feed
-- (separate from ai_voice_motivation which is AI-generated voice messages)
-- Available from Pro tier onwards

INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, minimum_tier, sort_order)
VALUES 
    ('pro', 'voice_posts', 'Voice Posts', 'Record and share voice posts in the community feed', NULL, true, 2, 20),
    ('elite', 'voice_posts', 'Voice Posts', 'Record and share voice posts in the community feed', NULL, true, 2, 20)
ON CONFLICT (plan_id, feature_key) DO UPDATE SET
    is_enabled = true,
    minimum_tier = 2;

-- =====================================================
-- STEP 6: UPDATE AI DESCRIPTION FOR VOICE_POSTS
-- =====================================================

UPDATE plan_features 
SET ai_description = 'record and share voice posts with the community'
WHERE feature_key = 'voice_posts';

-- =====================================================
-- DOCUMENTATION
-- =====================================================

COMMENT ON TABLE subscription_plans IS 
'Subscription plans. Plan IDs:
- free (tier 0)
- starter (tier 1)
- pro (tier 2)
- elite (tier 3) - formerly coach_plus

Feature keys for goals:
- goals: Number of goals user can CREATE (null = unlimited)
- active_goal_limit: Number of goals that can be ACTIVE simultaneously

Feature keys for voice:
- voice_posts: Audio posting in social feed (Pro+)
- ai_voice_motivation: AI-generated voice motivation messages (future)';
