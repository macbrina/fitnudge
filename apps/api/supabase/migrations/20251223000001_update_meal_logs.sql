-- Migration: Update meal_logs table for challenge support and AI health rating

-- Add challenge_id column to support meal logging for challenges
ALTER TABLE meal_logs 
  ADD COLUMN IF NOT EXISTS challenge_id UUID NULL 
  REFERENCES challenges(id) ON DELETE SET NULL;

-- Add health_rating column (AI-determined based on meal description)
ALTER TABLE meal_logs 
  ADD COLUMN IF NOT EXISTS health_rating TEXT NULL;

-- Add check constraint for health_rating values
ALTER TABLE meal_logs 
  ADD CONSTRAINT meal_logs_health_rating_check 
  CHECK (health_rating IS NULL OR health_rating IN ('healthy', 'okay', 'unhealthy'));

-- Add index for challenge_id lookups
CREATE INDEX IF NOT EXISTS idx_meal_logs_challenge_id 
  ON meal_logs(challenge_id);

-- Add composite index for challenge + date lookups
CREATE INDEX IF NOT EXISTS idx_meal_logs_challenge_date 
  ON meal_logs(challenge_id, logged_date DESC);

-- Add comment explaining health_rating
COMMENT ON COLUMN meal_logs.health_rating IS 'AI-determined health rating: healthy, okay, or unhealthy based on meal description';
COMMENT ON COLUMN meal_logs.challenge_id IS 'Optional link to a challenge for meal tracking challenges';

