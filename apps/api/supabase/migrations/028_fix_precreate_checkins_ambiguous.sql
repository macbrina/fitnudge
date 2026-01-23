-- =====================================================
-- FitNudge - Fix Ambiguous Column Reference in precreate_checkins_for_date
-- 
-- Issue: RETURNS TABLE(user_id, goal_id) creates PL/pgSQL output variables
-- that conflict with column names in ON CONFLICT clause.
-- 
-- Fix: Rename output columns to avoid conflict (out_user_id, out_goal_id)
--
-- Scalability (per SCALABILITY.md):
-- - This function uses O(1) batch INSERT (single SQL statement)
-- - No loops, no N+1 queries - handles 100K+ goals efficiently
-- - Uses ON CONFLICT DO NOTHING to avoid duplicates
-- - Returns inserted rows for cache invalidation
-- =====================================================

-- Must DROP first because we're changing the return type (column names)
-- PostgreSQL doesn't allow CREATE OR REPLACE when return type changes
DROP FUNCTION IF EXISTS precreate_checkins_for_date(DATE, UUID[]);

CREATE FUNCTION precreate_checkins_for_date(
  p_target_date DATE,
  p_user_ids UUID[] DEFAULT NULL
)
RETURNS TABLE(out_user_id UUID, out_goal_id UUID) AS $$
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
  'Pre-creates pending check-ins for all active goals on the specified date. Returns inserted user_id/goal_id pairs (as out_user_id/out_goal_id) for cache invalidation.';

-- =====================================================
-- Also fix precreate_checkin_for_goal if it has similar issues
-- (It returns TEXT so no conflict, but let's verify it's correct)
-- =====================================================

-- This function returns TEXT, so no column name conflict
-- Just ensuring it's using qualified column names properly
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
