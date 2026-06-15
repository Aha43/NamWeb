# NamWeb remote MCP server — read + write, OAuth-gated

Lets the **ChatGPT / Claude web** surfaces read *and act on* your Nam workspace over MCP. This is the
**P0–P2** slice of the [remote-MCP epic](../docs/features/remote-mcp/design.md): read tools,
write tools, all **OAuth 2.1/PKCE-gated** so each request runs as the signed-in user under Supabase
RLS. It reuses NamWeb's React-free core directly — `pull()` + `domain/lenses` for reads, and domain
`Intent`s committed via `commitIntent` (version guard + conflict-replay) for writes.

> Phasing: P0 read-only · P1 OAuth 2.1/PKCE · **P2 write tools (here)** · P3 Realtime · P4 hosting.

## Read tools

`get_workspace_context`, `list_inbox`, `list_projects`, `list_next_actions`, `list_backlog`,
`list_done`, `list_saved_views`, `list_project_children`, `find_node`, `list_resources`.

## Write tools

`add_inbox_item`, `create_project` (top-level, or nested with `parent_id`), `add_action`,
`add_next_action`, `mark_next` / `mark_done` / `mark_backlog`, `update_node`, `update_tags`,
`move_node`, `delete_node` (leaf or recursive), `add_blocked_by` / `remove_blocked_by`,
`add_resource` / `remove_resource` / `edit_resource`.

Each maps to a domain `Intent` committed via `commitIntent`, so concurrent edits from the SPA or
another device never silently clobber. Human control is **connector-side per-write confirmation**
(both ChatGPT and Claude prompt before a tool runs); the server reuses the domain mutation invariants
(cycle/structural guards) and refuses to touch the four structural container nodes.

## Authentication (P1)

The server **is its own OAuth 2.1 Authorization Server**, backed by Supabase identity (see
`auth/`). A connector does the standard authorization-code + PKCE flow; `/authorize` shows a
Supabase email/password login page, and on success we issue opaque access/refresh tokens that map
to that user's Supabase session. Every MCP request then runs under their JWT, so `pull` is scoped
by `owner_user_id` RLS exactly as the SPA is. Dynamic Client Registration is supported, so
connectors self-register.

After sign-in the user **picks which workspace** the connection acts on (P4b): one workspace is used
automatically, several show a picker, none shows a "create one first" prompt. The choice is baked into
the token and used per request, so a connector is scoped to one workspace — reconnect to switch. (The
dev no-auth path still uses the `VITE_WORKSPACE_NAME` env.)

### OAuth state persistence (P4a)

By default, tokens and registered clients live in an **in-memory store** (`auth/stores.ts`) — a
restart drops them and connectors re-authorize. Set **`NAM_MCP_DATABASE_URL`** to persist them to an
**MCP-owned `mcp` Postgres schema** (`db/schema.sql`, created idempotently on startup; `pg`-backed
`PostgresAuthStore`) so clients/tokens survive restarts:

```bash
NAM_MCP_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run mcp
# → "OAuth store: Postgres (mcp schema) — persists across restarts."
```

The `mcp` schema is the AS's own bookkeeping, reached via a direct service-level connection (not the
user-JWT/RLS data plane) and **not exposed to PostgREST**, so these rows — which hold the user's
Supabase session at rest — stay off the public API surface. The consent pages are Nam-branded and
hardened (CSRF double-submit cookie on both form POSTs; in-memory per-IP rate limit on sign-in). The
actual deploy/host is the remaining **P4b** step.

## Run it

1. Have the Supabase stack the SPA targets running (the NamDesktop local stack, or a hosted
   project), with a workspace row to read.
2. In `.env` (copied from `.env.example`), set the MCP block — see `.env.example` for the full list.
3. Start it:
   ```bash
   npm run mcp
   ```
   → `NamWeb MCP (read-only, OAuth) on http://127.0.0.1:3333/mcp`

### Dev / Inspector escape hatch (no OAuth)

Set `NAM_MCP_DEV_NOAUTH=1` to skip OAuth entirely and serve one shared session signed in with
`NAM_MCP_EMAIL` / `NAM_MCP_PASSWORD` (the old P0 path). **Local only — never deploy this.** Useful
for the MCP Inspector or a quick `curl`.

## Verify locally

With `NAM_MCP_DEV_NOAUTH=1` (no auth), call it directly (stateless JSON responses are enabled):
```bash
curl -s http://127.0.0.1:3333/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

In OAuth mode, inspect the Authorization Server metadata and confirm `/mcp` is gated:
```bash
curl -s http://127.0.0.1:3333/.well-known/oauth-authorization-server | jq .
# A POST without a bearer token returns 401 + a WWW-Authenticate / resource-metadata pointer:
curl -i -s http://127.0.0.1:3333/mcp -X POST -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -n 1
```
The MCP Inspector (`npx @modelcontextprotocol/inspector`, transport *Streamable HTTP*) will drive
the full OAuth dance for you — connect to `http://127.0.0.1:3333/mcp` and sign in.

## Connect from ChatGPT / Claude web

Expose the server with a tunnel (e.g. `cloudflared tunnel --url http://127.0.0.1:3333`), set
`NAM_MCP_ISSUER_URL` to the resulting `https://…` origin (so the AS metadata advertises public
URLs), restart, and add `https://…/mcp` as a **Claude Custom Connector** or a **ChatGPT
developer-mode connector**. The connector registers itself (DCR) and walks you through the Supabase
login — no shared secret on the tunnel.

## Out of scope here

Realtime live updates landed in the SPA (P3). OAuth-store persistence landed (P4a, above). Still out:
hosting/deploy (**P4b** — the Edge Functions vs. Cloudflare Workers decision). The "beyond parity"
intents (due dates, saved-view / mission-control / template CRUD, reordering) are not surfaced as
tools yet. The server stays host-agnostic (plain Node + `tsx`).
