import { strict as assert } from 'node:assert';
import { openDb, migrate, newId, nowIso } from '../src/db.js';
import { validatePasswordStrength } from '../src/auth.js';
import { logAudit, getAuditLogs } from '../src/audit.js';

// Create in-memory test database
const db = openDb(':memory:');
migrate(db);

// Test: Password validation
console.log('Testing password strength validation...');
const weakPwd = validatePasswordStrength('weak');
assert.equal(weakPwd.valid, false);
assert(weakPwd.errors.length > 0);

const strongPwd = validatePasswordStrength('SecurePassword123');
assert.equal(strongPwd.valid, true);
assert.equal(strongPwd.errors.length, 0);
console.log('✓ Password validation works');

// Test: Audit logging
console.log('Testing audit logging...');
const testUserId = newId();
db.prepare(
  'INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
).run(testUserId, 'test@example.com', 'hash', 'user', nowIso());

logAudit(db, testUserId, 'create', 'test', newId(), { test: true }, '127.0.0.1');
const logs = getAuditLogs(db, 10, 0, { userId: testUserId });
assert.equal(logs.length, 1);
assert.equal(logs[0].action, 'create');
assert.equal(logs[0].entityType, 'test');
console.log('✓ Audit logging works');

// Test: Database integrity
console.log('Testing database integrity...');
const users = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
assert.equal(users.count, 1);
console.log('✓ Database integrity verified');

console.log('\n✅ All tests passed!');
