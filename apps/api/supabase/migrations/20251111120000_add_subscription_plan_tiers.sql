-- =====================================================
-- ADD PLAN TIERS AND FEATURE MINIMUM TIERS
-- =====================================================

-- Add tier column to subscription_plans to define hierarchy (higher number = higher tier)
ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS tier INTEGER DEFAULT 0;

-- Populate tier values for existing plans
UPDATE subscription_plans
SET tier = CASE id
  WHEN 'free' THEN 0
  WHEN 'starter' THEN 1
  WHEN 'pro' THEN 2
  WHEN 'coach_plus' THEN 3
  ELSE COALESCE(tier, 0)
END;

-- Ensure tier column is not null going forward
ALTER TABLE subscription_plans
ALTER COLUMN tier SET NOT NULL,
ALTER COLUMN tier SET DEFAULT 0;

-- Add minimum_tier column to plan_features so features can be unlocked at a specific tier
ALTER TABLE plan_features
ADD COLUMN IF NOT EXISTS minimum_tier INTEGER DEFAULT 0;

-- Backfill minimum_tier based on the associated plan's tier
UPDATE plan_features pf
SET minimum_tier = sp.tier
FROM subscription_plans sp
WHERE pf.plan_id = sp.id;

-- Ensure minimum_tier column is not null
ALTER TABLE plan_features
ALTER COLUMN minimum_tier SET NOT NULL,
ALTER COLUMN minimum_tier SET DEFAULT 0;

-- Optional index to speed up lookups by minimum tier
CREATE INDEX IF NOT EXISTS idx_plan_features_minimum_tier
  ON plan_features (minimum_tier);

