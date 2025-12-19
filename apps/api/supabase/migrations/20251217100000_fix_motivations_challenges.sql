-- =====================================================
-- FIX MOTIVATIONS TABLE FOR CHALLENGES
-- And add generic entity reference to notification_history
-- =====================================================

-- =====================================================
-- PART 1: MOTIVATIONS TABLE
-- Add challenge_id support
-- =====================================================

-- 1. Add challenge_id to motivations table
ALTER TABLE motivations 
ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE;

-- 2. Make goal_id nullable (since motivation can be for goal OR challenge)
ALTER TABLE motivations 
ALTER COLUMN goal_id DROP NOT NULL;

-- 3. Add index for challenge_id
CREATE INDEX IF NOT EXISTS idx_motivations_challenge_id ON motivations(challenge_id);

-- 4. Add check constraint to ensure at least one of goal_id or challenge_id is set
ALTER TABLE motivations DROP CONSTRAINT IF EXISTS chk_motivations_goal_or_challenge;
ALTER TABLE motivations 
ADD CONSTRAINT chk_motivations_goal_or_challenge 
CHECK (goal_id IS NOT NULL OR challenge_id IS NOT NULL);

-- =====================================================
-- PART 2: NOTIFICATION_HISTORY - GENERIC ENTITY REFERENCE
-- 
-- Instead of adding goal_id, challenge_id, post_id, comment_id, etc.
-- as separate FK columns (not scalable), use a generic pattern:
--   entity_type: 'goal', 'challenge', 'post', 'comment', 'follow', etc.
--   entity_id: UUID of the referenced entity
--
-- NO foreign key constraints - this is intentional for:
-- - Flexibility (easy to add new entity types)
-- - Performance (no FK overhead on writes)
-- - Scalability (what Facebook/Instagram/Twitter do)
--
-- Trade-off: Handle "deleted entity" at application layer
-- =====================================================

-- 5. Add entity_type column (what kind of entity this notification references)
ALTER TABLE notification_history 
ADD COLUMN IF NOT EXISTS entity_type TEXT;

-- 6. Add entity_id column (the ID of the referenced entity)
ALTER TABLE notification_history 
ADD COLUMN IF NOT EXISTS entity_id UUID;

-- 7. Add index for efficient lookups by entity
CREATE INDEX IF NOT EXISTS idx_notification_history_entity 
ON notification_history(entity_type, entity_id) 
WHERE entity_type IS NOT NULL;

-- 8. Backfill existing notification_history from JSONB data
-- Goals (from goalId in data)
UPDATE notification_history 
SET entity_type = 'goal', entity_id = (data->>'goalId')::UUID
WHERE data->>'goalId' IS NOT NULL 
  AND entity_type IS NULL;

-- Challenges (from challengeId in data)
UPDATE notification_history 
SET entity_type = 'challenge', entity_id = (data->>'challengeId')::UUID
WHERE data->>'challengeId' IS NOT NULL 
  AND entity_type IS NULL;

-- Posts (from postId in data)
UPDATE notification_history 
SET entity_type = 'post', entity_id = (data->>'postId')::UUID
WHERE data->>'postId' IS NOT NULL 
  AND entity_type IS NULL;

-- Partner requests (from requestId in data)
UPDATE notification_history 
SET entity_type = 'partner_request', entity_id = (data->>'requestId')::UUID
WHERE data->>'requestId' IS NOT NULL 
  AND entity_type IS NULL;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN motivations.goal_id IS 'Goal this motivation is for (NULL if for a challenge)';
COMMENT ON COLUMN motivations.challenge_id IS 'Challenge this motivation is for (NULL if for a goal)';
COMMENT ON COLUMN notification_history.entity_type IS 'Type of entity: goal, challenge, post, comment, follow, partner_request, challenge_invite, achievement, etc.';
COMMENT ON COLUMN notification_history.entity_id IS 'ID of the referenced entity. No FK constraint - handle deleted entities at application level.';

-- =====================================================
-- NOTE ON DELETED ENTITIES
-- 
-- When a goal/challenge/post/etc is deleted:
-- - The notification_history record remains (for audit trail)
-- - entity_id will reference a non-existent record
-- - Frontend should check if entity exists before deep linking
-- - Show "This item has been deleted" if entity is gone
--
-- Optional: Add a background job to clean up old orphaned notifications
-- =====================================================
