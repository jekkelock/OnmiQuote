// src/config/tenant.js
// Manages tenant database connections with idle timeout (10 minutes)

import { getTenantDB } from './db.js';

// Map to hold tenant database connections with last access time
const tenantConnections = new Map();
const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// Cleanup interval in milliseconds (check every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// Start cleanup interval
setInterval(cleanupInactiveConnections, CLEANUP_INTERVAL_MS);

/**
 * Get a tenant database connection, creating it if necessary
 * @param {string|number} tenantId - The tenant ID
 * @returns {Promise<object>} Database connection
 */
export async function getTenantConnection(tenantId) {
  const key = String(tenantId);
  const now = Date.now();

  // If we have a connection and it's not expired, update its timestamp and return it
  if (tenantConnections.has(key)) {
    const entry = tenantConnections.get(key);
    if (now - entry.timestamp < IDLE_TIMEOUT_MS) {
      // Update last access time
      entry.timestamp = now;
      return entry.db;
    } else {
      // Connection has expired, close it and remove from map
      try {
        await entry.db.close();
      } catch (err) {
        console.error(`Error closing expired tenant ${tenantId} connection:`, err);
      }
      tenantConnections.delete(key);
    }
  }

  // Create new connection
  const db = await getTenantDB(tenantId);
  tenantConnections.set(key, {
    db,
    timestamp: now
  });

  return db;
}

/**
 * Close a specific tenant connection
 * @param {string|number} tenantId - The tenant ID
 */
export async function closeTenantConnection(tenantId) {
  const key = String(tenantId);
  if (tenantConnections.has(key)) {
    const entry = tenantConnections.get(key);
    try {
      await entry.db.close();
    } catch (err) {
      console.error(`Error closing tenant ${tenantId} connection:`, err);
    }
    tenantConnections.delete(key);
  }
}

/**
 * Close all tenant connections
 */
export async function closeAllTenantConnections() {
  for (const [key, entry] of tenantConnections.entries()) {
    try {
      await entry.db.close();
    } catch (err) {
      console.error(`Error closing tenant ${key} connection:`, err);
    }
  }
  tenantConnections.clear();
}

/**
 * Cleanup inactive connections (called by interval)
 */
function cleanupInactiveConnections() {
  const now = Date.now();
  for (const [key, entry] of tenantConnections.entries()) {
    if (now - entry.timestamp > IDLE_TIMEOUT_MS) {
      // Connection has been idle too long, close it
      entry.db.close().catch(err => {
        console.error(`Error closing idle tenant ${key} connection:`, err);
      });
      tenantConnections.delete(key);
    }
  }
}

// Export the cleanup function for testing if needed
export { cleanupInactiveConnections };