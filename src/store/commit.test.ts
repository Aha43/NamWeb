import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NamNode, WorkspaceDocument } from '../domain/types';
import type { Intent } from '../domain/mutations';

const { pull, push } = vi.hoisted(() => ({ pull: vi.fn(), push: vi.fn() }));
vi.mock('../sync/workspaceClient', () => ({ pull, push }));

import { commitIntent, type WorkspaceSnapshot } from './commit';

function node(id: string, partial: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...partial,
  };
}

function workspace(withA: boolean): WorkspaceDocument {
  const nodes: Record<string, NamNode> = {
    root: node('root', { childIds: ['inbox', 'projects', 'actions'] }),
    inbox: node('inbox'),
    projects: node('projects'),
    actions: node('actions', { childIds: withA ? ['a'] : [] }),
  };
  if (withA) nodes['a'] = node('a', { status: 'NEXT' });
  return {
    formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox',
    projectsNodeId: 'projects', nextActionsNodeId: 'actions', nodes,
    registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  };
}

const client = {} as SupabaseClient;
const base: WorkspaceSnapshot = { document: workspace(true), version: 4 };
const intent: Intent = { type: 'setStatus', id: 'a', status: 'DONE', now: '2026-06-10T12:00:00' };

beforeEach(() => {
  pull.mockReset();
  push.mockReset();
});

describe('commitIntent', () => {
  it('syncs when the guarded push succeeds first try', async () => {
    push.mockResolvedValueOnce({ kind: 'ok', version: 5 });
    const result = await commitIntent(client, 'default', base, intent);
    expect(result.outcome).toBe('synced');
    expect(result.snapshot.version).toBe(5);
    expect(result.snapshot.document.nodes['a'].status).toBe('DONE');
    expect(pull).not.toHaveBeenCalled();
  });

  it('errors when the first push errors', async () => {
    push.mockResolvedValueOnce({ kind: 'error', message: 'nope' });
    const result = await commitIntent(client, 'default', base, intent);
    expect(result).toMatchObject({ outcome: 'error', message: 'nope' });
    expect(result.snapshot).toBe(base);
  });

  it('replays the intent onto a freshly pulled doc and syncs', async () => {
    push.mockResolvedValueOnce({ kind: 'conflict', remoteVersion: 6 });
    pull.mockResolvedValueOnce({ kind: 'ok', document: workspace(true), version: 6 });
    push.mockResolvedValueOnce({ kind: 'ok', version: 7 });
    const result = await commitIntent(client, 'default', base, intent);
    expect(result.outcome).toBe('synced');
    expect(result.snapshot.version).toBe(7);
    expect(result.snapshot.document.nodes['a'].status).toBe('DONE');
  });

  it('reloads when the target node vanished remotely', async () => {
    push.mockResolvedValueOnce({ kind: 'conflict', remoteVersion: 6 });
    pull.mockResolvedValueOnce({ kind: 'ok', document: workspace(false), version: 6 });
    const result = await commitIntent(client, 'default', base, intent);
    expect(result.outcome).toBe('reloaded');
    expect(result.snapshot.version).toBe(6);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('reloads (bounded) when the replay still conflicts', async () => {
    push.mockResolvedValueOnce({ kind: 'conflict', remoteVersion: 6 });
    pull.mockResolvedValueOnce({ kind: 'ok', document: workspace(true), version: 6 });
    push.mockResolvedValueOnce({ kind: 'conflict', remoteVersion: 8 });
    const result = await commitIntent(client, 'default', base, intent);
    expect(result.outcome).toBe('reloaded');
    expect(result.snapshot.version).toBe(6);
  });

  it('errors when the conflict pull fails', async () => {
    push.mockResolvedValueOnce({ kind: 'conflict', remoteVersion: 6 });
    pull.mockResolvedValueOnce({ kind: 'error', message: 'offline' });
    const result = await commitIntent(client, 'default', base, intent);
    expect(result).toMatchObject({ outcome: 'error', message: 'offline' });
  });

  it('re-inserts when the row vanished entirely', async () => {
    push.mockResolvedValueOnce({ kind: 'conflict', remoteVersion: 6 });
    pull.mockResolvedValueOnce({ kind: 'noRemote' });
    push.mockResolvedValueOnce({ kind: 'ok', version: 1 });
    const result = await commitIntent(client, 'default', base, intent);
    expect(result.outcome).toBe('synced');
    expect(result.snapshot.version).toBe(1);
  });
});
