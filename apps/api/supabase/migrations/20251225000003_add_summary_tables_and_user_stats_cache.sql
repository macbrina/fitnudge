-- =====================================================
-- Add Summary Tables for Check-ins, Workouts, and User Stats Cache
-- =====================================================
-- Migration: 20251225000003_add_summary_tables_and_user_stats_cache.sql
-- Purpose: 
--   1. Create daily_checkin_summaries for aggregated check-in data
--   2. Create daily_workout_summaries for aggregated workout data
--   3. Create user_stats_cache for global user statistics
--   4. All tables maintained by triggers for real-time updates
--   5. Backfill existing data
-- =====================================================

-- =====================================================
-- PART 1: Create daily_checkin_summaries table
-- =====================================================
-- This table aggregates check-ins by user+goal/challenge+date
-- Used for faster home dashboard loading and streak calculations

CREATE TABLE IF NOT EXISTS daily_checkin_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
    summary_date DATE NOT NULL,
    
    -- Aggregated metrics
    scheduled_count INTEGER NOT NULL DEFAULT 0,    -- Total scheduled for the day
    completed_count INTEGER NOT NULL DEFAULT 0,    -- Completed check-ins
    avg_mood NUMERIC(3, 2),                        -- Average mood (1.0-5.0)
    has_photo BOOLEAN DEFAULT FALSE,               -- Whether any check-in has photo
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint (one row per user+goal+date)
CREATE UNIQUE INDEX IF NOT EXISTS daily_checkin_summaries_unique_idx 
ON daily_checkin_summaries (
    user_id, 
    COALESCE(goal_id, '00000000-0000-0000-0000-000000000000'::uuid),
    summary_date
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_daily_checkin_user_id 
ON daily_checkin_summaries(user_id);

CREATE INDEX IF NOT EXISTS idx_daily_checkin_goal_id 
ON daily_checkin_summaries(goal_id);

CREATE INDEX IF NOT EXISTS idx_daily_checkin_date 
ON daily_checkin_summaries(summary_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_checkin_user_date 
ON daily_checkin_summaries(user_id, summary_date DESC);

-- Trigger for updated_at
CREATE TRIGGER update_daily_checkin_summaries_updated_at 
    BEFORE UPDATE ON daily_checkin_summaries 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update daily check-in summary
CREATE OR REPLACE FUNCTION update_daily_checkin_summary()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_goal_id UUID;
    v_check_in_date DATE;
BEGIN
    -- Get the relevant values from NEW or OLD
    v_user_id := COALESCE(NEW.user_id, OLD.user_id);
    v_goal_id := COALESCE(NEW.goal_id, OLD.goal_id);
    v_check_in_date := COALESCE(NEW.check_in_date, OLD.check_in_date);
    
    -- Aggregate and upsert the summary
    INSERT INTO daily_checkin_summaries (
        user_id,
        goal_id,
        summary_date,
        scheduled_count,
        completed_count,
        avg_mood,
        has_photo
    )
    SELECT
        v_user_id,
        v_goal_id,
        v_check_in_date,
        COUNT(*),
        COUNT(*) FILTER (WHERE completed = true OR is_checked_in = true),
        AVG(CASE 
            WHEN mood IS NOT NULL THEN 
                CASE mood::text
                    WHEN 'terrible' THEN 1
                    WHEN 'bad' THEN 2
                    WHEN 'okay' THEN 3
                    WHEN 'good' THEN 4
                    WHEN 'great' THEN 5
                    ELSE mood::numeric
                END
            ELSE NULL
        END),
        BOOL_OR(photo_url IS NOT NULL)
    FROM check_ins
    WHERE user_id = v_user_id
        AND check_in_date = v_check_in_date
        AND (
            (goal_id IS NULL AND v_goal_id IS NULL) 
            OR goal_id = v_goal_id
        )
    GROUP BY v_user_id, v_goal_id, v_check_in_date
    ON CONFLICT (
        user_id, 
        COALESCE(goal_id, '00000000-0000-0000-0000-000000000000'::uuid),
        summary_date
    ) 
    DO UPDATE SET
        scheduled_count = EXCLUDED.scheduled_count,
        completed_count = EXCLUDED.completed_count,
        avg_mood = EXCLUDED.avg_mood,
        has_photo = EXCLUDED.has_photo,
        updated_at = NOW();
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for check_ins table
CREATE TRIGGER trigger_update_daily_checkin_summary
    AFTER INSERT OR UPDATE OR DELETE ON check_ins
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_checkin_summary();

-- =====================================================
-- PART 2: Create daily_workout_summaries table
-- =====================================================
-- This table aggregates workout sessions by user+goal/challenge+date

CREATE TABLE IF NOT EXISTS daily_workout_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
    challenge_id UUID REFERENCES challenges(id) ON DELETE SET NULL,
    summary_date DATE NOT NULL,
    
    -- Aggregated metrics
    workout_count INTEGER NOT NULL DEFAULT 0,           -- Number of completed workouts
    total_duration_seconds INTEGER NOT NULL DEFAULT 0,  -- Total workout duration
    total_exercises_completed INTEGER DEFAULT 0,        -- Total exercises done
    total_sets_completed INTEGER DEFAULT 0,             -- Total sets done
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS daily_workout_summaries_unique_idx 
ON daily_workout_summaries (
    user_id, 
    COALESCE(goal_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(challenge_id, '00000000-0000-0000-0000-000000000000'::uuid),
    summary_date
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_daily_workout_user_id 
ON daily_workout_summaries(user_id);

CREATE INDEX IF NOT EXISTS idx_daily_workout_goal_id 
ON daily_workout_summaries(goal_id);

CREATE INDEX IF NOT EXISTS idx_daily_workout_challenge_id 
ON daily_workout_summaries(challenge_id);

CREATE INDEX IF NOT EXISTS idx_daily_workout_date 
ON daily_workout_summaries(summary_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_workout_user_date 
ON daily_workout_summaries(user_id, summary_date DESC);

-- Trigger for updated_at
CREATE TRIGGER update_daily_workout_summaries_updated_at 
    BEFORE UPDATE ON daily_workout_summaries 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update daily workout summary
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
        total_sets_completed
    )
    SELECT
        v_user_id,
        v_goal_id,
        v_challenge_id,
        v_workout_date,
        COUNT(*),
        COALESCE(SUM(total_duration_seconds), 0),
        COALESCE(SUM(exercises_completed), 0),
        COALESCE(SUM(sets_completed), 0)
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
        updated_at = NOW();
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for workout_sessions table
CREATE TRIGGER trigger_update_daily_workout_summary
    AFTER INSERT OR UPDATE OR DELETE ON workout_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_workout_summary();

-- =====================================================
-- PART 3: Create user_stats_cache table
-- =====================================================
-- Single row per user with global statistics
-- Updated by triggers on check_ins, challenge_check_ins, goals, challenges

CREATE TABLE IF NOT EXISTS user_stats_cache (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    -- Goal & Challenge counts
    active_goals_count INTEGER DEFAULT 0,
    active_challenges_count INTEGER DEFAULT 0,
    completed_goals_count INTEGER DEFAULT 0,
    completed_challenges_count INTEGER DEFAULT 0,
    
    -- Check-in stats
    total_goal_checkins INTEGER DEFAULT 0,
    total_challenge_checkins INTEGER DEFAULT 0,
    total_checkins INTEGER GENERATED ALWAYS AS (total_goal_checkins + total_challenge_checkins) STORED,
    
    -- Streak data (calculated daily or on check-in)
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_checkin_date DATE,
    
    -- Completion rate (last 30 days)
    completion_rate_30d NUMERIC(5, 2) DEFAULT 0.0,
    scheduled_30d INTEGER DEFAULT 0,
    completed_30d INTEGER DEFAULT 0,
    
    -- Workout stats
    total_workouts INTEGER DEFAULT 0,
    total_workout_minutes INTEGER DEFAULT 0,
    
    -- Meal & Hydration stats
    total_meals_logged INTEGER DEFAULT 0,
    total_hydration_logs INTEGER DEFAULT 0,
    
    -- Last update timestamp
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_user_stats_cache_updated_at 
ON user_stats_cache(updated_at DESC);

-- =====================================================
-- PART 4: Functions to update user_stats_cache
-- =====================================================

-- Helper function to recalculate streak for a user
CREATE OR REPLACE FUNCTION calculate_user_streak(p_user_id UUID)
RETURNS TABLE(current_streak INTEGER, longest_streak INTEGER, last_date DATE) AS $$
DECLARE
    v_streak INTEGER := 0;
    v_max_streak INTEGER := 0;
    v_last_date DATE;
    v_check_date DATE;
    v_yesterday DATE;
    v_checkin_dates DATE[];
BEGIN
    -- Combine all check-in dates from goals and challenges
    SELECT ARRAY_AGG(DISTINCT d ORDER BY d DESC) INTO v_checkin_dates
    FROM (
        SELECT check_in_date AS d FROM check_ins 
        WHERE user_id = p_user_id AND (completed = true OR is_checked_in = true)
        UNION
        SELECT check_in_date AS d FROM challenge_check_ins 
        WHERE user_id = p_user_id AND is_checked_in = true
    ) AS dates;
    
    IF v_checkin_dates IS NULL OR array_length(v_checkin_dates, 1) = 0 THEN
        RETURN QUERY SELECT 0, 0, NULL::DATE;
        RETURN;
    END IF;
    
    v_last_date := v_checkin_dates[1];
    v_check_date := CURRENT_DATE;
    v_yesterday := CURRENT_DATE - INTERVAL '1 day';
    
    -- If not checked in today or yesterday, streak is 0
    IF v_last_date < v_yesterday THEN
        -- Find longest historical streak
        v_streak := 0;
        FOR i IN 1..array_length(v_checkin_dates, 1) LOOP
            IF i = 1 THEN
                v_streak := 1;
            ELSIF v_checkin_dates[i-1] - v_checkin_dates[i] = 1 THEN
                v_streak := v_streak + 1;
            ELSE
                v_max_streak := GREATEST(v_max_streak, v_streak);
                v_streak := 1;
            END IF;
        END LOOP;
        v_max_streak := GREATEST(v_max_streak, v_streak);
        
        RETURN QUERY SELECT 0, v_max_streak, v_last_date;
        RETURN;
    END IF;
    
    -- Count current streak
    v_check_date := v_last_date;
    v_streak := 0;
    
    FOR i IN 1..array_length(v_checkin_dates, 1) LOOP
        IF v_checkin_dates[i] = v_check_date THEN
            v_streak := v_streak + 1;
            v_check_date := v_check_date - INTERVAL '1 day';
        ELSIF v_checkin_dates[i] < v_check_date THEN
            EXIT;
        END IF;
    END LOOP;
    
    -- Calculate longest streak
    v_max_streak := v_streak;
    DECLARE
        v_temp_streak INTEGER := 0;
    BEGIN
        FOR i IN 1..array_length(v_checkin_dates, 1) LOOP
            IF i = 1 THEN
                v_temp_streak := 1;
            ELSIF v_checkin_dates[i-1] - v_checkin_dates[i] = 1 THEN
                v_temp_streak := v_temp_streak + 1;
            ELSE
                v_max_streak := GREATEST(v_max_streak, v_temp_streak);
                v_temp_streak := 1;
            END IF;
        END LOOP;
        v_max_streak := GREATEST(v_max_streak, v_temp_streak);
    END;
    
    RETURN QUERY SELECT v_streak, v_max_streak, v_last_date;
END;
$$ LANGUAGE plpgsql;

-- Main function to refresh user stats cache
CREATE OR REPLACE FUNCTION refresh_user_stats_cache(p_user_id UUID)
RETURNS void AS $$
DECLARE
    v_active_goals INTEGER;
    v_active_challenges INTEGER;
    v_completed_goals INTEGER;
    v_completed_challenges INTEGER;
    v_total_goal_checkins INTEGER;
    v_total_challenge_checkins INTEGER;
    v_current_streak INTEGER;
    v_longest_streak INTEGER;
    v_last_checkin_date DATE;
    v_scheduled_30d INTEGER;
    v_completed_30d INTEGER;
    v_completion_rate NUMERIC(5, 2);
    v_total_workouts INTEGER;
    v_total_workout_minutes INTEGER;
    v_total_meals INTEGER;
    v_total_hydration INTEGER;
    v_thirty_days_ago DATE := CURRENT_DATE - INTERVAL '30 days';
BEGIN
    -- Count active goals
    SELECT COUNT(*) INTO v_active_goals
    FROM goals WHERE user_id = p_user_id AND status = 'active';
    
    -- Count active challenges (user is participant)
    SELECT COUNT(*) INTO v_active_challenges
    FROM challenge_participants cp
    JOIN challenges c ON c.id = cp.challenge_id
    WHERE cp.user_id = p_user_id AND c.status IN ('active', 'upcoming');
    
    -- Count completed goals
    SELECT COUNT(*) INTO v_completed_goals
    FROM goals WHERE user_id = p_user_id AND status = 'completed';
    
    -- Count completed challenges
    SELECT COUNT(*) INTO v_completed_challenges
    FROM challenge_participants cp
    JOIN challenges c ON c.id = cp.challenge_id
    WHERE cp.user_id = p_user_id AND c.status = 'completed';
    
    -- Total goal check-ins (completed)
    SELECT COUNT(*) INTO v_total_goal_checkins
    FROM check_ins WHERE user_id = p_user_id AND (completed = true OR is_checked_in = true);
    
    -- Total challenge check-ins (completed)
    SELECT COUNT(*) INTO v_total_challenge_checkins
    FROM challenge_check_ins WHERE user_id = p_user_id AND is_checked_in = true;
    
    -- Calculate streak
    SELECT current_streak, longest_streak, last_date 
    INTO v_current_streak, v_longest_streak, v_last_checkin_date
    FROM calculate_user_streak(p_user_id);
    
    -- 30-day completion rate
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE completed = true OR is_checked_in = true)
    INTO v_scheduled_30d, v_completed_30d
    FROM check_ins 
    WHERE user_id = p_user_id AND check_in_date >= v_thirty_days_ago;
    
    IF v_scheduled_30d > 0 THEN
        v_completion_rate := ROUND((v_completed_30d::NUMERIC / v_scheduled_30d) * 100, 2);
    ELSE
        v_completion_rate := 0;
    END IF;
    
    -- Total workouts
    SELECT 
        COUNT(*),
        COALESCE(SUM(total_duration_seconds), 0) / 60
    INTO v_total_workouts, v_total_workout_minutes
    FROM workout_sessions 
    WHERE user_id = p_user_id AND status = 'completed';
    
    -- Total meals
    SELECT COUNT(*) INTO v_total_meals
    FROM meal_logs WHERE user_id = p_user_id;
    
    -- Total hydration logs
    SELECT COUNT(*) INTO v_total_hydration
    FROM hydration_logs WHERE user_id = p_user_id;
    
    -- Upsert the cache
    INSERT INTO user_stats_cache (
        user_id,
        active_goals_count,
        active_challenges_count,
        completed_goals_count,
        completed_challenges_count,
        total_goal_checkins,
        total_challenge_checkins,
        current_streak,
        longest_streak,
        last_checkin_date,
        completion_rate_30d,
        scheduled_30d,
        completed_30d,
        total_workouts,
        total_workout_minutes,
        total_meals_logged,
        total_hydration_logs,
        updated_at
    ) VALUES (
        p_user_id,
        v_active_goals,
        v_active_challenges,
        v_completed_goals,
        v_completed_challenges,
        v_total_goal_checkins,
        v_total_challenge_checkins,
        v_current_streak,
        v_longest_streak,
        v_last_checkin_date,
        v_completion_rate,
        v_scheduled_30d,
        v_completed_30d,
        v_total_workouts,
        v_total_workout_minutes,
        v_total_meals,
        v_total_hydration,
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        active_goals_count = EXCLUDED.active_goals_count,
        active_challenges_count = EXCLUDED.active_challenges_count,
        completed_goals_count = EXCLUDED.completed_goals_count,
        completed_challenges_count = EXCLUDED.completed_challenges_count,
        total_goal_checkins = EXCLUDED.total_goal_checkins,
        total_challenge_checkins = EXCLUDED.total_challenge_checkins,
        current_streak = EXCLUDED.current_streak,
        longest_streak = EXCLUDED.longest_streak,
        last_checkin_date = EXCLUDED.last_checkin_date,
        completion_rate_30d = EXCLUDED.completion_rate_30d,
        scheduled_30d = EXCLUDED.scheduled_30d,
        completed_30d = EXCLUDED.completed_30d,
        total_workouts = EXCLUDED.total_workouts,
        total_workout_minutes = EXCLUDED.total_workout_minutes,
        total_meals_logged = EXCLUDED.total_meals_logged,
        total_hydration_logs = EXCLUDED.total_hydration_logs,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger function for goal/challenge check-ins
CREATE OR REPLACE FUNCTION trigger_refresh_user_stats_on_checkin()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM refresh_user_stats_cache(COALESCE(NEW.user_id, OLD.user_id));
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger function for goals
CREATE OR REPLACE FUNCTION trigger_refresh_user_stats_on_goal()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM refresh_user_stats_cache(COALESCE(NEW.user_id, OLD.user_id));
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger function for challenge participants
CREATE OR REPLACE FUNCTION trigger_refresh_user_stats_on_challenge_participant()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM refresh_user_stats_cache(COALESCE(NEW.user_id, OLD.user_id));
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger function for workouts
CREATE OR REPLACE FUNCTION trigger_refresh_user_stats_on_workout()
RETURNS TRIGGER AS $$
BEGIN
    -- Only refresh if status changed to completed
    IF (TG_OP = 'INSERT' AND NEW.status = 'completed') OR
       (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') OR
       (TG_OP = 'DELETE' AND OLD.status = 'completed') THEN
        PERFORM refresh_user_stats_cache(COALESCE(NEW.user_id, OLD.user_id));
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger function for meals/hydration
CREATE OR REPLACE FUNCTION trigger_refresh_user_stats_on_tracking()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM refresh_user_stats_cache(COALESCE(NEW.user_id, OLD.user_id));
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for user_stats_cache updates
CREATE TRIGGER trigger_user_stats_on_checkin
    AFTER INSERT OR UPDATE OR DELETE ON check_ins
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_user_stats_on_checkin();

CREATE TRIGGER trigger_user_stats_on_challenge_checkin
    AFTER INSERT OR UPDATE OR DELETE ON challenge_check_ins
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_user_stats_on_checkin();

CREATE TRIGGER trigger_user_stats_on_goal
    AFTER INSERT OR UPDATE OR DELETE ON goals
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_user_stats_on_goal();

CREATE TRIGGER trigger_user_stats_on_challenge_participant
    AFTER INSERT OR UPDATE OR DELETE ON challenge_participants
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_user_stats_on_challenge_participant();

CREATE TRIGGER trigger_user_stats_on_workout
    AFTER INSERT OR UPDATE OR DELETE ON workout_sessions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_user_stats_on_workout();

CREATE TRIGGER trigger_user_stats_on_meal
    AFTER INSERT OR DELETE ON meal_logs
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_user_stats_on_tracking();

CREATE TRIGGER trigger_user_stats_on_hydration
    AFTER INSERT OR DELETE ON hydration_logs
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_user_stats_on_tracking();

-- =====================================================
-- PART 5: Enable RLS on new tables
-- =====================================================

ALTER TABLE daily_checkin_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_workout_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "daily_checkin_summaries_all"
ON daily_checkin_summaries FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_workout_summaries_all"
ON daily_workout_summaries FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_stats_cache_all"
ON user_stats_cache FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- PART 6: Enable Realtime for new tables
-- =====================================================

-- Helper function
CREATE OR REPLACE FUNCTION add_table_to_realtime_if_not_exists(table_name TEXT)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = table_name
  ) THEN
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', table_name);
  END IF;
END;
$$ LANGUAGE plpgsql;

SELECT add_table_to_realtime_if_not_exists('daily_checkin_summaries');
SELECT add_table_to_realtime_if_not_exists('daily_workout_summaries');
SELECT add_table_to_realtime_if_not_exists('user_stats_cache');

-- Set REPLICA IDENTITY FULL for complete row data on events
ALTER TABLE daily_checkin_summaries REPLICA IDENTITY FULL;
ALTER TABLE daily_workout_summaries REPLICA IDENTITY FULL;
ALTER TABLE user_stats_cache REPLICA IDENTITY FULL;

-- Clean up helper function
DROP FUNCTION IF EXISTS add_table_to_realtime_if_not_exists(TEXT);

-- =====================================================
-- PART 7: Backfill existing data
-- =====================================================

-- Backfill daily_checkin_summaries from existing check_ins
INSERT INTO daily_checkin_summaries (
    user_id,
    goal_id,
    summary_date,
    scheduled_count,
    completed_count,
    avg_mood,
    has_photo
)
SELECT
    user_id,
    goal_id,
    check_in_date,
    COUNT(*),
    COUNT(*) FILTER (WHERE completed = true OR is_checked_in = true),
    AVG(CASE 
        WHEN mood IS NOT NULL THEN 
            CASE mood::text
                WHEN 'terrible' THEN 1
                WHEN 'bad' THEN 2
                WHEN 'okay' THEN 3
                WHEN 'good' THEN 4
                WHEN 'great' THEN 5
                ELSE mood::numeric
            END
        ELSE NULL
    END),
    BOOL_OR(photo_url IS NOT NULL)
FROM check_ins
GROUP BY user_id, goal_id, check_in_date
ON CONFLICT (
    user_id, 
    COALESCE(goal_id, '00000000-0000-0000-0000-000000000000'::uuid),
    summary_date
) DO NOTHING;

-- Backfill daily_workout_summaries from existing workout_sessions
INSERT INTO daily_workout_summaries (
    user_id,
    goal_id,
    challenge_id,
    summary_date,
    workout_count,
    total_duration_seconds,
    total_exercises_completed,
    total_sets_completed
)
SELECT
    user_id,
    goal_id,
    challenge_id,
    (completed_at AT TIME ZONE 'UTC')::DATE,
    COUNT(*),
    COALESCE(SUM(total_duration_seconds), 0),
    COALESCE(SUM(exercises_completed), 0),
    COALESCE(SUM(sets_completed), 0)
FROM workout_sessions
WHERE status = 'completed' AND completed_at IS NOT NULL
GROUP BY user_id, goal_id, challenge_id, (completed_at AT TIME ZONE 'UTC')::DATE
ON CONFLICT (
    user_id, 
    COALESCE(goal_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(challenge_id, '00000000-0000-0000-0000-000000000000'::uuid),
    summary_date
) DO NOTHING;

-- Backfill user_stats_cache for all existing users
DO $$
DECLARE
    v_user RECORD;
BEGIN
    FOR v_user IN SELECT id FROM users LOOP
        PERFORM refresh_user_stats_cache(v_user.id);
    END LOOP;
END $$;


