-- =====================================================
-- FitNudge V2 - Enhanced Recaps & Goal-Specific Insights
-- 
-- Adds:
-- 1. Additional columns to weekly_recaps for caching full data
-- 2. detect_goal_patterns() function for per-goal insights
-- 3. API-ready goal insights structure
-- =====================================================

-- =====================================================
-- 1. ADD JSONB COLUMNS TO weekly_recaps
-- Cache full recap data to avoid recomputation
-- =====================================================

-- Stats object (completion rate, streaks, mood distribution, etc.)
ALTER TABLE weekly_recaps 
ADD COLUMN IF NOT EXISTS stats JSONB DEFAULT '{}'::jsonb;

-- Per-goal breakdown array
ALTER TABLE weekly_recaps 
ADD COLUMN IF NOT EXISTS goal_breakdown JSONB DEFAULT '[]'::jsonb;

-- 4-week completion rate trend
ALTER TABLE weekly_recaps 
ADD COLUMN IF NOT EXISTS completion_rate_trend JSONB DEFAULT '[]'::jsonb;

-- Achievements unlocked during the week
ALTER TABLE weekly_recaps 
ADD COLUMN IF NOT EXISTS achievements_unlocked JSONB DEFAULT '[]'::jsonb;

-- Accountability partner context (nullable)
ALTER TABLE weekly_recaps 
ADD COLUMN IF NOT EXISTS partner_context JSONB;

-- Full recap text (AI-generated summary paragraph)
-- Note: 'summary' column already exists but stores shorter text
-- This stores the full formatted recap text
ALTER TABLE weekly_recaps 
ADD COLUMN IF NOT EXISTS recap_text TEXT;

COMMENT ON COLUMN weekly_recaps.stats IS 'Full stats object: completion_rate, current_streak, longest_streak, mood_distribution, etc.';
COMMENT ON COLUMN weekly_recaps.goal_breakdown IS 'Array of per-goal performance: [{goal_id, title, completed, total, completion_rate, status}]';
COMMENT ON COLUMN weekly_recaps.completion_rate_trend IS 'Last 4 weeks trend: [{week_start, completion_rate, is_current}]';
COMMENT ON COLUMN weekly_recaps.achievements_unlocked IS 'Badges unlocked during the week: [{badge_key, badge_name, rarity}]';
COMMENT ON COLUMN weekly_recaps.partner_context IS 'Accountability partner info: [{partner_id, partner_name, partner_streak}]';

-- =====================================================
-- 2. FUNCTION: Detect Goal-Specific Patterns
-- Analyzes a single goal's check-in history
-- =====================================================

CREATE OR REPLACE FUNCTION detect_goal_patterns(p_goal_id UUID)
RETURNS INTEGER AS $$
DECLARE
  insight_count INTEGER := 0;
  v_user_id UUID;
  best_day_data RECORD;
  worst_day_data RECORD;
  skip_reason_data RECORD;
  streak_data RECORD;
  today DATE := CURRENT_DATE;
BEGIN
  -- Get user_id from goal
  SELECT user_id INTO v_user_id FROM goals WHERE id = p_goal_id;
  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Delete old insights for this goal (refresh)
  DELETE FROM pattern_insights 
  WHERE goal_id = p_goal_id 
    AND valid_from < today - INTERVAL '7 days';

  -- 1. Find BEST day for this goal (highest success rate)
  SELECT 
    EXTRACT(DOW FROM check_in_date)::int as day_index,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE completed = true) as completed,
    ROUND(COUNT(*) FILTER (WHERE completed = true) * 100.0 / NULLIF(COUNT(*), 0), 1) as success_rate
  INTO best_day_data
  FROM check_ins
  WHERE goal_id = p_goal_id
    AND check_in_date > today - INTERVAL '90 days'
  GROUP BY EXTRACT(DOW FROM check_in_date)
  HAVING COUNT(*) >= 3  -- Minimum sample size
  ORDER BY success_rate DESC
  LIMIT 1;
  
  IF best_day_data IS NOT NULL AND best_day_data.success_rate >= 70 THEN
    INSERT INTO pattern_insights (user_id, goal_id, insight_type, insight_text, insight_data, valid_from)
    VALUES (
      v_user_id,
      p_goal_id,
      'best_day',
      'You perform best on ' || 
        CASE best_day_data.day_index
          WHEN 0 THEN 'Sundays'
          WHEN 1 THEN 'Mondays'
          WHEN 2 THEN 'Tuesdays'
          WHEN 3 THEN 'Wednesdays'
          WHEN 4 THEN 'Thursdays'
          WHEN 5 THEN 'Fridays'
          WHEN 6 THEN 'Saturdays'
        END || ' (' || best_day_data.success_rate || '% success)',
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

  -- 2. Find WORST day for this goal (lowest success rate)
  SELECT 
    EXTRACT(DOW FROM check_in_date)::int as day_index,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE completed = true) as completed,
    ROUND(COUNT(*) FILTER (WHERE completed = true) * 100.0 / NULLIF(COUNT(*), 0), 1) as success_rate
  INTO worst_day_data
  FROM check_ins
  WHERE goal_id = p_goal_id
    AND check_in_date > today - INTERVAL '90 days'
  GROUP BY EXTRACT(DOW FROM check_in_date)
  HAVING COUNT(*) >= 3
  ORDER BY success_rate ASC
  LIMIT 1;
  
  IF worst_day_data IS NOT NULL AND worst_day_data.success_rate < 60 THEN
    INSERT INTO pattern_insights (user_id, goal_id, insight_type, insight_text, insight_data, valid_from)
    VALUES (
      v_user_id,
      p_goal_id,
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
        END || ' (' || worst_day_data.success_rate || '% success)',
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

  -- 3. Find most common SKIP REASON for this goal
  SELECT 
    skip_reason,
    COUNT(*) as count
  INTO skip_reason_data
  FROM check_ins
  WHERE goal_id = p_goal_id
    AND completed = false
    AND skip_reason IS NOT NULL
    AND check_in_date > today - INTERVAL '90 days'
  GROUP BY skip_reason
  ORDER BY count DESC
  LIMIT 1;
  
  IF skip_reason_data IS NOT NULL AND skip_reason_data.count >= 2 THEN
    INSERT INTO pattern_insights (user_id, goal_id, insight_type, insight_text, insight_data, valid_from)
    VALUES (
      v_user_id,
      p_goal_id,
      'skip_reason_pattern',
      'Your most common barrier is "' || skip_reason_data.skip_reason || '" (' || skip_reason_data.count || ' times)',
      jsonb_build_object(
        'skip_reason', skip_reason_data.skip_reason,
        'count', skip_reason_data.count
      ),
      today
    )
    ON CONFLICT DO NOTHING;
    insight_count := insight_count + 1;
  END IF;

  -- 4. Find longest streak history for this goal
  SELECT 
    longest_streak,
    current_streak,
    streak_start_date
  INTO streak_data
  FROM goals
  WHERE id = p_goal_id;
  
  IF streak_data IS NOT NULL AND streak_data.longest_streak >= 7 THEN
    INSERT INTO pattern_insights (user_id, goal_id, insight_type, insight_text, insight_data, valid_from)
    VALUES (
      v_user_id,
      p_goal_id,
      'success_pattern',
      'Your best streak was ' || streak_data.longest_streak || ' days! ' ||
        CASE 
          WHEN streak_data.current_streak > 0 
          THEN 'Currently at ' || streak_data.current_streak || ' days.'
          ELSE 'Time to start a new streak!'
        END,
      jsonb_build_object(
        'longest_streak', streak_data.longest_streak,
        'current_streak', streak_data.current_streak
      ),
      today
    )
    ON CONFLICT DO NOTHING;
    insight_count := insight_count + 1;
  END IF;

  RETURN insight_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION detect_goal_patterns(UUID) IS 
  'Analyzes a specific goal check-in history and generates pattern insights.';

-- =====================================================
-- 3. FUNCTION: Get Goal Insights
-- Returns all active insights for a specific goal
-- =====================================================

CREATE OR REPLACE FUNCTION get_goal_insights(p_goal_id UUID)
RETURNS TABLE (
  insight_type TEXT,
  insight_text TEXT,
  insight_data JSONB,
  valid_from DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pi.insight_type,
    pi.insight_text,
    pi.insight_data,
    pi.valid_from
  FROM pattern_insights pi
  WHERE pi.goal_id = p_goal_id
    AND (pi.valid_until IS NULL OR pi.valid_until > CURRENT_DATE)
  ORDER BY pi.valid_from DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_goal_insights(UUID) IS 
  'Returns all active pattern insights for a specific goal.';

-- =====================================================
-- 4. CELERY TASK HELPER: Detect patterns for all active goals
-- Used by weekly pattern detection task
-- =====================================================

CREATE OR REPLACE FUNCTION detect_all_goal_patterns(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  total_insights INTEGER := 0;
  goal_record RECORD;
  goal_insights INTEGER;
BEGIN
  -- Loop through all active goals for the user
  FOR goal_record IN 
    SELECT id FROM goals 
    WHERE user_id = p_user_id AND status = 'active'
  LOOP
    SELECT detect_goal_patterns(goal_record.id) INTO goal_insights;
    total_insights := total_insights + goal_insights;
  END LOOP;
  
  RETURN total_insights;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION detect_all_goal_patterns(UUID) IS 
  'Runs detect_goal_patterns for all active goals of a user. Returns total insights generated.';

-- =====================================================
-- 5. INDEX: Improve pattern insights queries
-- =====================================================

-- Note: Cannot use CURRENT_DATE in partial index predicate (not immutable)
-- Using simple index instead; active insight filtering done at query time
CREATE INDEX IF NOT EXISTS idx_pattern_insights_goal_valid 
  ON pattern_insights(goal_id, valid_from DESC);

-- Partial index for NULL valid_until (most common case for active insights)
CREATE INDEX IF NOT EXISTS idx_pattern_insights_active
  ON pattern_insights(goal_id, valid_from DESC)
  WHERE valid_until IS NULL;

-- =====================================================
-- 6. COMMENTS
-- =====================================================

COMMENT ON TABLE weekly_recaps IS 'Weekly progress summaries with AI-generated insights. Cached for performance.';
