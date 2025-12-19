-- =====================================================
-- WEBHOOK EVENTS TABLE FOR IDEMPOTENCY
-- =====================================================
--
-- This table tracks all webhook events to:
-- 1. Prevent duplicate processing (idempotency)
-- 2. Enable retry/debugging of failed events
-- 3. Audit trail of all subscription changes
--
-- =====================================================

-- Create webhook_events table
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE NOT NULL,  -- RevenueCat event ID
    event_type TEXT NOT NULL,       -- INITIAL_PURCHASE, RENEWAL, etc.
    user_id TEXT,                   -- App user ID
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    payload JSONB,                  -- Full webhook payload for debugging
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_user_id ON webhook_events(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at DESC);

-- Index for finding failed events that need retry
CREATE INDEX IF NOT EXISTS idx_webhook_events_failed_retry 
ON webhook_events(status, retry_count, created_at) 
WHERE status = 'failed' AND retry_count < 5;

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_webhook_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_webhook_events_updated_at ON webhook_events;
CREATE TRIGGER trigger_update_webhook_events_updated_at
    BEFORE UPDATE ON webhook_events
    FOR EACH ROW
    EXECUTE FUNCTION update_webhook_events_updated_at();


-- =====================================================
-- SUBSCRIPTION DEACTIVATION LOGS TABLE
-- =====================================================
--
-- Track all deactivations when subscriptions expire
-- Useful for support and debugging
--

CREATE TABLE IF NOT EXISTS subscription_deactivation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    previous_plan TEXT NOT NULL,
    new_plan TEXT NOT NULL DEFAULT 'free',
    goals_deactivated INTEGER DEFAULT 0,
    challenges_cancelled INTEGER DEFAULT 0,
    group_goals_left INTEGER DEFAULT 0,
    deactivation_reason TEXT NOT NULL CHECK (deactivation_reason IN ('subscription_expired', 'billing_issue', 'manual', 'transfer')),
    deactivated_goal_ids JSONB,     -- Array of goal IDs that were deactivated
    cancelled_challenge_ids JSONB,   -- Array of challenge IDs that were cancelled
    left_group_goal_ids JSONB,       -- Array of group goal IDs user left
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_deactivation_logs_user_id ON subscription_deactivation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_deactivation_logs_created_at ON subscription_deactivation_logs(created_at DESC);

-- Add comment
COMMENT ON TABLE subscription_deactivation_logs IS 
'Tracks all subscription-related deactivations for auditing and support.
When a subscription expires, this logs:
- How many goals were deactivated
- Which challenges were cancelled (if user was creator)
- Which group goals the user left';


-- =====================================================
-- ADD left_reason COLUMN TO group_goals TABLE
-- =====================================================

ALTER TABLE group_goals 
ADD COLUMN IF NOT EXISTS left_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE group_goals 
ADD COLUMN IF NOT EXISTS left_reason TEXT;

COMMENT ON COLUMN group_goals.left_at IS 'When user left the group goal';
COMMENT ON COLUMN group_goals.left_reason IS 'Reason for leaving: subscription_expired, user_left, kicked, etc.';


-- =====================================================
-- ADD cancelled_reason COLUMN TO challenges TABLE
-- =====================================================

ALTER TABLE challenges 
ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

ALTER TABLE challenges 
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN challenges.cancelled_reason IS 'Reason for cancellation: creator_subscription_expired, insufficient_participants, user_cancelled, etc.';
COMMENT ON COLUMN challenges.cancelled_at IS 'When the challenge was cancelled';


-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Only service role can access webhook_events (backend only)
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access webhook_events" ON webhook_events
    FOR ALL USING (auth.role() = 'service_role');

-- Users can view their own deactivation logs
ALTER TABLE subscription_deactivation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own deactivation logs" ON subscription_deactivation_logs
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage deactivation logs" ON subscription_deactivation_logs
    FOR ALL USING (auth.role() = 'service_role');
