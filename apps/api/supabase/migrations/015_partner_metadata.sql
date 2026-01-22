-- =====================================================
-- PARTNER METADATA DENORMALIZATION
-- =====================================================
-- Stores user profile metadata directly in accountability_partners
-- so realtime events include all needed data without extra fetches.

-- Add metadata columns for both users
ALTER TABLE accountability_partners
  ADD COLUMN IF NOT EXISTS user_name TEXT,
  ADD COLUMN IF NOT EXISTS user_username TEXT,
  ADD COLUMN IF NOT EXISTS user_profile_picture_url TEXT,
  ADD COLUMN IF NOT EXISTS partner_name TEXT,
  ADD COLUMN IF NOT EXISTS partner_username TEXT,
  ADD COLUMN IF NOT EXISTS partner_profile_picture_url TEXT;

-- =====================================================
-- TRIGGER: Auto-populate metadata on INSERT
-- =====================================================
CREATE OR REPLACE FUNCTION populate_partner_metadata()
RETURNS TRIGGER AS $$
DECLARE
  user_record RECORD;
  partner_record RECORD;
BEGIN
  -- Get user info
  SELECT name, username, profile_picture_url 
  INTO user_record
  FROM users 
  WHERE id = NEW.user_id;
  
  -- Get partner info
  SELECT name, username, profile_picture_url 
  INTO partner_record
  FROM users 
  WHERE id = NEW.partner_user_id;
  
  -- Set metadata
  NEW.user_name := user_record.name;
  NEW.user_username := user_record.username;
  NEW.user_profile_picture_url := user_record.profile_picture_url;
  NEW.partner_name := partner_record.name;
  NEW.partner_username := partner_record.username;
  NEW.partner_profile_picture_url := partner_record.profile_picture_url;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_populate_partner_metadata ON accountability_partners;
CREATE TRIGGER trigger_populate_partner_metadata
  BEFORE INSERT ON accountability_partners
  FOR EACH ROW
  EXECUTE FUNCTION populate_partner_metadata();

-- =====================================================
-- TRIGGER: Sync metadata when user profile is updated
-- =====================================================
CREATE OR REPLACE FUNCTION sync_partner_metadata_on_user_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if relevant fields changed
  IF OLD.name IS DISTINCT FROM NEW.name 
     OR OLD.username IS DISTINCT FROM NEW.username 
     OR OLD.profile_picture_url IS DISTINCT FROM NEW.profile_picture_url THEN
    
    -- Update where this user is the "user"
    UPDATE accountability_partners
    SET 
      user_name = NEW.name,
      user_username = NEW.username,
      user_profile_picture_url = NEW.profile_picture_url,
      updated_at = NOW()
    WHERE user_id = NEW.id;
    
    -- Update where this user is the "partner"
    UPDATE accountability_partners
    SET 
      partner_name = NEW.name,
      partner_username = NEW.username,
      partner_profile_picture_url = NEW.profile_picture_url,
      updated_at = NOW()
    WHERE partner_user_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_partner_metadata ON users;
CREATE TRIGGER trigger_sync_partner_metadata
  AFTER UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION sync_partner_metadata_on_user_update();

-- =====================================================
-- BACKFILL: Populate existing rows
-- =====================================================
UPDATE accountability_partners ap
SET 
  user_name = u.name,
  user_username = u.username,
  user_profile_picture_url = u.profile_picture_url
FROM users u
WHERE ap.user_id = u.id
  AND (ap.user_name IS NULL OR ap.user_username IS NULL);

UPDATE accountability_partners ap
SET 
  partner_name = u.name,
  partner_username = u.username,
  partner_profile_picture_url = u.profile_picture_url
FROM users u
WHERE ap.partner_user_id = u.id
  AND (ap.partner_name IS NULL OR ap.partner_username IS NULL);
