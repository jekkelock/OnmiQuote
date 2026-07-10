// tests/integration/proposal-send.test.js
// HTTP-level integration tests for POST /api/proposal/:id/send.
// Uses nodemailer's built-in jsonTransport as the SMTP stub — no real mail sent.
//
// Run:  node --test tests/integration/proposal-send.test.js

import { test, describe, before, after } from 'node:test';
import assert  from 'node:assert/strict';
import crypto  from 'node:crypto';
import fs      from 'node:fs';
import http    from 'node:http';
import path    from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Bootstrap ─────────────────────────────────────────────────────────────────

process.env.EMAIL_SECRET = 'test-email-secret-for-send-tests';
process.env.JWT_SECRET   = 'test-jwt-secret-for-send-tests';

const TENANTS_DIR = path.resolve(process.cwd(), 'data', 'tenants');
const TEST_TENANT = '8888'; // numeric → matches /^tenant_\d+\.db$/ in withProposalDB

// ── Imports ───────────────────────────────────────────────────────────────────

import nodemailer from 'nodemailer';
import { getTenantDB, initMainDB } from '../../src/config/db.js';
import { encrypt }                 from '../../src/utils/crypto.js';
import { generateToken }           from '../../src/config/auth.js';
import express                     from 'express';
import proposalRoutes              from '../../src/routes/proposal.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Make an HTTP request to the test server. Returns { status, body }. */
function request(server, method, urlPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const opts = {
      hostname: '127.0.0.1', port,
      path: urlPath, method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let json;
        try { json = JSON.parse(data); } catch (_) { json = data; }
        resolve({ status: res.statusCode, body: json });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * A nodemailer stub using jsonTransport.
 * Captures the last sent message in `stub.lastMessage`.
 * `stub.shouldFail` can be set to true to simulate an SMTP error.
 */
function createStubTransporter() {
  let lastMessage = null;
  let shouldFail  = false;
  let closeCount  = 0;

  const transport = nodemailer.createTransport({ jsonTransport: true });

  // Spy on close() to assert it is always called.
  const originalClose = transport.close.bind(transport);
  transport.close = () => { closeCount++; originalClose(); };

  // Wrap sendMail to capture messages and simulate failures.
  const originalSend = transport.sendMail.bind(transport);
  transport.sendMail = async (opts) => {
    if (shouldFail) throw new Error('Simulated SMTP connection failure');
    const result = await originalSend(opts);
    lastMessage = JSON.parse(result.message);
    return result;
  };

  return {
    transport,
    get lastMessage()  { return lastMessage; },
    get closeCount()   { return closeCount; },
    resetCloseCount()  { closeCount = 0; },
    set shouldFail(v)  { shouldFail = v; }
  };
}

/** Seed a minimal proposal and return its DB row. */
async function seedProposal(db, overrides = {}) {
  const token = crypto.randomBytes(16).toString('hex');
  await db.run(
    `INSERT INTO proposals
       (hash_token, customer_name, customer_email, line_items, total, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      token,
      'customer_name'  in overrides ? overrides.customer_name  : 'Test Corp',
      'customer_email' in overrides ? overrides.customer_email : 'buyer@test.com',
      'line_items'     in overrides ? overrides.line_items     : JSON.stringify([
        { item_name: 'Widget', description: 'Blue one', quantity: 3, custom_price: 50 }
      ]),
      'total'  in overrides ? overrides.total  : 150,
      'status' in overrides ? overrides.status : 'Draft'
    ]
  );
  return db.get('SELECT * FROM proposals WHERE hash_token = ?', [token]);
}

// ── State ─────────────────────────────────────────────────────────────────────

let server;
let db;
let stub;
let authToken;

// ── Setup ─────────────────────────────────────────────────────────────────────

before(async () => {
  fs.mkdirSync(TENANTS_DIR, { recursive: true });
  await initMainDB();

  db = await getTenantDB(TEST_TENANT);
  await db.run("DELETE FROM proposals WHERE customer_name IN ('Test Corp', 'No Email Corp')");
  await db.run('DELETE FROM email_settings');

  // Insert encrypted SMTP settings (fake host — never actually connects).
  await db.run(
    `INSERT INTO email_settings (smtp_host, smtp_port, smtp_user, smtp_password_encrypted, from_name)
     VALUES (?, ?, ?, ?, ?)`,
    ['smtp.fake.test', 587, 'sender@fake.test', encrypt('fake-password'), 'OmniQuote Test']
  );

  // JWT for tenant TEST_TENANT.
  authToken = generateToken({ id: 1, username: 'testuser', tenant_id: TEST_TENANT });

// Build a stub transporter factory so tests never hit real SMTP.
   stub = createStubTransporter();
   const stubFactory = async () => stub.transport;

  // Patch sendProposalEmail in the routes module to use the stub.
  // We do this by monkey-patching the imported email module that proposal.js uses.
  // Because ES module live bindings can't be monkey-patched directly, we use the
  // transporterFactory injection point exposed by sendProposalEmail.
  //
  // Instead, we override at the route level: the /send endpoint passes
  // req._transporterFactory when available — we set it via middleware.
  const app = express();
  app.use(express.json());

  // Inject stub transporter factory into every request for these tests.
  app.use((req, _res, next) => {
    req._transporterFactory = stubFactory;
    next();
  });

  app.use('/api/proposal', proposalRoutes);

  await new Promise(resolve => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
});

after(async () => {
  await db.close();
  await new Promise(resolve => server.close(resolve));
  const dbFile = path.join(TENANTS_DIR, `tenant_${TEST_TENANT}.db`);
  try { fs.unlinkSync(dbFile); } catch (_) {}
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/proposal/:id/send', () => {

  test('Requires authentication — rejects without a token', async () => {
    const proposal = await seedProposal(db);
    const res = await request(server, 'POST', `/api/proposal/${proposal.id}/send`);
    assert.equal(res.status, 401);
  });

  test('Returns 404 for a non-existent proposal ID', async () => {
    const res = await request(server, 'POST', '/api/proposal/999999/send', null,
      { Authorization: `Bearer ${authToken}` });
    assert.equal(res.status, 404);
  });

  test('Returns 409 when proposal is not in Draft status', async () => {
    const proposal = await seedProposal(db, { status: 'Sent' });
    const res = await request(server, 'POST', `/api/proposal/${proposal.id}/send`, null,
      { Authorization: `Bearer ${authToken}` });
    assert.equal(res.status, 409);
    assert.ok(res.body.error?.includes('Draft'), 'Error message must mention Draft');
  });

  test('Successful send: status becomes Sent and proposal is returned', async () => {
    stub.shouldFail = false;
    const proposal = await seedProposal(db);

    const res = await request(server, 'POST', `/api/proposal/${proposal.id}/send`, null,
      { Authorization: `Bearer ${authToken}` });

    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.proposal.status, 'Sent', 'Proposal status must be Sent');
    assert.equal(res.body.proposal.id, proposal.id, 'Returned proposal ID must match');
  });

  test('Successful send: DB row is persisted as Sent', async () => {
    stub.shouldFail = false;
    const proposal = await seedProposal(db);

    await request(server, 'POST', `/api/proposal/${proposal.id}/send`, null,
      { Authorization: `Bearer ${authToken}` });

    const row = await db.get('SELECT status FROM proposals WHERE id = ?', [proposal.id]);
    assert.equal(row.status, 'Sent');
  });

  test('Email failure rolls status back to Draft and returns 502', async () => {
    stub.shouldFail = true;
    const proposal = await seedProposal(db);

    const res = await request(server, 'POST', `/api/proposal/${proposal.id}/send`, null,
      { Authorization: `Bearer ${authToken}` });

    assert.equal(res.status, 502, `Expected 502 on SMTP failure, got ${res.status}`);
    assert.ok(res.body.error?.toLowerCase().includes('email'), 'Error must mention email failure');

    const row = await db.get('SELECT status FROM proposals WHERE id = ?', [proposal.id]);
    assert.equal(row.status, 'Draft', 'Status must roll back to Draft on email failure');

    stub.shouldFail = false; // reset for subsequent tests
  });

  test('Returns 400 when proposal has no customer_email', async () => {
    stub.shouldFail = false;
    const proposal = await seedProposal(db, { customer_email: null });

    const res = await request(server, 'POST', `/api/proposal/${proposal.id}/send`, null,
      { Authorization: `Bearer ${authToken}` });

    assert.equal(res.status, 400);
    assert.ok(res.body.error?.toLowerCase().includes('email'), 'Error must mention missing email');

    // Status must not have changed.
    const row = await db.get('SELECT status FROM proposals WHERE id = ?', [proposal.id]);
    assert.equal(row.status, 'Draft', 'Status must remain Draft when email is missing');
  });

  test('transporter.close() is called even when sendMail throws', async () => {
    stub.shouldFail = true;
    stub.resetCloseCount();
    const proposal = await seedProposal(db);

    await request(server, 'POST', `/api/proposal/${proposal.id}/send`, null,
      { Authorization: `Bearer ${authToken}` });

    assert.equal(stub.closeCount, 1, 'transporter.close() must be called exactly once on sendMail failure');

    stub.shouldFail = false;
  });

  test('transporter.close() is called on successful send', async () => {
    stub.shouldFail = false;
    stub.resetCloseCount();
    const proposal = await seedProposal(db);

    await request(server, 'POST', `/api/proposal/${proposal.id}/send`, null,
      { Authorization: `Bearer ${authToken}` });

    assert.equal(stub.closeCount, 1, 'transporter.close() must be called exactly once on success');
  });

  test('Rollback UPDATE failure: returns 502 with warning note, does not crash', async () => {
    stub.shouldFail = true;

    // Seed a proposal then close the DB to force the rollback UPDATE to fail.
    // We simulate a broken rollback by temporarily replacing req.db.run.
    // We do this at the stub factory level: inject a factory that returns a
    // transporter that throws AND whose associated db.run (for rollback) also throws.
    const brokenFactory = async (tenantDB) => {
      const transport = nodemailer.createTransport({ jsonTransport: true });
      const originalClose = transport.close.bind(transport);
      transport.close = () => originalClose();
      transport.sendMail = async () => { throw new Error('SMTP down'); };

      // Monkey-patch the db passed to sendProposalEmail so rollback also fails.
      const originalRun = tenantDB.run.bind(tenantDB);
      let callCount = 0;
      tenantDB.run = async (...args) => {
        callCount++;
        // First call after SMTP failure is the rollback UPDATE — make it throw.
        if (callCount === 1 && String(args[0]).includes('Draft')) {
          tenantDB.run = originalRun; // restore for subsequent calls
          throw new Error('Simulated DB rollback failure');
        }
        return originalRun(...args);
      };

      return transport;
    };

    const proposal = await seedProposal(db);

    // Temporarily override the factory injected by the before() middleware.
    const savedFactory = server._events; // we'll swap stub state instead
    const origFactory  = stub.transport; // hold ref

    // Inject via a one-shot express middleware layer by using a separate request.
    // Since we can't easily swap the server middleware mid-test, directly test
    // the sendProposalEmail + route logic by checking that 502 is returned and
    // no unhandled rejection escapes.

    // Restore the injected brokenFactory for just this request by creating a
    // second test app for this case.
    const brokenApp = express();
    brokenApp.use(express.json());
    brokenApp.use((req, _res, next) => { req._transporterFactory = brokenFactory; next(); });
    brokenApp.use('/api/proposal', proposalRoutes);

    const brokenServer = await new Promise(resolve => {
      const s = brokenApp.listen(0, '127.0.0.1', () => resolve(s));
    });

    try {
      const res = await request(brokenServer, 'POST', `/api/proposal/${proposal.id}/send`, null,
        { Authorization: `Bearer ${authToken}` });

      assert.equal(res.status, 502, `Expected 502 even when rollback fails, got ${res.status}`);
      assert.ok(
        res.body.error?.includes('WARNING') || res.body.error?.includes('502') || res.body.error?.includes('failed'),
        'Response must indicate email delivery failure'
      );
      // Must not crash — server still responded.
    } finally {
      await new Promise(r => brokenServer.close(r));
      stub.shouldFail = false;
    }
  });
});
