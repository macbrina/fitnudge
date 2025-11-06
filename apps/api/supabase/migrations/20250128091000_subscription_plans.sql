-- =====================================================
-- SUBSCRIPTION PLANS TABLE
-- =====================================================

-- Create subscription_plans table
CREATE TABLE subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    monthly_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    annual_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    goal_limit INTEGER, -- NULL means unlimited
    active_goal_limit INTEGER DEFAULT 1, -- Number of goals that can be active simultaneously
    is_popular BOOLEAN DEFAULT false,
    has_trial BOOLEAN DEFAULT false,
    trial_days INTEGER,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PLAN FEATURES TABLE
-- =====================================================

-- Create plan_features table
CREATE TABLE plan_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id TEXT NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    feature_name TEXT NOT NULL,
    feature_description TEXT,
    feature_value INTEGER, -- For numeric features (e.g., goal count, reminder count)
    is_enabled BOOLEAN DEFAULT true, -- For boolean features
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique feature per plan
    UNIQUE(plan_id, feature_key)
);

-- Add indexes for plan_features
CREATE INDEX idx_plan_features_plan_id ON plan_features(plan_id);
CREATE INDEX idx_plan_features_key ON plan_features(feature_key);
CREATE INDEX idx_plan_features_enabled ON plan_features(is_enabled);

-- Add indexes
CREATE INDEX idx_subscription_plans_active ON subscription_plans(is_active);
CREATE INDEX idx_subscription_plans_sort_order ON subscription_plans(sort_order);

-- Insert default plans
INSERT INTO subscription_plans (id, name, description, monthly_price, annual_price, goal_limit, active_goal_limit, is_popular, has_trial, trial_days, sort_order) VALUES
('free', 'Free', 'Perfect for getting started', 0.00, 0.00, 1, 1, false, false, null, 1),
('starter', 'Starter', 'For regular fitness enthusiasts', 2.99, 29.99, 3, 2, false, false, null, 2),
('pro', 'Pro', 'Advanced features for serious users', 4.99, 49.99, null, 3, true, true, 3, 3),
('coach_plus', 'Coach+', 'Everything you need to succeed', 9.99, 99.99, null, 3, false, false, null, 4);

-- Insert plan features
-- Free plan features
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order) VALUES
('free', 'goals', 'Goals', 'Number of goals you can create', 1, true, 1),
('free', 'text_motivation', 'Text Motivation', 'AI-powered text motivation messages', null, true, 2),
('free', 'community_access', 'Community Access', 'Access to community features', null, true, 3);

-- Starter plan features
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order) VALUES
('starter', 'goals', 'Goals', 'Number of goals you can create', 3, true, 1),
('starter', 'unlimited_text_motivation', 'Unlimited Text Motivation', 'Unlimited AI-powered text motivation messages', null, true, 2),
('starter', 'full_social_features', 'Full Social Features', 'Complete access to all social features', null, true, 3),
('starter', 'basic_analytics', 'Basic Analytics', 'Basic progress and performance analytics', null, true, 4);

-- Pro plan features
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order) VALUES
('pro', 'unlimited_goals', 'Unlimited Goals', 'Create unlimited goals', null, true, 1),
('pro', 'ai_voice_motivation', 'AI Voice Motivation', 'AI-powered voice motivation calls', null, true, 2),
('pro', 'advanced_analytics', 'Advanced Analytics', 'Detailed progress and performance analytics', null, true, 3),
('pro', 'priority_features', 'Priority Features', 'Early access to new features', null, true, 4);

-- Coach+ plan features
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, sort_order) VALUES
('coach_plus', 'unlimited_goals', 'Unlimited Goals', 'Create unlimited goals', null, true, 1),
('coach_plus', 'ai_voice_motivation', 'AI Voice Motivation', 'AI-powered voice motivation calls', null, true, 2),
('coach_plus', 'advanced_analytics', 'Advanced Analytics', 'Detailed progress and performance analytics', null, true, 3),
('coach_plus', 'priority_features', 'Priority Features', 'Early access to new features', null, true, 4),
('coach_plus', 'ai_memory_personalization', 'AI Memory & Personalization', 'AI learns and adapts to your preferences', null, true, 5),
('coach_plus', 'api_integrations', 'API Integrations', 'Connect with external fitness apps and devices', null, true, 6),
('coach_plus', 'priority_support', 'Priority Support', 'Priority customer support', null, true, 7);

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_subscription_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to update plan_features updated_at
CREATE OR REPLACE FUNCTION update_plan_features_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER trigger_update_subscription_plans_updated_at
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_plans_updated_at();

CREATE TRIGGER trigger_update_plan_features_updated_at
    BEFORE UPDATE ON plan_features
    FOR EACH ROW
    EXECUTE FUNCTION update_plan_features_updated_at();

-- Add RLS policies
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;

-- Allow all users to read active plans
CREATE POLICY "Allow read access to active subscription plans" ON subscription_plans
    FOR SELECT USING (is_active = true);

-- Allow all users to read features for active plans
CREATE POLICY "Allow read access to plan features" ON plan_features
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM subscription_plans 
            WHERE subscription_plans.id = plan_features.plan_id 
            AND subscription_plans.is_active = true
        )
    );

-- Only service role can modify plans and features
CREATE POLICY "Service role can modify subscription plans" ON subscription_plans
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can modify plan features" ON plan_features
    FOR ALL USING (auth.role() = 'service_role');
