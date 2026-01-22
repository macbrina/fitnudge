-- =====================================================
-- NOTIFICATION PREFERENCES - Add Partner Notification Column
-- V2: Single toggle for all partner-related notifications
-- =====================================================

-- Add single partners notification preference column
-- Controls: partner_request, partner_accepted, partner_nudge, partner_cheer, partner_milestone, partner_inactive
ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS partners BOOLEAN DEFAULT true;

-- Add weekly_recap column (was missing, only had weekly_recaps plural in some versions)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notification_preferences' AND column_name = 'weekly_recaps'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notification_preferences' AND column_name = 'weekly_recap'
    ) THEN
        ALTER TABLE notification_preferences RENAME COLUMN weekly_recaps TO weekly_recap;
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notification_preferences' AND column_name = 'weekly_recap'
    ) THEN
        ALTER TABLE notification_preferences ADD COLUMN weekly_recap BOOLEAN DEFAULT true;
    END IF;
END $$;

COMMENT ON COLUMN notification_preferences.partners IS 'Enable all partner-related notifications (requests, nudges, cheers, milestones)';
