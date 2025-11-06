-- =====================================================
-- SUBSCRIPTION EXIT OFFER FIELDS
-- =====================================================

-- Add exit-offer columns to subscription_plans
ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS exit_offer_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS exit_offer_monthly_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS exit_offer_annual_price DECIMAL(10,2);

-- Seed exit-offer pricing (50% off current annual list prices)
UPDATE subscription_plans
SET exit_offer_enabled = true,
    exit_offer_annual_price = 14.99
WHERE id = 'starter';

UPDATE subscription_plans
SET exit_offer_enabled = true,
    exit_offer_annual_price = 24.99
WHERE id = 'pro';

UPDATE subscription_plans
SET exit_offer_enabled = true,
    exit_offer_annual_price = 49.99
WHERE id = 'coach_plus';

-- Note: Free plan has no exit offer


