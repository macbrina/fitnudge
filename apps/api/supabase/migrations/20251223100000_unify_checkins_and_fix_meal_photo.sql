-- Migration: Unify check_ins table with challenge_check_ins structure
-- and change photo_urls to photo_url in meal_logs

-- =====================================================
-- PART 1: Fix meal_logs table - change photo_urls to photo_url
-- =====================================================

-- Add new photo_url column (single photo)
ALTER TABLE public.meal_logs
ADD COLUMN IF NOT EXISTS photo_url TEXT NULL;

-- Migrate first photo from array to single column (if any)
UPDATE public.meal_logs
SET photo_url = photo_urls[1]
WHERE photo_urls IS NOT NULL AND array_length(photo_urls, 1) > 0;

-- Drop the old photo_urls array column
ALTER TABLE public.meal_logs
DROP COLUMN IF EXISTS photo_urls;

-- =====================================================
-- PART 2: Unify check_ins table with challenge_check_ins structure
-- =====================================================

-- Step 0: Drop the materialized view that depends on check_ins columns
-- It will be recreated in a separate migration after column changes
DROP MATERIALIZED VIEW IF EXISTS analytics.user_engagement_summary CASCADE;

-- Step 1: Add new columns to match challenge_check_ins
ALTER TABLE public.check_ins
ADD COLUMN IF NOT EXISTS notes TEXT NULL,
ADD COLUMN IF NOT EXISTS photo_url TEXT NULL,
ADD COLUMN IF NOT EXISTS check_in_date DATE NULL;

-- Step 2: Migrate existing data
-- Copy reflection to notes
UPDATE public.check_ins
SET notes = reflection
WHERE reflection IS NOT NULL;

-- Copy first photo from photo_urls to photo_url
UPDATE public.check_ins
SET photo_url = photo_urls[1]
WHERE photo_urls IS NOT NULL AND array_length(photo_urls, 1) > 0;

-- Copy date to check_in_date
UPDATE public.check_ins
SET check_in_date = date;

-- Step 3: Add temporary text mood column
ALTER TABLE public.check_ins
ADD COLUMN IF NOT EXISTS mood_text TEXT NULL;

-- Convert integer mood (1-5) to text mood ('terrible', 'bad', 'okay', 'good', 'great')
UPDATE public.check_ins
SET mood_text = CASE 
    WHEN mood = 1 THEN 'terrible'
    WHEN mood = 2 THEN 'bad'
    WHEN mood = 3 THEN 'okay'
    WHEN mood = 4 THEN 'good'
    WHEN mood = 5 THEN 'great'
    ELSE NULL
END
WHERE mood IS NOT NULL;

-- Step 4: Drop old columns and constraints
ALTER TABLE public.check_ins
DROP CONSTRAINT IF EXISTS check_ins_mood_check;

ALTER TABLE public.check_ins
DROP COLUMN IF EXISTS reflection,
DROP COLUMN IF EXISTS mood,
DROP COLUMN IF EXISTS photo_urls,
DROP COLUMN IF EXISTS date;

-- Step 5: Rename mood_text to mood
ALTER TABLE public.check_ins
RENAME COLUMN mood_text TO mood;

-- Step 6: Make check_in_date NOT NULL with proper constraint
ALTER TABLE public.check_ins
ALTER COLUMN check_in_date SET NOT NULL,
ALTER COLUMN check_in_date SET DEFAULT CURRENT_DATE;

-- Step 7: Add mood check constraint (same as challenge_check_ins)
ALTER TABLE public.check_ins
ADD CONSTRAINT check_ins_mood_check CHECK (
    mood IS NULL OR mood = ANY(ARRAY['great', 'good', 'okay', 'bad', 'terrible'])
);

-- Step 8: Update completed column to have default false (match challenge_check_ins)
ALTER TABLE public.check_ins
ALTER COLUMN completed SET DEFAULT false,
ALTER COLUMN completed DROP NOT NULL;

-- Step 9: Update unique constraint to use check_in_date
-- First drop the old constraint
ALTER TABLE public.check_ins
DROP CONSTRAINT IF EXISTS check_ins_user_goal_date_unique;

-- Add new constraint with check_in_date
ALTER TABLE public.check_ins
ADD CONSTRAINT check_ins_user_goal_check_in_date_unique 
UNIQUE (user_id, goal_id, check_in_date);

-- Step 10: Update indexes
DROP INDEX IF EXISTS idx_check_ins_date;
DROP INDEX IF EXISTS idx_check_ins_has_photos;

CREATE INDEX IF NOT EXISTS idx_check_ins_check_in_date 
ON public.check_ins USING btree (check_in_date);

CREATE INDEX IF NOT EXISTS idx_check_ins_pending 
ON public.check_ins USING btree (user_id, check_in_date, is_checked_in)
WHERE is_checked_in = false;

-- Add comments
COMMENT ON COLUMN public.check_ins.notes IS 'User notes about the check-in';
COMMENT ON COLUMN public.check_ins.mood IS 'User mood: great, good, okay, bad, terrible';
COMMENT ON COLUMN public.check_ins.photo_url IS 'Optional photo URL for check-in';
COMMENT ON COLUMN public.check_ins.check_in_date IS 'Date of the check-in';
COMMENT ON COLUMN public.meal_logs.photo_url IS 'Optional photo URL of the meal';

