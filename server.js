import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const DB_DIR = path.join(__dirname, 'server-data');

app.use(cors());
app.use(express.json());

import { initEE, getCompareData, healthCheck } from './server-gee.js';
// Try initializing EE in background
initEE().catch(console.error);

import fs from 'fs';
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const dbPath = path.join(DB_DIR, 'satquery.sqlite');
const db = new sqlite3.Database(dbPath);

// Initialize DB schema
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    data TEXT
  )`);
  
  const tables = [
    'users', 'saved_locations', 'analyses', 'analysis_results',
    'evidence', 'reports', 'measurements', 'watches', 
    'watch_passes', 'timeline_events', 'exports'
  ];

  tables.forEach(table => {
    db.run(`CREATE TABLE IF NOT EXISTS ${table} (
      id TEXT PRIMARY KEY,
      data TEXT
    )`);
  });
});

// Helper functions for DB operations wrapping sqlite3 in Promises
const getRow = (table, id) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT data FROM ${table} WHERE id = ?`, [id], (err, row) => {
      if (err) reject(err);
      else resolve(row ? JSON.parse(row.data) : null);
    });
  });
};

const getAllRows = (table) => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT data FROM ${table}`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(row => JSON.parse(row.data)));
    });
  });
};

const insertRow = (table, id, data) => {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO ${table} (id, data) VALUES (?, ?)`, [id, JSON.stringify(data)], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
};

const updateRow = (table, id, data) => {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE ${table} SET data = ? WHERE id = ?`, [JSON.stringify(data), id], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

const deleteRow = (table, id) => {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM ${table} WHERE id = ?`, [id], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

// Earth Engine Health Check
app.get('/api/compare/health', async (req, res) => {
  try {
    const health = await healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Compare endpoint — passes full params to Earth Engine service
app.post('/api/compare', async (req, res) => {
  try {
    const { baselineDate, currentDate, coords, bounds, indicator } = req.body;
    if (!baselineDate || !currentDate || !coords) {
      return res.status(400).json({ status: 'error', code: 'INVALID_REQUEST', message: 'Missing baselineDate, currentDate, or coords' });
    }
    
    const result = await getCompareData({ baselineDate, currentDate, coords, bounds, indicator });
    res.json(result);
  } catch (error) {
    console.error('Compare API Error:', error);
    res.status(500).json({ status: 'error', code: 'SERVER_ERROR', message: error.toString() });
  }
});

// GET all items for a resource (or the settings object)
app.get('/api/:resource', async (req, res) => {
  try {
    const { resource } = req.params;
    if (resource === 'settings') {
      const data = await getRow('settings', 'singleton');
      return res.json(data || {});
    }
    const data = await getAllRows(resource);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to read data' });
  }
});

// GET single item by ID
app.get('/api/:resource/:id', async (req, res) => {
  try {
    const { resource, id } = req.params;
    if (resource === 'settings') {
      return res.status(400).json({ error: 'Settings is a singleton' });
    }
    const data = await getRow(resource, id);
    if (!data) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to read data' });
  }
});

// POST to create a new item (or overwrite settings)
app.post('/api/:resource', async (req, res) => {
  try {
    const { resource } = req.params;
    if (resource === 'settings') {
      const existing = await getRow('settings', 'singleton');
      if (existing) {
        await updateRow('settings', 'singleton', req.body);
      } else {
        await insertRow('settings', 'singleton', req.body);
      }
      return res.status(201).json(req.body);
    }

    const newItem = { id: Date.now().toString(), ...req.body };
    await insertRow(resource, newItem.id, newItem);
    res.status(201).json(newItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to write data' });
  }
});

// PUT to update an item by ID
app.put('/api/:resource/:id', async (req, res) => {
  try {
    const { resource, id } = req.params;
    if (resource === 'settings') {
      return res.status(400).json({ error: 'Settings is a singleton, use POST /api/settings' });
    }
    
    const existing = await getRow(resource, id);
    if (!existing) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    const updatedData = { ...existing, ...req.body, id };
    await updateRow(resource, id, updatedData);
    res.json(updatedData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update data' });
  }
});

// DELETE an item by ID
app.delete('/api/:resource/:id', async (req, res) => {
  try {
    const { resource, id } = req.params;
    if (resource === 'settings') {
      return res.status(400).json({ error: 'Cannot delete settings' });
    }

    const changes = await deleteRow(resource, id);
    if (changes === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete data' });
  }
});

app.listen(PORT, () => {
  console.log(`Local authoritative server running on http://localhost:${PORT} with SQLite backend`);
});
