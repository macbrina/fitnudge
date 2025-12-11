-- Add updated_at column to check_ins table
ALTER TABLE check_ins 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create trigger to auto-update updated_at on row update
CREATE OR REPLACE FUNCTION update_check_ins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS check_ins_updated_at_trigger ON check_ins;

-- Create the trigger
CREATE TRIGGER check_ins_updated_at_trigger
    BEFORE UPDATE ON check_ins
    FOR EACH ROW
    EXECUTE FUNCTION update_check_ins_updated_at();

-- Backfill existing records with created_at as updated_at
UPDATE check_ins SET updated_at = created_at WHERE updated_at IS NULL;
