/**
 * Email API Routes
 * Endpoints for testing and managing email functionality
 */

import express from 'express';
import emailService from '../services/email.js';

const router = express.Router();

/**
 * GET /api/email/config
 * Get email configuration status
 */
router.get('/config', async (req, res) => {
  const isConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER);

  res.json({
    configured: isConfigured,
    host: process.env.SMTP_HOST || null,
    port: process.env.SMTP_PORT || null,
    from: process.env.SMTP_FROM || null,
    user: process.env.SMTP_USER ? process.env.SMTP_USER.replace(/(.{3}).*(@.*)/, '$1***$2') : null
  });
});

/**
 * POST /api/email/verify
 * Verify SMTP configuration
 */
router.post('/verify', async (req, res) => {
  try {
    const result = await emailService.verifyEmailConfig();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/email/test
 * Send a test email
 */
router.post('/test', async (req, res) => {
  try {
    const { to } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }

    const result = await emailService.sendEmail({
      to,
      subject: 'FileFlow Test Email',
      text: 'This is a test email from FileFlow. If you received this, your email configuration is working correctly!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">FileFlow Test Email</h2>
          <p>This is a test email from FileFlow.</p>
          <p>If you received this, your email configuration is working correctly! ✅</p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px;">Sent from FileFlow Email Service</p>
          </div>
        </div>
      `
    });

    res.json(result);
  } catch (error) {
    console.error('Test email failed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
