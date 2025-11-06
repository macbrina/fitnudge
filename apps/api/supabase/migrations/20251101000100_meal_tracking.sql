-- =====================================================
-- MEAL TRACKING SYSTEM
-- =====================================================

-- Table for meal logs
CREATE TABLE meal_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'other')),
    meal_name TEXT,
    meal_description TEXT,
    logged_date DATE NOT NULL,
    logged_time TIME, -- Time of meal (optional)
    
    -- Nutritional data (optional, for accountability tracking)
    estimated_protein INTEGER, -- in grams
    estimated_calories INTEGER, -- in calories
    notes TEXT, -- Additional notes about the meal
    
    photo_urls TEXT[], -- Array of photo URLs for meal photos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for daily nutrition summaries (for accountability)
-- Aggregates meal data per day for easier tracking
CREATE TABLE daily_nutrition_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
    summary_date DATE NOT NULL,
    
    -- Aggregated nutritional data
    total_protein INTEGER DEFAULT 0, -- in grams
    total_calories INTEGER DEFAULT 0, -- in calories
    meal_count INTEGER DEFAULT 0, -- Number of meals logged
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one summary per user per date per goal
    UNIQUE(user_id, goal_id, summary_date)
);

-- Indexes for performance
CREATE INDEX idx_meal_logs_user_id ON meal_logs(user_id);
CREATE INDEX idx_meal_logs_goal_id ON meal_logs(goal_id);
CREATE INDEX idx_meal_logs_logged_date ON meal_logs(logged_date DESC);
CREATE INDEX idx_meal_logs_user_date ON meal_logs(user_id, logged_date DESC);
CREATE INDEX idx_meal_logs_meal_type ON meal_logs(meal_type);

CREATE INDEX idx_daily_nutrition_user_id ON daily_nutrition_summaries(user_id);
CREATE INDEX idx_daily_nutrition_goal_id ON daily_nutrition_summaries(goal_id);
CREATE INDEX idx_daily_nutrition_date ON daily_nutrition_summaries(summary_date DESC);
CREATE INDEX idx_daily_nutrition_user_date ON daily_nutrition_summaries(user_id, summary_date DESC);

-- Add updated_at trigger
CREATE TRIGGER update_meal_logs_updated_at 
    BEFORE UPDATE ON meal_logs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_nutrition_summaries_updated_at 
    BEFORE UPDATE ON daily_nutrition_summaries 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update daily nutrition summary when meal is added/updated/deleted
CREATE OR REPLACE FUNCTION update_daily_nutrition_summary()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO daily_nutrition_summaries (
        user_id,
        goal_id,
        summary_date,
        total_protein,
        total_calories,
        meal_count
    )
    SELECT
        user_id,
        goal_id,
        logged_date,
        COALESCE(SUM(estimated_protein), 0),
        COALESCE(SUM(estimated_calories), 0),
        COUNT(*)
    FROM meal_logs
    WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
        AND logged_date = COALESCE(NEW.logged_date, OLD.logged_date)
        AND (goal_id = COALESCE(NEW.goal_id, OLD.goal_id) OR goal_id IS NULL)
    GROUP BY user_id, goal_id, logged_date
    ON CONFLICT (user_id, goal_id, summary_date) 
    DO UPDATE SET
        total_protein = EXCLUDED.total_protein,
        total_calories = EXCLUDED.total_calories,
        meal_count = EXCLUDED.meal_count,
        updated_at = NOW();
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update daily summary on meal log changes
CREATE TRIGGER trigger_update_daily_nutrition_summary
    AFTER INSERT OR UPDATE OR DELETE ON meal_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_nutrition_summary();

-- Enable RLS
ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_nutrition_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meal_logs
CREATE POLICY "Users can view their own meal logs" ON meal_logs
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create their own meal logs" ON meal_logs
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own meal logs" ON meal_logs
    FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own meal logs" ON meal_logs
    FOR DELETE
    USING (user_id = auth.uid());

-- RLS Policies for daily_nutrition_summaries
CREATE POLICY "Users can view their own nutrition summaries" ON daily_nutrition_summaries
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own nutrition summaries" ON daily_nutrition_summaries
    FOR ALL
    USING (user_id = auth.uid());

