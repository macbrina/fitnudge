-- =============================================================================
-- Analytics Dashboard - Optimized for Scale
-- =============================================================================
-- Implements:
-- 1. Composite indexes for fast analytics queries
-- 2. Materialized views for pre-aggregation
-- 3. Optimized RPC with parallel CTEs
-- 4. Refresh function for Celery tasks
--
-- Supports 100K+ users following SCALABILITY.md patterns
-- =============================================================================

-- =============================================================================
-- PHASE 2: INDEXES (10K - 50K users)
-- =============================================================================
-- Note: Cannot use CONCURRENTLY in migration transactions.
-- For production with large tables, create indexes manually outside migrations.

-- Main analytics index (covers most queries)
CREATE INDEX IF NOT EXISTS idx_checkins_analytics 
ON check_ins (user_id, check_in_date DESC, completed, is_rest_day, skip_reason);

-- Goal-based analytics
CREATE INDEX IF NOT EXISTS idx_checkins_goal_analytics 
ON check_ins (goal_id, check_in_date DESC, completed, is_rest_day);

-- Skip reason analysis
CREATE INDEX IF NOT EXISTS idx_checkins_skip_analysis 
ON check_ins (user_id, check_in_date) 
WHERE completed = false AND is_rest_day = false;


-- =============================================================================
-- PHASE 3: MATERIALIZED VIEWS (50K - 100K users)
-- =============================================================================

-- Daily aggregated stats per user (base for all analytics)
DROP MATERIALIZED VIEW IF EXISTS mv_user_daily_stats CASCADE;
CREATE MATERIALIZED VIEW mv_user_daily_stats AS
SELECT 
    user_id,
    check_in_date,
    EXTRACT(DOW FROM check_in_date)::INT as day_of_week,
    EXTRACT(MONTH FROM check_in_date)::INT as month,
    EXTRACT(YEAR FROM check_in_date)::INT as year,
    COUNT(*) as total_checkins,
    COUNT(*) FILTER (WHERE completed = true OR is_rest_day = true) as completed_checkins,
    COUNT(*) FILTER (WHERE completed = false AND is_rest_day = false) as missed_checkins,
    -- Skip reason counts
    COUNT(*) FILTER (WHERE skip_reason = 'work') as skip_work,
    COUNT(*) FILTER (WHERE skip_reason = 'tired') as skip_tired,
    COUNT(*) FILTER (WHERE skip_reason = 'sick') as skip_sick,
    COUNT(*) FILTER (WHERE skip_reason = 'schedule') as skip_schedule,
    COUNT(*) FILTER (WHERE skip_reason = 'other' OR (skip_reason IS NULL AND completed = false AND is_rest_day = false)) as skip_other
FROM check_ins
WHERE check_in_date >= CURRENT_DATE - INTERVAL '1 year'  -- Keep 1 year of data
GROUP BY user_id, check_in_date;

-- Index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_daily_stats_pk 
ON mv_user_daily_stats (user_id, check_in_date);

CREATE INDEX IF NOT EXISTS idx_mv_user_daily_stats_date 
ON mv_user_daily_stats (user_id, check_in_date DESC);


-- Goal-level aggregated stats
DROP MATERIALIZED VIEW IF EXISTS mv_goal_stats CASCADE;
CREATE MATERIALIZED VIEW mv_goal_stats AS
SELECT 
    g.id as goal_id,
    g.user_id,
    g.title,
    g.status,
    g.created_at,
    COUNT(c.id) as total_checkins,
    COUNT(c.id) FILTER (WHERE c.completed = true OR c.is_rest_day = true) as completed_checkins,
    CASE 
        WHEN COUNT(c.id) > 0 
        THEN ROUND((COUNT(c.id) FILTER (WHERE c.completed = true OR c.is_rest_day = true)::NUMERIC / COUNT(c.id)), 3)
        ELSE 0 
    END as completion_rate
FROM goals g
LEFT JOIN check_ins c ON c.goal_id = g.id 
    AND c.check_in_date >= CURRENT_DATE - INTERVAL '90 days'
WHERE g.status = 'active'
GROUP BY g.id, g.user_id, g.title, g.status, g.created_at;

-- Index on goal stats
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_goal_stats_pk 
ON mv_goal_stats (goal_id);

CREATE INDEX IF NOT EXISTS idx_mv_goal_stats_user 
ON mv_goal_stats (user_id, completion_rate DESC);


-- =============================================================================
-- MATERIALIZED VIEW REFRESH FUNCTION (for Celery)
-- =============================================================================

CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Refresh concurrently (non-blocking)
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_daily_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_goal_stats;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_analytics_views() TO service_role;


-- =============================================================================
-- OPTIMIZED RPC WITH PARALLEL CTEs
-- =============================================================================

DROP FUNCTION IF EXISTS get_analytics_dashboard(UUID, INT);

CREATE OR REPLACE FUNCTION get_analytics_dashboard(
    p_user_id UUID,
    p_days INT DEFAULT 90
)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
STABLE  -- Can be cached by PostgreSQL
PARALLEL SAFE  -- Can run in parallel workers
AS $$
WITH
-- ==========================================================================
-- BASE DATA (computed once, reused by all CTEs)
-- ==========================================================================
date_range AS (
    SELECT 
        CURRENT_DATE - p_days as start_date,
        CURRENT_DATE as end_date
),

-- Use materialized view for pre-aggregated data
user_stats AS (
    SELECT * FROM mv_user_daily_stats
    WHERE user_id = p_user_id
      AND check_in_date >= (SELECT start_date FROM date_range)
      AND check_in_date <= (SELECT end_date FROM date_range)
),

-- ==========================================================================
-- SUMMARY STATS (from materialized view)
-- ==========================================================================
summary AS (
    SELECT 
        COALESCE(SUM(total_checkins), 0)::INT as total_check_ins,
        COALESCE(SUM(completed_checkins), 0)::INT as completed_check_ins,
        CASE 
            WHEN SUM(total_checkins) > 0 
            THEN ROUND((SUM(completed_checkins)::NUMERIC / SUM(total_checkins)) * 100, 1)
            ELSE 0 
        END as completion_rate
    FROM user_stats
),

-- Streak stats from goals table (already denormalized)
streak_stats AS (
    SELECT 
        COALESCE(MAX(current_streak), 0) as current_streak,
        COALESCE(MAX(longest_streak), 0) as longest_streak
    FROM goals
    WHERE user_id = p_user_id AND status = 'active'
),

-- ==========================================================================
-- CHART 1: WEEKLY CONSISTENCY (parallel with other CTEs)
-- ==========================================================================
weekly_consistency AS (
    SELECT 
        CASE day_of_week
            WHEN 0 THEN 'Sun'
            WHEN 1 THEN 'Mon'
            WHEN 2 THEN 'Tue'
            WHEN 3 THEN 'Wed'
            WHEN 4 THEN 'Thu'
            WHEN 5 THEN 'Fri'
            WHEN 6 THEN 'Sat'
        END as day,
        day_of_week as day_index,
        SUM(total_checkins)::INT as total,
        SUM(completed_checkins)::INT as completed,
        CASE 
            WHEN SUM(total_checkins) > 0 
            THEN ROUND((SUM(completed_checkins)::NUMERIC / SUM(total_checkins)) * 100)::INT
            ELSE 0 
        END as percentage,
        -- Order: Mon(1), Tue(2), ..., Sat(6), Sun(0->7)
        CASE day_of_week WHEN 0 THEN 7 ELSE day_of_week END as day_order
    FROM user_stats
    GROUP BY day_of_week
    ORDER BY day_order
),

-- ==========================================================================
-- CHART 2: STREAK HISTORY (last 12 weeks)
-- ==========================================================================
weeks AS (
    SELECT 
        week_num,
        (CURRENT_DATE - (12 - week_num) * 7)::DATE as week_start,
        (CURRENT_DATE - (12 - week_num - 1) * 7 - 1)::DATE as week_end
    FROM generate_series(1, 12) as week_num
),

streak_history AS (
    SELECT 
        'W' || w.week_num as week,
        w.week_start::TEXT as week_start,
        COALESCE(
            (
                SELECT MAX(streak_len)
                FROM (
                    SELECT COUNT(*) as streak_len
                    FROM (
                        SELECT 
                            check_in_date,
                            check_in_date - (ROW_NUMBER() OVER (ORDER BY check_in_date))::INT as grp
                        FROM user_stats
                        WHERE check_in_date >= w.week_start
                          AND check_in_date <= w.week_end
                          AND completed_checkins > 0
                    ) t
                    GROUP BY grp
                ) streaks
            ),
            0
        )::INT as max_streak
    FROM weeks w
    ORDER BY w.week_num
),

-- ==========================================================================
-- CHART 3: GOAL COMPARISON (from materialized view)
-- ==========================================================================
goal_comparison AS (
    SELECT 
        goal_id as id,
        title,
        total_checkins as total,
        completed_checkins as completed,
        completion_rate as completion,
        CASE (ROW_NUMBER() OVER (ORDER BY created_at) - 1) % 10
            WHEN 0 THEN '#FF6B6B'
            WHEN 1 THEN '#4ECDC4'
            WHEN 2 THEN '#6366F1'
            WHEN 3 THEN '#F59E0B'
            WHEN 4 THEN '#EC4899'
            WHEN 5 THEN '#06B6D4'
            WHEN 6 THEN '#22C55E'
            WHEN 7 THEN '#8B5CF6'
            WHEN 8 THEN '#EF4444'
            ELSE '#3B82F6'
        END as color
    FROM mv_goal_stats
    WHERE user_id = p_user_id
      AND total_checkins > 0
    ORDER BY completion_rate DESC
    LIMIT 5
),

-- ==========================================================================
-- CHART 4: MONTHLY TREND (last 6 months)
-- ==========================================================================
months AS (
    SELECT generate_series(
        DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months'),
        DATE_TRUNC('month', CURRENT_DATE),
        '1 month'::INTERVAL
    )::DATE as month_date
),

monthly_trend AS (
    SELECT 
        TO_CHAR(m.month_date, 'Mon') as month,
        (EXTRACT(MONTH FROM m.month_date)::INT - 1) as month_index,
        EXTRACT(YEAR FROM m.month_date)::INT as year,
        COALESCE(SUM(us.total_checkins), 0)::INT as total,
        COALESCE(SUM(us.completed_checkins), 0)::INT as completed,
        CASE 
            WHEN COALESCE(SUM(us.total_checkins), 0) > 0 
            THEN ROUND((SUM(us.completed_checkins)::NUMERIC / SUM(us.total_checkins)) * 100)::INT
            ELSE 0 
        END as percentage
    FROM months m
    LEFT JOIN user_stats us ON DATE_TRUNC('month', us.check_in_date) = m.month_date
    GROUP BY m.month_date
    ORDER BY m.month_date
),

-- ==========================================================================
-- CHART 5: SKIP REASONS DISTRIBUTION
-- ==========================================================================
skip_totals AS (
    SELECT 
        SUM(skip_work) as work,
        SUM(skip_tired) as tired,
        SUM(skip_sick) as sick,
        SUM(skip_schedule) as schedule,
        SUM(skip_other) as other,
        SUM(missed_checkins) as total_missed
    FROM user_stats
),

skip_reasons AS (
    SELECT 
        reason,
        label,
        count,
        CASE 
            WHEN (SELECT total_missed FROM skip_totals) > 0 
            THEN ROUND((count::NUMERIC / (SELECT total_missed FROM skip_totals)) * 100)::INT
            ELSE 0 
        END as percentage,
        color
    FROM (
        SELECT 'work' as reason, 'Work' as label, (SELECT work FROM skip_totals)::INT as count, '#FF6B6B' as color
        UNION ALL
        SELECT 'tired', 'Tired', (SELECT tired FROM skip_totals)::INT, '#4ECDC4'
        UNION ALL
        SELECT 'sick', 'Sick', (SELECT sick FROM skip_totals)::INT, '#9B59B6'
        UNION ALL
        SELECT 'schedule', 'Schedule', (SELECT schedule FROM skip_totals)::INT, '#F39C12'
        UNION ALL
        SELECT 'other', 'Other', (SELECT other FROM skip_totals)::INT, '#95A5A6'
    ) reasons
    WHERE count > 0
    ORDER BY count DESC
)

-- ==========================================================================
-- FINAL RESULT
-- ==========================================================================
SELECT json_build_object(
    -- Summary stats
    'total_check_ins', (SELECT total_check_ins FROM summary),
    'completed_check_ins', (SELECT completed_check_ins FROM summary),
    'completion_rate', (SELECT completion_rate FROM summary),
    'current_streak', (SELECT current_streak FROM streak_stats),
    'longest_streak', (SELECT longest_streak FROM streak_stats),
    
    -- Chart data
    'weekly_consistency', COALESCE((SELECT json_agg(row_to_json(w)) FROM weekly_consistency w), '[]'::json),
    'streak_history', COALESCE((SELECT json_agg(row_to_json(s)) FROM streak_history s), '[]'::json),
    'goal_comparison', COALESCE((SELECT json_agg(row_to_json(g)) FROM goal_comparison g), '[]'::json),
    'monthly_trend', COALESCE((SELECT json_agg(row_to_json(m)) FROM monthly_trend m), '[]'::json),
    'skip_reasons', COALESCE((SELECT json_agg(row_to_json(r)) FROM skip_reasons r), '[]'::json),
    
    -- Metadata
    'data_range_days', p_days,
    'generated_at', NOW()::TEXT,
    'cache_hint', 'mv'  -- Indicates data came from materialized views
);
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_analytics_dashboard(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_dashboard(UUID, INT) TO service_role;

-- Add comment
COMMENT ON FUNCTION get_analytics_dashboard IS 
'Returns comprehensive analytics dashboard data for a user.
Uses materialized views and parallel CTEs for optimal performance.
Premium feature - caller should verify subscription access.
Cache the result in Redis for 1 hour for best performance.';
