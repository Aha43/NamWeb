import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { AuthSession } from '@supabase/supabase-js';
import { PostgresAuthStore } from './postgresStore';
import type { AccessTokenData, AuthCodeData, GrantData, RefreshTokenData } from './stores';
import { encryptJson, hashToken } from './crypto';

interface QueryResult {
  rows: unknown[];
}

/** Fake pg.Pool: records (sql, params) per call, returns queued results in order. */
function makePool(results: QueryResult[] = []) {
  const calls: { sql: string; params: unknown[] }[] = [];
  let i = 0;
  const pool = {
    query: (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      return Promise.resolve(results[i++] ?? { rows: [] });
    },
  } as unknown as pg.Pool;
  return { pool, calls };
}

const KEY = Buffer.alloc(32, 7); // deterministic test key
const store = (pool: pg.Pool) => new PostgresAuthStore(pool, KEY);
const session = { access_token: 'at', refresh_token: 'rt' } as unknown as AuthSession;
const future = Math.floor(Date.now() / 1000) + 3600;
const past = Math.floor(Date.now() / 1000) - 1;

describe('PostgresAuthStore', () => {
  it('reads a client by id', async () => {
    const client = { client_id: 'c1' } as OAuthClientInformationFull;
    const { pool, calls } = makePool([{ rows: [{ client }] }]);
    expect(await store(pool).getClient('c1')).toEqual(client);
    expect(calls[0].sql).toContain('from mcp.oauth_clients');
    expect(calls[0].params).toEqual(['c1']);
  });

  it('stores bearer secrets HASHED, never in the clear (#1053)', async () => {
    const code: AuthCodeData = {
      clientId: 'c1', codeChallenge: 'x', redirectUri: 'r', scopes: [], session,
      workspace: 'default', expiresAt: future,
    };
    const { pool, calls } = makePool();
    await store(pool).saveCode('secret-code', code);
    // The key column is the SHA-256, not the raw code.
    expect(calls[0].params[0]).toBe(hashToken('secret-code'));
    expect(calls[0].params[0]).not.toBe('secret-code');
    // The session is encrypted (a base64 string, not the plaintext object).
    const stored = calls[0].params[1] as { session: unknown };
    expect(typeof stored.session).toBe('string');
    expect(stored.session).not.toEqual(session);
  });

  it('round-trips an encrypted session on read (takeCode)', async () => {
    const code: AuthCodeData = {
      clientId: 'c1', codeChallenge: 'x', redirectUri: 'r', scopes: [], session,
      workspace: 'default', expiresAt: future,
    };
    // The row as stored: session sealed with the same key.
    const sealed = { ...code, session: encryptJson(session, KEY) };
    const { pool, calls } = makePool([{ rows: [{ data: sealed }] }]);
    const got = await store(pool).takeCode('secret-code');
    expect(got).toEqual(code); // session decrypted back to the original
    expect(calls[0].sql).toContain('delete from mcp.oauth_codes');
    expect(calls[0].params[0]).toBe(hashToken('secret-code'));
  });

  it('saves a grant with a sliding expiry and encrypted session (#1053)', async () => {
    const grant: GrantData = { clientId: 'c1', scopes: ['nam.read'], workspace: 'default', session, refreshGeneration: 0 };
    const { pool, calls } = makePool();
    await store(pool).saveGrant('g1', grant);
    expect(calls[0].sql).toContain('mcp.oauth_grants');
    expect(calls[0].sql).toContain('to_timestamp'); // expires_at set
    expect(calls[0].params[0]).toBe('g1'); // grant id NOT hashed (internal, for the FK)
    expect(typeof (calls[0].params[1] as { session: unknown }).session).toBe('string'); // encrypted
  });

  it('drops an expired grant on read (cascades tokens)', async () => {
    const { pool, calls } = makePool([{ rows: [{ data: {}, expired: true }] }, { rows: [] }]);
    expect(await store(pool).getGrant('g1')).toBeUndefined();
    expect(calls[1].sql).toContain('delete from mcp.oauth_grants');
  });

  it('advances a grant (rotate + bump gen + slide expiry) returning the new generation', async () => {
    const { pool, calls } = makePool([{ rows: [{ gen: 3 }] }]);
    expect(await store(pool).advanceGrant('g1', session)).toBe(3);
    expect(calls[0].sql).toContain("'{refreshGeneration}'");
    expect(calls[0].sql).toContain('expires_at = to_timestamp');
  });

  it('claims a code atomically via DELETE ... RETURNING (#1051)', async () => {
    const { pool, calls } = makePool([{ rows: [] }]);
    expect(await store(pool).takeCode('gone')).toBeUndefined();
    expect(calls[0].sql).toContain('delete from mcp.oauth_codes');
    expect(calls[0].sql).toContain('returning data');
  });

  it('drops an expired access token on read (looked up by hash)', async () => {
    const expired: AccessTokenData = { grantId: 'g1', expiresAt: past };
    const { pool, calls } = makePool([{ rows: [{ data: expired }] }, { rows: [] }]);
    expect(await store(pool).getAccessToken('t')).toBeUndefined();
    expect(calls[0].params[0]).toBe(hashToken('t'));
    expect(calls[1].sql).toContain('delete from mcp.oauth_access_tokens');
  });

  it('reads a refresh token without consuming it, by hash', async () => {
    const data: RefreshTokenData = { grantId: 'g1', generation: 2 };
    const { pool, calls } = makePool([{ rows: [{ data }] }]);
    expect(await store(pool).getRefreshToken('r')).toEqual(data);
    expect(calls[0].sql).toContain('select data from mcp.oauth_refresh_tokens');
    expect(calls[0].params[0]).toBe(hashToken('r'));
  });

  it('deletes a grant (tokens cascade via FK)', async () => {
    const { pool, calls } = makePool();
    await store(pool).deleteGrant('g1');
    expect(calls[0].sql).toContain('delete from mcp.oauth_grants');
    expect(calls[0].params).toEqual(['g1']);
  });

  it('pruneExpired sweeps codes, access tokens, idle grants, and pending logins', async () => {
    const { pool, calls } = makePool();
    await store(pool).pruneExpired();
    const swept = calls.map((c) => c.sql).join('\n');
    expect(swept).toContain('mcp.oauth_codes');
    expect(swept).toContain('mcp.oauth_access_tokens');
    expect(swept).toContain('mcp.oauth_grants');
    expect(swept).toContain('mcp.oauth_pending_logins');
  });
});
