import type { Db } from './db.js';
import { newId, nowIso } from './db.js';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'password_reset'
  | 'user_created'
  | 'user_updated'
  | 'calibration_added';

export function logAudit(
  db: Db,
  userId: string,
  action: AuditAction,
  entityType: string,
  entityId: string | null = null,
  changes: Record<string, any> | null = null,
  ipAddress: string | null = null,
) {
  db.prepare(
    `
    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, changes, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    newId(),
    userId,
    action,
    entityType,
    entityId,
    changes ? JSON.stringify(changes) : null,
    ipAddress,
    nowIso(),
  );
}

export function getAuditLogs(
  db: Db,
  limit: number = 100,
  offset: number = 0,
  filters?: { userId?: string; entityType?: string; action?: string },
) {
  let query = `
    SELECT 
      id, user_id, action, entity_type, entity_id, changes, ip_address, created_at,
      (SELECT email FROM users WHERE id = audit_logs.user_id) as user_email
    FROM audit_logs
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filters?.userId) {
    query += ` AND user_id = ?`;
    params.push(filters.userId);
  }
  if (filters?.entityType) {
    query += ` AND entity_type = ?`;
    params.push(filters.entityType);
  }
  if (filters?.action) {
    query += ` AND action = ?`;
    params.push(filters.action);
  }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = db.prepare(query).all(...params) as Array<{
    id: string;
    user_id: string;
    user_email: string | null;
    action: AuditAction;
    entity_type: string;
    entity_id: string | null;
    changes: string | null;
    ip_address: string | null;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    changes: row.changes ? JSON.parse(row.changes) : null,
    ipAddress: row.ip_address,
    createdAt: row.created_at,
  }));
}

export function getAuditLogsForEntity(db: Db, entityType: string, entityId: string, limit: number = 50) {
  return getAuditLogs(db, limit, 0, { entityType, action: undefined }).filter(
    (log) => log.entityId === entityId,
  );
}
