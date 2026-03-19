-- ============================================================================
-- FileFlow - Full Cloud Migration
-- Run this in the Supabase SQL Editor (project: mladgojbfyofgauiylxw)
-- Safe to run multiple times (all statements use IF NOT EXISTS / OR REPLACE)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SCHEMA
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS fileflow;

-- Expose fileflow schema via PostgREST
ALTER ROLE authenticator SET pgrst.db_schemas = 'public,auth,storage,graphql_public,freedombus,integrityhvac,wildacresfarm,wildacresfarm_staging,bookflow,fileflow';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- 2. CORE TABLES
-- ----------------------------------------------------------------------------

-- Profiles
CREATE TABLE IF NOT EXISTS fileflow.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    avatar_url TEXT,
    role VARCHAR(50) DEFAULT 'user',
    account_status VARCHAR(50) DEFAULT 'active',
    storage_quota_bytes BIGINT DEFAULT 10737418240, -- 10GB
    storage_used_bytes BIGINT DEFAULT 0,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Folders
CREATE TABLE IF NOT EXISTS fileflow.folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES fileflow.folders(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Files
CREATE TABLE IF NOT EXISTS fileflow.files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),
    mime_type VARCHAR(255),
    size_bytes BIGINT DEFAULT 0,
    storage_path TEXT NOT NULL,
    bucket_name VARCHAR(255) DEFAULT 'files',
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES fileflow.folders(id) ON DELETE SET NULL,
    is_public BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Add any missing columns to existing files table
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'fileflow' AND table_name = 'files' AND column_name = 'is_public') THEN
        ALTER TABLE fileflow.files ADD COLUMN is_public BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'fileflow' AND table_name = 'files' AND column_name = 'original_name') THEN
        ALTER TABLE fileflow.files ADD COLUMN original_name VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'fileflow' AND table_name = 'files' AND column_name = 'bucket_name') THEN
        ALTER TABLE fileflow.files ADD COLUMN bucket_name VARCHAR(255) DEFAULT 'files';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'fileflow' AND table_name = 'files' AND column_name = 'metadata') THEN
        ALTER TABLE fileflow.files ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'fileflow' AND table_name = 'files' AND column_name = 'deleted_at') THEN
        ALTER TABLE fileflow.files ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. STORAGE BUCKET
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('files', 'files', false, 524288000, NULL) -- 500MB limit
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'files' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'files' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ----------------------------------------------------------------------------
-- 4. FUNCTIONS
-- ----------------------------------------------------------------------------

-- Update storage used when files are added/deleted
CREATE OR REPLACE FUNCTION fileflow.update_storage_used(user_id UUID, bytes_delta BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE fileflow.profiles
    SET storage_used_bytes = GREATEST(0, COALESCE(storage_used_bytes, 0) + bytes_delta),
        updated_at = NOW()
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION fileflow.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 5. TRIGGERS
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_profiles_updated_at') THEN
        CREATE TRIGGER trigger_profiles_updated_at
            BEFORE UPDATE ON fileflow.profiles
            FOR EACH ROW EXECUTE FUNCTION fileflow.update_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_folders_updated_at') THEN
        CREATE TRIGGER trigger_folders_updated_at
            BEFORE UPDATE ON fileflow.folders
            FOR EACH ROW EXECUTE FUNCTION fileflow.update_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_files_updated_at') THEN
        CREATE TRIGGER trigger_files_updated_at
            BEFORE UPDATE ON fileflow.files
            FOR EACH ROW EXECUTE FUNCTION fileflow.update_updated_at();
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_files_owner_id ON fileflow.files(owner_id);
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON fileflow.files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_deleted_at ON fileflow.files(deleted_at);
CREATE INDEX IF NOT EXISTS idx_folders_owner_id ON fileflow.folders(owner_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON fileflow.folders(parent_id);

-- ----------------------------------------------------------------------------
-- 7. RLS
-- ----------------------------------------------------------------------------
ALTER TABLE fileflow.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fileflow.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE fileflow.files ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON fileflow.profiles;
CREATE POLICY "Users can view own profile" ON fileflow.profiles
    FOR SELECT TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own profile" ON fileflow.profiles;
CREATE POLICY "Users can insert own profile" ON fileflow.profiles
    FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON fileflow.profiles;
CREATE POLICY "Users can update own profile" ON fileflow.profiles
    FOR UPDATE TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "Service role full access profiles" ON fileflow.profiles;
CREATE POLICY "Service role full access profiles" ON fileflow.profiles
    TO service_role USING (true) WITH CHECK (true);

-- Folders
DROP POLICY IF EXISTS "Users can manage own folders" ON fileflow.folders;
CREATE POLICY "Users can manage own folders" ON fileflow.folders
    FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access folders" ON fileflow.folders;
CREATE POLICY "Service role full access folders" ON fileflow.folders
    TO service_role USING (true) WITH CHECK (true);

-- Files
DROP POLICY IF EXISTS "Users can manage own files" ON fileflow.files;
CREATE POLICY "Users can manage own files" ON fileflow.files
    FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can view public files" ON fileflow.files;
CREATE POLICY "Users can view public files" ON fileflow.files
    FOR SELECT USING (is_public = true);

DROP POLICY IF EXISTS "Service role full access files" ON fileflow.files;
CREATE POLICY "Service role full access files" ON fileflow.files
    TO service_role USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 8. E-SIGNATURE TABLES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fileflow.signature_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_id UUID REFERENCES fileflow.files(id) ON DELETE SET NULL,
    original_file_url TEXT,
    original_file_name VARCHAR(255),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    signed_document_url TEXT,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS fileflow.signature_signatories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES fileflow.signature_requests(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    order_index INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    signed_at TIMESTAMPTZ,
    signature_data TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    access_token UUID DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fileflow.signature_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES fileflow.signature_requests(id) ON DELETE CASCADE,
    signatory_id UUID REFERENCES fileflow.signature_signatories(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    actor_email VARCHAR(255),
    actor_name VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sig_requests_owner ON fileflow.signature_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_sig_requests_status ON fileflow.signature_requests(status);
CREATE INDEX IF NOT EXISTS idx_sig_signatories_request ON fileflow.signature_signatories(request_id);
CREATE INDEX IF NOT EXISTS idx_sig_signatories_token ON fileflow.signature_signatories(access_token);
CREATE INDEX IF NOT EXISTS idx_sig_audit_request ON fileflow.signature_audit_log(request_id);

ALTER TABLE fileflow.signature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE fileflow.signature_signatories ENABLE ROW LEVEL SECURITY;
ALTER TABLE fileflow.signature_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own signature requests" ON fileflow.signature_requests;
CREATE POLICY "Users manage own signature requests" ON fileflow.signature_requests
    FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access sig requests" ON fileflow.signature_requests;
CREATE POLICY "Service role full access sig requests" ON fileflow.signature_requests
    TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users view signatories of own requests" ON fileflow.signature_signatories;
CREATE POLICY "Users view signatories of own requests" ON fileflow.signature_signatories
    FOR SELECT TO authenticated
    USING (request_id IN (SELECT id FROM fileflow.signature_requests WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users manage signatories of own requests" ON fileflow.signature_signatories;
CREATE POLICY "Users manage signatories of own requests" ON fileflow.signature_signatories
    FOR ALL TO authenticated
    USING (request_id IN (SELECT id FROM fileflow.signature_requests WHERE owner_id = auth.uid()))
    WITH CHECK (request_id IN (SELECT id FROM fileflow.signature_requests WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Public can view signatories by token" ON fileflow.signature_signatories;
CREATE POLICY "Public can view signatories by token" ON fileflow.signature_signatories
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can update signatories by token" ON fileflow.signature_signatories;
CREATE POLICY "Public can update signatories by token" ON fileflow.signature_signatories
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access signatories" ON fileflow.signature_signatories;
CREATE POLICY "Service role full access signatories" ON fileflow.signature_signatories
    TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users view own audit logs" ON fileflow.signature_audit_log;
CREATE POLICY "Users view own audit logs" ON fileflow.signature_audit_log
    FOR SELECT TO authenticated
    USING (request_id IN (SELECT id FROM fileflow.signature_requests WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Service role full access audit" ON fileflow.signature_audit_log;
CREATE POLICY "Service role full access audit" ON fileflow.signature_audit_log
    TO service_role USING (true) WITH CHECK (true);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_sig_requests_updated_at') THEN
        CREATE TRIGGER trigger_sig_requests_updated_at
            BEFORE UPDATE ON fileflow.signature_requests
            FOR EACH ROW EXECUTE FUNCTION fileflow.update_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_sig_signatories_updated_at') THEN
        CREATE TRIGGER trigger_sig_signatories_updated_at
            BEFORE UPDATE ON fileflow.signature_signatories
            FOR EACH ROW EXECUTE FUNCTION fileflow.update_updated_at();
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 9. ADMIN / ROLE COLUMNS (migration 009)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'fileflow' AND table_name = 'profiles' AND column_name = 'role') THEN
        ALTER TABLE fileflow.profiles ADD COLUMN role VARCHAR(50) DEFAULT 'user';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'fileflow' AND table_name = 'profiles' AND column_name = 'account_status') THEN
        ALTER TABLE fileflow.profiles ADD COLUMN account_status VARCHAR(50) DEFAULT 'active';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'fileflow' AND table_name = 'profiles' AND column_name = 'last_login_at') THEN
        ALTER TABLE fileflow.profiles ADD COLUMN last_login_at TIMESTAMPTZ;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 10. GRANTS
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA fileflow TO service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA fileflow TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA fileflow TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA fileflow TO authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA fileflow TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA fileflow TO anon;
GRANT EXECUTE ON FUNCTION fileflow.update_storage_used TO service_role, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA fileflow GRANT ALL PRIVILEGES ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA fileflow GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA fileflow GRANT ALL PRIVILEGES ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA fileflow GRANT ALL PRIVILEGES ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA fileflow GRANT SELECT ON TABLES TO anon;
