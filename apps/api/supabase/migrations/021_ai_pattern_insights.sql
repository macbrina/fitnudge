-- =====================================================
-- FitNudge - AI-Powered Pattern Insights
-- Migration 022
-- 
-- Replaces SQL-based pattern detection with AI-powered insights.
-- Key changes:
-- - One row per goal (upsert pattern)
-- - Status tracking: pending, generating, completed, failed, insufficient_data
-- - AI-generated insights stored as JSONB
-- - Metrics snapshots for trend comparison
-- - Nudge config for adaptive nudging (no second AI call)
-- - Realtime enabled for live UI updates
-- =====================================================

-- =====================================================
-- 1. DROP OLD SQL FUNCTIONS AND INDEXES
-- These are replaced by AI-powered generation
-- =====================================================

-- Drop old functions from migration 008 and 021
DROP FUNCTION IF EXISTS detect_goal_patterns(UUID);
DROP FUNCTION IF EXISTS detect_all_goal_patterns(UUID);
DROP FUNCTION IF EXISTS get_goal_insights(UUID);
DROP FUNCTION IF EXISTS get_goal_insights_metadata(UUID);
DROP FUNCTION IF EXISTS detect_user_patterns(UUID);

-- Drop old indexes from migration 008 (will be replaced with new ones)
DROP INDEX IF EXISTS idx_pattern_insights_goal_valid;
DROP INDEX IF EXISTS idx_pattern_insights_active;

-- =====================================================
-- 2. UPDATE PATTERN_INSIGHTS TABLE SCHEMA
-- =====================================================

-- Add new columns for AI-powered insights
ALTER TABLE pattern_insights 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

ALTER TABLE pattern_insights
  ADD COLUMN IF NOT EXISTS evidence JSONB;

ALTER TABLE pattern_insights 
  ADD COLUMN IF NOT EXISTS insights JSONB;

ALTER TABLE pattern_insights 
  ADD COLUMN IF NOT EXISTS summary TEXT;

ALTER TABLE pattern_insights 
  ADD COLUMN IF NOT EXISTS nudge_config JSONB;

ALTER TABLE pattern_insights 
  ADD COLUMN IF NOT EXISTS current_metrics JSONB;

ALTER TABLE pattern_insights 
  ADD COLUMN IF NOT EXISTS previous_metrics JSONB;

ALTER TABLE pattern_insights 
  ADD COLUMN IF NOT EXISTS checkins_analyzed INTEGER DEFAULT 0;

ALTER TABLE pattern_insights 
  ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE pattern_insights 
  ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ;

ALTER TABLE pattern_insights 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add status check constraint
ALTER TABLE pattern_insights 
  DROP CONSTRAINT IF EXISTS pattern_insights_status_check;
ALTER TABLE pattern_insights 
  ADD CONSTRAINT pattern_insights_status_check 
  CHECK (status IN ('pending', 'generating', 'completed', 'failed', 'insufficient_data'));

-- Add unique constraint for one row per goal (drop if exists first)
-- Note: We need to handle existing duplicate rows first
DO $$
BEGIN
  -- Delete duplicates, keeping only the most recent per goal
  DELETE FROM pattern_insights p1
  WHERE p1.id NOT IN (
    SELECT DISTINCT ON (goal_id) id
    FROM pattern_insights
    WHERE goal_id IS NOT NULL
    ORDER BY goal_id, created_at DESC NULLS LAST
  )
  AND p1.goal_id IS NOT NULL;
  
  -- Now add the unique constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pattern_insights_goal_unique'
  ) THEN
    ALTER TABLE pattern_insights 
      ADD CONSTRAINT pattern_insights_goal_unique UNIQUE (goal_id);
  END IF;
END $$;

-- =====================================================
-- 2b. DROP OLD COLUMNS AND CONSTRAINTS
-- These are no longer needed with AI-powered insights
-- =====================================================

-- Drop old insight_type constraint first (from migration 003)
ALTER TABLE pattern_insights 
  DROP CONSTRAINT IF EXISTS pattern_insights_insight_type_check;

-- Drop old columns that are replaced by new JSONB structure
-- insight_type, insight_text, insight_data -> replaced by 'insights' JSONB
-- valid_from, valid_until -> replaced by 'generated_at'
ALTER TABLE pattern_insights 
  DROP COLUMN IF EXISTS insight_type,
  DROP COLUMN IF EXISTS insight_text,
  DROP COLUMN IF EXISTS insight_data,
  DROP COLUMN IF EXISTS valid_from,
  DROP COLUMN IF EXISTS valid_until;

-- =====================================================
-- 3. INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_pattern_insights_status 
  ON pattern_insights(status);

CREATE INDEX IF NOT EXISTS idx_pattern_insights_user_status 
  ON pattern_insights(user_id, status);

CREATE INDEX IF NOT EXISTS idx_pattern_insights_generated_at 
  ON pattern_insights(generated_at DESC);

-- =====================================================
-- 4. UPDATED_AT TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION update_pattern_insights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pattern_insights_updated_at ON pattern_insights;
CREATE TRIGGER trigger_pattern_insights_updated_at
  BEFORE UPDATE ON pattern_insights
  FOR EACH ROW EXECUTE FUNCTION update_pattern_insights_updated_at();

-- =====================================================
-- 5. ENABLE REALTIME
-- =====================================================

-- Enable realtime for pattern_insights table
DO $$
BEGIN
  -- Check if table is already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'pattern_insights'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE pattern_insights;
  END IF;
END $$;

-- =====================================================
-- 6. HELPER FUNCTION: Calculate Metrics for a Goal
-- Used by AI service to get current metrics
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

  -- 30-day stats
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE completed = true),
    ROUND(COUNT(*) FILTER (WHERE completed = true) * 100.0 / NULLIF(COUNT(*), 0), 1)
  INTO v_total_checkins, v_completed_checkins, v_completion_rate_30d
  FROM check_ins
  WHERE goal_id = p_goal_id
    AND check_in_date > CURRENT_DATE - INTERVAL '30 days';

  -- 7-day completion rate
  SELECT ROUND(COUNT(*) FILTER (WHERE completed = true) * 100.0 / NULLIF(COUNT(*), 0), 1)
  INTO v_completion_rate_7d
  FROM check_ins
  WHERE goal_id = p_goal_id
    AND check_in_date > CURRENT_DATE - INTERVAL '7 days';

  -- Best day (highest completion rate, minimum 2 samples)
  SELECT day_index, rate INTO v_best_day, v_best_day_rate FROM (
    SELECT EXTRACT(DOW FROM check_in_date)::int as day_index,
           ROUND(COUNT(*) FILTER (WHERE completed = true) * 100.0 / NULLIF(COUNT(*), 0), 1) as rate
    FROM check_ins
    WHERE goal_id = p_goal_id AND check_in_date > CURRENT_DATE - INTERVAL '90 days'
    GROUP BY EXTRACT(DOW FROM check_in_date)
    HAVING COUNT(*) >= 2
    ORDER BY rate DESC
    LIMIT 1
  ) sub;

  -- Worst day (lowest completion rate, minimum 2 samples)
  SELECT day_index, rate INTO v_worst_day, v_worst_day_rate FROM (
    SELECT EXTRACT(DOW FROM check_in_date)::int as day_index,
           ROUND(COUNT(*) FILTER (WHERE completed = true) * 100.0 / NULLIF(COUNT(*), 0), 1) as rate
    FROM check_ins
    WHERE goal_id = p_goal_id AND check_in_date > CURRENT_DATE - INTERVAL '90 days'
    GROUP BY EXTRACT(DOW FROM check_in_date)
    HAVING COUNT(*) >= 2
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

COMMENT ON FUNCTION calculate_goal_metrics(UUID) IS 
  'Calculates current metrics for a goal. Used by AI insights service.';

-- =====================================================
-- 7. HELPER FUNCTION: Get Recent Check-ins for AI Context
-- Returns detailed check-in data for AI analysis
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
      'completed', completed,
      'skip_reason', skip_reason,
      'mood', mood,
      'note', LEFT(note, 100)  -- Truncate for context size
    ) ORDER BY check_in_date DESC
  )
  INTO v_checkins
  FROM (
    SELECT check_in_date, completed, skip_reason, mood, note
    FROM check_ins
    WHERE goal_id = p_goal_id
    ORDER BY check_in_date DESC
    LIMIT p_limit
  ) sub;

  RETURN COALESCE(v_checkins, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_checkins_for_ai(UUID, INTEGER) IS 
  'Returns recent check-ins formatted for AI context.';

-- =====================================================
-- 8. HELPER FUNCTION: Get Skip Reason Summary
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
      AND completed = false
      AND skip_reason IS NOT NULL
      AND check_in_date > CURRENT_DATE - INTERVAL '90 days'
    GROUP BY skip_reason
    ORDER BY count DESC
    LIMIT 5
  ) sub;

  RETURN COALESCE(v_summary, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_skip_reasons_summary(UUID) IS 
  'Returns summary of skip reasons for AI context.';

-- =====================================================
-- 9. RLS POLICIES
-- =====================================================

-- Enable RLS if not already
ALTER TABLE pattern_insights ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own pattern insights" ON pattern_insights;
DROP POLICY IF EXISTS "Users can insert own pattern insights" ON pattern_insights;
DROP POLICY IF EXISTS "Users can update own pattern insights" ON pattern_insights;
DROP POLICY IF EXISTS "Service can manage pattern insights" ON pattern_insights;

-- Authenticated users can view their own insights
CREATE POLICY "Users can view own pattern insights"
  ON pattern_insights FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role can do everything (for background tasks)
CREATE POLICY "Service can manage pattern insights"
  ON pattern_insights FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 10. COMMENTS
-- =====================================================

COMMENT ON COLUMN pattern_insights.summary IS 
  'AI-generated summary of the pattern insights (1-2 sentences)';

COMMENT ON COLUMN pattern_insights.evidence IS
  'Deterministically computed evidence block (window, counts, weekday_stats). Stored internally for debugging/validation, not exposed to users.';

COMMENT ON TABLE pattern_insights IS 
  'AI-generated pattern insights for goals. One row per goal, updated weekly or on-demand.';

COMMENT ON COLUMN pattern_insights.status IS 
  'Status of insight generation: pending, generating, completed, failed, insufficient_data';

COMMENT ON COLUMN pattern_insights.insights IS 
  'AI-generated insights array: [{type, text, priority}]';

COMMENT ON COLUMN pattern_insights.nudge_config IS 
  'Nudge configuration for adaptive nudging: {risky_days, risk_level, suggested_nudge_time}';

COMMENT ON COLUMN pattern_insights.current_metrics IS 
  'Metrics snapshot from current analysis';

COMMENT ON COLUMN pattern_insights.previous_metrics IS 
  'Metrics snapshot from previous analysis (for trend comparison)';
