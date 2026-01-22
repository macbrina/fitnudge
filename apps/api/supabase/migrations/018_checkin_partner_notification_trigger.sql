-- =====================================================
-- TRIGGER: Notify partners when check-ins change
-- =====================================================
-- This trigger automatically touches the accountability_partners
-- table when check-ins are inserted, updated, or deleted.
-- This triggers Supabase Realtime events to partners, so their
-- UI can update to show the latest check-in status.
--
-- This replaces the manual notify_partners_of_data_change() calls
-- in the API endpoints, providing a single source of truth.
-- =====================================================

-- Function to notify partners of check-in changes
CREATE OR REPLACE FUNCTION notify_partners_of_checkin_change()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Determine which user's check-in changed
    IF TG_OP = 'DELETE' THEN
        v_user_id := OLD.user_id;
    ELSE
        v_user_id := NEW.user_id;
    END IF;

    -- Skip if no user_id (shouldn't happen, but safety check)
    IF v_user_id IS NULL THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    -- Touch all accepted partnerships involving this user
    -- This triggers Supabase Realtime UPDATE events to partners
    UPDATE accountability_partners
    SET updated_at = NOW()
    WHERE (user_id = v_user_id OR partner_user_id = v_user_id)
      AND status = 'accepted';

    -- Return appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT
DROP TRIGGER IF EXISTS trigger_checkin_partner_notify_insert ON check_ins;
CREATE TRIGGER trigger_checkin_partner_notify_insert
    AFTER INSERT ON check_ins
    FOR EACH ROW
    EXECUTE FUNCTION notify_partners_of_checkin_change();

-- Create trigger for UPDATE
DROP TRIGGER IF EXISTS trigger_checkin_partner_notify_update ON check_ins;
CREATE TRIGGER trigger_checkin_partner_notify_update
    AFTER UPDATE ON check_ins
    FOR EACH ROW
    EXECUTE FUNCTION notify_partners_of_checkin_change();

-- Create trigger for DELETE
DROP TRIGGER IF EXISTS trigger_checkin_partner_notify_delete ON check_ins;
CREATE TRIGGER trigger_checkin_partner_notify_delete
    AFTER DELETE ON check_ins
    FOR EACH ROW
    EXECUTE FUNCTION notify_partners_of_checkin_change();

-- Add comment for documentation
COMMENT ON FUNCTION notify_partners_of_checkin_change() IS 
'Automatically notifies accountability partners when check-ins are modified.
Touches the accountability_partners table to trigger Supabase Realtime events,
so partners can refresh their UI to show updated check-in status.';
