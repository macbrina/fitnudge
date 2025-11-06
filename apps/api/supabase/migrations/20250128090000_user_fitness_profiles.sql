-- =====================================================
-- User Fitness Profiles Migration
-- Stores personalization data collected during onboarding
-- =====================================================

-- Create user_fitness_profiles table
CREATE TABLE user_fitness_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fitness_level TEXT NOT NULL CHECK (fitness_level IN ('beginner', 'intermediate', 'advanced', 'athlete')),
    primary_goal TEXT NOT NULL CHECK (primary_goal IN ('lose_weight', 'build_muscle', 'stay_active', 'general_fitness', 'sport_specific')),
    current_frequency TEXT NOT NULL CHECK (current_frequency IN ('never', '1-2x_week', '3-4x_week', '5+_week', 'daily')),
    preferred_location TEXT NOT NULL CHECK (preferred_location IN ('gym', 'home', 'outdoor', 'mix', 'dont_know')),
    available_time TEXT NOT NULL CHECK (available_time IN ('less_30min', '30-60min', '1-2hrs', 'flexible')),
    motivation_style TEXT NOT NULL CHECK (motivation_style IN ('tough_love', 'gentle_encouragement', 'data_driven', 'accountability_buddy')),
    biggest_challenge TEXT NOT NULL CHECK (biggest_challenge IN ('staying_consistent', 'getting_started', 'time_management', 'lack_of_knowledge')),
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id) -- One profile per user
);

-- Create indexes for performance
CREATE INDEX idx_user_fitness_profiles_user_id ON user_fitness_profiles(user_id);
CREATE INDEX idx_user_fitness_profiles_fitness_level ON user_fitness_profiles(fitness_level);
CREATE INDEX idx_user_fitness_profiles_primary_goal ON user_fitness_profiles(primary_goal);
CREATE INDEX idx_user_fitness_profiles_completed_at ON user_fitness_profiles(completed_at);

-- Add updated_at trigger
CREATE TRIGGER update_user_fitness_profiles_updated_at 
    BEFORE UPDATE ON user_fitness_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE user_fitness_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own fitness profile" ON user_fitness_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fitness profile" ON user_fitness_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fitness profile" ON user_fitness_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own fitness profile" ON user_fitness_profiles
    FOR DELETE USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE user_fitness_profiles IS 'Stores user personalization data collected during onboarding flow';
COMMENT ON COLUMN user_fitness_profiles.fitness_level IS 'User''s current fitness level: beginner, intermediate, advanced, athlete';
COMMENT ON COLUMN user_fitness_profiles.primary_goal IS 'User''s primary fitness goal';
COMMENT ON COLUMN user_fitness_profiles.current_frequency IS 'How often user currently exercises';
COMMENT ON COLUMN user_fitness_profiles.preferred_location IS 'Where user prefers to work out';
COMMENT ON COLUMN user_fitness_profiles.available_time IS 'How much time user has for workouts';
COMMENT ON COLUMN user_fitness_profiles.motivation_style IS 'What type of motivation works best for user';
COMMENT ON COLUMN user_fitness_profiles.biggest_challenge IS 'User''s biggest fitness challenge';
COMMENT ON COLUMN user_fitness_profiles.completed_at IS 'When user completed the personalization flow';
