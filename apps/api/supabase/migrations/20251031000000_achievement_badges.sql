-- =====================================================
-- ACHIEVEMENT BADGES SYSTEM
-- =====================================================

-- Create achievement_types table (badge definitions)
CREATE TABLE achievement_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    badge_key TEXT UNIQUE NOT NULL,
    badge_name TEXT NOT NULL,
    badge_description TEXT,
    badge_icon TEXT, -- URL or icon identifier
    unlock_condition TEXT NOT NULL, -- JSON describing condition (e.g., {"type": "streak", "value": 7})
    category TEXT DEFAULT 'general' CHECK (category IN ('streak', 'milestone', 'consistency', 'social', 'special')),
    rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
    points INTEGER DEFAULT 10, -- Points awarded for unlocking
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_achievements table (unlocked badges)
CREATE TABLE user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_type_id UUID NOT NULL REFERENCES achievement_types(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES goals(id) ON DELETE SET NULL, -- Optional: specific goal achievement
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}', -- Additional data (e.g., streak length, check-in count)
    
    -- Ensure user can only unlock same achievement once
    UNIQUE(user_id, achievement_type_id, goal_id)
);

-- Add indexes
CREATE INDEX idx_achievement_types_active ON achievement_types(is_active);
CREATE INDEX idx_achievement_types_category ON achievement_types(category);
CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_goal_id ON user_achievements(goal_id);
CREATE INDEX idx_user_achievements_unlocked_at ON user_achievements(unlocked_at DESC);

-- Add updated_at trigger for achievement_types
CREATE OR REPLACE FUNCTION update_achievement_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_achievement_types_updated_at
    BEFORE UPDATE ON achievement_types
    FOR EACH ROW
    EXECUTE FUNCTION update_achievement_types_updated_at();

-- Enable RLS
ALTER TABLE achievement_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Users can read achievement types
CREATE POLICY "Anyone can read achievement types" ON achievement_types
    FOR SELECT
    USING (is_active = true);

-- Users can read their own achievements
CREATE POLICY "Users can read their own achievements" ON user_achievements
    FOR SELECT
    USING (auth.uid() = user_id);

-- Service role can manage everything
CREATE POLICY "Service role can manage achievement types" ON achievement_types
    FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage user achievements" ON user_achievements
    FOR ALL
    USING (auth.role() = 'service_role');

-- Insert default achievement badges
INSERT INTO achievement_types (badge_key, badge_name, badge_description, unlock_condition, category, rarity, points, sort_order) VALUES
('first_checkin', 'Getting Started', 'Complete your first check-in', '{"type": "checkin_count", "value": 1}', 'milestone', 'common', 10, 1),
('streak_3', 'Three Day Streak', 'Maintain a 3-day streak', '{"type": "streak", "value": 3}', 'streak', 'common', 20, 2),
('streak_7', 'Week Warrior', 'Complete a 7-day streak', '{"type": "streak", "value": 7}', 'streak', 'rare', 50, 3),
('streak_30', 'Month Master', 'Complete a 30-day streak', '{"type": "streak", "value": 30}', 'streak', 'epic', 200, 4),
('streak_100', 'Century Club', 'Complete a 100-day streak', '{"type": "streak", "value": 100}', 'streak', 'legendary', 1000, 5),
('checkins_50', 'Consistency Champion', 'Complete 50 check-ins', '{"type": "checkin_count", "value": 50}', 'consistency', 'rare', 100, 6),
('checkins_100', 'Hundred Hero', 'Complete 100 check-ins', '{"type": "checkin_count", "value": 100}', 'consistency', 'epic', 300, 7),
('first_goal', 'Goal Setter', 'Create your first goal', '{"type": "goal_count", "value": 1}', 'milestone', 'common', 15, 8),
('perfect_week', 'Perfect Week', 'Complete all check-ins in a week', '{"type": "perfect_week", "value": 7}', 'consistency', 'rare', 75, 9);

