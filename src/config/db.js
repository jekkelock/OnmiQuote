// src/config/db.js
// Main DB (users + tenants) and per-tenant DB provisioning.
// Tenant databases are physically isolated as data/tenants/tenant_[id].db

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Main DB ──────────────────────────────────────────────────────────────────

let mainDb;

/**
 * Initialise the main database and create core tables if they don't exist.
 * @returns {Promise<object>} The opened SQLite database handle.
 */
export async function initMainDB() {
  const { Database } = sqlite3.verbose();
  mainDb = await open({
    filename: path.resolve(process.cwd(), 'main.db'),
    driver: Database
  });

  // Users – one account per tenant user
  await mainDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    UNIQUE NOT NULL,
      password_hash TEXT    NOT NULL,
      tenant_id     TEXT
    )
  `);

  // Tenants – each row represents an isolated business account
  await mainDb.run(`
    CREATE TABLE IF NOT EXISTS tenants (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      business_name TEXT    NOT NULL UNIQUE
    )
  `);

  return mainDb;
}

/**
 * Return the initialised main DB handle.
 * Throws if called before initMainDB().
 */
export function getMainDB() {
  if (!mainDb) {
    throw new Error('Main database not initialised. Call initMainDB() first.');
  }
  return mainDb;
}

// ─── Tenant DB ────────────────────────────────────────────────────────────────

/**
 * Open (and provision) an isolated SQLite database for a specific tenant.
 * The file is created at data/tenants/tenant_[tenantId].db.
 *
* Tables created on first access:
   *   • email_settings  – SMTP configuration (password stored AES-256-CBC encrypted)
   *   • services        – the tenant's service/product catalog
   *   • proposals       – B2B quote records with lifecycle status
   *   • templates       – business terms and disclaimers
 *
 * @param {string|number} tenantId
 * @returns {Promise<object>} The opened SQLite database handle.
 */
export async function getTenantDB(tenantId) {
  const { Database } = sqlite3.verbose();

  // Ensure the tenants directory exists
  const tenantDir = path.resolve(process.cwd(), 'data', 'tenants');
  fs.mkdirSync(tenantDir, { recursive: true });

  const tenantDBPath = path.join(tenantDir, `tenant_${tenantId}.db`);

  const db = await open({
    filename: tenantDBPath,
    driver: Database
  });

  // Reliability PRAGMAs
  await db.run('PRAGMA journal_mode=WAL');
  await db.run('PRAGMA busy_timeout=5000');
  await db.run('PRAGMA synchronous=NORMAL');

  // ── email_settings ──────────────────────────────────────────────────────────
  // Stores the tenant's outbound SMTP credentials.
  // smtp_password_encrypted is ciphertext produced by src/utils/crypto.js
  await db.run(`
    CREATE TABLE IF NOT EXISTS email_settings (
      id                       INTEGER PRIMARY KEY AUTOINCREMENT,
      smtp_host                TEXT    NOT NULL,
      smtp_port                INTEGER NOT NULL,
      smtp_user                TEXT    NOT NULL,
      smtp_password_encrypted  TEXT    NOT NULL,
      from_name                TEXT,
      created_at               DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at               DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── services ────────────────────────────────────────────────────────────────
  // The tenant's service/product catalog used when building proposals.
  await db.run(`
    CREATE TABLE IF NOT EXISTS services (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name   TEXT    NOT NULL,
      description TEXT,
      base_price  REAL    NOT NULL,
      unit_type   TEXT    NOT NULL
    )
`);

  // ── proposals ───────────────────────────────────────────────────────────────
  // Each row is a B2B quote sent (or drafted) for a customer.
  // line_items stores a JSON array of selected services with quantities/prices.
  await db.run(`
    CREATE TABLE IF NOT EXISTS proposals (
      id              INTEGER  PRIMARY KEY AUTOINCREMENT,
      hash_token      TEXT     NOT NULL UNIQUE,
      customer_name   TEXT,
      customer_email  TEXT,
      customer_phone  TEXT,
      line_items      TEXT     NOT NULL,          -- JSON array
      total           REAL     NOT NULL,
      status          TEXT     NOT NULL DEFAULT 'Draft',
      feedback        TEXT,
      viewed_at       DATETIME,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── templates ───────────────────────────────────────────────────────────────
  // Business terms and disclaimers for proposals.
  await db.run(`
    CREATE TABLE IF NOT EXISTS templates (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      template_name        TEXT    NOT NULL,
      terms_and_disclaimers TEXT
    )
  `);

  // ── inline migrations for pre-existing databases ────────────────────────────
  // Silences only "duplicate column" errors; all other ALTER failures are re-thrown.
  const safeAlter = async (sql) => {
    try {
      await db.run(sql);
    } catch (err) {
      if (!err.message?.includes('duplicate column name')) {
        console.error(`[db] Migration error (${sql}):`, err.message);
        throw err;
      }
    }
  };

  // Add missing columns (safe for already-existing)
  await safeAlter('ALTER TABLE proposals ADD COLUMN customer_email TEXT');
  await safeAlter('ALTER TABLE proposals ADD COLUMN customer_phone TEXT');
  await safeAlter('ALTER TABLE proposals ADD COLUMN feedback TEXT');
  await safeAlter('ALTER TABLE proposals ADD COLUMN viewed_at DATETIME');
  await safeAlter('ALTER TABLE proposals ADD COLUMN template_id INTEGER');

  return db;
}
