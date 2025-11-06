-- =====================================================
-- ADD ACTIVE GOAL LIMIT TO SUBSCRIPTION PLANS
-- =====================================================

-- Add active_goal_limit column to subscription_plans
ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS active_goal_limit INTEGER DEFAULT 1;

-- Update existing plans with active goal limits
-- Free: 1 active goal
UPDATE subscription_plans 
SET active_goal_limit = 1
WHERE id = 'free';

-- Starter: 2 active goals
UPDATE subscription_plans 
SET active_goal_limit = 2
WHERE id = 'starter';

-- Pro: 3 active goals
UPDATE subscription_plans 
SET active_goal_limit = 3
WHERE id = 'pro';

-- Coach+: 3 active goals
UPDATE subscription_plans 
SET active_goal_limit = 3
WHERE id = 'coach_plus';

