-- =====================================================
-- EXERCISE DATABASE TABLE
-- Stores 1300+ exercises with GIFs and metadata
-- Source: ExerciseDB one-time purchase ($129)
-- =====================================================

CREATE TABLE exercises (
    id TEXT PRIMARY KEY,                    -- "0001" (matches GIF filename)
    name TEXT NOT NULL,                     -- "3/4 sit-up"
    body_part TEXT,                         -- "waist", "upper legs", "chest", etc.
    equipment TEXT,                         -- "body weight", "barbell", "dumbbell", etc.
    target_muscle TEXT,                     -- "abs", "quads", "pectorals", etc.
    secondary_muscles TEXT[],               -- ["hip flexors", "lower back"]
    instructions TEXT[],                    -- Step-by-step instructions
    description TEXT,                       -- Full exercise description
    difficulty TEXT,                        -- "beginner", "intermediate", "advanced"
    category TEXT,                          -- "strength", "cardio", "stretching", "plyometrics"
    gif_url_180 TEXT,                       -- "/static/exercises/180/0001.gif"
    gif_url_360 TEXT,                       -- "/static/exercises/360/0001.gif"
    usage_count INTEGER DEFAULT 0,          -- Track exercise popularity
    last_used_at TIMESTAMP,                 -- Last time used in a plan
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR FAST LOOKUPS
-- =====================================================

-- Primary lookups
CREATE INDEX idx_exercises_name ON exercises(name);
CREATE INDEX idx_exercises_name_lower ON exercises(LOWER(name));

-- Filter indexes
CREATE INDEX idx_exercises_body_part ON exercises(body_part);
CREATE INDEX idx_exercises_target ON exercises(target_muscle);
CREATE INDEX idx_exercises_equipment ON exercises(equipment);
CREATE INDEX idx_exercises_difficulty ON exercises(difficulty);
CREATE INDEX idx_exercises_category ON exercises(category);

-- Usage analytics
CREATE INDEX idx_exercises_usage_count ON exercises(usage_count DESC);
CREATE INDEX idx_exercises_last_used ON exercises(last_used_at DESC NULLS LAST);

-- Full-text search (for advanced search features)
CREATE INDEX idx_exercises_name_search ON exercises 
    USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

-- Public read access (exercises are educational content)
CREATE POLICY "Anyone can view exercises" ON exercises
    FOR SELECT USING (true);

-- Only admins can manage exercises
CREATE POLICY "Only admins can manage exercises" ON exercises
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admin_users au
            WHERE au.user_id = auth.uid()
            AND au.is_active = true
        )
    );

-- =====================================================
-- UPDATE TRIGGER
-- =====================================================

CREATE TRIGGER update_exercises_updated_at 
    BEFORE UPDATE ON exercises 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- DOCUMENTATION
-- =====================================================

COMMENT ON TABLE exercises IS 
'Exercise database with 1300+ exercises, GIF demonstrations, and metadata.
Source: ExerciseDB one-time purchase. Self-hosted for performance and reliability.
GIFs stored in static/exercises/ directory, served via FastAPI static files.';

COMMENT ON COLUMN exercises.id IS 'Exercise ID from ExerciseDB (matches GIF filename)';
COMMENT ON COLUMN exercises.gif_url_180 IS 'Thumbnail GIF (180x180px) for previews';
COMMENT ON COLUMN exercises.gif_url_360 IS 'Mobile GIF (360x360px) for detail view';
COMMENT ON COLUMN exercises.usage_count IS 'Tracks how often exercise appears in generated plans';
COMMENT ON COLUMN exercises.instructions IS 'Step-by-step array of instructions for proper form';
COMMENT ON COLUMN exercises.secondary_muscles IS 'Additional muscles worked during exercise';

