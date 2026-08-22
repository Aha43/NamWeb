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

  it('create_project under a #checklist project is refused loudly and does not commit (#1147)', async () => {
    const doc = makeDoc();
    doc.nodes.p1.tags = ['#checklist'];
    pull.mockResolvedValue({ kind: 'ok', document: doc, version: 7 });
    const result = await call('create_project', { title: 'Sub', parent_id: 'p1' });
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/checklist/i);
    expect(commitIntent).not.toHaveBeenCalled();
  });

  it('update_tags marking a project that has sub-projects as #checklist is refused (#1147)', async () => {
    const doc = makeDoc();
    doc.nodes.p1.childIds = ['a1', 'sp'];
    doc.nodes.sp = node('sp', { title: 'Sub', project: true });
    pull.mockResolvedValue({ kind: 'ok', document: doc, version: 7 });
    const result = await call('update_tags', { node_id: 'p1', tags: ['#checklist'] });
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/checklist/i);
    expect(commitIntent).not.toHaveBeenCalled();
  });

  it('mark_checklist adds the #checklist tag to a project (#1164)', async () => {
    await call('mark_checklist', { project_id: 'p1' });
    const intent = committedIntent() as Extract<Intent, { type: 'updateTags' }>;
    expect(intent).toMatchObject({ type: 'updateTags', id: 'p1' });
    expect(intent.tags).toContain('#checklist');
  });

  it('mark_checklist refuses a project that has sub-projects, and errors on a non-project (#1164)', async () => {
    const doc = makeDoc();
    doc.nodes.p1.childIds = ['a1', 'sp'];
    doc.nodes.sp = node('sp', { title: 'Sub', project: true });
    pull.mockResolvedValue({ kind: 'ok', document: doc, version: 7 });
    expect((await call('mark_checklist', { project_id: 'p1' })).isError).toBe(true);
    expect(commitIntent).not.toHaveBeenCalled();
    // a1 is an action, not a project
    expect((await call('mark_checklist', { project_id: 'a1' })).isError).toBe(true);
  });

  it('reset_checklist maps to a resetChecklist intent on a #checklist project (#1165)', async () => {
    const doc = makeDoc();
    doc.nodes.p1.tags = ['#checklist'];
    pull.mockResolvedValue({ kind: 'ok', document: doc, version: 7 });
    await call('reset_checklist', { project_id: 'p1' });
    expect(committedIntent()).toMatchObject({ type: 'resetChecklist', id: 'p1' });
  });

  it('reset_checklist errors on a project that is not a checklist (#1165)', async () => {
    const result = await call('reset_checklist', { project_id: 'p1' }); // not tagged by default
    expect(result.isError).toBe(true);
    expect(commitIntent).not.toHaveBeenCalled();
  });

  it('unmark_checklist removes the #checklist tag (#1168)', async () => {
    const doc = makeDoc();
    doc.nodes.p1.tags = ['#checklist', 'work'];
    pull.mockResolvedValue({ kind: 'ok', document: doc, version: 7 });
    await call('unmark_checklist', { project_id: 'p1' });
    const intent = committedIntent() as Extract<Intent, { type: 'updateTags' }>;
    expect(intent).toMatchObject({ type: 'updateTags', id: 'p1' });
    expect(intent.tags).toEqual(['work']); // #checklist filtered out, other tags kept
  });

  it('list_checklists carries a checked/total progress count (#1167)', async () => {
    const doc = makeDoc();
    doc.nodes.p1.tags = ['#checklist'];
    doc.nodes.p1.childIds = ['a1', 'd1'];
    doc.nodes.d1 = node('d1', { title: 'Done item', status: 'DONE' });
    pull.mockResolvedValue({ kind: 'ok', document: doc, version: 7 });
    const result = await call('list_checklists');
    const rows = JSON.parse(firstText(result)) as { id: string; checklist?: { checked: number; total: number } }[];
    const p1 = rows.find((r) => r.id === 'p1');
    expect(p1?.checklist).toEqual({ checked: 1, total: 2 }); // a1 (NEXT) + d1 (DONE)
  });

  it('add_action defaults to BACKLOG and attaches to the project (matches NamDesktop)', async () => {
    await call('add_action', { project_id: 'p1', title: 'Do' });
    expect(committedIntent()).toMatchObject({
      type: 'addAction',
      parentId: 'p1',
      status: 'BACKLOG',
      title: 'Do',
    });
  });

  it('add_action honours an explicit status', async () => {
    await call('add_action', { project_id: 'p1', title: 'Now', status: 'NEXT' });
    expect(committedIntent()).toMatchObject({ type: 'addAction', status: 'NEXT' });
  });

  it('add_action schedules at creation, parsing a flexible date + time (#1121)', async () => {
    await call('add_action', { project_id: 'p1', title: 'Attend Brann match', due: '2026-08-15', due_time: '19' });
    expect(committedIntent()).toMatchObject({ type: 'addAction', title: 'Attend Brann match', dueAt: '2026-08-15', dueTime: '19:00' });
  });

  it('add_action rejects a time with no date (#1121)', async () => {
    const result = await call('add_action', { project_id: 'p1', title: 'x', due_time: '19:00' });
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/due_time requires due/i);
    expect(commitIntent).not.toHaveBeenCalled();
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

  it('mark_someday → setStatus SOMEDAY (#1131)', async () => {
    await call('mark_someday', { node_id: 'a1' });
    expect(committedIntent()).toMatchObject({ type: 'setStatus', id: 'a1', status: 'SOMEDAY' });
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

  it('set_due sets a date + time, parsing flexible input to canonical form (#1121)', async () => {
    await call('set_due', { node_id: 'a1', due: '26-8-15', due_time: '1930' });
    expect(committedIntent()).toMatchObject({
      type: 'setDue',
      id: 'a1',
      dueAt: '2026-08-15',
      dueTime: '19:30',
      dueEndAt: null,
      dueEndTime: null,
    });
  });

  it('set_due sets a range (start + end date)', async () => {
    await call('set_due', { node_id: 'a1', due: '2026-08-15', due_end: '2026-08-17' });
    expect(committedIntent()).toMatchObject({ type: 'setDue', id: 'a1', dueAt: '2026-08-15', dueEndAt: '2026-08-17' });
  });

  it('set_due with due=null clears the due (declarative)', async () => {
    await call('set_due', { node_id: 'a1', due: null });
    expect(committedIntent()).toMatchObject({ type: 'setDue', id: 'a1', dueAt: null, dueTime: null, dueEndAt: null, dueEndTime: null });
  });

  it('set_due rejects a malformed date with a clear message, and never commits', async () => {
    const result = await call('set_due', { node_id: 'a1', due: 'next friday' });
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/not a valid date/i);
    expect(commitIntent).not.toHaveBeenCalled();
  });

  it('set_due rejects an end date before the start', async () => {
    const result = await call('set_due', { node_id: 'a1', due: '2026-08-17', due_end: '2026-08-15' });
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/before/i);
    expect(commitIntent).not.toHaveBeenCalled();
  });

  it('set_due rejects a same-day range whose end time precedes the start time (review P2)', async () => {
    const result = await call('set_due', {
      node_id: 'a1',
      due: '2026-08-15',
      due_time: '19:00',
      due_end: '2026-08-15',
      due_end_time: '18:00',
    });
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/before due_time/i);
    expect(commitIntent).not.toHaveBeenCalled();
  });

  it('set_due allows a same-day range when the end time is later (sanity)', async () => {
    await call('set_due', { node_id: 'a1', due: '2026-08-15', due_time: '18:00', due_end: '2026-08-15', due_end_time: '19:00' });
    expect(committedIntent()).toMatchObject({ type: 'setDue', dueTime: '18:00', dueEndTime: '19:00' });
  });

  it('set_due rejects a time/range while clearing the due', async () => {
    const result = await call('set_due', { node_id: 'a1', due: null, due_time: '19:00' });
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/clearing the due/i);
  });

  it('set_due refuses a structural container', async () => {
    const result = await call('set_due', { node_id: 'inbox', due: '2026-08-15' });
    expect(result.isError).toBe(true);
    expect(firstText(result)).toContain('container');
    expect(commitIntent).not.toHaveBeenCalled();
  });

  it('move_node → moveNode (action to a valid destination)', async () => {
    await call('move_node', { node_id: 'a1', new_parent_id: 'actions' }); // a1 (action) → Free actions
    expect(committedIntent()).toMatchObject({ type: 'moveNode', id: 'a1', newParentId: 'actions' });
  });

  it('create_project rejects a non-project parent (#1054)', async () => {
    const result = await call('create_project', { title: 'X', parent_id: 'a1' }); // a1 is a leaf action
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/not a project/i);
    expect(commitIntent).not.toHaveBeenCalled();
  });

  it('add_action rejects a non-project parent (#1054)', async () => {
    const result = await call('add_action', { project_id: 'a1', title: 'X' }); // a1 is a leaf action
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/not a project/i);
    expect(commitIntent).not.toHaveBeenCalled();
  });

  it('move_node rejects an invalid destination — under a leaf action or the projects container (#1054)', async () => {
    const underAction = await call('move_node', { node_id: 'a1', new_parent_id: 'a1' });
    expect(underAction.isError).toBe(true);
    const underContainer = await call('move_node', { node_id: 'a1', new_parent_id: 'projects' });
    expect(underContainer.isError).toBe(true);
    expect(firstText(underContainer)).toMatch(/not a valid destination/i);
    expect(commitIntent).not.toHaveBeenCalled();
  });

  it('delete_node deletes a childless leaf directly, returning a 1-node manifest (#1092)', async () => {
    const result = await call('delete_node', { node_id: 'i1' });
    expect(committedIntent()).toEqual({ type: 'deleteLeaf', id: 'i1' });
    const payload = JSON.parse(firstText(result));
    expect(payload).toMatchObject({ ok: true, outcome: 'synced', deletedCount: 1 });
    expect(payload.deleted).toEqual([{ id: 'i1', title: 'Buy milk' }]);
  });

  it('delete_node REFUSES a node with children unless recursive:true (#1092)', async () => {
    const result = await call('delete_node', { node_id: 'p1' }); // p1 has child a1
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/recursive:true/i);
    expect(commitIntent).not.toHaveBeenCalled();
  });

  it('delete_node with recursive:true removes the subtree and returns its manifest (#1092)', async () => {
    const result = await call('delete_node', { node_id: 'p1', recursive: true });
    expect(committedIntent()).toEqual({ type: 'deleteRecursive', id: 'p1' });
    const payload = JSON.parse(firstText(result));
    expect(payload).toMatchObject({ ok: true, outcome: 'synced', deletedCount: 2 });
    expect(payload.deleted.map((d: { id: string }) => d.id).sort()).toEqual(['a1', 'p1']);
  });

  it('delete_node refuses (no data loss) when the workspace changed under it (#1092 conflict-safety)', async () => {
    // The gate + manifest were computed on the read snapshot; a conflict means commitIntent did NOT
    // replay (replayOnConflict:false) — delete_node must surface that, not report a false success.
    commitIntent.mockResolvedValueOnce({ snapshot: { document: makeDoc(), version: 8 }, outcome: 'reloaded' });
    const result = await call('delete_node', { node_id: 'p1', recursive: true });
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/changed|re-read|retry/i);
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
