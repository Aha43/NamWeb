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

test('resource events (#809): guests append, owners drain, the table stays dark', async ({ browserName }) => {
  const TOKEN = `e2e-smoke-events-${browserName}`;
  const projectId = `e2e-smoke-events-${browserName}`;
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
    // Guest ticks: accepted for an enabled share; the overlay read returns them oldest-first.
    expect((await anon.rpc('add_share_resource_event', { share_token: TOKEN, node: 'abcd1234', res_index: 1, delta: 1 })).data).toBe(true);
    expect((await anon.rpc('add_share_resource_event', { share_token: TOKEN, node: 'abcd1234', res_index: 1, delta: -1 })).data).toBe(true);
    const overlay = await anon.rpc('get_share_resource_events', { share_token: TOKEN });
    expect(overlay.error).toBeNull();
    expect(overlay.data).toEqual([
      { node_id: 'abcd1234', res_index: 1, delta: 1, answer: null },
      { node_id: 'abcd1234', res_index: 1, delta: -1, answer: null },
    ]);

    // The same quiet false for unknown tokens and malformed shapes (no oracle).
    expect((await anon.rpc('add_share_resource_event', { share_token: 'nope', node: 'x', res_index: 0, delta: 1 })).data).toBe(false);
    expect((await anon.rpc('add_share_resource_event', { share_token: TOKEN, node: 'x', res_index: 0, delta: 2 })).data).toBe(false);
    expect((await anon.rpc('add_share_resource_event', { share_token: TOKEN, node: '', res_index: 0, delta: 1 })).data).toBe(false);
    expect((await anon.rpc('add_share_resource_event', { share_token: TOKEN, node: 'x', res_index: -1, delta: 1 })).data).toBe(false);

    // The table is dark to anon — events flow only through the two RPCs.
    expect((await anon.from('share_resource_events').select('id')).error).not.toBeNull();

    // The owner claims via the RPC (#832/P1) — direct UPDATE/DELETE is revoked, so an old
    // bundle fails closed. The RPC returns the claimed rows; the guest overlay then empties.
    const directUpdate = await owner.from('share_resource_events').update({ drained: true }).eq('share_id', up.data!.share_id);
    expect(directUpdate.error).not.toBeNull(); // fail closed: no direct write grant
    const claimed = await owner.rpc('claim_drainable_events', { p_share_id: up.data!.share_id, p_kinds: ['delta', 'answer'] });
    expect(claimed.error).toBeNull();
    expect(claimed.data).toHaveLength(2);
    // Claimed rows come back id-ordered (#850): the drain applies them as a FIFO its idempotency
    // ledger relies on (a -1 then +1 must land in that order), so the +1 (inserted first, smaller
    // id) precedes the -1.
    const ids = (claimed.data as { id: number; delta: number }[]).map((r) => r.id);
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);
    expect((claimed.data as { delta: number }[]).map((r) => r.delta)).toEqual([1, -1]);
    expect((await anon.rpc('get_share_resource_events', { share_token: TOKEN })).data).toEqual([]);
    // The owner deletes via the RPC too (direct DELETE is revoked).
    const del = await owner.rpc('delete_drained_events', { p_ids: (claimed.data as { id: number }[]).map((r) => r.id) });
    expect(del.error).toBeNull();

    // A disabled share goes silent in BOTH directions.
    await owner.from('project_shares').update({ enabled: false }).eq('token', TOKEN);
    expect((await anon.rpc('add_share_resource_event', { share_token: TOKEN, node: 'abcd1234', res_index: 1, delta: 1 })).data).toBe(false);
    expect((await anon.rpc('get_share_resource_events', { share_token: TOKEN })).data).toEqual([]);
  } finally {
    await owner.from('project_shares').delete().eq('project_id', projectId); // cascades the events
  }
});

test('drain lease (#852): exclusive per share, holder-only release, re-acquire; anon cannot', async ({ browserName }) => {
  const TOKEN = `e2e-smoke-lease-${browserName}`;
  const projectId = `e2e-smoke-lease-${browserName}`;
  const { client: owner, userId } = await ownerClient();
  const anon = createClient(E2E.supabaseUrl, E2E.supabaseKey);
  await owner.from('project_shares').delete().eq('project_id', projectId);
  const up = await owner
    .from('project_shares')
    .insert({ token: TOKEN, owner_user_id: userId, project_id: projectId, content: { version: 1 }, enabled: true })
    .select('share_id')
    .single();
  expect(up.error).toBeNull();
  const shareId = up.data!.share_id;
  try {
    // Acquire → a token; a second acquire while held → null (exclusive).
    const first = await owner.rpc('acquire_drain_lease', { p_share_id: shareId, p_ttl_seconds: 120 });
    expect(first.error).toBeNull();
    expect(typeof first.data).toBe('string');
    expect((await owner.rpc('acquire_drain_lease', { p_share_id: shareId, p_ttl_seconds: 120 })).data).toBeNull();
    // A wrong-token release is a no-op — the lease stays held.
    await owner.rpc('release_drain_lease', { p_share_id: shareId, p_token: 'not-the-token' });
    expect((await owner.rpc('acquire_drain_lease', { p_share_id: shareId, p_ttl_seconds: 120 })).data).toBeNull();
    // The holder releases → re-acquire succeeds.
    expect((await owner.rpc('release_drain_lease', { p_share_id: shareId, p_token: first.data as string })).error).toBeNull();
    expect(typeof (await owner.rpc('acquire_drain_lease', { p_share_id: shareId, p_ttl_seconds: 120 })).data).toBe('string');
    // Anon gets no lease (owner-scoped, and execute is granted only to authenticated).
    expect(typeof (await anon.rpc('acquire_drain_lease', { p_share_id: shareId, p_ttl_seconds: 120 })).data).not.toBe('string');
  } finally {
    await owner.from('project_shares').delete().eq('project_id', projectId);
  }
});

test('question answers (#827): guests answer via the RPC, drain into the overlay', async ({ browserName }) => {
  const TOKEN = `e2e-smoke-answers-${browserName}`;
  const projectId = `e2e-smoke-answers-${browserName}`;
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
    expect((await anon.rpc('add_share_answer_event', { share_token: TOKEN, node: 'abcd1234', res_index: 2, answer: 'yes' })).data).toBe(true);
    expect((await anon.rpc('add_share_answer_event', { share_token: TOKEN, node: 'abcd1234', res_index: 2, answer: 'clear' })).data).toBe(true);
    // Malformed answer and unknown token → the same quiet false.
    expect((await anon.rpc('add_share_answer_event', { share_token: TOKEN, node: 'abcd1234', res_index: 2, answer: 'maybe' })).data).toBe(false);
    expect((await anon.rpc('add_share_answer_event', { share_token: 'nope', node: 'x', res_index: 0, answer: 'yes' })).data).toBe(false);
    // The overlay read returns answer rows (delta null) alongside any ticks.
    const overlay = await anon.rpc('get_share_resource_events', { share_token: TOKEN });
    expect(overlay.error).toBeNull();
    expect(overlay.data).toEqual([
      { node_id: 'abcd1234', res_index: 2, delta: null, answer: 'yes' },
      { node_id: 'abcd1234', res_index: 2, delta: null, answer: 'clear' },
    ]);
    // A counter tick still works on the same table (exactly-one-of holds).
    expect((await anon.rpc('add_share_resource_event', { share_token: TOKEN, node: 'abcd1234', res_index: 0, delta: 1 })).data).toBe(true);
  } finally {
    await owner.from('project_shares').delete().eq('project_id', projectId);
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
