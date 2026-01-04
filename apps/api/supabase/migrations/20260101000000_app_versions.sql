-- =====================================================
-- App Versions Table
-- Manages app version information for iOS and Android
-- Used to notify users when updates are available
-- =====================================================

-- Create platform enum type
CREATE TYPE app_platform_type AS ENUM ('ios', 'android');

-- App versions table - managed by admin
CREATE TABLE app_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform app_platform_type NOT NULL UNIQUE,
    latest_version TEXT NOT NULL,  -- e.g., '1.2.0'
    minimum_version TEXT NOT NULL,  -- Users below this MUST update
    release_notes TEXT,  -- Optional release notes to show users
    store_url TEXT,  -- Optional custom store URL (uses default if not set)
    force_update BOOLEAN DEFAULT false,  -- If true, users must update regardless of version
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial records for both platforms
INSERT INTO app_versions (platform, latest_version, minimum_version, release_notes)
VALUES 
    ('ios', '1.0.0', '1.0.0', 'Initial release'),
    ('android', '1.0.0', '1.0.0', 'Initial release');

-- Create index for faster lookups
CREATE INDEX idx_app_versions_platform ON app_versions(platform);

-- Add RLS policies
ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read app versions (public endpoint)
CREATE POLICY "app_versions_select_public" ON app_versions
    FOR SELECT USING (true);

-- Only admin can insert/update/delete
CREATE POLICY "app_versions_admin_insert" ON app_versions
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.user_id = auth.uid()
            AND admin_users.is_active = true
        )
    );

CREATE POLICY "app_versions_admin_update" ON app_versions
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.user_id = auth.uid()
            AND admin_users.is_active = true
        )
    );

CREATE POLICY "app_versions_admin_delete" ON app_versions
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.user_id = auth.uid()
            AND admin_users.is_active = true
        )
    );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_app_versions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER app_versions_updated_at_trigger
    BEFORE UPDATE ON app_versions
    FOR EACH ROW
    EXECUTE FUNCTION update_app_versions_updated_at();

-- Add comment for documentation
COMMENT ON TABLE app_versions IS 'Stores current and minimum required app versions for each platform. Managed by admin.';
COMMENT ON COLUMN app_versions.latest_version IS 'The latest available version in the app store';
COMMENT ON COLUMN app_versions.minimum_version IS 'Minimum version required - users below this must update';
COMMENT ON COLUMN app_versions.force_update IS 'If true, forces update regardless of version comparison';

