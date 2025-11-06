-- =====================================================
-- HABIT CHAINS: VISUAL CHAIN VISUALIZATION FOR STREAKS
-- =====================================================

-- Table for habit chain visualizations
-- Stores daily chain data for visualization purposes
CREATE TABLE habit_chains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    chain_date DATE NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    chain_length INTEGER DEFAULT 0, -- Current streak length on this date
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one chain entry per user per goal per date
    UNIQUE(user_id, goal_id, chain_date)
);

-- Indexes for performance
CREATE INDEX idx_habit_chains_user_id ON habit_chains(user_id);
CREATE INDEX idx_habit_chains_goal_id ON habit_chains(goal_id);
CREATE INDEX idx_habit_chains_date ON habit_chains(chain_date DESC);
CREATE INDEX idx_habit_chains_user_goal_date ON habit_chains(user_id, goal_id, chain_date DESC);
CREATE INDEX idx_habit_chains_completed ON habit_chains(is_completed) WHERE is_completed = true;

-- Function to update habit chains based on check-ins
-- This function will be called when check-ins are created/updated
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
            AND chain_date = OLD.date;
        
        RETURN OLD;
    END IF;
    
    -- Handle INSERT/UPDATE operations
    checkin_date := NEW.date;
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
                AND ci.date <= checkin_date
                AND ci.date >= checkin_date - INTERVAL '30 days' -- Look back 30 days for streak
                AND NOT EXISTS (
                    SELECT 1 
                    FROM check_ins ci2 
                    WHERE ci2.goal_id = checkin_goal_id
                        AND ci2.user_id = checkin_user_id
                        AND ci2.date BETWEEN ci.date + 1 AND checkin_date - 1
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

-- Trigger to update habit chains when check-ins change
CREATE TRIGGER trigger_update_habit_chains
    AFTER INSERT OR UPDATE OR DELETE ON check_ins
    FOR EACH ROW
    EXECUTE FUNCTION update_habit_chain_from_checkin();

-- Enable RLS
ALTER TABLE habit_chains ENABLE ROW LEVEL SECURITY;

-- RLS Policies for habit_chains
CREATE POLICY "Users can view their own habit chains" ON habit_chains
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own habit chains" ON habit_chains
    FOR ALL
    USING (user_id = auth.uid());

