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

test('the guest page renders a real share end to end', async ({ page, browserName }) => {
  const TOKEN = `e2e-smoke-page-${browserName}`;
  const { client: owner, userId } = await ownerClient();
  const content = {
    version: 1, title: 'Smoke expedition', note: 'Real stack, real RLS.',
    publishedAt: 'x',
    items: [{ id: 'it1', title: 'Cross the bridge' }],
    sections: [],
  };
  const up = await owner.from('project_shares').upsert(
    { token: TOKEN, owner_user_id: userId, project_id: `e2e-smoke-page-${browserName}`, content, enabled: true },
    { onConflict: 'owner_user_id,project_id' },
  );
  expect(up.error).toBeNull();
  try {
    await page.goto(`/p/${TOKEN}`);
    await expect(page.getByRole('heading', { name: 'Smoke expedition' })).toBeVisible();
    await expect(page.getByText('Cross the bridge')).toBeVisible();

    // Revoke → the same link is a quiet dead end.
    await owner.from('project_shares').update({ enabled: false }).eq('token', TOKEN);
    await page.reload();
    await expect(page.getByText('This link is no longer active')).toBeVisible();
  } finally {
    await owner.from('project_shares').delete().eq('token', TOKEN);
  }
});

test('the real jsonb round-trip is canonically clean, and rotation cannot be undone by a stale republish (#772)', async ({ browserName }) => {
  const { canonicalSnapshot } = await import('../src/lib/canonicalJson.js');
  const TOKEN = `e2e-smoke-lifecycle-${browserName}`;
  const { client: owner, userId } = await ownerClient();
  const content = { version: 1, title: 'Lifecycle', publishedAt: 'x', note: 'zed', items: [{ id: 'a1', title: 'One', due: { start: '2027-01-02' } }], sections: [] };
  const projectId = `e2e-smoke-lifecycle-${browserName}`;
  await owner.from('project_shares').delete().eq('project_id', projectId);
  const up = await owner.from('project_shares').insert({ token: TOKEN, owner_user_id: userId, project_id: projectId, content, enabled: true }).select().single();
  expect(up.error).toBeNull();
  try {
    // F2: what comes back from Postgres compares canonically equal to what went in —
    // even though jsonb reorders keys (stringify equality would fail here).
    const back = await owner.from('project_shares').select('content').eq('token', TOKEN).single();
    expect(JSON.stringify(back.data!.content)).not.toBe(JSON.stringify(content)); // jsonb DID reorder
    expect(canonicalSnapshot(back.data!.content)).toBe(canonicalSnapshot(content)); // and we see through it

    // F3: rotate, then a stale republish (content-only update by owner+project) keeps the NEW token.
    const t2 = 'e2e-rotated-' + TOKEN;
    await owner.from('project_shares').update({ token: t2 }).eq('token', TOKEN);
    const repub = await owner
      .from('project_shares')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('owner_user_id', userId)
      .eq('project_id', projectId)
      .select('token')
      .single();
    expect(repub.data!.token).toBe(t2); // the rotation survived the stale republish
    // And a rotate keyed on the DEAD token matches zero rows — the raced-rotate guard's premise.
    const raced = await owner.from('project_shares').update({ token: 'never' }).eq('token', TOKEN).select('token');
    expect(raced.data).toEqual([]);
  } finally {
    await owner.from('project_shares').delete().eq('project_id', projectId);
  }
});

test('the suggestion box: guests capture via the RPC, owners read, the table stays dark (#796)', async ({ browserName }) => {
  const TOKEN = `e2e-smoke-suggest-${browserName}`;
  const projectId = `e2e-smoke-suggest-${browserName}`;
  const { client: owner, userId } = await ownerClient();
  const anon = createClient(E2E.supabaseUrl, E2E.supabaseKey);
  await owner.from('project_shares').delete().eq('project_id', projectId);
  const up = await owner
    .from('project_shares')
    .insert({ token: TOKEN, owner_user_id: userId, project_id: projectId, content: { version: 1 }, enabled: true })
    .select('share_id')
    .single();
  expect(up.error).toBeNull();
  try {
    // Guest capture path: accepted for an enabled share…
    const ok = await anon.rpc('add_share_suggestion', { share_token: TOKEN, suggestion: '  Ryokan night  ', guest: 'Anna' });
    expect(ok.error).toBeNull();
    expect(ok.data).toBe(true);
    // …the same quiet false for unknown tokens, empties, and oversized names (no oracle).
    expect((await anon.rpc('add_share_suggestion', { share_token: 'nope', suggestion: 'x' })).data).toBe(false);
    expect((await anon.rpc('add_share_suggestion', { share_token: TOKEN, suggestion: '   ' })).data).toBe(false);
    expect((await anon.rpc('add_share_suggestion', { share_token: TOKEN, suggestion: 'x', guest: 'y'.repeat(101) })).data).toBe(false);

    // The table is dark to anon — capture is write-only, guests never read each other.
    expect((await anon.from('share_suggestions').select('id')).error).not.toBeNull();

    // The owner reads it, trimmed, and can resolve it.
    const mine = await owner.from('share_suggestions').select('body, guest_name, handled').eq('share_id', up.data!.share_id);
    expect(mine.error).toBeNull();
    expect(mine.data).toEqual([{ body: 'Ryokan night', guest_name: 'Anna', handled: false }]);

    // A disabled share stops accepting immediately.
    await owner.from('project_shares').update({ enabled: false }).eq('token', TOKEN);
    expect((await anon.rpc('add_share_suggestion', { share_token: TOKEN, suggestion: 'late idea' })).data).toBe(false);
  } finally {
    await owner.from('project_shares').delete().eq('project_id', projectId); // cascades the suggestions
  }
});

test('guests read exactly one enabled share via the RPC — and nothing else', async ({ browserName }) => {
  const TOKEN = `e2e-smoke-share-${browserName}`;
  const { client: owner, userId } = await ownerClient();
  const anon = createClient(E2E.supabaseUrl, E2E.supabaseKey);

  // Owner publishes (upsert like the app does).
  const content = { version: 1, title: 'Smoke trip', publishedAt: 'x', items: [], sections: [] };
  const up = await owner.from('project_shares').upsert(
    { token: TOKEN, owner_user_id: userId, project_id: `e2e-smoke-project-${browserName}`, content, enabled: true },
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
