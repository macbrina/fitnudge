-- =====================================================
-- Migration: Fix reminder_times column type
-- =====================================================
-- The reminder_times column was defined as TIME[] which causes PostgreSQL
-- to normalize "18:00" to "18:00:00". Since we only need HH:MM format
-- and do string comparisons, TEXT[] is more appropriate.
-- =====================================================

-- Step 1: Add a temporary TEXT[] column
ALTER TABLE goals ADD COLUMN reminder_times_new TEXT[];

-- Step 2: Copy and convert data (TIME to TEXT with HH:MM format)
UPDATE goals 
SET reminder_times_new = (
  SELECT array_agg(to_char(t, 'HH24:MI'))
  FROM unnest(reminder_times) AS t
)
WHERE reminder_times IS NOT NULL;

-- Step 3: Drop the old column
ALTER TABLE goals DROP COLUMN reminder_times;

-- Step 4: Rename the new column
ALTER TABLE goals RENAME COLUMN reminder_times_new TO reminder_times;

-- Step 5: Set NOT NULL and default
ALTER TABLE goals 
ALTER COLUMN reminder_times SET NOT NULL,
ALTER COLUMN reminder_times SET DEFAULT ARRAY['18:00']::TEXT[];
