-- =====================================================
-- CHALLENGE CHECK-INS PRE-CREATION SUPPORT
-- =====================================================
-- This migration adds support for pre-creating challenge check-ins
-- similar to how goal check-ins work. This improves scalability
-- by avoiding dynamic computation on each API call.

-- =====================================================
-- Part 1: Add completed and is_checked_in columns
-- =====================================================
ALTER TABLE challenge_check_ins 
ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_checked_in BOOLEAN DEFAULT FALSE;

-- =====================================================
-- Part 2: Update existing records
-- =====================================================
-- All existing records in challenge_check_ins were created when
-- users actually checked in, so they should be marked as completed
UPDATE challenge_check_ins 
SET completed = TRUE, is_checked_in = TRUE 
WHERE completed IS NULL OR is_checked_in IS NULL;

-- =====================================================
-- Part 3: Add index for efficient pending check-in queries
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_challenge_check_ins_pending 
ON challenge_check_ins(user_id, check_in_date, is_checked_in) 
WHERE is_checked_in = FALSE;

-- =====================================================
-- Part 4: Add comments for documentation
-- =====================================================
COMMENT ON COLUMN challenge_check_ins.completed IS 
'Whether the user completed the challenge activity for this day. True when user submits check-in.';

COMMENT ON COLUMN challenge_check_ins.is_checked_in IS 
'Whether the user has submitted their check-in. Pre-created records have this as false until user checks in.';
