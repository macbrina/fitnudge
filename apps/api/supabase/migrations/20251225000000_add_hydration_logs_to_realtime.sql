-- =====================================================
-- Enable Realtime for Hydration Logs
-- =====================================================
-- Migration: 20251225000000_add_hydration_logs_to_realtime.sql
-- Purpose: Enable Supabase Realtime for hydration tracking
--
-- Table: hydration_logs
-- Use case: Instant updates when users log water intake
-- Purpose: Real-time hydration tracking, multi-device sync
-- Impact: HydrationModal, HydrationProgressStats, GoalProgressSection
-- =====================================================

-- Helper function to safely add table to Realtime publication
CREATE OR REPLACE FUNCTION add_table_to_realtime_if_not_exists(table_name TEXT)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = table_name
  ) THEN
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', table_name);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Enable Realtime for hydration_logs
SELECT add_table_to_realtime_if_not_exists('hydration_logs');

-- Set REPLICA IDENTITY FULL so DELETE events include the full row data
-- This allows client-side filtering by user_id for DELETE events
ALTER TABLE hydration_logs REPLICA IDENTITY FULL;

-- Clean up helper function
DROP FUNCTION IF EXISTS add_table_to_realtime_if_not_exists(TEXT);

