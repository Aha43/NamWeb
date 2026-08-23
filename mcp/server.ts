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

import express, { type NextFunction, type Request, type Response } from 'express';
import { pathToFileURL } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { McpServer, type ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthRouter,
} from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { z } from 'zod';

import { SupabaseOAuthProvider, supabaseClientFromAuth } from './auth/provider';
import { SCOPE_READ, SCOPE_WRITE, SUPPORTED_SCOPES } from './auth/scopes';
import { createRateLimiter } from './auth/rateLimit';
import { loadRedirectAllowlist } from './auth/redirectAllowlist';
import type { AuthStore } from './auth/stores';
import { PostgresAuthStore } from './auth/postgresStore';
import { loadEncryptionKey } from './auth/crypto';
import { ensureSchema, getPool } from './db/pool';

import { pull, push } from '../src/sync/workspaceClient';
import { commitIntent, type CommitOutcome, type WorkspaceSnapshot } from '../src/store/commit';
import { applyIntent, normalizeTags, validateIntent, type Intent } from '../src/domain/mutations';
import { newId, nowIso } from '../src/lib/local';
import { parseFlexibleDate, parseFlexibleTime } from '../src/lib/dates';
import type { NamNode, NodeStatus, Resource, WorkspaceDocument } from '../src/domain/types';
import {
  actionMoveTargetsAll,
  allTags,
  archivedProjectIds,
  backlogItems,
  doneItems,
  effectiveTags,
  getNode,
  inboxItems,
  nextActions,
  projectActions,
  projectMoveTargets,
  checklistProgress,
  checklistProjects,
  projectPath,
  projects,
  searchResults,
  somedayRoots,
  subProjects,
  subtreeIds,
} from '../src/domain/lenses';
import { GONE_QUIET_DAYS, goneQuiet, stalledProjects } from '../src/domain/review';
import { CHECKLIST_TAG, NOT_STALLED_TAG, canonicalTag, isChecklist, isSystemTag } from '../src/domain/systemTags';
import { projectSummaryMarkdown } from '../src/domain/projectSummary';
import pkg from '../package.json';

// A build signal surfaced in get_workspace_context (#1099/#1097): `<version>+<sha>` when deployed
// (NAM_MCP_BUILD is the git short-SHA baked at deploy time), so a client can notice on its first read
// that it's talking to a newer server than the tool list it cached. Falls back to the bare version locally.
const SERVER_VERSION = process.env.NAM_MCP_BUILD
  ? `${pkg.version}+${process.env.NAM_MCP_BUILD}`
  : pkg.version;

/**
 * The unauthenticated liveness/build probe body (#1200). A connector that suddenly advertises zero
 * tools can't tell "server is down" from "my OAuth session went stale" — a plain GET here answers the
 * first (and reports the running build), so a dark connector is diagnosable instead of ambiguous.
 */
export function healthResponse(): { ok: true; name: string; version: string } {
  return { ok: true, name: 'namweb-mcp', version: SERVER_VERSION };
}

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

/** A plain-text tool result — for tools that return already-formatted prose (e.g. rendered Markdown)
 *  rather than a JSON structure. */
function text(body: string): TextResult {
  return { content: [{ type: 'text', text: body }] };
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

const NODE_STATUSES = ['NEXT', 'BACKLOG', 'DONE', 'CANCELLED', 'ARCHIVED', 'SOMEDAY'] as const;
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

// Parent-type guards (#1054): the domain reducer accepts any non-cyclic node as a parent, so the
// MCP tools must enforce the SAME structural rules the SPA's pickers do — otherwise the AI could
// nest a project/action under a leaf action, producing trees the app's lenses don't expect. A valid
// project parent is the projects root or another (non-archived) project; a valid action parent is
// the free-actions root or a (non-archived) project.
function assertProjectParent(doc: WorkspaceDocument, parentId: string): void {
  const ok =
    parentId === doc.projectsNodeId ||
    (doc.nodes[parentId]?.project === true && !archivedProjectIds(doc).has(parentId));
  if (!ok) {
    throw new Error(
      `Parent ${parentId} is not a project — a project can only nest under another project or at top level.`,
    );
  }
}
function assertActionParent(doc: WorkspaceDocument, parentId: string): void {
  const ok =
    parentId === doc.nextActionsNodeId ||
    (doc.nodes[parentId]?.project === true && !archivedProjectIds(doc).has(parentId));
  if (!ok) {
    throw new Error(
      `Parent ${parentId} is not a project — an action must live under a project (use add_next_action for a free action).`,
    );
  }
}

// Due date/time parsing for the scheduling tools (#1121). Reuse the SPA's lenient parsers so MCP
// input round-trips exactly like the app: dates → canonical `YYYY-MM-DD`, times → 24h `HH:mm`. A
// malformed value throws a tool-friendly message (commit() turns it into an errorResult).
function parseDueDate(label: string, value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.trim() === '') return null;
  const iso = parseFlexibleDate(value);
  if (!iso) throw new Error(`${label} "${value}" is not a valid date — use YYYY-MM-DD (e.g. 2026-08-15).`);
  return iso;
}
function parseDueTime(label: string, value: string | undefined): string | null {
  if (value === undefined || value.trim() === '') return null;
  const time = parseFlexibleTime(value);
  if (!time) throw new Error(`${label} "${value}" is not a valid time — use 24-hour HH:mm (e.g. 19:00).`);
  return time;
}

/**
 * What a write tool returns: the commit outcome PLUS the resulting node (#1194) — echoed in the same
 * shape `get_node` returns, from the post-commit document. So a write is self-confirming: the caller
 * sees the new tags / status / description it just set (or the id that's now `deleted`) without a
 * follow-up read, and a structural bug — a move that landed wrong, a tag array that got clobbered —
 * is visible immediately in the echo instead of a silent `{ok}` (the #1141 lesson from the surface).
 */
function writeSummary(
  outcome: CommitOutcome,
  message: string | undefined,
  intent: Intent,
  doc: WorkspaceDocument,
) {
  const summary: {
    ok: boolean;
    outcome: CommitOutcome;
    id?: string;
    node?: ReturnType<typeof fullNodeView>;
    message?: string;
  } = { ok: true, outcome };
  const id = echoTarget(intent);
  if (id) {
    summary.id = id; // the affected (or newly created) node id
    const n = doc.nodes[id];
    if (n) summary.node = fullNodeView(doc, n); // the result, so the write confirms itself
  }
  if (message) summary.message = message;
  return summary;
}

// Tag lanes (#837, #1070): `#shared-*` = sharing, other registered `#…` = system, else a
// user/context tag — so a consumer doesn't have to decode the `#` convention out of band.
function classifyTags(tags: string[]): { system: string[]; sharing: string[]; context: string[] } {
  const system: string[] = [];
  const sharing: string[] = [];
  const context: string[] = [];
  for (const t of tags) {
    if (canonicalTag(t).startsWith('#shared-')) sharing.push(t);
    else if (isSystemTag(t)) system.push(t);
    else context.push(t);
  }
  return { system, sharing, context };
}

// The compact, review-capable node projection (#1070). One shape for actions AND projects. Every
// field is already on the node — the old `briefNode` just dropped them, which made time-based review
// (gone-quiet, urgency) and out-of-tree placement (path) impossible from the MCP surface. Null/empty
// fields are omitted to keep payloads lean. `path` is the ancestor project titles (excludes the node
// itself and structural containers), so a consumer can place any node without walking the tree.
function nodeView(doc: WorkspaceDocument, n: NamNode) {
  const view: Record<string, unknown> = {
    id: n.id,
    type: n.project ? 'project' : 'action', // node kind — project-NEXT ≠ action-NEXT
    title: n.title,
    status: n.status,
    path: projectPath(doc, n.id),
  };
  if (n.project) view.childCount = n.childIds.length;
  // A checklist's one meaningful number — checked of total (#1167) — so a listing answers "which
  // checklists need attention", not just "which exist". On list_checklists and get_node alike.
  if (n.project && isChecklist(n)) view.checklist = checklistProgress(doc, n.id);
  if (n.tags.length) {
    view.tags = n.tags;
    view.tagKinds = classifyTags(n.tags);
  }
  if (n.dueAt) view.dueAt = n.dueAt;
  if (n.dueEndAt) view.dueEndAt = n.dueEndAt;
  if (n.dueTime) view.dueTime = n.dueTime;
  if (n.createdAt) view.createdAt = n.createdAt;
  if (n.updatedAt) view.updatedAt = n.updatedAt;
  if (n.statusChangedAt) view.statusChangedAt = n.statusChangedAt;
  if (n.description?.trim()) view.hasDescription = true; // presence only — get the text via get_node (#1106)
  if (n.resources.length) view.resourceCount = n.resources.length;
  return view;
}

function resourceBrief(r: Resource, index: number) {
  return { index, type: r.type, value: r.value, description: r.description };
}

/** Whether a node carries `tag` (own or inherited), by canonical form. */
function hasTag(doc: WorkspaceDocument, id: string, tag: string): boolean {
  const target = canonicalTag(tag);
  return effectiveTags(doc, id).some((t) => canonicalTag(t) === target);
}

/**
 * Narrow a flat action list by the optional MCP filters (#1199): within a project subtree, carrying a
 * tag, and/or due before a date — so an agent asks for the slice it wants (fewer tokens, fewer
 * misreads) instead of the whole list. `project_id` is validated by the caller (an unknown id is an
 * error, not a silent empty — the #1200 empty≠error principle).
 */
function applyActionFilters(
  doc: WorkspaceDocument,
  nodes: NamNode[],
  f: { subtreeIds?: Set<string>; tag?: string; due_before?: string },
): NamNode[] {
  let out = nodes;
  if (f.subtreeIds) out = out.filter((n) => f.subtreeIds!.has(n.id));
  if (f.tag) out = out.filter((n) => hasTag(doc, n.id, f.tag!));
  if (f.due_before) out = out.filter((n) => n.dueAt != null && n.dueAt < f.due_before!);
  return out;
}

/** The deep, review-capable projection of a node (#1106): everything `nodeView` shows PLUS the full
 *  description text, blocked-by dependencies as {id,title}, and resources inline. Shared by `get_node`
 *  and the write-echo (#1194) so a single write confirms exactly what a follow-up `get_node` would. */
function fullNodeView(doc: WorkspaceDocument, n: NamNode) {
  const view: Record<string, unknown> = { ...nodeView(doc, n) };
  delete view.hasDescription; // replaced by the full text
  delete view.resourceCount; // replaced by the resources array
  if (n.description?.trim()) view.description = n.description;
  if (n.blockedBy.length) {
    view.blockedBy = n.blockedBy.map((id) => ({ id, title: doc.nodes[id]?.title ?? '(unknown)' }));
  }
  if (n.resources.length) view.resources = n.resources.map(resourceBrief);
  return view;
}

/** The node a write affects, so the echo (#1194) can project it. Keyed off the intent so it's one
 *  mechanism for every write, not per-tool. (Deletes don't go through the shared `commit`/echo path —
 *  `delete_node` is a raw handler that returns its own removed-nodes manifest, #1092.) */
function echoTarget(intent: Intent): string | null {
  return 'id' in intent && typeof intent.id === 'string' ? intent.id : null;
}

/**
 * Build a fresh McpServer with the read tools registered, each closing over the
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
    // readOnlyHint (#1069): tells a client (Claude) this tool only reads, so it needn't prompt for it.
    server.registerTool(name, { description, annotations: { readOnlyHint: true } }, async () => {
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
      // Loud enforcement of domain invariants the reducer only no-ops (e.g. #checklist: no sub-projects,
      // #1147). Throw → the catch below turns it into a clear tool error, never a silent no-op write.
      const invalid = validateIntent(snapshot.document, intent);
      if (invalid) throw new Error(invalid);
      const result = await commitIntent(client, workspace, snapshot, intent);
      if (result.outcome === 'error') return errorResult(result.message ?? 'Write failed.');
      // Echo from the POST-commit document (result.snapshot.document) — the actual synced/replayed
      // state, not the pre-write snapshot — so the caller sees exactly what landed (#1194).
      return json(writeSummary(result.outcome, result.message, intent, result.snapshot.document));
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  };

  // Run several writes as ONE atomic commit (#1198): apply every intent to the pulled snapshot, then
  // push the whole document once (guarded on the held version). All-or-nothing — if a build/invariant
  // throws, or the version moved under us, nothing is written and the caller is told to re-read and
  // retry (no partial import, no interleaving). Echoes the affected nodes like a single write.
  const commitBatch = async (build: (doc: WorkspaceDocument) => Intent[]): Promise<TextResult> => {
    try {
      const snapshot = await loadSnapshot(client, workspace);
      const intents = build(snapshot.document);
      if (intents.length === 0) return errorResult('Nothing to write — the items list was empty.');
      let doc = snapshot.document;
      for (const intent of intents) {
        const invalid = validateIntent(doc, intent);
        if (invalid) throw new Error(invalid);
        doc = applyIntent(doc, intent); // fold onto the running doc so later intents see earlier ones
      }
      const res = await push(client, workspace, doc, snapshot.version);
      if (res.kind === 'error') return errorResult(res.message);
      if (res.kind !== 'ok') {
        return errorResult(
          'The workspace changed while writing — nothing was written (the batch is atomic). Re-read and retry.',
        );
      }
      const nodes = intents
        .map((i) => echoTarget(i))
        .filter((id): id is string => id != null)
        .map((id) => doc.nodes[id])
        .filter((n): n is NamNode => Boolean(n))
        .map((n) => fullNodeView(doc, n));
      return json({ ok: true, outcome: 'synced' as const, count: nodes.length, nodes });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  };

  read(
    'get_workspace_context',
    'Get a compact summary of the workspace plus this connection\'s capabilities: whether it can write ' +
      '(canWrite), the server build (serverVersion), and project titles, tags, and inbox/project counts.',
    (doc) => ({
      // Connection capabilities first (#1099) — so an agent knows its permissions and the server build
      // up front, instead of discovering "read-only" or "stale tools" by a write call that fails opaquely.
      canWrite, // does this token hold nam.write? Granted by default (#1116); false only if a client narrowed itself to read-only — reconnect to restore.
      serverVersion: SERVER_VERSION,
      projectCount: projects(doc).length,
      inboxCount: inboxItems(doc).length,
      tags: allTags(doc),
      projects: projects(doc).map((p) => p.title),
    }),
  );
  read('list_inbox', 'List all items currently in the Inbox.', (doc) =>
    inboxItems(doc).map((n) => nodeView(doc, n)),
  );
  read('list_projects', 'List all top-level projects.', (doc) =>
    projects(doc).map((p) => nodeView(doc, p)),
  );
  // Optional narrowing filters for the flat action lists (#1199): a big backlog is mostly noise to an
  // agent hunting one project's items — filters cut tokens and misreads at the source.
  const actionListFilters = {
    project_id: z.string().optional().describe('Only actions within this project (its subtree)'),
    tag: z.string().optional().describe('Only actions carrying this tag (own or inherited)'),
    due_before: z.string().optional().describe('Only actions with a due date strictly before this (YYYY-MM-DD)'),
  } as const;
  const listActions = (
    name: string,
    description: string,
    select: (doc: WorkspaceDocument) => NamNode[],
  ) =>
    server.registerTool(
      name,
      { description, inputSchema: actionListFilters, annotations: { readOnlyHint: true } },
      async ({ project_id, tag, due_before }) => {
        try {
          const doc = await loadDoc(client, workspace);
          let ids: Set<string> | undefined;
          if (project_id) {
            const p = requireNode(doc, project_id); // unknown id → error, not a silent empty (#1200)
            if (!p.project) return errorResult(`Node ${project_id} is an action, not a project.`);
            ids = subtreeIds(doc, project_id);
          }
          const rows = applyActionFilters(doc, select(doc), { subtreeIds: ids, tag, due_before });
          return json(rows.map((n) => nodeView(doc, n)));
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }
      },
    );
  listActions(
    'list_next_actions',
    'List actions with status NEXT across the workspace. Optionally filter by project (subtree), tag, or due-before.',
    (doc) => nextActions(doc),
  );
  listActions(
    'list_backlog',
    'List actions with status BACKLOG across the workspace. Optionally filter by project (subtree), tag, or due-before.',
    (doc) => backlogItems(doc),
  );
  read('list_done', 'List all actions with status DONE across the whole workspace.', (doc) =>
    doneItems(doc).map((n) => nodeView(doc, n)),
  );
  read(
    'list_someday',
    'List SOMEDAY items — projects/actions parked as "not decided to do" (#1131). Returns the ' +
      'outermost someday nodes only (a whole parked subtree is one row, not every descendant). ' +
      'SOMEDAY items are deliberately absent from the Next/Backlog/stalled/gone-quiet listings.',
    (doc) => somedayRoots(doc).map((n) => nodeView(doc, n)),
  );
  read(
    'list_checklists',
    'List all projects tagged #checklist (#1163) — their child actions are check-items (done/not-done). ' +
      'Check or uncheck an item with mark_done / mark_backlog; reset a whole checklist with reset_checklist.',
    (doc) => checklistProjects(doc).map((n) => nodeView(doc, n)),
  );
  read(
    'list_saved_views',
    'List the saved views (user-defined tag filters) defined in the workspace.',
    (doc) => doc.savedViews,
  );
  // Derived Review lenses (#1071) — the stalled / gone-quiet computation runs SERVER-SIDE over the
  // same pure lenses the app uses, so a consumer gets the answer directly instead of hand-joining
  // paginated status buckets. (gone-quiet needs the timestamps #1070 now projects.)
  read(
    'list_stalled_projects',
    'List open projects whose subtree has no NEXT action — GTD "loose ends" (excludes ones tagged #not-stalled).',
    (doc) => stalledProjects(doc).map((n) => nodeView(doc, n)),
  );
  read(
    'list_gone_quiet',
    `List open actions untouched for ${GONE_QUIET_DAYS}+ days (by last activity) — candidates that may have stalled.`,
    (doc) => goneQuiet(doc).map((n) => nodeView(doc, n)),
  );

  server.registerTool(
    'list_project_children',
    {
      description: 'List the direct children (actions and sub-projects) of a project node.',
      inputSchema: { project_id: z.string().describe('UUID of the project') },
      annotations: { readOnlyHint: true },
    },
    async ({ project_id }) => {
      try {
        const doc = await loadDoc(client, workspace);
        return json({
          actions: projectActions(doc, project_id).map((n) => nodeView(doc, n)),
          subProjects: subProjects(doc, project_id).map((p) => nodeView(doc, p)),
        });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // Bulk subtree read (#1074): one call returns a node and all its descendants (DFS order, each with
  // its `depth`), so a consumer can review a whole branch without N single-level round trips —
  // list_project_children is single-level and a full-tree pass otherwise costs dozens of calls.
  server.registerTool(
    'list_subtree',
    {
      description:
        'List a node and all its descendants (depth-first), each carrying its depth. Optionally cap the ' +
        'depth (0 = the node only, 1 = node + direct children, …). Set include_descriptions to read a whole ' +
        'project for review in ONE call (each node carries its full description) instead of N get_node calls.',
      inputSchema: {
        node_id: z.string().describe('UUID of the root node'),
        depth: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe('Max depth to descend; omit for the whole subtree'),
        include_descriptions: z
          .boolean()
          .optional()
          .describe(
            'Inline each node\'s full description (plus blocked-by + resources), like get_node, instead ' +
              'of just a hasDescription flag. Opt-in — a large subtree gets big. Default false.',
          ),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ node_id, depth, include_descriptions }) => {
      try {
        const doc = await loadDoc(client, workspace);
        if (!getNode(doc, node_id)) return errorResult(`No node with id ${node_id}.`);
        const out: unknown[] = [];
        const seen = new Set<string>(); // guard a malformed doc (DAG / cycle) — mirrors subtreeIds
        const walk = (id: string, d: number) => {
          const n = doc.nodes[id];
          if (!n || seen.has(id)) return;
          seen.add(id);
          const view = include_descriptions ? fullNodeView(doc, n) : nodeView(doc, n);
          out.push({ ...view, depth: d });
          if (depth != null && d >= depth) return;
          for (const childId of n.childIds) walk(childId, d + 1);
        };
        walk(node_id, 0);
        return json(out);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.registerTool(
    'find_node',
    {
      description:
        'Find nodes by title or tag (case-insensitive substring match) across actions and projects. ' +
        'DONE and archived nodes are never returned. Narrow noisy matches with exact / type / status / ' +
        'tag — e.g. exact:true for a whole-title match, type:"project", or tag to a specific context.',
      inputSchema: {
        title: z.string().describe('Text to match against title or tag (substring unless exact:true)'),
        exact: z.boolean().optional().describe('Match the FULL title exactly (case-insensitive) instead of substring'),
        type: z.enum(['project', 'action']).optional().describe('Only projects, or only actions'),
        status: z.enum(NODE_STATUSES).optional().describe('Only nodes with this status (note: DONE / archived are never returned)'),
        tag: z.string().optional().describe('Only nodes carrying this tag (own or inherited)'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ title, exact, type, status, tag }) => {
      try {
        const doc = await loadDoc(client, workspace);
        let nodes = searchResults(doc, title).map(({ node }) => node);
        if (exact) {
          const q = title.trim().toLowerCase();
          nodes = nodes.filter((n) => n.title.toLowerCase() === q);
        }
        if (type) nodes = nodes.filter((n) => (n.project ? 'project' : 'action') === type);
        if (status) nodes = nodes.filter((n) => n.status === status);
        if (tag) nodes = nodes.filter((n) => hasTag(doc, n.id, tag));
        return json(nodes.map((n) => nodeView(doc, n)));
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
      annotations: { readOnlyHint: true },
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

  // Deep single-node read (#1106): everything the list views show for a node PLUS the full
  // `description` text (lists only carry `hasDescription`), the blocked-by dependencies (as
  // {id,title}), and its resources inline. This is what lets an AI review intent instead of
  // guessing from titles — call it when a listing showed `hasDescription: true`.
  server.registerTool(
    'get_node',
    {
      description:
        'Get one node in full: its description text, blocked-by dependencies, and resources, plus ' +
        'everything the list views show (path, status, tags, due, timestamps). Use when a listing ' +
        'reported hasDescription:true and you need the actual text, or to inspect a node before editing.',
      inputSchema: { node_id: z.string().describe('UUID of the node') },
      annotations: { readOnlyHint: true },
    },
    async ({ node_id }) => {
      try {
        const doc = await loadDoc(client, workspace);
        const n = getNode(doc, node_id);
        if (!n) return errorResult(`No node with id ${node_id}.`);
        return json(fullNodeView(doc, n));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // Whole-project read as one Markdown document (#1196): the same renderer the web uses to feed
  // project summaries into a code chat, exposed to the connector so a review reads a project in ONE
  // call instead of N get_node calls (descriptions inline). Reuses the pure `projectSummaryMarkdown`
  // (src/domain) — same output the UI produces, so the two surfaces can't drift.
  server.registerTool(
    'render_project_md',
    {
      description:
        'Render a project and its actions/sub-projects as one Markdown document (titles, tags, and ' +
        'full descriptions, nested). One call to read a whole project for a review or to feed into a ' +
        'chat — instead of walking it node-by-node. Include-status defaults to all of NEXT/BACKLOG/DONE.',
      inputSchema: { project_id: z.string().describe('UUID of the project to render') },
      annotations: { readOnlyHint: true },
    },
    async ({ project_id }) => {
      try {
        const doc = await loadDoc(client, workspace);
        const node = getNode(doc, project_id);
        if (!node) return errorResult(`No node with id ${project_id}.`);
        if (!node.project) return errorResult(`Node ${project_id} is an action, not a project — render_project_md needs a project.`);
        return text(projectSummaryMarkdown(doc, project_id));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ---- Write tools ---------------------------------------------------------
  // Each maps to a domain Intent committed via `commit`. Human confirmation is connector-side (both
  // ChatGPT and Claude prompt before a tool call). Write is granted by default (#1116), so these are
  // normally live. Crucially they are registered UNCONDITIONALLY: a connection that narrowed itself to
  // read-only still sees them — a stable tool list across deploy/reconnect (the #1116 flap fix, where a
  // read-only-then-write handshake used to hand the client a write-less tool list it then cached) — but
  // each refuses with a clear, interpretable message instead of vanishing, so an agent never gets an
  // opaque "tool not found" it can't distinguish from a typo or a stale deploy.
  const READ_ONLY_REFUSAL =
    'This MCP connection is read-only: the nam.write scope was not granted to this token. ' +
    'Reconnect the connector to restore write access.';

  // Register through this wrapper so each write carries its annotations: `readOnlyHint: false` tells a
  // client (Claude) to prompt before running it, and `destructiveHint` flags the delete/remove tools.
  // When the connection lacks write, the callback is swapped for the plain refusal above (the schema
  // still advertises the tool). Generic over the input shape so each handler's args stay typed exactly.
  const registerWrite = <Args extends z.ZodRawShape>(
    name: string,
    config: { description: string; inputSchema: Args },
    cb: ToolCallback<Args>,
  ) =>
    server.registerTool(
      name,
      {
        ...config,
        annotations: { readOnlyHint: false, destructiveHint: /^(delete|remove)_/.test(name) },
      },
      canWrite ? cb : ((() => errorResult(READ_ONLY_REFUSAL)) as unknown as ToolCallback<Args>),
    );

  registerWrite(
    'add_inbox_item',
    {
      description: 'Capture a new item into the Inbox for later triage.',
      inputSchema: { title: z.string().describe('The item text') },
    },
    ({ title }) => commit(() => ({ type: 'addInboxItem', id: newId(), title, now: nowIso() })),
  );

  registerWrite(
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
        if (parent_id) {
          requireNode(doc, parent_id);
          assertProjectParent(doc, parent_id); // #1054
        }
        const parentId = parent_id ?? doc.projectsNodeId;
        return { type: 'addSubProject', parentId, id: newId(), title, now: nowIso() };
      }),
  );

  registerWrite(
    'add_action',
    {
      description:
        'Add an action to a project. Defaults to status BACKLOG (matches NamDesktop). Optionally ' +
        'schedule it at creation with a due date and clock time (or set/adjust it later with set_due).',
      inputSchema: {
        project_id: z.string().describe('UUID of the project to add the action to'),
        title: z.string().describe('Action title'),
        status: z.enum(NODE_STATUSES).optional().describe('Defaults to BACKLOG'),
        due: z.string().optional().describe('Due date at creation, YYYY-MM-DD'),
        due_time: z.string().optional().describe('Clock time on the due date, 24-hour HH:mm (requires due)'),
        description: z.string().optional().describe('Description/notes at creation (#1198) — saves a follow-up update_node'),
      },
    },
    ({ project_id, title, status, due, due_time, description }) =>
      commit((doc) => {
        requireNode(doc, project_id);
        assertActionParent(doc, project_id); // #1054
        const dueAt = parseDueDate('due', due);
        const dueTime = parseDueTime('due_time', due_time);
        if (dueTime && !dueAt) throw new Error('due_time requires due.');
        return {
          type: 'addAction',
          parentId: project_id,
          id: newId(),
          title,
          status: status ?? 'BACKLOG',
          ...(dueAt ? { dueAt } : {}),
          ...(dueTime ? { dueTime } : {}),
          ...(description?.trim() ? { description } : {}),
          now: nowIso(),
        };
      }),
  );

  registerWrite(
    'add_actions',
    {
      description:
        'Add SEVERAL actions to a project in ONE atomic call (#1198) — for imports / brain-dumps, instead ' +
        'of many add_action round-trips. All-or-nothing: if any item is invalid nothing is written. Each ' +
        'item may carry a description, so you don\'t need a follow-up update_node per action.',
      inputSchema: {
        project_id: z.string().describe('UUID of the project to add the actions to'),
        items: z
          .array(
            z.object({
              title: z.string().describe('Action title'),
              status: z.enum(NODE_STATUSES).optional().describe('Defaults to BACKLOG'),
              due: z.string().optional().describe('Due date, YYYY-MM-DD'),
              due_time: z.string().optional().describe('Clock time HH:mm (requires due)'),
              description: z.string().optional().describe('Description/notes'),
            }),
          )
          .describe('The actions to add, in order'),
      },
    },
    ({ project_id, items }) =>
      commitBatch((doc) => {
        requireNode(doc, project_id);
        assertActionParent(doc, project_id); // #1054
        return items.map((it) => {
          const dueAt = parseDueDate('due', it.due);
          const dueTime = parseDueTime('due_time', it.due_time);
          if (dueTime && !dueAt) throw new Error(`due_time requires due (item "${it.title}").`);
          return {
            type: 'addAction',
            parentId: project_id,
            id: newId(),
            title: it.title,
            status: it.status ?? 'BACKLOG',
            ...(dueAt ? { dueAt } : {}),
            ...(dueTime ? { dueTime } : {}),
            ...(it.description?.trim() ? { description: it.description } : {}),
            now: nowIso(),
          };
        });
      }),
  );

  registerWrite(
    'set_status',
    {
      description:
        'Set the status of SEVERAL nodes in ONE atomic call (#1198) — e.g. park five projects as SOMEDAY, ' +
        'or mark a batch DONE, in a single triage step. All-or-nothing.',
      inputSchema: {
        node_ids: z.array(z.string()).describe('UUIDs of the nodes to update'),
        status: z.enum(NODE_STATUSES).describe('The status to set on all of them'),
      },
    },
    ({ node_ids, status }) =>
      commitBatch((doc) =>
        node_ids.map((id) => {
          requireNode(doc, id);
          return { type: 'setStatus', id, status, now: nowIso() };
        }),
      ),
  );

  registerWrite(
    'add_next_action',
    {
      description:
        'Add a free-standing NEXT action, not attached to any project. Optionally schedule it at ' +
        'creation with a due date and clock time (or set/adjust it later with set_due).',
      inputSchema: {
        title: z.string().describe('Action title'),
        due: z.string().optional().describe('Due date at creation, YYYY-MM-DD'),
        due_time: z.string().optional().describe('Clock time on the due date, 24-hour HH:mm (requires due)'),
      },
    },
    ({ title, due, due_time }) =>
      commit((doc) => {
        const dueAt = parseDueDate('due', due);
        const dueTime = parseDueTime('due_time', due_time);
        if (dueTime && !dueAt) throw new Error('due_time requires due.');
        return {
          type: 'addAction',
          parentId: doc.nextActionsNodeId,
          id: newId(),
          title,
          status: 'NEXT',
          ...(dueAt ? { dueAt } : {}),
          ...(dueTime ? { dueTime } : {}),
          now: nowIso(),
        };
      }),
  );

  registerWrite(
    'set_due',
    {
      description:
        "Set an action or project's due date, with an optional clock time and an optional end date " +
        '(a date range). Replaces the whole due state — pass due=null to clear it entirely (which also ' +
        'clears the time and range). Dates are YYYY-MM-DD; times are 24-hour HH:mm.',
      inputSchema: {
        node_id: z.string().describe('UUID of the action or project'),
        due: z.string().nullable().describe('Due date (YYYY-MM-DD), or null to clear the due entirely'),
        due_time: z
          .string()
          .optional()
          .describe('Clock time on the due date, 24-hour HH:mm (e.g. "19:00"); omit for an all-day due'),
        due_end: z.string().optional().describe('End date for a range (YYYY-MM-DD); omit for a single day'),
        due_end_time: z.string().optional().describe('Clock time on the end date, 24-hour HH:mm; requires due_end'),
      },
    },
    ({ node_id, due, due_time, due_end, due_end_time }) =>
      commit((doc) => {
        requireNode(doc, node_id);
        assertNotContainer(doc, node_id);
        const dueAt = parseDueDate('due', due);
        const dueTime = parseDueTime('due_time', due_time);
        const dueEndAt = parseDueDate('due_end', due_end);
        const dueEndTime = parseDueTime('due_end_time', due_end_time);
        if (dueAt === null && (dueTime || dueEndAt || dueEndTime)) {
          throw new Error('Cannot set a time or an end date while clearing the due (due is null).');
        }
        if (dueEndTime && !dueEndAt) throw new Error('due_end_time requires due_end.');
        if (dueEndAt && dueAt && dueEndAt < dueAt) {
          throw new Error(`due_end (${dueEndAt}) is before due (${dueAt}).`);
        }
        // On a single day, the end time can't precede the start time — mirror the SPA due editor
        // (DueFieldset #508), which MCP would otherwise let an AI violate (#1121 review, Codex P2).
        if (dueEndAt && dueEndAt === dueAt && dueTime && dueEndTime && dueEndTime < dueTime) {
          throw new Error(`due_end_time (${dueEndTime}) is before due_time (${dueTime}) on the same day.`);
        }
        return { type: 'setDue', id: node_id, dueAt, dueEndAt, dueTime, dueEndTime, now: nowIso() };
      }),
  );

  const markStatus = (toolName: string, status: NodeStatus) =>
    registerWrite(
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
  markStatus('mark_someday', 'SOMEDAY'); // park as "not decided to do" (#1131)

  registerWrite(
    'mark_checklist',
    {
      description:
        'Mark a project as a checklist (#1164): adds the #checklist tag, so its actions become ' +
        'check-items. Refused if the project has sub-projects — a checklist holds only check-items.',
      inputSchema: { project_id: z.string().describe('UUID of the project') },
    },
    ({ project_id }) =>
      commit((doc) => {
        const node = requireNode(doc, project_id);
        if (!node.project) throw new Error(`Node ${project_id} is not a project; #checklist applies to projects.`);
        return { type: 'updateTags', id: project_id, tags: [...node.tags, CHECKLIST_TAG], now: nowIso() };
      }),
  );

  registerWrite(
    'unmark_checklist',
    {
      description:
        'Remove the #checklist tag from a project (#1168) — the reverse of mark_checklist, e.g. when a ' +
        'checklist grows into a real project (or was tagged by mistake). Always safe; no-op if not tagged.',
      inputSchema: { project_id: z.string().describe('UUID of the project') },
    },
    ({ project_id }) =>
      commit((doc) => {
        const node = requireNode(doc, project_id);
        return {
          type: 'updateTags',
          id: project_id,
          tags: node.tags.filter((t) => canonicalTag(t) !== CHECKLIST_TAG),
          now: nowIso(),
        };
      }),
  );

  registerWrite(
    'mark_not_stalled',
    {
      description:
        'Mark a project as intentionally next-less (#1193): adds the #not-stalled tag so the "loose ' +
        'ends" / stalled-projects review stops flagging it (e.g. a reference or someday project that ' +
        'deliberately has no next action). Projects only. No-op if already marked.',
      inputSchema: { project_id: z.string().describe('UUID of the project') },
    },
    ({ project_id }) =>
      commit((doc) => {
        const node = requireNode(doc, project_id);
        if (!node.project) throw new Error(`Node ${project_id} is not a project; #not-stalled applies to projects.`);
        return { type: 'updateTags', id: project_id, tags: [...node.tags, NOT_STALLED_TAG], now: nowIso() };
      }),
  );

  registerWrite(
    'unmark_not_stalled',
    {
      description:
        'Remove the #not-stalled tag from a project (#1193) — the reverse of mark_not_stalled, so the ' +
        'project is flagged again if its subtree has no NEXT action. Always safe; no-op if not tagged.',
      inputSchema: { project_id: z.string().describe('UUID of the project') },
    },
    ({ project_id }) =>
      commit((doc) => {
        const node = requireNode(doc, project_id);
        return {
          type: 'updateTags',
          id: project_id,
          tags: node.tags.filter((t) => canonicalTag(t) !== NOT_STALLED_TAG),
          now: nowIso(),
        };
      }),
  );

  registerWrite(
    'reset_checklist',
    {
      description:
        'Reset a checklist for its next run (#1165): set every DONE check-item back to BACKLOG in one ' +
        'step. The node must be a #checklist project.',
      inputSchema: { project_id: z.string().describe('UUID of the #checklist project') },
    },
    ({ project_id }) =>
      commit((doc) => {
        const node = requireNode(doc, project_id);
        if (!node.project || !isChecklist(node)) throw new Error(`Node ${project_id} is not a #checklist project.`);
        return { type: 'resetChecklist', id: project_id, now: nowIso() };
      }),
  );

  registerWrite(
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

  registerWrite(
    'update_tags',
    {
      description:
        'Set the CONTEXT tags on a node — the new complete list of ordinary (non-system) tags (normalized: ' +
        'trimmed, lowercased, de-duplicated). System tags (#checklist, #shared-*, #not-stalled, #in-progress) ' +
        'are NOT settable here — they are preserved untouched and managed via their own ops (e.g. ' +
        'mark_checklist, mark_not_stalled). Passing a system tag is refused (#1192), so an agent can never ' +
        'clobber a shared/checklist flag by resending a tag list.',
      inputSchema: {
        node_id: z.string().describe('UUID of the node'),
        tags: z.array(z.string()).describe('The complete new list of CONTEXT (non-system) tags'),
      },
    },
    ({ node_id, tags }) =>
      commit((doc) => {
        assertNotContainer(doc, node_id);
        const node = requireNode(doc, node_id);
        // Refuse system/sharing tags in the input — those have semantic ops (#1192): an accidental
        // #shared-open from an agent is worse than a refusal, and this keeps update_tags a context-only tool.
        const incoming = classifyTags(tags);
        const reserved = [...incoming.system, ...incoming.sharing];
        if (reserved.length) {
          throw new Error(
            `update_tags sets context tags only — ${reserved.join(', ')} ${reserved.length > 1 ? 'are' : 'is a'} ` +
              `system tag. Use the semantic ops (e.g. mark_checklist, mark_not_stalled) for those.`,
          );
        }
        // Preserve the node's existing system + sharing tags; replace only the context portion. So a
        // resent list can't drop a #checklist/#shared-* the caller didn't (and can't) include.
        const kept = node.tags.filter((t) => isSystemTag(t) || canonicalTag(t).startsWith('#shared-'));
        return { type: 'updateTags', id: node_id, tags: normalizeTags([...kept, ...incoming.context]), now: nowIso() };
      }),
  );

  registerWrite(
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
        const node = requireNode(doc, node_id);
        assertNotContainer(doc, node_id);
        requireNode(doc, new_parent_id);
        // Enforce the SAME destinations the SPA's move pickers offer (#1054): valid parents for a
        // project vs an action, excluding self/subtree/archived. Rejects nesting under a leaf action.
        const targets = node.project
          ? projectMoveTargets(doc, node_id)
          : actionMoveTargetsAll(doc, node_id);
        if (!targets.some((t) => t.id === new_parent_id)) {
          throw new Error(
            `${new_parent_id} is not a valid destination for this ${node.project ? 'project' : 'action'}.`,
          );
        }
        return { type: 'moveNode', id: node_id, newParentId: new_parent_id, now: nowIso() };
      }),
  );

  registerWrite(
    'delete_node',
    {
      description:
        'Delete a node. WARNING: if the node has children this RECURSIVELY deletes the node AND its ' +
        'entire subtree — every descendant project, action, and resource — irreversibly. A delete that ' +
        'would remove children is REFUSED unless you pass recursive:true (so a project is never nuked by ' +
        'mistaking it for a leaf). Returns a manifest of exactly what was removed (ids + titles).',
      inputSchema: {
        node_id: z.string().describe('UUID of the node to delete'),
        recursive: z
          .boolean()
          .optional()
          .describe('Required (true) to delete a node that HAS children; omit/false for a leaf'),
      },
    },
    // Raw handler (not the shared `commit`) so it can (a) refuse an unconfirmed subtree delete and
    // (b) return a manifest of the removed nodes — #1092 (delete is the one unrecoverable op, and
    // writes now come from an agent resolving ambiguous titles → ids).
    async ({ node_id, recursive }) => {
      try {
        const snapshot = await loadSnapshot(client, workspace);
        const doc = snapshot.document;
        const node = requireNode(doc, node_id);
        assertNotContainer(doc, node_id);
        const hasChildren = node.childIds.length > 0;
        const ids = [...subtreeIds(doc, node_id)]; // includes the node itself
        if (hasChildren && recursive !== true) {
          return errorResult(
            `"${node.title}" has ${node.childIds.length} direct child(ren) and ${ids.length - 1} ` +
              `descendant(s) in total — deleting it recursively removes them all. Pass recursive:true to confirm.`,
          );
        }
        const deleted = ids.map((id) => ({ id, title: doc.nodes[id]?.title ?? '(unknown)' }));
        const intent: Intent = hasChildren
          ? { type: 'deleteRecursive', id: node_id }
          : { type: 'deleteLeaf', id: node_id };
        // Disable conflict-replay (#1092): the recursive-gate + manifest above were computed on THIS
        // snapshot. If another edit landed first, a blind replay onto the fresher doc could bypass the
        // gate (a leaf that just gained a child) or misreport what was removed — so refuse and ask the
        // caller to re-read. A `synced` outcome therefore means the delete applied to exactly what we gated.
        const result = await commitIntent(client, workspace, snapshot, intent, {
          replayOnConflict: false,
        });
        if (result.outcome === 'error') return errorResult(result.message ?? 'Delete failed.');
        if (result.outcome !== 'synced') {
          return errorResult(
            `The workspace changed since you read "${node.title}" — nothing was deleted. Re-read the ` +
              `node (e.g. list_subtree) and retry, so the recursive check and manifest reflect the current state.`,
          );
        }
        return json({ ok: true, outcome: result.outcome, deletedCount: deleted.length, deleted });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  const prerequisite = (
    toolName: string,
    type: 'addPrerequisite' | 'removePrerequisite',
    verb: string,
  ) =>
    registerWrite(
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

  registerWrite(
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

  registerWrite(
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

  registerWrite(
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

/**
 * Fail-closed guard for the local-only no-auth mode (#1050 CRITICAL): refuse to start when the
 * environment looks like a deployment (NODE_ENV=production or an https issuer), so a copied
 * `NAM_MCP_DEV_NOAUTH=1` can't silently expose an unauthenticated read+write endpoint. Exported for
 * testing.
 */
export function assertNoAuthAllowed(env: NodeJS.ProcessEnv = process.env): void {
  const issuer = env.NAM_MCP_ISSUER_URL ?? '';
  if (env.NODE_ENV === 'production' || issuer.startsWith('https://')) {
    throw new Error(
      'Refusing to start: NAM_MCP_DEV_NOAUTH=1 in a production/https context. No-auth mode is ' +
        'local-dev only — unset it (and use OAuth) for any deployment.',
    );
  }
}

async function main() {
  const port = Number(process.env.NAM_MCP_PORT ?? 3333);
  const app = express();
  // Trust EXACTLY the configured number of proxy hops (default 1 — a single PaaS load balancer), so
  // req.ip / req.secure reflect the real client. NOT `true` (#1050): trusting the whole
  // X-Forwarded-For chain lets a client spoof req.ip and bypass the sign-in rate-limit. Set
  // NAM_MCP_TRUST_PROXY to the real hop count for your host.
  app.set('trust proxy', Number(process.env.NAM_MCP_TRUST_PROXY ?? 1));

  // Liveness/build probe (#1200) — before any auth, so a client can check the server is up and read
  // its build without a session. Distinguishes "server gone" from "stale connector / read-only".
  app.get('/health', (_req, res) => res.json(healthResponse()));

  const noAuth = process.env.NAM_MCP_DEV_NOAUTH === '1';
  if (noAuth) {
    // Dev/Inspector escape hatch: no OAuth, one shared signed-in client. LOCAL ONLY, fail-closed +
    // loopback-bound below — a copied env var must not silently expose an unauthenticated endpoint.
    assertNoAuthAllowed();
    const client = await signedInClient();
    // Dev shared session has full access; workspace from the env (no consent step).
    app.post(
      '/mcp',
      express.json(),
      mcpHandler(() => ({ client, canWrite: true, workspace: workspaceName() })),
    );
    console.warn('⚠  NAM_MCP_DEV_NOAUTH=1 — OAuth disabled, shared dev session (loopback only).');
  } else {
    // Normal: this server is the OAuth 2.1 Authorization Server (Supabase-backed).
    const issuerUrl = new URL(process.env.NAM_MCP_ISSUER_URL ?? `http://127.0.0.1:${port}`);

    // Persist OAuth state to the MCP-owned `mcp` Postgres schema when configured,
    // so clients/tokens survive a restart; otherwise fall back to in-memory.
    let store: AuthStore | undefined;
    let pgStore: PostgresAuthStore | undefined;
    if (process.env.NAM_MCP_DATABASE_URL) {
      await ensureSchema();
      // At-rest encryption is REQUIRED with the persistent store (#1053) — loadEncryptionKey throws
      // if NAM_MCP_ENCRYPTION_KEY is missing/malformed, so a deploy can't silently store sessions
      // in the clear.
      pgStore = new PostgresAuthStore(getPool(), loadEncryptionKey());
      store = pgStore;
      console.log('OAuth store: Postgres (mcp schema) — persistent, sessions encrypted at rest.');
      // Sweep expired codes/tokens/idle grants/pending periodically (#1053) — pruneExpired was never
      // scheduled before, so expired rows accumulated.
      const prune = () => void pgStore!.pruneExpired().catch((e) => console.warn('prune failed:', e));
      setInterval(prune, 60 * 60_000).unref();
    } else {
      console.warn(
        'OAuth store: in-memory — set NAM_MCP_DATABASE_URL to persist clients/tokens across restarts.',
      );
    }
    // Redirect-origin allowlist (#1052): only registrations/logins whose redirect origin is allowed
    // proceed. Fail-closed in a deployment with the list unset — warn loudly so it gets configured.
    const redirectAllowlist = loadRedirectAllowlist();
    if (redirectAllowlist.enforce && redirectAllowlist.origins.length === 0) {
      console.warn(
        '⚠  NAM_MCP_ALLOWED_REDIRECT_ORIGINS is unset in a production/https context — ALL client ' +
          'registrations will be refused until you set it (e.g. "https://claude.ai,https://chatgpt.com").',
      );
    }
    const provider = new SupabaseOAuthProvider({ store, redirectAllowlist });
    // Rate-limit Dynamic Client Registration (#1052) so it can't be spammed to grow the client store.
    const regLimiter = createRateLimiter({ windowMs: 60 * 60_000, max: 20 });
    app.post('/register', regLimiter.middleware);
    app.use(
      mcpAuthRouter({
        provider,
        issuerUrl,
        scopesSupported: [...SUPPORTED_SCOPES],
        resourceName: 'NamWeb',
      }),
    );
    // Two independent limiters (#1050): by IP (blunts one host flooding attempts) AND by account
    // (blunts one email targeted from many hosts). Keeping them separate avoids the ip+email footgun
    // where rotating the target would mint a fresh bucket. Per-process/in-memory — a multi-instance
    // deploy would move these to a shared store (see rateLimit.ts).
    const ipLimiter = createRateLimiter({ windowMs: 5 * 60_000, max: 10 });
    const accountLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 20 });
    app.post(
      '/nam/login',
      ipLimiter.middleware,
      express.urlencoded({ extended: false }),
      (req: Request, res: Response, next: NextFunction) => {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        if (email && !accountLimiter.allow(`email:${email}`)) {
          res.status(429).send('Too many sign-in attempts for this account. Please wait and try again.');
          return;
        }
        next();
      },
      provider.handleLogin,
    );
    app.post(
      '/nam/select-workspace',
      express.urlencoded({ extended: false }),
      provider.handleSelectWorkspace,
    );

    const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(issuerUrl);
    app.post(
      '/mcp',
      express.json(),
      // Require the read baseline on the resource endpoint (#1050) — a write-only or unsupported-scope
      // token can no longer invoke read tools; write tools additionally check nam.write below.
      requireBearerAuth({ verifier: provider, requiredScopes: [SCOPE_READ], resourceMetadataUrl }),
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

  // No-auth mode binds to loopback only — even if the fail-closed guard above were bypassed, the
  // unauthenticated endpoint must not be reachable off-host (#1050). OAuth mode binds all interfaces.
  const host = noAuth ? '127.0.0.1' : '0.0.0.0';
  app.listen(port, host, () => {
    console.log(`NamWeb MCP (read + write, ${noAuth ? 'DEV no-auth' : 'OAuth'}) on ${host}:${port}/mcp`);
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
