// NamWeb remote MCP server — P0 read-only prototype (issue #105).
//
// Standalone Node entry (run via `tsx`, NOT bundled by Vite). It reuses NamWeb's
// React-free core directly: `pull()` from the Supabase `workspaces` row + the
// `domain/lenses` projections. The AI↔app contract is that row — exactly what the
// SPA and NamDesktop cloud-sync share.
//
// P0 scope: NO auth (signs in once with dev credentials), NO writes, local-only.
// Phasing → P1 OAuth 2.1/PKCE, P2 write tools, P3 Realtime, P4 hosting.
// See docs/features/remote-mcp/design.md.

import express, { type Request, type Response } from 'express';
import { pathToFileURL } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

import { pull } from '../src/sync/workspaceClient';
import type { NamNode, Resource, WorkspaceDocument } from '../src/domain/types';
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

/** Pull the current workspace document, or throw a message suitable for a tool error. */
async function loadDoc(client: SupabaseClient): Promise<WorkspaceDocument> {
  const name = workspaceName();
  const result = await pull(client, name);
  if (result.kind === 'ok') return result.document;
  if (result.kind === 'noRemote') {
    throw new Error(`No workspace row named "${name}" for this user yet.`);
  }
  throw new Error(`Failed to read workspace: ${result.message}`);
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
export function buildServer(client: SupabaseClient): McpServer {
  const server = new McpServer({ name: 'namweb', version: '0.1.0' });

  const read = (
    name: string,
    description: string,
    handler: (doc: WorkspaceDocument) => unknown,
  ) =>
    server.registerTool(name, { description }, async () => {
      try {
        return json(handler(await loadDoc(client)));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    });

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
        const doc = await loadDoc(client);
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
        const doc = await loadDoc(client);
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
        const doc = await loadDoc(client);
        const node = getNode(doc, node_id);
        if (!node) return errorResult(`No node with id ${node_id}.`);
        return json(node.resources.map(resourceBrief));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  return server;
}

// ---- HTTP (stateless Streamable HTTP at POST /mcp) -----------------------

async function main() {
  const port = Number(process.env.NAM_MCP_PORT ?? 3333);
  const client = await signedInClient();
  const app = express();
  app.use(express.json());

  app.post('/mcp', async (req: Request, res: Response) => {
    // Stateless: a fresh server + transport per request (no session reuse).
    const server = buildServer(client);
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
  });

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
    console.log(`NamWeb MCP (read-only, P0) on http://127.0.0.1:${port}/mcp`);
    console.log(`Workspace row: "${workspaceName()}"  ·  signed in as ${process.env.NAM_MCP_EMAIL}`);
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
