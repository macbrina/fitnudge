-- Add trigger to cascade deletes from auth.users to public.users
-- This ensures data consistency if user is deleted from Supabase Dashboard or directly via SQL

-- Create function to handle auth.users deletion
CREATE OR REPLACE FUNCTION public.handle_auth_user_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete from public.users when auth.users is deleted
    -- The CASCADE on public.users foreign keys will handle related tables
    DELETE FROM public.users WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
-- Note: This requires the trigger to be created in the auth schema
DO $$
BEGIN
    -- Drop existing trigger if it exists
    DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
    
    -- Create new trigger
    CREATE TRIGGER on_auth_user_deleted
        AFTER DELETE ON auth.users
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_auth_user_deletion();
        
    RAISE NOTICE 'Created trigger on_auth_user_deleted on auth.users';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE WARNING 'Cannot create trigger on auth.users - insufficient privileges. Delete cascade from auth.users to public.users will not work automatically.';
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to create trigger on auth.users: %', SQLERRM;
END $$;

-- Also create reverse trigger: when public.users is deleted, delete from auth.users
CREATE OR REPLACE FUNCTION public.handle_public_user_deletion()
RETURNS TRIGGER AS $$
DECLARE
    supabase_service_role TEXT;
BEGIN
    -- Use auth.admin functions to delete user from auth.users
    -- This runs with SECURITY DEFINER so it has elevated privileges
    PERFORM auth.uid(); -- This will fail if not in auth context, that's ok
    
    -- Try to delete from auth.users
    DELETE FROM auth.users WHERE id = OLD.id;
    RETURN OLD;
EXCEPTION
    WHEN OTHERS THEN
        -- Log but don't fail - public.users deletion should still proceed
        RAISE WARNING 'Could not delete user % from auth.users: %', OLD.id, SQLERRM;
        RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on public.users (for reverse cascade)
DROP TRIGGER IF EXISTS on_public_user_deleted ON public.users;
CREATE TRIGGER on_public_user_deleted
    BEFORE DELETE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_public_user_deletion();

-- Add comment explaining the triggers
COMMENT ON FUNCTION public.handle_auth_user_deletion() IS 
    'Cascades user deletion from auth.users to public.users';
COMMENT ON FUNCTION public.handle_public_user_deletion() IS 
    'Cascades user deletion from public.users to auth.users';

