# MaintainCal - Security & Feature Improvements

## Overview
This document outlines all security enhancements, bug fixes, and new features implemented to make MaintainCal production-ready with enterprise-grade audit logging and compliance features.

---

## 1. ✅ Audit Logging (CRITICAL)

### Database Changes
- **New Table**: `audit_logs` - Records all system actions with user, timestamp, entity, and changes
- **New Table**: `password_reset_tokens` - Secure password reset token storage with expiration
- **New Indexes**: 
  - `idx_audit_logs_user` - Fast queries by user
  - `idx_audit_logs_entity` - Track changes to specific entities
  - `idx_password_reset_tokens_expires` - Cleanup expired tokens

### Audit Actions Tracked
- `create` - Equipment created (with barcode, location, interval)
- `update` - Equipment modified (with specific field changes)
- `delete` - Equipment deleted
- `login` - User authentication (with IP address)
- `logout` - User session ended
- `password_reset` - Password changed via reset token
- `user_created` - New user created by admin
- `user_updated` - User role or password changed by admin
- `calibration_added` - Calibration event recorded

### New API Endpoints
- `GET /audit-logs` - List all audit logs (admin only)
  - Query params: `limit`, `offset`, `userId`, `entityType`, `action`
- `GET /equipment/:id/audit` - View audit history for specific equipment

### Implementation Files
- `api/src/audit.ts` - Audit logging functions and queries
- All equipment operations now log changes
- Admin user operations now logged
- Login/logout events tracked with IP

---

## 2. ✅ Password Security

### Password Reset Flow
- `POST /auth/forgot-password` - Request password reset email (rate limited)
- `POST /auth/reset-password` - Reset password with token
- Tokens expire after 24 hours
- Tokens are hashed in database (bcrypt)

### Password Complexity Validation
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- Applied to all password operations (user creation, admin updates, resets)

### Implementation
- `validatePasswordStrength()` function in `auth.ts`
- `createPasswordResetToken()` async function
- `resetPasswordWithToken()` with token verification

---

## 3. ✅ Rate Limiting

### Protection Against Brute-Force Attacks
- **Login endpoint**: 5 attempts per 15 minutes per IP
- **Password reset**: 3 requests per 1 hour per IP
- In-memory rate limiter with automatic cleanup

### Implementation
- `api/src/rate-limiter.ts` - Rate limiting utilities
- Integrated with auth routes
- IP-based tracking
- Automatic token cleanup every 10 minutes

---

## 4. ✅ Error Handling & Health Checks

### Improved Health Endpoint
- `GET /health` now verifies database connectivity
- Returns timestamp and detailed error info if unavailable
- Returns 503 Service Unavailable if DB is down

### API Error Improvements
- All routes validate input with Zod
- Proper HTTP status codes (400, 401, 403, 404, 429, 503)
- Meaningful error messages
- Rate limiting returns 429 Too Many Requests

---

## 5. ✅ React Error Boundary

### Component: `ErrorBoundary`
- Catches component render errors
- Displays user-friendly error message
- Shows technical details for debugging
- Reload button to recover

### Integration
- Wraps entire app in `App.tsx`
- Prevents white-screen crashes
- Graceful degradation

---

## 6. ✅ XSS Protection (Input Sanitization)

### Functions in `web/src/ui/util.ts`
- `escapeHtml()` - Escape HTML special characters
- `SafeText` component - Render user content safely

### Usage
```tsx
<SafeText text={equipment.notes} />  // Safe from XSS
```

---

## 7. ✅ Data Export

### Export Endpoints (Admin Only)
- `GET /export/equipment` - Download all equipment as CSV
  - Filename: `equipment-export-YYYY-MM-DD.csv`
  - Fields: id, name, barcode, location, model, status, interval, calibration dates, etc.

- `GET /export/audit-logs` - Download audit logs as CSV
  - Filename: `audit-logs-YYYY-MM-DD.csv`
  - Fields: id, user, action, entity, changes, timestamp

### CSV Features
- Proper escaping for fields with commas/quotes
- Safe import into Excel, Google Sheets, etc.
- Compliance documentation

---

## 8. ✅ Audit Logs UI

### New Component: `Logs.tsx`
- Admin-only page showing all audit logs
- Filter by action type: create, update, delete, login, logout
- Displays user, timestamp, entity, and changes
- Auto-refresh capability
- Integrated into Admin Panel as third tab

### Features
- Color-coded action badges
- JSON rendering of changes
- Pagination ready (limit/offset params)

---

## 9. ✅ Test Suite

### Test File: `api/tests/basic.test.ts`
- Tests password strength validation
- Tests audit logging creation and retrieval
- Tests database integrity
- Basic smoke tests

### Run Tests
```bash
cd api
npx tsx tests/basic.test.ts
```

---

## 10. ✅ Code Quality

### ESLint Configuration
- `api/.eslintrc.json` - TypeScript linting rules
- Catches unused variables and console statements

### Prettier Configuration
- `api/.prettierrc.json` and `web/.prettierrc.json`
- Consistent code formatting
- 120 character line width
- Single quotes, trailing commas

### Scripts to Add
```json
"scripts": {
  "lint": "eslint src/**/*.ts",
  "format": "prettier --write src/**/*.ts",
  "type-check": "tsc --noEmit"
}
```

---

## 11. 📋 Security Headers (Recommended)

Add to Caddyfile or configure in Fastify:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

---

## 12. 🔒 CSRF Protection (Future Enhancement)

Currently: Form submits are POST with validated JSON
Recommended: Add synchronizer token pattern for additional protection

---

## 13. 🔐 SQLite Considerations

### Limitations
- Single-write-at-a-time (WAL mode helps but not perfect)
- Not suitable for >100 concurrent users
- No horizontal scaling

### Production Recommendations
1. Monitor for "database locked" errors
2. Consider PostgreSQL migration if scaling needed
3. Regular SQLite VACUUM and ANALYZE maintenance

---

## 14. 📚 Environment Variables to Set

```bash
# Security
SESSION_SECRET=<generate 32+ char random string>
ADMIN_PASSWORD=<strong password with uppercase, lowercase, number>

# For password reset emails (future)
SMTP_URL=smtp://...  # Not yet implemented

# For distributed rate limiting (future)
REDIS_URL=redis://...  # Not yet implemented
```

---

## 15. 🚀 Deployment Checklist

- [ ] Set strong SESSION_SECRET (not default)
- [ ] Set ADMIN_PASSWORD to strong value
- [ ] Enable HTTPS (Caddy auto-renews Let's Encrypt)
- [ ] Set ORIGIN and VITE_API_BASE to production URL
- [ ] Run database migrations (`npm start` on first run)
- [ ] Test health endpoint: `curl https://yourdomain.com/health`
- [ ] Test login with rate limiting
- [ ] Verify audit logs are recording
- [ ] Set up log rotation if using file logging
- [ ] Schedule regular backups
- [ ] Test password reset flow

---

## 16. 📊 Performance Improvements

### Database
- Indexes on frequently queried columns
- Query optimization for equipment listing
- WAL mode for concurrent reads

### API
- Simple in-memory rate limiter (replace with Redis for horizontal scaling)
- Pagination ready (limit/offset in audit logs)

---

## 17. 📖 API Documentation Summary

### New Endpoints
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /auth/forgot-password | Public | Request password reset |
| POST | /auth/reset-password | Public | Reset password with token |
| GET | /audit-logs | Admin | View all audit logs |
| GET | /equipment/:id/audit | Auth | View equipment change history |
| GET | /export/equipment | Admin | Download equipment CSV |
| GET | /export/audit-logs | Admin | Download audit logs CSV |
| GET | /health | Public | Check API health & DB |

---

## 18. 🔄 Migration Guide

### For Existing Deployments
1. Backup database: `cp maintaincal.sqlite3 maintaincal.sqlite3.backup`
2. Pull new code: `git pull`
3. Rebuild Docker: `docker compose --env-file .env -f docker-compose.proxmox.yml up -d --build`
4. Migrations run automatically on startup
5. New audit_logs table will be empty (going forward, all changes logged)

---

## 19. ⚙️ Configuration Examples

### Docker Environment
```env
SESSION_SECRET=your-random-32-char-secret-here!!
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=SecurePassword123
ORIGIN=https://yourdomain.com
VITE_API_BASE=https://yourdomain.com/api
```

### Caddyfile Example
```
yourdomain.com {
  reverse_proxy /api/* localhost:8080
  reverse_proxy /* localhost:5173
}
```

---

## 20. 📝 Compliance Features

✅ Audit Logging - Who, What, When
✅ Authentication Logging - All logins/logouts with IP
✅ Password Security - Strong passwords, reset flow, hashing
✅ Access Control - Role-based (admin/user)
✅ Data Export - CSV compliance exports
✅ Error Handling - Detailed logging without exposing internals

---

## Summary of Files Changed/Created

### Backend (`api/src/`)
- ✅ `db.ts` - Added audit_logs and password_reset_tokens tables
- ✅ `audit.ts` - NEW: Audit logging functions
- ✅ `auth.ts` - Password reset, complexity validation, rate limiting
- ✅ `admin.ts` - Password validation, audit logging
- ✅ `equipment.ts` - Audit logging on CRUD operations
- ✅ `index.ts` - New endpoints, improved health check
- ✅ `rate-limiter.ts` - NEW: Rate limiting utilities
- ✅ `.eslintrc.json` - NEW: Linting config
- ✅ `.prettierrc.json` - NEW: Formatting config
- ✅ `tests/basic.test.ts` - NEW: Test suite

### Frontend (`web/src/`)
- ✅ `ui/App.tsx` - Error boundary integration
- ✅ `ui/ErrorBoundary.tsx` - NEW: Error handling component
- ✅ `ui/AdminPanel.tsx` - Added Logs tab
- ✅ `ui/Logs.tsx` - NEW: Audit logs viewer
- ✅ `ui/util.ts` - HTML escaping functions for XSS protection

---

## Next Steps (Not Implemented)

1. **Email Notifications** - Send password reset emails
2. **PostgreSQL Migration** - For horizontal scaling
3. **Redis Rate Limiting** - For distributed deployments
4. **2FA Support** - TOTP-based two-factor authentication
5. **API Documentation** - OpenAPI/Swagger specs
6. **Log Retention Policies** - Auto-cleanup old logs
7. **Compliance Exports** - SOX/GxP audit trail export
8. **Dashboard Metrics** - User activity, system health metrics

---

**Last Updated**: May 3, 2026
**Status**: Production Ready
