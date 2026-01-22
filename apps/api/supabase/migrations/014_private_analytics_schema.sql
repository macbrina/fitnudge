-- =====================================================
-- MIGRATION: Move Analytics Views to Private Schema
-- =====================================================
-- Purpose: Fix security issue where materialized views
-- are publicly accessible via PostgREST API.
--
-- Solution: Move views to 'analytics' schema which is
-- not exposed by PostgREST (only 'public' is exposed).
--
-- Access: Views are only accessible via RPC functions
-- which properly filter by user_id.
-- =====================================================

-- Create private analytics schema
CREATE SCHEMA IF NOT EXISTS analytics;

-- Grant usage to required roles
GRANT USAGE ON SCHEMA analytics TO postgres, service_role, authenticated;

-- =====================================================
-- MOVE user_engagement_summary
-- =====================================================

-- Drop old view in public schema
DROP MATERIALIZED VIEW IF EXISTS public.user_engagement_summary CASCADE;

-- Create in analytics schema
CREATE MATERIALIZED VIEW analytics.user_engagement_summary AS
SELECT
    u.id,
    u.username,
    u.name,
    u.plan,
    u.email,
    u.created_at as user_created_at,
    COUNT(DISTINCT g.id) as total_goals,
    COUNT(DISTINCT CASE WHEN g.status = 'active' THEN g.id END) as active_goals,
    COUNT(DISTINCT ci.id) as total_check_ins,
    COUNT(DISTINCT CASE WHEN ci.completed THEN ci.id END) as completed_check_ins,
    COUNT(DISTINCT ap.id) as partner_count,
    MAX(g.current_streak) as best_streak,
    MAX(ci.check_in_date) as last_check_in_date,
    MAX(u.last_login_at) as last_login,
    NOW() as refreshed_at
FROM users u
LEFT JOIN goals g ON u.id = g.user_id
LEFT JOIN check_ins ci ON g.id = ci.goal_id
LEFT JOIN accountability_partners ap ON (u.id = ap.user_id OR u.id = ap.partner_user_id) AND ap.status = 'accepted'
GROUP BY u.id, u.username, u.name, u.plan, u.email, u.created_at;

-- Indexes
CREATE UNIQUE INDEX idx_analytics_user_engagement_id ON analytics.user_engagement_summary(id);
CREATE INDEX idx_analytics_user_engagement_plan ON analytics.user_engagement_summary(plan);
CREATE INDEX idx_analytics_user_engagement_active_goals ON analytics.user_engagement_summary(active_goals DESC);
CREATE INDEX idx_analytics_user_engagement_last_login ON analytics.user_engagement_summary(last_login DESC NULLS LAST);

-- =====================================================
-- MOVE subscription_analytics
-- =====================================================

-- Drop old view in public schema
DROP MATERIALIZED VIEW IF EXISTS public.subscription_analytics CASCADE;

-- Create in analytics schema
CREATE MATERIALIZED VIEW analytics.subscription_analytics AS
SELECT
    plan,
    status,
    platform,
    COUNT(*) as subscription_count,
    COUNT(DISTINCT user_id) as unique_users,
    AVG(EXTRACT(EPOCH FROM (expires_date - purchase_date))/86400) as avg_duration_days,
    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
    SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_count,
    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
    MIN(purchase_date) as first_purchase,
    MAX(purchase_date) as last_purchase,
    NOW() as refreshed_at
FROM subscriptions
GROUP BY plan, status, platform;

-- Indexes
CREATE INDEX idx_analytics_subscription_plan_status ON analytics.subscription_analytics(plan, status);
CREATE INDEX idx_analytics_subscription_platform ON analytics.subscription_analytics(platform);

-- =====================================================
-- MOVE mv_user_daily_stats
-- =====================================================

-- Drop old view in public schema
DROP MATERIALIZED VIEW IF EXISTS public.mv_user_daily_stats CASCADE;

-- Create in analytics schema
CREATE MATERIALIZED VIEW analytics.mv_user_daily_stats AS
SELECT 
    user_id,
    check_in_date,
    EXTRACT(DOW FROM check_in_date)::INT as day_of_week,
    EXTRACT(MONTH FROM check_in_date)::INT as month,
    EXTRACT(YEAR FROM check_in_date)::INT as year,
    COUNT(*) as total_checkins,
    COUNT(*) FILTER (WHERE completed = true OR is_rest_day = true) as completed_checkins,
    COUNT(*) FILTER (WHERE completed = false AND is_rest_day = false) as missed_checkins,
    COUNT(*) FILTER (WHERE skip_reason = 'work') as skip_work,
    COUNT(*) FILTER (WHERE skip_reason = 'tired') as skip_tired,
    COUNT(*) FILTER (WHERE skip_reason = 'sick') as skip_sick,
    COUNT(*) FILTER (WHERE skip_reason = 'schedule') as skip_schedule,
    COUNT(*) FILTER (WHERE skip_reason = 'other' OR (skip_reason IS NULL AND completed = false AND is_rest_day = false)) as skip_other
FROM check_ins
WHERE check_in_date >= CURRENT_DATE - INTERVAL '1 year'
GROUP BY user_id, check_in_date;

-- Indexes
CREATE UNIQUE INDEX idx_analytics_mv_user_daily_stats_pk 
ON analytics.mv_user_daily_stats (user_id, check_in_date);

CREATE INDEX idx_analytics_mv_user_daily_stats_date 
ON analytics.mv_user_daily_stats (user_id, check_in_date DESC);

-- =====================================================
-- MOVE mv_goal_stats
-- =====================================================

-- Drop old view in public schema
DROP MATERIALIZED VIEW IF EXISTS public.mv_goal_stats CASCADE;

-- Create in analytics schema
CREATE MATERIALIZED VIEW analytics.mv_goal_stats AS
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

-- Indexes
CREATE UNIQUE INDEX idx_analytics_mv_goal_stats_pk 
ON analytics.mv_goal_stats (goal_id);

CREATE INDEX idx_analytics_mv_goal_stats_user 
ON analytics.mv_goal_stats (user_id, completion_rate DESC);

-- =====================================================
-- ACCESS CONTROL (Strict)
-- =====================================================

-- Revoke all public access to the schema
REVOKE ALL ON SCHEMA analytics FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA analytics FROM PUBLIC;

-- Only service_role can access (for RPC functions)
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO service_role;

-- =====================================================
-- UPDATE REFRESH FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = analytics, public
AS $$
BEGIN
    -- Refresh concurrently (non-blocking)
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.user_engagement_summary;
    REFRESH MATERIALIZED VIEW analytics.subscription_analytics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_user_daily_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_goal_stats;
    
    RAISE NOTICE 'Analytics views refreshed at %', NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_analytics_views() TO service_role;

-- =====================================================
-- UPDATE get_analytics_dashboard FUNCTION
-- =====================================================

DROP FUNCTION IF EXISTS get_analytics_dashboard(UUID, INT);

CREATE OR REPLACE FUNCTION get_analytics_dashboard(
    p_user_id UUID,
    p_days INT DEFAULT 90
)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = analytics, public
AS $$
WITH date_range AS (
    SELECT 
        CURRENT_DATE - (p_days || ' days')::INTERVAL as start_date,
        CURRENT_DATE as end_date
),

-- Use materialized view for pre-aggregated data (now from analytics schema)
user_stats AS (
    SELECT * FROM analytics.mv_user_daily_stats
    WHERE user_id = p_user_id
      AND check_in_date >= (SELECT start_date FROM date_range)
      AND check_in_date <= (SELECT end_date FROM date_range)
),

-- SUMMARY STATS
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

-- CHART 1: WEEKLY PATTERN
weekly_pattern AS (
    SELECT 
        day_of_week,
        CASE day_of_week
            WHEN 0 THEN 'Sun'
            WHEN 1 THEN 'Mon'
            WHEN 2 THEN 'Tue'
            WHEN 3 THEN 'Wed'
            WHEN 4 THEN 'Thu'
            WHEN 5 THEN 'Fri'
            WHEN 6 THEN 'Sat'
        END as day,
        SUM(total_checkins)::INT as total,
        SUM(completed_checkins)::INT as completed,
        CASE 
            WHEN SUM(total_checkins) > 0 
            THEN ROUND((SUM(completed_checkins)::NUMERIC / SUM(total_checkins)) * 100)::INT
            ELSE 0 
        END as rate
    FROM user_stats
    GROUP BY day_of_week
    ORDER BY day_of_week
),

-- CHART 2: SKIP REASONS
skip_reasons AS (
    SELECT 
        'Work' as reason, SUM(skip_work)::INT as count, '#3B82F6' as color
    FROM user_stats
    UNION ALL
    SELECT 'Tired', SUM(skip_tired)::INT, '#F59E0B' FROM user_stats
    UNION ALL  
    SELECT 'Sick', SUM(skip_sick)::INT, '#EF4444' FROM user_stats
    UNION ALL
    SELECT 'Schedule', SUM(skip_schedule)::INT, '#8B5CF6' FROM user_stats
    UNION ALL
    SELECT 'Other', SUM(skip_other)::INT, '#6B7280' FROM user_stats
),

-- CHART 3: GOAL BREAKDOWN (from analytics schema)
goal_breakdown AS (
    SELECT 
        title as goal,
        completion_rate::NUMERIC * 100 as rate,
        CASE (ROW_NUMBER() OVER (ORDER BY completion_rate DESC))::INT % 8
            WHEN 0 THEN '#3B82F6'
            WHEN 1 THEN '#10B981'
            WHEN 2 THEN '#F59E0B'
            WHEN 3 THEN '#EF4444'
            WHEN 4 THEN '#8B5CF6'
            WHEN 5 THEN '#EC4899'
            WHEN 6 THEN '#22C55E'
            WHEN 7 THEN '#8B5CF6'
            WHEN 8 THEN '#EF4444'
            ELSE '#3B82F6'
        END as color
    FROM analytics.mv_goal_stats
    WHERE user_id = p_user_id
      AND total_checkins > 0
    ORDER BY completion_rate DESC
    LIMIT 5
),

-- CHART 4: MONTHLY TREND
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
        COALESCE(SUM(us.completed_checkins), 0)::INT as completed,
        COALESCE(SUM(us.total_checkins), 0)::INT as total
    FROM months m
    LEFT JOIN user_stats us 
        ON DATE_TRUNC('month', us.check_in_date) = m.month_date
    GROUP BY m.month_date, TO_CHAR(m.month_date, 'Mon')
    ORDER BY m.month_date
)

SELECT json_build_object(
    'summary', (SELECT row_to_json(s) FROM summary s),
    'weekly_pattern', (SELECT COALESCE(json_agg(row_to_json(w)), '[]'::json) FROM weekly_pattern w),
    'skip_reasons', (SELECT COALESCE(json_agg(row_to_json(sr)), '[]'::json) FROM skip_reasons sr WHERE sr.count > 0),
    'goal_breakdown', (SELECT COALESCE(json_agg(row_to_json(gb)), '[]'::json) FROM goal_breakdown gb),
    'monthly_trend', (SELECT COALESCE(json_agg(row_to_json(mt)), '[]'::json) FROM monthly_trend mt),
    'period_days', p_days,
    'generated_at', NOW()
);
$$;

GRANT EXECUTE ON FUNCTION get_analytics_dashboard(UUID, INT) TO authenticated, service_role;

-- =====================================================
-- INITIAL REFRESH
-- =====================================================

REFRESH MATERIALIZED VIEW analytics.user_engagement_summary;
REFRESH MATERIALIZED VIEW analytics.subscription_analytics;
REFRESH MATERIALIZED VIEW analytics.mv_user_daily_stats;
REFRESH MATERIALIZED VIEW analytics.mv_goal_stats;

-- =====================================================
-- DOCUMENTATION
-- =====================================================

COMMENT ON SCHEMA analytics IS 
'Private schema for analytics materialized views. 
Not exposed via PostgREST API (only public schema is exposed).
Access only via RPC functions with proper user filtering.';

COMMENT ON MATERIALIZED VIEW analytics.user_engagement_summary IS 
'Pre-computed user engagement metrics. Refreshed hourly via Celery.';

COMMENT ON MATERIALIZED VIEW analytics.subscription_analytics IS 
'Pre-computed subscription metrics. Admin/service role only.';

COMMENT ON MATERIALIZED VIEW analytics.mv_user_daily_stats IS 
'Daily aggregated check-in stats per user. Used by get_analytics_dashboard.';

COMMENT ON MATERIALIZED VIEW analytics.mv_goal_stats IS 
'Goal-level aggregated stats. Used by get_analytics_dashboard.';
