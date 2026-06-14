// P0 verification for the read-only MCP server: assert the full tool surface and
// exercise a read path end-to-end over an in-memory transport (no Supabase needed).
// `pull` is mocked, so this runs anywhere `npm run test` does.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NamNode, WorkspaceDocument } from '../src/domain/types';

const pull = vi.fn();
vi.mock('../src/sync/workspaceClient', () => ({ pull }));

// Imported after the mock is registered.
const { buildServer } = await import('./server');

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

async function connectedClient() {
  const server = buildServer(fakeClient);
  const client = new Client({ name: 'test', version: '0.0.0' });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientT), server.connect(serverT)]);
  return { client, server };
}

function firstText(result: { content: { type: string; text?: string }[] }): string {
  const block = result.content.find((c) => c.type === 'text');
  return block?.text ?? '';
}

const EXPECTED_TOOLS = [
  'get_workspace_context',
  'list_inbox',
  'list_projects',
  'list_next_actions',
  'list_backlog',
  'list_done',
  'list_saved_views',
  'list_project_children',
  'find_node',
  'list_resources',
];

describe('NamWeb MCP read-only server', () => {
  beforeEach(() => {
    pull.mockReset();
    pull.mockResolvedValue({ kind: 'ok', document: makeDoc(), version: 1 });
  });
  afterEach(() => vi.restoreAllMocks());

  it('advertises exactly the desktop-parity read tool surface', async () => {
    const { client, server } = await connectedClient();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...EXPECTED_TOOLS].sort());
    await server.close();
  });

  it('get_workspace_context returns counts, tags, and project titles from pull()', async () => {
    const { client, server } = await connectedClient();
    const result = await client.callTool({ name: 'get_workspace_context', arguments: {} });
    const ctx = JSON.parse(firstText(result as never));
    expect(ctx).toEqual({
      projectCount: 1,
      inboxCount: 1,
      tags: expect.arrayContaining(['work', 'errand']),
      projects: ['Launch'],
    });
    expect(pull).toHaveBeenCalledOnce();
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
      { id: 'p1', title: 'Launch', status: 'BACKLOG', childCount: 0, path: [] },
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
