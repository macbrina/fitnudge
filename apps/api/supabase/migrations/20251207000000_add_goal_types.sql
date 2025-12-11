-- =====================================================
-- GOAL TYPES: Habits vs Challenges
-- =====================================================

-- Add goal_type to distinguish between ongoing habits and time/target challenges
ALTER TABLE goals
ADD COLUMN IF NOT EXISTS goal_type TEXT DEFAULT 'habit' 
    CHECK (goal_type IN ('habit', 'time_challenge', 'target_challenge'));

-- Link goals to shared challenges (for shareable challenge goals)
ALTER TABLE goals
ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES challenges(id) ON DELETE SET NULL;

-- Target check-ins count for target_challenge type
ALTER TABLE goals
ADD COLUMN IF NOT EXISTS target_checkins INTEGER;

-- Track challenge start date (for time challenges)
ALTER TABLE goals
ADD COLUMN IF NOT EXISTS challenge_start_date DATE;

-- Track challenge end date (for time challenges - calculated from start + duration)
ALTER TABLE goals
ADD COLUMN IF NOT EXISTS challenge_end_date DATE;

-- When the goal was completed (for challenges)
ALTER TABLE goals
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- How the goal was completed
ALTER TABLE goals
ADD COLUMN IF NOT EXISTS completion_reason TEXT 
    CHECK (completion_reason IN ('duration', 'target', 'manual'));

-- Add index for goal type filtering
CREATE INDEX IF NOT EXISTS idx_goals_goal_type ON goals(goal_type);

-- Add index for challenge lookups
CREATE INDEX IF NOT EXISTS idx_goals_challenge_id ON goals(challenge_id) WHERE challenge_id IS NOT NULL;

-- Add index for finding incomplete challenges
CREATE INDEX IF NOT EXISTS idx_goals_challenges_incomplete 
ON goals(goal_type, challenge_end_date) 
WHERE goal_type IN ('time_challenge', 'target_challenge') AND completed_at IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN goals.goal_type IS 'Type of goal: habit (ongoing), time_challenge (duration-based), or target_challenge (checkin count-based)';
COMMENT ON COLUMN goals.challenge_id IS 'Links to shared challenge if this goal is part of a group challenge';
COMMENT ON COLUMN goals.target_checkins IS 'Number of check-ins required to complete a target_challenge';
COMMENT ON COLUMN goals.challenge_start_date IS 'Start date for time-based challenges';
COMMENT ON COLUMN goals.challenge_end_date IS 'End date for time-based challenges (start_date + duration)';
COMMENT ON COLUMN goals.completed_at IS 'Timestamp when the goal/challenge was completed';
COMMENT ON COLUMN goals.completion_reason IS 'How the goal was completed: duration (time elapsed), target (check-ins reached), or manual';

-- Backfill existing goals as habits
UPDATE goals SET goal_type = 'habit' WHERE goal_type IS NULL;

-- Add constraint to ensure target_checkins is set for target challenges
-- (Note: This is a partial constraint, full validation should be in application layer)
ALTER TABLE goals
ADD CONSTRAINT goals_target_checkins_required 
    CHECK (goal_type != 'target_challenge' OR target_checkins IS NOT NULL);

-- Add constraint to ensure challenge dates are set for time challenges
ALTER TABLE goals
ADD CONSTRAINT goals_challenge_dates_required 
    CHECK (goal_type != 'time_challenge' OR (challenge_start_date IS NOT NULL AND challenge_end_date IS NOT NULL));
