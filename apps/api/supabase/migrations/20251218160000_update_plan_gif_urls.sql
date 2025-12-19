-- =====================================================
-- Update GIF URLs in Existing Actionable Plans
-- Migrates embedded URLs from static to Cloudflare CDN
-- =====================================================

-- The exercises table has been updated to use Cloudflare CDN URLs,
-- but existing plans still have old /static/ URLs embedded in their
-- structured_data JSON. This migration updates all those URLs.

-- Update GIF URLs in actionable_plans.structured_data JSONB
-- This uses text replacement since the URLs are nested in various
-- places within the JSON structure (warm_up, cool_down, main_workout, etc.)

UPDATE actionable_plans
SET 
    structured_data = REPLACE(
        REPLACE(
            structured_data::text,
            '/static/exercises/360/',
            'https://media.fitnudge.app/exercises/360/'
        ),
        '/static/exercises/180/',
        'https://media.fitnudge.app/exercises/180/'
    )::jsonb,
    updated_at = NOW()
WHERE structured_data::text LIKE '%/static/exercises/%';

-- Log how many plans were updated
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % actionable plans with new CDN URLs', updated_count;
END $$;

