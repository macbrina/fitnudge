-- =====================================================
-- ADD INDEX FOR BILLING ISSUE SUBSCRIPTIONS
-- =====================================================
-- This migration creates an index on billing_issue status.
-- Must run separately from the enum value addition due to PostgreSQL limitations.

-- Create index for billing issue subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_billing_issue 
ON subscriptions(status) 
WHERE status = 'billing_issue';
