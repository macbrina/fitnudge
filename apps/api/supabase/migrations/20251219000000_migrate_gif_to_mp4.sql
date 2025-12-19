-- =====================================================
-- MIGRATE GIF TO MP4 VIDEO
-- Cloudflare CDN now hosts MP4 videos instead of GIFs
-- =====================================================

-- Step 1: Rename gif_url_360 to mp4_url (if column exists)
DO $$
BEGIN
    -- Check if gif_url_360 exists and mp4_url doesn't
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exercises' AND column_name = 'gif_url_360'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exercises' AND column_name = 'mp4_url'
    ) THEN
        ALTER TABLE exercises RENAME COLUMN gif_url_360 TO mp4_url;
        RAISE NOTICE 'Renamed gif_url_360 to mp4_url';
    ELSE
        RAISE NOTICE 'Column already renamed or does not exist';
    END IF;
END $$;

-- Step 2: Drop gif_url_180 column (if exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exercises' AND column_name = 'gif_url_180'
    ) THEN
        ALTER TABLE exercises DROP COLUMN gif_url_180;
        RAISE NOTICE 'Dropped gif_url_180 column';
    ELSE
        RAISE NOTICE 'gif_url_180 column does not exist';
    END IF;
END $$;

-- Step 3: Update all mp4_url extensions from .gif to .mp4
UPDATE exercises
SET mp4_url = REPLACE(mp4_url, '.gif', '.mp4')
WHERE mp4_url LIKE '%.gif';

-- Step 4: Update existing actionable_plans structured_data 
-- Change all embedded gif URLs to mp4
UPDATE actionable_plans
SET 
    structured_data = REPLACE(
        REPLACE(
            REPLACE(
                structured_data::text,
                '.gif"',
                '.mp4"'
            ),
            'gif_url',
            'mp4_url'
        ),
        'gif_url_thumb',
        'mp4_url_thumb'
    )::jsonb,
    updated_at = NOW()
WHERE structured_data::text LIKE '%gif%';

-- Step 5: Update column comment
COMMENT ON COLUMN exercises.mp4_url IS 'MP4 video URL (Cloudflare R2 CDN) for exercise demonstration - 360px resolution';

-- Confirm migration
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exercises' AND column_name = 'mp4_url'
    ) THEN
        RAISE NOTICE '✅ Migration complete: exercises table now uses mp4_url';
    END IF;
END $$;

