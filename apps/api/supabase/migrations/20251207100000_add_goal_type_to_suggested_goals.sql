-- Add goal_type column to suggested_goals table
-- This stores the type of goals the user requested (habit, time_challenge, target_challenge, mixed)
-- so retries use the correct type

-- Add goal_type column with default 'habit' for existing records
ALTER TABLE suggested_goals 
ADD COLUMN IF NOT EXISTS goal_type TEXT NOT NULL DEFAULT 'habit'
CHECK (goal_type IN ('habit', 'time_challenge', 'target_challenge', 'mixed'));

-- Add regeneration_count column if not exists (used for tracking generation limits)
ALTER TABLE suggested_goals 
ADD COLUMN IF NOT EXISTS regeneration_count INTEGER NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN suggested_goals.goal_type IS 'Type of goals requested: habit (ongoing), time_challenge (duration-based), target_challenge (count-based), or mixed';
COMMENT ON COLUMN suggested_goals.regeneration_count IS 'Number of times suggestions have been generated for this user';
