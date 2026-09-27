import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { detectionService } from './backend/detectionService.js';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const DB_DIR = path.join(__dirname, 'server-data');

app.use(cors());
app.use(express.json());

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

const detectionJobs = {};

app.post('/api/detection', (req, res) => {
  const provider = process.env.DETECT_PROVIDER || 'earth-engine';
  if (provider === 'demo') {
    return res.status(400).json({ error: 'Local Demo Mode is not allowed in production API.' });
  }
  
  // Basic caching
  const cacheKey = `${req.body.targetType}-${JSON.stringify(req.body.geometry)}`;
  if (detectionJobs[cacheKey] && detectionJobs[detectionJobs[cacheKey]]) {
    return res.json({ id: detectionJobs[cacheKey], status: 'queued' });
  }

  const jobId = `job-${Date.now()}`;
  detectionJobs[jobId] = { id: jobId, status: 'queued' };
  detectionJobs[cacheKey] = jobId;

  // Run asynchronously
  (async () => {
    const updateJob = (statusStr) => {
      detectionJobs[jobId].status = statusStr;
    };
    
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT')), 90000) // 90s timeout
      );
      
      const detectPromise = detectionService.detect(req.body, updateJob);
      const result = await Promise.race([detectPromise, timeoutPromise]);
      
      if (result.status === 'success') {
        // Save authoritative Analysis
        const analysisId = `analysis-${Date.now()}`;
        await insertRow('analyses', analysisId, {
          id: analysisId,
          targetType: req.body.targetType,
          geometry: req.body.geometry,
          dataset: result.dataset,
          status: 'completed',
          createdAt: new Date().toISOString()
        });

        // Create evidence record
        await insertRow('evidence', result.evidenceId, {
          id: result.evidenceId,
          analysisId: analysisId,
          type: 'detection',
          timestamp: new Date().toISOString(),
          dataset: result.dataset,
          acquisition: result.acquisition,
          method: result.method,
          summary: result.summary,
          aoi: result.aoi
        });
        
        // Create detection (analysis_results)
        await insertRow('analysis_results', `det-${Date.now()}`, {
          id: `det-${Date.now()}`,
          analysisId: analysisId,
          targetType: req.body.targetType,
          metrics: result.analysis,
          summary: result.summary,
          detections: result.detections
        });
      }
      
      // Store final result
      Object.assign(detectionJobs[jobId], result);
      
      // If success or handled error, the status is already properly set by detectionService
      // wait, detectionService returns { status: 'success' / 'error' / 'no_results' }
      if (result.status === 'success') detectionJobs[jobId].status = 'ready';
      else if (result.status === 'error') detectionJobs[jobId].status = 'failed';
      else detectionJobs[jobId].status = result.status; // 'no_detections', 'no_candidate_pixels', etc
      
    } catch (error) {
      console.error('Detection API error for job', jobId, error);
      if (error.message === 'TIMEOUT') {
        detectionJobs[jobId] = { id: jobId, status: 'timeout', message: 'Detection timed out while converting the analysis mask into geographic features.' };
      } else {
        detectionJobs[jobId] = { id: jobId, status: 'failed', error: 'PROCESSING_FAILED', message: error.message || 'Unknown processing error' };
      }
    }
  })();

  res.json({ id: jobId, status: 'queued' });
});

app.get('/api/detection/:id', (req, res) => {
  const job = detectionJobs[req.params.id];
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});


// EARTH ENGINE HEALTH
app.get('/api/earth-engine/health', async (req, res) => {
  try {
    // Just a basic check that variables are present
    const hasProject = !!process.env.EARTH_ENGINE_PROJECT_ID;
    const hasEmail = !!process.env.EARTH_ENGINE_CLIENT_EMAIL;
    const hasKey = !!process.env.EARTH_ENGINE_PRIVATE_KEY;
    
    res.json({
      authenticated: hasProject && hasEmail && hasKey,
      projectConfigured: hasProject,
      initialized: true // If we wanted true runtime check we'd call auth.js
    });
  } catch (err) {
    res.status(500).json({ error: 'EARTH ENGINE PROVIDER ERROR', message: err.message });
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
