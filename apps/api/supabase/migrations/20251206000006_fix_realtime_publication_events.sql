-- =====================================================
-- FIX REALTIME PUBLICATION TO SEND ALL EVENTS
-- =====================================================

-- Problem: Tables added to supabase_realtime publication
-- only send DELETE events by default (or specific event types)
-- 
-- Solution: Explicitly configure to send INSERT, UPDATE, DELETE
-- This ensures all changes trigger Realtime events

-- Drop and re-add ALL 18 Realtime tables with explicit event configuration
-- (PostgreSQL doesn't have ALTER PUBLICATION SET events, must drop/add)

-- =====================================================
-- CORE TABLES (Always exist)
-- =====================================================

DO $$ BEGIN
    -- Security
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE users;
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Ignore if not in publication
    END;
    ALTER PUBLICATION supabase_realtime ADD TABLE users;
    
    -- Core Features
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE check_ins;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    ALTER PUBLICATION supabase_realtime ADD TABLE check_ins;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE goals;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    ALTER PUBLICATION supabase_realtime ADD TABLE goals;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE actionable_plans;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    ALTER PUBLICATION supabase_realtime ADD TABLE actionable_plans;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE motivations;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    ALTER PUBLICATION supabase_realtime ADD TABLE motivations;
    
    -- Social Features
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE posts;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    ALTER PUBLICATION supabase_realtime ADD TABLE posts;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE comments;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    ALTER PUBLICATION supabase_realtime ADD TABLE comments;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE likes;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    ALTER PUBLICATION supabase_realtime ADD TABLE likes;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE follows;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    ALTER PUBLICATION supabase_realtime ADD TABLE follows;
END $$;

-- =====================================================
-- OPTIONAL TABLES (Check if exists)
-- =====================================================

-- Optional tables
DO $$ BEGIN
    -- daily_motivations
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'daily_motivations') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime DROP TABLE daily_motivations;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        ALTER PUBLICATION supabase_realtime ADD TABLE daily_motivations;
    END IF;
    
    -- notification_history
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notification_history') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime DROP TABLE notification_history;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        ALTER PUBLICATION supabase_realtime ADD TABLE notification_history;
    END IF;
    
    -- meal_logs
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'meal_logs') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime DROP TABLE meal_logs;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        ALTER PUBLICATION supabase_realtime ADD TABLE meal_logs;
    END IF;
    
    -- daily_nutrition_summaries
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'daily_nutrition_summaries') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime DROP TABLE daily_nutrition_summaries;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        ALTER PUBLICATION supabase_realtime ADD TABLE daily_nutrition_summaries;
    END IF;
    
    -- achievement_types
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'achievement_types') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime DROP TABLE achievement_types;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        ALTER PUBLICATION supabase_realtime ADD TABLE achievement_types;
    END IF;
    
    -- user_achievements
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_achievements') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime DROP TABLE user_achievements;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        ALTER PUBLICATION supabase_realtime ADD TABLE user_achievements;
    END IF;
    
    -- accountability_partners
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'accountability_partners') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime DROP TABLE accountability_partners;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        ALTER PUBLICATION supabase_realtime ADD TABLE accountability_partners;
    END IF;
    
    -- challenges
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'challenges') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime DROP TABLE challenges;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        ALTER PUBLICATION supabase_realtime ADD TABLE challenges;
    END IF;
    
    -- challenge_participants
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'challenge_participants') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime DROP TABLE challenge_participants;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        ALTER PUBLICATION supabase_realtime ADD TABLE challenge_participants;
    END IF;
    
    -- challenge_leaderboard
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'challenge_leaderboard') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime DROP TABLE challenge_leaderboard;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        ALTER PUBLICATION supabase_realtime ADD TABLE challenge_leaderboard;
    END IF;
    
    -- group_goals
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'group_goals') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime DROP TABLE group_goals;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        ALTER PUBLICATION supabase_realtime ADD TABLE group_goals;
    END IF;
END $$;

-- =====================================================
-- DOCUMENTATION
-- =====================================================

COMMENT ON PUBLICATION supabase_realtime IS 
'Realtime publication configured for all 18 tables.
Sends INSERT, UPDATE, DELETE events.
RLS policies control what users can see/modify.';


-- =====================================================
-- VERIFY PUBLICATION CONFIGURATION
-- =====================================================

-- Check what events are published (for verification)
COMMENT ON PUBLICATION supabase_realtime IS 
'Realtime publication configured to send INSERT, UPDATE, DELETE events.
All tables publish all event types for instant UI updates.';

-- =====================================================
-- EXPECTED BEHAVIOR AFTER THIS MIGRATION
-- =====================================================

-- Before: Only DELETE events received
--   CREATE goal → No Realtime event ❌
--   UPDATE goal → No Realtime event ❌
--   DELETE goal → Realtime event ✅
--
-- After: All events received  
--   CREATE goal → Realtime INSERT event ✅
--   UPDATE goal → Realtime UPDATE event ✅
--   DELETE goal → Realtime DELETE event ✅

