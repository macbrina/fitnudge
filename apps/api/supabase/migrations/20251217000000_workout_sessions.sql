-- =====================================================
-- WORKOUT SESSIONS TABLE
-- Tracks individual workout session completions
-- =====================================================

-- Create workout_sessions table
CREATE TABLE workout_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES actionable_plans(id) ON DELETE CASCADE,
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    paused_duration_seconds INTEGER DEFAULT 0,
    total_duration_seconds INTEGER,
    
    -- Progress tracking
    exercises_completed INTEGER DEFAULT 0,
    exercises_total INTEGER NOT NULL DEFAULT 0,
    exercises_skipped INTEGER DEFAULT 0,
    sets_completed INTEGER DEFAULT 0,
    sets_total INTEGER NOT NULL DEFAULT 0,
    
    -- Workout data (stores exercise-level completion details)
    workout_data JSONB DEFAULT '{}',
    
    -- Status
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX idx_workout_sessions_user_id ON workout_sessions(user_id);
CREATE INDEX idx_workout_sessions_goal_id ON workout_sessions(goal_id);
CREATE INDEX idx_workout_sessions_status ON workout_sessions(status);
CREATE INDEX idx_workout_sessions_started_at ON workout_sessions(started_at DESC);
CREATE INDEX idx_workout_sessions_user_completed ON workout_sessions(user_id, status) 
    WHERE status = 'completed';

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_workout_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_workout_sessions_updated_at
    BEFORE UPDATE ON workout_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_workout_sessions_updated_at();

-- Enable RLS
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;

-- Users can read their own workout sessions
CREATE POLICY "Users can read their own workout sessions" ON workout_sessions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own workout sessions
CREATE POLICY "Users can create their own workout sessions" ON workout_sessions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own workout sessions
CREATE POLICY "Users can update their own workout sessions" ON workout_sessions
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Service role can manage all workout sessions
CREATE POLICY "Service role can manage workout sessions" ON workout_sessions
    FOR ALL
    USING (auth.role() = 'service_role');

-- Add comments for documentation
COMMENT ON TABLE workout_sessions IS 'Tracks individual workout session completions with timing and progress data';
COMMENT ON COLUMN workout_sessions.paused_duration_seconds IS 'Total time the workout was paused';
COMMENT ON COLUMN workout_sessions.total_duration_seconds IS 'Actual workout duration (excluding pauses)';
COMMENT ON COLUMN workout_sessions.workout_data IS 'JSON containing exercise-level completion details';
COMMENT ON COLUMN workout_sessions.status IS 'Session status: in_progress, completed, or abandoned';

