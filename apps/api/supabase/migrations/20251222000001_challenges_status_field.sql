-- =====================================================
-- CHALLENGES: Replace is_active with proper status lifecycle
-- =====================================================
-- Status field properly represents challenge lifecycle:
-- - upcoming: Challenge hasn't started yet
-- - active: Challenge is currently running
-- - completed: Challenge duration/target was reached
-- - cancelled: Challenge was cancelled by creator

-- =====================================================
-- Part 1: Add status column to challenges
-- =====================================================

ALTER TABLE challenges 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled'));

-- =====================================================
-- Part 2: Migrate existing data from is_active to status
-- =====================================================

UPDATE challenges 
SET status = CASE
    WHEN cancelled_at IS NOT NULL THEN 'cancelled'
    WHEN start_date > CURRENT_DATE THEN 'upcoming'
    WHEN end_date < CURRENT_DATE THEN 'completed'
    WHEN is_active = true THEN 'active'
    ELSE 'upcoming'
END
WHERE status IS NULL;

-- =====================================================
-- Part 3: Create indexes for status queries
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);

-- Composite index for finding active challenges
CREATE INDEX IF NOT EXISTS idx_challenges_status_dates 
ON challenges(status, start_date, end_date) 
WHERE status IN ('upcoming', 'active');

-- =====================================================
-- Part 4: Drop policies and indexes that depend on is_active
-- =====================================================

-- Drop RLS policy that depends on is_active
DROP POLICY IF EXISTS challenges_public_select ON challenges;

-- Drop indexes that reference is_active
DROP INDEX IF EXISTS idx_challenges_active;
DROP INDEX IF EXISTS idx_challenges_public;

-- =====================================================
-- Part 5: Drop is_active column (replaced by status)
-- =====================================================

ALTER TABLE challenges DROP COLUMN IF EXISTS is_active;

-- Recreate index for public challenges using status
CREATE INDEX IF NOT EXISTS idx_challenges_public 
ON challenges(is_public, status) 
WHERE is_public = true AND status IN ('upcoming', 'active');

-- Recreate RLS policy using status instead of is_active
CREATE POLICY challenges_public_select ON challenges
    FOR SELECT
    USING (is_public = true AND status IN ('upcoming', 'active'));

-- =====================================================
-- Part 6: Add participant status to challenge_participants
-- =====================================================

ALTER TABLE challenge_participants
ADD COLUMN IF NOT EXISTS participant_status TEXT DEFAULT 'active'
    CHECK (participant_status IN ('active', 'completed', 'left'));

COMMENT ON COLUMN challenge_participants.participant_status IS 
'Participant status: active (participating), completed (reached target/finished), left (left the challenge)';

-- =====================================================
-- Part 7: Update challenge comments
-- =====================================================

COMMENT ON COLUMN challenges.status IS 
'Challenge lifecycle status: upcoming (not started), active (in progress), completed (finished), cancelled (stopped by creator)';

