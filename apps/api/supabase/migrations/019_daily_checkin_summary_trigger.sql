-- =====================================================
-- TRIGGER: Populate daily_checkin_summaries on check-in changes
-- =====================================================
-- This trigger automatically maintains the daily_checkin_summaries table
-- when check-ins are inserted, updated, or deleted.
--
-- The summaries provide pre-aggregated data for faster analytics queries,
-- especially for weekly recaps and trend analysis.
--
-- IMPORTANT: This trigger runs AFTER trigger_checkin_*_goal_sync (017)
-- because PostgreSQL runs AFTER triggers alphabetically by name.
-- This ensures goal.current_streak is already updated when we read it.
-- =====================================================

-- Function to recalculate a daily summary for a specific user/goal/date
CREATE OR REPLACE FUNCTION recalculate_daily_checkin_summary(
    p_user_id UUID,
    p_goal_id UUID,
    p_date DATE
) RETURNS VOID AS $$
DECLARE
    v_total INTEGER;
    v_completed INTEGER;
    v_rest_day INTEGER;
    v_skipped INTEGER;
    v_streak INTEGER;
BEGIN
    -- Skip if goal_id is null (shouldn't happen, but safety check)
    IF p_goal_id IS NULL THEN
        RETURN;
    END IF;

    -- Count check-ins for this user/goal/date
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE completed = true AND is_rest_day = false),
        COUNT(*) FILTER (WHERE is_rest_day = true),
        COUNT(*) FILTER (WHERE completed = false AND is_rest_day = false)
    INTO v_total, v_completed, v_rest_day, v_skipped
    FROM check_ins
    WHERE user_id = p_user_id 
      AND goal_id = p_goal_id 
      AND check_in_date = p_date;

    -- Get current streak from goal (already updated by trigger_checkin_*_goal_sync)
    SELECT COALESCE(current_streak, 0) INTO v_streak
    FROM goals 
    WHERE id = p_goal_id;

    IF v_total > 0 THEN
        -- UPSERT: Insert or update the summary
        INSERT INTO daily_checkin_summaries (
            user_id, goal_id, summary_date,
            total_check_ins, completed_count, rest_day_count, skipped_count, streak_at_date,
            created_at, updated_at
        ) VALUES (
            p_user_id, p_goal_id, p_date,
            v_total, v_completed, v_rest_day, v_skipped, v_streak,
            NOW(), NOW()
        )
        ON CONFLICT (user_id, goal_id, summary_date) DO UPDATE SET
            total_check_ins = v_total,
            completed_count = v_completed,
            rest_day_count = v_rest_day,
            skipped_count = v_skipped,
            streak_at_date = v_streak,
            updated_at = NOW();
    ELSE
        -- No check-ins for this date anymore, remove summary if exists
        DELETE FROM daily_checkin_summaries
        WHERE user_id = p_user_id 
          AND goal_id = p_goal_id 
          AND summary_date = p_date;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to sync daily summaries on check-in changes
CREATE OR REPLACE FUNCTION sync_daily_checkin_summary()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        -- Recalculate summary for the deleted check-in's date
        PERFORM recalculate_daily_checkin_summary(OLD.user_id, OLD.goal_id, OLD.check_in_date);
        RETURN OLD;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- If date or goal changed, recalculate BOTH old and new combinations
        IF OLD.check_in_date != NEW.check_in_date OR OLD.goal_id IS DISTINCT FROM NEW.goal_id THEN
            -- Recalculate old date/goal (may now have fewer check-ins)
            PERFORM recalculate_daily_checkin_summary(OLD.user_id, OLD.goal_id, OLD.check_in_date);
        END IF;
        -- Always recalculate new date/goal
        PERFORM recalculate_daily_checkin_summary(NEW.user_id, NEW.goal_id, NEW.check_in_date);
        RETURN NEW;
        
    ELSE -- INSERT
        -- Recalculate summary for the new check-in's date
        PERFORM recalculate_daily_checkin_summary(NEW.user_id, NEW.goal_id, NEW.check_in_date);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create triggers (named to run AFTER goal_sync triggers alphabetically)
-- 'summary' comes after 'goal_sync' and 'partner_notify' alphabetically

DROP TRIGGER IF EXISTS trigger_checkin_summary_sync_insert ON check_ins;
CREATE TRIGGER trigger_checkin_summary_sync_insert
    AFTER INSERT ON check_ins
    FOR EACH ROW
    EXECUTE FUNCTION sync_daily_checkin_summary();

DROP TRIGGER IF EXISTS trigger_checkin_summary_sync_update ON check_ins;
CREATE TRIGGER trigger_checkin_summary_sync_update
    AFTER UPDATE ON check_ins
    FOR EACH ROW
    EXECUTE FUNCTION sync_daily_checkin_summary();

DROP TRIGGER IF EXISTS trigger_checkin_summary_sync_delete ON check_ins;
CREATE TRIGGER trigger_checkin_summary_sync_delete
    AFTER DELETE ON check_ins
    FOR EACH ROW
    EXECUTE FUNCTION sync_daily_checkin_summary();

-- Add comments for documentation
COMMENT ON FUNCTION recalculate_daily_checkin_summary(UUID, UUID, DATE) IS 
'Recalculates the daily_checkin_summaries record for a specific user/goal/date combination.
Called by the sync_daily_checkin_summary trigger function.';

COMMENT ON FUNCTION sync_daily_checkin_summary() IS 
'Trigger function that maintains daily_checkin_summaries when check-ins change.
Handles INSERT, UPDATE, and DELETE operations, including date/goal changes.';

-- =====================================================
-- BACKFILL: Populate summaries for existing check-ins
-- =====================================================
-- This populates the summaries table with data from existing check-ins.
-- Note: streak_at_date will use current goal streak (not historical).

INSERT INTO daily_checkin_summaries (
    user_id, goal_id, summary_date,
    total_check_ins, completed_count, rest_day_count, skipped_count, streak_at_date,
    created_at, updated_at
)
SELECT 
    c.user_id,
    c.goal_id,
    c.check_in_date,
    COUNT(*) as total_check_ins,
    COUNT(*) FILTER (WHERE c.completed = true AND c.is_rest_day = false) as completed_count,
    COUNT(*) FILTER (WHERE c.is_rest_day = true) as rest_day_count,
    COUNT(*) FILTER (WHERE c.completed = false AND c.is_rest_day = false) as skipped_count,
    COALESCE(g.current_streak, 0) as streak_at_date,
    NOW(),
    NOW()
FROM check_ins c
LEFT JOIN goals g ON g.id = c.goal_id
WHERE c.goal_id IS NOT NULL
GROUP BY c.user_id, c.goal_id, c.check_in_date, g.current_streak
ON CONFLICT (user_id, goal_id, summary_date) DO UPDATE SET
    total_check_ins = EXCLUDED.total_check_ins,
    completed_count = EXCLUDED.completed_count,
    rest_day_count = EXCLUDED.rest_day_count,
    skipped_count = EXCLUDED.skipped_count,
    streak_at_date = EXCLUDED.streak_at_date,
    updated_at = NOW();
