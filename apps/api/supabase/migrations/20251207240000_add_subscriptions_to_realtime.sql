-- Add subscriptions table to Realtime for RevenueCat webhook updates
-- This allows the mobile app to react in real-time when subscription status changes

-- First set REPLICA IDENTITY FULL for proper DELETE event handling
ALTER TABLE subscriptions REPLICA IDENTITY FULL;

-- Add to Realtime publication
DO $$ 
BEGIN
    -- Check if table is already in publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'subscriptions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE subscriptions;
        RAISE NOTICE 'Added subscriptions to supabase_realtime publication';
    ELSE
        RAISE NOTICE 'subscriptions already in supabase_realtime publication';
    END IF;
END $$;

COMMENT ON TABLE subscriptions IS 'User subscriptions - Realtime enabled for instant feature gating updates from RevenueCat webhooks';
