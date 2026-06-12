// Small builder for seeding mocked workspace documents in the E2E journeys.
//
// Starts from the same empty structural skeleton the real reset uses (seed.ts) and lets a
// journey declaratively add projects / actions / inbox items, wiring childIds for you. Pure
// data — handed to installRestMock so the app pulls a populated workspace.

import type { NamNode, NodeStatus, WorkspaceDocument } from '../../src/domain/types';
import { emptyDocument } from '../seed';

interface NodeOpts {
  status?: NodeStatus;
  tags?: string[];
  description?: string | null;
  dueAt?: string | null;
  /** Prerequisite node ids — the action is blocked until these are done. */
  blockedBy?: string[];
  /** Parent node id. Defaults: actions under next-actions, projects under projects. */
  under?: string;
}

function makeNode(id: string, title: string, project: boolean, opts: NodeOpts): NamNode {
  return {
    id,
    title,
    description: opts.description ?? null,
    status: opts.status ?? (project ? 'BACKLOG' : 'NEXT'),
    project,
    childIds: [],
    tags: opts.tags ?? [],
    blockedBy: opts.blockedBy ?? [],
    resources: [],
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
    statusChangedAt: null,
    dueAt: opts.dueAt ?? null,
  };
}

export class DocBuilder {
  private doc: WorkspaceDocument = emptyDocument() as WorkspaceDocument;

  private attach(parentId: string, childId: string): void {
    this.doc.nodes[parentId].childIds.push(childId);
  }

  /** Add a project (default under the projects container). */
  project(id: string, title: string, opts: NodeOpts = {}): this {
    const parent = opts.under ?? this.doc.projectsNodeId;
    this.doc.nodes[id] = makeNode(id, title, true, opts);
    this.attach(parent, id);
    return this;
  }

  /** Add an action (default under the next-actions container). */
  action(id: string, title: string, opts: NodeOpts = {}): this {
    const parent = opts.under ?? this.doc.nextActionsNodeId;
    this.doc.nodes[id] = makeNode(id, title, false, opts);
    this.attach(parent, id);
    return this;
  }

  /** Add an inbox item (unprocessed capture). */
  inbox(id: string, title: string, opts: NodeOpts = {}): this {
    this.doc.nodes[id] = makeNode(id, title, false, { status: 'BACKLOG', ...opts });
    this.attach(this.doc.inboxNodeId, id);
    return this;
  }

  /** Register tags so tag-driven surfaces (filters, boards) see them. */
  tags(...names: string[]): this {
    this.doc.registeredTags.push(...names);
    return this;
  }

  build(): WorkspaceDocument {
    return this.doc;
  }
}

/** Convenience: a fresh empty document (structural containers only). */
export function emptyDoc(): WorkspaceDocument {
  return emptyDocument() as WorkspaceDocument;
}
