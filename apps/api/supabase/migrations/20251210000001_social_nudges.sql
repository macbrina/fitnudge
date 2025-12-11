-- =====================================================
-- SOCIAL NUDGES: Motivation mechanics for social features
-- =====================================================
-- This migration adds support for:
-- 1. Social nudges (nudge, cheer, milestone, competitive, custom messages)
-- 2. Extended notification preferences for social features

-- =====================================================
-- Part 1: Create social_nudges table
-- =====================================================
CREATE TABLE IF NOT EXISTS social_nudges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Who and where
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Context (one of these will be set based on the nudge context)
    goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    partnership_id UUID REFERENCES accountability_partners(id) ON DELETE CASCADE,
    
    -- Content
    nudge_type TEXT NOT NULL CHECK (nudge_type IN (
        'nudge',           -- Reminder to check in
        'cheer',           -- Quick encouragement/celebration
        'milestone',       -- Celebrating achievement
        'competitive',     -- Competitive banter
        'custom'           -- Custom message
    )),
    message TEXT,                    -- Custom message (optional)
    emoji TEXT,                      -- Quick reaction emoji
    is_ai_generated BOOLEAN DEFAULT false,
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Rate limiting
    nudge_date DATE DEFAULT CURRENT_DATE
);

-- =====================================================
-- Part 2: Indexes for social_nudges
-- =====================================================
-- Primary lookup: Get nudges received by user
CREATE INDEX IF NOT EXISTS idx_social_nudges_recipient 
ON social_nudges(recipient_id, is_read, created_at DESC);

-- Lookup: Get nudges sent by user
CREATE INDEX IF NOT EXISTS idx_social_nudges_sender 
ON social_nudges(sender_id, created_at DESC);

-- Lookup: Get nudges for a specific goal
CREATE INDEX IF NOT EXISTS idx_social_nudges_goal 
ON social_nudges(goal_id) 
WHERE goal_id IS NOT NULL;

-- Lookup: Get nudges for a specific challenge
CREATE INDEX IF NOT EXISTS idx_social_nudges_challenge 
ON social_nudges(challenge_id) 
WHERE challenge_id IS NOT NULL;

-- Lookup: Get nudges for a partnership
CREATE INDEX IF NOT EXISTS idx_social_nudges_partnership 
ON social_nudges(partnership_id) 
WHERE partnership_id IS NOT NULL;

-- Rate limiting: Only 1 nudge per sender-recipient pair per day (for nudge type)
CREATE UNIQUE INDEX IF NOT EXISTS idx_nudge_daily_limit 
ON social_nudges(sender_id, recipient_id, nudge_type, nudge_date)
WHERE nudge_type = 'nudge';

-- =====================================================
-- Part 3: RLS Policies for social_nudges
-- =====================================================
ALTER TABLE social_nudges ENABLE ROW LEVEL SECURITY;

-- Users can view nudges sent to them or by them
CREATE POLICY "Users can view their own nudges"
ON social_nudges FOR SELECT
TO authenticated
USING (recipient_id = auth.uid() OR sender_id = auth.uid());

-- Users can create nudges (as sender)
CREATE POLICY "Users can create nudges"
ON social_nudges FOR INSERT
TO authenticated
WITH CHECK (sender_id = auth.uid());

-- Users can mark their received nudges as read
CREATE POLICY "Users can update their received nudges"
ON social_nudges FOR UPDATE
TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

-- Users can delete nudges they sent
CREATE POLICY "Users can delete nudges they sent"
ON social_nudges FOR DELETE
TO authenticated
USING (sender_id = auth.uid());

-- =====================================================
-- Part 4: Add social notification preferences columns
-- =====================================================
-- Note: notification_preferences table should already exist

-- Accountability Partners notifications
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS social_partner_requests BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS social_partner_nudges BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS social_partner_cheers BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS social_partner_milestones BOOLEAN DEFAULT true;

-- Group Goals notifications
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS social_group_invites BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS social_group_milestones BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS social_group_nudges BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS social_group_contributions BOOLEAN DEFAULT false;  -- Off by default (noisy)

-- Challenges notifications
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS social_challenge_invites BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS social_challenge_leaderboard BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS social_challenge_nudges BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS social_challenge_reminders BOOLEAN DEFAULT true;

-- Goal Sharing notifications
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS social_goal_shared BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS social_motivation_messages BOOLEAN DEFAULT true;

-- Comments on the new columns
COMMENT ON COLUMN notification_preferences.social_partner_requests IS 'Receive notifications when someone requests to be your accountability partner';
COMMENT ON COLUMN notification_preferences.social_partner_nudges IS 'Receive nudges from your accountability partners';
COMMENT ON COLUMN notification_preferences.social_partner_cheers IS 'Receive cheers from your accountability partners when you check in';
COMMENT ON COLUMN notification_preferences.social_partner_milestones IS 'Receive notifications about your partner achievements';
COMMENT ON COLUMN notification_preferences.social_group_invites IS 'Receive notifications when invited to group goals';
COMMENT ON COLUMN notification_preferences.social_group_milestones IS 'Receive notifications about team milestones';
COMMENT ON COLUMN notification_preferences.social_group_nudges IS 'Receive nudges from group goal members';
COMMENT ON COLUMN notification_preferences.social_group_contributions IS 'Receive notifications when team members contribute (can be noisy)';
COMMENT ON COLUMN notification_preferences.social_challenge_invites IS 'Receive notifications when invited to challenges';
COMMENT ON COLUMN notification_preferences.social_challenge_leaderboard IS 'Receive notifications about leaderboard changes';
COMMENT ON COLUMN notification_preferences.social_challenge_nudges IS 'Receive competitive nudges in challenges';
COMMENT ON COLUMN notification_preferences.social_challenge_reminders IS 'Receive reminders about challenge start/end dates';
COMMENT ON COLUMN notification_preferences.social_goal_shared IS 'Receive notifications when someone shares a goal with you';
COMMENT ON COLUMN notification_preferences.social_motivation_messages IS 'Receive motivation messages from people you share goals with';

-- =====================================================
-- Part 5: Enable Realtime for social_nudges
-- =====================================================
DO $$ 
BEGIN
    -- Check if table is already in the publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'social_nudges'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE social_nudges;
    END IF;
END $$;

-- =====================================================
-- Part 6: Updated_at trigger for social_nudges
-- =====================================================
-- Note: We're not adding updated_at to this table since nudges are typically
-- only created once and then marked as read. If needed, uncomment below:
--
-- ALTER TABLE social_nudges ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
-- CREATE TRIGGER update_social_nudges_updated_at 
--     BEFORE UPDATE ON social_nudges 
--     FOR EACH ROW 
--     EXECUTE FUNCTION update_updated_at_column();
