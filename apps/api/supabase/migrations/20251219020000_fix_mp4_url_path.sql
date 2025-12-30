-- Migration: Fix MP4 URL path
-- The correct path is https://media.fitnudge.app/exercises/ not https://media.fitnudge.app/exercises/360/

-- Update exercises table mp4_url column to use correct path
UPDATE exercises
SET mp4_url = REPLACE(mp4_url, 'https://media.fitnudge.app/exercises/360/', 'https://media.fitnudge.app/exercises/')
WHERE mp4_url LIKE '%https://media.fitnudge.app/exercises/360/%';

-- Also fix any plans that have the old URL embedded in structured_data
UPDATE actionable_plans
SET
    structured_data = REPLACE(
        structured_data::text,
        'https://media.fitnudge.app/exercises/360/',
        'https://media.fitnudge.app/exercises/'
    )::jsonb,
    updated_at = NOW()
WHERE structured_data::text LIKE '%https://media.fitnudge.app/exercises/360/%';

-- Also fix any 180 paths if they exist
UPDATE exercises
SET mp4_url = REPLACE(mp4_url, 'https://media.fitnudge.app/exercises/180/', 'https://media.fitnudge.app/exercises/')
WHERE mp4_url LIKE '%https://media.fitnudge.app/exercises/180/%';

UPDATE actionable_plans
SET
    structured_data = REPLACE(
        structured_data::text,
        'https://media.fitnudge.app/exercises/180/',
        'https://media.fitnudge.app/exercises/'
    )::jsonb,
    updated_at = NOW()
WHERE structured_data::text LIKE '%https://media.fitnudge.app/exercises/180/%';

