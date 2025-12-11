-- =====================================================
-- SET REPLICA IDENTITY FULL FOR REALTIME DELETE EVENTS
-- =====================================================

-- Problem: With RLS enabled, DELETE events only send primary key
-- Solution: Set REPLICA IDENTITY FULL to include full old record
-- 
-- This allows Realtime filters to work on DELETE events by including
-- user_id and other columns in the old record payload.
--
-- Security: Safe because Realtime subscriptions are already filtered by user_id
-- Users only receive DELETE events for their own records.

-- Core tables with user_id filtering (always exist)
ALTER TABLE goals REPLICA IDENTITY FULL;
ALTER TABLE check_ins REPLICA IDENTITY FULL;
ALTER TABLE motivations REPLICA IDENTITY FULL;
ALTER TABLE users REPLICA IDENTITY FULL;
ALTER TABLE posts REPLICA IDENTITY FULL;
ALTER TABLE comments REPLICA IDENTITY FULL;

-- Optional tables (check if exists first)
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'daily_motivations') THEN
        ALTER TABLE daily_motivations REPLICA IDENTITY FULL;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'meal_logs') THEN
        ALTER TABLE meal_logs REPLICA IDENTITY FULL;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_achievements') THEN
        ALTER TABLE user_achievements REPLICA IDENTITY FULL;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_fitness_profiles') THEN
        ALTER TABLE user_fitness_profiles REPLICA IDENTITY FULL;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notification_preferences') THEN
        ALTER TABLE notification_preferences REPLICA IDENTITY FULL;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'suggested_goals') THEN
        ALTER TABLE suggested_goals REPLICA IDENTITY FULL;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'progress_photos') THEN
        ALTER TABLE progress_photos REPLICA IDENTITY FULL;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'habit_chain_logs') THEN
        ALTER TABLE habit_chain_logs REPLICA IDENTITY FULL;
    END IF;
END $$;

-- =====================================================
-- DOCUMENTATION
-- =====================================================

COMMENT ON TABLE goals IS 
'REPLICA IDENTITY FULL enabled for Realtime DELETE events with RLS.
Ensures user_id is included in DELETE payloads for proper filtering.';

COMMENT ON TABLE check_ins IS
'REPLICA IDENTITY FULL enabled for Realtime DELETE events with RLS.
Ensures user_id is included in DELETE payloads for proper filtering.';

-- =====================================================
-- WHY THIS IS NEEDED
-- =====================================================

-- Without REPLICA IDENTITY FULL:
--   DELETE event payload: {old: {id: "abc-123"}}  ← Only primary key!
--   Filter `user_id=eq.${userId}` can't work ❌
--
-- With REPLICA IDENTITY FULL:
--   DELETE event payload: {old: {id: "abc-123", user_id: "xyz", title: "..."}}
--   Filter `user_id=eq.${userId}` works! ✅
--
-- Security: Users already filtered by user_id in subscription
-- They only receive events for their own records (no data leak)

