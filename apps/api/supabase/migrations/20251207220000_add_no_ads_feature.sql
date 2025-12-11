-- =====================================================
-- ADD NO ADS FEATURE TO PLAN FEATURES
-- =====================================================
-- This migration adds the "no_ads" feature for Starter tier and above.
-- Free tier users (tier 0) will see ads, paid users (tier 1+) won't.
-- minimum_tier = 1 (Starter) means Starter, Pro, and Coach+ all get this feature.

INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, minimum_tier, sort_order)
VALUES (
  'starter',
  'no_ads',
  'No Ads',
  'Ad-free experience without interruptions',
  null,
  true,
  1,  -- minimum_tier: Starter (1) and above
  10
)
ON CONFLICT (plan_id, feature_key) DO UPDATE SET
  feature_name = EXCLUDED.feature_name,
  feature_description = EXCLUDED.feature_description,
  is_enabled = EXCLUDED.is_enabled,
  minimum_tier = EXCLUDED.minimum_tier;
