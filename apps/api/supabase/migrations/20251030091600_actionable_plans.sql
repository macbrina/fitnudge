-- =====================================================
-- ACTIONABLE PLANS TABLE
-- =====================================================

-- Create actionable_plans table
CREATE TABLE actionable_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    plan_type TEXT NOT NULL CHECK (plan_type IN ('meal_plan', 'workout_plan', 'habit_plan', 'accountability_plan')),
    structured_data JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
    error_message TEXT,
    generated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one plan per goal
    UNIQUE(goal_id)
);

-- Add indexes
CREATE INDEX idx_actionable_plans_goal_id ON actionable_plans(goal_id);
CREATE INDEX idx_actionable_plans_status ON actionable_plans(status);
CREATE INDEX idx_actionable_plans_plan_type ON actionable_plans(plan_type);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_actionable_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_actionable_plans_updated_at
    BEFORE UPDATE ON actionable_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_actionable_plans_updated_at();

-- Enable RLS
ALTER TABLE actionable_plans ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own plans
CREATE POLICY "Users can read their own actionable plans" ON actionable_plans
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM goals
            WHERE goals.id = actionable_plans.goal_id
            AND goals.user_id = auth.uid()
        )
    );

-- Service role can do everything
CREATE POLICY "Service role can manage actionable plans" ON actionable_plans
    FOR ALL
    USING (auth.role() = 'service_role');

