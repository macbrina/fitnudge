-- Migration: Add tracking_type to goals and challenges
-- This field determines the UI/UX for how users complete their check-ins:
-- - 'workout': User completes via workout player
-- - 'meal': User completes by logging meals
-- - 'hydration': User completes by logging water intake (target-based)
-- - 'checkin': User completes via manual check-in modal (default)

-- Add tracking_type to goals table
ALTER TABLE goals 
  ADD COLUMN IF NOT EXISTS tracking_type TEXT DEFAULT 'checkin';

-- Add check constraint for valid values
ALTER TABLE goals 
  ADD CONSTRAINT goals_tracking_type_check 
  CHECK (tracking_type IN ('workout', 'meal', 'hydration', 'checkin'));

-- Add tracking_type to challenges table
ALTER TABLE challenges 
  ADD COLUMN IF NOT EXISTS tracking_type TEXT DEFAULT 'checkin';

-- Add check constraint for valid values
ALTER TABLE challenges 
  ADD CONSTRAINT challenges_tracking_type_check 
  CHECK (tracking_type IN ('workout', 'meal', 'hydration', 'checkin'));

-- Set existing fitness goals to 'workout' tracking type
UPDATE goals 
SET tracking_type = 'workout' 
WHERE category = 'fitness' AND tracking_type = 'checkin';

-- Set existing fitness challenges to 'workout' tracking type
UPDATE challenges 
SET tracking_type = 'workout' 
WHERE category = 'fitness' AND tracking_type = 'checkin';

-- Add comment explaining the field
COMMENT ON COLUMN goals.tracking_type IS 'Determines check-in UI: workout (workout player), meal (meal logging), hydration (water tracking), checkin (manual modal)';
COMMENT ON COLUMN challenges.tracking_type IS 'Determines check-in UI: workout (workout player), meal (meal logging), hydration (water tracking), checkin (manual modal)';

