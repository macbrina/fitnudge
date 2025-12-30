-- =====================================================
-- ADD BADGE ICON COLUMN TO ACHIEVEMENT TYPES
-- Stores Cloudflare R2 CDN URL to badge image
-- =====================================================

-- Add badge_icon column to store CDN URL
ALTER TABLE achievement_types
ADD COLUMN IF NOT EXISTS badge_icon TEXT;

-- Add comment for documentation
COMMENT ON COLUMN achievement_types.badge_icon IS 'Cloudflare R2 CDN URL to badge icon image (PNG from Flaticon)';

-- Set CDN URLs for all existing achievements
-- Format: https://media.fitnudge.app/badges/{badge_key}.png
-- The frontend will fallback to Ionicons if image fails to load

UPDATE achievement_types 
SET badge_icon = CONCAT('https://media.fitnudge.app/badges/', badge_key, '.png')
WHERE badge_icon IS NULL;

