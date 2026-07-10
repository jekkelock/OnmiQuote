import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initMainDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import tenantRoutes from './routes/tenant.js';
import proposalRoutes from './routes/proposal.js';
import catalogRoutes from './routes/catalog.js';
import settingsRoutes from './routes/settings.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const db = (await import('./config/db.js')).getMainDB();
    await db.get('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/proposal', proposalRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/settings', settingsRoutes);

// Public proposal routes (for email links without /api prefix)
app.use('/proposal', proposalRoutes);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile('index.html', { root: process.cwd() });
    }
  });
}

const PORT = process.env.PORT || 3000;

(async () => {
  await initMainDB();
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
})();