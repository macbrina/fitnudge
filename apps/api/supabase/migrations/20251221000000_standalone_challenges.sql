-- =====================================================
-- STANDALONE CHALLENGES: Add challenge_id to shared tables
-- =====================================================
-- This migration enables challenges to be fully standalone entities,
-- without needing to create a goal first. Challenges will have their
-- own actionable_plans, workout_sessions, and workout_feedback.
--
-- Pattern: Same as motivations table (goal_id XOR challenge_id)

-- =====================================================
-- PART 1: ACTIONABLE_PLANS - Add challenge_id support
-- =====================================================

-- 1. Add challenge_id column
ALTER TABLE actionable_plans 
ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE;

-- 2. Make goal_id nullable (since plan can be for goal OR challenge)
ALTER TABLE actionable_plans 
ALTER COLUMN goal_id DROP NOT NULL;

-- 3. Drop the old unique constraint on goal_id (allows one plan per goal)
-- The constraint is auto-named by PostgreSQL
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'actionable_plans_goal_id_key'
    ) THEN
        ALTER TABLE actionable_plans DROP CONSTRAINT actionable_plans_goal_id_key;
    END IF;
END $$;

-- 4. Add new partial unique indexes (one plan per goal OR one plan per challenge)
CREATE UNIQUE INDEX IF NOT EXISTS idx_actionable_plans_goal_unique 
ON actionable_plans(goal_id) WHERE goal_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_actionable_plans_challenge_unique 
ON actionable_plans(challenge_id) WHERE challenge_id IS NOT NULL;

-- 5. Add XOR constraint (exactly one of goal_id or challenge_id must be set)
ALTER TABLE actionable_plans DROP CONSTRAINT IF EXISTS chk_plans_goal_xor_challenge;
ALTER TABLE actionable_plans 
ADD CONSTRAINT chk_plans_goal_xor_challenge 
CHECK (
    (goal_id IS NOT NULL AND challenge_id IS NULL) OR 
    (goal_id IS NULL AND challenge_id IS NOT NULL)
);

-- 6. Add index for efficient challenge lookups
CREATE INDEX IF NOT EXISTS idx_actionable_plans_challenge_id 
ON actionable_plans(challenge_id) WHERE challenge_id IS NOT NULL;

-- =====================================================
-- PART 2: WORKOUT_SESSIONS - Add challenge_id support
-- =====================================================

-- 1. Add challenge_id column
ALTER TABLE workout_sessions 
ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE;

-- 2. Add index for efficient challenge lookups
CREATE INDEX IF NOT EXISTS idx_workout_sessions_challenge_id 
ON workout_sessions(challenge_id) WHERE challenge_id IS NOT NULL;

-- 3. Add constraint: at least one of goal_id or challenge_id must be set
-- (allows workouts to be linked to goals OR challenges)
ALTER TABLE workout_sessions DROP CONSTRAINT IF EXISTS chk_sessions_goal_or_challenge;
ALTER TABLE workout_sessions 
ADD CONSTRAINT chk_sessions_goal_or_challenge 
CHECK (goal_id IS NOT NULL OR challenge_id IS NOT NULL);

-- =====================================================
-- PART 3: WORKOUT_FEEDBACK - Add challenge_id support
-- =====================================================

-- 1. Add challenge_id column
ALTER TABLE workout_feedback 
ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE;

-- 2. Add index for efficient challenge lookups
CREATE INDEX IF NOT EXISTS idx_workout_feedback_challenge_id 
ON workout_feedback(challenge_id) WHERE challenge_id IS NOT NULL;

-- 3. Add constraint: at least one of goal_id or challenge_id must be set
ALTER TABLE workout_feedback DROP CONSTRAINT IF EXISTS chk_feedback_goal_or_challenge;
ALTER TABLE workout_feedback 
ADD CONSTRAINT chk_feedback_goal_or_challenge 
CHECK (goal_id IS NOT NULL OR challenge_id IS NOT NULL);

-- =====================================================
-- PART 4: CHALLENGES - Add goal-like fields for standalone creation
-- =====================================================
-- Instead of embedding everything in goal_template JSONB,
-- add proper columns for the essential goal properties.

-- Category for the challenge (same as goals)
ALTER TABLE challenges 
ADD COLUMN IF NOT EXISTS category TEXT;

-- Frequency for check-ins (same as goals)
ALTER TABLE challenges 
ADD COLUMN IF NOT EXISTS frequency TEXT CHECK (frequency IN ('daily', 'weekly', 'custom'));

-- Days of week for custom frequency (same as goals)
ALTER TABLE challenges 
ADD COLUMN IF NOT EXISTS days_of_week TEXT[];

-- Target days for completion (same as goals)
ALTER TABLE challenges 
ADD COLUMN IF NOT EXISTS target_days INTEGER;

-- Target check-ins (same as goals)
ALTER TABLE challenges 
ADD COLUMN IF NOT EXISTS target_checkins INTEGER;

-- Reminder times (array of time strings)
ALTER TABLE challenges 
ADD COLUMN IF NOT EXISTS reminder_times TEXT[];

-- =====================================================
-- PART 5: DROP goal_template JSONB column
-- =====================================================
-- Since we're in development with no data, we can safely drop this.
-- The actionable_plan will be stored in actionable_plans table instead.

ALTER TABLE challenges 
DROP COLUMN IF EXISTS goal_template;

-- =====================================================
-- PART 6: Update comments for clarity
-- =====================================================

COMMENT ON COLUMN actionable_plans.goal_id IS 'Goal this plan is for (NULL if for a challenge)';
COMMENT ON COLUMN actionable_plans.challenge_id IS 'Challenge this plan is for (NULL if for a goal)';

COMMENT ON COLUMN workout_sessions.goal_id IS 'Goal this session is for (NULL if for a challenge)';
COMMENT ON COLUMN workout_sessions.challenge_id IS 'Challenge this session is for (NULL if for a goal)';

COMMENT ON COLUMN workout_feedback.goal_id IS 'Goal this feedback is for (NULL if for a challenge)';
COMMENT ON COLUMN workout_feedback.challenge_id IS 'Challenge this feedback is for (NULL if for a goal)';

COMMENT ON COLUMN challenges.category IS 'Category of the challenge (fitness, nutrition, sleep, etc.)';
COMMENT ON COLUMN challenges.frequency IS 'How often check-ins are expected (daily, weekly, custom)';
COMMENT ON COLUMN challenges.days_of_week IS 'For custom frequency, which days of the week to check in';
COMMENT ON COLUMN challenges.target_days IS 'Target number of days to complete the challenge';
COMMENT ON COLUMN challenges.target_checkins IS 'Target number of check-ins for the challenge';
COMMENT ON COLUMN challenges.reminder_times IS 'Times to send reminder notifications';

