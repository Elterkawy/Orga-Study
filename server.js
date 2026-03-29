const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'orgastudy.db');
const db = new sqlite3.Database(DB_PATH);

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Serve static files (frontend) from project root
app.use(express.static(__dirname));

// Initialize table for key/value JSON storage
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT)`);
});

function getKey(key) {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM kv WHERE key = ?', [key], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      try {
        resolve(JSON.parse(row.value));
      } catch (e) {
        resolve(null);
      }
    });
  });
}

function setKey(key, value) {
  return new Promise((resolve, reject) => {
    const s = JSON.stringify(value || null);
    db.run('INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, s], function(err) {
      if (err) return reject(err);
      resolve(true);
    });
  });
}

// Generic endpoints for keys: homeworks, courses, schedule, done, goals
app.get('/api/:key', async (req, res) => {
  try {
    const data = await getKey(req.params.key);
    res.json({ ok: true, key: req.params.key, value: data === null ? null : data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.put('/api/:key', async (req, res) => {
  try {
    const payload = req.body;
    await setKey(req.params.key, payload);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/:key', async (req, res) => {
  // alias to put
  try {
    const payload = req.body;
    await setKey(req.params.key, payload);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`OrgaStudy backend running on http://localhost:${PORT}`);
});
