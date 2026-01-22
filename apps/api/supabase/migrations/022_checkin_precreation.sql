-- =====================================================
-- FitNudge V2 - Check-in Pre-creation System
-- Pre-creates check-ins for accurate analytics & "missed" tracking
-- 
-- CLEAN SCHEMA: Only 'status' column, no legacy 'completed'/'is_rest_day'
-- =====================================================

-- =====================================================
-- 0. DROP DEPENDENT OBJECTS
-- These depend on completed/is_rest_day columns
-- They will be recreated in migrations 023/024 with status column
-- =====================================================

-- Drop materialized views that depend on completed/is_rest_day
DROP MATERIALIZED VIEW IF EXISTS analytics.user_engagement_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS analytics.mv_user_daily_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS analytics.mv_goal_stats CASCADE;

-- Also drop public schema views if they exist (from older migrations)
DROP MATERIALIZED VIEW IF EXISTS public.user_engagement_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_user_daily_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_goal_stats CASCADE;

-- Drop triggers that reference completed/is_rest_day columns
-- They will be recreated in migration 023 with status column
DROP TRIGGER IF EXISTS trg_checkin_sync_goal_stats ON check_ins;
DROP TRIGGER IF EXISTS trg_sync_daily_checkin_summary ON check_ins;

-- Drop the old trigger functions (will be recreated in 023)
DROP FUNCTION IF EXISTS recalculate_goal_stats() CASCADE;
DROP FUNCTION IF EXISTS sync_daily_checkin_summary() CASCADE;
DROP FUNCTION IF EXISTS recalculate_daily_checkin_summary(UUID, UUID, DATE) CASCADE;

-- =====================================================
-- 1. ADD STATUS COLUMN TO CHECK_INS TABLE
-- Status values:
--   - 'pending': Pre-created, waiting for user response
--   - 'completed': User marked as done
--   - 'skipped': User explicitly skipped (has skip_reason)
--   - 'missed': Day passed without user response (marked by end-of-day task)
--   - 'rest_day': User marked as rest day (preserves streak)
-- =====================================================

-- Add status column if not exists
ALTER TABLE check_ins 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed'
  CHECK (status IN ('pending', 'completed', 'skipped', 'missed', 'rest_day'));

-- Backfill status based on existing data BEFORE dropping columns
-- Only run if 'completed' column still exists (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'check_ins' AND column_name = 'completed'
  ) THEN
    UPDATE check_ins SET status = 'completed' WHERE completed = true;
    UPDATE check_ins SET status = 'rest_day' WHERE completed = false AND is_rest_day = true;
    UPDATE check_ins SET status = 'skipped' WHERE completed = false AND skip_reason IS NOT NULL AND is_rest_day = false;
    UPDATE check_ins SET status = 'missed' WHERE completed = false AND skip_reason IS NULL AND is_rest_day = false;
    
    RAISE NOTICE 'Backfilled status from completed/is_rest_day columns';
  ELSE
    RAISE NOTICE 'completed column already dropped, skipping backfill';
  END IF;
END $$;

-- Now drop the legacy columns - status is the single source of truth
ALTER TABLE check_ins DROP COLUMN IF EXISTS completed;
ALTER TABLE check_ins DROP COLUMN IF EXISTS is_rest_day;

-- Add index for efficient pending check-in queries
CREATE INDEX IF NOT EXISTS idx_check_ins_status 
  ON check_ins(status) 
  WHERE status = 'pending';

-- Add index for goal + status queries (for analytics)
CREATE INDEX IF NOT EXISTS idx_check_ins_goal_status 
  ON check_ins(goal_id, status);

-- Add index for user + date + status (for daily processing)
CREATE INDEX IF NOT EXISTS idx_check_ins_user_date_status 
  ON check_ins(user_id, check_in_date, status);

COMMENT ON COLUMN check_ins.status IS 
  'Check-in lifecycle status: pending (awaiting response), completed, skipped, missed (no response by EOD), rest_day';

-- =====================================================
-- 2. FUNCTION: Pre-create Check-ins for a Single Date
-- Used by both daily batch task and goal creation trigger
-- =====================================================

CREATE OR REPLACE FUNCTION precreate_checkins_for_date(
  p_target_date DATE,
  p_user_ids UUID[] DEFAULT NULL
)
RETURNS TABLE(user_id UUID, goal_id UUID) AS $$
BEGIN
  -- Pre-create check-ins for all active goals where target_date is a scheduled day
  -- Returns the user_id and goal_id of each newly inserted check-in
  -- Only inserts 'status' - no completed/is_rest_day columns
  
  RETURN QUERY
  INSERT INTO check_ins (user_id, goal_id, check_in_date, status)
  SELECT 
    g.user_id,
    g.id,
    p_target_date,
    'pending'
  FROM goals g
  WHERE g.status = 'active'
    AND (p_user_ids IS NULL OR g.user_id = ANY(p_user_ids))
    AND (
      g.frequency_type = 'daily'
      OR (
        g.frequency_type = 'weekly'
        AND (
          g.target_days = '{}'
          OR g.target_days IS NULL
          OR EXTRACT(DOW FROM p_target_date)::int = ANY(g.target_days)
        )
      )
    )
  ON CONFLICT (user_id, goal_id, check_in_date) DO NOTHING
  RETURNING check_ins.user_id, check_ins.goal_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION precreate_checkins_for_date(DATE, UUID[]) IS 
  'Pre-creates pending check-ins for all active goals on the specified date. Returns inserted user_id/goal_id pairs for cache invalidation.';

-- =====================================================
-- 3. FUNCTION: Pre-create Check-in for a Single Goal
-- Used by goal creation/reactivation triggers
-- =====================================================

CREATE OR REPLACE FUNCTION precreate_checkin_for_goal(
  p_goal_id UUID,
  p_user_id UUID,
  p_frequency_type TEXT,
  p_target_days INTEGER[],
  p_user_timezone TEXT DEFAULT 'UTC'
)
RETURNS TEXT AS $$
-- Returns: 'inserted' (new check-in created), 'existed' (already exists), 'not_scheduled' (not a scheduled day)
DECLARE
  user_today DATE;
  is_scheduled BOOLEAN;
  inserted_count INTEGER;
BEGIN
  user_today := (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(p_user_timezone, 'UTC'))::date;
  
  is_scheduled := (
    p_frequency_type = 'daily'
    OR (
      p_frequency_type = 'weekly'
      AND (
        p_target_days = '{}'
        OR p_target_days IS NULL
        OR EXTRACT(DOW FROM user_today)::int = ANY(p_target_days)
      )
    )
  );
  
  IF is_scheduled THEN
    INSERT INTO check_ins (user_id, goal_id, check_in_date, status)
    VALUES (p_user_id, p_goal_id, user_today, 'pending')
    ON CONFLICT (user_id, goal_id, check_in_date) DO NOTHING;
    
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    
    IF inserted_count > 0 THEN
      RETURN 'inserted';
    ELSE
      RETURN 'existed';
    END IF;
  END IF;
  
  RETURN 'not_scheduled';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION precreate_checkin_for_goal(UUID, UUID, TEXT, INTEGER[], TEXT) IS 
  'Pre-creates a pending check-in for a single goal if today is a scheduled day. Returns: inserted, existed, or not_scheduled.';

-- =====================================================
-- 4. TRIGGER: Create Initial Check-in on Goal INSERT
-- =====================================================

CREATE OR REPLACE FUNCTION trg_goal_create_initial_checkin()
RETURNS TRIGGER AS $$
DECLARE
  user_tz TEXT;
BEGIN
  IF NEW.status != 'active' THEN
    RETURN NEW;
  END IF;
  
  SELECT timezone INTO user_tz FROM users WHERE id = NEW.user_id;
  
  PERFORM precreate_checkin_for_goal(
    NEW.id,
    NEW.user_id,
    NEW.frequency_type,
    NEW.target_days,
    user_tz
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_goal_insert_checkin ON goals;
CREATE TRIGGER trg_goal_insert_checkin
  AFTER INSERT ON goals
  FOR EACH ROW
  EXECUTE FUNCTION trg_goal_create_initial_checkin();

-- =====================================================
-- 5. TRIGGER: Create Check-in on Goal Reactivation
-- =====================================================

CREATE OR REPLACE FUNCTION trg_goal_reactivate_checkin()
RETURNS TRIGGER AS $$
DECLARE
  user_tz TEXT;
BEGIN
  IF OLD.status = 'active' OR NEW.status != 'active' THEN
    RETURN NEW;
  END IF;
  
  SELECT timezone INTO user_tz FROM users WHERE id = NEW.user_id;
  
  PERFORM precreate_checkin_for_goal(
    NEW.id,
    NEW.user_id,
    NEW.frequency_type,
    NEW.target_days,
    user_tz
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_goal_reactivate_checkin ON goals;
CREATE TRIGGER trg_goal_reactivate_checkin
  AFTER UPDATE OF status ON goals
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION trg_goal_reactivate_checkin();

-- =====================================================
-- 6. FUNCTION: Mark Missed Check-ins (End of Day)
-- =====================================================

CREATE OR REPLACE FUNCTION mark_missed_checkins_batch()
RETURNS INTEGER AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  UPDATE check_ins ci
  SET 
    status = 'missed',
    updated_at = NOW()
  FROM users u
  WHERE ci.user_id = u.id
    AND ci.status = 'pending'
    AND ci.check_in_date < (
      (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(u.timezone, 'UTC'))::date
    );
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_missed_checkins_batch() IS 
  'Marks pending check-ins as missed when their day has passed (in user timezone). Run hourly.';

-- =====================================================
-- 7. BACKFILL: Create Today's Pending Check-ins
-- One-time operation for existing active goals
-- =====================================================

SELECT precreate_checkins_for_date(CURRENT_DATE);

-- =====================================================
-- 8. HELPER: Get Check-in Status Summary for Goal
-- =====================================================

CREATE OR REPLACE FUNCTION get_checkin_status_summary(
  p_goal_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  status TEXT,
  count BIGINT,
  percentage NUMERIC
) AS $$
DECLARE
  total BIGINT;
BEGIN
  SELECT COUNT(*) INTO total
  FROM check_ins
  WHERE goal_id = p_goal_id
    AND check_in_date > CURRENT_DATE - p_days;
  
  RETURN QUERY
  SELECT 
    ci.status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / NULLIF(total, 0), 1) as percentage
  FROM check_ins ci
  WHERE ci.goal_id = p_goal_id
    AND ci.check_in_date > CURRENT_DATE - p_days
  GROUP BY ci.status
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_checkin_status_summary(UUID, INTEGER) IS 
  'Returns status breakdown for a goal over the last N days.';

-- =====================================================
-- 9. COMMENTS
-- =====================================================

COMMENT ON TABLE check_ins IS 
  'V2 Check-in System: Pre-created daily for active goals. Status is the single source of truth: pending -> completed/skipped/missed/rest_day.';
