// Persistent AuthStore backed by the MCP-owned `mcp` Postgres schema (P4a #113; grants #1051).
//
// Drop-in for InMemoryAuthStore so issued clients/codes/grants/tokens survive a restart. Each row
// stores its data object verbatim as JSONB (node-postgres serializes it); access/refresh tokens also
// carry a `grant_id` column so a grant delete cascades to them (family revocation).
//
// Expiry: codes/access tokens carry an `expiresAt` (epoch seconds); reads treat an expired row as
// absent and delete it. `pruneExpired` is a best-effort sweep.

import type pg from 'pg';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { AuthSession } from '@supabase/supabase-js';
import type {
  AccessTokenData,
  AuthCodeData,
  AuthStore,
  GrantData,
  PendingLoginData,
  RefreshTokenData,
} from './stores';

const nowSeconds = () => Math.floor(Date.now() / 1000);

export class PostgresAuthStore implements AuthStore {
  constructor(private readonly pool: pg.Pool) {}

  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    const { rows } = await this.pool.query<{ client: OAuthClientInformationFull }>(
      'select client from mcp.oauth_clients where client_id = $1',
      [clientId],
    );
    return rows[0]?.client;
  }

  async saveClient(client: OAuthClientInformationFull): Promise<void> {
    await this.pool.query(
      `insert into mcp.oauth_clients (client_id, client) values ($1, $2)
       on conflict (client_id) do update set client = excluded.client`,
      [client.client_id, client],
    );
  }

  async saveCode(code: string, data: AuthCodeData): Promise<void> {
    await this.pool.query(
      `insert into mcp.oauth_codes (code, data, expires_at) values ($1, $2, to_timestamp($3))
       on conflict (code) do update set data = excluded.data, expires_at = excluded.expires_at`,
      [code, data, data.expiresAt],
    );
  }

  async getCode(code: string): Promise<AuthCodeData | undefined> {
    const { rows } = await this.pool.query<{ data: AuthCodeData }>(
      'select data from mcp.oauth_codes where code = $1',
      [code],
    );
    const data = rows[0]?.data;
    if (!data) return undefined;
    if (data.expiresAt <= nowSeconds()) {
      await this.deleteCode(code);
      return undefined;
    }
    return data;
  }

  async takeCode(code: string): Promise<AuthCodeData | undefined> {
    // Atomic single-use claim (#1051) — one exchange wins the row.
    const { rows } = await this.pool.query<{ data: AuthCodeData }>(
      'delete from mcp.oauth_codes where code = $1 returning data',
      [code],
    );
    const data = rows[0]?.data;
    if (!data) return undefined;
    return data.expiresAt <= nowSeconds() ? undefined : data;
  }

  async deleteCode(code: string): Promise<void> {
    await this.pool.query('delete from mcp.oauth_codes where code = $1', [code]);
  }

  async saveGrant(id: string, data: GrantData): Promise<void> {
    await this.pool.query(
      `insert into mcp.oauth_grants (grant_id, data) values ($1, $2)
       on conflict (grant_id) do update set data = excluded.data`,
      [id, data],
    );
  }

  async getGrant(id: string): Promise<GrantData | undefined> {
    const { rows } = await this.pool.query<{ data: GrantData }>(
      'select data from mcp.oauth_grants where grant_id = $1',
      [id],
    );
    return rows[0]?.data;
  }

  async updateGrantSession(id: string, session: AuthSession): Promise<void> {
    await this.pool.query(
      `update mcp.oauth_grants set data = jsonb_set(data, '{session}', $2::jsonb) where grant_id = $1`,
      [id, JSON.stringify(session)],
    );
  }

  async claimRefresh(id: string, expectedGeneration: number, leaseSeconds: number): Promise<boolean> {
    // Acquire the in-progress lock atomically (#1051 re-review v3): set `refreshLock` ONLY if the grant
    // is still at `expectedGeneration` and no LIVE lock is held (an expired lease is reclaimable). Does
    // NOT bump the generation — that happens at finalizeRefresh, after the new token is durable — so a
    // concurrent duplicate of the same token sees generation unchanged + a live lock and is told to
    // retry, never mistaken for reuse. The lock lives in the `data` JSONB beside the generation.
    // rowCount 0 = not claimed (superseded, gone, or already locked).
    const { rowCount } = await this.pool.query(
      `update mcp.oauth_grants
         set data = jsonb_set(data, '{refreshLock}',
               jsonb_build_object('generation', $2::int, 'expiresAt', $3::int))
       where grant_id = $1
         and (data->>'refreshGeneration')::int = $2
         and (data->'refreshLock' is null
              or (data->'refreshLock'->>'expiresAt')::int <= $4)`,
      [id, expectedGeneration, nowSeconds() + leaseSeconds, nowSeconds()],
    );
    return (rowCount ?? 0) > 0;
  }

  async finalizeRefresh(id: string, expectedGeneration: number): Promise<number | null> {
    // Bump the generation (superseding the old token) and drop the lock — only while still at
    // `expectedGeneration`. Called AFTER the new refresh token is durably issued, so the generation
    // never runs ahead of a usable replacement. Zero rows = the state moved (lease expired + reclaimed).
    const { rows } = await this.pool.query<{ gen: number }>(
      `update mcp.oauth_grants
         set data = jsonb_set(data, '{refreshGeneration}',
                 to_jsonb((data->>'refreshGeneration')::int + 1)) - 'refreshLock'
       where grant_id = $1 and (data->>'refreshGeneration')::int = $2
       returning (data->>'refreshGeneration')::int as gen`,
      [id, expectedGeneration],
    );
    return rows[0]?.gen ?? null;
  }

  async releaseRefresh(id: string, expectedGeneration: number): Promise<void> {
    // Winner path failed: drop the lock WITHOUT advancing the generation, so the still-current token can
    // be retried. Guarded on our own lock's generation so a later request's lock is never cleared.
    await this.pool.query(
      `update mcp.oauth_grants set data = data - 'refreshLock'
       where grant_id = $1 and (data->'refreshLock'->>'generation')::int = $2`,
      [id, expectedGeneration],
    );
  }

  async deleteGrant(id: string): Promise<void> {
    // Cascades to access + refresh tokens via their grant_id FK (on delete cascade).
    await this.pool.query('delete from mcp.oauth_grants where grant_id = $1', [id]);
  }

  async saveAccessToken(token: string, data: AccessTokenData): Promise<void> {
    await this.pool.query(
      `insert into mcp.oauth_access_tokens (token, grant_id, data, expires_at)
       values ($1, $2, $3, to_timestamp($4))
       on conflict (token) do update set grant_id = excluded.grant_id, data = excluded.data, expires_at = excluded.expires_at`,
      [token, data.grantId, data, data.expiresAt],
    );
  }

  async getAccessToken(token: string): Promise<AccessTokenData | undefined> {
    const { rows } = await this.pool.query<{ data: AccessTokenData }>(
      'select data from mcp.oauth_access_tokens where token = $1',
      [token],
    );
    const data = rows[0]?.data;
    if (!data) return undefined;
    if (data.expiresAt <= nowSeconds()) {
      await this.deleteAccessToken(token);
      return undefined;
    }
    return data;
  }

  async deleteAccessToken(token: string): Promise<void> {
    await this.pool.query('delete from mcp.oauth_access_tokens where token = $1', [token]);
  }

  async saveRefreshToken(token: string, data: RefreshTokenData): Promise<void> {
    await this.pool.query(
      `insert into mcp.oauth_refresh_tokens (token, grant_id, data) values ($1, $2, $3)
       on conflict (token) do update set grant_id = excluded.grant_id, data = excluded.data`,
      [token, data.grantId, data],
    );
  }

  async getRefreshToken(token: string): Promise<RefreshTokenData | undefined> {
    // Non-consuming — validated by generation, not deleted, so a replay is detectable (#1051).
    const { rows } = await this.pool.query<{ data: RefreshTokenData }>(
      'select data from mcp.oauth_refresh_tokens where token = $1',
      [token],
    );
    return rows[0]?.data;
  }

  async savePendingLogin(id: string, data: PendingLoginData): Promise<void> {
    await this.pool.query(
      `insert into mcp.oauth_pending_logins (id, data, expires_at) values ($1, $2, to_timestamp($3))
       on conflict (id) do update set data = excluded.data, expires_at = excluded.expires_at`,
      [id, data, data.expiresAt],
    );
  }

  async takePendingLogin(id: string): Promise<PendingLoginData | undefined> {
    const { rows } = await this.pool.query<{ data: PendingLoginData }>(
      'delete from mcp.oauth_pending_logins where id = $1 returning data',
      [id],
    );
    const data = rows[0]?.data;
    if (!data) return undefined;
    return data.expiresAt <= nowSeconds() ? undefined : data;
  }

  /** Best-effort removal of expired codes/access tokens/pending logins. */
  async pruneExpired(): Promise<void> {
    await this.pool.query('delete from mcp.oauth_codes where expires_at <= now()');
    await this.pool.query('delete from mcp.oauth_access_tokens where expires_at <= now()');
    await this.pool.query('delete from mcp.oauth_pending_logins where expires_at <= now()');
  }
}
