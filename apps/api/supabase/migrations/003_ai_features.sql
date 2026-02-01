-- =====================================================
-- FitNudge V2 - AI Features
-- AI conversations, weekly recaps, daily motivations, pattern insights
-- =====================================================

-- =====================================================
-- AI COACH CONVERSATIONS (Premium)
-- =====================================================
-- Stores conversation threads with embedded messages for performance
-- Each user has one active conversation that can be continued
CREATE TABLE ai_coach_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Goal-scoped thread: when set, conversation is locked to this goal (persistent per goal).
  -- NULL = general chat. When goal is deleted, CASCADE removes this conversation.
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  
  -- Conversation metadata
  title TEXT, -- Optional: AI-generated title based on conversation
  
  -- Messages stored as JSONB array for efficient retrieval
  -- Each message: { role: 'user'|'assistant', content: string, created_at: timestamp }
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Token tracking for rate limiting and cost management
  total_tokens_used INTEGER NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  
  -- Soft delete for data retention
  is_archived BOOLEAN NOT NULL DEFAULT FALSE
);

-- Fast lookup by user (most common query)
CREATE INDEX idx_ai_coach_conversations_user_id ON ai_coach_conversations(user_id);

-- Lookup goal-specific thread: one persistent thread per user per goal
CREATE UNIQUE INDEX idx_ai_coach_conversations_user_goal
  ON ai_coach_conversations(user_id, goal_id)
  WHERE goal_id IS NOT NULL AND is_archived = FALSE;

-- Active conversations for a user (exclude archived)
CREATE INDEX idx_ai_coach_conversations_user_active 
  ON ai_coach_conversations(user_id, is_archived) 
  WHERE is_archived = FALSE;

-- Order by recent activity
CREATE INDEX idx_ai_coach_conversations_last_message 
  ON ai_coach_conversations(user_id, last_message_at DESC);

-- =====================================================
-- AI COACH DAILY USAGE (Rate Limiting)
-- =====================================================
-- Track daily usage per user for premium feature enforcement
CREATE TABLE ai_coach_daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  message_count INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  bonus_messages INTEGER NOT NULL DEFAULT 0, -- Extra messages unlocked via rewarded ads
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One record per user per day
  CONSTRAINT ai_coach_daily_usage_user_date_unique UNIQUE (user_id, usage_date)
);

-- Index for fast daily lookup
CREATE INDEX idx_ai_coach_daily_usage_user_date 
  ON ai_coach_daily_usage(user_id, usage_date);

-- =====================================================
-- WEEKLY RECAPS (Premium)
-- =====================================================
CREATE TABLE weekly_recaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Week info
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  
  -- Stats
  goals_hit INTEGER DEFAULT 0,
  goals_total INTEGER DEFAULT 0,
  consistency_percent DECIMAL(5,2),
  
  -- AI-generated content
  summary TEXT,
  win TEXT,
  insight TEXT,
  focus_next_week TEXT,
  motivational_close TEXT,
  
  -- Metadata
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  
  UNIQUE(user_id, week_start)
);

CREATE INDEX idx_weekly_recaps_user ON weekly_recaps(user_id);
CREATE INDEX idx_weekly_recaps_week ON weekly_recaps(user_id, week_start DESC);

-- =====================================================
-- PATTERN INSIGHTS (Premium)
-- =====================================================
CREATE TABLE pattern_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE, -- NULL for cross-goal insights
  
  -- Insight data
  insight_type TEXT NOT NULL CHECK (insight_type IN (
    'best_day', 'worst_day', 'dropout_point',
    'skip_reason_pattern', 'success_pattern', 'time_pattern'
  )),
  insight_text TEXT NOT NULL,
  insight_data JSONB, -- Raw data backing the insight
  
  -- Validity
  valid_from DATE NOT NULL,
  valid_until DATE, -- NULL = still valid
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pattern_insights_user ON pattern_insights(user_id);
CREATE INDEX idx_pattern_insights_goal ON pattern_insights(goal_id);

-- =====================================================
-- DAILY MOTIVATIONS (Free feature)
-- =====================================================
CREATE TABLE daily_motivations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  background_style TEXT DEFAULT 'gradient_sunset',
  background_colors TEXT[], -- Gradient colors array for the card
  date DATE NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  share_count INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ, -- When the push notification was sent
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_motivations_user_id ON daily_motivations(user_id);
CREATE INDEX idx_daily_motivations_date ON daily_motivations(date DESC);
CREATE INDEX idx_daily_motivations_user_date ON daily_motivations(user_id, date DESC);

-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE TRIGGER update_ai_coach_conversations_updated_at
  BEFORE UPDATE ON ai_coach_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_coach_daily_usage_updated_at
  BEFORE UPDATE ON ai_coach_daily_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE ai_coach_conversations IS 'Stores AI Coach chat conversations with embedded message history. goal_id: when set, thread is locked to that goal (persistent per goal); NULL = general chat.';
COMMENT ON TABLE ai_coach_daily_usage IS 'Tracks daily AI Coach usage for rate limiting';

