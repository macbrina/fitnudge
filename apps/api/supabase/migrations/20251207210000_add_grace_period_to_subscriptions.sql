-- =====================================================
-- ADD GRACE PERIOD SUPPORT TO SUBSCRIPTIONS
-- =====================================================
-- This migration adds grace period tracking for billing issues.
-- When a payment fails, Apple/Google give users a grace period (up to 16 days)
-- during which payment is retried and the user retains access.

-- First, add missing values to subscription_status enum
-- 'billing_issue' - Payment failed, user may be in grace period
-- 'transferred' - Subscription transferred to another user
-- Note: ADD VALUE cannot be used in a transaction with other statements that use the new value
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'billing_issue';
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'transferred';

-- Add grace_period_ends_at column to subscriptions table
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMP WITH TIME ZONE;

-- Add revenuecat_event_id column to track the last RevenueCat event
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS revenuecat_event_id TEXT;

-- Add environment column to track sandbox vs production
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS environment TEXT CHECK (environment IN ('SANDBOX', 'PRODUCTION'));

-- Create index for efficient grace period queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_grace_period 
ON subscriptions(grace_period_ends_at) 
WHERE grace_period_ends_at IS NOT NULL;

-- Note: Index on billing_issue status will be created in a separate migration
-- because PostgreSQL doesn't allow using newly added enum values in the same transaction

-- Add comment explaining grace period
COMMENT ON COLUMN subscriptions.grace_period_ends_at IS 
'End date of grace period during billing issues. User retains access until this date. Apple: 16 days, Google: configurable 3-30 days.';

COMMENT ON COLUMN subscriptions.revenuecat_event_id IS 
'The ID of the last RevenueCat webhook event processed for this subscription.';

COMMENT ON COLUMN subscriptions.environment IS 
'Whether this subscription is from SANDBOX (testing) or PRODUCTION.';
