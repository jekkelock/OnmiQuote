// src/routes/settings.js
// Protected SMTP settings routes for the authenticated tenant.
// Mount point: /api/settings  →  full paths: GET/POST /api/settings/smtp

import express from 'express';
import nodemailer from 'nodemailer';
import { authenticate } from '../middleware/auth.js';
import { attachTenantDB, cleanupTenant } from '../middleware/tenant.js';
import { encrypt } from '../utils/crypto.js';  // ← from the dedicated crypto util

const router = express.Router();

// All settings routes require a valid JWT and a resolved tenant DB.
router.use(authenticate);
router.use(attachTenantDB);
router.use(cleanupTenant);

// ── GET /api/settings/smtp ──────────────────────────────────────────────────
// Returns the tenant's stored SMTP config. Never returns the password.
router.get('/smtp', async (req, res) => {
  try {
    const settings = await req.db.get(
      'SELECT id, smtp_host, smtp_port, smtp_user, from_name, created_at, updated_at FROM email_settings LIMIT 1'
    );

    if (!settings) {
      return res.status(404).json({ error: 'SMTP settings not configured' });
    }

    res.json({ settings });
  } catch (err) {
    console.error('[settings] SMTP fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch SMTP settings' });
  }
});

// ── POST /api/settings/smtp ─────────────────────────────────────────────────
// Upserts the tenant's SMTP config. If smtp_password is omitted on an update,
// the existing encrypted password is preserved.
router.post('/smtp', async (req, res) => {
  try {
    const { smtp_host, smtp_port, smtp_user, smtp_password, from_name } = req.body;

    if (!smtp_host || !smtp_port || !smtp_user) {
      return res.status(400).json({
        error: 'smtp_host, smtp_port, and smtp_user are required'
      });
    }

    const existing = await req.db.get(
      'SELECT id, smtp_password_encrypted FROM email_settings LIMIT 1'
    );

    // Encrypt new password if provided; fall back to the stored one.
    if (!smtp_password && !existing?.smtp_password_encrypted) {
      return res.status(400).json({ error: 'smtp_password is required for initial setup' });
    }
    const encryptedPassword = smtp_password
      ? encrypt(smtp_password)
      : existing.smtp_password_encrypted;

    if (existing) {
      await req.db.run(
        `UPDATE email_settings
            SET smtp_host = ?, smtp_port = ?, smtp_user = ?,
                smtp_password_encrypted = ?, from_name = ?,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [smtp_host, Number(smtp_port), smtp_user, encryptedPassword, from_name ?? null, existing.id]
      );
    } else {
      await req.db.run(
        `INSERT INTO email_settings
           (smtp_host, smtp_port, smtp_user, smtp_password_encrypted, from_name)
         VALUES (?, ?, ?, ?, ?)`,
        [smtp_host, Number(smtp_port), smtp_user, encryptedPassword, from_name ?? null]
      );
    }

    const settings = await req.db.get(
      'SELECT id, smtp_host, smtp_port, smtp_user, from_name, created_at, updated_at FROM email_settings LIMIT 1'
    );

    res.json({ settings });
  } catch (err) {
    console.error('[settings] SMTP save error:', err);
    res.status(500).json({ error: 'Failed to save SMTP settings' });
  }
});

// ── POST /api/settings/smtp/test ────────────────────────────────────────────
// Verifies a live SMTP connection and sends a test email to the configured
// user address. Accepts credentials in the request body so the frontend can
// test before saving.
router.post('/smtp/test', async (req, res) => {
  try {
    const { smtp_host, smtp_port, smtp_user, smtp_password, from_name } = req.body;

    if (!smtp_host || !smtp_port || !smtp_user || !smtp_password) {
      return res.status(400).json({ error: 'smtp_host, smtp_port, smtp_user, and smtp_password are required' });
    }

    const transporter = nodemailer.createTransport({
      host:   smtp_host,
      port:   Number(smtp_port),
      secure: Number(smtp_port) === 465,
      auth:   { user: smtp_user, pass: smtp_password }
    });

    await transporter.verify();
    await transporter.sendMail({
      from:    from_name || smtp_user,
      to:      smtp_user,
      subject: 'OmniQuote — SMTP Connection Test',
      text:    'Your SMTP configuration is working correctly. Proposals can now be sent from OmniQuote.'
    });

    res.json({ message: 'SMTP connection verified and test email sent' });
  } catch (err) {
    console.error('[settings] SMTP test error:', err);
    res.status(500).json({ error: 'SMTP connection failed: ' + err.message });
  }
});

// ── GET /api/settings/general ───────────────────────────────────────────────
// Returns the tenant's company profile settings.
router.get('/general', async (req, res) => {
  try {
    const settings = await req.db.get(
      'SELECT * FROM settings_general WHERE id = 1 LIMIT 1'
    );

    const defaults = {
      company_name: '',
      company_email: '',
      company_phone: '',
      company_address: '',
      currency: 'EUR',
      primary_color: '#3B82F6',
      logo_url: ''
    };

    res.json({ settings: settings || defaults });
  } catch (err) {
    console.error('[settings] General fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch general settings' });
  }
});

// ── POST /api/settings/general ──────────────────────────────────────────────
// Upserts the tenant's company profile settings.
router.post('/general', async (req, res) => {
  try {
    const { company_name, company_email, company_phone, company_address, currency, primary_color, logo_url } = req.body;

    const existing = await req.db.get('SELECT id FROM settings_general WHERE id = 1 LIMIT 1');

    if (existing) {
      await req.db.run(
        `UPDATE settings_general
            SET company_name = ?, company_email = ?, company_phone = ?,
                company_address = ?, currency = ?, primary_color = ?, logo_url = ?,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = 1`,
        [company_name, company_email, company_phone, company_address, currency, primary_color, logo_url]
      );
    } else {
      await req.db.run(
        `INSERT INTO settings_general
           (id, company_name, company_email, company_phone, company_address, currency, primary_color, logo_url)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
        [company_name, company_email, company_phone, company_address, currency, primary_color, logo_url]
      );
    }

    const settings = await req.db.get('SELECT * FROM settings_general WHERE id = 1 LIMIT 1');
    res.json({ settings });
  } catch (err) {
    console.error('[settings] General save error:', err);
    res.status(500).json({ error: 'Failed to save general settings' });
  }
});

export default router;
