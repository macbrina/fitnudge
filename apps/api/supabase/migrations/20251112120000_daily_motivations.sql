-- =====================================================
-- Daily Motivations Table Migration
-- Separate table for daily AI-generated motivational messages
-- =====================================================

-- Create daily_motivations table
CREATE TABLE daily_motivations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    background_style TEXT DEFAULT 'gradient_sunset', -- Predefined background styles
    date DATE NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    share_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date) -- Ensures only ONE motivation per day per user
);

-- Create indexes for performance
CREATE INDEX idx_daily_motivations_user_id ON daily_motivations(user_id);
CREATE INDEX idx_daily_motivations_date ON daily_motivations(date DESC);
CREATE INDEX idx_daily_motivations_user_date ON daily_motivations(user_id, date DESC);

-- Add comment for documentation
COMMENT ON TABLE daily_motivations IS 'Daily AI-generated motivational messages for users, one per day per user';
COMMENT ON COLUMN daily_motivations.background_style IS 'Predefined background style for the motivation display (e.g., gradient_sunset, gradient_mountain, etc.)';
COMMENT ON COLUMN daily_motivations.share_count IS 'Number of times this motivation has been shared';

