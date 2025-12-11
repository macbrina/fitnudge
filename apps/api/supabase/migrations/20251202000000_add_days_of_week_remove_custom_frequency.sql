-- =====================================================
-- Add days_of_week to goals and remove 'custom' and 'monthly' from frequency enum
-- =====================================================

-- Step 1: Add days_of_week column to goals table
ALTER TABLE goals ADD COLUMN IF NOT EXISTS days_of_week INTEGER[];

-- Add comment for documentation
COMMENT ON COLUMN goals.days_of_week IS 'Array of day numbers (0-6) for weekly goals. 0=Sunday, 1=Monday, ..., 6=Saturday. NULL for daily goals.';

-- Step 2: Handle any existing goals with 'custom' or 'monthly' frequency
-- Convert 'custom' and 'monthly' to 'weekly' as a safe default
UPDATE goals 
SET frequency = 'weekly' 
WHERE frequency = 'custom' OR frequency = 'monthly';

-- Step 2b: Handle any existing goal_templates with 'custom' or 'monthly' frequency
-- Convert 'custom' and 'monthly' to 'weekly' as a safe default
UPDATE goal_templates 
SET frequency = 'weekly' 
WHERE frequency = 'custom' OR frequency = 'monthly';

-- Step 3: Create new enum without 'custom' and 'monthly'
CREATE TYPE goal_frequency_new AS ENUM ('daily', 'weekly');

-- Step 4: Alter the goals table to use the new enum
ALTER TABLE goals 
  ALTER COLUMN frequency TYPE goal_frequency_new 
  USING frequency::text::goal_frequency_new;

-- Step 4b: Alter the goal_templates table to use the new enum
ALTER TABLE goal_templates 
  ALTER COLUMN frequency TYPE goal_frequency_new 
  USING frequency::text::goal_frequency_new;

-- Step 5: Drop the old enum and rename the new one
DROP TYPE goal_frequency;
ALTER TYPE goal_frequency_new RENAME TO goal_frequency;

-- Step 6: Create index for days_of_week queries
CREATE INDEX IF NOT EXISTS idx_goals_days_of_week ON goals USING GIN(days_of_week) WHERE days_of_week IS NOT NULL;

