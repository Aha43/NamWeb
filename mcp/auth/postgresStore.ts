// Persistent AuthStore backed by the MCP-owned `mcp` Postgres schema (P4a #113; grants #1051;
// at-rest protection #1053).
//
// At rest: bearer secrets (access/refresh tokens, auth codes, pending-login ids) are stored by their
// SHA-256 — the raw value never touches the DB — and the Supabase `session` inside grants/codes/
// pending rows is AES-256-GCM encrypted with an app key. So a database dump yields neither replayable
// tokens nor usable sessions. (Grant ids are internal, not bearer secrets, so they stay in the clear
// for the FK cascade.) Grants carry a sliding `expires_at` extended on each refresh, giving refresh
// tokens a lifetime; `pruneExpired` sweeps everything expired.

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
import { decryptJson, encryptJson, hashToken } from './crypto';

const nowSeconds = () => Math.floor(Date.now() / 1000);

function grantTtlSeconds(): number {
  const days = Number(process.env.NAM_MCP_GRANT_TTL_DAYS ?? 30);
  return Math.max(1, days) * 24 * 3600;
}

/** A stored session field is the base64 ciphertext (not the AuthSession object). */
type Sealed<T extends { session: AuthSession }> = Omit<T, 'session'> & { session: string };

export class PostgresAuthStore implements AuthStore {
  constructor(
    private readonly pool: pg.Pool,
    private readonly key: Buffer,
  ) {}

  private seal<T extends { session: AuthSession }>(data: T): Sealed<T> {
    return { ...data, session: encryptJson(data.session, this.key) };
  }
  private open<T extends { session: AuthSession }>(row: Sealed<T>): T {
    return { ...row, session: decryptJson<AuthSession>(row.session, this.key) } as unknown as T;
  }

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
      [hashToken(code), this.seal(data), data.expiresAt],
    );
  }

  async getCode(code: string): Promise<AuthCodeData | undefined> {
    const { rows } = await this.pool.query<{ data: Sealed<AuthCodeData> }>(
      'select data from mcp.oauth_codes where code = $1',
      [hashToken(code)],
    );
    const data = rows[0]?.data;
    if (!data) return undefined;
    if (data.expiresAt <= nowSeconds()) {
      await this.deleteCode(code);
      return undefined;
    }
    return this.open(data);
  }

  async takeCode(code: string): Promise<AuthCodeData | undefined> {
    const { rows } = await this.pool.query<{ data: Sealed<AuthCodeData> }>(
      'delete from mcp.oauth_codes where code = $1 returning data',
      [hashToken(code)],
    );
    const data = rows[0]?.data;
    if (!data) return undefined;
    return data.expiresAt <= nowSeconds() ? undefined : this.open(data);
  }

  async deleteCode(code: string): Promise<void> {
    await this.pool.query('delete from mcp.oauth_codes where code = $1', [hashToken(code)]);
  }

  async saveGrant(id: string, data: GrantData): Promise<void> {
    await this.pool.query(
      `insert into mcp.oauth_grants (grant_id, data, expires_at)
       values ($1, $2, to_timestamp($3))
       on conflict (grant_id) do update set data = excluded.data, expires_at = excluded.expires_at`,
      [id, this.seal(data), nowSeconds() + grantTtlSeconds()],
    );
  }

  async getGrant(id: string): Promise<GrantData | undefined> {
    const { rows } = await this.pool.query<{ data: Sealed<GrantData>; expired: boolean }>(
      'select data, (expires_at <= now()) as expired from mcp.oauth_grants where grant_id = $1',
      [id],
    );
    const row = rows[0];
    if (!row) return undefined;
    if (row.expired) {
      await this.deleteGrant(id);
      return undefined;
    }
    return this.open(row.data);
  }

  async updateGrantSession(id: string, session: AuthSession): Promise<void> {
    await this.pool.query(
      `update mcp.oauth_grants set data = jsonb_set(data, '{session}', to_jsonb($2::text))
       where grant_id = $1`,
      [id, encryptJson(session, this.key)],
    );
  }

  async advanceGrant(id: string, session: AuthSession): Promise<number> {
    // Rotate (encrypted) session + bump generation + slide the expiry, atomically; return the new gen.
    const { rows } = await this.pool.query<{ gen: number }>(
      `update mcp.oauth_grants
         set data = jsonb_set(
               jsonb_set(data, '{session}', to_jsonb($2::text)),
               '{refreshGeneration}', to_jsonb((data->>'refreshGeneration')::int + 1)),
             expires_at = to_timestamp($3)
       where grant_id = $1
       returning (data->>'refreshGeneration')::int as gen`,
      [id, encryptJson(session, this.key), nowSeconds() + grantTtlSeconds()],
    );
    if (!rows[0]) throw new Error(`No grant ${id}`);
    return rows[0].gen;
  }

  async deleteGrant(id: string): Promise<void> {
    await this.pool.query('delete from mcp.oauth_grants where grant_id = $1', [id]);
  }

  async saveAccessToken(token: string, data: AccessTokenData): Promise<void> {
    await this.pool.query(
      `insert into mcp.oauth_access_tokens (token, grant_id, data, expires_at)
       values ($1, $2, $3, to_timestamp($4))
       on conflict (token) do update set grant_id = excluded.grant_id, data = excluded.data, expires_at = excluded.expires_at`,
      [hashToken(token), data.grantId, data, data.expiresAt],
    );
  }

  async getAccessToken(token: string): Promise<AccessTokenData | undefined> {
    const { rows } = await this.pool.query<{ data: AccessTokenData }>(
      'select data from mcp.oauth_access_tokens where token = $1',
      [hashToken(token)],
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
    await this.pool.query('delete from mcp.oauth_access_tokens where token = $1', [hashToken(token)]);
  }

  async saveRefreshToken(token: string, data: RefreshTokenData): Promise<void> {
    await this.pool.query(
      `insert into mcp.oauth_refresh_tokens (token, grant_id, data) values ($1, $2, $3)
       on conflict (token) do update set grant_id = excluded.grant_id, data = excluded.data`,
      [hashToken(token), data.grantId, data],
    );
  }

  async getRefreshToken(token: string): Promise<RefreshTokenData | undefined> {
    const { rows } = await this.pool.query<{ data: RefreshTokenData }>(
      'select data from mcp.oauth_refresh_tokens where token = $1',
      [hashToken(token)],
    );
    return rows[0]?.data;
  }

  async savePendingLogin(id: string, data: PendingLoginData): Promise<void> {
    await this.pool.query(
      `insert into mcp.oauth_pending_logins (id, data, expires_at) values ($1, $2, to_timestamp($3))
       on conflict (id) do update set data = excluded.data, expires_at = excluded.expires_at`,
      [hashToken(id), this.seal(data), data.expiresAt],
    );
  }

  async takePendingLogin(id: string): Promise<PendingLoginData | undefined> {
    const { rows } = await this.pool.query<{ data: Sealed<PendingLoginData> }>(
      'delete from mcp.oauth_pending_logins where id = $1 returning data',
      [hashToken(id)],
    );
    const data = rows[0]?.data;
    if (!data) return undefined;
    return data.expiresAt <= nowSeconds() ? undefined : this.open(data);
  }

  /** Best-effort removal of everything expired: codes, access tokens, idle grants (cascading to
   *  their tokens), and pending logins. Scheduled by the server (#1053). */
  async pruneExpired(): Promise<void> {
    await this.pool.query('delete from mcp.oauth_codes where expires_at <= now()');
    await this.pool.query('delete from mcp.oauth_access_tokens where expires_at <= now()');
    await this.pool.query('delete from mcp.oauth_grants where expires_at <= now()');
    await this.pool.query('delete from mcp.oauth_pending_logins where expires_at <= now()');
  }
}
