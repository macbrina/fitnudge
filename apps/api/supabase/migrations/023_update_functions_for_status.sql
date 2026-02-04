-- =====================================================
-- FitNudge V2 - Update Functions for Check-in Status
-- Updates all SQL functions to use the new status column
-- instead of completed/is_rest_day boolean logic
-- =====================================================
-- NOTE: Materialized views are updated in a SEPARATE
-- migration file (024_update_analytics_views_for_status.sql)
-- due to Supabase restrictions on mixing MV operations.
-- =====================================================

-- =====================================================
-- 1. UPDATE: reset_missed_streaks_batch (from 007)
-- Now checks for status instead of completed/is_rest_day
-- =====================================================

CREATE OR REPLACE FUNCTION reset_missed_streaks_batch()
RETURNS INTEGER AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  -- Find and reset goals where:
  -- 1. Goal is active with current_streak > 0
  -- 2. Yesterday (in user's timezone) was a target day
  -- 3. No streak-preserving check-in exists for yesterday
  --    (status = 'completed' OR status = 'rest_day')
  
  WITH goals_to_reset AS (
    SELECT g.id
    FROM goals g
    JOIN users u ON g.user_id = u.id
    WHERE g.status = 'active'
      AND g.current_streak > 0
      -- Check if yesterday was a target day
      AND (
        g.frequency_type = 'daily'
        OR
        (
          g.frequency_type = 'weekly'
          AND (
            g.target_days = '{}'
            OR EXTRACT(DOW FROM (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(u.timezone, 'UTC')) - INTERVAL '1 day')::int = ANY(g.target_days)
          )
        )
      )
      -- No streak-preserving check-in exists for yesterday
      AND NOT EXISTS (
        SELECT 1 FROM check_ins ci
        WHERE ci.goal_id = g.id
          AND ci.check_in_date = (
            (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(u.timezone, 'UTC'))::date - INTERVAL '1 day'
          )::date
          AND ci.status IN ('completed', 'rest_day')
      )
  )
  UPDATE goals 
  SET 
    current_streak = 0,
    streak_start_date = NULL,
    updated_at = NOW()
  WHERE id IN (SELECT id FROM goals_to_reset);
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2. UPDATE: get_streak_at_risk_users (from 009)
-- Check for pending status instead of no check-in
-- =====================================================

CREATE OR REPLACE FUNCTION get_streak_at_risk_users(min_streak INT DEFAULT 7)
RETURNS TABLE (
  user_id UUID,
  goal_id UUID,
  title TEXT,
  current_streak INT,
  longest_streak INT,
  timezone TEXT,
  name TEXT,
  push_token TEXT
) AS $$
DECLARE
  current_date_utc DATE := CURRENT_DATE;
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (g.id)
    g.user_id,
    g.id as goal_id,
    g.title,
    g.current_streak::INT,
    g.longest_streak::INT,
    u.timezone,
    u.name,
    dt.fcm_token as push_token
  FROM goals g
  JOIN users u ON g.user_id = u.id
  LEFT JOIN device_tokens dt ON u.id = dt.user_id AND dt.is_active = true
  WHERE g.status = 'active'
    AND g.current_streak >= min_streak
    -- Has pending (not completed) check-in today
    AND EXISTS (
      SELECT 1 FROM check_ins ci
      WHERE ci.goal_id = g.id
        AND ci.check_in_date = current_date_utc
        AND ci.status = 'pending'
    )
    -- Goal is scheduled for today
    AND (
      g.frequency_type = 'daily'
      OR (
        g.frequency_type = 'weekly'
        AND g.target_days IS NOT NULL
        AND EXTRACT(DOW FROM current_date_utc)::INT = ANY(g.target_days)
      )
    )
  ORDER BY g.id, g.current_streak DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. UPDATE: get_users_with_missed_days (from 009)
-- At least min_days consecutive calendar days with status = 'missed'.
-- Schedule-aware via check_ins (only created for scheduled days).
-- Excludes users who checked in today (completed/skipped/rest_day).
-- =====================================================

CREATE OR REPLACE FUNCTION get_users_with_missed_days(min_days INT DEFAULT 2)
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  timezone TEXT,
  push_token TEXT,
  days_missed INT
) AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH missed_dates AS (
    SELECT DISTINCT ci.user_id, ci.check_in_date AS d
    FROM check_ins ci
    WHERE ci.status = 'missed'
      AND ci.check_in_date > CURRENT_DATE - INTERVAL '7 days'
      AND ci.check_in_date < CURRENT_DATE
  ),
  with_gap AS (
    SELECT md.user_id, md.d,
           md.d - LAG(md.d) OVER (PARTITION BY md.user_id ORDER BY md.d) AS gap
    FROM missed_dates md
  ),
  run_groups AS (
    SELECT wg.user_id, wg.d,
           SUM(CASE WHEN wg.gap IS NULL OR wg.gap > 1 THEN 1 ELSE 0 END) OVER (PARTITION BY wg.user_id ORDER BY wg.d) AS run_id
    FROM with_gap wg
  ),
  run_lengths AS (
    SELECT rg.user_id, COUNT(*)::INT AS run_len
    FROM run_groups rg
    GROUP BY rg.user_id, rg.run_id
  ),
  eligible AS (
    SELECT rl.user_id, MAX(rl.run_len)::INT AS max_consecutive
    FROM run_lengths rl
    GROUP BY rl.user_id
    HAVING MAX(rl.run_len) >= min_days
  )
  SELECT DISTINCT ON (u.id)
    u.id AS user_id,
    u.name,
    u.timezone,
    dt.fcm_token AS push_token,
    e.max_consecutive AS days_missed
  FROM users u
  JOIN goals g ON g.user_id = u.id AND g.status = 'active'
  JOIN eligible e ON e.user_id = u.id
  LEFT JOIN device_tokens dt ON dt.user_id = u.id AND dt.is_active = true
  WHERE NOT EXISTS (
    SELECT 1 FROM check_ins ci
    WHERE ci.user_id = u.id
      AND ci.check_in_date >= CURRENT_DATE
      AND ci.status IN ('completed', 'skipped', 'rest_day')
  )
  ORDER BY u.id;
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- 4. UPDATE: calculate_goal_metrics (from 021)
-- Uses status column for calculations
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_goal_metrics(p_goal_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_metrics JSONB;
  v_completion_rate_30d NUMERIC;
  v_completion_rate_7d NUMERIC;
  v_best_day INTEGER;
  v_best_day_rate NUMERIC;
  v_worst_day INTEGER;
  v_worst_day_rate NUMERIC;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
  v_total_checkins INTEGER;
  v_completed_checkins INTEGER;
  v_goal_title TEXT;
  v_frequency_type TEXT;
  v_frequency_count INTEGER;
BEGIN
  -- Get goal data
  SELECT title, current_streak, longest_streak, frequency_type, frequency_count
  INTO v_goal_title, v_current_streak, v_longest_streak, v_frequency_type, v_frequency_count
  FROM goals WHERE id = p_goal_id;

  IF v_goal_title IS NULL THEN
    RETURN jsonb_build_object('error', 'Goal not found');
  END IF;

  -- 30-day stats (exclude pending)
  SELECT 
    COUNT(*) FILTER (WHERE status != 'pending'),
    COUNT(*) FILTER (WHERE status = 'completed'),
    ROUND(COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / 
          NULLIF(COUNT(*) FILTER (WHERE status != 'pending'), 0), 1)
  INTO v_total_checkins, v_completed_checkins, v_completion_rate_30d
  FROM check_ins
  WHERE goal_id = p_goal_id
    AND check_in_date > CURRENT_DATE - INTERVAL '30 days';

  -- 7-day completion rate
  SELECT ROUND(COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / 
               NULLIF(COUNT(*) FILTER (WHERE status != 'pending'), 0), 1)
  INTO v_completion_rate_7d
  FROM check_ins
  WHERE goal_id = p_goal_id
    AND check_in_date > CURRENT_DATE - INTERVAL '7 days';

  -- Best day (highest completion rate, minimum 2 samples)
  SELECT day_index, rate INTO v_best_day, v_best_day_rate FROM (
    SELECT EXTRACT(DOW FROM check_in_date)::int as day_index,
           ROUND(COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / 
                 NULLIF(COUNT(*) FILTER (WHERE status != 'pending'), 0), 1) as rate
    FROM check_ins
    WHERE goal_id = p_goal_id 
      AND check_in_date > CURRENT_DATE - INTERVAL '90 days'
      AND status != 'pending'
    GROUP BY EXTRACT(DOW FROM check_in_date)
    HAVING COUNT(*) FILTER (WHERE status != 'pending') >= 2
    ORDER BY rate DESC
    LIMIT 1
  ) sub;

  -- Worst day (lowest completion rate, minimum 2 samples)
  SELECT day_index, rate INTO v_worst_day, v_worst_day_rate FROM (
    SELECT EXTRACT(DOW FROM check_in_date)::int as day_index,
           ROUND(COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / 
                 NULLIF(COUNT(*) FILTER (WHERE status != 'pending'), 0), 1) as rate
    FROM check_ins
    WHERE goal_id = p_goal_id 
      AND check_in_date > CURRENT_DATE - INTERVAL '90 days'
      AND status != 'pending'
    GROUP BY EXTRACT(DOW FROM check_in_date)
    HAVING COUNT(*) FILTER (WHERE status != 'pending') >= 2
    ORDER BY rate ASC
    LIMIT 1
  ) sub;

  RETURN jsonb_build_object(
    'goal_title', v_goal_title,
    'frequency_type', v_frequency_type,
    'frequency_count', COALESCE(v_frequency_count, 7),
    'completion_rate_30d', COALESCE(v_completion_rate_30d, 0),
    'completion_rate_7d', COALESCE(v_completion_rate_7d, 0),
    'best_day_index', v_best_day,
    'best_day_rate', v_best_day_rate,
    'worst_day_index', v_worst_day,
    'worst_day_rate', v_worst_day_rate,
    'current_streak', COALESCE(v_current_streak, 0),
    'longest_streak', COALESCE(v_longest_streak, 0),
    'total_checkins_30d', COALESCE(v_total_checkins, 0),
    'completed_checkins_30d', COALESCE(v_completed_checkins, 0),
    'calculated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. UPDATE: get_checkins_for_ai (from 021)
-- Include status in AI context
-- =====================================================

CREATE OR REPLACE FUNCTION get_checkins_for_ai(p_goal_id UUID, p_limit INTEGER DEFAULT 30)
RETURNS JSONB AS $$
DECLARE
  v_checkins JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', check_in_date,
      'day_of_week', EXTRACT(DOW FROM check_in_date)::int,
      'day_name', TO_CHAR(check_in_date, 'Day'),
      'status', status,
      'completed', CASE WHEN status = 'completed' THEN true ELSE false END,
      'skip_reason', skip_reason,
      'mood', mood,
      'note', LEFT(note, 100)
    ) ORDER BY check_in_date DESC
  )
  INTO v_checkins
  FROM (
    SELECT check_in_date, status, skip_reason, mood, note
    FROM check_ins
    WHERE goal_id = p_goal_id
      AND status != 'pending'  -- Exclude pending from AI analysis
    ORDER BY check_in_date DESC
    LIMIT p_limit
  ) sub;

  RETURN COALESCE(v_checkins, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. UPDATE: get_skip_reasons_summary (from 021)
-- Filter by status = 'skipped' instead of completed = false
-- =====================================================

CREATE OR REPLACE FUNCTION get_skip_reasons_summary(p_goal_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_summary JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'reason', skip_reason,
      'count', count
    ) ORDER BY count DESC
  )
  INTO v_summary
  FROM (
    SELECT skip_reason, COUNT(*) as count
    FROM check_ins
    WHERE goal_id = p_goal_id
      AND status = 'skipped'
      AND skip_reason IS NOT NULL
      AND check_in_date > CURRENT_DATE - INTERVAL '90 days'
    GROUP BY skip_reason
    ORDER BY count DESC
    LIMIT 5
  ) sub;

  RETURN COALESCE(v_summary, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. UPDATE: recalculate_goal_stats (from 017)
-- Uses status column for streak calculation
-- =====================================================

CREATE OR REPLACE FUNCTION recalculate_goal_stats()
RETURNS TRIGGER AS $$
DECLARE
    target_goal_id UUID;
    v_total_completions INTEGER;
    v_current_streak INTEGER;
    v_longest_streak INTEGER;
    v_last_completed_date DATE;
    v_last_checkin_date DATE;
    v_streak_start_date DATE;
    v_week_completions INTEGER;
    v_week_start DATE;
    rec RECORD;
    prev_date DATE;
    temp_streak INTEGER;
BEGIN
    -- Determine which goal_id to update
    IF TG_OP = 'DELETE' THEN
        target_goal_id := OLD.goal_id;
    ELSE
        target_goal_id := NEW.goal_id;
    END IF;

    -- Skip if no goal_id
    IF target_goal_id IS NULL THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    -- Skip recalculation for pending check-ins (they don't affect streaks)
    IF TG_OP != 'DELETE' AND NEW.status = 'pending' THEN
        RETURN NEW;
    END IF;

    -- Calculate total completions (status = 'completed')
    SELECT COUNT(*) INTO v_total_completions
    FROM check_ins
    WHERE goal_id = target_goal_id AND status = 'completed';

    -- Get last completed date and last checkin date (excluding pending)
    SELECT MAX(check_in_date) INTO v_last_completed_date
    FROM check_ins
    WHERE goal_id = target_goal_id AND status = 'completed';

    SELECT MAX(check_in_date) INTO v_last_checkin_date
    FROM check_ins
    WHERE goal_id = target_goal_id AND status != 'pending';

    -- Calculate week completions (current week, starting Sunday)
    v_week_start := date_trunc('week', CURRENT_DATE)::DATE;
    
    SELECT COUNT(*) INTO v_week_completions
    FROM check_ins
    WHERE goal_id = target_goal_id 
      AND status = 'completed'
      AND check_in_date >= v_week_start;

    -- Calculate current streak (consecutive completed days from most recent)
    -- rest_day status PRESERVES streak but doesn't INCREMENT it
    v_current_streak := 0;
    v_streak_start_date := NULL;
    prev_date := NULL;

    FOR rec IN 
        SELECT check_in_date, status
        FROM check_ins
        WHERE goal_id = target_goal_id
          AND status != 'pending'  -- Exclude pending
        ORDER BY check_in_date DESC
    LOOP
        IF prev_date IS NULL THEN
            -- First (most recent) check-in
            IF rec.status = 'completed' THEN
                v_current_streak := 1;
                v_streak_start_date := rec.check_in_date;
            ELSIF rec.status = 'rest_day' THEN
                -- Rest day: don't increment, but don't break (continue checking)
                NULL;
            ELSE
                EXIT; -- Streak broken at start (missed/skipped day)
            END IF;
        ELSE
            -- Check if consecutive day
            IF rec.check_in_date = prev_date - INTERVAL '1 day' THEN
                IF rec.status = 'completed' THEN
                    v_current_streak := v_current_streak + 1;
                    v_streak_start_date := rec.check_in_date;
                ELSIF rec.status = 'rest_day' THEN
                    -- Rest day: preserve streak, continue checking
                    NULL;
                ELSE
                    EXIT; -- Streak broken (missed/skipped day)
                END IF;
            ELSE
                EXIT; -- Gap in dates, streak broken
            END IF;
        END IF;
        prev_date := rec.check_in_date;
    END LOOP;

    -- Calculate longest streak
    v_longest_streak := 0;
    temp_streak := 0;
    prev_date := NULL;

    FOR rec IN 
        SELECT check_in_date, status
        FROM check_ins
        WHERE goal_id = target_goal_id
          AND status != 'pending'
        ORDER BY check_in_date ASC
    LOOP
        IF rec.status = 'completed' THEN
            IF prev_date IS NULL OR rec.check_in_date = prev_date + INTERVAL '1 day' THEN
                temp_streak := temp_streak + 1;
            ELSE
                IF temp_streak > v_longest_streak THEN
                    v_longest_streak := temp_streak;
                END IF;
                temp_streak := 1;
            END IF;
        ELSIF rec.status = 'rest_day' THEN
            -- Rest day: preserve streak (don't increment, don't break)
            NULL;
        ELSE
            -- missed/skipped: end streak
            IF temp_streak > v_longest_streak THEN
                v_longest_streak := temp_streak;
            END IF;
            temp_streak := 0;
        END IF;
        prev_date := rec.check_in_date;
    END LOOP;

    -- Final check for longest streak
    IF temp_streak > v_longest_streak THEN
        v_longest_streak := temp_streak;
    END IF;

    IF v_current_streak > v_longest_streak THEN
        v_longest_streak := v_current_streak;
    END IF;

    -- Update the goal with calculated values
    UPDATE goals
    SET 
        current_streak = v_current_streak,
        longest_streak = v_longest_streak,
        total_completions = v_total_completions,
        last_completed_date = v_last_completed_date,
        last_checkin_date = v_last_checkin_date,
        streak_start_date = v_streak_start_date,
        week_completions = v_week_completions,
        week_start_date = v_week_start,
        updated_at = NOW()
    WHERE id = target_goal_id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. UPDATE: recalculate_daily_checkin_summary (from 019)
-- Uses status column for counting
-- =====================================================

CREATE OR REPLACE FUNCTION recalculate_daily_checkin_summary(
    p_user_id UUID,
    p_goal_id UUID,
    p_date DATE
) RETURNS VOID AS $$
DECLARE
    v_total INTEGER;
    v_completed INTEGER;
    v_rest_day INTEGER;
    v_skipped INTEGER;
    v_streak INTEGER;
BEGIN
    IF p_goal_id IS NULL THEN
        RETURN;
    END IF;

    -- Count check-ins by status (exclude pending)
    SELECT 
        COUNT(*) FILTER (WHERE status != 'pending'),
        COUNT(*) FILTER (WHERE status = 'completed'),
        COUNT(*) FILTER (WHERE status = 'rest_day'),
        COUNT(*) FILTER (WHERE status IN ('skipped', 'missed'))
    INTO v_total, v_completed, v_rest_day, v_skipped
    FROM check_ins
    WHERE user_id = p_user_id 
      AND goal_id = p_goal_id 
      AND check_in_date = p_date;

    -- Get current streak from goal
    SELECT COALESCE(current_streak, 0) INTO v_streak
    FROM goals 
    WHERE id = p_goal_id;

    IF v_total > 0 THEN
        INSERT INTO daily_checkin_summaries (
            user_id, goal_id, summary_date,
            total_check_ins, completed_count, rest_day_count, skipped_count, streak_at_date,
            created_at, updated_at
        ) VALUES (
            p_user_id, p_goal_id, p_date,
            v_total, v_completed, v_rest_day, v_skipped, v_streak,
            NOW(), NOW()
        )
        ON CONFLICT (user_id, goal_id, summary_date) DO UPDATE SET
            total_check_ins = v_total,
            completed_count = v_completed,
            rest_day_count = v_rest_day,
            skipped_count = v_skipped,
            streak_at_date = v_streak,
            updated_at = NOW();
    ELSE
        DELETE FROM daily_checkin_summaries
        WHERE user_id = p_user_id 
          AND goal_id = p_goal_id 
          AND summary_date = p_date;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. UPDATE: sync_daily_checkin_summary trigger (from 019)
-- Skip pending status for summary updates
-- =====================================================

CREATE OR REPLACE FUNCTION sync_daily_checkin_summary()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM recalculate_daily_checkin_summary(OLD.user_id, OLD.goal_id, OLD.check_in_date);
        RETURN OLD;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Skip if just creating pending check-in
        IF NEW.status = 'pending' AND OLD.status = 'pending' THEN
            RETURN NEW;
        END IF;
        
        IF OLD.check_in_date != NEW.check_in_date OR OLD.goal_id IS DISTINCT FROM NEW.goal_id THEN
            PERFORM recalculate_daily_checkin_summary(OLD.user_id, OLD.goal_id, OLD.check_in_date);
        END IF;
        PERFORM recalculate_daily_checkin_summary(NEW.user_id, NEW.goal_id, NEW.check_in_date);
        RETURN NEW;
        
    ELSE -- INSERT
        -- Skip summary update for pending check-ins
        IF NEW.status = 'pending' THEN
            RETURN NEW;
        END IF;
        
        PERFORM recalculate_daily_checkin_summary(NEW.user_id, NEW.goal_id, NEW.check_in_date);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. UPDATE: build_ai_context (from 007)
-- Uses status for recent performance
-- =====================================================

CREATE OR REPLACE FUNCTION build_ai_context(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  context JSONB;
  user_data RECORD;
  goals_data JSONB;
  patterns_data JSONB;
  recent_stats RECORD;
BEGIN
  SELECT name, motivation_style, timezone INTO user_data
  FROM users WHERE id = p_user_id;
  
  SELECT jsonb_agg(jsonb_build_object(
    'title', title,
    'why_statement', why_statement,
    'current_streak', current_streak,
    'longest_streak', longest_streak,
    'frequency', CASE 
      WHEN frequency_type = 'daily' THEN 'Daily'
      ELSE frequency_count || 'x per week'
    END,
    'week_completions', week_completions,
    'frequency_count', frequency_count
  ))
  INTO goals_data
  FROM goals
  WHERE user_id = p_user_id AND status = 'active';
  
  -- Use insights JSONB (migration 021 replaced insight_type/insight_text/insight_data)
  SELECT COALESCE(jsonb_agg(pattern_item), '[]'::jsonb) INTO patterns_data
  FROM (
    SELECT jsonb_build_object(
      'type', COALESCE(elem->>'type', 'pattern'),
      'text', COALESCE(elem->>'text', elem->>'message', ''),
      'goal_id', pi.goal_id
    ) as pattern_item
    FROM pattern_insights pi,
         jsonb_array_elements(COALESCE(pi.insights, '[]'::jsonb)) as elem
    WHERE pi.user_id = p_user_id
      AND pi.status = 'completed'
    LIMIT 50
  ) sub;
  
  -- Recent stats (exclude pending)
  SELECT 
    COUNT(*) FILTER (WHERE status != 'pending') as total_checkins,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_checkins,
    ROUND(COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / 
          NULLIF(COUNT(*) FILTER (WHERE status != 'pending'), 0), 1) as completion_rate
  INTO recent_stats
  FROM check_ins
  WHERE user_id = p_user_id
    AND check_in_date > CURRENT_DATE - INTERVAL '30 days';
  
  context := jsonb_build_object(
    'user_name', user_data.name,
    'motivation_style', user_data.motivation_style,
    'timezone', user_data.timezone,
    'goals', COALESCE(goals_data, '[]'::jsonb),
    'patterns', COALESCE(patterns_data, '[]'::jsonb),
    'recent_performance', jsonb_build_object(
      'total_checkins', COALESCE(recent_stats.total_checkins, 0),
      'completed_checkins', COALESCE(recent_stats.completed_checkins, 0),
      'completion_rate', COALESCE(recent_stats.completion_rate, 0)
    )
  );
  
  RETURN context;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 11. COMMENTS
-- =====================================================

COMMENT ON FUNCTION reset_missed_streaks_batch() IS 
  'V2: Updated to use status column. Resets streaks for goals where yesterday has no completed/rest_day status.';

COMMENT ON FUNCTION get_streak_at_risk_users(INT) IS 
  'V2: Updated to check for pending status instead of missing check-in.';

COMMENT ON FUNCTION calculate_goal_metrics(UUID) IS 
  'V2: Updated to use status column for calculations.';

COMMENT ON FUNCTION recalculate_goal_stats() IS 
  'V2: Updated to use status column for streak calculation.';

-- =====================================================
-- 12. RECREATE TRIGGERS (dropped in migration 022)
-- =====================================================

-- Trigger to sync goal stats on check-in changes
DROP TRIGGER IF EXISTS trg_checkin_sync_goal_stats ON check_ins;
CREATE TRIGGER trg_checkin_sync_goal_stats
  AFTER INSERT OR UPDATE OR DELETE ON check_ins
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_goal_stats();

-- Trigger to sync daily check-in summaries
DROP TRIGGER IF EXISTS trg_sync_daily_checkin_summary ON check_ins;
CREATE TRIGGER trg_sync_daily_checkin_summary
  AFTER INSERT OR UPDATE OR DELETE ON check_ins
  FOR EACH ROW
  EXECUTE FUNCTION sync_daily_checkin_summary();

-- NOTE: Materialized views are updated in migration 024
