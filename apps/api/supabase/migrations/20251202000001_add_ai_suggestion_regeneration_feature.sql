-- =====================================================
-- Add AI Suggestion Regeneration Feature and Tracking
-- =====================================================

-- Step 1: Add regeneration_count column to suggested_goals table
ALTER TABLE suggested_goals ADD COLUMN IF NOT EXISTS regeneration_count INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN suggested_goals.regeneration_count IS 'Number of successful AI suggestion regenerations (0 = initial generation, 1 = first regen, 2 = second regen, etc.)';

-- Step 2: Add ai_goal_generations feature to plan_features
-- This feature controls how many total AI goal generations a user gets
-- Free users: 2 total generations (feature_value = 2, minimum_tier = 0)
-- Starter+ users: Unlimited (feature_value = NULL, minimum_tier = 1)

-- Free plan: 2 total generations
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, minimum_tier, sort_order)
VALUES (
  'free',
  'ai_goal_generations',
  'AI Goal Generations',
  '2 AI goal generation attempts',
  2,
  true,
  0,
  40
)
ON CONFLICT (plan_id, feature_key) DO UPDATE
SET 
  feature_name = EXCLUDED.feature_name,
  feature_description = EXCLUDED.feature_description,
  feature_value = EXCLUDED.feature_value,
  is_enabled = EXCLUDED.is_enabled,
  minimum_tier = EXCLUDED.minimum_tier;

-- Starter plan: Unlimited (feature_value = NULL, minimum_tier = 1)
-- This will cascade to Pro (tier 2) and Coach+ (tier 3) automatically
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, minimum_tier, sort_order)
VALUES (
  'starter',
  'ai_goal_generations',
  'Unlimited AI Goal Generations',
  'Unlimited AI goal generation and regeneration',
  NULL,
  true,
  1,
  40
)
ON CONFLICT (plan_id, feature_key) DO UPDATE
SET 
  feature_name = EXCLUDED.feature_name,
  feature_description = EXCLUDED.feature_description,
  feature_value = EXCLUDED.feature_value,
  is_enabled = EXCLUDED.is_enabled,
  minimum_tier = EXCLUDED.minimum_tier;

