# Deploying the remote MCP server (Fly.io)

The runbook for hosting `mcp/server.ts` as an always-on OAuth 2.1 server + MCP endpoint. It runs the
existing Express + MCP-SDK app from the repo `Dockerfile` (no build step). Config is entirely via
environment secrets — nothing sensitive is committed.

> **Prerequisite:** the pre-deploy security hardening (epic #1055) is merged. Do not host without it.

Host is **Fly.io** here (a small always-on Node service — see `design.md`, "Hosting decision — P4b").
Railway is an equivalent swap; the env contract below is identical.

## What you reuse vs. what's new

- **Reused — your existing Supabase.** User sign-in uses the same project URL + publishable key as the
  SPA. The OAuth token store lives in the **same Supabase Postgres**, in an isolated `mcp` schema that
  the server creates automatically on first boot (`mcp/db/pool.ts`, `mcp/db/schema.sql`). No second
  database.
- **New — the Fly.io app.** A long-running Node process, HTTPS on a stable origin, and secret storage.

In production **each connecting user logs in themselves** (OAuth), so the server never holds anyone's
Supabase password — unlike the local `NAM_MCP_DEV_NOAUTH` dev mode.

## Environment (set as Fly secrets — never committed)

| Secret | Required | What it is / where to get it |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | yes | Supabase → Project Settings → API → Project URL (same as the SPA). |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | yes | Supabase → Project Settings → API → publishable/anon key (same as the SPA). |
| `NAM_MCP_DATABASE_URL` | yes | Supabase → Project Settings → Database → Connection string. Use the **Session pooler** URI for a hosted service. Server-only. The `mcp` schema is created here. |
| `NAM_MCP_ENCRYPTION_KEY` | yes | 32-byte key that encrypts stored Supabase sessions at rest. Generate with `openssl rand -hex 32`. Losing/rotating it invalidates existing grants (users re-connect). |
| `NAM_MCP_ISSUER_URL` | yes | The public origin, e.g. `https://nam-mcp.fly.dev`. The OAuth metadata advertises this — it must equal the URL clients reach. |
| `NAM_MCP_ALLOWED_REDIRECT_ORIGINS` | yes (prod) | Comma-separated origins a client may send the auth code to, e.g. `https://claude.ai`. Fail-closed: with this unset in an https context, **all** client registrations are refused. |
| `NAM_MCP_TRUST_PROXY` | recommended | Proxy hop count. `1` for Fly's single edge proxy — makes `req.ip` the real client (needed for the sign-in rate-limit; do NOT use `true`). |
| `NAM_MCP_GRANT_TTL_DAYS` | optional | Sliding grant lifetime; default `30`. |
| `NAM_MCP_PORT` | optional | Container listen port; default `3333` (matches `fly.toml` `internal_port`). |

**Never set `NAM_MCP_DEV_NOAUTH` in production** — the server refuses to boot with it in an https
context, but don't rely on that.

`NAM_MCP_EMAIL` / `NAM_MCP_PASSWORD` are **only** for local dev-noauth mode — not used here.

## Steps

### 1. CLI ready (one-time)

```bash
brew install flyctl        # macOS
fly auth login
fly auth whoami            # confirms you're authenticated
```

### 2. Create the app (no deploy yet)

From the repo root (this `fly.toml` + the `Dockerfile` are picked up automatically):

```bash
fly launch --no-deploy
```

- Keep the existing config when prompted. If the app name `nam-mcp` is taken, edit the `app =` line in
  `fly.toml` to something unique (e.g. `nam-mcp-<yourname>`) and re-run.
- This is where Fly asks for a **payment method** if you haven't added one (≈ $2–5/mo for one small VM).

### 3. Set the secrets

Fill in your values (the `\` line-continuations make one command):

```bash
fly secrets set \
  VITE_SUPABASE_URL="https://YOUR-PROJECT.supabase.co" \
  VITE_SUPABASE_PUBLISHABLE_KEY="YOUR-PUBLISHABLE-KEY" \
  NAM_MCP_DATABASE_URL="postgresql://postgres.YOUR-REF:PASSWORD@aws-...pooler.supabase.com:5432/postgres" \
  NAM_MCP_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  NAM_MCP_ISSUER_URL="https://nam-mcp.fly.dev" \
  NAM_MCP_ALLOWED_REDIRECT_ORIGINS="https://claude.ai" \
  NAM_MCP_TRUST_PROXY="1"
```

- Set `NAM_MCP_ISSUER_URL` to your actual app URL (`fly info` shows the hostname). Start with the free
  `*.fly.dev` domain; a custom domain is an optional later step (`fly certs`).
- Generate `NAM_MCP_ENCRYPTION_KEY` on your own machine so the raw key never leaves it. Keep a copy in
  your password manager — you'll need it if you ever recreate the app.

### 4. Deploy

```bash
fly deploy
fly logs
```

In the logs you want to see:

```
OAuth store: Postgres (mcp schema) — persistent, sessions encrypted at rest.
NamWeb MCP (read + write, OAuth) on 0.0.0.0:3333/mcp
```

Sanity-check the public origin serves OAuth metadata:

```bash
curl https://nam-mcp.fly.dev/.well-known/oauth-authorization-server
```

### 5. Connect a client

In **Claude → Settings → Connectors → Add custom connector**, enter `https://nam-mcp.fly.dev/mcp`.
The flow: the connector self-registers (DCR) → you land on the server's Supabase sign-in page → you
pick your workspace → `/mcp` is gated to your session. (ChatGPT: add it as a developer connector; same
flow.)

If registration is **refused**, the logs print the redirect origin the client actually used — add it to
`NAM_MCP_ALLOWED_REDIRECT_ORIGINS` and redeploy:

```bash
fly secrets set NAM_MCP_ALLOWED_REDIRECT_ORIGINS="https://claude.ai,https://<the-logged-origin>"
```

### 6. Smoke test

1. Ask the AI to list your projects (read tools) — confirms read + RLS scoping to your workspace.
2. Ask it to create a small project / next action (write tools) — confirms writes commit through
   `commitIntent`.
3. Restart to prove persistence: `fly apps restart <app>` — your connection keeps working (tokens
   survived because they're in Postgres, not memory).

## Operations

- **Redeploy:** `fly deploy` (after `git pull` of new `mcp/` code).
- **Rotate a secret:** `fly secrets set NAME=...` triggers a rolling restart.
- **Scale:** keep **one** machine. The sign-in rate-limiters are per-process (`mcp/auth/rateLimit.ts`);
  going multi-instance needs a shared limiter store first. `fly.toml` pins `min_machines_running = 1`
  and `auto_stop_machines = "off"`.
- **Costs:** one `shared-cpu-1x` / 512MB machine, always on ≈ a few $/mo; Supabase usage is unchanged.

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Boots but warns `OAuth store: in-memory` | `NAM_MCP_DATABASE_URL` not set — tokens won't survive restarts. Set it. |
| Startup error from `loadEncryptionKey` | `NAM_MCP_ENCRYPTION_KEY` missing or not 64 hex chars / valid base64. Regenerate with `openssl rand -hex 32`. |
| All client registrations refused | `NAM_MCP_ALLOWED_REDIRECT_ORIGINS` unset or missing the client's origin (see step 5). |
| Sign-in rate-limit trips too early / never | `NAM_MCP_TRUST_PROXY` wrong for the host. Fly = `1`. Never `true`. |
| DB connection errors | Use the **Session pooler** connection string from Supabase (not the direct IPv6 host); ensure the password is URL-encoded. |
| OAuth metadata shows `http://` or wrong host | `NAM_MCP_ISSUER_URL` doesn't match the public origin. Set it to the exact `https://…` URL. |
