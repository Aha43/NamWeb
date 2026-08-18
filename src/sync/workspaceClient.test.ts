import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { WorkspaceDocument } from '../domain/types';
import { pull, push } from './workspaceClient';

type Response = { data: unknown; error: { message: string } | null };

interface FakeBuilder {
  select: () => FakeBuilder;
  update: () => FakeBuilder;
  insert: () => FakeBuilder;
  eq: () => FakeBuilder;
  maybeSingle: () => Promise<Response>;
  single: () => Promise<Response>;
  // Thenable so `await builder` (the update().select() path) resolves a response too.
  then: (resolve: (v: Response) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>;
}

/**
 * Minimal Supabase client fake. Terminal awaits (`maybeSingle`, `single`, and the
 * thenable update path) each consume one queued `{data, error}` in call order.
 */
function makeClient(opts: { user?: { id: string } | null; queue?: Response[] }): SupabaseClient {
  const user = opts.user === undefined ? { id: 'u1' } : opts.user;
  const queue = opts.queue ?? [];
  let i = 0;
  const consume = (): Response => {
    if (i >= queue.length) throw new Error('mock queue exhausted');
    return queue[i++];
  };
  const builder: FakeBuilder = {
    select: () => builder,
    update: () => builder,
    insert: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve(consume()),
    single: () => Promise.resolve(consume()),
    then: (resolve, reject) => Promise.resolve(consume()).then(resolve, reject),
  };
  return {
    from: () => builder,
    auth: { getSession: async () => ({ data: { session: user ? { user } : null }, error: null }) },
  } as unknown as SupabaseClient;
}

const doc = { formatVersion: 1, nodes: {} } as unknown as WorkspaceDocument;

describe('pull', () => {
  it('returns the row document and version', async () => {
    const client = makeClient({ queue: [{ data: { version: 7, document: doc }, error: null }] });
    const result = await pull(client, 'default');
    expect(result).toEqual({ kind: 'ok', document: doc, version: 7, healed: false });
  });

  it('returns noRemote when there is no row', async () => {
    const client = makeClient({ queue: [{ data: null, error: null }] });
    expect(await pull(client, 'default')).toEqual({ kind: 'noRemote' });
  });

  it('returns error on a query error', async () => {
    const client = makeClient({ queue: [{ data: null, error: { message: 'boom' } }] });
    expect(await pull(client, 'default')).toEqual({ kind: 'error', message: 'boom' });
  });

  it('returns error when not authenticated', async () => {
    const client = makeClient({ user: null });
    expect(await pull(client, 'default')).toEqual({ kind: 'error', message: 'Not authenticated' });
  });
});

describe('push', () => {
  it('reports ok with the new version when the guarded update matches one row', async () => {
    const client = makeClient({ queue: [{ data: [{ version: 5 }], error: null }] });
    expect(await push(client, 'default', doc, 4)).toEqual({ kind: 'ok', version: 5 });
  });

  it('inserts a fresh row when none exists (first push)', async () => {
    const client = makeClient({
      queue: [
        { data: [], error: null }, // guarded update matches nothing
        { data: null, error: null }, // fetch finds no existing row
        { data: { version: 1 }, error: null }, // insert returns version 1
      ],
    });
    expect(await push(client, 'default', doc, 0)).toEqual({ kind: 'ok', version: 1 });
  });

  it('reports a conflict with the remote version when a row exists at a different version', async () => {
    const client = makeClient({
      queue: [
        { data: [], error: null }, // guarded update matches nothing
        { data: { version: 9 }, error: null }, // existing row is ahead
      ],
    });
    expect(await push(client, 'default', doc, 4)).toEqual({ kind: 'conflict', remoteVersion: 9 });
  });

  it('returns error when the guarded update errors', async () => {
    const client = makeClient({ queue: [{ data: null, error: { message: 'nope' } }] });
    expect(await push(client, 'default', doc, 4)).toEqual({ kind: 'error', message: 'nope' });
  });

  it('returns error when not authenticated', async () => {
    const client = makeClient({ user: null });
    expect(await push(client, 'default', doc, 0)).toEqual({ kind: 'error', message: 'Not authenticated' });
  });
});

describe('pull — normalizes malformed childIds at ingest (#1141)', () => {
  // pull is the single remote-ingest choke point (web load / Realtime reconcile / commitIntent
  // conflict-pull, and the MCP loadSnapshot all read through it), so a repaired doc here means no
  // committed or replay base downstream can carry a dangling/aliased childId.
  function childNode(id: string, childIds: string[] = [], project = false) {
    return { id, title: id, description: null, status: 'BACKLOG', project, childIds,
      tags: [], blockedBy: [], resources: [], createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null };
  }
  const corruptDoc = (nodes: Record<string, unknown>) =>
    ({ formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox', projectsNodeId: 'projects',
       nextActionsNodeId: 'actions', nodes, registeredTags: [], savedViews: [], missionControls: [],
       templates: [], viewOrders: {} } as unknown as WorkspaceDocument);

  it('prunes a dangling child id and reports healed:true', async () => {
    const document = corruptDoc({ p: childNode('p', ['a', 'ghost'], true), a: childNode('a') });
    const client = makeClient({ queue: [{ data: { version: 7, document }, error: null }] });
    const result = await pull(client, 'default');
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect(result.healed).toBe(true);
    expect(result.document.nodes.p.childIds).toEqual(['a']);
    expect(result.version).toBe(7);
  });

  it('collapses an id aliased into two parents to a single owner (healed:true)', async () => {
    const document = corruptDoc({
      p: childNode('p', ['y'], true), q: childNode('q', ['y'], true), y: childNode('y'),
    });
    const client = makeClient({ queue: [{ data: { version: 3, document }, error: null }] });
    const result = await pull(client, 'default');
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect(result.healed).toBe(true);
    const owners = [result.document.nodes.p, result.document.nodes.q].filter((n) => n.childIds.includes('y'));
    expect(owners).toHaveLength(1);
  });

  it('leaves a clean doc untouched (healed:false)', async () => {
    const document = corruptDoc({ p: childNode('p', ['a'], true), a: childNode('a') });
    const client = makeClient({ queue: [{ data: { version: 2, document }, error: null }] });
    const result = await pull(client, 'default');
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect(result.healed).toBe(false);
    expect(result.document.nodes.p.childIds).toEqual(['a']);
  });
});
