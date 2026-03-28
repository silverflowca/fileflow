-- ============================================================================
-- FileFlow - Railway Addendum Migration
-- Run this AFTER railway_full_migration.sql to add tables missing from it.
-- Safe to run multiple times (all use IF NOT EXISTS).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PUBLIC LINKS (share links)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fileflow.public_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_token TEXT NOT NULL UNIQUE,
    file_id UUID REFERENCES fileflow.files(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES fileflow.folders(id) ON DELETE CASCADE,
    permission_level TEXT DEFAULT 'viewer' CHECK (permission_level IN ('viewer', 'editor')),
    requires_password BOOLEAN DEFAULT false,
    password_hash TEXT,
    expires_at TIMESTAMPTZ,
    max_access_count INTEGER,
    current_access_count INTEGER DEFAULT 0,
    created_by UUID NOT NULL REFERENCES fileflow.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    link_type VARCHAR(50) DEFAULT 'view',
    allow_download BOOLEAN DEFAULT true,
    allow_comment BOOLEAN DEFAULT false,
    notify_on_access BOOLEAN DEFAULT false,
    custom_slug VARCHAR(100),
    CONSTRAINT public_links_check CHECK (
        (file_id IS NOT NULL AND folder_id IS NULL) OR
        (file_id IS NULL AND folder_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_fileflow_public_links_token ON fileflow.public_links(link_token);
CREATE INDEX IF NOT EXISTS idx_fileflow_public_links_file ON fileflow.public_links(file_id);
CREATE INDEX IF NOT EXISTS idx_fileflow_public_links_expires ON fileflow.public_links(expires_at);

ALTER TABLE fileflow.public_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create public links for own resources" ON fileflow.public_links;
CREATE POLICY "Users can create public links for own resources"
ON fileflow.public_links FOR INSERT TO authenticated
WITH CHECK (
    created_by = auth.uid() AND (
        EXISTS (SELECT 1 FROM fileflow.files f WHERE f.id = public_links.file_id AND f.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM fileflow.folders f WHERE f.id = public_links.folder_id AND f.owner_id = auth.uid())
    )
);

DROP POLICY IF EXISTS "Users can view public links" ON fileflow.public_links;
CREATE POLICY "Users can view public links"
ON fileflow.public_links FOR SELECT TO authenticated
USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM fileflow.files f WHERE f.id = public_links.file_id AND f.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM fileflow.folders f WHERE f.id = public_links.folder_id AND f.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can delete own public links" ON fileflow.public_links;
CREATE POLICY "Users can delete own public links"
ON fileflow.public_links FOR DELETE TO authenticated
USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Service role full access public_links" ON fileflow.public_links;
CREATE POLICY "Service role full access public_links"
ON fileflow.public_links FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Allow anonymous users to read public links (needed for share page)
DROP POLICY IF EXISTS "Anon can read public links by token" ON fileflow.public_links;
CREATE POLICY "Anon can read public links by token"
ON fileflow.public_links FOR SELECT TO anon
USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON fileflow.public_links TO authenticated;
GRANT ALL ON fileflow.public_links TO service_role;
GRANT SELECT ON fileflow.public_links TO anon;

-- ----------------------------------------------------------------------------
-- ACCESS LOG
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fileflow.access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES fileflow.files(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES fileflow.folders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES fileflow.profiles(id) ON DELETE SET NULL,
    public_link_id UUID REFERENCES fileflow.public_links(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('view', 'download', 'upload', 'delete', 'share', 'rename', 'move')),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    accessed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fileflow_access_log_file ON fileflow.access_log(file_id);
CREATE INDEX IF NOT EXISTS idx_fileflow_access_log_user ON fileflow.access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_fileflow_access_log_time ON fileflow.access_log(accessed_at DESC);

ALTER TABLE fileflow.access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access access_log" ON fileflow.access_log;
CREATE POLICY "Service role full access access_log"
ON fileflow.access_log FOR ALL TO service_role
USING (true) WITH CHECK (true);

GRANT ALL ON fileflow.access_log TO service_role;
GRANT INSERT ON fileflow.access_log TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- API KEYS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fileflow.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(64) NOT NULL,
    key_prefix VARCHAR(16) NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission_level VARCHAR(50) NOT NULL DEFAULT 'read',
    scope_type VARCHAR(50) NOT NULL DEFAULT 'all',
    scope_ids UUID[] DEFAULT '{}',
    rate_limit_per_minute INTEGER DEFAULT 60,
    rate_limit_per_day INTEGER DEFAULT 10000,
    last_used_at TIMESTAMPTZ,
    usage_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_owner_id ON fileflow.api_keys(owner_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON fileflow.api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON fileflow.api_keys(key_hash);

ALTER TABLE fileflow.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role has full access to api_keys" ON fileflow.api_keys;
CREATE POLICY "Service role has full access to api_keys"
ON fileflow.api_keys FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own api_keys" ON fileflow.api_keys;
CREATE POLICY "Users can view their own api_keys"
ON fileflow.api_keys FOR SELECT TO authenticated USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can create api_keys" ON fileflow.api_keys;
CREATE POLICY "Users can create api_keys"
ON fileflow.api_keys FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own api_keys" ON fileflow.api_keys;
CREATE POLICY "Users can update their own api_keys"
ON fileflow.api_keys FOR UPDATE TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own api_keys" ON fileflow.api_keys;
CREATE POLICY "Users can delete their own api_keys"
ON fileflow.api_keys FOR DELETE TO authenticated USING (owner_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON fileflow.api_keys TO authenticated;
GRANT ALL ON fileflow.api_keys TO service_role;

-- Update trigger for api_keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_api_keys_updated_at') THEN
        CREATE TRIGGER trigger_api_keys_updated_at
            BEFORE UPDATE ON fileflow.api_keys
            FOR EACH ROW EXECUTE FUNCTION fileflow.update_updated_at();
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- DOCUMENT ACCESS TOKENS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fileflow.document_access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    token_prefix VARCHAR(8) NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scope_type VARCHAR(50) NOT NULL DEFAULT 'specific',
    file_ids UUID[] DEFAULT '{}',
    folder_ids UUID[] DEFAULT '{}',
    can_view BOOLEAN DEFAULT true,
    can_download BOOLEAN DEFAULT false,
    can_edit BOOLEAN DEFAULT false,
    can_delete BOOLEAN DEFAULT false,
    can_share BOOLEAN DEFAULT false,
    allowed_ips TEXT[] DEFAULT '{}',
    allowed_domains TEXT[] DEFAULT '{}',
    max_downloads INTEGER,
    current_downloads INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(token_hash)
);

CREATE INDEX IF NOT EXISTS idx_doc_tokens_created_by ON fileflow.document_access_tokens(created_by);
CREATE INDEX IF NOT EXISTS idx_doc_tokens_token_hash ON fileflow.document_access_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_doc_tokens_active ON fileflow.document_access_tokens(is_active) WHERE is_active = true;

ALTER TABLE fileflow.document_access_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role has full access to tokens" ON fileflow.document_access_tokens;
CREATE POLICY "Service role has full access to tokens"
ON fileflow.document_access_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own tokens" ON fileflow.document_access_tokens;
CREATE POLICY "Users can view their own tokens"
ON fileflow.document_access_tokens FOR SELECT TO authenticated USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can create tokens" ON fileflow.document_access_tokens;
CREATE POLICY "Users can create tokens"
ON fileflow.document_access_tokens FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update their own tokens" ON fileflow.document_access_tokens;
CREATE POLICY "Users can update their own tokens"
ON fileflow.document_access_tokens FOR UPDATE TO authenticated USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own tokens" ON fileflow.document_access_tokens;
CREATE POLICY "Users can delete their own tokens"
ON fileflow.document_access_tokens FOR DELETE TO authenticated USING (created_by = auth.uid());

GRANT ALL ON fileflow.document_access_tokens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON fileflow.document_access_tokens TO authenticated;

-- ----------------------------------------------------------------------------
-- TOKEN USAGE LOG
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fileflow.token_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id UUID NOT NULL REFERENCES fileflow.document_access_tokens(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    file_id UUID,
    ip_address VARCHAR(45),
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_usage_token_id ON fileflow.token_usage_log(token_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON fileflow.token_usage_log(created_at);

ALTER TABLE fileflow.token_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role has full access to token logs" ON fileflow.token_usage_log;
CREATE POLICY "Service role has full access to token logs"
ON fileflow.token_usage_log FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON fileflow.token_usage_log TO service_role;

-- ----------------------------------------------------------------------------
-- ADMIN AUDIT LOG
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fileflow.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_id ON fileflow.admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON fileflow.admin_audit_log(created_at);

ALTER TABLE fileflow.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role has full access to audit logs" ON fileflow.admin_audit_log;
CREATE POLICY "Service role has full access to audit logs"
ON fileflow.admin_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON fileflow.admin_audit_log TO service_role;
GRANT SELECT ON fileflow.admin_audit_log TO authenticated;

-- ----------------------------------------------------------------------------
-- GRANTS for newly created tables
-- ----------------------------------------------------------------------------
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA fileflow TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA fileflow TO service_role;
