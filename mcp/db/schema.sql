-- MCP-owned OAuth Authorization Server storage (P4a #113; grant/family model #1051).
--
-- A dedicated `mcp` schema, created and managed by the MCP server itself — kept
-- out of NamDesktop's `public` app schema (whose migrations are NamDesktop's
-- source of truth). The schema is intentionally NOT exposed to PostgREST, so
-- these rows — which hold the user's Supabase session at rest — stay off the
-- public API surface; the server reaches them via a direct service-level
-- Postgres connection (NAM_MCP_DATABASE_URL), not the user-JWT/RLS data plane.
--
-- Idempotent: run on every server start (`ensureSchema`).

create schema if not exists mcp;

-- Registered clients (Dynamic Client Registration).
create table if not exists mcp.oauth_clients (
  client_id  text        primary key,
  client     jsonb       not null,
  created_at timestamptz not null default now()
);

-- Single-use authorization codes, bound to a PKCE challenge + captured session.
create table if not exists mcp.oauth_codes (
  code       text        primary key,
  data       jsonb       not null,
  expires_at timestamptz not null
);
create index if not exists oauth_codes_expires_at on mcp.oauth_codes (expires_at);

-- Grants: the shared per-authorization record (session, scopes, workspace, refresh generation) that
-- access + refresh tokens reference. Deleting a grant cascades to its tokens (family revocation).
-- `expires_at` is a sliding window extended on each refresh (#1053) — an idle authorization ages out
-- and is pruned, giving refresh tokens a lifetime. The `session` inside `data` is encrypted at rest.
create table if not exists mcp.oauth_grants (
  grant_id   text        primary key,
  data       jsonb       not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists oauth_grants_expires_at on mcp.oauth_grants (expires_at);

-- Issued access tokens → their grant.
create table if not exists mcp.oauth_access_tokens (
  token      text        primary key,
  grant_id   text        not null references mcp.oauth_grants (grant_id) on delete cascade,
  data       jsonb       not null,
  expires_at timestamptz not null
);
create index if not exists oauth_access_tokens_expires_at on mcp.oauth_access_tokens (expires_at);
create index if not exists oauth_access_tokens_grant on mcp.oauth_access_tokens (grant_id);

-- Issued refresh tokens → their grant + the generation they were minted at. NOT deleted on use:
-- a refresh token with a generation below the grant's current one is a replay (reuse detection).
create table if not exists mcp.oauth_refresh_tokens (
  token    text  primary key,
  grant_id text  not null references mcp.oauth_grants (grant_id) on delete cascade,
  data     jsonb not null
);
create index if not exists oauth_refresh_tokens_grant on mcp.oauth_refresh_tokens (grant_id);

-- Authenticated-but-not-yet-workspace-chosen logins, held between the credential
-- POST and the workspace-pick POST (single use; short TTL).
create table if not exists mcp.oauth_pending_logins (
  id         text        primary key,
  data       jsonb       not null,
  expires_at timestamptz not null
);
create index if not exists oauth_pending_logins_expires_at on mcp.oauth_pending_logins (expires_at);
