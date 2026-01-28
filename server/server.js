import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
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
    const { data, error } = await supabase.auth.signUp({
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
// HEALTH CHECK
// ============================================================================

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'fileflow-api', version: '2.0.0' });
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
