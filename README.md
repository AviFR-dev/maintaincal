# maintaincal
Equipment calibration tracking web app with barcode scanning

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

