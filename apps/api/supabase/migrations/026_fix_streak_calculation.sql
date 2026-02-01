-- =====================================================
-- Migration 026: Fix Streak Calculation with Pending Check-ins
-- =====================================================
-- 
-- Problem: The streak calculation excludes pending check-ins from the query,
-- which creates date gaps. When calculating consecutive days, these gaps
-- incorrectly break the streak.
--
-- Example:
--   Jan 18: completed
--   Jan 19: pending (pre-created, not responded)
--   Jan 20: rest_day (today)
--
-- Old behavior: Query sees Jan 20 and Jan 18, detects gap, breaks streak = 0
-- New behavior: Query includes Jan 19 pending, skips over it, streak preserved
--
-- Fix: Include pending in the query but treat it like rest_day (pass through)
-- =====================================================

CREATE OR REPLACE FUNCTION recalculate_goal_stats()
RETURNS TRIGGER AS $$
DECLARE
    target_goal_id UUID;
    v_total_completions INTEGER;
    v_current_streak INTEGER;
    v_longest_streak INTEGER;
    v_last_completed_date DATE;
    v_last_checkin_date DATE;
    v_streak_start_date DATE;
    v_week_completions INTEGER;
    v_week_start DATE;
    rec RECORD;
    prev_date DATE;
    temp_streak INTEGER;
BEGIN
    -- Determine which goal_id to update
    IF TG_OP = 'DELETE' THEN
        target_goal_id := OLD.goal_id;
    ELSE
        target_goal_id := NEW.goal_id;
    END IF;

    -- Skip if no goal_id
    IF target_goal_id IS NULL THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    -- Skip recalculation for pending check-ins (they don't affect streaks)
    IF TG_OP != 'DELETE' AND NEW.status = 'pending' THEN
        RETURN NEW;
    END IF;

    -- Calculate total completions (status = 'completed')
    SELECT COUNT(*) INTO v_total_completions
    FROM check_ins
    WHERE goal_id = target_goal_id AND status = 'completed';

    -- Get last completed date and last checkin date (excluding pending)
    SELECT MAX(check_in_date) INTO v_last_completed_date
    FROM check_ins
    WHERE goal_id = target_goal_id AND status = 'completed';

    SELECT MAX(check_in_date) INTO v_last_checkin_date
    FROM check_ins
    WHERE goal_id = target_goal_id AND status != 'pending';

    -- Calculate week completions (current week, starting Sunday)
    v_week_start := date_trunc('week', CURRENT_DATE)::DATE;
    
    SELECT COUNT(*) INTO v_week_completions
    FROM check_ins
    WHERE goal_id = target_goal_id 
      AND status = 'completed'
      AND check_in_date >= v_week_start;

    -- =====================================================
    -- Calculate current streak (consecutive days from most recent)
    -- 
    -- Status handling:
    --   completed: INCREMENT streak
    --   rest_day:  PRESERVE streak (pass through, don't increment)
    --   pending:   PRESERVE streak (pass through, don't increment)
    --   missed:    BREAK streak
    --   skipped:   BREAK streak
    -- =====================================================
    v_current_streak := 0;
    v_streak_start_date := NULL;
    prev_date := NULL;

    -- INCLUDE all check-ins (including pending) to avoid date gaps
    FOR rec IN 
        SELECT check_in_date, status
        FROM check_ins
        WHERE goal_id = target_goal_id
        ORDER BY check_in_date DESC
    LOOP
        IF prev_date IS NULL THEN
            -- First (most recent) check-in
            IF rec.status = 'completed' THEN
                v_current_streak := 1;
                v_streak_start_date := rec.check_in_date;
            ELSIF rec.status IN ('rest_day', 'pending') THEN
                -- Rest day or pending: don't increment, but don't break (continue checking)
                NULL;
            ELSE
                EXIT; -- Streak broken at start (missed/skipped day)
            END IF;
        ELSE
            -- Check if consecutive day
            IF rec.check_in_date = prev_date - INTERVAL '1 day' THEN
                IF rec.status = 'completed' THEN
                    v_current_streak := v_current_streak + 1;
                    v_streak_start_date := rec.check_in_date;
                ELSIF rec.status IN ('rest_day', 'pending') THEN
                    -- Rest day or pending: preserve streak, continue checking
                    NULL;
                ELSE
                    EXIT; -- Streak broken (missed/skipped day)
                END IF;
            ELSE
                EXIT; -- Gap in dates, streak broken
            END IF;
        END IF;
        prev_date := rec.check_in_date;
    END LOOP;

    -- =====================================================
    -- Calculate longest streak (same logic, but ascending order)
    -- =====================================================
    v_longest_streak := 0;
    temp_streak := 0;
    prev_date := NULL;

    FOR rec IN 
        SELECT check_in_date, status
        FROM check_ins
        WHERE goal_id = target_goal_id
        ORDER BY check_in_date ASC
    LOOP
        IF rec.status = 'completed' THEN
            IF prev_date IS NULL OR rec.check_in_date = prev_date + INTERVAL '1 day' THEN
                temp_streak := temp_streak + 1;
            ELSE
                IF temp_streak > v_longest_streak THEN
                    v_longest_streak := temp_streak;
                END IF;
                temp_streak := 1;
            END IF;
        ELSIF rec.status IN ('rest_day', 'pending') THEN
            -- Rest day or pending: preserve streak (don't increment, don't break)
            -- But still update prev_date to maintain consecutive day check
            NULL;
        ELSE
            -- missed/skipped: end streak
            IF temp_streak > v_longest_streak THEN
                v_longest_streak := temp_streak;
            END IF;
            temp_streak := 0;
        END IF;
        prev_date := rec.check_in_date;
    END LOOP;

    -- Final check for longest streak
    IF temp_streak > v_longest_streak THEN
        v_longest_streak := temp_streak;
    END IF;

    IF v_current_streak > v_longest_streak THEN
        v_longest_streak := v_current_streak;
    END IF;

    -- Update goal stats (include week_start_date for consistency)
    UPDATE goals
    SET 
        total_completions = v_total_completions,
        current_streak = v_current_streak,
        longest_streak = v_longest_streak,
        last_completed_date = v_last_completed_date,
        last_checkin_date = v_last_checkin_date,
        streak_start_date = v_streak_start_date,
        week_completions = v_week_completions,
        week_start_date = v_week_start,
        updated_at = NOW()
    WHERE id = target_goal_id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculate_goal_stats() IS 
  'Recalculates goal stats (streak, completions) on check-in changes. Handles pending check-ins by treating them as pass-through (like rest_day) to avoid date gaps breaking streaks.';

-- Ensure trigger exists (022 drops it; 023 recreates it; we recreate here so 026 alone fixes streak)
DROP TRIGGER IF EXISTS trg_checkin_sync_goal_stats ON check_ins;
CREATE TRIGGER trg_checkin_sync_goal_stats
    AFTER INSERT OR UPDATE OR DELETE ON check_ins
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_goal_stats();
