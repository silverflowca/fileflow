/**
 * PDFFlow Service - Document Processing Integration
 * Connects FileFlow to PDFFlow API for OCR, translation, and extraction
 */

import fetch from 'node-fetch';
import FormData from 'form-data';

const PDFFLOW_URL = process.env.PDFFLOW_URL || 'http://localhost:8000';
const PDFFLOW_API_KEY = process.env.PDFFLOW_API_KEY || '';

/**
 * Get PDFFlow capabilities (supported formats, languages, etc.)
 */
export async function getCapabilities() {
  const response = await fetch(`${PDFFLOW_URL}/v1/capabilities`, {
    headers: buildHeaders()
  });

  if (!response.ok) {
    throw new Error(`Failed to get capabilities: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Process a document synchronously
 * @param {Buffer|ReadableStream} file - File content
 * @param {string} filename - Original filename
 * @param {Object} options - Processing options
 */
export async function processDocument(file, filename, options = {}) {
  const form = new FormData();
  form.append('file', file, { filename });

  // Add processing options
  if (options.ocr) form.append('ocr', options.ocr);
  if (options.ocrLanguage) form.append('ocr_language_hint', options.ocrLanguage);
  if (options.translateTo) form.append('translate_to', options.translateTo);
  if (options.translatePdfMode) form.append('translate_pdf_mode', options.translatePdfMode);
  if (options.preserveNumbers !== undefined) form.append('preserve_numbers', String(options.preserveNumbers));
  if (options.preserveFormulas !== undefined) form.append('preserve_formulas', String(options.preserveFormulas));
  if (options.glossary) form.append('glossary', JSON.stringify(options.glossary));
  if (options.doNotTranslatePatterns) form.append('do_not_translate_patterns', JSON.stringify(options.doNotTranslatePatterns));

  form.append('return_pages', String(options.returnPages !== false));
  form.append('return_structured', String(options.returnStructured !== false));
  form.append('return_artifacts', String(options.returnArtifacts !== false));

  const response = await fetch(`${PDFFLOW_URL}/v1/process`, {
    method: 'POST',
    headers: {
      ...buildHeaders(),
      ...form.getHeaders()
    },
    body: form
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Document processing failed: ${error}`);
  }

  return response.json();
}

/**
 * Create an async processing job
 * @param {Buffer|ReadableStream} file - File content
 * @param {string} filename - Original filename
 * @param {Object} options - Processing options
 */
export async function createJob(file, filename, options = {}) {
  const form = new FormData();
  form.append('file', file, { filename });

  // Add processing options
  if (options.ocr) form.append('ocr', options.ocr);
  if (options.ocrLanguage) form.append('ocr_language_hint', options.ocrLanguage);
  if (options.translateTo) form.append('translate_to', options.translateTo);
  if (options.translatePdfMode) form.append('translate_pdf_mode', options.translatePdfMode);
  if (options.preserveNumbers !== undefined) form.append('preserve_numbers', String(options.preserveNumbers));
  if (options.preserveFormulas !== undefined) form.append('preserve_formulas', String(options.preserveFormulas));
  if (options.glossary) form.append('glossary', JSON.stringify(options.glossary));
  if (options.doNotTranslatePatterns) form.append('do_not_translate_patterns', JSON.stringify(options.doNotTranslatePatterns));
  if (options.priority !== undefined) form.append('priority', String(options.priority));

  form.append('return_pages', String(options.returnPages !== false));
  form.append('return_structured', String(options.returnStructured !== false));

  const response = await fetch(`${PDFFLOW_URL}/v1/jobs`, {
    method: 'POST',
    headers: {
      ...buildHeaders(),
      ...form.getHeaders()
    },
    body: form
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create job: ${error}`);
  }

  return response.json();
}

/**
 * Get job status
 * @param {string} jobId - Job ID
 */
export async function getJobStatus(jobId) {
  const response = await fetch(`${PDFFLOW_URL}/v1/jobs/${jobId}`, {
    headers: buildHeaders()
  });

  if (!response.ok) {
    throw new Error(`Failed to get job status: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get an artifact (e.g., translated PDF)
 * @param {string} documentId - Document ID
 * @param {string} artifactName - Artifact name (e.g., 'translated_pdf')
 */
export async function getArtifact(documentId, artifactName) {
  const response = await fetch(`${PDFFLOW_URL}/v1/artifacts/${documentId}/${artifactName}`, {
    headers: buildHeaders()
  });

  if (!response.ok) {
    throw new Error(`Failed to get artifact: ${response.statusText}`);
  }

  return response;
}

/**
 * Check if PDFFlow is available
 */
export async function healthCheck() {
  try {
    const response = await fetch(`${PDFFLOW_URL}/health`, {
      headers: buildHeaders()
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Build request headers
 */
function buildHeaders() {
  const headers = {};
  if (PDFFLOW_API_KEY) {
    headers['x-api-key'] = PDFFLOW_API_KEY;
  }
  return headers;
}

export default {
  getCapabilities,
  processDocument,
  createJob,
  getJobStatus,
  getArtifact,
  healthCheck
};
