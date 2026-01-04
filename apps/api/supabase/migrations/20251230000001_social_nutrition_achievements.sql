-- =====================================================
-- SOCIAL & NUTRITION ACHIEVEMENT BADGES
-- Additional achievements for partner, nudge, meal, hydration, and challenge features
-- =====================================================

-- =====================================================
-- PARTNER ACHIEVEMENTS (Social Category)
-- =====================================================
INSERT INTO achievement_types (badge_key, badge_name, badge_description, unlock_condition, category, rarity, points, sort_order) VALUES
('first_partner', 'Accountability Buddy', 'Connect with your first accountability partner', '{"type": "partner_count", "value": 1}', 'social', 'common', 25, 100),
('partners_3', 'Squad Goals', 'Have 3 active accountability partners', '{"type": "partner_count", "value": 3}', 'social', 'rare', 75, 101),
('partners_5', 'Network Builder', 'Have 5 active accountability partners', '{"type": "partner_count", "value": 5}', 'social', 'epic', 150, 102);

-- =====================================================
-- NUDGE ACHIEVEMENTS (Social Category)
-- =====================================================
INSERT INTO achievement_types (badge_key, badge_name, badge_description, unlock_condition, category, rarity, points, sort_order) VALUES
('first_nudge', 'First Nudge', 'Send your first nudge to a partner', '{"type": "nudges_sent", "value": 1}', 'social', 'common', 15, 110),
('nudges_10', 'Motivator', 'Send 10 nudges to your partners', '{"type": "nudges_sent", "value": 10}', 'social', 'rare', 50, 111),
('nudges_50', 'Chief Motivator', 'Send 50 nudges to your partners', '{"type": "nudges_sent", "value": 50}', 'social', 'epic', 150, 112),
('nudges_100', 'Nudge Master', 'Send 100 nudges to your partners', '{"type": "nudges_sent", "value": 100}', 'social', 'legendary', 300, 113);

-- =====================================================
-- MEAL TRACKING ACHIEVEMENTS (Consistency Category)
-- =====================================================
INSERT INTO achievement_types (badge_key, badge_name, badge_description, unlock_condition, category, rarity, points, sort_order) VALUES
('first_meal', 'First Bite', 'Log your first meal', '{"type": "meal_count", "value": 1}', 'milestone', 'common', 10, 120),
('meals_10', 'Meal Tracker', 'Log 10 meals', '{"type": "meal_count", "value": 10}', 'consistency', 'common', 30, 121),
('meals_50', 'Nutrition Ninja', 'Log 50 meals', '{"type": "meal_count", "value": 50}', 'consistency', 'rare', 75, 122),
('meals_100', 'Meal Master', 'Log 100 meals', '{"type": "meal_count", "value": 100}', 'consistency', 'epic', 200, 123),
('meals_365', 'Year of Meals', 'Log 365 meals', '{"type": "meal_count", "value": 365}', 'consistency', 'legendary', 500, 124);

-- =====================================================
-- HYDRATION ACHIEVEMENTS (Consistency Category)
-- =====================================================
INSERT INTO achievement_types (badge_key, badge_name, badge_description, unlock_condition, category, rarity, points, sort_order) VALUES
('first_hydration', 'First Sip', 'Log your first hydration', '{"type": "hydration_count", "value": 1}', 'milestone', 'common', 10, 130),
('hydration_10', 'Hydration Station', 'Log hydration 10 times', '{"type": "hydration_count", "value": 10}', 'consistency', 'common', 30, 131),
('hydration_50', 'Water Warrior', 'Log hydration 50 times', '{"type": "hydration_count", "value": 50}', 'consistency', 'rare', 75, 132),
('hydration_100', 'Hydration Hero', 'Log hydration 100 times', '{"type": "hydration_count", "value": 100}', 'consistency', 'epic', 200, 133);

-- =====================================================
-- CHALLENGE ACHIEVEMENTS (Milestone Category)
-- =====================================================
INSERT INTO achievement_types (badge_key, badge_name, badge_description, unlock_condition, category, rarity, points, sort_order) VALUES
('first_challenge', 'Challenger', 'Join your first challenge', '{"type": "challenge_count", "value": 1}', 'milestone', 'common', 20, 140),
('challenges_5', 'Challenge Seeker', 'Participate in 5 challenges', '{"type": "challenge_count", "value": 5}', 'milestone', 'rare', 75, 141),
('challenges_10', 'Challenge Veteran', 'Participate in 10 challenges', '{"type": "challenge_count", "value": 10}', 'milestone', 'epic', 200, 142),
('first_win', 'First Victory', 'Win your first challenge', '{"type": "challenge_won", "value": 1}', 'milestone', 'rare', 100, 143),
('wins_5', 'Champion', 'Win 5 challenges', '{"type": "challenge_won", "value": 5}', 'milestone', 'epic', 250, 144),
('wins_10', 'Grand Champion', 'Win 10 challenges', '{"type": "challenge_won", "value": 10}', 'milestone', 'legendary', 500, 145);

-- =====================================================
-- FUTURE: POSTS/LIKES/COMMENTS ACHIEVEMENTS (Placeholder)
-- These will be activated when the social features are implemented
-- =====================================================
INSERT INTO achievement_types (badge_key, badge_name, badge_description, unlock_condition, category, rarity, points, sort_order, is_active) VALUES
('first_post', 'First Post', 'Create your first post', '{"type": "post_count", "value": 1}', 'social', 'common', 15, 200, false),
('posts_10', 'Content Creator', 'Create 10 posts', '{"type": "post_count", "value": 10}', 'social', 'rare', 50, 201, false),
('first_comment', 'Conversation Starter', 'Leave your first comment', '{"type": "comment_count", "value": 1}', 'social', 'common', 10, 210, false),
('comments_50', 'Community Voice', 'Leave 50 comments', '{"type": "comment_count", "value": 50}', 'social', 'rare', 75, 211, false),
('first_like_received', 'Liked', 'Receive your first like', '{"type": "likes_received", "value": 1}', 'social', 'common', 10, 220, false),
('likes_100', 'Popular', 'Receive 100 likes on your posts', '{"type": "likes_received", "value": 100}', 'social', 'epic', 150, 221, false);

