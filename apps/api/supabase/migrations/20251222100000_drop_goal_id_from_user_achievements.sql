-- Migration: Drop goal_id from user_achievements
-- Reason: Achievements belong to users, not specific goals/challenges.
-- Context is now stored in the metadata JSONB field instead.
-- This allows achievements to persist even when goals/challenges are deleted.

-- Drop goal_id column from user_achievements
ALTER TABLE user_achievements DROP COLUMN IF EXISTS goal_id;

-- Add comment explaining the metadata usage
COMMENT ON COLUMN user_achievements.metadata IS 'Stores achievement context: source_type (goal/challenge), source_id, streak counts, etc.';

