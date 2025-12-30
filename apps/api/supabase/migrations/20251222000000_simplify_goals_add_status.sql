-- =====================================================
-- SIMPLIFY GOALS: Remove challenge-related columns, replace is_active with status
-- =====================================================
-- Goals are now only for ongoing habits. Time-bound challenges 
-- are handled exclusively by the challenges table.

-- =====================================================
-- Part 1: Drop constraints before removing columns
-- =====================================================

-- Drop the constraint that required target_checkins for target_challenge
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_target_checkins_required;

-- Drop the constraint that required dates for time_challenge
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_challenge_dates_required;

-- Drop the goal_type check constraint
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_goal_type_check;

-- =====================================================
-- Part 2: Add status column (replacing is_active)
-- =====================================================

-- Add status column with proper values
ALTER TABLE goals 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'archived'));

-- Migrate existing data from is_active to status
-- IMPORTANT: Ensure is_active = true maps to status = 'active'
UPDATE goals 
SET status = CASE
    WHEN is_active = true THEN 'active'
    WHEN archived_reason IS NOT NULL THEN 'archived'
    WHEN completed_at IS NOT NULL THEN 'completed'
    ELSE 'paused'
END
WHERE status IS NULL OR status = 'active';

-- Double-check: ensure all goals with is_active = true have status = 'active'
UPDATE goals SET status = 'active' WHERE is_active = true AND status != 'active';

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);

-- =====================================================
-- Part 3: Remove challenge-related columns from goals
-- =====================================================

-- Drop indexes first
DROP INDEX IF EXISTS idx_goals_goal_type;
DROP INDEX IF EXISTS idx_goals_challenges_incomplete;

-- Remove columns we no longer need
ALTER TABLE goals DROP COLUMN IF EXISTS goal_type;
ALTER TABLE goals DROP COLUMN IF EXISTS target_checkins;
ALTER TABLE goals DROP COLUMN IF EXISTS challenge_start_date;
ALTER TABLE goals DROP COLUMN IF EXISTS challenge_end_date;
ALTER TABLE goals DROP COLUMN IF EXISTS converted_to_challenge_id;
ALTER TABLE goals DROP COLUMN IF EXISTS challenge_id;

-- =====================================================
-- Part 4: Drop materialized views that depend on is_active
-- =====================================================

-- Drop materialized view that depends on is_active column
DROP MATERIALIZED VIEW IF EXISTS analytics.user_engagement_summary CASCADE;

-- =====================================================
-- Part 5: Drop is_active column (replaced by status)
-- =====================================================

ALTER TABLE goals DROP COLUMN IF EXISTS is_active;

-- =====================================================
-- Part 6: Update comments
-- =====================================================

COMMENT ON COLUMN goals.status IS 'Current status: active (in use), paused (temporarily stopped), completed (finished), archived (hidden from view)';

-- =====================================================
-- Part 7: Recreate materialized view with status instead of is_active
-- =====================================================

-- Note: The materialized view analytics.user_engagement_summary was dropped above.
-- If needed, it should be recreated in a separate migration using the new 'status' column
-- instead of the removed 'is_active' column.
-- Example: WHERE status = 'active' instead of WHERE is_active = true

