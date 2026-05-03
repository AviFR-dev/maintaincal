import type { FastifyInstance, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Db } from './db.js';
import type { PublicUser, Role } from './types.js';

declare module 'fastify' {
  interface Session {
    user?: PublicUser;
  }
}

export function requireAuth(req: FastifyRequest) {
  if (!req.session.user) {
    const err = new Error('Unauthorized');
    // @ts-expect-error Fastify error shape
    err.statusCode = 401;
    throw err;
  }
  return req.session.user;
}

export function requireRole(req: FastifyRequest, role: Role) {
  const user = requireAuth(req);
  if (user.role !== role) {
    const err = new Error('Forbidden');
    // @ts-expect-error Fastify error shape
    err.statusCode = 403;
    throw err;
  }
  return user;
}

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function registerAuthRoutes(app: FastifyInstance, db: Db) {
  app.post('/auth/login', async (req, reply) => {
    const body = loginBodySchema.parse(req.body);
    const row = db
      .prepare('SELECT id, email, password_hash, role FROM users WHERE email = ?')
      .get(body.email) as { id: string; email: string; password_hash: string; role: Role } | undefined;

    if (!row) return reply.code(401).send({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(body.password, row.password_hash);
    if (!ok) return reply.code(401).send({ error: 'Invalid credentials' });

    const user: PublicUser = { id: row.id, email: row.email, role: row.role };
    req.session.user = user;
    return reply.send({ user });
  });

  app.post('/auth/logout', async (req, reply) => {
    await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
    return reply.send({ ok: true });
  });

  app.get('/me', async (req) => {
    return { user: req.session.user ?? null };
  });
}

