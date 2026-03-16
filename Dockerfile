FROM node:20-alpine AS base
WORKDIR /app

# Copy root package + lockfile + all workspace package.jsons
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/core/package.json ./packages/core/
COPY packages/skills/package.json ./packages/skills/
COPY packages/gateway/package.json ./packages/gateway/
COPY packages/channels/telegram/package.json ./packages/channels/telegram/
COPY packages/channels/discord/package.json ./packages/channels/discord/
COPY packages/server/package.json ./packages/server/
COPY packages/web/package.json ./packages/web/
RUN npm install --ignore-scripts

# Copy source
COPY tsconfig.json ./
COPY packages/ ./packages/

# Build all packages
FROM base AS builder
RUN npm run build

# ── Server image ─────────────────────────────────────────────
FROM node:20-alpine AS server
WORKDIR /app

# Copy root package.json for workspace resolution
COPY --from=builder /app/package.json ./

# shared
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/

# core
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/

# skills (+ SQL migrations which tsc doesn't copy)
COPY --from=builder /app/packages/skills/dist ./packages/skills/dist
COPY --from=builder /app/packages/skills/package.json ./packages/skills/
COPY --from=builder /app/packages/skills/src/model-management/repositories/pg/migrations ./packages/skills/dist/model-management/repositories/pg/migrations

# gateway
COPY --from=builder /app/packages/gateway/dist ./packages/gateway/dist
COPY --from=builder /app/packages/gateway/package.json ./packages/gateway/

# channels (optional — may have empty dist)
COPY --from=builder /app/packages/channels/telegram/package.json ./packages/channels/telegram/
COPY --from=builder /app/packages/channels/discord/package.json ./packages/channels/discord/

# server
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/package.json ./packages/server/

# web (static frontend)
COPY --from=builder /app/packages/web/dist ./packages/web/dist
COPY --from=builder /app/packages/web/package.json ./packages/web/

# Install production deps only
RUN npm install --omit=dev --ignore-scripts

EXPOSE 18789
CMD ["node", "packages/server/dist/index.js"]
