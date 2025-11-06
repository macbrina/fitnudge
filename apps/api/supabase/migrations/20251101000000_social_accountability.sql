-- =====================================================
-- SOCIAL ACCOUNTABILITY: GOAL SHARING & ACCOUNTABILITY PARTNERS
-- =====================================================

-- Table for goal sharing permissions
-- Tracks which users can view a goal's progress
CREATE TABLE goal_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    shared_with_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_level TEXT NOT NULL DEFAULT 'view' CHECK (permission_level IN ('view', 'comment', 'motivate')),
    shared_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique share per goal-user pair
    UNIQUE(goal_id, shared_with_user_id)
);

-- Table for accountability partners
-- Matches users who want accountability partnerships
CREATE TABLE accountability_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    partner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
    initiated_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure unique partnership per user pair
    UNIQUE(user_id, partner_user_id)
);

-- Table for group goals
-- Allows multiple users to work on the same goal together
CREATE TABLE group_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    
    -- Ensure unique membership per goal-user pair
    UNIQUE(goal_id, user_id)
);

-- Add is_shared column to goals table
ALTER TABLE goals
ADD COLUMN is_shared BOOLEAN DEFAULT false,
ADD COLUMN is_group_goal BOOLEAN DEFAULT false,
ADD COLUMN shared_with_all_friends BOOLEAN DEFAULT false;

-- Indexes for performance
CREATE INDEX idx_goal_shares_goal_id ON goal_shares(goal_id);
CREATE INDEX idx_goal_shares_shared_with_user_id ON goal_shares(shared_with_user_id);
CREATE INDEX idx_goal_shares_shared_by_user_id ON goal_shares(shared_by_user_id);
CREATE INDEX idx_goal_shares_active ON goal_shares(is_active) WHERE is_active = true;

CREATE INDEX idx_accountability_partners_user_id ON accountability_partners(user_id);
CREATE INDEX idx_accountability_partners_partner_user_id ON accountability_partners(partner_user_id);
CREATE INDEX idx_accountability_partners_status ON accountability_partners(status);
CREATE INDEX idx_accountability_partners_accepted ON accountability_partners(status) WHERE status = 'accepted';

CREATE INDEX idx_group_goals_goal_id ON group_goals(goal_id);
CREATE INDEX idx_group_goals_user_id ON group_goals(user_id);
CREATE INDEX idx_group_goals_active ON group_goals(is_active) WHERE is_active = true;

-- Add updated_at trigger for goal_shares and accountability_partners
CREATE TRIGGER update_goal_shares_updated_at 
    BEFORE UPDATE ON goal_shares 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accountability_partners_updated_at 
    BEFORE UPDATE ON accountability_partners 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE goal_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE accountability_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for goal_shares
CREATE POLICY "Users can view goal shares for their goals" ON goal_shares
    FOR SELECT
    USING (
        goal_id IN (SELECT id FROM goals WHERE user_id = auth.uid())
        OR shared_with_user_id = auth.uid()
    );

CREATE POLICY "Goal owners can share their goals" ON goal_shares
    FOR INSERT
    WITH CHECK (
        goal_id IN (SELECT id FROM goals WHERE user_id = auth.uid())
    );

CREATE POLICY "Goal owners can update goal shares" ON goal_shares
    FOR UPDATE
    USING (
        goal_id IN (SELECT id FROM goals WHERE user_id = auth.uid())
    );

CREATE POLICY "Goal owners can delete goal shares" ON goal_shares
    FOR DELETE
    USING (
        goal_id IN (SELECT id FROM goals WHERE user_id = auth.uid())
    );

-- RLS Policies for accountability_partners
CREATE POLICY "Users can view their own partnerships" ON accountability_partners
    FOR SELECT
    USING (user_id = auth.uid() OR partner_user_id = auth.uid());

CREATE POLICY "Users can create partnership requests" ON accountability_partners
    FOR INSERT
    WITH CHECK (initiated_by_user_id = auth.uid());

CREATE POLICY "Users can update their own partnerships" ON accountability_partners
    FOR UPDATE
    USING (partner_user_id = auth.uid() OR user_id = auth.uid());

CREATE POLICY "Users can delete their own partnerships" ON accountability_partners
    FOR DELETE
    USING (user_id = auth.uid() OR partner_user_id = auth.uid());

-- RLS Policies for group_goals
CREATE POLICY "Users can view group goals they're part of" ON group_goals
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Goal owners can add members to group goals" ON group_goals
    FOR INSERT
    WITH CHECK (
        goal_id IN (
            SELECT g.id FROM goals g
            JOIN group_goals gg ON g.id = gg.goal_id
            WHERE gg.user_id = auth.uid() AND gg.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Goal owners and admins can update group members" ON group_goals
    FOR UPDATE
    USING (
        goal_id IN (
            SELECT g.id FROM goals g
            JOIN group_goals gg ON g.id = gg.goal_id
            WHERE gg.user_id = auth.uid() AND gg.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Goal owners and admins can remove group members" ON group_goals
    FOR DELETE
    USING (
        goal_id IN (
            SELECT g.id FROM goals g
            JOIN group_goals gg ON g.id = gg.goal_id
            WHERE gg.user_id = auth.uid() AND gg.role IN ('owner', 'admin')
        )
    );

