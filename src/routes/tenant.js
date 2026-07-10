import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { attachTenantDB, cleanupTenant } from '../middleware/tenant.js';

const router = express.Router();

// All routes require authentication and tenant DB
router.use(authenticate);
router.use(attachTenantDB);
router.use(cleanupTenant);

// Get tenant business info
router.get('/info', async (req, res) => {
  try {
    const db = (await import('../config/db.js')).getMainDB();
    const tenant = await db.get('SELECT business_name FROM tenants WHERE id = ?', [req.user.tenant_id]);
    res.json({ tenant });
  } catch (err) {
    console.error('Tenant info error:', err);
    res.status(500).json({ error: 'Failed to fetch tenant info' });
  }
});

export default router;