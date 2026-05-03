import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { openDb, migrate, nowIso, newId } from './db.js';
import { registerAuthRoutes, requireAuth, requireRole } from './auth.js';
import {
  addCalibrationEvent,
  createEquipment,
  equipmentCreateSchema,
  equipmentPatchSchema,
  findByBarcode,
  getEquipment,
  listDistinctLocations,
  listDistinctModels,
  listEquipment,
  patchEquipment,
} from './equipment.js';
import { registerAdminRoutes } from './admin.js';
import { getAuditLogs, logAudit } from './audit.js';

const env = z
  .object({
    NODE_ENV: z.string().optional(),
    PORT: z.string().optional(),
    DATABASE_PATH: z.string().default('maintaincal.sqlite3'),
    SESSION_SECRET: z.string().min(32).default('dev-session-secret-change-me-32chars!!'),
    ORIGIN: z.string().optional(),
    ADMIN_EMAIL: z.string().email().default('admin@example.com'),
    ADMIN_PASSWORD: z.string().min(8).default('admin1234'),
  })
  .parse(process.env);

const app = Fastify({ logger: true });
const db = openDb(env.DATABASE_PATH);
migrate(db);

await app.register(cors, {
  origin: env.ORIGIN ? [env.ORIGIN] : true,
  credentials: true,
});

await app.register(cookie);
await app.register(session, {
  secret: env.SESSION_SECRET,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
  },
  saveUninitialized: false,
});

// bootstrap admin (idempotent)
const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(env.ADMIN_EMAIL) as { id: string } | undefined;
if (!existingAdmin) {
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
  db.prepare('INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)').run(
    newId(),
    env.ADMIN_EMAIL,
    passwordHash,
    'admin',
    nowIso(),
  );
  app.log.info({ email: env.ADMIN_EMAIL }, 'Seeded admin user');
}

app.get('/health', async (reply) => {
  try {
    // Check database connectivity
    db.prepare('SELECT 1').get();
    return { ok: true, timestamp: nowIso() };
  } catch (e) {
    reply.code(503);
    return { ok: false, error: 'Database unavailable' };
  }
});

registerAuthRoutes(app, db);
registerAdminRoutes(app, db);

app.get('/equipment', async (req) => {
  requireAuth(req);
  const querySchema = z.object({
    search: z.string().optional(),
    location: z.string().optional(),
    status: z.enum(['active', 'retired']).optional(),
    model: z.string().optional(),
    due: z.enum(['overdue', 'dueSoon']).optional(),
    dueSoonDays: z.coerce.number().int().positive().optional(),
  });
  const q = querySchema.parse(req.query);
  return { items: listEquipment(db, q) };
});

app.get('/equipment/meta', async (req) => {
  requireAuth(req);
  return {
    locations: listDistinctLocations(db),
    models: listDistinctModels(db),
    statuses: ['active', 'retired'],
  };
});

app.get('/equipment/:id', async (req, reply) => {
  requireAuth(req);
  const id = z.object({ id: z.string().min(1) }).parse(req.params).id;
  const item = getEquipment(db, id);
  if (!item) return reply.code(404).send({ error: 'Not found' });
  return item;
});

app.get('/equipment/by-barcode/:value', async (req, reply) => {
  requireAuth(req);
  const value = z.object({ value: z.string().min(1) }).parse(req.params).value;
  const item = findByBarcode(db, value);
  if (!item) return reply.code(404).send({ error: 'Not found' });
  return item;
});

app.post('/equipment', async (req) => {
  const user = requireRole(req, 'admin');
  const body = equipmentCreateSchema.parse(req.body);
  return createEquipment(db, body, user.id);
});

app.patch('/equipment/:id', async (req, reply) => {
  const user = requireRole(req, 'admin');
  const id = z.object({ id: z.string().min(1) }).parse(req.params).id;
  const body = equipmentPatchSchema.parse(req.body);
  const updated = patchEquipment(db, id, body, user.id);
  if (!updated) return reply.code(404).send({ error: 'Not found' });
  return updated;
});

app.post('/equipment/:id/calibration-events', async (req, reply) => {
  const user = requireAuth(req);
  const id = z.object({ id: z.string().min(1) }).parse(req.params).id;
  const body = z
    .object({
      calibratedAt: z.string().datetime(),
      notes: z.string().optional().nullable(),
    })
    .parse(req.body);
  const updated = addCalibrationEvent(db, { equipmentId: id, calibratedAt: body.calibratedAt, performedByUserId: user.id, notes: body.notes });
  if (!updated) return reply.code(404).send({ error: 'Not found' });
  return updated;
});

app.get('/audit-logs', async (req) => {
  requireRole(req, 'admin');
  const querySchema = z.object({
    limit: z.coerce.number().int().positive().default(100),
    offset: z.coerce.number().int().nonnegative().default(0),
    userId: z.string().optional(),
    entityType: z.string().optional(),
    action: z.string().optional(),
  });
  const q = querySchema.parse(req.query);
  const logs = getAuditLogs(db, q.limit, q.offset, {
    userId: q.userId,
    entityType: q.entityType,
    action: q.action as any,
  });
  return { logs };
});

app.get('/equipment/:id/audit', async (req, reply) => {
  requireAuth(req);
  const id = z.object({ id: z.string().min(1) }).parse(req.params).id;
  const equipment = getEquipment(db, id);
  if (!equipment) return reply.code(404).send({ error: 'Not found' });
  
  const logs = getAuditLogs(db, 50, 0, { entityType: 'equipment' }).filter(log => log.entityId === id);
  return { logs };
});

app.get('/export/equipment', async (req, reply) => {
  requireRole(req, 'admin');
  const equipment = listEquipment(db, {});
  const csv = `id,name,barcode,assetTag,location,model,serialNumber,status,intervalDays,lastCalibratedAt,nextDueAt,updatedAt
${equipment.map(e => [
    e.id,
    `"${e.name.replace(/"/g, '""')}"`,
    e.barcodeValue,
    e.assetTag ? `"${e.assetTag.replace(/"/g, '""')}"` : '',
    e.location ? `"${e.location.replace(/"/g, '""')}"` : '',
    e.model ? `"${e.model.replace(/"/g, '""')}"` : '',
    e.serialNumber ? `"${e.serialNumber.replace(/"/g, '""')}"` : '',
    e.status,
    e.intervalDays,
    e.lastCalibratedAt || '',
    e.nextDueAt || '',
    e.updatedAt,
  ].join(',')).join('\n')}`;
  
  reply.header('Content-Type', 'text/csv');
  reply.header('Content-Disposition', `attachment; filename="equipment-export-${nowIso().split('T')[0]}.csv"`);
  return reply.send(csv);
});

app.get('/export/audit-logs', async (req, reply) => {
  requireRole(req, 'admin');
  const logs = getAuditLogs(db, 10000, 0);
  const csv = `id,user,action,entity,entityId,changes,timestamp
${logs.map(l => [
    l.id,
    `"${l.userEmail?.replace(/"/g, '""') || 'unknown'}"`,
    l.action,
    l.entityType,
    l.entityId || '',
    l.changes ? `"${JSON.stringify(l.changes).replace(/"/g, '""')}"` : '',
    l.createdAt,
  ].join(',')).join('\n')}`;
  
  reply.header('Content-Type', 'text/csv');
  reply.header('Content-Disposition', `attachment; filename="audit-logs-${nowIso().split('T')[0]}.csv"`);
  return reply.send(csv);
});

const port = Number(env.PORT ?? '8080');
await app.listen({ port, host: '0.0.0.0' });

