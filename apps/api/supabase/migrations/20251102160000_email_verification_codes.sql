-- Create email_verification_codes table for storing 6-digit verification codes
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT false,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT max_attempts CHECK (attempts <= 5)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_user_id ON email_verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_code ON email_verification_codes(code);
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_expires_at ON email_verification_codes(expires_at);

-- Create index for unverified codes (expiration check done in queries, not in index)
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_unverified ON email_verification_codes(user_id, expires_at)
WHERE verified = false;

-- Function to cleanup expired codes (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM email_verification_codes
  WHERE expires_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON TABLE email_verification_codes IS 'Stores 6-digit email verification codes with 24-hour expiration';
COMMENT ON COLUMN email_verification_codes.code IS '6-digit verification code';
COMMENT ON COLUMN email_verification_codes.expires_at IS 'Code expiration time (24 hours from creation)';
COMMENT ON COLUMN email_verification_codes.verified IS 'Whether this code has been successfully verified';
COMMENT ON COLUMN email_verification_codes.attempts IS 'Number of verification attempts (max 5)';

