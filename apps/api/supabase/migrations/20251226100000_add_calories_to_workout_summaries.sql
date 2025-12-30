-- =====================================================
-- Add Calories Burned to Daily Workout Summaries
-- =====================================================
-- Migration: 20251226100000_add_calories_to_workout_summaries.sql
-- Purpose: 
--   1. Add total_calories_burned column to daily_workout_summaries
--   2. Update the trigger to aggregate calories
--   3. Backfill existing data
-- =====================================================

-- =====================================================
-- PART 1: Add column
-- =====================================================

ALTER TABLE daily_workout_summaries
ADD COLUMN IF NOT EXISTS total_calories_burned INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN daily_workout_summaries.total_calories_burned IS 'Total estimated calories burned from all workouts on this day';

-- =====================================================
-- PART 2: Update the trigger function to include calories
-- =====================================================

CREATE OR REPLACE FUNCTION update_daily_workout_summary()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_goal_id UUID;
    v_challenge_id UUID;
    v_workout_date DATE;
BEGIN
    -- Get the relevant values from NEW or OLD
    v_user_id := COALESCE(NEW.user_id, OLD.user_id);
    v_goal_id := COALESCE(NEW.goal_id, OLD.goal_id);
    v_challenge_id := COALESCE(NEW.challenge_id, OLD.challenge_id);
    v_workout_date := COALESCE(
        (NEW.completed_at AT TIME ZONE 'UTC')::DATE,
        (OLD.completed_at AT TIME ZONE 'UTC')::DATE,
        (NEW.started_at AT TIME ZONE 'UTC')::DATE,
        (OLD.started_at AT TIME ZONE 'UTC')::DATE
    );
    
    -- Only aggregate if we have a valid date
    IF v_workout_date IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Aggregate and upsert the summary (only count completed workouts)
    INSERT INTO daily_workout_summaries (
        user_id,
        goal_id,
        challenge_id,
        summary_date,
        workout_count,
        total_duration_seconds,
        total_exercises_completed,
        total_sets_completed,
        total_calories_burned
    )
    SELECT
        v_user_id,
        v_goal_id,
        v_challenge_id,
        v_workout_date,
        COUNT(*),
        COALESCE(SUM(total_duration_seconds), 0),
        COALESCE(SUM(exercises_completed), 0),
        COALESCE(SUM(sets_completed), 0),
        COALESCE(SUM(calories_burned), 0)
    FROM workout_sessions
    WHERE user_id = v_user_id
        AND status = 'completed'
        AND (completed_at AT TIME ZONE 'UTC')::DATE = v_workout_date
        AND (
            (goal_id IS NULL AND v_goal_id IS NULL) 
            OR goal_id = v_goal_id
        )
        AND (
            (challenge_id IS NULL AND v_challenge_id IS NULL) 
            OR challenge_id = v_challenge_id
        )
    GROUP BY v_user_id, v_goal_id, v_challenge_id, v_workout_date
    ON CONFLICT (
        user_id, 
        COALESCE(goal_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(challenge_id, '00000000-0000-0000-0000-000000000000'::uuid),
        summary_date
    ) 
    DO UPDATE SET
        workout_count = EXCLUDED.workout_count,
        total_duration_seconds = EXCLUDED.total_duration_seconds,
        total_exercises_completed = EXCLUDED.total_exercises_completed,
        total_sets_completed = EXCLUDED.total_sets_completed,
        total_calories_burned = EXCLUDED.total_calories_burned,
        updated_at = NOW();
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 3: Backfill existing data
-- =====================================================

-- Update existing summaries with calories from workout_sessions
UPDATE daily_workout_summaries dws
SET total_calories_burned = COALESCE(ws_agg.total_calories, 0)
FROM (
    SELECT 
        user_id,
        goal_id,
        challenge_id,
        (completed_at AT TIME ZONE 'UTC')::DATE as workout_date,
        SUM(COALESCE(calories_burned, 0)) as total_calories
    FROM workout_sessions
    WHERE status = 'completed'
        AND completed_at IS NOT NULL
    GROUP BY user_id, goal_id, challenge_id, (completed_at AT TIME ZONE 'UTC')::DATE
) ws_agg
WHERE dws.user_id = ws_agg.user_id
    AND dws.summary_date = ws_agg.workout_date
    AND (
        (dws.goal_id IS NULL AND ws_agg.goal_id IS NULL) 
        OR dws.goal_id = ws_agg.goal_id
    )
    AND (
        (dws.challenge_id IS NULL AND ws_agg.challenge_id IS NULL) 
        OR dws.challenge_id = ws_agg.challenge_id
    );

