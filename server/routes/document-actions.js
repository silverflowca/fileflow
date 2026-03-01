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

    // Save extracted text as a separate file
    if (result.extracted?.full_text) {
      console.log('Saving extracted text to file...');
      const baseName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
      const detectedLang = result.detected_language?.code || 'unknown';
      const textFileName = `${baseName}_text_detected_${detectedLang}_.txt`;

      // Get the folder path from the original file
      const folderPath = file.storage_path.substring(0, file.storage_path.lastIndexOf('/'));
      const textFilePath = `${folderPath}/${textFileName}`;

      console.log('Text file path:', textFilePath);
      console.log('Text length:', result.extracted.full_text.length);

      // Upload text file to storage
      const textBuffer = Buffer.from(result.extracted.full_text, 'utf-8');
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('files')
        .upload(textFilePath, textBuffer, {
          contentType: 'text/plain',
          upsert: true
        });

      if (uploadError) {
        console.error('Failed to upload text file to storage:', uploadError);
      } else {
        console.log('Text file uploaded successfully:', uploadData);

        // Create a file record in the database
        const { data: insertData, error: insertError } = await supabase
          .schema('fileflow')
          .from('files')
          .insert({
            owner_id: userId,
            folder_id: file.folder_id,
            name: textFileName,
            storage_path: textFilePath,
            bucket_name: 'files',
            file_type: 'text/plain',
            file_extension: '.txt',
            size_bytes: textBuffer.length,
            upload_status: 'completed',
            metadata: {
              extracted_from: fileId,
              detected_language: result.detected_language
            }
          });

        if (insertError) {
          console.error('Failed to insert file record:', insertError);
        } else {
          console.log('File record created successfully:', insertData);
        }
      }
    } else {
      console.log('No extracted text found in result');
    }

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

    // Save OCR text as a separate file
    if (result.extracted?.full_text) {
      const baseName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
      const detectedLang = result.detected_language?.code || 'unknown';
      const textFileName = `${baseName}_text_detected_${detectedLang}_.txt`;

      // Get the folder path from the original file
      const folderPath = file.storage_path.substring(0, file.storage_path.lastIndexOf('/'));
      const textFilePath = `${folderPath}/${textFileName}`;

      // Upload text file to storage
      const textBuffer = Buffer.from(result.extracted.full_text, 'utf-8');
      const { error: uploadError } = await supabase.storage
        .from('files')
        .upload(textFilePath, textBuffer, {
          contentType: 'text/plain',
          upsert: true
        });

      if (!uploadError) {
        // Create a file record in the database
        await supabase
          .schema('fileflow')
          .from('files')
          .insert({
            owner_id: userId,
            folder_id: file.folder_id,
            name: textFileName,
            storage_path: textFilePath,
            bucket_name: 'files',
            file_type: 'text/plain',
            file_extension: '.txt',
            size_bytes: textBuffer.length,
            upload_status: 'completed',
            metadata: {
              extracted_from: fileId,
              detected_language: result.detected_language,
              ocr_mode: mode,
              ocr_language: language
            }
          });
      }
    }

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

      // Save translated text as a separate file
      if (result.translated?.full_text) {
        console.log('Saving translated text to file...');
        const baseName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
        const sourceLang = result.detected_language?.code || 'unknown';
        const textFileName = `${baseName}_translated_${sourceLang}_to_${targetLanguage}_.txt`;

        // Get the folder path from the original file
        const folderPath = file.storage_path.substring(0, file.storage_path.lastIndexOf('/'));
        const textFilePath = `${folderPath}/${textFileName}`;

        console.log('Translated text file path:', textFilePath);
        console.log('Translated text length:', result.translated.full_text.length);

        // Upload text file to storage
        const textBuffer = Buffer.from(result.translated.full_text, 'utf-8');
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('files')
          .upload(textFilePath, textBuffer, {
            contentType: 'text/plain',
            upsert: true
          });

        if (uploadError) {
          console.error('Failed to upload translated text file to storage:', uploadError);
        } else {
          console.log('Translated text file uploaded successfully:', uploadData);

          // Create a file record in the database
          const { data: insertData, error: insertError } = await supabase
            .schema('fileflow')
            .from('files')
            .insert({
              owner_id: userId,
              folder_id: file.folder_id,
              name: textFileName,
              storage_path: textFilePath,
              bucket_name: 'files',
              file_type: 'text/plain',
              file_extension: '.txt',
              size_bytes: textBuffer.length,
              upload_status: 'completed',
              metadata: {
                translated_from: fileId,
                source_language: result.detected_language,
                target_language: targetLanguage,
                translation_mode: pdfMode
              }
            });

          if (insertError) {
            console.error('Failed to insert translated file record:', insertError);
          } else {
            console.log('Translated file record created successfully:', insertData);
          }
        }
      } else {
        console.log('No translated text found in result');
      }

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
