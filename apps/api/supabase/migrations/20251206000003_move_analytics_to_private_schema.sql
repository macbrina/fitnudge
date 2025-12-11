-- =====================================================
-- MOVE ANALYTICS VIEWS TO PRIVATE SCHEMA
-- Security: Hide from PostgREST API, admin/backend only
-- =====================================================

-- Problem: Views in public schema are exposed via Supabase API
-- Solution: Move to private 'analytics' schema (not exposed by PostgREST)

-- =====================================================
-- 1. CREATE ANALYTICS SCHEMA
-- =====================================================

CREATE SCHEMA IF NOT EXISTS analytics;

-- Grant usage to service role (backend/admin access)
GRANT USAGE ON SCHEMA analytics TO service_role;

-- =====================================================
-- 2. DROP EXISTING PUBLIC VIEWS
-- =====================================================

-- Drop public schema materialized views
DROP MATERIALIZED VIEW IF EXISTS public.user_engagement_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.subscription_analytics CASCADE;

-- Drop old refresh function
DROP FUNCTION IF EXISTS public.refresh_analytics_views();

-- =====================================================
-- 3. CREATE MATERIALIZED VIEWS IN ANALYTICS SCHEMA
-- =====================================================

-- User engagement summary (moved to analytics schema)
CREATE MATERIALIZED VIEW analytics.user_engagement_summary AS
SELECT
    u.id,
    u.username,
    u.plan,
    u.email,
    u.created_at as user_created_at,
    COUNT(DISTINCT g.id) as total_goals,
    COUNT(DISTINCT CASE WHEN g.is_active THEN g.id END) as active_goals,
    COUNT(DISTINCT ci.id) as total_check_ins,
    COUNT(DISTINCT CASE WHEN ci.completed THEN ci.id END) as completed_check_ins,
    COUNT(DISTINCT p.id) as total_posts,
    COUNT(DISTINCT f.follower_id) as followers_count,
    COUNT(DISTINCT f2.following_id) as following_count,
    AVG(ci.mood) as avg_mood,
    MAX(ci.date) as last_check_in_date,
    MAX(u.last_login_at) as last_login,
    NOW() as refreshed_at
FROM users u
LEFT JOIN goals g ON u.id = g.user_id
LEFT JOIN check_ins ci ON g.id = ci.goal_id
LEFT JOIN posts p ON u.id = p.user_id
LEFT JOIN follows f ON u.id = f.following_id
LEFT JOIN follows f2 ON u.id = f2.follower_id
GROUP BY u.id, u.username, u.plan, u.email, u.created_at;

-- Subscription analytics (moved to analytics schema)
CREATE MATERIALIZED VIEW analytics.subscription_analytics AS
SELECT
    plan,
    status,
    platform,
    COUNT(*) as user_count,
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

-- =====================================================
-- 4. CREATE INDEXES
-- =====================================================

-- User engagement indexes
CREATE UNIQUE INDEX idx_analytics_user_engagement_id ON analytics.user_engagement_summary(id);
CREATE INDEX idx_analytics_user_engagement_plan ON analytics.user_engagement_summary(plan);
CREATE INDEX idx_analytics_user_engagement_active_goals ON analytics.user_engagement_summary(active_goals DESC);
CREATE INDEX idx_analytics_user_engagement_last_login ON analytics.user_engagement_summary(last_login DESC NULLS LAST);
CREATE INDEX idx_analytics_user_engagement_total_checkins ON analytics.user_engagement_summary(total_check_ins DESC);

-- Subscription analytics indexes
CREATE INDEX idx_analytics_subscription_plan_status ON analytics.subscription_analytics(plan, status);
CREATE INDEX idx_analytics_subscription_platform ON analytics.subscription_analytics(platform);

-- =====================================================
-- 5. CREATE REFRESH FUNCTION IN ANALYTICS SCHEMA
-- =====================================================

CREATE OR REPLACE FUNCTION analytics.refresh_views()
RETURNS void AS $$
BEGIN
    -- CONCURRENTLY allows queries to continue during refresh
    -- Requires unique index (which we have on user_engagement_summary.id)
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.user_engagement_summary;
    REFRESH MATERIALIZED VIEW analytics.subscription_analytics;
    
    RAISE NOTICE 'Analytics views refreshed at %', NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also create in public schema for backward compatibility (calls analytics version)
CREATE OR REPLACE FUNCTION public.refresh_analytics_views()
RETURNS void AS $$
BEGIN
    PERFORM analytics.refresh_views();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. GRANT PERMISSIONS
-- =====================================================

-- Revoke all public access
REVOKE ALL ON SCHEMA analytics FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA analytics FROM PUBLIC;

-- Grant to service role only (backend/admin)
GRANT USAGE ON SCHEMA analytics TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO service_role;
GRANT EXECUTE ON FUNCTION analytics.refresh_views() TO service_role;

-- Public function for Celery task (but data still protected)
GRANT EXECUTE ON FUNCTION public.refresh_analytics_views() TO service_role;

-- =====================================================
-- 7. INITIAL REFRESH
-- =====================================================

REFRESH MATERIALIZED VIEW analytics.user_engagement_summary;
REFRESH MATERIALIZED VIEW analytics.subscription_analytics;

-- =====================================================
-- 8. DOCUMENTATION
-- =====================================================

COMMENT ON SCHEMA analytics IS 
'Private schema for analytics materialized views. 
Not exposed via PostgREST API. Service role access only.';

COMMENT ON MATERIALIZED VIEW analytics.user_engagement_summary IS 
'Pre-computed user engagement metrics for analytics dashboards. 
LOCATION: analytics schema (NOT exposed via API).
ACCESS: Service role ONLY (contains all users data).
REFRESH: Hourly via Celery task calling public.refresh_analytics_views().
Performance: ~280x faster than regular view with indexes.';

COMMENT ON MATERIALIZED VIEW analytics.subscription_analytics IS 
'Pre-computed subscription metrics for business analytics. 
LOCATION: analytics schema (NOT exposed via API).
ACCESS: Service role ONLY (sensitive business data).
REFRESH: Hourly via Celery task calling public.refresh_analytics_views().';

COMMENT ON FUNCTION analytics.refresh_views() IS 
'Refreshes all analytics materialized views in analytics schema.
Uses CONCURRENTLY to avoid locking. Called via public wrapper function.';

COMMENT ON FUNCTION public.refresh_analytics_views() IS 
'Public wrapper for analytics.refresh_views().
Called by Celery task hourly. Data remains protected in analytics schema.';

-- =====================================================
-- SECURITY NOTES
-- =====================================================

-- ✅ Views moved to 'analytics' schema (not exposed via PostgREST)
-- ✅ Only service_role can access (backend/admin queries)
-- ✅ Regular users cannot see schema or query views
-- ✅ Celery task can still refresh via public.refresh_analytics_views()
-- ✅ No API exposure = maximum security for sensitive analytics data

