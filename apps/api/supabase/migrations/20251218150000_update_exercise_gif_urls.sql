-- =====================================================
-- Update Exercise GIF URLs to Cloudflare R2
-- Migrates from self-hosted static files to CDN
-- =====================================================

-- Update all exercise GIF URLs to use Cloudflare CDN
UPDATE exercises
SET 
    gif_url_180 = 'https://media.fitnudge.app/exercises/180/' || id || '.gif',
    gif_url_360 = 'https://media.fitnudge.app/exercises/360/' || id || '.gif',
    updated_at = NOW();

-- Add comment documenting the change
COMMENT ON COLUMN exercises.gif_url_180 IS 'Thumbnail GIF (180x180px) hosted on Cloudflare R2 CDN';
COMMENT ON COLUMN exercises.gif_url_360 IS 'Mobile GIF (360x360px) hosted on Cloudflare R2 CDN';

