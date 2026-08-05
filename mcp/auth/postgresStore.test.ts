import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { AuthSession } from '@supabase/supabase-js';
import { PostgresAuthStore } from './postgresStore';
import type { AccessTokenData, AuthCodeData, GrantData, RefreshTokenData } from './stores';
import { decryptJson, encryptJson, hashToken } from './crypto';

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
    expect(calls[0].params[0]).toBe(hashToken('secret-code'));
    expect(calls[0].params[0]).not.toBe('secret-code');
    const stored = calls[0].params[1] as { session: unknown };
    expect(typeof stored.session).toBe('string'); // session encrypted
    expect(stored.session).not.toEqual(session);
  });

  it('round-trips an encrypted session on read (takeCode)', async () => {
    const code: AuthCodeData = {
      clientId: 'c1', codeChallenge: 'x', redirectUri: 'r', scopes: [], session,
      workspace: 'default', expiresAt: future,
    };
    const sealed = { ...code, session: encryptJson(session, KEY) };
    const { pool, calls } = makePool([{ rows: [{ data: sealed }] }]);
    expect(await store(pool).takeCode('secret-code')).toEqual(code); // session decrypted
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

  it('claims a code atomically via DELETE ... RETURNING (#1051)', async () => {
    const { pool, calls } = makePool([{ rows: [] }]);
    expect(await store(pool).takeCode('gone')).toBeUndefined();
    expect(calls[0].sql).toContain('delete from mcp.oauth_codes');
    expect(calls[0].sql).toContain('returning data');
  });

  it('drops an expired access token on read (looked up by hash)', async () => {
    const expired: AccessTokenData = { grantId: 'g1', scopes: ['nam.read'], expiresAt: past };
    const { pool, calls } = makePool([{ rows: [{ data: expired }] }, { rows: [] }]);
    expect(await store(pool).getAccessToken('t')).toBeUndefined();
    expect(calls[0].params[0]).toBe(hashToken('t'));
    expect(calls[1].sql).toContain('delete from mcp.oauth_access_tokens');
  });

  it('saves an access token with its grant_id column + per-token scopes', async () => {
    const data: AccessTokenData = { grantId: 'g1', scopes: ['nam.read'], expiresAt: future };
    const { pool, calls } = makePool();
    await store(pool).saveAccessToken('t', data);
    expect(calls[0].sql).toContain('mcp.oauth_access_tokens');
    expect(calls[0].params[0]).toBe(hashToken('t')); // stored by hash
    expect(calls[0].params[2]).toEqual(data);
  });

  it('reads a refresh token without consuming it, by hash', async () => {
    const data: RefreshTokenData = { grantId: 'g1', generation: 2 };
    const { pool, calls } = makePool([{ rows: [{ data }] }]);
    expect(await store(pool).getRefreshToken('r')).toEqual(data);
    expect(calls[0].sql).toContain('select data from mcp.oauth_refresh_tokens');
    expect(calls[0].params[0]).toBe(hashToken('r'));
  });

  it('patches just the (encrypted) session on updateGrantSession', async () => {
    const { pool, calls } = makePool();
    await store(pool).updateGrantSession('g1', session);
    expect(calls[0].sql).toContain("jsonb_set(data, '{session}'");
    expect(calls[0].params[0]).toBe('g1');
    expect(typeof calls[0].params[1]).toBe('string'); // ciphertext, not the raw session
    expect(decryptJson(calls[0].params[1] as string, KEY)).toEqual(session); // round-trips
  });

  it('claimRefresh acquires the lock at the generation with no live lock, stamping the lockId (#1051 re-review)', async () => {
    const { pool, calls } = makePool([{ rowCount: 1, rows: [] }]);
    expect(await store(pool).claimRefresh('g1', 2, 30, 'lock-abc')).toBe(true);
    expect(calls[0].sql).toContain("'{refreshLock}'"); // sets the in-progress lock
    expect(calls[0].sql).toContain("'lockId'"); // stamped with the owner nonce
    expect(calls[0].sql).not.toContain("'{refreshGeneration}'"); // does NOT advance the generation
    expect(calls[0].sql).toContain("(data->>'refreshGeneration')::int = $2"); // at this generation
    expect(calls[0].sql).toContain("data->'refreshLock' is null"); // and no live lock
    expect(calls[0].params[0]).toBe('g1');
    expect(calls[0].params[1]).toBe(2);
    expect(calls[0].params[4]).toBe('lock-abc');
  });

  it('claimRefresh returns false when the row was already locked/superseded (rowCount 0)', async () => {
    const { pool } = makePool([{ rowCount: 0, rows: [] }]);
    expect(await store(pool).claimRefresh('g1', 2, 30, 'lock-abc')).toBe(false);
  });

  it('finalizeRefresh bumps the generation, drops the lock, slides the expiry, guarded on the OWN lockId (#1051 re-review, #1053)', async () => {
    const { pool, calls } = makePool([{ rows: [{ gen: 3 }] }]);
    expect(await store(pool).finalizeRefresh('g1', 'lock-abc')).toBe(3);
    expect(calls[0].sql).toContain("'{refreshGeneration}'"); // advances the generation
    expect(calls[0].sql).toContain("- 'refreshLock'"); // and clears the lock
    expect(calls[0].sql).toContain('expires_at = to_timestamp'); // slides the grant TTL (#1053)
    expect(calls[0].sql).toContain("data->'refreshLock'->>'lockId' = $2"); // only OUR lock
    expect(calls[0].params).toEqual(['g1', 'lock-abc', expect.any(Number)]); // id, lockId, sliding expiry
  });

  it('finalizeRefresh returns null when the lock is no longer ours (lease expired + reclaimed)', async () => {
    const { pool } = makePool([{ rows: [] }]);
    expect(await store(pool).finalizeRefresh('g1', 'lock-abc')).toBeNull();
  });

  it('releaseRefresh drops only its OWN lock (by lockId), leaving the generation unchanged (#1051 re-review)', async () => {
    const { pool, calls } = makePool();
    await store(pool).releaseRefresh('g1', 'lock-abc');
    expect(calls[0].sql).toContain("data - 'refreshLock'"); // clears the lock
    expect(calls[0].sql).not.toContain("'{refreshGeneration}'"); // generation NOT touched
    expect(calls[0].sql).toContain("data->'refreshLock'->>'lockId' = $2"); // only our lock
    expect(calls[0].params).toEqual(['g1', 'lock-abc']);
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
