// tests/integration/proposal-lifecycle.test.js
// HTTP-level status lifecycle validation for public proposal endpoints.
// Uses Node's built-in test runner (node:test) — no extra deps required.
//
// Run:  node --test tests/integration/proposal-lifecycle.test.js

import { test, describe, before, after } from 'node:test';
import assert  from 'node:assert/strict';
import crypto  from 'node:crypto';
import fs      from 'node:fs';
import http    from 'node:http';
import path    from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Bootstrap ─────────────────────────────────────────────────────────────────

process.env.EMAIL_SECRET = 'test-email-secret-for-lifecycle-tests';
process.env.JWT_SECRET   = 'test-jwt-secret-for-lifecycle-tests';

const TENANTS_DIR  = path.resolve(process.cwd(), 'data', 'tenants');
const TEST_TENANT  = '9999'; // numeric so tenant_9999.db matches /^tenant_\d+\.db$/ in withProposalDB

// ── Helpers ───────────────────────────────────────────────────────────────────

const { getTenantDB } = await import('../../src/config/db.js');

/** Seed a proposal row and return it. */
async function seedProposal(db, status = 'Draft', token = crypto.randomBytes(16).toString('hex')) {
  await db.run(
    `INSERT INTO proposals
       (hash_token, customer_name, customer_email, line_items, total, status)
     VALUES (?, 'Test Customer', 'test@example.com', '[]', 100.00, ?)`,
    [token, status]
  );
  return db.get('SELECT * FROM proposals WHERE hash_token = ?', [token]);
}

/** Make a fetch-style HTTP request to the test server. */
function request(server, method, urlPath, body = null) {
  return new Promise((resolve, reject) => {
    const addr   = server.address();
    const port   = addr.port;
    const opts   = {
      hostname: '127.0.0.1',
      port,
      path:     urlPath,
      method,
      headers:  { 'Content-Type': 'application/json' }
    };

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json;
        try { json = JSON.parse(data); } catch (_) { json = data; }
        resolve({ status: res.statusCode, body: json, headers: res.headers });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── Spin up the Express app on a random port ──────────────────────────────────

// Import the full app (server.js) but without calling app.listen().
// We import just the express app by re-creating it from routes.
import express      from 'express';
import proposalRoutes from '../../src/routes/proposal.js';
import { initMainDB } from '../../src/config/db.js';

let server;
let db;       // direct DB handle for seeding / assertions

before(async () => {
  fs.mkdirSync(TENANTS_DIR, { recursive: true });
  await initMainDB();

  // Open a direct DB handle to the test tenant for seeding & assertions.
  db = await getTenantDB(TEST_TENANT);
  await db.run("DELETE FROM proposals WHERE customer_name = 'Test Customer'");

  const app = express();
  app.use(express.json());
  app.use('/api/proposal', proposalRoutes);
  app.use('/proposal',     proposalRoutes);  // mirror email-link mount

  // Start on a random free port.
  await new Promise(resolve => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
});

after(async () => {
  await db.close();
  await new Promise(resolve => server.close(resolve));
  // Remove test DB file.
  const dbFile = path.join(TENANTS_DIR, `tenant_${TEST_TENANT}.db`);
  try { fs.unlinkSync(dbFile); } catch (_) {}
});

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('GET /api/proposal/:hash_token — auto-view promotion', () => {

  test('Draft proposal → auto-promoted to Viewed, viewed_at set', async () => {
    const { hash_token } = await seedProposal(db, 'Draft');

    const res = await request(server, 'GET', `/api/proposal/${hash_token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.proposal.status,    'Viewed');
    assert.ok(res.body.proposal.viewed_at,   'viewed_at must be set');

    // Confirm persisted in DB.
    const row = await db.get('SELECT status FROM proposals WHERE hash_token = ?', [hash_token]);
    assert.equal(row.status, 'Viewed');
  });

  test('Sent proposal → auto-promoted to Viewed', async () => {
    const { hash_token } = await seedProposal(db, 'Sent');

    const res = await request(server, 'GET', `/api/proposal/${hash_token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.proposal.status, 'Viewed');
  });

  test('Already-Viewed proposal → status unchanged, viewed_at not reset', async () => {
    const { hash_token } = await seedProposal(db, 'Viewed');
    // Manually set a known viewed_at.
    await db.run(
      "UPDATE proposals SET viewed_at = '2025-01-01T00:00:00.000Z' WHERE hash_token = ?",
      [hash_token]
    );

    const res = await request(server, 'GET', `/api/proposal/${hash_token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.proposal.status, 'Viewed');

    const row = await db.get('SELECT viewed_at FROM proposals WHERE hash_token = ?', [hash_token]);
    assert.equal(row.viewed_at, '2025-01-01T00:00:00.000Z', 'viewed_at must not change');
  });

  test('Accepted proposal → NOT reverted to Viewed', async () => {
    const { hash_token } = await seedProposal(db, 'Accepted');

    const res = await request(server, 'GET', `/api/proposal/${hash_token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.proposal.status, 'Accepted', 'Accepted must not become Viewed');
  });

  test('Denied proposal → NOT reverted to Viewed', async () => {
    const { hash_token } = await seedProposal(db, 'Denied');

    const res = await request(server, 'GET', `/api/proposal/${hash_token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.proposal.status, 'Denied', 'Denied must not become Viewed');
  });

  test('"Revision Requested" proposal → NOT reverted to Viewed', async () => {
    const { hash_token } = await seedProposal(db, 'Revision Requested');

    const res = await request(server, 'GET', `/api/proposal/${hash_token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.proposal.status, 'Revision Requested');
  });

  test('Unknown token → 404', async () => {
    const res = await request(server, 'GET', '/api/proposal/nonexistenttoken000000000000000');
    assert.equal(res.status, 404);
  });
});

describe('POST /api/proposal/:hash_token/accept', () => {

  test('Accepts a Viewed proposal', async () => {
    const { hash_token } = await seedProposal(db, 'Viewed');

    const res = await request(server, 'POST', `/api/proposal/${hash_token}/accept`);

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'Accepted');

    const row = await db.get('SELECT status FROM proposals WHERE hash_token = ?', [hash_token]);
    assert.equal(row.status, 'Accepted');
  });

  test('Unknown token → 404', async () => {
    const res = await request(server, 'POST', '/api/proposal/nonexistenttoken000000000000000/accept');
    assert.equal(res.status, 404);
  });
});

describe('POST /api/proposal/:hash_token/deny', () => {

  test('Denies a Sent proposal', async () => {
    const { hash_token } = await seedProposal(db, 'Sent');

    const res = await request(server, 'POST', `/api/proposal/${hash_token}/deny`);

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'Denied');

    const row = await db.get('SELECT status FROM proposals WHERE hash_token = ?', [hash_token]);
    assert.equal(row.status, 'Denied');
  });

  test('Denies a Viewed proposal', async () => {
    const { hash_token } = await seedProposal(db, 'Viewed');

    const res = await request(server, 'POST', `/api/proposal/${hash_token}/deny`);

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'Denied');
  });

  test('Unknown token → 404', async () => {
    const res = await request(server, 'POST', '/api/proposal/nonexistenttoken000000000000000/deny');
    assert.equal(res.status, 404);
  });
});

describe('POST /api/proposal/:hash_token/feedback', () => {

  test('Sets status to "Revision Requested" (with space) and stores feedback', async () => {
    const { hash_token } = await seedProposal(db, 'Viewed');
    const note = 'Please reduce item 2 price.';

    const res = await request(server, 'POST', `/api/proposal/${hash_token}/feedback`, { feedback: note });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'Revision Requested');

    const row = await db.get('SELECT status, feedback FROM proposals WHERE hash_token = ?', [hash_token]);
    assert.equal(row.status, 'Revision Requested');
    assert.notEqual(row.status, 'RevisionRequested', 'must use space-separated form');

    const history = JSON.parse(row.feedback);
    assert.equal(history.length, 1);
    assert.equal(history[0].text, note);
    assert.ok(history[0].submitted_at);
  });

  test('Appends to existing feedback history', async () => {
    const { hash_token } = await seedProposal(db, 'Viewed');

    await request(server, 'POST', `/api/proposal/${hash_token}/feedback`, { feedback: 'Note 1' });
    await request(server, 'POST', `/api/proposal/${hash_token}/feedback`, { feedback: 'Note 2' });

    const row = await db.get('SELECT feedback FROM proposals WHERE hash_token = ?', [hash_token]);
    const history = JSON.parse(row.feedback);
    assert.equal(history.length, 2);
    assert.equal(history[0].text, 'Note 1');
    assert.equal(history[1].text, 'Note 2');
  });

  test('Missing feedback body → 400', async () => {
    const { hash_token } = await seedProposal(db, 'Viewed');

    const res = await request(server, 'POST', `/api/proposal/${hash_token}/feedback`, {});

    assert.equal(res.status, 400);
  });

  test('Blank feedback string → 400', async () => {
    const { hash_token } = await seedProposal(db, 'Viewed');

    const res = await request(server, 'POST', `/api/proposal/${hash_token}/feedback`, { feedback: '   ' });

    assert.equal(res.status, 400);
  });

  test('Unknown token → 404', async () => {
    const res = await request(server, 'POST', '/api/proposal/nonexistenttoken000000000000000/feedback', { feedback: 'x' });
    assert.equal(res.status, 404);
  });
});

describe('hash_token uniqueness', () => {
  test('Duplicate hash_token is rejected by the DB', async () => {
    const token = crypto.randomBytes(16).toString('hex');
    await seedProposal(db, 'Draft', token);

    await assert.rejects(
      () => seedProposal(db, 'Draft', token),
      /UNIQUE constraint failed/
    );
  });
});
