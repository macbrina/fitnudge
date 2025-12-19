-- =====================================================
-- Fix Challenge Data Redundancy (Simplified)
-- =====================================================
-- Problem: Both challenge_participants and challenge_leaderboard
-- store points, rank, and progress_data, causing data inconsistency.
--
-- Solution (SIMPLE):
-- - challenge_participants: MEMBERSHIP ONLY (who joined, when)
-- - challenge_leaderboard: ALL SCORING DATA (rank, points, progress_data)
--
-- This is cleaner because:
-- 1. Check-in updates ONE table (challenge_leaderboard)
-- 2. Leaderboard queries need ONE table
-- 3. Membership checks use challenge_participants
-- =====================================================

-- Step 1: Remove scoring columns from challenge_participants
-- Keep only: id, challenge_id, user_id, goal_id, joined_at, completed_at
ALTER TABLE challenge_participants 
DROP COLUMN IF EXISTS rank,
DROP COLUMN IF EXISTS points,
DROP COLUMN IF EXISTS progress_data;

-- Step 2: Ensure challenge_leaderboard has all needed columns
-- It should already have: id, challenge_id, user_id, rank, points, progress_data, updated_at
-- Just add comments for clarity

COMMENT ON TABLE challenge_participants IS 
'Membership table. Tracks who joined which challenge and when. No scoring data.';

COMMENT ON TABLE challenge_leaderboard IS 
'All scoring data for challenges. Stores rank, points, progress_data. Updated on check-in.';

-- Step 3: Optimize indexes for the new structure
-- Remove old index that references dropped column
DROP INDEX IF EXISTS idx_challenge_participants_points;

-- Add index for leaderboard queries (already exists but let's ensure it)
CREATE INDEX IF NOT EXISTS idx_challenge_leaderboard_points_desc 
ON challenge_leaderboard(challenge_id, points DESC);
