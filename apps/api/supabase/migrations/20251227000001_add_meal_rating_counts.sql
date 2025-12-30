-- =====================================================
-- Migration: 20251227000001_add_meal_rating_counts.sql
-- Purpose: 
--   1. Add okay_meal_count and unhealthy_meal_count to daily_nutrition_summaries
--   2. Update trigger to track all health ratings
--   3. Backfill existing data
-- =====================================================

-- =====================================================
-- PART 1: Add new columns to nutrition summaries
-- =====================================================

ALTER TABLE daily_nutrition_summaries 
ADD COLUMN IF NOT EXISTS okay_meal_count INTEGER DEFAULT 0;

ALTER TABLE daily_nutrition_summaries 
ADD COLUMN IF NOT EXISTS unhealthy_meal_count INTEGER DEFAULT 0;

-- =====================================================
-- PART 2: Update the trigger function to include all health ratings
-- =====================================================

CREATE OR REPLACE FUNCTION update_daily_nutrition_summary()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_goal_id UUID;
    v_challenge_id UUID;
    v_logged_date DATE;
BEGIN
    v_user_id := COALESCE(NEW.user_id, OLD.user_id);
    v_goal_id := COALESCE(NEW.goal_id, OLD.goal_id);
    v_challenge_id := COALESCE(NEW.challenge_id, OLD.challenge_id);
    v_logged_date := COALESCE(NEW.logged_date, OLD.logged_date);
    
    -- Aggregate and upsert the summary (now includes all health rating counts)
    INSERT INTO daily_nutrition_summaries (
        user_id,
        goal_id,
        challenge_id,
        summary_date,
        total_protein,
        total_calories,
        meal_count,
        healthy_meal_count,
        okay_meal_count,
        unhealthy_meal_count
    )
    SELECT
        v_user_id,
        v_goal_id,
        v_challenge_id,
        v_logged_date,
        COALESCE(SUM(estimated_protein), 0),
        COALESCE(SUM(estimated_calories), 0),
        COUNT(*),
        COUNT(*) FILTER (WHERE health_rating = 'healthy'),
        COUNT(*) FILTER (WHERE health_rating = 'okay'),
        COUNT(*) FILTER (WHERE health_rating = 'unhealthy')
    FROM meal_logs
    WHERE user_id = v_user_id
      AND logged_date = v_logged_date
      AND (
          (v_goal_id IS NOT NULL AND goal_id = v_goal_id)
          OR (v_challenge_id IS NOT NULL AND challenge_id = v_challenge_id)
          OR (v_goal_id IS NULL AND v_challenge_id IS NULL AND goal_id IS NULL AND challenge_id IS NULL)
      )
    ON CONFLICT (user_id, COALESCE(goal_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(challenge_id, '00000000-0000-0000-0000-000000000000'::uuid), summary_date)
    DO UPDATE SET
        total_protein = EXCLUDED.total_protein,
        total_calories = EXCLUDED.total_calories,
        meal_count = EXCLUDED.meal_count,
        healthy_meal_count = EXCLUDED.healthy_meal_count,
        okay_meal_count = EXCLUDED.okay_meal_count,
        unhealthy_meal_count = EXCLUDED.unhealthy_meal_count,
        updated_at = NOW();
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 3: Backfill okay_meal_count for existing data
-- =====================================================

UPDATE daily_nutrition_summaries dns
SET okay_meal_count = (
    SELECT COUNT(*) 
    FROM meal_logs ml
    WHERE ml.user_id = dns.user_id
      AND ml.logged_date = dns.summary_date
      AND ml.health_rating = 'okay'
      AND (
          (dns.goal_id IS NOT NULL AND ml.goal_id = dns.goal_id)
          OR (dns.challenge_id IS NOT NULL AND ml.challenge_id = dns.challenge_id)
          OR (dns.goal_id IS NULL AND dns.challenge_id IS NULL AND ml.goal_id IS NULL AND ml.challenge_id IS NULL)
      )
);

-- =====================================================
-- PART 4: Backfill unhealthy_meal_count for existing data
-- =====================================================

UPDATE daily_nutrition_summaries dns
SET unhealthy_meal_count = (
    SELECT COUNT(*) 
    FROM meal_logs ml
    WHERE ml.user_id = dns.user_id
      AND ml.logged_date = dns.summary_date
      AND ml.health_rating = 'unhealthy'
      AND (
          (dns.goal_id IS NOT NULL AND ml.goal_id = dns.goal_id)
          OR (dns.challenge_id IS NOT NULL AND ml.challenge_id = dns.challenge_id)
          OR (dns.goal_id IS NULL AND dns.challenge_id IS NULL AND ml.goal_id IS NULL AND ml.challenge_id IS NULL)
      )
);

-- =====================================================
-- PART 5: Add index for health_rating queries (optional optimization)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_meal_logs_health_rating 
ON meal_logs(health_rating) 
WHERE health_rating IS NOT NULL;

