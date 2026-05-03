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

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('create','update','delete','login','logout','password_reset','user_created','user_updated','calibration_added')),
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      changes TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_equipment_barcode ON equipment(barcode_value);
    CREATE INDEX IF NOT EXISTS idx_rules_next_due ON calibration_rules(next_due_at);
    CREATE INDEX IF NOT EXISTS idx_events_equipment ON calibration_events(equipment_id, calibrated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);
  `);
}

export function nowIso() {
  return new Date().toISOString();
}

export function newId() {
  return randomUUID();
}

