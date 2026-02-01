-- =====================================================
-- FitNudge - iOS Live Activities (ActivityKit) token storage
-- =====================================================
-- Stores per-user, per-device tokens needed for:
-- - Push-to-start (iOS 17.2+)
-- - Push-to-update/end (activity push token per activity instance)
--
-- NOTE: Selection logic lives in server/app code. Swift UI renders payload only.

CREATE TABLE IF NOT EXISTS live_activity_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios')),

  -- Token to start a Live Activity remotely (iOS 17.2+)
  push_to_start_token TEXT,

  -- Token used to update/end a specific activity instance.
  activity_id TEXT,
  activity_push_token TEXT,

  -- Required for correct day boundaries and deterministic ordering
  timezone TEXT NOT NULL DEFAULT 'UTC',

  -- Dedupe + minimal state to reduce flicker/spam
  last_day_key TEXT,
  last_payload_hash TEXT,
  locked_day_key TEXT,
  locked_task_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, device_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_live_activity_devices_user ON live_activity_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_live_activity_devices_platform ON live_activity_devices(platform);
CREATE INDEX IF NOT EXISTS idx_live_activity_devices_updated_at ON live_activity_devices(updated_at DESC);

-- Enable RLS and policies (mirror device_tokens style)
ALTER TABLE live_activity_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY live_activity_devices_select_own ON live_activity_devices
  FOR SELECT TO authenticated
  USING (user_id = get_user_id_from_auth());

CREATE POLICY live_activity_devices_insert_own ON live_activity_devices
  FOR INSERT TO authenticated
  WITH CHECK (user_id = get_user_id_from_auth());

CREATE POLICY live_activity_devices_update_own ON live_activity_devices
  FOR UPDATE TO authenticated
  USING (user_id = get_user_id_from_auth());

CREATE POLICY live_activity_devices_delete_own ON live_activity_devices
  FOR DELETE TO authenticated
  USING (user_id = get_user_id_from_auth());

-- Keep updated_at fresh
DROP TRIGGER IF EXISTS update_live_activity_devices_updated_at ON live_activity_devices;
CREATE TRIGGER update_live_activity_devices_updated_at
  BEFORE UPDATE ON live_activity_devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

