/**
 * Email Service
 * Handles sending emails via SMTP using nodemailer
 */

import nodemailer from 'nodemailer';

// Create reusable transporter
let transporter = null;

function getTransporter() {
  if (!transporter) {
    const config = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };

    // Add TLS options for Gmail and similar services
    if (config.port === 587) {
      config.tls = {
        ciphers: 'SSLv3',
        rejectUnauthorized: false
      };
    }

    transporter = nodemailer.createTransport(config);
  }
  return transporter;
}

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} options.html - HTML body (optional)
 * @param {Array} options.attachments - Attachments (optional)
 */
export async function sendEmail({ to, subject, text, html, attachments = [] }) {
  try {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      console.warn('SMTP not configured, skipping email send');
      return { success: false, message: 'SMTP not configured' };
    }

    const transport = getTransporter();

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html: html || text,
      attachments
    };

    const info = await transport.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

/**
 * Send welcome email to new user
 */
export async function sendWelcomeEmail(userEmail, userName) {
  const subject = 'Welcome to FileFlow!';
  const text = `Hi ${userName},\n\nWelcome to FileFlow! Your account has been created successfully.\n\nYou can now upload, manage, and share your files securely.\n\nBest regards,\nThe FileFlow Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #3b82f6;">Welcome to FileFlow!</h2>
      <p>Hi ${userName},</p>
      <p>Welcome to FileFlow! Your account has been created successfully.</p>
      <p>You can now upload, manage, and share your files securely.</p>
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px;">Best regards,<br/>The FileFlow Team</p>
      </div>
    </div>
  `;

  return sendEmail({ to: userEmail, subject, text, html });
}

/**
 * Send file share notification
 */
export async function sendFileShareEmail(recipientEmail, senderName, fileName, shareUrl) {
  const subject = `${senderName} shared a file with you`;
  const text = `Hi,\n\n${senderName} has shared "${fileName}" with you.\n\nClick the link below to access the file:\n${shareUrl}\n\nBest regards,\nThe FileFlow Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #3b82f6;">File Shared With You</h2>
      <p>Hi,</p>
      <p><strong>${senderName}</strong> has shared <strong>"${fileName}"</strong> with you.</p>
      <div style="margin: 30px 0;">
        <a href="${shareUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">
          Access File
        </a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">Or copy this link: ${shareUrl}</p>
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px;">Best regards,<br/>The FileFlow Team</p>
      </div>
    </div>
  `;

  return sendEmail({ to: recipientEmail, subject, text, html });
}

/**
 * Send document processing completion notification
 */
export async function sendProcessingCompleteEmail(userEmail, fileName, actionType) {
  const actionNames = {
    extract: 'Text Extraction',
    ocr: 'OCR Processing',
    translate: 'Translation'
  };

  const subject = `${actionNames[actionType] || 'Processing'} Complete - ${fileName}`;
  const text = `Hi,\n\nYour ${actionNames[actionType] || 'processing'} for "${fileName}" has completed successfully.\n\nYou can now view the results in FileFlow.\n\nBest regards,\nThe FileFlow Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #3b82f6;">${actionNames[actionType] || 'Processing'} Complete</h2>
      <p>Hi,</p>
      <p>Your ${actionNames[actionType] || 'processing'} for <strong>"${fileName}"</strong> has completed successfully.</p>
      <p>You can now view the results in FileFlow.</p>
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px;">Best regards,<br/>The FileFlow Team</p>
      </div>
    </div>
  `;

  return sendEmail({ to: userEmail, subject, text, html });
}

/**
 * Verify SMTP configuration
 */
export async function verifyEmailConfig() {
  try {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      return { success: false, message: 'SMTP not configured' };
    }

    const transport = getTransporter();
    await transport.verify();
    return { success: true, message: 'SMTP configuration is valid' };
  } catch (error) {
    console.error('SMTP verification failed:', error);
    return { success: false, message: error.message };
  }
}

export default {
  sendEmail,
  sendWelcomeEmail,
  sendFileShareEmail,
  sendProcessingCompleteEmail,
  verifyEmailConfig
};
