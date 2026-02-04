-- =====================================================
-- Task audit log - persistent failure records for debugging
-- Celery results expire after 1h; this keeps failures for 30 days
-- =====================================================

CREATE TABLE task_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL UNIQUE,
  task_name TEXT,
  state TEXT NOT NULL CHECK (state IN ('FAILURE', 'SOFT_FAILURE')),
  error_message TEXT NOT NULL,
  traceback TEXT,
  args_json TEXT,
  kwargs_json TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_audit_log_created_at ON task_audit_log(created_at DESC);
CREATE INDEX idx_task_audit_log_task_name ON task_audit_log(task_name);
CREATE INDEX idx_task_audit_log_task_id ON task_audit_log(task_id);

-- RLS: Only service role can access (bypasses RLS). Deny anon/authenticated.
ALTER TABLE task_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_audit_log_service_only ON task_audit_log
  FOR ALL USING (false);  -- No role satisfies this; service role bypasses RLS

COMMENT ON TABLE task_audit_log IS 'Persistent log of Celery task failures for admin debugging. Retention: 30 days (cleanup task).';
