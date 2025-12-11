-- Add tracking fields to prevent duplicate push notifications
-- When backend sends a push notification, it records the date and time
-- This prevents sending the same notification multiple times during the same minute

ALTER TABLE motivations 
ADD COLUMN IF NOT EXISTS sent_date DATE,
ADD COLUMN IF NOT EXISTS reminder_time TIME;

-- Index for fast duplicate checking (only check sent motivations)
CREATE INDEX IF NOT EXISTS idx_motivations_sent_tracking 
ON motivations(goal_id, sent_date, reminder_time, is_sent)
WHERE is_sent = true;

-- Add comments for documentation
COMMENT ON COLUMN motivations.sent_date IS 'Date when notification was sent (in user timezone)';
COMMENT ON COLUMN motivations.reminder_time IS 'Reminder time that triggered this notification (HH:MM format)';

