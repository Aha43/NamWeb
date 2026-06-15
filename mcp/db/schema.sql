-- MCP-owned OAuth Authorization Server storage (P4a, issue #113).
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

-- Issued access tokens → the Supabase session they act as.
create table if not exists mcp.oauth_access_tokens (
  token      text        primary key,
  data       jsonb       not null,
  expires_at timestamptz not null
);
create index if not exists oauth_access_tokens_expires_at on mcp.oauth_access_tokens (expires_at);

-- Issued refresh tokens (single use — taken on refresh; Supabase rotates them).
create table if not exists mcp.oauth_refresh_tokens (
  token text  primary key,
  data  jsonb not null
);

-- Authenticated-but-not-yet-workspace-chosen logins, held between the credential
-- POST and the workspace-pick POST (single use; short TTL).
create table if not exists mcp.oauth_pending_logins (
  id         text        primary key,
  data       jsonb       not null,
  expires_at timestamptz not null
);
create index if not exists oauth_pending_logins_expires_at on mcp.oauth_pending_logins (expires_at);
