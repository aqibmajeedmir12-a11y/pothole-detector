const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'roadmonitor.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS potholes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('low','medium','high','critical')),
    source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('ai_camera','esp32_sensor','manual')),
    image_url TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'detected' CHECK(status IN ('detected','confirmed','in_repair','repaired')),
    detected_at TEXT NOT NULL DEFAULT (datetime('now')),
    repaired_at TEXT,
    maintenance_notes TEXT,
    road_name TEXT,
    confidence REAL DEFAULT 0.0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sensor_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    vibration_level REAL NOT NULL,
    lat REAL,
    lng REAL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    pothole_detected INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin','viewer')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pothole_id INTEGER REFERENCES potholes(id),
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'detection' CHECK(type IN ('detection','severity_change','repair')),
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_potholes_status ON potholes(status);
  CREATE INDEX IF NOT EXISTS idx_potholes_severity ON potholes(severity);
  CREATE INDEX IF NOT EXISTS idx_potholes_detected_at ON potholes(detected_at);
  CREATE INDEX IF NOT EXISTS idx_sensor_data_device ON sensor_data(device_id);
  CREATE INDEX IF NOT EXISTS idx_sensor_data_timestamp ON sensor_data(timestamp);
  CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(read);
`);

// Migration: add estimation columns (idempotent)
const migrationColumns = [
  { name: 'area',   sql: 'ALTER TABLE potholes ADD COLUMN area REAL DEFAULT 0' },
  { name: 'volume', sql: 'ALTER TABLE potholes ADD COLUMN volume REAL DEFAULT 0' },
  { name: 'cost',   sql: 'ALTER TABLE potholes ADD COLUMN cost INTEGER DEFAULT 0' },
];
for (const col of migrationColumns) {
  try { db.exec(col.sql); } catch (_) { /* column already exists */ }
}

console.log('✅ SQLite database initialized at', dbPath);

module.exports = db;
