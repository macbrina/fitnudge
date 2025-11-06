-- Add push_notifications and email_notifications to notification_preferences table
-- This allows users to control delivery channels separately

ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT true;

-- Update existing records to have both enabled by default
UPDATE notification_preferences
SET 
  push_notifications = true,
  email_notifications = true
WHERE push_notifications IS NULL OR email_notifications IS NULL;

-- Add comments
COMMENT ON COLUMN notification_preferences.push_notifications IS 'Enable push notifications delivery';
COMMENT ON COLUMN notification_preferences.email_notifications IS 'Enable email notifications delivery';

-- Update the get_user_notification_preferences function to include new fields
-- Drop the function first since we're changing the return type
DROP FUNCTION IF EXISTS get_user_notification_preferences(UUID);

-- Recreate the function with new return type including push_notifications and email_notifications
CREATE FUNCTION get_user_notification_preferences(p_user_id UUID)
RETURNS TABLE (
  enabled BOOLEAN,
  push_notifications BOOLEAN,
  email_notifications BOOLEAN,
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
    np.push_notifications,
    np.email_notifications,
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

