-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_motivations ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view public profiles" ON users
    FOR SELECT USING (true);

-- OAuth accounts policies
CREATE POLICY "Users can view their own oauth accounts" ON oauth_accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own oauth accounts" ON oauth_accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own oauth accounts" ON oauth_accounts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own oauth accounts" ON oauth_accounts
    FOR DELETE USING (auth.uid() = user_id);

-- Goals policies
CREATE POLICY "Users can view their own goals" ON goals
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goals" ON goals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals" ON goals
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals" ON goals
    FOR DELETE USING (auth.uid() = user_id);

-- Check-ins policies
CREATE POLICY "Users can view their own check-ins" ON check_ins
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own check-ins" ON check_ins
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own check-ins" ON check_ins
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own check-ins" ON check_ins
    FOR DELETE USING (auth.uid() = user_id);

-- AI motivations policies
CREATE POLICY "Users can view their own motivations" ON ai_motivations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own motivations" ON ai_motivations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own motivations" ON ai_motivations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own motivations" ON ai_motivations
    FOR DELETE USING (auth.uid() = user_id);

-- Posts policies
CREATE POLICY "Users can view public posts" ON posts
    FOR SELECT USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Users can insert their own posts" ON posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts" ON posts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts" ON posts
    FOR DELETE USING (auth.uid() = user_id);

-- Post reactions policies
CREATE POLICY "Users can view all post reactions" ON post_reactions
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own reactions" ON post_reactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reactions" ON post_reactions
    FOR DELETE USING (auth.uid() = user_id);

-- Comments policies
CREATE POLICY "Users can view all comments" ON comments
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own comments" ON comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON comments
    FOR DELETE USING (auth.uid() = user_id);

-- User follows policies
CREATE POLICY "Users can view all follows" ON user_follows
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own follows" ON user_follows
    FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can delete their own follows" ON user_follows
    FOR DELETE USING (auth.uid() = follower_id);

-- Subscriptions policies
CREATE POLICY "Users can view their own subscriptions" ON subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions" ON subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions" ON subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

-- Blog posts policies (public read access)
CREATE POLICY "Anyone can view published blog posts" ON blog_posts
    FOR SELECT USING (is_published = true);

-- Create function to get user's followers count
CREATE OR REPLACE FUNCTION get_user_followers_count(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*) 
        FROM user_follows 
        WHERE following_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user's following count
CREATE OR REPLACE FUNCTION get_user_following_count(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*) 
        FROM user_follows 
        WHERE follower_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user's posts count
CREATE OR REPLACE FUNCTION get_user_posts_count(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*) 
        FROM posts 
        WHERE user_id = user_uuid AND is_public = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is following another user
CREATE OR REPLACE FUNCTION is_user_following(follower_uuid UUID, following_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM user_follows 
        WHERE follower_id = follower_uuid AND following_id = following_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user liked a post
CREATE OR REPLACE FUNCTION has_user_liked_post(user_uuid UUID, post_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM post_reactions 
        WHERE user_id = user_uuid AND post_id = post_uuid AND reaction_type = 'like'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
