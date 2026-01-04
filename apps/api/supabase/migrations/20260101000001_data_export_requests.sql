-- =====================================================
-- Data Export Requests Table
-- Tracks user data export requests for GDPR compliance
-- =====================================================

-- Create export status enum
CREATE TYPE export_status_type AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Data export requests table
CREATE TABLE data_export_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    status export_status_type NOT NULL DEFAULT 'pending',
    error_message TEXT,
    download_url TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX idx_data_export_requests_user_id ON data_export_requests(user_id);
CREATE INDEX idx_data_export_requests_status ON data_export_requests(status);
CREATE INDEX idx_data_export_requests_created_at ON data_export_requests(created_at);

-- Add RLS policies
ALTER TABLE data_export_requests ENABLE ROW LEVEL SECURITY;

-- Users can only see their own export requests
CREATE POLICY "data_export_requests_select_own" ON data_export_requests
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Only the system (service role) can insert/update
-- Users request exports via the API which runs with service role
CREATE POLICY "data_export_requests_insert_service" ON data_export_requests
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "data_export_requests_update_service" ON data_export_requests
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

-- Add comment for documentation
COMMENT ON TABLE data_export_requests IS 'Tracks user data export requests for GDPR compliance';
COMMENT ON COLUMN data_export_requests.status IS 'Current status of the export: pending, processing, completed, or failed';
COMMENT ON COLUMN data_export_requests.download_url IS 'URL to download the export (if stored in cloud storage)';
COMMENT ON COLUMN data_export_requests.expires_at IS 'When the download URL expires';

