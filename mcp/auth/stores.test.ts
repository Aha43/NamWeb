import { describe, expect, it } from 'vitest';
import type { AuthSession } from '@supabase/supabase-js';
import { InMemoryAuthStore, type GrantData } from './stores';

const session = { access_token: 'at', refresh_token: 'rt' } as unknown as AuthSession;
const grant = (): GrantData => ({
  clientId: 'c1',
  scopes: ['nam.read'],
  workspace: 'default',
  session,
  refreshGeneration: 0,
});

describe('InMemoryAuthStore refresh lease (owner nonce, #1051 re-review v4)', () => {
  it('a stale winner cannot release or finalize a newer claimant lock', async () => {
    const store = new InMemoryAuthStore();
    await store.saveGrant('g', grant());

    // Winner A claims with a 0s lease → it is immediately reclaimable (simulates an expired lease).
    expect(await store.claimRefresh('g', 0, 0, 'lock-A')).toBe(true);
    // A newer request B reclaims the same generation (A's lease has expired) with its own lockId.
    expect(await store.claimRefresh('g', 0, 30, 'lock-B')).toBe(true);
    expect((await store.getGrant('g'))?.refreshLock?.lockId).toBe('lock-B');

    // The stale winner A must NOT be able to clear B's live lock…
    await store.releaseRefresh('g', 'lock-A');
    expect((await store.getGrant('g'))?.refreshLock?.lockId).toBe('lock-B'); // still B's

    // …nor finalize (advance the generation) under B's lock.
    expect(await store.finalizeRefresh('g', 'lock-A')).toBeNull();
    const afterStale = await store.getGrant('g');
    expect(afterStale?.refreshGeneration).toBe(0); // generation NOT advanced by the stale winner
    expect(afterStale?.refreshLock?.lockId).toBe('lock-B'); // B still holds the lock

    // B, the real owner, finalizes cleanly.
    expect(await store.finalizeRefresh('g', 'lock-B')).toBe(1);
    const done = await store.getGrant('g');
    expect(done?.refreshGeneration).toBe(1);
    expect(done?.refreshLock).toBeUndefined(); // lock cleared
  });

  it('claimRefresh is refused while a live lock is held', async () => {
    const store = new InMemoryAuthStore();
    await store.saveGrant('g', grant());
    expect(await store.claimRefresh('g', 0, 30, 'lock-A')).toBe(true);
    expect(await store.claimRefresh('g', 0, 30, 'lock-B')).toBe(false); // A's lock is still live
  });
});
