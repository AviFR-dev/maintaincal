import { z } from 'zod';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import type { Db } from './db.js';
import { newId, nowIso } from './db.js';
import { requireRole } from './auth.js';
import type { Role } from './types.js';

const roleSchema = z.enum(['admin', 'user']);

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: roleSchema.default('user'),
});

const patchUserSchema = z
  .object({
    role: roleSchema.optional(),
    password: z.string().min(8).optional(),
  })
  .refine((v) => v.role || v.password, { message: 'No changes specified' });

export function registerAdminRoutes(app: FastifyInstance, db: Db) {
  app.get('/admin/users', async (req) => {
    requireRole(req, 'admin');
    const rows = db
      .prepare('SELECT id, email, role, created_at FROM users ORDER BY role DESC, email ASC')
      .all() as Array<{ id: string; email: string; role: Role; created_at: string }>;
    return {
      users: rows.map((r) => ({ id: r.id, email: r.email, role: r.role, createdAt: r.created_at })),
    };
  });

  app.post('/admin/users', async (req, reply) => {
    requireRole(req, 'admin');
    const body = createUserSchema.parse(req.body);
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(body.email) as { id: string } | undefined;
    if (exists) return reply.code(409).send({ error: 'Email already exists' });

    const passwordHash = await bcrypt.hash(body.password, 10);
    db.prepare('INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)').run(
      newId(),
      body.email,
      passwordHash,
      body.role,
      nowIso(),
    );
    return reply.code(201).send({ ok: true });
  });

  app.patch('/admin/users/:id', async (req, reply) => {
    const admin = requireRole(req, 'admin');
    const id = z.object({ id: z.string().min(1) }).parse(req.params).id;
    const patch = patchUserSchema.parse(req.body);

    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id) as { id: string } | undefined;
    if (!existing) return reply.code(404).send({ error: 'Not found' });

    if (id === admin.id && patch.role && patch.role !== 'admin') {
      return reply.code(400).send({ error: 'Cannot remove admin role from yourself' });
    }

    const tx = db.transaction(() => {
      if (patch.role) {
        db.prepare('UPDATE users SET role = ? WHERE id = ?').run(patch.role, id);
      }
      if (patch.password) {
        const passwordHash = bcrypt.hashSync(patch.password, 10);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
      }
    });
    tx();

    return { ok: true };
  });
}

