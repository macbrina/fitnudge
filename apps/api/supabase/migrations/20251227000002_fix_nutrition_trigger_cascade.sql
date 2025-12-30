-- =====================================================
-- Migration: 20251227000002_fix_nutrition_trigger_cascade.sql
-- Purpose: 
--   Fix ALL summary triggers to handle CASCADE deletes
--   When a goal is deleted, logs are deleted via CASCADE, which
--   triggers these functions. But the goal no longer exists, causing
--   a foreign key violation when trying to insert the summary.
--   
--   This migration fixes:
--   1. update_daily_nutrition_summary (meal_logs)
--   2. update_daily_hydration_summary (hydration_logs)
--   3. update_daily_checkin_summary (check_ins)
--   4. update_daily_workout_summary (workout_sessions)
-- =====================================================

CREATE OR REPLACE FUNCTION update_daily_nutrition_summary()
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
            -- Goal is being deleted, skip the summary update
            -- The summary will be deleted by its own CASCADE
            RETURN NULL;
        END IF;
    END IF;
    
    -- Check if the challenge still exists (handles CASCADE deletes)
    IF v_challenge_id IS NOT NULL THEN
        SELECT EXISTS(SELECT 1 FROM challenges WHERE id = v_challenge_id) INTO v_challenge_exists;
        IF NOT v_challenge_exists THEN
            -- Challenge is being deleted, skip the summary update
            -- The summary will be deleted by its own CASCADE
            RETURN NULL;
        END IF;
    END IF;
    
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
-- Also fix the hydration summary trigger for consistency
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
    
    -- Aggregate and upsert the summary
    INSERT INTO daily_hydration_summaries (
        user_id,
        goal_id,
        challenge_id,
        summary_date,
        total_ml,
        glass_count
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
        total_ml = EXCLUDED.total_ml,
        glass_count = EXCLUDED.glass_count,
        updated_at = NOW();
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Fix the checkin summary trigger
-- =====================================================

CREATE OR REPLACE FUNCTION update_daily_checkin_summary()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_goal_id UUID;
    v_check_in_date DATE;
    v_goal_exists BOOLEAN;
BEGIN
    v_user_id := COALESCE(NEW.user_id, OLD.user_id);
    v_goal_id := COALESCE(NEW.goal_id, OLD.goal_id);
    v_check_in_date := COALESCE(NEW.check_in_date, OLD.check_in_date);
    
    -- Check if the goal still exists (handles CASCADE deletes)
    IF v_goal_id IS NOT NULL THEN
        SELECT EXISTS(SELECT 1 FROM goals WHERE id = v_goal_id) INTO v_goal_exists;
        IF NOT v_goal_exists THEN
            RETURN NULL;
        END IF;
    END IF;
    
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
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Fix the workout summary trigger
-- =====================================================

CREATE OR REPLACE FUNCTION update_daily_workout_summary()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_goal_id UUID;
    v_challenge_id UUID;
    v_workout_date DATE;
    v_goal_exists BOOLEAN;
    v_challenge_exists BOOLEAN;
BEGIN
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
            (goal_id IS NULL AND v_goal_id IS NULL AND challenge_id IS NULL AND v_challenge_id IS NULL)
            OR (v_goal_id IS NOT NULL AND goal_id = v_goal_id)
            OR (v_challenge_id IS NOT NULL AND challenge_id = v_challenge_id)
        )
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

