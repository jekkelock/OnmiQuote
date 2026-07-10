// src/utils/crypto.js
// AES-256-CBC encrypt/decrypt for SMTP passwords using EMAIL_SECRET env var.
// Uses Node's built-in `crypto` module — no external dependencies.

import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // AES block size

// Fixed salt — the key is derived once per process start and cached.
// Using PBKDF2 (100k iterations, SHA-256) over a raw SHA-256 hash gives
// meaningful resistance against brute-force if EMAIL_SECRET is low-entropy.
const KEY_CACHE = new Map();
const KDF_SALT  = 'omniquote-email-key-v1'; // non-secret, version-tagged
const KDF_ITER  = 100_000;

function getKey() {
  const secret = process.env.EMAIL_SECRET;
  if (!secret) {
    throw new Error('EMAIL_SECRET environment variable is not set.');
  }
  if (KEY_CACHE.has(secret)) return KEY_CACHE.get(secret);

  const key = crypto.pbkdf2Sync(secret, KDF_SALT, KDF_ITER, 32, 'sha256');
  KEY_CACHE.set(secret, key);
  return key;
}

/**
 * Encrypts a plaintext string.
 * @param {string} text - Plaintext to encrypt.
 * @returns {string} Hex-encoded "iv:ciphertext"
 */
export function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypts an encrypted string produced by `encrypt`.
 * @param {string} encryptedText - Hex-encoded "iv:ciphertext"
 * @returns {string} Decrypted plaintext.
 */
export function decrypt(encryptedText) {
  const [ivHex, ...rest] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const ciphertext = rest.join(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
