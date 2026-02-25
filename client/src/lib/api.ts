// Simple API client for FileFlow backend

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8680';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('fileflow_token', token);
    } else {
      localStorage.removeItem('fileflow_token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('fileflow_token');
    }
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  // Auth
  async login(email: string, password: string) {
    const data = await this.request<{
      user: any;
      session: { access_token: string };
      profile: any;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    this.setToken(data.session.access_token);
    return data;
  }

  async register(email: string, password: string, displayName: string) {
    const data = await this.request<{
      user: any;
      session: { access_token: string } | null;
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });

    if (data.session) {
      this.setToken(data.session.access_token);
    }
    return data;
  }

  async getMe() {
    return this.request<{ user: any; profile: any }>('/api/auth/me');
  }

  logout() {
    this.setToken(null);
  }

  // Folders
  async getFolders(parentId: string | null = null) {
    const param = parentId || 'null';
    return this.request<any[]>(`/api/folders?parent_id=${param}`);
  }

  async createFolder(name: string, parentId: string | null = null) {
    return this.request<any>('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parent_id: parentId }),
    });
  }

  async deleteFolder(id: string) {
    return this.request<{ success: boolean }>(`/api/folders/${id}`, {
      method: 'DELETE',
    });
  }

  // Files
  async getFiles(folderId: string | null = null) {
    const param = folderId || 'null';
    return this.request<any[]>(`/api/files?folder_id=${param}`);
  }

  async createFileRecord(fileData: {
    name: string;
    file_type: string;
    file_extension: string;
    size_bytes: number;
    folder_id: string | null;
    storage_path: string;
    bucket_name: string;
    upload_status: string;
    thumbnail_path?: string;
    dimensions?: { width: number; height: number };
    duration_seconds?: number;
  }) {
    return this.request<any>('/api/files', {
      method: 'POST',
      body: JSON.stringify(fileData),
    });
  }

  async deleteFile(id: string) {
    return this.request<{ success: boolean }>(`/api/files/${id}`, {
      method: 'DELETE',
    });
  }

  async getUploadUrl(fileName: string, fileType: string, folderId: string | null) {
    return this.request<{
      uploadUrl: string;
      storagePath: string;
      token: string;
    }>('/api/files/upload-url', {
      method: 'POST',
      body: JSON.stringify({ fileName, fileType, folderId }),
    });
  }

  async getDownloadUrl(fileId: string) {
    return this.request<{ url: string; fileName: string }>(
      `/api/storage/download/${fileId}`
    );
  }

  // E-Signature API methods
  async getSignatureRequests() {
    return this.request<any[]>('/api/esignature/requests');
  }

  async getFileSignatures(fileId: string) {
    return this.request<any[]>(`/api/files/${fileId}/signatures`);
  }

  async getSignatureRequest(id: string) {
    return this.request<any>(`/api/esignature/requests/${id}`);
  }

  async createSignatureRequest(data: {
    title: string;
    description?: string;
    file_id?: string;
    signatories: { name: string; email: string; title?: string }[];
    expires_at?: string;
  }) {
    return this.request<any>('/api/esignature/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async sendSignatureRequest(id: string) {
    return this.request<{ success: boolean }>(`/api/esignature/requests/${id}/send`, {
      method: 'POST',
    });
  }

  async cancelSignatureRequest(id: string) {
    return this.request<{ success: boolean }>(`/api/esignature/requests/${id}/cancel`, {
      method: 'POST',
    });
  }

  async deleteSignatureRequest(id: string) {
    return this.request<{ success: boolean }>(`/api/esignature/requests/${id}`, {
      method: 'DELETE',
    });
  }

  async getSigningDetails(token: string) {
    return this.request<{ request: any; signatory: any }>(
      `/api/esignature/sign/${token}`
    );
  }

  async signDocument(data: {
    signatory_id: string;
    access_token: string;
    signature_data: string;
    name: string;
    email: string;
  }) {
    return this.request<{ success: boolean; all_signed: boolean }>(
      '/api/esignature/sign',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async downloadSignedPdf(requestId: string): Promise<void> {
    const token = this.getToken();
    const response = await fetch(`${API_URL}/api/esignature/requests/${requestId}/pdf`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to download PDF');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signature_document_${requestId}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  // ============================================================================
  // FILE DETAILS & SHARING
  // ============================================================================

  async getFileDetails(fileId: string) {
    return this.request<{
      id: string;
      name: string;
      file_type: string;
      size_bytes: number;
      urls: {
        download: string;
        internal: string;
        view: string;
        embed: string;
      };
      sharing: {
        publicLinks: any[];
        permissionsCount: number;
        isPublic: boolean;
      };
      stats: {
        versionsCount: number;
        currentVersion: number;
      };
      access: {
        isOwner: boolean;
        canEdit: boolean;
        canShare: boolean;
        canDelete: boolean;
      };
    }>(`/api/files/${fileId}/details`);
  }

  // Public links (sharing)
  async getFileLinks(fileId: string) {
    return this.request<any[]>(`/api/files/${fileId}/links`);
  }

  async createFileLink(fileId: string, options: {
    permission_level?: 'viewer' | 'editor';
    expires_at?: string;
    max_access_count?: number;
    requires_password?: boolean;
    password?: string;
    allow_download?: boolean;
    allow_comment?: boolean;
  }) {
    return this.request<{
      id: string;
      link_token: string;
      shareUrl: string;
      embedUrl: string;
    }>(`/api/files/${fileId}/links`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async deleteFileLink(fileId: string, linkId: string) {
    return this.request<{ success: boolean }>(`/api/files/${fileId}/links/${linkId}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // API KEYS
  // ============================================================================

  async getApiKeys() {
    return this.request<{
      id: string;
      name: string;
      key_prefix: string;
      permission_level: string;
      scope_type: string;
      last_used_at: string | null;
      usage_count: number;
      created_at: string;
    }[]>('/api/keys');
  }

  async createApiKey(options: {
    name: string;
    permission_level?: 'read' | 'write' | 'admin';
    scope_type?: 'all' | 'folder' | 'file';
    scope_ids?: string[];
    expires_at?: string;
  }) {
    return this.request<{
      id: string;
      name: string;
      key: string; // Only shown once!
      key_prefix: string;
      permission_level: string;
      message: string;
    }>('/api/keys', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async revokeApiKey(keyId: string) {
    return this.request<{ success: boolean }>(`/api/keys/${keyId}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // E-SIGNATURE SIGNATORY MANAGEMENT
  // ============================================================================

  async addSignatory(requestId: string, signatory: {
    name: string;
    email: string;
    title?: string;
    order_index?: number;
  }) {
    return this.request<any>(`/api/esignature/requests/${requestId}/signatories`, {
      method: 'POST',
      body: JSON.stringify(signatory),
    });
  }

  async updateSignatory(requestId: string, signatoryId: string, updates: {
    name?: string;
    email?: string;
    title?: string;
    order_index?: number;
  }) {
    return this.request<any>(`/api/esignature/requests/${requestId}/signatories/${signatoryId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async removeSignatory(requestId: string, signatoryId: string) {
    return this.request<{ success: boolean }>(`/api/esignature/requests/${requestId}/signatories/${signatoryId}`, {
      method: 'DELETE',
    });
  }

  async getSignatureStatusUrl(requestId: string) {
    return this.request<{ statusUrl: string; embedUrl: string }>(`/api/esignature/requests/${requestId}/status-url`);
  }

  async resendSignatoryInvitation(requestId: string, signatoryId: string) {
    return this.request<{ success: boolean; signingUrl: string }>(`/api/esignature/requests/${requestId}/signatories/${signatoryId}/resend`, {
      method: 'POST',
    });
  }

  async attachFileToSignatureRequest(requestId: string, fileId: string) {
    return this.request<{ success: boolean; file: any }>(`/api/esignature/requests/${requestId}/attach-file`, {
      method: 'POST',
      body: JSON.stringify({ file_id: fileId }),
    });
  }

  async downloadSignedPdfWithFile(requestId: string): Promise<void> {
    const token = this.getToken();
    const response = await fetch(`${API_URL}/api/esignature/requests/${requestId}/signed-pdf`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to download signed PDF');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signed_document_${requestId}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  // ============================================================================
  // PDF MERGE
  // ============================================================================

  async mergePdf(options: {
    file_ids: string[];
    output_name?: string;
    folder_id?: string | null;
  }) {
    return this.request<{
      success: boolean;
      file: any;
      merged_info: {
        source_files: {
          id: string;
          name: string;
          original_size_bytes: number;
          page_count: number;
          page_range: { start: number; end: number };
          file_type: string;
          created_at: string;
          updated_at: string;
        }[];
        total_pages: number;
        output_size_bytes: number;
      };
    }>('/api/files/merge-pdf', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  // ============================================================================
  // ADMIN - USER MANAGEMENT
  // ============================================================================

  async getAdminUsers() {
    return this.request<{
      id: string;
      email: string;
      display_name: string;
      role: string;
      account_status: string;
      storage_quota_bytes: number;
      storage_used_bytes: number;
      created_at: string;
      last_login_at: string | null;
    }[]>('/api/admin/users');
  }

  async getAdminUser(userId: string) {
    return this.request<{
      id: string;
      email: string;
      display_name: string;
      role: string;
      account_status: string;
      storage_quota_bytes: number;
      storage_used_bytes: number;
      created_at: string;
      stats: {
        file_count: number;
        folder_count: number;
        total_storage: number;
      };
    }>(`/api/admin/users/${userId}`);
  }

  async createAdminUser(data: {
    email: string;
    password: string;
    display_name?: string;
    role?: 'user' | 'admin';
    storage_quota_bytes?: number;
  }) {
    return this.request<{ user: any; profile: any }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAdminUser(userId: string, updates: {
    display_name?: string;
    role?: 'user' | 'admin';
    account_status?: 'active' | 'suspended' | 'pending';
    storage_quota_bytes?: number;
  }) {
    return this.request<any>(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteAdminUser(userId: string) {
    return this.request<{ success: boolean }>(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async resetUserPassword(userId: string, newPassword: string) {
    return this.request<{ success: boolean }>(`/api/admin/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ new_password: newPassword }),
    });
  }

  // ============================================================================
  // ADMIN - DOCUMENT ACCESS TOKENS
  // ============================================================================

  async getDocumentTokens() {
    return this.request<{
      id: string;
      name: string;
      token_prefix: string;
      scope_type: string;
      file_ids: string[];
      folder_ids: string[];
      can_view: boolean;
      can_download: boolean;
      can_edit: boolean;
      can_delete: boolean;
      can_share: boolean;
      is_active: boolean;
      expires_at: string | null;
      last_used_at: string | null;
      usage_count: number;
      current_downloads: number;
      max_downloads: number | null;
      created_at: string;
    }[]>('/api/admin/tokens');
  }

  async createDocumentToken(data: {
    name: string;
    scope_type?: 'all' | 'folder' | 'specific';
    file_ids?: string[];
    folder_ids?: string[];
    can_view?: boolean;
    can_download?: boolean;
    can_edit?: boolean;
    can_delete?: boolean;
    can_share?: boolean;
    allowed_ips?: string[];
    allowed_domains?: string[];
    max_downloads?: number;
    expires_at?: string;
  }) {
    return this.request<{
      id: string;
      name: string;
      token: string; // Only shown once!
      token_prefix: string;
      message: string;
    }>('/api/admin/tokens', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDocumentToken(tokenId: string, updates: {
    name?: string;
    is_active?: boolean;
    can_view?: boolean;
    can_download?: boolean;
    can_edit?: boolean;
    can_delete?: boolean;
    can_share?: boolean;
    allowed_ips?: string[];
    allowed_domains?: string[];
    max_downloads?: number;
    expires_at?: string | null;
    file_ids?: string[];
    folder_ids?: string[];
  }) {
    return this.request<any>(`/api/admin/tokens/${tokenId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteDocumentToken(tokenId: string) {
    return this.request<{ success: boolean }>(`/api/admin/tokens/${tokenId}`, {
      method: 'DELETE',
    });
  }

  async getTokenUsageLogs(tokenId: string) {
    return this.request<{
      id: string;
      action: string;
      file_id: string | null;
      ip_address: string | null;
      user_agent: string | null;
      success: boolean;
      error_message: string | null;
      created_at: string;
    }[]>(`/api/admin/tokens/${tokenId}/logs`);
  }

  // ============================================================================
  // ADMIN - SYSTEM STATS & AUDIT
  // ============================================================================

  async getAdminStats() {
    return this.request<{
      users: {
        total: number;
        admins: number;
        active: number;
        suspended: number;
      };
      files: {
        total: number;
        total_storage_bytes: number;
        total_storage_formatted: string;
      };
      folders: {
        total: number;
      };
      tokens: {
        total: number;
        active: number;
      };
      signatures: {
        total: number;
        completed: number;
        pending: number;
      };
    }>('/api/admin/stats');
  }

  async getAuditLogs(limit = 50, offset = 0) {
    return this.request<{
      id: string;
      admin_id: string;
      action: string;
      target_type: string;
      target_id: string | null;
      old_values: any;
      new_values: any;
      ip_address: string | null;
      created_at: string;
      admin?: {
        id: string;
        display_name: string;
        email: string;
      };
    }[]>(`/api/admin/audit-logs?limit=${limit}&offset=${offset}`);
  }
}

export const api = new ApiClient();
export default api;
