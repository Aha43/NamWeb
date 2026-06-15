import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { AuthSession } from '@supabase/supabase-js';
import { PostgresAuthStore } from './postgresStore';
import type { AccessTokenData, AuthCodeData } from './stores';

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

  it('drops an expired access token on read', async () => {
    const expired: AccessTokenData = {
      clientId: 'c1', scopes: [], session, workspace: 'default', expiresAt: past,
    };
    const { pool, calls } = makePool([{ rows: [{ data: expired }] }, { rows: [] }]);
    const store = new PostgresAuthStore(pool);

    expect(await store.getAccessToken('t')).toBeUndefined();
    expect(calls[1].sql).toContain('delete from mcp.oauth_access_tokens');
  });

  it('patches just the session on updateAccessSession', async () => {
    const { pool, calls } = makePool();
    await new PostgresAuthStore(pool).updateAccessSession('t', session);

    expect(calls[0].sql).toContain("jsonb_set(data, '{session}'");
    expect(calls[0].params).toEqual(['t', JSON.stringify(session)]);
  });

  it('takes a refresh token via DELETE ... RETURNING', async () => {
    const data = { clientId: 'c1', scopes: [], session };
    const { pool, calls } = makePool([{ rows: [{ data }] }]);
    const store = new PostgresAuthStore(pool);

    expect(await store.takeRefreshToken('r')).toEqual(data);
    expect(calls[0].sql).toContain('delete from mcp.oauth_refresh_tokens');
    expect(calls[0].sql).toContain('returning data');

    const empty = makePool([{ rows: [] }]);
    expect(await new PostgresAuthStore(empty.pool).takeRefreshToken('gone')).toBeUndefined();
  });
});
