-- =====================================================
-- FitNudge V2 - Scalable Streak Tracking
-- O(1) streak updates via denormalized columns on goals
-- Batch streak reset via daily/weekly PostgreSQL functions
-- =====================================================

-- =====================================================
-- 1. ADD TRACKING COLUMNS TO GOALS TABLE
-- =====================================================

-- streak_start_date: When the current streak began
ALTER TABLE goals ADD COLUMN IF NOT EXISTS streak_start_date DATE;

-- last_completed_date: Last successful check-in (completed=true)
ALTER TABLE goals ADD COLUMN IF NOT EXISTS last_completed_date DATE;

-- last_checkin_date: Last check-in of any type (completed, rest, or missed)
ALTER TABLE goals ADD COLUMN IF NOT EXISTS last_checkin_date DATE;

-- week_completions: Number of completions in current week (for weekly goals)
ALTER TABLE goals ADD COLUMN IF NOT EXISTS week_completions INTEGER DEFAULT 0;

-- week_start_date: Start date of current tracking week
ALTER TABLE goals ADD COLUMN IF NOT EXISTS week_start_date DATE;

-- =====================================================
-- 2. ADD INDEXES FOR EFFICIENT QUERIES
-- =====================================================

-- Index for daily streak reset task (find goals that missed yesterday)
CREATE INDEX IF NOT EXISTS idx_goals_streak_reset 
  ON goals(status, current_streak, last_completed_date) 
  WHERE status = 'active' AND current_streak > 0;

-- Index for weekly streak processing (find weekly goals to evaluate)
CREATE INDEX IF NOT EXISTS idx_goals_weekly_processing
  ON goals(frequency_type, status, week_start_date)
  WHERE frequency_type = 'weekly' AND status = 'active';

-- =====================================================
-- 3. FUNCTION: Reset Missed Streaks (Daily Task)
-- Runs hourly to catch all timezones
-- Resets streak for goals where yesterday was a target day but no check-in
-- IMPORTANT: Respects is_rest_day - rest days preserve the streak
-- =====================================================

CREATE OR REPLACE FUNCTION reset_missed_streaks_batch()
RETURNS INTEGER AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  -- Find and reset goals where:
  -- 1. Goal is active with current_streak > 0
  -- 2. Yesterday (in user's timezone) was a target day
  -- 3. No check-in exists for yesterday that preserves streak (completed OR is_rest_day)
  
  WITH goals_to_reset AS (
    SELECT g.id
    FROM goals g
    JOIN users u ON g.user_id = u.id
    WHERE g.status = 'active'
      AND g.current_streak > 0
      -- Check if yesterday was a target day
      AND (
        -- Daily goals: every day is a target day
        g.frequency_type = 'daily'
        OR
        -- Weekly goals: check if yesterday's day-of-week is in target_days
        (
          g.frequency_type = 'weekly'
          AND (
            g.target_days = '{}'  -- Empty array means any day
            OR EXTRACT(DOW FROM (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(u.timezone, 'UTC')) - INTERVAL '1 day')::int = ANY(g.target_days)
          )
        )
      )
      -- No streak-preserving check-in exists for yesterday
      -- (completed = true OR is_rest_day = true preserves the streak)
      AND NOT EXISTS (
        SELECT 1 FROM check_ins ci
        WHERE ci.goal_id = g.id
          AND ci.check_in_date = (
            (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(u.timezone, 'UTC'))::date - INTERVAL '1 day'
          )::date
          AND (ci.completed = true OR ci.is_rest_day = true)
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

COMMENT ON FUNCTION reset_missed_streaks_batch() IS 
  'Resets streaks for goals where yesterday was a target day but no streak-preserving check-in exists (completed or rest day). Run hourly to handle all timezones.';

-- =====================================================
-- 4. FUNCTION: Reset Weekly Completions (Monday Task)
-- Runs every Monday to reset week_completions counter
-- Note: Streaks are managed per check-in (same as daily goals)
-- This function only resets the "X/Y this week" counter
-- =====================================================

CREATE OR REPLACE FUNCTION reset_weekly_completions_batch()
RETURNS INTEGER AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  -- Reset week_completions for all weekly goals where week_start_date is from last week
  -- This prepares the counter for the new week
  UPDATE goals
  SET 
    week_completions = 0,
    week_start_date = CURRENT_DATE,
    updated_at = NOW()
  WHERE frequency_type = 'weekly'
    AND status = 'active'
    AND (
      week_start_date IS NULL 
      OR week_start_date < CURRENT_DATE - INTERVAL '6 days'
    );
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reset_weekly_completions_batch() IS 
  'Resets week_completions counter for weekly goals at start of new week. Streaks are managed per check-in. Run every Monday.';

-- =====================================================
-- 5. FUNCTION: Get Week Start Date
-- Helper to calculate ISO week start (Monday)
-- =====================================================

CREATE OR REPLACE FUNCTION get_week_start(target_date DATE)
RETURNS DATE AS $$
BEGIN
  -- Return Monday of the week containing target_date
  RETURN target_date - EXTRACT(ISODOW FROM target_date)::int + 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_week_start(DATE) IS 
  'Returns the Monday of the week containing the given date.';

-- =====================================================
-- 6. FUNCTION: Detect Pattern Insights (Weekly Task)
-- Analyzes check-in history and stores insights
-- =====================================================

CREATE OR REPLACE FUNCTION detect_user_patterns(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  insight_count INTEGER := 0;
  best_day_data RECORD;
  worst_day_data RECORD;
  skip_reason_data RECORD;
  today DATE := CURRENT_DATE;
BEGIN
  -- Delete old insights for this user (refresh)
  DELETE FROM pattern_insights 
  WHERE user_id = p_user_id 
    AND valid_from < today - INTERVAL '7 days';

  -- 1. Find BEST day (highest success rate)
  SELECT 
    EXTRACT(DOW FROM check_in_date)::int as day_index,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE completed = true) as completed,
    ROUND(COUNT(*) FILTER (WHERE completed = true) * 100.0 / NULLIF(COUNT(*), 0), 1) as success_rate
  INTO best_day_data
  FROM check_ins
  WHERE user_id = p_user_id
    AND check_in_date > today - INTERVAL '90 days'
  GROUP BY EXTRACT(DOW FROM check_in_date)
  HAVING COUNT(*) >= 4  -- Minimum sample size
  ORDER BY success_rate DESC
  LIMIT 1;
  
  IF best_day_data IS NOT NULL AND best_day_data.success_rate >= 70 THEN
    INSERT INTO pattern_insights (user_id, goal_id, insight_type, insight_text, insight_data, valid_from)
    VALUES (
      p_user_id,
      NULL,
      'best_day',
      'Your best day is ' || 
        CASE best_day_data.day_index
          WHEN 0 THEN 'Sunday'
          WHEN 1 THEN 'Monday'
          WHEN 2 THEN 'Tuesday'
          WHEN 3 THEN 'Wednesday'
          WHEN 4 THEN 'Thursday'
          WHEN 5 THEN 'Friday'
          WHEN 6 THEN 'Saturday'
        END || ' with ' || best_day_data.success_rate || '% success rate',
      jsonb_build_object(
        'day_index', best_day_data.day_index,
        'success_rate', best_day_data.success_rate,
        'sample_size', best_day_data.total
      ),
      today
    )
    ON CONFLICT DO NOTHING;
    insight_count := insight_count + 1;
  END IF;

  -- 2. Find WORST day (lowest success rate)
  SELECT 
    EXTRACT(DOW FROM check_in_date)::int as day_index,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE completed = true) as completed,
    ROUND(COUNT(*) FILTER (WHERE completed = true) * 100.0 / NULLIF(COUNT(*), 0), 1) as success_rate
  INTO worst_day_data
  FROM check_ins
  WHERE user_id = p_user_id
    AND check_in_date > today - INTERVAL '90 days'
  GROUP BY EXTRACT(DOW FROM check_in_date)
  HAVING COUNT(*) >= 4  -- Minimum sample size
  ORDER BY success_rate ASC
  LIMIT 1;
  
  IF worst_day_data IS NOT NULL AND worst_day_data.success_rate < 60 THEN
    INSERT INTO pattern_insights (user_id, goal_id, insight_type, insight_text, insight_data, valid_from)
    VALUES (
      p_user_id,
      NULL,
      'worst_day',
      'You tend to skip on ' || 
        CASE worst_day_data.day_index
          WHEN 0 THEN 'Sundays'
          WHEN 1 THEN 'Mondays'
          WHEN 2 THEN 'Tuesdays'
          WHEN 3 THEN 'Wednesdays'
          WHEN 4 THEN 'Thursdays'
          WHEN 5 THEN 'Fridays'
          WHEN 6 THEN 'Saturdays'
        END || ' (' || worst_day_data.success_rate || '% success rate)',
      jsonb_build_object(
        'day_index', worst_day_data.day_index,
        'success_rate', worst_day_data.success_rate,
        'sample_size', worst_day_data.total
      ),
      today
    )
    ON CONFLICT DO NOTHING;
    insight_count := insight_count + 1;
  END IF;

  -- 3. Find most common SKIP REASON
  SELECT 
    skip_reason,
    COUNT(*) as count
  INTO skip_reason_data
  FROM check_ins
  WHERE user_id = p_user_id
    AND completed = false
    AND skip_reason IS NOT NULL
    AND check_in_date > today - INTERVAL '90 days'
  GROUP BY skip_reason
  ORDER BY count DESC
  LIMIT 1;
  
  IF skip_reason_data IS NOT NULL AND skip_reason_data.count >= 3 THEN
    INSERT INTO pattern_insights (user_id, goal_id, insight_type, insight_text, insight_data, valid_from)
    VALUES (
      p_user_id,
      NULL,
      'skip_reason_pattern',
      'Your most common barrier is "' || skip_reason_data.skip_reason || '" (mentioned ' || skip_reason_data.count || ' times)',
      jsonb_build_object(
        'skip_reason', skip_reason_data.skip_reason,
        'count', skip_reason_data.count
      ),
      today
    )
    ON CONFLICT DO NOTHING;
    insight_count := insight_count + 1;
  END IF;

  RETURN insight_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION detect_user_patterns(UUID) IS 
  'Analyzes user check-in history and generates pattern insights for AI context.';

-- =====================================================
-- 7. FUNCTION: Build AI Context for User
-- Aggregates all relevant data for AI prompts
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
  -- Get user info
  SELECT name, motivation_style, timezone INTO user_data
  FROM users WHERE id = p_user_id;
  
  -- Get active goals with streaks
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
  
  -- Get recent patterns
  SELECT jsonb_agg(jsonb_build_object(
    'type', insight_type,
    'text', insight_text,
    'data', insight_data
  ))
  INTO patterns_data
  FROM pattern_insights
  WHERE user_id = p_user_id
    AND (valid_until IS NULL OR valid_until > CURRENT_DATE);
  
  -- Get recent stats (last 30 days)
  SELECT 
    COUNT(*) as total_checkins,
    COUNT(*) FILTER (WHERE completed = true) as completed_checkins,
    ROUND(COUNT(*) FILTER (WHERE completed = true) * 100.0 / NULLIF(COUNT(*), 0), 1) as completion_rate
  INTO recent_stats
  FROM check_ins
  WHERE user_id = p_user_id
    AND check_in_date > CURRENT_DATE - INTERVAL '30 days';
  
  -- Build context
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

COMMENT ON FUNCTION build_ai_context(UUID) IS 
  'Builds comprehensive context for AI prompts including goals, streaks, patterns, and recent performance.';

-- =====================================================
-- 8. BACKFILL EXISTING GOALS (One-time)
-- Set last_completed_date from existing check_ins
-- =====================================================

-- Set last_completed_date from most recent completed check-in
UPDATE goals g
SET last_completed_date = (
  SELECT MAX(check_in_date)
  FROM check_ins c
  WHERE c.goal_id = g.id AND c.completed = true
)
WHERE g.last_completed_date IS NULL;

-- Set last_checkin_date from most recent check-in of any type
UPDATE goals g
SET last_checkin_date = (
  SELECT MAX(check_in_date)
  FROM check_ins c
  WHERE c.goal_id = g.id
)
WHERE g.last_checkin_date IS NULL;

-- Set streak_start_date for goals with active streaks
-- (Approximate: current_streak days ago)
UPDATE goals
SET streak_start_date = CURRENT_DATE - (current_streak - 1)
WHERE current_streak > 0 AND streak_start_date IS NULL;

-- Set week_start_date to current week for weekly goals
UPDATE goals
SET week_start_date = get_week_start(CURRENT_DATE)
WHERE frequency_type = 'weekly' AND week_start_date IS NULL;

-- Calculate week_completions for weekly goals (from current week's check-ins)
UPDATE goals g
SET week_completions = (
  SELECT COUNT(*)
  FROM check_ins c
  WHERE c.goal_id = g.id 
    AND c.completed = true
    AND c.check_in_date >= get_week_start(CURRENT_DATE)
    AND c.check_in_date <= CURRENT_DATE
)
WHERE g.frequency_type = 'weekly';

-- =====================================================
-- 9. COMMENTS
-- =====================================================

COMMENT ON COLUMN goals.streak_start_date IS 'Date when the current streak began. NULL if no active streak.';
COMMENT ON COLUMN goals.last_completed_date IS 'Date of the last successful check-in (completed=true).';
COMMENT ON COLUMN goals.last_checkin_date IS 'Date of the last check-in of any type.';
COMMENT ON COLUMN goals.week_completions IS 'Number of completions in current tracking week (for weekly goals).';
COMMENT ON COLUMN goals.week_start_date IS 'Start date of current tracking week (Monday).';
