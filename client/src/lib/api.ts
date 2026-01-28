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
}

export const api = new ApiClient();
export default api;
