// P2 verification for the write tools: assert each tool maps its args to the right
// domain Intent, that build-time guards (missing node / structural container / bad
// index) become tool errors, and that a commit failure surfaces as a tool error.
// Both `pull` and `commitIntent` are mocked, so this runs with no Supabase.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NamNode, WorkspaceDocument } from '../src/domain/types';
import type { Intent } from '../src/domain/mutations';

const pull = vi.fn();
vi.mock('../src/sync/workspaceClient', () => ({ pull }));

const commitIntent = vi.fn();
vi.mock('../src/store/commit', () => ({ commitIntent }));

// Imported after the mocks are registered.
const { buildServer } = await import('./server');

// --- Minimal valid workspace ---------------------------------------------

function node(id: string, partial: Partial<NamNode> = {}): NamNode {
  return {
    id,
    title: id,
    description: null,
    status: 'BACKLOG',
    project: false,
    childIds: [],
    tags: [],
    blockedBy: [],
    resources: [],
    createdAt: null,
    updatedAt: null,
    statusChangedAt: null,
    dueAt: null,
    ...partial,
  };
}

function makeDoc(): WorkspaceDocument {
  const nodes: Record<string, NamNode> = {};
  const add = (n: NamNode) => (nodes[n.id] = n);
  add(node('root', { title: 'NAM', childIds: ['inbox', 'projects', 'actions'] }));
  add(node('inbox', { title: 'Inbox', childIds: ['i1'] }));
  add(node('projects', { title: 'Projects', childIds: ['p1'] }));
  add(node('actions', { title: 'Actions' }));
  add(node('i1', { title: 'Buy milk' }));
  add(node('p1', { title: 'Launch', project: true, childIds: ['a1'] }));
  add(
    node('a1', {
      title: 'Draft',
      status: 'NEXT',
      description: 'keep me',
      resources: [{ type: 'URI', value: 'http://x', description: 'link' }],
    }),
  );
  return {
    formatVersion: 1,
    rootNodeId: 'root',
    inboxNodeId: 'inbox',
    projectsNodeId: 'projects',
    nextActionsNodeId: 'actions',
    nodes,
    registeredTags: [],
    savedViews: [],
    missionControls: [],
    templates: [],
    viewOrders: {},
  };
}

const fakeClient = {} as SupabaseClient;

async function connectedClient() {
  const server = buildServer(fakeClient);
  const client = new Client({ name: 'test', version: '0.0.0' });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientT), server.connect(serverT)]);
  return { client, server };
}

type ToolResult = { isError?: boolean; content: { type: string; text?: string }[] };

function firstText(result: ToolResult): string {
  return result.content.find((c) => c.type === 'text')?.text ?? '';
}

/** The Intent passed to the most recent commitIntent call. */
function committedIntent(): Intent {
  const calls = commitIntent.mock.calls;
  return calls[calls.length - 1][3] as Intent;
}

async function call(name: string, args: Record<string, unknown> = {}) {
  const { client, server } = await connectedClient();
  const result = (await client.callTool({ name, arguments: args })) as ToolResult;
  await server.close();
  return result;
}

describe('NamWeb MCP write tools', () => {
  beforeEach(() => {
    pull.mockReset();
    pull.mockResolvedValue({ kind: 'ok', document: makeDoc(), version: 7 });
    commitIntent.mockReset();
    commitIntent.mockImplementation(async (_c, _n, snapshot) => ({
      snapshot: { document: snapshot.document, version: snapshot.version + 1 },
      outcome: 'synced',
    }));
  });

  it('add_inbox_item → addInboxItem, returning the new id', async () => {
    const result = await call('add_inbox_item', { title: 'Call dentist' });
    const intent = committedIntent() as Extract<Intent, { type: 'addInboxItem' }>;
    expect(intent).toMatchObject({ type: 'addInboxItem', title: 'Call dentist' });
    const payload = JSON.parse(firstText(result));
    expect(payload).toMatchObject({ ok: true, outcome: 'synced', id: intent.id });
  });

  it('create_project with no parent roots under projectsNodeId', async () => {
    await call('create_project', { title: 'New' });
    expect(committedIntent()).toMatchObject({ type: 'addSubProject', parentId: 'projects', title: 'New' });
  });

  it('create_project with a parent nests under it', async () => {
    await call('create_project', { title: 'Sub', parent_id: 'p1' });
    expect(committedIntent()).toMatchObject({ type: 'addSubProject', parentId: 'p1' });
  });

  it('create_project with an unknown parent errors and does not commit', async () => {
    const result = await call('create_project', { title: 'X', parent_id: 'nope' });
    expect(result.isError).toBe(true);
    expect(firstText(result)).toContain('nope');
    expect(commitIntent).not.toHaveBeenCalled();
  });

  it('add_action defaults to NEXT and attaches to the project', async () => {
    await call('add_action', { project_id: 'p1', title: 'Do' });
    expect(committedIntent()).toMatchObject({
      type: 'addAction',
      parentId: 'p1',
      status: 'NEXT',
      title: 'Do',
    });
  });

  it('add_action honours an explicit status', async () => {
    await call('add_action', { project_id: 'p1', title: 'Later', status: 'BACKLOG' });
    expect(committedIntent()).toMatchObject({ type: 'addAction', status: 'BACKLOG' });
  });

  it('add_next_action roots a NEXT action under nextActionsNodeId', async () => {
    await call('add_next_action', { title: 'Free' });
    expect(committedIntent()).toMatchObject({
      type: 'addAction',
      parentId: 'actions',
      status: 'NEXT',
    });
  });

  it('mark_done → setStatus DONE', async () => {
    await call('mark_done', { node_id: 'a1' });
    expect(committedIntent()).toMatchObject({ type: 'setStatus', id: 'a1', status: 'DONE' });
  });

  it('refuses to change the status of a structural container', async () => {
    const result = await call('mark_done', { node_id: 'projects' });
    expect(result.isError).toBe(true);
    expect(firstText(result)).toContain('container');
    expect(commitIntent).not.toHaveBeenCalled();
  });

  it('update_node leaves omitted fields unchanged', async () => {
    await call('update_node', { node_id: 'a1', title: 'Renamed' });
    expect(committedIntent()).toMatchObject({
      type: 'updateNode',
      id: 'a1',
      title: 'Renamed',
      description: 'keep me',
    });
  });

  it('update_tags normalizes the tag list', async () => {
    await call('update_tags', { node_id: 'a1', tags: ['Work', ' work ', 'Home'] });
    expect(committedIntent()).toMatchObject({ type: 'updateTags', tags: ['work', 'home'] });
  });

  it('move_node → moveNode', async () => {
    await call('move_node', { node_id: 'a1', new_parent_id: 'projects' });
    expect(committedIntent()).toMatchObject({ type: 'moveNode', id: 'a1', newParentId: 'projects' });
  });

  it('delete_node picks deleteLeaf for a childless node', async () => {
    await call('delete_node', { node_id: 'i1' });
    expect(committedIntent()).toEqual({ type: 'deleteLeaf', id: 'i1' });
  });

  it('delete_node picks deleteRecursive for a node with children', async () => {
    await call('delete_node', { node_id: 'p1' });
    expect(committedIntent()).toEqual({ type: 'deleteRecursive', id: 'p1' });
  });

  it('refuses to delete a structural container', async () => {
    const result = await call('delete_node', { node_id: 'inbox' });
    expect(result.isError).toBe(true);
    expect(commitIntent).not.toHaveBeenCalled();
  });

  it('add_blocked_by → addPrerequisite', async () => {
    await call('add_blocked_by', { node_id: 'a1', blocked_by_id: 'i1' });
    expect(committedIntent()).toMatchObject({
      type: 'addPrerequisite',
      actionId: 'a1',
      prereqId: 'i1',
    });
  });

  it('add_resource appends to the existing resource list', async () => {
    await call('add_resource', { node_id: 'a1', type: 'EMAIL', value: 'a@b.c' });
    const intent = committedIntent();
    expect(intent.type).toBe('updateResources');
    expect((intent as Extract<Intent, { type: 'updateResources' }>).resources).toEqual([
      { type: 'URI', value: 'http://x', description: 'link' },
      { type: 'EMAIL', value: 'a@b.c', description: null },
    ]);
  });

  it('remove_resource drops the resource at the index', async () => {
    await call('remove_resource', { node_id: 'a1', index: 0 });
    expect((committedIntent() as Extract<Intent, { type: 'updateResources' }>).resources).toEqual([]);
  });

  it('remove_resource with an out-of-range index errors', async () => {
    const result = await call('remove_resource', { node_id: 'a1', index: 5 });
    expect(result.isError).toBe(true);
    expect(commitIntent).not.toHaveBeenCalled();
  });

  it('edit_resource merges over the existing resource', async () => {
    await call('edit_resource', { node_id: 'a1', index: 0, value: 'http://y' });
    expect((committedIntent() as Extract<Intent, { type: 'updateResources' }>).resources).toEqual([
      { type: 'URI', value: 'http://y', description: 'link' },
    ]);
  });

  it('surfaces a commit failure as a tool error', async () => {
    commitIntent.mockResolvedValueOnce({
      snapshot: { document: makeDoc(), version: 7 },
      outcome: 'error',
      message: 'push failed',
    });
    const result = await call('add_inbox_item', { title: 'x' });
    expect(result.isError).toBe(true);
    expect(firstText(result)).toContain('push failed');
  });

  it('surfaces a missing workspace row as a tool error', async () => {
    pull.mockResolvedValue({ kind: 'noRemote' });
    const result = await call('add_inbox_item', { title: 'x' });
    expect(result.isError).toBe(true);
    expect(commitIntent).not.toHaveBeenCalled();
  });
});
