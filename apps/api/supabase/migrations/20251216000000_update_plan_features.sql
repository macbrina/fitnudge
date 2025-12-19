-- Migration: Update plan_features for subscription tiers
-- Date: 2024-12-16
-- Changes:
-- 1. Update active_goal_limit for starter to feature_value = 2
-- 2. Remove meal_tracking_full from starter
-- 3. Remove unlimited_goals from pro and elite (redundant with goals feature)
-- 4. Update goals feature for pro: name="Unlimited Goals", better description
-- 5. Remove goals from elite (pro has minimum_tier=2, elite inherits it)
-- 6. Update active_goal_limit on elite: name="Unlimited Active Goals"
-- 7. Remove full_social_features from starter
-- 8. Remove priority_features from pro, keep only on elite (minimum_tier=3)
-- 9. Differentiate ai_progress_reflections between pro and elite

-- =====================================================
-- 1. Update active_goal_limit for starter to feature_value = 2
-- =====================================================
UPDATE plan_features
SET feature_value = 2
WHERE plan_id = 'starter' AND feature_key = 'active_goal_limit';

-- =====================================================
-- 2. Remove meal_tracking_full from starter
-- =====================================================
DELETE FROM plan_features
WHERE plan_id = 'starter' AND feature_key = 'meal_tracking_full';

-- =====================================================
-- 3. Remove unlimited_goals from pro and elite (redundant)
-- =====================================================
DELETE FROM plan_features
WHERE feature_key = 'unlimited_goals' AND plan_id IN ('pro', 'elite');

-- =====================================================
-- 4. Update goals feature for pro
-- =====================================================
UPDATE plan_features
SET 
    feature_name = 'Unlimited Goals',
    feature_description = 'Create unlimited goals to track all aspects of your fitness',
    minimum_tier = 2
WHERE plan_id = 'pro' AND feature_key = 'goals';

-- =====================================================
-- 5. Remove goals from elite (pro has minimum_tier=2, elite inherits)
-- =====================================================
DELETE FROM plan_features
WHERE plan_id = 'elite' AND feature_key = 'goals';

-- =====================================================
-- 6. Update active_goal_limit on elite
-- =====================================================
UPDATE plan_features
SET 
    feature_name = 'Unlimited Active Goals',
    feature_description = 'No limit on active goals - track everything at once',
    feature_value = NULL,
    minimum_tier = 3
WHERE plan_id = 'elite' AND feature_key = 'active_goal_limit';

-- =====================================================
-- 7. Remove full_social_features from starter
-- =====================================================
DELETE FROM plan_features
WHERE plan_id = 'starter' AND feature_key = 'full_social_features';

-- =====================================================
-- 8. Remove priority_features from pro, keep only elite
-- =====================================================
DELETE FROM plan_features
WHERE plan_id = 'pro' AND feature_key = 'priority_features';

-- Update elite's priority_features to have minimum_tier = 3
UPDATE plan_features
SET minimum_tier = 3
WHERE plan_id = 'elite' AND feature_key = 'priority_features';

-- =====================================================
-- 9. Differentiate ai_progress_reflections between pro and elite
-- =====================================================
-- Pro: Standard AI reflections
UPDATE plan_features
SET 
    feature_name = 'AI Progress Reflections',
    feature_description = 'Weekly AI-generated insights on your progress and habits',
    minimum_tier = 2
WHERE plan_id = 'pro' AND feature_key = 'ai_progress_reflections';

-- Elite: Premium AI reflections with deeper analysis
UPDATE plan_features
SET 
    feature_name = 'Premium AI Reflections',
    feature_description = 'Deep AI analysis with personalized coaching, pattern recognition, and actionable recommendations',
    minimum_tier = 3
WHERE plan_id = 'elite' AND feature_key = 'ai_progress_reflections';

-- =====================================================
-- 10. Update challenge_limit on elite
-- =====================================================
UPDATE plan_features
SET 
    feature_name = 'Unlimited Challenges',
    feature_description = 'Maximum challenges you can participate in',
    feature_value = NULL,
    minimum_tier = 3
WHERE plan_id = 'elite' AND feature_key = 'challenge_limit';

-- =====================================================
-- Summary of tier inheritance:
-- - minimum_tier = 0: Available to all (free+)
-- - minimum_tier = 1: Available to starter+ (starter, pro, elite)
-- - minimum_tier = 2: Available to pro+ (pro, elite)
-- - minimum_tier = 3: Elite exclusive
-- =====================================================

