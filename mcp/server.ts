// NamWeb remote MCP server — read + write, OAuth-gated (issues #105 P0, #107 P1, #109 P2).
//
// Standalone Node entry (run via `tsx`, NOT bundled by Vite). It reuses NamWeb's
// React-free core directly: `pull()` from the Supabase `workspaces` row + the
// `domain/lenses` projections. The AI↔app contract is that row — exactly what the
// SPA and NamDesktop cloud-sync share.
//
// P1: this server is the OAuth 2.1/PKCE Authorization Server (Supabase-backed,
// see ./auth/*); each request runs under the authenticated user's Supabase JWT and
// RLS. `NAM_MCP_DEV_NOAUTH=1` keeps the P0 shared-session path for local/Inspector.
// P2: write tools — each maps to a domain `Intent` committed via `commitIntent`
// (version guard + conflict-replay), so concurrent SPA/device edits never clobber.
// Human control is connector-side per-write confirmation. Phasing → P3 Realtime,
// P4 hosting. See docs/features/remote-mcp/design.md.

import express, { type Request, type Response } from 'express';
import { pathToFileURL } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthRouter,
} from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { z } from 'zod';

import { SupabaseOAuthProvider, supabaseClientFromAuth } from './auth/provider';
import { SCOPE_WRITE, SUPPORTED_SCOPES } from './auth/scopes';
import type { AuthStore } from './auth/stores';
import { PostgresAuthStore } from './auth/postgresStore';
import { ensureSchema, getPool } from './db/pool';

import { pull } from '../src/sync/workspaceClient';
import { commitIntent, type CommitOutcome, type WorkspaceSnapshot } from '../src/store/commit';
import { normalizeTags, type Intent } from '../src/domain/mutations';
import { newId, nowIso } from '../src/lib/local';
import type { NamNode, NodeStatus, Resource, WorkspaceDocument } from '../src/domain/types';
import {
  allTags,
  backlogItems,
  doneItems,
  getNode,
  inboxItems,
  nextActions,
  projectActions,
  projectPath,
  projects,
  searchResults,
  subProjects,
} from '../src/domain/lenses';

// ---- Config --------------------------------------------------------------

// Config is read lazily (inside main()/loadDoc) so importing this module for tests
// never triggers the missing-env exits below.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var ${name}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return value;
}

function workspaceName(): string {
  return process.env.VITE_WORKSPACE_NAME ?? 'default';
}

// ---- Supabase session (P0: password sign-in stands in for P1 OAuth) ------

async function signedInClient(): Promise<SupabaseClient> {
  const email = requireEnv('NAM_MCP_EMAIL');
  const client = createClient(
    requireEnv('VITE_SUPABASE_URL'),
    requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: true } },
  );
  const { error } = await client.auth.signInWithPassword({
    email,
    password: requireEnv('NAM_MCP_PASSWORD'),
  });
  if (error) {
    console.error(`Supabase sign-in failed for ${email}: ${error.message}`);
    process.exit(1);
  }
  return client;
}

// ---- Tool plumbing -------------------------------------------------------

type TextResult = { content: { type: 'text'; text: string }[] };

function json(data: unknown): TextResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message: string): TextResult & { isError: true } {
  return { isError: true, content: [{ type: 'text', text: message }] };
}

/** Pull the current snapshot (document + version), or throw a tool-friendly message. */
async function loadSnapshot(client: SupabaseClient, name: string): Promise<WorkspaceSnapshot> {
  const result = await pull(client, name);
  if (result.kind === 'ok') return { document: result.document, version: result.version };
  if (result.kind === 'noRemote') {
    throw new Error(`No workspace row named "${name}" for this user yet.`);
  }
  throw new Error(`Failed to read workspace: ${result.message}`);
}

/** Pull just the current document (reads), or throw a message suitable for a tool error. */
async function loadDoc(client: SupabaseClient, name: string): Promise<WorkspaceDocument> {
  return (await loadSnapshot(client, name)).document;
}

// ---- Write helpers (P2) --------------------------------------------------

const NODE_STATUSES = ['NEXT', 'BACKLOG', 'DONE', 'CANCELLED', 'ARCHIVED'] as const;
const RESOURCE_TYPES = ['TEXT', 'EMAIL', 'URI', 'FILE'] as const;

/** Look a node up for a write, throwing a tool-friendly error if it is missing. */
function requireNode(doc: WorkspaceDocument, id: string): NamNode {
  const node = getNode(doc, id);
  if (!node) throw new Error(`No node with id ${id}.`);
  return node;
}

/** Reject writes that target the four structural container nodes. */
function assertNotContainer(doc: WorkspaceDocument, id: string): void {
  if ([doc.rootNodeId, doc.inboxNodeId, doc.projectsNodeId, doc.nextActionsNodeId].includes(id)) {
    throw new Error(`Node ${id} is a structural container and cannot be modified.`);
  }
}

/** The compact result a write tool returns: the commit outcome + any new node id. */
function writeSummary(outcome: CommitOutcome, message: string | undefined, intent: Intent) {
  const summary: { ok: boolean; outcome: CommitOutcome; id?: string; message?: string } = {
    ok: true,
    outcome,
  };
  if (intent.type === 'addInboxItem' || intent.type === 'addAction' || intent.type === 'addSubProject') {
    summary.id = intent.id;
  }
  if (message) summary.message = message;
  return summary;
}

// Compact node projections — small, AI-friendly shapes (not the whole NamNode).
function briefNode(n: NamNode) {
  return { id: n.id, title: n.title, status: n.status, tags: n.tags };
}
function projectBrief(doc: WorkspaceDocument, n: NamNode) {
  return {
    id: n.id,
    title: n.title,
    status: n.status,
    childCount: n.childIds.length,
    path: projectPath(doc, n.id),
  };
}
function resourceBrief(r: Resource, index: number) {
  return { index, type: r.type, value: r.value, description: r.description };
}

/**
 * Build a fresh McpServer with the 10 read tools registered, each closing over the
 * shared authenticated `client`. A new instance is created per HTTP request (the
 * canonical stateless Streamable-HTTP pattern); registration is cheap.
 */
export function buildServer(
  client: SupabaseClient,
  { canWrite = true, workspace = workspaceName() }: { canWrite?: boolean; workspace?: string } = {},
): McpServer {
  const server = new McpServer({ name: 'namweb', version: '0.1.0' });

  const read = (
    name: string,
    description: string,
    handler: (doc: WorkspaceDocument) => unknown,
  ) =>
    server.registerTool(name, { description }, async () => {
      try {
        return json(handler(await loadDoc(client, workspace)));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    });

  // Run a write: pull a fresh snapshot, build the intent from it, then commit it
  // (version guard + conflict-replay). Build-time errors (missing node, structural
  // guard) and push failures surface as tool errors, not throws.
  const commit = async (build: (doc: WorkspaceDocument) => Intent): Promise<TextResult> => {
    try {
      const snapshot = await loadSnapshot(client, workspace);
      const intent = build(snapshot.document);
      const result = await commitIntent(client, workspace, snapshot, intent);
      if (result.outcome === 'error') return errorResult(result.message ?? 'Write failed.');
      return json(writeSummary(result.outcome, result.message, intent));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  };

  read(
    'get_workspace_context',
    'Get a compact summary of the workspace: project titles, tags in use, and inbox/project counts.',
    (doc) => ({
      projectCount: projects(doc).length,
      inboxCount: inboxItems(doc).length,
      tags: allTags(doc),
      projects: projects(doc).map((p) => p.title),
    }),
  );
  read('list_inbox', 'List all items currently in the Inbox.', (doc) =>
    inboxItems(doc).map(briefNode),
  );
  read('list_projects', 'List all top-level projects.', (doc) =>
    projects(doc).map((p) => projectBrief(doc, p)),
  );
  read('list_next_actions', 'List all actions with status NEXT across the whole workspace.', (doc) =>
    nextActions(doc).map(briefNode),
  );
  read('list_backlog', 'List all actions with status BACKLOG across the whole workspace.', (doc) =>
    backlogItems(doc).map(briefNode),
  );
  read('list_done', 'List all actions with status DONE across the whole workspace.', (doc) =>
    doneItems(doc).map(briefNode),
  );
  read(
    'list_saved_views',
    'List the saved views (user-defined tag filters) defined in the workspace.',
    (doc) => doc.savedViews,
  );

  server.registerTool(
    'list_project_children',
    {
      description: 'List the direct children (actions and sub-projects) of a project node.',
      inputSchema: { project_id: z.string().describe('UUID of the project') },
    },
    async ({ project_id }) => {
      try {
        const doc = await loadDoc(client, workspace);
        return json({
          actions: projectActions(doc, project_id).map(briefNode),
          subProjects: subProjects(doc, project_id).map((p) => projectBrief(doc, p)),
        });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.registerTool(
    'find_node',
    {
      description:
        'Find nodes by title or tag (case-insensitive substring match) across actions and projects.',
      inputSchema: { title: z.string().describe('Substring to search for') },
    },
    async ({ title }) => {
      try {
        const doc = await loadDoc(client, workspace);
        return json(
          searchResults(doc, title).map(({ node, path }) => ({ ...briefNode(node), path })),
        );
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.registerTool(
    'list_resources',
    {
      description: 'List all resources (links, files, notes) attached to a node.',
      inputSchema: { node_id: z.string().describe('UUID of the node') },
    },
    async ({ node_id }) => {
      try {
        const doc = await loadDoc(client, workspace);
        const node = getNode(doc, node_id);
        if (!node) return errorResult(`No node with id ${node_id}.`);
        return json(node.resources.map(resourceBrief));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ---- Write tools (P2) ----------------------------------------------------
  // Each maps to a domain Intent committed via `commit`. Human confirmation is
  // connector-side (both ChatGPT and Claude prompt before a tool call). Gated on
  // the `nam.write` scope: a read-only token never sees these tools at all.
  if (!canWrite) return server;

  server.registerTool(
    'add_inbox_item',
    {
      description: 'Capture a new item into the Inbox for later triage.',
      inputSchema: { title: z.string().describe('The item text') },
    },
    ({ title }) => commit(() => ({ type: 'addInboxItem', id: newId(), title, now: nowIso() })),
  );

  server.registerTool(
    'create_project',
    {
      description:
        'Create a project. With no parent_id it becomes a top-level project; with parent_id it nests under that project.',
      inputSchema: {
        title: z.string().describe('Project title'),
        parent_id: z.string().optional().describe('UUID of the parent project; omit for top-level'),
      },
    },
    ({ title, parent_id }) =>
      commit((doc) => {
        if (parent_id) requireNode(doc, parent_id);
        const parentId = parent_id ?? doc.projectsNodeId;
        return { type: 'addSubProject', parentId, id: newId(), title, now: nowIso() };
      }),
  );

  server.registerTool(
    'add_action',
    {
      description: 'Add an action to a project. Defaults to status NEXT.',
      inputSchema: {
        project_id: z.string().describe('UUID of the project to add the action to'),
        title: z.string().describe('Action title'),
        status: z.enum(NODE_STATUSES).optional().describe('Defaults to NEXT'),
      },
    },
    ({ project_id, title, status }) =>
      commit((doc) => {
        requireNode(doc, project_id);
        return {
          type: 'addAction',
          parentId: project_id,
          id: newId(),
          title,
          status: status ?? 'NEXT',
          now: nowIso(),
        };
      }),
  );

  server.registerTool(
    'add_next_action',
    {
      description: 'Add a free-standing NEXT action, not attached to any project.',
      inputSchema: { title: z.string().describe('Action title') },
    },
    ({ title }) =>
      commit((doc) => ({
        type: 'addAction',
        parentId: doc.nextActionsNodeId,
        id: newId(),
        title,
        status: 'NEXT',
        now: nowIso(),
      })),
  );

  const markStatus = (toolName: string, status: NodeStatus) =>
    server.registerTool(
      toolName,
      {
        description: `Set a node's status to ${status}.`,
        inputSchema: { node_id: z.string().describe('UUID of the node') },
      },
      ({ node_id }) =>
        commit((doc) => {
          assertNotContainer(doc, node_id);
          requireNode(doc, node_id);
          return { type: 'setStatus', id: node_id, status, now: nowIso() };
        }),
    );
  markStatus('mark_next', 'NEXT');
  markStatus('mark_done', 'DONE');
  markStatus('mark_backlog', 'BACKLOG');

  server.registerTool(
    'update_node',
    {
      description: 'Update a node title and/or description. Omitted fields are left unchanged.',
      inputSchema: {
        node_id: z.string().describe('UUID of the node'),
        title: z.string().optional().describe('New title'),
        description: z.string().nullable().optional().describe('New description, or null to clear'),
      },
    },
    ({ node_id, title, description }) =>
      commit((doc) => {
        const node = requireNode(doc, node_id);
        assertNotContainer(doc, node_id);
        return {
          type: 'updateNode',
          id: node_id,
          title: title ?? node.title,
          description: description !== undefined ? description : node.description,
          now: nowIso(),
        };
      }),
  );

  server.registerTool(
    'update_tags',
    {
      description:
        'Replace the full tag list on a node (tags are normalized: trimmed, lowercased, de-duplicated).',
      inputSchema: {
        node_id: z.string().describe('UUID of the node'),
        tags: z.array(z.string()).describe('The complete new tag list'),
      },
    },
    ({ node_id, tags }) =>
      commit((doc) => {
        assertNotContainer(doc, node_id);
        requireNode(doc, node_id);
        return { type: 'updateTags', id: node_id, tags: normalizeTags(tags), now: nowIso() };
      }),
  );

  server.registerTool(
    'move_node',
    {
      description:
        'Move a node under a new parent. Structural cycles and container moves are rejected.',
      inputSchema: {
        node_id: z.string().describe('UUID of the node to move'),
        new_parent_id: z.string().describe('UUID of the new parent'),
      },
    },
    ({ node_id, new_parent_id }) =>
      commit((doc) => {
        assertNotContainer(doc, node_id);
        requireNode(doc, node_id);
        requireNode(doc, new_parent_id);
        return { type: 'moveNode', id: node_id, newParentId: new_parent_id, now: nowIso() };
      }),
  );

  server.registerTool(
    'delete_node',
    {
      description:
        'Delete a node. A node with children is deleted recursively; a leaf is removed directly.',
      inputSchema: { node_id: z.string().describe('UUID of the node to delete') },
    },
    ({ node_id }) =>
      commit((doc) => {
        const node = requireNode(doc, node_id);
        assertNotContainer(doc, node_id);
        return node.childIds.length > 0
          ? { type: 'deleteRecursive', id: node_id }
          : { type: 'deleteLeaf', id: node_id };
      }),
  );

  const prerequisite = (
    toolName: string,
    type: 'addPrerequisite' | 'removePrerequisite',
    verb: string,
  ) =>
    server.registerTool(
      toolName,
      {
        description: `${verb} a blocked-by dependency: node_id is blocked by blocked_by_id.`,
        inputSchema: {
          node_id: z.string().describe('UUID of the dependent (blocked) action'),
          blocked_by_id: z.string().describe('UUID of the prerequisite action'),
        },
      },
      ({ node_id, blocked_by_id }) =>
        commit((doc) => {
          requireNode(doc, node_id);
          requireNode(doc, blocked_by_id);
          return { type, actionId: node_id, prereqId: blocked_by_id, now: nowIso() };
        }),
    );
  prerequisite('add_blocked_by', 'addPrerequisite', 'Add');
  prerequisite('remove_blocked_by', 'removePrerequisite', 'Remove');

  server.registerTool(
    'add_resource',
    {
      description: 'Attach a resource (link, file, note) to a node.',
      inputSchema: {
        node_id: z.string().describe('UUID of the node'),
        type: z.enum(RESOURCE_TYPES).describe('Resource type'),
        value: z.string().describe('The resource value (URL, path, or text)'),
        description: z.string().nullable().optional().describe('Optional label'),
      },
    },
    ({ node_id, type, value, description }) =>
      commit((doc) => {
        const node = requireNode(doc, node_id);
        const resources: Resource[] = [
          ...node.resources,
          { type, value, description: description ?? null },
        ];
        return { type: 'updateResources', id: node_id, resources, now: nowIso() };
      }),
  );

  server.registerTool(
    'remove_resource',
    {
      description:
        'Remove the resource at the given index from a node (see list_resources for indexes).',
      inputSchema: {
        node_id: z.string().describe('UUID of the node'),
        index: z.number().int().nonnegative().describe('Index of the resource to remove'),
      },
    },
    ({ node_id, index }) =>
      commit((doc) => {
        const node = requireNode(doc, node_id);
        if (index >= node.resources.length) throw new Error(`No resource at index ${index}.`);
        const resources = node.resources.filter((_, i) => i !== index);
        return { type: 'updateResources', id: node_id, resources, now: nowIso() };
      }),
  );

  server.registerTool(
    'edit_resource',
    {
      description: 'Edit the resource at the given index. Omitted fields are left unchanged.',
      inputSchema: {
        node_id: z.string().describe('UUID of the node'),
        index: z.number().int().nonnegative().describe('Index of the resource to edit'),
        type: z.enum(RESOURCE_TYPES).optional().describe('New type'),
        value: z.string().optional().describe('New value'),
        description: z.string().nullable().optional().describe('New label, or null to clear'),
      },
    },
    ({ node_id, index, type, value, description }) =>
      commit((doc) => {
        const node = requireNode(doc, node_id);
        const current = node.resources[index];
        if (!current) throw new Error(`No resource at index ${index}.`);
        const updated: Resource = {
          type: type ?? current.type,
          value: value ?? current.value,
          description: description !== undefined ? description : current.description,
        };
        const resources = node.resources.map((r, i) => (i === index ? updated : r));
        return { type: 'updateResources', id: node_id, resources, now: nowIso() };
      }),
  );

  return server;
}

// ---- HTTP (stateless Streamable HTTP at POST /mcp) -----------------------

/**
 * The shared `POST /mcp` handler. `resolveClient` provides the Supabase client to
 * run the request under — the OAuth-resolved per-user client in normal mode, or a
 * single shared client in dev-no-auth mode.
 */
function mcpHandler(
  resolve: (req: Request) => { client: SupabaseClient; canWrite: boolean; workspace: string },
) {
  return async (req: Request, res: Response) => {
    // Stateless: a fresh server + transport per request (no session reuse).
    const { client, canWrite, workspace } = resolve(req);
    const server = buildServer(client, { canWrite, workspace });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('Error handling MCP request:', err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  };
}

async function main() {
  const port = Number(process.env.NAM_MCP_PORT ?? 3333);
  const app = express();

  if (process.env.NAM_MCP_DEV_NOAUTH === '1') {
    // Dev/Inspector escape hatch: no OAuth, one shared signed-in client. Never deploy.
    const client = await signedInClient();
    // Dev shared session has full access; workspace from the env (no consent step).
    app.post(
      '/mcp',
      express.json(),
      mcpHandler(() => ({ client, canWrite: true, workspace: workspaceName() })),
    );
    console.warn('⚠  NAM_MCP_DEV_NOAUTH=1 — OAuth disabled, shared dev session (local only).');
  } else {
    // Normal: this server is the OAuth 2.1 Authorization Server (Supabase-backed).
    const issuerUrl = new URL(process.env.NAM_MCP_ISSUER_URL ?? `http://127.0.0.1:${port}`);

    // Persist OAuth state to the MCP-owned `mcp` Postgres schema when configured,
    // so clients/tokens survive a restart; otherwise fall back to in-memory.
    let store: AuthStore | undefined;
    if (process.env.NAM_MCP_DATABASE_URL) {
      await ensureSchema();
      store = new PostgresAuthStore(getPool());
      console.log('OAuth store: Postgres (mcp schema) — persists across restarts.');
    } else {
      console.warn(
        'OAuth store: in-memory — set NAM_MCP_DATABASE_URL to persist clients/tokens across restarts.',
      );
    }
    const provider = new SupabaseOAuthProvider({ store });
    app.use(
      mcpAuthRouter({
        provider,
        issuerUrl,
        scopesSupported: [...SUPPORTED_SCOPES],
        resourceName: 'NamWeb',
      }),
    );
    app.post('/nam/login', express.urlencoded({ extended: false }), provider.handleLogin);
    app.post(
      '/nam/select-workspace',
      express.urlencoded({ extended: false }),
      provider.handleSelectWorkspace,
    );

    const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(issuerUrl);
    app.post(
      '/mcp',
      express.json(),
      requireBearerAuth({ verifier: provider, resourceMetadataUrl }),
      mcpHandler((req) => ({
        client: supabaseClientFromAuth(req.auth),
        canWrite: req.auth?.scopes?.includes(SCOPE_WRITE) ?? false,
        workspace: (req.auth?.extra?.workspace as string | undefined) ?? workspaceName(),
      })),
    );
  }

  // Stateless mode does not support server-initiated SSE streams or sessions.
  const methodNotAllowed = (_req: Request, res: Response) =>
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed (stateless server: use POST).' },
      id: null,
    });
  app.get('/mcp', methodNotAllowed);
  app.delete('/mcp', methodNotAllowed);

  app.listen(port, () => {
    const mode = process.env.NAM_MCP_DEV_NOAUTH === '1' ? 'DEV no-auth' : 'OAuth';
    console.log(`NamWeb MCP (read + write, ${mode}) on http://127.0.0.1:${port}/mcp`);
    console.log(`Workspace row: "${workspaceName()}"`);
  });
}

// Only boot the HTTP server when run directly (`npm run mcp`), not when imported
// by a test that exercises buildServer() over an in-memory transport.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
