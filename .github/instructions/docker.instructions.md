---
description: "Use when working with Docker, docker-compose, Dockerfile, deployment, or server startup in xClaw"
applyTo: ["docker-compose.yml", "Dockerfile", "packages/server/**"]
---
# Docker & Deployment Instructions

## Docker Compose Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| postgres | postgres:18-alpine | 5433:5432 | Config/structured data |
| mongodb | mongo:7 | 27018:27017 | AI/conversational data |
| redis | redis:8-alpine | 6379 | Cache |
| xclaw | built from Dockerfile | 3000 | API server |
| web | built from packages/web | 5173 | Frontend |

## Build & Run

```bash
git clone --recurse-submodules https://github.com/xdev-asia/xClaw.git
cd xClaw
docker compose up --build          # Build and start all
docker compose logs -f xclaw       # View server logs
docker compose down                # Stop all
```

- **Never** run `npm run build` or `npm test` directly on host
- Always use Docker Compose for consistency with production environment
- Clone with `--recurse-submodules` to include plugin and demo submodules

## Server Startup Sequence

In `packages/server/src/index.ts`, the startup order is:

1. `runMigrations()` — Apply pending PostgreSQL migrations
2. `connectMongo()` — Connect to MongoDB
3. `seedInitialData()` — Idempotent seed (tenant, roles, admin user)

Each step wrapped in try/catch so one failure doesn't crash the server.

## Dockerfile Notes

- Multi-stage build: `builder` stage runs `tsc -b` for each package
- Non-TS assets (SQL migrations) must be explicitly copied: `cp -r src/migrations dist/migrations`
- Final stage uses slim Node image with only `dist/` and `node_modules/`
- Plugins are in external submodules — not built as part of the main Dockerfile
