// src/routes/proposal.js
// Public lifecycle routes (no auth) + protected CRUD routes (auth required).
//
// Public mount points (server.js):
//   app.use('/api/proposal', proposalRoutes)
//   app.use('/proposal',     proposalRoutes)   ← for email-link clicks
//
// Proposal status lifecycle:
//   Draft → Sent → Viewed → Accepted | Denied | Revision Requested

import express from 'express';
import crypto  from 'crypto';
import fs      from 'fs';
import path    from 'path';
import { fileURLToPath } from 'url';

import { authenticate }                from '../middleware/auth.js';
import { attachTenantDB, cleanupTenant } from '../middleware/tenant.js';
import { getTenantDB }                 from '../config/db.js';
import { sendProposalEmail }           from '../services/email.js';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const TENANTS_DIR = path.resolve(process.cwd(), 'data', 'tenants');
const FRONTEND_URL = process.env.FRONTEND_URL || `http://localhost:${process.env.FRONTEND_PORT || 5173}`;

const router = express.Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Generates a cryptographically random 32-char hex token. */
function generateHashToken() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Scans every tenant_[id].db file, finds the proposal matching hashToken,
 * then calls `fn(db, proposal)` inside a guaranteed-close block.
 *
 * Usage:
 *   const result = await withProposalDB(token, async (db, proposal) => { ... });
 *   if (result === null) { // not found }
 *
 * @template T
 * @param {string}   hashToken
 * @param {function} fn  — async (db, proposal) => T
 * @returns {Promise<T | null>}  null when not found
 */
async function withProposalDB(hashToken, fn) {
  if (!fs.existsSync(TENANTS_DIR)) return null;

  const files = fs.readdirSync(TENANTS_DIR)
    .filter(f => /^tenant_\d+\.db$/.test(f));

  for (const file of files) {
    const match = file.match(/^tenant_(\d+)\.db$/);
    if (!match) continue;
    const tenantId = match[1];

    let db;
    try {
      // getTenantDB applies WAL mode and schema migrations.
      db = await getTenantDB(tenantId);
      const proposal = await db.get(
        'SELECT * FROM proposals WHERE hash_token = ?',
        [hashToken]
      );

      if (proposal) {
        try {
          return await fn(db, proposal, tenantId);
        } finally {
          // Always close, even if fn() throws.
          try { await db.close(); } catch (_) {}
        }
      }

      await db.close();
    } catch (err) {
      // Tenant DB may be uninitialised or corrupt — skip and close.
      if (db) try { await db.close(); } catch (_) {}
    }
  }

  return null; // not found in any tenant
}

// ── Public routes (no authentication required) ───────────────────────────────

// GET /api/proposal/:hash_token  (also reachable at /proposal/:hash_token)
// Crucial: auto-promotes status Draft|Sent → Viewed before serving.
router.get('/:hash_token', async (req, res) => {
  try {
    const hash    = req.params.hash_token;
    let   payload = null;

    const found = await withProposalDB(hash, async (db, proposal) => {
      if (proposal.status === 'Draft' || proposal.status === 'Sent') {
        await db.run(
          'UPDATE proposals SET status = ?, viewed_at = CURRENT_TIMESTAMP WHERE hash_token = ?',
          ['Viewed', hash]
        );
        proposal.status    = 'Viewed';
        proposal.viewed_at = new Date().toISOString();
      }
      return proposal;
    });

    if (found === null) return res.status(404).json({ error: 'Proposal not found' });

    res.json({ proposal: found });
  } catch (err) {
    console.error('[proposal] public GET error:', err);
    res.status(500).json({ error: 'Failed to fetch proposal' });
  }
});

// POST /api/proposal/:hash_token/accept
router.post('/:hash_token/accept', async (req, res) => {
  try {
    const hash  = req.params.hash_token;
    const found = await withProposalDB(hash, async (db) => {
      await db.run('UPDATE proposals SET status = ? WHERE hash_token = ?', ['Accepted', hash]);
      return true;
    });

    if (found === null) return res.status(404).json({ error: 'Proposal not found' });

    res.json({ message: 'Proposal accepted', status: 'Accepted' });
  } catch (err) {
    console.error('[proposal] accept error:', err);
    res.status(500).json({ error: 'Failed to accept proposal' });
  }
});

// POST /api/proposal/:hash_token/deny
router.post('/:hash_token/deny', async (req, res) => {
  try {
    const hash  = req.params.hash_token;
    const found = await withProposalDB(hash, async (db) => {
      await db.run('UPDATE proposals SET status = ? WHERE hash_token = ?', ['Denied', hash]);
      return true;
    });

    if (found === null) return res.status(404).json({ error: 'Proposal not found' });

    res.json({ message: 'Proposal denied', status: 'Denied' });
  } catch (err) {
    console.error('[proposal] deny error:', err);
    res.status(500).json({ error: 'Failed to deny proposal' });
  }
});

// POST /api/proposal/:hash_token/feedback
// Body: { feedback: string }   (customer negotiation notes)
// Sets status → 'Revision Requested' and appends to the feedback column.
router.post('/:hash_token/feedback', async (req, res) => {
  try {
    const { feedback } = req.body;

    if (!feedback || !String(feedback).trim()) {
      return res.status(400).json({ error: 'feedback field is required' });
    }

    const hash  = req.params.hash_token;
    const found = await withProposalDB(hash, async (db, proposal) => {
      const history = proposal.feedback ? JSON.parse(proposal.feedback) : [];
      history.push({ text: String(feedback).trim(), submitted_at: new Date().toISOString() });
      await db.run(
        'UPDATE proposals SET status = ?, feedback = ? WHERE hash_token = ?',
        ['Revision Requested', JSON.stringify(history), hash]
      );
      return true;
    });

    if (found === null) return res.status(404).json({ error: 'Proposal not found' });

    res.json({ message: 'Feedback submitted', status: 'Revision Requested' });
  } catch (err) {
    console.error('[proposal] feedback error:', err);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// GET /:hash_token/accept  ── email-link click → renders a simple HTML page
router.get('/:hash_token/accept', async (req, res) => {
  const hash = req.params.hash_token;
  try {
    const found = await withProposalDB(hash, async (db) => {
      await db.run('UPDATE proposals SET status = ? WHERE hash_token = ?', ['Accepted', hash]);
      return true;
    });

    if (found === null) {
      return res.redirect(`${FRONTEND_URL}/proposal/${hash}?status=notfound`);
    }

    res.send(confirmationPage('Proposal Accepted', '#16a34a', '✓ Proposal Accepted', hash));
  } catch (err) {
    console.error('[proposal] GET accept error:', err);
    res.redirect(`${FRONTEND_URL}/proposal/${hash}?status=error`);
  }
});

// GET /:hash_token/deny  ── email-link click → renders a simple HTML page
router.get('/:hash_token/deny', async (req, res) => {
  const hash = req.params.hash_token;
  try {
    const found = await withProposalDB(hash, async (db) => {
      await db.run('UPDATE proposals SET status = ? WHERE hash_token = ?', ['Denied', hash]);
      return true;
    });

    if (found === null) {
      return res.redirect(`${FRONTEND_URL}/proposal/${hash}?status=notfound`);
    }

    res.send(confirmationPage('Proposal Denied', '#dc2626', '✗ Proposal Denied', hash));
  } catch (err) {
    console.error('[proposal] GET deny error:', err);
    res.redirect(`${FRONTEND_URL}/proposal/${hash}?status=error`);
  }
});

/** Minimal confirmation page for email-link clicks. */
function confirmationPage(title, color, heading, hash) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 540px; margin: 80px auto; padding: 24px; text-align: center; }
    h1   { color: ${color}; }
    a    { color: #2563eb; }
  </style>
</head>
<body>
  <h1>${heading}</h1>
  <p>Your response has been recorded.</p>
  <a href="${FRONTEND_URL}/proposal/${hash}">View proposal</a>
</body>
</html>`;
}

// ── Protected routes (JWT required) ──────────────────────────────────────────

const protectedRouter = express.Router();
protectedRouter.use(authenticate);
protectedRouter.use(attachTenantDB);
protectedRouter.use(cleanupTenant);

// GET /api/proposal  — list all proposals for the tenant
protectedRouter.get('/', async (req, res) => {
  try {
    const proposals = await req.db.all(
      'SELECT * FROM proposals ORDER BY created_at DESC'
    );
    res.json({ proposals });
  } catch (err) {
    console.error('[proposal] list error:', err);
    res.status(500).json({ error: 'Failed to fetch proposals' });
  }
});

// GET /api/proposal/:id  — fetch single proposal by numeric ID (tenant-scoped)
protectedRouter.get('/:id(\\d+)', async (req, res) => {
  try {
    const proposal = await req.db.get(
      'SELECT * FROM proposals WHERE id = ?', [req.params.id]
    );
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    res.json({ proposal });
  } catch (err) {
    console.error('[proposal] get error:', err);
    res.status(500).json({ error: 'Failed to fetch proposal' });
  }
});

// POST /api/proposal  — create a new Draft proposal
protectedRouter.post('/', async (req, res) => {
  try {
    const { customer_name, customer_email, customer_phone, line_items, total } = req.body;

    if (!line_items || total === undefined) {
      return res.status(400).json({ error: 'line_items and total are required' });
    }

    const hash_token = generateHashToken();

    const result = await req.db.run(
      `INSERT INTO proposals
         (hash_token, customer_name, customer_email, customer_phone, line_items, total, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Draft')`,
      [hash_token, customer_name ?? null, customer_email ?? null, customer_phone ?? null,
       JSON.stringify(line_items), Number(total)]
    );

    const proposal = await req.db.get(
      'SELECT * FROM proposals WHERE id = ?', [result.lastID]
    );

    res.status(201).json({ proposal });
  } catch (err) {
    console.error('[proposal] create error:', err);
    res.status(500).json({ error: 'Failed to create proposal' });
  }
});

// POST /api/proposal/:id/send  — mark as Sent and email the customer
//
// On email failure: status is rolled back to Draft and 502 is returned.
// req._transporterFactory can be injected by tests to avoid real SMTP.
protectedRouter.post('/:id(\\d+)/send', async (req, res) => {
  try {
    const { id } = req.params;

    const proposal = await req.db.get(
      'SELECT * FROM proposals WHERE id = ?', [id]
    );

    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

    if (proposal.status !== 'Draft') {
      return res.status(409).json({
        error: `Cannot send a proposal with status '${proposal.status}'. Only Draft proposals can be sent.`
      });
    }

    if (!proposal.customer_email) {
      return res.status(400).json({ error: 'Proposal has no customer email address — cannot send.' });
    }

    // Promote to Sent before attempting delivery.
    await req.db.run('UPDATE proposals SET status = ? WHERE id = ?', ['Sent', id]);
    const updated = await req.db.get('SELECT * FROM proposals WHERE id = ?', [id]);

    try {
      // Pass an optional transporter factory override (used by integration tests).
      const opts = req._transporterFactory
        ? { transporterFactory: req._transporterFactory }
        : {};
      await sendProposalEmail(req.db, updated, opts);
    } catch (emailErr) {
      console.error('[proposal] email send error:', emailErr.message);

      // Best-effort rollback: customer never received the email, so revert to Draft.
      // The rollback is guarded independently — a rollback failure must not mask
      // the original email error or leave the caller without a response.
      let rollbackNote = '';
      try {
        await req.db.run('UPDATE proposals SET status = ? WHERE id = ?', ['Draft', id]);
      } catch (rollbackErr) {
        // Status is stuck as Sent even though email failed — requires manual intervention.
        console.error('[proposal] CRITICAL: rollback to Draft failed after email error:', rollbackErr.message);
        rollbackNote = ' WARNING: status rollback also failed — proposal may be stuck as Sent.';
      }

      return res.status(502).json({
        error: `Email delivery failed: ${emailErr.message}. Proposal status rolled back to Draft.${rollbackNote}`
      });
    }

    res.json({ proposal: updated });
  } catch (err) {
    console.error('[proposal] send error:', err);
    res.status(500).json({ error: 'Failed to send proposal' });
  }
});

// DELETE /api/proposal/:id  — remove a proposal
protectedRouter.delete('/:id(\\d+)', async (req, res) => {
  try {
    const result = await req.db.run(
      'DELETE FROM proposals WHERE id = ?', [req.params.id]
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Proposal not found' });
    res.json({ message: 'Proposal deleted' });
  } catch (err) {
    console.error('[proposal] delete error:', err);
    res.status(500).json({ error: 'Failed to delete proposal' });
  }
});

// Mount protected router on the same base (public routes registered first take priority)
router.use(protectedRouter);

export default router;
