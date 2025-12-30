-- =====================================================
-- WORKOUT SESSION IMPROVEMENTS
-- Add practice mode, better tracking, and session limits
-- =====================================================

-- Add is_practice_session flag to workout_sessions
-- Practice sessions don't count for streaks or achievements
ALTER TABLE workout_sessions
ADD COLUMN IF NOT EXISTS is_practice_session BOOLEAN DEFAULT FALSE;

-- Add actual_exercise_time_seconds to track real exercise time
-- (total duration - paused - skipped exercise durations)
ALTER TABLE workout_sessions
ADD COLUMN IF NOT EXISTS actual_exercise_time_seconds INTEGER DEFAULT 0;

-- Add exercise_durations to track time spent on each exercise
-- Stored as JSONB: {"exercise_id": duration_seconds, ...}
ALTER TABLE workout_sessions
ADD COLUMN IF NOT EXISTS exercise_durations JSONB DEFAULT '{}';

-- Add calories_burned estimate
ALTER TABLE workout_sessions
ADD COLUMN IF NOT EXISTS calories_burned INTEGER DEFAULT 0;

-- Add feedback rating (how the workout felt)
ALTER TABLE workout_sessions
ADD COLUMN IF NOT EXISTS feedback_rating TEXT CHECK (feedback_rating IN ('hard', 'just_right', 'easy'));

-- Create index for querying practice vs real sessions
CREATE INDEX IF NOT EXISTS idx_workout_sessions_practice 
ON workout_sessions(user_id, is_practice_session, status);

-- Create index for daily session count queries
-- Using started_at directly since DATE() is not immutable
-- Queries will filter by date range instead
CREATE INDEX IF NOT EXISTS idx_workout_sessions_daily 
ON workout_sessions(user_id, goal_id, started_at, status);

-- Add comment for documentation
COMMENT ON COLUMN workout_sessions.is_practice_session IS 'True if this is an extra session beyond the scheduled limit for the day. Practice sessions do not count towards streaks or achievements.';
COMMENT ON COLUMN workout_sessions.actual_exercise_time_seconds IS 'Actual time spent exercising (excludes paused time, rest periods, and skipped exercises)';
COMMENT ON COLUMN workout_sessions.exercise_durations IS 'JSON object mapping exercise names to duration in seconds for detailed tracking';
COMMENT ON COLUMN workout_sessions.calories_burned IS 'Estimated calories burned during the workout';
COMMENT ON COLUMN workout_sessions.feedback_rating IS 'User feedback on workout difficulty: hard, just_right, or easy';

