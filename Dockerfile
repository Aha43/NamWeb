# Container image for the NamWeb remote MCP server (mcp/server.ts) — the P4b hosting artifact
# (design: docs/features/remote-mcp/design.md). It runs the existing Express + @modelcontextprotocol/sdk
# app via `tsx` (no build step), exactly like `npm run mcp` does locally.
#
# This is deliberately a FULL install (dev deps included): the server's own runtime deps — `tsx` and
# `@modelcontextprotocol/sdk` — are currently devDependencies of the shared SPA package.json, and
# `express`/`zod` resolve transitively. A lean image (`npm ci --omit=dev` + the server declaring its
# own deps) rides with the shared-core package extraction (design P4); kept out of here so standing
# the server up doesn't touch the working app.
FROM node:24-slim

WORKDIR /app

# Install against the exact lockfile first (cached until deps change). Full install — see header.
COPY package.json package-lock.json ./
RUN npm ci

# The server + the React-free domain/sync/store/lib core it imports at runtime, plus the tsconfig
# (tsx reads its `@/*` path mapping to resolve the core's internal imports). No .env — all
# configuration comes from the host environment at run time.
COPY tsconfig*.json ./
COPY mcp ./mcp
COPY src ./src

# Config is entirely via env: NAM_MCP_* (EMAIL/PASSWORD or OAuth), VITE_SUPABASE_URL /
# VITE_SUPABASE_PUBLISHABLE_KEY, VITE_WORKSPACE_NAME, NAM_MCP_DATABASE_URL (persistent OAuth store),
# NAM_MCP_ISSUER_URL (public https origin). Never set NAM_MCP_DEV_NOAUTH in production.
# The server listens on NAM_MCP_PORT (default 3333) — map/expose that to your host's port.
# Bake the deploy's git short-SHA so the server can advertise its build in get_workspace_context
# (serverVersion → `<version>+<sha>`, #1099/#1097) — lets a client detect it cached a stale tool list
# after a deploy. Passed by `npm run mcp:deploy`; empty on a plain `fly deploy` (→ bare version).
ARG NAM_MCP_BUILD=""
ENV NAM_MCP_BUILD=$NAM_MCP_BUILD

ENV NODE_ENV=production
EXPOSE 3333
CMD ["npx", "tsx", "mcp/server.ts"]
