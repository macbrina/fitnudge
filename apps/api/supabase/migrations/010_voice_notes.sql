-- =====================================================
-- FitNudge V2 - Voice Notes Schema
-- Adds voice note columns to check_ins table
-- =====================================================

-- Add voice note columns to check_ins
ALTER TABLE check_ins
ADD COLUMN IF NOT EXISTS voice_note_url TEXT,
ADD COLUMN IF NOT EXISTS voice_note_transcript TEXT;

-- Index for faster lookups of check-ins with voice notes
CREATE INDEX IF NOT EXISTS idx_check_ins_voice_note 
ON check_ins(user_id, created_at DESC) 
WHERE voice_note_url IS NOT NULL;

-- Comment
COMMENT ON COLUMN check_ins.voice_note_url IS 'URL to voice note audio file in R2 storage';
COMMENT ON COLUMN check_ins.voice_note_transcript IS 'AI transcription of voice note via Whisper';
