-- =====================================================
-- Add Country to Users and Biological Sex to Fitness Profiles
-- For better AI-powered meal suggestions and calorie calculations
-- =====================================================

-- Add country column to users table (auto-detected during signup like timezone)
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS country TEXT;

COMMENT ON COLUMN users.country IS 'ISO 3166-1 alpha-2 country code (e.g., US, NG, GB). Auto-detected during signup for localized meal suggestions.';

-- Create index for country-based queries (e.g., analytics, localized content)
CREATE INDEX IF NOT EXISTS idx_users_country ON users(country);

-- Add biological_sex column to user_fitness_profiles for accurate calorie/nutrition calculations
ALTER TABLE user_fitness_profiles 
  ADD COLUMN IF NOT EXISTS biological_sex TEXT 
    CHECK (biological_sex IN ('male', 'female', 'prefer_not_to_say'));

COMMENT ON COLUMN user_fitness_profiles.biological_sex IS 
  'Biological sex for accurate calorie/nutrition calculations. Used by AI to personalize meal plans and calorie targets.';

-- Create index for biological_sex (useful for aggregate analytics)
CREATE INDEX IF NOT EXISTS idx_user_fitness_profiles_biological_sex ON user_fitness_profiles(biological_sex);

