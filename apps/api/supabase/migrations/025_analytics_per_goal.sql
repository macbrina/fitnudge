-- =============================================================================
-- MIGRATION: Per-Goal Analytics Dashboard
-- =============================================================================
-- Purpose: Refactor analytics to be per-goal instead of aggregated across all goals.
-- 
-- Changes:
-- 1. RPC now requires p_goal_id (no more aggregated view)
-- 2. Added heatmap_data for calendar visualization
-- 3. Added this_week_summary for weekly status view
-- 4. Added mood_trend for mood over time chart
-- 5. Removed goal_comparison (not needed for single goal)
-- 6. All data filtered by specific goal
--
-- Following SCALABILITY.md patterns for 100K+ users.
-- =============================================================================

-- =============================================================================
-- CREATE INDEX FOR PER-GOAL QUERIES
-- =============================================================================

-- Index for efficient goal-specific analytics
CREATE INDEX IF NOT EXISTS idx_checkins_goal_date_status 
ON check_ins (goal_id, check_in_date DESC, status);

-- Index for mood trend queries
CREATE INDEX IF NOT EXISTS idx_checkins_goal_mood 
ON check_ins (goal_id, check_in_date DESC) 
WHERE mood IS NOT NULL;

-- =============================================================================
-- DROP OLD FUNCTION AND CREATE NEW PER-GOAL VERSION
-- =============================================================================

DROP FUNCTION IF EXISTS get_analytics_dashboard(UUID, INT);

CREATE OR REPLACE FUNCTION get_analytics_dashboard(
    p_user_id UUID,
    p_goal_id UUID,  -- Now required
    p_days INT DEFAULT 30  -- Default to 30 days
)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
STABLE
PARALLEL SAFE
AS $$
WITH
-- ==========================================================================
-- DATE RANGES (respects goal creation date)
-- ==========================================================================
date_range AS (
    SELECT 
        -- Start from the LATER of: (goal creation date) OR (today - p_days)
        -- This ensures we don't fetch data from before the goal existed
        GREATEST(
            (SELECT created_at::DATE FROM goals WHERE id = p_goal_id),
            CURRENT_DATE - p_days
        ) as start_date,
        CURRENT_DATE as end_date
),

-- ==========================================================================
-- GOAL VALIDATION & INFO
-- ==========================================================================
goal_info AS (
    SELECT 
        id,
        title,
        current_streak,
        longest_streak,
        frequency_type,
        frequency_count,
        target_days,  -- Include target_days for schedule checking (NULL = daily, array = weekly)
        created_at
    FROM goals
    WHERE id = p_goal_id
      AND user_id = p_user_id
      AND status = 'active'
),

-- ==========================================================================
-- BASE CHECK-INS FOR THIS GOAL (within date range)
-- ==========================================================================
goal_checkins AS (
    SELECT 
        ci.id,
        ci.check_in_date,
        ci.status,
        ci.mood,
        ci.skip_reason,
        ci.note,
        EXTRACT(DOW FROM ci.check_in_date)::INT as day_of_week
    FROM check_ins ci
    WHERE ci.goal_id = p_goal_id
      AND ci.user_id = p_user_id
      AND ci.check_in_date >= (SELECT start_date FROM date_range)
      AND ci.check_in_date <= (SELECT end_date FROM date_range)
      AND ci.status != 'pending'  -- Exclude pending from analytics
),

-- ==========================================================================
-- SUMMARY STATS (for this goal)
-- ==========================================================================
summary AS (
    SELECT 
        COUNT(*)::INT as total_check_ins,
        COUNT(*) FILTER (WHERE status IN ('completed', 'rest_day'))::INT as completed_check_ins,
        CASE 
            WHEN COUNT(*) > 0 
            THEN ROUND((COUNT(*) FILTER (WHERE status IN ('completed', 'rest_day'))::NUMERIC / COUNT(*)) * 100, 1)
            ELSE 0 
        END as completion_rate
    FROM goal_checkins
),

-- ==========================================================================
-- HEATMAP DATA (for calendar visualization)
-- Generate ALL dates in range, marking each with proper status
-- ==========================================================================
heatmap_all_dates AS (
    SELECT generate_series(
        (SELECT start_date FROM date_range),
        (SELECT end_date FROM date_range),
        '1 day'::INTERVAL
    )::DATE as day_date
),

heatmap_with_checkins AS (
    SELECT 
        d.day_date,
        ci.status as checkin_status
    FROM heatmap_all_dates d
    LEFT JOIN check_ins ci 
        ON ci.check_in_date = d.day_date 
        AND ci.goal_id = p_goal_id 
        AND ci.user_id = p_user_id
),

heatmap_data AS (
    SELECT 
        h.day_date::TEXT as date,
        -- SIMPLIFIED: Pre-created check-ins are the source of truth
        -- If check-in exists: use its status
        -- If no check-in: it's not_scheduled (wasn't a scheduled day)
        COALESCE(h.checkin_status, 'not_scheduled') as status,
        CASE 
            WHEN h.checkin_status = 'completed' THEN 4
            WHEN h.checkin_status = 'rest_day' THEN 3
            WHEN h.checkin_status IN ('skipped', 'missed') THEN 0
            WHEN h.checkin_status = 'pending' THEN 2
            ELSE 1  -- not_scheduled
        END as intensity
    FROM heatmap_with_checkins h
    ORDER BY h.day_date
),

-- ==========================================================================
-- THIS WEEK SUMMARY (always last 7 days, not affected by days param)
-- ==========================================================================
this_week_days AS (
    SELECT generate_series(
        CURRENT_DATE - 6,
        CURRENT_DATE,
        '1 day'::INTERVAL
    )::DATE as day_date
),

this_week_checkins AS (
    SELECT 
        ci.check_in_date,
        ci.status
    FROM check_ins ci
    WHERE ci.goal_id = p_goal_id
      AND ci.user_id = p_user_id
      AND ci.check_in_date >= CURRENT_DATE - 6
      AND ci.check_in_date <= CURRENT_DATE
),

this_week_summary AS (
    SELECT 
        d.day_date::TEXT as date,
        TO_CHAR(d.day_date, 'Dy') as day_name,
        EXTRACT(DOW FROM d.day_date)::INT as day_of_week,
        CASE 
            -- Day before goal was created: no_data
            WHEN d.day_date < (SELECT created_at::DATE FROM goal_info) THEN 'no_data'
            -- Has check-in: use its status (pre-created check-ins are source of truth)
            WHEN c.status IS NOT NULL THEN c.status
            -- No check-in after goal creation: not_scheduled (wasn't a scheduled day)
            ELSE 'not_scheduled'
        END as status
    FROM this_week_days d
    LEFT JOIN this_week_checkins c ON c.check_in_date = d.day_date
    ORDER BY d.day_date
),

-- ==========================================================================
-- WEEKLY CONSISTENCY (day of week patterns, uses days param)
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
        COUNT(*)::INT as total,
        COUNT(*) FILTER (WHERE status IN ('completed', 'rest_day'))::INT as completed,
        CASE 
            WHEN COUNT(*) > 0 
            THEN ROUND((COUNT(*) FILTER (WHERE status IN ('completed', 'rest_day'))::NUMERIC / COUNT(*)) * 100)::INT
            ELSE 0 
        END as percentage,
        CASE day_of_week WHEN 0 THEN 7 ELSE day_of_week END as day_order
    FROM goal_checkins
    GROUP BY day_of_week
    ORDER BY day_order
),

-- ==========================================================================
-- STREAK HISTORY (from goal creation, W1 = goal's first week)
-- Shows up to 12 most recent weeks. If goal is newer, shows fewer weeks.
-- ==========================================================================
goal_creation_week AS (
    -- Find the Monday of the week when goal was created
    SELECT DATE_TRUNC('week', (SELECT created_at::DATE FROM goal_info))::DATE as start_week
),

all_goal_weeks AS (
    -- Generate all weeks from goal creation to current week
    SELECT 
        ROW_NUMBER() OVER (ORDER BY week_start) as week_num,
        week_start::DATE,
        (week_start + INTERVAL '6 days')::DATE as week_end
    FROM (
        SELECT generate_series(
            (SELECT start_week FROM goal_creation_week),
            DATE_TRUNC('week', CURRENT_DATE)::DATE,
            '1 week'::INTERVAL
        )::DATE as week_start
    ) weeks
),

-- Take only the last 12 weeks (or fewer if goal is newer)
weeks AS (
    SELECT * FROM all_goal_weeks
    ORDER BY week_num DESC
    LIMIT 12
),

week_checkins AS (
    SELECT 
        ci.check_in_date,
        ci.status
    FROM check_ins ci
    WHERE ci.goal_id = p_goal_id
      AND ci.user_id = p_user_id
      AND ci.check_in_date >= (SELECT created_at::DATE FROM goal_info)
      AND ci.status IN ('completed', 'rest_day')
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
                        FROM week_checkins
                        WHERE check_in_date >= w.week_start
                          AND check_in_date <= w.week_end
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
-- MOOD TREND (uses days param)
-- ==========================================================================
mood_trend AS (
    SELECT 
        check_in_date::TEXT as date,
        mood,
        CASE mood
            WHEN 'amazing' THEN 3
            WHEN 'good' THEN 2
            WHEN 'tough' THEN 1
            ELSE NULL
        END as mood_score,
        TO_CHAR(check_in_date, 'Mon DD') as label
    FROM goal_checkins
    WHERE mood IS NOT NULL
    ORDER BY check_in_date
),

-- ==========================================================================
-- SKIP REASONS (uses days param)
-- ==========================================================================
skip_totals AS (
    SELECT 
        COUNT(*) FILTER (WHERE skip_reason = 'work') as work,
        COUNT(*) FILTER (WHERE skip_reason = 'tired') as tired,
        COUNT(*) FILTER (WHERE skip_reason = 'sick') as sick,
        COUNT(*) FILTER (WHERE skip_reason = 'schedule') as schedule,
        COUNT(*) FILTER (WHERE skip_reason = 'other' OR skip_reason IS NULL) as other,
        COUNT(*) as total_skipped
    FROM goal_checkins
    WHERE status = 'skipped'
),

skip_reasons AS (
    SELECT 
        reason,
        label,
        count,
        CASE 
            WHEN (SELECT total_skipped FROM skip_totals) > 0 
            THEN ROUND((count::NUMERIC / (SELECT total_skipped FROM skip_totals)) * 100)::INT
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
),

-- ==========================================================================
-- MONTHLY TREND (uses days param to determine range)
-- Shows up to 6 months within the date range
-- ==========================================================================
months AS (
    SELECT generate_series(
        GREATEST(
            DATE_TRUNC('month', (SELECT start_date FROM date_range)),
            DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months')
        ),
        DATE_TRUNC('month', CURRENT_DATE),
        '1 month'::INTERVAL
    )::DATE as month_date
),

monthly_trend AS (
    SELECT 
        TO_CHAR(m.month_date, 'Mon') as month,
        (EXTRACT(MONTH FROM m.month_date)::INT - 1) as month_index,
        EXTRACT(YEAR FROM m.month_date)::INT as year,
        COALESCE(COUNT(gc.id), 0)::INT as total,
        COALESCE(COUNT(gc.id) FILTER (WHERE gc.status IN ('completed', 'rest_day')), 0)::INT as completed,
        CASE 
            WHEN COUNT(gc.id) > 0 
            THEN ROUND((COUNT(gc.id) FILTER (WHERE gc.status IN ('completed', 'rest_day'))::NUMERIC / COUNT(gc.id)) * 100)::INT
            ELSE 0 
        END as percentage
    FROM months m
    LEFT JOIN goal_checkins gc ON DATE_TRUNC('month', gc.check_in_date) = m.month_date
    GROUP BY m.month_date
    ORDER BY m.month_date
)

-- ==========================================================================
-- FINAL RESULT
-- ==========================================================================
SELECT json_build_object(
    -- Goal info
    'goal_id', (SELECT id FROM goal_info),
    'goal_title', (SELECT title FROM goal_info),
    'goal_created_at', (SELECT created_at::DATE::TEXT FROM goal_info),
    -- Target days for frontend to determine scheduled vs not_scheduled
    -- NULL = daily (all days scheduled), array = specific days (0=Sun, 1=Mon, etc.)
    'target_days', (SELECT target_days FROM goal_info),
    
    -- Summary stats
    'total_check_ins', (SELECT total_check_ins FROM summary),
    'completed_check_ins', (SELECT completed_check_ins FROM summary),
    'completion_rate', (SELECT completion_rate FROM summary),
    'current_streak', COALESCE((SELECT current_streak FROM goal_info), 0),
    'longest_streak', COALESCE((SELECT longest_streak FROM goal_info), 0),
    
    -- New: Heatmap data (for calendar)
    'heatmap_data', COALESCE((SELECT json_agg(row_to_json(h)) FROM heatmap_data h), '[]'::json),
    
    -- New: This week summary (always 7 days)
    'this_week_summary', COALESCE((SELECT json_agg(row_to_json(tw)) FROM this_week_summary tw), '[]'::json),
    
    -- Chart data
    'weekly_consistency', COALESCE((SELECT json_agg(row_to_json(w)) FROM weekly_consistency w), '[]'::json),
    'streak_history', COALESCE((SELECT json_agg(row_to_json(s)) FROM streak_history s), '[]'::json),
    'monthly_trend', COALESCE((SELECT json_agg(row_to_json(m)) FROM monthly_trend m), '[]'::json),
    'skip_reasons', COALESCE((SELECT json_agg(row_to_json(r)) FROM skip_reasons r), '[]'::json),
    
    -- New: Mood trend
    'mood_trend', COALESCE((SELECT json_agg(row_to_json(mt)) FROM mood_trend mt), '[]'::json),
    
    -- Metadata
    'data_range_days', p_days,
    'generated_at', NOW()::TEXT,
    'cache_hint', 'per_goal'
);
$$;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION get_analytics_dashboard(UUID, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_dashboard(UUID, UUID, INT) TO service_role;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON FUNCTION get_analytics_dashboard IS 
'Returns per-goal analytics dashboard data.
V2: Now requires goal_id - analytics are per-goal, not aggregated.
Includes heatmap_data, this_week_summary, and mood_trend.
Uses status column for all check-in state logic.
Premium feature - caller should verify subscription access.
Cache key: analytics:dashboard:{user_id}:{goal_id}:{days}';
