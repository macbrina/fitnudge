-- =====================================================
-- Fix Pattern Insights: Add goal creation date and improve validation
-- =====================================================
-- Issues fixed:
-- 1. Add goal_created_at to metrics so AI knows time boundaries
-- 2. Improve best/worst day calculation clarity
-- 3. Ensure metrics include goal age for frontend trend display logic

-- Update calculate_goal_metrics to include goal_created_at
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
  v_goal_created_at TIMESTAMPTZ;
  v_goal_age_days INTEGER;
BEGIN
  -- Get goal data including creation date
  SELECT title, current_streak, longest_streak, frequency_type, frequency_count, created_at
  INTO v_goal_title, v_current_streak, v_longest_streak, v_frequency_type, v_frequency_count, v_goal_created_at
  FROM goals WHERE id = p_goal_id;

  IF v_goal_title IS NULL THEN
    RETURN jsonb_build_object('error', 'Goal not found');
  END IF;

  -- Calculate goal age in days
  v_goal_age_days := (CURRENT_DATE - v_goal_created_at::DATE)::INTEGER;

  -- 30-day stats (exclude pending)
  -- Only count check-ins since goal creation
  SELECT 
    COUNT(*) FILTER (WHERE status != 'pending'),
    COUNT(*) FILTER (WHERE status = 'completed'),
    ROUND(COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / 
          NULLIF(COUNT(*) FILTER (WHERE status != 'pending'), 0), 1)
  INTO v_total_checkins, v_completed_checkins, v_completion_rate_30d
  FROM check_ins
  WHERE goal_id = p_goal_id
    AND check_in_date > CURRENT_DATE - INTERVAL '30 days'
    AND check_in_date >= v_goal_created_at::DATE;

  -- 7-day completion rate
  SELECT ROUND(COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / 
               NULLIF(COUNT(*) FILTER (WHERE status != 'pending'), 0), 1)
  INTO v_completion_rate_7d
  FROM check_ins
  WHERE goal_id = p_goal_id
    AND check_in_date > CURRENT_DATE - INTERVAL '7 days'
    AND check_in_date >= v_goal_created_at::DATE;

  -- Best day (highest completion rate, minimum 2 samples)
  -- Only consider days since goal creation
  -- Note: Days with only 1 check-in are excluded (not statistically meaningful)
  -- If multiple days tie for best rate, the one with more samples is chosen
  SELECT day_index, rate INTO v_best_day, v_best_day_rate FROM (
    SELECT EXTRACT(DOW FROM check_in_date)::int as day_index,
           ROUND(COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / 
                 NULLIF(COUNT(*) FILTER (WHERE status != 'pending'), 0), 1) as rate,
           COUNT(*) FILTER (WHERE status != 'pending') as sample_count
    FROM check_ins
    WHERE goal_id = p_goal_id 
      AND check_in_date > CURRENT_DATE - INTERVAL '90 days'
      AND check_in_date >= v_goal_created_at::DATE
      AND status != 'pending'
    GROUP BY EXTRACT(DOW FROM check_in_date)
    HAVING COUNT(*) FILTER (WHERE status != 'pending') >= 2
    ORDER BY rate DESC, sample_count DESC
    LIMIT 1
  ) sub;

  -- Worst day (lowest completion rate, minimum 2 samples)
  -- Only consider days since goal creation
  -- Note: Days with only 1 check-in are excluded (not statistically meaningful)
  -- If multiple days tie for worst rate, the one with more samples is chosen
  SELECT day_index, rate INTO v_worst_day, v_worst_day_rate FROM (
    SELECT EXTRACT(DOW FROM check_in_date)::int as day_index,
           ROUND(COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / 
                 NULLIF(COUNT(*) FILTER (WHERE status != 'pending'), 0), 1) as rate,
           COUNT(*) FILTER (WHERE status != 'pending') as sample_count
    FROM check_ins
    WHERE goal_id = p_goal_id 
      AND check_in_date > CURRENT_DATE - INTERVAL '90 days'
      AND check_in_date >= v_goal_created_at::DATE
      AND status != 'pending'
    GROUP BY EXTRACT(DOW FROM check_in_date)
    HAVING COUNT(*) FILTER (WHERE status != 'pending') >= 2
    ORDER BY rate ASC, sample_count DESC
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
    'goal_created_at', v_goal_created_at,
    'goal_age_days', v_goal_age_days,
    'calculated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_goal_metrics(UUID) IS 
  'Calculates current metrics for a goal. Includes goal creation date and age for time boundary validation.';
