// E-Signature Module Types

export interface SignatureRequest {
  id: string;
  title: string;
  description?: string;
  file_id?: string;
  original_file_url?: string;
  original_file_name?: string;
  owner_id: string;
  status: 'draft' | 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  expires_at?: string;
  completed_at?: string;
  signed_document_url?: string;
  deleted_at?: string;
  signatories?: Signatory[];
}

export interface Signatory {
  id: string;
  request_id: string;
  name: string;
  email: string;
  title?: string;
  order_index: number;
  status: 'pending' | 'sent' | 'viewed' | 'signed' | 'declined';
  signed_at?: string;
  signature_data?: string;
  ip_address?: string;
  user_agent?: string;
  access_token: string;
  created_at: string;
  updated_at: string;
}

export interface SignatoryInput {
  name: string;
  email: string;
  title?: string;
}

export interface SignatureAuditLog {
  id: string;
  request_id: string;
  signatory_id?: string;
  action: string;
  actor_email?: string;
  actor_name?: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface CreateSignatureRequestInput {
  title: string;
  description?: string;
  file_id?: string;
  signatories: SignatoryInput[];
  expires_at?: string;
}

export interface SignDocumentInput {
  signatory_id: string;
  access_token: string;
  signature_data: string; // Base64 encoded signature image
  name: string;
  email: string;
}
