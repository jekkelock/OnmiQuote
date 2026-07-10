// tests/unit/email-template.test.js
// Pure unit tests for buildEmailHtml — no network, no DB, no external deps.
//
// Run:  node --test tests/unit/email-template.test.js

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

process.env.EMAIL_SECRET = 'test-email-secret';
process.env.JWT_SECRET   = 'test-jwt-secret';

const { buildEmailHtml } = await import('../../src/services/email.js');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const URLS = {
  acceptUrl:   'http://localhost:3000/proposal/abc123/accept',
  feedbackUrl: 'http://localhost:5173/proposal/abc123/feedback',
  denyUrl:     'http://localhost:3000/proposal/abc123/deny'
};

const BASE_PROPOSAL = {
  hash_token:     'abc123def456abc1',
  customer_name:  'Acme Corp',
  customer_email: 'buyer@acme.com',
  customer_phone: '+1 555 0100',
  line_items: JSON.stringify([
    { item_name: 'Consulting',  description: 'Strategy session', quantity: 2, custom_price: 500 },
    { item_name: 'Design Work', description: 'Brand refresh',    quantity: 1, custom_price: 1200 }
  ]),
  total: 2200
};

// ── URL injection ─────────────────────────────────────────────────────────────

describe('URL injection — three distinct tracking links', () => {
  test('Accept URL appears in the HTML', () => {
    const html = buildEmailHtml(BASE_PROPOSAL, URLS);
    assert.ok(html.includes(URLS.acceptUrl), 'Accept URL must be present');
  });

  test('Feedback (Request Changes) URL appears in the HTML', () => {
    const html = buildEmailHtml(BASE_PROPOSAL, URLS);
    assert.ok(html.includes(URLS.feedbackUrl), 'Feedback URL must be present');
  });

  test('Deny URL appears in the HTML', () => {
    const html = buildEmailHtml(BASE_PROPOSAL, URLS);
    assert.ok(html.includes(URLS.denyUrl), 'Deny URL must be present');
  });

  test('All three URLs are distinct', () => {
    assert.notEqual(URLS.acceptUrl,   URLS.feedbackUrl, 'Accept ≠ Feedback');
    assert.notEqual(URLS.acceptUrl,   URLS.denyUrl,     'Accept ≠ Deny');
    assert.notEqual(URLS.feedbackUrl, URLS.denyUrl,     'Feedback ≠ Deny');
  });

  test('"Review & Accept" button label is present', () => {
    const html = buildEmailHtml(BASE_PROPOSAL, URLS);
    assert.ok(
      html.includes('Review') && html.includes('Accept'),
      '"Review & Accept" label must appear'
    );
  });

  test('"Request Changes" button label is present', () => {
    const html = buildEmailHtml(BASE_PROPOSAL, URLS);
    assert.ok(html.includes('Request Changes'), '"Request Changes" label must appear');
  });

  test('"Decline" button label is present', () => {
    const html = buildEmailHtml(BASE_PROPOSAL, URLS);
    assert.ok(html.includes('Decline'), '"Decline" label must appear');
  });
});

// ── Customer details ──────────────────────────────────────────────────────────

describe('Customer details', () => {
  test('Customer name appears in the body', () => {
    const html = buildEmailHtml(BASE_PROPOSAL, URLS);
    assert.ok(html.includes('Acme Corp'), 'Customer name must appear');
  });

  test('Customer email appears in the body', () => {
    const html = buildEmailHtml(BASE_PROPOSAL, URLS);
    assert.ok(html.includes('buyer@acme.com'), 'Customer email must appear');
  });

  test('Customer phone appears when present', () => {
    const html = buildEmailHtml(BASE_PROPOSAL, URLS);
    assert.ok(html.includes('+1 555 0100'), 'Customer phone must appear');
  });

  test('Falls back to "Valued Customer" when customer_name is blank', () => {
    const html = buildEmailHtml({ ...BASE_PROPOSAL, customer_name: '' }, URLS);
    assert.ok(html.includes('Valued Customer'), 'Fallback name must appear');
  });
});

// ── Line items ────────────────────────────────────────────────────────────────

describe('Line items table', () => {
  test('Item names appear in the table', () => {
    const html = buildEmailHtml(BASE_PROPOSAL, URLS);
    assert.ok(html.includes('Consulting'),  'First item name must appear');
    assert.ok(html.includes('Design Work'), 'Second item name must appear');
  });

  test('Item descriptions appear in the table', () => {
    const html = buildEmailHtml(BASE_PROPOSAL, URLS);
    assert.ok(html.includes('Strategy session'), 'First description must appear');
    assert.ok(html.includes('Brand refresh'),    'Second description must appear');
  });

  test('Subtotals are calculated correctly', () => {
    const html = buildEmailHtml(BASE_PROPOSAL, URLS);
    // Consulting: 2 × $500 = $1000.00
    assert.ok(html.includes('1000.00'), 'Consulting subtotal $1000.00 must appear');
    // Design Work: 1 × $1200 = $1200.00
    assert.ok(html.includes('1200.00'), 'Design Work subtotal $1200.00 must appear');
  });

  test('Total appears prominently', () => {
    const html = buildEmailHtml(BASE_PROPOSAL, URLS);
    assert.ok(html.includes('2200.00'), 'Total $2200.00 must appear');
  });

  test('Empty line_items renders fallback row, not a crash', () => {
    const html = buildEmailHtml({ ...BASE_PROPOSAL, line_items: '[]' }, URLS);
    assert.ok(html.includes('No line items'), 'Empty state text must appear');
    assert.ok(html.includes('2200.00'), 'Total still appears even with empty items');
  });
});

// ── HTML safety ───────────────────────────────────────────────────────────────

describe('HTML escaping', () => {
  test('Customer name with HTML special chars is escaped', () => {
    const malicious = '<script>alert(1)</script>';
    const html = buildEmailHtml({ ...BASE_PROPOSAL, customer_name: malicious }, URLS);
    assert.ok(!html.includes('<script>'), 'Raw <script> tag must not appear');
    assert.ok(html.includes('&lt;script&gt;'), 'Escaped version must appear');
  });

  test('Item name with ampersand is escaped', () => {
    const items = JSON.stringify([
      { item_name: 'R&D Services', description: '', quantity: 1, custom_price: 100 }
    ]);
    const html = buildEmailHtml({ ...BASE_PROPOSAL, line_items: items }, URLS);
    assert.ok(html.includes('R&amp;D Services'), 'Ampersand must be HTML-escaped');
  });

  test('CTA URLs with ampersands in query strings are HTML-escaped in href attributes', () => {
    const dirtyUrls = {
      acceptUrl:   'http://localhost:3000/proposal/abc/accept?token=x&ref=email',
      feedbackUrl: 'http://localhost:5173/proposal/abc/feedback?token=x&ref=email',
      denyUrl:     'http://localhost:3000/proposal/abc/deny?token=x&ref=email'
    };
    const html = buildEmailHtml(BASE_PROPOSAL, dirtyUrls);
    // Raw & must not appear inside href attributes — must be &amp;
    assert.ok(
      !html.includes('href="http://localhost:3000/proposal/abc/accept?token=x&ref=email"'),
      'Unescaped & must not appear inside accept href'
    );
    assert.ok(
      html.includes('href="http://localhost:3000/proposal/abc/accept?token=x&amp;ref=email"'),
      'Escaped &amp; must appear inside accept href'
    );
    assert.ok(
      html.includes('href="http://localhost:5173/proposal/abc/feedback?token=x&amp;ref=email"'),
      'Escaped &amp; must appear inside feedback href'
    );
    assert.ok(
      html.includes('href="http://localhost:3000/proposal/abc/deny?token=x&amp;ref=email"'),
      'Escaped &amp; must appear inside deny href'
    );
  });

  test('CTA URLs with double-quotes are HTML-escaped in href attributes', () => {
    const dirtyUrls = {
      acceptUrl:   'http://localhost:3000/proposal/a"b/accept',
      feedbackUrl: 'http://localhost:5173/proposal/a"b/feedback',
      denyUrl:     'http://localhost:3000/proposal/a"b/deny'
    };
    const html = buildEmailHtml(BASE_PROPOSAL, dirtyUrls);
    assert.ok(
      !html.includes('href="http://localhost:3000/proposal/a"b/accept"'),
      'Raw double-quote must not appear inside accept href'
    );
    assert.ok(
      html.includes('href="http://localhost:3000/proposal/a&quot;b/accept"'),
      'Double-quote must be escaped as &quot; in accept href'
    );
  });
});

// ── Structure ─────────────────────────────────────────────────────────────────

describe('HTML structure', () => {
  test('Returns a complete HTML document', () => {
    const html = buildEmailHtml(BASE_PROPOSAL, URLS);
    assert.ok(html.startsWith('<!DOCTYPE html>'), 'Must start with DOCTYPE');
    assert.ok(html.includes('</html>'), 'Must end with </html>');
  });

  test('Contains OmniQuote branding', () => {
    const html = buildEmailHtml(BASE_PROPOSAL, URLS);
    assert.ok(html.includes('OmniQuote'), 'OmniQuote brand name must appear');
  });
});
