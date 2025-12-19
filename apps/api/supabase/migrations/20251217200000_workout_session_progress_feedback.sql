-- =====================================================
-- WORKOUT SESSION PROGRESS TRACKING
-- Adds fields to support pause/resume and progress persistence
-- =====================================================

-- Add progress tracking fields to workout_sessions
ALTER TABLE workout_sessions
    ADD COLUMN IF NOT EXISTS current_phase TEXT DEFAULT 'warmup' 
        CHECK (current_phase IN ('warmup', 'workout', 'cooldown', 'rest', 'completed')),
    ADD COLUMN IF NOT EXISTS current_exercise_index INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_set INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS current_round INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS completion_percentage DECIMAL(5, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP WITH TIME ZONE;

-- Add index for finding active sessions to resume
CREATE INDEX IF NOT EXISTS idx_workout_sessions_active 
    ON workout_sessions(user_id, goal_id, status) 
    WHERE status = 'in_progress';

-- Add comment for new fields
COMMENT ON COLUMN workout_sessions.current_phase IS 'Current workout phase: warmup, workout, cooldown, rest, or completed';
COMMENT ON COLUMN workout_sessions.current_exercise_index IS 'Index of current exercise in the workout (0-based)';
COMMENT ON COLUMN workout_sessions.current_set IS 'Current set number (1-based)';
COMMENT ON COLUMN workout_sessions.current_round IS 'Current circuit round for circuit-style workouts (1-based)';
COMMENT ON COLUMN workout_sessions.completion_percentage IS 'Overall workout completion percentage (0-100)';
COMMENT ON COLUMN workout_sessions.paused_at IS 'Timestamp when workout was paused (null if not paused)';

-- =====================================================
-- WORKOUT FEEDBACK TABLE
-- Collects user feedback when they quit a workout
-- =====================================================

CREATE TABLE IF NOT EXISTS workout_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES workout_sessions(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES actionable_plans(id) ON DELETE CASCADE,
    
    -- Feedback data
    quit_reason TEXT NOT NULL CHECK (quit_reason IN (
        'dont_know_how',
        'too_easy',
        'too_hard',
        'just_looking',
        'no_time',
        'other'
    )),
    additional_feedback TEXT,
    
    -- Context at time of quit
    exercises_completed INTEGER DEFAULT 0,
    completion_percentage DECIMAL(5, 2) DEFAULT 0,
    time_spent_seconds INTEGER DEFAULT 0,
    exercise_name TEXT, -- Name of exercise user was on when they quit (for AI improvement)
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_workout_feedback_user_id ON workout_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_feedback_goal_id ON workout_feedback(goal_id);
CREATE INDEX IF NOT EXISTS idx_workout_feedback_quit_reason ON workout_feedback(quit_reason);
CREATE INDEX IF NOT EXISTS idx_workout_feedback_created_at ON workout_feedback(created_at DESC);

-- Enable RLS
ALTER TABLE workout_feedback ENABLE ROW LEVEL SECURITY;

-- Users can read their own feedback
CREATE POLICY "Users can read their own workout feedback" ON workout_feedback
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own feedback
CREATE POLICY "Users can create workout feedback" ON workout_feedback
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Service role can manage all feedback
CREATE POLICY "Service role can manage workout feedback" ON workout_feedback
    FOR ALL
    USING (auth.role() = 'service_role');

-- Add comments
COMMENT ON TABLE workout_feedback IS 'Collects user feedback when they quit a workout to improve future recommendations';
COMMENT ON COLUMN workout_feedback.quit_reason IS 'Why user quit: dont_know_how, too_easy, too_hard, just_looking, no_time, or other';
COMMENT ON COLUMN workout_feedback.additional_feedback IS 'Optional free-text feedback from user';


