-- =====================================================
-- COMPREHENSIVE FIX: ALL RLS POLICIES TO AUTHENTICATED
-- =====================================================
-- Problem: Many policies created WITHOUT "TO authenticated" default to public role
-- This breaks Realtime because auth.uid() isn't evaluated correctly for authenticated users
--
-- Rules:
-- 1. User-specific tables: TO authenticated with user_id = auth.uid()
-- 2. Viewable by all logged-in users (achievement_types, exercises, etc.): TO authenticated USING (true)
-- 3. Truly public (blog, system_health): TO public
-- 4. Admin tables: service_role only
--
-- Truly Public Tables (TO public):
-- - blog_posts, blog_categories, blog_tags, blog_post_categories, blog_post_tags
-- - system_health_updates, system_health_history
-- - account_lockouts, failed_login_attempts, security_events
-- - offer_codes
--
-- Everything else: TO authenticated

-- =====================================================
-- 1. USERS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Users can view public profiles" ON users;
DROP POLICY IF EXISTS "Users can manage own account" ON users;

CREATE POLICY "users_select"
ON users FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "users_update"
ON users FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- =====================================================
-- 2. OAUTH_ACCOUNTS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can read own oauth accounts" ON oauth_accounts;
DROP POLICY IF EXISTS "Users can insert own oauth accounts" ON oauth_accounts;
DROP POLICY IF EXISTS "Users can update own oauth accounts" ON oauth_accounts;
DROP POLICY IF EXISTS "Users can delete own oauth accounts" ON oauth_accounts;
DROP POLICY IF EXISTS "Users can manage own oauth accounts" ON oauth_accounts;

CREATE POLICY "oauth_accounts_all"
ON oauth_accounts FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 3. GOALS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can view own goals" ON goals;
DROP POLICY IF EXISTS "Users can insert own goals" ON goals;
DROP POLICY IF EXISTS "Users can update own goals" ON goals;
DROP POLICY IF EXISTS "Users can delete own goals" ON goals;
DROP POLICY IF EXISTS "Users can manage own goals" ON goals;

CREATE POLICY "goals_all"
ON goals FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 4. CHECK_INS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can view own check-ins" ON check_ins;
DROP POLICY IF EXISTS "Users can insert own check-ins" ON check_ins;
DROP POLICY IF EXISTS "Users can update own check-ins" ON check_ins;
DROP POLICY IF EXISTS "Users can delete own check-ins" ON check_ins;
DROP POLICY IF EXISTS "Users can manage own check-ins" ON check_ins;

CREATE POLICY "check_ins_all"
ON check_ins FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 5. MOTIVATIONS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can view own motivations" ON motivations;
DROP POLICY IF EXISTS "Users can insert own motivations" ON motivations;
DROP POLICY IF EXISTS "Users can update own motivations" ON motivations;
DROP POLICY IF EXISTS "Users can delete own motivations" ON motivations;
DROP POLICY IF EXISTS "Users can manage own motivations" ON motivations;

CREATE POLICY "motivations_all"
ON motivations FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 6. POSTS TABLE (authenticated can read all, manage own)
-- =====================================================
DROP POLICY IF EXISTS "Anyone can read public posts" ON posts;
DROP POLICY IF EXISTS "Users can create posts" ON posts;
DROP POLICY IF EXISTS "Users can update own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON posts;

CREATE POLICY "posts_select"
ON posts FOR SELECT TO authenticated
USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "posts_insert"
ON posts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "posts_update"
ON posts FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "posts_delete"
ON posts FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- 7. COMMENTS TABLE (authenticated only)
-- =====================================================
DROP POLICY IF EXISTS "Anyone can read comments" ON comments;
DROP POLICY IF EXISTS "Users can create comments" ON comments;
DROP POLICY IF EXISTS "Users can update own comments" ON comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON comments;

CREATE POLICY "comments_select"
ON comments FOR SELECT TO authenticated
USING (true);

CREATE POLICY "comments_insert"
ON comments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comments_update"
ON comments FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comments_delete"
ON comments FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- 8. LIKES TABLE (authenticated only)
-- =====================================================
DROP POLICY IF EXISTS "Anyone can read likes" ON likes;
DROP POLICY IF EXISTS "Users can create likes" ON likes;
DROP POLICY IF EXISTS "Users can delete own likes" ON likes;

CREATE POLICY "likes_select"
ON likes FOR SELECT TO authenticated
USING (true);

CREATE POLICY "likes_insert"
ON likes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "likes_delete"
ON likes FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- 9. FOLLOWS TABLE (authenticated only)
-- =====================================================
DROP POLICY IF EXISTS "Anyone can read follows" ON follows;
DROP POLICY IF EXISTS "Users can create follows" ON follows;
DROP POLICY IF EXISTS "Users can delete own follows" ON follows;

CREATE POLICY "follows_select"
ON follows FOR SELECT TO authenticated
USING (true);

CREATE POLICY "follows_insert"
ON follows FOR INSERT TO authenticated
WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "follows_delete"
ON follows FOR DELETE TO authenticated
USING (auth.uid() = follower_id);

-- =====================================================
-- 10. FEED_PREFERENCES TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can manage own feed preferences" ON feed_preferences;

CREATE POLICY "feed_preferences_all"
ON feed_preferences FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 11. SUBSCRIPTIONS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can create subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON subscriptions;

CREATE POLICY "subscriptions_select"
ON subscriptions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "subscriptions_insert"
ON subscriptions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "subscriptions_update"
ON subscriptions FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 12. MEDIA_UPLOADS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can manage own media" ON media_uploads;

CREATE POLICY "media_uploads_all"
ON media_uploads FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 13. USER_CONSENTS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can manage own consents" ON user_consents;

CREATE POLICY "user_consents_all"
ON user_consents FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 14. ACHIEVEMENT_TYPES TABLE (all authenticated can view)
-- =====================================================
DROP POLICY IF EXISTS "Anyone can read achievement types" ON achievement_types;
DROP POLICY IF EXISTS "Service role can manage achievement types" ON achievement_types;

CREATE POLICY "achievement_types_select"
ON achievement_types FOR SELECT TO authenticated
USING (is_active = true);

-- =====================================================
-- 15. USER_ACHIEVEMENTS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can read their own achievements" ON user_achievements;
DROP POLICY IF EXISTS "Users can view own achievements" ON user_achievements;
DROP POLICY IF EXISTS "Only admins can manage achievements" ON user_achievements;
DROP POLICY IF EXISTS "Only admins can update achievements" ON user_achievements;
DROP POLICY IF EXISTS "Service role can manage user achievements" ON user_achievements;

CREATE POLICY "user_achievements_select"
ON user_achievements FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- 16. USER_FITNESS_PROFILES TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can view own fitness profile" ON user_fitness_profiles;
DROP POLICY IF EXISTS "Users can insert own fitness profile" ON user_fitness_profiles;
DROP POLICY IF EXISTS "Users can update own fitness profile" ON user_fitness_profiles;
DROP POLICY IF EXISTS "Users can delete own fitness profile" ON user_fitness_profiles;
DROP POLICY IF EXISTS "Users can manage own fitness profile" ON user_fitness_profiles;

CREATE POLICY "user_fitness_profiles_all"
ON user_fitness_profiles FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 17. NOTIFICATION_PREFERENCES TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can view their own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can insert their own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can update their own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can delete their own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can manage own notification preferences" ON notification_preferences;

CREATE POLICY "notification_preferences_all"
ON notification_preferences FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 18. DEVICE_TOKENS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can view their own device tokens" ON device_tokens;
DROP POLICY IF EXISTS "Users can insert their own device tokens" ON device_tokens;
DROP POLICY IF EXISTS "Users can update their own device tokens" ON device_tokens;
DROP POLICY IF EXISTS "Users can delete their own device tokens" ON device_tokens;
DROP POLICY IF EXISTS "Users can manage own device tokens" ON device_tokens;

CREATE POLICY "device_tokens_all"
ON device_tokens FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 19. NOTIFICATION_HISTORY TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can view their own notification history" ON notification_history;
DROP POLICY IF EXISTS "System can insert notification history" ON notification_history;
DROP POLICY IF EXISTS "System can update notification history" ON notification_history;
DROP POLICY IF EXISTS "Users can view own notification history" ON notification_history;

CREATE POLICY "notification_history_select"
ON notification_history FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- 20. DAILY_MOTIVATIONS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can view own motivations" ON daily_motivations;
DROP POLICY IF EXISTS "Only admins can create motivations" ON daily_motivations;
DROP POLICY IF EXISTS "Users can update own motivation share count" ON daily_motivations;
DROP POLICY IF EXISTS "Only admins can delete motivations" ON daily_motivations;
DROP POLICY IF EXISTS "Users can view own daily motivations" ON daily_motivations;

CREATE POLICY "daily_motivations_select"
ON daily_motivations FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "daily_motivations_update"
ON daily_motivations FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 21. ACTIONABLE_PLANS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can read their own actionable plans" ON actionable_plans;
DROP POLICY IF EXISTS "Users can manage own actionable plans" ON actionable_plans;
DROP POLICY IF EXISTS "Service role can manage actionable plans" ON actionable_plans;

CREATE POLICY "actionable_plans_select"
ON actionable_plans FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM goals
        WHERE goals.id = actionable_plans.goal_id
        AND goals.user_id = auth.uid()
    )
);

-- =====================================================
-- 22. SUGGESTED_GOALS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can manage own suggested goals" ON suggested_goals;
DROP POLICY IF EXISTS "Users can view own suggested goals" ON suggested_goals;

CREATE POLICY "suggested_goals_all"
ON suggested_goals FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 23. PROGRESS_PHOTOS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can read their own progress photos" ON progress_photos;
DROP POLICY IF EXISTS "Users can insert their own progress photos" ON progress_photos;
DROP POLICY IF EXISTS "Users can update their own progress photos" ON progress_photos;
DROP POLICY IF EXISTS "Users can delete their own progress photos" ON progress_photos;
DROP POLICY IF EXISTS "Users can manage own progress photos" ON progress_photos;
DROP POLICY IF EXISTS "Service role can manage progress photos" ON progress_photos;

CREATE POLICY "progress_photos_all"
ON progress_photos FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 24. HABIT_CHAINS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can view their own habit chains" ON habit_chains;
DROP POLICY IF EXISTS "Users can manage their own habit chains" ON habit_chains;

CREATE POLICY "habit_chains_all"
ON habit_chains FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 26. MEAL_LOGS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can view their own meal logs" ON meal_logs;
DROP POLICY IF EXISTS "Users can create their own meal logs" ON meal_logs;
DROP POLICY IF EXISTS "Users can update their own meal logs" ON meal_logs;
DROP POLICY IF EXISTS "Users can delete their own meal logs" ON meal_logs;
DROP POLICY IF EXISTS "Users can manage own meal logs" ON meal_logs;

CREATE POLICY "meal_logs_all"
ON meal_logs FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 28. DAILY_NUTRITION_SUMMARIES TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can view their own nutrition summaries" ON daily_nutrition_summaries;
DROP POLICY IF EXISTS "Users can manage their own nutrition summaries" ON daily_nutrition_summaries;
DROP POLICY IF EXISTS "Users can view own nutrition summaries" ON daily_nutrition_summaries;

CREATE POLICY "daily_nutrition_summaries_all"
ON daily_nutrition_summaries FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 29. ACCOUNTABILITY_PARTNERS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can view their own partnerships" ON accountability_partners;
DROP POLICY IF EXISTS "Users can create partnership requests" ON accountability_partners;
DROP POLICY IF EXISTS "Users can update their own partnerships" ON accountability_partners;
DROP POLICY IF EXISTS "Users can delete their own partnerships" ON accountability_partners;
DROP POLICY IF EXISTS "Users can manage own partnerships" ON accountability_partners;

CREATE POLICY "accountability_partners_all"
ON accountability_partners FOR ALL TO authenticated
USING (auth.uid() = user_id OR auth.uid() = partner_user_id)
WITH CHECK (auth.uid() = user_id OR auth.uid() = partner_user_id);

-- =====================================================
-- 30. GOAL_SHARES TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can view goal shares for their goals" ON goal_shares;
DROP POLICY IF EXISTS "Goal owners can share their goals" ON goal_shares;
DROP POLICY IF EXISTS "Goal owners can update goal shares" ON goal_shares;
DROP POLICY IF EXISTS "Goal owners can delete goal shares" ON goal_shares;

CREATE POLICY "goal_shares_select"
ON goal_shares FOR SELECT TO authenticated
USING (
    shared_with_user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM goals g
        WHERE g.id = goal_shares.goal_id
        AND g.user_id = auth.uid()
    )
);

CREATE POLICY "goal_shares_insert"
ON goal_shares FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM goals g
        WHERE g.id = goal_shares.goal_id
        AND g.user_id = auth.uid()
    )
);

CREATE POLICY "goal_shares_update"
ON goal_shares FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM goals g
        WHERE g.id = goal_shares.goal_id
        AND g.user_id = auth.uid()
    )
);

CREATE POLICY "goal_shares_delete"
ON goal_shares FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM goals g
        WHERE g.id = goal_shares.goal_id
        AND g.user_id = auth.uid()
    )
);

-- =====================================================
-- 31. GROUP_GOALS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can view group goals they're part of" ON group_goals;
DROP POLICY IF EXISTS "Goal owners can add members to group goals" ON group_goals;
DROP POLICY IF EXISTS "Goal owners and admins can update group members" ON group_goals;
DROP POLICY IF EXISTS "Goal owners and admins can remove group members" ON group_goals;
DROP POLICY IF EXISTS "Users can view group goals they participate in" ON group_goals;

CREATE POLICY "group_goals_select"
ON group_goals FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "group_goals_insert"
ON group_goals FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "group_goals_update"
ON group_goals FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "group_goals_delete"
ON group_goals FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- 32. CHALLENGES TABLE
-- =====================================================
DROP POLICY IF EXISTS "Anyone can read active public challenges" ON challenges;
DROP POLICY IF EXISTS "Anyone can view active challenges" ON challenges;
DROP POLICY IF EXISTS "Anyone can view public challenges" ON challenges;
DROP POLICY IF EXISTS "Authenticated users can create challenges" ON challenges;
DROP POLICY IF EXISTS "Challenge creators can update their challenges" ON challenges;
DROP POLICY IF EXISTS "Service role can manage challenges" ON challenges;
DROP POLICY IF EXISTS "Users can create challenges" ON challenges;
DROP POLICY IF EXISTS "Users can delete own challenges" ON challenges;
DROP POLICY IF EXISTS "Users can read their own challenges" ON challenges;
DROP POLICY IF EXISTS "Users can update own challenges" ON challenges;
DROP POLICY IF EXISTS "Authenticated users can read challenges" ON challenges;
DROP POLICY IF EXISTS "Authenticated users can update own challenges" ON challenges;
DROP POLICY IF EXISTS "Authenticated users can delete own challenges" ON challenges;
DROP POLICY IF EXISTS "challenges_select" ON challenges;
DROP POLICY IF EXISTS "challenges_insert" ON challenges;
DROP POLICY IF EXISTS "challenges_update" ON challenges;
DROP POLICY IF EXISTS "challenges_delete" ON challenges;

CREATE POLICY "challenges_select"
ON challenges FOR SELECT TO authenticated
USING (
    created_by = auth.uid()
    OR EXISTS (
        SELECT 1 FROM challenge_participants cp
        WHERE cp.challenge_id = challenges.id
        AND cp.user_id = auth.uid()
    )
    OR (is_public = true AND is_active = true)
);

CREATE POLICY "challenges_insert"
ON challenges FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "challenges_update"
ON challenges FOR UPDATE TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "challenges_delete"
ON challenges FOR DELETE TO authenticated
USING (created_by = auth.uid());

-- =====================================================
-- 33. CHALLENGE_PARTICIPANTS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Service role can manage challenge participants" ON challenge_participants;
DROP POLICY IF EXISTS "Users can join challenges" ON challenge_participants;
DROP POLICY IF EXISTS "Users can manage own challenge participation" ON challenge_participants;
DROP POLICY IF EXISTS "Users can read challenge participants" ON challenge_participants;
DROP POLICY IF EXISTS "Users can update their own participation" ON challenge_participants;
DROP POLICY IF EXISTS "Authenticated users can read challenge participants" ON challenge_participants;
DROP POLICY IF EXISTS "Authenticated users can join challenges" ON challenge_participants;
DROP POLICY IF EXISTS "Authenticated users can update own participation" ON challenge_participants;
DROP POLICY IF EXISTS "Authenticated users can leave challenges" ON challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_select" ON challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_insert" ON challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_update" ON challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_delete" ON challenge_participants;

CREATE POLICY "challenge_participants_select"
ON challenge_participants FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM challenge_participants my_p
        WHERE my_p.challenge_id = challenge_participants.challenge_id
        AND my_p.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM challenges c
        WHERE c.id = challenge_participants.challenge_id
        AND c.is_public = true
    )
);

CREATE POLICY "challenge_participants_insert"
ON challenge_participants FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "challenge_participants_update"
ON challenge_participants FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "challenge_participants_delete"
ON challenge_participants FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- =====================================================
-- 34. CHALLENGE_CHECK_INS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can view challenge check-ins for challenges they participate in" ON challenge_check_ins;
DROP POLICY IF EXISTS "Users can view challenge check-ins for challenges they particip" ON challenge_check_ins;
DROP POLICY IF EXISTS "Users can view challenge check-ins" ON challenge_check_ins;
DROP POLICY IF EXISTS "Users can create their own challenge check-ins" ON challenge_check_ins;
DROP POLICY IF EXISTS "Users can update their own challenge check-ins" ON challenge_check_ins;
DROP POLICY IF EXISTS "Users can delete their own challenge check-ins" ON challenge_check_ins;
DROP POLICY IF EXISTS "Authenticated users can view challenge check-ins" ON challenge_check_ins;
DROP POLICY IF EXISTS "temp_all_access" ON challenge_check_ins;
DROP POLICY IF EXISTS "challenge_check_ins_select" ON challenge_check_ins;
DROP POLICY IF EXISTS "challenge_check_ins_insert" ON challenge_check_ins;
DROP POLICY IF EXISTS "challenge_check_ins_update" ON challenge_check_ins;
DROP POLICY IF EXISTS "challenge_check_ins_delete" ON challenge_check_ins;

CREATE POLICY "challenge_check_ins_select"
ON challenge_check_ins FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM challenge_participants cp
        WHERE cp.challenge_id = challenge_check_ins.challenge_id
        AND cp.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM challenges c
        WHERE c.id = challenge_check_ins.challenge_id
        AND c.is_public = true
    )
);

CREATE POLICY "challenge_check_ins_insert"
ON challenge_check_ins FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "challenge_check_ins_update"
ON challenge_check_ins FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "challenge_check_ins_delete"
ON challenge_check_ins FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- =====================================================
-- 35. CHALLENGE_LEADERBOARD TABLE
-- =====================================================
DROP POLICY IF EXISTS "Service role can manage leaderboard" ON challenge_leaderboard;
DROP POLICY IF EXISTS "Anyone can view challenge leaderboard" ON challenge_leaderboard;
DROP POLICY IF EXISTS "challenge_leaderboard_select" ON challenge_leaderboard;

CREATE POLICY "challenge_leaderboard_select"
ON challenge_leaderboard FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM challenge_participants cp
        WHERE cp.challenge_id = challenge_leaderboard.challenge_id
        AND cp.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM challenges c
        WHERE c.id = challenge_leaderboard.challenge_id
        AND c.is_public = true
    )
);

-- =====================================================
-- 36. SUBSCRIPTION_PLANS TABLE (all authenticated can view)
-- =====================================================
DROP POLICY IF EXISTS "Allow read access to active subscription plans" ON subscription_plans;
DROP POLICY IF EXISTS "Anyone can view subscription plans" ON subscription_plans;
DROP POLICY IF EXISTS "Only admins can manage subscription plans" ON subscription_plans;
DROP POLICY IF EXISTS "Service role can modify subscription plans" ON subscription_plans;

CREATE POLICY "subscription_plans_select"
ON subscription_plans FOR SELECT TO authenticated
USING (is_active = true);

-- =====================================================
-- 37. PLAN_FEATURES TABLE (all authenticated can view)
-- =====================================================
DROP POLICY IF EXISTS "Allow read access to plan features" ON plan_features;
DROP POLICY IF EXISTS "Anyone can view plan features" ON plan_features;
DROP POLICY IF EXISTS "Only admins can manage plan features" ON plan_features;
DROP POLICY IF EXISTS "Service role can modify plan features" ON plan_features;

CREATE POLICY "plan_features_select"
ON plan_features FOR SELECT TO authenticated
USING (true);

-- =====================================================
-- 38. EXERCISES TABLE (all authenticated can view)
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view exercises" ON exercises;
DROP POLICY IF EXISTS "Only admins can manage exercises" ON exercises;

CREATE POLICY "exercises_select"
ON exercises FOR SELECT TO authenticated
USING (true);

-- =====================================================
-- 40. SOCIAL_NUDGES TABLE
-- =====================================================
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'social_nudges') THEN
        -- Drop old policies
        DROP POLICY IF EXISTS "Users can view their own nudges" ON social_nudges;
        DROP POLICY IF EXISTS "Users can create nudges" ON social_nudges;
        DROP POLICY IF EXISTS "Users can update their received nudges" ON social_nudges;
        DROP POLICY IF EXISTS "Users can delete nudges they sent" ON social_nudges;
        DROP POLICY IF EXISTS "social_nudges_select" ON social_nudges;
        DROP POLICY IF EXISTS "social_nudges_insert" ON social_nudges;
        DROP POLICY IF EXISTS "social_nudges_update" ON social_nudges;
        DROP POLICY IF EXISTS "social_nudges_delete" ON social_nudges;
        
        EXECUTE 'CREATE POLICY "social_nudges_select" ON social_nudges FOR SELECT TO authenticated USING (sender_id = auth.uid() OR recipient_id = auth.uid())';
        EXECUTE 'CREATE POLICY "social_nudges_insert" ON social_nudges FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid())';
        EXECUTE 'CREATE POLICY "social_nudges_update" ON social_nudges FOR UPDATE TO authenticated USING (recipient_id = auth.uid())';
        EXECUTE 'CREATE POLICY "social_nudges_delete" ON social_nudges FOR DELETE TO authenticated USING (sender_id = auth.uid())';
    END IF;
END $$;

-- =====================================================
-- 41. SENT_MOTIVATIONS TABLE
-- =====================================================
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sent_motivations') THEN
        DROP POLICY IF EXISTS "sent_motivations_select" ON sent_motivations;
        EXECUTE 'CREATE POLICY "sent_motivations_select" ON sent_motivations FOR SELECT TO authenticated USING (auth.uid() = user_id)';
    END IF;
END $$;

-- =====================================================
-- 42. AI_CHAT_MESSAGES TABLE
-- =====================================================
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ai_chat_messages') THEN
        DROP POLICY IF EXISTS "ai_chat_messages_all" ON ai_chat_messages;
        EXECUTE 'CREATE POLICY "ai_chat_messages_all" ON ai_chat_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
    END IF;
END $$;

-- =====================================================
-- 43. API_KEYS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can only see their own API keys" ON api_keys;

CREATE POLICY "api_keys_all"
ON api_keys FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 44. REFRESH_TOKENS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can only see their own refresh tokens" ON refresh_tokens;

CREATE POLICY "refresh_tokens_all"
ON refresh_tokens FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 45. ADMIN_USERS TABLE (admin only - keep existing logic)
-- =====================================================
DROP POLICY IF EXISTS "Only admins can access admin_users" ON admin_users;

CREATE POLICY "admin_users_all"
ON admin_users FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM admin_users au
        WHERE au.user_id = auth.uid()
        AND au.is_active = true
    )
);

-- =====================================================
-- 46. AUDIT_LOGS TABLE (admin only)
-- =====================================================
DROP POLICY IF EXISTS "Only admins can access audit_logs" ON audit_logs;

CREATE POLICY "audit_logs_all"
ON audit_logs FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM admin_users au
        WHERE au.user_id = auth.uid()
        AND au.is_active = true
    )
);

-- =====================================================
-- 47. PASSWORD_RESET_TOKENS TABLE (no user access)
-- =====================================================
DROP POLICY IF EXISTS "Service role only" ON password_reset_tokens;
DROP POLICY IF EXISTS "password_reset_tokens_service_all" ON password_reset_tokens;

CREATE POLICY "password_reset_tokens_deny"
ON password_reset_tokens FOR ALL TO authenticated
USING (false);

-- =====================================================
-- 48. EMAIL_VERIFICATION_CODES TABLE (no user access)
-- =====================================================
DROP POLICY IF EXISTS "Service role only" ON email_verification_codes;
DROP POLICY IF EXISTS "email_verification_codes_service_all" ON email_verification_codes;

CREATE POLICY "email_verification_codes_deny"
ON email_verification_codes FOR ALL TO authenticated
USING (false);

-- =====================================================
-- 49. SUBSCRIPTION_DEACTIVATION_LOGS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users can view their own deactivation logs" ON subscription_deactivation_logs;
DROP POLICY IF EXISTS "Service role can manage deactivation logs" ON subscription_deactivation_logs;

CREATE POLICY "subscription_deactivation_logs_select"
ON subscription_deactivation_logs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- 50. GOAL_TEMPLATES TABLE (all authenticated can view)
-- =====================================================
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'goal_templates') THEN
        EXECUTE 'CREATE POLICY "goal_templates_select" ON goal_templates FOR SELECT TO authenticated USING (true)';
    END IF;
END $$;

-- =====================================================
-- 51. WEBHOOK_EVENTS TABLE (no user access)
-- =====================================================
DROP POLICY IF EXISTS "Service role only access webhook_events" ON webhook_events;

CREATE POLICY "webhook_events_deny"
ON webhook_events FOR ALL TO authenticated
USING (false);

-- =====================================================
-- 52. SECURITY_EVENTS TABLE (user can see own)
-- =====================================================
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'security_events') THEN
        DROP POLICY IF EXISTS "security_events_select" ON security_events;
        EXECUTE 'CREATE POLICY "security_events_select" ON security_events FOR SELECT TO authenticated USING (auth.uid() = user_id)';
    END IF;
END $$;

-- =====================================================
-- 53. ACCOUNT_LOCKOUTS TABLE (user can see own)
-- =====================================================
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'account_lockouts') THEN
        DROP POLICY IF EXISTS "account_lockouts_select" ON account_lockouts;
        DROP POLICY IF EXISTS "account_lockouts_deny" ON account_lockouts;
        -- account_lockouts uses email_hash, not user_id - deny all authenticated access
        EXECUTE 'CREATE POLICY "account_lockouts_deny" ON account_lockouts FOR ALL TO authenticated USING (false)';
    END IF;
END $$;

-- =====================================================
-- 54. FAILED_LOGIN_ATTEMPTS TABLE (no user access)
-- =====================================================
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'failed_login_attempts') THEN
        DROP POLICY IF EXISTS "failed_login_attempts_deny" ON failed_login_attempts;
        EXECUTE 'CREATE POLICY "failed_login_attempts_deny" ON failed_login_attempts FOR ALL TO authenticated USING (false)';
    END IF;
END $$;

-- =====================================================
-- 55. OFFER_CODES TABLE (all authenticated can view active)
-- =====================================================
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'offer_codes') THEN
        DROP POLICY IF EXISTS "offer_codes_select" ON offer_codes;
        EXECUTE 'CREATE POLICY "offer_codes_select" ON offer_codes FOR SELECT TO authenticated USING (is_active = true)';
    END IF;
END $$;

-- =====================================================
-- SET REPLICA IDENTITY FULL FOR REALTIME TABLES
-- =====================================================
ALTER TABLE users REPLICA IDENTITY FULL;
ALTER TABLE goals REPLICA IDENTITY FULL;
ALTER TABLE check_ins REPLICA IDENTITY FULL;
ALTER TABLE challenges REPLICA IDENTITY FULL;
ALTER TABLE challenge_participants REPLICA IDENTITY FULL;
ALTER TABLE challenge_check_ins REPLICA IDENTITY FULL;
ALTER TABLE challenge_leaderboard REPLICA IDENTITY FULL;
ALTER TABLE subscriptions REPLICA IDENTITY FULL;
ALTER TABLE daily_motivations REPLICA IDENTITY FULL;
ALTER TABLE accountability_partners REPLICA IDENTITY FULL;
ALTER TABLE group_goals REPLICA IDENTITY FULL;
ALTER TABLE user_achievements REPLICA IDENTITY FULL;

-- =====================================================
-- DOCUMENTATION
-- =====================================================
COMMENT ON SCHEMA public IS 
'All RLS policies fixed to use TO authenticated.
Only blog/system_health tables remain TO public.
Realtime will now properly evaluate auth.uid() for authenticated users.';
