/**
 * Document Processing API Client
 * Handles PDFFlow integration for OCR, translation, and extraction
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8680';

function getToken(): string | null {
  return localStorage.getItem('fileflow_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

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

export interface ProcessingCapabilities {
  supported_file_types: Record<string, string>;
  ocr_languages: string[];
  translation_languages: string[];
  translation_pairs: string[];
  max_upload_size: number;
  converters_available: {
    libreoffice: boolean;
    ocrmypdf: boolean;
  };
}

export interface ExtractResult {
  documentId: string;
  fileType: string;
  detectedLanguage: { code: string; confidence: number };
  extracted: {
    full_text: string;
    pages?: any[];
    sheets?: any;
  };
  meta: any;
}

export interface TranslateResult {
  documentId?: string;
  jobId?: string;
  status?: string;
  statusUrl?: string;
  detectedLanguage?: { code: string; confidence: number };
  translated?: {
    full_text: string;
    pages?: any[];
  };
  artifacts?: {
    translated_pdf?: string;
  };
  meta?: any;
}

export const documentProcessing = {
  /**
   * Get PDFFlow capabilities
   */
  async getCapabilities(): Promise<ProcessingCapabilities> {
    return request('/api/document-processing/capabilities');
  },

  /**
   * Check if PDFFlow service is available
   */
  async checkHealth(): Promise<{ available: boolean }> {
    return request('/api/document-processing/health');
  },

  /**
   * Extract text from a document
   */
  async extract(
    fileId: string,
    options?: { returnStructured?: boolean; returnPages?: boolean }
  ): Promise<ExtractResult> {
    return request(`/api/files/${fileId}/actions/extract`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
  },

  /**
   * Run OCR on a document
   */
  async ocr(
    fileId: string,
    options?: { language?: string; mode?: 'auto' | 'on' | 'off' }
  ): Promise<ExtractResult> {
    return request(`/api/files/${fileId}/actions/ocr`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
  },

  /**
   * Detect document language
   */
  async detectLanguage(fileId: string): Promise<{ language: string; confidence: number }> {
    return request(`/api/files/${fileId}/actions/detect-language`, {
      method: 'POST',
    });
  },

  /**
   * Translate a document
   */
  async translate(
    fileId: string,
    options: {
      targetLanguage: string;
      pdfMode?: 'overlay' | 'append';
      preserveNumbers?: boolean;
      preserveFormulas?: boolean;
      glossary?: Record<string, string>;
      doNotTranslatePatterns?: string[];
      async?: boolean;
    }
  ): Promise<TranslateResult> {
    return request(`/api/files/${fileId}/actions/translate`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  },

  /**
   * Get async job status
   */
  async getJobStatus(jobId: string): Promise<{
    job_id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    result?: any;
    error?: string;
  }> {
    return request(`/api/document-processing/jobs/${jobId}`);
  },
};

export default documentProcessing;
