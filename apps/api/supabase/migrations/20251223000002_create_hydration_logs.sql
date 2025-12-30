-- Migration: Create hydration_logs table for water intake tracking

CREATE TABLE IF NOT EXISTS public.hydration_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  goal_id UUID NULL,
  challenge_id UUID NULL,
  amount_ml INTEGER NOT NULL,  -- Amount in milliliters (1 glass ≈ 237ml)
  logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NULL DEFAULT now(),
  
  CONSTRAINT hydration_logs_pkey PRIMARY KEY (id),
  CONSTRAINT hydration_logs_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT hydration_logs_goal_id_fkey FOREIGN KEY (goal_id) 
    REFERENCES goals(id) ON DELETE SET NULL,
  CONSTRAINT hydration_logs_challenge_id_fkey FOREIGN KEY (challenge_id) 
    REFERENCES challenges(id) ON DELETE SET NULL,
  CONSTRAINT hydration_logs_amount_positive CHECK (amount_ml > 0)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_hydration_logs_user_id 
  ON hydration_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_hydration_logs_user_date 
  ON hydration_logs(user_id, logged_date DESC);

CREATE INDEX IF NOT EXISTS idx_hydration_logs_goal_id 
  ON hydration_logs(goal_id);

CREATE INDEX IF NOT EXISTS idx_hydration_logs_challenge_id 
  ON hydration_logs(challenge_id);

CREATE INDEX IF NOT EXISTS idx_hydration_logs_logged_date 
  ON hydration_logs(logged_date DESC);

-- Composite index for goal/challenge + date queries
CREATE INDEX IF NOT EXISTS idx_hydration_logs_goal_date 
  ON hydration_logs(goal_id, logged_date DESC);

CREATE INDEX IF NOT EXISTS idx_hydration_logs_challenge_date 
  ON hydration_logs(challenge_id, logged_date DESC);

-- Add RLS policies
ALTER TABLE hydration_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own hydration logs
CREATE POLICY hydration_logs_select_own ON hydration_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can only insert their own hydration logs
CREATE POLICY hydration_logs_insert_own ON hydration_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can only update their own hydration logs
CREATE POLICY hydration_logs_update_own ON hydration_logs
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can only delete their own hydration logs
CREATE POLICY hydration_logs_delete_own ON hydration_logs
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Add comments
COMMENT ON TABLE hydration_logs IS 'Tracks water intake for hydration goals/challenges';
COMMENT ON COLUMN hydration_logs.amount_ml IS 'Amount of water in milliliters. Common presets: 237ml (1 glass), 500ml (bottle), 750ml (large bottle)';

-- Add hydration settings to user profiles (optional - for daily target and unit preference)
ALTER TABLE user_fitness_profiles 
  ADD COLUMN IF NOT EXISTS hydration_unit TEXT DEFAULT 'ml' 
    CHECK (hydration_unit IN ('ml', 'oz')),
  ADD COLUMN IF NOT EXISTS hydration_daily_target_ml INTEGER DEFAULT 2000;

COMMENT ON COLUMN user_fitness_profiles.hydration_unit IS 'User preference for hydration display: ml (milliliters) or oz (fluid ounces)';
COMMENT ON COLUMN user_fitness_profiles.hydration_daily_target_ml IS 'Daily water intake target in milliliters (default 2000ml ≈ 8 glasses)';

