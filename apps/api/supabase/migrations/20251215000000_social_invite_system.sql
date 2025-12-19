-- =====================================================
-- SOCIAL INVITE SYSTEM
-- =====================================================
-- This migration adds:
-- 1. User referral system (referral codes, tracking)
-- 2. Scoped accountability partners (global, challenge only - no goal scope)
-- 3. Challenge invites table
-- 4. Removes group_goals feature entirely (challenges cover this use case)
-- 5. Removes redundant goal_shares table
-- =====================================================

-- =====================================================
-- Part 1: User Referral System
-- =====================================================

-- Add referral columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(10) UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS referral_bonus_granted_at TIMESTAMP WITH TIME ZONE;

-- Index for referral lookups
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by_user_id) WHERE referred_by_user_id IS NOT NULL;

COMMENT ON COLUMN users.referral_code IS 'Unique referral code for this user (e.g., JOHN1234)';
COMMENT ON COLUMN users.referred_by_user_id IS 'User who referred this user to the app';
COMMENT ON COLUMN users.referral_bonus_granted_at IS 'When referral bonus was granted (prevents double-granting)';

-- =====================================================
-- Part 2: Update Accountability Partners (Scoped)
-- =====================================================

-- Add scope columns to accountability_partners (global, goal, or challenge)
ALTER TABLE accountability_partners
ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'global',
ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS invite_code VARCHAR(20) UNIQUE;

-- Add check constraint for scope (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'accountability_partners_scope_check'
    ) THEN
        ALTER TABLE accountability_partners
        ADD CONSTRAINT accountability_partners_scope_check CHECK (
            scope IN ('global', 'goal', 'challenge')
        );
    END IF;
END $$;

-- Add constraint for scope consistency (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'accountability_partners_scope_consistency'
    ) THEN
        ALTER TABLE accountability_partners
        ADD CONSTRAINT accountability_partners_scope_consistency CHECK (
            (scope = 'global' AND goal_id IS NULL AND challenge_id IS NULL) OR
            (scope = 'goal' AND goal_id IS NOT NULL AND challenge_id IS NULL) OR
            (scope = 'challenge' AND goal_id IS NULL AND challenge_id IS NOT NULL)
        );
    END IF;
END $$;

-- Index for invite code lookups
CREATE INDEX IF NOT EXISTS idx_accountability_partners_invite_code 
ON accountability_partners(invite_code) WHERE invite_code IS NOT NULL;

-- Index for scoped lookups
CREATE INDEX IF NOT EXISTS idx_accountability_partners_goal_id 
ON accountability_partners(goal_id) WHERE goal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accountability_partners_challenge_id 
ON accountability_partners(challenge_id) WHERE challenge_id IS NOT NULL;

COMMENT ON COLUMN accountability_partners.scope IS 'Scope of partnership: global (all goals), goal (specific goal), or challenge (specific challenge)';
COMMENT ON COLUMN accountability_partners.goal_id IS 'Goal ID if scope is goal-specific';
COMMENT ON COLUMN accountability_partners.challenge_id IS 'Challenge ID if scope is challenge-specific';
COMMENT ON COLUMN accountability_partners.invite_code IS 'Shareable invite code for link-based invites';

-- =====================================================
-- Part 3: Challenge Invites Table
-- =====================================================

CREATE TABLE IF NOT EXISTS challenge_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    invited_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL if via link
    invite_code VARCHAR(20) UNIQUE,  -- For shareable links
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE
);

-- Unique constraint: One invite per user per challenge (only for in-app invites)
CREATE UNIQUE INDEX IF NOT EXISTS idx_challenge_invites_unique_user
ON challenge_invites(challenge_id, invited_user_id) 
WHERE invited_user_id IS NOT NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_challenge_invites_challenge_id ON challenge_invites(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_invites_invited_user ON challenge_invites(invited_user_id) WHERE invited_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_challenge_invites_invited_by ON challenge_invites(invited_by_user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_invites_code ON challenge_invites(invite_code) WHERE invite_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_challenge_invites_status ON challenge_invites(status);

-- RLS
ALTER TABLE challenge_invites ENABLE ROW LEVEL SECURITY;

-- Users can view invites they sent or received
CREATE POLICY "challenge_invites_select" ON challenge_invites
FOR SELECT TO authenticated
USING (
    invited_by_user_id = auth.uid() OR 
    invited_user_id = auth.uid()
);

-- Users can create invites for challenges they're part of or own
CREATE POLICY "challenge_invites_insert" ON challenge_invites
FOR INSERT TO authenticated
WITH CHECK (
    invited_by_user_id = auth.uid() AND
    (
        EXISTS (SELECT 1 FROM challenges WHERE id = challenge_id AND created_by = auth.uid()) OR
        EXISTS (SELECT 1 FROM challenge_participants WHERE challenge_id = challenge_invites.challenge_id AND user_id = auth.uid())
    )
);

-- Users can update invites they received (accept/decline)
CREATE POLICY "challenge_invites_update" ON challenge_invites
FOR UPDATE TO authenticated
USING (invited_user_id = auth.uid())
WITH CHECK (invited_user_id = auth.uid());

-- Users can delete invites they sent
CREATE POLICY "challenge_invites_delete" ON challenge_invites
FOR DELETE TO authenticated
USING (invited_by_user_id = auth.uid());

-- =====================================================
-- Part 4: Drop Group Goals Feature Entirely
-- =====================================================
-- The group_goals table allowed multiple users to collaborate on a shared goal.
-- This is now replaced by private challenges with invites.
-- Challenges provide: individual progress tracking, leaderboards, time-bound goals.

-- Drop group_goal_invites table if it exists
DROP TABLE IF EXISTS group_goal_invites CASCADE;

-- Drop the group_goals table (separate from goals table!)
DROP TABLE IF EXISTS group_goals CASCADE;

-- Remove group_goals from realtime publication if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'group_goals'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE group_goals;
    END IF;
END $$;

-- Remove group_goals related plan_features
DELETE FROM plan_features WHERE feature_key IN (
    'group_goals',
    'group_goals_premium',
    'group_goals_limit',
    'group_goals_join_limit',
    'group_goals_active_limit',
    'group_goals_create_limit'
);

-- =====================================================
-- Part 5: Drop goal_shares Table and Related Columns
-- =====================================================

-- Drop goal_shares table
DROP TABLE IF EXISTS goal_shares CASCADE;

-- Remove group goal and sharing related columns from goals table
ALTER TABLE goals DROP COLUMN IF EXISTS is_group_goal;
ALTER TABLE goals DROP COLUMN IF EXISTS is_shared;
ALTER TABLE goals DROP COLUMN IF EXISTS shared_with_all_friends;

-- Remove related notification preferences (optional cleanup)
ALTER TABLE notification_preferences DROP COLUMN IF EXISTS social_goal_shared;

-- =====================================================
-- Part 6: Enable Realtime for New Tables
-- =====================================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'challenge_invites'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE challenge_invites;
    END IF;
END $$;

-- =====================================================
-- Part 7: Update Accountability Partner Feature Limits
-- =====================================================
-- Free users cannot have accountability partners (feature starts at Starter)
-- Starter: 2 partners, Pro: 5 partners, Elite: unlimited

-- Remove legacy variants (consolidate to just 'social_accountability')
DELETE FROM plan_features WHERE feature_key IN (
    'social_accountability_basic',
    'social_accountability_premium'
);

-- Add accountability partner limits for tiers that have access
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_value, is_enabled, minimum_tier, feature_description, ai_description, sort_order)
VALUES
    ('starter', 'accountability_partner_limit', 'Accountability Partner Limit', 2, true, 1,
     'Maximum accountability partners', 'up to 2 accountability partners', 25),
    ('pro', 'accountability_partner_limit', 'Accountability Partner Limit', 5, true, 2,
     'Maximum accountability partners', 'up to 5 accountability partners', 25),
    ('elite', 'accountability_partner_limit', 'Accountability Partner Limit', NULL, true, 3,
     'Unlimited accountability partners', 'unlimited accountability partners', 25)
ON CONFLICT (plan_id, feature_key) DO UPDATE SET
    feature_value = EXCLUDED.feature_value,
    is_enabled = EXCLUDED.is_enabled,
    feature_description = EXCLUDED.feature_description,
    ai_description = EXCLUDED.ai_description;

-- =====================================================
-- Part 8: Clean Up Group Goal Notification Data
-- =====================================================

-- Delete group goal related notifications from notification_history
DELETE FROM notification_history 
WHERE notification_type IN (
    'group_invite',
    'group_milestone',
    'group_nudge',
    'group_contribution',
    'goal_shared'
);

-- Remove group goal related preference columns from notification_preferences
ALTER TABLE notification_preferences DROP COLUMN IF EXISTS social_group_invites;
ALTER TABLE notification_preferences DROP COLUMN IF EXISTS social_group_milestones;
ALTER TABLE notification_preferences DROP COLUMN IF EXISTS social_group_nudges;
ALTER TABLE notification_preferences DROP COLUMN IF EXISTS social_group_contributions;
ALTER TABLE notification_preferences DROP COLUMN IF EXISTS social_goal_shared;

-- =====================================================
-- Part 9: Update Comments
-- =====================================================

COMMENT ON TABLE plan_features IS
'Plan features mapping. Key distinctions:
- CHALLENGES: Competitive or collaborative events with individual progress tracking and leaderboards. Can be public or private with invites.
- GOALS: Personal goals with actionable plans, habits, etc. Always individual.
- ACCOUNTABILITY PARTNERS: Users who keep you on track (Starter+). Limits: Starter=2, Pro=5, Elite=unlimited.
- GROUP GOALS feature has been REMOVED - use private challenges instead for group activities.';
