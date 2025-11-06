-- Remove sound and vibration controls from notification preferences
-- These are now always enabled and not user-configurable

-- Drop the sound_enabled and vibration_enabled columns
ALTER TABLE notification_preferences 
DROP COLUMN IF EXISTS sound_enabled,
DROP COLUMN IF EXISTS vibration_enabled;

-- Update the get_user_notification_preferences function to remove sound/vibration references
CREATE OR REPLACE FUNCTION get_user_notification_preferences(p_user_id UUID)
RETURNS TABLE (
  enabled BOOLEAN,
  ai_motivation BOOLEAN,
  reminders BOOLEAN,
  social BOOLEAN,
  achievements BOOLEAN,
  reengagement BOOLEAN,
  quiet_hours_enabled BOOLEAN,
  quiet_hours_start TIME,
  quiet_hours_end TIME
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    np.enabled,
    np.ai_motivation,
    np.reminders,
    np.social,
    np.achievements,
    np.reengagement,
    np.quiet_hours_enabled,
    np.quiet_hours_start,
    np.quiet_hours_end
  FROM notification_preferences np
  WHERE np.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
