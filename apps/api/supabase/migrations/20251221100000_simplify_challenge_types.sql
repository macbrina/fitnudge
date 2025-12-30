-- Migration: Simplify challenge types to only streak and checkin_count
-- Time challenges focus on streaks (maintaining daily streaks)
-- Target challenges count check-ins (complete X check-ins)

-- Step 1: Update any existing 'community' or 'custom' challenges to 'streak'
UPDATE challenges 
SET challenge_type = 'streak' 
WHERE challenge_type IN ('community', 'custom');

-- Step 2: Drop the old constraint and add new one with only streak and checkin_count
ALTER TABLE challenges 
DROP CONSTRAINT IF EXISTS challenges_challenge_type_check;

ALTER TABLE challenges
ADD CONSTRAINT challenges_challenge_type_check 
CHECK (challenge_type IN ('streak', 'checkin_count'));

-- Add comment explaining the types
COMMENT ON COLUMN challenges.challenge_type IS 'streak = Time Challenge (duration-based, focus on maintaining streaks), checkin_count = Target Challenge (count-based, complete X check-ins)';


