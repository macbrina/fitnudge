-- Create user_status enum
CREATE TYPE user_status AS ENUM ('active', 'disabled', 'suspended');

-- Add status column to users table with default 'active'
ALTER TABLE users
ADD COLUMN status user_status NOT NULL DEFAULT 'active';

-- Migrate existing is_active data to status
UPDATE users
SET status = CASE
    WHEN is_active = true THEN 'active'::user_status
    WHEN is_active = false THEN 'disabled'::user_status
    ELSE 'active'::user_status
END;

-- Remove is_active column
ALTER TABLE users
DROP COLUMN is_active;

-- Add comment
COMMENT ON COLUMN users.status IS 'User account status: active, disabled, or suspended';

-- Update any views or functions that referenced is_active
-- Check for any RLS policies that use is_active
-- (Most policies use auth.uid() so shouldn't need updates, but checking anyway)

-- Create index on status for efficient filtering
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

