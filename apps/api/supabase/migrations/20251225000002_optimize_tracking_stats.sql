-- =====================================================
-- Optimize Tracking Stats - Use Summary Tables
-- =====================================================
-- Migration: 20251225000002_optimize_tracking_stats.sql
-- Purpose: 
--   1. Add healthy_meal_count to daily_nutrition_summaries
--   2. Update trigger to track healthy meals
--   3. Backfill existing data
-- =====================================================

-- =====================================================
-- PART 1: Add healthy_meal_count to nutrition summaries
-- =====================================================

ALTER TABLE daily_nutrition_summaries 
ADD COLUMN IF NOT EXISTS healthy_meal_count INTEGER DEFAULT 0;

-- Update the trigger function to include healthy_meal_count
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
    
    -- Aggregate and upsert the summary (now includes healthy_meal_count)
    INSERT INTO daily_nutrition_summaries (
        user_id,
        goal_id,
        challenge_id,
        summary_date,
        total_protein,
        total_calories,
        meal_count,
        healthy_meal_count
    )
    SELECT
        v_user_id,
        v_goal_id,
        v_challenge_id,
        v_logged_date,
        COALESCE(SUM(estimated_protein), 0),
        COALESCE(SUM(estimated_calories), 0),
        COUNT(*),
        COUNT(*) FILTER (WHERE health_rating = 'healthy')
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
        healthy_meal_count = EXCLUDED.healthy_meal_count,
        updated_at = NOW();
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 2: Backfill healthy_meal_count for existing data
-- =====================================================

-- Update existing nutrition summaries with healthy meal counts
UPDATE daily_nutrition_summaries dns
SET healthy_meal_count = (
    SELECT COUNT(*) 
    FROM meal_logs ml
    WHERE ml.user_id = dns.user_id
        AND ml.logged_date = dns.summary_date
        AND ml.health_rating = 'healthy'
        AND (
            (ml.goal_id IS NULL AND dns.goal_id IS NULL) 
            OR ml.goal_id = dns.goal_id
        )
        AND (
            (ml.challenge_id IS NULL AND dns.challenge_id IS NULL) 
            OR ml.challenge_id = dns.challenge_id
        )
)
WHERE healthy_meal_count IS NULL OR healthy_meal_count = 0;

-- =====================================================
-- PART 3: Create indexes for efficient range queries
-- =====================================================

-- Index for date range queries on nutrition summaries
CREATE INDEX IF NOT EXISTS idx_daily_nutrition_date_range 
ON daily_nutrition_summaries(user_id, summary_date DESC);

-- Index for date range queries on hydration summaries
CREATE INDEX IF NOT EXISTS idx_daily_hydration_date_range 
ON daily_hydration_summaries(user_id, summary_date DESC);

-- Composite indexes for goal/challenge + date queries
CREATE INDEX IF NOT EXISTS idx_daily_nutrition_goal_date 
ON daily_nutrition_summaries(goal_id, summary_date DESC) WHERE goal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_daily_nutrition_challenge_date 
ON daily_nutrition_summaries(challenge_id, summary_date DESC) WHERE challenge_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_daily_hydration_goal_date 
ON daily_hydration_summaries(goal_id, summary_date DESC) WHERE goal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_daily_hydration_challenge_date 
ON daily_hydration_summaries(challenge_id, summary_date DESC) WHERE challenge_id IS NOT NULL;

