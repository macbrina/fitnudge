-- =============================================================================
-- MIGRATION: Catch-up "missed" for past days, "pending" for today;
--            Weekly consistency schedule-aware (like heatmap/this_week)
-- =============================================================================
-- 1. Catch-up: When backfilling, use status='missed' for past dates and
--    status='pending' for today so we don't create pending for past days and
--    wait for the hourly task to mark them missed.
-- 2. Weekly consistency: Use schedule-aware logic (frequency_type + target_days)
--    so scheduled days without a check-in count as "missed" and appear in the
--    per-day breakdown (e.g. Thursday no longer missing when it was scheduled).
-- =============================================================================

-- =============================================================================
-- 1. get_analytics_dashboard: Make weekly_consistency schedule-aware
-- =============================================================================

CREATE OR REPLACE FUNCTION get_analytics_dashboard(
    p_user_id UUID,
    p_goal_id UUID,
    p_days INT DEFAULT 30
)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
STABLE
PARALLEL SAFE
AS $$
WITH
date_range AS (
    SELECT 
        GREATEST(
            (SELECT created_at::DATE FROM goals WHERE id = p_goal_id),
            CURRENT_DATE - p_days
        ) as start_date,
        CURRENT_DATE as end_date
),

goal_info AS (
    SELECT 
        id,
        title,
        current_streak,
        longest_streak,
        frequency_type,
        frequency_count,
        target_days,
        created_at
    FROM goals
    WHERE id = p_goal_id
      AND user_id = p_user_id
      AND status = 'active'
),

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
      AND ci.status != 'pending'
),

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
        ci.status as checkin_status,
        EXTRACT(DOW FROM d.day_date)::INT as day_of_week,
        (SELECT frequency_type FROM goal_info) as frequency_type,
        (SELECT target_days FROM goal_info) as target_days,
        (SELECT created_at::DATE FROM goal_info) as goal_created_at
    FROM heatmap_all_dates d
    LEFT JOIN check_ins ci 
        ON ci.check_in_date = d.day_date 
        AND ci.goal_id = p_goal_id 
        AND ci.user_id = p_user_id
),

heatmap_data AS (
    SELECT 
        h.day_date::TEXT as date,
        CASE 
            WHEN h.day_date < h.goal_created_at THEN 'no_data'
            WHEN h.checkin_status IS NOT NULL THEN h.checkin_status
            ELSE 
                CASE 
                    WHEN h.frequency_type = 'daily' THEN 'missed'
                    WHEN h.frequency_type = 'weekly' THEN
                        CASE 
                            WHEN h.target_days IS NULL OR h.target_days = '{}'::INTEGER[] THEN 'missed'
                            WHEN h.day_of_week = ANY(h.target_days) THEN 'missed'
                            ELSE 'not_scheduled'
                        END
                    ELSE 'not_scheduled'
                END
        END as status,
        CASE 
            WHEN h.checkin_status = 'completed' THEN 4
            WHEN h.checkin_status = 'rest_day' THEN 3
            WHEN h.checkin_status IN ('skipped', 'missed') THEN 0
            WHEN h.checkin_status = 'pending' THEN 2
            WHEN h.checkin_status IS NULL AND (
                h.frequency_type = 'daily'
                OR (h.frequency_type = 'weekly' AND (
                    h.target_days IS NULL OR h.target_days = '{}'::INTEGER[] OR h.day_of_week = ANY(h.target_days)
                ))
            ) THEN 0
            ELSE 1
        END as intensity
    FROM heatmap_with_checkins h
    ORDER BY h.day_date
),

this_week_days AS (
    SELECT generate_series(
        CURRENT_DATE - 6,
        CURRENT_DATE,
        '1 day'::INTERVAL
    )::DATE as day_date
),

this_week_checkins AS (
    SELECT ci.check_in_date, ci.status
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
            WHEN d.day_date < (SELECT created_at::DATE FROM goal_info) THEN 'no_data'
            WHEN c.status IS NOT NULL THEN c.status
            ELSE 
                CASE 
                    WHEN (SELECT frequency_type FROM goal_info) = 'daily' THEN 'missed'
                    WHEN (SELECT frequency_type FROM goal_info) = 'weekly' THEN
                        CASE 
                            WHEN (SELECT target_days FROM goal_info) IS NULL 
                                 OR (SELECT target_days FROM goal_info) = '{}'::INTEGER[] THEN 'missed'
                            WHEN EXTRACT(DOW FROM d.day_date)::INT IN (
                                SELECT UNNEST((SELECT target_days FROM goal_info))
                            ) THEN 'missed'
                            ELSE 'not_scheduled'
                        END
                    ELSE 'not_scheduled'
                END
        END as status
    FROM this_week_days d
    LEFT JOIN this_week_checkins c ON c.check_in_date = d.day_date
    ORDER BY d.day_date
),

-- Schedule-aware: one row per scheduled day in range with effective status
-- (from check-in or 'missed'). Off-days excluded; only scheduled days count for rate.
schedule_aware_days AS (
    SELECT 
        h.day_date,
        h.day_of_week,
        CASE 
            WHEN h.checkin_status IS NOT NULL THEN h.checkin_status
            WHEN h.frequency_type = 'daily' THEN 'missed'
            WHEN h.frequency_type = 'weekly' AND (
                h.target_days IS NULL OR h.target_days = '{}'::INTEGER[] OR h.day_of_week = ANY(h.target_days)
            ) THEN 'missed'
            ELSE NULL
        END as status
    FROM heatmap_with_checkins h
    WHERE h.day_date >= h.goal_created_at
      AND (
        h.frequency_type = 'daily'
        OR (h.frequency_type = 'weekly' AND (
            h.target_days IS NULL OR h.target_days = '{}'::INTEGER[] OR h.day_of_week = ANY(h.target_days)
        ))
      )
),

-- Summary from scheduled days only: completion_rate = completed/rest_day over scheduled_days (off-days not in rate)
schedule_aware_summary AS (
    SELECT 
        COUNT(*)::INT as total_check_ins,
        COUNT(*) FILTER (WHERE status IN ('completed', 'rest_day'))::INT as completed_check_ins,
        CASE 
            WHEN COUNT(*) > 0 
            THEN ROUND((COUNT(*) FILTER (WHERE status IN ('completed', 'rest_day'))::NUMERIC / COUNT(*)) * 100, 1)
            ELSE 0 
        END as completion_rate
    FROM schedule_aware_days
),

weekly_consistency AS (
    SELECT 
        CASE day_of_week
            WHEN 0 THEN 'Sun' WHEN 1 THEN 'Mon' WHEN 2 THEN 'Tue' WHEN 3 THEN 'Wed'
            WHEN 4 THEN 'Thu' WHEN 5 THEN 'Fri' WHEN 6 THEN 'Sat'
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
    FROM schedule_aware_days
    WHERE status IS NOT NULL
    GROUP BY day_of_week
    ORDER BY day_order
),

goal_creation_week AS (
    SELECT DATE_TRUNC('week', (SELECT created_at::DATE FROM goal_info))::DATE as start_week
),

all_goal_weeks AS (
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

weeks AS (
    SELECT * FROM all_goal_weeks
    ORDER BY week_num DESC
    LIMIT 12
),

week_checkins AS (
    SELECT ci.check_in_date, ci.status
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
            (SELECT MAX(streak_len) FROM (
                SELECT COUNT(*) as streak_len
                FROM (
                    SELECT check_in_date,
                        check_in_date - (ROW_NUMBER() OVER (ORDER BY check_in_date))::INT as grp
                    FROM week_checkins
                    WHERE check_in_date >= w.week_start AND check_in_date <= w.week_end
                ) t
                GROUP BY grp
            ) streaks),
            0
        )::INT as max_streak
    FROM weeks w
    ORDER BY w.week_num
),

mood_trend AS (
    SELECT 
        check_in_date::TEXT as date,
        mood,
        CASE mood WHEN 'amazing' THEN 3 WHEN 'good' THEN 2 WHEN 'tough' THEN 1 ELSE NULL END as mood_score,
        TO_CHAR(check_in_date, 'Mon DD') as label
    FROM goal_checkins
    WHERE mood IS NOT NULL
    ORDER BY check_in_date
),

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
    SELECT reason, label, count,
        CASE WHEN (SELECT total_skipped FROM skip_totals) > 0 
             THEN ROUND((count::NUMERIC / (SELECT total_skipped FROM skip_totals)) * 100)::INT
             ELSE 0 END as percentage,
        color
    FROM (
        SELECT 'work' as reason, 'Work' as label, (SELECT work FROM skip_totals)::INT as count, '#FF6B6B' as color
        UNION ALL SELECT 'tired', 'Tired', (SELECT tired FROM skip_totals)::INT, '#4ECDC4'
        UNION ALL SELECT 'sick', 'Sick', (SELECT sick FROM skip_totals)::INT, '#9B59B6'
        UNION ALL SELECT 'schedule', 'Schedule', (SELECT schedule FROM skip_totals)::INT, '#F39C12'
        UNION ALL SELECT 'other', 'Other', (SELECT other FROM skip_totals)::INT, '#95A5A6'
    ) reasons
    WHERE count > 0
    ORDER BY count DESC
),

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
        CASE WHEN COUNT(gc.id) > 0 
             THEN ROUND((COUNT(gc.id) FILTER (WHERE gc.status IN ('completed', 'rest_day'))::NUMERIC / COUNT(gc.id)) * 100)::INT
             ELSE 0 END as percentage
    FROM months m
    LEFT JOIN goal_checkins gc ON DATE_TRUNC('month', gc.check_in_date) = m.month_date
    GROUP BY m.month_date
    ORDER BY m.month_date
)

SELECT json_build_object(
    'goal_id', (SELECT id FROM goal_info),
    'goal_title', (SELECT title FROM goal_info),
    'goal_created_at', (SELECT created_at::DATE::TEXT FROM goal_info),
    'target_days', (SELECT target_days FROM goal_info),
    'frequency_type', (SELECT frequency_type FROM goal_info),
    'total_check_ins', (SELECT total_check_ins FROM schedule_aware_summary),
    'completed_check_ins', (SELECT completed_check_ins FROM schedule_aware_summary),
    'completion_rate', (SELECT completion_rate FROM schedule_aware_summary),
    'current_streak', COALESCE((SELECT current_streak FROM goal_info), 0),
    'longest_streak', COALESCE((SELECT longest_streak FROM goal_info), 0),
    'heatmap_data', COALESCE((SELECT json_agg(row_to_json(h)) FROM heatmap_data h), '[]'::json),
    'this_week_summary', COALESCE((SELECT json_agg(row_to_json(tw)) FROM this_week_summary tw), '[]'::json),
    'weekly_consistency', COALESCE((SELECT json_agg(row_to_json(w)) FROM weekly_consistency w), '[]'::json),
    'streak_history', COALESCE((SELECT json_agg(row_to_json(s)) FROM streak_history s), '[]'::json),
    'monthly_trend', COALESCE((SELECT json_agg(row_to_json(m)) FROM monthly_trend m), '[]'::json),
    'skip_reasons', COALESCE((SELECT json_agg(row_to_json(r)) FROM skip_reasons r), '[]'::json),
    'mood_trend', COALESCE((SELECT json_agg(row_to_json(mt)) FROM mood_trend mt), '[]'::json),
    'data_range_days', p_days,
    'generated_at', NOW()::TEXT,
    'cache_hint', 'per_goal'
);
$$;

-- =============================================================================
-- 2. catchup_missing_checkins: use 'missed' for past, 'pending' for today
-- =============================================================================

CREATE OR REPLACE FUNCTION catchup_missing_checkins(
    p_start_date DATE,
    p_end_date DATE DEFAULT CURRENT_DATE - 1
)
RETURNS TABLE(
    out_date DATE,
    inserted_count INTEGER,
    total_goals INTEGER
) AS $$
DECLARE
    loop_date DATE;
    inserted_for_date INTEGER;
    total_goals_for_date INTEGER;
    row_status TEXT;
BEGIN
    IF p_start_date > p_end_date THEN
        RAISE EXCEPTION 'start_date (%) must be <= end_date (%)', p_start_date, p_end_date;
    END IF;
    IF p_end_date >= CURRENT_DATE THEN
        RAISE EXCEPTION 'end_date (%) must be < CURRENT_DATE', p_end_date;
    END IF;

    loop_date := p_start_date;
    WHILE loop_date <= p_end_date LOOP
        row_status := CASE WHEN loop_date < CURRENT_DATE THEN 'missed' ELSE 'pending' END;

        SELECT COUNT(*) INTO total_goals_for_date
        FROM goals g
        WHERE g.status = 'active'
          AND (
            g.frequency_type = 'daily'
            OR (g.frequency_type = 'weekly' AND (
                g.target_days = '{}' OR g.target_days IS NULL
                OR EXTRACT(DOW FROM loop_date)::int = ANY(g.target_days)
            ))
          );

        INSERT INTO check_ins (user_id, goal_id, check_in_date, status)
        SELECT g.user_id, g.id, loop_date, row_status
        FROM goals g
        WHERE g.status = 'active'
          AND (
            g.frequency_type = 'daily'
            OR (g.frequency_type = 'weekly' AND (
                g.target_days = '{}' OR g.target_days IS NULL
                OR EXTRACT(DOW FROM loop_date)::int = ANY(g.target_days)
            ))
          )
          AND NOT EXISTS (
            SELECT 1 FROM check_ins ci
            WHERE ci.user_id = g.user_id AND ci.goal_id = g.id AND ci.check_in_date = loop_date
          );

        GET DIAGNOSTICS inserted_for_date = ROW_COUNT;
        out_date := loop_date;
        inserted_count := inserted_for_date;
        total_goals := total_goals_for_date;
        RETURN NEXT;

        loop_date := loop_date + INTERVAL '1 day';
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 3. catchup_missing_checkins_auto: use 'missed' for past, 'pending' for today
-- =============================================================================

CREATE OR REPLACE FUNCTION catchup_missing_checkins_auto(
    p_lookback_days INT DEFAULT 7
)
RETURNS TABLE(
    out_date DATE,
    inserted_count INTEGER,
    total_goals INTEGER
) AS $$
DECLARE
    loop_date DATE;
    start_date DATE;
    end_date DATE;
    inserted_for_date INTEGER;
    total_goals_for_date INTEGER;
    row_status TEXT;
BEGIN
    IF p_lookback_days < 1 OR p_lookback_days > 30 THEN
        RAISE EXCEPTION 'lookback_days must be between 1 and 30, got %', p_lookback_days;
    END IF;

    end_date := CURRENT_DATE - 1;
    start_date := CURRENT_DATE - p_lookback_days;
    loop_date := start_date;

    WHILE loop_date <= end_date LOOP
        row_status := CASE WHEN loop_date < CURRENT_DATE THEN 'missed' ELSE 'pending' END;

        SELECT COUNT(*) INTO total_goals_for_date
        FROM goals g
        WHERE g.status = 'active'
          AND (
            g.frequency_type = 'daily'
            OR (g.frequency_type = 'weekly' AND (
                g.target_days = '{}' OR g.target_days IS NULL
                OR EXTRACT(DOW FROM loop_date)::int = ANY(g.target_days)
            ))
          );

        INSERT INTO check_ins (user_id, goal_id, check_in_date, status)
        SELECT g.user_id, g.id, loop_date, row_status
        FROM goals g
        WHERE g.status = 'active'
          AND (
            g.frequency_type = 'daily'
            OR (g.frequency_type = 'weekly' AND (
                g.target_days = '{}' OR g.target_days IS NULL
                OR EXTRACT(DOW FROM loop_date)::int = ANY(g.target_days)
            ))
          )
          AND NOT EXISTS (
            SELECT 1 FROM check_ins ci
            WHERE ci.user_id = g.user_id AND ci.goal_id = g.id AND ci.check_in_date = loop_date
          );

        GET DIAGNOSTICS inserted_for_date = ROW_COUNT;

        IF inserted_for_date > 0 THEN
            out_date := loop_date;
            inserted_count := inserted_for_date;
            total_goals := total_goals_for_date;
            RETURN NEXT;
        END IF;

        loop_date := loop_date + INTERVAL '1 day';
    END LOOP;
END;
$$ LANGUAGE plpgsql;
