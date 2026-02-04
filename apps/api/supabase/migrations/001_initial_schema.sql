-- =====================================================
-- FitNudge V2 - Initial Schema
-- Core tables: users, goals, check_ins
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS
-- =====================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, -- Same ID as auth.users for Realtime
  
  -- Auth
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT, -- NULL for OAuth users (has_password is calculated from this)
  auth_provider TEXT DEFAULT 'email' CHECK (auth_provider IN ('email', 'google', 'apple')),
  email_verified BOOLEAN DEFAULT false,
  
  -- Profile
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL, -- Display name
  profile_picture_url TEXT,
  bio TEXT,
  timezone TEXT DEFAULT 'UTC',
  language TEXT DEFAULT 'en', -- Multilingual: 'en', 'es', 'fr', etc.
  country TEXT, -- ISO 3166-1 alpha-2 code
  
  -- Status & Role
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'suspended')),
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  
  -- V2 Preferences
  motivation_style TEXT DEFAULT 'supportive' CHECK (motivation_style IN ('supportive', 'tough_love', 'calm')),
  morning_motivation_enabled BOOLEAN DEFAULT true,
  morning_motivation_time TIME DEFAULT '08:00',
  
  -- Subscription (details in subscriptions table)
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  
  -- Referral System
  referral_code TEXT UNIQUE,
  referred_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  referral_bonus_granted_at TIMESTAMPTZ,
  
  -- Onboarding
  onboarding_completed_at TIMESTAMPTZ, -- Set when V2 personalization is complete
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL;

-- =====================================================
-- GOALS
-- =====================================================
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Goal definition
  title TEXT NOT NULL,
  
  -- Frequency
  frequency_type TEXT NOT NULL CHECK (frequency_type IN ('daily', 'weekly')),
  frequency_count INTEGER DEFAULT 7, -- Days per week: 7 for daily, 1-7 for weekly
  target_days INTEGER[] DEFAULT ARRAY[]::INTEGER[], -- 0=Sun, 1=Mon, etc. Empty = any day
  
  -- Reminder
  reminder_times TIME[] NOT NULL DEFAULT ARRAY['18:00'::TIME],
  reminder_window_before_minutes INTEGER DEFAULT 30, -- 0 = exact time, 30 = 30 min before
  checkin_prompt_delay_minutes INTEGER DEFAULT 30,  -- 0 = at reminder time, 30 = 30 min after last reminder
  
  -- Motivation
  why_statement TEXT, -- User's personal "why"
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  
  -- Stats (denormalized for performance)
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  total_completions INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_goals_status ON goals(status);
CREATE INDEX idx_goals_user_status ON goals(user_id, status);

-- =====================================================
-- CHECK-INS
-- =====================================================
CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  
  -- Check-in data
  check_in_date DATE NOT NULL,
  completed BOOLEAN NOT NULL,
  is_rest_day BOOLEAN DEFAULT false,
  
  -- Reflection (optional)
  mood TEXT CHECK (mood IN ('tough', 'good', 'amazing')),
  skip_reason TEXT CHECK (skip_reason IN ('work', 'tired', 'sick', 'schedule', 'other')),
  note TEXT,
  
  -- Voice note (Premium)
  voice_note_url TEXT,
  voice_note_transcript TEXT,
  
  -- AI response
  ai_response TEXT, -- The personalized message AI sent after check-in
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, goal_id, check_in_date)
);

CREATE INDEX idx_check_ins_user_date ON check_ins(user_id, check_in_date);
CREATE INDEX idx_check_ins_goal_date ON check_ins(goal_id, check_in_date);
CREATE INDEX idx_check_ins_user_goal ON check_ins(user_id, goal_id);

-- =====================================================
-- DAILY CHECK-IN SUMMARIES (for scalability)
-- =====================================================
CREATE TABLE daily_checkin_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  summary_date DATE NOT NULL,
  
  -- Aggregated stats
  total_check_ins INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  rest_day_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  
  -- Streak info at end of day
  streak_at_date INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, goal_id, summary_date)
);

CREATE INDEX idx_checkin_summaries_user_date ON daily_checkin_summaries(user_id, summary_date DESC);
CREATE INDEX idx_checkin_summaries_goal ON daily_checkin_summaries(goal_id);
-- Helps weekly recap / goal-range queries without partitions
CREATE INDEX idx_checkin_summaries_user_goal_date ON daily_checkin_summaries(user_id, goal_id, summary_date DESC);

-- =====================================================
-- OPTIONAL MAINTENANCE: Retention cleanup (run monthly)
-- =====================================================
-- Suggested retention: keep last 24 months of daily_checkin_summaries.
-- Run this block manually in Supabase SQL editor (or schedule it via cron).
DO $$
DECLARE
  cutoff DATE := (CURRENT_DATE - INTERVAL '24 months')::date;
  rows_deleted INT;
BEGIN
  LOOP
    WITH doomed AS (
      SELECT ctid
      FROM daily_checkin_summaries
      WHERE summary_date < cutoff
      LIMIT 5000
    )
    DELETE FROM daily_checkin_summaries d
    USING doomed
    WHERE d.ctid = doomed.ctid;

    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    EXIT WHEN rows_deleted = 0;
  END LOOP;
END $$;


-- =====================================================
-- TRIGGERS: Update timestamps
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_check_ins_updated_at
  BEFORE UPDATE ON check_ins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- AUTH USERS DELETE TRIGGERS (Bidirectional)
-- =====================================================

-- 1. When auth.users is deleted → delete from public.users
CREATE OR REPLACE FUNCTION public.handle_auth_user_deletion()
RETURNS TRIGGER AS $$
DECLARE
    public_user_exists BOOLEAN;
BEGIN
    -- Check if public.users row still exists (might have been deleted already)
    SELECT EXISTS(SELECT 1 FROM public.users WHERE id = OLD.id) INTO public_user_exists;
    
    -- Only delete from public.users if it still exists
    -- This prevents circular trigger conflicts
    IF public_user_exists THEN
        DELETE FROM public.users WHERE id = OLD.id;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
-- Note: This requires elevated privileges (service_role)
DO $$
BEGIN
    -- Drop existing trigger if it exists
    DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
    
    -- Create new trigger
    CREATE TRIGGER on_auth_user_deleted
        AFTER DELETE ON auth.users
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_auth_user_deletion();
        
    RAISE NOTICE 'Created trigger on_auth_user_deleted on auth.users';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE WARNING 'Cannot create trigger on auth.users - insufficient privileges. Delete cascade from auth.users to public.users will not work automatically. You may need to run this migration with service_role privileges.';
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to create trigger on auth.users: %', SQLERRM;
END $$;

-- 2. When public.users is deleted → delete from auth.users
CREATE OR REPLACE FUNCTION public.handle_public_user_deletion()
RETURNS TRIGGER AS $$
DECLARE
    auth_user_exists BOOLEAN;
BEGIN
    -- Check if auth.users row still exists (might have been deleted already)
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = OLD.id) INTO auth_user_exists;
    
    -- Only delete from auth.users if it still exists
    -- This prevents circular trigger conflicts
    IF auth_user_exists THEN
        DELETE FROM auth.users WHERE id = OLD.id;
    END IF;
    
    RETURN OLD;
EXCEPTION
    WHEN OTHERS THEN
        -- Log but don't fail - public.users deletion should still proceed
        RAISE WARNING 'Could not delete user % from auth.users: %', OLD.id, SQLERRM;
        RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on public.users (for reverse cascade)
-- Use AFTER DELETE to avoid trigger conflicts with the auth.users deletion trigger
DROP TRIGGER IF EXISTS on_public_user_deleted ON public.users;
CREATE TRIGGER on_public_user_deleted
    AFTER DELETE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_public_user_deletion();

-- Add comments explaining the triggers
COMMENT ON FUNCTION public.handle_auth_user_deletion() IS 
    'Cascades user deletion from auth.users to public.users. Deletes public.users record when auth.users is deleted.';

COMMENT ON FUNCTION public.handle_public_user_deletion() IS 
    'Cascades user deletion from public.users to auth.users. Deletes auth.users record when public.users is deleted.';

