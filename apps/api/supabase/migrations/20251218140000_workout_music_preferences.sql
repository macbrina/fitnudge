-- =====================================================
-- Workout Music and Sound Preferences
-- =====================================================

-- Create workout_music table for background music tracks
CREATE TABLE IF NOT EXISTS workout_music (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Track info
    title TEXT NOT NULL,
    artist TEXT,
    duration_seconds INTEGER NOT NULL,
    
    -- Storage (Cloudflare R2)
    file_url TEXT NOT NULL,
    file_key TEXT NOT NULL,
    file_size_bytes INTEGER,
    
    -- Metadata for smart selection
    bpm INTEGER,  -- Beats per minute
    genre TEXT,
    mood TEXT CHECK (mood IN ('energetic', 'calm', 'motivational', 'intense', 'chill')),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for active tracks
CREATE INDEX IF NOT EXISTS idx_workout_music_active ON workout_music(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_workout_music_mood ON workout_music(mood) WHERE is_active = true;

-- Create sound_effects table for ding sounds etc
CREATE TABLE IF NOT EXISTS sound_effects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Effect info
    name TEXT NOT NULL,  -- e.g., 'exercise_start', 'rest_start', 'countdown_tick', 'workout_complete'
    description TEXT,
    
    -- Storage (Cloudflare R2)
    file_url TEXT NOT NULL,
    file_key TEXT NOT NULL,
    file_size_bytes INTEGER,
    duration_ms INTEGER,  -- Duration in milliseconds
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,  -- Default sound for this type
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for active sound effects
CREATE INDEX IF NOT EXISTS idx_sound_effects_active ON sound_effects(is_active, name);

-- Create user_audio_preferences table
CREATE TABLE IF NOT EXISTS user_audio_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Music preferences
    music_enabled BOOLEAN DEFAULT true,
    music_volume DECIMAL(3, 2) DEFAULT 0.80 CHECK (music_volume >= 0 AND music_volume <= 1),
    shuffle_enabled BOOLEAN DEFAULT true,
    
    -- Coach voice preferences
    coach_voice_enabled BOOLEAN DEFAULT true,
    coach_voice_volume DECIMAL(3, 2) DEFAULT 0.80 CHECK (coach_voice_volume >= 0 AND coach_voice_volume <= 1),
    
    -- Sound effects preferences  
    sound_effects_enabled BOOLEAN DEFAULT true,
    sound_effects_volume DECIMAL(3, 2) DEFAULT 0.80 CHECK (sound_effects_volume >= 0 AND sound_effects_volume <= 1),
    
    -- External music app preference
    preferred_music_app TEXT CHECK (preferred_music_app IN ('playlist', 'apple_music', 'spotify')),
    
    -- Last played track (for resume)
    last_played_track_id UUID REFERENCES workout_music(id) ON DELETE SET NULL,
    last_played_position_seconds INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Index for user preferences lookup
CREATE INDEX IF NOT EXISTS idx_user_audio_preferences_user ON user_audio_preferences(user_id);

-- Enable RLS
ALTER TABLE workout_music ENABLE ROW LEVEL SECURITY;
ALTER TABLE sound_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_audio_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workout_music (read-only for all authenticated users)
CREATE POLICY "Users can read active workout music"
    ON workout_music FOR SELECT
    TO authenticated
    USING (is_active = true);

-- RLS Policies for sound_effects (read-only for all authenticated users)
CREATE POLICY "Users can read active sound effects"
    ON sound_effects FOR SELECT
    TO authenticated
    USING (is_active = true);

-- RLS Policies for user_audio_preferences
CREATE POLICY "Users can read own audio preferences"
    ON user_audio_preferences FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own audio preferences"
    ON user_audio_preferences FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own audio preferences"
    ON user_audio_preferences FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Insert default sound effects (you'll update file_url after uploading to R2)
INSERT INTO sound_effects (name, description, file_url, file_key, duration_ms, is_default) VALUES
    ('exercise_start', 'Ding sound when exercise begins', 'https://media.fitnudge.app/sounds/exercise_start.mp3', 'sounds/exercise_start.mp3', 500, true),
    ('rest_start', 'Softer ding when rest period begins', 'https://media.fitnudge.app/sounds/rest_start.mp3', 'sounds/rest_start.mp3', 400, true),
    ('countdown_tick', 'Tick sound during 3-2-1 countdown', 'https://media.fitnudge.app/sounds/countdown_tick.mp3', 'sounds/countdown_tick.mp3', 200, true),
    ('workout_complete', 'Celebration sound when workout finishes', 'https://media.fitnudge.app/sounds/workout_complete.mp3', 'sounds/workout_complete.mp3', 1500, true)
ON CONFLICT DO NOTHING;

