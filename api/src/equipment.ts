import { z } from 'zod';
import type { Db } from './db.js';
import { nowIso, newId } from './db.js';

export type EquipmentRow = {
  id: string;
  name: string;
  barcode_value: string;
  asset_tag: string | null;
  location: string | null;
  model: string | null;
  serial_number: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const equipmentCreateSchema = z.object({
  name: z.string().min(1),
  barcodeValue: z.string().min(1),
  assetTag: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  status: z.enum(['active', 'retired']).default('active'),
  notes: z.string().optional().nullable(),
  intervalDays: z.number().int().positive(),
  graceDays: z.number().int().min(0).default(0),
  lastCalibratedAt: z.string().datetime().optional().nullable(),
});

export const equipmentPatchSchema = equipmentCreateSchema.partial().extend({
  intervalDays: z.number().int().positive().optional(),
  graceDays: z.number().int().min(0).optional(),
});

export function computeNextDue(lastCalibratedAt: string | null | undefined, intervalDays: number) {
  if (!lastCalibratedAt) return null;
  const dt = new Date(lastCalibratedAt);
  const next = new Date(dt.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  return next.toISOString();
}

export function createEquipment(db: Db, input: z.infer<typeof equipmentCreateSchema>) {
  const id = newId();
  const ts = nowIso();
  const nextDueAt = computeNextDue(input.lastCalibratedAt, input.intervalDays);

  const tx = db.transaction(() => {
    db.prepare(
      `
      INSERT INTO equipment (id, name, barcode_value, asset_tag, location, model, serial_number, status, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      id,
      input.name,
      input.barcodeValue,
      input.assetTag ?? null,
      input.location ?? null,
      input.model ?? null,
      input.serialNumber ?? null,
      input.status ?? 'active',
      input.notes ?? null,
      ts,
      ts,
    );

    db.prepare(
      `
      INSERT INTO calibration_rules (id, equipment_id, interval_days, grace_days, last_calibrated_at, next_due_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
    ).run(newId(), id, input.intervalDays, input.graceDays ?? 0, input.lastCalibratedAt ?? null, nextDueAt);
  });

  tx();
  return getEquipment(db, id);
}

export function getEquipment(db: Db, id: string) {
  const equipment = db.prepare('SELECT * FROM equipment WHERE id = ?').get(id) as EquipmentRow | undefined;
  if (!equipment) return null;
  const rule = db
    .prepare('SELECT interval_days, grace_days, last_calibrated_at, next_due_at FROM calibration_rules WHERE equipment_id = ?')
    .get(id) as
    | { interval_days: number; grace_days: number; last_calibrated_at: string | null; next_due_at: string | null }
    | undefined;
  const events = db
    .prepare(
      `
      SELECT e.id, e.calibrated_at, e.performed_by_user_id, e.notes, e.created_at,
             u.email as performed_by_email
      FROM calibration_events e
      LEFT JOIN users u ON u.id = e.performed_by_user_id
      WHERE e.equipment_id = ?
      ORDER BY e.calibrated_at DESC
      LIMIT 50
      `,
    )
    .all(id) as Array<{
    id: string;
    calibrated_at: string;
    performed_by_user_id: string | null;
    performed_by_email: string | null;
    notes: string | null;
    created_at: string;
  }>;

  return {
    equipment: {
      id: equipment.id,
      name: equipment.name,
      barcodeValue: equipment.barcode_value,
      assetTag: equipment.asset_tag,
      location: equipment.location,
      model: equipment.model,
      serialNumber: equipment.serial_number,
      status: equipment.status,
      notes: equipment.notes,
      createdAt: equipment.created_at,
      updatedAt: equipment.updated_at,
    },
    rule: rule
      ? {
          intervalDays: rule.interval_days,
          graceDays: rule.grace_days,
          lastCalibratedAt: rule.last_calibrated_at,
          nextDueAt: rule.next_due_at,
        }
      : null,
    events: events.map((ev) => ({
      id: ev.id,
      calibratedAt: ev.calibrated_at,
      performedByUserId: ev.performed_by_user_id,
      performedByEmail: ev.performed_by_email,
      notes: ev.notes,
      createdAt: ev.created_at,
    })),
  };
}

export function findByBarcode(db: Db, barcodeValue: string) {
  const row = db.prepare('SELECT id FROM equipment WHERE barcode_value = ?').get(barcodeValue) as { id: string } | undefined;
  return row ? getEquipment(db, row.id) : null;
}

export function listEquipment(
  db: Db,
  q: {
    search?: string;
    due?: 'overdue' | 'dueSoon';
    dueSoonDays?: number;
    location?: string;
    status?: 'active' | 'retired';
    model?: string;
  },
) {
  const dueSoonDays = q.dueSoonDays ?? 30;
  const now = nowIso();
  const dueSoonLimit = new Date(Date.now() + dueSoonDays * 24 * 60 * 60 * 1000).toISOString();

  let where = '1=1';
  const params: any[] = [];

  if (q.search) {
    where += ' AND (name LIKE ? OR barcode_value LIKE ? OR asset_tag LIKE ? OR location LIKE ?)';
    const s = `%${q.search}%`;
    params.push(s, s, s, s);
  }

  if (q.location) {
    where += ' AND e.location = ?';
    params.push(q.location);
  }

  if (q.status) {
    where += ' AND e.status = ?';
    params.push(q.status);
  }

  if (q.model) {
    where += ' AND e.model = ?';
    params.push(q.model);
  }

  if (q.due === 'overdue') {
    where += ' AND r.next_due_at IS NOT NULL AND r.next_due_at < ?';
    params.push(now);
  } else if (q.due === 'dueSoon') {
    where += ' AND r.next_due_at IS NOT NULL AND r.next_due_at >= ? AND r.next_due_at <= ?';
    params.push(now, dueSoonLimit);
  }

  const rows = db
    .prepare(
      `
      SELECT e.*, r.interval_days, r.grace_days, r.last_calibrated_at, r.next_due_at
      FROM equipment e
      JOIN calibration_rules r ON r.equipment_id = e.id
      WHERE ${where}
      ORDER BY
        CASE WHEN r.next_due_at IS NULL THEN 1 ELSE 0 END,
        r.next_due_at ASC,
        e.name ASC
      LIMIT 200
      `,
    )
    .all(...params) as Array<
    EquipmentRow & {
      interval_days: number;
      grace_days: number;
      last_calibrated_at: string | null;
      next_due_at: string | null;
    }
  >;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    barcodeValue: r.barcode_value,
    assetTag: r.asset_tag,
    location: r.location,
    model: r.model,
    serialNumber: r.serial_number,
    status: r.status,
    intervalDays: r.interval_days,
    graceDays: r.grace_days,
    lastCalibratedAt: r.last_calibrated_at,
    nextDueAt: r.next_due_at,
    updatedAt: r.updated_at,
  }));
}

export function listDistinctLocations(db: Db) {
  const rows = db
    .prepare("SELECT DISTINCT location FROM equipment WHERE location IS NOT NULL AND TRIM(location) <> '' ORDER BY location ASC")
    .all() as Array<{ location: string }>;
  return rows.map((r) => r.location);
}

export function listDistinctModels(db: Db) {
  const rows = db
    .prepare("SELECT DISTINCT model FROM equipment WHERE model IS NOT NULL AND TRIM(model) <> '' ORDER BY model ASC")
    .all() as Array<{ model: string }>;
  return rows.map((r) => r.model);
}

export function patchEquipment(db: Db, id: string, patch: z.infer<typeof equipmentPatchSchema>) {
  const existing = getEquipment(db, id);
  if (!existing) return null;

  const merged = {
    equipment: {
      ...existing.equipment,
      name: patch.name ?? existing.equipment.name,
      barcodeValue: patch.barcodeValue ?? existing.equipment.barcodeValue,
      assetTag: patch.assetTag ?? existing.equipment.assetTag,
      location: patch.location ?? existing.equipment.location,
      model: patch.model ?? existing.equipment.model,
      serialNumber: patch.serialNumber ?? existing.equipment.serialNumber,
      status: patch.status ?? existing.equipment.status,
      notes: patch.notes ?? existing.equipment.notes,
    },
    rule: {
      intervalDays: patch.intervalDays ?? existing.rule?.intervalDays ?? 365,
      graceDays: patch.graceDays ?? existing.rule?.graceDays ?? 0,
      lastCalibratedAt: patch.lastCalibratedAt ?? existing.rule?.lastCalibratedAt ?? null,
    },
  };

  const nextDueAt = computeNextDue(merged.rule.lastCalibratedAt, merged.rule.intervalDays);
  const ts = nowIso();

  const tx = db.transaction(() => {
    db.prepare(
      `
      UPDATE equipment
      SET name = ?, barcode_value = ?, asset_tag = ?, location = ?, model = ?, serial_number = ?, status = ?, notes = ?, updated_at = ?
      WHERE id = ?
      `,
    ).run(
      merged.equipment.name,
      merged.equipment.barcodeValue,
      merged.equipment.assetTag ?? null,
      merged.equipment.location ?? null,
      merged.equipment.model ?? null,
      merged.equipment.serialNumber ?? null,
      merged.equipment.status,
      merged.equipment.notes ?? null,
      ts,
      id,
    );

    db.prepare(
      `
      UPDATE calibration_rules
      SET interval_days = ?, grace_days = ?, last_calibrated_at = ?, next_due_at = ?
      WHERE equipment_id = ?
      `,
    ).run(merged.rule.intervalDays, merged.rule.graceDays, merged.rule.lastCalibratedAt, nextDueAt, id);
  });

  tx();
  return getEquipment(db, id);
}

export function addCalibrationEvent(db: Db, input: { equipmentId: string; calibratedAt: string; performedByUserId: string; notes?: string | null }) {
  const existing = getEquipment(db, input.equipmentId);
  if (!existing || !existing.rule) return null;
  const evId = newId();
  const ts = nowIso();
  const nextDueAt = computeNextDue(input.calibratedAt, existing.rule.intervalDays);

  const tx = db.transaction(() => {
    db.prepare(
      `
      INSERT INTO calibration_events (id, equipment_id, calibrated_at, performed_by_user_id, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
    ).run(evId, input.equipmentId, input.calibratedAt, input.performedByUserId, input.notes ?? null, ts);

    db.prepare(
      `
      UPDATE calibration_rules
      SET last_calibrated_at = ?, next_due_at = ?
      WHERE equipment_id = ?
      `,
    ).run(input.calibratedAt, nextDueAt, input.equipmentId);
  });

  tx();
  return getEquipment(db, input.equipmentId);
}

