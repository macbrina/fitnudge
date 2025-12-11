-- Add is_checked_in column to check_ins table
-- This tracks whether the user has responded to the check-in (yes or no)
-- separate from "completed" which tracks if they actually completed the goal

ALTER TABLE check_ins
ADD COLUMN IF NOT EXISTS is_checked_in BOOLEAN DEFAULT FALSE;

-- Backfill: If completed is not null, user has checked in
UPDATE check_ins
SET is_checked_in = TRUE
WHERE completed IS NOT NULL;

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_check_ins_is_checked_in ON check_ins(is_checked_in);

-- Add comment for documentation
COMMENT ON COLUMN check_ins.is_checked_in IS 'Whether the user has responded to this check-in (true after user selects yes/no)';
