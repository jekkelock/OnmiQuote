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

// Main DB

let mainDb;

export async function initMainDB() {
  const { Database } = sqlite3.verbose();
  mainDb = await open({
    filename: path.resolve(process.cwd(), 'main.db'),
    driver: Database
  });

  const safeMainAlter = async (sql) => {
    try {
      await mainDb.run(sql);
    } catch (err) {
      if (!err.message?.includes('duplicate column name')) {
        console.error(`[db] Main migration error (${sql}):`, err.message);
      }
    }
  };

  await mainDb.run(`CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    UNIQUE NOT NULL,
      password_hash TEXT    NOT NULL,
      tenant_id     TEXT,
      token_version INTEGER DEFAULT 1
    )`);

  await safeMainAlter('ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 1');

  await mainDb.run(`CREATE TABLE IF NOT EXISTS tenants (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      business_name TEXT    NOT NULL UNIQUE
    )`);

  return mainDb;
}

export function getMainDB() {
  if (!mainDb) {
    throw new Error('Main database not initialised. Call initMainDB() first.');
  }
  return mainDb;
}

// Tenant DB

export async function getTenantDB(tenantId) {
  const tenantIdNum = Number(tenantId);
  if (!Number.isInteger(tenantIdNum) || tenantIdNum < 1) {
    throw new Error('Invalid tenant ID: must be a positive integer');
  }

  const { Database } = sqlite3.verbose();

  const tenantDir = path.resolve(process.cwd(), 'data', 'tenants');
  fs.mkdirSync(tenantDir, { recursive: true });

  const tenantDBPath = path.join(tenantDir, `tenant_${tenantIdNum}.db`);

  const db = await open({
    filename: tenantDBPath,
    driver: Database
  });

  await db.run('PRAGMA journal_mode=WAL');
  await db.run('PRAGMA busy_timeout=5000');
  await db.run('PRAGMA synchronous=NORMAL');

  await db.run(`CREATE TABLE IF NOT EXISTS email_settings (
      id                       INTEGER PRIMARY KEY AUTOINCREMENT,
      smtp_host                TEXT    NOT NULL,
      smtp_port                INTEGER NOT NULL,
      smtp_user                TEXT    NOT NULL,
      smtp_password_encrypted  TEXT    NOT NULL,
      from_name                TEXT,
      created_at               DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at               DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

  await db.run(`CREATE TABLE IF NOT EXISTS services (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name   TEXT    NOT NULL,
      description TEXT,
      base_price  REAL    NOT NULL,
      unit_type   TEXT    NOT NULL
    )`);

  await db.run(`CREATE TABLE IF NOT EXISTS proposals (
      id              INTEGER  PRIMARY KEY AUTOINCREMENT,
      hash_token      TEXT     NOT NULL UNIQUE,
      customer_name   TEXT,
      customer_email  TEXT,
      customer_phone  TEXT,
      line_items      TEXT     NOT NULL,
      total           REAL     NOT NULL,
      status          TEXT     NOT NULL DEFAULT 'Draft',
      feedback        TEXT,
      viewed_at       DATETIME,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

  await db.run(`CREATE TABLE IF NOT EXISTS templates (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      template_name        TEXT    NOT NULL,
      terms_and_disclaimers TEXT
    )`);

  await db.run(`CREATE TABLE IF NOT EXISTS settings_general (
      id              INTEGER PRIMARY KEY CHECK (id = 1),
      company_name    TEXT,
      company_email   TEXT,
      company_phone   TEXT,
      company_address TEXT,
      currency        TEXT DEFAULT 'EUR',
      primary_color   TEXT DEFAULT '#3B82F6',
      logo_url        TEXT,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

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

  await safeAlter('ALTER TABLE proposals ADD COLUMN customer_email TEXT');
  await safeAlter('ALTER TABLE proposals ADD COLUMN customer_phone TEXT');
  await safeAlter('ALTER TABLE proposals ADD COLUMN feedback TEXT');
  await safeAlter('ALTER TABLE proposals ADD COLUMN viewed_at DATETIME');
  await safeAlter('ALTER TABLE proposals ADD COLUMN template_id INTEGER');

  return db;
}