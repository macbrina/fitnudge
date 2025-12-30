-- =====================================================
-- Recreate analytics.user_engagement_summary with new check_ins column structure
-- =====================================================
-- This view was dropped in the previous migration because it depended on
-- the mood (integer) and date columns which were changed. 
-- Now recreating with check_in_date and text-based mood.

-- Drop and recreate the materialized view with updated column references
DROP MATERIALIZED VIEW IF EXISTS analytics.user_engagement_summary CASCADE;

CREATE MATERIALIZED VIEW analytics.user_engagement_summary AS
SELECT
    u.id,
    u.username,
    u.plan,
    u.email,
    u.created_at as user_created_at,
    COUNT(DISTINCT g.id) as total_goals,
    COUNT(DISTINCT CASE WHEN g.status = 'active' THEN g.id END) as active_goals,
    COUNT(DISTINCT ci.id) as total_check_ins,
    COUNT(DISTINCT CASE WHEN ci.completed THEN ci.id END) as completed_check_ins,
    COUNT(DISTINCT p.id) as total_posts,
    COUNT(DISTINCT f.follower_id) as followers_count,
    COUNT(DISTINCT f2.following_id) as following_count,
    -- Mood is now text-based, calculate average by mapping to numbers
    AVG(CASE 
        WHEN ci.mood = 'terrible' THEN 1
        WHEN ci.mood = 'bad' THEN 2
        WHEN ci.mood = 'okay' THEN 3
        WHEN ci.mood = 'good' THEN 4
        WHEN ci.mood = 'great' THEN 5
        ELSE NULL
    END) as avg_mood,
    -- Use new column name check_in_date instead of date
    MAX(ci.check_in_date) as last_check_in_date,
    MAX(u.last_login_at) as last_login,
    NOW() as refreshed_at
FROM users u
LEFT JOIN goals g ON u.id = g.user_id
LEFT JOIN check_ins ci ON g.id = ci.goal_id
LEFT JOIN posts p ON u.id = p.user_id
LEFT JOIN follows f ON u.id = f.following_id
LEFT JOIN follows f2 ON u.id = f2.follower_id
GROUP BY u.id, u.username, u.plan, u.email, u.created_at;

-- Recreate indexes for the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_user_engagement_id ON analytics.user_engagement_summary(id);
CREATE INDEX IF NOT EXISTS idx_analytics_user_engagement_plan ON analytics.user_engagement_summary(plan);
CREATE INDEX IF NOT EXISTS idx_analytics_user_engagement_active_goals ON analytics.user_engagement_summary(active_goals DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_user_engagement_last_login ON analytics.user_engagement_summary(last_login DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_analytics_user_engagement_total_checkins ON analytics.user_engagement_summary(total_check_ins DESC);

-- Refresh the view with initial data
REFRESH MATERIALIZED VIEW analytics.user_engagement_summary;

-- Update comment
COMMENT ON MATERIALIZED VIEW analytics.user_engagement_summary IS 
'Pre-computed user engagement metrics for analytics dashboards. 
LOCATION: analytics schema (NOT exposed via API).
ACCESS: Service role ONLY (contains all users data).
REFRESH: Hourly via Celery task calling public.refresh_analytics_views().
Performance: ~280x faster than regular view with indexes.
NOTE: Uses check_in_date (was date) and text-based mood (was integer). Updated Dec 2025.';
