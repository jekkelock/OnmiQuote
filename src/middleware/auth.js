import { getMainDB } from '../config/db.js';
import { verifyToken } from '../config/auth.js';

export async function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const decoded = verifyToken(token);
    if (!decoded?.tenant_id) return res.status(400).json({ error: 'Invalid token payload' });

    // Attach user and tenant info
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid token' });
  }
}