// src/services/email.js
// Nodemailer transporter factory, professional HTML template builder,
// and proposal email dispatcher.
//
// Design notes:
//  • buildEmailHtml() is a pure function — no I/O, fully unit-testable.
//  • sendProposalEmail() accepts an optional `transporterFactory` so tests
//    can inject a nodemailer stub without touching real SMTP.
//  • The transport is always closed in a finally block after sending.

import nodemailer from 'nodemailer';
import { decrypt } from '../utils/crypto.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT          = process.env.PORT          || 3000;
const FRONTEND_PORT = process.env.FRONTEND_PORT || 5173;
// Backend URL — used for one-click action links (GET routes that render HTML).
const APP_URL      = process.env.APP_URL      || `http://localhost:${PORT}`;
// Frontend URL — used for the feedback page (SPA route with a form).
const FRONTEND_URL = process.env.FRONTEND_URL || `http://localhost:${FRONTEND_PORT}`;

// ── Transporter factory ───────────────────────────────────────────────────────

/**
 * Build a Nodemailer transporter from a tenant's stored, encrypted SMTP config.
 * Throws if no SMTP settings have been configured.
 *
 * @param {object} tenantDB - Open SQLite handle for the tenant's database.
 * @returns {Promise<import('nodemailer').Transporter>}
 */
export async function getTransporter(tenantDB) {
  const settings = await tenantDB.get('SELECT * FROM email_settings LIMIT 1');
  if (!settings) {
    throw new Error('SMTP settings not configured for this tenant. Configure them at POST /api/settings/smtp.');
  }

  const password = decrypt(settings.smtp_password_encrypted);

  return nodemailer.createTransport({
    host:   settings.smtp_host,
    port:   Number(settings.smtp_port),
    secure: Number(settings.smtp_port) === 465,
    auth:   { user: settings.smtp_user, pass: password }
  });
}

// ── HTML template ─────────────────────────────────────────────────────────────

/**
 * Build the proposal email HTML body.
 * All CSS is inlined for maximum email-client compatibility.
 *
 * @param {object} proposal - Proposal row (hash_token, customer_name, customer_email,
 *                            customer_phone, line_items JSON string, total).
 * @param {{ acceptUrl: string, feedbackUrl: string, denyUrl: string }} urls
 * @returns {string} Complete HTML document string.
 */
export function buildEmailHtml(proposal, { acceptUrl, feedbackUrl, denyUrl }) {
  const lineItems = JSON.parse(proposal.line_items || '[]');

  const itemRowsHtml = lineItems.length
    ? lineItems.map(item => {
        const qty      = Number(item.quantity)     || 0;
        const price    = Number(item.custom_price) || 0;
        const subtotal = qty * price;
        return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;">${escHtml(item.item_name || '')}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#6b7280;">${escHtml(item.description || '')}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:center;">${qty}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:right;">$${price.toFixed(2)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:right;font-weight:600;">$${subtotal.toFixed(2)}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="5" style="padding:16px;text-align:center;color:#9ca3af;font-size:14px;">No line items</td></tr>`;

  const total = Number(proposal.total) || 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your OmniQuote Proposal</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#1e293b;padding:28px 32px;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">OmniQuote</p>
            <p style="margin:6px 0 0;font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Commercial Proposal</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:28px 32px 16px;">
            <p style="margin:0;font-size:16px;color:#111827;">Hello <strong>${escHtml(proposal.customer_name || 'Valued Customer')}</strong>,</p>
            <p style="margin:12px 0 0;font-size:14px;color:#4b5563;line-height:1.6;">
              Please find your customised quote below. Review the details and use the action buttons at the bottom of this email to let us know how you'd like to proceed.
            </p>
            ${proposal.customer_email ? `<p style="margin:4px 0 0;font-size:13px;color:#9ca3af;">Contact: ${escHtml(proposal.customer_email)}${proposal.customer_phone ? ' · ' + escHtml(proposal.customer_phone) : ''}</p>` : ''}
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;"></td></tr>

        <!-- Line items -->
        <tr>
          <td style="padding:20px 32px;">
            <p style="margin:0 0 12px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#6b7280;">Quote Details</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:700;text-transform:uppercase;color:#6b7280;letter-spacing:0.5px;border-bottom:2px solid #e5e7eb;">Item</th>
                  <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:700;text-transform:uppercase;color:#6b7280;letter-spacing:0.5px;border-bottom:2px solid #e5e7eb;">Description</th>
                  <th style="padding:10px 12px;text-align:center;font-size:12px;font-weight:700;text-transform:uppercase;color:#6b7280;letter-spacing:0.5px;border-bottom:2px solid #e5e7eb;">Qty</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;font-weight:700;text-transform:uppercase;color:#6b7280;letter-spacing:0.5px;border-bottom:2px solid #e5e7eb;">Unit Price</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;font-weight:700;text-transform:uppercase;color:#6b7280;letter-spacing:0.5px;border-bottom:2px solid #e5e7eb;">Subtotal</th>
                </tr>
              </thead>
              <tbody>${itemRowsHtml}</tbody>
            </table>

            <!-- Total -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;">
              <tr>
                <td style="padding:12px 12px;text-align:right;font-size:18px;font-weight:700;color:#1e293b;border-top:2px solid #1e293b;">
                  Total: $${total.toFixed(2)}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;"></td></tr>

        <!-- CTA buttons -->
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 16px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#6b7280;">Your Response</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <!-- Review & Accept -->
                <td style="padding-right:12px;">
                  <a href="${escHtml(acceptUrl)}"
                     style="display:inline-block;padding:12px 22px;background:#16a34a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;border-radius:6px;letter-spacing:0.3px;">
                    ✓ Review &amp; Accept
                  </a>
                </td>
                <!-- Request Changes -->
                <td style="padding-right:12px;">
                  <a href="${escHtml(feedbackUrl)}"
                     style="display:inline-block;padding:12px 22px;background:#d97706;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;border-radius:6px;letter-spacing:0.3px;">
                    ✎ Request Changes
                  </a>
                </td>
                <!-- Decline -->
                <td>
                  <a href="${escHtml(denyUrl)}"
                     style="display:inline-block;padding:12px 22px;background:#dc2626;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;border-radius:6px;letter-spacing:0.3px;">
                    ✕ Decline
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">
              Clicking "Review &amp; Accept" or "Decline" will record your response immediately.
              "Request Changes" opens a form where you can share your notes.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
              This proposal was sent via <strong>OmniQuote</strong>. If you did not request this, you can safely ignore this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;
}

// ── Mailer ────────────────────────────────────────────────────────────────────

/**
 * Send the proposal email to the customer.
 *
 * The transport is always closed (transporter.close()) in a finally block,
 * regardless of whether sendMail succeeds or throws.
 *
 * @param {object}   tenantDB           - Open SQLite handle for the tenant's DB.
 * @param {object}   proposal           - Proposal row.
 * @param {object}   [options]
 * @param {function} [options.transporterFactory] - Override for testing. Receives
 *                                                  tenantDB and returns a transporter.
 *                                                  Defaults to getTransporter.
 * @returns {Promise<object>} Nodemailer send result ({ messageId, accepted, rejected }).
 */
export async function sendProposalEmail(tenantDB, proposal, { transporterFactory = getTransporter } = {}) {
  if (!proposal.customer_email) {
    throw new Error('Proposal has no customer_email — cannot send.');
  }

  const settings    = await tenantDB.get('SELECT * FROM email_settings LIMIT 1');
  const transporter = await transporterFactory(tenantDB);

  // Build the three action URLs.
  const acceptUrl   = `${APP_URL}/proposal/${proposal.hash_token}/accept`;
  const denyUrl     = `${APP_URL}/proposal/${proposal.hash_token}/deny`;
  const feedbackUrl = `${FRONTEND_URL}/proposal/${proposal.hash_token}/feedback`;

  const html = buildEmailHtml(proposal, { acceptUrl, feedbackUrl, denyUrl });

  try {
    const result = await transporter.sendMail({
      from:    settings?.from_name
                 ? `"${settings.from_name}" <${settings.smtp_user}>`
                 : settings?.smtp_user,
      to:      proposal.customer_email,
      subject: `Your Quote from OmniQuote — Ref #${proposal.hash_token.slice(0, 8).toUpperCase()}`,
      html
    });

    return {
      messageId: result.messageId,
      accepted:  result.accepted  ?? [],
      rejected:  result.rejected  ?? []
    };
  } finally {
    // Always release the SMTP connection pool.
    transporter.close();
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

/** Escape a string for safe HTML interpolation. */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
