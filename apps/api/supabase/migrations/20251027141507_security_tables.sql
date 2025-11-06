-- Security Tables Migration
-- Adds tables for API keys, refresh tokens, and audit logging

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_id VARCHAR(32) NOT NULL UNIQUE,
    key_hash VARCHAR(64) NOT NULL,
    app_name VARCHAR(50) NOT NULL DEFAULT 'mobile',
    permissions TEXT[] NOT NULL DEFAULT ARRAY['read', 'write'],
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Refresh Tokens table for token rotation
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_family VARCHAR(32) NOT NULL,
    token_id VARCHAR(32) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(token_family, token_id)
);

-- Failed Login Attempts table
CREATE TABLE IF NOT EXISTS failed_login_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email_hash VARCHAR(64) NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_locked BOOLEAN NOT NULL DEFAULT false
);

-- Account Lockouts table
CREATE TABLE IF NOT EXISTS account_lockouts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email_hash VARCHAR(64) NOT NULL UNIQUE,
    locked_until TIMESTAMP WITH TIME ZONE NOT NULL,
    reason VARCHAR(100) NOT NULL DEFAULT 'too_many_failed_attempts',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security Events table for audit logging
CREATE TABLE IF NOT EXISTS security_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_id ON api_keys(key_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(token_family);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active ON refresh_tokens(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_failed_attempts_email ON failed_login_attempts(email_hash);
CREATE INDEX IF NOT EXISTS idx_failed_attempts_ip ON failed_login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_failed_attempts_time ON failed_login_attempts(attempted_at);

CREATE INDEX IF NOT EXISTS idx_lockouts_email ON account_lockouts(email_hash);
CREATE INDEX IF NOT EXISTS idx_lockouts_time ON account_lockouts(locked_until);

CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_time ON security_events(created_at);

-- RLS Policies for API Keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own API keys" ON api_keys
    FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for Refresh Tokens
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own refresh tokens" ON refresh_tokens
    FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for Security Events
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own security events" ON security_events
    FOR ALL USING (auth.uid() = user_id);

-- Functions for cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    -- Clean up expired API keys
    DELETE FROM api_keys 
    WHERE expires_at < NOW() AND is_active = false;
    
    -- Clean up expired refresh tokens
    DELETE FROM refresh_tokens 
    WHERE expires_at < NOW() AND is_active = false;
    
    -- Clean up old failed login attempts (older than 24 hours)
    DELETE FROM failed_login_attempts 
    WHERE attempted_at < NOW() - INTERVAL '24 hours';
    
    -- Clean up expired account lockouts
    DELETE FROM account_lockouts 
    WHERE locked_until < NOW();
    
    -- Clean up old security events (older than 90 days)
    DELETE FROM security_events 
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Function to check if account is locked
CREATE OR REPLACE FUNCTION is_account_locked(email_hash_param VARCHAR(64))
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM account_lockouts 
        WHERE email_hash = email_hash_param 
        AND locked_until > NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Function to record failed login attempt
CREATE OR REPLACE FUNCTION record_failed_login(
    email_hash_param VARCHAR(64),
    ip_address_param INET,
    user_agent_param TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    attempt_count INTEGER;
BEGIN
    -- Insert failed attempt
    INSERT INTO failed_login_attempts (email_hash, ip_address, user_agent)
    VALUES (email_hash_param, ip_address_param, user_agent_param);
    
    -- Count attempts in last hour
    SELECT COUNT(*) INTO attempt_count
    FROM failed_login_attempts
    WHERE email_hash = email_hash_param
    AND attempted_at > NOW() - INTERVAL '1 hour';
    
    -- Lock account if too many attempts
    IF attempt_count >= 5 THEN
        INSERT INTO account_lockouts (email_hash, locked_until, reason)
        VALUES (email_hash_param, NOW() + INTERVAL '30 minutes', 'too_many_failed_attempts')
        ON CONFLICT (email_hash) 
        DO UPDATE SET 
            locked_until = NOW() + INTERVAL '30 minutes',
            reason = 'too_many_failed_attempts';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to record security event
CREATE OR REPLACE FUNCTION record_security_event(
    user_id_param UUID,
    event_type_param VARCHAR(50),
    event_data_param JSONB DEFAULT NULL,
    ip_address_param INET DEFAULT NULL,
    user_agent_param TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    INSERT INTO security_events (user_id, event_type, event_data, ip_address, user_agent)
    VALUES (user_id_param, event_type_param, event_data_param, ip_address_param, user_agent_param);
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up expired data (if pg_cron is available)
-- This would need to be set up separately in production
-- SELECT cron.schedule('cleanup-expired-tokens', '0 2 * * *', 'SELECT cleanup_expired_tokens();');

-- Insert sample data for testing (optional)
-- This can be removed in production
INSERT INTO api_keys (user_id, key_id, key_hash, app_name, permissions, expires_at)
SELECT 
    id,
    'test_key_' || substr(id::text, 1, 8),
    'test_hash_' || substr(id::text, 1, 8),
    'test_app',
    ARRAY['read', 'write'],
    NOW() + INTERVAL '1 year'
FROM users
LIMIT 1
ON CONFLICT DO NOTHING;
