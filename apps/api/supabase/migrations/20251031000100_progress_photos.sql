-- =====================================================
-- PROGRESS PHOTOS SUPPORT
-- =====================================================

-- Add photo_urls array to check_ins table
ALTER TABLE check_ins 
ADD COLUMN photo_urls TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add index for querying check-ins with photos
CREATE INDEX idx_check_ins_has_photos ON check_ins USING GIN (photo_urls) WHERE array_length(photo_urls, 1) > 0;

-- Create progress_photos table for better organization (optional, can use photo_urls in check_ins)
CREATE TABLE progress_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_in_id UUID NOT NULL REFERENCES check_ins(id) ON DELETE CASCADE,
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    photo_order INTEGER DEFAULT 0, -- Order within the check-in (before/after)
    caption TEXT,
    is_before_photo BOOLEAN DEFAULT false, -- Mark as "before" photo for comparison
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique photo per check-in
    UNIQUE(check_in_id, photo_url)
);

-- Add indexes
CREATE INDEX idx_progress_photos_user_id ON progress_photos(user_id);
CREATE INDEX idx_progress_photos_goal_id ON progress_photos(goal_id);
CREATE INDEX idx_progress_photos_check_in_id ON progress_photos(check_in_id);
CREATE INDEX idx_progress_photos_before_photo ON progress_photos(goal_id, is_before_photo) WHERE is_before_photo = true;

-- Enable RLS
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;

-- Users can read their own photos
CREATE POLICY "Users can read their own progress photos" ON progress_photos
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own photos
CREATE POLICY "Users can insert their own progress photos" ON progress_photos
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own photos
CREATE POLICY "Users can update their own progress photos" ON progress_photos
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own photos
CREATE POLICY "Users can delete their own progress photos" ON progress_photos
    FOR DELETE
    USING (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "Service role can manage progress photos" ON progress_photos
    FOR ALL
    USING (auth.role() = 'service_role');

