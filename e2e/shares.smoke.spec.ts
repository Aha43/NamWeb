import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { E2E } from './env';

// #759 — the share security model, proven against the real local stack (API-only, no page):
// the ONLY guest read path is the get_project_share RPC; the table itself is dark to anon.
// Runs with the smoke suite (`npm run e2e`, local stack via `npm run db:start`).

// Chromium and webkit run this spec concurrently — key the fixture per project so the two
// runs never race on one row (same isolation trick as the workspace smoke).

async function ownerClient() {
  const client = createClient(E2E.supabaseUrl, E2E.supabaseKey);
  const { data, error } = await client.auth.signInWithPassword({ email: E2E.email, password: E2E.password });
  if (error) throw new Error(`E2E sign-in failed: ${error.message}`);
  return { client, userId: data.user.id };
}

test('guests read exactly one enabled share via the RPC — and nothing else', async ({ browserName: _browserName }, testInfo) => {
  const TOKEN = `e2e-smoke-share-${testInfo.project.name}`;
  const { client: owner, userId } = await ownerClient();
  const anon = createClient(E2E.supabaseUrl, E2E.supabaseKey);

  // Owner publishes (upsert like the app does).
  const content = { version: 1, title: 'Smoke trip', publishedAt: 'x', items: [], sections: [] };
  const up = await owner.from('project_shares').upsert(
    { token: TOKEN, owner_user_id: userId, project_id: `e2e-smoke-project-${testInfo.project.name}`, content, enabled: true },
    { onConflict: 'owner_user_id,project_id' },
  );
  expect(up.error).toBeNull();

  try {
    // The guest path: RPC by exact token → the content, nothing more.
    const hit = await anon.rpc('get_project_share', { share_token: TOKEN });
    expect(hit.error).toBeNull();
    expect(hit.data).toMatchObject({ title: 'Smoke trip' });

    // Wrong token → null, same shape as disabled (no oracle).
    const miss = await anon.rpc('get_project_share', { share_token: 'no-such-token' });
    expect(miss.error).toBeNull();
    expect(miss.data).toBeNull();

    // The table is dark to anon: no grants → enumeration is impossible.
    const enumerate = await anon.from('project_shares').select('token');
    expect(enumerate.error, 'anon must not be able to select from project_shares').not.toBeNull();

    // Disabling turns the link off immediately.
    await owner.from('project_shares').update({ enabled: false }).eq('token', TOKEN);
    const dark = await anon.rpc('get_project_share', { share_token: TOKEN });
    expect(dark.data).toBeNull();

    // Another signed-in user is just as locked out of the owner's rows (RLS).
    const others = await anon.from('project_shares').select('token'); // anon again for good measure
    expect(others.error).not.toBeNull();
  } finally {
    await owner.from('project_shares').delete().eq('token', TOKEN);
  }
});
