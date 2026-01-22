-- =============================================
-- Migration: User Reports Table
-- Description: Allows users to report inappropriate usernames and behavior
-- =============================================

-- User Reports table
CREATE TABLE IF NOT EXISTS user_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_username TEXT, -- Capture username at time of report
    reason TEXT NOT NULL CHECK (reason IN ('inappropriate_username', 'harassment', 'spam', 'other')),
    details TEXT, -- Optional additional context
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
    admin_notes TEXT, -- Notes from admin review
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter ON user_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_reported_user ON user_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports(status);
CREATE INDEX IF NOT EXISTS idx_user_reports_created_at ON user_reports(created_at DESC);

-- RLS Policies
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

-- Users can create their own reports
CREATE POLICY "users_can_create_reports"
    ON user_reports FOR INSERT
    WITH CHECK (auth.uid() = reporter_id);

-- Users can view their own reports
CREATE POLICY "users_can_view_own_reports"
    ON user_reports FOR SELECT
    USING (auth.uid() = reporter_id);

-- Service role can do everything (for admin access)
CREATE POLICY "service_role_full_access"
    ON user_reports FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Comment for documentation
COMMENT ON TABLE user_reports IS 'User reports for inappropriate usernames, harassment, spam, etc.';
COMMENT ON COLUMN user_reports.reason IS 'Report reason: inappropriate_username, harassment, spam, other';
COMMENT ON COLUMN user_reports.status IS 'Report status: pending, reviewed, actioned, dismissed';
