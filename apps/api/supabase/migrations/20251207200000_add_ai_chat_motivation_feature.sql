-- =====================================================
-- ADD AI CHAT MOTIVATION FEATURE TO PRO AND COACH+ PLANS
-- =====================================================
-- AI Chat Motivation is the key differentiator for Pro tier
-- This is a text-based AI coaching chat (not voice - voice is future feature)
-- Available from Pro tier onwards (minimum_tier = 2)

-- Pro plan: AI Chat Motivation
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, minimum_tier, sort_order)
SELECT 'pro', 'ai_chat_motivation', 'AI Chat Motivation', 'Personalized AI coaching conversations for motivation and guidance', null, true, 2, 11
WHERE NOT EXISTS (SELECT 1 FROM plan_features WHERE plan_id = 'pro' AND feature_key = 'ai_chat_motivation');

-- Coach+ plan: AI Chat Motivation (Enhanced)
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, feature_value, is_enabled, minimum_tier, sort_order)
SELECT 'coach_plus', 'ai_chat_motivation', 'AI Chat Motivation (Enhanced)', 'Advanced AI coaching with memory and personalized strategies', null, true, 2, 11
WHERE NOT EXISTS (SELECT 1 FROM plan_features WHERE plan_id = 'coach_plus' AND feature_key = 'ai_chat_motivation');

-- Update existing ai_voice_motivation entries to mark as future feature (disabled for now)
-- This preserves the record but disables it until voice is implemented
UPDATE plan_features 
SET is_enabled = false, 
    feature_description = 'AI-powered voice motivation calls (Coming Soon)'
WHERE feature_key = 'ai_voice_motivation';

-- Add comment for documentation
COMMENT ON TABLE plan_features IS 'Plan features include ai_chat_motivation (Pro+) as primary AI feature. ai_voice_motivation is planned for future release.';
