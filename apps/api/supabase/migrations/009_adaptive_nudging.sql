-- =====================================================
-- FitNudge V2 - Adaptive Nudging Functions
-- RPC functions to support smart nudge detection
-- =====================================================

-- =====================================================
-- Function: get_streak_at_risk_users
-- Returns users with 7+ day streaks who haven't checked in today
-- Used by: check_streak_at_risk_task
-- =====================================================
CREATE OR REPLACE FUNCTION get_streak_at_risk_users(min_streak INT DEFAULT 7)
RETURNS TABLE (
  user_id UUID,
  goal_id UUID,
  title TEXT,
  current_streak INT,
  longest_streak INT,
  timezone TEXT,
  name TEXT,
  push_token TEXT
) AS $$
DECLARE
  current_date_utc DATE := CURRENT_DATE;
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (g.id)
    g.user_id,
    g.id as goal_id,
    g.title,
    g.current_streak::INT,
    g.longest_streak::INT,
    u.timezone,
    u.name,
    dt.fcm_token as push_token
  FROM goals g
  JOIN users u ON g.user_id = u.id
  LEFT JOIN device_tokens dt ON u.id = dt.user_id AND dt.is_active = true
  WHERE g.status = 'active'
    AND g.current_streak >= min_streak
    -- No check-in today
    AND NOT EXISTS (
      SELECT 1 FROM check_ins ci
      WHERE ci.goal_id = g.id
        AND ci.check_in_date = current_date_utc
    )
    -- Goal is scheduled for today (based on user timezone - simplified)
    AND (
      g.frequency_type = 'daily'
      OR (
        g.frequency_type = 'weekly'
        AND g.target_days IS NOT NULL
        AND EXTRACT(DOW FROM current_date_utc)::INT = ANY(g.target_days)
      )
    )
  ORDER BY g.id, g.current_streak DESC;
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- Function: get_users_with_missed_days
-- Returns users who haven't checked in for X+ consecutive days
-- Used by: check_missed_days_intervention_task
-- =====================================================
CREATE OR REPLACE FUNCTION get_users_with_missed_days(min_days INT DEFAULT 2)
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  timezone TEXT,
  push_token TEXT,
  days_missed INT
) AS $$
DECLARE
  cutoff_date DATE := CURRENT_DATE - min_days;
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (u.id)
    u.id as user_id,
    u.name,
    u.timezone,
    dt.fcm_token as push_token,
    (CURRENT_DATE - MAX(ci.check_in_date))::INT as days_missed
  FROM users u
  JOIN goals g ON u.id = g.user_id AND g.status = 'active'
  LEFT JOIN device_tokens dt ON u.id = dt.user_id AND dt.is_active = true
  LEFT JOIN check_ins ci ON u.id = ci.user_id
  GROUP BY u.id, u.name, u.timezone, dt.fcm_token
  HAVING MAX(ci.check_in_date) IS NULL 
     OR MAX(ci.check_in_date) < cutoff_date
  ORDER BY u.id, MAX(ci.check_in_date) DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- Function: get_users_approaching_milestone
-- Returns goals within X days of a streak milestone
-- Used by: check_approaching_milestone_task
-- =====================================================
CREATE OR REPLACE FUNCTION get_users_approaching_milestone(
  days_before INT DEFAULT 3,
  milestones INT[] DEFAULT ARRAY[7, 14, 21, 30, 50, 100, 200, 365, 500, 730, 1000]
)
RETURNS TABLE (
  user_id UUID,
  goal_id UUID,
  title TEXT,
  current_streak INT,
  approaching_milestone INT,
  days_until INT,
  name TEXT,
  timezone TEXT,
  push_token TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH goal_milestones AS (
    SELECT 
      g.user_id,
      g.id as goal_id,
      g.title,
      g.current_streak,
      m.milestone as approaching_milestone,
      (m.milestone - g.current_streak) as days_until
    FROM goals g
    CROSS JOIN LATERAL (
      SELECT unnest(milestones) as milestone
    ) m
    WHERE g.status = 'active'
      AND g.current_streak >= 4
      AND m.milestone - g.current_streak BETWEEN 1 AND days_before
  )
  SELECT DISTINCT ON (gm.goal_id)
    gm.user_id,
    gm.goal_id,
    gm.title,
    gm.current_streak::INT,
    gm.approaching_milestone::INT,
    gm.days_until::INT,
    u.name,
    u.timezone,
    dt.fcm_token as push_token
  FROM goal_milestones gm
  JOIN users u ON gm.user_id = u.id
  LEFT JOIN device_tokens dt ON u.id = dt.user_id AND dt.is_active = true
  ORDER BY gm.goal_id, gm.approaching_milestone ASC;
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- Index for adaptive nudging queries
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_check_ins_date_completed 
ON check_ins(check_in_date, completed);

CREATE INDEX IF NOT EXISTS idx_goals_streak_status 
ON goals(status, current_streak DESC) 
WHERE status = 'active';

-- Add comments
COMMENT ON FUNCTION get_streak_at_risk_users IS 
'Returns users with long streaks who have not checked in today. Used for streak-at-risk nudges.';

COMMENT ON FUNCTION get_users_with_missed_days IS 
'Returns users who have missed multiple consecutive days. Used for re-engagement nudges.';

COMMENT ON FUNCTION get_users_approaching_milestone IS 
'Returns users approaching a streak milestone. Used for motivation nudges.';
