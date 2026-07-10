import express from 'express';
import { getMainDB } from '../config/db.js';
import { hashPassword, generateToken } from '../config/auth.js';
import { getTenantConnection } from '../config/tenant.js';

const router = express.Router();

// Register a new user and create tenant
router.post('/register', async (req, res) => {
  const { username, password, business_name } = req.body;

  if (!username || !password || !business_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const db = getMainDB();

    // Check if username exists
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Check if business_name exists
    const existingTenant = await db.get('SELECT id FROM tenants WHERE business_name = ?', [business_name]);
    if (existingTenant) {
      return res.status(409).json({ error: 'Business name already exists' });
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Create tenant
    const tenantResult = await db.run(
      'INSERT INTO tenants (business_name) VALUES (?)',
      [business_name]
    );
    const tenantId = tenantResult.lastID;

    // Create user with tenant_id
    const userResult = await db.run(
      'INSERT INTO users (username, password_hash, tenant_id) VALUES (?, ?, ?)',
      [username, password_hash, tenantId]
    );
    const userId = userResult.lastID;

    // Initialize tenant database (creates file and history table)
    await getTenantConnection(tenantId);

    // Generate JWT token
    const token = generateToken({ user_id: userId, tenant_id: tenantId, username });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      tenant_id: tenantId
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Missing credentials' });
  }

  try {
    const db = getMainDB();

    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { verifyPassword } = await import('../config/auth.js');
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken({ user_id: user.id, tenant_id: user.tenant_id, username });

    res.json({
      message: 'Login successful',
      token,
      tenant_id: user.tenant_id
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;