import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { buildUserExport } from './exportData';

function fakeClient(opts: {
  user?: { id: string; email?: string } | null;
  rows?: unknown[];
  error?: { message: string } | null;
}): SupabaseClient {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => Promise.resolve({ data: opts.rows ?? [], error: opts.error ?? null }),
  };
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: opts.user ?? null } }) },
    from: () => builder,
  } as unknown as SupabaseClient;
}

describe('buildUserExport', () => {
  it('bundles the user and their workspace rows', async () => {
    const rows = [{ name: 'default', version: 3, document: { a: 1 }, created_at: 'c', updated_at: 'u' }];
    const bundle = await buildUserExport(fakeClient({ user: { id: 'u1', email: 'me@nam.local' }, rows }));
    expect(bundle.user).toEqual({ id: 'u1', email: 'me@nam.local' });
    expect(bundle.workspaces).toEqual(rows);
    expect(bundle.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('throws when not signed in', async () => {
    await expect(buildUserExport(fakeClient({ user: null }))).rejects.toThrow(/not signed in/i);
  });

  it('throws on a query error', async () => {
    await expect(
      buildUserExport(fakeClient({ user: { id: 'u1' }, error: { message: 'boom' } })),
    ).rejects.toThrow('boom');
  });
});
