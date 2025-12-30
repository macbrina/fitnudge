-- =====================================================
-- Migration: 20251227000005_create_goal_statistics.sql
-- Purpose: Create goal_statistics table for cached per-goal metrics
--          Similar to user_stats_cache but at the goal level
--          Maintained by triggers for real-time updates
-- =====================================================

-- =====================================================
-- PART 1: Create goal_statistics table
-- =====================================================

CREATE TABLE IF NOT EXISTS goal_statistics (
    goal_id UUID PRIMARY KEY REFERENCES goals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Streak data
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_checkin_date DATE,
    streak_start_date DATE,
    
    -- Completion metrics
    total_checkins INTEGER DEFAULT 0,
    completed_checkins INTEGER DEFAULT 0,
    completion_rate DECIMAL(5,2) DEFAULT 0.00,
    
    -- Time-windowed metrics for quick stats
    checkins_last_7d INTEGER DEFAULT 0,
    checkins_last_30d INTEGER DEFAULT 0,
    completion_rate_7d DECIMAL(5,2) DEFAULT 0.00,
    completion_rate_30d DECIMAL(5,2) DEFAULT 0.00,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_goal_statistics_user_id ON goal_statistics(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_statistics_updated_at ON goal_statistics(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_goal_statistics_current_streak ON goal_statistics(current_streak DESC);

-- =====================================================
-- PART 2: Function to calculate and refresh goal statistics
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_goal_statistics(p_goal_id UUID)
RETURNS void AS $$
DECLARE
    v_user_id UUID;
    v_total_checkins INTEGER;
    v_completed_checkins INTEGER;
    v_completion_rate DECIMAL(5,2);
    v_checkins_7d INTEGER;
    v_checkins_30d INTEGER;
    v_completed_7d INTEGER;
    v_completed_30d INTEGER;
    v_completion_rate_7d DECIMAL(5,2);
    v_completion_rate_30d DECIMAL(5,2);
    v_current_streak INTEGER;
    v_longest_streak INTEGER;
    v_last_checkin_date DATE;
    v_streak_start_date DATE;
    v_today DATE := CURRENT_DATE;
    v_check_date DATE;
    v_temp_streak INTEGER;
    v_streak_started BOOLEAN;
    v_completed_dates DATE[];
    v_sorted_dates DATE[];
    v_prev_date DATE;
    v_d DATE;
BEGIN
    -- Get user_id for this goal
    SELECT user_id INTO v_user_id FROM goals WHERE id = p_goal_id;
    
    IF v_user_id IS NULL THEN
        -- Goal doesn't exist, nothing to do
        RETURN;
    END IF;
    
    -- Get total check-ins count
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE completed = true)
    INTO v_total_checkins, v_completed_checkins
    FROM check_ins
    WHERE goal_id = p_goal_id;
    
    -- Calculate completion rate
    IF v_total_checkins > 0 THEN
        v_completion_rate := ROUND((v_completed_checkins::DECIMAL / v_total_checkins) * 100, 2);
    ELSE
        v_completion_rate := 0;
    END IF;
    
    -- Get 7-day metrics
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE completed = true)
    INTO v_checkins_7d, v_completed_7d
    FROM check_ins
    WHERE goal_id = p_goal_id
      AND check_in_date >= v_today - INTERVAL '6 days';
    
    IF v_checkins_7d > 0 THEN
        v_completion_rate_7d := ROUND((v_completed_7d::DECIMAL / v_checkins_7d) * 100, 2);
    ELSE
        v_completion_rate_7d := 0;
    END IF;
    
    -- Get 30-day metrics
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE completed = true)
    INTO v_checkins_30d, v_completed_30d
    FROM check_ins
    WHERE goal_id = p_goal_id
      AND check_in_date >= v_today - INTERVAL '29 days';
    
    IF v_checkins_30d > 0 THEN
        v_completion_rate_30d := ROUND((v_completed_30d::DECIMAL / v_checkins_30d) * 100, 2);
    ELSE
        v_completion_rate_30d := 0;
    END IF;
    
    -- Get all completed check-in dates for streak calculation
    SELECT ARRAY_AGG(DISTINCT check_in_date ORDER BY check_in_date DESC)
    INTO v_completed_dates
    FROM check_ins
    WHERE goal_id = p_goal_id AND completed = true;
    
    -- Initialize streak values
    v_current_streak := 0;
    v_longest_streak := 0;
    v_last_checkin_date := NULL;
    v_streak_start_date := NULL;
    
    IF v_completed_dates IS NOT NULL AND array_length(v_completed_dates, 1) > 0 THEN
        v_last_checkin_date := v_completed_dates[1]; -- Most recent (desc order)
        
        -- Calculate current streak (consecutive days from today or yesterday)
        v_check_date := v_today;
        v_streak_started := false;
        
        -- Check if today or yesterday has a check-in to start the streak
        IF v_today = ANY(v_completed_dates) THEN
            v_streak_started := true;
            v_check_date := v_today;
        ELSIF (v_today - 1) = ANY(v_completed_dates) THEN
            v_streak_started := true;
            v_check_date := v_today - 1;
        END IF;
        
        IF v_streak_started THEN
            -- Count consecutive days backwards
            WHILE v_check_date = ANY(v_completed_dates) LOOP
                v_current_streak := v_current_streak + 1;
                v_streak_start_date := v_check_date;
                v_check_date := v_check_date - 1;
            END LOOP;
        END IF;
        
        -- Calculate longest streak (iterate through sorted dates)
        SELECT ARRAY_AGG(d ORDER BY d ASC)
        INTO v_sorted_dates
        FROM unnest(v_completed_dates) AS d;
        
        IF v_sorted_dates IS NOT NULL AND array_length(v_sorted_dates, 1) > 0 THEN
            v_temp_streak := 1;
            v_longest_streak := 1;
            v_prev_date := v_sorted_dates[1];
            
            FOR i IN 2..array_length(v_sorted_dates, 1) LOOP
                v_d := v_sorted_dates[i];
                IF v_d - v_prev_date = 1 THEN
                    v_temp_streak := v_temp_streak + 1;
                    IF v_temp_streak > v_longest_streak THEN
                        v_longest_streak := v_temp_streak;
                    END IF;
                ELSE
                    v_temp_streak := 1;
                END IF;
                v_prev_date := v_d;
            END LOOP;
        END IF;
        
        -- Ensure longest is at least as long as current
        IF v_current_streak > v_longest_streak THEN
            v_longest_streak := v_current_streak;
        END IF;
    END IF;
    
    -- Upsert the goal statistics
    INSERT INTO goal_statistics (
        goal_id,
        user_id,
        current_streak,
        longest_streak,
        last_checkin_date,
        streak_start_date,
        total_checkins,
        completed_checkins,
        completion_rate,
        checkins_last_7d,
        checkins_last_30d,
        completion_rate_7d,
        completion_rate_30d,
        updated_at
    ) VALUES (
        p_goal_id,
        v_user_id,
        v_current_streak,
        v_longest_streak,
        v_last_checkin_date,
        v_streak_start_date,
        v_total_checkins,
        v_completed_checkins,
        v_completion_rate,
        v_checkins_7d,
        v_checkins_30d,
        v_completion_rate_7d,
        v_completion_rate_30d,
        NOW()
    )
    ON CONFLICT (goal_id) DO UPDATE SET
        current_streak = EXCLUDED.current_streak,
        longest_streak = EXCLUDED.longest_streak,
        last_checkin_date = EXCLUDED.last_checkin_date,
        streak_start_date = EXCLUDED.streak_start_date,
        total_checkins = EXCLUDED.total_checkins,
        completed_checkins = EXCLUDED.completed_checkins,
        completion_rate = EXCLUDED.completion_rate,
        checkins_last_7d = EXCLUDED.checkins_last_7d,
        checkins_last_30d = EXCLUDED.checkins_last_30d,
        completion_rate_7d = EXCLUDED.completion_rate_7d,
        completion_rate_30d = EXCLUDED.completion_rate_30d,
        updated_at = NOW();
        
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 3: Trigger function for check_ins changes
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_refresh_goal_statistics()
RETURNS TRIGGER AS $$
DECLARE
    v_goal_id UUID;
BEGIN
    -- Determine the goal_id to update
    IF TG_OP = 'DELETE' THEN
        v_goal_id := OLD.goal_id;
    ELSE
        v_goal_id := NEW.goal_id;
    END IF;
    
    -- Only proceed if goal_id is not null
    IF v_goal_id IS NOT NULL THEN
        -- Check if the goal still exists (for cascading deletes)
        IF EXISTS (SELECT 1 FROM goals WHERE id = v_goal_id) THEN
            PERFORM refresh_goal_statistics(v_goal_id);
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 4: Create trigger on check_ins table
-- =====================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_goal_stats_on_checkin ON check_ins;

-- Create the trigger
CREATE TRIGGER trigger_goal_stats_on_checkin
    AFTER INSERT OR UPDATE OR DELETE ON check_ins
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_goal_statistics();

-- =====================================================
-- PART 5: Trigger for goal creation (initialize stats)
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_init_goal_statistics()
RETURNS TRIGGER AS $$
BEGIN
    -- Initialize empty statistics for new goal
    INSERT INTO goal_statistics (goal_id, user_id)
    VALUES (NEW.id, NEW.user_id)
    ON CONFLICT (goal_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_goal_stats_on_goal_create ON goals;

-- Create the trigger for goal creation
CREATE TRIGGER trigger_goal_stats_on_goal_create
    AFTER INSERT ON goals
    FOR EACH ROW
    EXECUTE FUNCTION trigger_init_goal_statistics();

-- =====================================================
-- PART 6: Enable RLS
-- =====================================================

ALTER TABLE goal_statistics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "goal_statistics_select_own"
ON goal_statistics FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "goal_statistics_all_own"
ON goal_statistics FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- PART 7: Enable Realtime
-- =====================================================

DO $$
BEGIN
    -- Add to realtime publication if not already present
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'goal_statistics'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE goal_statistics;
    END IF;
END $$;

-- Set REPLICA IDENTITY FULL for complete row data on realtime events
ALTER TABLE goal_statistics REPLICA IDENTITY FULL;

-- =====================================================
-- PART 8: Backfill existing goals
-- =====================================================

DO $$
DECLARE
    v_goal RECORD;
    v_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting goal_statistics backfill...';
    
    FOR v_goal IN SELECT id FROM goals LOOP
        PERFORM refresh_goal_statistics(v_goal.id);
        v_count := v_count + 1;
        
        -- Log progress every 100 goals
        IF v_count % 100 = 0 THEN
            RAISE NOTICE 'Processed % goals...', v_count;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Completed goal_statistics backfill. Total goals processed: %', v_count;
END $$;

-- =====================================================
-- PART 9: Add helpful comment
-- =====================================================

COMMENT ON TABLE goal_statistics IS 'Cached statistics for each goal, maintained by triggers on check_ins. Provides O(1) access to streak info, completion rates, and other metrics.';

