/**
 * Document Actions Routes
 * API endpoints for document processing (OCR, translation, extraction)
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import pdfflow from '../services/pdfflow.js';

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * GET /api/document-processing/capabilities
 * Get PDFFlow capabilities (supported formats, languages)
 */
router.get('/capabilities', async (req, res) => {
  try {
    const capabilities = await pdfflow.getCapabilities();
    res.json(capabilities);
  } catch (error) {
    console.error('Failed to get capabilities:', error);
    res.status(503).json({ error: 'Document processing service unavailable' });
  }
});

/**
 * GET /api/document-processing/health
 * Check if PDFFlow is available
 */
router.get('/health', async (req, res) => {
  const healthy = await pdfflow.healthCheck();
  res.json({ available: healthy });
});

/**
 * POST /api/files/:fileId/actions/extract
 * Extract text from a document
 */
router.post('/files/:fileId/actions/extract', async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;
    const { returnStructured = true, returnPages = true } = req.body;

    // Get file info
    const { data: file, error: fileError } = await supabase
      .schema('fileflow')
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fileError || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('files')
      .download(file.storage_path);

    if (downloadError) {
      return res.status(500).json({ error: 'Failed to download file' });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    // Process document
    const result = await pdfflow.processDocument(buffer, file.name, {
      returnStructured,
      returnPages,
      returnArtifacts: false
    });

    // Save extraction result
    await saveProcessingResult(fileId, userId, 'extract', result);

    res.json({
      documentId: result.document_id,
      fileType: result.file_type,
      detectedLanguage: result.detected_language,
      extracted: result.extracted,
      meta: result.meta
    });
  } catch (error) {
    console.error('Extraction failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/files/:fileId/actions/ocr
 * Run OCR on a document
 */
router.post('/files/:fileId/actions/ocr', async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;
    const { language = 'eng', mode = 'auto' } = req.body;

    // Get file info
    const { data: file, error: fileError } = await supabase
      .schema('fileflow')
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fileError || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('files')
      .download(file.storage_path);

    if (downloadError) {
      return res.status(500).json({ error: 'Failed to download file' });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    // Process document with OCR
    const result = await pdfflow.processDocument(buffer, file.name, {
      ocr: mode,
      ocrLanguage: language,
      returnPages: true,
      returnStructured: true
    });

    // Save OCR result
    await saveProcessingResult(fileId, userId, 'ocr', result);

    res.json({
      documentId: result.document_id,
      detectedLanguage: result.detected_language,
      extracted: result.extracted,
      meta: result.meta
    });
  } catch (error) {
    console.error('OCR failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/files/:fileId/actions/detect-language
 * Detect document language
 */
router.post('/files/:fileId/actions/detect-language', async (req, res) => {
  try {
    const { fileId } = req.params;

    // Get file info
    const { data: file, error: fileError } = await supabase
      .schema('fileflow')
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fileError || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('files')
      .download(file.storage_path);

    if (downloadError) {
      return res.status(500).json({ error: 'Failed to download file' });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    // Process document (minimal extraction for language detection)
    const result = await pdfflow.processDocument(buffer, file.name, {
      returnPages: false,
      returnStructured: false,
      returnArtifacts: false
    });

    res.json({
      language: result.detected_language.code,
      confidence: result.detected_language.confidence
    });
  } catch (error) {
    console.error('Language detection failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/files/:fileId/actions/translate
 * Translate a document
 */
router.post('/files/:fileId/actions/translate', async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;
    const {
      targetLanguage,
      pdfMode = 'overlay',
      preserveNumbers = true,
      preserveFormulas = true,
      glossary = null,
      doNotTranslatePatterns = null,
      async: useAsync = false
    } = req.body;

    if (!targetLanguage) {
      return res.status(400).json({ error: 'targetLanguage is required' });
    }

    // Get file info
    const { data: file, error: fileError } = await supabase
      .schema('fileflow')
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fileError || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('files')
      .download(file.storage_path);

    if (downloadError) {
      return res.status(500).json({ error: 'Failed to download file' });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    const options = {
      translateTo: targetLanguage,
      translatePdfMode: pdfMode,
      preserveNumbers,
      preserveFormulas,
      glossary,
      doNotTranslatePatterns,
      returnPages: true,
      returnStructured: true,
      returnArtifacts: true
    };

    if (useAsync) {
      // Create async job
      const job = await pdfflow.createJob(buffer, file.name, options);

      // Save job reference
      await supabase
        .schema('fileflow')
        .from('processing_jobs')
        .insert({
          user_id: userId,
          file_id: fileId,
          job_type: 'translate',
          status: 'pending',
          pdfflow_job_id: job.job_id,
          input_params: { targetLanguage, pdfMode, preserveNumbers, preserveFormulas }
        });

      res.json({
        jobId: job.job_id,
        status: 'pending',
        statusUrl: `/api/document-processing/jobs/${job.job_id}`
      });
    } else {
      // Synchronous processing
      const result = await pdfflow.processDocument(buffer, file.name, options);

      // Save translation result
      await saveProcessingResult(fileId, userId, 'translate', result);

      // If there's a translated PDF artifact, save it
      if (result.artifacts?.translated_pdf) {
        await saveArtifact(fileId, userId, result.document_id, 'translated_pdf', result);
      }

      res.json({
        documentId: result.document_id,
        detectedLanguage: result.detected_language,
        translated: result.translated,
        artifacts: result.artifacts,
        meta: result.meta
      });
    }
  } catch (error) {
    console.error('Translation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/document-processing/jobs/:jobId
 * Get async job status
 */
router.get('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await pdfflow.getJobStatus(jobId);
    res.json(status);
  } catch (error) {
    console.error('Failed to get job status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/document-processing/artifacts/:documentId/:name
 * Get a processing artifact (e.g., translated PDF)
 */
router.get('/artifacts/:documentId/:name', async (req, res) => {
  try {
    const { documentId, name } = req.params;
    const artifactResponse = await pdfflow.getArtifact(documentId, name);

    // Stream the artifact to the client
    res.set('Content-Type', artifactResponse.headers.get('content-type'));
    artifactResponse.body.pipe(res);
  } catch (error) {
    console.error('Failed to get artifact:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper: Save processing result
 */
async function saveProcessingResult(fileId, userId, actionType, result) {
  await supabase
    .schema('fileflow')
    .from('processing_results')
    .insert({
      file_id: fileId,
      user_id: userId,
      action_type: actionType,
      document_id: result.document_id,
      detected_language: result.detected_language,
      meta: result.meta
    });
}

/**
 * Helper: Save artifact reference
 */
async function saveArtifact(fileId, userId, documentId, artifactType, result) {
  await supabase
    .schema('fileflow')
    .from('document_artifacts')
    .insert({
      file_id: fileId,
      user_id: userId,
      pdfflow_document_id: documentId,
      artifact_type: artifactType,
      artifact_url: result.artifacts?.[artifactType]
    });
}

export default router;
