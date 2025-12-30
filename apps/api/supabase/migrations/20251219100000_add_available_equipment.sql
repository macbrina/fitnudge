-- =====================================================
-- Add Available Equipment to User Fitness Profiles
-- Allows users to specify what equipment they have access to
-- Used to filter exercises appropriately for home/mix workouts
-- =====================================================

-- Add available_equipment column as TEXT array
-- Logically follows preferred_location in the onboarding flow
-- Default to empty array (will be interpreted as "body weight only")
-- Note: PostgreSQL does not support AFTER clause; column is added at table end
ALTER TABLE user_fitness_profiles
ADD COLUMN IF NOT EXISTS available_equipment TEXT[] DEFAULT '{}';

-- Add comment explaining the column
COMMENT ON COLUMN user_fitness_profiles.available_equipment IS 
'Array of equipment user has access to. Options: none, resistance_band, dumbbell, kettlebell, pull_up_bar, yoga_mat, barbell, bench, cable_machine. Empty array means body weight only.';

-- Create index for equipment filtering queries
CREATE INDEX IF NOT EXISTS idx_user_fitness_profiles_equipment 
ON user_fitness_profiles USING GIN(available_equipment);

