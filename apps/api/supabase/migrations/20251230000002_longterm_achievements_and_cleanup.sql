-- =====================================================
-- LONG-TERM ACHIEVEMENTS & CLEANUP
-- 1. Add higher-tier achievements for long-term engagement
-- 2. Remove program_week achievements (requires goal_id which isn't available)
-- =====================================================

-- =====================================================
-- REMOVE PROGRAM_WEEK ACHIEVEMENTS (Can't work without goal_id)
-- =====================================================
DELETE FROM achievement_types WHERE badge_key IN (
    'program_week_2',
    'program_week_3', 
    'program_week_4',
    'program_complete'
);

-- =====================================================
-- LONG-TERM STREAK ACHIEVEMENTS
-- =====================================================
INSERT INTO achievement_types (badge_key, badge_name, badge_description, unlock_condition, category, rarity, points, sort_order) VALUES
('streak_200', 'Half Year Hero', 'Complete a 200-day streak', '{"type": "streak", "value": 200}', 'streak', 'legendary', 2000, 6),
('streak_365', 'Year Long Legend', 'Complete a 365-day streak', '{"type": "streak", "value": 365}', 'streak', 'legendary', 5000, 7);

-- =====================================================
-- LONG-TERM CHECK-IN ACHIEVEMENTS
-- =====================================================
INSERT INTO achievement_types (badge_key, badge_name, badge_description, unlock_condition, category, rarity, points, sort_order) VALUES
('checkins_250', 'Quarter Thousand', 'Complete 250 check-ins', '{"type": "checkin_count", "value": 250}', 'consistency', 'epic', 500, 8),
('checkins_500', 'Half Thousand', 'Complete 500 check-ins', '{"type": "checkin_count", "value": 500}', 'consistency', 'legendary', 1000, 9),
('checkins_1000', 'Thousand Check-ins', 'Complete 1000 check-ins', '{"type": "checkin_count", "value": 1000}', 'consistency', 'legendary', 2500, 10);

-- =====================================================
-- LONG-TERM WORKOUT ACHIEVEMENTS
-- =====================================================
INSERT INTO achievement_types (badge_key, badge_name, badge_description, unlock_condition, category, rarity, points, sort_order) VALUES
('workout_200', 'Workout Warrior', 'Complete 200 workout sessions', '{"type": "workout_count", "value": 200}', 'milestone', 'legendary', 1500, 15),
('workout_365', 'Daily Grind', 'Complete 365 workout sessions', '{"type": "workout_count", "value": 365}', 'milestone', 'legendary', 3000, 16),
('workout_500', 'Workout Legend', 'Complete 500 workout sessions', '{"type": "workout_count", "value": 500}', 'milestone', 'legendary', 5000, 17);

-- =====================================================
-- LONG-TERM WORKOUT STREAK ACHIEVEMENTS
-- =====================================================
INSERT INTO achievement_types (badge_key, badge_name, badge_description, unlock_condition, category, rarity, points, sort_order) VALUES
('workout_streak_60', 'Two Month Titan', 'Complete workouts 60 days in a row', '{"type": "workout_streak", "value": 60}', 'streak', 'legendary', 1000, 54),
('workout_streak_100', 'Century Workout', 'Complete workouts 100 days in a row', '{"type": "workout_streak", "value": 100}', 'streak', 'legendary', 2000, 55);

-- =====================================================
-- LONG-TERM MEAL ACHIEVEMENTS
-- =====================================================
INSERT INTO achievement_types (badge_key, badge_name, badge_description, unlock_condition, category, rarity, points, sort_order) VALUES
('meals_500', 'Meal Marathon', 'Log 500 meals', '{"type": "meal_count", "value": 500}', 'consistency', 'legendary', 750, 125),
('meals_1000', 'Meal Milestone', 'Log 1000 meals', '{"type": "meal_count", "value": 1000}', 'consistency', 'legendary', 1500, 126);

-- =====================================================
-- LONG-TERM HYDRATION ACHIEVEMENTS
-- =====================================================
INSERT INTO achievement_types (badge_key, badge_name, badge_description, unlock_condition, category, rarity, points, sort_order) VALUES
('hydration_200', 'Hydration Habit', 'Log hydration 200 times', '{"type": "hydration_count", "value": 200}', 'consistency', 'epic', 300, 134),
('hydration_365', 'Year of Hydration', 'Log hydration 365 times', '{"type": "hydration_count", "value": 365}', 'consistency', 'legendary', 600, 135),
('hydration_500', 'Hydration Master', 'Log hydration 500 times', '{"type": "hydration_count", "value": 500}', 'consistency', 'legendary', 1000, 136);

-- =====================================================
-- LONG-TERM NUDGE ACHIEVEMENTS
-- =====================================================
INSERT INTO achievement_types (badge_key, badge_name, badge_description, unlock_condition, category, rarity, points, sort_order) VALUES
('nudges_250', 'Encouragement Expert', 'Send 250 nudges to your partners', '{"type": "nudges_sent", "value": 250}', 'social', 'legendary', 500, 114),
('nudges_500', 'Nudge Legend', 'Send 500 nudges to your partners', '{"type": "nudges_sent", "value": 500}', 'social', 'legendary', 1000, 115);

-- =====================================================
-- LONG-TERM CHALLENGE ACHIEVEMENTS
-- =====================================================
INSERT INTO achievement_types (badge_key, badge_name, badge_description, unlock_condition, category, rarity, points, sort_order) VALUES
('challenges_25', 'Challenge Enthusiast', 'Participate in 25 challenges', '{"type": "challenge_count", "value": 25}', 'milestone', 'epic', 400, 146),
('challenges_50', 'Challenge Master', 'Participate in 50 challenges', '{"type": "challenge_count", "value": 50}', 'milestone', 'legendary', 750, 147),
('challenges_100', 'Challenge Legend', 'Participate in 100 challenges', '{"type": "challenge_count", "value": 100}', 'milestone', 'legendary', 1500, 148),
('wins_25', 'Dominator', 'Win 25 challenges', '{"type": "challenge_won", "value": 25}', 'milestone', 'legendary', 1000, 149),
('wins_50', 'Unstoppable', 'Win 50 challenges', '{"type": "challenge_won", "value": 50}', 'milestone', 'legendary', 2500, 150);

-- =====================================================
-- LONG-TERM GOAL ACHIEVEMENTS
-- =====================================================
INSERT INTO achievement_types (badge_key, badge_name, badge_description, unlock_condition, category, rarity, points, sort_order) VALUES
('goals_5', 'Goal Getter', 'Create 5 goals', '{"type": "goal_count", "value": 5}', 'milestone', 'rare', 50, 80),
('goals_10', 'Ambitious', 'Create 10 goals', '{"type": "goal_count", "value": 10}', 'milestone', 'epic', 100, 81),
('goals_25', 'Goal Master', 'Create 25 goals', '{"type": "goal_count", "value": 25}', 'milestone', 'legendary', 250, 82);

-- =====================================================
-- LONG-TERM PARTNER ACHIEVEMENTS
-- =====================================================
INSERT INTO achievement_types (badge_key, badge_name, badge_description, unlock_condition, category, rarity, points, sort_order) VALUES
('partners_10', 'Social Butterfly', 'Have 10 active accountability partners', '{"type": "partner_count", "value": 10}', 'social', 'legendary', 300, 103);

-- =====================================================
-- LONG-TERM PERFECT WORKOUT ACHIEVEMENTS
-- =====================================================
INSERT INTO achievement_types (badge_key, badge_name, badge_description, unlock_condition, category, rarity, points, sort_order) VALUES
('perfect_workout_25', 'Precision', 'Complete 25 workouts without skipping any exercises', '{"type": "perfect_workout_count", "value": 25}', 'special', 'legendary', 500, 23),
('perfect_workout_50', 'Master of Form', 'Complete 50 workouts without skipping any exercises', '{"type": "perfect_workout_count", "value": 50}', 'special', 'legendary', 1000, 24);

-- =====================================================
-- LONG-TERM SOCIAL POSTS ACHIEVEMENTS (Future - inactive)
-- =====================================================
INSERT INTO achievement_types (badge_key, badge_name, badge_description, unlock_condition, category, rarity, points, sort_order, is_active) VALUES
('posts_50', 'Prolific Poster', 'Create 50 posts', '{"type": "post_count", "value": 50}', 'social', 'epic', 150, 202, false),
('posts_100', 'Community Builder', 'Create 100 posts', '{"type": "post_count", "value": 100}', 'social', 'legendary', 300, 203, false),
('comments_100', 'Conversation King', 'Leave 100 comments', '{"type": "comment_count", "value": 100}', 'social', 'epic', 150, 212, false),
('comments_250', 'Discussion Master', 'Leave 250 comments', '{"type": "comment_count", "value": 250}', 'social', 'legendary', 300, 213, false),
('likes_500', 'Rising Star', 'Receive 500 likes on your posts', '{"type": "likes_received", "value": 500}', 'social', 'legendary', 400, 222, false),
('likes_1000', 'Community Favorite', 'Receive 1000 likes on your posts', '{"type": "likes_received", "value": 1000}', 'social', 'legendary', 750, 223, false);

