-- =====================================================
-- Add Language Preference to Users
-- Default to English for localization support
-- =====================================================

-- Add language column to users table with default 'en' (English)
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';

COMMENT ON COLUMN users.language IS 'User preferred language code (ISO 639-1, e.g., en, es, fr, de). Used for app localization and AI-generated content.';

-- Create index for language-based queries (e.g., analytics, localized notifications)
CREATE INDEX IF NOT EXISTS idx_users_language ON users(language);

