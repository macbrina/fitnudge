-- =====================================================
-- Fix Daily Nutrition Summaries & Add Hydration Summaries
-- =====================================================
-- Migration: 20251225000001_fix_nutrition_add_hydration_summaries.sql
-- Purpose: 
--   1. Add challenge_id to daily_nutrition_summaries (was missing)
--   2. Update trigger to handle both goal_id and challenge_id
--   3. Create daily_hydration_summaries table with trigger
-- =====================================================

-- =====================================================
-- PART 1: Fix daily_nutrition_summaries
-- =====================================================

-- Add challenge_id column if it doesn't exist
ALTER TABLE daily_nutrition_summaries 
ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES challenges(id) ON DELETE SET NULL;

-- Create index for challenge_id
CREATE INDEX IF NOT EXISTS idx_daily_nutrition_challenge_id 
ON daily_nutrition_summaries(challenge_id);

-- Drop old unique constraint and create new one that includes challenge_id
-- The old constraint was: (user_id, goal_id, summary_date)
-- New constraint: (user_id, goal_id, challenge_id, summary_date)
DO $$
BEGIN
    -- Drop old constraint if exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'daily_nutrition_summaries_user_id_goal_id_summary_date_key'
    ) THEN
        ALTER TABLE daily_nutrition_summaries 
        DROP CONSTRAINT daily_nutrition_summaries_user_id_goal_id_summary_date_key;
    END IF;
END $$;

-- Create new unique constraint with NULLS NOT DISTINCT to handle NULL goal_id/challenge_id
CREATE UNIQUE INDEX IF NOT EXISTS daily_nutrition_summaries_unique_idx 
ON daily_nutrition_summaries (
    user_id, 
    COALESCE(goal_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(challenge_id, '00000000-0000-0000-0000-000000000000'::uuid),
    summary_date
);

-- Update the trigger function to handle both goal_id and challenge_id
CREATE OR REPLACE FUNCTION update_daily_nutrition_summary()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_goal_id UUID;
    v_challenge_id UUID;
    v_logged_date DATE;
BEGIN
    -- Get the relevant values from NEW or OLD
    v_user_id := COALESCE(NEW.user_id, OLD.user_id);
    v_goal_id := COALESCE(NEW.goal_id, OLD.goal_id);
    v_challenge_id := COALESCE(NEW.challenge_id, OLD.challenge_id);
    v_logged_date := COALESCE(NEW.logged_date, OLD.logged_date);
    
    -- Aggregate and upsert the summary
    INSERT INTO daily_nutrition_summaries (
        user_id,
        goal_id,
        challenge_id,
        summary_date,
        total_protein,
        total_calories,
        meal_count
    )
    SELECT
        v_user_id,
        v_goal_id,
        v_challenge_id,
        v_logged_date,
        COALESCE(SUM(estimated_protein), 0),
        COALESCE(SUM(estimated_calories), 0),
        COUNT(*)
    FROM meal_logs
    WHERE user_id = v_user_id
        AND logged_date = v_logged_date
        AND (
            (goal_id IS NULL AND v_goal_id IS NULL) 
            OR goal_id = v_goal_id
        )
        AND (
            (challenge_id IS NULL AND v_challenge_id IS NULL) 
            OR challenge_id = v_challenge_id
        )
    GROUP BY v_user_id, v_goal_id, v_challenge_id, v_logged_date
    ON CONFLICT (
        user_id, 
        COALESCE(goal_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(challenge_id, '00000000-0000-0000-0000-000000000000'::uuid),
        summary_date
    ) 
    DO UPDATE SET
        total_protein = EXCLUDED.total_protein,
        total_calories = EXCLUDED.total_calories,
        meal_count = EXCLUDED.meal_count,
        updated_at = NOW();
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 2: Create daily_hydration_summaries table
-- =====================================================

CREATE TABLE IF NOT EXISTS daily_hydration_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
    challenge_id UUID REFERENCES challenges(id) ON DELETE SET NULL,
    summary_date DATE NOT NULL,
    
    -- Aggregated metrics
    total_amount_ml INTEGER NOT NULL DEFAULT 0,  -- Total water intake in ml
    log_count INTEGER NOT NULL DEFAULT 0,         -- Number of times water was logged
    target_ml INTEGER DEFAULT 2000,               -- Daily target (default 8 glasses = 2000ml)
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create unique index (handles NULLs properly)
CREATE UNIQUE INDEX IF NOT EXISTS daily_hydration_summaries_unique_idx 
ON daily_hydration_summaries (
    user_id, 
    COALESCE(goal_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(challenge_id, '00000000-0000-0000-0000-000000000000'::uuid),
    summary_date
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_daily_hydration_user_id 
ON daily_hydration_summaries(user_id);

CREATE INDEX IF NOT EXISTS idx_daily_hydration_goal_id 
ON daily_hydration_summaries(goal_id);

CREATE INDEX IF NOT EXISTS idx_daily_hydration_challenge_id 
ON daily_hydration_summaries(challenge_id);

CREATE INDEX IF NOT EXISTS idx_daily_hydration_date 
ON daily_hydration_summaries(summary_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_hydration_user_date 
ON daily_hydration_summaries(user_id, summary_date DESC);

-- Add updated_at trigger
CREATE TRIGGER update_daily_hydration_summaries_updated_at 
    BEFORE UPDATE ON daily_hydration_summaries 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update daily hydration summary when hydration is logged
CREATE OR REPLACE FUNCTION update_daily_hydration_summary()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_goal_id UUID;
    v_challenge_id UUID;
    v_logged_date DATE;
    v_target_ml INTEGER;
BEGIN
    -- Get the relevant values from NEW or OLD
    v_user_id := COALESCE(NEW.user_id, OLD.user_id);
    v_goal_id := COALESCE(NEW.goal_id, OLD.goal_id);
    v_challenge_id := COALESCE(NEW.challenge_id, OLD.challenge_id);
    v_logged_date := COALESCE(NEW.logged_date, OLD.logged_date);
    
    -- Try to get user's hydration target from their fitness profile
    SELECT COALESCE(hydration_daily_target_ml, 2000) INTO v_target_ml
    FROM user_fitness_profiles
    WHERE user_id = v_user_id;
    
    -- Default to 2000ml if no profile exists
    IF v_target_ml IS NULL THEN
        v_target_ml := 2000;
    END IF;
    
    -- Aggregate and upsert the summary
    INSERT INTO daily_hydration_summaries (
        user_id,
        goal_id,
        challenge_id,
        summary_date,
        total_amount_ml,
        log_count,
        target_ml
    )
    SELECT
        v_user_id,
        v_goal_id,
        v_challenge_id,
        v_logged_date,
        COALESCE(SUM(amount_ml), 0),
        COUNT(*),
        v_target_ml
    FROM hydration_logs
    WHERE user_id = v_user_id
        AND logged_date = v_logged_date
        AND (
            (goal_id IS NULL AND v_goal_id IS NULL) 
            OR goal_id = v_goal_id
        )
        AND (
            (challenge_id IS NULL AND v_challenge_id IS NULL) 
            OR challenge_id = v_challenge_id
        )
    GROUP BY v_user_id, v_goal_id, v_challenge_id, v_logged_date
    ON CONFLICT (
        user_id, 
        COALESCE(goal_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(challenge_id, '00000000-0000-0000-0000-000000000000'::uuid),
        summary_date
    ) 
    DO UPDATE SET
        total_amount_ml = EXCLUDED.total_amount_ml,
        log_count = EXCLUDED.log_count,
        target_ml = EXCLUDED.target_ml,
        updated_at = NOW();
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update daily summary on hydration log changes
CREATE TRIGGER trigger_update_daily_hydration_summary
    AFTER INSERT OR UPDATE OR DELETE ON hydration_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_hydration_summary();

-- =====================================================
-- PART 3: Enable RLS on daily_hydration_summaries
-- =====================================================

ALTER TABLE daily_hydration_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policy for daily_hydration_summaries
CREATE POLICY "daily_hydration_summaries_all"
ON daily_hydration_summaries FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- PART 4: Enable Realtime for daily_hydration_summaries
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

SELECT add_table_to_realtime_if_not_exists('daily_hydration_summaries');

-- Set REPLICA IDENTITY FULL for complete row data on events
ALTER TABLE daily_hydration_summaries REPLICA IDENTITY FULL;

-- Clean up helper function
DROP FUNCTION IF EXISTS add_table_to_realtime_if_not_exists(TEXT);

-- =====================================================
-- PART 5: Backfill existing hydration logs into summaries
-- =====================================================

-- Backfill hydration summaries from existing logs
INSERT INTO daily_hydration_summaries (
    user_id,
    goal_id,
    challenge_id,
    summary_date,
    total_amount_ml,
    log_count,
    target_ml
)
SELECT
    hl.user_id,
    hl.goal_id,
    hl.challenge_id,
    hl.logged_date,
    SUM(hl.amount_ml),
    COUNT(*),
    COALESCE(ufp.hydration_daily_target_ml, 2000)
FROM hydration_logs hl
LEFT JOIN user_fitness_profiles ufp ON ufp.user_id = hl.user_id
GROUP BY hl.user_id, hl.goal_id, hl.challenge_id, hl.logged_date, ufp.hydration_daily_target_ml
ON CONFLICT (
    user_id, 
    COALESCE(goal_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(challenge_id, '00000000-0000-0000-0000-000000000000'::uuid),
    summary_date
) DO NOTHING;

