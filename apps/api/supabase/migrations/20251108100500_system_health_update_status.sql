alter table system_health_updates
  add column if not exists status text not null default 'identified';

-- Add constraint only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'system_health_updates_status_check'
  ) THEN
    ALTER TABLE system_health_updates
      ADD CONSTRAINT system_health_updates_status_check
      CHECK (status IN ('identified','monitoring','resolved'));
  END IF;
END $$;

