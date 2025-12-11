-- =====================================================
-- FIX ALL RLS POLICIES TO USE TO authenticated
-- =====================================================
-- Migration: 20251206000007_fix_all_policies_to_authenticated.sql
-- Purpose: Explicitly set all user-facing policies to TO authenticated
-- 
-- Why: Best practice for security and clarity
-- - TO authenticated: Only applies to logged-in users
-- - TO public: Kept only for truly public data
--
-- Pattern: FOR ALL TO authenticated for tables with uniform CRUD access

-- =====================================================
-- USERS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

CREATE POLICY "Users can manage own account"
ON users
FOR ALL
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Keep "Users can view public profiles" as public (intentionally public)

-- =====================================================
-- OAUTH_ACCOUNTS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can read own oauth accounts" ON oauth_accounts;
DROP POLICY IF EXISTS "Users can insert own oauth accounts" ON oauth_accounts;
DROP POLICY IF EXISTS "Users can update own oauth accounts" ON oauth_accounts;
DROP POLICY IF EXISTS "Users can delete own oauth accounts" ON oauth_accounts;

CREATE POLICY "Users can manage own oauth accounts"
ON oauth_accounts
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- GOALS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view own goals" ON goals;
DROP POLICY IF EXISTS "Users can insert own goals" ON goals;
DROP POLICY IF EXISTS "Users can update own goals" ON goals;
DROP POLICY IF EXISTS "Users can delete own goals" ON goals;

CREATE POLICY "Users can manage own goals"
ON goals
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- CHECK_INS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view own check-ins" ON check_ins;
DROP POLICY IF EXISTS "Users can insert own check-ins" ON check_ins;
DROP POLICY IF EXISTS "Users can update own check-ins" ON check_ins;
DROP POLICY IF EXISTS "Users can delete own check-ins" ON check_ins;

CREATE POLICY "Users can manage own check-ins"
ON check_ins
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- MOTIVATIONS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view own motivations" ON motivations;
DROP POLICY IF EXISTS "Users can insert own motivations" ON motivations;
DROP POLICY IF EXISTS "Users can update own motivations" ON motivations;
DROP POLICY IF EXISTS "Users can delete own motivations" ON motivations;

CREATE POLICY "Users can manage own motivations"
ON motivations
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- POSTS TABLE (Mixed: public read, authenticated write)
-- =====================================================

DROP POLICY IF EXISTS "Anyone can read public posts" ON posts;
DROP POLICY IF EXISTS "Users can create posts" ON posts;
DROP POLICY IF EXISTS "Users can update own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON posts;

-- Keep public read
CREATE POLICY "Anyone can read public posts"
ON posts
FOR SELECT
TO public
USING (is_public = true OR auth.uid() = user_id);

-- Authenticated write/update/delete
CREATE POLICY "Users can create posts"
ON posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
ON posts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
ON posts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- COMMENTS TABLE (Public read, authenticated write)
-- =====================================================

DROP POLICY IF EXISTS "Anyone can read comments" ON comments;
DROP POLICY IF EXISTS "Users can create comments" ON comments;
DROP POLICY IF EXISTS "Users can update own comments" ON comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON comments;

-- Public read
CREATE POLICY "Anyone can read comments"
ON comments
FOR SELECT
TO public
USING (true);

-- Authenticated write
CREATE POLICY "Users can create comments"
ON comments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
ON comments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
ON comments
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- LIKES TABLE (Public read, authenticated write)
-- =====================================================

DROP POLICY IF EXISTS "Anyone can read likes" ON likes;
DROP POLICY IF EXISTS "Users can create likes" ON likes;
DROP POLICY IF EXISTS "Users can delete own likes" ON likes;

-- Public read
CREATE POLICY "Anyone can read likes"
ON likes
FOR SELECT
TO public
USING (true);

-- Authenticated write/delete
CREATE POLICY "Users can create likes"
ON likes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes"
ON likes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- FOLLOWS TABLE (Public read, authenticated write)
-- =====================================================

DROP POLICY IF EXISTS "Anyone can read follows" ON follows;
DROP POLICY IF EXISTS "Users can create follows" ON follows;
DROP POLICY IF EXISTS "Users can delete own follows" ON follows;

-- Public read
CREATE POLICY "Anyone can read follows"
ON follows
FOR SELECT
TO public
USING (true);

-- Authenticated write/delete
CREATE POLICY "Users can create follows"
ON follows
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can delete own follows"
ON follows
FOR DELETE
TO authenticated
USING (auth.uid() = follower_id);

-- =====================================================
-- FEED_PREFERENCES TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can manage own feed preferences" ON feed_preferences;

CREATE POLICY "Users can manage own feed preferences"
ON feed_preferences
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- SUBSCRIPTIONS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can create subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON subscriptions;

CREATE POLICY "Users can view own subscriptions"
ON subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create subscriptions"
ON subscriptions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
ON subscriptions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- IAP_RECEIPTS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view own receipts" ON iap_receipts;
DROP POLICY IF EXISTS "Users can create receipts" ON iap_receipts;

CREATE POLICY "Users can view own receipts"
ON iap_receipts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create receipts"
ON iap_receipts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- MEDIA_UPLOADS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can manage own media" ON media_uploads;

CREATE POLICY "Users can manage own media"
ON media_uploads
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- USER_CONSENTS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can manage own consents" ON user_consents;

CREATE POLICY "Users can manage own consents"
ON user_consents
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- ACTIONABLE_PLANS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can read their own actionable plans" ON actionable_plans;

CREATE POLICY "Users can read their own actionable plans"
ON actionable_plans
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM goals
        WHERE goals.id = actionable_plans.goal_id
        AND goals.user_id = auth.uid()
    )
);

-- Keep service_role policy as is

-- =====================================================
-- ACHIEVEMENT_TYPES TABLE
-- =====================================================

DROP POLICY IF EXISTS "Anyone can read achievement types" ON achievement_types;

-- Keep public read for achievement types
CREATE POLICY "Anyone can read achievement types"
ON achievement_types
FOR SELECT
TO public
USING (is_active = true);

-- Keep service_role policy as is

-- =====================================================
-- USER_ACHIEVEMENTS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can read their own achievements" ON user_achievements;

CREATE POLICY "Users can read their own achievements"
ON user_achievements
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Keep service_role policy as is

-- =====================================================
-- PROGRESS_PHOTOS TABLE
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'progress_photos') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Users can manage own progress photos" ON progress_photos';
        EXECUTE 'CREATE POLICY "Users can manage own progress photos" ON progress_photos FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
    END IF;
END $$;

-- =====================================================
-- HABIT_CHAIN_LOGS TABLE
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'habit_chain_logs') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Users can manage own habit chain logs" ON habit_chain_logs';
        EXECUTE 'CREATE POLICY "Users can manage own habit chain logs" ON habit_chain_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
    END IF;
END $$;

-- =====================================================
-- MEAL_LOGS TABLE
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'meal_logs') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Users can manage own meal logs" ON meal_logs';
        EXECUTE 'CREATE POLICY "Users can manage own meal logs" ON meal_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
    END IF;
END $$;

-- =====================================================
-- MEAL_PHOTOS TABLE
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'meal_photos') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Users can manage own meal photos" ON meal_photos';
        EXECUTE 'CREATE POLICY "Users can manage own meal photos" ON meal_photos FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
    END IF;
END $$;

-- =====================================================
-- DAILY_NUTRITION_SUMMARIES TABLE
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'daily_nutrition_summaries') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Users can view own nutrition summaries" ON daily_nutrition_summaries';
        EXECUTE 'CREATE POLICY "Users can view own nutrition summaries" ON daily_nutrition_summaries FOR SELECT TO authenticated USING (auth.uid() = user_id)';
    END IF;
END $$;

-- =====================================================
-- CHALLENGES TABLE
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'challenges') THEN
        -- Public can read active/public challenges
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view public challenges" ON challenges';
        EXECUTE 'CREATE POLICY "Anyone can view public challenges" ON challenges FOR SELECT TO public USING (is_active = true AND is_public = true)';
    END IF;
END $$;

-- =====================================================
-- CHALLENGE_PARTICIPANTS TABLE
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'challenge_participants') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Users can manage own challenge participation" ON challenge_participants';
        EXECUTE 'CREATE POLICY "Users can manage own challenge participation" ON challenge_participants FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
    END IF;
END $$;

-- =====================================================
-- CHALLENGE_LEADERBOARD TABLE
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'challenge_leaderboard') THEN
        -- Public read for leaderboards
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view challenge leaderboard" ON challenge_leaderboard';
        EXECUTE 'CREATE POLICY "Anyone can view challenge leaderboard" ON challenge_leaderboard FOR SELECT TO public USING (true)';
    END IF;
END $$;

-- =====================================================
-- ACCOUNTABILITY_PARTNERS TABLE
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'accountability_partners') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Users can manage own partnerships" ON accountability_partners';
        EXECUTE 'CREATE POLICY "Users can manage own partnerships" ON accountability_partners FOR ALL TO authenticated USING (auth.uid() = user_id OR auth.uid() = partner_user_id) WITH CHECK (auth.uid() = user_id OR auth.uid() = partner_user_id)';
    END IF;
END $$;

-- =====================================================
-- GROUP_GOALS TABLE
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'group_goals') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Users can view group goals they participate in" ON group_goals';
        EXECUTE 'CREATE POLICY "Users can view group goals they participate in" ON group_goals FOR SELECT TO authenticated USING (auth.uid() = user_id)';
    END IF;
END $$;

-- =====================================================
-- NOTIFICATION_PREFERENCES TABLE
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notification_preferences') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Users can manage own notification preferences" ON notification_preferences';
        EXECUTE 'CREATE POLICY "Users can manage own notification preferences" ON notification_preferences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
    END IF;
END $$;

-- =====================================================
-- DEVICE_TOKENS TABLE
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'device_tokens') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Users can manage own device tokens" ON device_tokens';
        EXECUTE 'CREATE POLICY "Users can manage own device tokens" ON device_tokens FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
    END IF;
END $$;

-- =====================================================
-- NOTIFICATION_HISTORY TABLE
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notification_history') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Users can view own notification history" ON notification_history';
        EXECUTE 'CREATE POLICY "Users can view own notification history" ON notification_history FOR SELECT TO authenticated USING (auth.uid() = user_id)';
    END IF;
END $$;

-- =====================================================
-- DAILY_MOTIVATIONS TABLE
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'daily_motivations') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Users can view own daily motivations" ON daily_motivations';
        EXECUTE 'CREATE POLICY "Users can view own daily motivations" ON daily_motivations FOR SELECT TO authenticated USING (auth.uid() = user_id)';
    END IF;
END $$;

-- =====================================================
-- USER_FITNESS_PROFILES TABLE
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_fitness_profiles') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Users can manage own fitness profile" ON user_fitness_profiles';
        EXECUTE 'CREATE POLICY "Users can manage own fitness profile" ON user_fitness_profiles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
    END IF;
END $$;

-- =====================================================
-- SUGGESTED_GOALS TABLE
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'suggested_goals') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Users can view own suggested goals" ON suggested_goals';
        EXECUTE 'CREATE POLICY "Users can view own suggested goals" ON suggested_goals FOR SELECT TO authenticated USING (auth.uid() = user_id)';
    END IF;
END $$;

-- =====================================================
-- NOTES
-- =====================================================

-- Admin-only tables kept as is:
--   - admin_users (admin role check)
--   - audit_logs (admin role check)
--   - blog_posts (admin/moderator for write, public for read)
--   - service_role policies (not changed)

-- Public read tables kept as is:
--   - blog_categories (anyone can view)
--   - blog_tags (anyone can view)
--   - achievement_types (anyone can view active)
--   - challenge_leaderboard (public visibility)

-- =====================================================
-- VERIFICATION
-- =====================================================

COMMENT ON SCHEMA public IS 
'All user-facing RLS policies updated to explicitly use TO authenticated.
Public read policies remain as TO public where appropriate.
Admin and service_role policies unchanged.';

