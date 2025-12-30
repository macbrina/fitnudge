-- Migration: Fix hydration summary trigger column names
-- The previous migration used incorrect column names (total_ml, glass_count)
-- The correct column names are (total_amount_ml, log_count)

-- =====================================================
-- Fix the hydration summary trigger with correct column names
-- =====================================================

CREATE OR REPLACE FUNCTION update_daily_hydration_summary()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_goal_id UUID;
    v_challenge_id UUID;
    v_logged_date DATE;
    v_goal_exists BOOLEAN;
    v_challenge_exists BOOLEAN;
BEGIN
    v_user_id := COALESCE(NEW.user_id, OLD.user_id);
    v_goal_id := COALESCE(NEW.goal_id, OLD.goal_id);
    v_challenge_id := COALESCE(NEW.challenge_id, OLD.challenge_id);
    v_logged_date := COALESCE(NEW.logged_date, OLD.logged_date);
    
    -- Check if the goal still exists (handles CASCADE deletes)
    IF v_goal_id IS NOT NULL THEN
        SELECT EXISTS(SELECT 1 FROM goals WHERE id = v_goal_id) INTO v_goal_exists;
        IF NOT v_goal_exists THEN
            RETURN NULL;
        END IF;
    END IF;
    
    -- Check if the challenge still exists (handles CASCADE deletes)
    IF v_challenge_id IS NOT NULL THEN
        SELECT EXISTS(SELECT 1 FROM challenges WHERE id = v_challenge_id) INTO v_challenge_exists;
        IF NOT v_challenge_exists THEN
            RETURN NULL;
        END IF;
    END IF;
    
    -- Aggregate and upsert the summary with CORRECT column names
    INSERT INTO daily_hydration_summaries (
        user_id,
        goal_id,
        challenge_id,
        summary_date,
        total_amount_ml,  -- Fixed: was incorrectly 'total_ml'
        log_count         -- Fixed: was incorrectly 'glass_count'
    )
    SELECT
        v_user_id,
        v_goal_id,
        v_challenge_id,
        v_logged_date,
        COALESCE(SUM(amount_ml), 0),
        COUNT(*)
    FROM hydration_logs
    WHERE user_id = v_user_id
      AND logged_date = v_logged_date
      AND (
          (v_goal_id IS NOT NULL AND goal_id = v_goal_id)
          OR (v_challenge_id IS NOT NULL AND challenge_id = v_challenge_id)
          OR (v_goal_id IS NULL AND v_challenge_id IS NULL AND goal_id IS NULL AND challenge_id IS NULL)
      )
    ON CONFLICT (user_id, COALESCE(goal_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(challenge_id, '00000000-0000-0000-0000-000000000000'::uuid), summary_date)
    DO UPDATE SET
        total_amount_ml = EXCLUDED.total_amount_ml,  -- Fixed
        log_count = EXCLUDED.log_count,              -- Fixed
        updated_at = NOW();
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

