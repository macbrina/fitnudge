-- =====================================================
-- DROP IAP_RECEIPTS TABLE
-- =====================================================
-- This table was used for manual IAP receipt verification.
-- Since we now use RevenueCat for all IAP handling, this table is no longer needed.
-- RevenueCat handles:
-- - Receipt validation
-- - Subscription status tracking
-- - Webhook notifications
-- - Cross-platform subscription management
-- =====================================================

-- Drop policies first
DROP POLICY IF EXISTS "Users can view own receipts" ON iap_receipts;
DROP POLICY IF EXISTS "Users can create receipts" ON iap_receipts;

-- Drop indexes
DROP INDEX IF EXISTS idx_iap_receipts_user_id;
DROP INDEX IF EXISTS idx_iap_receipts_transaction_id;

-- Drop the table
DROP TABLE IF EXISTS iap_receipts;

-- Add comment to document why this was removed
COMMENT ON TABLE subscriptions IS 
'User subscription records. 
Managed primarily via RevenueCat webhooks.
IAP receipts are no longer stored locally - RevenueCat handles all validation.';
