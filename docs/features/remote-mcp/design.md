# Remote MCP Server: ChatGPT / Claude web → Nam

Status: **P0–P4a complete and verified locally** (read tools, write tools, OAuth 2.1/PKCE, per-user
RLS, Realtime live-updates, persistent OAuth store). **Only P4b — hosting/deploy — remains**; host
decided (a small Node service first, see "Hosting decision — P4b"). #1046.
Companion to NamDesktop's `docs/features/external-agent/design.md` (the stdio/file-contract
version). This is the **web** equivalent: a *remote* MCP server the hosted AI surfaces connect to.

## Goal

From the **ChatGPT or Claude *web* surfaces**, with a NamWeb connector enabled, "get stuff done in
Nam" — capture a thought, add/triage actions, create projects — by chatting, and watch it show up in
the running NamWeb SPA.

NamDesktop already lets a *desktop* Claude do this through a local stdio MCP server whose contract is
a JSON file on disk. NamWeb's job is to bring that to the deployed web, where the AI client is
remote and there is no shared filesystem.

## Core principle

**The AI stays in AI-land. NamWeb stays in productivity-app-land.** On the desktop the contract
between them is a JSON file; on the web it is the **Supabase `workspaces` row** both NamWeb and
NamDesktop cloud-sync already share.

## Transfer analysis: file-contract → row-contract

| Concern | NamDesktop (local) | NamWeb (web) |
|---|---|---|
| AI↔app contract | `workspace.external.json` on disk | Supabase `workspaces` row (`document` JSONB) |
| Concurrency safety | single writer + monitoring mode + staging file | optimistic **`version`** guard + conflict-replay (`src/store/commit.ts`) |
| Accept/reject review | summary dialog on monitoring-mode exit | live writes (P0–P2); optional drafts review later |
| App reacts to changes | `WatchService` on the file | SPA pulls on mount/conflict today; **Supabase Realtime** later (P3) |
| Transport | stdio (same JAR, separate process) | **remote** MCP over Streamable HTTP, OAuth-gated |

The key simplification: because the row is **already** guarded by a version counter with a
conflict-replay path, multi-writer is safe by construction. The desktop's monitoring-mode /
staging-file / sentinel dance exists only because a local file has no merge safety — **none of that
is needed here.** The MCP server writes the same row; the SPA reconciles like it does for any other
device.

> Scope note: a hosted MCP server is "a web API of our own," which `CLAUDE.md` and
> `docs/features/web-app/design.md` currently **defer**. This design consciously **promotes** that
> epic. Supabase migrations still live in NamDesktop; we do not duplicate schema.

## Architecture

```
ChatGPT / Claude web (remote MCP connector)
    │  OAuth 2.1 / PKCE  →  user-scoped access token
    ▼
NamWeb MCP server  (Streamable HTTP, /mcp)
    │  maps the authorized user → Supabase identity
    │  pull() / commitIntent() / push()   (reused core, RLS by owner_user_id)
    ▼
Supabase `workspaces` row   (document JSONB + version)
    │  (P3) Realtime change feed
    ▼
NamWeb SPA (running)  →  reflects AI changes live
```

## Feasibility (verified June 2026)

- **Claude — Custom Connectors.** Add a remote MCP **URL**; the server advertises auth via
  `401 + WWW-Authenticate` → Protected Resource Metadata → OAuth 2.1 / PKCE. Available on paid tiers.
- **ChatGPT — Developer mode (beta).** Full MCP client supporting **read + write** tools over
  streaming HTTP/SSE, added under Connectors; write tools prompt the user for confirmation. A Secure
  MCP Tunnel exists for local development.

Both are remote-MCP clients, so one OAuth-gated Streamable-HTTP server serves both.

## Auth model

- **OAuth 2.1 with PKCE.** The connector performs the authorization-code+PKCE flow against our
  server's metadata; the issued access token is presented on every MCP call.
- **Map the authorized user → a Supabase identity** so `pull`/`push` run under that user's JWT and
  RLS scopes the `workspaces` row by `owner_user_id` (same guarantee the SPA relies on).
- **Recommendation:** lean on a batteries-included OAuth provider (e.g. the Cloudflare
  `workers-oauth-provider`, or Supabase Auth itself) rather than hand-rolling token issuance.
- **Secrets are server-side only** — never shipped to the SPA bundle.

## Hosting recommendation (decide at design review)

1. **Primary — Supabase Edge Functions (Deno).** One platform; the function runs with the user's JWT
   so RLS "just works"; no extra infra. Risk: OAuth-provider ergonomics in Edge are less trodden.
2. **Strong alternative — Cloudflare Workers.** Anthropic's well-documented remote-MCP + OAuth
   template path; pick this if OAuth in Edge proves painful. Talks to Supabase over PostgREST/JS.
3. **Third — a small Node service / new backend repo.** Most control, most ops; only if 1–2 don't fit.

Final call deferred; the read-only prototype (below) is host-agnostic (plain Node + `tsx`).

## Hosting decision — P4b (resolved 2026-08-05): **a small Node service first**

The ranking above was written before P1/P2 existed. It no longer holds, because of **how** the server
was actually built:

- P1/P2 hand-roll the OAuth 2.1 Authorization Server on the **MCP SDK's Express integration** —
  `mcpAuthRouter` + `StreamableHTTPServerTransport` + `express` (`mcp/server.ts`, `mcp/auth/*`). That
  is a Node/Express stack.
- **Supabase Edge Functions (Deno)** and **Cloudflare Workers** would each require **rewriting** that
  transport + OAuth layer to their runtime — not a deploy, a port. That's real risk against a server
  that already works end-to-end.

So for the goal *"ship what's built"*, the pragmatic order **inverts**: a **small Node service is now
#1** (run the existing Express app almost unchanged), with **Supabase Edge Functions kept as a later
platform-consolidation migration** (attractive once the AI backend also hosts the phase-2 in-app-chat
proxy — revisit then). Cloudflare Workers: same port cost, deferred.

**Recommended host:** a managed Docker/Node container host — **Fly.io or Railway** (both: a Node
runtime, a managed Postgres for the token store, automatic TLS, a custom domain, env-secret storage;
low single-digit $/mo). Vendor is the owner's preference/account; the requirements are what matter:

| Need | Why | Source |
| --- | --- | --- |
| Long-running Node process (not serverless-per-request in a foreign runtime) | runs the Express/MCP-SDK app as-is | `mcp/server.ts` |
| Managed Postgres + `NAM_MCP_DATABASE_URL` | persist OAuth clients/tokens across restarts | `mcp/auth/postgresStore.ts`, `mcp/db/schema.sql` |
| HTTPS on a stable custom domain | OAuth AS metadata must advertise public `https://` URLs | `NAM_MCP_ISSUER_URL` |
| Secret env (`NAM_MCP_*`, Supabase URL/keys) | login + row access | `.env.example` |

**Deploy shape (Node service):**
1. A `Dockerfile` that builds the server bundle (server + its `../src/...` core — see the refactor
   note below on whether to bundle vs extract) and runs `node`/`tsx mcp/server.ts`.
2. Provision the managed Postgres; set `NAM_MCP_DATABASE_URL` → `PostgresAuthStore` engages
   automatically (schema created idempotently, kept off PostgREST).
3. Point a custom domain at the service; set `NAM_MCP_ISSUER_URL` to that public origin.
4. **Security posture (verify in prod):** CSRF double-submit cookie, per-IP sign-in rate-limit, and
   PKCE all active; `NAM_MCP_DEV_NOAUTH` **unset**; secrets only in the host's secret store.
5. Add `https://…/mcp` as a Claude Custom Connector / ChatGPT developer connector → DCR → PKCE →
   Supabase login → workspace pick → gated `/mcp`. Smoke read + write + live-SPA (Realtime).

**Shared-core refactor (design P4):** a Node/Docker build **can bundle `../src/...` directly**, so the
"extract to a shared package" refactor is **not a prerequisite** for this first deploy — do it later
(it pays off mainly for the phase-2 Edge-Function chat proxy, which *can't* reach into `src/`).

## Domain-code reuse

NamWeb's core is already **React-free and dependency-injected**, so the server reuses it directly:

- `src/domain/types.ts` — the `WorkspaceDocument` / `NamNode` shape (the wire blob).
- `src/domain/mutations.ts` — `applyIntent(doc, intent)` + the `Intent` union (every write op).
- `src/domain/lenses.ts` — read projections (`projects`, `inboxItems`, `nextActions`, `dueGroups`, …).
- `src/sync/workspaceClient.ts` — `pull` / `push` (the version-guarded row contract).
- `src/store/commit.ts` — `commitIntent` (optimistic + conflict-replay; takes an injected client).
- `src/lib/local.ts` — `newId` / `nowIso` (Node-safe).

**Refactor (proposed, not P0):** extract these into a shared package consumed by both the SPA and the
server — the "promote to a backend package" moment `CLAUDE.md` anticipates. P0 imports `../src/...`
relatively to prove the loop before paying for the refactor.

## Tool surface

Target is **parity with NamDesktop's stdio MCP server** (`src/namdesktop/mcp/NamMcpServer.java`).
Every tool below mirrors a desktop tool of the same name and is backed by NamWeb's existing,
React-free core — reads by a `domain/lenses` projection, writes by an `Intent` committed via
`commitIntent`. Parity here is a **floor, not a ceiling** (see "Beyond parity" below).

**Read tools** (P0) — pure projections over a `pull()`ed `WorkspaceDocument`:

| Tool | Backing lens |
|---|---|
| `get_workspace_context()` | `projects()` + `allTags()` + `inboxItems()` (counts, project titles, tags in use) |
| `list_inbox()` | `inboxItems()` → `{id, title, status, tags}` |
| `list_projects()` | `projects()` → `{id, title, status, childCount, path}` (`projectPath()`) |
| `list_next_actions()` | `nextActions()` |
| `list_backlog()` | `backlogItems()` |
| `list_done()` | `doneItems()` |
| `list_saved_views()` | `doc.savedViews` (user-defined tag filters) |
| `list_project_children(project_id)` | `projectActions()` + `subProjects()` |
| `find_node(title)` | `searchResults()` (case-insensitive substring) |
| `list_resources(node_id)` | `getNode().resources` |

**Write tools** (P2 — implemented, #109) — each maps to an existing `Intent`, committed via
`commitIntent` (version guard + conflict-replay):

| Tool | Intent |
|---|---|
| `add_inbox_item(title, …)` | `addInboxItem` |
| `create_project(title, parent_id?)` | `addSubProject` (nested) / top-level project¹ |
| `add_action(project_id, title, …)` | `addAction` |
| `add_next_action(title, …)` | `addAction` with status `NEXT`¹ |
| `mark_next/mark_done/mark_backlog(node_id)` | `setStatus` |
| `update_node(node_id, title?, description?)` | `updateNode` (omitted fields keep current value) |
| `update_tags(node_id, tags)` | `updateTags` (normalized, whole-list replace) |
| `move_node(node_id, new_parent_id?)` | `moveNode` |
| `delete_node(node_id)` | `deleteLeaf` (childless) / `deleteRecursive` |
| `add_blocked_by/remove_blocked_by(node_id, blocked_by_id)` | `addPrerequisite` / `removePrerequisite` |
| `add_resource/remove_resource/edit_resource(node_id, …)` | `updateResources` (whole-list replace) |

**Intentionally dropped:** `get_monitoring_status` — it reports the desktop's file-watch / staging
state, which the row contract eliminates. Its role (knowing writes are safe to apply) is replaced
by the version guard + (P3) Realtime, so there is no web equivalent.

**Rooting decision (resolved in P2):** `create_project` at *top-level* and `add_next_action` both
lack a parent, but `addSubProject` / `addAction` require a `parentId`. Resolved **without a new
`Intent`**: the four container node ids already live on the document, so the server reads them off
the pulled doc — top-level `create_project` → `addSubProject` with `parentId = doc.projectsNodeId`;
`add_next_action` → `addAction` with `parentId = doc.nextActionsNodeId`, status `NEXT`. This is
exactly how the SPA roots them (`ProjectsPage.tsx`), so the existing invariant is reused, not
re-implemented. `add_action` defaults to status `NEXT` (matching the SPA workbench).

**Beyond parity (not desktop tools, available "for free"):** NamWeb's `Intent` set is a superset of
the desktop's — due dates (`setDue`), saved-view / mission-control / template CRUD, and reordering
(`reorderChildren` / `reorderView`) all exist as committed intents and can be surfaced as tools once
parity lands, if useful.

## Write safety

- Every write goes through the **version guard + conflict-replay** — concurrent edits from the SPA or
  another device never silently clobber.
- **Connector-side per-write confirmation** (both surfaces prompt) is the first line of human control.
- **Prompt-injection** is a real risk for write tools; keep the write surface small and explicit,
  validate inputs, and reuse the domain mutations' invariants (cycle/structural guards) — never weaken
  them.
- Optional later: a **drafts** review mode (a separate workspace row, or draft-flagged nodes the SPA
  surfaces for accept/reject) — the closest analogue to desktop monitoring mode, if we want it.

## Reactive SPA

Today the SPA pulls on mount and on conflict. To get the NamDesktop "watch it land" feel, add a
**Supabase Realtime** subscription on the user's `workspaces` row so AI-driven changes appear live
(P3). Independent of the server work; valuable on its own for multi-device.

## Risks

- OAuth 2.1/PKCE complexity (mitigated by a managed provider).
- ChatGPT developer mode is **beta** — surface may shift.
- Prompt-injection on write tools (small surface + confirmation + domain invariants).
- Secrets must stay server-side only.
- Scope creep into the broader deferred web-API — keep this connector-shaped, not a general REST API.

## Issue breakdown (phased)

- **P0** — Design doc (this) + local **read-only** prototype (`mcp/`, no auth, tunnel-connectable). ← #105 ✅
- **P1** — OAuth 2.1/PKCE + authorized-user → Supabase-identity mapping. ← #107 ✅
- **P2** — Write tools (the `Intent`-mapped set above) with connector-side per-write confirmation. ← #109 ✅
- **P3** — Supabase Realtime live updates in the SPA. ✅ (`src/sync/realtime.ts`, wired in `useWorkspace`)
- **P4a** — Persistent OAuth store (`PostgresAuthStore`). ✅
- **P4b** — **Hosting/deploy — the remaining gap.** Host **decided: a small Node service first**
  (see "Hosting decision" above). ← #1046. The core-extraction refactor is deferred (not needed to
  bundle `../src` in a Node/Docker build).

## Decisions settled
- Contract is the Supabase `workspaces` row, not a file; no monitoring/staging mode needed.
- One OAuth-gated Streamable-HTTP server serves both Claude and ChatGPT.
- P0 is read-only, unauthenticated, local + tunnel — prove connectivity before OAuth/writes.
- **P1 OAuth (#107):** rather than a managed provider, the server implements the MCP SDK's
  `OAuthServerProvider` itself (`mcp/auth/`), backed by **Supabase identity** for the actual login.
  It issues **opaque** access/refresh tokens that map to a Supabase session (no JWT signing owned
  here), so every MCP request runs under the user's JWT/RLS — no second identity domain. The whole
  auth concern sits behind the `OAuthServerProvider` + `AuthStore` seams, so the "managed provider"
  question below stays a provider swap, not a rewrite. Tokens/clients are in-memory for now
  (re-auth on restart); persistence is P4. Verified end-to-end (DCR → PKCE → login → token →
  gated `/mcp`) against the local stack.

## Open (for design review)
- ~~Hosting target~~ — **resolved (P4b): a small Node service first** (see "Hosting decision"); Edge
  Functions revisited as a later platform-consolidation migration.
- OAuth provider choice — **P1 hand-rolls a Supabase-backed `OAuthServerProvider`**; the managed-
  provider swap (e.g. Cloudflare `workers-oauth-provider`) only becomes relevant *if* we later migrate
  off the Node service to Workers. Not needed for the Node-service deploy.
- Whether to add a drafts/review mode or rely on connector-side confirmation only.
- **Concrete host vendor** (Fly.io vs Railway vs …) + domain + prod-Postgres provisioning — owner's
  call/spend; the deploy shape is vendor-agnostic.
