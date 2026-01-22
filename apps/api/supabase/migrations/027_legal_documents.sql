-- ============================================================================
-- Migration: 027_legal_documents
-- Description: Legal documents table for Terms of Service, Privacy Policy, etc.
-- ============================================================================

-- Legal documents table with versioning support
CREATE TABLE IF NOT EXISTS legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Document type
  type TEXT NOT NULL CHECK (type IN ('terms_of_service', 'privacy_policy', 'cookie_policy')),
  
  -- Version info
  version TEXT NOT NULL,                    -- e.g., "1.0", "1.1", "2.0"
  title TEXT NOT NULL,                      -- Display title, e.g., "Terms of Service"
  
  -- Content
  content TEXT NOT NULL,                    -- HTML content
  summary TEXT,                             -- Optional brief summary of changes
  
  -- Dates
  effective_date TIMESTAMPTZ NOT NULL,      -- When this version becomes/became active
  
  -- Status
  is_current BOOLEAN DEFAULT false,         -- Quick flag for current active version
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  UNIQUE(type, version)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_legal_documents_type ON legal_documents(type);
CREATE INDEX IF NOT EXISTS idx_legal_documents_current ON legal_documents(type, is_current) WHERE is_current = true;

-- Trigger to ensure only one current version per type
CREATE OR REPLACE FUNCTION ensure_single_current_legal_document()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = true THEN
    -- Set all other documents of the same type to not current
    UPDATE legal_documents
    SET is_current = false, updated_at = now()
    WHERE type = NEW.type AND id != NEW.id AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_single_current_legal_document ON legal_documents;
CREATE TRIGGER trigger_single_current_legal_document
  BEFORE INSERT OR UPDATE ON legal_documents
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_current_legal_document();

-- Updated at trigger
DROP TRIGGER IF EXISTS update_legal_documents_updated_at ON legal_documents;
CREATE TRIGGER update_legal_documents_updated_at
  BEFORE UPDATE ON legal_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- User acceptance tracking (optional but recommended for compliance)
CREATE TABLE IF NOT EXISTS user_legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  legal_document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ DEFAULT now(),
  ip_address INET,                          -- For audit purposes
  user_agent TEXT,                          -- For audit purposes
  
  -- Prevent duplicate acceptances of same document
  UNIQUE(user_id, legal_document_id)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_user_legal_acceptances_user ON user_legal_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_user_legal_acceptances_document ON user_legal_acceptances(legal_document_id);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_legal_acceptances ENABLE ROW LEVEL SECURITY;

-- Legal documents are publicly readable (anyone can view ToS, Privacy Policy)
DROP POLICY IF EXISTS "Legal documents are publicly readable" ON legal_documents;
CREATE POLICY "Legal documents are publicly readable"
  ON legal_documents FOR SELECT
  TO authenticated, anon
  USING (true);

-- Only service role can modify legal documents
DROP POLICY IF EXISTS "Service role can manage legal documents" ON legal_documents;
CREATE POLICY "Service role can manage legal documents"
  ON legal_documents FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can view their own acceptances
DROP POLICY IF EXISTS "Users can view their own legal acceptances" ON user_legal_acceptances;
CREATE POLICY "Users can view their own legal acceptances"
  ON user_legal_acceptances FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own acceptances
DROP POLICY IF EXISTS "Users can create their own legal acceptances" ON user_legal_acceptances;
CREATE POLICY "Users can create their own legal acceptances"
  ON user_legal_acceptances FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Service role full access to acceptances
DROP POLICY IF EXISTS "Service role can manage legal acceptances" ON user_legal_acceptances;
CREATE POLICY "Service role can manage legal acceptances"
  ON user_legal_acceptances FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Get current legal document by type
CREATE OR REPLACE FUNCTION get_current_legal_document(doc_type TEXT)
RETURNS TABLE (
  id UUID,
  type TEXT,
  version TEXT,
  title TEXT,
  content TEXT,
  effective_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ld.id,
    ld.type,
    ld.version,
    ld.title,
    ld.content,
    ld.effective_date
  FROM legal_documents ld
  WHERE ld.type = doc_type AND ld.is_current = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user has accepted current version
CREATE OR REPLACE FUNCTION has_user_accepted_current_legal(
  p_user_id UUID,
  doc_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  current_doc_id UUID;
BEGIN
  -- Get current document ID
  SELECT id INTO current_doc_id
  FROM legal_documents
  WHERE type = doc_type AND is_current = true
  LIMIT 1;
  
  IF current_doc_id IS NULL THEN
    RETURN true; -- No document exists, consider accepted
  END IF;
  
  -- Check if user has accepted this document
  RETURN EXISTS (
    SELECT 1 FROM user_legal_acceptances
    WHERE user_id = p_user_id AND legal_document_id = current_doc_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Seed initial documents (empty placeholders - update via admin)
-- ============================================================================

-- Note: Insert your actual ToS and Privacy Policy content here or via admin panel
-- Example structure:
-- INSERT INTO legal_documents (type, version, title, content, effective_date, is_current)
-- VALUES 
--   ('terms_of_service', '1.0', 'Terms of Service', '<div>...</div>', now(), true),
--   ('privacy_policy', '1.0', 'Privacy Policy', '<div>...</div>', now(), true);
