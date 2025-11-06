-- Create notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  ai_motivation BOOLEAN NOT NULL DEFAULT true,
  reminders BOOLEAN NOT NULL DEFAULT true,
  social BOOLEAN NOT NULL DEFAULT true,
  achievements BOOLEAN NOT NULL DEFAULT true,
  reengagement BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start TIME NOT NULL DEFAULT '22:00:00',
  quiet_hours_end TIME NOT NULL DEFAULT '08:00:00',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create device tokens table for FCM registration
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('ios', 'android')),
  device_id TEXT NOT NULL,
  timezone TEXT NOT NULL,
  app_version TEXT NOT NULL,
  os_version TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(fcm_token)
);

-- Create notification history table for tracking sent notifications
CREATE TABLE IF NOT EXISTS notification_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_token_id UUID REFERENCES device_tokens(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('ai_motivation', 'reminder', 'social', 'achievement', 'reengagement')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_fcm_token ON device_tokens(fcm_token);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON device_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_notification_history_user_id ON notification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_type ON notification_history(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_history_sent_at ON notification_history(sent_at);

-- Enable RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_preferences
CREATE POLICY "Users can view their own notification preferences" ON notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences" ON notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences" ON notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notification preferences" ON notification_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for device_tokens
CREATE POLICY "Users can view their own device tokens" ON device_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own device tokens" ON device_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own device tokens" ON device_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own device tokens" ON device_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for notification_history
CREATE POLICY "Users can view their own notification history" ON notification_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert notification history" ON notification_history
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update notification history" ON notification_history
  FOR UPDATE USING (true);

-- Create function to get user notification preferences
CREATE OR REPLACE FUNCTION get_user_notification_preferences(p_user_id UUID)
RETURNS TABLE (
  enabled BOOLEAN,
  ai_motivation BOOLEAN,
  reminders BOOLEAN,
  social BOOLEAN,
  achievements BOOLEAN,
  reengagement BOOLEAN,
  quiet_hours_enabled BOOLEAN,
  quiet_hours_start TIME,
  quiet_hours_end TIME
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    np.enabled,
    np.ai_motivation,
    np.reminders,
    np.social,
    np.achievements,
    np.reengagement,
    np.quiet_hours_enabled,
    np.quiet_hours_start,
    np.quiet_hours_end
  FROM notification_preferences np
  WHERE np.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if notification type is enabled for user
CREATE OR REPLACE FUNCTION is_notification_type_enabled(
  p_user_id UUID,
  p_notification_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  preferences notification_preferences%ROWTYPE;
BEGIN
  SELECT * INTO preferences
  FROM notification_preferences
  WHERE user_id = p_user_id;
  
  -- If no preferences found, return false
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if notifications are globally enabled
  IF NOT preferences.enabled THEN
    RETURN FALSE;
  END IF;
  
  -- Check specific notification type
  CASE p_notification_type
    WHEN 'ai_motivation' THEN
      RETURN preferences.ai_motivation;
    WHEN 'reminder' THEN
      RETURN preferences.reminders;
    WHEN 'social' THEN
      RETURN preferences.social;
    WHEN 'achievement' THEN
      RETURN preferences.achievements;
    WHEN 'reengagement' THEN
      RETURN preferences.reengagement;
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get active device tokens for user
CREATE OR REPLACE FUNCTION get_user_active_device_tokens(p_user_id UUID)
RETURNS TABLE (
  fcm_token TEXT,
  device_type TEXT,
  device_id TEXT,
  timezone TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dt.fcm_token,
    dt.device_type,
    dt.device_id,
    dt.timezone
  FROM device_tokens dt
  WHERE dt.user_id = p_user_id 
    AND dt.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update device token last used
CREATE OR REPLACE FUNCTION update_device_token_last_used(p_fcm_token TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE device_tokens
  SET last_used_at = NOW()
  WHERE fcm_token = p_fcm_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to deactivate old device tokens
CREATE OR REPLACE FUNCTION deactivate_old_device_tokens(p_user_id UUID, p_keep_token TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE device_tokens
  SET is_active = false
  WHERE user_id = p_user_id 
    AND fcm_token != p_keep_token
    AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_device_tokens_updated_at
  BEFORE UPDATE ON device_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default notification preferences for existing users
INSERT INTO notification_preferences (user_id, enabled, ai_motivation, reminders, social, achievements, reengagement)
SELECT 
  id,
  true,
  true,
  true,
  true,
  true,
  true
FROM users
WHERE id NOT IN (SELECT user_id FROM notification_preferences)
ON CONFLICT (user_id) DO NOTHING;
