-- =================================================================
-- Add ALL notification types to notification_history check constraint
-- This includes current, planned, and future notification types
-- =================================================================

ALTER TABLE notification_history 
DROP CONSTRAINT IF EXISTS notification_history_notification_type_check;

ALTER TABLE notification_history 
ADD CONSTRAINT notification_history_notification_type_check 
CHECK (notification_type IN (
    -- ===================
    -- Core types (existing)
    -- ===================
    'ai_motivation',        -- AI-generated motivation messages
    'reminder',             -- Goal/challenge reminders
    'social',               -- General social notifications
    'achievement',          -- Badge/milestone achievements
    'reengagement',         -- Re-engagement campaigns
    'subscription',         -- Subscription-related notifications
    'general',              -- Default fallback type
    
    -- ===================
    -- Partner notifications (from SocialNotificationType)
    -- ===================
    'partner_request',      -- Someone sent a partner request
    'partner_accepted',     -- Partner request was accepted
    'partner_nudge',        -- Partner sent a nudge
    'partner_cheer',        -- Partner sent a cheer
    'partner_milestone',    -- Partner hit a milestone
    'partner_inactive',     -- Partner hasn't been active
    
    -- ===================
    -- Challenge notifications (from SocialNotificationType)
    -- ===================
    'challenge',            -- General challenge notification
    'challenge_invite',     -- Invited to a challenge
    'challenge_joined',     -- Someone joined your challenge
    'challenge_overtaken',  -- Someone passed you on leaderboard
    'challenge_lead',       -- You're now in first place
    'challenge_nudge',      -- Nudge in a challenge
    'challenge_starting',   -- Challenge is starting soon
    'challenge_ending',     -- Challenge is ending soon
    'challenge_ended',      -- Challenge has ended
    
    -- ===================
    -- Other types
    -- ===================
    'plan_ready',           -- Goal/challenge plan is ready
    'motivation_message',   -- Motivation message from SocialNotificationType
    
    -- ===================
    -- Future/planned types
    -- ===================
    'weekly_recap',         -- Weekly recap ready (for WeeklyRecapService)
    'streak_milestone',     -- Streak milestone achieved
    'goal_complete'         -- Goal completed
));

