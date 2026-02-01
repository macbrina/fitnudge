-- =====================================================
-- FitNudge - Maintenance Mode + Admin Broadcast Notifications
-- app_config maintenance keys, notifications table, notification_history dismissed_at
-- =====================================================

-- =====================================================
-- 1. NOTIFICATIONS (admin broadcast definitions)
-- =====================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  cta_label TEXT,
  cta_url TEXT,
  deeplink TEXT,
  source_lang TEXT NOT NULL DEFAULT 'en',
  translations JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'free', 'premium')),
  delivery TEXT NOT NULL DEFAULT 'in_app' CHECK (delivery IN ('push', 'in_app', 'both')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_active ON notifications(is_active) WHERE is_active = true;
CREATE INDEX idx_notifications_schedule ON notifications(starts_at, ends_at);

COMMENT ON TABLE notifications IS 'Admin broadcast definitions. Stored per-user in notification_history as general + entity_type admin_broadcast.';
COMMENT ON COLUMN notifications.source_lang IS 'Language admin wrote in (e.g. en). Used for fallback when resolving translations.';
COMMENT ON COLUMN notifications.translations IS 'Per-locale title, body, cta_label. Format: { "en": { "title": "...", "body": "...", "cta_label": "..." }, "fr": { ... }, ... }. API resolves by users.language; fallback source_lang then en.';

-- Trigger for updated_at
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- When a notification (broadcast) is deleted, remove related notification_history rows
-- (users who already saw it) so we don't keep orphaned history.
CREATE OR REPLACE FUNCTION delete_notification_history_on_broadcast_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM notification_history
  WHERE entity_type = 'admin_broadcast'
    AND entity_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER notifications_delete_cascade_history
  AFTER DELETE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION delete_notification_history_on_broadcast_delete();

COMMENT ON FUNCTION delete_notification_history_on_broadcast_delete() IS 'Remove notification_history rows (entity_type=admin_broadcast, entity_id=deleted id) when an admin broadcast is deleted.';

-- =====================================================
-- 2. NOTIFICATION_HISTORY - add dismissed_at
-- =====================================================
ALTER TABLE notification_history
ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

COMMENT ON COLUMN notification_history.dismissed_at IS 'When user dismissed (e.g. admin broadcast modal). Used for once-ever dismissal.';

-- =====================================================
-- 3. APP_CONFIG - maintenance keys + bypass
-- =====================================================
INSERT INTO app_config (key, value, category, description, is_public) VALUES
  ('maintenance_enabled', 'false', 'maintenance', 'When true, show maintenance screen and block all routes including auth.', true),
  ('maintenance_title', 'We''ll be back soon', 'maintenance', 'Maintenance screen title.', true),
  ('maintenance_message', 'We''re performing scheduled maintenance. Please check back shortly.', 'maintenance', 'Maintenance screen message.', true),
  ('maintenance_image_url', '', 'maintenance', 'Optional image URL for maintenance screen. Empty = use default asset.', true),
  ('maintenance_cta_label', '', 'maintenance', 'Optional CTA button label. Empty = no CTA.', true),
  ('maintenance_cta_url', '', 'maintenance', 'Optional CTA button URL.', true),
  ('maintenance_bypass_user_ids', '[]', 'maintenance', 'JSON array of user UUIDs allowed to skip maintenance (e.g. internal testers).', true)
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 4. RLS - notifications (service_role only; API uses service client)
-- =====================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_service_all ON notifications
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY notifications_authenticated_select ON notifications
  FOR SELECT TO authenticated
  USING (true);

-- =====================================================
-- 5. REALTIME - app_config, notifications
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE app_config;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Replica identity for realtime payloads
ALTER TABLE notifications REPLICA IDENTITY FULL;
