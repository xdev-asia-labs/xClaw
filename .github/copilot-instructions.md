# xClaw AI Agent Platform — Copilot Instructions

## Project Overview

xClaw is a TypeScript monorepo (npm workspaces) for a general-purpose multi-industry AI agent platform with plugin-based skills, multi-channel messaging, RBAC, multi-tenant architecture, and dual-database design. Communication may be in Vietnamese.

## Monorepo Structure

- `packages/shared` — Foundation types (`@xclaw/shared`), imported by every other package
- `packages/core` — Agent engine, SkillManager, ToolRegistry, LLM, memory, workflow
- `packages/db` — Dual-database layer: Drizzle ORM (PostgreSQL) + MongoDB driver
- `packages/skills` — Built-in skills using `defineSkill()` helper
- `packages/gateway` — Hono HTTP server, REST API, auth, RBAC, tenant middleware
- `packages/server` — Standalone server entry point (migrations → MongoDB → seed on startup)
- `packages/cli` — CLI via commander.js
- `packages/skill-hub` — Marketplace service, Anthropic/MCP adapters
- `packages/web` — React + Tailwind frontend (Vite, zustand, lucide-react)
- `packages/channels/*` — Channel plugins (Telegram, Discord)
- `packages/integrations` — 8 built-in integrations (Gmail, GitHub, Notion, Slack, etc.)
- `packages/domains` — 12 domain packs (general, developer, healthcare, finance, etc.)
- `packages/ml` — Machine learning utilities
- `data/knowledge-packs/*` — Data-only plugin packages

### Git Submodules

- `xclaw-plugins/` — Official plugins (ShirtGen.AI, Healthcare) → [xdev-asia-labs/xclaw-plugins](https://github.com/xdev-asia-labs/xclaw-plugins)
- `his-mini/` — HIS-Mini demo integration app → [xdev-asia-labs/xclaw-demo-integration-app](https://github.com/xdev-asia-labs/xclaw-demo-integration-app)

Plugins are **not** inside `packages/`. They live in external repos linked as git submodules. Clone with `git clone --recurse-submodules`.

## Dual-Database Architecture

- **PostgreSQL 18** — Config/structured data via Drizzle ORM (13 tables): tenants, tenantSettings, users, roles, permissions, rolePermissions, userRoles, oauthAccounts, workflows, workflowExecutions, integrationConnections, webhooks, userDomainPreferences
- **MongoDB 7** — AI/conversational data (4 collections): sessions, messages, memory_entries, agent_configs. Messages and memory entries have `embedding?: number[]` fields for vector search/RAG
- **Redis 8** — Cache layer

## TypeScript Conventions

- **ESM only**: `"type": "module"` in all packages. Use `.js` extensions in relative imports
- **Target**: ES2022, `module: "NodeNext"`, `moduleResolution: "NodeNext"`
- **Strict mode**: `strict: true` in tsconfig
- **Project references**: Each package tsconfig uses `references` to declare dependencies
- **Barrel exports**: Each package has `src/index.ts` re-exporting public API

## Coding Patterns

- Define shared types/interfaces in `@xclaw/shared`, import with `import type { ... }`
- Skills use `defineSkill()` from `@xclaw/core`
- Gateway routes use Hono with `try/catch` and `err instanceof Error ? err.message : 'Failed'`
- State management: Zustand stores in `packages/web/src/stores/`
- Seed data must be **idempotent** — always check existence before inserting
- Startup sequence: `runMigrations()` → `connectMongo()` → `seedInitialData()`, each wrapped in try/catch
- Error handling: Only validate at system boundaries (user input, external APIs)

## Build & Test

- **Always use Docker Compose**: `docker compose up --build`
- Do NOT run `npm run build` or `npm test` directly on host
- View logs: `docker compose logs -f xclaw`
