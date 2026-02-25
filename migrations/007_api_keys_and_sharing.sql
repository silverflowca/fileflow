-- API Keys and Enhanced Sharing for FileFlow
-- This migration adds API keys for programmatic access and enhances sharing capabilities

-- API Keys: Allow users to generate API keys for read-only or edit access
CREATE TABLE IF NOT EXISTS fileflow.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of the actual key
    key_prefix VARCHAR(8) NOT NULL, -- First 8 chars for identification (e.g., "ff_xxxx...")
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission_level VARCHAR(50) NOT NULL DEFAULT 'read', -- 'read', 'write', 'admin'
    -- Scope restrictions
    scope_type VARCHAR(50) NOT NULL DEFAULT 'all', -- 'all', 'folder', 'file'
    scope_ids UUID[] DEFAULT '{}', -- Array of folder/file IDs this key can access
    -- Rate limiting
    rate_limit_per_minute INTEGER DEFAULT 60,
    rate_limit_per_day INTEGER DEFAULT 10000,
    -- Metadata
    last_used_at TIMESTAMP WITH TIME ZONE,
    usage_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Share links (enhanced public_links with more features)
-- Check if link_type column exists before adding
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'fileflow'
        AND table_name = 'public_links'
        AND column_name = 'link_type'
    ) THEN
        ALTER TABLE fileflow.public_links ADD COLUMN link_type VARCHAR(50) DEFAULT 'view';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'fileflow'
        AND table_name = 'public_links'
        AND column_name = 'allow_download'
    ) THEN
        ALTER TABLE fileflow.public_links ADD COLUMN allow_download BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'fileflow'
        AND table_name = 'public_links'
        AND column_name = 'allow_comment'
    ) THEN
        ALTER TABLE fileflow.public_links ADD COLUMN allow_comment BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'fileflow'
        AND table_name = 'public_links'
        AND column_name = 'notify_on_access'
    ) THEN
        ALTER TABLE fileflow.public_links ADD COLUMN notify_on_access BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'fileflow'
        AND table_name = 'public_links'
        AND column_name = 'custom_slug'
    ) THEN
        ALTER TABLE fileflow.public_links ADD COLUMN custom_slug VARCHAR(100);
    END IF;
END;
$$;

-- Indexes for API keys
CREATE INDEX IF NOT EXISTS idx_api_keys_owner_id ON fileflow.api_keys(owner_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON fileflow.api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON fileflow.api_keys(key_hash);

-- Update trigger for api_keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_api_keys_updated_at') THEN
        CREATE TRIGGER trigger_api_keys_updated_at
            BEFORE UPDATE ON fileflow.api_keys
            FOR EACH ROW EXECUTE FUNCTION fileflow.update_signature_updated_at();
    END IF;
END;
$$;

-- Enable RLS
ALTER TABLE fileflow.api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies for API keys
DROP POLICY IF EXISTS "Service role has full access to api_keys" ON fileflow.api_keys;
DROP POLICY IF EXISTS "Users can view their own api_keys" ON fileflow.api_keys;
DROP POLICY IF EXISTS "Users can create api_keys" ON fileflow.api_keys;
DROP POLICY IF EXISTS "Users can update their own api_keys" ON fileflow.api_keys;
DROP POLICY IF EXISTS "Users can delete their own api_keys" ON fileflow.api_keys;

CREATE POLICY "Service role has full access to api_keys"
ON fileflow.api_keys
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can view their own api_keys"
ON fileflow.api_keys
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Users can create api_keys"
ON fileflow.api_keys
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own api_keys"
ON fileflow.api_keys
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete their own api_keys"
ON fileflow.api_keys
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON fileflow.api_keys TO authenticated;
GRANT ALL ON fileflow.api_keys TO service_role;

-- Function to generate file URLs (for API responses)
CREATE OR REPLACE FUNCTION fileflow.get_file_urls(file_id UUID)
RETURNS JSONB AS $$
DECLARE
    file_record RECORD;
    result JSONB;
BEGIN
    SELECT * INTO file_record FROM fileflow.files WHERE id = file_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    result := jsonb_build_object(
        'storage_path', file_record.storage_path,
        'bucket_name', file_record.bucket_name,
        'internal_path', '/api/storage/download/' || file_id::text,
        'file_id', file_id
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
