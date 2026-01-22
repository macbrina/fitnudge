-- =====================================================
-- MIGRATION: Update Analytics Views for Check-in Status
-- =====================================================
-- Purpose: Update materialized views in analytics schema
-- to use the new status column instead of completed/is_rest_day.
--
-- IMPORTANT: This is a separate migration because Supabase
-- has restrictions on mixing materialized view operations
-- with other SQL statements in the same migration.
--
-- All views are in the private 'analytics' schema (not exposed
-- via PostgREST API - only accessible via RPC functions).
-- =====================================================

-- =====================================================
-- 1. UPDATE: analytics.mv_user_daily_stats
-- Uses status column for counting
-- =====================================================

DROP MATERIALIZED VIEW IF EXISTS analytics.mv_user_daily_stats CASCADE;

CREATE MATERIALIZED VIEW analytics.mv_user_daily_stats AS
SELECT 
    ci.user_id,
    ci.check_in_date,
    EXTRACT(DOW FROM ci.check_in_date)::INT as day_of_week,
    EXTRACT(MONTH FROM ci.check_in_date)::INT as month,
    EXTRACT(YEAR FROM ci.check_in_date)::INT as year,
    COUNT(*) as total_checkins,
    -- Completed = status is 'completed' or 'rest_day'
    COUNT(*) FILTER (WHERE ci.status IN ('completed', 'rest_day')) as completed_checkins,
    -- Missed = status is 'missed' or 'skipped'
    COUNT(*) FILTER (WHERE ci.status IN ('missed', 'skipped')) as missed_checkins,
    -- Skip reason counts (only from skipped status)
    COUNT(*) FILTER (WHERE ci.status = 'skipped' AND ci.skip_reason = 'work') as skip_work,
    COUNT(*) FILTER (WHERE ci.status = 'skipped' AND ci.skip_reason = 'tired') as skip_tired,
    COUNT(*) FILTER (WHERE ci.status = 'skipped' AND ci.skip_reason = 'sick') as skip_sick,
    COUNT(*) FILTER (WHERE ci.status = 'skipped' AND ci.skip_reason = 'schedule') as skip_schedule,
    COUNT(*) FILTER (WHERE ci.status = 'skipped' AND (ci.skip_reason = 'other' OR ci.skip_reason IS NULL)) as skip_other,
    -- Pending count (for debugging/monitoring)
    COUNT(*) FILTER (WHERE ci.status = 'pending') as pending_checkins
FROM check_ins ci
-- Only include check-ins for active goals
JOIN goals g ON ci.goal_id = g.id AND g.status = 'active'
WHERE ci.check_in_date >= CURRENT_DATE - INTERVAL '1 year'
  -- Exclude pending check-ins from analytics (they're not finalized)
  AND ci.status != 'pending'
GROUP BY ci.user_id, ci.check_in_date;

-- Recreate indexes
CREATE UNIQUE INDEX idx_analytics_mv_user_daily_stats_pk 
ON analytics.mv_user_daily_stats (user_id, check_in_date);

CREATE INDEX idx_analytics_mv_user_daily_stats_date 
ON analytics.mv_user_daily_stats (user_id, check_in_date DESC);

-- =====================================================
-- 2. UPDATE: analytics.mv_goal_stats
-- Uses status column for counting
-- =====================================================

DROP MATERIALIZED VIEW IF EXISTS analytics.mv_goal_stats CASCADE;

CREATE MATERIALIZED VIEW analytics.mv_goal_stats AS
SELECT 
    g.id as goal_id,
    g.user_id,
    g.title,
    g.status,
    g.created_at,
    COUNT(c.id) FILTER (WHERE c.status != 'pending') as total_checkins,
    COUNT(c.id) FILTER (WHERE c.status IN ('completed', 'rest_day')) as completed_checkins,
    CASE 
        WHEN COUNT(c.id) FILTER (WHERE c.status != 'pending') > 0 
        THEN ROUND((COUNT(c.id) FILTER (WHERE c.status IN ('completed', 'rest_day'))::NUMERIC / 
                    COUNT(c.id) FILTER (WHERE c.status != 'pending')), 3)
        ELSE 0 
    END as completion_rate
FROM goals g
LEFT JOIN check_ins c ON c.goal_id = g.id 
    AND c.check_in_date >= CURRENT_DATE - INTERVAL '90 days'
WHERE g.status = 'active'
GROUP BY g.id, g.user_id, g.title, g.status, g.created_at;

-- Recreate indexes
CREATE UNIQUE INDEX idx_analytics_mv_goal_stats_pk 
ON analytics.mv_goal_stats (goal_id);

CREATE INDEX idx_analytics_mv_goal_stats_user 
ON analytics.mv_goal_stats (user_id, completion_rate DESC);

-- =====================================================
-- 3. UPDATE: analytics.user_engagement_summary
-- Uses status column for check-in counts
-- =====================================================

DROP MATERIALIZED VIEW IF EXISTS analytics.user_engagement_summary CASCADE;

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
    -- V2: Use status instead of completed boolean
    COUNT(DISTINCT CASE WHEN ci.status = 'completed' THEN ci.id END) as completed_check_ins,
    COUNT(DISTINCT ap.id) as partner_count,
    MAX(g.current_streak) as best_streak,
    MAX(ci.check_in_date) as last_check_in_date,
    MAX(u.last_login_at) as last_login,
    NOW() as refreshed_at
FROM users u
LEFT JOIN goals g ON u.id = g.user_id
LEFT JOIN check_ins ci ON g.id = ci.goal_id AND ci.status != 'pending'
LEFT JOIN accountability_partners ap ON (u.id = ap.user_id OR u.id = ap.partner_user_id) AND ap.status = 'accepted'
GROUP BY u.id, u.username, u.name, u.plan, u.email, u.created_at;

-- Indexes
CREATE UNIQUE INDEX idx_analytics_user_engagement_id ON analytics.user_engagement_summary(id);
CREATE INDEX idx_analytics_user_engagement_plan ON analytics.user_engagement_summary(plan);
CREATE INDEX idx_analytics_user_engagement_active_goals ON analytics.user_engagement_summary(active_goals DESC);
CREATE INDEX idx_analytics_user_engagement_last_login ON analytics.user_engagement_summary(last_login DESC NULLS LAST);

-- =====================================================
-- 4. GRANT PERMISSIONS
-- Only service_role can access (for RPC functions)
-- =====================================================

GRANT SELECT ON analytics.mv_user_daily_stats TO service_role;
GRANT SELECT ON analytics.mv_goal_stats TO service_role;
GRANT SELECT ON analytics.user_engagement_summary TO service_role;

-- =====================================================
-- 5. UPDATE: refresh_analytics_views function
-- To use analytics schema views
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = analytics, public
AS $$
BEGIN
    -- Refresh concurrently (non-blocking) for views with unique indexes
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.user_engagement_summary;
    REFRESH MATERIALIZED VIEW analytics.subscription_analytics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_user_daily_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_goal_stats;
    
    RAISE NOTICE 'Analytics views refreshed at %', NOW();
END;
$$;

-- =====================================================
-- 6. INITIAL REFRESH
-- =====================================================

REFRESH MATERIALIZED VIEW analytics.user_engagement_summary;
REFRESH MATERIALIZED VIEW analytics.mv_user_daily_stats;
REFRESH MATERIALIZED VIEW analytics.mv_goal_stats;

-- =====================================================
-- 7. COMMENTS
-- =====================================================

COMMENT ON MATERIALIZED VIEW analytics.mv_user_daily_stats IS 
  'V2: Updated to use status column. Aggregates daily check-in stats by status for analytics.';

COMMENT ON MATERIALIZED VIEW analytics.mv_goal_stats IS 
  'V2: Updated to use status column. Aggregates goal-level stats for comparison charts.';

COMMENT ON MATERIALIZED VIEW analytics.user_engagement_summary IS 
  'V2: Updated to use status column. Pre-computed user engagement metrics.';
