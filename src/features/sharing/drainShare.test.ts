import { describe, expect, it, vi } from 'vitest';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import { guestIdMap } from '@/domain/shareContent';

const service = {
  claimDrainableEvents: vi.fn(),
  deleteEvents: vi.fn(),
  fetchLeftoverDrained: vi.fn(),
};
vi.mock('./shares', async (orig) => ({
  ...(await orig<typeof import('./shares')>()),
  claimDrainableEvents: (...a: unknown[]) => service.claimDrainableEvents(...a),
  deleteEvents: (...a: unknown[]) => service.deleteEvents(...a),
  fetchLeftoverDrained: (...a: unknown[]) => service.fetchLeftoverDrained(...a),
}));

import { drainShare } from './drainShare';
import { DRAINABLE_KINDS } from './shares';

function node(id: string, p: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...p,
  };
}

function docWith(value: string): WorkspaceDocument {
  return {
    formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox', projectsNodeId: 'projects', nextActionsNodeId: 'actions',
    nodes: {
      root: node('root', { childIds: ['inbox', 'projects', 'actions'] }),
      inbox: node('inbox'),
      projects: node('projects', { childIds: ['trip'] }),
      actions: node('actions'),
      trip: node('trip', { project: true, childIds: ['a1'] }),
      a1: node('a1', { resources: [{ type: 'COUNT', value, description: 'jars', guestEditable: true }] }),
    },
    registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  };
}

const SHARE = { share_id: 'sid1', project_id: 'trip', token: 'tok123' };
const pseudoA1 = [...guestIdMap(docWith('0/12'), 'trip', 'tok123').entries()].find(([, r]) => r === 'a1')![0];

describe('drainShare (#821/#832)', () => {
  it('plans against the LIVE document, resolved AFTER the claim (#821/F2)', async () => {
    // A sync refetch replaces the doc DURING the claim round-trip: the counter moved 10→11.
    let doc = docWith('10/12');
    service.claimDrainableEvents.mockImplementation(async () => {
      doc = docWith('11/12');
      return [{ id: 7, node_id: pseudoA1, res_index: 0, delta: 1, answer: null }];
    });
    service.deleteEvents.mockResolvedValue(undefined);
    service.fetchLeftoverDrained.mockResolvedValue([]);
    const dispatch = vi.fn();
    const landed = await drainShare(() => doc, dispatch, async () => true, SHARE);
    expect(landed).toBe(1);
    // The claim is the kind-filtered RPC (#832/P1) — unknown kinds never come back to be deleted.
    expect(service.claimDrainableEvents).toHaveBeenCalledWith('sid1', DRAINABLE_KINDS);
    // A stale plan would guard on '10/12' and silently no-op against the fresh doc.
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ expectedValue: '11/12' }));
    // Landed events are deleted — drained rows must not ratchet the lifetime cap (#821).
    expect(service.deleteEvents).toHaveBeenCalledWith([7]);
  });

  it('deletes only after DURABLE success — a failed flush keeps the rows (#823/P1)', async () => {
    service.claimDrainableEvents.mockResolvedValue([{ id: 7, node_id: pseudoA1, res_index: 0, delta: 1, answer: null }]);
    service.fetchLeftoverDrained.mockResolvedValue([]);
    service.deleteEvents.mockClear();
    const dispatch = vi.fn();
    await drainShare(() => docWith('10/12'), dispatch, async () => false, SHARE);
    expect(dispatch).toHaveBeenCalled(); // the intents went out (optimistic + Retry own them)
    expect(service.deleteEvents).not.toHaveBeenCalled(); // but nothing is deleted
  });

  it('sweeps dead leftover drained rows before claiming (#823/P2)', async () => {
    service.claimDrainableEvents.mockResolvedValue([]);
    service.fetchLeftoverDrained.mockResolvedValue([3, 4]);
    service.deleteEvents.mockClear().mockResolvedValue(undefined);
    await drainShare(() => docWith('10/12'), vi.fn(), async () => true, SHARE);
    expect(service.deleteEvents).toHaveBeenCalledWith([3, 4]);
  });

  it('a lost claim (other device won the split) applies and deletes nothing', async () => {
    service.claimDrainableEvents.mockResolvedValue([]); // the RPC returned no rows for us
    service.fetchLeftoverDrained.mockResolvedValue([]);
    service.deleteEvents.mockClear();
    const dispatch = vi.fn();
    expect(await drainShare(() => docWith('10/12'), dispatch, async () => true, SHARE)).toBe(0);
    expect(dispatch).not.toHaveBeenCalled();
    expect(service.deleteEvents).not.toHaveBeenCalled();
  });
});
