-- =====================================================
-- Migration: 20251227000006_create_challenge_statistics.sql
-- Purpose: Create challenge_statistics table for cached per-participant metrics
--          Similar to goal_statistics but for challenge participation
--          Maintained by triggers for real-time updates
-- =====================================================

-- =====================================================
-- PART 1: Create challenge_statistics table
-- =====================================================

CREATE TABLE IF NOT EXISTS challenge_statistics (
    -- Composite primary key: one row per user per challenge
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Streak data (for streak-type challenges)
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_checkin_date DATE,
    streak_start_date DATE,
    
    -- Completion metrics
    total_checkins INTEGER DEFAULT 0,
    completed_checkins INTEGER DEFAULT 0,
    completion_rate DECIMAL(5,2) DEFAULT 0.00,
    
    -- Points and progress
    points INTEGER DEFAULT 0,
    progress INTEGER DEFAULT 0,  -- Tracks either streak count or checkin count based on challenge_type
    
    -- Time-windowed metrics for quick stats
    checkins_last_7d INTEGER DEFAULT 0,
    checkins_last_30d INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one row per user per challenge
    UNIQUE(challenge_id, user_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_challenge_statistics_user_id ON challenge_statistics(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_statistics_challenge_id ON challenge_statistics(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_statistics_updated_at ON challenge_statistics(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenge_statistics_points ON challenge_statistics(points DESC);
CREATE INDEX IF NOT EXISTS idx_challenge_statistics_current_streak ON challenge_statistics(current_streak DESC);

-- =====================================================
-- PART 2: Function to calculate and refresh challenge statistics
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_challenge_statistics(p_challenge_id UUID, p_user_id UUID)
RETURNS void AS $$
DECLARE
    v_challenge_type TEXT;
    v_total_checkins INTEGER;
    v_completed_checkins INTEGER;
    v_completion_rate DECIMAL(5,2);
    v_checkins_7d INTEGER;
    v_checkins_30d INTEGER;
    v_current_streak INTEGER;
    v_longest_streak INTEGER;
    v_last_checkin_date DATE;
    v_streak_start_date DATE;
    v_points INTEGER;
    v_progress INTEGER;
    v_today DATE := CURRENT_DATE;
    v_check_date DATE;
    v_temp_streak INTEGER;
    v_streak_started BOOLEAN;
    v_completed_dates DATE[];
    v_sorted_dates DATE[];
    v_prev_date DATE;
    v_d DATE;
BEGIN
    -- Get challenge type
    SELECT challenge_type INTO v_challenge_type 
    FROM challenges 
    WHERE id = p_challenge_id;
    
    IF v_challenge_type IS NULL THEN
        -- Challenge doesn't exist, nothing to do
        RETURN;
    END IF;
    
    -- Get total check-ins count
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE is_checked_in = true)
    INTO v_total_checkins, v_completed_checkins
    FROM challenge_check_ins
    WHERE challenge_id = p_challenge_id AND user_id = p_user_id;
    
    -- Calculate completion rate
    IF v_total_checkins > 0 THEN
        v_completion_rate := ROUND((v_completed_checkins::DECIMAL / v_total_checkins) * 100, 2);
    ELSE
        v_completion_rate := 0;
    END IF;
    
    -- Get 7-day metrics
    SELECT COUNT(*) FILTER (WHERE is_checked_in = true)
    INTO v_checkins_7d
    FROM challenge_check_ins
    WHERE challenge_id = p_challenge_id 
      AND user_id = p_user_id
      AND check_in_date >= v_today - INTERVAL '6 days';
    
    -- Get 30-day metrics
    SELECT COUNT(*) FILTER (WHERE is_checked_in = true)
    INTO v_checkins_30d
    FROM challenge_check_ins
    WHERE challenge_id = p_challenge_id 
      AND user_id = p_user_id
      AND check_in_date >= v_today - INTERVAL '29 days';
    
    -- Get all completed check-in dates for streak calculation
    SELECT ARRAY_AGG(DISTINCT check_in_date ORDER BY check_in_date DESC)
    INTO v_completed_dates
    FROM challenge_check_ins
    WHERE challenge_id = p_challenge_id 
      AND user_id = p_user_id 
      AND is_checked_in = true;
    
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
    
    -- Calculate points and progress based on challenge type
    IF v_challenge_type = 'streak' THEN
        v_points := v_current_streak * 10;  -- 10 points per day of streak
        v_progress := v_current_streak;
    ELSIF v_challenge_type = 'checkin_count' THEN
        v_points := v_completed_checkins * 5;  -- 5 points per check-in
        v_progress := v_completed_checkins;
    ELSE
        -- Fallback: treat as streak
        v_points := v_current_streak * 10;
        v_progress := v_current_streak;
    END IF;
    
    -- Upsert the challenge statistics
    INSERT INTO challenge_statistics (
        challenge_id,
        user_id,
        current_streak,
        longest_streak,
        last_checkin_date,
        streak_start_date,
        total_checkins,
        completed_checkins,
        completion_rate,
        points,
        progress,
        checkins_last_7d,
        checkins_last_30d,
        updated_at
    ) VALUES (
        p_challenge_id,
        p_user_id,
        v_current_streak,
        v_longest_streak,
        v_last_checkin_date,
        v_streak_start_date,
        v_total_checkins,
        v_completed_checkins,
        v_completion_rate,
        v_points,
        v_progress,
        v_checkins_7d,
        v_checkins_30d,
        NOW()
    )
    ON CONFLICT (challenge_id, user_id) DO UPDATE SET
        current_streak = EXCLUDED.current_streak,
        longest_streak = EXCLUDED.longest_streak,
        last_checkin_date = EXCLUDED.last_checkin_date,
        streak_start_date = EXCLUDED.streak_start_date,
        total_checkins = EXCLUDED.total_checkins,
        completed_checkins = EXCLUDED.completed_checkins,
        completion_rate = EXCLUDED.completion_rate,
        points = EXCLUDED.points,
        progress = EXCLUDED.progress,
        checkins_last_7d = EXCLUDED.checkins_last_7d,
        checkins_last_30d = EXCLUDED.checkins_last_30d,
        updated_at = NOW();
        
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 3: Trigger function for challenge_check_ins changes
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_refresh_challenge_statistics()
RETURNS TRIGGER AS $$
DECLARE
    v_challenge_id UUID;
    v_user_id UUID;
BEGIN
    -- Determine the challenge_id and user_id to update
    IF TG_OP = 'DELETE' THEN
        v_challenge_id := OLD.challenge_id;
        v_user_id := OLD.user_id;
    ELSE
        v_challenge_id := NEW.challenge_id;
        v_user_id := NEW.user_id;
    END IF;
    
    -- Only proceed if both are not null
    IF v_challenge_id IS NOT NULL AND v_user_id IS NOT NULL THEN
        -- Check if the challenge still exists (for cascading deletes)
        IF EXISTS (SELECT 1 FROM challenges WHERE id = v_challenge_id) THEN
            PERFORM refresh_challenge_statistics(v_challenge_id, v_user_id);
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 4: Create trigger on challenge_check_ins table
-- =====================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_challenge_stats_on_checkin ON challenge_check_ins;

-- Create the trigger
CREATE TRIGGER trigger_challenge_stats_on_checkin
    AFTER INSERT OR UPDATE OR DELETE ON challenge_check_ins
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_challenge_statistics();

-- =====================================================
-- PART 5: Trigger for challenge participant join (initialize stats)
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_init_challenge_statistics()
RETURNS TRIGGER AS $$
BEGIN
    -- Initialize empty statistics for new participant
    INSERT INTO challenge_statistics (challenge_id, user_id)
    VALUES (NEW.challenge_id, NEW.user_id)
    ON CONFLICT (challenge_id, user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_challenge_stats_on_participant_join ON challenge_participants;

-- Create the trigger for participant join
CREATE TRIGGER trigger_challenge_stats_on_participant_join
    AFTER INSERT ON challenge_participants
    FOR EACH ROW
    EXECUTE FUNCTION trigger_init_challenge_statistics();

-- =====================================================
-- PART 6: Enable RLS
-- =====================================================

ALTER TABLE challenge_statistics ENABLE ROW LEVEL SECURITY;

-- RLS Policies - users can see their own stats and stats of challenges they're in
CREATE POLICY "challenge_statistics_select_own"
ON challenge_statistics FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Allow users to see all stats for challenges they participate in (for leaderboards)
CREATE POLICY "challenge_statistics_select_participants"
ON challenge_statistics FOR SELECT TO authenticated
USING (
    challenge_id IN (
        SELECT challenge_id FROM challenge_participants WHERE user_id = auth.uid()
    )
);

CREATE POLICY "challenge_statistics_all_own"
ON challenge_statistics FOR ALL TO authenticated
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
        AND tablename = 'challenge_statistics'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE challenge_statistics;
    END IF;
END $$;

-- Set REPLICA IDENTITY FULL for complete row data on realtime events
ALTER TABLE challenge_statistics REPLICA IDENTITY FULL;

-- =====================================================
-- PART 8: Backfill existing challenge participants
-- =====================================================

DO $$
DECLARE
    v_participant RECORD;
    v_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting challenge_statistics backfill...';
    
    FOR v_participant IN 
        SELECT DISTINCT challenge_id, user_id 
        FROM challenge_participants
    LOOP
        PERFORM refresh_challenge_statistics(v_participant.challenge_id, v_participant.user_id);
        v_count := v_count + 1;
        
        -- Log progress every 100 participants
        IF v_count % 100 = 0 THEN
            RAISE NOTICE 'Processed % participants...', v_count;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Completed challenge_statistics backfill. Total participants processed: %', v_count;
END $$;

-- =====================================================
-- PART 9: Add helpful comment
-- =====================================================

COMMENT ON TABLE challenge_statistics IS 'Cached statistics for each challenge participant, maintained by triggers on challenge_check_ins. Provides O(1) access to streak info, points, and other metrics for leaderboards and progress display.';

