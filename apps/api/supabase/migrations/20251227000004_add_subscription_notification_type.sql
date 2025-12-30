-- Add 'subscription' to the allowed notification types
-- This allows tracking subscription-related notifications (expiry, billing issues, etc.)

-- Drop and recreate the check constraint to include 'subscription' type
ALTER TABLE notification_history 
DROP CONSTRAINT IF EXISTS notification_history_notification_type_check;

ALTER TABLE notification_history 
ADD CONSTRAINT notification_history_notification_type_check 
CHECK (notification_type IN ('ai_motivation', 'reminder', 'social', 'achievement', 'reengagement', 'subscription'));

