-- =====================================================
-- FIX HABIT CHAIN TRIGGER: Update to use check_in_date
-- =====================================================
-- The check_ins table was updated to use check_in_date instead of date
-- This migration updates the trigger function to use the new column name

-- Drop and recreate the function with updated column references
CREATE OR REPLACE FUNCTION update_habit_chain_from_checkin()
RETURNS TRIGGER AS $$
DECLARE
    checkin_date DATE;
    checkin_user_id UUID;
    checkin_goal_id UUID;
    checkin_completed BOOLEAN;
BEGIN
    -- Handle DELETE operation
    IF TG_OP = 'DELETE' THEN
        DELETE FROM habit_chains
        WHERE user_id = OLD.user_id
            AND goal_id = OLD.goal_id
            AND chain_date = OLD.check_in_date;
        
        RETURN OLD;
    END IF;
    
    -- Handle INSERT/UPDATE operations
    checkin_date := NEW.check_in_date;
    checkin_user_id := NEW.user_id;
    checkin_goal_id := NEW.goal_id;
    checkin_completed := NEW.completed;
    
    -- Insert or update habit chain entry
    INSERT INTO habit_chains (
        user_id,
        goal_id,
        chain_date,
        is_completed,
        chain_length
    )
    SELECT
        checkin_user_id,
        checkin_goal_id,
        checkin_date,
        checkin_completed,
        -- Calculate current streak length
        (
            SELECT COUNT(*) + 1
            FROM check_ins ci
            WHERE ci.goal_id = checkin_goal_id
                AND ci.user_id = checkin_user_id
                AND ci.completed = true
                AND ci.check_in_date <= checkin_date
                AND ci.check_in_date >= checkin_date - INTERVAL '30 days' -- Look back 30 days for streak
                AND NOT EXISTS (
                    SELECT 1 
                    FROM check_ins ci2 
                    WHERE ci2.goal_id = checkin_goal_id
                        AND ci2.user_id = checkin_user_id
                        AND ci2.check_in_date BETWEEN ci.check_in_date + 1 AND checkin_date - 1
                        AND ci2.completed = false
                )
        )
    ON CONFLICT (user_id, goal_id, chain_date)
    DO UPDATE SET
        is_completed = checkin_completed,
        chain_length = EXCLUDED.chain_length;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

