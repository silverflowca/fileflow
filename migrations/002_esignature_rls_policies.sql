-- E-Signature RLS Policies
-- Run this after 001_esignature_tables.sql

-- Enable RLS on all e-signature tables
ALTER TABLE fileflow.signature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE fileflow.signature_signatories ENABLE ROW LEVEL SECURITY;
ALTER TABLE fileflow.signature_audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (safe to run multiple times)
DROP POLICY IF EXISTS "Users can view their own signature requests" ON fileflow.signature_requests;
DROP POLICY IF EXISTS "Users can create signature requests" ON fileflow.signature_requests;
DROP POLICY IF EXISTS "Users can update their own signature requests" ON fileflow.signature_requests;
DROP POLICY IF EXISTS "Users can delete their own signature requests" ON fileflow.signature_requests;
DROP POLICY IF EXISTS "Service role has full access to signature requests" ON fileflow.signature_requests;

DROP POLICY IF EXISTS "Users can view signatories of their requests" ON fileflow.signature_signatories;
DROP POLICY IF EXISTS "Users can create signatories" ON fileflow.signature_signatories;
DROP POLICY IF EXISTS "Users can update signatories" ON fileflow.signature_signatories;
DROP POLICY IF EXISTS "Public can view signatories by token" ON fileflow.signature_signatories;
DROP POLICY IF EXISTS "Public can update signatories by token" ON fileflow.signature_signatories;
DROP POLICY IF EXISTS "Service role has full access to signatories" ON fileflow.signature_signatories;

DROP POLICY IF EXISTS "Users can view audit logs of their requests" ON fileflow.signature_audit_log;
DROP POLICY IF EXISTS "Users can create audit logs" ON fileflow.signature_audit_log;
DROP POLICY IF EXISTS "Service role has full access to audit logs" ON fileflow.signature_audit_log;

-- ============================================================================
-- SIGNATURE REQUESTS POLICIES
-- ============================================================================

-- Service role bypass (for backend server)
CREATE POLICY "Service role has full access to signature requests"
ON fileflow.signature_requests
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Users can view their own requests
CREATE POLICY "Users can view their own signature requests"
ON fileflow.signature_requests
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- Users can create requests
CREATE POLICY "Users can create signature requests"
ON fileflow.signature_requests
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

-- Users can update their own requests
CREATE POLICY "Users can update their own signature requests"
ON fileflow.signature_requests
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- Users can delete their own requests
CREATE POLICY "Users can delete their own signature requests"
ON fileflow.signature_requests
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

-- ============================================================================
-- SIGNATURE SIGNATORIES POLICIES
-- ============================================================================

-- Service role bypass
CREATE POLICY "Service role has full access to signatories"
ON fileflow.signature_signatories
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Users can view signatories of requests they own
CREATE POLICY "Users can view signatories of their requests"
ON fileflow.signature_signatories
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM fileflow.signature_requests sr
    WHERE sr.id = request_id AND sr.owner_id = auth.uid()
  )
);

-- Users can create signatories for their requests
CREATE POLICY "Users can create signatories"
ON fileflow.signature_signatories
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM fileflow.signature_requests sr
    WHERE sr.id = request_id AND sr.owner_id = auth.uid()
  )
);

-- Users can update signatories of their requests
CREATE POLICY "Users can update signatories"
ON fileflow.signature_signatories
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM fileflow.signature_requests sr
    WHERE sr.id = request_id AND sr.owner_id = auth.uid()
  )
);

-- Allow anonymous/public access for signing (via access_token)
CREATE POLICY "Public can view signatories by token"
ON fileflow.signature_signatories
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Public can update signatories by token"
ON fileflow.signature_signatories
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- ============================================================================
-- SIGNATURE AUDIT LOG POLICIES
-- ============================================================================

-- Service role bypass
CREATE POLICY "Service role has full access to audit logs"
ON fileflow.signature_audit_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Users can view audit logs of their requests
CREATE POLICY "Users can view audit logs of their requests"
ON fileflow.signature_audit_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM fileflow.signature_requests sr
    WHERE sr.id = request_id AND sr.owner_id = auth.uid()
  )
);

-- Anyone can create audit logs (for signing actions)
CREATE POLICY "Anyone can create audit logs"
ON fileflow.signature_audit_log
FOR INSERT
TO authenticated, anon
WITH CHECK (true);

-- Grant necessary permissions to authenticated and anon roles
GRANT SELECT, INSERT, UPDATE, DELETE ON fileflow.signature_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fileflow.signature_signatories TO authenticated;
GRANT SELECT, INSERT ON fileflow.signature_audit_log TO authenticated;

GRANT SELECT, UPDATE ON fileflow.signature_signatories TO anon;
GRANT SELECT ON fileflow.signature_requests TO anon;
GRANT INSERT ON fileflow.signature_audit_log TO anon;
