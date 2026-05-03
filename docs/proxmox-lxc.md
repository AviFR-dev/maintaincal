# Proxmox (Unprivileged LXC) deployment

This guide deploys MaintainCal into an **unprivileged LXC** running Docker Compose, optimized for **snapshots + Proxmox backups**.

## 1) Create the LXC

- **Type**: Unprivileged container
- **OS**: Debian 12 / Ubuntu 22.04+ recommended
- **CPU/RAM**: 1–2 vCPU, 1–2 GB RAM is fine for small labs
- **Disk**: Put the LXC disk on your ZFS/local storage
- **Network**: Static IP or DHCP reservation (recommended)

### Required LXC options (Docker-in-LXC)
In Proxmox, set:
- **Features**: `nesting=1`, `keyctl=1`
- Optional (if you run into permissions issues): allow `fuse=1`

## 2) Inside the container: install Docker + Compose

Install Docker Engine + Compose using the official docs for your distro.

Verify:
- `docker version`
- `docker compose version`

## 3) Create persistent directories (bind mounts)

We keep state outside containers in `/var/lib/maintaincal` so Proxmox backups/snapshots capture everything.

Create:
- `/var/lib/maintaincal/data` (SQLite DB)
- `/var/lib/maintaincal/caddy/data` and `/var/lib/maintaincal/caddy/config` (TLS and config)

## 4) Configure environment

On the LXC, in the repo root:

- Copy `.env.example` → `.env`
- Set:
  - `MAINTAINCAL_HOST` (example: `maintaincal.lan`)
  - `SESSION_SECRET` (>= 32 chars, unique)
  - `ADMIN_EMAIL` / `ADMIN_PASSWORD`
  - `ORIGIN=https://maintaincal.lan`
  - `VITE_API_BASE=https://maintaincal.lan/api`

## 5) Run the stack

From the repo root:

```bash
docker compose --env-file .env -f docker-compose.proxmox.yml up -d --build
```

### What you get
- HTTPS entrypoint (Caddy) on `:80` and `:443`
- Web UI behind `/`
- API behind `/api/*` (reverse proxied to the internal API)

## 6) Backups (recommended)

- **Proxmox snapshots** before upgrades: quick rollback.
- **Proxmox scheduled backups** for the LXC.
- Optional app-level DB export (nightly) as a second layer.

## 7) Updates

```bash
git pull
docker compose --env-file .env -f docker-compose.proxmox.yml up -d --build
```

If something goes wrong, rollback via snapshot/backup.

