import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import documentActionsRouter from './routes/document-actions.js';
import emailRouter from './routes/email.js';

// ============================================================================
// AUDIO STREAMING SESSION MANAGER
// ============================================================================
// Tracks active recording sessions: sessionId -> { writeStream, filePath, mimeType, userId, lastHeartbeat, size }
const audioSessions = new Map();
const AUDIO_TEMP_DIR = path.join(os.tmpdir(), 'fileflow-audio');
const SESSION_TIMEOUT_MS = 45_000; // 45s without a chunk = auto-finalize

// Ensure temp dir exists
if (!fs.existsSync(AUDIO_TEMP_DIR)) fs.mkdirSync(AUDIO_TEMP_DIR, { recursive: true });

// Heartbeat watchdog — checks every 15s for stale sessions
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of audioSessions) {
    if (now - session.lastHeartbeat > SESSION_TIMEOUT_MS) {
      console.log(`[audio] Session ${sessionId} timed out — auto-finalizing`);
      finalizeAudioSession(sessionId, 'timeout').catch(err =>
        console.error(`[audio] Auto-finalize error for ${sessionId}:`, err.message)
      );
    }
  }
}, 15_000);

async function finalizeAudioSession(sessionId, reason = 'manual') {
  const session = audioSessions.get(sessionId);
  if (!session) return null;

  audioSessions.delete(sessionId); // Remove first to prevent double-finalize

  // Close the write stream
  await new Promise((resolve) => {
    if (session.writeStream.writableEnded) return resolve();
    session.writeStream.end(resolve);
  });

  if (session.size === 0 || !fs.existsSync(session.filePath)) {
    console.log(`[audio] Session ${sessionId} had no data — skipping DB record`);
    try { fs.unlinkSync(session.filePath); } catch (_) {}
    return null;
  }

  console.log(`[audio] Finalized session ${sessionId} (${reason}), size=${session.size} bytes`);
  return session;
}

// Graceful shutdown — close all open write streams
function shutdownAudioSessions() {
  console.log(`[audio] Shutting down ${audioSessions.size} open recording session(s)...`);
  for (const [sessionId, session] of audioSessions) {
    try {
      if (!session.writeStream.writableEnded) session.writeStream.end();
      console.log(`[audio] Closed session ${sessionId}`);
    } catch (_) {}
  }
  audioSessions.clear();
}
process.on('SIGTERM', shutdownAudioSessions);
process.on('SIGINT', shutdownAudioSessions);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8680;

// Supabase client with service role (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'fileflow' }
  }
);

// Supabase client with anon key — required for login/register so Supabase issues real sessions
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!ANON_KEY) {
  console.error('[FATAL] SUPABASE_ANON_KEY is not set — login/register will not work');
  process.exit(1);
}
const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  ANON_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'fileflow' }
  }
);

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the public directory (built React app)
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

// ============================================================================
// AUTH ROUTES
// ============================================================================

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Get or create profile (ensures profile exists for file uploads)
    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    // Auto-create profile if it doesn't exist
    if (!profile) {
      const { data: newProfile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          email: data.user.email,
          display_name: data.user.user_metadata?.display_name || 'User',
          storage_quota_bytes: 10737418240, // 10GB
          storage_used_bytes: 0
        })
        .select()
        .single();

      if (!profileError) {
        profile = newProfile;
      }
    }

    res.json({
      user: data.user,
      session: data.session,
      profile
    });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password, displayName } = req.body;

  try {
    const { data, error } = await supabaseAnon.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } }
    });
    if (error) throw error;

    res.json({ user: data.user, session: data.session });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    res.json({ user: req.user, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// FOLDERS ROUTES
// ============================================================================

app.get('/api/folders', authenticate, async (req, res) => {
  const { parent_id } = req.query;

  try {
    let query = supabase
      .from('folders')
      .select('*')
      .eq('owner_id', req.user.id)
      .is('deleted_at', null)
      .order('name');

    // Handle null parent_id for root folders
    if (parent_id === 'null' || parent_id === '' || !parent_id) {
      query = query.is('parent_id', null);
    } else {
      query = query.eq('parent_id', parent_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/folders', authenticate, async (req, res) => {
  const { name, parent_id } = req.body;

  try {
    let path = '/';
    let depth = 0;

    // Get parent folder info if exists
    if (parent_id) {
      const { data: parent } = await supabase
        .from('folders')
        .select('path, depth')
        .eq('id', parent_id)
        .single();

      if (parent) {
        path = `${parent.path}${parent_id}/`;
        depth = (parent.depth || 0) + 1;
      }
    }

    const { data, error } = await supabase
      .from('folders')
      .insert({
        name,
        parent_id: parent_id || null,
        owner_id: req.user.id,
        path,
        depth,
        is_root: !parent_id
      })
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Create folder error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/folders/:id', authenticate, async (req, res) => {
  try {
    const { error } = await supabase
      .from('folders')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('owner_id', req.user.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// FILES ROUTES
// ============================================================================

app.get('/api/files', authenticate, async (req, res) => {
  const { folder_id } = req.query;

  try {
    let query = supabase
      .from('files')
      .select('*')
      .eq('owner_id', req.user.id)
      .is('deleted_at', null)
      .order('name');

    if (folder_id === 'null' || folder_id === '' || !folder_id) {
      query = query.is('folder_id', null);
    } else {
      query = query.eq('folder_id', folder_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/files', authenticate, async (req, res) => {
  const fileData = req.body;

  try {
    const { data, error } = await supabase
      .from('files')
      .insert({
        ...fileData,
        owner_id: req.user.id
      })
      .select()
      .single();

    if (error) throw error;

    // Update storage used
    await supabase.rpc('update_storage_used', {
      user_id: req.user.id,
      bytes_delta: fileData.size_bytes
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/files/:id', authenticate, async (req, res) => {
  try {
    // Get file info first
    const { data: file } = await supabase
      .from('files')
      .select('storage_path, size_bytes, bucket_name')
      .eq('id', req.params.id)
      .eq('owner_id', req.user.id)
      .single();

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete from storage
    await supabase.storage
      .from(file.bucket_name || 'files')
      .remove([file.storage_path]);

    // Soft delete in database
    await supabase
      .from('files')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', req.params.id);

    // Update storage used
    await supabase.rpc('update_storage_used', {
      user_id: req.user.id,
      bytes_delta: -file.size_bytes
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get upload URL for direct storage upload
app.post('/api/files/upload-url', authenticate, async (req, res) => {
  const { fileName, fileType, folderId } = req.body;

  try {
    const fileExt = fileName.split('.').pop();
    const storagePath = `${req.user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    // Create signed upload URL
    const { data, error } = await supabase.storage
      .from('files')
      .createSignedUploadUrl(storagePath);

    if (error) throw error;

    res.json({
      uploadUrl: data.signedUrl,
      storagePath,
      token: data.token
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// STORAGE ROUTES
// ============================================================================

app.get('/api/storage/download/:fileId', authenticate, async (req, res) => {
  try {
    const { data: file } = await supabase
      .from('files')
      .select('storage_path, bucket_name, name')
      .eq('id', req.params.fileId)
      .eq('owner_id', req.user.id)
      .single();

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const { data, error } = await supabase.storage
      .from(file.bucket_name || 'files')
      .createSignedUrl(file.storage_path, 3600);

    if (error) throw error;

    res.json({ url: data.signedUrl, fileName: file.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// E-SIGNATURE ROUTES
// ============================================================================

// Get all signature requests for the authenticated user
app.get('/api/esignature/requests', authenticate, async (req, res) => {
  try {
    const { data: requests, error } = await supabase
      .from('signature_requests')
      .select('*, signatories:signature_signatories(*)')
      .eq('owner_id', req.user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get signature requests for a specific file
app.get('/api/files/:fileId/signatures', authenticate, async (req, res) => {
  const { fileId } = req.params;

  try {
    // Verify file ownership
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('id')
      .eq('id', fileId)
      .eq('owner_id', req.user.id)
      .single();

    if (fileError || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get all signature requests for this file
    const { data: requests, error } = await supabase
      .from('signature_requests')
      .select('*, signatories:signature_signatories(*)')
      .eq('file_id', fileId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single signature request
app.get('/api/esignature/requests/:id', authenticate, async (req, res) => {
  try {
    const { data: request, error } = await supabase
      .from('signature_requests')
      .select('*, signatories:signature_signatories(*)')
      .eq('id', req.params.id)
      .eq('owner_id', req.user.id)
      .single();

    if (error) throw error;
    if (!request) {
      return res.status(404).json({ error: 'Signature request not found' });
    }

    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new signature request
app.post('/api/esignature/requests', authenticate, async (req, res) => {
  const { title, description, file_id, signatories, expires_at } = req.body;

  try {
    // Create the signature request
    const { data: request, error: requestError } = await supabase
      .from('signature_requests')
      .insert({
        title,
        description,
        file_id,
        owner_id: req.user.id,
        status: 'draft',
        expires_at
      })
      .select()
      .single();

    if (requestError) throw requestError;

    // Add signatories
    if (signatories && signatories.length > 0) {
      const signatoryRecords = signatories.map((s, index) => ({
        request_id: request.id,
        name: s.name,
        email: s.email,
        title: s.title || null,
        order_index: index,
        status: 'pending'
      }));

      const { error: signatoryError } = await supabase
        .from('signature_signatories')
        .insert(signatoryRecords);

      if (signatoryError) throw signatoryError;
    }

    // Log the creation
    await supabase.from('signature_audit_log').insert({
      request_id: request.id,
      action: 'created',
      actor_email: req.user.email,
      actor_name: req.user.user_metadata?.display_name || req.user.email,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    // Fetch the complete request with signatories
    const { data: completeRequest } = await supabase
      .from('signature_requests')
      .select('*, signatories:signature_signatories(*)')
      .eq('id', request.id)
      .single();

    res.json(completeRequest);
  } catch (err) {
    console.error('Create signature request error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Send signature request (change status to pending)
app.post('/api/esignature/requests/:id/send', authenticate, async (req, res) => {
  try {
    const { data: request, error: fetchError } = await supabase
      .from('signature_requests')
      .select('*')
      .eq('id', req.params.id)
      .eq('owner_id', req.user.id)
      .single();

    if (fetchError || !request) {
      return res.status(404).json({ error: 'Signature request not found' });
    }

    if (request.status !== 'draft') {
      return res.status(400).json({ error: 'Request has already been sent' });
    }

    // Update request status
    const { error: updateError } = await supabase
      .from('signature_requests')
      .update({ status: 'pending' })
      .eq('id', req.params.id);

    if (updateError) throw updateError;

    // Update all signatories to 'sent'
    await supabase
      .from('signature_signatories')
      .update({ status: 'sent' })
      .eq('request_id', req.params.id);

    // Log the action
    await supabase.from('signature_audit_log').insert({
      request_id: req.params.id,
      action: 'sent',
      actor_email: req.user.email,
      actor_name: req.user.user_metadata?.display_name || req.user.email,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel signature request
app.post('/api/esignature/requests/:id/cancel', authenticate, async (req, res) => {
  try {
    const { error } = await supabase
      .from('signature_requests')
      .update({ status: 'cancelled' })
      .eq('id', req.params.id)
      .eq('owner_id', req.user.id);

    if (error) throw error;

    // Log the action
    await supabase.from('signature_audit_log').insert({
      request_id: req.params.id,
      action: 'cancelled',
      actor_email: req.user.email,
      actor_name: req.user.user_metadata?.display_name || req.user.email,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete signature request (soft delete)
app.delete('/api/esignature/requests/:id', authenticate, async (req, res) => {
  try {
    const { error } = await supabase
      .from('signature_requests')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('owner_id', req.user.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// E-SIGNATURE PUBLIC STATUS (Shareable URL to check status)
// ============================================================================

// Public status page for signature request (shareable URL)
app.get('/api/esignature/status/:requestId', async (req, res) => {
  try {
    const { data: request, error } = await supabase
      .from('signature_requests')
      .select(`
        id, title, description, status, created_at, expires_at, completed_at,
        original_file_name,
        signatories:signature_signatories(
          id, name, email, title, status, order_index, signed_at
        )
      `)
      .eq('id', req.params.requestId)
      .is('deleted_at', null)
      .single();

    if (error || !request) {
      return res.status(404).json({ error: 'Signature request not found' });
    }

    // Return public-safe data (no access tokens or sensitive info)
    const publicData = {
      id: request.id,
      title: request.title,
      description: request.description,
      status: request.status,
      created_at: request.created_at,
      expires_at: request.expires_at,
      completed_at: request.completed_at,
      original_file_name: request.original_file_name,
      signatories: request.signatories?.map(s => ({
        name: s.name,
        title: s.title,
        status: s.status,
        order_index: s.order_index,
        signed_at: s.signed_at,
        // Mask email for privacy
        email_masked: s.email ? s.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : null
      })).sort((a, b) => a.order_index - b.order_index),
      progress: {
        total: request.signatories?.length || 0,
        signed: request.signatories?.filter(s => s.status === 'signed').length || 0,
        pending: request.signatories?.filter(s => s.status !== 'signed').length || 0,
      }
    };

    res.json(publicData);
  } catch (err) {
    console.error('Signature status error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Generate shareable status URL for a signature request
app.get('/api/esignature/requests/:id/status-url', authenticate, async (req, res) => {
  try {
    // Verify ownership
    const { data: request } = await supabase
      .from('signature_requests')
      .select('id, owner_id')
      .eq('id', req.params.id)
      .eq('owner_id', req.user.id)
      .single();

    if (!request) {
      return res.status(404).json({ error: 'Signature request not found' });
    }

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5175';
    res.json({
      statusUrl: `${clientUrl}/esignature/status/${request.id}`,
      embedUrl: `${clientUrl}/esignature/status/${request.id}?embed=true`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// E-SIGNATURE SIGNATORY MANAGEMENT (Add/Remove after request started)
// ============================================================================

// Add signatory to an existing request (even after it's started)
app.post('/api/esignature/requests/:id/signatories', authenticate, async (req, res) => {
  const { name, email, title, order_index } = req.body;

  try {
    // Get request and verify ownership
    const { data: request, error: fetchError } = await supabase
      .from('signature_requests')
      .select('*')
      .eq('id', req.params.id)
      .eq('owner_id', req.user.id)
      .single();

    if (fetchError || !request) {
      return res.status(404).json({ error: 'Signature request not found' });
    }

    // Can't add to cancelled or completed requests
    if (request.status === 'cancelled' || request.status === 'completed') {
      return res.status(400).json({ error: 'Cannot add signatories to a cancelled or completed request' });
    }

    // Get highest existing order index if not provided
    let finalOrderIndex = order_index;
    if (finalOrderIndex === undefined) {
      const { data: existingSignatories } = await supabase
        .from('signature_signatories')
        .select('order_index')
        .eq('request_id', req.params.id)
        .order('order_index', { ascending: false })
        .limit(1);

      finalOrderIndex = (existingSignatories?.[0]?.order_index ?? -1) + 1;
    }

    // Determine status based on request status
    let initialStatus = 'pending';
    if (request.status === 'pending' || request.status === 'in_progress') {
      initialStatus = 'sent'; // Auto-send if request is already active
    }

    // Create new signatory
    const { data: signatory, error: insertError } = await supabase
      .from('signature_signatories')
      .insert({
        request_id: req.params.id,
        name,
        email,
        title,
        order_index: finalOrderIndex,
        status: initialStatus
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Log the action
    await supabase.from('signature_audit_log').insert({
      request_id: req.params.id,
      signatory_id: signatory.id,
      action: 'signatory_added',
      actor_email: req.user.email,
      actor_name: req.user.user_metadata?.display_name || req.user.email,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      metadata: { signatory_email: email, signatory_name: name }
    });

    // If request was completed and we're adding a new signatory, revert to in_progress
    if (request.status === 'completed') {
      await supabase
        .from('signature_requests')
        .update({ status: 'in_progress', completed_at: null })
        .eq('id', req.params.id);
    }

    res.json(signatory);
  } catch (err) {
    console.error('Add signatory error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update signatory details
app.patch('/api/esignature/requests/:id/signatories/:signatoryId', authenticate, async (req, res) => {
  const { name, email, title, order_index } = req.body;

  try {
    // Verify ownership
    const { data: request } = await supabase
      .from('signature_requests')
      .select('owner_id')
      .eq('id', req.params.id)
      .single();

    if (!request || request.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get existing signatory
    const { data: existingSignatory } = await supabase
      .from('signature_signatories')
      .select('status')
      .eq('id', req.params.signatoryId)
      .single();

    // Can't update a signatory who has already signed
    if (existingSignatory?.status === 'signed') {
      return res.status(400).json({ error: 'Cannot update a signatory who has already signed' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (title !== undefined) updateData.title = title;
    if (order_index !== undefined) updateData.order_index = order_index;

    const { data: signatory, error } = await supabase
      .from('signature_signatories')
      .update(updateData)
      .eq('id', req.params.signatoryId)
      .eq('request_id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Log the action
    await supabase.from('signature_audit_log').insert({
      request_id: req.params.id,
      signatory_id: req.params.signatoryId,
      action: 'signatory_updated',
      actor_email: req.user.email,
      metadata: updateData
    });

    res.json(signatory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove signatory from request
app.delete('/api/esignature/requests/:id/signatories/:signatoryId', authenticate, async (req, res) => {
  try {
    // Verify ownership
    const { data: request } = await supabase
      .from('signature_requests')
      .select('owner_id, status')
      .eq('id', req.params.id)
      .single();

    if (!request || request.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get signatory info before deletion
    const { data: signatory } = await supabase
      .from('signature_signatories')
      .select('*')
      .eq('id', req.params.signatoryId)
      .single();

    if (!signatory) {
      return res.status(404).json({ error: 'Signatory not found' });
    }

    // Can't remove a signatory who has already signed
    if (signatory.status === 'signed') {
      return res.status(400).json({ error: 'Cannot remove a signatory who has already signed' });
    }

    // Delete the signatory
    const { error } = await supabase
      .from('signature_signatories')
      .delete()
      .eq('id', req.params.signatoryId);

    if (error) throw error;

    // Log the action
    await supabase.from('signature_audit_log').insert({
      request_id: req.params.id,
      action: 'signatory_removed',
      actor_email: req.user.email,
      metadata: { removed_signatory: { name: signatory.name, email: signatory.email } }
    });

    // Check if all remaining signatories have signed (request might now be complete)
    const { data: remainingSignatories } = await supabase
      .from('signature_signatories')
      .select('status')
      .eq('request_id', req.params.id);

    if (remainingSignatories && remainingSignatories.length > 0) {
      const allSigned = remainingSignatories.every(s => s.status === 'signed');
      if (allSigned && request.status !== 'draft') {
        await supabase
          .from('signature_requests')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', req.params.id);
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Resend invitation to a signatory
app.post('/api/esignature/requests/:id/signatories/:signatoryId/resend', authenticate, async (req, res) => {
  try {
    // Verify ownership
    const { data: request } = await supabase
      .from('signature_requests')
      .select('owner_id, status')
      .eq('id', req.params.id)
      .single();

    if (!request || request.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get signatory
    const { data: signatory } = await supabase
      .from('signature_signatories')
      .select('*')
      .eq('id', req.params.signatoryId)
      .single();

    if (!signatory) {
      return res.status(404).json({ error: 'Signatory not found' });
    }

    if (signatory.status === 'signed') {
      return res.status(400).json({ error: 'Signatory has already signed' });
    }

    // Generate new access token
    const newToken = crypto.randomUUID();

    await supabase
      .from('signature_signatories')
      .update({
        access_token: newToken,
        status: 'sent'
      })
      .eq('id', req.params.signatoryId);

    // Log the action
    await supabase.from('signature_audit_log').insert({
      request_id: req.params.id,
      signatory_id: req.params.signatoryId,
      action: 'invitation_resent',
      actor_email: req.user.email,
      metadata: { signatory_email: signatory.email }
    });

    // Return the new signing URL
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5175';
    res.json({
      success: true,
      signingUrl: `${clientUrl}/sign/${newToken}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// E-SIGNATURE PDF ATTACHMENT (Add signatures to existing PDFs)
// ============================================================================

// Attach e-signature request to an existing file (PDF)
app.post('/api/esignature/requests/:id/attach-file', authenticate, async (req, res) => {
  const { file_id } = req.body;

  try {
    // Verify request ownership
    const { data: request } = await supabase
      .from('signature_requests')
      .select('*')
      .eq('id', req.params.id)
      .eq('owner_id', req.user.id)
      .single();

    if (!request) {
      return res.status(404).json({ error: 'Signature request not found' });
    }

    // Verify file exists and user owns it
    const { data: file } = await supabase
      .from('files')
      .select('*')
      .eq('id', file_id)
      .eq('owner_id', req.user.id)
      .single();

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Update the request with the file ID
    const { error: updateError } = await supabase
      .from('signature_requests')
      .update({
        file_id,
        original_file_url: file.storage_path,
        original_file_name: file.name
      })
      .eq('id', req.params.id);

    if (updateError) throw updateError;

    // Log the action
    await supabase.from('signature_audit_log').insert({
      request_id: req.params.id,
      action: 'file_attached',
      actor_email: req.user.email,
      metadata: { file_id, file_name: file.name }
    });

    res.json({ success: true, file });
  } catch (err) {
    console.error('Attach file error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Generate signed PDF with embedded signatures on the original document
app.get('/api/esignature/requests/:id/signed-pdf', authenticate, async (req, res) => {
  try {
    // Get the signature request with signatories and file
    const { data: request, error: fetchError } = await supabase
      .from('signature_requests')
      .select('*, signatories:signature_signatories(*)')
      .eq('id', req.params.id)
      .eq('owner_id', req.user.id)
      .single();

    if (fetchError || !request) {
      return res.status(404).json({ error: 'Signature request not found' });
    }

    let pdfDoc;

    // If there's an attached file, load it
    if (request.file_id) {
      const { data: file } = await supabase
        .from('files')
        .select('*')
        .eq('id', request.file_id)
        .single();

      if (file && file.file_type === 'application/pdf') {
        // Download the original PDF
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(file.bucket_name || 'files')
          .download(file.storage_path);

        if (!downloadError && fileData) {
          const pdfBytes = await fileData.arrayBuffer();
          pdfDoc = await PDFDocument.load(pdfBytes);
        }
      }
    }

    // If no PDF loaded, create a new one
    if (!pdfDoc) {
      pdfDoc = await PDFDocument.create();
    }

    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Add signature page at the end
    const signaturePage = pdfDoc.addPage([612, 792]);
    const { width, height } = signaturePage.getSize();

    // Header
    signaturePage.drawRectangle({
      x: 0,
      y: height - 80,
      width: width,
      height: 80,
      color: rgb(0.231, 0.510, 0.965)
    });

    signaturePage.drawText('SIGNATURE CERTIFICATE', {
      x: 50,
      y: height - 50,
      size: 24,
      font: helveticaBold,
      color: rgb(1, 1, 1)
    });

    // Document info
    signaturePage.drawText('Document:', {
      x: 50,
      y: height - 120,
      size: 12,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2)
    });

    signaturePage.drawText(request.title, {
      x: 130,
      y: height - 120,
      size: 12,
      font: helveticaFont,
      color: rgb(0.2, 0.2, 0.2)
    });

    if (request.original_file_name) {
      signaturePage.drawText('Original File:', {
        x: 50,
        y: height - 140,
        size: 10,
        font: helveticaBold,
        color: rgb(0.4, 0.4, 0.4)
      });

      signaturePage.drawText(request.original_file_name, {
        x: 130,
        y: height - 140,
        size: 10,
        font: helveticaFont,
        color: rgb(0.4, 0.4, 0.4)
      });
    }

    signaturePage.drawText('Status:', {
      x: 50,
      y: height - 160,
      size: 10,
      font: helveticaBold,
      color: rgb(0.4, 0.4, 0.4)
    });

    const statusText = request.status === 'completed' ? 'FULLY EXECUTED' : request.status.toUpperCase();
    signaturePage.drawText(statusText, {
      x: 130,
      y: height - 160,
      size: 10,
      font: helveticaBold,
      color: request.status === 'completed' ? rgb(0.086, 0.635, 0.290) : rgb(0.8, 0.4, 0)
    });

    signaturePage.drawText(`Document ID: ${request.id}`, {
      x: 50,
      y: height - 180,
      size: 9,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5)
    });

    signaturePage.drawText(`Generated: ${new Date().toISOString()}`, {
      x: 300,
      y: height - 180,
      size: 9,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5)
    });

    // Horizontal line
    signaturePage.drawLine({
      start: { x: 50, y: height - 200 },
      end: { x: width - 50, y: height - 200 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8)
    });

    // Signatures section
    signaturePage.drawText('SIGNATORIES', {
      x: 50,
      y: height - 230,
      size: 14,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2)
    });

    let yPosition = height - 270;
    const signatories = request.signatories || [];

    for (let i = 0; i < signatories.length; i++) {
      const signatory = signatories[i];
      const boxHeight = 100;

      // Check if we need a new page
      if (yPosition - boxHeight < 80) {
        const newPage = pdfDoc.addPage([612, 792]);
        yPosition = newPage.getSize().height - 50;
      }

      // Signatory box
      signaturePage.drawRectangle({
        x: 50,
        y: yPosition - boxHeight,
        width: width - 100,
        height: boxHeight,
        borderColor: rgb(0.85, 0.85, 0.85),
        borderWidth: 1,
        color: rgb(0.98, 0.98, 0.98)
      });

      // Name and details
      signaturePage.drawText(signatory.name, {
        x: 60,
        y: yPosition - 25,
        size: 12,
        font: helveticaBold,
        color: rgb(0.2, 0.2, 0.2)
      });

      if (signatory.title) {
        signaturePage.drawText(signatory.title, {
          x: 60,
          y: yPosition - 40,
          size: 10,
          font: helveticaFont,
          color: rgb(0.5, 0.5, 0.5)
        });
      }

      signaturePage.drawText(signatory.email, {
        x: 60,
        y: yPosition - 55,
        size: 10,
        font: helveticaFont,
        color: rgb(0.5, 0.5, 0.5)
      });

      // Signature or status
      if (signatory.status === 'signed' && signatory.signature_data) {
        try {
          const signatureBase64 = signatory.signature_data.replace(/^data:image\/\w+;base64,/, '');
          const signatureBytes = Buffer.from(signatureBase64, 'base64');
          const signatureImage = await pdfDoc.embedPng(signatureBytes);
          const sigDims = signatureImage.scale(0.25);

          signaturePage.drawImage(signatureImage, {
            x: 320,
            y: yPosition - 70,
            width: Math.min(sigDims.width, 150),
            height: Math.min(sigDims.height, 50)
          });

          signaturePage.drawText(`Signed: ${new Date(signatory.signed_at).toLocaleString()}`, {
            x: 320,
            y: yPosition - 85,
            size: 8,
            font: helveticaFont,
            color: rgb(0.086, 0.635, 0.290)
          });
        } catch (imgError) {
          signaturePage.drawText('[Digital Signature on File]', {
            x: 320,
            y: yPosition - 50,
            size: 10,
            font: helveticaFont,
            color: rgb(0.086, 0.635, 0.290)
          });
        }
      } else {
        signaturePage.drawText(`Status: ${signatory.status}`, {
          x: 320,
          y: yPosition - 50,
          size: 10,
          font: helveticaFont,
          color: rgb(0.6, 0.6, 0.6)
        });
      }

      yPosition -= boxHeight + 15;
    }

    // Footer
    signaturePage.drawText('This document was electronically signed via FileFlow E-Signature', {
      x: 50,
      y: 40,
      size: 8,
      font: helveticaFont,
      color: rgb(0.6, 0.6, 0.6)
    });

    // Save and send
    const pdfBytes = await pdfDoc.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${request.title.replace(/[^a-z0-9]/gi, '_')}_signed.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('Signed PDF generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get signing details by access token (public endpoint for signatories)
app.get('/api/esignature/sign/:token', async (req, res) => {
  try {
    const { data: signatory, error: signatoryError } = await supabase
      .from('signature_signatories')
      .select('*, request:signature_requests(*)')
      .eq('access_token', req.params.token)
      .single();

    if (signatoryError || !signatory) {
      return res.status(404).json({ error: 'Invalid or expired signing link' });
    }

    // Check if request is still valid
    const request = signatory.request;
    if (request.status === 'cancelled') {
      return res.status(400).json({ error: 'This signature request has been cancelled' });
    }
    if (request.status === 'completed') {
      return res.status(400).json({ error: 'This signature request has already been completed' });
    }
    if (request.expires_at && new Date(request.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This signature request has expired' });
    }

    // Log view if not already signed
    if (signatory.status !== 'signed') {
      await supabase
        .from('signature_signatories')
        .update({ status: signatory.status === 'sent' ? 'viewed' : signatory.status })
        .eq('id', signatory.id);

      if (signatory.status === 'sent') {
        await supabase.from('signature_audit_log').insert({
          request_id: request.id,
          signatory_id: signatory.id,
          action: 'viewed',
          actor_email: signatory.email,
          actor_name: signatory.name,
          ip_address: req.ip,
          user_agent: req.headers['user-agent']
        });
      }
    }

    // Remove sensitive data and return
    const { request: _, ...signatoryData } = signatory;
    res.json({
      request: {
        id: request.id,
        title: request.title,
        description: request.description,
        created_at: request.created_at,
        status: request.status
      },
      signatory: signatoryData
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sign document
app.post('/api/esignature/sign', async (req, res) => {
  const { signatory_id, access_token, signature_data, name, email } = req.body;

  try {
    // Verify the signatory and token
    const { data: signatory, error: signatoryError } = await supabase
      .from('signature_signatories')
      .select('*, request:signature_requests(*)')
      .eq('id', signatory_id)
      .eq('access_token', access_token)
      .single();

    if (signatoryError || !signatory) {
      return res.status(404).json({ error: 'Invalid signing credentials' });
    }

    if (signatory.status === 'signed') {
      return res.status(400).json({ error: 'You have already signed this document' });
    }

    const request = signatory.request;
    if (request.status === 'cancelled' || request.status === 'completed') {
      return res.status(400).json({ error: 'This signature request is no longer accepting signatures' });
    }

    // Update signatory with signature
    const { error: updateError } = await supabase
      .from('signature_signatories')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signature_data,
        name: name || signatory.name,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      })
      .eq('id', signatory_id);

    if (updateError) throw updateError;

    // Log the signature
    await supabase.from('signature_audit_log').insert({
      request_id: request.id,
      signatory_id: signatory_id,
      action: 'signed',
      actor_email: email || signatory.email,
      actor_name: name || signatory.name,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    // Check if all signatories have signed
    const { data: allSignatories } = await supabase
      .from('signature_signatories')
      .select('status')
      .eq('request_id', request.id);

    const allSigned = allSignatories?.every(s => s.status === 'signed');

    if (allSigned) {
      // Update request status to completed
      await supabase
        .from('signature_requests')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', request.id);

      // Log completion
      await supabase.from('signature_audit_log').insert({
        request_id: request.id,
        action: 'completed',
        metadata: { completed_by_signatory: signatory_id }
      });
    } else {
      // Update to in_progress if not already
      await supabase
        .from('signature_requests')
        .update({ status: 'in_progress' })
        .eq('id', request.id)
        .eq('status', 'pending');
    }

    res.json({ success: true, all_signed: allSigned });
  } catch (err) {
    console.error('Sign document error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PDF GENERATION
// ============================================================================

// Generate signed PDF with signature page
app.get('/api/esignature/requests/:id/pdf', authenticate, async (req, res) => {
  try {
    // Get the signature request with signatories
    const { data: request, error: fetchError } = await supabase
      .from('signature_requests')
      .select('*, signatories:signature_signatories(*)')
      .eq('id', req.params.id)
      .eq('owner_id', req.user.id)
      .single();

    if (fetchError || !request) {
      return res.status(404).json({ error: 'Signature request not found' });
    }

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Add signature page
    const page = pdfDoc.addPage([612, 792]); // Letter size
    const { width, height } = page.getSize();

    // Header
    page.drawRectangle({
      x: 0,
      y: height - 80,
      width: width,
      height: 80,
      color: rgb(0.231, 0.510, 0.965) // #3b82f6
    });

    page.drawText('SIGNATURE PAGE', {
      x: 50,
      y: height - 50,
      size: 24,
      font: helveticaBold,
      color: rgb(1, 1, 1)
    });

    // Document title
    page.drawText('Document:', {
      x: 50,
      y: height - 120,
      size: 12,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2)
    });

    page.drawText(request.title, {
      x: 120,
      y: height - 120,
      size: 12,
      font: helveticaFont,
      color: rgb(0.2, 0.2, 0.2)
    });

    // Created date
    page.drawText('Created:', {
      x: 50,
      y: height - 140,
      size: 10,
      font: helveticaBold,
      color: rgb(0.4, 0.4, 0.4)
    });

    page.drawText(new Date(request.created_at).toLocaleString(), {
      x: 120,
      y: height - 140,
      size: 10,
      font: helveticaFont,
      color: rgb(0.4, 0.4, 0.4)
    });

    // Status
    const statusText = request.status === 'completed' ? 'FULLY EXECUTED' : request.status.toUpperCase();
    page.drawText('Status:', {
      x: 50,
      y: height - 160,
      size: 10,
      font: helveticaBold,
      color: rgb(0.4, 0.4, 0.4)
    });

    page.drawText(statusText, {
      x: 120,
      y: height - 160,
      size: 10,
      font: helveticaBold,
      color: request.status === 'completed' ? rgb(0.086, 0.635, 0.290) : rgb(0.4, 0.4, 0.4)
    });

    // Description
    if (request.description) {
      page.drawText('Description:', {
        x: 50,
        y: height - 190,
        size: 10,
        font: helveticaBold,
        color: rgb(0.4, 0.4, 0.4)
      });

      page.drawText(request.description.substring(0, 80), {
        x: 50,
        y: height - 205,
        size: 10,
        font: helveticaFont,
        color: rgb(0.4, 0.4, 0.4)
      });
    }

    // Horizontal line
    page.drawLine({
      start: { x: 50, y: height - 230 },
      end: { x: width - 50, y: height - 230 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8)
    });

    // Signatures section
    page.drawText('SIGNATORIES', {
      x: 50,
      y: height - 260,
      size: 14,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2)
    });

    let yPosition = height - 300;
    const signatories = request.signatories || [];

    for (let i = 0; i < signatories.length; i++) {
      const signatory = signatories[i];
      const boxHeight = 120;

      // Check if we need a new page
      if (yPosition - boxHeight < 100) {
        const newPage = pdfDoc.addPage([612, 792]);
        yPosition = newPage.getSize().height - 50;
      }

      // Signatory box
      page.drawRectangle({
        x: 50,
        y: yPosition - boxHeight,
        width: width - 100,
        height: boxHeight,
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 1,
        color: rgb(0.98, 0.98, 0.98)
      });

      // Signatory number
      page.drawText(`Signatory ${i + 1}`, {
        x: 60,
        y: yPosition - 20,
        size: 10,
        font: helveticaBold,
        color: rgb(0.4, 0.4, 0.4)
      });

      // Name
      page.drawText(signatory.name, {
        x: 60,
        y: yPosition - 40,
        size: 14,
        font: helveticaBold,
        color: rgb(0.2, 0.2, 0.2)
      });

      // Title/Role
      if (signatory.title) {
        page.drawText(signatory.title, {
          x: 60,
          y: yPosition - 55,
          size: 10,
          font: helveticaFont,
          color: rgb(0.5, 0.5, 0.5)
        });
      }

      // Email
      page.drawText(signatory.email, {
        x: 60,
        y: yPosition - 70,
        size: 10,
        font: helveticaFont,
        color: rgb(0.5, 0.5, 0.5)
      });

      // Signature area
      if (signatory.status === 'signed' && signatory.signature_data) {
        // Draw signature image
        try {
          const signatureBase64 = signatory.signature_data.replace(/^data:image\/\w+;base64,/, '');
          const signatureBytes = Buffer.from(signatureBase64, 'base64');
          const signatureImage = await pdfDoc.embedPng(signatureBytes);

          const sigDims = signatureImage.scale(0.3);
          page.drawImage(signatureImage, {
            x: 300,
            y: yPosition - 80,
            width: Math.min(sigDims.width, 180),
            height: Math.min(sigDims.height, 60)
          });
        } catch (imgError) {
          console.error('Error embedding signature image:', imgError);
          page.drawText('[Signature on file]', {
            x: 300,
            y: yPosition - 50,
            size: 12,
            font: helveticaFont,
            color: rgb(0.4, 0.4, 0.4)
          });
        }

        // Signed date
        page.drawText(`Signed: ${new Date(signatory.signed_at).toLocaleString()}`, {
          x: 300,
          y: yPosition - 95,
          size: 9,
          font: helveticaFont,
          color: rgb(0.086, 0.635, 0.290)
        });
      } else {
        // Not signed yet
        page.drawText('[ Not yet signed ]', {
          x: 300,
          y: yPosition - 50,
          size: 12,
          font: helveticaFont,
          color: rgb(0.6, 0.6, 0.6)
        });

        page.drawText(`Status: ${signatory.status}`, {
          x: 300,
          y: yPosition - 70,
          size: 9,
          font: helveticaFont,
          color: rgb(0.6, 0.6, 0.6)
        });
      }

      yPosition -= boxHeight + 20;
    }

    // Footer
    page.drawText('This document was electronically signed via FileFlow E-Signature', {
      x: 50,
      y: 50,
      size: 8,
      font: helveticaFont,
      color: rgb(0.6, 0.6, 0.6)
    });

    page.drawText(`Document ID: ${request.id}`, {
      x: 50,
      y: 35,
      size: 8,
      font: helveticaFont,
      color: rgb(0.6, 0.6, 0.6)
    });

    page.drawText(`Generated: ${new Date().toISOString()}`, {
      x: width - 200,
      y: 35,
      size: 8,
      font: helveticaFont,
      color: rgb(0.6, 0.6, 0.6)
    });

    // Serialize PDF
    const pdfBytes = await pdfDoc.save();

    // Send response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${request.title.replace(/[^a-z0-9]/gi, '_')}_signatures.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// FILE VERSIONING ROUTES
// ============================================================================

// Get file versions
app.get('/api/files/:id/versions', authenticate, async (req, res) => {
  try {
    const { data: versions, error } = await supabase
      .from('file_versions')
      .select(`
        id, version_number, size_bytes, change_description,
        is_current, created_at,
        created_by:profiles!file_versions_created_by_fkey(id, display_name, email)
      `)
      .eq('file_id', req.params.id)
      .order('version_number', { ascending: false });

    if (error) throw error;
    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new file version
app.post('/api/files/:id/versions', authenticate, async (req, res) => {
  const { storage_path, size_bytes, change_description, checksum } = req.body;

  try {
    // Get next version number
    const { data: currentVersions } = await supabase
      .from('file_versions')
      .select('version_number')
      .eq('file_id', req.params.id)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = (currentVersions?.[0]?.version_number || 0) + 1;

    // Mark existing versions as not current
    await supabase
      .from('file_versions')
      .update({ is_current: false })
      .eq('file_id', req.params.id)
      .eq('is_current', true);

    // Create new version
    const { data: version, error: versionError } = await supabase
      .from('file_versions')
      .insert({
        file_id: req.params.id,
        version_number: nextVersion,
        storage_path,
        size_bytes,
        checksum,
        change_description,
        created_by: req.user.id,
        is_current: true
      })
      .select()
      .single();

    if (versionError) throw versionError;

    // Update file record
    await supabase
      .from('files')
      .update({
        version: nextVersion,
        storage_path,
        size_bytes
      })
      .eq('id', req.params.id);

    res.json(version);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Restore a specific version
app.post('/api/files/:id/versions/:versionId/restore', authenticate, async (req, res) => {
  try {
    // Get the version to restore
    const { data: version, error: fetchError } = await supabase
      .from('file_versions')
      .select('*')
      .eq('id', req.params.versionId)
      .eq('file_id', req.params.id)
      .single();

    if (fetchError || !version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // Create a new version from the restored one
    const { data: currentVersions } = await supabase
      .from('file_versions')
      .select('version_number')
      .eq('file_id', req.params.id)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = (currentVersions?.[0]?.version_number || 0) + 1;

    // Mark existing versions as not current
    await supabase
      .from('file_versions')
      .update({ is_current: false })
      .eq('file_id', req.params.id)
      .eq('is_current', true);

    // Create restored version
    const { data: newVersion, error: versionError } = await supabase
      .from('file_versions')
      .insert({
        file_id: req.params.id,
        version_number: nextVersion,
        storage_path: version.storage_path,
        size_bytes: version.size_bytes,
        checksum: version.checksum,
        change_description: `Restored from version ${version.version_number}`,
        created_by: req.user.id,
        is_current: true
      })
      .select()
      .single();

    if (versionError) throw versionError;

    // Update file record
    await supabase
      .from('files')
      .update({
        version: nextVersion,
        storage_path: version.storage_path,
        size_bytes: version.size_bytes
      })
      .eq('id', req.params.id);

    res.json(newVersion);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get download URL for a specific version
app.get('/api/files/:id/versions/:versionId/download', authenticate, async (req, res) => {
  try {
    const { data: version, error: fetchError } = await supabase
      .from('file_versions')
      .select('storage_path, bucket_name')
      .eq('id', req.params.versionId)
      .eq('file_id', req.params.id)
      .single();

    if (fetchError || !version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    const { data, error } = await supabase.storage
      .from(version.bucket_name || 'files')
      .createSignedUrl(version.storage_path, 3600);

    if (error) throw error;

    res.json({ url: data.signedUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DOCUMENT PERMISSIONS ROUTES
// ============================================================================

// Get permissions for a file
app.get('/api/files/:id/permissions', authenticate, async (req, res) => {
  try {
    const { data: permissions, error } = await supabase
      .from('document_permissions')
      .select(`
        id, can_read, can_write, can_delete, can_review, can_comment,
        can_version, can_share, is_owner, valid_from, valid_until, granted_at,
        user:profiles!document_permissions_user_id_fkey(id, display_name, email),
        group:groups!document_permissions_group_id_fkey(id, name),
        granted_by_user:profiles!document_permissions_granted_by_fkey(id, display_name)
      `)
      .eq('file_id', req.params.id)
      .is('revoked_at', null);

    if (error) throw error;
    res.json(permissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Grant permission to a user
app.post('/api/files/:id/permissions', authenticate, async (req, res) => {
  const {
    user_id, group_id,
    can_read = true, can_write = false, can_delete = false,
    can_review = false, can_comment = false, can_version = false,
    can_share = false, is_owner = false, valid_until
  } = req.body;

  try {
    // Check if user has permission to share
    const { data: file } = await supabase
      .from('files')
      .select('owner_id')
      .eq('id', req.params.id)
      .single();

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (file.owner_id !== req.user.id) {
      // Check share permission
      const { data: perm } = await supabase
        .from('document_permissions')
        .select('can_share')
        .eq('file_id', req.params.id)
        .eq('user_id', req.user.id)
        .eq('can_share', true)
        .is('revoked_at', null)
        .single();

      if (!perm) {
        return res.status(403).json({ error: 'You do not have permission to share this file' });
      }
    }

    // Revoke existing permission
    if (user_id) {
      await supabase
        .from('document_permissions')
        .update({ revoked_at: new Date().toISOString(), revoked_by: req.user.id })
        .eq('file_id', req.params.id)
        .eq('user_id', user_id)
        .is('revoked_at', null);
    }

    // Create new permission
    const { data: permission, error } = await supabase
      .from('document_permissions')
      .insert({
        file_id: req.params.id,
        user_id: user_id || null,
        group_id: group_id || null,
        can_read, can_write, can_delete,
        can_review, can_comment, can_version, can_share,
        is_owner, valid_until,
        granted_by: req.user.id
      })
      .select(`
        id, can_read, can_write, can_delete, can_review, can_comment,
        can_version, can_share, is_owner, valid_from, valid_until, granted_at,
        user:profiles!document_permissions_user_id_fkey(id, display_name, email)
      `)
      .single();

    if (error) throw error;
    res.json(permission);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update permission
app.patch('/api/files/:id/permissions/:permId', authenticate, async (req, res) => {
  const {
    can_read, can_write, can_delete,
    can_review, can_comment, can_version, can_share,
    valid_until
  } = req.body;

  try {
    const { data: permission, error } = await supabase
      .from('document_permissions')
      .update({
        can_read, can_write, can_delete,
        can_review, can_comment, can_version, can_share,
        valid_until
      })
      .eq('id', req.params.permId)
      .eq('file_id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(permission);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Revoke permission
app.delete('/api/files/:id/permissions/:permId', authenticate, async (req, res) => {
  try {
    const { error } = await supabase
      .from('document_permissions')
      .update({ revoked_at: new Date().toISOString(), revoked_by: req.user.id })
      .eq('id', req.params.permId)
      .eq('file_id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check user permission on file
app.get('/api/files/:id/check-permission', authenticate, async (req, res) => {
  const { permission } = req.query;

  try {
    // Check if owner
    const { data: file } = await supabase
      .from('files')
      .select('owner_id')
      .eq('id', req.params.id)
      .single();

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (file.owner_id === req.user.id) {
      return res.json({ hasPermission: true, isOwner: true });
    }

    // Check document_permissions
    const permissionField = `can_${permission}`;
    const { data: perm } = await supabase
      .from('document_permissions')
      .select('*')
      .eq('file_id', req.params.id)
      .eq('user_id', req.user.id)
      .is('revoked_at', null)
      .single();

    const hasPermission = perm ? perm[permissionField] === true : false;

    res.json({
      hasPermission,
      isOwner: false,
      permissions: perm || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DOCUMENT COMMENTS ROUTES
// ============================================================================

// Get comments for a file
app.get('/api/files/:id/comments', authenticate, async (req, res) => {
  const { version_id } = req.query;

  try {
    let query = supabase
      .from('document_comments')
      .select(`
        id, content, position_data, is_resolved, created_at, updated_at,
        author:profiles!document_comments_author_id_fkey(id, display_name, email, avatar_url),
        resolved_by_user:profiles!document_comments_resolved_by_fkey(id, display_name)
      `)
      .eq('file_id', req.params.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (version_id) {
      query = query.eq('version_id', version_id);
    }

    const { data: comments, error } = await query;
    if (error) throw error;

    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add comment
app.post('/api/files/:id/comments', authenticate, async (req, res) => {
  const { content, version_id, parent_comment_id, position_data } = req.body;

  try {
    const { data: comment, error } = await supabase
      .from('document_comments')
      .insert({
        file_id: req.params.id,
        version_id,
        parent_comment_id,
        content,
        position_data,
        author_id: req.user.id
      })
      .select(`
        id, content, position_data, is_resolved, created_at,
        author:profiles!document_comments_author_id_fkey(id, display_name, email, avatar_url)
      `)
      .single();

    if (error) throw error;
    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update comment
app.patch('/api/files/:id/comments/:commentId', authenticate, async (req, res) => {
  const { content } = req.body;

  try {
    const { data: comment, error } = await supabase
      .from('document_comments')
      .update({ content })
      .eq('id', req.params.commentId)
      .eq('author_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Resolve comment
app.post('/api/files/:id/comments/:commentId/resolve', authenticate, async (req, res) => {
  try {
    const { data: comment, error } = await supabase
      .from('document_comments')
      .update({
        is_resolved: true,
        resolved_by: req.user.id,
        resolved_at: new Date().toISOString()
      })
      .eq('id', req.params.commentId)
      .select()
      .single();

    if (error) throw error;
    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete comment
app.delete('/api/files/:id/comments/:commentId', authenticate, async (req, res) => {
  try {
    const { error } = await supabase
      .from('document_comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', req.params.commentId)
      .eq('author_id', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DOCUMENT REVIEWS ROUTES
// ============================================================================

// Get reviews for a file
app.get('/api/files/:id/reviews', authenticate, async (req, res) => {
  try {
    const { data: reviews, error } = await supabase
      .from('document_reviews')
      .select(`
        id, status, due_date, review_notes, requested_at, reviewed_at,
        requested_by_user:profiles!document_reviews_requested_by_fkey(id, display_name, email),
        reviewer:profiles!document_reviews_reviewer_id_fkey(id, display_name, email),
        version:file_versions(id, version_number)
      `)
      .eq('file_id', req.params.id)
      .order('requested_at', { ascending: false });

    if (error) throw error;
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Request review
app.post('/api/files/:id/reviews', authenticate, async (req, res) => {
  const { reviewer_id, version_id, due_date } = req.body;

  try {
    const { data: review, error } = await supabase
      .from('document_reviews')
      .insert({
        file_id: req.params.id,
        version_id,
        reviewer_id,
        due_date,
        requested_by: req.user.id
      })
      .select(`
        id, status, due_date, requested_at,
        reviewer:profiles!document_reviews_reviewer_id_fkey(id, display_name, email)
      `)
      .single();

    if (error) throw error;
    res.json(review);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit review
app.post('/api/files/:id/reviews/:reviewId/submit', authenticate, async (req, res) => {
  const { status, review_notes } = req.body; // 'approved', 'rejected', 'changes_requested'

  try {
    const { data: review, error } = await supabase
      .from('document_reviews')
      .update({
        status,
        review_notes,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', req.params.reviewId)
      .eq('reviewer_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json(review);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// CROSS-APP FILE ACCESS (for CaseFlow and other apps)
// ============================================================================

// Get files accessible by user (for external apps like CaseFlow)
app.get('/api/external/files', authenticate, async (req, res) => {
  const { folder_id, search, file_type } = req.query;

  try {
    let query = supabase
      .from('files')
      .select(`
        id, name, file_type, file_extension, size_bytes, version,
        starred, storage_path, created_at, updated_at,
        folder:folders(id, name),
        owner:profiles!files_owner_id_fkey(id, display_name, email)
      `)
      .is('deleted_at', null);

    if (folder_id) {
      query = query.eq('folder_id', folder_id);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    if (file_type) {
      query = query.eq('file_type', file_type);
    }

    const { data: files, error } = await query.order('updated_at', { ascending: false });
    if (error) throw error;

    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get users for permission assignment (for external apps)
app.get('/api/external/users', authenticate, async (req, res) => {
  const { search } = req.query;

  try {
    let query = supabase
      .from('profiles')
      .select('id, display_name, email, avatar_url, role')
      .order('display_name');

    if (search) {
      query = query.or(`display_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: users, error } = await query.limit(50);
    if (error) throw error;

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// FILE DETAILS ROUTE (Individual file info with URLs)
// ============================================================================

// Get detailed file information with all URLs
app.get('/api/files/:id/details', authenticate, async (req, res) => {
  try {
    // Get file with owner info
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select(`
        *,
        owner:profiles!files_owner_id_fkey(id, display_name, email),
        folder:folders(id, name, path)
      `)
      .eq('id', req.params.id)
      .single();

    if (fileError || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check if user has access (owner or has permission)
    const isOwner = file.owner_id === req.user.id;
    let hasPermission = isOwner;

    if (!isOwner) {
      const { data: permission } = await supabase
        .from('document_permissions')
        .select('can_read')
        .eq('file_id', req.params.id)
        .eq('user_id', req.user.id)
        .single();

      hasPermission = permission?.can_read;
    }

    if (!hasPermission) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Generate signed URLs
    const { data: downloadUrlData } = await supabase.storage
      .from(file.bucket_name || 'files')
      .createSignedUrl(file.storage_path, 3600); // 1 hour

    // Get public links for this file
    const { data: publicLinks } = await supabase
      .from('public_links')
      .select('*')
      .eq('file_id', req.params.id)
      .is('expires_at', null)
      .or(`expires_at.gt.${new Date().toISOString()}`);

    // Get permissions count
    const { count: permissionsCount } = await supabase
      .from('document_permissions')
      .select('*', { count: 'exact', head: true })
      .eq('file_id', req.params.id);

    // Get version count
    const { count: versionsCount } = await supabase
      .from('file_versions')
      .select('*', { count: 'exact', head: true })
      .eq('file_id', req.params.id);

    // Construct response with all file details
    const baseUrl = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5175';

    res.json({
      ...file,
      urls: {
        download: downloadUrlData?.signedUrl,
        internal: `${baseUrl}/api/storage/download/${file.id}`,
        view: `${clientUrl}/files/${file.id}`,
        embed: `${clientUrl}/embed/${file.id}`,
      },
      sharing: {
        publicLinks: publicLinks || [],
        permissionsCount: permissionsCount || 0,
        isPublic: (publicLinks?.length || 0) > 0,
      },
      stats: {
        versionsCount: versionsCount || 0,
        currentVersion: file.version,
      },
      access: {
        isOwner,
        canEdit: isOwner,
        canShare: isOwner,
        canDelete: isOwner,
      }
    });
  } catch (err) {
    console.error('File details error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PUBLIC LINKS (Shareable URLs like Canva)
// ============================================================================

// Get public links for a file
app.get('/api/files/:id/links', authenticate, async (req, res) => {
  try {
    const { data: links, error } = await supabase
      .from('public_links')
      .select('*')
      .eq('file_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(links || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a public share link
app.post('/api/files/:id/links', authenticate, async (req, res) => {
  const {
    permission_level = 'viewer',
    expires_at,
    max_access_count,
    requires_password,
    password,
    allow_download = true,
    allow_comment = false,
    notify_on_access = false,
    custom_slug
  } = req.body;

  try {
    // Check if user owns the file
    const { data: file } = await supabase
      .from('files')
      .select('owner_id')
      .eq('id', req.params.id)
      .single();

    if (!file || file.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only file owner can create share links' });
    }

    // Generate unique token
    const linkToken = crypto.randomUUID().replace(/-/g, '');

    // Hash password if provided
    let passwordHash = null;
    if (requires_password && password) {
      passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    }

    const { data: link, error } = await supabase
      .from('public_links')
      .insert({
        link_token: linkToken,
        file_id: req.params.id,
        permission_level,
        expires_at,
        max_access_count,
        requires_password: !!requires_password,
        password_hash: passwordHash,
        allow_download,
        allow_comment,
        notify_on_access,
        custom_slug,
        created_by: req.user.id
      })
      .select()
      .single();

    if (error) throw error;

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5175';
    res.json({
      ...link,
      shareUrl: `${clientUrl}/share/${linkToken}`,
      embedUrl: `${clientUrl}/embed/${linkToken}`
    });
  } catch (err) {
    console.error('Create link error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a public link
app.delete('/api/files/:id/links/:linkId', authenticate, async (req, res) => {
  try {
    const { error } = await supabase
      .from('public_links')
      .delete()
      .eq('id', req.params.linkId)
      .eq('created_by', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Access a public link (no auth required)
app.get('/api/share/:token', async (req, res) => {
  try {
    const { data: link, error } = await supabase
      .from('public_links')
      .select(`
        *,
        file:files(id, name, file_type, file_extension, size_bytes, storage_path, bucket_name)
      `)
      .eq('link_token', req.params.token)
      .single();

    if (error || !link) {
      return res.status(404).json({ error: 'Link not found or expired' });
    }

    // Check if expired
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This link has expired' });
    }

    // Check max access count
    if (link.max_access_count && link.current_access_count >= link.max_access_count) {
      return res.status(410).json({ error: 'This link has reached maximum access count' });
    }

    // Check password requirement
    if (link.requires_password) {
      const providedPassword = req.headers['x-link-password'];
      if (!providedPassword) {
        return res.json({
          requiresPassword: true,
          fileName: link.file?.name
        });
      }

      const hash = crypto.createHash('sha256').update(providedPassword).digest('hex');
      if (hash !== link.password_hash) {
        return res.status(401).json({ error: 'Invalid password' });
      }
    }

    // Update access count
    await supabase
      .from('public_links')
      .update({ current_access_count: (link.current_access_count || 0) + 1 })
      .eq('id', link.id);

    // Generate signed URL if download allowed
    let downloadUrl = null;
    if (link.allow_download && link.file) {
      const { data: urlData } = await supabase.storage
        .from(link.file.bucket_name || 'files')
        .createSignedUrl(link.file.storage_path, 3600);
      downloadUrl = urlData?.signedUrl;
    }

    res.json({
      file: link.file,
      permissions: {
        canView: true,
        canEdit: link.permission_level === 'editor',
        canDownload: link.allow_download,
        canComment: link.allow_comment
      },
      downloadUrl
    });
  } catch (err) {
    console.error('Share link error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// API KEYS MANAGEMENT
// ============================================================================

// Generate API key hash
function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// Generate new API key
function generateApiKey() {
  const key = `ff_${crypto.randomBytes(32).toString('hex')}`;
  return key;
}

// API key authentication middleware
const authenticateApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  try {
    const keyHash = hashApiKey(apiKey);
    const keyPrefix = apiKey.substring(0, 8);

    const { data: apiKeyRecord, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key_hash', keyHash)
      .eq('key_prefix', keyPrefix)
      .is('revoked_at', null)
      .single();

    if (error || !apiKeyRecord) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Check expiration
    if (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at) < new Date()) {
      return res.status(401).json({ error: 'API key has expired' });
    }

    // Update usage stats
    await supabase
      .from('api_keys')
      .update({
        last_used_at: new Date().toISOString(),
        usage_count: (apiKeyRecord.usage_count || 0) + 1
      })
      .eq('id', apiKeyRecord.id);

    req.apiKey = apiKeyRecord;
    req.user = { id: apiKeyRecord.owner_id };
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

// List user's API keys
app.get('/api/keys', authenticate, async (req, res) => {
  try {
    const { data: keys, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, permission_level, scope_type, scope_ids, rate_limit_per_minute, rate_limit_per_day, last_used_at, usage_count, expires_at, revoked_at, created_at')
      .eq('owner_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(keys || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new API key
app.post('/api/keys', authenticate, async (req, res) => {
  const {
    name,
    permission_level = 'read',
    scope_type = 'all',
    scope_ids = [],
    expires_at,
    rate_limit_per_minute = 60,
    rate_limit_per_day = 10000
  } = req.body;

  try {
    // Generate the actual key (shown only once)
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);
    const keyPrefix = apiKey.substring(0, 8);

    const { data: keyRecord, error } = await supabase
      .from('api_keys')
      .insert({
        name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        owner_id: req.user.id,
        permission_level,
        scope_type,
        scope_ids,
        expires_at,
        rate_limit_per_minute,
        rate_limit_per_day
      })
      .select('id, name, key_prefix, permission_level, scope_type, created_at')
      .single();

    if (error) throw error;

    // Return the full key only on creation (never stored or shown again)
    res.json({
      ...keyRecord,
      key: apiKey,
      message: 'Save this key now - it will not be shown again!'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Revoke API key
app.delete('/api/keys/:id', authenticate, async (req, res) => {
  try {
    const { error } = await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('owner_id', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API key access endpoint - get files with API key auth
app.get('/api/v1/files', authenticateApiKey, async (req, res) => {
  try {
    const { folder_id, search } = req.query;
    const apiKey = req.apiKey;

    let query = supabase
      .from('files')
      .select('id, name, file_type, file_extension, size_bytes, storage_path, bucket_name, created_at, updated_at')
      .eq('owner_id', apiKey.owner_id)
      .is('deleted_at', null);

    // Apply scope restrictions
    if (apiKey.scope_type === 'folder' && apiKey.scope_ids?.length > 0) {
      query = query.in('folder_id', apiKey.scope_ids);
    } else if (apiKey.scope_type === 'file' && apiKey.scope_ids?.length > 0) {
      query = query.in('id', apiKey.scope_ids);
    }

    if (folder_id) {
      query = query.eq('folder_id', folder_id);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data: files, error } = await query.order('name');

    if (error) throw error;

    res.json({
      files,
      permission: apiKey.permission_level,
      usage: {
        count: apiKey.usage_count,
        lastUsed: apiKey.last_used_at
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API key access - get single file
app.get('/api/v1/files/:id', authenticateApiKey, async (req, res) => {
  try {
    const apiKey = req.apiKey;

    // Check scope
    if (apiKey.scope_type === 'file' && apiKey.scope_ids?.length > 0) {
      if (!apiKey.scope_ids.includes(req.params.id)) {
        return res.status(403).json({ error: 'File not in API key scope' });
      }
    }

    const { data: file, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', req.params.id)
      .eq('owner_id', apiKey.owner_id)
      .single();

    if (error || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Generate download URL
    const { data: urlData } = await supabase.storage
      .from(file.bucket_name || 'files')
      .createSignedUrl(file.storage_path, 3600);

    res.json({
      file,
      downloadUrl: urlData?.signedUrl,
      permission: apiKey.permission_level
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PDF MERGE
// ============================================================================

app.post('/api/files/merge-pdf', authenticate, async (req, res) => {
  const { file_ids, output_name, folder_id } = req.body;

  if (!file_ids || !Array.isArray(file_ids) || file_ids.length < 2) {
    return res.status(400).json({ error: 'At least 2 file IDs required' });
  }

  try {
    // Fetch all file records
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('*')
      .in('id', file_ids)
      .eq('owner_id', req.user.id);

    if (filesError) throw filesError;

    if (files.length !== file_ids.length) {
      return res.status(404).json({ error: 'One or more files not found or not owned by you' });
    }

    // Verify all files are PDFs
    const nonPdfFiles = files.filter(f => !f.file_type.includes('pdf'));
    if (nonPdfFiles.length > 0) {
      return res.status(400).json({
        error: `Non-PDF files cannot be merged: ${nonPdfFiles.map(f => f.name).join(', ')}`
      });
    }

    // Order files by the order in file_ids array
    const orderedFiles = file_ids.map(id => files.find(f => f.id === id)).filter(Boolean);

    // Create merged PDF
    const mergedPdf = await PDFDocument.create();

    // Store source file info for metadata
    const sourceFilesInfo = [];

    for (const file of orderedFiles) {
      // Download PDF from Supabase storage
      const { data: fileData, error: downloadError } = await supabase
        .storage
        .from(file.bucket_name || 'files')
        .download(file.storage_path);

      if (downloadError) {
        throw new Error(`Failed to download ${file.name}: ${downloadError.message}`);
      }

      const pdfBytes = await fileData.arrayBuffer();
      const sourcePdf = await PDFDocument.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());

      // Track page range for this source file
      const startPage = mergedPdf.getPageCount() + 1;
      copiedPages.forEach(page => mergedPdf.addPage(page));
      const endPage = mergedPdf.getPageCount();

      sourceFilesInfo.push({
        id: file.id,
        name: file.name,
        original_size_bytes: file.size_bytes,
        page_count: copiedPages.length,
        page_range: { start: startPage, end: endPage },
        file_type: file.file_type,
        created_at: file.created_at,
        updated_at: file.updated_at
      });
    }

    // Set PDF metadata
    mergedPdf.setTitle(output_name || 'Merged Document');
    mergedPdf.setCreator('FileFlow');
    mergedPdf.setProducer('FileFlow PDF Merger');
    mergedPdf.setCreationDate(new Date());
    mergedPdf.setModificationDate(new Date());

    // Add custom metadata about source files
    mergedPdf.setSubject(`Merged from ${sourceFilesInfo.length} files: ${sourceFilesInfo.map(f => f.name).join(', ')}`);

    const mergedPdfBytes = await mergedPdf.save();
    const mergedBuffer = Buffer.from(mergedPdfBytes);

    // Generate storage path
    const timestamp = Date.now();
    const finalName = output_name?.endsWith('.pdf') ? output_name : `${output_name || 'merged'}.pdf`;
    const storagePath = `${req.user.id}/${timestamp}_${finalName}`;

    // Upload merged PDF to storage
    const { error: uploadError } = await supabase
      .storage
      .from('files')
      .upload(storagePath, mergedBuffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Create file record with source files metadata
    const { data: newFile, error: createError } = await supabase
      .from('files')
      .insert({
        name: finalName,
        file_type: 'application/pdf',
        file_extension: 'pdf',
        size_bytes: mergedBuffer.length,
        folder_id: folder_id || null,
        owner_id: req.user.id,
        storage_path: storagePath,
        bucket_name: 'files',
        upload_status: 'completed',
        version: 1,
        metadata: {
          merged_from: sourceFilesInfo,
          merge_date: new Date().toISOString(),
          total_source_files: sourceFilesInfo.length,
          total_pages: mergedPdf.getPageCount()
        }
      })
      .select()
      .single();

    if (createError) throw createError;

    // Update user's storage usage
    await supabase
      .from('profiles')
      .update({
        storage_used_bytes: supabase.rpc('increment_storage', { bytes: mergedBuffer.length })
      })
      .eq('id', req.user.id);

    res.json({
      success: true,
      file: newFile,
      merged_info: {
        source_files: sourceFilesInfo,
        total_pages: mergedPdf.getPageCount(),
        output_size_bytes: mergedBuffer.length
      }
    });
  } catch (err) {
    console.error('PDF merge error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

// ============================================================================
// ADMIN MIDDLEWARE
// ============================================================================

const adminOnly = async (req, res, next) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (error || !profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.isAdmin = true;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Access denied' });
  }
};

// ============================================================================
// ADMIN - USER MANAGEMENT
// ============================================================================

// Get all users (admin only)
app.get('/api/admin/users', authenticate, adminOnly, async (req, res) => {
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get auth user data for each profile
    const usersWithAuth = await Promise.all(profiles.map(async (profile) => {
      const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
      const authUser = users?.find(u => u.id === profile.id);
      return {
        ...profile,
        email: authUser?.email || profile.email,
        email_confirmed: authUser?.email_confirmed_at ? true : false,
        last_sign_in: authUser?.last_sign_in_at,
        created_at_auth: authUser?.created_at
      };
    }));

    res.json(usersWithAuth);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single user details
app.get('/api/admin/users/:userId', authenticate, adminOnly, async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.params.userId)
      .single();

    if (error) throw error;

    // Get file count and storage stats
    const { data: files } = await supabase
      .from('files')
      .select('id, size_bytes')
      .eq('owner_id', req.params.userId);

    const { data: folders } = await supabase
      .from('folders')
      .select('id')
      .eq('owner_id', req.params.userId);

    res.json({
      ...profile,
      stats: {
        file_count: files?.length || 0,
        folder_count: folders?.length || 0,
        total_storage: files?.reduce((sum, f) => sum + (f.size_bytes || 0), 0) || 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new user (admin only)
app.post('/api/admin/users', authenticate, adminOnly, async (req, res) => {
  const { email, password, display_name, role = 'user', storage_quota_bytes = 10737418240 } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name }
    });

    if (authError) throw authError;

    // Create profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email,
        display_name: display_name || email.split('@')[0],
        role,
        storage_quota_bytes,
        storage_used_bytes: 0,
        account_status: 'active'
      })
      .select()
      .single();

    if (profileError) throw profileError;

    // Log admin action
    await supabase.from('admin_audit_log').insert({
      admin_id: req.user.id,
      action: 'create_user',
      target_type: 'user',
      target_id: authData.user.id,
      new_values: { email, display_name, role },
      ip_address: req.ip
    });

    res.json({ user: authData.user, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user (admin only)
app.patch('/api/admin/users/:userId', authenticate, adminOnly, async (req, res) => {
  const { display_name, role, account_status, storage_quota_bytes } = req.body;
  const updates = {};

  if (display_name !== undefined) updates.display_name = display_name;
  if (role !== undefined) updates.role = role;
  if (account_status !== undefined) updates.account_status = account_status;
  if (storage_quota_bytes !== undefined) updates.storage_quota_bytes = storage_quota_bytes;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }

  try {
    // Get old values for audit
    const { data: oldProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.params.userId)
      .single();

    updates.updated_at = new Date().toISOString();

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.params.userId)
      .select()
      .single();

    if (error) throw error;

    // Log admin action
    await supabase.from('admin_audit_log').insert({
      admin_id: req.user.id,
      action: 'update_user',
      target_type: 'user',
      target_id: req.params.userId,
      old_values: oldProfile,
      new_values: updates,
      ip_address: req.ip
    });

    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user (admin only)
app.delete('/api/admin/users/:userId', authenticate, adminOnly, async (req, res) => {
  try {
    // Prevent self-deletion
    if (req.params.userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Get user info for audit
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.params.userId)
      .single();

    // Delete auth user (cascades to profile via FK)
    const { error } = await supabase.auth.admin.deleteUser(req.params.userId);
    if (error) throw error;

    // Log admin action
    await supabase.from('admin_audit_log').insert({
      admin_id: req.user.id,
      action: 'delete_user',
      target_type: 'user',
      target_id: req.params.userId,
      old_values: profile,
      ip_address: req.ip
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset user password (admin only)
app.post('/api/admin/users/:userId/reset-password', authenticate, adminOnly, async (req, res) => {
  const { new_password } = req.body;

  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const { error } = await supabase.auth.admin.updateUserById(req.params.userId, {
      password: new_password
    });

    if (error) throw error;

    // Log admin action
    await supabase.from('admin_audit_log').insert({
      admin_id: req.user.id,
      action: 'reset_password',
      target_type: 'user',
      target_id: req.params.userId,
      ip_address: req.ip
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// ADMIN - DOCUMENT ACCESS TOKENS
// ============================================================================

// Get all document access tokens (admin sees all, users see their own)
app.get('/api/admin/tokens', authenticate, async (req, res) => {
  try {
    let query = supabase
      .from('document_access_tokens')
      .select('*')
      .order('created_at', { ascending: false });

    // Non-admins only see their own tokens
    if (!req.isAdmin) {
      query = query.eq('created_by', req.user.id);
    }

    const { data: tokens, error } = await query;
    if (error) throw error;

    res.json(tokens);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create document access token
app.post('/api/admin/tokens', authenticate, async (req, res) => {
  const {
    name,
    scope_type = 'specific',
    file_ids = [],
    folder_ids = [],
    can_view = true,
    can_download = false,
    can_edit = false,
    can_delete = false,
    can_share = false,
    allowed_ips = [],
    allowed_domains = [],
    max_downloads,
    expires_at
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Token name is required' });
  }

  try {
    // Generate secure token
    const tokenValue = `ff_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(tokenValue).digest('hex');
    const tokenPrefix = tokenValue.substring(0, 10);

    const { data: token, error } = await supabase
      .from('document_access_tokens')
      .insert({
        name,
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        created_by: req.user.id,
        scope_type,
        file_ids,
        folder_ids,
        can_view,
        can_download,
        can_edit,
        can_delete,
        can_share,
        allowed_ips,
        allowed_domains,
        max_downloads,
        expires_at: expires_at || null
      })
      .select()
      .single();

    if (error) throw error;

    // Log admin action
    await supabase.from('admin_audit_log').insert({
      admin_id: req.user.id,
      action: 'create_token',
      target_type: 'token',
      target_id: token.id,
      new_values: { name, scope_type, file_ids, folder_ids },
      ip_address: req.ip
    });

    res.json({
      ...token,
      token: tokenValue, // Only shown once!
      message: 'Save this token - it will not be shown again!'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update document access token
app.patch('/api/admin/tokens/:tokenId', authenticate, async (req, res) => {
  const {
    name,
    is_active,
    can_view,
    can_download,
    can_edit,
    can_delete,
    can_share,
    allowed_ips,
    allowed_domains,
    max_downloads,
    expires_at,
    file_ids,
    folder_ids
  } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (is_active !== undefined) updates.is_active = is_active;
  if (can_view !== undefined) updates.can_view = can_view;
  if (can_download !== undefined) updates.can_download = can_download;
  if (can_edit !== undefined) updates.can_edit = can_edit;
  if (can_delete !== undefined) updates.can_delete = can_delete;
  if (can_share !== undefined) updates.can_share = can_share;
  if (allowed_ips !== undefined) updates.allowed_ips = allowed_ips;
  if (allowed_domains !== undefined) updates.allowed_domains = allowed_domains;
  if (max_downloads !== undefined) updates.max_downloads = max_downloads;
  if (expires_at !== undefined) updates.expires_at = expires_at;
  if (file_ids !== undefined) updates.file_ids = file_ids;
  if (folder_ids !== undefined) updates.folder_ids = folder_ids;

  updates.updated_at = new Date().toISOString();

  try {
    // Check ownership or admin
    const { data: existing } = await supabase
      .from('document_access_tokens')
      .select('created_by')
      .eq('id', req.params.tokenId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Token not found' });
    }

    // Check if user can edit this token
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (existing.created_by !== req.user.id && profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to modify this token' });
    }

    const { data: token, error } = await supabase
      .from('document_access_tokens')
      .update(updates)
      .eq('id', req.params.tokenId)
      .select()
      .single();

    if (error) throw error;

    res.json(token);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete/revoke document access token
app.delete('/api/admin/tokens/:tokenId', authenticate, async (req, res) => {
  try {
    // Check ownership or admin
    const { data: existing } = await supabase
      .from('document_access_tokens')
      .select('*')
      .eq('id', req.params.tokenId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Token not found' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (existing.created_by !== req.user.id && profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this token' });
    }

    const { error } = await supabase
      .from('document_access_tokens')
      .delete()
      .eq('id', req.params.tokenId);

    if (error) throw error;

    // Log admin action
    await supabase.from('admin_audit_log').insert({
      admin_id: req.user.id,
      action: 'delete_token',
      target_type: 'token',
      target_id: req.params.tokenId,
      old_values: existing,
      ip_address: req.ip
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get token usage logs
app.get('/api/admin/tokens/:tokenId/logs', authenticate, async (req, res) => {
  try {
    // Check ownership or admin
    const { data: token } = await supabase
      .from('document_access_tokens')
      .select('created_by')
      .eq('id', req.params.tokenId)
      .single();

    if (!token) {
      return res.status(404).json({ error: 'Token not found' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (token.created_by !== req.user.id && profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data: logs, error } = await supabase
      .from('token_usage_log')
      .select('*')
      .eq('token_id', req.params.tokenId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// ADMIN - SYSTEM STATS & AUDIT
// ============================================================================

// Get system statistics
app.get('/api/admin/stats', authenticate, adminOnly, async (req, res) => {
  try {
    // Get counts
    const { data: users } = await supabase.from('profiles').select('id, role, account_status');
    const { data: files } = await supabase.from('files').select('id, size_bytes');
    const { data: folders } = await supabase.from('folders').select('id');
    const { data: tokens } = await supabase.from('document_access_tokens').select('id, is_active');
    const { data: signatureRequests } = await supabase.from('signature_requests').select('id, status');

    const totalStorage = files?.reduce((sum, f) => sum + (f.size_bytes || 0), 0) || 0;

    res.json({
      users: {
        total: users?.length || 0,
        admins: users?.filter(u => u.role === 'admin').length || 0,
        active: users?.filter(u => u.account_status === 'active').length || 0,
        suspended: users?.filter(u => u.account_status === 'suspended').length || 0
      },
      files: {
        total: files?.length || 0,
        total_storage_bytes: totalStorage,
        total_storage_formatted: formatBytes(totalStorage)
      },
      folders: {
        total: folders?.length || 0
      },
      tokens: {
        total: tokens?.length || 0,
        active: tokens?.filter(t => t.is_active).length || 0
      },
      signatures: {
        total: signatureRequests?.length || 0,
        completed: signatureRequests?.filter(s => s.status === 'completed').length || 0,
        pending: signatureRequests?.filter(s => s.status === 'pending' || s.status === 'in_progress').length || 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper function for formatting bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get admin audit logs
app.get('/api/admin/audit-logs', authenticate, adminOnly, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const { data: logs, error } = await supabase
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Get admin names
    const adminIds = [...new Set(logs.map(l => l.admin_id))];
    const { data: admins } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .in('id', adminIds);

    const logsWithAdmins = logs.map(log => ({
      ...log,
      admin: admins?.find(a => a.id === log.admin_id)
    }));

    res.json(logsWithAdmins);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// TOKEN-BASED FILE ACCESS (Public API)
// ============================================================================

// Middleware to authenticate via document access token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ff_')) {
    return res.status(401).json({ error: 'Invalid token format' });
  }

  const tokenValue = authHeader.split(' ')[1];
  const tokenHash = crypto.createHash('sha256').update(tokenValue).digest('hex');

  try {
    const { data: token, error } = await supabase
      .from('document_access_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('is_active', true)
      .single();

    if (error || !token) {
      return res.status(401).json({ error: 'Invalid or inactive token' });
    }

    // Check expiration
    if (token.expires_at && new Date(token.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Token has expired' });
    }

    // Check IP restrictions
    if (token.allowed_ips?.length > 0) {
      const clientIp = req.ip || req.connection.remoteAddress;
      if (!token.allowed_ips.includes(clientIp)) {
        return res.status(403).json({ error: 'IP not allowed' });
      }
    }

    // Update usage stats
    await supabase
      .from('document_access_tokens')
      .update({
        last_used_at: new Date().toISOString(),
        usage_count: token.usage_count + 1
      })
      .eq('id', token.id);

    req.accessToken = token;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token authentication failed' });
  }
};

// Public file access via token
app.get('/api/public/files', authenticateToken, async (req, res) => {
  try {
    const token = req.accessToken;
    let query = supabase.from('files').select('id, name, file_type, size_bytes, created_at, updated_at');

    if (token.scope_type === 'specific' && token.file_ids?.length > 0) {
      query = query.in('id', token.file_ids);
    } else if (token.scope_type === 'folder' && token.folder_ids?.length > 0) {
      query = query.in('folder_id', token.folder_ids);
    }
    // 'all' scope returns all files accessible to token creator

    const { data: files, error } = await query;
    if (error) throw error;

    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public file download via token
app.get('/api/public/files/:fileId/download', authenticateToken, async (req, res) => {
  try {
    const token = req.accessToken;

    if (!token.can_download) {
      return res.status(403).json({ error: 'Download not permitted with this token' });
    }

    // Check if file is in scope
    if (token.scope_type === 'specific' && !token.file_ids?.includes(req.params.fileId)) {
      return res.status(403).json({ error: 'File not accessible with this token' });
    }

    // Check download limits
    if (token.max_downloads && token.current_downloads >= token.max_downloads) {
      return res.status(403).json({ error: 'Download limit reached' });
    }

    const { data: file, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', req.params.fileId)
      .single();

    if (error || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get signed URL
    const supabasePublic = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data: signedData, error: signedError } = await supabasePublic.storage
      .from(file.bucket_name)
      .createSignedUrl(file.storage_path, 3600);

    if (signedError) throw signedError;

    // Update download count
    await supabase
      .from('document_access_tokens')
      .update({ current_downloads: token.current_downloads + 1 })
      .eq('id', token.id);

    // Log usage
    await supabase.from('token_usage_log').insert({
      token_id: token.id,
      action: 'download',
      file_id: file.id,
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.json({ download_url: signedData.signedUrl, file });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'fileflow-api', version: '2.0.0' });
});

// ============================================================================
// API DOCUMENTATION ROUTES
// ============================================================================

// Swagger UI for interactive API documentation
app.get('/api/docs', (req, res) => {
  const swaggerHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>FileFlow API Documentation</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; padding: 0; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 20px 0; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "/api/docs/openapi.yaml",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>`;
  res.type('html').send(swaggerHtml);
});

// Serve OpenAPI YAML specification
app.get('/api/docs/openapi.yaml', (req, res) => {
  const yamlPath = path.join(__dirname, '..', 'docs', 'api.yaml');
  if (fs.existsSync(yamlPath)) {
    res.type('text/yaml').sendFile(yamlPath);
  } else {
    res.status(404).json({ error: 'OpenAPI specification not found' });
  }
});

// Serve OpenAPI as JSON (for tools that prefer JSON)
app.get('/api/docs/openapi.json', async (req, res) => {
  const yamlPath = path.join(__dirname, '..', 'docs', 'api.yaml');
  if (fs.existsSync(yamlPath)) {
    try {
      const yaml = fs.readFileSync(yamlPath, 'utf8');
      // Simple YAML to JSON conversion (basic support)
      const { default: YAML } = await import('yaml');
      const json = YAML.parse(yaml);
      res.json(json);
    } catch (err) {
      res.status(500).json({ error: 'Failed to parse OpenAPI specification' });
    }
  } else {
    res.status(404).json({ error: 'OpenAPI specification not found' });
  }
});

// Serve markdown API documentation
app.get('/api/docs/readme', (req, res) => {
  const mdPath = path.join(__dirname, '..', 'docs', 'API.md');
  if (fs.existsSync(mdPath)) {
    const markdown = fs.readFileSync(mdPath, 'utf8');
    // Return as HTML with basic styling
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>FileFlow API Reference</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.0/github-markdown.min.css">
  <style>
    body {
      background: #0d1117;
      padding: 40px;
      max-width: 980px;
      margin: 0 auto;
    }
    .markdown-body {
      background: #161b22;
      padding: 40px;
      border-radius: 8px;
      color: #c9d1d9;
    }
    .markdown-body pre { background: #0d1117; }
    .markdown-body code { background: #0d1117; }
  </style>
</head>
<body>
  <article class="markdown-body">
    <div id="content"></div>
  </article>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script>
    document.getElementById('content').innerHTML = marked.parse(\`${markdown.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`);
  </script>
</body>
</html>`;
    res.type('html').send(html);
  } else {
    res.status(404).json({ error: 'API documentation not found' });
  }
});

// Raw markdown file
app.get('/api/docs/readme.md', (req, res) => {
  const mdPath = path.join(__dirname, '..', 'docs', 'API.md');
  if (fs.existsSync(mdPath)) {
    res.type('text/markdown').sendFile(mdPath);
  } else {
    res.status(404).json({ error: 'API documentation not found' });
  }
});

// Documentation index
app.get('/api/docs/index', (req, res) => {
  res.json({
    title: 'FileFlow API Documentation',
    version: '2.0.0',
    endpoints: {
      swagger_ui: '/api/docs',
      openapi_yaml: '/api/docs/openapi.yaml',
      openapi_json: '/api/docs/openapi.json',
      readme_html: '/api/docs/readme',
      readme_md: '/api/docs/readme.md'
    },
    description: 'FileFlow provides a REST API for file management, sharing, and e-signatures.'
  });
});

// ============================================================================
// DOCUMENT PROCESSING ROUTES (PDFFlow Integration)
// ============================================================================
app.use('/api/document-processing', authenticate, documentActionsRouter);
app.use('/api', authenticate, documentActionsRouter);

// ============================================================================
// EMAIL ROUTES
// ============================================================================
app.use('/api/email', authenticate, emailRouter);

// ============================================================================
// AUDIO STREAMING ROUTES
// ============================================================================

// POST /api/audio/stream/start — create a new recording session
app.post('/api/audio/stream/start', authenticate, (req, res) => {
  const { mimeType = 'audio/webm' } = req.body;
  const sessionId = crypto.randomUUID();
  const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
  const filePath = path.join(AUDIO_TEMP_DIR, `${sessionId}.${ext}`);

  try {
    const writeStream = fs.createWriteStream(filePath, { flags: 'a' });

    writeStream.on('error', (err) => {
      console.error(`[audio] Write stream error for ${sessionId}:`, err.message);
      audioSessions.delete(sessionId);
    });

    audioSessions.set(sessionId, {
      writeStream,
      filePath,
      mimeType,
      ext,
      userId: req.user.id,
      lastHeartbeat: Date.now(),
      size: 0,
    });

    console.log(`[audio] Session started: ${sessionId} (${mimeType})`);
    res.json({ sessionId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/audio/stream/:sessionId/chunk — append a binary chunk
app.post('/api/audio/stream/:sessionId/chunk', authenticate, express.raw({ type: '*/*', limit: '2mb' }), (req, res) => {
  const { sessionId } = req.params;
  const session = audioSessions.get(sessionId);

  if (!session) return res.status(404).json({ error: 'Session not found or expired' });
  if (session.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  if (!req.body || req.body.length === 0) return res.status(400).json({ error: 'Empty chunk' });

  session.writeStream.write(req.body, (err) => {
    if (err) {
      console.error(`[audio] Chunk write error for ${sessionId}:`, err.message);
      return res.status(500).json({ error: 'Failed to write chunk' });
    }
    session.size += req.body.length;
    session.lastHeartbeat = Date.now();
    res.json({ ok: true, size: session.size });
  });
});

// POST /api/audio/stream/:sessionId/finalize — close stream, save to storage & DB
app.post('/api/audio/stream/:sessionId/finalize', authenticate, async (req, res) => {
  const { sessionId } = req.params;
  const { fileName, folderId } = req.body;

  const session = audioSessions.get(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found or already finalized' });
  if (session.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  try {
    const finalized = await finalizeAudioSession(sessionId, 'client');
    if (!finalized) return res.status(400).json({ error: 'No audio data recorded' });

    const fileBuffer = fs.readFileSync(finalized.filePath);
    const finalName = fileName
      ? (fileName.includes('.') ? fileName : `${fileName}.${finalized.ext}`)
      : `Recording_${new Date().toISOString().replace(/[:.]/g, '-')}.${finalized.ext}`;

    const storagePath = `${req.user.id}/${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${finalized.ext}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('files')
      .upload(storagePath, fileBuffer, { contentType: finalized.mimeType, upsert: false });

    if (uploadError) throw uploadError;

    // Save file record in DB
    const { data: fileRecord, error: dbError } = await supabase.from('files').insert({
      name: finalName,
      mime_type: finalized.mimeType,
      size_bytes: finalized.size,
      storage_path: storagePath,
      bucket_name: 'files',
      folder_id: folderId || null,
      owner_id: req.user.id,
    }).select().single();

    if (dbError) throw dbError;

    // Cleanup temp file
    try { fs.unlinkSync(finalized.filePath); } catch (_) {}

    console.log(`[audio] Saved recording: ${finalName} (${finalized.size} bytes)`);
    res.json({ data: fileRecord });
  } catch (err) {
    console.error(`[audio] Finalize error for ${sessionId}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/audio/stream/:sessionId — discard a session (user cancelled)
app.delete('/api/audio/stream/:sessionId', authenticate, async (req, res) => {
  const { sessionId } = req.params;
  const session = audioSessions.get(sessionId);

  if (!session) return res.json({ ok: true }); // Already gone
  if (session.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  audioSessions.delete(sessionId);
  try {
    if (!session.writeStream.writableEnded) session.writeStream.end();
    fs.unlinkSync(session.filePath);
  } catch (_) {}

  console.log(`[audio] Session ${sessionId} discarded by user`);
  res.json({ ok: true });
});

// ============================================================================
// TRANSCRIPTION + AI SUMMARY ROUTES
// ============================================================================

// In-memory store for transcript results (keyed by file id)
// For production this should be persisted to DB, but this keeps it simple.
const transcriptCache = new Map();

// POST /api/audio/transcribe/:fileId — download file from storage, send to Deepgram
app.post('/api/audio/transcribe/:fileId', authenticate, async (req, res) => {
  const { fileId } = req.params;
  const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
  if (!DEEPGRAM_API_KEY) return res.status(500).json({ error: 'Deepgram API key not configured' });

  try {
    // Get file record
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('id, name, storage_path, bucket_name, file_type, owner_id')
      .eq('id', fileId)
      .single();

    if (fileError || !file) return res.status(404).json({ error: 'File not found' });
    if (file.owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (!file.file_type?.startsWith('audio/')) return res.status(400).json({ error: 'File is not an audio file' });

    // Check cache
    if (transcriptCache.has(fileId)) {
      return res.json(transcriptCache.get(fileId));
    }

    // Download audio from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(file.bucket_name || 'files')
      .download(file.storage_path);

    if (downloadError) throw downloadError;

    const audioBuffer = Buffer.from(await fileData.arrayBuffer());

    // Send to Deepgram Nova-2 for transcription
    const dgRes = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&paragraphs=true&diarize=true', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': file.file_type,
      },
      body: audioBuffer,
    });

    if (!dgRes.ok) {
      const dgErr = await dgRes.text();
      throw new Error(`Deepgram error: ${dgErr}`);
    }

    const dgData = await dgRes.json();
    const transcript = dgData?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
    const paragraphs = dgData?.results?.channels?.[0]?.alternatives?.[0]?.paragraphs?.transcript ?? null;

    const result = { fileId, transcript, paragraphs, words: dgData?.results?.channels?.[0]?.alternatives?.[0]?.words ?? [] };
    transcriptCache.set(fileId, result);

    res.json(result);
  } catch (err) {
    console.error('[transcribe] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/audio/transcribe/:fileId — retrieve cached transcript
app.get('/api/audio/transcribe/:fileId', authenticate, async (req, res) => {
  const { fileId } = req.params;
  if (transcriptCache.has(fileId)) return res.json(transcriptCache.get(fileId));
  res.status(404).json({ error: 'No transcript found. Request transcription first.' });
});

// POST /api/audio/summarize/:fileId — summarize a cached transcript using Claude
app.post('/api/audio/summarize/:fileId', authenticate, async (req, res) => {
  const { fileId } = req.params;
  const cached = transcriptCache.get(fileId);
  if (!cached?.transcript) return res.status(404).json({ error: 'No transcript found. Transcribe the file first.' });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Anthropic API key not configured' });

  const systemPrompt = process.env.AI_SUMMARY_PROMPT ||
    'You are a professional meeting assistant. Given the following transcript, provide a concise summary covering: key topics discussed, decisions made, and any important context. Be clear and professional.';

  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Transcript:\n\n${cached.transcript}` }],
      }),
    });

    if (!aiRes.ok) {
      const aiErr = await aiRes.text();
      throw new Error(`Claude API error: ${aiErr}`);
    }

    const aiData = await aiRes.json();
    const summary = aiData?.content?.[0]?.text ?? '';

    // Cache summary alongside transcript
    cached.summary = summary;
    transcriptCache.set(fileId, cached);

    res.json({ fileId, summary });
  } catch (err) {
    console.error('[summarize] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/deepgram-key — get whether a key is configured (masked)
app.get('/api/settings/deepgram-key', authenticate, async (req, res) => {
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', req.user.id).single();
  if (profile?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const key = process.env.DEEPGRAM_API_KEY || '';
  res.json({ configured: !!key, preview: key ? key.slice(0, 6) + '…' : '' });
});

// POST /api/settings/deepgram-key — update Deepgram API key (admin only)
app.post('/api/settings/deepgram-key', authenticate, async (req, res) => {
  const { key } = req.body;
  if (!key?.trim()) return res.status(400).json({ error: 'Key is required' });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', req.user.id).single();
  if (profile?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  try {
    const envPath = new URL('.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('DEEPGRAM_API_KEY=')) {
      envContent = envContent.replace(/^DEEPGRAM_API_KEY=.*/m, `DEEPGRAM_API_KEY=${key.trim()}`);
    } else {
      envContent += `\nDEEPGRAM_API_KEY=${key.trim()}\n`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');
    process.env.DEEPGRAM_API_KEY = key.trim();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/ai-prompt — get current AI summary prompt
app.get('/api/settings/ai-prompt', authenticate, (req, res) => {
  res.json({
    prompt: process.env.AI_SUMMARY_PROMPT ||
      'You are a professional meeting assistant. Given the following transcript, provide a concise summary covering: key topics discussed, decisions made, and any important context. Be clear and professional.'
  });
});

// POST /api/settings/ai-prompt — update AI summary prompt (admin only)
app.post('/api/settings/ai-prompt', authenticate, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt?.trim()) return res.status(400).json({ error: 'Prompt is required' });

  // Check admin role
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', req.user.id).single();
  if (profile?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  // Write to .env file at runtime (simple approach for local dev)
  try {
    const envPath = new URL('.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('AI_SUMMARY_PROMPT=')) {
      envContent = envContent.replace(/^AI_SUMMARY_PROMPT=.*/m, `AI_SUMMARY_PROMPT=${prompt.trim()}`);
    } else {
      envContent += `\nAI_SUMMARY_PROMPT=${prompt.trim()}\n`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');
    process.env.AI_SUMMARY_PROMPT = prompt.trim();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  // Only serve index.html for non-API routes
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Test database connection
async function testConnection() {
  try {
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    if (error) throw error;
    console.log('✅ Database connection established');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║           FileFlow API Server                      ║
╠════════════════════════════════════════════════════╣
║  Port: ${PORT}                                        ║
║  URL:  http://localhost:${PORT}                       ║
╚════════════════════════════════════════════════════╝
  `);
  testConnection();
});
