-- =====================================================
-- SIMPLIFIED FEATURE LIMITS MIGRATION
-- =====================================================
--
-- Simplified approach:
-- - active_goal_limit: Max goals user can have ACTIVE at a time
-- - challenge_limit: Max challenges user can participate in (created OR joined)
-- - group_goals_limit: Max group goals user can participate in (created OR joined)
--
-- Whether you create or join, it counts toward your limit.
-- To add more, deactivate/leave existing ones first.
--
-- Limits by Plan:
-- ┌───────────────────────┬──────┬─────────┬─────┬───────┐
-- │ Feature               │ Free │ Starter │ Pro │ Elite │
-- ├───────────────────────┼──────┼─────────┼─────┼───────┤
-- │ active_goal_limit     │ 1    │ 3       │ 5   │ NULL  │
-- │ challenge_limit       │ 1    │ 2       │ 3   │ NULL  │
-- │ group_goals_limit     │ 0    │ 0       │ 3   │ NULL  │
-- └───────────────────────┴──────┴─────────┴─────┴───────┘
--
-- NULL = unlimited
-- 0 = feature not available
--
-- =====================================================

-- =====================================================
-- 1. ACTIVE GOAL LIMIT (already exists, ensure correct values)
-- =====================================================
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_value, is_enabled, minimum_tier, feature_description, ai_description, sort_order)
VALUES
    ('free', 'active_goal_limit', 'Active Goals Limit', 1, true, 0, 
     'Maximum number of goals you can have active at a time',
     'User can have 1 active goal at a time', 10),
    ('starter', 'active_goal_limit', 'Active Goals Limit', 3, true, 1,
     'Maximum number of goals you can have active at a time', 
     'User can have 3 active goals at a time', 10),
    ('pro', 'active_goal_limit', 'Active Goals Limit', 5, true, 2,
     'Maximum number of goals you can have active at a time',
     'User can have 5 active goals at a time', 10),
    ('elite', 'active_goal_limit', 'Active Goals Limit', NULL, true, 3,
     'Maximum number of active goals (unlimited)',
     'User can have unlimited active goals', 10)
ON CONFLICT (plan_id, feature_key) DO UPDATE SET
    feature_name = EXCLUDED.feature_name,
    feature_value = EXCLUDED.feature_value,
    is_enabled = EXCLUDED.is_enabled,
    minimum_tier = EXCLUDED.minimum_tier,
    feature_description = EXCLUDED.feature_description,
    ai_description = EXCLUDED.ai_description,
    sort_order = EXCLUDED.sort_order;


-- =====================================================
-- 2. CHALLENGE LIMIT (created OR joined - simplified)
-- =====================================================
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_value, is_enabled, minimum_tier, feature_description, ai_description, sort_order)
VALUES
    ('free', 'challenge_limit', 'Challenges Limit', 1, true, 0, 
     'Maximum challenges you can participate in (created or joined)',
     'User can participate in 1 challenge at a time', 25),
    ('starter', 'challenge_limit', 'Challenges Limit', 2, true, 1,
     'Maximum challenges you can participate in (created or joined)', 
     'User can participate in 2 challenges at a time', 25),
    ('pro', 'challenge_limit', 'Challenges Limit', 3, true, 2,
     'Maximum challenges you can participate in (created or joined)',
     'User can participate in 3 challenges at a time', 25),
    ('elite', 'challenge_limit', 'Challenges Limit', NULL, true, 3,
     'Maximum challenges you can participate in (unlimited)',
     'User can participate in unlimited challenges', 25)
ON CONFLICT (plan_id, feature_key) DO UPDATE SET
    feature_name = EXCLUDED.feature_name,
    feature_value = EXCLUDED.feature_value,
    is_enabled = EXCLUDED.is_enabled,
    minimum_tier = EXCLUDED.minimum_tier,
    feature_description = EXCLUDED.feature_description,
    ai_description = EXCLUDED.ai_description,
    sort_order = EXCLUDED.sort_order;


-- =====================================================
-- 3. GROUP GOALS LIMIT (created OR joined - simplified)
-- =====================================================
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_value, is_enabled, minimum_tier, feature_description, ai_description, sort_order)
VALUES
    ('free', 'group_goals_limit', 'Group Goals Limit', 0, false, 0, 
     'Maximum group goals you can participate in (upgrade required)',
     'User cannot participate in group goals', 30),
    ('starter', 'group_goals_limit', 'Group Goals Limit', 0, false, 1,
     'Maximum group goals you can participate in (upgrade to Pro)', 
     'User cannot participate in group goals', 30),
    ('pro', 'group_goals_limit', 'Group Goals Limit', 3, true, 2,
     'Maximum group goals you can participate in (created or joined)',
     'User can participate in 3 group goals at a time', 30),
    ('elite', 'group_goals_limit', 'Group Goals Limit', NULL, true, 3,
     'Maximum group goals you can participate in (unlimited)',
     'User can participate in unlimited group goals', 30)
ON CONFLICT (plan_id, feature_key) DO UPDATE SET
    feature_name = EXCLUDED.feature_name,
    feature_value = EXCLUDED.feature_value,
    is_enabled = EXCLUDED.is_enabled,
    minimum_tier = EXCLUDED.minimum_tier,
    feature_description = EXCLUDED.feature_description,
    ai_description = EXCLUDED.ai_description,
    sort_order = EXCLUDED.sort_order;


-- =====================================================
-- 4. CLEANUP OLD COMPLEX KEYS (if they exist)
-- =====================================================
-- Remove the overly complex separate limits
DELETE FROM plan_features WHERE feature_key IN (
    'challenge_join_limit',
    'challenge_active_limit', 
    'challenge_create_limit',
    'group_goals_join_limit',
    'group_goals_active_limit',
    'group_goals_create_limit'
);


-- =====================================================
-- 5. DOCUMENTATION
-- =====================================================
COMMENT ON TABLE plan_features IS 
'Plan features and limits - SIMPLIFIED APPROACH.

GOAL LIMITS:
- active_goal_limit: Max goals user can have ACTIVE at a time

CHALLENGE LIMITS:
- challenge_limit: Max challenges user can PARTICIPATE in (created + joined)
- challenge_join: Boolean - can user access challenges? (all tiers)
- challenge_create: Boolean - can user CREATE challenges? (starter+ only)

GROUP GOAL LIMITS:
- group_goals_limit: Max group goals user can PARTICIPATE in (created + joined)
- group_goals: Boolean - can user access group goals? (pro+ only)

KEY PRINCIPLE:
Whether you CREATE or JOIN something, it counts toward your limit.
To add more, you must leave/deactivate existing ones first.

NOTES:
- feature_value = NULL means unlimited
- feature_value = 0 means feature not available
- is_enabled = false means feature is disabled for that tier';
