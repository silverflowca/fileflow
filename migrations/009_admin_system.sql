-- Migration: Admin System
-- Description: Add user roles, admin capabilities, and document access tokens

-- Add role column to profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'fileflow' AND table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE fileflow.profiles ADD COLUMN role VARCHAR(50) DEFAULT 'user';
  END IF;
END $$;

-- Add account status column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'fileflow' AND table_name = 'profiles' AND column_name = 'account_status'
  ) THEN
    ALTER TABLE fileflow.profiles ADD COLUMN account_status VARCHAR(50) DEFAULT 'active';
  END IF;
END $$;

-- Add last_login_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'fileflow' AND table_name = 'profiles' AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE fileflow.profiles ADD COLUMN last_login_at TIMESTAMPTZ;
  END IF;
END $$;

-- Create document access tokens table
CREATE TABLE IF NOT EXISTS fileflow.document_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  token_prefix VARCHAR(8) NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Access scope
  scope_type VARCHAR(50) NOT NULL DEFAULT 'specific', -- 'all', 'folder', 'specific'
  file_ids UUID[] DEFAULT '{}',
  folder_ids UUID[] DEFAULT '{}',

  -- Permissions
  can_view BOOLEAN DEFAULT true,
  can_download BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_share BOOLEAN DEFAULT false,

  -- Restrictions
  allowed_ips TEXT[] DEFAULT '{}',
  allowed_domains TEXT[] DEFAULT '{}',
  max_downloads INTEGER,
  current_downloads INTEGER DEFAULT 0,

  -- Validity
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,

  -- Audit
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(token_hash)
);

-- Create token usage log
CREATE TABLE IF NOT EXISTS fileflow.token_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES fileflow.document_access_tokens(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'view', 'download', 'edit', 'delete', 'share'
  file_id UUID,
  ip_address VARCHAR(45),
  user_agent TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create admin audit log
CREATE TABLE IF NOT EXISTS fileflow.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL, -- 'user', 'token', 'file', 'system'
  target_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_doc_tokens_created_by ON fileflow.document_access_tokens(created_by);
CREATE INDEX IF NOT EXISTS idx_doc_tokens_token_hash ON fileflow.document_access_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_doc_tokens_active ON fileflow.document_access_tokens(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_token_usage_token_id ON fileflow.token_usage_log(token_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON fileflow.token_usage_log(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_id ON fileflow.admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON fileflow.admin_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON fileflow.profiles(role);

-- Enable RLS
ALTER TABLE fileflow.document_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE fileflow.token_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE fileflow.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for document_access_tokens
CREATE POLICY "Service role has full access to tokens"
  ON fileflow.document_access_tokens FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view their own tokens"
  ON fileflow.document_access_tokens FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Users can create tokens"
  ON fileflow.document_access_tokens FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own tokens"
  ON fileflow.document_access_tokens FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own tokens"
  ON fileflow.document_access_tokens FOR DELETE
  USING (created_by = auth.uid());

-- RLS Policies for token_usage_log
CREATE POLICY "Service role has full access to token logs"
  ON fileflow.token_usage_log FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for admin_audit_log
CREATE POLICY "Service role has full access to audit logs"
  ON fileflow.admin_audit_log FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL PRIVILEGES ON fileflow.document_access_tokens TO service_role;
GRANT ALL PRIVILEGES ON fileflow.token_usage_log TO service_role;
GRANT ALL PRIVILEGES ON fileflow.admin_audit_log TO service_role;
GRANT ALL PRIVILEGES ON fileflow.document_access_tokens TO authenticated;
GRANT ALL PRIVILEGES ON fileflow.token_usage_log TO authenticated;
GRANT SELECT ON fileflow.admin_audit_log TO authenticated;

-- Update default admin user to have admin role
UPDATE fileflow.profiles
SET role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'admin@fileflow.local'
);
