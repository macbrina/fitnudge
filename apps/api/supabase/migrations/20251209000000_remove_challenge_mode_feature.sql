-- =====================================================
-- REMOVE DEPRECATED challenge_mode FEATURE
-- =====================================================
-- 
-- challenge_mode was an ambiguous feature key that didn't differentiate
-- between joining and creating challenges. We now use:
--   - challenge_join: Join public community challenges (FREE)
--   - challenge_create: Create/manage community challenges (STARTER+)
--
-- This migration removes any lingering challenge_mode entries from plan_features.
--

-- Remove challenge_mode from all plans
DELETE FROM plan_features WHERE feature_key = 'challenge_mode';

-- Add a comment explaining the challenge vs group_goals distinction
COMMENT ON TABLE plan_features IS 
'Plan features mapping. Key distinctions:
- CHALLENGES (challenge_join, challenge_create): PUBLIC, COMPETITIVE events with LEADERBOARDS. Time-limited, open to community.
- GROUP GOALS (group_goals, group_goals_premium): PRIVATE, COLLABORATIVE goals shared with FRIENDS. Ongoing, invite-only.';
