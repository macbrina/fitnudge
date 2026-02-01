-- =====================================================
-- Add 'completed' status to goals
-- =====================================================
-- Allows users to mark goals as completed (achieved)
-- Completed goals cannot be resumed - they're finished achievements
-- Different from 'archived' which can be reactivated

-- Add completed_at timestamp column
ALTER TABLE goals
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Update status CHECK constraint to include 'completed'
ALTER TABLE goals
DROP CONSTRAINT IF EXISTS goals_status_check;

ALTER TABLE goals
ADD CONSTRAINT goals_status_check 
CHECK (status IN ('active', 'paused', 'archived', 'completed'));

-- Add index for completed goals queries
CREATE INDEX IF NOT EXISTS idx_goals_completed_at 
ON goals(completed_at DESC) 
WHERE status = 'completed';

COMMENT ON COLUMN goals.completed_at IS 
  'Timestamp when goal was marked as completed. NULL if not completed.';
