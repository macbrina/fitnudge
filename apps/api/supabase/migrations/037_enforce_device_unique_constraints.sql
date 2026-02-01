-- =====================================================
-- Enforce one row per (user_id, device_id, platform)
-- for live_activity_devices and nextup_fcm_devices.
-- =====================================================
-- Deduplicates existing rows (keeps latest by updated_at),
-- then ensures unique constraint exists for upsert on_conflict.

-- --- live_activity_devices ---
WITH duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, device_id, platform
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM live_activity_devices
)
DELETE FROM live_activity_devices
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

ALTER TABLE live_activity_devices DROP CONSTRAINT IF EXISTS live_activity_devices_user_id_device_id_platform_key;
ALTER TABLE live_activity_devices DROP CONSTRAINT IF EXISTS live_activity_devices_user_device_platform_key;
ALTER TABLE live_activity_devices ADD CONSTRAINT live_activity_devices_user_device_platform_key UNIQUE (user_id, device_id, platform);

-- --- nextup_fcm_devices ---
WITH duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, device_id, platform
      ORDER BY updated_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM nextup_fcm_devices
)
DELETE FROM nextup_fcm_devices
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

ALTER TABLE nextup_fcm_devices DROP CONSTRAINT IF EXISTS nextup_fcm_devices_user_id_device_id_platform_key;
ALTER TABLE nextup_fcm_devices DROP CONSTRAINT IF EXISTS nextup_fcm_devices_user_device_platform_key;
ALTER TABLE nextup_fcm_devices ADD CONSTRAINT nextup_fcm_devices_user_device_platform_key UNIQUE (user_id, device_id, platform);
