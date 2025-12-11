-- =====================================================
-- SHARED CHALLENGES: Enable sharing goals as challenges
-- =====================================================
-- This migration adds support for:
-- 1. Converting goals to shared challenges
-- 2. Challenge check-ins (separate from goal check-ins)
-- 3. Group goal check-ins (allow multiple users per goal)

-- =====================================================
-- Part 1: Add converted_to_challenge_id to goals table
-- =====================================================
ALTER TABLE goals 
ADD COLUMN IF NOT EXISTS converted_to_challenge_id UUID REFERENCES challenges(id) ON DELETE SET NULL;

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_goals_converted_challenge 
ON goals(converted_to_challenge_id) 
WHERE converted_to_challenge_id IS NOT NULL;

COMMENT ON COLUMN goals.converted_to_challenge_id IS 
'Reference to the challenge if this goal was shared as a challenge. NULL if private.';

-- =====================================================
-- Part 2: Add goal_template and join_deadline to challenges
-- =====================================================
ALTER TABLE challenges 
ADD COLUMN IF NOT EXISTS goal_template JSONB,
ADD COLUMN IF NOT EXISTS join_deadline DATE;

COMMENT ON COLUMN challenges.goal_template IS 
'Stores the original goal properties when a goal is converted to a challenge. Used for creating the challenge definition.';

COMMENT ON COLUMN challenges.join_deadline IS 
'Optional deadline for joining the challenge. If NULL, uses start_date as deadline (lock after start policy).';

-- =====================================================
-- Part 3: Create challenge_check_ins table
-- =====================================================
-- Shared challenges use a separate check-in table because:
-- 1. Challenge check-ins are for competing, not for the original goal
-- 2. Leaderboard calculations use challenge_check_ins
-- 3. Original goal progress remains separate from challenge progress

CREATE TABLE IF NOT EXISTS challenge_check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    mood TEXT CHECK (mood IN ('great', 'good', 'okay', 'bad', 'terrible')),
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Each user can only check in once per day per challenge
    UNIQUE(challenge_id, user_id, check_in_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_challenge_check_ins_challenge_id 
ON challenge_check_ins(challenge_id);

CREATE INDEX IF NOT EXISTS idx_challenge_check_ins_user_id 
ON challenge_check_ins(user_id);

CREATE INDEX IF NOT EXISTS idx_challenge_check_ins_date 
ON challenge_check_ins(check_in_date);

-- Composite index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_challenge_check_ins_challenge_user 
ON challenge_check_ins(challenge_id, user_id);

-- Add updated_at trigger
CREATE TRIGGER update_challenge_check_ins_updated_at 
    BEFORE UPDATE ON challenge_check_ins 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Part 4: RLS Policies for challenge_check_ins
-- =====================================================
ALTER TABLE challenge_check_ins ENABLE ROW LEVEL SECURITY;

-- Users can view check-ins for challenges they're participating in
CREATE POLICY "Users can view challenge check-ins for challenges they participate in"
ON challenge_check_ins FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM challenge_participants cp
        WHERE cp.challenge_id = challenge_check_ins.challenge_id
        AND cp.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM challenges c
        WHERE c.id = challenge_check_ins.challenge_id
        AND c.is_public = true
    )
);

-- Users can create their own check-ins
CREATE POLICY "Users can create their own challenge check-ins"
ON challenge_check_ins FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM challenge_participants cp
        WHERE cp.challenge_id = challenge_check_ins.challenge_id
        AND cp.user_id = auth.uid()
    )
);

-- Users can update their own check-ins
CREATE POLICY "Users can update their own challenge check-ins"
ON challenge_check_ins FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Users can delete their own check-ins
CREATE POLICY "Users can delete their own challenge check-ins"
ON challenge_check_ins FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- =====================================================
-- Part 5: Modify check_ins unique constraint for group goals
-- =====================================================
-- Allow multiple users to check into the same goal on the same day
-- This enables group goals where team members all check in

-- First, check if the old constraint exists and drop it
-- The original constraint is UNIQUE(goal_id, date) which PostgreSQL names 'check_ins_goal_id_date_key'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_ins_goal_id_date_key'
    ) THEN
        ALTER TABLE check_ins DROP CONSTRAINT check_ins_goal_id_date_key;
    END IF;
END $$;

-- Also try to drop if named differently (in case of manual naming)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_ins_unique_constraint'
    ) THEN
        ALTER TABLE check_ins DROP CONSTRAINT check_ins_unique_constraint;
    END IF;
END $$;

-- Add new constraint that includes user_id
-- This allows: User A + Goal X + Date Y (unique)
--              User B + Goal X + Date Y (also valid - different user)
ALTER TABLE check_ins 
ADD CONSTRAINT check_ins_user_goal_date_unique 
UNIQUE(user_id, goal_id, date);

COMMENT ON CONSTRAINT check_ins_user_goal_date_unique ON check_ins IS 
'Allows multiple users to check into the same goal (for group goals) but each user can only check in once per day per goal.';

-- =====================================================
-- Part 6: Enable Realtime for challenge_check_ins
-- =====================================================
DO $$ 
BEGIN
    -- Check if table is already in the publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'challenge_check_ins'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE challenge_check_ins;
    END IF;
END $$;
