-- =====================================================
-- FitNudge V2 - App Configuration
-- Dynamic configuration values manageable by admin
-- =====================================================

-- =====================================================
-- APP CONFIG TABLE
-- Key-value store for dynamic app configuration
-- =====================================================
CREATE TABLE app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  category TEXT NOT NULL, -- 'app_store_urls', 'external_urls', 'feature_flags', etc.
  description TEXT, -- For admin UI to explain what this config does
  is_public BOOLEAN NOT NULL DEFAULT TRUE, -- Can unauthenticated users fetch this?
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_app_config_category ON app_config(category);
CREATE INDEX idx_app_config_is_public ON app_config(is_public) WHERE is_public = TRUE;

-- Trigger for updated_at
CREATE TRIGGER update_app_config_updated_at
  BEFORE UPDATE ON app_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SEED DATA
-- =====================================================

-- App Store URLs
INSERT INTO app_config (key, value, category, description, is_public) VALUES
  ('ios_app_store_url', 'https://apps.apple.com/app/fitnudge/id123456789', 'app_store_urls', 'iOS App Store URL for app ratings and sharing', TRUE),
  ('android_play_store_url', 'https://play.google.com/store/apps/details?id=com.fitnudge.app', 'app_store_urls', 'Android Play Store URL for app ratings and sharing', TRUE);

-- External URLs
INSERT INTO app_config (key, value, category, description, is_public) VALUES
  ('privacy_policy_url', 'https://fitnudge.app/privacy-policy', 'external_urls', 'Privacy Policy page URL', TRUE),
  ('terms_of_service_url', 'https://fitnudge.app/terms-of-service', 'external_urls', 'Terms of Service page URL', TRUE),
  ('help_center_url', 'https://fitnudge.tawk.help/', 'external_urls', 'Help Center URL (Tawk.to knowledge base)', TRUE),
  ('tally_feedback_url', 'https://tally.so/r/2EaLE9', 'external_urls', 'Tally.so feedback form URL', TRUE),
  ('tawk_chat_url', 'https://tawk.to/chat/695732b53a0c9b197f142f94/1jdu9s5a9', 'external_urls', 'Tawk.to live chat widget URL', TRUE),
  ('contact_email', 'mailto:hello@fitnudge.app', 'external_urls', 'Contact email address (mailto link)', TRUE);

-- Social Media Links
INSERT INTO app_config (key, value, category, description, is_public) VALUES
  ('social_twitter', 'https://twitter.com/fitnudgeapp', 'social_media', 'Twitter/X profile URL', TRUE),
  ('social_instagram', 'https://instagram.com/fitnudgeapp', 'social_media', 'Instagram profile URL', TRUE),
  ('social_facebook', 'https://facebook.com/fitnudgeapp', 'social_media', 'Facebook page URL', TRUE),
  ('social_linkedin', 'https://linkedin.com/company/fitnudgeapp', 'social_media', 'LinkedIn company page URL', TRUE),
  ('social_tiktok', 'https://tiktok.com/@fitnudgeapp', 'social_media', 'TikTok profile URL', TRUE);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Public configs can be read by anyone (including anon)
CREATE POLICY app_config_select_public ON app_config
  FOR SELECT TO anon, authenticated
  USING (is_public = TRUE);

-- Service role can do everything (for admin operations)
CREATE POLICY app_config_service_all ON app_config
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE app_config IS 'Dynamic app configuration values. Public configs can be fetched without authentication. Managed by admin.';
COMMENT ON COLUMN app_config.key IS 'Unique configuration key (e.g., ios_app_store_url)';
COMMENT ON COLUMN app_config.value IS 'Configuration value (e.g., URL)';
COMMENT ON COLUMN app_config.category IS 'Category for grouping (app_store_urls, external_urls, feature_flags)';
COMMENT ON COLUMN app_config.is_public IS 'If true, can be fetched by unauthenticated users';
