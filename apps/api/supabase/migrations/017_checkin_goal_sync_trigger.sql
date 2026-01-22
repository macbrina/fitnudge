-- =====================================================
-- TRIGGER: Sync goal statistics on check-in changes
-- =====================================================
-- This trigger automatically recalculates goal statistics
-- (current_streak, longest_streak, total_completions, etc.)
-- whenever check-ins are inserted, updated, or deleted.
--
-- This ensures data consistency for both API operations and 
-- direct database modifications.
-- =====================================================

-- Function to recalculate goal statistics
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
    streak_start DATE;
BEGIN
    -- Determine which goal_id to update
    IF TG_OP = 'DELETE' THEN
        target_goal_id := OLD.goal_id;
    ELSE
        target_goal_id := NEW.goal_id;
    END IF;

    -- Skip if no goal_id (shouldn't happen, but safety check)
    IF target_goal_id IS NULL THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    -- Calculate total completions
    SELECT COUNT(*) INTO v_total_completions
    FROM check_ins
    WHERE goal_id = target_goal_id AND completed = true;

    -- Get last completed date and last checkin date
    SELECT MAX(check_in_date) INTO v_last_completed_date
    FROM check_ins
    WHERE goal_id = target_goal_id AND completed = true;

    SELECT MAX(check_in_date) INTO v_last_checkin_date
    FROM check_ins
    WHERE goal_id = target_goal_id;

    -- Calculate week completions (current week, starting Sunday)
    v_week_start := date_trunc('week', CURRENT_DATE)::DATE;
    
    SELECT COUNT(*) INTO v_week_completions
    FROM check_ins
    WHERE goal_id = target_goal_id 
      AND completed = true
      AND check_in_date >= v_week_start;

    -- Calculate current streak (consecutive completed days from most recent)
    -- Rest days PRESERVE the streak (don't break it) but don't INCREMENT it
    v_current_streak := 0;
    v_streak_start_date := NULL;
    prev_date := NULL;

    FOR rec IN 
        SELECT check_in_date, completed, is_rest_day
        FROM check_ins
        WHERE goal_id = target_goal_id
        ORDER BY check_in_date DESC
    LOOP
        IF prev_date IS NULL THEN
            -- First (most recent) check-in
            IF rec.completed THEN
                v_current_streak := 1;
                v_streak_start_date := rec.check_in_date;
            ELSIF rec.is_rest_day THEN
                -- Rest day: don't increment, but don't break (continue checking)
                NULL;
            ELSE
                EXIT; -- Streak broken at start (missed day)
            END IF;
        ELSE
            -- Check if consecutive day
            IF rec.check_in_date = prev_date - INTERVAL '1 day' THEN
                IF rec.completed THEN
                    v_current_streak := v_current_streak + 1;
                    v_streak_start_date := rec.check_in_date;
                ELSIF rec.is_rest_day THEN
                    -- Rest day: preserve streak, continue checking
                    NULL;
                ELSE
                    EXIT; -- Streak broken (missed day)
                END IF;
            ELSE
                EXIT; -- Gap in dates, streak broken
            END IF;
        END IF;
        prev_date := rec.check_in_date;
    END LOOP;

    -- Calculate longest streak (scan all check-ins chronologically)
    -- Rest days PRESERVE the streak (don't break it) but don't INCREMENT it
    v_longest_streak := 0;
    temp_streak := 0;
    prev_date := NULL;

    FOR rec IN 
        SELECT check_in_date, completed, is_rest_day
        FROM check_ins
        WHERE goal_id = target_goal_id
        ORDER BY check_in_date ASC
    LOOP
        IF rec.completed THEN
            IF prev_date IS NULL OR rec.check_in_date = prev_date + INTERVAL '1 day' THEN
                temp_streak := temp_streak + 1;
            ELSE
                -- Gap detected, save and reset
                IF temp_streak > v_longest_streak THEN
                    v_longest_streak := temp_streak;
                END IF;
                temp_streak := 1;
            END IF;
        ELSIF rec.is_rest_day THEN
            -- Rest day: preserve streak (don't increment, don't break)
            -- Just update prev_date to maintain consecutive day check
            NULL;
        ELSE
            -- Not completed (missed), end streak
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

    -- Ensure current_streak is considered for longest
    IF v_current_streak > v_longest_streak THEN
        v_longest_streak := v_current_streak;
    END IF;

    -- Update the goal with calculated values
    UPDATE goals
    SET 
        current_streak = v_current_streak,
        longest_streak = v_longest_streak,
        total_completions = v_total_completions,
        last_completed_date = v_last_completed_date,
        last_checkin_date = v_last_checkin_date,
        streak_start_date = v_streak_start_date,
        week_completions = v_week_completions,
        week_start_date = v_week_start,
        updated_at = NOW()
    WHERE id = target_goal_id;

    -- Return appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT
DROP TRIGGER IF EXISTS trigger_checkin_insert_goal_sync ON check_ins;
CREATE TRIGGER trigger_checkin_insert_goal_sync
    AFTER INSERT ON check_ins
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_goal_stats();

-- Create trigger for UPDATE
DROP TRIGGER IF EXISTS trigger_checkin_update_goal_sync ON check_ins;
CREATE TRIGGER trigger_checkin_update_goal_sync
    AFTER UPDATE ON check_ins
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_goal_stats();

-- Create trigger for DELETE
DROP TRIGGER IF EXISTS trigger_checkin_delete_goal_sync ON check_ins;
CREATE TRIGGER trigger_checkin_delete_goal_sync
    AFTER DELETE ON check_ins
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_goal_stats();

-- Add comment for documentation
COMMENT ON FUNCTION recalculate_goal_stats() IS 
'Automatically recalculates goal statistics (streaks, completions, etc.) whenever check-ins are modified. 
This ensures data consistency for both API operations and direct database modifications.';
