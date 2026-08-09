import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { AuthSession } from '@supabase/supabase-js';
import { PostgresAuthStore } from './postgresStore';
import type { AccessTokenData, AuthCodeData, RefreshTokenData } from './stores';

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

const session = { access_token: 'at', refresh_token: 'rt' } as unknown as AuthSession;
const future = Math.floor(Date.now() / 1000) + 3600;
const past = Math.floor(Date.now() / 1000) - 1;

describe('PostgresAuthStore', () => {
  it('reads a client by id', async () => {
    const client = { client_id: 'c1' } as OAuthClientInformationFull;
    const { pool, calls } = makePool([{ rows: [{ client }] }]);
    const store = new PostgresAuthStore(pool);

    expect(await store.getClient('c1')).toEqual(client);
    expect(calls[0].sql).toContain('from mcp.oauth_clients');
    expect(calls[0].params).toEqual(['c1']);
  });

  it('upserts a client', async () => {
    const client = { client_id: 'c1' } as OAuthClientInformationFull;
    const { pool, calls } = makePool();
    await new PostgresAuthStore(pool).saveClient(client);

    expect(calls[0].sql).toContain('on conflict (client_id) do update');
    expect(calls[0].params).toEqual(['c1', client]);
  });

  it('returns a live code and drops an expired one', async () => {
    const live: AuthCodeData = {
      clientId: 'c1', codeChallenge: 'x', redirectUri: 'r', scopes: [], session,
      workspace: 'default', expiresAt: future,
    };
    const expired: AuthCodeData = { ...live, expiresAt: past };

    const liveStore = makePool([{ rows: [{ data: live }] }]);
    expect(await new PostgresAuthStore(liveStore.pool).getCode('k')).toEqual(live);

    const expiredStore = makePool([{ rows: [{ data: expired }] }, { rows: [] }]);
    const store = new PostgresAuthStore(expiredStore.pool);
    expect(await store.getCode('k')).toBeUndefined();
    // Second call is the delete of the expired row.
    expect(expiredStore.calls[1].sql).toContain('delete from mcp.oauth_codes');
    expect(expiredStore.calls[1].params).toEqual(['k']);
  });

  it('claims a code atomically via DELETE ... RETURNING (#1051)', async () => {
    const live: AuthCodeData = {
      clientId: 'c1', codeChallenge: 'x', redirectUri: 'r', scopes: [], session,
      workspace: 'default', expiresAt: future,
    };
    const { pool, calls } = makePool([{ rows: [{ data: live }] }]);
    expect(await new PostgresAuthStore(pool).takeCode('k')).toEqual(live);
    expect(calls[0].sql).toContain('delete from mcp.oauth_codes');
    expect(calls[0].sql).toContain('returning data');

    const empty = makePool([{ rows: [] }]);
    expect(await new PostgresAuthStore(empty.pool).takeCode('gone')).toBeUndefined();
  });

  it('drops an expired access token on read', async () => {
    const expired: AccessTokenData = { grantId: 'g1', scopes: ['nam.read'], expiresAt: past };
    const { pool, calls } = makePool([{ rows: [{ data: expired }] }, { rows: [] }]);
    const store = new PostgresAuthStore(pool);

    expect(await store.getAccessToken('t')).toBeUndefined();
    expect(calls[1].sql).toContain('delete from mcp.oauth_access_tokens');
  });

  it('saves an access token with its grant_id column + per-token scopes', async () => {
    const data: AccessTokenData = { grantId: 'g1', scopes: ['nam.read'], expiresAt: future };
    const { pool, calls } = makePool();
    await new PostgresAuthStore(pool).saveAccessToken('t', data);
    expect(calls[0].sql).toContain('mcp.oauth_access_tokens');
    expect(calls[0].params).toEqual(['t', 'g1', data, future]);
  });

  it('reads a refresh token without consuming it (reuse detection needs the row)', async () => {
    const data: RefreshTokenData = { grantId: 'g1', generation: 2 };
    const { pool, calls } = makePool([{ rows: [{ data }] }]);
    expect(await new PostgresAuthStore(pool).getRefreshToken('r')).toEqual(data);
    expect(calls[0].sql).toContain('select data from mcp.oauth_refresh_tokens');
  });

  it('patches just the session on updateGrantSession', async () => {
    const { pool, calls } = makePool();
    await new PostgresAuthStore(pool).updateGrantSession('g1', session);
    expect(calls[0].sql).toContain("jsonb_set(data, '{session}'");
    expect(calls[0].params).toEqual(['g1', JSON.stringify(session)]);
  });

  it('advances a grant via compare-and-swap on the generation, returning the new gen (#1051 review)', async () => {
    const { pool, calls } = makePool([{ rows: [{ gen: 3 }] }]);
    expect(await new PostgresAuthStore(pool).advanceGrant('g1', 2, session)).toBe(3);
    expect(calls[0].sql).toContain("'{refreshGeneration}'");
    expect(calls[0].sql).toContain("(data->>'refreshGeneration')::int = $3"); // the CAS guard
    expect(calls[0].params).toEqual(['g1', JSON.stringify(session), 2]);
  });

  it('advanceGrant returns null when a concurrent refresh already moved the generation (#1051 review)', async () => {
    const { pool } = makePool([{ rows: [] }]); // WHERE generation = expected matched nothing
    expect(await new PostgresAuthStore(pool).advanceGrant('g1', 2, session)).toBeNull();
  });

  it('deletes a grant (tokens cascade via FK)', async () => {
    const { pool, calls } = makePool();
    await new PostgresAuthStore(pool).deleteGrant('g1');
    expect(calls[0].sql).toContain('delete from mcp.oauth_grants');
    expect(calls[0].params).toEqual(['g1']);
  });
});
