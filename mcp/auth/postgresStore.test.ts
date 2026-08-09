import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { AuthSession } from '@supabase/supabase-js';
import { PostgresAuthStore } from './postgresStore';
import type { AccessTokenData, AuthCodeData, RefreshTokenData } from './stores';

interface QueryResult {
  rows: unknown[];
  rowCount?: number;
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

  it('claimRefresh acquires the lock only at the generation with no live lock (#1051 re-review)', async () => {
    const { pool, calls } = makePool([{ rowCount: 1, rows: [] }]);
    expect(await new PostgresAuthStore(pool).claimRefresh('g1', 2, 30)).toBe(true);
    expect(calls[0].sql).toContain("'{refreshLock}'"); // sets the in-progress lock
    expect(calls[0].sql).not.toContain("'{refreshGeneration}'"); // does NOT advance the generation
    expect(calls[0].sql).toContain("(data->>'refreshGeneration')::int = $2"); // at this generation
    expect(calls[0].sql).toContain("data->'refreshLock' is null"); // and no live lock
    expect(calls[0].params[0]).toBe('g1');
    expect(calls[0].params[1]).toBe(2);
  });

  it('claimRefresh returns false when the row was already locked/superseded (rowCount 0)', async () => {
    const { pool } = makePool([{ rowCount: 0, rows: [] }]);
    expect(await new PostgresAuthStore(pool).claimRefresh('g1', 2, 30)).toBe(false);
  });

  it('finalizeRefresh bumps the generation and drops the lock, guarded on the generation (#1051 re-review)', async () => {
    const { pool, calls } = makePool([{ rows: [{ gen: 3 }] }]);
    expect(await new PostgresAuthStore(pool).finalizeRefresh('g1', 2)).toBe(3);
    expect(calls[0].sql).toContain("'{refreshGeneration}'"); // advances the generation
    expect(calls[0].sql).toContain("- 'refreshLock'"); // and clears the lock
    expect(calls[0].sql).toContain("(data->>'refreshGeneration')::int = $2");
    expect(calls[0].params).toEqual(['g1', 2]);
  });

  it('finalizeRefresh returns null when the state moved (lease expired + reclaimed)', async () => {
    const { pool } = makePool([{ rows: [] }]);
    expect(await new PostgresAuthStore(pool).finalizeRefresh('g1', 2)).toBeNull();
  });

  it('releaseRefresh drops only its own lock, leaving the generation unchanged (#1051 re-review)', async () => {
    const { pool, calls } = makePool();
    await new PostgresAuthStore(pool).releaseRefresh('g1', 2);
    expect(calls[0].sql).toContain("data - 'refreshLock'"); // clears the lock
    expect(calls[0].sql).not.toContain("'{refreshGeneration}'"); // generation NOT touched
    expect(calls[0].sql).toContain("(data->'refreshLock'->>'generation')::int = $2"); // only our lock
    expect(calls[0].params).toEqual(['g1', 2]);
  });

  it('deletes a grant (tokens cascade via FK)', async () => {
    const { pool, calls } = makePool();
    await new PostgresAuthStore(pool).deleteGrant('g1');
    expect(calls[0].sql).toContain('delete from mcp.oauth_grants');
    expect(calls[0].params).toEqual(['g1']);
  });
});
