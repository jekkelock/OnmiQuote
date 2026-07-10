import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { attachTenantDB, cleanupTenant } from '../middleware/tenant.js';

const router = express.Router();

// All routes require authentication and tenant DB
router.use(authenticate);
router.use(attachTenantDB);
router.use(cleanupTenant);

// Services/Catalog routes

// Create a new service
router.post('/services', async (req, res) => {
  try {
    const { item_name, description, base_price, unit_type } = req.body;

    if (!item_name || base_price === undefined || !unit_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await req.db.run(
      'INSERT INTO services (item_name, description, base_price, unit_type) VALUES (?, ?, ?, ?)',
      [item_name, description, base_price, unit_type]
    );

    const service = await req.db.get('SELECT * FROM services WHERE id = ?', [result.lastID]);
    res.status(201).json({ service });
  } catch (err) {
    console.error('Service create error:', err);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

// Get all services
router.get('/services', async (req, res) => {
  try {
    const services = await req.db.all('SELECT * FROM services ORDER BY item_name ASC');
    res.json({ services });
  } catch (err) {
    console.error('Services fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// Update a service
router.put('/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { item_name, description, base_price, unit_type } = req.body;

    await req.db.run(
      'UPDATE services SET item_name = ?, description = ?, base_price = ?, unit_type = ? WHERE id = ?',
      [item_name, description, base_price, unit_type, id]
    );

    const service = await req.db.get('SELECT * FROM services WHERE id = ?', [id]);
    res.json({ service });
  } catch (err) {
    console.error('Service update error:', err);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

// Delete a service
router.delete('/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await req.db.run('DELETE FROM services WHERE id = ?', [id]);
    res.json({ message: 'Service deleted' });
  } catch (err) {
    console.error('Service delete error:', err);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

// Templates routes

// Create a new template
router.post('/templates', async (req, res) => {
  try {
    const { template_name, terms_and_disclaimers } = req.body;

    if (!template_name) {
      return res.status(400).json({ error: 'Missing template_name' });
    }

    const result = await req.db.run(
      'INSERT INTO templates (template_name, terms_and_disclaimers) VALUES (?, ?)',
      [template_name, terms_and_disclaimers]
    );

    const template = await req.db.get('SELECT * FROM templates WHERE id = ?', [result.lastID]);
    res.status(201).json({ template });
  } catch (err) {
    console.error('Template create error:', err);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Get all templates
router.get('/templates', async (req, res) => {
  try {
    const templates = await req.db.all('SELECT * FROM templates ORDER BY template_name ASC');
    res.json({ templates });
  } catch (err) {
    console.error('Templates fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Update a template
router.put('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { template_name, terms_and_disclaimers } = req.body;

    await req.db.run(
      'UPDATE templates SET template_name = ?, terms_and_disclaimers = ? WHERE id = ?',
      [template_name, terms_and_disclaimers, id]
    );

    const template = await req.db.get('SELECT * FROM templates WHERE id = ?', [id]);
    res.json({ template });
  } catch (err) {
    console.error('Template update error:', err);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Delete a template
router.delete('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await req.db.run('DELETE FROM templates WHERE id = ?', [id]);
    res.json({ message: 'Template deleted' });
  } catch (err) {
    console.error('Template delete error:', err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;