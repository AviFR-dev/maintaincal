import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

export type Db = Database.Database;

export function openDb(databasePath: string): Db {
  const db = new Database(databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function migrate(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','user')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS equipment (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      barcode_value TEXT NOT NULL UNIQUE,
      asset_tag TEXT,
      location TEXT,
      model TEXT,
      serial_number TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calibration_rules (
      id TEXT PRIMARY KEY,
      equipment_id TEXT NOT NULL UNIQUE,
      interval_days INTEGER NOT NULL,
      grace_days INTEGER NOT NULL DEFAULT 0,
      last_calibrated_at TEXT,
      next_due_at TEXT,
      FOREIGN KEY(equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS calibration_events (
      id TEXT PRIMARY KEY,
      equipment_id TEXT NOT NULL,
      calibrated_at TEXT NOT NULL,
      performed_by_user_id TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
      FOREIGN KEY(performed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_equipment_barcode ON equipment(barcode_value);
    CREATE INDEX IF NOT EXISTS idx_rules_next_due ON calibration_rules(next_due_at);
    CREATE INDEX IF NOT EXISTS idx_events_equipment ON calibration_events(equipment_id, calibrated_at DESC);
  `);
}

export function nowIso() {
  return new Date().toISOString();
}

export function newId() {
  return randomUUID();
}

