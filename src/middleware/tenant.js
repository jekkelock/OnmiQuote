import { closeTenantConnection, getTenantConnection } from '../config/tenant.js';
import { verifyToken } from '../config/auth.js';

export async function attachTenantDB(req, res, next) {
  try {
    // Get tenant ID from authenticated user
    const tenantId = req.user?.tenant_id;
    if (!tenantId) throw new Error('Tenant ID missing');

    // Get (or create) tenant DB connection
    req.db = await getTenantConnection(tenantId);
    next();
  } catch (err) {
    res.status(400).json({ error: 'Tenant resolution failed' });
  }
}

// Note: Connection cleanup is handled by idle timeout in tenant.js
// Do not close here to avoid race conditions with concurrent requests
export function cleanupTenant(req, res, next) {
  next();
}