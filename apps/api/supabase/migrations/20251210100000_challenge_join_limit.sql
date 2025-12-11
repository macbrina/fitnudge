-- =====================================================
-- Migration: Add challenge_join_limit feature
-- =====================================================
-- This migration adds a new feature to track how many
-- challenges a user can join simultaneously.
--
-- Limits:
-- - Free: 1 challenge at a time
-- - Starter: 2 challenges at a time
-- - Pro: 3 challenges at a time
-- - Elite: 3 challenges at a time
-- =====================================================

-- Insert challenge_join_limit feature for all plans
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_value, is_enabled, minimum_tier, feature_description, ai_description, sort_order)
VALUES
    ('free', 'challenge_join_limit', 'Challenge Join Limit', 1, true, 0, 
     'Maximum number of challenges you can participate in simultaneously',
     'User can join up to 1 challenge at a time', 25),
    ('starter', 'challenge_join_limit', 'Challenge Join Limit', 2, true, 1,
     'Maximum number of challenges you can participate in simultaneously', 
     'User can join up to 2 challenges at a time', 25),
    ('pro', 'challenge_join_limit', 'Challenge Join Limit', 3, true, 2,
     'Maximum number of challenges you can participate in simultaneously',
     'User can join up to 3 challenges at a time', 25),
    ('elite', 'challenge_join_limit', 'Challenge Join Limit', 3, true, 3,
     'Maximum number of challenges you can participate in simultaneously',
     'User can join up to 3 challenges at a time', 25)
ON CONFLICT (plan_id, feature_key) DO UPDATE SET
    feature_name = EXCLUDED.feature_name,
    feature_value = EXCLUDED.feature_value,
    is_enabled = EXCLUDED.is_enabled,
    minimum_tier = EXCLUDED.minimum_tier,
    feature_description = EXCLUDED.feature_description,
    ai_description = EXCLUDED.ai_description,
    sort_order = EXCLUDED.sort_order;

-- =====================================================
-- Add archived_reason column to goals table
-- =====================================================
-- This allows us to track why a goal was archived
-- (e.g., "converted_to_challenge", "user_archived", etc.)

ALTER TABLE goals 
ADD COLUMN IF NOT EXISTS archived_reason TEXT;

COMMENT ON COLUMN goals.archived_reason IS 
'Reason for archiving: converted_to_challenge, user_archived, completed, etc.';

-- =====================================================
-- Add index for efficient queries
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_goals_archived_reason 
ON goals(archived_reason) 
WHERE archived_reason IS NOT NULL;
