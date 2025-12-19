-- =====================================================
-- ADD DEVICE INFO TO REFRESH TOKENS FOR SESSION MANAGEMENT
-- =====================================================
-- This allows users to:
-- 1. See all their active sessions with device info
-- 2. Sign out of specific sessions (devices)
-- 3. Sign out of all sessions at once
-- =====================================================

-- Add device info columns to refresh_tokens
ALTER TABLE refresh_tokens
ADD COLUMN IF NOT EXISTS device_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS device_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS device_type VARCHAR(20), -- 'ios', 'android', 'web'
ADD COLUMN IF NOT EXISTS ip_address INET,
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS location VARCHAR(100); -- Optional: city/country from IP

-- Index for faster session lookups by user
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active 
ON refresh_tokens(user_id, is_active) 
WHERE is_active = true;

-- Comment for documentation
COMMENT ON COLUMN refresh_tokens.device_name IS 'Human-readable device name (e.g., iPhone 14 Pro, Chrome on Windows)';
COMMENT ON COLUMN refresh_tokens.device_id IS 'Unique device identifier from client';
COMMENT ON COLUMN refresh_tokens.device_type IS 'Platform: ios, android, or web';
COMMENT ON COLUMN refresh_tokens.ip_address IS 'IP address when session was created';
COMMENT ON COLUMN refresh_tokens.user_agent IS 'User agent string from client';
COMMENT ON COLUMN refresh_tokens.location IS 'Geographic location derived from IP (optional)';
