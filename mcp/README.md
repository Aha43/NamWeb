# NamWeb remote MCP server — P0 read-only prototype

Lets the **ChatGPT / Claude web** surfaces read your Nam workspace over MCP. This is the
**P0** slice of the [remote-MCP epic](../docs/features/remote-mcp/design.md): **read-only,
no OAuth, local-only**. It reuses NamWeb's React-free core directly — `pull()` over the
Supabase `workspaces` row plus the `domain/lenses` projections.

> Phasing: **P0** read-only (here) · P1 OAuth 2.1/PKCE · P2 write tools · P3 Realtime · P4 hosting.

## Tools (read-only)

`get_workspace_context`, `list_inbox`, `list_projects`, `list_next_actions`, `list_backlog`,
`list_done`, `list_saved_views`, `list_project_children`, `find_node`, `list_resources`.

## Run it

1. Have the Supabase stack the SPA targets running (the NamDesktop local stack, or a hosted
   project), with a workspace row to read.
2. In `.env` (copied from `.env.example`), set the MCP block:
   ```
   NAM_MCP_EMAIL=you@example.com        # a Supabase user who owns the workspace row
   NAM_MCP_PASSWORD=...                  # that user's password
   NAM_MCP_PORT=3333                     # optional, default 3333
   ```
   It reuses the existing `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and
   `VITE_WORKSPACE_NAME` values.
3. Start it:
   ```bash
   npm run mcp
   ```
   → `NamWeb MCP (read-only, P0) on http://127.0.0.1:3333/mcp`

## Verify locally

With the MCP Inspector:
```bash
npx @modelcontextprotocol/inspector
```
Connect to `http://127.0.0.1:3333/mcp` (transport: *Streamable HTTP*), list tools, call one.

Or by hand (stateless JSON responses are enabled):
```bash
curl -s http://127.0.0.1:3333/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Connect from ChatGPT / Claude web

The server is plain HTTP on localhost, so expose it with a tunnel (e.g. `cloudflared tunnel
--url http://127.0.0.1:3333`) and add the resulting `https://…/mcp` URL as a **Claude Custom
Connector** or a **ChatGPT developer-mode connector**.

> P0 has **no authentication** — anyone who can reach the tunnel can read the workspace. Use a
> short-lived tunnel for testing only; real auth (OAuth 2.1/PKCE → Supabase identity) is P1.

## Out of scope here

No writes, no OAuth, no hosting/deploy. The server is host-agnostic (plain Node + `tsx`); the
Edge Functions vs. Cloudflare Workers decision is P4.
