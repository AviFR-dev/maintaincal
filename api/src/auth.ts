import type { FastifyInstance, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import type { Db } from './db.js';
import type { PublicUser, Role } from './types.js';
import { newId, nowIso } from './db.js';
import { logAudit } from './audit.js';
import { checkRateLimit, resetRateLimit } from './rate-limiter.js';

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

// Password must be at least 8 chars, contain uppercase, lowercase, number
export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain a lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain a number');
  return { valid: errors.length === 0, errors };
}

export async function createPasswordResetToken(db: Db, email: string): Promise<string | null> {
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
  if (!user) return null;

  const token = randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(token, 10);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

  db.prepare(
    `
    INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
    `,
  ).run(newId(), user.id, tokenHash, expiresAt, nowIso());

  return token;
}

export async function resetPasswordWithToken(db: Db, email: string, token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  const validation = validatePasswordStrength(newPassword);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join('; ') };
  }

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
  if (!user) return { success: false, error: 'User not found' };

  const resetToken = db
    .prepare(
      `
    SELECT token_hash, expires_at FROM password_reset_tokens
    WHERE user_id = ? AND expires_at > datetime('now')
    ORDER BY created_at DESC
    LIMIT 1
    `,
    )
    .get(user.id) as { token_hash: string; expires_at: string } | undefined;

  if (!resetToken) {
    return { success: false, error: 'Invalid or expired reset token' };
  }

  const tokenValid = await bcrypt.compare(token, resetToken.token_hash);
  if (!tokenValid) {
    return { success: false, error: 'Invalid or expired reset token' };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);

  // Clean up used token
  db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);

  logAudit(db, user.id, 'password_reset', 'user', user.id, { via: 'reset_token' });

  return { success: true };
}

export function registerAuthRoutes(app: FastifyInstance, db: Db) {
  app.post('/auth/login', async (req, reply) => {
    const ipAddress = req.ip;
    
    // Rate limiting: 5 attempts per 15 minutes per IP
    if (!checkRateLimit(`login:${ipAddress}`, 5, 15 * 60 * 1000)) {
      logAudit(db, 'system', 'login', 'user', null, { reason: 'rate_limit_exceeded' }, ipAddress);
      return reply.code(429).send({ error: 'Too many login attempts. Please try again later.' });
    }

    const body = loginBodySchema.parse(req.body);
    const row = db
      .prepare('SELECT id, email, password_hash, role FROM users WHERE email = ?')
      .get(body.email) as { id: string; email: string; password_hash: string; role: Role } | undefined;

    if (!row) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    
    const ok = await bcrypt.compare(body.password, row.password_hash);
    if (!ok) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const user: PublicUser = { id: row.id, email: row.email, role: row.role };
    req.session.user = user;
    resetRateLimit(`login:${ipAddress}`);
    logAudit(db, row.id, 'login', 'user', row.id, {}, req.ip);
    return reply.send({ user });
  });

  app.post('/auth/logout', async (req, reply) => {
    const user = req.session.user;
    await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
    if (user) {
      logAudit(db, user.id, 'logout', 'user', user.id, {}, req.ip);
    }
    return reply.send({ ok: true });
  });

  app.post('/auth/forgot-password', async (req, reply) => {
    const ipAddress = req.ip;
    
    // Rate limiting: 3 password reset requests per 1 hour per IP
    if (!checkRateLimit(`forgot-password:${ipAddress}`, 3, 60 * 60 * 1000)) {
      return reply.code(429).send({ error: 'Too many password reset requests. Please try again later.' });
    }

    const body = z.object({ email: z.string().email() }).parse(req.body);
    const token = await createPasswordResetToken(db, body.email);
    // Never reveal if email exists for security
    return reply.send({ message: 'If the email exists, a reset link will be sent.' });
  });

  app.post('/auth/reset-password', async (req, reply) => {
    const body = z
      .object({
        email: z.string().email(),
        token: z.string().min(1),
        newPassword: z.string().min(8),
      })
      .parse(req.body);

    const result = await resetPasswordWithToken(db, body.email, body.token, body.newPassword);
    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }
    return reply.send({ ok: true });
  });

  app.get('/me', async (req) => {
    return { user: req.session.user ?? null };
  });
}

