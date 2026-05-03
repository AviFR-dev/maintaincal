# maintaincal
Equipment calibration tracking web app with barcode scanning

**Now with audit logging, password reset, rate limiting, and compliance features!**

## Features

- 📋 Equipment CRUD with barcode support
- 📅 Calibration interval tracking with auto next-due dates
- 🔍 Barcode scanner integration
- 👥 User management with role-based access (admin/user)
- 📊 **Audit logs** - Track all changes with user/IP/timestamp
- 🔐 **Password reset** - User self-service recovery
- ⏱️ **Rate limiting** - Protection against brute-force attacks
- 📤 **Data export** - CSV export for compliance
- ✨ **Error handling** - Graceful error boundaries
- 🛡️ **XSS protection** - HTML escaping for user content

## Quick start (Docker)

1. Install Docker Desktop.
2. From repo root:

```bash
docker compose up -d --build
```

- Web UI: `http://localhost:5173`
- API: `http://localhost:8080/health`

### Default admin
- Email: `admin@example.com`
- Password: `admin1234`

## Proxmox (LXC) deployment

Use the Proxmox-optimized compose file `[docker-compose.proxmox.yml](docker-compose.proxmox.yml)` with a bind-mounted data directory at `/var/lib/maintaincal/` (easy backups via Proxmox/PBS).

See `[docs/proxmox-lxc.md](docs/proxmox-lxc.md)`.

## Local dev (no Docker)

### API
```bash
cd api
npm install
npm run dev
```

### Web
```bash
cd web
npm install
npm run dev
```

## Documentation

- **[IMPROVEMENTS.md](./IMPROVEMENTS.md)** - Security enhancements and new features (detailed)
- **[REBUILD_SUMMARY.md](./REBUILD_SUMMARY.md)** - What changed and why
- **[docs/proxmox-lxc.md](./docs/proxmox-lxc.md)** - Proxmox deployment guide

## Security Features

### Audit Logging
All user actions are logged to the database:
- Equipment created, updated, deleted
- User logins/logouts with IP address
- Admin user management actions
- Calibration records added

Access audit logs via:
- Admin Panel → Logs tab
- API: `GET /audit-logs`

### Password Management
- **Password Reset**: Users can self-service password recovery
- **Strong Passwords**: Minimum 8 chars, uppercase, lowercase, number
- **Rate Limiting**: Max 5 login attempts per 15 minutes per IP

### Data Protection
- **XSS Prevention**: User input escaped in React components
- **CSRF**: Input validation on all endpoints
- **Error Boundary**: Graceful handling of component errors

### Compliance
- CSV export of equipment and audit logs
- Complete change history per equipment
- User attribution for all changes
- IP tracking for security events

