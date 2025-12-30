-- =====================================================
-- Fix ON DELETE CASCADE for Summary and Log Tables
-- =====================================================
-- Migration: 20251226000000_fix_delete_cascade_references.sql
-- Purpose: Change ON DELETE SET NULL to ON DELETE CASCADE
--          for tables where orphaned data is meaningless
-- =====================================================

-- =====================================================
-- PART 1: Fix daily_nutrition_summaries
-- =====================================================

ALTER TABLE daily_nutrition_summaries 
DROP CONSTRAINT IF EXISTS daily_nutrition_summaries_goal_id_fkey;

ALTER TABLE daily_nutrition_summaries
ADD CONSTRAINT daily_nutrition_summaries_goal_id_fkey 
FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE;

ALTER TABLE daily_nutrition_summaries 
DROP CONSTRAINT IF EXISTS daily_nutrition_summaries_challenge_id_fkey;

ALTER TABLE daily_nutrition_summaries
ADD CONSTRAINT daily_nutrition_summaries_challenge_id_fkey 
FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE;

-- =====================================================
-- PART 2: Fix daily_hydration_summaries
-- =====================================================

ALTER TABLE daily_hydration_summaries 
DROP CONSTRAINT IF EXISTS daily_hydration_summaries_goal_id_fkey;

ALTER TABLE daily_hydration_summaries
ADD CONSTRAINT daily_hydration_summaries_goal_id_fkey 
FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE;

ALTER TABLE daily_hydration_summaries 
DROP CONSTRAINT IF EXISTS daily_hydration_summaries_challenge_id_fkey;

ALTER TABLE daily_hydration_summaries
ADD CONSTRAINT daily_hydration_summaries_challenge_id_fkey 
FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE;

-- =====================================================
-- PART 3: Fix daily_checkin_summaries
-- =====================================================

ALTER TABLE daily_checkin_summaries 
DROP CONSTRAINT IF EXISTS daily_checkin_summaries_goal_id_fkey;

ALTER TABLE daily_checkin_summaries
ADD CONSTRAINT daily_checkin_summaries_goal_id_fkey 
FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE;

-- =====================================================
-- PART 4: Fix daily_workout_summaries
-- =====================================================

ALTER TABLE daily_workout_summaries 
DROP CONSTRAINT IF EXISTS daily_workout_summaries_goal_id_fkey;

ALTER TABLE daily_workout_summaries
ADD CONSTRAINT daily_workout_summaries_goal_id_fkey 
FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE;

ALTER TABLE daily_workout_summaries 
DROP CONSTRAINT IF EXISTS daily_workout_summaries_challenge_id_fkey;

ALTER TABLE daily_workout_summaries
ADD CONSTRAINT daily_workout_summaries_challenge_id_fkey 
FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE;

-- =====================================================
-- PART 5: Fix hydration_logs
-- =====================================================

ALTER TABLE hydration_logs 
DROP CONSTRAINT IF EXISTS hydration_logs_goal_id_fkey;

ALTER TABLE hydration_logs
ADD CONSTRAINT hydration_logs_goal_id_fkey 
FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE;

ALTER TABLE hydration_logs 
DROP CONSTRAINT IF EXISTS hydration_logs_challenge_id_fkey;

ALTER TABLE hydration_logs
ADD CONSTRAINT hydration_logs_challenge_id_fkey 
FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE;

-- =====================================================
-- PART 6: Fix meal_logs
-- =====================================================

ALTER TABLE meal_logs 
DROP CONSTRAINT IF EXISTS meal_logs_goal_id_fkey;

ALTER TABLE meal_logs
ADD CONSTRAINT meal_logs_goal_id_fkey 
FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE;

ALTER TABLE meal_logs 
DROP CONSTRAINT IF EXISTS meal_logs_challenge_id_fkey;

ALTER TABLE meal_logs
ADD CONSTRAINT meal_logs_challenge_id_fkey 
FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE;

-- =====================================================
-- Cleanup any orphaned data that might already exist
-- =====================================================

-- Delete orphaned summary rows where goal no longer exists
DELETE FROM daily_nutrition_summaries 
WHERE goal_id IS NOT NULL AND goal_id NOT IN (SELECT id FROM goals);

DELETE FROM daily_hydration_summaries 
WHERE goal_id IS NOT NULL AND goal_id NOT IN (SELECT id FROM goals);

DELETE FROM daily_checkin_summaries 
WHERE goal_id IS NOT NULL AND goal_id NOT IN (SELECT id FROM goals);

DELETE FROM daily_workout_summaries 
WHERE goal_id IS NOT NULL AND goal_id NOT IN (SELECT id FROM goals);

-- Delete orphaned summary rows where challenge no longer exists
DELETE FROM daily_nutrition_summaries 
WHERE challenge_id IS NOT NULL AND challenge_id NOT IN (SELECT id FROM challenges);

DELETE FROM daily_hydration_summaries 
WHERE challenge_id IS NOT NULL AND challenge_id NOT IN (SELECT id FROM challenges);

DELETE FROM daily_workout_summaries 
WHERE challenge_id IS NOT NULL AND challenge_id NOT IN (SELECT id FROM challenges);

-- Delete orphaned log rows
DELETE FROM hydration_logs 
WHERE goal_id IS NOT NULL AND goal_id NOT IN (SELECT id FROM goals);

DELETE FROM hydration_logs 
WHERE challenge_id IS NOT NULL AND challenge_id NOT IN (SELECT id FROM challenges);

DELETE FROM meal_logs 
WHERE goal_id IS NOT NULL AND goal_id NOT IN (SELECT id FROM goals);

DELETE FROM meal_logs 
WHERE challenge_id IS NOT NULL AND challenge_id NOT IN (SELECT id FROM challenges);

