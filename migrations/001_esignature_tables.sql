-- E-Signature Module Tables for FileFlow
-- This migration creates tables for managing document signing requests
-- NOTE: This only creates new tables, it does NOT reset or modify existing data

-- Signature Requests: Main table for signature request documents
CREATE TABLE IF NOT EXISTS fileflow.signature_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_id UUID REFERENCES fileflow.files(id) ON DELETE SET NULL,
    original_file_url TEXT,
    original_file_name VARCHAR(255),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft, pending, in_progress, completed, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    signed_document_url TEXT, -- URL to the final signed PDF
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Signatories: People who need to sign the document
CREATE TABLE IF NOT EXISTS fileflow.signature_signatories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES fileflow.signature_requests(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    title VARCHAR(255), -- e.g., "CEO", "Witness", "Contractor"
    order_index INTEGER NOT NULL DEFAULT 0, -- Signing order
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, sent, viewed, signed, declined
    signed_at TIMESTAMP WITH TIME ZONE,
    signature_data TEXT, -- Base64 encoded signature image
    ip_address VARCHAR(45),
    user_agent TEXT,
    access_token UUID DEFAULT gen_random_uuid(), -- Unique token for signing link
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Signature Audit Log: Track all actions on signature requests
CREATE TABLE IF NOT EXISTS fileflow.signature_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES fileflow.signature_requests(id) ON DELETE CASCADE,
    signatory_id UUID REFERENCES fileflow.signature_signatories(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- created, sent, viewed, signed, declined, completed, expired
    actor_email VARCHAR(255),
    actor_name VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance (IF NOT EXISTS is implicit with CREATE INDEX ... IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_signature_requests_owner_id ON fileflow.signature_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_status ON fileflow.signature_requests(status);
CREATE INDEX IF NOT EXISTS idx_signature_signatories_request_id ON fileflow.signature_signatories(request_id);
CREATE INDEX IF NOT EXISTS idx_signature_signatories_access_token ON fileflow.signature_signatories(access_token);
CREATE INDEX IF NOT EXISTS idx_signature_signatories_email ON fileflow.signature_signatories(email);
CREATE INDEX IF NOT EXISTS idx_signature_audit_log_request_id ON fileflow.signature_audit_log(request_id);

-- Update timestamp trigger function (CREATE OR REPLACE is safe)
CREATE OR REPLACE FUNCTION fileflow.update_signature_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers only if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_signature_requests_updated_at') THEN
        CREATE TRIGGER trigger_signature_requests_updated_at
            BEFORE UPDATE ON fileflow.signature_requests
            FOR EACH ROW EXECUTE FUNCTION fileflow.update_signature_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_signature_signatories_updated_at') THEN
        CREATE TRIGGER trigger_signature_signatories_updated_at
            BEFORE UPDATE ON fileflow.signature_signatories
            FOR EACH ROW EXECUTE FUNCTION fileflow.update_signature_updated_at();
    END IF;
END;
$$;
