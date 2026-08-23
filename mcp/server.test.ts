// P0 verification for the read-only MCP server: assert the full tool surface and
// exercise a read path end-to-end over an in-memory transport (no Supabase needed).
// `pull` is mocked, so this runs anywhere `npm run test` does.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NamNode, WorkspaceDocument } from '../src/domain/types';

const pull = vi.fn();
const push = vi.fn();
vi.mock('../src/sync/workspaceClient', () => ({ pull, push }));

// Imported after the mock is registered.
const { buildServer, assertNoAuthAllowed } = await import('./server');

// --- Minimal valid workspace (mirrors src/domain/lenses.test.ts skeleton) ---

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
  add(node('i1', { title: 'Buy milk', tags: ['errand'] }));
  add(node('p1', { title: 'Launch', project: true, tags: ['work'] }));
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

// A typed-but-unused stand-in: tools that read go through the mocked `pull`.
const fakeClient = {} as SupabaseClient;

async function connectedClient(opts?: { canWrite?: boolean; workspace?: string }) {
  const server = buildServer(fakeClient, opts);
  const client = new Client({ name: 'test', version: '0.0.0' });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientT), server.connect(serverT)]);
  return { client, server };
}

function firstText(result: { content: { type: string; text?: string }[] }): string {
  const block = result.content.find((c) => c.type === 'text');
  return block?.text ?? '';
}

const EXPECTED_READ_TOOLS = [
  'get_workspace_context',
  'list_inbox',
  'list_projects',
  'list_next_actions',
  'list_backlog',
  'list_done',
  'list_someday',
  'list_checklists',
  'list_saved_views',
  'list_stalled_projects',
  'list_gone_quiet',
  'list_project_children',
  'list_subtree',
  'find_node',
  'get_node',
  'list_resources',
  'render_project_md',
];

const EXPECTED_WRITE_TOOLS = [
  'add_inbox_item',
  'create_project',
  'add_action',
  'add_actions',
  'set_status',
  'add_next_action',
  'mark_next',
  'mark_done',
  'mark_backlog',
  'mark_someday',
  'mark_checklist',
  'unmark_checklist',
  'mark_not_stalled',
  'unmark_not_stalled',
  'reset_checklist',
  'update_node',
  'update_tags',
  'set_due',
  'move_node',
  'delete_node',
  'add_blocked_by',
  'remove_blocked_by',
  'add_resource',
  'remove_resource',
  'edit_resource',
];

describe('NamWeb MCP server (read surface)', () => {
  beforeEach(() => {
    pull.mockReset();
    pull.mockResolvedValue({ kind: 'ok', document: makeDoc(), version: 1 });
  });
  afterEach(() => vi.restoreAllMocks());

  it('advertises exactly the desktop-parity read + write tool surface', async () => {
    const { client, server } = await connectedClient();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      [...EXPECTED_READ_TOOLS, ...EXPECTED_WRITE_TOOLS].sort(),
    );
    await server.close();
  });

  it('annotates read tools read-only and write tools as writes/destructive (#1069)', async () => {
    const { client, server } = await connectedClient();
    const tools = (await client.listTools()).tools;
    const ann = (name: string) => tools.find((t) => t.name === name)?.annotations;
    expect(ann('list_projects')?.readOnlyHint).toBe(true);
    expect(ann('list_subtree')?.readOnlyHint).toBe(true);
    expect(ann('create_project')?.readOnlyHint).toBe(false);
    expect(ann('add_action')?.destructiveHint).toBe(false);
    expect(ann('delete_node')?.destructiveHint).toBe(true);
    expect(ann('remove_resource')?.destructiveHint).toBe(true);
    await server.close();
  });

  it('reads from the workspace the token selected', async () => {
    const { client, server } = await connectedClient({ workspace: 'dev' });
    await client.callTool({ name: 'list_inbox', arguments: {} });
    expect(pull).toHaveBeenCalledWith(fakeClient, 'dev');
    await server.close();
  });

  it('still advertises the write tools on a read-only connection — a stable tool list (#1116)', async () => {
    const { client, server } = await connectedClient({ canWrite: false });
    const names = (await client.listTools()).tools.map((t) => t.name);
    // Write tools are registered regardless of canWrite, so the advertised list never flaps across a
    // deploy/reconnect (the #1116 fix). They refuse at call time instead of vanishing.
    expect(names.sort()).toEqual([...EXPECTED_READ_TOOLS, ...EXPECTED_WRITE_TOOLS].sort());
    await server.close();
  });

  it('a write tool on a read-only connection refuses with a clear, interpretable message (#1116)', async () => {
    const { client, server } = await connectedClient({ canWrite: false });
    const result = await client.callTool({ name: 'add_inbox_item', arguments: { title: 'X' } });
    expect((result as { isError?: boolean }).isError).toBe(true);
    const text = firstText(result as never);
    expect(text).toMatch(/read-only/i); // names the condition
    expect(text).toMatch(/nam\.write/); // and the missing scope — an agent can interpret it
    await server.close();
  });

  it('render_project_md returns the project as one Markdown document; refuses an action (#1196)', async () => {
    const { client, server } = await connectedClient();
    const ok = await client.callTool({ name: 'render_project_md', arguments: { project_id: 'p1' } });
    expect((ok as { isError?: boolean }).isError).toBeFalsy();
    expect(firstText(ok as never)).toContain('# Launch'); // the project title as an H1
    const bad = await client.callTool({ name: 'render_project_md', arguments: { project_id: 'i1' } });
    expect((bad as { isError?: boolean }).isError).toBe(true);
    expect(firstText(bad as never)).toMatch(/not a project/i); // an action is refused clearly
    await server.close();
  });

  it('get_workspace_context reports capabilities (canWrite, serverVersion) + counts, tags, titles (#1099)', async () => {
    const { client, server } = await connectedClient(); // default canWrite: true
    const result = await client.callTool({ name: 'get_workspace_context', arguments: {} });
    const ctx = JSON.parse(firstText(result as never));
    expect(ctx).toEqual({
      canWrite: true,
      serverVersion: expect.any(String),
      projectCount: 1,
      inboxCount: 1,
      tags: expect.arrayContaining(['work', 'errand']),
      projects: ['Launch'],
    });
    expect(pull).toHaveBeenCalledOnce();
    await server.close();
  });

  it('get_workspace_context reports canWrite:false for a read-only connection (#1099)', async () => {
    const { client, server } = await connectedClient({ canWrite: false });
    const result = await client.callTool({ name: 'get_workspace_context', arguments: {} });
    expect(JSON.parse(firstText(result as never)).canWrite).toBe(false);
    await server.close();
  });

  it('list_project_children projects actions and sub-projects of the given id', async () => {
    const { client, server } = await connectedClient();
    const result = await client.callTool({
      name: 'list_project_children',
      arguments: { project_id: 'projects' },
    });
    const payload = JSON.parse(firstText(result as never));
    expect(payload.subProjects).toEqual([
      {
        id: 'p1',
        type: 'project',
        title: 'Launch',
        status: 'BACKLOG',
        path: [],
        childCount: 0,
        tags: ['work'],
        tagKinds: { system: [], sharing: [], context: ['work'] },
      },
    ]);
    expect(payload.actions).toEqual([]);
    await server.close();
  });

  it('surfaces a read failure as a tool error, not a throw', async () => {
    pull.mockResolvedValue({ kind: 'error', message: 'boom' });
    const { client, server } = await connectedClient();
    const result = (await client.callTool({ name: 'list_inbox', arguments: {} })) as {
      isError?: boolean;
      content: { type: string; text?: string }[];
    };
    expect(result.isError).toBe(true);
    expect(firstText(result)).toContain('boom');
    await server.close();
  });
});

// --- Enriched read surface for review work (#1070 projections / #1071 lenses / #1074 subtree) ---

function richDoc(): WorkspaceDocument {
  const nodes: Record<string, NamNode> = {};
  const add = (n: NamNode) => (nodes[n.id] = n);
  add(node('root', { title: 'NAM', childIds: ['inbox', 'projects', 'actions'] }));
  add(node('inbox', { title: 'Inbox' }));
  add(node('projects', { title: 'Projects', childIds: ['p1', 'p2'] }));
  add(node('actions', { title: 'Actions' }));
  add(node('p1', { title: 'Launch', project: true, childIds: ['a1'], tags: ['work', '#in-progress', '#shared-open'] }));
  add(
    node('a1', {
      title: 'Ship it',
      status: 'NEXT',
      tags: ['errand'],
      createdAt: '2026-08-01T09:00:00',
      updatedAt: '2026-08-09T09:00:00',
      statusChangedAt: '2026-08-05T09:00:00',
      dueAt: '2026-08-12',
      dueTime: '14:30',
      description: 'the note',
      resources: [{ type: 'URI', value: 'https://x', description: null }],
    }),
  );
  add(node('p2', { title: 'Stale', project: true, childIds: ['a2'] })); // no NEXT in subtree → stalled
  add(node('a2', { title: 'old thing', status: 'BACKLOG', updatedAt: '2020-01-01T00:00:00' })); // gone quiet
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

describe('MCP read surface enrichment', () => {
  beforeEach(() => {
    pull.mockReset();
    pull.mockResolvedValue({ kind: 'ok', document: richDoc(), version: 1 });
    push.mockReset();
    push.mockResolvedValue({ kind: 'ok', version: 2 }); // writes succeed so we can inspect the echo (#1194)
  });
  afterEach(() => vi.restoreAllMocks());

  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const { client, server } = await connectedClient();
    const result = await client.callTool({ name, arguments: args });
    await server.close();
    return JSON.parse(firstText(result as never));
  };

  it('projects timestamps, due, path, node-type, and note/resource presence (#1070)', async () => {
    const [a1] = await call('list_next_actions');
    expect(a1).toMatchObject({
      id: 'a1',
      type: 'action',
      title: 'Ship it',
      status: 'NEXT',
      path: ['Launch'], // ancestor project, resolved server-side
      dueAt: '2026-08-12',
      dueTime: '14:30',
      createdAt: '2026-08-01T09:00:00',
      updatedAt: '2026-08-09T09:00:00',
      statusChangedAt: '2026-08-05T09:00:00',
      hasDescription: true, // presence in lists; full text via get_node (#1106)
      resourceCount: 1,
      tags: ['errand'],
    });
  });

  it('get_node returns the full description text, blocked-by, and resources (#1106)', async () => {
    const node = await call('get_node', { node_id: 'a1' });
    expect(node).toMatchObject({
      id: 'a1',
      type: 'action',
      title: 'Ship it',
      description: 'the note', // the actual text, not just hasDescription
      path: ['Launch'],
      resources: [{ index: 0, type: 'URI', value: 'https://x', description: null }],
    });
    // presence flags are replaced by the real data
    expect(node.hasDescription).toBeUndefined();
    expect(node.resourceCount).toBeUndefined();
  });

  it('get_node errors on an unknown id', async () => {
    const { client, server } = await connectedClient();
    const result = (await client.callTool({ name: 'get_node', arguments: { node_id: 'nope' } })) as {
      isError?: boolean;
      content: { type: string; text?: string }[];
    };
    expect(result.isError).toBe(true);
    await server.close();
  });

  // Write-echo (#1194): every write returns the resulting node in get_node form (or `deleted`), so a
  // write is self-confirming — no verification-read, and a clobber/mis-move is visible immediately.
  it('update_tags echoes the resulting node with its new tags (#1194)', async () => {
    const r = await call('update_tags', { node_id: 'a1', tags: ['errand', 'urgent'] });
    expect(r.outcome).toBe('synced');
    expect(r.id).toBe('a1');
    expect(r.node).toMatchObject({ id: 'a1', title: 'Ship it', tags: ['errand', 'urgent'] });
    expect(r.node.description).toBe('the note'); // full get_node form, not a stub
  });

  it('update_tags sets context tags but PRESERVES existing system/sharing tags (#1192)', async () => {
    // p1 carries context 'work' + system '#in-progress' + sharing '#shared-open'.
    const r = await call('update_tags', { node_id: 'p1', tags: ['roadmap'] });
    expect(r.node.tags).toContain('roadmap'); // new context tag applied
    expect(r.node.tags).not.toContain('work'); // old context tag replaced
    expect(r.node.tags).toContain('#in-progress'); // system tag untouched
    expect(r.node.tags).toContain('#shared-open'); // sharing tag untouched
  });

  it('update_tags refuses a system tag in the input (#1192)', async () => {
    const { client, server } = await connectedClient();
    const r = (await client.callTool({
      name: 'update_tags',
      arguments: { node_id: 'a1', tags: ['#checklist'] },
    })) as { isError?: boolean; content: { type: string; text?: string }[] };
    expect(r.isError).toBe(true);
    expect(firstText(r as never)).toMatch(/system tag|semantic ops/i);
    await server.close();
  });

  it('a status write echoes the new status (#1194): mark_done', async () => {
    const r = await call('mark_done', { node_id: 'a1' });
    expect(r.node).toMatchObject({ id: 'a1', status: 'DONE' });
  });

  it('mark_not_stalled / unmark_not_stalled toggle the #not-stalled system tag on a project (#1193)', async () => {
    const marked = await call('mark_not_stalled', { project_id: 'p2' });
    expect(marked.node.tags).toContain('#not-stalled');
    expect(marked.node.tagKinds.system).toContain('#not-stalled');
    const unmarked = await call('unmark_not_stalled', { project_id: 'p2' });
    expect(unmarked.node.tags ?? []).not.toContain('#not-stalled');
  });

  it('mark_not_stalled refuses an action (projects only) (#1193)', async () => {
    const { client, server } = await connectedClient();
    const r = (await client.callTool({ name: 'mark_not_stalled', arguments: { project_id: 'a1' } })) as {
      isError?: boolean;
    };
    expect(r.isError).toBe(true);
    await server.close();
  });

  it('a create echoes the new node with its id (#1194): add_action', async () => {
    const r = await call('add_action', { project_id: 'p1', title: 'New one' });
    expect(typeof r.id).toBe('string');
    expect(r.node).toMatchObject({ id: r.id, title: 'New one', type: 'action', status: 'BACKLOG' });
  });

  it('add_action accepts a description at creation (#1198)', async () => {
    const r = await call('add_action', { project_id: 'p1', title: 'With notes', description: 'a birth note' });
    expect(r.node.description).toBe('a birth note');
  });

  it('add_actions adds many in one atomic call, echoing each node (#1198)', async () => {
    const r = await call('add_actions', {
      project_id: 'p1',
      items: [
        { title: 'First', status: 'NEXT' },
        { title: 'Second', description: 'with a note' },
      ],
    });
    expect(r.count).toBe(2);
    expect(r.nodes.map((n: { title: string }) => n.title)).toEqual(['First', 'Second']);
    expect(r.nodes[0]).toMatchObject({ title: 'First', status: 'NEXT' });
    expect(r.nodes[1].description).toBe('with a note');
  });

  it('add_actions is atomic — one invalid item writes nothing (#1198)', async () => {
    const { client, server } = await connectedClient();
    const res = (await client.callTool({
      name: 'add_actions',
      arguments: { project_id: 'nope', items: [{ title: 'x' }] },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true); // unknown project → nothing written
    await server.close();
  });

  it('set_status updates several nodes in one call (#1198)', async () => {
    const r = await call('set_status', { node_ids: ['a1', 'a2'], status: 'SOMEDAY' });
    expect(r.count).toBe(2);
    expect(r.nodes.every((n: { status: string }) => n.status === 'SOMEDAY')).toBe(true);
  });

  it('delete_node self-confirms with its removed-nodes manifest, not a node echo (#1092/#1194)', async () => {
    const r = await call('delete_node', { node_id: 'a1' });
    expect(r.deletedCount).toBe(1);
    expect(r.deleted).toEqual([{ id: 'a1', title: 'Ship it' }]);
    expect(r.node).toBeUndefined(); // delete is a raw handler, not the shared commit/echo path
  });

  it('classifies tags into system / sharing / context lanes (#1070)', async () => {
    const projects = await call('list_projects');
    const launch = projects.find((p: { id: string }) => p.id === 'p1');
    expect(launch.type).toBe('project');
    expect(launch.tagKinds).toEqual({
      system: ['#in-progress'],
      sharing: ['#shared-open'],
      context: ['work'],
    });
  });

  it('find_node: exact-match narrows a substring hit (#1199)', async () => {
    expect((await call('find_node', { title: 'Ship' })).map((n: { id: string }) => n.id)).toContain('a1');
    expect((await call('find_node', { title: 'Ship', exact: true })).some((n: { id: string }) => n.id === 'a1')).toBe(false);
    expect((await call('find_node', { title: 'Ship it', exact: true })).map((n: { id: string }) => n.id)).toContain('a1');
  });

  it('find_node: type filter restricts to projects/actions (#1199)', async () => {
    const projectsOnly = await call('find_node', { title: 'l', type: 'project' }); // matches Launch, Stale, old thing
    expect(projectsOnly.length).toBeGreaterThan(0);
    expect(projectsOnly.every((n: { type: string }) => n.type === 'project')).toBe(true);
  });

  it('list_backlog filters by project subtree; unknown project errors (#1199)', async () => {
    expect((await call('list_backlog')).map((n: { id: string }) => n.id)).toEqual(['a2']); // only BACKLOG
    expect((await call('list_backlog', { project_id: 'p2' })).map((n: { id: string }) => n.id)).toEqual(['a2']);
    expect(await call('list_backlog', { project_id: 'p1' })).toEqual([]); // p1's only action is NEXT
    const { client, server } = await connectedClient();
    const bad = (await client.callTool({ name: 'list_backlog', arguments: { project_id: 'nope' } })) as { isError?: boolean };
    expect(bad.isError).toBe(true); // not a silent empty (#1200 principle)
    await server.close();
  });

  it('list_next_actions filters by project subtree (#1199)', async () => {
    expect((await call('list_next_actions', { project_id: 'p1' })).map((n: { id: string }) => n.id)).toEqual(['a1']);
  });

  it('list_subtree include_descriptions inlines full descriptions like get_node (#1197)', async () => {
    const plain = await call('list_subtree', { node_id: 'p1' });
    const a1plain = plain.find((n: { id: string }) => n.id === 'a1');
    expect(a1plain.hasDescription).toBe(true); // presence flag by default
    expect(a1plain.description).toBeUndefined();

    const rich = await call('list_subtree', { node_id: 'p1', include_descriptions: true });
    const a1rich = rich.find((n: { id: string }) => n.id === 'a1');
    expect(a1rich.description).toBe('the note'); // full text inline
    expect(a1rich.resources).toEqual([{ index: 0, type: 'URI', value: 'https://x', description: null }]);
    expect(a1rich.depth).toBe(1); // still carries depth
  });

  it('list_subtree returns the node + descendants with depth, and honors a depth cap (#1074)', async () => {
    const full = await call('list_subtree', { node_id: 'p1' });
    expect(full.map((n: { id: string; depth: number }) => [n.id, n.depth])).toEqual([
      ['p1', 0],
      ['a1', 1],
    ]);
    const capped = await call('list_subtree', { node_id: 'p1', depth: 0 });
    expect(capped.map((n: { id: string }) => n.id)).toEqual(['p1']);
  });

  it('list_subtree dedupes a node reachable via two parents (malformed DAG), emitting it once', async () => {
    const dag = richDoc();
    dag.nodes['p1'].childIds = ['a1', 'p2']; // p1 → a1, p2
    dag.nodes['p2'].childIds = ['a1']; // …and p2 → a1 too (a1 has two parents)
    pull.mockResolvedValue({ kind: 'ok', document: dag, version: 1 });
    const sub = await call('list_subtree', { node_id: 'p1' });
    // Without the visited-guard a1 would appear twice; it must appear exactly once and terminate.
    expect(sub.map((n: { id: string }) => n.id)).toEqual(['p1', 'a1', 'p2']);
  });

  it('list_stalled_projects and list_gone_quiet run the review lenses server-side (#1071)', async () => {
    const stalled = await call('list_stalled_projects');
    expect(stalled.map((n: { id: string }) => n.id)).toEqual(['p2']); // Stale has no NEXT; Launch does
    const quiet = await call('list_gone_quiet');
    expect(quiet.map((n: { id: string }) => n.id)).toContain('a2'); // untouched since 2020
  });
});

describe('assertNoAuthAllowed — dev no-auth fail-closed guard (#1050)', () => {
  it('allows no-auth in a local/dev context', () => {
    expect(() => assertNoAuthAllowed({})).not.toThrow();
    expect(() => assertNoAuthAllowed({ NAM_MCP_ISSUER_URL: 'http://127.0.0.1:3333' })).not.toThrow();
    expect(() => assertNoAuthAllowed({ NODE_ENV: 'development' })).not.toThrow();
  });

  it('refuses no-auth when NODE_ENV=production', () => {
    expect(() => assertNoAuthAllowed({ NODE_ENV: 'production' })).toThrow(/refusing to start/i);
  });

  it('refuses no-auth when the issuer is https (a real deployment)', () => {
    expect(() => assertNoAuthAllowed({ NAM_MCP_ISSUER_URL: 'https://mcp.example.com' })).toThrow(
      /refusing to start/i,
    );
  });
});
