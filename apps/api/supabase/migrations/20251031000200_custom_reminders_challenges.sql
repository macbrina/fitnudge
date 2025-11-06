-- =====================================================
-- CUSTOM REMINDER MESSAGES
-- =====================================================

-- Add custom_reminder_message to goals table
ALTER TABLE goals
ADD COLUMN custom_reminder_message TEXT;

-- Add index for querying goals with custom messages
CREATE INDEX idx_goals_custom_reminder ON goals(custom_reminder_message) WHERE custom_reminder_message IS NOT NULL;

-- =====================================================
-- CHALLENGES SYSTEM
-- =====================================================

-- Create challenges table
CREATE TABLE challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    challenge_type TEXT NOT NULL CHECK (challenge_type IN ('streak', 'checkin_count', 'community', 'custom')),
    duration_days INTEGER NOT NULL, -- Challenge duration (e.g., 21 for 21-day challenge)
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_public BOOLEAN DEFAULT true, -- Public challenges appear in community
    is_active BOOLEAN DEFAULT true,
    max_participants INTEGER, -- NULL means unlimited
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}', -- Additional challenge data (rules, prizes, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure dates are valid
    CHECK (end_date >= start_date)
);

-- Create challenge_participants table
CREATE TABLE challenge_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES goals(id) ON DELETE SET NULL, -- Goal used for this challenge
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    progress_data JSONB DEFAULT '{}', -- Track progress (streak, check-ins, etc.)
    rank INTEGER, -- Current rank in leaderboard
    points INTEGER DEFAULT 0, -- Points earned in challenge
    completed_at TIMESTAMP WITH TIME ZONE, -- When challenge was completed
    
    -- Ensure user can only join once
    UNIQUE(challenge_id, user_id)
);

-- Create challenge_leaderboard table (materialized view alternative)
CREATE TABLE challenge_leaderboard (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL,
    points INTEGER DEFAULT 0,
    progress_data JSONB DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one entry per user per challenge
    UNIQUE(challenge_id, user_id)
);

-- Add indexes
CREATE INDEX idx_challenges_active ON challenges(is_active, start_date, end_date);
CREATE INDEX idx_challenges_public ON challenges(is_public, is_active) WHERE is_public = true;
CREATE INDEX idx_challenge_participants_challenge_id ON challenge_participants(challenge_id);
CREATE INDEX idx_challenge_participants_user_id ON challenge_participants(user_id);
CREATE INDEX idx_challenge_participants_points ON challenge_participants(challenge_id, points DESC);
CREATE INDEX idx_challenge_leaderboard_challenge_id ON challenge_leaderboard(challenge_id, rank);
CREATE INDEX idx_challenge_leaderboard_user_id ON challenge_leaderboard(user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_challenges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_challenges_updated_at
    BEFORE UPDATE ON challenges
    FOR EACH ROW
    EXECUTE FUNCTION update_challenges_updated_at();

-- Enable RLS
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_leaderboard ENABLE ROW LEVEL SECURITY;

-- Anyone can read active public challenges
CREATE POLICY "Anyone can read active public challenges" ON challenges
    FOR SELECT
    USING (is_public = true AND is_active = true);

-- Users can read their own challenges (even if not public)
CREATE POLICY "Users can read their own challenges" ON challenges
    FOR SELECT
    USING (created_by = auth.uid());

-- Users can create challenges
CREATE POLICY "Users can create challenges" ON challenges
    FOR INSERT
    WITH CHECK (created_by = auth.uid() OR auth.role() = 'service_role');

-- Challenge creators can update their challenges
CREATE POLICY "Challenge creators can update their challenges" ON challenges
    FOR UPDATE
    USING (created_by = auth.uid() OR auth.role() = 'service_role');

-- Users can read challenge participants
CREATE POLICY "Users can read challenge participants" ON challenge_participants
    FOR SELECT
    USING (
        -- Users can see participants of challenges they're in or public challenges
        EXISTS (
            SELECT 1 FROM challenge_participants cp
            WHERE cp.challenge_id = challenge_participants.challenge_id
            AND cp.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM challenges c
            WHERE c.id = challenge_participants.challenge_id
            AND c.is_public = true
        )
        OR auth.role() = 'service_role'
    );

-- Users can join challenges
CREATE POLICY "Users can join challenges" ON challenge_participants
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own participation
CREATE POLICY "Users can update their own participation" ON challenge_participants
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Service role can manage everything
CREATE POLICY "Service role can manage challenges" ON challenges
    FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage challenge participants" ON challenge_participants
    FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage leaderboard" ON challenge_leaderboard
    FOR ALL
    USING (auth.role() = 'service_role');

