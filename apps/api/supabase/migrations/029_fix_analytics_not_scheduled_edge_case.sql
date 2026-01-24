-- =============================================================================
-- MIGRATION: Fix Analytics "Not Scheduled" Edge Case
-- =============================================================================
-- Problem: Analytics marks days as "not_scheduled" when no check-in exists,
-- even if the day SHOULD be scheduled according to goal's frequency_type/target_days.
-- This happens when:
-- 1. Celery task didn't run (maintenance, downtime)
-- 2. System was down and couldn't create check-ins
-- 3. User couldn't check in due to system issues (not their fault)
--
-- Solution: Check goal's schedule (frequency_type + target_days) to determine
-- if a day SHOULD be scheduled, rather than relying solely on check-in existence.
-- If day should be scheduled but no check-in exists, mark as 'missed' instead of 'not_scheduled'.
--
-- Following SCALABILITY.md patterns for 100K+ users.
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
-- ==========================================================================
-- DATE RANGES (respects goal creation date)
-- ==========================================================================
date_range AS (
    SELECT 
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
        target_days,
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
      AND ci.status != 'pending'
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
-- FIXED: Check goal schedule to determine if day SHOULD be scheduled
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
            -- Day before goal was created: no_data
            WHEN h.day_date < h.goal_created_at THEN 'no_data'
            -- Has check-in: use its status
            WHEN h.checkin_status IS NOT NULL THEN h.checkin_status
            -- No check-in: determine if day SHOULD be scheduled based on goal schedule
            ELSE 
                CASE 
                    -- Daily goal: all days should be scheduled
                    WHEN h.frequency_type = 'daily' THEN 'missed'
                    -- Weekly goal: check if day_of_week is in target_days
                    WHEN h.frequency_type = 'weekly' THEN
                        CASE 
                            -- If target_days is NULL or empty array, treat as daily (all days scheduled)
                            WHEN h.target_days IS NULL 
                                 OR h.target_days = '{}'::INTEGER[] THEN 'missed'
                            -- If day_of_week is in target_days, it should be scheduled
                            WHEN h.day_of_week = ANY(h.target_days) THEN 'missed'
                            -- Otherwise, truly not scheduled
                            ELSE 'not_scheduled'
                        END
                    -- Fallback: not_scheduled
                    ELSE 'not_scheduled'
                END
        END as status,
        CASE 
            WHEN h.checkin_status = 'completed' THEN 4
            WHEN h.checkin_status = 'rest_day' THEN 3
            WHEN h.checkin_status IN ('skipped', 'missed') THEN 0
            WHEN h.checkin_status = 'pending' THEN 2
            -- For days that should be scheduled but have no check-in (system missed)
            WHEN h.checkin_status IS NULL AND (
                h.frequency_type = 'daily'
                OR (
                    h.frequency_type = 'weekly'
                    AND (
                        h.target_days IS NULL
                        OR h.target_days = '{}'::INTEGER[]
                        OR h.day_of_week = ANY(h.target_days)
                    )
                )
            ) THEN 0  -- Show as missed (intensity 0)
            ELSE 1  -- not_scheduled
        END as intensity
    FROM heatmap_with_checkins h
    ORDER BY h.day_date
),

-- ==========================================================================
-- THIS WEEK SUMMARY (always last 7 days, not affected by days param)
-- FIXED: Check goal schedule to determine if day SHOULD be scheduled
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
            -- Has check-in: use its status
            WHEN c.status IS NOT NULL THEN c.status
            -- No check-in: determine if day SHOULD be scheduled based on goal schedule
            ELSE 
                CASE 
                    -- Daily goal: all days should be scheduled
                    WHEN (SELECT frequency_type FROM goal_info) = 'daily' THEN 'missed'
                    -- Weekly goal: check if day_of_week is in target_days
                    WHEN (SELECT frequency_type FROM goal_info) = 'weekly' THEN
                        CASE 
                            -- If target_days is NULL or empty array, treat as daily (all days scheduled)
                            WHEN (SELECT target_days FROM goal_info) IS NULL 
                                 OR (SELECT target_days FROM goal_info) = '{}'::INTEGER[] THEN 'missed'
                            -- If day_of_week is in target_days, it should be scheduled
                            -- Use IN with UNNEST to avoid ANY() subquery issues
                            WHEN EXTRACT(DOW FROM d.day_date)::INT IN (
                                SELECT UNNEST((SELECT target_days FROM goal_info))
                            ) THEN 'missed'
                            -- Otherwise, truly not scheduled
                            ELSE 'not_scheduled'
                        END
                    -- Fallback: not_scheduled
                    ELSE 'not_scheduled'
                END
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
-- ==========================================================================
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
    'goal_id', (SELECT id FROM goal_info),
    'goal_title', (SELECT title FROM goal_info),
    'goal_created_at', (SELECT created_at::DATE::TEXT FROM goal_info),
    'target_days', (SELECT target_days FROM goal_info),
    'frequency_type', (SELECT frequency_type FROM goal_info),
    
    'total_check_ins', (SELECT total_check_ins FROM summary),
    'completed_check_ins', (SELECT completed_check_ins FROM summary),
    'completion_rate', (SELECT completion_rate FROM summary),
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

COMMENT ON FUNCTION get_analytics_dashboard IS 
'Returns per-goal analytics dashboard data.
FIXED: Now checks goal schedule (frequency_type + target_days) to determine if days SHOULD be scheduled,
rather than relying solely on check-in existence. This handles edge cases where:
- Celery task didn''t run (maintenance/downtime)
- System was down and couldn''t create check-ins
- Days that should be scheduled but have no check-in are marked as "missed" instead of "not_scheduled"
';

-- ... existing code ...

-- =============================================================================
-- CATCH-UP FUNCTION: Backfill Missing Check-ins After Maintenance
-- =============================================================================
-- Use this function after maintenance/downtime to retroactively create
-- check-ins for days that should have been scheduled but weren't created.
-- 
-- Note: Check-ins created for past dates will be immediately marked as 'missed'
-- by the mark_missed_checkins_task since the days have already passed.
-- This is expected behavior - it accurately reflects that the check-in
-- opportunity was missed (even though it wasn't the user's fault).
--
-- Usage: Call catchup_missing_checkins(start_date, end_date) after maintenance
-- Example: SELECT catchup_missing_checkins('2026-01-20', '2026-01-22');
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
BEGIN
    -- Validate date range
    IF p_start_date > p_end_date THEN
        RAISE EXCEPTION 'start_date (%) must be <= end_date (%)', p_start_date, p_end_date;
    END IF;
    
    -- Don't allow future dates
    IF p_end_date >= CURRENT_DATE THEN
        RAISE EXCEPTION 'end_date (%) must be < CURRENT_DATE', p_end_date;
    END IF;
    
    -- Loop through each date in range
    loop_date := p_start_date;
    WHILE loop_date <= p_end_date LOOP
        -- Get count of active goals that should have check-ins for this date
        SELECT COUNT(*) INTO total_goals_for_date
        FROM goals g
        WHERE g.status = 'active'
          AND (
            g.frequency_type = 'daily'
            OR (
              g.frequency_type = 'weekly'
              AND (
                g.target_days = '{}'
                OR g.target_days IS NULL
                OR EXTRACT(DOW FROM loop_date)::int = ANY(g.target_days)
              )
            )
          );
        
        -- Call precreate_checkins_for_date for this date
        -- This will create check-ins with status='pending' for all active goals
        -- where this date is a scheduled day, skipping ones that already exist
        INSERT INTO check_ins (user_id, goal_id, check_in_date, status)
        SELECT 
            g.user_id,
            g.id,
            loop_date,
            'pending'
        FROM goals g
        WHERE g.status = 'active'
          AND (
            g.frequency_type = 'daily'
            OR (
              g.frequency_type = 'weekly'
              AND (
                g.target_days = '{}'
                OR g.target_days IS NULL
                OR EXTRACT(DOW FROM loop_date)::int = ANY(g.target_days)
              )
            )
          )
          -- Only create if check-in doesn't already exist
          AND NOT EXISTS (
            SELECT 1 FROM check_ins ci
            WHERE ci.user_id = g.user_id
              AND ci.goal_id = g.id
              AND ci.check_in_date = loop_date
          );
        
        GET DIAGNOSTICS inserted_for_date = ROW_COUNT;
        
        -- Return result for this date (assign to OUT params, then RETURN NEXT)
        out_date := loop_date;
        inserted_count := inserted_for_date;
        total_goals := total_goals_for_date;
        RETURN NEXT;
        
        -- Move to next date
        loop_date := loop_date + INTERVAL '1 day';
    END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION catchup_missing_checkins IS 
'Backfills missing check-ins for a date range after maintenance/downtime.
Creates check-ins with status=''pending'' for all active goals where each date
is a scheduled day. Check-ins for past dates will be immediately marked as
''missed'' by mark_missed_checkins_task, which is expected behavior.

Usage: SELECT * FROM catchup_missing_checkins(''2026-01-20'', ''2026-01-22'');
Returns: date, inserted_count, total_goals for each date processed.';

GRANT EXECUTE ON FUNCTION catchup_missing_checkins(DATE, DATE) TO service_role;

-- =============================================================================
-- AUTO CATCH-UP FUNCTION: Automatically Detect and Backfill Missing Check-ins
-- =============================================================================
-- Automatically detects missing check-ins for recent dates and backfills them.
-- Perfect for after maintenance when you don't know exact dates.
--
-- Scans all active goals and finds dates where check-ins should exist but don't.
-- Only creates check-ins for scheduled days (respects frequency_type + target_days).
--
-- Usage: SELECT * FROM catchup_missing_checkins_auto(7);  -- last 7 days
--        SELECT * FROM catchup_missing_checkins_auto();   -- defaults to 7 days
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
BEGIN
    -- Validate lookback days
    IF p_lookback_days < 1 OR p_lookback_days > 30 THEN
        RAISE EXCEPTION 'lookback_days must be between 1 and 30, got %', p_lookback_days;
    END IF;
    
    -- Calculate date range (from lookback_days ago to yesterday)
    end_date := CURRENT_DATE - 1;
    start_date := CURRENT_DATE - p_lookback_days;
    
    -- Loop through each date in range
    loop_date := start_date;
    WHILE loop_date <= end_date LOOP
        -- Count active goals that should have check-ins for this date
        SELECT COUNT(*) INTO total_goals_for_date
        FROM goals g
        WHERE g.status = 'active'
          AND (
            g.frequency_type = 'daily'
            OR (
              g.frequency_type = 'weekly'
              AND (
                g.target_days = '{}'
                OR g.target_days IS NULL
                OR EXTRACT(DOW FROM loop_date)::int = ANY(g.target_days)
              )
            )
          );
        
        -- Create missing check-ins for this date
        -- Only creates if check-in doesn't already exist (ON CONFLICT handled by NOT EXISTS)
        INSERT INTO check_ins (user_id, goal_id, check_in_date, status)
        SELECT 
            g.user_id,
            g.id,
            loop_date,
            'pending'
        FROM goals g
        WHERE g.status = 'active'
          AND (
            g.frequency_type = 'daily'
            OR (
              g.frequency_type = 'weekly'
              AND (
                g.target_days = '{}'
                OR g.target_days IS NULL
                OR EXTRACT(DOW FROM loop_date)::int = ANY(g.target_days)
              )
            )
          )
          -- Only create if check-in doesn't already exist
          AND NOT EXISTS (
            SELECT 1 FROM check_ins ci
            WHERE ci.user_id = g.user_id
              AND ci.goal_id = g.id
              AND ci.check_in_date = loop_date
          );
        
        GET DIAGNOSTICS inserted_for_date = ROW_COUNT;
        
        -- Return result for this date (only if check-ins were created)
        IF inserted_for_date > 0 THEN
            out_date := loop_date;
            inserted_count := inserted_for_date;
            total_goals := total_goals_for_date;
            RETURN NEXT;
        END IF;
        
        -- Move to next date
        loop_date := loop_date + INTERVAL '1 day';
    END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION catchup_missing_checkins_auto IS 
'Auto-detects and backfills missing check-ins for recent dates.
Scans all active goals and finds dates where check-ins should exist but don''t.
Perfect for after maintenance when exact dates are unknown.

Usage: SELECT * FROM catchup_missing_checkins_auto(7);  -- last 7 days
       SELECT * FROM catchup_missing_checkins_auto();   -- defaults to 7 days
Returns: Only dates where check-ins were created (out_date, inserted_count, total_goals).';

GRANT EXECUTE ON FUNCTION catchup_missing_checkins_auto(INT) TO service_role;