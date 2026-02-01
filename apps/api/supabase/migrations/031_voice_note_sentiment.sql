-- =====================================================
-- FitNudge - Voice Note Sentiment (GPT analysis)
-- Stores sentiment/tone from transcript for downstream AI (insights).
-- =====================================================

-- Add voice_note_sentiment JSONB to check_ins
ALTER TABLE check_ins
ADD COLUMN IF NOT EXISTS voice_note_sentiment JSONB;

COMMENT ON COLUMN check_ins.voice_note_sentiment IS
  'GPT-derived sentiment from voice note transcript: {sentiment, tone, matches_mood}. Used by insights AI.';

-- Add voice_note_duration (seconds) to check_ins
ALTER TABLE check_ins
ADD COLUMN IF NOT EXISTS voice_note_duration INTEGER;

COMMENT ON COLUMN check_ins.voice_note_duration IS
  'Actual duration of voice note file in seconds.';

-- Update get_checkins_for_ai to include created_at (time user checked in)
-- Run this in SQL editor

CREATE OR REPLACE FUNCTION get_checkins_for_ai(p_goal_id UUID, p_limit INTEGER DEFAULT 30)
RETURNS JSONB AS $$
DECLARE
  v_checkins JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', check_in_date,
      'day_of_week', EXTRACT(DOW FROM check_in_date)::int,
      'day_name', TO_CHAR(check_in_date, 'Day'),
      'status', status,
      'completed', CASE WHEN status = 'completed' THEN true ELSE false END,
      'skip_reason', skip_reason,
      'mood', mood,
      'note', LEFT(note, 100),
      'voice_note_transcript', voice_note_transcript,
      'voice_note_sentiment', voice_note_sentiment,
      'voice_note_duration', voice_note_duration,
      'created_at', created_at
    ) ORDER BY check_in_date DESC
  )
  INTO v_checkins
  FROM (
    SELECT check_in_date, status, skip_reason, mood, note,
           voice_note_transcript, voice_note_sentiment, voice_note_duration,
           created_at
    FROM check_ins
    WHERE goal_id = p_goal_id
      AND status != 'pending'
    ORDER BY check_in_date DESC
    LIMIT p_limit
  ) sub;

  RETURN COALESCE(v_checkins, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_checkins_for_ai(UUID, INTEGER) IS
  'Returns recent check-ins for AI context, including voice note transcript, sentiment, and created_at timestamp.';
