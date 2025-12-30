-- =====================================================
-- Fix Workout Music URLs
-- =====================================================
-- The correct path is /sounds/ not /music/

UPDATE workout_music
SET 
    file_url = REPLACE(file_url, 'https://media.fitnudge.app/music/', 'https://media.fitnudge.app/sounds/'),
    file_key = REPLACE(file_key, 'music/', 'sounds/'),
    updated_at = NOW()
WHERE file_url LIKE '%media.fitnudge.app/music/%';

-- Verify the update
-- SELECT id, title, file_url, file_key FROM workout_music LIMIT 5;

