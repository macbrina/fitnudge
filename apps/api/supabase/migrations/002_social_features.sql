-- =====================================================
-- FitNudge V2 - Social Features
-- Partners, nudges, achievements
-- =====================================================

-- =====================================================
-- ACCOUNTABILITY PARTNERS
-- =====================================================
CREATE TABLE accountability_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Partners
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Status: pending (request sent), accepted (active), rejected, blocked
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
  initiated_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_by UUID REFERENCES users(id) ON DELETE SET NULL, -- Who initiated the block (null if not blocked)
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  
  -- Ensure unique partnership per user pair
  UNIQUE(user_id, partner_user_id)
);

CREATE INDEX idx_partners_user ON accountability_partners(user_id);
CREATE INDEX idx_partners_partner ON accountability_partners(partner_user_id);
CREATE INDEX idx_partners_status ON accountability_partners(status);
CREATE INDEX idx_partners_user_status ON accountability_partners(user_id, status);

-- =====================================================
-- SOCIAL NUDGES (Cheers, Nudges, Milestones)
-- =====================================================
CREATE TABLE social_nudges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who and where
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Context
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  partnership_id UUID REFERENCES accountability_partners(id) ON DELETE CASCADE,
  
  -- Content
  nudge_type TEXT NOT NULL CHECK (nudge_type IN (
    'nudge',       -- Reminder to check in
    'cheer',       -- Quick encouragement (👏 💪 🔥 ⭐ 🎯)
    'milestone',   -- Celebrating streak/achievement
    'message',     -- Custom message (legacy)
    'competitive', -- Competitive banter
    'custom'       -- Custom message
  )),
  emoji TEXT, -- For cheers: the emoji used
  message TEXT, -- Optional custom message
  
  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nudges_recipient ON social_nudges(recipient_id);
CREATE INDEX idx_nudges_sender ON social_nudges(sender_id);
CREATE INDEX idx_nudges_unread ON social_nudges(recipient_id, is_read) WHERE is_read = false;
CREATE INDEX idx_nudges_partnership ON social_nudges(partnership_id);

-- =====================================================
-- ACHIEVEMENT TYPES (Badge Definitions)
-- =====================================================
CREATE TABLE achievement_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_key TEXT UNIQUE NOT NULL,
  badge_name TEXT NOT NULL,
  badge_description TEXT,
  badge_icon TEXT, -- URL or icon identifier
  unlock_condition JSONB NOT NULL, -- e.g., {"type": "streak", "value": 7}
  category TEXT DEFAULT 'general' CHECK (category IN ('streak', 'milestone', 'consistency', 'social', 'special', 'engagement')),
  rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  points INTEGER DEFAULT 10,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_achievement_types_active ON achievement_types(is_active);
CREATE INDEX idx_achievement_types_category ON achievement_types(category);

-- =====================================================
-- USER ACHIEVEMENTS (Unlocked Badges)
-- =====================================================
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_type_id UUID NOT NULL REFERENCES achievement_types(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL, -- Optional: specific goal
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}', -- Additional data (streak length, etc.)
  
  UNIQUE(user_id, achievement_type_id, goal_id)
);

CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_goal ON user_achievements(goal_id);
CREATE INDEX idx_user_achievements_unlocked ON user_achievements(unlocked_at DESC);

-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE TRIGGER update_accountability_partners_updated_at
  BEFORE UPDATE ON accountability_partners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_achievement_types_updated_at
  BEFORE UPDATE ON achievement_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

