-- =====================================================
-- WORKOUT-SPECIFIC ACHIEVEMENT BADGES
-- Expands the achievement system with workout tracking badges
-- =====================================================

-- Insert workout-specific achievement badges
INSERT INTO achievement_types (badge_key, badge_name, badge_description, unlock_condition, category, rarity, points, sort_order) VALUES

-- Workout Count Milestones
('first_workout', 'First Workout', 'Complete your first timed workout session', '{"type": "workout_count", "value": 1}', 'milestone', 'common', 15, 10),
('workout_10', 'Getting Stronger', 'Complete 10 workout sessions', '{"type": "workout_count", "value": 10}', 'milestone', 'rare', 75, 11),
('workout_25', 'Fitness Enthusiast', 'Complete 25 workout sessions', '{"type": "workout_count", "value": 25}', 'milestone', 'rare', 150, 12),
('workout_50', 'Dedicated Athlete', 'Complete 50 workout sessions', '{"type": "workout_count", "value": 50}', 'milestone', 'epic', 300, 13),
('workout_100', 'Fitness Legend', 'Complete 100 workout sessions', '{"type": "workout_count", "value": 100}', 'milestone', 'legendary', 750, 14),

-- Perfect Workout (no skips)
('perfect_workout', 'Flawless', 'Complete a workout without skipping any exercises', '{"type": "perfect_workout", "value": 1}', 'special', 'rare', 50, 20),
('perfect_workout_5', 'Perfectionist', 'Complete 5 workouts without skipping any exercises', '{"type": "perfect_workout_count", "value": 5}', 'special', 'epic', 150, 21),
('perfect_workout_10', 'Excellence', 'Complete 10 workouts without skipping any exercises', '{"type": "perfect_workout_count", "value": 10}', 'special', 'legendary', 300, 22),

-- Time-Based Achievements
('early_bird', 'Early Bird', 'Complete a workout before 7:00 AM', '{"type": "workout_time", "condition": "before", "hour": 7}', 'special', 'common', 25, 30),
('night_owl', 'Night Owl', 'Complete a workout after 9:00 PM', '{"type": "workout_time", "condition": "after", "hour": 21}', 'special', 'common', 25, 31),
('lunch_warrior', 'Lunch Break Warrior', 'Complete a workout between 11:00 AM and 2:00 PM', '{"type": "workout_time", "condition": "between", "start_hour": 11, "end_hour": 14}', 'special', 'rare', 40, 32),

-- Duration Achievements
('marathon_session', 'Marathon Session', 'Complete a workout lasting 45 minutes or more', '{"type": "workout_duration", "minutes": 45}', 'special', 'rare', 60, 40),
('endurance_master', 'Endurance Master', 'Complete a workout lasting 60 minutes or more', '{"type": "workout_duration", "minutes": 60}', 'special', 'epic', 100, 41),

-- Streak Achievements (workout-specific)
('workout_streak_3', 'Three Day Focus', 'Complete workouts 3 days in a row', '{"type": "workout_streak", "value": 3}', 'streak', 'common', 30, 50),
('workout_streak_7', 'Week of Gains', 'Complete workouts 7 days in a row', '{"type": "workout_streak", "value": 7}', 'streak', 'rare', 100, 51),
('workout_streak_14', 'Two Week Warrior', 'Complete workouts 14 days in a row', '{"type": "workout_streak", "value": 14}', 'streak', 'epic', 250, 52),
('workout_streak_30', 'Month of Iron', 'Complete workouts 30 days in a row', '{"type": "workout_streak", "value": 30}', 'streak', 'legendary', 500, 53),

-- Program Progression
('program_week_2', 'Level Up', 'Complete week 1 of your workout program', '{"type": "program_week", "value": 1}', 'milestone', 'rare', 75, 60),
('program_week_3', 'Building Momentum', 'Complete week 2 of your workout program', '{"type": "program_week", "value": 2}', 'milestone', 'rare', 100, 61),
('program_week_4', 'Almost There', 'Complete week 3 of your workout program', '{"type": "program_week", "value": 3}', 'milestone', 'epic', 150, 62),
('program_complete', 'Program Graduate', 'Complete a full 4-week workout program', '{"type": "program_week", "value": 4}', 'milestone', 'legendary', 500, 63),

-- Weekly Consistency
('weekly_warrior_3', 'Weekly Warrior', 'Complete 3 workouts in a single week', '{"type": "weekly_workouts", "value": 3}', 'consistency', 'common', 40, 70),
('weekly_warrior_5', 'Fitness Fanatic', 'Complete 5 workouts in a single week', '{"type": "weekly_workouts", "value": 5}', 'consistency', 'rare', 80, 71),
('weekly_warrior_7', 'Seven Day Strong', 'Complete a workout every day for a week', '{"type": "weekly_workouts", "value": 7}', 'consistency', 'epic', 200, 72)

ON CONFLICT (badge_key) DO UPDATE SET
    badge_name = EXCLUDED.badge_name,
    badge_description = EXCLUDED.badge_description,
    unlock_condition = EXCLUDED.unlock_condition,
    category = EXCLUDED.category,
    rarity = EXCLUDED.rarity,
    points = EXCLUDED.points,
    sort_order = EXCLUDED.sort_order;

-- Add 'workout' to the category check constraint if not already present
-- (The original migration uses a check constraint, we need to add workout category)
DO $$
BEGIN
    -- First try to drop the old constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'achievement_types_category_check' 
        AND table_name = 'achievement_types'
    ) THEN
        ALTER TABLE achievement_types DROP CONSTRAINT achievement_types_category_check;
    END IF;
    
    -- Add updated constraint with 'workout' category
    ALTER TABLE achievement_types ADD CONSTRAINT achievement_types_category_check 
        CHECK (category IN ('streak', 'milestone', 'consistency', 'social', 'special', 'general', 'workout'));
EXCEPTION
    WHEN OTHERS THEN
        -- Constraint might already be correct or not exist
        NULL;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN achievement_types.category IS 'Achievement category: streak, milestone, consistency, social, special, general, or workout';

