// Persistent AuthStore backed by the MCP-owned `mcp` Postgres schema (P4a, #113).
//
// Drop-in for InMemoryAuthStore so issued clients/codes/tokens survive a server
// restart (connectors no longer re-authorize on every restart). Each row stores
// the store's data object verbatim as JSONB — node-postgres serializes the JS
// object for us — keeping this a thin, obvious mapping of the AuthStore methods.
//
// Expiry: codes/access tokens carry an `expiresAt` (epoch seconds); reads treat
// an expired row as absent and delete it. `pruneExpired` is a best-effort sweep.

import type pg from 'pg';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { AuthSession } from '@supabase/supabase-js';
import type {
  AccessTokenData,
  AuthCodeData,
  AuthStore,
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

  async deleteCode(code: string): Promise<void> {
    await this.pool.query('delete from mcp.oauth_codes where code = $1', [code]);
  }

  async saveAccessToken(token: string, data: AccessTokenData): Promise<void> {
    await this.pool.query(
      `insert into mcp.oauth_access_tokens (token, data, expires_at) values ($1, $2, to_timestamp($3))
       on conflict (token) do update set data = excluded.data, expires_at = excluded.expires_at`,
      [token, data, data.expiresAt],
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

  async updateAccessSession(token: string, session: AuthSession): Promise<void> {
    await this.pool.query(
      `update mcp.oauth_access_tokens set data = jsonb_set(data, '{session}', $2::jsonb)
       where token = $1`,
      [token, JSON.stringify(session)],
    );
  }

  async deleteAccessToken(token: string): Promise<void> {
    await this.pool.query('delete from mcp.oauth_access_tokens where token = $1', [token]);
  }

  async saveRefreshToken(token: string, data: RefreshTokenData): Promise<void> {
    await this.pool.query(
      `insert into mcp.oauth_refresh_tokens (token, data) values ($1, $2)
       on conflict (token) do update set data = excluded.data`,
      [token, data],
    );
  }

  async takeRefreshToken(token: string): Promise<RefreshTokenData | undefined> {
    const { rows } = await this.pool.query<{ data: RefreshTokenData }>(
      'delete from mcp.oauth_refresh_tokens where token = $1 returning data',
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
