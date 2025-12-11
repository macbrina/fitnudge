-- =====================================================
-- COMPREHENSIVE RLS POLICIES FOR ALL TABLES
-- Security: Protect user data and admin-only resources
-- =====================================================

-- =====================================================
-- 1. BLOG POSTS (Admin-only write, public read)
-- =====================================================

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_tags ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (from initial schema)
DROP POLICY IF EXISTS "Anyone can view published blog posts" ON blog_posts;

-- Public can view published posts
CREATE POLICY "Anyone can view published blog posts" ON blog_posts
    FOR SELECT USING (status = 'published');

-- Only admins can create blog posts
CREATE POLICY "Only admins can create blog posts" ON blog_posts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM admin_users au
            WHERE au.user_id = auth.uid()
            AND au.role = 'admin'
            AND au.is_active = true
        )
    );

-- Only admins can update blog posts
CREATE POLICY "Only admins can update blog posts" ON blog_posts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM admin_users au
            WHERE au.user_id = auth.uid()
            AND au.role = 'admin'
            AND au.is_active = true
        )
    );

-- Only admins can delete blog posts
CREATE POLICY "Only admins can delete blog posts" ON blog_posts
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM admin_users au
            WHERE au.user_id = auth.uid()
            AND au.role = 'admin'
            AND au.is_active = true
        )
    );

-- Blog categories: public read, admin write
CREATE POLICY "Anyone can view blog categories" ON blog_categories FOR SELECT USING (true);
CREATE POLICY "Only admins can manage blog categories" ON blog_categories FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Blog tags: public read, admin write
CREATE POLICY "Anyone can view blog tags" ON blog_tags FOR SELECT USING (true);
CREATE POLICY "Only admins can manage blog tags" ON blog_tags FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Blog relationships: follow parent table permissions
CREATE POLICY "Follow blog_posts permissions" ON blog_post_categories FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)
);
CREATE POLICY "Follow blog_posts permissions" ON blog_post_tags FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)
);

-- =====================================================
-- 2. DAILY MOTIVATIONS (User read own, admin write)
-- =====================================================

ALTER TABLE daily_motivations ENABLE ROW LEVEL SECURITY;

-- Users can view their own motivations
CREATE POLICY "Users can view own motivations" ON daily_motivations
    FOR SELECT USING (auth.uid() = user_id);

-- Only backend/admin can insert motivations (via service role)
CREATE POLICY "Only admins can create motivations" ON daily_motivations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM admin_users au
            WHERE au.user_id = auth.uid()
            AND au.is_active = true
        )
    );

-- Users can update share_count on their own motivations
CREATE POLICY "Users can update own motivation share count" ON daily_motivations
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Only admins can delete motivations
CREATE POLICY "Only admins can delete motivations" ON daily_motivations
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM admin_users au
            WHERE au.user_id = auth.uid()
            AND au.is_active = true
        )
    );

-- =====================================================
-- 3. DEVICE TOKENS (User manage own)
-- =====================================================
-- Note: Created in notification_preferences migration

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'device_tokens') THEN
        ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can manage own device tokens" ON device_tokens
            FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- =====================================================
-- 4. NOTIFICATIONS (User read/update own)
-- =====================================================
-- Note: notifications table doesn't exist yet, will add RLS when created

-- ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can view own notifications" ON notifications
--     FOR SELECT USING (auth.uid() = user_id);

-- =====================================================
-- 5. NOTIFICATION PREFERENCES (User manage own)
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notification_preferences') THEN
        ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can manage own notification preferences" ON notification_preferences
            FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- =====================================================
-- 6. ACTIONABLE PLANS (User manage own)
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'actionable_plans') THEN
        ALTER TABLE actionable_plans ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can manage own actionable plans" ON actionable_plans
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM goals g
                    WHERE g.id = actionable_plans.goal_id
                    AND g.user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- =====================================================
-- 7. SUGGESTED GOALS (User manage own)
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'suggested_goals') THEN
        ALTER TABLE suggested_goals ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can manage own suggested goals" ON suggested_goals
            FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- =====================================================
-- 8. USER ACHIEVEMENTS (User read own, backend write)
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_achievements') THEN
        ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can view own achievements" ON user_achievements
            FOR SELECT USING (auth.uid() = user_id);
        
        CREATE POLICY "Only admins can manage achievements" ON user_achievements
            FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM admin_users au
                    WHERE au.user_id = auth.uid()
                    AND au.is_active = true
                )
            );
        
        CREATE POLICY "Only admins can update achievements" ON user_achievements
            FOR UPDATE USING (
                EXISTS (
                    SELECT 1 FROM admin_users au
                    WHERE au.user_id = auth.uid()
                    AND au.is_active = true
                )
            );
    END IF;
END $$;

-- =====================================================
-- 9. ACHIEVEMENT BADGES (Public read, admin write)
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'achievement_badges') THEN
        ALTER TABLE achievement_badges ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Anyone can view achievement badges" ON achievement_badges
            FOR SELECT USING (true);
        
        CREATE POLICY "Only admins can manage badges" ON achievement_badges
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM admin_users au
                    WHERE au.user_id = auth.uid()
                    AND au.is_active = true
                )
            );
    END IF;
END $$;

-- =====================================================
-- 10. PROGRESS PHOTOS (User manage own)
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'progress_photos') THEN
        ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can manage own progress photos" ON progress_photos
            FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- =====================================================
-- 11. CHALLENGES (Public read active, user manage own)
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'challenges') THEN
        ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
        
        -- Anyone can view public active challenges, users can view their own
        CREATE POLICY "Anyone can view active challenges" ON challenges
            FOR SELECT USING (
                (is_public = true AND is_active = true)
                OR created_by = auth.uid()
            );
        
        -- Users can create challenges
        CREATE POLICY "Authenticated users can create challenges" ON challenges
            FOR INSERT WITH CHECK (auth.uid() = created_by);
        
        -- Users can update own challenges
        CREATE POLICY "Users can update own challenges" ON challenges
            FOR UPDATE USING (auth.uid() = created_by);
        
        -- Users can delete own challenges
        CREATE POLICY "Users can delete own challenges" ON challenges
            FOR DELETE USING (auth.uid() = created_by);
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'challenge_participants') THEN
        ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;
        
        -- Challenge participants: users can manage own participation
        CREATE POLICY "Users can manage own challenge participation" ON challenge_participants
            FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- =====================================================
-- 12. MEAL TRACKING (User manage own)
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'meal_logs') THEN
        ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can manage own meal logs" ON meal_logs
            FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'meal_photos') THEN
        ALTER TABLE meal_photos ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can manage own meal photos" ON meal_photos
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM meal_logs ml
                    WHERE ml.id = meal_photos.meal_log_id
                    AND ml.user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- =====================================================
-- 13. HABIT CHAINS (User manage own)
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'habit_chain_logs') THEN
        ALTER TABLE habit_chain_logs ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can manage own habit chains" ON habit_chain_logs
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM goals g
                    WHERE g.id = habit_chain_logs.goal_id
                    AND g.user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- =====================================================
-- 14. SUBSCRIPTION PLANS (Public read, admin write)
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscription_plans') THEN
        ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Anyone can view subscription plans" ON subscription_plans
            FOR SELECT USING (is_active = true);
        
        CREATE POLICY "Only admins can manage subscription plans" ON subscription_plans
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM admin_users au
                    WHERE au.user_id = auth.uid()
                    AND au.is_active = true
                )
            );
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'plan_features') THEN
        ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Anyone can view plan features" ON plan_features
            FOR SELECT USING (true);
        
        CREATE POLICY "Only admins can manage plan features" ON plan_features
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM admin_users au
                    WHERE au.user_id = auth.uid()
                    AND au.is_active = true
                )
            );
    END IF;
END $$;

-- =====================================================
-- 15. BACKEND-ONLY TABLES (Service role only)
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'password_reset_tokens') THEN
        ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Service role only" ON password_reset_tokens
            FOR ALL USING (false); -- No user access, service role bypasses RLS
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'email_verification_codes') THEN
        ALTER TABLE email_verification_codes ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Service role only" ON email_verification_codes
            FOR ALL USING (false); -- No user access, service role bypasses RLS
    END IF;
END $$;

-- =====================================================
-- 16. USER FITNESS PROFILES (User manage own)
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_fitness_profiles') THEN
        ALTER TABLE user_fitness_profiles ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can manage own fitness profile" ON user_fitness_profiles
            FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- =====================================================
-- 17. SYSTEM HEALTH (Admin only)
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'system_health_updates') THEN
        ALTER TABLE system_health_updates ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Anyone can view active system health updates" ON system_health_updates
            FOR SELECT USING (status = 'active');
        
        CREATE POLICY "Only admins can manage system health" ON system_health_updates
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM admin_users au
                    WHERE au.user_id = auth.uid()
                    AND au.is_active = true
                )
            );
    END IF;
END $$;

-- =====================================================
-- DOCUMENTATION
-- =====================================================

COMMENT ON POLICY "Anyone can view published blog posts" ON blog_posts IS 
'Public access to published blog content';

COMMENT ON POLICY "Users can view own motivations" ON daily_motivations IS 
'Users can only view their own AI-generated motivations';

COMMENT ON POLICY "Users can manage own device tokens" ON device_tokens IS 
'Users can register/update/delete their own push notification tokens';

COMMENT ON POLICY "Service role only" ON password_reset_tokens IS 
'Backend-only table, no direct user access. Service role bypasses RLS.';

