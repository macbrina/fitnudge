-- =====================================================
-- ADD AI DESCRIPTION COLUMN AND UPDATE ALL DESCRIPTIONS
-- =====================================================
-- 
-- This migration:
-- 1. Adds ai_description column to plan_features table
-- 2. Updates feature_description with better descriptions
-- 3. Populates ai_description for AI prompt generation
--

-- Step 1: Add ai_description column
ALTER TABLE plan_features 
ADD COLUMN IF NOT EXISTS ai_description TEXT;

-- Step 2: Update all features with descriptions and AI descriptions
-- Using a single UPDATE with CASE for efficiency

-- ==================== CORE FEATURES ====================

UPDATE plan_features SET
    feature_description = 'Simple yes/no check-ins with optional reflection text',
    ai_description = 'daily check-ins (yes/no with optional reflection)'
WHERE feature_key = 'daily_checkins';

UPDATE plan_features SET
    feature_description = 'Track consecutive days of completing goals',
    ai_description = 'streak tracking to see your consistency'
WHERE feature_key = 'streak_tracking';

UPDATE plan_features SET
    feature_description = 'Visual progress charts and summary cards',
    ai_description = 'progress visualization showing your consistency'
WHERE feature_key = 'progress_visualization';

UPDATE plan_features SET
    feature_description = 'Scheduled notification reminders',
    ai_description = 'smart reminders at your chosen times'
WHERE feature_key = 'basic_reminders';

UPDATE plan_features SET
    feature_description = 'Community feed with posts and interactions',
    ai_description = 'community feed to share your journey'
WHERE feature_key = 'social_feed';

UPDATE plan_features SET
    feature_description = 'AI-powered text motivation messages',
    ai_description = 'AI-powered motivation messages'
WHERE feature_key = 'text_motivation';

UPDATE plan_features SET
    feature_description = 'Track mood with check-ins (1-5 scale)',
    ai_description = 'mood tracking to understand your emotional patterns'
WHERE feature_key = 'mood_tracking';

UPDATE plan_features SET
    feature_description = 'Photo uploads with check-ins to track visual changes',
    ai_description = 'progress photos to track visual changes'
WHERE feature_key = 'progress_photos';

UPDATE plan_features SET
    feature_description = 'Unlock badges for milestones and achievements',
    ai_description = 'achievement badges to celebrate milestones'
WHERE feature_key = 'achievement_badges';

UPDATE plan_features SET
    feature_description = 'Access to community features and social feed',
    ai_description = 'community feed to share your journey'
WHERE feature_key = 'community_access';

UPDATE plan_features SET
    feature_description = 'Personalize your reminder messages',
    ai_description = 'custom reminder messages tailored to you'
WHERE feature_key = 'custom_reminders';

UPDATE plan_features SET
    feature_description = 'Visual chain visualization for streaks',
    ai_description = 'habit chain visualization to see your consistency'
WHERE feature_key = 'habit_chains';

-- ==================== GOALS ====================

UPDATE plan_features SET
    feature_description = 'Number of goals you can create',
    ai_description = 'goals to track your fitness progress'
WHERE feature_key = 'goals';

UPDATE plan_features SET
    feature_description = 'Create multiple goals (Starter: 3, Pro/Coach+: unlimited)',
    ai_description = 'multiple goals to track different aspects of your fitness'
WHERE feature_key = 'multiple_goals';

UPDATE plan_features SET
    feature_description = 'Create unlimited goals to track all aspects of your fitness',
    ai_description = 'unlimited goals to track different aspects of your fitness'
WHERE feature_key = 'unlimited_goals';

-- ==================== CHALLENGES (PUBLIC, COMPETITIVE) ====================

UPDATE plan_features SET
    feature_description = 'Join public community challenges with leaderboards. Challenges are competitive, time-limited events open to all users.',
    ai_description = 'join community challenges to compete with others'
WHERE feature_key = 'challenge_join';

UPDATE plan_features SET
    feature_description = 'Create and manage public community challenges with leaderboards. Set duration, rules, and track participants.',
    ai_description = 'create community challenges for others to join and compete'
WHERE feature_key = 'challenge_create';

-- ==================== GROUP GOALS (PRIVATE, COLLABORATIVE) ====================

UPDATE plan_features SET
    feature_description = 'Create private, collaborative goals shared with invited friends. Work together on shared objectives and motivate each other.',
    ai_description = 'private group goals to work on together with friends'
WHERE feature_key = 'group_goals';

UPDATE plan_features SET
    feature_description = 'Unlimited private group goals with advanced management. Invite friends, track collective progress, and share accountability.',
    ai_description = 'unlimited private group goals with friends and advanced features'
WHERE feature_key = 'group_goals_premium';

-- ==================== MEAL TRACKING ====================

UPDATE plan_features SET
    feature_description = 'Log meals with basic info (Free), nutritional data & summaries (Starter+)',
    ai_description = 'meal tracking with nutritional information'
WHERE feature_key = 'meal_tracking';

UPDATE plan_features SET
    feature_description = 'Log meals with basic info (name, type, date)',
    ai_description = 'meal tracking with basic information'
WHERE feature_key = 'meal_tracking_basic';

UPDATE plan_features SET
    feature_description = 'Full meal tracking with nutritional data, daily summaries, and photo support',
    ai_description = 'meal tracking with nutritional data and summaries'
WHERE feature_key = 'meal_tracking_full';

UPDATE plan_features SET
    feature_description = 'Advanced nutrition insights, trends, and meal analytics',
    ai_description = 'advanced meal tracking analytics and nutrition insights'
WHERE feature_key = 'meal_tracking_analytics';

-- ==================== SOCIAL ACCOUNTABILITY ====================

UPDATE plan_features SET
    feature_description = 'Share goals with accountability partners for motivation',
    ai_description = 'share goals with friends for accountability'
WHERE feature_key = 'social_accountability';

UPDATE plan_features SET
    feature_description = 'Share 1 goal with 1 friend for accountability',
    ai_description = 'share goals with friends for accountability'
WHERE feature_key = 'social_accountability_basic';

UPDATE plan_features SET
    feature_description = 'Priority partner matching, unlimited goal sharing',
    ai_description = 'premium social accountability with priority matching'
WHERE feature_key = 'social_accountability_premium';

UPDATE plan_features SET
    feature_description = 'Complete access to all social features',
    ai_description = 'complete access to all social and community features'
WHERE feature_key = 'full_social_features';

-- ==================== AI FEATURES ====================

UPDATE plan_features SET
    feature_description = 'Premium AI coach summaries with deep insights and actionable recommendations',
    ai_description = 'AI progress reflections and coaching insights'
WHERE feature_key = 'ai_progress_reflections';

UPDATE plan_features SET
    feature_description = 'Personalized AI coaching conversations for motivation and guidance',
    ai_description = 'personalized AI coaching conversations'
WHERE feature_key = 'ai_chat_motivation';

UPDATE plan_features SET
    feature_description = 'AI learns and adapts to your preferences over time',
    ai_description = 'AI that learns and adapts to your preferences'
WHERE feature_key = 'ai_memory_personalization';

UPDATE plan_features SET
    feature_description = 'AI-generated personalized goal suggestions based on your profile',
    ai_description = 'AI-powered goal generation'
WHERE feature_key = 'ai_goal_generations';

UPDATE plan_features SET
    feature_description = 'AI-powered voice motivation calls (Coming Soon)',
    ai_description = 'AI voice motivation calls'
WHERE feature_key = 'ai_voice_motivation';

UPDATE plan_features SET
    feature_description = 'AI-generated voice motivation messages (Coming Soon)',
    ai_description = 'AI voice motivation calls'
WHERE feature_key = 'voice_motivation';

-- ==================== ANALYTICS ====================

UPDATE plan_features SET
    feature_description = 'Basic progress and performance analytics',
    ai_description = 'basic analytics to track your progress'
WHERE feature_key = 'basic_analytics';

UPDATE plan_features SET
    feature_description = 'Detailed progress and performance analytics with insights',
    ai_description = 'advanced analytics for deep insights'
WHERE feature_key = 'advanced_analytics';

-- ==================== OTHER PREMIUM FEATURES ====================

UPDATE plan_features SET
    feature_description = 'AI-generated weekly progress summaries',
    ai_description = 'weekly recap summaries of your progress'
WHERE feature_key = 'weekly_recap';

UPDATE plan_features SET
    feature_description = 'Unlimited AI-powered text motivation messages',
    ai_description = 'unlimited AI-powered motivation messages'
WHERE feature_key = 'unlimited_text_motivation';

UPDATE plan_features SET
    feature_description = 'Early access to new features before general release',
    ai_description = 'early access to new features'
WHERE feature_key = 'priority_features';

UPDATE plan_features SET
    feature_description = 'Connect with external fitness apps and devices',
    ai_description = 'integrations with external fitness apps and devices'
WHERE feature_key = 'api_integrations';

UPDATE plan_features SET
    feature_description = 'Priority customer support with faster response times',
    ai_description = ''
WHERE feature_key = 'priority_support';

UPDATE plan_features SET
    feature_description = 'Ad-free experience without interruptions',
    ai_description = 'ad-free experience'
WHERE feature_key = 'no_ads';

-- ==================== DOCUMENTATION ====================

COMMENT ON TABLE plan_features IS 
'Plan features mapping. All feature data is stored here and fetched dynamically by the API.

Columns:
- feature_key: Unique identifier for the feature
- feature_name: Display name for the feature
- feature_description: Human-readable description for UI
- ai_description: Short description used in AI prompts (empty = do not mention to AI)
- is_enabled: Whether the feature is implemented and active
- feature_value: Numeric value for features with limits (e.g., goal count)

Key feature distinctions:
- CHALLENGES (challenge_join, challenge_create): PUBLIC, COMPETITIVE events with LEADERBOARDS. Time-limited, open to community.
- GROUP GOALS (group_goals, group_goals_premium): PRIVATE, COLLABORATIVE goals shared with FRIENDS. Ongoing, invite-only.';

COMMENT ON COLUMN plan_features.ai_description IS 'Short description used in AI prompts. Empty string means the feature should not be mentioned by AI.';
